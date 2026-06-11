# 08 — `.planning/` State Schema

> **Statut** : conception v1 — pré-implémentation.
> **Auteur** : phase Conception Pipeline Fractale v4.
> **Date** : 2026-05-03.
> **Source** : D15 (YAML state), §3.5 (.planning/ architecture), D8 (économie tokens), RMS v1 (8 sets logiques).
> **Contrat PFV4** : le stockage physique est strictement limité à `.planning/state.yaml`,
> `.planning/current-risk.yaml` et `.planning/run-set.json`.

---

## 1. Inventaire des fichiers canoniques

`.planning/` contient exactement trois fichiers d'état canoniques.

| Fichier | Format | Rôle | Fréquence de mise à jour | Auteur |
|---|---|---|---|---|
| `.planning/state.yaml` | YAML | État durable du workspace : phase, mode, Project Set, Policy Set | À l'initialisation, aux transitions de phase, aux changements explicites de politique | Harness + dev |
| `.planning/current-risk.yaml` | YAML | Classe de risque courante T/L/M/H/C, preuves de classification, promotions | À la classification initiale et à chaque reclassification | Harness ou dev |
| `.planning/run-set.json` | JSON | État vivant du run : Intent Set, Capability Set, Runtime Binding Set, Route Set, Run Set, Evidence Set, journal logique | À chaque gate et événement significatif | Harness |

Les RMS Sets restent canoniques conceptuellement. Ils ne sont pas des fichiers : ce sont des
sections logiques projetées dans ces trois fichiers.

---

## 2. Types canoniques

```typescript
export type RiskClass = "T" | "L" | "M" | "H" | "C";

export type OperatingMode = "bypass" | "auto" | "pairing";

export type GateType =
  | "session_start"
  | "user_prompt"
  | "pre_tool"
  | "post_tool"
  | "stop"
  | "subagent_start"
  | "subagent_stop";

export type SubPhase =
  | "Observer"
  | "Define"
  | "Design"
  | "Execute"
  | "Verify"
  | "Capitalize"
  | "Transmit";

export type MacroCycle =
  | "discovery"
  | "cadrage"
  | "conception"
  | "build"
  | "validation"
  | "release"
  | "run"
  | "learning";
```

Règles de mode :

| Mode | Sens | Contraintes |
|---|---|---|
| `bypass` | Exécution légère sans supervision détaillée | Autorisé seulement pour T/L et jamais pour H/C |
| `auto` | Exécution autonome avec garde-fous | Checkpoints actifs, visibilité complète, validation humaine obligatoire aux gates/politiques qui l'exigent |
| `pairing` | Collaboration explicite avec l'humain | Mode le plus supervisé, toujours autorisé |

Il n'existe pas de variantes du mode `auto`. Toute décision automatique appartient à ce mode.

---

## 3. `.planning/state.yaml`

### Rôle

Source de vérité durable du workspace. Le harness le lit à `session_start`, `user_prompt`,
`pre_tool`, `post_tool`, `stop`, `subagent_start` et `subagent_stop` pour connaître la phase,
la sous-phase, le mode opératoire et les règles stables à appliquer.

### Schema YAML

```yaml
version: "1"
run_id: string
phase: string                         # MacroCycle
sub_phase: string | null              # SubPhase
attempt_count: integer
operating_mode:
  current: string                      # OperatingMode
  override_active: boolean
  override_reason: string | null
  override_expires_at: string | null
  history:
    - mode: string                     # OperatingMode
      activated_at: string             # ISO 8601 UTC
      activated_by: string             # "human" | "auto" | "policy"
      reason: string | null
      deactivated_at: string | null
last_transition:
  from: string | null                  # MacroCycle
  to: string                           # MacroCycle
  at: string                           # ISO 8601 UTC
  triggered_by: string                 # "human" | "auto" | GateType
  reason: string | null
transition_history:
  - from: string | null
    to: string
    at: string
    triggered_by: string
    reason: string | null
projectSet: object                     # RMS Project Set logique
policySet: object                      # RMS Policy Set logique
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
learning
```

### Valeurs d'enum — `sub_phase`

