# SPEC-002 — Protocole criticality T/L/M/H/C : étapes obligatoires

status: draft
date: 2026-06-11
owner: protocole (hima-spec-wave15)
source-of-truth-code:
  - packages/behavior-core/src/risk-classifier.ts
  - packages/behavior-core/src/risk-class.ts
  - packages/behavior-core/src/ledger.ts
  - packages/gates-core/src/evaluate-gate.ts
  - packages/gates-core/src/evaluate-stop.ts
cross-refs: SPEC-001, SPEC-003, SPEC-006
claim-bearing: true

---

## Objet

Ce document est le contrat différenciant de hima : la criticité n'est pas déclarée par prompt,
elle est **classifiée en code** par le main agent au moment du `user_prompt`, puis enforced
mécaniquement par des gates bloquantes à chaque événement du cycle de vie.

Deux invariants fondateur non négociables s'appliquent à tous les niveaux :
1. `verify` est obligatoire en fin de CHAQUE tâche, quel que soit le niveau.
2. `deep_research` n'est obligatoire QUE pour les niveaux H et C.

Chaque exigence est taggée sur deux axes indépendants :
- importance : `[CRITICAL]` `[HIGH]` `[MEDIUM]` `[LOW]`
- ordre d'exécution : `[BLOCKS:critical]` `[BLOCKS:high]` `[BLOCKS:low]` `[BLOCKS:none]`

---

## CRITICAL items

### [CRITICAL][BLOCKS:critical] C-001 — Définitions des cinq niveaux

Source de vérité : `packages/behavior-core/src/risk-class.ts`.

```ts
RISK_CLASSES = ["T", "L", "M", "H", "C"]   // ordre total croissant
RISK_CLASS_RANK = { T:0, L:1, M:2, H:3, C:4 }
```

Sémantique opérationnelle dérivée de `MANDATORY_ACTIVITIES` et des scores composites
dans `risk-classifier.ts` :

| Niveau | Nom | Score composite | Exemples canoniques |
|--------|-----|-----------------|---------------------|
| T | Trivial | ≤ 2 | docs, commentaire, renommage local, typo |
| L | Low | 3–5 | fix mineur, refactor fichier unique, deps patch |
| M | Medium | 6–10 | feature nouvelle, refactor multi-fichiers, diffLinesNet > 300 |
| H | High | 11–17 | auth, billing, migration schéma, API publique, infra-prod |
| C | Critical | ≥ 18 ou signal forçant | health-data, biométrie, multi-repo, architecture_refactor |

**Signaux forçants (override le score composite — définis dans `risk-classifier.ts`) :**

| Type | Condition | Niveau forcé |
|------|-----------|--------------|
| Fichier | `HIGH_FILE_PATTERNS` : auth, payments, migrations, infra, .env, secrets… | ≥ H |
| Fichier | `CRITICAL_FILE_PATTERNS` : health, biometric, medical | C |
| Label | `HIGH_LABELS` : auth, migration, pii, gdpr, api-breaking… | ≥ H |
| Label | `CRITICAL_LABELS` : hipaa, arch-refactor, cross-repo, nis2… | C |
| Diff | `HIGH_DIFF_PATTERNS` : CREATE/ALTER/DROP TABLE, GRANT, REVOKE, secrets en clair, PII | ≥ H |
| Diff | `CRITICAL_DIFF_PATTERNS` : health_data, biometric, financial_regulated | C |
| Structurel | `changeType === "architecture_refactor"` | C |
| Structurel | `reposCount ≥ 2` | C |
| Structurel | `diffLinesNet > 300` | plancher M |

**Règle de résolution :**
```
riskClass = maxRiskClass([forcedClass, calculatedClass, structuralMinimum])
```
Jamais de rétrogradation silencieuse. `maxRiskClass` est l'unique point d'agrégation.

---

### [CRITICAL][BLOCKS:critical] C-002 — Le classifieur vit dans le main agent

**Décision fondateur (PROPOSITION.md §12, invariant non re-litigable) :**

> Le classifieur de risque vit dans le main agent. L'agent avec lequel le fondateur
> parle classifie, récupère le niveau, et applique le protocole correspondant.

**Appel :** `classifyRisk(changeset: Changeset)` depuis `risk-classifier.ts`.
Le main agent construit le `Changeset` depuis le message utilisateur avant toute autre action.

