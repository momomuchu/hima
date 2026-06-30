---
claim-bearing: true
status: DRAFT — pending founder review
date: 2026-06-11
version: v1.0-draft
authors: [spec-synthesis, fondateur]
source-contracts:
  - docs/decisions/0003-restructure-v2-melange-des-trois.md
  - .planning/restructure/PROPOSITION.md (§1–12)
  - .omc/ultragoal/brief.md
  - packages/storage-core/src/capability-map.ts
  - packages/behavior-core/src/index.ts
  - packages/gates-core/src/index.ts + evaluate-gate.ts + evaluate-stop.ts
  - packages/hima-cli/src/index.ts + commands/hook.ts
  - packages/adapter-hermes-v2/src/index.ts + hook-bindings.ts
  - packages/adapter-claude-v2/src/index.ts
---

Falsifies-If:
  kill-condition: >
    Après Wave 3 livrée, ≥2 contrats d'interface définis ici sont incorrects
    (signature réelle diverge de la spec) ou ≥1 contradiction listée en §6
    est restée non résolue avant implémentation Wave 2/3.
  checkpoint-date: 2026-07-15
  evidence-anchor: .omc/ultragoal/ledger.jsonl
  on-fail: >
    Mettre la spec en statut SUPERSEDED, ouvrir un ralplan de re-spec avant
    toute implémentation Wave 2 ou 3 supplémentaire.

---

# SPEC-V1 — hima : Spécification Globale v1

> **hima** = profils OMO-style réimplémentés + behaviors agent-runtime enforced en code
> + Hermes Agent premier adapter. Cycle orchestré = SDLC complet.
> Ce document est le contrat liant les waves d'implémentation 2, 3, 4.

---

## 1. Vue d'ensemble du cycle SDLC orchestré par hima

hima orchestre le SDLC complet sur tout runtime supporté. Chaque étape a une
entrée, une sortie, une gate de sortie et un profil responsable.

### 1.1 Tableau des étapes

