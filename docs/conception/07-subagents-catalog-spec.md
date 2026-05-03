# Catalogue des Subagents — Pipeline Fractale v4

> **Statut** : Spec de conception — v1.0 — 2026-05-03
> **Portée** : définition exhaustive des subagents du harness, leur mission, leurs interfaces, leur format de définition par plateforme, et leur intégration dans l'Evidence Set.
> **Dépendances** : `checkpoint-implementation.md` §9.1.3, `rms-runtime-sets-v1-draft.md` §Subagents, `report-hermes-cdx-cld.md` §2.4
> **Source de vérité** : ce document pour la phase Conception

---

## 1. Inventaire complet

Tableau de référence : tous les subagents du harness, MVP et post-MVP.

| Nom | Mission (une ligne) | Cycle + déclencheur | Classe min | Evidence produite | Claude | Codex | Hermes |
|---|---|---|---|---|---|---|---|
| `reviewer` | Revue de code antagoniste contre les standards qualité | Build.Vérifier — à chaque incrément M+ | M | `review-report.md` dans Evidence Set | Markdown | TOML | delegate_task |
| `threat-modeler` | Analyse de menaces STRIDE sur les flux nouveaux | Conception — si classe É ou C | É | `threat-model.md` dans Evidence Set | Markdown | TOML | delegate_task |
| `test-writer` | Rédige les tests TDD RED, aveugle à l'implémentation | Build.Concevoir — avant tout code B | F | `tests-red-evidence.md` + fichiers tests | Markdown | TOML | delegate_task |
| `evidence-collector` | Collecte et structure l'Evidence Set avant stop gate | gate.stop — avant tout DONE_VERIFIED | T | `evidence-set.json` complet | Markdown | TOML | delegate_task |
| `security-auditor` | Audit OWASP ASVS + scan SAST/SCA étendu | Validation — classe É/C | É | `security-audit-report.md` | Markdown | TOML | delegate_task |
| `accessibility-checker` | Vérifie WCAG 2.2 AA sur les parcours UI critiques | Validation — tout changement UI M+ | M | `a11y-report.md` | Markdown | TOML | delegate_task |
| `perf-profiler` | Mesure latence p99/taux d'erreur contre SLO définis | Validation — classe M+ avec SLO | M | `perf-report.md` + résultats k6 | Markdown | TOML | delegate_task |
| `doc-generator` | Génère/met à jour README, ADR, CHANGELOG à partir des diffs | Build.Capitaliser — incrément user-facing | F | `doc-update-report.md` | Markdown | TOML | delegate_task |
| `retro-facilitator` | Anime la rétrospective de cycle, produit les action items | Apprentissage — fin de chaque cycle M+ | M | `retro-report.md` | Markdown | TOML | delegate_task |

---

## 2. Subagents core (MVP)

### 2.1 `reviewer`

**Mission** : jouer le rôle d'un reviewer antagoniste. Lire le diff, appliquer la checklist de revue de code (correctness, tests, sécurité STRIDE rapide, observabilité, accessibilité, privacy, performance, FinOps, lisibilité, Tidy First), lister les objections numérotées, et rendre un verdict binaire : APPROVED / CHANGES_REQUIRED.

**Input** :
```json
{
  "type": "reviewer",
  "input": {
    "diff": "<git diff ou contenu des fichiers modifiés>",
    "risk_class": "M",
    "acceptance_criteria": ["Given...", "When...", "Then..."],
    "threat_model_ref": ".planning/<feature>/threat-model.md",
    "checklist": "build-review-checklist"
  }
}
```

**Output** :
```json
{
  "verdict": "CHANGES_REQUIRED",
  "objections": [
    { "id": 1, "severity": "blocking", "category": "security", "description": "..." },
    { "id": 2, "severity": "minor", "category": "observability", "description": "..." }
  ],
  "approved_items": ["Tidy First respecté", "Tests couvrent les chemins critiques"],
  "confidence": 0.85
}
```

**Contribution à l'Evidence Set** :
- Fichier `review-report.md` écrit dans `.rms/runs/<run-id>/evidence/`
- Champ `review` de `evidence-set.json` alimenté avec le verdict et la liste des objections

