# 02 - Substates Specifiques Par Macro-Cycle

Statut: draft de conception

## Principe

Chaque macro-cycle a ses propres substates.

Les 7 etapes fractales restent une lens commune:

```text
OBSERVE, DEFINE, DESIGN, EXECUTE, VERIFY, CAPITALIZE, TRANSMIT
```

Mais elles ne doivent pas etre stockees comme substates identiques dans tous les
cycles.

Un bon substate doit dire ce qui se passe vraiment dans ce cycle.

Mauvais:

```text
BUILD.Observer
BUILD.Definir
BUILD.Concevoir
```

Mieux:

```text
build.baseline_verified
build.slice_plan
build.implementation_slice
```

## Discovery Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `discovery.intake_received` | OBSERVE | Une demande, idee, signal ou probleme entre dans le systeme. | intent source referencee |
| `discovery.context_inventory` | OBSERVE | Sources connues: docs, prompts, feedback, logs, marche, utilisateurs. | observation notes |
| `discovery.problem_frame` | DEFINE | Probleme/opportunite formule sans solution prematuree. | problem statement minimal |
| `discovery.assumption_map` | DEFINE | Hypotheses, inconnues, risques de mauvaise discovery. | assumptions list |
| `discovery.opportunity_hypothesis` | DESIGN | Hypothese de valeur et approche de validation. | opportunity hypothesis |
| `discovery.probe_executed` | EXECUTE | Recherche, entretien, spike ou analyse realisee. | probe result |
| `discovery.discovery_verdict` | VERIFY | On decide si le probleme merite Cadrage. | go/no-go/gaps |
| `discovery.learning_capture` | CAPITALIZE | Signaux et patterns retenus. | learning note |
| `discovery.cadrage_handoff` | TRANSMIT | Entree exploitable pour Cadrage. | handoff artifact |

## Cadrage Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `cadrage.candidate_selected` | OBSERVE | Item candidat selectionne depuis Discovery/backlog. | item reference |
| `cadrage.scope_boundary` | DEFINE | In/out/non-scope clarifies. | scope boundary |
| `cadrage.requirements_model` | DEFINE | EF/ENF, acceptance criteria, test criteria. | requirements draft |
| `cadrage.risk_officialized` | DEFINE | Classe T/F/M/E/C officielle et justifiee. | risk decision |
| `cadrage.priority_capacity_fit` | DESIGN | Priorite, capacite, arbitrage MoSCoW/RICE. | priority decision |
| `cadrage.dor_package` | EXECUTE | Pack DoR assemble. | DoR package |
| `cadrage.cadrage_review` | VERIFY | DoR et perimetre verifies. | review verdict |
| `cadrage.cadrage_decision_record` | CAPITALIZE | Decisions de cadrage, tradeoffs et risques residuels captures. | cadrage decision record |
| `cadrage.conception_handoff` | TRANSMIT | Entree claire pour Conception. | handoff artifact |

## Conception Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `conception.constraints_loaded` | OBSERVE | Contraintes produit, tech, qualite, securite, runtime connues. | constraints inventory |
| `conception.design_problem` | DEFINE | Probleme de conception formule. | design problem |
| `conception.option_space` | DESIGN | Alternatives explicites. | options list |
| `conception.decision_model` | DESIGN | Choix et criteres de decision. | ADR draft or decision note |
| `conception.risk_model` | DESIGN | Threat model, privacy, migration, perf selon classe. | risk model |
| `conception.gate_design` | DESIGN | Gates/tests/evidence attendus pour Build/Validation. | gate plan |
| `conception.prototype_or_spike` | EXECUTE | Spike/PoC si necessaire. | spike result |
| `conception.design_review` | VERIFY | Decision et risques verifies. | review verdict |
| `conception.decision_capture` | CAPITALIZE | ADR, alternatives rejetees, hypotheses et limites de design captures. | design decision record |
| `conception.build_handoff` | TRANSMIT | Plan d'execution donne a Build. | build handoff |

## Build Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `build.work_scope_loaded` | OBSERVE | Item, design, files, tests et contraintes charges. | work scope |
| `build.baseline_verified` | OBSERVE | Etat initial verifie: tests existants, build, dirty tree. | baseline evidence |
| `build.increment_definition` | DEFINE | Increment, comportement attendu, criteres de succes et non-scope local definis. | increment definition |
| `build.slice_plan` | DESIGN | Incrementation choisie, fichiers, tests, rollback local. | slice plan |
| `build.guard_tests_ready` | DESIGN | Tests/regression guards ou justification. | test plan |
| `build.implementation_slice` | EXECUTE | Code/docs/tests modifies. | diff evidence |
| `build.local_quality_check` | VERIFY | Tests/lint/typecheck/build locaux selon policy. | command results |
| `build.integration_hardening` | VERIFY | Integration, edge cases, security/perf checks selon classe. | hardening evidence |
| `build.change_summary` | CAPITALIZE | Ce qui a change, risques ouverts, dette creee/remboursee. | change summary |
| `build.validation_handoff` | TRANSMIT | Evidence exploitable par Validation. | validation handoff |

