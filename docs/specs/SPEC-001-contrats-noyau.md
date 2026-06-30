# SPEC-001 — Contrats noyau : types canoniques et dispatch partagé

status: draft
date: 2026-06-11
owner: hima-spec-wave15
source: PROPOSITION.md §1/3/4/12, ADR-0002, ADR-0003, packages/behavior-core/src/types.ts,
        packages/gates-core/src/, packages/core/src/gates/evaluate-gate.ts,
        packages/core/src/policy/baseline-policy.ts

---

## Objet

Ce document spécifie le contrat des types partagés et du dispatch de gates utilisés par TOUS
les packages hima. Il est la référence de vérité pour toute implémentation Wave 2/3 et pour
les tests d'acceptation.

Chaque exigence est taggée sur deux axes indépendants :
- importance : `[CRITICAL]` `[HIGH]` `[MEDIUM]` `[LOW]`
- ordre d'exécution : `[BLOCKS:critical]` `[BLOCKS:high]` `[BLOCKS:low]` `[BLOCKS:none]`

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] Le jeu canonique de `GateType` est exactement 9 valeurs :
  `session_start`, `user_prompt`, `pre_tool`, `post_tool`, `pre_compact`, `post_compact`,
  `stop`, `subagent_start`, `subagent_stop`. Toute implémentation ne respectant pas cette
  liste exacte doit être rejetée à la revue. (Source : ADR-0002, confirmé par
  `behavior-core/src/types.ts` et `storage-core/src/capability-map.ts`.)

- [CRITICAL][BLOCKS:critical] Le type `GateDecision` est l'union `"allow" | "warn" | "block"`.
  Ces trois valeurs sont les seules décisions possibles à la sortie d'une gate. Aucune
  valeur supplémentaire ne peut être introduite sans ADR.

- [CRITICAL][BLOCKS:critical] Le type `RiskClass` est l'union ordonnée `"T" | "L" | "M" | "H" | "C"`.
  L'ordre est total : T < L < M < H < C. La fonction `riskAtLeast(current, minimum)` est
  l'unique point d'accès à la comparaison ; toute comparaison directe par chaîne est interdite.
  (Source : `behavior-core/src/risk-class.ts`.)

- [CRITICAL][BLOCKS:critical] Le type `FinalState` est l'union :
  `"DONE_VERIFIED" | "DONE_WITH_GAPS" | "BLOCKED_NEEDS_USER" | "BLOCKED_RUNTIME_MISSING" |
  "BLOCKED_POLICY" | "MAX_ATTEMPTS_REACHED" | "LOOP_DETECTED" | "CANCELLED"`.
  Ces valeurs sont les seules déclarations d'état de fin de run. (Source : `behavior-core/src/types.ts`,
  `core/src/types/canonical.ts`.)

- [CRITICAL][BLOCKS:critical] **Propriétaire des types canoniques : `@hima/behavior-core`.**
  Décision tranchée ici (voir §Contradictions pour la discussion) : `GateType`, `GateDecision`,
  `RiskClass`, `FinalState` vivent dans `packages/behavior-core/src/types.ts` et
  `packages/behavior-core/src/risk-class.ts`. Les autres packages importent depuis
  `@hima/behavior-core`, jamais depuis `@harness/core` directement (sauf `@hima/gates-core`
  pendant la période de transition — voir §Contrat de sortie de la dette de transition).
  Justification : `behavior-core` est le seul package CORE pur-TS sans dépendance sur le
  monolithe legacy ; il peut être importé par tout autre package sans créer de cycle.

- [CRITICAL][BLOCKS:high] La signature contractuelle de `evaluateGate` est :
  ```ts
  function evaluateGate(
    context: GateEvaluationContext,
    event: GateEvent,
  ): GateResult
  ```
  Elle est synchrone, pure en termes d'effets de bord observables (pas d'I/O réseau, pas
  d'écriture fichier), et ne lève jamais d'exception observable : toute erreur interne
  produit un `GateResult` avec `decision: "block"` et `violationType` approprié.

- [CRITICAL][BLOCKS:high] La signature contractuelle de `evaluateStop` (implémentation locale
  dans `gates-core`) est :
  ```ts
  function evaluateStop(
    context: GateEvaluationContext,
    event: GateEvent,
  ): GateResult
  ```
  Invariant absolu : un appel avec `context.currentRisk.risk_class ∈ {"T","L"}` ET
  `RISK_POLICY[riskClass].requiresEvidenceBeforeStop === false` RETOURNE TOUJOURS
  `{ decision: "allow", finalState: "DONE_VERIFIED" }` si et seulement si aucun
  `policyEventBlocker` critique non résolu n'est présent et que `enforceBlockingRuntimeBinding`
  retourne `null`. (Correction du bug diagnostiqué dans PROPOSITION.md §8/§12 :
  `evaluateStop()` de `@harness/core` ignorait `requiresEvidenceBeforeStop`.)

