# SPEC-005 — Boulder State (Persistance Plan Multi-Session)

status: draft
date: 2026-06-11
version: 0.1
source: PROPOSITION.md §5, §12 ; lane-omo.md §2 ; ultragoal/brief.md Wave2-MélangeOMO
claim-bearing: true

---

## Contexte et décisions fondateur actées

Le fondateur a confirmé (R3-2, §12 PROPOSITION.md) :

- La boucle plan/boulder est **conservée** — c'est la persistance de plan multi-session, cœur du « travail automatique ».
- Format : `.hima/boulder.json` (adapté depuis OMO `boulder-state`, réimplémenté — pas copié).
- Plans = fichiers markdown à checkboxes numérotées sous `.hima/plans/`.
- Contrat de reprise : à chaque `session_start`, si un boulder actif existe, son état est injecté et l'exécution reprend.
- Le ledger hash-chain de l'ancien hima est conservé simplifié (sha256 chain, sans ed25519 par-entrée).
- La state-machine 8 macro-cycles est **différée** (hors v0.1, l'idée est conservée).

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] `.hima/boulder.json` est le seul fichier d'état de référence pour la persistance multi-session. Toute lecture ou écriture d'état de plan passe par ce fichier. Pas d'état en mémoire uniquement.

- [CRITICAL][BLOCKS:critical] À chaque démarrage de session (`session_start`), si `boulder.json` existe et contient un `active_work_id` avec `status: active`, l'état du boulder est injecté dans le contexte du main agent ET l'exécution reprend automatiquement sur la première tâche non cochée.

- [CRITICAL][BLOCKS:critical] Le format du plan markdown est contraint : section `## TODOs` obligatoire contenant des checkboxes numérotées `- [ ] N. Titre` (niveau 0, indentation zéro). Section optionnelle `## Final Verification Wave` avec checkboxes `- [ ] F1. Titre`. Aucun autre format de tâche n'est parsé par `readCurrentTopLevelTask()`.

- [CRITICAL][BLOCKS:high] Toute écriture dans `boulder.json` est **atomique** : écriture dans un fichier temporaire `.hima/boulder.json.tmp`, puis rename. Si le rename échoue, rollback (le fichier précédent est inchangé). Aucune écriture directe.

- [CRITICAL][BLOCKS:high] `appendSessionId()` est le seul point d'entrée de la reprise multi-session. Il est appelé au `session_start` et rattache la session courante au `active_work_id`. Il est idempotent : si le `session_id` est déjà présent dans `session_ids`, il n'est pas dupliqué.

---

## HIGH items

- [HIGH][BLOCKS:high] Format de `.hima/boulder.json` (schema v1 hima — simplifié depuis OMO schema v2) :

```jsonc
{
  "schema_version": 1,
  "active_work_id": "my-plan-a1b2c3d4",   // null si aucun work actif
  "works": {
    "my-plan-a1b2c3d4": {
      "work_id": "my-plan-a1b2c3d4",
      "active_plan": ".hima/plans/my-plan.md",
      "plan_name": "my-plan",
      "status": "active",                   // active | completed | paused | abandoned
      "started_at": "2026-06-11T10:00:00Z",
      "updated_at": "2026-06-11T10:30:00Z",
      "ended_at": null,
      "elapsed_ms": 0,
      "session_ids": ["ses_a", "ses_b"],    // toutes les sessions ayant travaillé ce boulder
      "task_sessions": {
        "todo:1": {
          "task_key": "todo:1",
          "status": "completed",            // pending | running | completed | cancelled
          "started_at": "2026-06-11T10:05:00Z",
          "elapsed_ms": 120000
        }
      }
    }
  }
}
```

- [HIGH][BLOCKS:high] Format du plan markdown. Le planificateur (`/plan`) produit exactement ce format :