```text
Observer
Define
Design
Execute
Verify
Capitalize
Transmit
```

### Exemple

```yaml
version: "1"
run_id: "550e8400-e29b-41d4-a716-446655440000"
phase: build
sub_phase: Execute
attempt_count: 2
operating_mode:
  current: auto
  override_active: false
  override_reason: null
  override_expires_at: null
  history:
    - mode: auto
      activated_at: "2026-05-03T09:00:00Z"
      activated_by: "auto"
      reason: "Mode par défaut avec checkpoints et visibilité complète"
      deactivated_at: null
last_transition:
  from: conception
  to: build
  at: "2026-05-03T14:22:00Z"
  triggered_by: "user_prompt"
  reason: "Plan validé, ADR signé, risque L accepté"
transition_history:
  - from: discovery
    to: cadrage
    at: "2026-05-03T09:30:00Z"
    triggered_by: "user_prompt"
    reason: "Problème validé, scope accepté"
projectSet:
  schemaVersion: "1.0"
  projectId: "pipeline-fractale"
  name: "Pipeline Fractale Harness"
policySet:
  schemaVersion: "1.0"
  riskPolicies:
    L:
      riskClass: L
      requiredCycles: [build, validation]
      mandatoryGates: [pre_tool, post_tool]
      mandatoryGatesBeforeDone: [stop]
      bypassPermitted: true
```

### Contraintes

- `phase` est toujours un `MacroCycle`.
- `sub_phase`, quand présent, est toujours un `SubPhase`.
- `operating_mode.current` est `bypass`, `auto` ou `pairing`.
- `auto` garde les checkpoints, la visibilité complète et les validations humaines requises.
- `triggered_by` utilise les valeurs `human`, `auto` ou un `GateType` brut. Les gates ne portent jamais de préfixe.
- `projectSet` et `policySet` sont des objets logiques dans `state.yaml`, pas des fichiers.
- Le Runtime Binding Set logique est stocké dans `run-set.json.runtimeBindings`.

---

## 4. `.planning/current-risk.yaml`

### Rôle

Classification T/L/M/H/C du changement en cours. Elle module la profondeur des cycles, les gates
actives, les modes autorisés et le minimum d'evidence requis.

### Schema YAML

```yaml
version: "1"
run_id: string
risk_class: string                    # RiskClass
classification_method: string         # "auto" | "manual" | "promoted"
classified_at: string                 # ISO 8601 UTC
classified_by: string                 # "risk-classifier" | "human" | GateType
evidence:
  files_touched: integer | null
  touches_auth: boolean | null
  touches_payments: boolean | null
  touches_pii: boolean | null
  touches_db_schema: boolean | null
  touches_public_api: boolean | null
  touches_health_data: boolean | null
  touches_core_arch: boolean | null
  classifier_notes: string | null
promotion_history:
  - previous_class: string             # RiskClass
    new_class: string                  # RiskClass
    promoted_at: string                # ISO 8601 UTC
    promoted_by: string                # "human" | GateType
    trigger: string
```

### Exemple

