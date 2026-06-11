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
| `reviewer` | Revue de code antagoniste contre les standards qualité | `phase=build`, `sub_phase=Verify` — à chaque incrément M+ | M | section `evidence.subagents.reviewer` | Markdown | TOML | delegate_task |
| `threat-modeler` | Analyse de menaces STRIDE sur les flux nouveaux | `phase=conception`, `sub_phase=Design` — si classe H ou C | H | section `evidence.subagents.threat_modeler` | Markdown | TOML | delegate_task |
| `test-writer` | Rédige les tests TDD RED, aveugle à l'implémentation | `phase=build`, `sub_phase=Design` — avant tout code B | L | section `evidence.tests.red_phase` + fichiers tests | Markdown | TOML | delegate_task |
| `evidence-collector` | Collecte et structure l'Evidence Set avant stop gate | `gate=stop` — avant tout DONE_VERIFIED | T | section Evidence Set de `.planning/run-set.json` | Markdown | TOML | delegate_task |
| `security-auditor` | Audit OWASP ASVS + scan SAST/SCA étendu | `phase=validation` — classe H/C | H | section `evidence.subagents.security_auditor` | Markdown | TOML | delegate_task |
| `accessibility-checker` | Vérifie WCAG 2.2 AA sur les parcours UI critiques | `phase=validation` — tout changement UI M+ | M | section `evidence.subagents.accessibility_checker` | Markdown | TOML | delegate_task |
| `perf-profiler` | Mesure latence p99/taux d'erreur contre SLO définis | `phase=validation` — classe M+ avec SLO | M | section `evidence.subagents.perf_profiler` + résultats k6 | Markdown | TOML | delegate_task |
| `doc-generator` | Génère/met à jour README, ADR, CHANGELOG à partir des diffs | `phase=build`, `sub_phase=Capitalize` — incrément user-facing | L | section `evidence.subagents.doc_generator` | Markdown | TOML | delegate_task |
| `retro-facilitator` | Anime la rétrospective de cycle, produit les action items | `phase=learning` — fin de chaque cycle M+ | M | section `evidence.subagents.retro` | Markdown | TOML | delegate_task |

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
    "threat_model_ref": ".planning/run-set.json#evidence.conception.threat_model",
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
- Résultat retourné au parent puis persisté dans `.planning/run-set.json`
- Section `evidence.subagents.reviewer` alimentée avec le verdict et la liste des objections

**Quand spawner** : `phase=build`, `sub_phase=Verify`, obligatoire pour M/H/C. Pour T/L : optionnel mais recommandé.

**Fichier de définition** : `artifacts/subagents/reviewer.md` (voir §4)

---

### 2.2 `threat-modeler`

**Mission** : analyser les nouveaux flux de données introduits par l'incrément, appliquer la méthode STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege), identifier les menaces pertinentes, et produire un threat model structuré avec les contrôles recommandés.

