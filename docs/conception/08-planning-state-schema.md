# 08 — `.planning/state/` Schema

> **Statut** : conception v1 — pré-implémentation.
> **Auteur** : phase Conception Pipeline Fractale v4.
> **Date** : 2026-05-03.
> **Source** : D15 (YAML state / JSONL logs), §3.5 (.planning/ architecture), D8 (économie tokens), RMS v1 (8 sets canoniques).

---

## 1. Inventaire des fichiers

`.planning/state/` contient exactement cinq fichiers YAML. Un sixième fichier (`run.yaml`) est mutualisé avec le Run Set RMS actif.

| Fichier | Rôle | Fréquence de mise à jour | Auteur |
|---|---|---|---|
| `state.yaml` | Phase courante, sous-phase, historique de transitions | À chaque transition de phase | Harness (state machine) |
| `mode.yaml` | Mode opératoire actif (pairing / auto-décision / bypass) | Quand le mode change | Harness + dev |
| `current-risk.yaml` | Classe de risque du changement courant (T/F/M/É/C) | À la classification initiale et à chaque reclassification | Harness (auto) ou dev (manuel) |
| `run.yaml` | État vivant de l'exécution — Run Set RMS | Fréquemment pendant l'exécution | Harness (chaque gate) |
| `final-state.yaml` | État de clôture du run (DONE_VERIFIED, BLOCKED, etc.) | Une seule fois, en fin de run | Harness (gate stop) |

**Principe d'immuabilité** : les fichiers YAML dans `state/` sont des vues régénérées ou mises à jour en place. Les logs `.planning/logs/*.jsonl` sont les sources d'autorité append-only. `state.yaml` peut être intégralement régénéré depuis `logs/state-transitions.jsonl`.

---

## 2. `state.yaml` — Machine d'état du cycle

### Rôle

Source de vérité sur la position courante dans la pipeline fractale v4. Consulté par le harness à chaque gate pour décider quelles actions sont autorisées.

### Schema YAML

```yaml
# state.yaml
version: "1"                          # version du schema (SemVer mineur)
run_id: string                        # UUID v4 généré à harness init
phase: string                         # phase courante — enum voir ci-dessous
sub_phase: string | null              # sous-phase (étape du sous-cycle universel)
attempt_count: integer                # nombre de tentatives sur la phase courante
last_transition:
  from: string                        # phase précédente
  to: string                          # phase courante
  at: string                          # ISO 8601 UTC
  triggered_by: string                # "human" | "auto" | "gate:<gate-name>"
  reason: string | null               # motif libre, facultatif sauf si promotion de classe
transition_history:                   # dernières N transitions (N = 10 par défaut)
  - from: string
    to: string
    at: string
    triggered_by: string
    reason: string | null
```

### Valeurs d'enum — `phase`

```text
discovery
cadrage
conception
build
validation
release
run
apprentissage
```

### Valeurs d'enum — `sub_phase`

```text
observer
definir
concevoir
executer
verifier
capitaliser
transmettre
```

### Exemple complet

```yaml
version: "1"
run_id: "550e8400-e29b-41d4-a716-446655440000"
phase: build
sub_phase: executer
attempt_count: 2
last_transition:
  from: conception
  to: build
  at: "2026-05-03T14:22:00Z"
  triggered_by: "human"
  reason: "Plan validé, ADR signé, threat model T/F accepté"
transition_history:
  - from: cadrage
    to: conception
    at: "2026-05-03T11:05:00Z"
    triggered_by: "auto"
    reason: null
  - from: discovery
    to: cadrage
    at: "2026-05-03T09:30:00Z"
    triggered_by: "human"
    reason: "Problème validé, scope accepté"
```

### Champs obligatoires vs facultatifs par classe de risque

| Champ | T/F | M | É/C |
|---|---|---|---|
| `version`, `run_id`, `phase` | obligatoire | obligatoire | obligatoire |
| `sub_phase` | facultatif | obligatoire | obligatoire |
| `attempt_count` | facultatif | obligatoire | obligatoire |
| `last_transition.reason` | facultatif | conseillé | **obligatoire** |
| `transition_history` (N ≥ 5) | N = 3 | N = 5 | N = 10 |

---

## 3. `mode.yaml` — Mode opératoire actif

### Rôle

Contrôle la frontière de supervision humaine dans le cycle courant. Le harness lit ce fichier à `gate.user_prompt` et `gate.pre_tool` pour moduler les autorisations.

### Schema YAML

