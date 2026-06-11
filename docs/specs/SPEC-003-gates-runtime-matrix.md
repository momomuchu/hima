# SPEC-003 — Gates, verdicts et dégradation par runtime

status: draft
date: 2026-06-11
owner: noyau
source: PROPOSITION.md §3/§4/§12, ADR-0002, ADR-0003,
        packages/storage-core/src/capability-map.ts,
        packages/behavior-core/src/types.ts,
        packages/gates-core/src/evaluate-gate.ts,
        packages/gates-core/src/evaluate-stop.ts
cross-refs: SPEC-001-package-contracts.md, SPEC-007-adapter-hermes.md

---

## Objet

Ce document spécifie, pour chacun des 9 GateTypes canoniques (ADR-0002) :
1. Le déclencheur et les entrées attendues.
2. Les verdicts possibles (`allow` / `warn` / `block`) avec leurs conditions.
3. Le comportement par runtime (claude / codex / hermes) selon la capability-map réelle.
4. Le contrat de dégradation : que fait hima quand une gate est `degraded` ou `absent`.
5. La propagation des règles aux sub-agents Hermes (trou `skip_context_files`).

Chaque exigence est taggée :
- importance : `[CRITICAL]` `[HIGH]` `[MEDIUM]` `[LOW]`
- ordre : `[BLOCKS:critical]` `[BLOCKS:high]` `[BLOCKS:low]` `[BLOCKS:none]`

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] La capability-map (`@hima/storage-core/capability-map.ts`)
  est la source autoritaire de vérité pour `level` (`supported` / `degraded` / `absent`)
  de chaque GateType × runtime. Aucune implémentation ne peut déclarer un niveau différent
  de celui de la map sans ADR et mise à jour de la map.

- [CRITICAL][BLOCKS:critical] Contrat de dégradation universel : quand `level = "degraded"`
  (hook observable mais non bloquant), la gate DOIT produire un verdict `warn` ou déclencher
  une gate de compensation au `pre_tool` ou `user_prompt` du tour suivant. Elle ne peut
  **jamais** prétendre avoir bloqué quand le hook sous-jacent ne peut pas bloquer.

- [CRITICAL][BLOCKS:critical] Contrat d'absence universel : quand `level = "absent"` (aucun
  hook natif), la gate ne tire pas sur ce runtime. La stratégie de compensation (ex.
  propagation via `delegate_task`) est documentée dans la capability-map et dans SPEC-007.
  Prétendre qu'une gate `absent` a évalué est une violation de contrat.

- [CRITICAL][BLOCKS:high] Toute gate `block` sur un runtime `degraded` ou `absent` qui ne
  peut pas bloquer nativement DOIT enregistrer un `RunSetEvent` de type `GATE_EVALUATED`
  avec `decision: "warn"` (pas `"block"`) pour ne pas induire de faux positifs dans
  `getPolicyEventBlockers` (evaluate-stop.ts).

---

## HIGH items — Matrice GateType × runtime × verdict

### `session_start`

- **Déclencheur** : ouverture de session (avant tout message utilisateur).
- **Entrées** : profil de démarrage, `runtimeBindings`.
- **Verdicts possibles** :
  - `allow` : runtime connu, bindings initialisés.
  - `warn` : runtime dégradé ou bindings partiels (log uniquement).
  - `block` : interdit sur tous les runtimes actuels (hook non bloquant partout).
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | degraded  | SessionStart existe mais ne peut pas bloquer |
  | codex   | degraded  | idem |
  | hermes  | degraded  | `on_session_start` observable uniquement |
- [HIGH][BLOCKS:high] Sur les trois runtimes, `session_start` est toujours `degraded`.
  La gate produit au maximum un `warn`. L'initialisation des `runtimeBindings` dans le
  `runSet` est la seule action compensatoire ; elle s'exécute dans le plugin avant
  la première gate bloquante.

### `user_prompt`

- **Déclencheur** : soumission d'un message utilisateur (avant envoi au LLM).
- **Entrées** : `promptContent`, `currentRisk`, `runSet.policy`.
- **Verdicts possibles** :
  - `allow` : prompt conforme, criticality classifiée.
  - `warn` : signal de forçage détecté mais non bloquant (ex. riskClass sous-estimé).
  - `block` : prompt injection détectée (`PROMPT_INJECTION_DETECTED`), ou magic-word
    intercepté et requérant redirection.
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | supported | PreToolUse peut bloquer |
  | codex   | supported | idem |
  | hermes  | supported | `pre_llm_call` → `{"action":"block"}` |
