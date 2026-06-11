# SPEC-006 — Boucle plan/boulder + état .hima/

status: draft
date: 2026-06-11
owner: protocole (hima-spec-wave15)
source-of-truth-code:
  - packages/behavior-core/src/ledger.ts
  - packages/behavior-core/src/run-set-types.ts
  - .planning/restructure/lanes/lane-omo.md §2
  - .hima/state/ (layout réel observé)
cross-refs: SPEC-001, SPEC-002, SPEC-005
claim-bearing: true

---

## Résumé

Le boulder est la primitive de persistance du travail multi-session de hima. Un boulder = un plan markdown produit par le profil `planner` + un état JSON (`.hima/boulder.json`) qui lie ce plan aux sessions qui l'exécutent. L'exécution est assurée par le profil `executor`. La boucle : `readCurrentTopLevelTask` → exécuter → cocher → `isComplete`. Chaque événement significatif est logué dans le ledger sha256-chain. Le mapping SDLC fondateur (analyse → spécification → design → implémentation ⇄ test → maintenance) se traduit en sections de plan, chaque transition gatée par un verdict de criticality.

**Blocage légal (invariant) :** le mécanisme est décrit depuis lane-omo.md §2 (OMO boulder-state). Tout le code est réimplémenté — aucune copie de code OMO (SUL-1.0).

---

## CRITICAL items

### [CRITICAL][BLOCKS:critical] CR-001 — Layout .hima/ : structure complète

```
.hima/
  boulder.json              # état boulder courant (schema v1 hima — ci-dessous)
  plans/                    # plans markdown produits par le planner
    <slug>-<workId>.md      # un plan par boulder
  state/
    ledger/
      <runId>.jsonl         # ledger sha256-chain par run (existant, ledger.ts)
    events.jsonl            # événements bruts de session (existant)
    conception/             # artefacts de phase (ADR, specs, notes)
  rules/                    # règles injectées par le rules-engine (versionnées)
  .gitignore                # auto-généré : ignore tout sauf rules/
```

**Règle .gitignore (invariant) :** à la première écriture dans `.hima/`, créer `.hima/.gitignore` avec :

```
*
!/rules/
!/rules/**
```

L'état runtime (boulder.json, ledger, events) est local-only. Les règles sont versionnées. Ce split est le seul moyen de ne pas committer d'état de session tout en versionant les politiques.

---

### [CRITICAL][BLOCKS:critical] CR-002 — Format boulder.json (schema v1 hima)

```typescript
interface BoulderState {
  schema_version: 1;
  active_work_id: string | null;       // workId du boulder actif, null si aucun
  works: Record<string, BoulderWork>;  // tous les boulders (actifs + historique)
}

interface BoulderWork {
  work_id: string;           // slug-8hexchars (ex: "refactor-auth-a1b2c3d4")
  plan_path: string;         // chemin relatif au projectRoot : ".hima/plans/<slug>-<workId>.md"
  plan_name: string;         // slug lisible (ex: "refactor-auth")
  status: "active" | "completed" | "paused" | "abandoned";
  sdlc_phase: SdlcPhase;     // phase SDLC courante (voir CR-005)
  risk_class: RiskClass;     // T | L | M | H | C — classifié à la création
  started_at: string;        // ISO8601
  updated_at: string;        // ISO8601
  ended_at?: string;         // ISO8601, présent si status completed/abandoned
  elapsed_ms: number;        // durée cumulée active
  session_ids: string[];     // sessions rattachées (ordre chronologique)
  session_origins: Record<string, "direct" | "appended">;
  worktree_path?: string;    // path absolu si le work tourne dans un worktree git
  task_sessions: Record<string, TaskSessionState>;
}

interface TaskSessionState {
  task_key: string;           // "todo:N" ou "F:N" (final wave)
  status: "running" | "completed" | "cancelled";
  started_at: string;
  elapsed_ms: number;
}

type SdlcPhase = "analyse" | "specification" | "design" | "implementation" | "test" | "maintenance";
type RiskClass = "T" | "L" | "M" | "H" | "C";
```

**Règle de cohérence :** `active_work_id` doit pointer sur une clé existante dans `works`, ou être `null`. Toute écriture qui violerait cette invariant est rejetée (écriture défensive avec rollback — voir CR-004).

---

### [CRITICAL][BLOCKS:critical] CR-003 — Format des plans markdown

Le plan est le contrat d'exécution du boulder. Format strict imposé par le planner :

