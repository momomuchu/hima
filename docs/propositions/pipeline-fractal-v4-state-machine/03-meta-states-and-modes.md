# 03 - Meta-States, Modes Et Activation Developpement

Statut: draft de conception

## Probleme A Corriger

La V1 avait seulement quelques meta-states:

```text
ERROR_RECOVERABLE
ERROR_ESCALATED
SUSPENDED
ABORTED
```

C'est insuffisant pour comprendre ce qui se passe vraiment.

Un run peut etre:

- ambigu mais pas en erreur;
- bloque par policy;
- degrade parce qu'un runtime ne supporte pas une primitive;
- en attente d'un subagent;
- en train de diverger;
- en attente d'evidence;
- en checkpoint humain obligatoire;
- hors mode developpement.

Ces situations ne doivent pas toutes etre appelees `ERROR`.

## Trois Dimensions A Ne Pas Confondre

| Dimension | Question | Valeurs principales |
|---|---|---|
| Run kind | Quel type de travail fait-on ? | conversation, research, architecture, planning, development, validation, release, operations, learning |
| Pipeline activation | La Pipeline Fractale V4 pilote-t-elle le run ? | inactive, candidate, armed, active, suspended, closing, closed |
| Supervision mode | Qui valide les decisions ? | pairing, auto_decision, bypass |

Exemple:

```text
run_kind=architecture
pipeline_activation=inactive
supervision_mode=auto_decision
```

signifie que l'agent aide a concevoir, mais qu'on n'a pas active la machine de
developpement complete.

Exemple:

```text
run_kind=development
pipeline_activation=active
macro_cycle=BUILD
supervision_mode=auto_decision
```

signifie que le RMS pilote un vrai run de developpement.

## Activation Du Mode Developpement

Le mode developpement est une activation du pipeline, pas un mode de supervision.

| Activation | Description | Effet |
|---|---|---|
| `inactive` | Discussion, recherche ou conception hors run. | Pas de macro-cycle actif. |
| `candidate` | La demande pourrait devenir un run. | Le RMS peut capturer Intent Set. |
| `armed` | Intent, risk et route sont prets. | Le RMS peut demarrer un cycle. |
| `active` | Pipeline pilote l'execution. | Macro/substate obligatoires. |
| `suspended` | Pipeline en pause. | Aucun write hors logs/state. |
| `closing` | Evidence et final state en resolution. | Stop gate active. |
| `closed` | Final state ecrit. | Run immutable sauf append audit. |

## Transition D'Activation

```text
conversation/research/architecture
  -> candidate        si la demande implique un changement ou un cycle
  -> armed            si Intent + Policy + Capability + Route sont prets
  -> active           si CYCLE_START est emis
  -> closing          si final state candidate existe
  -> closed           si Evidence Set valide le final state
```

## Modes De Supervision

| Mode | Role humain | Autorise pour | Interdit pour | Guard principale |
|---|---|---|---|---|
| `pairing` | Humain present, valide souvent. | T/F/M/E/C | aucun | checkpoint frequent |
| `auto_decision` | Agent propose/execute, humain valide aux gates critiques. | T/F/M/E | C | policy + evidence |
| `bypass` | Agent avance sans validation humaine active. | T/F seulement | M/E/C par defaut | `bypass_allowed` |

### Bypass

Bypass ne veut pas dire absence de controle.

Cela veut dire:

- pas de validation humaine active;
- gates automatiques toujours actifs;
- evidence minimale toujours requise;
- interdit sur E/C;
- M seulement avec override humain explicite, et a eviter.

## Meta-Regions

Au lieu d'un seul `meta_state`, la V2 utilise plusieurs regions orthogonales.
Ces regions sont des indicateurs operationnels. Elles ne remplacent pas les
sources canoniques: Evidence Set pour l'evidence, Convergence Set pour la
convergence, Capability/Binding sets pour le runtime.

```json
{
  "meta_regions": {
    "attention": "nominal",
    "policy": "clear",
    "runtime": "available",
    "delegation": "no_children",
    "human": "no_checkpoint_pending",
    "safety": "normal"
  },
  "derived_status": {
    "evidence": "partial",
    "convergence": "converging"
  }
}
```

## Region: Attention

| Valeur | Sens | Effet |
|---|---|---|
| `nominal` | Rien de special. | Continue. |
| `ambiguous_intent` | Intent insuffisant ou contradictoire. | Revenir a Define / demander clarification si bloquant. |
| `scope_drift` | Le run depasse son scope. | Stop local, re-route ou re-cadrage. |
| `context_missing` | Source necessaire absente. | Chercher source ou marquer unknown. |
| `context_conflict` | Sources contradictoires. | Reconciliation requise. |

## Region: Policy