| # | Étape | Entrée | Sortie | Gate de sortie | Profil responsable |
|---|---|---|---|---|---|
| E1 | **Analyse** | Message utilisateur + contexte projet | Changeset classifié (riskClass T/L/M/H/C) | `user_prompt` gate — riskClass attribué, mode opératoire décidé | `planner` (classification) |
| E2 | **Spécification** | Changeset classifié + disciplines.md | Spec ou scope doc avec exigences taggées | Pour M+ : spec taggée [CRITICAL…LOW][BLOCKS:*] présente et approuvée | `planner` (interdit d'écrire du code) |
| E3 | **Design** | Spec approuvée | Plan d'implémentation (.hima/boulder.json + plan .md) | Boulder initialisé, plan à checkboxes numérotées validé | `planner` → transfert à `executor` |
| E4 | **Implémentation** | Plan validé | Code écrit, fichiers modifiés | `pre_tool` gate avant chaque outil d'écriture ; tidy-first (S ou B, jamais mixte) | `executor` |
| E5 | **Test ⇄ Implémentation** | Code + tests co-localisés | Tests verts, preuves d'exécution | `post_tool` gate (observable) ; pour M+ : evidence sufficiency vérifiée avant stop | `executor` + `critic` |
| E6 | **Verify (fin de tâche)** | Résultat de l'étape précédente | Verdict DONE_VERIFIED / PARTIAL / BLOCKED | `stop` gate — obligatoire TOUS niveaux (T inclus, voir §3) | `critic` |
| E7 | **Maintenance/feedback** | Retour fondateur + ledger | Ajustements, re-classification | Re-entrée en E1 ; état boulder préservé | `planner` |

> Déploiement : hors scope v0.1 — étape E8 différée post-Wave 4.

### 1.2 Invariants confirmés (PROPOSITION.md §12)

- **Verify fin de tâche = obligatoire à TOUS les niveaux** (T, L, M, H, C).
  Même partiel, un verdict doit être émis. Tracé vers : evaluate-stop.ts,
  gate `stop`, PROPOSITION.md §12 amendement.
- **Deep research = obligatoire seulement en H et C.**
  Pour T/L/M : facultatif. Tracé vers : kernel rule `[M+][RESEARCH-TRIGGER]`.
- **Tidy First** : chaque commit est S (structurel) OU B (comportemental), jamais mixte.
  Tracé vers : brief.md contraintes dures + 0003-restructure-v2.

---

## 2. Contrats d'interface

### 2.1 gates-core ↔ hima-cli

**Contrat existant, implémenté — documenter tel quel.**

Signature principale (packages/gates-core/src/evaluate-gate.ts) :

```typescript
function evaluateGate(context: GateEvaluationContext, event: GateEvent): GateResult
```

`GateEvaluationContext` (re-exporté depuis @harness/core via gates-core) :
```typescript
{
  projectRoot: string;
  state: RunSetState;       // mode: "bypass"|"checkpoint"|"full-bypass"|...
  currentRisk: CurrentRiskFile;  // { risk_class: RiskClass }
  runSet: RunSetFile;       // events[], evidence[], runtimeBindings[]
}
```

`GateEvent` :
```typescript
{
  gateType: GateType;  // l'un des 9 types du capability-map
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  promptContent?: string;
  metadata?: Record<string, unknown>;
}
```

`GateResult` : `{ decision: "allow"|"block"|"warn", reason: string, gateType, violationType?, finalState?, missingEvidenceItems?, contextInjection? }`

**hima-cli consomme ce contrat** via `runHookCommand` (packages/hima-cli/src/commands/hook.ts) :
- Lit JSON depuis stdin
- Charge l'état `.hima/` via `readPlanningProject(root)` → construit `GateEvaluationContext`
- Appelle `evaluateGate(context, gateEvent)` → formate le verdict
- Formats de sortie : `native` (défaut), `claude`, `hermes` via `--format`

**Normalisation des noms d'événements** (hook.ts NATIVE_EVENT_MAP) :
les noms natifs Hermes/Claude (`pretooluse`, `pre_tool_call`, etc.) sont normalisés
vers les 9 GateTypes canoniques avant appel à evaluateGate.

**Bug résolu** (evaluate-stop.ts) : la gate `stop` est surchargée localement
pour corriger `requiresEvidenceBeforeStop` ignoré dans @harness/core — désormais :
- riskClass T/L → `requiresEvidenceBeforeStop: false` → allow sans evidence check
- riskClass M+ → evidence sufficiency vérifiée, `block` si manquante

### 2.2 behavior-core ↔ gates-core

`behavior-core` expose `evaluateBehaviors(context, event)` → `GateResult[]`.
`gates-core` appelle `coreEvaluateGate` (depuis @harness/core) qui orchestre
les behaviors enregistrés via `registerBehavior` + `getBehaviorsForGate`.

Flux : GateEvent → evaluateGate → [si stop : evaluateStop local] → [sinon : coreEvaluateGate → evaluateBehaviors → BEH-xxx] → GateResult agrégé

Les 12 behaviors actuels de behavior-core (via `behaviors/index.ts`) alimentent
les verdicts de gates-core par `BehaviorVerdict` agrégés en `GateResult`.

**Contrat d'enrichissement BEH → gate** :
- Un behavior reçoit `GateEvaluationContext + GateEvent`
- Retourne `BehaviorVerdict: { decision, reason, violationType? }`
- Le registre agrège : si ≥1 verdict `block` → GateResult.decision = "block"

### 2.3 adapter ↔ runtime (9 GateTypes × capability-map)

Source de vérité : `packages/storage-core/src/capability-map.ts`.

#### Matrice GateType × runtime × niveau

| GateType | Hermes | Claude | Codex | Hook natif Hermes | Peut bloquer (Hermes) |
|---|---|---|---|---|---|
| `session_start` | degraded | degraded | degraded | `on_session_start` | NON |
| `user_prompt` | **supported** | supported | supported | `pre_llm_call` | OUI |
| `pre_tool` | **supported** | supported | supported | `pre_tool_call` | OUI |
| `post_tool` | degraded | degraded | degraded | `post_tool_call` | NON |
| `pre_compact` | **supported** | supported | supported | `pre_compact` | OUI |
| `post_compact` | degraded | degraded | degraded | `post_compact` | NON |
| `stop` | **degraded** | supported | supported | `on_session_end` | **NON** |
| `subagent_start` | **absent** | supported | absent | aucun | NON |
| `subagent_stop` | degraded | supported | absent | `subagent_stop` | NON |

#### Dégradations Hermes documentées (HERMES_GAPS dans capability-map.ts)

| ID | Description | Stratégie compensatrice |
|---|---|---|
| `hermes-no-system-prompt-hook` | Pas de hook system-prompt | Injection via `pre_llm_call` user-message ou tool-result |
| `hermes-magic-words-gateway-only` | Pas d'interception CLI déterministe | KEYWORD_DETECTORS dans plugin `pre_llm_call`/`pre_gateway_dispatch` |
| `hermes-sticky-profiles` | Profils sticky globalement (issue #18594) | Toujours passer `HERMES_HOME` explicitement ; pas de switch mid-session |
| `hermes-subagents-skip-context-files` | Sub-agents : `skip_context_files=True` hardcodé | Propagation via `pre_tool_call`/`delegate_task` du plugin hima |

**Interface HermesHookBinding** (adapter-hermes-v2/src/hook-bindings.ts) :
```typescript
{
  target: "hermes";
  gateType: GateType;
  nativeEvent: string | null;
  canBlock: boolean;
  status: "supported" | "degraded" | "absent";
  command: string;  // ex: "hima hook pre-tool-use"
  reason: string;
}
```
Obtenu via `getHermesHookBindings()` — itère sur les 9 GateTypes.

### 2.4 boulder-state ↔ commandes

**À spécifier pour Wave 2 (boulder-state non encore implémenté v2).**

Contrat cible :
- `.hima/boulder.json` : `{ workId, sessionIds[], status, planPath, createdAt, updatedAt }`
- Plan markdown : fichier `.hima/plans/<workId>.md` avec `## TODOs` + `- [ ] N. Tâche`
- Reprise multi-session : `appendSessionId(workId, sessionId)` → mutation atomique
- Commande `/plan` → crée un boulder, écrit le plan, bascule le profil sur `planner`
- Commande `/status` → lit boulder.json + plan → affiche l'état courant

**Invariant** : `boulder-state` est un package core pur TS, zéro couplage runtime.
Les adapters n'écrivent pas directement dans `.hima/` — ils passent par boulder-state.

### 2.5 rules-engine ↔ injection

**À implémenter Wave 2. Contrat cible issu de PROPOSITION.md §6.**

Sources de règles (priorité décroissante) :
1. `.hima/rules/` — règles projet hima
2. `.claude/rules/` — règles globales Claude Code
3. `.cursor/rules/` — compat cross-harness

Frontmatter requis par fichier de règle :
```yaml
---
globs: ["**/*.ts", "src/**"]   # patterns picomatch
alwaysApply: false              # true = injecté à chaque hook sans filtre glob
---
```

Injection : au `pre_tool` hook, le rules-engine évalue les globs contre
`event.toolInput.path`, injecte le contenu des règles correspondantes dans
`GateResult.contextInjection`.

Source `disciplines.md` : devient une règle du rules-engine avec
`alwaysApply: true` — discipline-guard gate lit depuis cette source.

### 2.6 keyword-core ↔ gateway

**Contrat strict issu de PROPOSITION.md §12 (amendement fondateur).**

```typescript
KEYWORD_DETECTORS: Array<{
  type: string;
  pattern: RegExp;   // OBLIGATOIRE : /\b(ulw|...)\s*$/  — fin de message uniquement
  message: (agentName: string, modelID: string) => string;
}>
```

**Règle de détection** : match uniquement en fin de message (`\s*$` après le mot).
Motif : faux positifs si `\b` seul — le fondateur a vécu la détection de « ulw »
quand il *décrivait* le keyword (PROPOSITION.md §12 amendement, bug OMC live).

Les blocs de code sont strippés avant matching (pattern OMO, réimplémenté).

Surface d'invocation : plugin `pre_llm_call` ou `pre_gateway_dispatch` Hermes.
Sur Claude : hook `PreToolUse` ou `UserPromptSubmit`.

Magic words v0.1 proposés :
| Mot | Pattern | Effet |
|---|---|---|
| `ulw` | `/\b(ulw)\s*$/i` | Active exécution parallèle (/ulw) |
| `plan` via `/plan` | commande explicite | Active profil planner + boulder |

### 2.7 prompts-core ↔ profils

**Contrat cible Wave 2. Source : PROPOSITION.md §2.**

Structure : `prompts/<agent>/<variant>.md`
Sélection : `resolveVariant(modelID: string, agentName: string) → string` (chemin du prompt)

Profils v0.1 (noms fonctionnels, décision Q1 fondateur) :

| Profil | Rôle | Invariant critique |
|---|---|---|
| `planner` | Classification criticality, spécification, plan boulder | **INTERDIT d'écrire du code** — gate `pre_tool` bloque tout Write/Edit depuis ce profil |
| `executor` | Implémentation, tests, commits | Tidy First obligatoire ; verify fin de tâche |
| `critic` | Review, verify, verdict DONE/PARTIAL/BLOCKED | Lecture seule ; ne spawne pas de sub-agents |

Injection dynamique : `{placeholder}` dans les .md résolus par `resolver()` au moment
de l'invocation (ex. `{disciplines}` → contenu disciplines.md via rules-engine).

---

## 3. Protocole criticality T/L/M/H/C

### 3.1 Niveaux et étapes obligatoires

| Niveau | Définition | Étapes obligatoires | Verify fin de tâche | Deep research |
|---|---|---|---|---|
| **T** (Trivial) | Patch direct, fix typo, renommage 1 variable | E4 → E6 | OUI (partiel accepté) | NON |
| **L** (Low) | Read before write, changement réversible étroit | E3 → E4 → E6 | OUI | NON |
| **M** (Medium) | Goal contract, acceptance criteria, spec | E2 → E3 → E4 → E5 → E6 | OUI (preuve directe) | NON (mais recommandé) |
| **H** (High) | Planning délibéré, spec complète, review indépendant | E1 → E2 → E3 → E4 → E5 → E6 | OUI (proof obligatoire) | **OUI** |
| **C** (Critical) | Stop jusqu'à autorité/scope/rollback explicites | E1 → E2 (bloquant) → ... → E6 | OUI | **OUI (≥5 sources)** |

### 3.2 Gates bloquantes par niveau (portage PROPOSITION.md §3)

Les ~20 gates bloquantes portées en code (Wave 1/3) :

| Gate | Niveau déclencheur | Comportement | Tracé vers |
|---|---|---|---|
| `C-stop sans autorité` (K-12) | C | Block stop si pas d'autorité explicite | evaluateStop + RISK_POLICY |
| `pending-approval` (K-14) | M+ | Block pre_tool si plan pending approval non approuvé | behavior-core BEH |
| `worker-model explicite` (K-28) | Tous | Block subagent_start si model non spécifié | gates-core subagent_start |
| `read-first` (K-39) | L+ | Block Write/Edit si fichier non lu avant | pre_tool gate |
| `final-state + done-only-with-proof` (K-43/44) | Tous | Block stop sans verdict DONE/PARTIAL/BLOCKED | evaluate-stop.ts |
| `no-push` (K-49) | Tous | Block Bash(git push) sauf demande explicite | pre_tool gate |
| `decision-authority DA-01→05` | H/C | Block add_dependency, billing, security, schema, delete_test sans fondateur | behavior-core |
| `discipline-guard / tidy-first` | Tous | Block commit mixte S+B | pre_tool (Bash git commit) |
| `security-scope` | H/C | Block pentest/scanner sans environnement approuvé | pre_tool |
| `subagent_start bloquante` (bug §12) | Tous | Block spawn sous-agent si rôle l'interdit (ex. critic) | absent gate → **à implémenter Wave 3** |
| `hook-dedup (agentId, event)` (bug §12) | Tous | Ignorer événement déjà traité pour (agentId, gateType) | subagent_stop gate → **à implémenter Wave 3** |

### 3.3 Classifieurs (3 portés de l'ancien hima)

1. **risk-classifier** : `classifyRisk(changeset)` → `RiskClass` T/L/M/H/C.
   Exposé dans behavior-core/src/risk-classifier.ts. Statut : rapatrié tel quel.
2. **action-signal** : `classifyToolName(toolName)` → `SemanticClass` (read/write/bash...).
   Détermine si un outil est en zone S ou B pour tidy-first.
3. **behavior-override** : `resolveOverride(context)` → permet au fondateur d'élever/abaisser
   le riskClass via overrides dans .hima/run-set.json.

---

## 4. Surface utilisateur — commandes v0.1

### 4.1 Commandes définies

| Commande | Syntaxe | Effet | État créé | Profils invoqués |
|---|---|---|---|---|
| `/plan` | `/plan [description]` | Classification → boulder init → plan .md | `.hima/boulder.json` créé, plan markdown | `planner` |
| `/ulw` | `/ulw` (fin de message) ou magic word `ulw\s*$` | Exécution parallèle (ultrawork) sur le plan actif | Boulder status → "running" | `executor` (N lanes) |
| `/qa` | `/qa` | Review critique du résultat courant | Evidence ajoutée au run-set | `critic` |
| `/status` | `/status [--root <dir>]` | Affiche état .hima/ (boulder, riskClass, run-set, ledger) | Aucun (lecture seule) | — |

### 4.2 CLI hima-cli (contrat existant)

Entrée : `hima <command> [args]`

Commandes bas niveau :
- `hima hook <event> [--format claude|hermes|native] [--root <dir>]` — lit JSON stdin, évalue, écrit JSON stdout
- `hima status [--root <dir>]` — affiche état .hima/

Format `claude` : sortie compatible Claude Code hooks (`{ decision, reason }`)
Format `hermes` : sortie compatible plugin Hermes (`{ action, message }`)
Format `native` : GateResult brut (défaut)

---

## 5. Matrice de traçabilité

### CRITICAL items

| ID | Exigence | [BLOCKS:*] | Contrat source | Wave |
|---|---|---|---|---|
| R-01 | `stop` gate = obligatoire TOUS niveaux, verdict DONE/PARTIAL/BLOCKED émis | BLOCKS:critical | evaluate-stop.ts + PROPOSITION.md §12 | W1 ✓ livré |
| R-02 | `pre_tool` gate bloque le profil `planner` de tout Write/Edit | BLOCKS:critical | PROPOSITION.md §2 (planner interdit d'écrire du code) | W3 |
| R-03 | Magic word détecté uniquement en fin de message (`\s*$`) | BLOCKS:critical | PROPOSITION.md §12 amendement (bug OMC vécu) | W2 |
| R-04 | `subagent_start` gate bloquante par rôle (bug §12 : worker spawn 2 sous-agents) | BLOCKS:critical | PROPOSITION.md §12 backlog bugs | W3 |
| R-05 | Propagation des règles hima aux sub-agents via `pre_tool_call`/`delegate_task` (Hermes skip_context_files) | BLOCKS:critical | capability-map.ts `hermes-subagents-skip-context-files` | W3 |
| R-06 | Déduplication événements par (agentId, gateType) — bug SubagentStop ≥6 rejeux | BLOCKS:critical | PROPOSITION.md §12 backlog bugs | W3 |

### HIGH items

| ID | Exigence | [BLOCKS:*] | Contrat source | Wave |
|---|---|---|---|---|
| R-07 | `stop` gate sur Hermes = degraded → gate finale déportée au tour suivant via `pre_tool_call`/`pre_llm_call` | BLOCKS:high | capability-map.ts + PROPOSITION.md §4 | W3 |
| R-08 | Ledger sha256 hash-chain (sans ed25519 par entrée) — audit de reproductibilité | BLOCKS:high | PROPOSITION.md §5, behavior-core/src/ledger.ts | W1 ✓ livré |
| R-09 | Sources de règles priorisées : `.hima/rules` > `.claude/rules` > `.cursor/rules` | BLOCKS:high | PROPOSITION.md §6 | W2 |
| R-10 | Boulder-state : reprise multi-session, `appendSessionId`, plan markdown à checkboxes | BLOCKS:high | PROPOSITION.md §5 + brief.md | W2 |
| R-11 | Profil `critic` = lecture seule, ne spawne pas de sub-agents | BLOCKS:high | PROPOSITION.md §2 + kernel rule no-self-approve | W2 |
| R-12 | `HERMES_HOME` toujours passé explicitement (profils sticky, issue #18594) | BLOCKS:high | capability-map.ts `hermes-sticky-profiles` | W3 |
| R-13 | capability-map = source de vérité unique pour GateType × runtime × niveau | BLOCKS:high | storage-core/capability-map.ts (contrat existant) | W1 ✓ livré |

### MEDIUM items (convergence)

| ID | Exigence | [BLOCKS:*] | Contrat source | Wave |
|---|---|---|---|---|
| R-14 | `disciplines.md` injecté via rules-engine (`alwaysApply: true`) | BLOCKS:low | PROPOSITION.md §6 | W2 |
| R-15 | `resolveVariant(modelID, agentName)` → sélection prompt par modèle | BLOCKS:low | PROPOSITION.md §2 | W2 |
| R-16 | Format de sortie `--format hermes` aligné sur l'API plugin Hermes | BLOCKS:low | hook-bindings.ts, hima-cli/commands/hook.ts | W3 |
| R-17 | Injection via `pre_llm_call` user-message (pas system-prompt — absent sur Hermes) | BLOCKS:low | capability-map.ts `hermes-no-system-prompt-hook` | W3 |
| R-18 | `evaluateGate` normalisé : noms d'événements natifs → GateType canonique (NATIVE_EVENT_MAP) | BLOCKS:none | hook.ts lignes 13-27 | W1 ✓ livré |

### LOW items (convergence tail)

| ID | Exigence | [BLOCKS:*] | Contrat source | Wave |
|---|---|---|---|---|
| R-19 | Profils restants (8 au-delà de planner/executor/critic) | BLOCKS:none | PROPOSITION.md §2 | W4 |
| R-20 | Setup open-source (README, install, MIT) | BLOCKS:none | brief.md non-goals W4 | W4 |
| R-21 | Réintégration state-machine macro-cycles (différée, pas abandonnée) | BLOCKS:none | PROPOSITION.md §12 ajustements | W4+ |

---

## 6. Contradictions détectées

> Section obligatoire. Croisement des contrats. Zéro remplissage.

### C-01 [CRITICAL] — stop gate Hermes non bloquante vs verify obligatoire fin de tâche

**Contradiction** : PROPOSITION.md §12 dit « verify obligatoire à la fin de CHAQUE tâche »
(tous niveaux). Mais sur Hermes, `stop`/`on_session_end` est `degraded` (non bloquant,
capability-map.ts ligne 128). La gate ne peut pas physiquement bloquer la fin de session.

**Résolution spécifiée** (R-07) : la gate finale est déportée au tour suivant —
le plugin hima intercepte le `pre_llm_call` ou `pre_tool_call` du tour d'après
et bloque si l'état run-set ne contient pas de verdict DONE/PARTIAL/BLOCKED.
**Trou restant** : entre la fin de session et le début du tour suivant, il y a une
fenêtre où l'agent peut avoir terminé sans verdict. Acceptable pour v0.1 (outil
personnel), à durcir en v1.x avec MCP hermes supervision (`events_poll`).

### C-02 [CRITICAL] — subagent_start absent sur Hermes vs gate bloquante requise (R-04)

**Contradiction** : R-04 exige une gate `subagent_start` bloquante par rôle (bug live :
worker a spawné 2 sous-agents malgré interdiction). Mais Hermes expose
`subagent_start: absent` (capability-map.ts ligne 136 — aucun hook natif).

**Résolution spécifiée** : la gate `subagent_start` doit être interceptée via
`pre_tool_call` sur l'outil de délégation (ex. `Task`, `delegate_task`). Ce n'est
pas un hook lifecycle mais un hook d'outil. La gate pre_tool est **supported** sur
Hermes → applicable. La normalisation dans `NATIVE_EVENT_MAP` (hook.ts) doit
inclure le mappage `delegate_task` → `subagent_start`. **Non implémenté — Wave 3.**

### C-03 [HIGH] — gates-core importe @harness/core vs isolation package pure TS

**Contradiction** : gates-core/src/evaluate-gate.ts importe `evaluateGate` depuis
`@harness/core` (ligne 8), et evaluate-stop.ts importe 6 symboles depuis `@harness/core`.
Or l'architecture cible (PROPOSITION.md §1) stipule « core pur TS, zéro couplage runtime ».
`@harness/core` est l'ancien hima — son statut post-Wave 1 est ambigu : reste-t-il
une dépendance permanente ou est-il absorbé progressivement ?

**Résolution spécifiée** : `@harness/core` reste une dépendance interne transitoire
pendant les waves 1-3. La Wave 4 ou un refactor dédié réabsorbe les symboles
clés dans `behavior-core` ou `gates-core` directement. La condition de la contradiction
est satisfaite si `@harness/core` ne contient aucun couplage runtime (hooks,
filesystem adapter-specific). À vérifier avant Wave 4.

### C-04 [HIGH] — profil planner interdit d'écrire du code vs gate pre_tool non implémentée pour les profils

**Contradiction** : R-02 exige que `pre_tool` bloque tout Write/Edit depuis le profil
`planner`. Mais gates-core et behavior-core ne connaissent pas encore le concept de
« profil actif » — `GateEvaluationContext` ne contient pas de champ `activeProfile`.
Le behavior-registry reçoit uniquement `(context, event)` sans identité de profil.

**Résolution spécifiée** : `GateEvaluationContext` doit être étendu d'un champ
`activeProfile?: string` injecté par hima-cli au moment de `readPlanningProject`.
Le profil actif est lu depuis `.hima/current-profile.json` (ou boulder.json).
Un behavior dédié `BEH-planner-write-block` vérifie ce champ. **À concevoir Wave 2/3.**

### C-05 [HIGH] — keyword-core `\s*$` (fin de message) vs surface d'injection Hermes gateway-only

**Contradiction** : keyword-core doit détecter les magic words uniquement en fin de message.
Mais sur Hermes, la détection vit dans `pre_llm_call`/`pre_gateway_dispatch` (pas de
CLI interception). La gate `user_prompt` (pre_llm_call) reçoit le message complet —
le pattern `/\b(ulw)\s*$/i` est applicable. Mais `pre_gateway_dispatch` reçoit
potentiellement un message déjà transformé (multi-turn context). Le pattern `\s*$`
appliqué sur le message transformé peut rater le dernier token du message original.

**Résolution spécifiée** : appliquer le pattern sur le `promptContent` brut du
dernier message utilisateur uniquement (pas le contexte complet). La gate
`user_prompt` est le point d'application primaire. `pre_gateway_dispatch`
est secondaire et optionnel. **À préciser dans l'implémentation keyword-core Wave 2.**

### C-06 [MEDIUM] — ledger hash-chain dans behavior-core vs responsabilité de storage-core

**Contradiction** : le ledger (`appendLedgerEntry`, `readLedger`, `verifyLedgerChain`)
est exporté depuis `behavior-core/src/ledger.ts` (index.ts lignes 93-101). Mais
`storage-core` contient les primitives de stockage atomique (`atomicWriteFile`,
`withFileLock`, `readJsonFile`). La responsabilité est divisée : le ledger utilise
le stockage mais vit dans behavior-core.

**Résolution spécifiée** : acceptable pour v0.1 (le ledger est une dépendance
comportementale, pas juste du stockage). Le refactor vers `storage-core/ledger.ts`
est un item Wave 4 (mouvement S = structurel, sans changement comportemental).

### C-07 [MEDIUM] — GateType défini dans behavior-core/types.ts ET re-exporté depuis storage-core

**Contradiction** : `GateType` est défini dans `behavior-core/src/types.ts`
(re-exporté dans behavior-core/index.ts ligne 16). Il est aussi défini et exporté
depuis `storage-core/src/capability-map.ts` (storage-core/index.ts lignes 7-8).
Deux définitions canoniques pour le même type — risque de désynchronisation si l'une
évolue sans l'autre.

**Résolution spécifiée** : `storage-core` est la source de vérité unique pour
`GateType` (capability-map.ts est le référentiel de tous les types de gates).
`behavior-core/types.ts` doit réimporter `GateType` depuis `@hima/storage-core`
et supprimer sa propre définition. **Action Wave 2 (commit S, structurel).**

### C-08 [MEDIUM] — `evaluateStop` vérifie `requiresEvidenceBeforeStop` mais `RISK_POLICY` vit dans @harness/core

**Contradiction** : evaluate-stop.ts ligne 74 lit `RISK_POLICY[context.currentRisk.risk_class]`
importé depuis `@harness/core`. Si `@harness/core` est absorbé (C-03), `RISK_POLICY`
doit migrer. Mais `RISK_POLICY` n'est pas encore exposé dans `behavior-core`.

**Résolution** : couplée à la résolution de C-03 — migration `RISK_POLICY` vers
behavior-core lors de l'absorption Wave 4. En attendant : toléré, non bloquant.

### C-09 [LOW] — `hima hook pre-tool-use` vs `hima hook pre_tool` — normalisation double

**Contradiction mineure** : HOOK_COMMAND_EVENTS dans hook-bindings.ts génère
`hima hook pre-tool-use` (tirets). NATIVE_EVENT_MAP dans hook.ts normalise
`pretooluse` → `pre_tool`. Un utilisateur qui taperait `hima hook pre-tool-use`
passerait par `replaceAll("-", "_")` → `pre_tool_use` → lookup NATIVE_EVENT_MAP
sur `pre_tool_use` → non trouvé → lookup sur `pre_tool_use` (avec underscores)
→ GATE_TYPES.includes check → `"pre_tool_use"` n'est pas dans GATE_TYPES (c'est `"pre_tool"`).
**Risque : commande générée par getHermesHookBindings() non parseable par runHookCommand.**

**Résolution** : étendre NATIVE_EVENT_MAP pour couvrir les variantes avec tirets
(ex. `pre-tool-use`, `post-tool-use`, etc.). **Bug — à corriger Wave 1 ou Wave 3.**

### C-10 [LOW] — `subagent_start` absent Hermes mais `HermesHookBinding.command` = "hima hook subagent-start"

**Contradiction** : getHermesHookBindings() génère une HermesHookBinding avec
`nativeEvent: null` et `command: "hima hook subagent-start"` pour `subagent_start`.
Cette commande ne peut jamais être invoquée nativement par Hermes (pas de hook).
Le binding est inutilisable tel quel.

**Résolution** : le binding reste présent comme documentation de l'absence,
mais son `canBlock: false` et `status: "absent"` signalent qu'il ne doit pas
être enregistré dans le plugin Hermes. Le plugin doit filtrer les bindings
`status === "absent"` avant enregistrement. **À vérifier Wave 3.**

### C-11 [HIGH] — verdicts `block` sur `post_tool` structurellement inopérants sur TOUS les runtimes

**Contradiction** (reprise du draft parallèle `.planning/restructure/SPEC-V1.md`, C-2) :
`post_tool` est `degraded` sur Hermes, Claude Code ET Codex — aucun runtime ne peut
bloquer après l'exécution d'un outil. Tout behavior enregistré sur `post_tool` avec
verdict `block` est silencieusement ignoré au runtime alors que le ledger l'enregistre
comme décision : illusion d'enforcement.

**Résolution proposée** : déclarer `post_tool` observation-only par design (verdicts
plafonnés à `warn` + entrée ledger) ; les logiques réellement bloquantes migrent vers
le `pre_tool` du tour suivant (état porté dans `.hima/`). **Décision fondateur D-4 —
avant Wave 2.**

---

## Annexe A — Décisions en suspens avant Wave 2

| Décision | Options | Deadline |
|---|---|---|
| DA-01 : `GateType` source de vérité unique (C-07) | Migrer behavior-core vers @hima/storage-core | Avant premier commit Wave 2 |
| DA-02 : Champ `activeProfile` dans GateEvaluationContext (C-04) | Étendre le type + injecter depuis boulder.json | Design Wave 2 |
| DA-03 : Commandes `/plan /ulw` — surface Hermes vs Claude | Magic word ou CLI explicite seulement | Début Wave 3 |
| DA-04 : Absorption @harness/core (C-03) | Différer Wave 4 ou plan Wave 3 partiel | Avant Wave 4 |
| DA-05 : `post_tool` observation-only par design (C-11) | Plafonner à warn + migrer les blocks vers pre_tool N+1 | Avant Wave 2 |
| DA-06 : Adoption d'Effect (effect-ts) pour les contrats de spec | Effect Schema comme langage de contrat (validation runtime + types) vs TS pur + Zod existant | Avant premier commit Wave 2 — proposition fondateur 2026-06-11, ADR requis |

> Note de réconciliation (2026-06-11) : deux drafts SPEC-V1 ont été produits en parallèle.
> CE fichier (`docs/specs/SPEC-V1.md`, registre C-01..C-11) est le canonique.
> `.planning/restructure/SPEC-V1.md` est SUPERSEDED — sa seule trouvaille unique (post_tool)
> a été intégrée ci-dessus en C-11. Correspondance : C-1→C-03, C-2→C-11, C-3→C-01, C-4→C-02, C-5→C-07, C-6→C-08.