```yaml
version: "1"
run_id: "550e8400-e29b-41d4-a716-446655440000"
risk_class: "L"
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

### Règle de promotion

Une promotion déclenche :

1. Pause de l'exécution courante.
2. Retour au cycle `conception` ou `discovery` selon l'ampleur.
3. Ajout dans `promotion_history`.
4. Ajout d'un événement `risk.promoted` dans `run-set.json.eventLog`.
5. Réévaluation du mode opératoire, avec `bypass` interdit pour H/C.

---

## 5. `.planning/run-set.json`

### Rôle

État vivant du run actif. C'est le seul fichier JSON canonique du contrat PFV4. Il porte à la fois
l'état opérationnel courant et les projections logiques RMS qui varient par run.

### Schema JSON

```json
{
  "version": "1",
  "runId": "string",
  "startedAt": "string",
  "lastEventAt": "string",
  "intentSet": {
    "schemaVersion": "1.0",
    "rawPrompt": "string",
    "interpretedObjective": "string",
    "inScope": [],
    "notInScope": [],
    "authorizedMode": "auto",
    "plannedCycles": []
  },
  "capabilitySet": {
    "schemaVersion": "1.0",
    "runtime": "codex",
    "activeHooks": [],
    "availableSkills": [],
    "connectedMcpServers": []
  },
  "runtimeBindings": {
    "activeTarget": "codex",
    "gates": {}
  },
  "route": {
    "phase": "build",
    "subPhase": "Execute",
    "mode": "auto",
    "riskClass": "L"
  },
  "runSet": {
    "schemaVersion": "1.0",
    "currentPhase": "build",
    "currentSubPhase": "Execute",
    "tasks": [],
    "attempts": 0,
    "activeSubagents": [],
    "writeLocks": [],
    "blockers": [],
    "candidateFinalStates": []
  },
  "evidenceSet": {
    "schemaVersion": "1.0",
    "items": [],
    "verdict": {
      "minimumMet": false,
      "missingTypes": [],
      "confidence": 0,
      "doneVerifiedAuthorized": false,
      "gapsPresent": false,
      "gapDescriptions": []
    }
  },
  "eventLog": []
}
```

### Exemple complet valide

```json
{
  "version": "1",
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "startedAt": "2026-05-03T09:00:00Z",
  "lastEventAt": "2026-05-03T14:45:00Z",
  "intentSet": {
    "schemaVersion": "1.0",
    "rawPrompt": "Implémenter endpoint POST /api/feature",
    "interpretedObjective": "Ajouter un endpoint API isolé derrière feature flag.",
    "inScope": ["Endpoint POST /api/feature", "Tests unitaires"],
    "notInScope": ["Modification du schéma DB"],
    "authorizedMode": "auto",
    "plannedCycles": ["build", "validation"]
  },
  "capabilitySet": {
    "schemaVersion": "1.0",
    "runtime": "codex",
    "activeHooks": [
      { "gateType": "pre_tool", "canBlock": true, "wired": true },
      { "gateType": "post_tool", "canBlock": false, "wired": true },
      { "gateType": "stop", "canBlock": true, "wired": true }
    ],
    "availableSkills": ["code-review", "ultraqa"],
    "connectedMcpServers": []
  },
  "runtimeBindings": {
    "activeTarget": "codex",
    "gates": {
      "pre_tool": {
        "status": "native",
        "adapterEvent": "pre_tool",
        "canBlock": true
      }
    }
  },
  "route": {
    "phase": "build",
    "subPhase": "Execute",
    "mode": "auto",
    "riskClass": "L"
  },
  "runSet": {
    "schemaVersion": "1.0",
    "currentPhase": "build",
    "currentSubPhase": "Execute",
    "tasks": [
      {
        "id": "T-003",
        "description": "Implémenter endpoint POST /api/feature",
        "state": "in-progress",
        "assignedTo": "agent",
        "updatedAt": "2026-05-03T14:22:00Z",
        "attempts": 1
      }
    ],
    "attempts": 1,
    "activeSubagents": [],
    "writeLocks": [
      {
        "path": "src/api/feature.ts",
        "lockedBy": "agent",
        "lockedAt": "2026-05-03T14:22:00Z"
      }
    ],
    "blockers": [],
    "candidateFinalStates": []
  },
  "evidenceSet": {
    "schemaVersion": "1.0",
    "items": [
      {
        "type": "files-modified",
        "collectedAt": "2026-05-03T14:45:00Z",
        "collectedByGate": "post_tool",
        "passing": true,
        "files": ["src/api/feature.ts"],
        "diffSummary": "+47 -3 lines"
      }
    ],
    "verdict": {
      "minimumMet": false,
      "missingTypes": ["test-results"],
      "confidence": 55,
      "doneVerifiedAuthorized": false,
      "gapsPresent": false,
      "gapDescriptions": []
    }
  },
  "eventLog": [
    {
      "v": 1,
      "id": "evt_01HX",
      "at": "2026-05-03T14:45:00Z",
      "type": "tool.write",
      "source": "post_tool",
      "phase": "build",
      "subPhase": "Execute",
      "riskClass": "L"
    }
  ]
}
```

### Contraintes

- `runId` est identique dans les trois fichiers.
- `intentSet.authorizedMode` et `route.mode` utilisent `OperatingMode`.
- `capabilitySet.activeHooks[*].gateType`, `runtimeBindings.gates` et `eventLog[*].source`
  utilisent `GateType` sans préfixe; les gates requises sont dérivées, pas stockées dans `route`.
- `runSet.currentPhase` utilise `MacroCycle`.
- `runSet.currentSubPhase` utilise `SubPhase`.
- `evidenceSet.verdict.doneVerifiedAuthorized` ne peut être `true` que si les preuves requises par
  `state.yaml.policySet` et `current-risk.yaml.risk_class` sont présentes avec `passing: true`.
- `eventLog` est append-only logique : les événements ne sont pas réécrits ou supprimés.

---

## 6. Cycle de vie des fichiers

### Création — `harness init`

```text
harness init
  └── crée .planning/
        ├── state.yaml          phase=discovery, sub_phase=Observer, operating_mode.current=auto
        ├── current-risk.yaml   risk_class=null jusqu'à classification
        └── run-set.json        projections RMS vides, eventLog=[]