**Sortie contractuelle (`ClassificationResult`) :**

```ts
interface ClassificationResult {
  riskClass: RiskClass;             // T | L | M | H | C
  justification: string;            // trace humaine lisible
  activeSignals: ForcingSignal[];   // signaux qui ont forcé le niveau
  compositeScore?: number;
  operatingMode: OperatingMode;     // bypass | auto | pairing
  deploymentStrategy: DeploymentStrategy;
  mandatoryActivities: string[];    // étapes obligatoires pour ce niveau
  bypassEligible: boolean;
  classifiedAt: string;             // ISO8601
  proposedBy: "agent" | "developer";
}
```

**Point d'attention (QO-003 non résolu) :** le `Changeset` de `risk-classifier.ts` est
orienté changeset de code. Pour la v0.1, il manque un adaptateur
`messageToChangeset(message, context) → Changeset` qui infère `changeType`, `files`,
`labels` depuis le texte naturel. Ce composant est à créer avant l'intégration réelle
dans le flux `user_prompt`.

---

### [CRITICAL][BLOCKS:critical] C-003 — Reclassification obligatoire sur nouveaux signaux

La classification initiale n'est pas définitive. Reclassifier via `promoteRisk()` dès que :

1. Un fichier touché correspond à un pattern forçant absent à la classification initiale.
2. Le diff effectif révèle un pattern `HIGH_DIFF_PATTERNS` ou `CRITICAL_DIFF_PATTERNS`.
3. `diffLinesNet` dépasse le seuil structurel (> 300) en cours d'exécution.
4. Un label est ajouté manuellement par le développeur.
5. `reposCount` passe à ≥ 2 lors d'un spawn de sous-agent cross-repo.
6. La gate `pre_tool` détecte `CLASS_UNDERESTIMATED`.

**Appel :** `promoteRisk(current, target, reason, triggerContext?)`.
La dérétrogradation (`demoteRisk`) exige `authorizedBy: "developer"`, ne peut descendre
que d'un niveau, est bloquée si un signal forçant incompatible est actif.

---

### [CRITICAL][BLOCKS:critical] C-004 — Gate bloquante si classification absente

Si aucune classification n'est enregistrée dans le run-set courant au moment d'un
événement `pre_tool` ou `stop` :

- **Gate `user_prompt`** : block, `violationType: "CLASS_UNDERESTIMATED"`.
- **Gate `pre_tool`** : block idem.
- **Gate `stop`** : verdict conservateur → block, `finalState: "BLOCKED_POLICY"`.

---

### [CRITICAL][BLOCKS:critical] C-005 — Invariants fondateur (s'appliquent à TOUS niveaux)

1. **`verify` obligatoire en fin de CHAQUE tâche**, quel que soit le niveau T/L/M/H/C.
   Note : `MANDATORY_ACTIVITIES` dans `risk-classifier.ts` ne contient pas `"verify"`
   explicitement (contradiction CONTRADICTION-003 ci-dessous) — la gate `stop` doit
   l'enforcer indépendamment du niveau.

2. **`deep_research` obligatoire UNIQUEMENT pour H et C.**
   Pour T/L/M : interdire l'injection de deep research automatique (anti-cérémonie).

---

## HIGH items

### [HIGH][BLOCKS:high] H-001 — Matrice des étapes obligatoires par niveau

Source : `MANDATORY_ACTIVITIES` dans `risk-classifier.ts` + invariants fondateur.

#### Niveau T — Trivial

**Étapes OBLIGATOIRES :**
1. `risk_classification` — avant toute action
2. `unit_tests` — si du code est modifié
3. `sast` + `secrets_scan` — CI automatique
4. `quality_gates_ci`
5. `verify` — invariant fondateur (fin de tâche)

**Étapes INTERDITES (anti-cérémonie) :**
- `formal_dor`, `adr`, `human_approval`, `threat_model_*`, `aipd`
- `deep_research`
- `rollback_plan` formel
- Toute émission d'evidence `ci_green`/`sast_clean` si aucun code modifié

**Verdicts de gate :**

| GateType | Verdict attendu |
|----------|----------------|
| `user_prompt` | allow (classification T enregistrée) |
| `pre_tool` | allow |
| `stop` | allow si `unit_tests` + `verify` présents ; warn sinon |