```yaml
# mode.yaml
version: "1"
current: string                       # "pairing" | "auto-decision" | "bypass"
override_active: boolean              # true si mode forcé manuellement
override_reason: string | null        # justification de l'override (obligatoire si override_active)
override_expires_at: string | null    # ISO 8601 UTC — null si permanent jusqu'à révocation
mode_history:
  - mode: string
    activated_at: string              # ISO 8601 UTC
    activated_by: string              # "human" | "auto" | "policy"
    reason: string | null
    deactivated_at: string | null
```

### Règles d'activation

```text
bypass    => autorisé uniquement si current-risk.yaml.class ∈ {T, F}
           => interdit si class ∈ {É, C} — gate.pre_tool renvoie BLOCKED_POLICY
pairing   => aucune contrainte de classe
auto-dec  => mode par défaut — aucune contrainte, proposition obligatoire avant action
```

### Exemple

```yaml
version: "1"
current: auto-decision
override_active: false
override_reason: null
override_expires_at: null
mode_history:
  - mode: auto-decision
    activated_at: "2026-05-03T09:00:00Z"
    activated_by: "auto"
    reason: "Mode par défaut à l'initialisation"
    deactivated_at: null
```

---

## 4. `current-risk.yaml` — Classe de risque courante

### Rôle

Classification T/F/M/É/C du changement actuellement en cours. Pivot de tout le système — module la profondeur du sous-cycle, les gates actives, et les modes autorisés.

### Schema YAML

```yaml
# current-risk.yaml
version: "1"
class: string                         # "T" | "F" | "M" | "E" | "C"
classification_method: string         # "auto" | "manual" | "promoted"
classified_at: string                 # ISO 8601 UTC de la dernière classification
classified_by: string                 # "risk-classifier" | "human" | "gate:cadrage"
evidence:
  files_touched: integer | null       # nombre de fichiers dans le diff
  touches_auth: boolean | null        # touche auth/autz
  touches_payments: boolean | null    # touche paiement
  touches_pii: boolean | null         # touche données personnelles
  touches_db_schema: boolean | null   # touche migration ou schéma DB
  touches_public_api: boolean | null  # touche API publique
  touches_health_data: boolean | null # touche données de santé / biométrie
  touches_core_arch: boolean | null   # refonte architecturale
  classifier_notes: string | null     # notes libres du classificateur
promotion_history:                    # si la classe a été reclassifiée en cours de cycle
  - previous_class: string
    new_class: string
    promoted_at: string               # ISO 8601 UTC
    promoted_by: string               # "human" | "gate"
    trigger: string                   # ce qui a déclenché la promotion
```

### Règle de promotion de classe

Une promotion (F → É par exemple) déclenche :
1. Pause de la PR / branche en cours.
2. Retour en phase conception (re-Discovery selon ampleur).
3. Entrée dans `promotion_history`.
4. Émission d'un événement `risk.promoted` dans `events.jsonl`.
5. Réévaluation du mode opératoire (bypass interdit si nouvelle classe É/C).

### Exemple

```yaml
version: "1"
class: "F"
classification_method: "auto"
classified_at: "2026-05-03T09:31:00Z"
classified_by: "risk-classifier"
evidence:
  files_touched: 3
  touches_auth: false
  touches_payments: false
  touches_pii: false
  touches_db_schema: false
  touches_public_api: false
  touches_health_data: false
  touches_core_arch: false
  classifier_notes: "Nouvelle feature UI isolée derrière feature flag"
promotion_history: []
```

### Champs obligatoires par classe

| Champ | T | F | M | É | C |
|---|---|---|---|---|---|
| `class`, `classification_method`, `classified_at` | oui | oui | oui | oui | oui |
| `evidence.*` (champs booléens) | non | non | oui | **oui** | **oui** |
| `classifier_notes` | non | non | conseillé | **oui** | **oui** |
| `promotion_history` | non | non | si promu | **oui** | **oui** |

---

## 5. `run.yaml` — Run Set RMS (état vivant)

### Rôle

Correspond directement au **Run Set** de l'architecture RMS (set 7 sur 8). Mis à jour à chaque gate. Ne remplace pas `events.jsonl` — c'est une vue courante, non la source d'autorité.

### Schema YAML