```

### Mise à jour — pendant l'exécution

Ordre de mise à jour lors d'un événement :

1. Ajouter l'événement dans `run-set.json.eventLog`.
2. Réécrire `run-set.json.runSet` si les tâches, locks, blockers ou subagents changent.
3. Réécrire `state.yaml` si phase, sous-phase, mode, policy ou binding changent.
4. Réécrire `current-risk.yaml` si la classe de risque change.

En cas de crash, `run-set.json.eventLog` est la source de reconstruction du run actif.

### Clôture — gate `stop`

```text
gate stop
  └── valide evidenceSet
  └── écrit run-set.json.runSet.candidateFinalStates
  └── ajoute eventLog type=final_state.set
  └── laisse les trois fichiers canoniques comme snapshot du dernier run actif
```

---

## 7. Économie de tokens — D8

L'agent écrit uniquement ce qui est nécessaire à la prochaine décision.

### Toujours écrit

- `state.yaml.phase`, `state.yaml.sub_phase`, `state.yaml.operating_mode.current`
- `current-risk.yaml.risk_class`
- `run-set.json.runSet` pour l'état vivant
- `run-set.json.evidenceSet` pour les preuves de complétion
- `run-set.json.eventLog` pour les événements indispensables

### Profondeur par classe de risque

| Champ | T | L | M | H | C |
|---|---|---|---|---|---|
| `state.yaml.transition_history` | 3 | 3 | 5 | 10 | 10 |
| `current-risk.yaml.evidence.*` | minimal | minimal | complet | complet | complet |
| `current-risk.yaml.evidence.classifier_notes` | non | non | conseillé | oui | oui |
| `run-set.json.runSet.writeLocks` | non | non | oui | oui | oui |
| `run-set.json.evidenceSet.items` | minimal | tests + fichiers | static + tests | build + review | audit complet |
| `run-set.json.eventLog` | compact | compact | normal | détaillé | détaillé |

### Anti-patterns

- Créer un fichier physique par RMS Set.
- Créer un dossier de registre ou de runs pour contourner les trois fichiers canoniques.
- Créer un alias ou une variante au lieu d'utiliser directement `auto`.
- Préfixer les noms de gates.
- Employer une classe de risque héritée au lieu de T/L/M/H/C.

---

## 8. Relation aux 8 Sets RMS logiques

| Set RMS logique | Projection canonique |
|---|---|
| Project Set | `.planning/state.yaml.projectSet` |
| Intent Set | `.planning/run-set.json.intentSet` |
| Runtime Capability Set | `.planning/run-set.json.capabilitySet` |
| Runtime Binding Set | `.planning/run-set.json.runtimeBindings` |
| Policy Set | `.planning/state.yaml.policySet` |
| Route Set | `.planning/run-set.json.route` |
| Run Set | `.planning/run-set.json.runSet` |
| Evidence Set | `.planning/run-set.json.evidenceSet` |

Cette table décrit les projections logiques, pas des chemins de fichiers supplémentaires.

---

*Document de conception — à versionner dans `docs/conception/`. Référence pour l'implémentation du package `core/planning/`.*
