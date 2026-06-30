# SPEC-002 — Protocole criticality

**statut:** DRAFT — Wave 1.5 spécification  
**date:** 2026-06-11  
**source de vérité code:** `packages/behavior-core/src/risk-class.ts`, `risk-classifier.ts`  
**auteur:** spec-protocole (lane Wave 15)  
**précédents:** PROPOSITION.md §3, §12 ; deep-interview-hima-positioning.md Round 3

---

## Résumé

Ce document est le contrat différenciant de hima : la criticality n'est pas déclarée en prompt, elle est **classifiée en code** par le main agent au moment du `user_prompt`, puis enforced mécaniquement par des gates bloquantes à chaque événement du cycle. L'invariant fondateur est : verify en fin de CHAQUE tâche, deep research obligatoire SEULEMENT pour H/C.

---

## CRITICAL items

### [CRITICAL][BLOCKS:critical] C-001 — Définitions T/L/M/H/C (source de vérité : risk-class.ts)

Les cinq niveaux sont définis dans `packages/behavior-core/src/risk-class.ts` :

```
RISK_CLASSES = ["T", "L", "M", "H", "C"]  (ordre croissant)
RISK_CLASS_RANK = { T:0, L:1, M:2, H:3, C:4 }
```

Signification sémantique dérivée de `risk-classifier.ts` (MANDATORY_ACTIVITIES + scores composites) :

| Niveau | Nom fonctionnel | Score composite | Exemples représentatifs |
|--------|----------------|-----------------|------------------------|
| T | Trivial | ≤ 2 | docs, commentaire, renommage local |
| L | Low | 3–5 | fix, refactor mineur, deps patch |
| M | Medium | 6–10 | feature nouvelle, refactor multi-fichiers |
| H | High | 11–17 | auth, billing, migration schéma, API publique, infra |
| C | Critical | ≥ 18 ou signal forçant | health data, biométrie, multi-repo, architecture_refactor |

**Signals forçants (override le score composite) :**
- Fichiers : patterns `HIGH_FILE_PATTERNS` (auth, payments, migrations, infra…) → force ≥ H  
- Fichiers : patterns `CRITICAL_FILE_PATTERNS` (health, biometric, medical) → force C  
- Labels : `HIGH_LABELS` (auth, migration, pii…) → force ≥ H ; `CRITICAL_LABELS` (hipaa, arch-refactor, cross-repo…) → force C  
- Diff content : `HIGH_DIFF_PATTERNS` (CREATE TABLE, ALTER TABLE, secrets en clair…) → force ≥ H  
- Diff content : `CRITICAL_DIFF_PATTERNS` (health_data, biometric…) → force C  
- Structurel : `reposCount ≥ 2` → force C ; `changeType === "architecture_refactor"` → force C  
- Structurel : `diffLinesNet > 300` → plancher M  

**Règle de résolution :** `maxRiskClass([forcedClass, calculatedClass, structuralMinimum])` — jamais de rétrogradation silencieuse.

---

### [CRITICAL][BLOCKS:critical] C-002 — Qui classifie : le main agent au user_prompt

**Décision fondateur (PROPOSITION.md §12, invariant non re-litigable) :**

> Le classifieur de risque vit dans le **main agent** — l'agent avec lequel le fondateur parle classifie, le risque est récupéré, et le protocole par niveau s'applique.

**Interface de classification (entrée → sortie) :**

```typescript
// Entrée
interface ClassificationInput {
  message: string;          // texte brut du user_prompt (magic words strippés)
  contextFiles: string[];   // fichiers ouverts / mentionnés dans le message
  diffContent?: string;     // diff courant si disponible
  labels?: string[];        // labels actifs (depuis run-set.json ou inférés)
  changeType: ChangeType;   // inféré du message : feature | fix | refactor | migration | infra | docs | architecture_refactor
  diffLinesNet?: number;
  reposCount?: number;
}

// Sortie : ClassificationResult (risk-classifier.ts)
interface ClassificationResult {
  riskClass: RiskClass;             // T | L | M | H | C
  justification: string;            // trace humaine
  activeSignals: ForcingSignal[];   // signaux qui ont forcé le niveau
  compositeScore?: number;
  operatingMode: OperatingMode;     // bypass | auto | pairing
  deploymentStrategy: DeploymentStrategy;
  mandatoryActivities: string[];    // liste des étapes obligatoires pour ce niveau
  bypassEligible: boolean;
  classifiedAt: string;             // ISO8601
  proposedBy: "agent" | "developer";
}
```

**Appel :** `classifyRisk(changeset: Changeset)` depuis `risk-classifier.ts`. Le main agent construit le `Changeset` depuis le message utilisateur avant toute autre action.

---