```yaml
# run.yaml
version: "1"
run_id: string                        # même UUID que state.yaml
started_at: string                    # ISO 8601 UTC
last_event_at: string                 # ISO 8601 UTC — horodatage du dernier événement
current_phase: string                 # redondant avec state.yaml — for quick access
open_tasks:                           # tâches en cours
  - id: string                        # identifiant court lisible (ex: "T-001")
    description: string
    assigned_to: string               # "agent" | "human" | "subagent:<id>"
    started_at: string
    attempt: integer
completed_tasks:                      # tâches terminées dans ce run
  - id: string
    description: string
    completed_at: string
    outcome: string                   # "success" | "partial" | "skipped"
blockers:                             # blocages actifs
  - id: string
    description: string
    blocking_since: string
    resolution: string | null
active_subagents:                     # sous-agents en cours d'exécution
  - id: string
    role: string                      # ex: "reviewer", "threat-modeler"
    spawned_at: string
    status: string                    # "running" | "waiting_result"
current_locks:                        # zones de fichiers verrouillées par l'agent
  - path: string
    locked_by: string
    locked_at: string
loop_detection:
  count: integer                      # nombre de cycles répétitifs détectés
  last_detected_at: string | null
  pattern: string | null              # description du motif détecté
last_event:
  type: string                        # type d'événement (voir §7)
  at: string
  summary: string | null
```

### Exemple partiel

```yaml
version: "1"
run_id: "550e8400-e29b-41d4-a716-446655440000"
started_at: "2026-05-03T09:00:00Z"
last_event_at: "2026-05-03T14:45:00Z"
current_phase: build
open_tasks:
  - id: "T-003"
    description: "Implémenter endpoint POST /api/feature"
    assigned_to: "agent"
    started_at: "2026-05-03T14:22:00Z"
    attempt: 1
completed_tasks:
  - id: "T-001"
    description: "ADR rédigé"
    completed_at: "2026-05-03T11:05:00Z"
    outcome: "success"
  - id: "T-002"
    description: "Tests unitaires écrits (RED)"
    completed_at: "2026-05-03T14:20:00Z"
    outcome: "success"
blockers: []
active_subagents: []
current_locks:
  - path: "src/api/feature.ts"
    locked_by: "agent"
    locked_at: "2026-05-03T14:22:00Z"
loop_detection:
  count: 0
  last_detected_at: null
  pattern: null
last_event:
  type: "tool.write"
  at: "2026-05-03T14:45:00Z"
  summary: "src/api/feature.ts modifié"
```

---

## 6. `final-state.yaml` — État de clôture

### Rôle

Écrit une seule fois à la fin du run par `gate.stop`. Immuable après écriture. Sert de source pour la métrologie DORA.

### Schema YAML

```yaml
# final-state.yaml
version: "1"
run_id: string
final_state: string                   # voir enum ci-dessous
closed_at: string                     # ISO 8601 UTC
closed_by: string                     # "human" | "gate:stop" | "gate:max-attempts"
evidence_sufficient: boolean          # true si Evidence Set jugé complet
gaps_known:                           # risques résiduels acceptés
  - description: string
    accepted_by: string               # "human" | "policy"
    accepted_at: string
```

### Valeurs d'enum — `final_state`

```text
DONE_VERIFIED          # travail terminé, evidence suffisante
DONE_WITH_GAPS         # terminé mais lacunes connues acceptées
BLOCKED_NEEDS_USER     # bloqué, intervention humaine requise
BLOCKED_RUNTIME_MISSING # capacité runtime absente
BLOCKED_POLICY         # bloqué par règle de politique
MAX_ATTEMPTS_REACHED   # 3 itérations sans résolution
LOOP_DETECTED          # boucle détectée, arrêt forcé
CANCELLED              # annulé explicitement
```

---

## 7. Schemas JSONL — Logs

Tous les fichiers `.planning/logs/` sont **append-only strict**. Jamais de modification de lignes existantes. Chaque ligne est un objet JSON autonome et valide.

### 7.1 `events.jsonl` — Flux d'événements bruts

Chaque ligne :

```json
{
  "v": 1,
  "id": "evt_<ulid>",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "at": "2026-05-03T14:45:00Z",
  "type": "tool.write",
  "source": "gate.pre_tool",
  "payload": {
    "tool": "Write",
    "path": "src/api/feature.ts",
    "decision": "allow"
  },
  "phase": "build",
  "risk_class": "F"
}
```

Types d'événements canoniques :

```text
session.start          session.end
phase.transition       risk.classified    risk.promoted
tool.write             tool.read          tool.exec
gate.blocked           gate.allowed
subagent.spawned       subagent.completed
loop.detected          attempt.incremented
evidence.added         final_state.set
```

### 7.2 `state-transitions.jsonl` — Historique des transitions d'état