**Anti-exemple canonique documenté :** le bug hook Stop Wave 1 (PROPOSITION.md §8) —
`evaluateStop()` ignorait `requiresEvidenceBeforeStop: false` pour T/L, bloquant
indéfiniment des tâches triviales. Ce comportement est explicitement interdit.

---

#### Niveau L — Low

**Étapes OBLIGATOIRES :**
1. `risk_classification`
2. `unit_tests` + `integration_tests`
3. `sast` + `secrets_scan`
4. `code_review_1`
5. `quality_gates_ci`
6. `rollback_plan` (décrit, même informel)
7. `verify`

**Étapes INTERDITES :**
- `formal_dor`, `adr`, `threat_model_*`, `human_approval`
- `deep_research`

**Verdicts de gate :**

| GateType | Verdict attendu |
|----------|----------------|
| `user_prompt` | allow |
| `pre_tool` | allow |
| `stop` | allow si `code_review_1` + `verify` présents |

**`bypassEligible` conditions L :** `ciGreen === true` ET `diffLinesNet ≤ 100` ET
aucun signal forçant H+ ET aucun fichier sensitif ET `newEndpointExposed !== true`.

---

#### Niveau M — Medium

**Étapes OBLIGATOIRES :**
1. `risk_classification`
2. `formal_dor` (Definition of Ready — gate M bloquante via BEH-012)
3. `privacy_accessibility_impact`
4. `unit_tests` + `integration_tests`
5. `sast` + `secrets_scan`
6. `code_review_1`
7. `quality_gates_ci`
8. `acceptance_validation`
9. `rollback_plan`
10. `active_slo_monitoring`
11. `verify`

**Gates bloquantes M+ :**
- Gate `pre_tool` : block si `formal_dor` absent (BEH-012, plancher M).
- Gate `stop` : BEH-023 émet `warn` si evidence incomplète (non-blocking à M,
  blocking à H+).
- `bypassEligible` : toujours `false` à M+ — les gates sont non-contournables.

**Étapes INTERDITES :**
- `threat_model_stride`, `threat_model_linddun`, `aipd`, `dast`, `sbom`,
  `load_tests`, `human_approval_signed`
- `deep_research`

---

#### Niveau H — High

**Étapes OBLIGATOIRES :**
1. `problem_validation`
2. `user_interviews_jtbd`
3. `risk_classification`
4. `formal_dor`
5. `privacy_accessibility_impact`
6. `adr` (Architecture Decision Record — gate H bloquante)
7. `threat_model_stride`
8. **`deep_research`** ← invariant fondateur, obligatoire à partir de H
9. `unit_tests` + `integration_tests` + `e2e_critical`
10. `sast` + `dast` + `secrets_scan` + `sbom` + `artifact_sign`
11. `code_review_2`
12. `human_approval`
13. `feature_flag`
14. `rollback_plan_tested`
15. `canary_progressive`
16. `verify`

**Gates bloquantes H :**
- Gate `user_prompt` : block si plan non approuvé (pending-approval K-14, PROPOSITION.md §3).
- Gate `pre_tool` : block si `adr` absent.
- Gate `subagent_start` : BEH-031 (watcher) — warn si aucun watcher enregistré
  (non-blocking sur Hermes — voir CONTRADICTION-001 ci-dessous).
- Gate `stop` : BEH-023 → block si evidence incomplète à H+.

**OperatingMode :** `"auto"` (pas `"pairing"` — réservé à C).
**DeploymentStrategy :** `"canary-progressive"`.

---

#### Niveau C — Critical

**Étapes OBLIGATOIRES :**
1. `problem_validation`
2. `user_interviews_jtbd`
3. `risk_classification`
4. `formal_dor`
5. `privacy_accessibility_impact`
6. `adr`
7. `threat_model_stride` + `threat_model_linddun`
8. `aipd` (AI Privacy Impact Assessment)
9. **`deep_research`** ← obligatoire
10. `unit_tests` + `integration_tests` + `e2e_critical`
11. `sast` + `dast` + `secrets_scan` + `sbom` + `artifact_sign`
12. `code_review_2` + `security_audit`
13. `load_tests`
14. `human_approval_signed`
15. `feature_flag`
16. `rollback_plan_repeated`
17. `stakeholder_communication`
18. `postmortem_template`
19. `verify`