### [CRITICAL][BLOCKS:critical] C-003 — Re-check : quand reclassifier

La classification n'est pas définitive. Re-classer obligatoirement quand :

1. Un fichier touché correspond à un pattern forçant non présent au moment de la classification initiale.
2. Le diff effectif révèle un pattern `HIGH_DIFF_PATTERNS` ou `CRITICAL_DIFF_PATTERNS`.
3. `diffLinesNet` dépasse le seuil structurel (> 300) en cours d'exécution.
4. Un label est ajouté manuellement par le développeur.
5. `reposCount` passe à ≥ 2 lors d'un spawn de sous-agent cross-repo.
6. La gate `pre_tool` détecte `CLASS_UNDERESTIMATED` (violation type existant dans `behavior-registry.ts`).

**Appel :** `promoteRisk(current, target, reason, triggerContext?)` depuis `risk-classifier.ts`. La rétrogradation (`demoteRisk`) exige `authorizedBy: "developer"` et ne peut sauter qu'un niveau à la fois.

---

### [CRITICAL][BLOCKS:critical] C-004 — Enforcement : gate bloquante si l'agent ne classifie pas

Si aucune classification n'est enregistrée dans `run-set.json` au moment d'un événement `pre_tool` ou `stop`, le behavior `BEH-023` (completion-status) et les gates M+/C existants ne peuvent pas s'évaluer. L'enforcement est :

- **Gate `user_prompt`** : vérifie la présence d'un `riskClass` valide dans le run-set courant. Si absent → `decision: "block"`, `violationType: "CLASS_UNDERESTIMATED"`, le tour ne progresse pas.
- **Gate `pre_tool`** : si `riskClass` absent ou invalide → block idem.
- **Gate `stop`** : `BEH-023` exige un `riskClass ≥ M` pour bloquer sur evidence incomplète ; sans `riskClass` → verdict conservateur = block avec `finalState: "BLOCKED_POLICY"`.

---

## HIGH items

### [HIGH][BLOCKS:high] H-001 — Matrice protocole : étapes obligatoires par niveau

Source : `MANDATORY_ACTIVITIES` dans `risk-classifier.ts` + invariants fondateur (PROPOSITION.md §12).