Sous-ensemble ciblé de `events.jsonl`. Sert à régénérer `state.yaml` intégralement.

Chaque ligne :

```json
{
  "v": 1,
  "id": "tr_<ulid>",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "at": "2026-05-03T14:22:00Z",
  "from_phase": "conception",
  "to_phase": "build",
  "from_sub_phase": "transmettre",
  "to_sub_phase": "executer",
  "triggered_by": "human",
  "reason": "Plan validé, ADR signé",
  "risk_class_at_transition": "F",
  "mode_at_transition": "auto-decision",
  "attempt_count_at_transition": 1
}
```

### 7.3 `decisions.jsonl` — Décisions explicites du harness ou de l'humain

Capturent les décisions non triviales (classifications, promotions, overrides de mode, gate blocks).

Chaque ligne :

```json
{
  "v": 1,
  "id": "dec_<ulid>",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "at": "2026-05-03T09:31:00Z",
  "type": "risk.classified",
  "decision": "class=F",
  "decided_by": "risk-classifier",
  "evidence_summary": "3 fichiers, pas d'auth, pas de PII, feature flag présent",
  "alternatives_considered": ["T", "M"],
  "reason": "Fonctionnalité isolée sans surface de risque identifiée",
  "phase": "cadrage"
}
```

Types de décisions :

```text
risk.classified        risk.promoted
mode.changed           mode.overridden
gate.blocked           gate.allowed_with_warning
transition.approved    transition.rejected
subagent.approved      evidence.accepted
```

---

## 8. Cycle de vie des fichiers

### 8.1 Création — `harness init`

```text
harness init
  └── crée .planning/state/
        ├── state.yaml          phase=discovery, sub_phase=observer, attempt=0
        ├── mode.yaml           current=auto-decision (par défaut)
        ├── current-risk.yaml   class=null (non encore classifié)
        ├── run.yaml            open_tasks=[], completed_tasks=[]
        └── final-state.yaml    NON créé — créé seulement à la clôture
      crée .planning/logs/
        ├── events.jsonl        vide
        ├── state-transitions.jsonl  vide
        └── decisions.jsonl     vide
```

### 8.2 Mise à jour — pendant l'exécution

Ordre de mise à jour lors d'une transition de phase :

1. Append dans `events.jsonl` (événement `phase.transition`)
2. Append dans `state-transitions.jsonl`
3. Réécriture de `state.yaml` (mise à jour en place)
4. Réécriture de `run.yaml` si changement de `open_tasks` / `blockers`
5. Réécriture de `current-risk.yaml` si reclassification

Règle : les logs sont toujours écrits **avant** la mise à jour des YAML. En cas de crash entre les deux, le YAML peut être régénéré depuis le log.

### 8.3 Archivage — fin de run

```text
harness close (ou gate.stop)
  └── écrit final-state.yaml
  └── copie .planning/state/ → .planning/timeline/<run-id>/state-snapshot/
  └── copie .planning/logs/  → .planning/timeline/<run-id>/logs/
  └── réinitialise state.yaml pour le prochain run (nouveau run_id)
  └── NE SUPPRIME PAS les logs originaux (append-only permanent)
```

### 8.4 Suppression — jamais

Les fichiers `*.jsonl` ne sont jamais supprimés ni tronqués. `state.yaml`, `mode.yaml`, `current-risk.yaml`, `run.yaml` sont mis à jour en place. `final-state.yaml` est immuable après écriture.

---

## 9. Régénération depuis les logs

### Fichiers régénérables

| Fichier | Source de régénération | Commande |
|---|---|---|
| `state.yaml` | `state-transitions.jsonl` | `harness rebuild state` |
| `run.yaml` | `events.jsonl` (replay) | `harness rebuild run` |
| `current-risk.yaml` | `decisions.jsonl` (type=risk.*) | `harness rebuild risk` |

### Fichiers sources primaires (non régénérables)

| Fichier | Raison |
|---|---|
| `mode.yaml` | Les overrides manuels peuvent ne pas être dans les logs automatiques |
| `events.jsonl` | Source d'autorité — ne peut pas être régénérée |
| `decisions.jsonl` | Source d'autorité — ne peut pas être régénérée |
| `state-transitions.jsonl` | Source d'autorité — sous-ensemble de `events.jsonl` |

### Algorithme de rebuild de `state.yaml`