**Gates bloquantes C :**
- Gate `user_prompt` : C-stop (K-12) — block tout démarrage sans autorité explicite
  du développeur.
- Gate `pre_tool` : block si action non approuvée (pending-approval K-14).
- Gate `stop` : BEH-023 → block si evidence incomplète.

**OperatingMode :** `"pairing"` — supervision active requise, l'agent ne progresse
pas sans approbation par tour.
**DeploymentStrategy :** `"canary-with-flag"`.

---

### [HIGH][BLOCKS:high] H-002 — Mapping étape → GateType → enforcement

| Étape | GateType(s) | Décision si absente (M+) | Source |
|-------|-------------|--------------------------|--------|
| `risk_classification` | `user_prompt`, `pre_tool` | block | CLASS_UNDERESTIMATED |
| `formal_dor` | `pre_tool` | block (M+) | BEH-012 |
| `adr` | `pre_tool` | block (H+) | PRE_BUILD_DISCIPLINE |
| `deep_research` | `pre_tool` (H+) | block | QO-001 (behavior à créer) |
| `human_approval` | `pre_tool` (H), `stop` | block | K-14 pending-approval |
| `human_approval_signed` | `stop` (C) | block | K-12 C-stop |
| evidence complète | `stop` (H+) | block | BEH-023 |
| watcher enregistré | `subagent_start` (H+) | warn | BEH-031 |
| `verify` | `stop` (tous niveaux) | warn → block (H+) | BEH-023 + invariant fondateur |
| read-before-write | `pre_tool` | block | BEH-010 |

---

### [HIGH][BLOCKS:low] H-003 — Reproductibilité : verdicts loggués dans le ledger sha256

Tout verdict de gate est enregistré dans le ledger hash-chain
(`packages/behavior-core/src/ledger.ts`). L'entrée ledger pour un verdict de gate :

```ts
// payload injecté dans appendLedgerEntry(projectRoot, runId, payload)
{
  type: "gate_verdict",
  gateType: GateType,
  riskClass: RiskClass,
  decision: GateDecision,         // "allow" | "warn" | "block"
  behaviorId?: string,
  violationType?: GateViolationType,
  finalState?: FinalState,
  reason: string,
  ts: string                       // ISO8601 — posé par appendLedgerEntry
}
```

Invariant : la chaîne `prevHash → eventHash` (sha256) ne peut être rompue.
La signature ed25519 par-entrée a été abandonnée (verdict PROPOSITION.md §5 :
clé éphémère = zero authenticité). Le hash-chain reste.

---

## MEDIUM items (convergence detail)

### [MEDIUM][BLOCKS:none] M-001 — Règles de promotion et demotion

- `promoteRisk()` : cible strictement supérieure au niveau courant ; sinon
  `RiskClassificationError("INVALID_DEMOTION")`.
- `demoteRisk()` : exige `authorizedBy: "developer"` ; ne peut descendre que
  d'un niveau ; bloqué si signal forçant incompatible actif.
- Un agent ne peut pas auto-démoter — seul `proposedBy: "developer"` initie.

### [MEDIUM][BLOCKS:none] M-002 — bypassEligible : conditions strictes

`bypassEligible = true` uniquement si :
- `riskClass === "T"` (toujours éligible), OU
- `riskClass === "L"` ET `ciGreen === true` ET `diffLinesNet ≤ 100` ET
  aucun signal forçant H+ ET aucun fichier sensitif ET `newEndpointExposed !== true`.

À M+ : `bypassEligible` est toujours `false`.

### [MEDIUM][BLOCKS:none] M-003 — OperatingMode et DeploymentStrategy par niveau

| Niveau | OperatingMode | DeploymentStrategy |
|--------|---------------|--------------------|
| T | bypass | direct |
| L | auto | direct |
| M | auto | canary-10 |
| H | auto | canary-progressive |
| C | pairing | canary-with-flag |

### [MEDIUM][BLOCKS:none] M-004 — Capability dégradée sur Hermes

Hermes ne supporte pas le hook `stop` bloquant (signal non bloquant). En conséquence,
la gate finale `DONE_VERIFIED` / `BLOCKED_POLICY` doit passer par `pre_tool_call` ou
`pre_llm_call` du tour suivant, pas du tour courant. Matrice complète de dégradation
déléguée à SPEC-003.

---

## LOW items (convergence tail)