## Validation Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `validation.evidence_plan` | OBSERVE | Liste des preuves requises selon risk/policy. | validation plan |
| `validation.environment_ready` | OBSERVE | Environnement de verification disponible. | env check |
| `validation.criteria_alignment` | DEFINE | AC/DoD compares au travail produit. | criteria map |
| `validation.test_execution` | EXECUTE | Tests automatises/manuels/exploratoires executes. | test results |
| `validation.acceptance_check` | VERIFY | Besoin utilisateur ou harness objective verifie. | acceptance verdict |
| `validation.defect_triage` | VERIFY | Bugs/gaps classes et routage rollback/build. | defect log |
| `validation.quality_verdict` | CAPITALIZE | GO / NO-GO / GO with gaps. | validation verdict |
| `validation.release_handoff` | TRANSMIT | Entree pour Release ou retour Build. | release handoff |

## Release Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `release.candidate_declared` | OBSERVE | Candidate et scope release identifies. | release candidate |
| `release.release_scope_defined` | DEFINE | Version, changements inclus/exclus, compatibilite et contraintes definis. | release scope |
| `release.rollback_ready` | DESIGN | Rollback, feature flag, migration strategy. | rollback plan |
| `release.approval_gate` | VERIFY | Gate humain/auto selon classe. | approval decision |
| `release.artifact_packaged` | EXECUTE | Artefacts, version, changelog, SBOM si requis. | artifact evidence |
| `release.deployment_executed` | EXECUTE | Deploiement ou simulation realise. | deploy evidence |
| `release.smoke_verified` | VERIFY | Smoke tests et SLO initial OK. | smoke result |
| `release.release_notes_capture` | CAPITALIZE | Notes, decisions, risques residuels. | release notes |
| `release.run_handoff` | TRANSMIT | Entree operationnelle pour Run. | run handoff |

## Run Substates

Run est un cycle long-lived. Il ne "se termine" pas comme Build ou Release.
Un run de livraison peut produire un sample operationnel et un handoff vers
Apprentissage, mais le service reste en operation apres cet handoff.

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `run.baseline_observed` | OBSERVE | SLO/SLI/logs/couts/baseline observes. | baseline metrics |
| `run.health_monitoring` | OBSERVE | Etat courant mesure. | monitoring snapshot |
| `run.incident_triage` | DEFINE | Incident ou no-incident classifie. | incident class or no-op |
| `run.mitigation_decision` | DESIGN | Rollback, hotfix, no-action, escalation. | ops decision |
| `run.mitigation_executed` | EXECUTE | Action operationnelle appliquee si necessaire. | action log |
| `run.stability_window` | VERIFY | Stabilite observee sur fenetre definie. | stability evidence |
| `run.operational_learning` | CAPITALIZE | Postmortem/lessons/runbook updates. | run learning |
| `run.learning_sample_handoff` | TRANSMIT | Sample operationnel transmis a Apprentissage sans clore les operations. | learning sample |

## Apprentissage Substates

| Substate | Lens | Role | Exit evidence |
|---|---|---|---|
| `learning.evidence_replay` | OBSERVE | Relecture preuves, decisions, metrics, incidents. | replay summary |
| `learning.prediction_delta` | DEFINE | Ecarts prediction vs realite identifies. | delta report |
| `learning.pattern_extraction` | DEFINE | Patterns recurrents positifs/negatifs. | pattern list |
| `learning.rule_update_design` | DESIGN | Changements proposes aux policies/gates/templates. | update proposal |
| `learning.policy_or_doc_update` | EXECUTE | Mise a jour docs/policies si approuvee. | update diff |
| `learning.calibration_verdict` | VERIFY | Les changements ameliorent-ils le systeme ? | calibration verdict |
| `learning.memory_capture` | CAPITALIZE | Lessons consolidees. | learning record |
| `learning.discovery_seed_handoff` | TRANSMIT | Inputs structures pour prochaine Discovery. | discovery seeds |

## Mapping Lens Non-Bijectif

La relation entre substate et lens n'est pas toujours 1:1.

Exemple:

```text
cadrage.risk_officialized
```

peut relever de `DEFINE` parce que la classe est definie, mais aussi de `DESIGN`
car elle determine le chemin pipeline.

V1 decision: un substate a une lens primaire et peut avoir des tags secondaires.

```json
{
  "cycle_substate": "cadrage.risk_officialized",
  "primary_lens": "DEFINE",
  "secondary_lenses": ["DESIGN"]
}
```

## Transition Rule

Une transition interne doit aller d'un substate semantique vers un autre
substate semantique.

La lens est derivee, pas pilotante.

Mauvais:

```text
BUILD.OBSERVE -> BUILD.DEFINE
```

Mieux:

```text
build.baseline_verified -> build.increment_definition
```

## Questions A Stabiliser

1. Chaque macro-cycle doit-il avoir exactement 7 substates principaux, ou un
   nombre variable ?
2. Les substates doivent-ils etre en anglais des maintenant pour faciliter le
   code ?
3. Faut-il autoriser plusieurs lenses secondaires ?
4. Les transitions internes doivent-elles etre strictement lineaires ou autoriser
   des retours locaux, par exemple `validation.defect_triage -> build.slice_plan` ?