- [HIGH][BLOCKS:high] `user_prompt` est `supported` partout. C'est la gate principale
  de classification de criticality et de détection de magic-words sur Hermes (voir trou
  `hermes-magic-words-gateway-only` : la détection KEYWORD_DETECTORS vit dans ce hook).

### `pre_tool`

- **Déclencheur** : avant exécution d'un tool call (Write, Edit, Bash, etc.).
- **Entrées** : `toolName`, `toolInput`, `sessionReadSet`, `currentRisk`.
- **Verdicts possibles** :
  - `allow` : outil autorisé, zone de write valide.
  - `warn` : zone sensible mais autorisée avec log.
  - `block` : `FORBIDDEN_WRITE_ZONE`, `SECRET_IN_PLAINTEXT`, `BYPASS_ATTEMPTED`,
    `PRE_BUILD_DISCIPLINE`, `SUBAGENT_TOOL_DENIED`, `BLOCKED_COMMAND_PATTERN`.
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | supported | PreToolUse peut bloquer |
  | codex   | supported | idem |
  | hermes  | supported | `pre_tool_call` → `{"action":"block"}` |
- [HIGH][BLOCKS:high] `pre_tool` est `supported` partout et est la gate de blocage
  principale. Sur Hermes, c'est aussi le point de propagation des règles hima aux
  sub-agents via `delegate_task` (voir §Propagation sub-agents Hermes).

### `post_tool`

- **Déclencheur** : après résultat d'un tool call.
- **Entrées** : `toolName`, `toolOutput`, `currentRisk`.
- **Verdicts possibles** :
  - `allow` : résultat conforme.
  - `warn` : suppression sans justification détectée (`DONE_WITHOUT_EVIDENCE` en warn).
  - `block` : interdit (hook non bloquant sur tous les runtimes v2).
- **Capability** :
  | Runtime | Level    | Note |
  |---------|----------|------|
  | claude  | degraded | PostToolUse observable uniquement |
  | codex   | degraded | idem |
  | hermes  | degraded | `post_tool_call` observable uniquement |
- [HIGH][BLOCKS:high] `post_tool` est `degraded` partout. Les violations critiques
  détectées ici sont enregistrées comme `RunSetEvent { type: "GATE_EVALUATED",
  decision: "warn", payload: { finalState: "BLOCKED_POLICY", policyEvent: { status:
  "unresolved", severity: "critical", resolvableByEvidence: true } } }`.
  `evaluateStop` les remonte comme bloqueurs au prochain `stop`.

### `pre_compact`

- **Déclencheur** : avant compaction du contexte par le runtime.
- **Entrées** : état boulder courant, `currentRisk`, snapshot pré-compaction.
- **Verdicts possibles** :
  - `allow` : état boulder présent et cohérent.
  - `block` : état manquant avant compaction (`COMPACTION_CONTINUITY_MISMATCH`).
    Fail-closed : si l'état ne peut être sauvegardé, bloquer la compaction.
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | supported | PreCompact peut bloquer |
  | codex   | supported | idem |
  | hermes  | supported | `pre_compact` peut bloquer |
- [HIGH][BLOCKS:low] `pre_compact` est `supported` partout. Bypass jamais autorisé
  (ADR-0002 §Consequences).

### `post_compact`

- **Déclencheur** : après restauration du contexte post-compaction.
- **Entrées** : snapshot pré-compaction, état restauré, `currentRisk`.
- **Verdicts possibles** :
  - `allow` : route restaurée correspond au snapshot.
  - `warn` : divergence mineure (log).
  - `block` : `COMPACTION_CONTINUITY_MISMATCH` si la route restaurée diverge sous M/H/C.
- **Capability** :
  | Runtime | Level    | Note |
  |---------|----------|------|
  | claude  | degraded | PostCompact observable uniquement |
  | codex   | degraded | idem |
  | hermes  | degraded | `post_compact` observable uniquement |
- [HIGH][BLOCKS:low] `post_compact` est `degraded` partout. La vérification de
  continuité est enregistrée ; un écart critique est reporté comme bloqueur au
  prochain `stop` via le mécanisme `policyEvent`.

### `stop`