---

## HIGH items

- [HIGH][BLOCKS:high] La structure `GateEvaluationContext` est définie dans `@harness/core`
  (source de vérité `packages/core/src/gates/evaluate-gate.ts`). Les packages hima
  consomment ce type par import de type uniquement (`import type`). Elle contient :
  ```ts
  interface GateEvaluationContext {
    projectRoot: string
    state: PlanningStateFile
    currentRisk: CurrentRiskFile
    runSet: RunSetFile
    sessionReadSet?: ReadonlySet<string>        // BEH-010
    sessionReadHashMap?: ReadonlyMap<string, string>  // BEH-010 H1
  }
  ```

- [HIGH][BLOCKS:high] La structure `GateEvent` est définie dans `@harness/core`
  (`packages/core/src/schemas/gate-event.schema.ts`). Elle contient :
  ```ts
  interface GateEvent {
    gateType: GateType
    toolName?: string
    toolInput?: unknown
    toolOutput?: unknown
    promptContent?: string
    metadata?: Record<string, unknown>
  }
  ```

- [HIGH][BLOCKS:high] La structure `GateResult` est définie dans `@harness/core`
  (`packages/core/src/gates/evaluate-gate.ts`). Champs obligatoires : `decision`, `gateType`,
  `reason`. Champs optionnels clés : `contextInjection`, `violationType`, `finalState`,
  `missingEvidenceItems`, `evidenceAnchors`, `policyEvent`, `subagentRecord`, `gateDecisionRecords`.

- [HIGH][BLOCKS:high] **Graphe de dépendances inter-packages (sans cycle) :**
  ```
  @hima/behavior-core     → aucune dépendance hima (pur TS)
  @hima/storage-core      → aucune dépendance hima (pur TS)
  @hima/gates-core        → @hima/behavior-core, @harness/core (transition)
  @hima/adapter-hermes-v2 → @hima/storage-core
  @hima/hima-cli          → @hima/gates-core, @harness/core
  ```
  Règle : aucun package CORE (`behavior-core`, `storage-core`, `gates-core`) ne peut importer
  depuis un package ADAPTER (`adapter-hermes-v2`). Les adapters importent depuis les cores,
  jamais l'inverse.

- [HIGH][BLOCKS:high] `evaluateGate` dans `@hima/gates-core` est le point d'entrée unique pour
  le dispatch. Il délègue `stop` à l'implémentation locale `evaluateStop` et toutes les autres
  gates à `coreEvaluateGate` de `@harness/core`. Aucun consommateur externe ne doit appeler
  directement `coreEvaluateGate` de `@harness/core`.

- [HIGH][BLOCKS:low] Invariant `evaluateGate` — exhaustivité : tout `GateType` produit un
  `GateResult`. L'implémentation `@harness/core` a un cas `default` qui retourne `allow` pour
  les types inconnus ; ce cas ne doit jamais être atteint en production (les 9 gates sont
  toutes traitées explicitement).

- [HIGH][BLOCKS:low] Invariants de décision risk-scaled :
  - `riskAtLeast(riskClass, "M")` → les violations de policy produisent `decision: "block"` ;
    en dessous de M, elles produisent `decision: "warn"`.
  - Exception : `SECRET_IN_PLAINTEXT`, `BYPASS_ATTEMPTED` non-résolu, `UNRESOLVED_POLICY_VIOLATION`
    produisent toujours `"block"` quelle que soit la risk class.

- [HIGH][BLOCKS:low] Invariant `evaluateStop` — modes :
  - `mode ∈ {"bypass", "full-bypass"}` (M0) : ignore la vérification d'évidence ; retourne
    `allow + DONE_VERIFIED` sauf si `policyEventBlockers` présents ou `runtimeBinding` bloquant.
  - `mode = "checkpoint"` (M2) : bloque avec `MISSING_HUMAN_VALIDATION` en phase pre-arch si
    aucune évidence `hook_decision` acceptée.
  - Tous les autres modes (M1, M3, M4) : vérification d'évidence complète.

- [HIGH][BLOCKS:none] Le type `GateViolationType` est l'union discriminante de toutes les
  violations possibles (définie dans `@harness/core/gates/evaluate-gate.ts`). Valeurs clés pour
  hima v2 : `DONE_WITHOUT_EVIDENCE`, `BYPASS_ATTEMPTED`, `SECRET_IN_PLAINTEXT`,
  `MISSING_HUMAN_VALIDATION`, `RUNTIME_BINDING_UNAVAILABLE`, `UNRESOLVED_POLICY_VIOLATION`.