| Valeur | Sens | Effet |
|---|---|---|
| `clear` | Policy satisfaite. | Continue. |
| `warning` | Non-conformite non bloquante. | Log + Evidence Set. |
| `blocked` | Policy bloque. | Pas de transition. |
| `escalation_required` | Validation humaine ou review requise. | Checkpoint. |
| `risk_promotion_pending` | Signaux de classe plus elevee. | Suspendre ou reclassifier. |

## Region: Runtime

| Valeur | Sens | Effet |
|---|---|---|
| `available` | Runtime OK. | Continue. |
| `capability_unknown` | Pas encore inspecte. | Capability discovery obligatoire. |
| `capability_degraded` | Primitive manquante mais fallback possible. | Route degradee tracee. |
| `runtime_missing` | Runtime/outillage absent. | `BLOCKED_RUNTIME_MISSING`. |
| `tool_failed` | Outil a echoue. | Retry ou reroute. |

## Derived Status: Evidence

| Valeur | Sens | Effet |
|---|---|---|
| `missing` | Aucune preuve utile. | Stop interdit. |
| `partial` | Preuves presentes mais insuffisantes. | Continue / verifier. |
| `sufficient` | Preuves suffisantes pour la classe. | Final candidate possible. |
| `with_gaps` | Preuves suffisantes pour avancer mais gaps connus. | `DONE_WITH_GAPS` possible. |
| `verified` | Preuves satisfont la stop gate. | `DONE_VERIFIED` possible. |
| `stale` | Preuve trop ancienne ou obsolete. | Re-verification. |
| `conflicted` | Preuves contradictoires. | Reconciliation ou block. |

Cette valeur est derivee depuis l'Evidence Set. Elle peut etre cachee dans une
vue de lecture, mais ne doit pas etre editee comme source de verite.

## Region: Delegation

| Valeur | Sens | Effet |
|---|---|---|
| `no_children` | Aucun subagent actif. | Normal. |
| `children_running` | Subagents actifs. | Attente possible. |
| `child_result_pending` | Resultat recu mais pas integre. | Evidence intake obligatoire. |
| `child_conflict` | Resultats contradictoires. | Review/arbiter. |
| `child_failed` | Subagent a echoue. | Retry/reroute. |

## Region: Human

| Valeur | Sens | Effet |
|---|---|---|
| `no_checkpoint_pending` | Aucun humain requis. | Continue. |
| `checkpoint_recommended` | Humain utile mais non bloquant. | Warn. |
| `checkpoint_required` | Humain requis par policy. | Block transition. |
| `waiting_user` | Question ou validation attendue. | Pause. |
| `human_rejected` | Validation refusee. | Rework ou abort. |

## Derived Status: Convergence

| Valeur | Sens | Effet |
|---|---|---|
| `not_sampled` | Pas encore mesure. | Premier sample requis. |
| `converging` | Le run se rapproche du but. | Continue. |
| `flat` | Peu de progres. | Re-evaluer route. |
| `oscillating` | Va-et-vient entre memes options. | Re-cadrage ou humain. |
| `diverging` | Defauts/scope/incertitudes augmentent. | Stop/re-route. |
| `verified` | Convergence atteinte. | Final candidate possible. |

Cette valeur est derivee depuis le Convergence Set. Elle ne remplace pas les
scores, samples et signaux detailles de `05-convergence-model.md`.

## Region: Safety

| Valeur | Sens | Effet |
|---|---|---|
| `normal` | Pas de signal safety/securite. | Continue. |
| `destructive_action_pending` | Action irreversible/destructive. | Checkpoint humain. |
| `secret_or_pii_risk` | Risque secret/PII. | Promotion risk + security gate. |
| `production_risk` | Risque prod/release/run. | Release/Run gates renforces. |
| `compliance_risk` | RGPD/EAA/NIS2/DORA financier/etc. | C/E minimum selon signal. |

## Pourquoi Pas Un Seul Meta-State

Un enum unique force des conflits.

Exemple reel possible:

```text
policy=warning
runtime=capability_degraded
evidence=partial
convergence=converging
human=no_checkpoint_pending
```

Ce run n'est pas en erreur. Il avance, mais avec degradation runtime et evidence
encore incomplete. Un seul `ERROR` serait faux.

## Relation Modes x Meta-States

| Situation | Pairing | Auto-decision | Bypass |
|---|---|---|---|
| `ambiguous_intent` | humain aide a clarifier | agent clarifie puis propose | interdit si risque non T/F |
| `risk_promotion_pending` | humain valide promotion | humain requis si E/C | block |
| `evidence=partial` | humain peut accepter gaps | stop interdit sauf `DONE_WITH_GAPS` | stop interdit |
| `runtime=capability_degraded` | humain peut choisir fallback | RMS choisit fallback si policy permet | fallback seulement T/F |
| `convergence=flat` | discussion et re-cadrage | reroute automatique possible | max rapide, sinon block |

## Decision V2

Les meta-states ne doivent pas etre les memes que les final states.

Un final state cloture.

Une meta-region decrit la situation pendant le run.