```markdown
# Nom du plan

## TODOs

- [ ] 1. Première tâche
- [ ] 2. Deuxième tâche
- [x] 3. Tâche déjà complétée (exemple)

## Final Verification Wave

- [ ] F1. Vérifier que les tests passent
- [ ] F2. Vérifier le comportement en démo Hermes
```

  Règles de parsing :
  - `readCurrentTopLevelTask()` retourne la **première checkbox non cochée** (`- [ ]`) de la section `## TODOs` avec indentation zéro.
  - Pattern de checkbox non cochée : `/^[-*]\s*\[\s*\]\s*(.+)$/` (zéro espaces d'indentation).
  - Les checkboxes cochées (`- [x]`) sont ignorées.
  - Les sous-tâches (indentées) ne sont pas parsées comme top-level tasks.
  - `getPlanProgress()` compte `[x]` vs `[ ]` dans `## TODOs` uniquement (pas `Final Verification Wave`) → `{ total, completed, remaining, isComplete }`.

- [HIGH][BLOCKS:high] Contrat de reprise à `session_start` :

  1. Lire `boulder.json`.
  2. Si `active_work_id` est null ou absent → aucune reprise, attendre commande `/plan`.
  3. Si `active_work_id` présent et `status: active` :
     a. Appeler `appendSessionId(dir, sessionId, "appended")`.
     b. Lire le plan `.md` associé.
     c. Appeler `readCurrentTopLevelTask(planPath)` → première tâche non cochée.
     d. Injecter dans le contexte du main agent : état du boulder (work_id, plan_name, progression N/M, prochaine tâche) sous la forme `[Boulder Context: <work_id>]\nPlan: <plan_name>\nProgression: N/M\nProchaine tâche: <label>`.
     e. Si `getPlanProgress().isComplete` → ne pas reprendre l'exécution, signaler DONE au fondateur.
  4. Si `status: completed | paused | abandoned` → lister les works disponibles (`getWorkResumeOptions()`), proposer reprise ou nouveau plan.

- [HIGH][BLOCKS:high] Interaction avec la criticality : un boulder créé pour une tâche M+ **conserve les étapes obligatoires** entre sessions. Le champ `task_sessions` documente quelles tâches ont été exécutées. Si une tâche obligatoire (criticality M+) est marquée `cancelled` ou absente, la reprise signale l'anomalie avant de continuer.

- [HIGH][BLOCKS:low] Interaction avec le ledger : chaque événement de reprise de boulder est loggué dans le ledger hash-chain. Format de l'entrée ledger :

```jsonc
{
  "type": "boulder_resume",
  "work_id": "my-plan-a1b2c3d4",
  "session_id": "ses_b",
  "plan_progress": { "total": 5, "completed": 2, "remaining": 3 },
  "timestamp": "2026-06-11T10:30:00Z",
  "prev_hash": "<sha256 de l'entrée précédente>",
  "hash": "<sha256 de cette entrée>"
}
```

  De même, chaque complétion de tâche, chaque checkpoint `/qa`, et chaque changement de `status` dans `boulder.json` produit une entrée ledger.

- [HIGH][BLOCKS:low] Structure des fichiers boulder dans `.hima/` :

```
.hima/
  boulder.json              # état de persistance (local-only, gitignore)
  plans/
    <nom-du-plan>.md        # plans markdown produits par /plan
  rules/                    # VERSIONNÉ (gitignore exception : !/rules/)
  .gitignore                # contenu : ["*", "!/rules/", "!/rules/**"]
```

  Le `.gitignore` auto-généré lors de la première écriture dans `.hima/` exclut tout l'état runtime mais verse les rules.

---

## MEDIUM items (convergence)

- [MEDIUM][BLOCKS:low] `generateWorkId()` produit un identifiant unique sous la forme `<plan_name>-<8 hex chars>` (ex: `my-plan-a1b2c3d4`). Collision tolérée : si un `work_id` identique existe déjà dans `works`, générer un nouveau.

- [MEDIUM][BLOCKS:low] `getWorkResumeOptions()` retourne les works non terminés (`status: active | paused`) avec leur progression. Format : `{ work_id, plan_name, progress: { total, completed }, last_updated }[]`, trié par `updated_at` décroissant.

- [MEDIUM][BLOCKS:low] Timers par tâche : `startTaskTimer(dir, taskKey)` écrit `started_at` dans `task_sessions[taskKey]` ; `endTaskTimer(dir, taskKey)` calcule et écrit `elapsed_ms`. Les timers sont utiles pour l'observabilité mais pas bloquants.

- [MEDIUM][BLOCKS:none] Worktrees : si `worktree_path` est défini dans le work, `resolveBoulderPlanPath()` cherche le plan en priorité dans le chemin worktree.

- [MEDIUM][BLOCKS:none] Le boulder state package (`packages/boulder-state/`) n'a aucune dépendance harness — zéro import d'adapter Hermes ou Claude. Seules dépendances : `node:fs`, `node:path`, `node:crypto`. Testable sans runtime.

---

## LOW items (convergence tail)

- [LOW][BLOCKS:none] Les works avec `status: abandoned` sont conservés dans `boulder.json` pour audit. Une commande `/status --all` (v0.2) pourra les lister.

- [LOW][BLOCKS:none] `isComplete` sur un boulder déclenche automatiquement la suggestion d'exécuter `/qa` si la `Final Verification Wave` n'est pas encore complétée.

- [LOW][BLOCKS:none] Les plans peuvent être nommés via `/plan <nom>` ou auto-nommés depuis les premiers mots du contexte de la session.

---

## Contradictions détectées

1. **Schema OMO v2 vs schema hima v1** : OMO boulder-state (lane-omo.md §2) inclut des champs `session_origins`, `worktree_path`, et un miroir top-level (rétrocompatibilité v1). La présente spec simplifie en supprimant le miroir top-level et `session_origins`. Si le code rapatrié depuis l'ancien hima utilise des champs OMO directement, une migration de schema sera nécessaire. À vérifier au moment du rapatriement.

2. **Interaction criticality-boulder non spécifiée dans PROPOSITION.md** : PROPOSITION.md §5 décrit le boulder mais ne documente pas le comportement pour les tâches M+ entre sessions. La présente spec ajoute ce contrat (section HIGH : étapes obligatoires conservées). Si la définition de « tâche obligatoire M+ » change dans SPEC-001 ou la spec globale, cette spec doit être mise à jour.

---

## Questions ouvertes pour le fondateur

1. Faut-il un champ `criticality` par tâche dans `task_sessions` pour tracer les étapes obligatoires M+ ? (proposition : oui, ajout de `criticality?: 'T'|'L'|'M'|'H'|'C'` dans `TaskSessionState`)
2. Un boulder `paused` vs `abandoned` — quelle est la distinction opérationnelle ? La présente spec ne les différencie pas comportement. À préciser.
3. La reprise automatique à `session_start` est-elle toujours désirée, ou faut-il une option de confirmation avant de reprendre ?
