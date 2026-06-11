# 01 - Modele D'Etat Corrige

Statut: draft de conception

## Probleme A Corriger

Le modele precedent laissait penser que l'etat courant etait seulement:

```text
BUILD.Executer
```

ou:

```text
DISCOVERY.Observer
```

Ce modele est trop pauvre.

Il melange trois choses differentes:

1. le macro-cycle actif;
2. le travail semantique reel dans ce cycle;
3. la lens fractale commune utilisee pour raisonner.

Il ne couvre pas non plus correctement les cas ou l'agent n'est pas en train de
faire du developpement.

## Principe V2

L'etat courant doit separer trois couches:

1. `RunEnvelope` - ce que fait la session ou le run au sens large.
2. `HarnessMachineState` - l'etat de la Pipeline V4 quand elle est active.
3. `DerivedView` - les lectures derivees utiles aux agents et aux hooks.

La lens fractale, le statut evidence global et le statut de convergence ne
doivent pas etre des sources de verite independantes. Ils sont derives depuis le
substate registry, l'Evidence Set et le Convergence Set.

```text
RunState =
  RunEnvelope
  + HarnessMachineState | NOT_ACTIVE
  + DerivedView
```

## State Object Minimal - Pipeline Active

```json
{
  "version": "2",
  "run_id": "run_2026-05-03_001",
  "run_envelope": {
    "run_kind": "development",
    "pipeline_activation": "active",
    "intent_ref": "intent_2026-05-03_001",
    "route_ref": "route_2026-05-03_001"
  },
  "harness_machine": {
    "status": "ACTIVE",
    "macro_cycle": "BUILD",
    "cycle_substate": "build.implementation_slice",
    "risk_class": "M",
    "supervision_mode": "auto_decision",
    "runtime_context": {
      "runtime": "codex",
      "capability_set_id": "cap_2026-05-03_codex",
      "binding_set_id": "binding_codex_v1"
    },
    "meta_regions": {
      "attention": "nominal",
      "policy": "clear",
      "runtime": "available",
      "delegation": "no_children",
      "human": "no_checkpoint_pending",
      "safety": "normal"
    }
  },
  "convergence": {
    "score": 0.61,
    "last_progress_event": "LOCAL_TESTS_PASSED",
    "stalled_samples": 0,
    "divergence_signals": []
  },
  "derived_view": {
    "primary_lens": "EXECUTE",
    "secondary_lenses": [],
    "evidence_status": "partial",
    "convergence_status": "converging"
  }
}
```

## No Null Rule

La V2 evite les `null`.

Les valeurs inconnues, non applicables ou absentes doivent etre explicites.

| Cas | Valeur |
|---|---|
| Pipeline inactive | `harness_machine.status=NOT_ACTIVE` |
| Pipeline armee mais entre cycles | `harness_machine.status=IDLE` |
| Pas de substate parce que machine idle | `cycle_substate=IDLE` |
| Champ pas applicable | `NOT_APPLICABLE` |
| Champ attendu mais pas encore connu | `UNKNOWN` |
| Champ pas encore initialise | `UNSET` |

Exemple hors developpement:

```json
{
  "run_envelope": {
    "run_kind": "architecture",
    "pipeline_activation": "inactive"
  },
  "harness_machine": {
    "status": "NOT_ACTIVE"
  },
  "derived_view": {
    "primary_lens": "DEFINE",
    "evidence_status": "NOT_APPLICABLE",
    "convergence_status": "NOT_APPLICABLE"
  }
}
```

Ici, la lens `DEFINE` peut exister parce que l'agent aide a clarifier une
architecture, mais elle est une vue derivee de la discussion, pas un etat de la
Pipeline Fractale V4.

## Run Kinds

Tous les runs d'agents ne sont pas des runs de developpement.

| `run_kind` | Sens | Pipeline active par defaut ? |
|---|---|---|
| `conversation` | Reponse simple, aide ponctuelle | Non |
| `research` | Recherche documentaire ou repo analysis | Non, sauf si la recherche est une etape d'un cycle actif |
| `architecture` | Conception, cadrage, proposition | Non par defaut; peut activer `CONCEPTION` si rattache a un item |
| `planning` | Planification de travail | Non par defaut; peut activer `CADRAGE` |
| `development` | Modification code/tests/infra/docs produit | Oui |
| `validation` | Verification d'un resultat existant | Oui si rattache a un run; sinon partiel |
| `release` | Preparation ou execution release | Oui |
| `operations` | Run, incident, monitoring | Oui si rattache a un service ou incident |
| `learning` | Retro, postmortem, amelioration du harness | Oui si rattache a Apprentissage |

## Pipeline Activation