---

## MEDIUM items

- [MEDIUM][BLOCKS:low] `behavior-core` exporte aussi `GATE_TYPES` (array readonly),
  `GATE_DECISIONS`, `FINAL_STATES`, `RISK_CLASSES`, `RISK_CLASS_RANK` comme constantes
  runtime — pas uniquement des types. Ces constantes doivent être cohérentes avec les types
  (dérivées via `as const`).

- [MEDIUM][BLOCKS:low] `storage-core` duplique la définition de `GateType` et `GATE_TYPES`
  dans `capability-map.ts`. Cette duplication est acceptable pendant la période de transition
  (Wave 1→2), mais DOIT être éliminée en Wave 2 au profit d'une dépendance sur
  `@hima/behavior-core`. (Source de la duplication : `packages/storage-core/src/capability-map.ts`
  lignes 14-26, identique à `packages/behavior-core/src/types.ts` lignes 3-15.)

- [MEDIUM][BLOCKS:low] `hima-cli/src/types.ts` définit son propre `GateType` et `Decision`
  localement avec un commentaire indiquant que c'est temporaire. Cette définition locale doit
  disparaître en Wave 2 au profit de l'import depuis `@hima/behavior-core`. La liste locale
  omet `pre_compact` et `post_compact` (7 valeurs vs 9 canoniques) — c'est une divergence
  active dans le code livré Wave 1.

- [MEDIUM][BLOCKS:none] `RISK_POLICY` (défini dans `@harness/core/policy/baseline-policy.ts`)
  spécifie par RiskClass : `allowedModes`, `requiresEvidenceBeforeStop`,
  `requiresHumanCheckpoint`, `requiresSubagentGatesWhenDelegating`, `mandatoryEvidenceKeys`.
  Ces valeurs sont lues par `evaluateStop` dans `gates-core`. Elles ne sont pas re-définies
  dans `behavior-core` — elles restent dans `@harness/core` jusqu'à la sortie complète de la
  dette de transition.

- [MEDIUM][BLOCKS:none] Le comportement de `mergeWithBehaviorVerdict` (dans `@harness/core`)
  s'applique après chaque gate : les behaviors BEH-xxx peuvent élever `allow → warn` ou
  `allow/warn → block`, mais ne peuvent jamais abaisser un `block` existant.

---

## LOW items (détail de convergence)

- [LOW][BLOCKS:none] `QualityDimension` (`"security" | "tests" | "review" | "evidence" |
  "suppression"`) est défini dans `behavior-core` et `core/canonical.ts` de façon cohérente.
  Aucune divergence détectée.

- [LOW][BLOCKS:none] `CompletionStatus` (`"DONE_VERIFIED" | "DONE_UNTESTED" |
  "ATTEMPTED_UNCONFIRMED"`) est distinct de `FinalState` : il qualifie une entrée d'évidence,
  pas l'état de fin de run.

- [LOW][BLOCKS:none] `SUBAGENT_ROLES`, `CLAIM_SOURCES`, `FAILURE_POLICY_ACTIONS` sont des
  enums annexes définis dans `core/canonical.ts`. Ils ne sont pas encore exposés par
  `behavior-core` ; à migrer en Wave 2 si un package CORE en a besoin.

---

## Contrat de sortie de la dette de transition

### Situation actuelle (Wave 1)

`@hima/gates-core/src/evaluate-gate.ts` délègue 8 gates sur 9 à `coreEvaluateGate` de
`@harness/core`. Seule la gate `stop` est réimplémentée localement. Concrètement :

```
evaluateGate(ctx, event)
  if event.gateType === "stop"  → evaluateStop (local, fixé)
  else                          → coreEvaluateGate (monolithe @harness/core)
```

### Critères de sortie (Wave 2/3)

- [HIGH][BLOCKS:high] Chaque gate doit disposer d'une implémentation autonome dans
  `packages/gates-core/src/gates/<gate-name>.ts`. La dépendance sur `coreEvaluateGate` de
  `@harness/core` est éliminée quand les 9 fichiers existent et passent les tests.

- [HIGH][BLOCKS:low] L'ordre de portage recommandé (risque décroissant de régression) :
  1. `pre_tool` (gate la plus active, écritures + hard limits)
  2. `post_tool` (détection de secrets + DONE_WITHOUT_EVIDENCE)
  3. `user_prompt` (bypass detection)
  4. `subagent_start` / `subagent_stop` (contract enforcement)
  5. `session_start` (context injection)
  6. `pre_compact` / `post_compact` (continuité de compaction)

- [MEDIUM][BLOCKS:low] Pendant la transition, `@hima/gates-core` PEUT importer depuis
  `@harness/core`. Cette exception est documentée dans le commentaire d'en-tête de
  `evaluate-gate.ts` et expire à la fin de Wave 3.