```markdown
---
work_id: <workId>
plan_name: <slug>
sdlc_phase: <phase>
risk_class: <T|L|M|H|C>
created_at: <ISO8601>
---

# <titre lisible du boulder>

## Context

<Contexte de 2-5 lignes : pourquoi ce travail, quelle décision a déclenché ce boulder.>

## TODOs

- [ ] 1. <Titre de la tâche 1>
- [ ] 2. <Titre de la tâche 2>
- [ ] 3. <Titre de la tâche 3>

## Final Verification Wave

- [ ] F1. Verify : <ce que verify doit confirmer>
- [ ] F2. Ledger chain intact (verifyLedgerChain)
```

**Règles de format (testables) :**
- Les tâches TODO sont des checkboxes de niveau 0 : `- [ ] N. Titre` où N est un entier croissant depuis 1.
- Les tâches de la Final Verification Wave sont `- [ ] F1. Titre`, `- [ ] F2. Titre`, etc.
- Une tâche cochée = `- [x] N. Titre` (minuscule x).
- Indentation des checkboxes : zéro espace (niveau racine uniquement — les sous-tâches indentées ne sont pas scannées par `readCurrentTopLevelTask`).
- La section `## Final Verification Wave` est **obligatoire** et doit contenir au moins un item `verify`.

**Pattern de détection des checkboxes non cochées :**
```
/^[-*]\s*\[\s*\]\s*(.+)$/  (pas d'indentation)
```

---

### [CRITICAL][BLOCKS:critical] CR-004 — Cycle de vie d'un boulder

#### Création (déclencheur : commande `/plan`)

1. Le profil `planner` est activé.
2. Le planner produit `<slug>-<workId>.md` dans `.hima/plans/`.
3. `createBoulder(projectRoot, planPath, planName, riskClass)` :
   - Génère `workId = "${planName}-${randomHex(8)}"`.
   - Crée l'entrée dans `boulder.json` avec `status: "active"`, `sdlc_phase` inféré depuis le frontmatter du plan.
   - Met à jour `active_work_id`.
   - Écrit `.hima/.gitignore` si absent.
4. Un événement `boulder_created` est logué dans le ledger (`appendLedgerEntry`).

#### Rattachement de session (déclencheur : `session_start`)