**Invariants fondateur (s'appliquent à TOUS les niveaux) :**
- `verify` obligatoire en fin de CHAQUE tâche (avis clair, vérification même partielle).
- `deep_research` obligatoire SEULEMENT pour H et C.

#### Niveau T — Trivial

**Étapes OBLIGATOIRES :**
1. `risk_classification` — classifier avant d'agir
2. `unit_tests` — si du code est modifié
3. `sast` + `secrets_scan` — automatique CI
4. `quality_gates_ci`
5. `verify` — avis de fin de tâche (invariant fondateur)

**Étapes INTERDITES (anti-cérémonie) :**
- Aucune gate M+/C (pas de `formal_dor`, pas de `adr`, pas de `human_approval`)
- Pas de deep research
- Pas de `rollback_plan` formel
- Pas d'émission de `ci_green` / `sast_clean` si aucun code modifié (bug v1 documenté : `baseline-policy.ts` ignorait `requiresEvidenceBeforeStop: false` pour T → boucle hook Stop)

**GateType → verdict :**

| GateType | Verdict attendu |
|----------|----------------|
| `user_prompt` | allow (classification T enregistrée) |
| `pre_tool` | allow |
| `stop` | allow si `unit_tests` et `verify` présents |

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
- Pas de `formal_dor`, `adr`, `threat_model`, `human_approval`
- Pas de deep research

**GateType → verdict :**

| GateType | Verdict attendu |
|----------|----------------|
| `user_prompt` | allow |
| `pre_tool` | allow |
| `stop` | allow si `code_review_1` + `verify` présents |

---

#### Niveau M — Medium

**Étapes OBLIGATOIRES :**
1. `risk_classification`
2. `formal_dor` (Definition of Ready)
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
- Gate `pre_tool` : bloque si `formal_dor` absent (behavior `BEH-012`, floor M).
- Gate `stop` : BEH-023 émet `warn` si evidence incomplète (non blocking à M, blocking à H+).

**Étapes INTERDITES :**
- Pas de `threat_model_stride`, `threat_model_linddun`, `aipd`, `dast`, `sbom`, `load_tests`
- Pas de `human_approval_signed`
- Pas de deep research

---

#### Niveau H — High

**Étapes OBLIGATOIRES :**
1. `problem_validation`
2. `user_interviews_jtbd`
3. `risk_classification`
4. `formal_dor`
5. `privacy_accessibility_impact`
6. `adr` (Architecture Decision Record)
7. `threat_model_stride`
8. **`deep_research`** (invariant fondateur — obligatoire à partir de H)
9. `unit_tests` + `integration_tests` + `e2e_critical`
10. `sast` + `dast` + `secrets_scan` + `sbom` + `artifact_sign`
11. `code_review_2`
12. `human_approval`
13. `feature_flag`
14. `rollback_plan_tested`
15. `canary_progressive`
16. `verify`

**Gates bloquantes H :**
- Gate `subagent_start` : BEH-031 (watcher) — warn si aucun watcher enregistré (non-blocking sur Hermes, voir §Contradictions).
- Gate `stop` : BEH-023 → `block` si evidence incomplète à H+.
- Gate `user_prompt` : gate pending-approval (K-14 dans PROPOSITION.md §3) — bloque si plan non approuvé.

**OperatingMode :** `"auto"` (pas `"pairing"` — réservé à C).

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
9. **`deep_research`** (obligatoire)
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
- Gate `user_prompt` : C-stop (K-12) — bloque tout démarrage sans autorité explicite du développeur.
- Gate `stop` : BEH-023 → block sur evidence incomplète.
- Gate `pre_tool` : pending-approval (K-14) — block si action non approuvée.

**OperatingMode :** `"pairing"` — l'agent ne progresse pas sans supervision active.  
**DeploymentStrategy :** `"canary-with-flag"`.

---

### [HIGH][BLOCKS:high] H-002 — Mapping étape → GateType → GateDecision

| Étape | GateType(s) | GateDecision si absente (M+) | Behavior |
|-------|-------------|------------------------------|---------|
| `risk_classification` | `user_prompt`, `pre_tool` | block | CLASS_UNDERESTIMATED |
| `formal_dor` | `pre_tool` | block (M+) | BEH-012 |
| `deep_research` | `pre_tool` (H+) | block | à définir (QUESTION OUVERTE §QO-001) |
| `human_approval` | `pre_tool` (H), `stop` | block | K-14 pending-approval |
| `human_approval_signed` | `stop` (C) | block | K-12 C-stop |
| `adr` | `pre_tool` (H+) | block | PRE_BUILD_DISCIPLINE |
| evidence complete | `stop` (H+) | block | BEH-023 |
| watcher enregistré | `subagent_start` (H+) | warn | BEH-031 |
| verify | `stop` (tous niveaux) | warn/block | BEH-023 |
| read-before-write | `pre_tool` | block | BEH-010 |

---

### [HIGH][BLOCKS:low] H-003 — Reproductibilité : verdicts logués dans le ledger sha256

Tout verdict de gate est enregistré dans le ledger hash-chain (`packages/behavior-core/src/ledger.ts`). Format d'une entrée :

```typescript
interface LedgerEntry {
  sha256: string;         // hash de l'entrée courante
  prevHash: string;       // hash de l'entrée précédente (chain)
  timestamp: string;      // ISO8601
  gateType: GateType;
  riskClass: RiskClass;
  decision: GateDecision;
  behaviorId?: string;
  violationType?: GateViolationType;
  finalState?: FinalState;
  reason: string;
}
```

**Invariant :** la chain ne peut être rompue ; une entrée manquante entre deux hashes consécutifs est détectable. La signature ed25519 par-entrée a été abandonnée (PROPOSITION.md §5 — verdict : « supprimer, la clé éphémère par entrée n'authentifie rien »). Le sha256-chain reste.

---

## MEDIUM items (convergence detail)

### [MEDIUM][BLOCKS:none] M-001 — Reclassification et demotion : règles de protection

- `promoteRisk` : la cible doit être strictement supérieure au niveau courant (enforced dans `risk-classifier.ts` — lance `RiskClassificationError` code `INVALID_DEMOTION` sinon).
- `demoteRisk` : exige `authorizedBy: "developer"`, ne peut descendre que d'un niveau, bloqué si un signal forçant incompatible est actif.
- Un agent ne peut pas auto-démoter ; seul le développeur (`proposedBy: "developer"`) peut initier une demotion.

### [MEDIUM][BLOCKS:none] M-002 — BypassEligible : conditions

Un changeset est `bypassEligible` uniquement si :
- `riskClass === "T"` (toujours éligible), OU
- `riskClass === "L"` ET `ciGreen === true` ET `diffLinesNet ≤ 100` ET aucun signal forçant H+ ET aucun fichier sensitif ET `newEndpointExposed !== true`.

À riskClass M+, `bypassEligible` est toujours `false` — les gates sont non-contournables.

### [MEDIUM][BLOCKS:none] M-003 — Capability degradée sur Hermes

Hermes ne supporte pas le hook `stop` bloquant (signal non bloquant). Conséquence : la gate finale `DONE_VERIFIED` / `BLOCKED_POLICY` doit passer par `pre_tool_call` ou `pre_llm_call` du tour **suivant**, pas du tour courant. Matrice de dégradation complète déléguée à SPEC-004 (capability mapping GateType × runtime — QUESTION OUVERTE §QO-002).

### [MEDIUM][BLOCKS:none] M-004 — OperatingMode par niveau

| RiskClass | OperatingMode | Signification |
|-----------|---------------|---------------|
| T | bypass | Gates passantes ; CI suffit |
| L | auto | Gates actives, pas de supervision humaine requise |
| M | auto | idem + gates M bloquantes |
| H | auto | idem + deep research + human_approval |
| C | pairing | Supervision humaine active ; chaque action approuvée |

---

## LOW items (convergence tail)

### [LOW][BLOCKS:none] L-001 — DeploymentStrategy par niveau

| RiskClass | DeploymentStrategy |
|-----------|--------------------|
| T, L | direct |
| M | canary-10 |
| H | canary-progressive |
| C | canary-with-flag |

### [LOW][BLOCKS:none] L-002 — classifiedAt déterministe en tests

`DETERMINISTIC_CLASSIFIED_AT = "1970-01-01T00:00:00.000Z"` dans `risk-classifier.ts` — les tests ne dépendent pas de l'horloge système.

---

## Contradictions détectées

### CONTRADICTION-001 — BEH-031 (watcher) : warn vs block sur Hermes

**Référence A :** `beh-031-watcher.ts` retourne `decision: "warn"` (non-blocking) pour l'absence de watcher à H+.  
**Référence B :** PROPOSITION.md §3 liste BEH-031 dans les « gates bloquantes (hook) » : « watcher » apparaît dans la catégorie « Gate bloquante » avec la note `(H/C)`.  
**Impact :** Si BEH-031 doit être bloquant comme annoncé en §3, le code actuel ne le reflète pas. Sur Hermes spécifiquement, `BEH_031_DEGRADED_MODE.hermes` documente que le `warn` est un « capability gap accepté ».  
**Non résolu intentionnellement** — le fondateur doit trancher : BEH-031 reste-t-il warn sur tous les runtimes, ou block sur les runtimes qui le supportent (Claude Code) et warn uniquement sur Hermes/Codex ?

### CONTRADICTION-002 — deep_research : gate ou étape de protocol ?

**Référence A :** PROPOSITION.md §12 invariant fondateur : « la deep research n'est obligatoire QUE pour les niveaux critiques ».  
**Référence B :** PROPOSITION.md §3 : « research-trigger H/C » dans la colonne « Injection de contexte ».  
**Ambiguïté :** "niveaux critiques" désigne-t-il uniquement C, ou H+C ? Le rapport de lane OMO et le contexte texte suggèrent H+C. Ce document (H-001) a retenu H+C par cohérence avec `research-trigger H/C`. Si le fondateur voulait C uniquement, M-001 est à revoir.  
**Attente :** confirmation fondateur.

### CONTRADICTION-003 — MANDATORY_ACTIVITIES vs invariant verify-toujours

**Référence A :** `MANDATORY_ACTIVITIES` dans `risk-classifier.ts` ne contient pas `"verify"` comme entrée explicite dans aucun niveau.  
**Référence B :** PROPOSITION.md §12 invariant fondateur : « verify obligatoire à la fin de CHAQUE tâche quel que soit le niveau ».  
**Impact :** Le code source actuel ne reflète pas cet invariant. `verify` devra être ajouté à tous les niveaux dans `MANDATORY_ACTIVITIES` lors de Wave 2/3, ou géré par une gate dédiée `stop` indépendante du niveau.  
**Non résolu** — décision d'implémentation requise avant Wave 2.

---

## Questions ouvertes

### QO-001 — Gate deep_research : quel behavior, quel GateType ?

Aucun `BEH-xxx` existant dans `packages/behavior-core/src/behaviors/` ne gère l'obligation de deep research. Le mapping H-002 indique « à définir ». Ce behavior est à créer en Wave 2/3.

### QO-002 — Matrice GateType × runtime × dégradation

L'ancien `04-runtime-bindings-spec.md` avait l'embryon de cette matrice (PROPOSITION.md §12). Elle n'existe pas encore dans la restructure v2. Déléguée à SPEC-004.

### QO-003 — Interface de classification depuis le main agent

Le `Changeset` de `risk-classifier.ts` est orienté changeset de code (fichiers, diff, labels). Pour le cas hima v0.1 (le fondateur parle au main agent), l'entrée est un **message en langage naturel**. Il manque un adaptateur `messageToChangeset(message: string, context) → Changeset` qui infère `changeType`, `files`, `labels` depuis le texte. Ce composant n'est pas spécifié et bloque l'intégration réelle du classifieur dans le flux `user_prompt`.