**Quand spawner** : étape Build.Vérifier (sous-cycle étape 5), obligatoire pour M/É/C. Pour T/F : optionnel mais recommandé.

**Fichier de définition** : `artifacts/subagents/reviewer.md` (voir §4)

---

### 2.2 `threat-modeler`

**Mission** : analyser les nouveaux flux de données introduits par l'incrément, appliquer la méthode STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), identifier les menaces pertinentes, et produire un threat model structuré avec les contrôles recommandés.

**Input** :
```json
{
  "type": "threat-modeler",
  "input": {
    "design_doc": ".planning/<feature>/design-doc.md",
    "new_data_flows": ["flux auth", "flux paiement"],
    "risk_class": "É",
    "existing_threat_model_ref": "docs/07-architecture/threat-model.md"
  }
}
```

**Output** :
```json
{
  "threats": [
    {
      "id": "T-001",
      "stride_category": "Elevation of privilege",
      "component": "auth service",
      "description": "...",
      "likelihood": "high",
      "impact": "critical",
      "mitigations": ["..."],
      "status": "open"
    }
  ],
  "residual_risks": ["..."],
  "recommended_controls": ["..."]
}
```

**Contribution à l'Evidence Set** :
- Fichier `threat-model.md` écrit dans `.rms/runs/<run-id>/evidence/`
- Champ `security.threat_model` de `evidence-set.json` alimenté

**Quand spawner** : cycle Conception, sous-cycle étape 3 (Concevoir), obligatoire pour É et C. Jamais pour T/F/M.

**Fichier de définition** : `artifacts/subagents/threat-modeler.md`

---

### 2.3 `test-writer`

**Mission** : rédiger des tests TDD RED à partir des critères d'acceptation (Given-When-Then), sans jamais consulter le code de production existant. Les tests doivent échouer pour la bonne raison (fonction non encore implémentée, pas une erreur de syntaxe). Produire les fichiers de test et un rapport d'evidence confirmant l'état RED.