**Input** :
```json
{
  "type": "threat-modeler",
  "input": {
    "design_doc": ".planning/run-set.json#evidence.conception.design_doc",
    "new_data_flows": ["flux auth", "flux paiement"],
    "risk_class": "H",
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
- Résultat retourné au parent puis persisté dans `.planning/run-set.json`
- Section `evidence.security.threat_model` alimentée

**Quand spawner** : cycle Conception, sous-cycle étape 3 (Design), obligatoire pour H et C. Jamais pour T/L/M.

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
- Résultat retourné au parent puis persisté dans `.planning/run-set.json`
- Les fichiers de test sont écrits dans le repo cible
- Section `evidence.tests.red_phase` alimentée

**Quand spawner** : `phase=build`, `sub_phase=Design`, avant tout code B. Obligatoire pour M/H/C en mode TDD. Déclenché par le harness avant d'autoriser `pre_tool` sur les fichiers de production.

**Fichier de définition** : `artifacts/subagents/test-writer.md`

---

### 2.4 `evidence-collector`

**Mission** : parcourir l'état courant du run (Run Set), collecter toutes les preuves disponibles (résultats CI, rapports subagents, fichiers modifiés, décisions de hooks), assembler la section Evidence Set de `.planning/run-set.json` et évaluer si le niveau d'evidence est suffisant pour autoriser `DONE_VERIFIED`. Si insuffisant, lister explicitement les gaps.

**Input** :
```json
{
  "type": "evidence-collector",
  "input": {
    "run_id": "<run-id>",
    "run_set_path": ".planning/run-set.json",
    "policy_set_path": ".planning/state.yaml#policy_set",
    "risk_class": "H",
    "events_ref": ".planning/run-set.json#events"
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
- Produit la mise à jour de la section `evidence` dans `.planning/run-set.json`
- C'est le seul subagent dont le résultat peut remplacer l'Evidence Set logique complet ; les autres subagents retournent des rapports structurés que le parent consolide

**Quand spawner** : stop, avant toute décision `DONE_VERIFIED`. Obligatoire pour toutes les classes. Bloquant : si `blocking_gaps` non vide, le final state est `DONE_WITH_GAPS` ou `BLOCKED_NEEDS_USER`.

**Fichier de définition** : `artifacts/subagents/evidence-collector.md`

---

## 3. Subagents étendus (post-MVP)

Ces subagents ne font pas partie du MVP minimal. Ils sont planifiés pour l'Étape 3 (extension aux classes H/C) ou au-delà.

### 3.1 `security-auditor`

**Mission** : audit de sécurité complet sur un incrément de classe H/C. Vérification des contrôles OWASP ASVS pertinents, lancement d'un scan DAST simulé sur les endpoints exposés, vérification des CVE dans les dépendances introduites, production d'un rapport structuré par chapitre ASVS.

**Déclencheur** : Validation, incrément H/C.
**Evidence** : section `evidence.subagents.security_auditor` + tableau ASVS coverage dans l'Evidence Set logique.
**Dépend de** : résultats SAST/SCA CI déjà disponibles, threat model produit par `threat-modeler`.

---

### 3.2 `accessibility-checker`

**Mission** : vérification WCAG 2.2 AA sur les parcours UI critiques. Analyse de l'arbre d'accessibilité (accessibility tree), simulation de navigation clavier, vérification des contrastes, contrôle des attributs ARIA. Produit un rapport de conformité avec les critères A/AA violés et les corrections recommandées.

**Déclencheur** : Validation, tout changement UI de classe M+.
**Evidence** : section `evidence.subagents.accessibility_checker`, zéro violation A/AA bloquante.
**Note plateforme** : sur Expo/mobile, utilise l'accessibility tree natif — jamais de screenshots.

---

### 3.3 `perf-profiler`

**Mission** : mesurer les métriques de performance (latence p50/p95/p99, throughput, taux d'erreur) sur l'environnement de staging, comparer aux SLO définis en Conception, identifier les régressions > 10 % sans justification.

**Déclencheur** : Validation, incrément M+ avec SLO définis.
**Evidence** : section `evidence.subagents.perf_profiler` + résultats k6/Gatling.
**Input requis** : SLO documentés en Conception (latence p99 cible, taux d'erreur max, throughput nominal).

---

### 3.4 `doc-generator`

**Mission** : à partir du diff Git et des critères d'acceptation, générer ou mettre à jour les artefacts de documentation : README (si comportement change), ADR (si nouvelle décision d'architecture), CHANGELOG (si changement user-facing). Ne pas créer de documentation si aucun changement observable ne le justifie.

**Déclencheur** : `phase=build`, `sub_phase=Capitalize`, incrément user-facing.
**Evidence** : section `evidence.subagents.doc_generator` listant les fichiers créés/modifiés.
**Règle** : ne jamais créer de doc pour des changements purement internes (refactoring S).

---

### 3.5 `retro-facilitator`

**Mission** : animer la rétrospective de fin de cycle. Collecter les métriques du cycle (DORA, qualité, dette), identifier les patterns récurrents (défauts escaped, commits mixtes S+B, promotions de classe), formuler 3-5 action items concrets et mesurables pour le cycle suivant.

**Déclencheur** : `phase=learning`, fin de chaque cycle M+.
**Evidence** : section `evidence.subagents.retro` dans `.planning/run-set.json`.
**Input** : section `events` du cycle, métriques DORA, registre dette, promotions de classe.

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
  # Aucun Write direct dans .planning/ ; le parent harness persiste les résultats.
---

# <Subagent Name>

## Mission

<Mission en une phrase impérative.>

## Règles invariantes

- Retourner les résultats au parent sous forme structurée ; le parent persiste dans `.planning/run-set.json`.
- Ne jamais modifier de fichiers de production hors du périmètre de la mission.
- Si le run_id n'est pas fourni en input, lire `.planning/state.yaml`.
- Chaque output doit être un JSON structuré intégrable dans l'Evidence Set logique.

## Input attendu

<Description du JSON d'input avec les champs obligatoires.>

## Output produit

<Description du JSON d'output et des fichiers créés.>

## Contribution à l'Evidence Set

- Section logique : `.planning/run-set.json#evidence.subagents.<subagent-name>`
- Champ JSON : `evidence["<section>"]`
```

**Exemple concret** (`artifacts/subagents/reviewer.md`) :

```markdown
---
name: reviewer
description: >
  Revue de code antagoniste. Lit un diff Git, applique la checklist de revue
  qualité (correctness, tests, sécurité STRIDE, observabilité, accessibilité,
  Tidy First), liste les objections numérotées, rend un verdict APPROVED ou
  CHANGES_REQUIRED. Spawner à phase=build, sub_phase=Verify pour tout incrément M+.
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

- Retourner les résultats au parent sous forme structurée pour persistance dans .planning/run-set.json
- Ne jamais modifier de fichiers de production hors du périmètre.
- Input JSON depuis stdin ou variable d'environnement HARNESS_INPUT.
- Output JSON structuré vers stdout + section dans l'Evidence Set logique.

## Input attendu

<Champs JSON obligatoires>

## Output produit

<Structure JSON de sortie>
"""

[model]
provider = "openai"
name = "gpt-5.4"

[sandbox]
writable_roots = []
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

- Output JSON au parent pour persistance dans `.planning/run-set.json`
- Lire run_id depuis l'environnement HARNESS_RUN_ID si non fourni.
- Résultat final retourné comme texte structuré au parent via delegate_task.

[...]
```

---

## 5. Gestion des résultats de subagents

**Règle fondamentale** (issue de `rms-runtime-sets-v1-draft.md`) :

> Le résultat d'un subagent doit toujours remonter dans l'Evidence Set logique ou la section `events` de `.planning/run-set.json`. Il ne doit jamais devenir une mémoire implicite invisible.

### 5.1 Circuit obligatoire

```
subagent exécuté
  → retourne JSON structuré au thread parent
  → thread parent appende un événement dans .planning/run-set.json#events :
      { "ts": "...", "event": "subagent_completed", "type": "reviewer",
        "verdict": "APPROVED", "evidence_ref": "evidence.subagents.reviewer" }
  → evidence-collector consolide dans .planning/run-set.json#evidence
```

### 5.2 Interdits explicites

- Un subagent ne doit **jamais** écrire directement dans `.planning/run-set.json` ; seul le parent harness persiste les sections canoniques.
- Un subagent ne doit **jamais** modifier des fichiers de production hors de son périmètre déclaré.
- Un subagent ne doit **jamais** spawner d'autres subagents (toutes les plateformes interdisent le nested spawn ou le limitent à depth 1 — respecter depth 0 en MVP).
- Un résultat subagent non tracé dans `.planning/run-set.json#events` est considéré invalide par le RMS.

### 5.3 Traitement des échecs

| État du subagent | Action du harness |
|---|---|
| Résultat structuré valide | Enregistrer dans l'Evidence Set logique, continuer |
| Timeout (> seuil configuré) | Log dans `.planning/run-set.json#events`, marquer gap dans `.planning/run-set.json#evidence` |
| Erreur d'exécution | Log, incrémenter attempt counter, retry si < 3 |
| 3 tentatives échouées | Final state → `BLOCKED_RUNTIME_MISSING` si plateforme absente, sinon `MAX_ATTEMPTS_REACHED` |
| Verdict bloquant (ex: reviewer CHANGES_REQUIRED) | Suspendre le run, notifier le développeur, attendre correction |

---

## 6. Matrice Subagent × Classe de risque

| Subagent | T | L | M | H | C |
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

**Règle bypass** : en mode bypass (classes T/L uniquement), seul `evidence-collector` reste mandatory. Les autres sont skipped. Le bypass est interdit pour H/C (décision D4 du checkpoint).

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

- Chaque subagent retourne un JSON structuré sans écriture `.planning/` directe
- `evidence-collector` est **toujours séquentiel** (spawné en dernier, après tous les autres)
- Le parent harness sérialise les écritures vers `.planning/run-set.json`

### 7.4 Séquençage recommandé par cycle

**phase=build, sub_phase=Design** :
```
spawn test-writer (séquentiel — doit finir avant le code)
```

**phase=build, sub_phase=Verify** (M+) :
```
spawn reviewer        ─┐
spawn security-auditor ─┤ parallèle (3 max)
spawn accessibility-checker (si UI) ─┘
↓ (attendre tous)
spawn evidence-collector (séquentiel)
```

**Validation** (H/C) :
```
spawn security-auditor ─┐
spawn perf-profiler     ─┤ parallèle
spawn accessibility-checker ─┘
↓ (attendre tous)
spawn evidence-collector
```

**stop** (toutes classes) :
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

export type RiskClass = 'T' | 'L' | 'M' | 'H' | 'C';

export const RISK_CLASS_RANK: Record<RiskClass, number> = {
  T: 0,
  L: 1,
  M: 2,
  H: 3,
  C: 4,
};

export function riskAtLeast(current: RiskClass, minimum: RiskClass): boolean {
  return RISK_CLASS_RANK[current] >= RISK_CLASS_RANK[minimum];
}

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
  eventsRef: string;
}

export interface SubagentResult {
  type: SubagentType;
  runId: string;
  status: SubagentStatus;
  /** Verdict structuré, dépend du type */
  output: ReviewerOutput | ThreatModelerOutput | TestWriterOutput | EvidenceCollectorOutput | Record<string, unknown>;
  /** Référence logique dans la section evidence de .planning/run-set.json */
  evidenceRef: string;
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
  hookDecisions: Array<{ gateType: string; decision: 'allow' | 'deny'; ts: string }>;
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
 * Le résultat est toujours persisté dans l'Evidence Set logique avant d'être retourné.
 * En cas d'échec (max 3 tentatives), lève une SubagentError avec le détail.
 *
 * @param type   - Type de subagent à spawner
 * @param input  - Input structuré, validé avant spawn
 * @returns      - Résultat du subagent avec référence evidence et durée
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
  cycle: 'build' | 'validation' | 'stop'
): {
  mandatory: SubagentType[];
  optional: SubagentType[];
  skipped: SubagentType[];
};
```

### 8.3 Utilisation dans le runtime

```typescript
// Exemple d'utilisation dans packages/runtime/src/pre-tool-use.ts

import { spawnSubagent, getRequiredSubagents, riskAtLeast } from '@harness/core/subagents';
import { readRunState } from '@harness/core/planning';

const state = await readRunState();

// À phase=build, sub_phase=Design — avant d'autoriser l'écriture de code B
if (state.phase === 'build' && state.subPhase === 'Design' && riskAtLeast(state.riskClass, 'M')) {
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

// À stop — toujours
const evidenceResult = await spawnSubagent('evidence-collector', {
  runId: state.runId,
  riskClass: state.riskClass,
  payload: {
    runSetPath: '.planning/run-set.json',
    policySetPath: '.planning/state.yaml#policy_set',
    eventsRef: '.planning/run-set.json#events',
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
| Écriture evidence | Retour JSON au parent | Retour JSON au parent | Résumé final synchrone | Persistance parent dans `.planning/run-set.json#evidence` |

---

*Note Cycle 75 drift* : the executable subagent catalog source is now
`packages/core/src/catalogs/operational-catalog.ts`, rendered by
`packages/core/src/catalogs/artifact-generation.ts` into managed `artifacts/subagents/<id>.md`
files. Runtime enforcement still depends on the adapter capability profile: Claude has native
subagent start/stop events, Codex lacks unmanaged subagent hooks, and Hermes exposes
`subagent_stop` as observable/non-blocking while `subagent_start` is unsupported in the executable
MVP profile.