Le "mode developpement" ne doit pas etre confondu avec les 3 modes de
supervision.

Il y a d'abord une activation de pipeline:

| `pipeline_activation` | Sens |
|---|---|
| `inactive` | La discussion ou analyse ne pilote pas la Pipeline V4. |
| `candidate` | La demande pourrait devenir un run pipeline, mais pas encore decide. |
| `armed` | Le RMS a prepare Intent/Policy/Capability, mais aucune execution de cycle. |
| `active` | La Pipeline V4 pilote le run. |
| `suspended` | Pipeline active mais en pause. |
| `closing` | Evidence/final state en cours de cloture. |
| `closed` | Final state ecrit. |

Exemple:

```text
architecture discussion -> pipeline_activation=inactive
demande de feature claire -> candidate
RMS cree Intent/Route -> armed
on commence Discovery ou Build -> active
```

## Macro Cycle

```text
IDLE
DISCOVERY
CADRAGE
CONCEPTION
BUILD
VALIDATION
RELEASE
RUN
APPRENTISSAGE
```

`IDLE` signifie que la Pipeline V4 est disponible, mais aucun cycle n'est en
cours. Hors pipeline, on n'utilise pas `macro_cycle=NONE`; on utilise
`harness_machine.status=NOT_ACTIVE`.

## Cycle Substate

`cycle_substate` doit etre specifique au macro-cycle.

Exemples:

```text
discovery.problem_frame
cadrage.scope_boundary
conception.option_space
build.implementation_slice
validation.acceptance_check
release.rollback_ready
run.incident_triage
learning.pattern_extraction
```

La liste detaillee est dans `02-cycle-specific-substates.md`.

## Fractal Lens

La lens fractale sert a garder une discipline commune.

```text
NONE
OBSERVE
DEFINE
DESIGN
EXECUTE
VERIFY
CAPITALIZE
TRANSMIT
```

Elle ne remplace pas le substate.

Elle est derivee depuis `cycle_substate` par un registry, et sert a repondre a
la question:

```text
Cette substate specifique joue quel role dans le pattern fractal ?
```

Si la lens est materialisee dans un snapshot, elle doit etre validee contre le
registry. Elle ne doit jamais etre modifiee independamment du substate.

## Risk Class

```text
UNCLASSIFIED
T  = Trivial
F  = Faible
M  = Moyen
E  = Eleve
C  = Critique
```

`UNCLASSIFIED` est autorise seulement avant la gate de classification.

## Supervision Mode

```text
pairing
auto_decision
bypass
```

Ces modes sont orthogonaux au macro-cycle.

Ils modifient:

- les guards;
- les validations humaines;
- les droits de bypass;
- la profondeur d'evidence;
- les conditions de convergence.

## Evidence Status

```text
missing
partial
sufficient
with_gaps
verified
stale
conflicted
```

`evidence_status` est derive depuis l'Evidence Set. Il peut etre materialise
dans `derived_view`, mais l'Evidence Set reste la source de verite.

`verified` est requis pour `DONE_VERIFIED`.

`with_gaps` peut produire `DONE_WITH_GAPS`, jamais `DONE_VERIFIED`.

## Final States

Les final states ne sont pas des macro-cycles.

```text
DONE_VERIFIED
DONE_WITH_GAPS
BLOCKED_NEEDS_USER
BLOCKED_RUNTIME_MISSING
BLOCKED_POLICY
MAX_ATTEMPTS_REACHED
LOOP_DETECTED
CANCELLED
ABORTED
```

## Invariants

1. Si `pipeline_activation=inactive`, alors `harness_machine.status=NOT_ACTIVE`.
2. Si `harness_machine.status=NOT_ACTIVE`, aucun `macro_cycle` ne doit etre interprete.
3. Si `harness_machine.status=IDLE`, alors `macro_cycle=IDLE` et `cycle_substate=IDLE`.
4. Si `macro_cycle` est un vrai cycle, alors `cycle_substate` doit appartenir a ce cycle.
5. `primary_lens` est derivee de `cycle_substate`; elle n'est pas une source de verite.
6. `risk_class=UNCLASSIFIED` interdit `bypass`.
7. `risk_class=E` ou `C` interdit `bypass`.
8. `risk_class=C` interdit `auto_decision` sans checkpoint humain obligatoire; le mode recommande est `pairing`.
9. `DONE_VERIFIED` interdit `derived_view.evidence_status != verified`.
10. `DONE_VERIFIED` interdit `derived_view.convergence_status != verified`.
11. Toute transition modifiant `pipeline_activation`, `macro_cycle`, `cycle_substate`, `risk_class`, `supervision_mode` ou `final_state` doit produire un evenement append-only.