**Règle critique** : cet agent reçoit uniquement la spec (critères d'acceptation, interfaces prévues). Il ne reçoit JAMAIS le code de production. Toute dépendance visible au code d'implémentation invalide la phase RED.

**Input** :
```json
{
  "type": "test-writer",
  "input": {
    "acceptance_criteria": [
      { "id": "AC-001", "given": "...", "when": "...", "then": "..." }
    ],
    "interface_contracts": "docs/07-architecture/interfaces.md",
    "test_strategy": "pyramide",
    "target_module": "src/domain/user",
    "risk_class": "M"
  }
}
```

**Output** :
```json
{
  "test_files": [
    { "path": "tests/unit/user.test.ts", "content": "..." },
    { "path": "tests/integration/user-repo.test.ts", "content": "..." }
  ],
  "red_evidence": {
    "all_tests_fail": true,
    "failure_reasons": ["UserService not found", "method register not implemented"],
    "invalid_failures": []
  }
}
```

**Contribution à l'Evidence Set** :
- Fichier `tests-red-evidence.md` dans `.rms/runs/<run-id>/evidence/`
- Les fichiers de test sont écrits dans le repo cible
- Champ `tests.red_phase` de `evidence-set.json` alimenté

**Quand spawner** : Build.Concevoir (étape 3), avant tout code B. Obligatoire pour M/É/C en mode TDD. Déclenché par le harness avant d'autoriser `gate.pre_tool` sur les fichiers de production.

**Fichier de définition** : `artifacts/subagents/test-writer.md`

---

### 2.4 `evidence-collector`

**Mission** : parcourir l'état courant du run (Run Set), collecter toutes les preuves disponibles (résultats CI, rapports subagents, fichiers modifiés, décisions de hooks), assembler un `evidence-set.json` complet et évaluer si le niveau d'evidence est suffisant pour autoriser `DONE_VERIFIED`. Si insuffisant, lister explicitement les gaps.

**Input** :
```json
{
  "type": "evidence-collector",
  "input": {
    "run_id": "<run-id>",
    "run_set_path": ".rms/runs/<run-id>/run-set.json",
    "policy_set_path": ".rms/registry/policies.yaml",
    "risk_class": "É",
    "events_log": ".rms/runs/<run-id>/events.jsonl"
  }
}
```

**Output** :
```json
{
  "evidence_set": {
    "commands_run": ["pnpm test", "pnpm lint", "pnpm build"],
    "test_results": { "passed": 42, "failed": 0, "coverage": "83%" },
    "lint_typecheck": "green",
    "sast_sca": "green",
    "files_modified": ["src/domain/user.ts", "tests/unit/user.test.ts"],
    "hook_decisions": [...],
    "subagent_outputs": { "reviewer": "APPROVED", "threat-modeler": "threats-mitigated" },
    "review": { "verdict": "APPROVED", "objections_resolved": true },
    "residual_risks": [],
    "known_gaps": [],
    "confidence_level": 0.92
  },
  "final_state_recommendation": "DONE_VERIFIED",
  "blocking_gaps": []
}
```

**Contribution à l'Evidence Set** :
- Produit directement `evidence-set.json` dans `.rms/runs/<run-id>/`
- C'est le seul subagent qui écrit le fichier `evidence-set.json` — les autres subagents écrivent leurs rapports dans `evidence/`, `evidence-collector` les consolide

**Quand spawner** : gate.stop, avant toute décision `DONE_VERIFIED`. Obligatoire pour toutes les classes. Bloquant : si `blocking_gaps` non vide, le final state est `DONE_WITH_GAPS` ou `BLOCKED_NEEDS_USER`.

**Fichier de définition** : `artifacts/subagents/evidence-collector.md`

---

## 3. Subagents étendus (post-MVP)

Ces subagents ne font pas partie du MVP minimal. Ils sont planifiés pour l'Étape 3 (extension aux classes É/C) ou au-delà.

### 3.1 `security-auditor`

**Mission** : audit de sécurité complet sur un incrément de classe É/C. Vérification des contrôles OWASP ASVS pertinents, lancement d'un scan DAST simulé sur les endpoints exposés, vérification des CVE dans les dépendances introduites, production d'un rapport structuré par chapitre ASVS.

**Déclencheur** : Validation, incrément É/C.
**Evidence** : `security-audit-report.md` + tableau ASVS coverage dans Evidence Set.
**Dépend de** : résultats SAST/SCA CI déjà disponibles, threat model produit par `threat-modeler`.

---

### 3.2 `accessibility-checker`

**Mission** : vérification WCAG 2.2 AA sur les parcours UI critiques. Analyse de l'arbre d'accessibilité (accessibility tree), simulation de navigation clavier, vérification des contrastes, contrôle des attributs ARIA. Produit un rapport de conformité avec les critères A/AA violés et les corrections recommandées.

**Déclencheur** : Validation, tout changement UI de classe M+.
**Evidence** : `a11y-report.md` dans Evidence Set, zéro violation A/AA bloquante.
**Note plateforme** : sur Expo/mobile, utilise l'accessibility tree natif — jamais de screenshots.

---

### 3.3 `perf-profiler`

**Mission** : mesurer les métriques de performance (latence p50/p95/p99, throughput, taux d'erreur) sur l'environnement de staging, comparer aux SLO définis en Conception, identifier les régressions > 10 % sans justification.

**Déclencheur** : Validation, incrément M+ avec SLO définis.
**Evidence** : `perf-report.md` + résultats k6/Gatling dans Evidence Set.
**Input requis** : SLO documentés en Conception (latence p99 cible, taux d'erreur max, throughput nominal).

---

### 3.4 `doc-generator`

**Mission** : à partir du diff Git et des critères d'acceptation, générer ou mettre à jour les artefacts de documentation : README (si comportement change), ADR (si nouvelle décision d'architecture), CHANGELOG (si changement user-facing). Ne pas créer de documentation si aucun changement observable ne le justifie.

**Déclencheur** : Build.Capitaliser, incrément user-facing.
**Evidence** : `doc-update-report.md` listant les fichiers créés/modifiés.
**Règle** : ne jamais créer de doc pour des changements purement internes (refactoring S).

---

### 3.5 `retro-facilitator`

**Mission** : animer la rétrospective de fin de cycle. Collecter les métriques du cycle (DORA, qualité, dette), identifier les patterns récurrents (défauts escaped, commits mixtes S+B, promotions de classe), formuler 3-5 action items concrets et mesurables pour le cycle suivant.

**Déclencheur** : cycle Apprentissage, fin de chaque cycle M+.
**Evidence** : `retro-report.md` dans `.planning/timeline/`.
**Input** : `events.jsonl` du cycle, métriques DORA, registre dette, promotions de classe.

---

## 4. Format de définition par plateforme

### 4.1 Claude Code — Markdown dans `artifacts/subagents/`

Format : fichier Markdown avec frontmatter YAML. Installé dans `.claude/agents/<name>.md` ou `~/.claude/agents/<name>.md`.

**Template** :

```markdown
---
name: <subagent-name>
description: >
  <Description concise. Utilisée par Claude pour auto-sélectionner le subagent
  quand la description correspond à la tâche demandée.>
model: claude-sonnet-4-6
tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
allowedTools:
  - Read
  - Grep
  - Glob
  - Write(path:.rms/runs/**/evidence/*)
---

# <Subagent Name>

## Mission

<Mission en une phrase impérative.>

## Règles invariantes

- Écrire les résultats UNIQUEMENT dans `.rms/runs/<run-id>/evidence/` — jamais en mémoire implicite.
- Ne jamais modifier de fichiers de production hors du périmètre de la mission.
- Si le run_id n'est pas fourni en input, lire `.rms/state/active-run.json`.
- Chaque output doit être un JSON structuré ou un fichier Markdown dans l'Evidence Set.

## Input attendu

<Description du JSON d'input avec les champs obligatoires.>

## Output produit

<Description du JSON d'output et des fichiers créés.>

## Contribution à l'Evidence Set

- Fichier : `<nom-du-rapport>.md` dans `.rms/runs/<run-id>/evidence/`
- Champ JSON : `evidence-set.json["<section>"]`
```

**Exemple concret** (`artifacts/subagents/reviewer.md`) :

```markdown
---
name: reviewer
description: >
  Revue de code antagoniste. Lit un diff Git, applique la checklist de revue
  qualité (correctness, tests, sécurité STRIDE, observabilité, accessibilité,
  Tidy First), liste les objections numérotées, rend un verdict APPROVED ou
  CHANGES_REQUIRED. Spawner à Build.Vérifier pour tout incrément M+.
model: claude-sonnet-4-6
tools:
  - Read
  - Grep
  - Write
---

# Reviewer

## Mission

Jouer le rôle d'un reviewer antagoniste sur un diff Git et rendre un verdict
structuré avec objections numérotées.

[... reste du contenu ...]
```

---

### 4.2 Codex — TOML dans `artifacts/subagents/codex/`

Format : fichier TOML. Installé dans `.codex/agents/<name>.toml` ou `~/.codex/agents/<name>.toml`.

**Template** :

```toml
name = "<subagent-name>"
description = """
<Description concise. Utilisée par Codex pour router vers ce subagent
quand la tâche correspond.>
"""

instructions = """
# Mission

<Mission en une phrase impérative.>

## Règles invariantes

- Écrire les résultats UNIQUEMENT dans .rms/runs/<run-id>/evidence/
- Ne jamais modifier de fichiers de production hors du périmètre.
- Input JSON depuis stdin ou variable d'environnement HARNESS_INPUT.
- Output JSON structuré vers stdout + fichier dans l'Evidence Set.

## Input attendu

<Champs JSON obligatoires>

## Output produit

<Structure JSON de sortie>
"""

[model]
provider = "openai"
name = "gpt-5.4"

[sandbox]
writable_roots = [".rms/runs"]
network = false

[tools]
allowed = ["read_file", "write_file", "search_files"]
```

---

### 4.3 Hermes — `delegate_task` config dans `artifacts/subagents/hermes/`

Format : section de configuration dans `~/.hermes/config.yaml` + skill SKILL.md optionnel. Hermes n'a pas de format "subagent file" natif équivalent — le subagent est déclenché via `delegate_task` avec un prompt structuré.

**Template de config** :

```yaml
# ~/.hermes/config.yaml (section delegation)
delegation:
  max_concurrent_children: 3
  max_spawn_depth: 1
  children:
    - role: reviewer
      description: >
        Revue de code antagoniste. Lit un diff, applique la checklist qualité,
        liste les objections, rend un verdict APPROVED ou CHANGES_REQUIRED.
      instructions_file: ~/.hermes/skills/harness-reviewer/SKILL.md
      max_iterations: 20
```

**Template de skill SKILL.md** (pour les subagents Hermes complexes) :

```markdown
---
name: harness-<subagent-name>
description: >
  <Description pour Hermes Skills Hub>
version: "1.0.0"
platforms: [hermes]
metadata:
  harness_subagent: true
  harness_type: "<subagent-name>"
---

# Harness — <SubagentName>

## Mission

<Mission impérative>

## Règles

- Output JSON dans `.rms/runs/<run-id>/evidence/`
- Lire run_id depuis l'environnement HARNESS_RUN_ID si non fourni.
- Résultat final retourné comme texte structuré au parent via delegate_task.

[...]
```

---

## 5. Gestion des résultats de subagents

**Règle fondamentale** (issue de `rms-runtime-sets-v1-draft.md`) :

> Le résultat d'un subagent doit toujours remonter dans l'Evidence Set ou `events.jsonl`. Il ne doit jamais devenir une mémoire implicite invisible.

### 5.1 Circuit obligatoire

```
subagent exécuté
  → écrit son rapport dans .rms/runs/<run-id>/evidence/<rapport>.md
  → retourne JSON structuré au thread parent
  → thread parent écrit une ligne dans events.jsonl :
      { "ts": "...", "event": "subagent_completed", "type": "reviewer",
        "verdict": "APPROVED", "evidence_path": "evidence/review-report.md" }
  → evidence-collector consolide dans evidence-set.json
```

### 5.2 Interdits explicites

- Un subagent ne doit **jamais** écrire directement dans `evidence-set.json` (sauf `evidence-collector`).
- Un subagent ne doit **jamais** modifier des fichiers de production hors de son périmètre déclaré.
- Un subagent ne doit **jamais** spawner d'autres subagents (toutes les plateformes interdisent le nested spawn ou le limitent à depth 1 — respecter depth 0 en MVP).
- Un résultat subagent non tracé dans `events.jsonl` est considéré invalide par le RMS.

### 5.3 Traitement des échecs

| État du subagent | Action du harness |
|---|---|
| Résultat structuré valide | Enregistrer dans Evidence Set, continuer |
| Timeout (> seuil configuré) | Log dans events.jsonl, marquer gap dans evidence-set.json |
| Erreur d'exécution | Log, incrémenter attempt counter, retry si < 3 |
| 3 tentatives échouées | Final state → `BLOCKED_RUNTIME_MISSING` si plateforme absente, sinon `MAX_ATTEMPTS_REACHED` |
| Verdict bloquant (ex: reviewer CHANGES_REQUIRED) | Suspendre le run, notifier le développeur, attendre correction |

---

## 6. Matrice Subagent × Classe de risque

| Subagent | T | F | M | É | C |
|---|:---:|:---:|:---:|:---:|:---:|
| `reviewer` | — | ○ | **M** | **M** | **M** |
| `threat-modeler` | — | — | — | **M** | **M** |
| `test-writer` | — | ○ | **M** | **M** | **M** |
| `evidence-collector` | **M** | **M** | **M** | **M** | **M** |
| `security-auditor` | — | — | ○ | **M** | **M** |
| `accessibility-checker` | — | — | **M** (si UI) | **M** | **M** |
| `perf-profiler` | — | — | ○ | **M** | **M** |
| `doc-generator` | — | ○ | ○ | **M** | **M** |
| `retro-facilitator` | — | — | **M** | **M** | **M** |

**Légende** : **M** = Mandatory (bloquant) — ○ = Optional (recommandé, non bloquant) — — = Skipped

**Règle de cumul** : quand un incrément contient des changements de classes différentes, c'est la **classe maximale** qui détermine la colonne applicable.

**Règle bypass** : en mode bypass (classes T/F uniquement), seul `evidence-collector` reste mandatory. Les autres sont skipped. Le bypass est interdit pour É/C (décision D4 du checkpoint).

---

## 7. Modèle de concurrence

### 7.1 Limites par plateforme

| Plateforme | Max parallel subagents | Max depth | Timeout par défaut |
|---|---|---|---|
| Claude Code | Non documenté globalement — `maxTurns` par subagent | 1 (pas de nested spawn) | Configurable par subagent |
| Codex | 6 (`agents.max_threads`) | 1 (`agents.max_depth`) | 1800 s |
| Hermes | 3 (`max_concurrent_children`) | 1 (`max_spawn_depth`, cap 3) | Configurable |

**Règle MVP** : spawner au maximum 3 subagents en parallèle pour rester portable sur les 3 plateformes.

### 7.2 Isolation

Chaque subagent reçoit un contexte isolé : il ne voit pas l'historique complet du thread parent. Il reçoit uniquement :
1. Son prompt système (défini dans son fichier de définition)
2. L'input JSON structuré fourni par le harness
3. Le contenu des fichiers explicitement passés en input

Cette isolation est garantie nativement par les 3 plateformes (Claude Code : contexte propre, Codex : thread séparé, Hermes : conversation fraîche).

### 7.3 Zones d'écriture et conflits

Pour éviter les conflits d'écriture en cas de subagents parallèles :

- Chaque subagent écrit **uniquement** dans son répertoire dédié : `.rms/runs/<run-id>/evidence/<subagent-name>/`
- `evidence-collector` est **toujours séquentiel** (spawné en dernier, après tous les autres)
- `events.jsonl` est append-only — les écritures concurrentes sont tolérées (chaque ligne est atomique)

### 7.4 Séquençage recommandé par cycle

**Build.Concevoir** :
```
spawn test-writer (séquentiel — doit finir avant le code)
```

**Build.Vérifier** (M+) :
```
spawn reviewer        ─┐
spawn security-auditor ─┤ parallèle (3 max)
spawn accessibility-checker (si UI) ─┘
↓ (attendre tous)
spawn evidence-collector (séquentiel)
```

**Validation** (É/C) :
```
spawn security-auditor ─┐
spawn perf-profiler     ─┤ parallèle
spawn accessibility-checker ─┘
↓ (attendre tous)
spawn evidence-collector
```

**gate.stop** (toutes classes) :
```
spawn evidence-collector (séquentiel — toujours en dernier)
→ évaluer final state
```

### 7.5 Fusion des résultats

Le thread parent (harness) est responsable de la fusion. Algorithme :

1. Attendre la completion de tous les subagents du batch courant
2. Lire leurs outputs JSON depuis les fichiers evidence
3. Détecter les conflits : si deux subagents produisent des verdicts contradictoires sur le même artefact, le verdict le plus restrictif gagne (CHANGES_REQUIRED > APPROVED, BLOCKED > DONE)
4. Passer le résultat fusionné à `evidence-collector`

---

## 8. API TypeScript

### 8.1 Types

```typescript
// packages/core/src/subagents/types.ts

export type SubagentType =
  | 'reviewer'
  | 'threat-modeler'
  | 'test-writer'
  | 'evidence-collector'
  | 'security-auditor'
  | 'accessibility-checker'
  | 'perf-profiler'
  | 'doc-generator'
  | 'retro-facilitator';

export type RiskClass = 'T' | 'F' | 'M' | 'É' | 'C';

export type SubagentStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT';

export type FinalStateRecommendation =
  | 'DONE_VERIFIED'
  | 'DONE_WITH_GAPS'
  | 'BLOCKED_NEEDS_USER'
  | 'BLOCKED_RUNTIME_MISSING'
  | 'BLOCKED_POLICY'
  | 'MAX_ATTEMPTS_REACHED';

export interface SubagentInput {
  runId: string;
  riskClass: RiskClass;
  /** Payload spécifique au type de subagent */
  payload: ReviewerInput | ThreatModelerInput | TestWriterInput | EvidenceCollectorInput | Record<string, unknown>;
}

export interface ReviewerInput {
  diff: string;
  acceptanceCriteria: string[];
  threatModelRef?: string;
  checklist?: 'build-review-checklist' | 'security-checklist';
}

export interface ThreatModelerInput {
  designDoc: string;
  newDataFlows: string[];
  existingThreatModelRef?: string;
}

export interface TestWriterInput {
  acceptanceCriteria: Array<{ id: string; given: string; when: string; then: string }>;
  interfaceContracts?: string;
  testStrategy: 'pyramide' | 'trophée' | 'honeycomb';
  targetModule: string;
}

export interface EvidenceCollectorInput {
  runSetPath: string;
  policySetPath: string;
  eventsLog: string;
}

export interface SubagentResult {
  type: SubagentType;
  runId: string;
  status: SubagentStatus;
  /** Verdict structuré, dépend du type */
  output: ReviewerOutput | ThreatModelerOutput | TestWriterOutput | EvidenceCollectorOutput | Record<string, unknown>;
  /** Chemin du fichier rapport dans l'Evidence Set */
  evidencePath: string;
  /** Durée d'exécution en millisecondes */
  durationMs: number;
  /** Erreur éventuelle si status === 'FAILED' */
  error?: string;
}

export interface ReviewerOutput {
  verdict: 'APPROVED' | 'CHANGES_REQUIRED';
  objections: Array<{
    id: number;
    severity: 'blocking' | 'major' | 'minor';
    category: string;
    description: string;
  }>;
  approvedItems: string[];
  confidenceLevel: number;
}

export interface ThreatModelerOutput {
  threats: Array<{
    id: string;
    strideCategory: string;
    component: string;
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high' | 'critical';
    mitigations: string[];
    status: 'open' | 'mitigated' | 'accepted';
  }>;
  residualRisks: string[];
  recommendedControls: string[];
}

export interface TestWriterOutput {
  testFiles: Array<{ path: string; content: string }>;
  redEvidence: {
    allTestsFail: boolean;
    failureReasons: string[];
    invalidFailures: string[];
  };
}

export interface EvidenceCollectorOutput {
  evidenceSet: EvidenceSet;
  finalStateRecommendation: FinalStateRecommendation;
  blockingGaps: string[];
}

export interface EvidenceSet {
  commandsRun: string[];
  testResults: { passed: number; failed: number; coverage?: string };
  lintTypecheck: 'green' | 'red' | 'skipped';
  sastSca: 'green' | 'red' | 'skipped';
  filesModified: string[];
  hookDecisions: Array<{ gate: string; decision: 'allow' | 'deny'; ts: string }>;
  subagentOutputs: Partial<Record<SubagentType, string>>;
  review?: { verdict: string; objectionsResolved: boolean };
  residualRisks: string[];
  knownGaps: string[];
  confidenceLevel: number;
}
```

### 8.2 Fonction principale

```typescript
// packages/core/src/subagents/spawn.ts

import type { SubagentType, SubagentInput, SubagentResult } from './types.js';

/**
 * Spawne un subagent isolé et attend son résultat.
 *
 * Le résultat est toujours persisté dans l'Evidence Set avant d'être retourné.
 * En cas d'échec (max 3 tentatives), lève une SubagentError avec le détail.
 *
 * @param type   - Type de subagent à spawner
 * @param input  - Input structuré, validé avant spawn
 * @returns      - Résultat du subagent avec chemin evidence et durée
 */
export async function spawnSubagent(
  type: SubagentType,
  input: SubagentInput
): Promise<SubagentResult>;

/**
 * Spawne plusieurs subagents en parallèle (max 3 simultanés).
 * Attend tous les résultats avant de retourner.
 * En cas de conflit de verdict, applique la règle du verdict le plus restrictif.
 */
export async function spawnSubagentBatch(
  tasks: Array<{ type: SubagentType; input: SubagentInput }>
): Promise<SubagentResult[]>;

/**
 * Détermine quels subagents sont mandatory/optional/skipped
 * pour une classe de risque donnée et un cycle donné.
 */
export function getRequiredSubagents(
  riskClass: RiskClass,
  cycle: 'build' | 'validation' | 'stop-gate'
): {
  mandatory: SubagentType[];
  optional: SubagentType[];
  skipped: SubagentType[];
};
```

### 8.3 Utilisation dans le runtime

```typescript
// Exemple d'utilisation dans packages/runtime/src/pre-tool-use.ts

import { spawnSubagent, getRequiredSubagents } from '@harness/core/subagents';
import { readRunState } from '@harness/core/planning';

const state = await readRunState();

// À Build.Concevoir — avant d'autoriser l'écriture de code B
if (state.phase === 'build.concevoir' && state.riskClass >= 'M') {
  const result = await spawnSubagent('test-writer', {
    runId: state.runId,
    riskClass: state.riskClass,
    payload: {
      acceptanceCriteria: state.currentIncrement.acceptanceCriteria,
      testStrategy: state.testStrategy,
      targetModule: state.currentIncrement.targetModule,
    },
  });

  if (!result.output.redEvidence.allTestsFail) {
    // Tests pas en état RED → bloquer le Build
    return { action: 'deny', reason: 'Tests must be RED before writing production code (TDD)' };
  }
}

// À gate.stop — toujours
const evidenceResult = await spawnSubagent('evidence-collector', {
  runId: state.runId,
  riskClass: state.riskClass,
  payload: {
    runSetPath: `.rms/runs/${state.runId}/run-set.json`,
    policySetPath: '.rms/registry/policies.yaml',
    eventsLog: `.rms/runs/${state.runId}/events.jsonl`,
  },
});

if (evidenceResult.output.blockingGaps.length > 0) {
  return { action: 'deny', reason: `Evidence gaps: ${evidenceResult.output.blockingGaps.join(', ')}` };
}
```

---

## Annexe A — Emplacements des fichiers de définition

```
artifacts/
└── subagents/
    ├── reviewer.md               Claude Code
    ├── threat-modeler.md
    ├── test-writer.md
    ├── evidence-collector.md
    ├── security-auditor.md
    ├── accessibility-checker.md
    ├── perf-profiler.md
    ├── doc-generator.md
    ├── retro-facilitator.md
    ├── codex/
    │   ├── reviewer.toml         Codex
    │   ├── threat-modeler.toml
    │   ├── test-writer.toml
    │   ├── evidence-collector.toml
    │   └── ...
    └── hermes/
        ├── harness-reviewer/
        │   └── SKILL.md          Hermes (via delegate_task)
        ├── harness-threat-modeler/
        │   └── SKILL.md
        └── ...
```

---

## Annexe B — Portabilité des subagents par plateforme

| Concept RMS | Claude Code | Codex | Hermes | Stratégie |
|---|---|---|---|---|
| Définition subagent | `.claude/agents/<name>.md` | `.codex/agents/<name>.toml` | config.yaml + SKILL.md optionnel | Générateur par adaptateur |
| Spawn | Auto (description match) ou explicite | Explicite uniquement | `delegate_task` | Harness spawn toujours explicite |
| Isolation contexte | Contexte propre, pas d'historique parent | Thread séparé | Conversation fraîche | Garantie sur les 3 |
| Max parallèle | Non documenté (MVP: 3) | 6 | 3 | MVP: 3 (plus restrictif) |
| Max depth | 1 (pas de nested) | 1 | 1 (cap 3) | MVP: 0 nested spawn |
| Retour résultat | Réponse finale au parent | Output final remonte | Résumé final synchrone | JSON structuré attendu |
| Écriture evidence | `Write` tool sur `.rms/` | `write_file` sur `.rms/` | Tool writing Hermes | Path `.rms/runs/<id>/evidence/` |

---

*Produit en phase Conception — à utiliser comme référence pour l'implémentation de `packages/core/src/subagents/` et des artefacts dans `artifacts/subagents/`.*
*Prochaine étape : implémenter les fichiers de définition concrets dans `artifacts/subagents/` (Étape 2 MVP — Claude Code uniquement).*