1. Gate `session_start` lit `boulder.json`.
2. Si `active_work_id` non null → `appendSessionId(projectRoot, sessionId, "appended")` :
   - Lit le boulder courant.
   - Ajoute `sessionId` à `session_ids` et `session_origins[sessionId] = "appended"`.
   - Met à jour `updated_at`.
   - Écrit de manière défensive : lit → modifie → écrit (pas d'écriture si lecture échoue).
3. Si `active_work_id` est null → pas de rattachement automatique. La session démarre sans boulder actif.
4. Un événement `session_attached` est logué dans le ledger.

#### Exécution (boucle principale, déclencheur : `/ulw` ou exécution automatique)

```
loop:
  task = readCurrentTopLevelTask(planPath)
  if task == null → goto VERIFY
  startTaskTimer(workId, task.key)
  execute(task)
  checkTask(planPath, task.key)   // coche - [ ] → - [x] dans le .md
  endTaskTimer(workId, task.key)
  log ledger: task_completed
  goto loop

VERIFY:
  execute Final Verification Wave tasks
  if all F tasks pass → completeBoulder()
  else → boulder remains active, surface gap
```

`readCurrentTopLevelTask(planPath)` : scanne le plan ligne à ligne, retourne la première checkbox non cochée de niveau 0 hors section `## Final Verification Wave`. Retourne `null` si toutes les tâches TODO sont cochées.

#### Reprise multi-session (déclencheur : nouvelle session avec `active_work_id` non null)

1. `getWorkResumeOptions(projectRoot)` : liste tous les `works` avec `status: "active" | "paused"`, calcule la progression `getPlanProgress(planPath)` pour chacun.
2. Le main agent présente les options de reprise au fondateur (ou reprend automatiquement si un seul boulder actif).
3. `appendSessionId` rattache la nouvelle session.
4. La boucle reprend depuis `readCurrentTopLevelTask` — les tâches déjà cochées sont sautées automatiquement.

#### Clôture (déclencheur : toutes les tâches + Final Verification Wave cochées)

1. `completeBoulder(projectRoot, workId)` :
   - Met `status: "completed"`, `ended_at: now`, calcule `elapsed_ms` final.
   - Met `active_work_id: null`.
2. Un événement `boulder_completed` est logué dans le ledger.
3. Le ledger chain est vérifié (`verifyLedgerChain`) — si la chain est rompue, le boulder passe à `status: "paused"` et une alerte est émise.

#### Abandon (déclencheur : décision explicite du fondateur ou gate C-stop)

1. `abandonBoulder(projectRoot, workId, reason)` : `status: "abandoned"`, `ended_at: now`.
2. Événement `boulder_abandoned` dans le ledger avec `reason`.
3. `active_work_id: null`.

---

### [CRITICAL][BLOCKS:critical] CR-005 — Mapping SDLC : phases, sections de plan, gates de transition

Le cycle SDLC fondateur (PROPOSITION.md §12) est :

```
analyse → spécification → design → implémentation ⇄ test → maintenance/feedback
```

v0.1 couvre les 5 premières phases. Déploiement et maintenance complète sont déférés.

#### Phases et leur correspondance dans le boulder

| Phase SDLC | `sdlc_phase` | Section plan | Gate de transition (sortie) |
|------------|-------------|--------------|---------------------------|
| Analyse | `analyse` | `## TODOs` contient tâches d'exploration/interview | verify : artefact d'analyse produit |
| Spécification | `specification` | `## TODOs` contient tâches spec/ADR | verify : spec acceptée, ADR status=accepted (M+) |
| Design | `design` | `## TODOs` contient tâches de design (UI, architecture) | verify : design reviewé par critic |
| Implémentation | `implementation` | `## TODOs` contient tâches de code | verify : tests passent, gates CI vertes |
| Test | `test` | `## Final Verification Wave` | verify : DONE_VERIFIED confirmé |
| Maintenance | `maintenance` | nouveau boulder créé | — |

**Règle de transition :** un boulder ne change de `sdlc_phase` qu'à la complétion d'une tâche marquée `[TRANSITION:→<phase>]` dans son titre, ou par commande explicite. La gate de transition vérifie le verdict de criticality avant d'autoriser le changement.

**Gate de transition par criticality :**

| Transition | T/L | M | H | C |
|-----------|-----|---|---|---|
| analyse → specification | allow | allow + formal_dor | block si formal_dor absent | block si autorité absente |
| specification → design | allow | allow + spec acceptée | block si ADR absent | block si ADR non signed |
| design → implementation | allow | allow + critic review | block si critic review absent | block si human_approval absent |
| implementation ↔ test | allow | warn si tests absents | block si e2e absent | block si security_audit absent |
| test → maintenance | allow | allow | block si DONE_VERIFIED absent | block si DONE_VERIFIED absent |

---

## HIGH items

### [HIGH][BLOCKS:high] H-001 — Interaction boulder ↔ ledger sha256-chain

Le ledger (`packages/behavior-core/src/ledger.ts`) est la trace d'audit immuable du cycle de vie du boulder. Chaque événement boulder est persisté via `appendLedgerEntry(projectRoot, runId, payload)`.

**runId pour un boulder :** `"boulder-<workId>"` — un fichier JSONL par boulder dans
`.hima/state/ledger/`. Exemple : `.hima/state/ledger/boulder-refactor-auth-a1b2c3d4.jsonl`.

**Format d'une entrée ledger (contrat `ledger.ts` — champs posés par `appendLedgerEntry`) :**

```jsonc
{
  "id": "<runId>-<sequence+1>",        // ex: "boulder-refactor-auth-a1b2c3d4-1"
  "ts": "<ISO8601>",                    // posé par appendLedgerEntry
  "runId": "boulder-refactor-auth-a1b2c3d4",
  "sequence": 0,                        // incrémental, 0-based
  "prevHash": "0000...0000",            // GENESIS_HASH pour la première entrée
  "eventHash": "<sha256(stableJson(payload))>",
  "payload": {
    "type": "boulder_created",
    "workId": "refactor-auth-a1b2c3d4",
    "planPath": ".hima/plans/refactor-auth-a1b2c3d4.md",
    "planName": "refactor-auth",
    "riskClass": "M",
    "sdlcPhase": "analyse"
  }
}
```

`stableJson(payload)` trie les clés de façon déterministe (ordre alphabétique, récursif)
avant de calculer le sha256 — garantit que deux payloads identiques produisent toujours
le même hash. Défini dans `ledger.ts`.

**Événements boulder loggés :**

| Événement (`payload.type`) | Déclencheur | Payload requis |
|--------------------------|------------|----------------|
| `boulder_created` | `createBoulder` | `workId, planPath, planName, riskClass, sdlcPhase` |
| `session_attached` | `appendSessionId` | `workId, sessionId, origin` |
| `task_started` | `startTaskTimer` | `workId, taskKey, taskTitle` |
| `task_completed` | `endTaskTimer` + checkbox cochée | `workId, taskKey, elapsedMs` |
| `task_cancelled` | abandon d'une tâche en cours | `workId, taskKey, reason` |
| `phase_transition` | transition SDLC | `workId, fromPhase, toPhase, gateVerdict` |
| `boulder_completed` | `completeBoulder` | `workId, totalElapsedMs, finalRiskClass` |
| `boulder_abandoned` | `abandonBoulder` | `workId, reason` |
| `chain_verified` | fin de boulder | `workId, chainLength, valid: true/false` |

**Intégrité de la chain :** `verifyLedgerChain(entries)` vérifie que :
1. `entry.prevHash === previousEntry.eventHash` pour chaque entrée consécutive.
2. `entry.eventHash === sha256Hex(stableJson(entry.payload))` pour chaque entrée.
3. La première entrée a `prevHash === GENESIS_HASH` (`"0".repeat(64)`).

Si la chain est invalide, le boulder passe en `status: "paused"` et une alerte est émise au fondateur avant tout autre action.

---

### [HIGH][BLOCKS:high] H-002 — Fonctions de storage à implémenter (réimplémentation — pas de copie OMO)

```typescript
// Création d'un boulder
function createBoulder(
  projectRoot: string,
  planPath: string,
  planName: string,
  riskClass: RiskClass,
  sdlcPhase?: SdlcPhase,
): Promise<BoulderWork>;

// Rattachement de session au boulder actif
function appendSessionId(
  projectRoot: string,
  sessionId: string,
  origin: "direct" | "appended",
): Promise<void>;

// Lecture de la prochaine tâche non cochée (niveau 0 uniquement)
function readCurrentTopLevelTask(
  planPath: string,
): Promise<{ key: string; title: string; section: string } | null>;

// Progression du plan
function getPlanProgress(
  planPath: string,
): Promise<{ total: number; completed: number; isComplete: boolean }>;

// Options de reprise (boulders actifs/pausés)
function getWorkResumeOptions(
  projectRoot: string,
): Promise<Array<{ work: BoulderWork; progress: { total: number; completed: number } }>>;

// Timer de tâche
function startTaskTimer(projectRoot: string, workId: string, taskKey: string): Promise<void>;
function endTaskTimer(projectRoot: string, workId: string, taskKey: string): Promise<void>;

// Clôture
function completeBoulder(projectRoot: string, workId: string): Promise<void>;
function abandonBoulder(projectRoot: string, workId: string, reason: string): Promise<void>;

// Transition de phase SDLC
function transitionSdlcPhase(
  projectRoot: string,
  workId: string,
  toPhase: SdlcPhase,
  gateVerdict: GateDecision,
): Promise<void>;
```

Toutes les fonctions de write sont **défensives** : lire l'état courant → appliquer la modification → écrire atomiquement (write to temp file + rename). Si la lecture échoue, ne pas écrire.

---

### [HIGH][BLOCKS:low] H-003 — Règle de coexistence boulder / worktree git

Si `worktree_path` est défini dans un `BoulderWork` :
- `resolveBoulderPlanPath(projectRoot, work)` retourne `path.join(worktree_path, work.plan_path)` si le fichier existe à cet emplacement, sinon fallback vers `path.join(projectRoot, work.plan_path)`.
- Le ledger reste dans `projectRoot/.hima/state/ledger/` (pas dans le worktree) — un seul ledger par projet même avec worktrees.
- `boulder.json` reste dans `projectRoot/.hima/` — partagé entre worktrees.

---

### [HIGH][BLOCKS:low] H-004 — Génération du workId

```typescript
function generateWorkId(planName: string): string {
  const slug = planName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const hex = randomBytes(4).toString("hex");  // 8 hex chars
  return `${slug}-${hex}`;
}
```

Le workId est l'identifiant stable du boulder à travers toutes les sessions. Il est généré une seule fois à la création et ne change jamais.

---

## MEDIUM items (convergence detail)

### [MEDIUM][BLOCKS:none] M-001 — Lecture défensive de boulder.json

`readBoulderState(projectRoot)` :
1. Tente de lire `.hima/boulder.json`.
2. Si ENOENT → retourne `{ schema_version: 1, active_work_id: null, works: {} }` (état vide valide).
3. Si parse JSON échoue → retourne l'état vide + log d'erreur (ne pas crasher).
4. Si `active_work_id` pointe sur un workId absent de `works` → corriger : `active_work_id = null`, log d'alerte.

### [MEDIUM][BLOCKS:none] M-002 — getPlanProgress : comptage des checkboxes

```typescript
// Compte toutes les checkboxes de niveau 0 dans le plan
// (TODOs + Final Verification Wave ensemble)
async function getPlanProgress(planPath: string): Promise<{
  total: number;
  completed: number;
  isComplete: boolean;
}> {
  const lines = (await readFile(planPath, "utf8")).split("\n");
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    if (/^[-*]\s*\[\s*\]\s*/.test(line)) { total++; }
    else if (/^[-*]\s*\[x\]\s*/i.test(line)) { total++; completed++; }
  }
  return { total, completed, isComplete: total > 0 && completed === total };
}
```

### [MEDIUM][BLOCKS:none] M-003 — Interaction avec le run-set (RunSetFile)

Le run-set (`packages/behavior-core/src/run-set-types.ts`) porte l'état d'un run de gates. Le boulder n'est pas directement dans le run-set, mais deux champs sont liés :

- `RunSetFile.route.subPhase` : peut porter la `sdlc_phase` courante du boulder actif — permet aux behaviors (ex: BEH-012 Chesterton Fence) de contextualiser leur verdict à la phase SDLC.
- `RunSetFile.evidence` : les artefacts produits pendant un boulder (plans acceptés, ADR, résultats de tests) sont enregistrés comme `EvidenceItem` dans le run-set, puis vérifiés par BEH-023 à la gate `stop`.

### [MEDIUM][BLOCKS:none] M-004 — Commandes déclenchant le cycle boulder

| Commande | Action sur le boulder |
|----------|----------------------|
| `/plan <description>` | Active le profil planner, crée un nouveau boulder |
| `/ulw` ou `/ultrawork` | Active le profil executor, démarre la boucle sur le boulder actif |
| `/status` | Lit `boulder.json` + `getPlanProgress`, affiche l'état courant |
| `/pause` | Met `status: "paused"` sur le boulder actif |
| `/resume` | Affiche `getWorkResumeOptions`, reprend le boulder sélectionné |

Les commandes sont définies dans SPEC-005 (surface commandes + magic-words). Cette table est un contrat d'interface entre SPEC-005 et SPEC-006.

---

## LOW items (convergence tail)

### [LOW][BLOCKS:none] L-001 — Timers : précision et accumulation

`elapsed_ms` est calculé comme `Date.now() - startedAt` à chaque `endTaskTimer`. La valeur est accumulée (sommée) sur toutes les sessions d'un même `task_key`. La granularité milliseconde est suffisante pour le monitoring de progression ; aucune précision sub-milliseconde n'est requise.

### [LOW][BLOCKS:none] L-002 — Nommage des fichiers de plan

Convention de nommage : `.hima/plans/<slug>-<8hex>.md` où `slug` est dérivé du `planName` (voir H-004). Les fichiers de plan ne sont pas auto-ignorés par `.gitignore` — ils sont intentionnellement locaux mais peuvent être versionnés si le fondateur le souhaite (décision différée).

### [LOW][BLOCKS:none] L-003 — État vide au démarrage de hima

Si `.hima/boulder.json` est absent (première session sur un projet), hima démarre sans boulder actif. Le fondateur démarre un boulder explicitement avec `/plan`. Il n'y a pas de boulder "implicite" créé automatiquement.

### [LOW][BLOCKS:none] L-004 — Compatibilité avec l'état .hima/ existant

Le répertoire `.hima/state/ledger/` existe déjà avec des fichiers `run_YYYYMMDDHHMMSS.jsonl` (format ancien, pré-restructure). Ces fichiers ne sont pas migrés automatiquement — ils sont ignorés par le nouveau code. Le schema v1 de `boulder.json` est spécifique à la restructure v2.

---

## Falsifies-If

```
kill-condition   : Si verifyLedgerChain() retourne false sur un fichier .jsonl produit
                   par le cycle normal boulder (création → rattachement → complétion),
                   ce document est falsifié — le hash-chain stableJson a un bug de
                   sérialisation ou des événements sont écrits hors-contrat.

kill-condition   : Si le boulder est rarement repris en multi-session (< 20% des
                   boulders actifs repris après interruption), ce document est falsifié
                   dans sa prémisse — la persistance JSON est sur-engineerée et une
                   simplification (état en mémoire v0.1) doit être proposée.

kill-condition   : Si les plans à checkboxes sont contournés (le planner écrit des
                   plans sans checkboxes ou l'executor ne coche pas après exécution),
                   ce document est falsifié — l'enforcement du format CR-003 doit
                   passer par une gate pre_tool sur l'écriture dans .hima/plans/.

kill-condition   : Si le mapping SDLC est ignoré en pratique (le fondateur ne transite
                   jamais explicitement entre phases sur 5 sessions consécutives),
                   ce document est falsifié — sdlc_phase et gates de transition CR-005
                   sont du théâtre ; réduire à un champ informatif non-gaté.

checkpoint-date  : Wave 2 (avant toute implémentation du package boulder-state).

evidence-anchor  : packages/behavior-core/src/ledger.ts (verifyLedgerChain, GENESIS_HASH,
                   appendLedgerEntry),
                   .hima/state/ledger/*.jsonl (fichiers observés en production),
                   test suite boulder-state (à créer en Wave 2).

on-fail          : Ouvrir un ticket Wave 2 bloquant, mettre SPEC-006 en status:blocked,
                   ne pas merger le PR qui falsifie. Pour le kill-condition ledger :
                   investigation prioritaire sur stableJson avant Wave 3.
```

---

## Contradictions détectées

### CONTRADICTION-001 — boulder.json : emplacement à la racine .hima/ vs sous .hima/state/

**Référence A :** lane-omo.md §2 place `boulder.json` dans `.omo/` (racine du dossier état OMO), pas dans un sous-dossier.  
**Référence B :** Le layout `.hima/` existant place tout l'état runtime dans `.hima/state/` (ledger, events.jsonl, conception/).  
**Décision prise dans cette spec :** `boulder.json` est placé à la racine `.hima/boulder.json` (accessible rapidement, miroir du pattern OMO). Les plans sont dans `.hima/plans/`. L'état technique (ledger, events) reste dans `.hima/state/`. Ce choix n'est pas une décision fondateur actée — si le fondateur préfère tout dans `.hima/state/`, le chemin est `boulder.json → .hima/state/boulder.json`.  
**Non résolu définitivement** — à confirmer avant Wave 2.

### CONTRADICTION-002 — sdlc_phase dans le boulder vs dans le run-set

**Référence A :** PROPOSITION.md §12 définit le SDLC comme le cycle que hima orchestre, suggérant que la phase courante est une propriété du contexte d'exécution (run-set).  
**Référence B :** Cette spec place `sdlc_phase` dans `BoulderWork` (persisté dans `boulder.json`) et dans `RunSetFile.route.subPhase` (état de run volatile).  
**Ambiguïté :** les deux sont nécessaires mais peuvent diverger (un run peut être en phase `test` pendant que le boulder est encore en `implementation`). Le point de vérité unique n'est pas tranché.  
**Non résolu** — à trancher lors de l'implémentation de Wave 2.

---

## Questions ouvertes

### QO-001 — Gate de transition SDLC : quel behavior la porte ?

Aucun `BEH-xxx` existant ne gère les transitions SDLC. La gate de transition (CR-005) nécessite un nouveau behavior `BEH-040` (sdlc-phase-transition-guard) ou une logique dans la gate `pre_tool` générique. À créer en Wave 2.

### QO-002 — Déclencheur automatique vs explicite de la boucle

Lane-omo.md §2 décrit une boucle déclenchée par `/start-work` (commande explicite). PROPOSITION.md §9 décrit une exécution « automatique » après `/ulw`. La question est : est-ce que `/ulw` démarre toujours une nouvelle boucle depuis la première tâche non cochée, ou est-ce que le boulder reprend là où il s'était arrêté (reprise automatique) ? Cette spec suppose la reprise automatique (readCurrentTopLevelTask retourne la première non cochée). À confirmer.

### QO-003 — Validation du format de plan au write

Cette spec impose un format strict pour les plans (CR-003). Aucun mécanisme de validation n'est spécifié pour rejeter un plan malformé au moment où le planner l'écrit. Une gate `pre_tool` sur les Write dans `.hima/plans/` pourrait valider le frontmatter et la présence des sections obligatoires. À décider avant Wave 2.