```text
1. Lire state-transitions.jsonl dans l'ordre chronologique
2. Rejouer chaque transition
3. Garder uniquement les N dernières dans transition_history
4. La dernière transition donne phase + sub_phase + triggered_by
5. Compter attempt_count depuis les events attempt.incremented
6. Écrire state.yaml
```

---

## 10. Économie de tokens — D8

**Règle fondatrice (D8)** : l'agent écrit dans `.planning/` ce qui est nécessaire à la **prochaine décision**, pas ce qui serait théoriquement traçable.

### Ce qui est toujours écrit (non négociable)

- `state.yaml` : phase + sub_phase + run_id. Sans eux, le harness ne peut pas gater.
- `current-risk.yaml` : class. Sans lui, le mode et les gates ne peuvent pas s'appliquer.
- `events.jsonl` : chaque événement gate. Source de vérité minimale.

### Ce qui est écrit selon la classe de risque

| Champ / fichier | T | F | M | É | C |
|---|---|---|---|---|---|
| `state.yaml.sub_phase` | non | non | oui | oui | oui |
| `state.yaml.transition_history` (N) | 3 | 3 | 5 | 10 | 10 |
| `current-risk.yaml.evidence.*` | non | non | oui | oui | oui |
| `current-risk.yaml.classifier_notes` | non | non | conseillé | oui | oui |
| `run.yaml.open_tasks` description longue | courte | courte | normale | normale | détaillée |
| `run.yaml.current_locks` | non | non | oui | oui | oui |
| `decisions.jsonl` reason détaillé | non | non | conseillé | oui | oui |
| `decisions.jsonl` alternatives_considered | non | non | non | oui | oui |

### Ce qui n'est jamais écrit dans state/ (anti-patterns)

- Contenu de PRD, specs, ADR → vont dans `docs/` ou `.planning/registry/`
- Résultats de tests → vont dans Evidence Set
- Sorties de subagents → vont dans `events.jsonl` comme `subagent.completed`
- Notes de rétrospective → vont dans `.planning/timeline/<run-id>/retro.md`
- Plans d'itération détaillés → vont dans `.planning/registry/`

**Ratio cible** : un fichier YAML dans `state/` ne devrait jamais dépasser 80 lignes pour T/F/M, 150 lignes pour É/C. Au-delà, le contenu appartient probablement à `registry/` ou `docs/`.

---

## 11. Relation aux 8 Sets RMS canoniques

Le RMS (Runtime Management System) définit 8 sets canoniques. `.planning/state/` couvre directement 2 d'entre eux et référence les autres.

| Set RMS | Stocké dans | Fichier(s) |
|---|---|---|
| 1. Project Set | `docs/` + `.planning/agent/` | `docs/01-governance/`, `.planning/agent/boundaries.yaml` |
| 2. Intent Set | `.planning/registry/` | `pbi-current.yaml`, `scope.md` par run |
| 3. Runtime Capability Set | `.planning/agent/` | `runtime-capability.yaml` (généré par inspection) |
| 4. Runtime Binding Set | `.planning/agent/` | `bindings-<runtime>.yaml` |
| 5. Policy Set | `.planning/agent/` | `policies.yaml`, `gates.yaml` |
| **6. Route Set** | `.planning/state/` | `mode.yaml` + `current-risk.yaml` (décision de route) |
| **7. Run Set** | `.planning/state/` | **`run.yaml`** |
| 8. Evidence Set | `.planning/logs/` + `timeline/` | `events.jsonl`, `decisions.jsonl`, `final-state.yaml` |

### Pourquoi Route Set = mode.yaml + current-risk.yaml

Le Route Set RMS contient : mode choisi, pipeline choisi, gates activées. Dans la pipeline fractale v4, ces éléments sont déterminés par la combinaison `(mode opératoire, classe de risque)`. `mode.yaml` porte le mode, `current-risk.yaml` porte la classe. Ensemble ils définissent la route.

### Ce qui n'est pas dans `.planning/state/`

- **Project Set** : stabilité plurielle, appartient à `docs/`. Pas vocationné à changer par run.
- **Intent Set** : capturé en début de run dans `registry/`, pas dans `state/` (périmètre run, pas état machine).
- **Capability Set** : inspecté une fois par session, stocké dans `agent/`, pas mis à jour par chaque gate.
- **Binding Set** : statique par runtime, dans `agent/bindings-<runtime>.yaml`.
- **Evidence Set** : append-only, dans `logs/` + `timeline/`. Ne modifie pas l'état machine.

---

*Document de conception — à versionner dans `docs/conception/`. Référence pour l'implémentation du package `core/planning/`.*