- **Déclencheur** : signal de fin de session (agent sur le point de s'arrêter).
- **Entrées** : `runSet.evidence`, `currentRisk`, `runSet.events` (policy blockers).
- **Verdicts possibles** :
  - `allow` : evidence suffisant, pas de policy blockers → `DONE_VERIFIED`.
  - `warn` : riskClass T/L, `requiresEvidenceBeforeStop = false` → `DONE_VERIFIED`
    sans vérification d'evidence (bug fix evaluate-stop.ts).
  - `block` : evidence insuffisant pour M/H/C → `BLOCKED_POLICY` ; human validation
    manquante → `BLOCKED_NEEDS_USER` ; policy blockers non résolus →
    `BLOCKED_POLICY` ; runtime binding non bloquant pour M+ →
    `BLOCKED_RUNTIME_MISSING`.
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | supported | Stop hook bloquant |
  | codex   | supported | idem |
  | hermes  | degraded  | `on_session_end` non bloquant |
- [HIGH][BLOCKS:critical] **Dégradation stop sur Hermes** : `on_session_end` ne peut
  pas bloquer. La gate finale `DONE/PARTIAL/BLOCKED` est **reportée au tour suivant**
  via `pre_tool_call` ou `pre_llm_call`. Mécanisme :
  1. `on_session_end` enregistre le verdict dans `.hima/state/run-set.json`.
  2. Au prochain `pre_tool_call` ou `pre_llm_call`, le plugin relit le run-set et
     injecte le verdict en user-message si le verdict était `block`.
  3. Si la session se termine sans tour suivant (session réellement fermée),
     le verdict reste dans le run-set pour audit ultérieur — `FinalState` est
     `BLOCKED_POLICY` ou `DONE_WITH_GAPS`, jamais `DONE_VERIFIED`.

### `subagent_start`

- **Déclencheur** : avant spawn d'un sub-agent.
- **Entrées** : `SubagentRunRecord { id, role, allowedTools, scope }`, `currentRisk`.
- **Verdicts possibles** :
  - `allow` : rôle autorisé, tools dans la liste blanche, scope défini.
  - `block` : `SUBAGENT_CONTRACT_INCOMPLETE` (pas de scope/role), `SUBAGENT_SPAWN_LIMIT`
    (dépassement du quota), `WATCHER_NOT_REGISTERED` (H/C sans watcher).
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | supported | SubagentStart bloquant |
  | codex   | absent    | Pas de hook natif |
  | hermes  | absent    | Pas de hook natif |
- [HIGH][BLOCKS:critical] **Absence subagent_start sur Hermes et Codex** : pas de hook
  natif. La compensation contractuelle est `pre_tool_call / delegate_task` : quand le
  plugin détecte un `delegate_task` tool call, il évalue les contraintes de
  `subagent_start` (rôle, scope, tools) et peut bloquer via `pre_tool_call`. Voir
  SPEC-007 §Propagation sub-agents.

### `subagent_stop`

- **Déclencheur** : fin d'un sub-agent (résultat disponible).
- **Entrées** : `SubagentRunRecord`, résultat, `currentRisk`.
- **Verdicts possibles** :
  - `allow` : livrables présents, trace disponible.
  - `warn` : livrables partiels (`SUBAGENT_DELIVERABLES_MISSING`).
  - `block` : interdit (hook non bloquant partout sauf Claude).
- **Capability** :
  | Runtime | Level     | Note |
  |---------|-----------|------|
  | claude  | supported | SubagentStop bloquant |
  | codex   | absent    | Pas de hook natif |
  | hermes  | degraded  | `subagent_stop` observable, non bloquant |
- [HIGH][BLOCKS:high] Sur Hermes, `subagent_stop` est `degraded`. Les violations
  détectées (livrables manquants, pas de trace) sont enregistrées en `warn` dans le
  run-set. Le mécanisme de déduplication par `(agentId, event)` est obligatoire pour
  éviter le rejoue multiple observé en session (bug PROPOSITION.md §12 — hook
  SubagentStop ayant rejoué ≥6 fois le même agentId).

---

## HIGH items — Propagation des règles aux sub-agents Hermes

- [HIGH][BLOCKS:critical] **Trou `skip_context_files`** : les sub-agents Hermes ont
  `skip_context_files=True` hardcodé. Les règles injectées via `.hermes.md` (profil
  hima) ne se propagent **pas** automatiquement aux agents enfants.

- [HIGH][BLOCKS:critical] Stratégie de compensation contractuelle (PROPOSITION.md §4,
  capability-map.ts `hermes-subagents-skip-context-files`) :
  1. Le plugin hima intercepte tout tool call `delegate_task` (ou équivalent spawn) via
     `pre_tool_call`.
  2. Il injecte dans les `instructions` du sub-agent les règles hima critiques
     (criticality, gates, modèle autorisé) comme chaîne inline — pas via fichier context.
  3. Le `pre_tool_call` peut bloquer le spawn si les instructions injectées dépassent
     la limite ou si le rôle n'est pas autorisé.
  4. Cette injection est la seule garantie que les behaviors hima s'appliquent aux
     sub-agents Hermes.

- [HIGH][BLOCKS:high] Les règles à propager obligatoirement à tout sub-agent Hermes :
  - Modèle autorisé (jamais flagship/Opus sans autorité explicite).
  - RiskClass courante et protocole minimal associé.
  - Interdiction de spawner des sous-sous-agents (profondeur max = 1 depuis le main agent).
  - Verify obligatoire en fin de tâche.

---

## MEDIUM items (convergence detail)

- [MEDIUM][BLOCKS:low] `GateViolationType` complet (défini dans behavior-registry.ts) :
  `SECRET_IN_PLAINTEXT`, `FORBIDDEN_WRITE_ZONE`, `BYPASS_ATTEMPTED`,
  `MIGRATION_WITHOUT_ADR`, `MISSING_FALSIFIES_IF`, `DONE_WITHOUT_EVIDENCE`,
  `AI_SLOP_CLEANUP_EVIDENCE_MISSING`, `MISSING_HUMAN_VALIDATION`,
  `SUBAGENT_WITHOUT_TRACE`, `SUBAGENT_DELIVERABLES_MISSING`, `SUBAGENT_SPAWN_LIMIT`,
  `SUBAGENT_TOOL_DENIED`, `COMPACTION_CONTINUITY_MISMATCH`, `BLOCKED_COMMAND_PATTERN`,
  `CLASS_UNDERESTIMATED`, `PROMPT_INJECTION_DETECTED`, `RUNTIME_BINDING_UNAVAILABLE`,
  `UNRESOLVED_POLICY_VIOLATION`, `INVALID_PHASE_TRANSITION`, `PRE_BUILD_DISCIPLINE`,
  `SUBAGENT_CONTRACT_INCOMPLETE`, `WATCHER_NOT_REGISTERED`, `CYCLE_ABORT`,
  `OVERRIDE_FORBIDDEN_FOR_RISK_CLASS`, `OVERRIDE_FORBIDDEN_FLOOR_REDUCTION`.

- [MEDIUM][BLOCKS:low] Le contrat de déduplication `subagent_stop` : chaque gate
  `subagent_stop` est indexée par `(agentId, gateType)` dans le run-set. Si un event
  `GATE_EVALUATED` pour ce couple existe déjà, le plugin l'ignore sans réévaluer.

- [MEDIUM][BLOCKS:none] Le mode `checkpoint` (evaluate-stop.ts) : en phase
  `discovery` ou `cadrage`, `stop` est bloqué jusqu'à présence de `hook_decision`
  dans l'evidence set. Ce mode est indépendant du runtime.

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] `getLimitedGates(runtime)` de `@hima/storage-core` retourne
  tous les gates `degraded` ou `absent` pour un runtime. Utile pour les logs de
  démarrage du plugin Hermes.