- [MEDIUM][BLOCKS:none] La dépendance transitoire doit être tracée dans un TODO avec
  référence au critère de sortie : `// TODO(wave3-exit): replace coreEvaluateGate delegation`.

---

## Contradictions détectées

### C-001 — Duplication de GateType entre behavior-core et storage-core

**Source A** : `packages/behavior-core/src/types.ts` lignes 3-15 définit `GATE_TYPES` et
`GateType` (9 valeurs).

**Source B** : `packages/storage-core/src/capability-map.ts` lignes 14-26 redéfinit
identiquement `GATE_TYPES` et `GateType` sans importer depuis `behavior-core`.

**Impact** : Si les deux listes divergent à l'avenir (ajout d'une gate), l'une sera silencieusement
désynchronisée. Le compilateur TypeScript ne détecte pas la divergence entre deux `as const`
indépendants.

**Résolution requise (Wave 2)** : `storage-core` importe `GateType`/`GATE_TYPES` depuis
`@hima/behavior-core`. Vérifier qu'aucun cycle de dépendance n'est introduit (storage-core
n'a pas de dépendance sur behavior-core actuellement).

### C-002 — GateType incomplet dans hima-cli/src/types.ts

**Source A** : ADR-0002 + behavior-core définissent 9 GateTypes dont `pre_compact` et
`post_compact`.

**Source B** : `packages/hima-cli/src/types.ts` lignes 1-31 définit un `GateType` local avec
7 valeurs uniquement (omission de `pre_compact` et `post_compact`).

**Impact** : Le CLI ne peut pas router les hooks `pre-compact` / `post-compact` vers les
gates correctes. La fonction `parseGateType` dans `commands/hook.ts` ne les reconnaît pas
(aucune entrée dans `NATIVE_EVENT_MAP` pour ces deux gates).

**Résolution requise (Wave 2)** : Supprimer le type local, importer depuis `@hima/behavior-core`,
ajouter les deux entrées manquantes dans `NATIVE_EVENT_MAP`.

### C-003 — evaluateStop : deux implémentations coexistantes

**Source A** : `packages/core/src/gates/evaluate-gate.ts` lignes 859-974 — implémentation
originale dans `@harness/core`, qui ne lit PAS `requiresEvidenceBeforeStop`.

**Source B** : `packages/gates-core/src/evaluate-stop.ts` — implémentation corrigée qui lit
`requiresEvidenceBeforeStop`.

**Impact** : Les 8 autres gates passant encore par `coreEvaluateGate` (@harness/core),
la logique de `evaluateStop` dans core n'est PAS utilisée pour le gate `stop` via hima
(puisque gates-core l'override). Mais si un consommateur appelle directement
`evaluateGate` de `@harness/core` (sans passer par `@hima/gates-core`), il obtient
le comportement bugué. Le risque existe dans les tests ou outils tiers.

**Question ouverte** : Faut-il patcher `@harness/core` directement ou maintenir le shim ?
La réponse dépend du calendrier de sortie de la dette de transition (Wave 3).

### C-004 — Propriété de GateEvaluationContext et GateResult

**Source A** : PROPOSITION.md §1 dit que les packages CORE sont "pur TypeScript, zéro couplage
runtime".

**Source B** : `GateEvaluationContext` et `GateResult` sont définis dans `@harness/core` (le
monolithe legacy), pas dans `@hima/behavior-core`.

**Impact** : `@hima/gates-core` dépend de `@harness/core` pour ses types d'interface
principaux, ce qui contredit l'objectif de zéro couplage legacy pour les packages CORE.

**Résolution proposée** : En Wave 2, migrer `GateEvaluationContext` et `GateResult` vers
`@hima/behavior-core` (ou un nouveau `@hima/gate-types`). Decision à prendre avant
implémentation : fichier un ADR.

### C-005 — Verdict "Verdict" vs "GateDecision"

**Source A** : `packages/hima-cli/src/types.ts` définit `type Verdict = { decision: Decision; reason?: string; contextInjection?: string }` et `type Decision = "allow" | "block" | "warn"`.

**Source B** : `@harness/core` définit `GateDecision = "allow" | "warn" | "block"` et
`GateResult` (superset de Verdict avec de nombreux champs supplémentaires).

**Impact** : Deux vocabulaires pour le même concept. `commands/hook.ts` fait un cast
explicite `result.decision as Verdict["decision"]` — fragile si de nouvelles valeurs
sont ajoutées à `GateDecision`.

**Résolution requise (Wave 2)** : Supprimer `Verdict` et `Decision` locaux ; utiliser
`GateDecision` et `GateResult` depuis `@hima/behavior-core`.