### [LOW][BLOCKS:none] L-001 — classifiedAt déterministe en tests

`DETERMINISTIC_CLASSIFIED_AT = "1970-01-01T00:00:00.000Z"` dans `risk-classifier.ts` —
les snapshots de test ne dépendent pas de l'horloge système.

### [LOW][BLOCKS:none] L-002 — Exemples de score composite

```
docs     : impact=1 × probabilité=1 = 1  → T
fix      : impact=2 × probabilité=2 = 4  → L
feature  : impact=3 × probabilité=3 = 9  → M
migration: impact=4 × probabilité=4 = 16 → H
arch_ref : impact=5 × probabilité=4 = 20 → C (+ signal forçant)
```

---

## Contradictions détectées

### CONTRADICTION-001 — BEH-031 (watcher) : warn vs block

**Source A :** `beh-031-watcher.ts` retourne `decision: "warn"` (non-blocking).
**Source B :** PROPOSITION.md §3 liste BEH-031 dans les « gates bloquantes (H/C) ».
**Résolution requise :** le fondateur doit trancher — warn sur tous les runtimes
(posture actuelle), ou block sur les runtimes qui le supportent (Claude Code) et
warn uniquement sur Hermes/Codex ?

### CONTRADICTION-002 — MANDATORY_ACTIVITIES vs invariant `verify`

**Source A :** `MANDATORY_ACTIVITIES` dans `risk-classifier.ts` ne contient pas
`"verify"` dans aucun niveau.
**Source B :** Invariant fondateur (PROPOSITION.md §12) : verify obligatoire à la
fin de CHAQUE tâche.
**Impact :** Le code ne reflète pas l'invariant. `verify` doit être ajouté à tous
les niveaux dans `MANDATORY_ACTIVITIES` en Wave 2, ou géré par une gate `stop`
dédiée indépendante du niveau.
**Non résolu** — décision d'implémentation requise avant Wave 2.

### CONTRADICTION-003 — deep_research : C uniquement ou H+C ?

**Source A :** PROPOSITION.md §12 : « la deep research n'est obligatoire QUE pour
les niveaux critiques ».
**Source B :** PROPOSITION.md §3 : « research-trigger H/C ».
**Décision retenue ici :** H+C (cohérence avec §3 et le contexte textuel). Si le
fondateur voulait C uniquement, M-001 et H-001 sont à réviser.
**Attente :** confirmation fondateur.

---

## Questions ouvertes

### QO-001 — Gate deep_research : quel behavior, quel GateType ?

Aucun `BEH-xxx` dans `packages/behavior-core/src/behaviors/` ne gère l'obligation
de deep research pour H+. Ce behavior est à créer en Wave 2/3.

### QO-002 — messageToChangeset : adaptateur langage naturel → Changeset

Le `Changeset` de `risk-classifier.ts` est orienté changeset de code. Pour hima v0.1,
l'entrée est un message en langage naturel. L'adaptateur
`messageToChangeset(message: string, context) → Changeset` n'est pas spécifié
et bloque l'intégration réelle du classifieur dans le flux `user_prompt`.

---

## Falsifies-If

```
kill-condition   : Si un agent hima complète une tâche H ou C sans que `deep_research`
                   soit enregistrée dans les mandatory activities vérifiées par la gate
                   `stop`, ce document est falsifié — la contrainte n'est pas enforcée.

kill-condition   : Si la gate `stop` retourne `DONE_VERIFIED` pour une tâche T ou L
                   sans que `verify` soit présent dans l'evidence set, ce document est
                   falsifié — l'invariant fondateur `verify-toujours` n'est pas enforced.

kill-condition   : Si `classifyRisk()` n'est jamais appelé avant le premier `pre_tool`
                   d'un run, et que la gate `pre_tool` ne block pas, ce document est
                   falsifié — le classifieur n'est pas dans le main agent.

checkpoint-date  : Wave 2 (avant toute implémentation de gate H/C).

evidence-anchor  : packages/behavior-core/src/risk-classifier.ts MANDATORY_ACTIVITIES,
                   packages/gates-core/src/evaluate-stop.ts,
                   test suite gates-core (à créer en Wave 2).

on-fail          : Ouvrir un ticket Wave 2 bloquant, mettre SPEC-002 en status:blocked,
                   ne pas merger le PR qui falsifie.
```