- [LOW][BLOCKS:none] La fonction `assessRuntimeBinding` (importée de `@harness/core`
  dans evaluate-stop.ts) vérifie que le binding de `stop` peut bloquer pour M+.
  Sur Hermes, cette vérification retourne `blockingProblem: true` pour tout riskClass
  ≥ M, ce qui force `BLOCKED_RUNTIME_MISSING` si la gate stop est appelée directement
  sans le mécanisme de report.

---

## Falsifies-If

```
kill-condition: Une gate déclarée "block" dans GateResult est produite par un hook
  dont level = "degraded" ou "absent" dans la capability-map, sans mécanisme de
  compensation documenté et actif.
checkpoint-date: 2026-07-15
evidence-anchor: packages/storage-core/src/capability-map.ts,
  packages/gates-core/src/evaluate-stop.ts
on-fail: Corriger le verdict de la gate (warn au lieu de block) et documenter la
  stratégie de compensation dans capability-map.ts avant toute Wave suivante.

kill-condition: Le mécanisme de report du verdict stop sur Hermes (on_session_end →
  pre_tool_call/pre_llm_call tour suivant) n'est pas implémenté et les sessions Hermes
  à risque M/H/C se terminent sans verdict de gate.
checkpoint-date: 2026-07-01
evidence-anchor: packages/adapter-hermes-v2/src/hook-bindings.ts, SPEC-007
on-fail: Bloquer Wave 3 ; implémenter le report avant tout test d'acceptation
  "session complète parler→classification→/ulw→verify".

kill-condition: Les sub-agents Hermes exécutent des tool calls interdits faute de
  propagation des règles hima (trou skip_context_files non compensé).
checkpoint-date: 2026-07-15
evidence-anchor: .planning/restructure/PROPOSITION.md §4, capability-map.ts
  hermes-subagents-skip-context-files
on-fail: Activer l'injection inline dans pre_tool_call/delegate_task et ajouter un
  test d'acceptation "sub-agent bloqué sur tool interdit".
```
