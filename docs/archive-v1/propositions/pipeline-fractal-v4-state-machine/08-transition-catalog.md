# 08 - Transition Catalog

Statut: draft de conception

## Principe

Ce catalogue decrit des transitions entre substates semantiques propres a
chaque macro-cycle. La `fractal_lens` reste derivee depuis `cycle_substate`;
elle ne pilote pas la transition.

Chaque transition qui modifie `pipeline_activation`, `macro_cycle`,
`cycle_substate`, `risk_class`, `supervision_mode` ou `final_state` doit emettre
un evenement append-only.

## Activation Du Pipeline

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| ACT-01 | `pipeline_activation=inactive`, `harness_machine.status=NOT_ACTIVE` | `pipeline_activation=candidate`, `harness_machine.status=NOT_ACTIVE` | `PIPELINE_CANDIDATE` | La demande implique un changement, une validation, une release, un incident ou une learning loop. | intent note |
| ACT-02 | `candidate`, `harness_machine.status=NOT_ACTIVE` | `armed`, `harness_machine.status=IDLE`, `macro_cycle=IDLE`, `cycle_substate=IDLE` | `PIPELINE_ARM` | Intent, policy, capability et route initiale sont connus ou explicitement marques `UNKNOWN`. | Intent Set + route |
| ACT-03 | `armed`, `run_kind=development` | `active`, `macro_cycle=DISCOVERY`, `cycle_substate=discovery.intake_received` | `CYCLE_START` | Nouveau probleme ou opportunite a qualifier. | source d'intent |
| ACT-04 | `armed`, `run_kind=development` | `active`, `macro_cycle=BUILD`, `cycle_substate=build.work_scope_loaded` | `CYCLE_START_AT_BUILD` | DoR deja disponible, scope de modification clair, risk class non `UNCLASSIFIED`. | work scope + risk decision |
| ACT-05 | `armed`, `run_kind=validation` | `active`, `macro_cycle=VALIDATION`, `cycle_substate=validation.evidence_plan` | `CYCLE_START_AT_VALIDATION` | Resultat existant a verifier et criteres accessibles. | validation request |
| ACT-06 | `armed`, `run_kind=release` | `active`, `macro_cycle=RELEASE`, `cycle_substate=release.candidate_declared` | `CYCLE_START_AT_RELEASE` | Candidate release identifiee. | release candidate |
| ACT-07 | `armed`, `run_kind=operations` | `active`, `macro_cycle=RUN`, `cycle_substate=run.baseline_observed` | `CYCLE_START_AT_RUN` | Service, incident ou observation operationnelle rattache. | run context |
| ACT-08 | `active` | `suspended` | `CYCLE_SUSPEND` | Pause volontaire, checkpoint humain ou blocage temporaire non terminal. | suspend reason |
| ACT-09 | `suspended` | `active`, last stable `macro_cycle.cycle_substate` | `SESSION_RESUME` | Snapshot valide et contexte restaurable. | restored state |
| ACT-10 | `active` | `closing` | `FINAL_CANDIDATE` | Evidence suffisante pour evaluer un final state. | final candidate record |
| ACT-11 | `closing` | `closed` | `FINAL_COMMIT` | Final state autorise par guard et evidence. | final record |

## Nominal - Transitions Internes

### Discovery

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| DIS-01 | `discovery.intake_received` | `discovery.context_inventory` | `SUBSTATE_COMPLETE` | Source d'intent referencee. | intent source |
| DIS-02 | `discovery.context_inventory` | `discovery.problem_frame` | `SUBSTATE_COMPLETE` | Sources pertinentes lues ou manquantes listees. | observation notes |
| DIS-03 | `discovery.problem_frame` | `discovery.assumption_map` | `SUBSTATE_COMPLETE` | Probleme formule sans solution imposee. | problem statement |
| DIS-04 | `discovery.assumption_map` | `discovery.opportunity_hypothesis` | `SUBSTATE_COMPLETE` | Hypotheses et inconnues explicites. | assumptions list |
| DIS-05 | `discovery.opportunity_hypothesis` | `discovery.probe_executed` | `SUBSTATE_COMPLETE` | Probe, recherche ou entretien defini. | probe plan |
| DIS-06 | `discovery.probe_executed` | `discovery.discovery_verdict` | `SUBSTATE_COMPLETE` | Resultat de probe capture. | probe result |
| DIS-07 | `discovery.discovery_verdict` | `discovery.learning_capture` | `SUBSTATE_COMPLETE` | Verdict `go`, `no-go` ou `gaps` emis. | discovery verdict |
| DIS-08 | `discovery.learning_capture` | `discovery.cadrage_handoff` | `SUBSTATE_COMPLETE` | Signaux utiles consolides. | learning note |

### Cadrage

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| CAD-01 | `cadrage.candidate_selected` | `cadrage.scope_boundary` | `SUBSTATE_COMPLETE` | Item candidat reference. | item reference |
| CAD-02 | `cadrage.scope_boundary` | `cadrage.requirements_model` | `SUBSTATE_COMPLETE` | In/out/non-scope explicites. | scope boundary |
| CAD-03 | `cadrage.requirements_model` | `cadrage.risk_officialized` | `SUBSTATE_COMPLETE` | EF/ENF, AC et criteres testables draftes. | requirements draft |
| CAD-04 | `cadrage.risk_officialized` | `cadrage.priority_capacity_fit` | `SUBSTATE_COMPLETE` | Classe T/F/M/E/C justifiee. | risk decision |
| CAD-05 | `cadrage.priority_capacity_fit` | `cadrage.dor_package` | `SUBSTATE_COMPLETE` | Priorite et capacite compatibles ou arbitrage trace. | priority decision |
| CAD-06 | `cadrage.dor_package` | `cadrage.cadrage_review` | `SUBSTATE_COMPLETE` | DoR assemble. | DoR package |
| CAD-07 | `cadrage.cadrage_review` | `cadrage.cadrage_decision_record` | `SUBSTATE_COMPLETE` | DoR valide ou gaps acceptes. | review verdict |
| CAD-08 | `cadrage.cadrage_decision_record` | `cadrage.conception_handoff` | `SUBSTATE_COMPLETE` | Decisions de cadrage, gaps acceptes et next route captures. | cadrage decision record |

### Conception

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| CON-01 | `conception.constraints_loaded` | `conception.design_problem` | `SUBSTATE_COMPLETE` | Contraintes produit, tech, qualite et runtime inventoriees. | constraints inventory |
| CON-02 | `conception.design_problem` | `conception.option_space` | `SUBSTATE_COMPLETE` | Probleme de conception formule. | design problem |
| CON-03 | `conception.option_space` | `conception.decision_model` | `SUBSTATE_COMPLETE` | Alternatives pertinentes listees. | options list |
| CON-04 | `conception.decision_model` | `conception.risk_model` | `SUBSTATE_COMPLETE` | Choix propose avec criteres. | ADR draft or decision note |
| CON-05 | `conception.risk_model` | `conception.gate_design` | `SUBSTATE_COMPLETE` | Risques de conception traites selon classe. | risk model |
| CON-06 | `conception.gate_design` | `conception.prototype_or_spike` | `SUBSTATE_COMPLETE` | Gates et preuves Build/Validation definies. | gate plan |
| CON-07 | `conception.prototype_or_spike` | `conception.design_review` | `SUBSTATE_COMPLETE` | Spike execute ou explicitement non requis. | spike result or waiver |
| CON-08 | `conception.design_review` | `conception.decision_capture` | `SUBSTATE_COMPLETE` | Decision verifiee, risques residuels explicites. | review verdict |
| CON-09 | `conception.decision_capture` | `conception.build_handoff` | `SUBSTATE_COMPLETE` | ADR, decision note ou waiver capture avant Build. | design decision record |

### Build

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| BLD-01 | `build.work_scope_loaded` | `build.baseline_verified` | `SUBSTATE_COMPLETE` | Item, design, fichiers et contraintes charges. | work scope |
| BLD-02 | `build.baseline_verified` | `build.increment_definition` | `SUBSTATE_COMPLETE` | Baseline, tests existants et dirty tree connus. | baseline evidence |
| BLD-03 | `build.increment_definition` | `build.slice_plan` | `SUBSTATE_COMPLETE` | Increment, frontieres de fichiers et hypothese de rollback local definis. | increment definition |
| BLD-04 | `build.slice_plan` | `build.guard_tests_ready` | `SUBSTATE_COMPLETE` | Incrementation, fichiers et rollback local definis. | slice plan |
| BLD-05 | `build.guard_tests_ready` | `build.implementation_slice` | `SUBSTATE_COMPLETE` | Tests guards prets ou justification documentee. | test plan |
| BLD-06 | `build.implementation_slice` | `build.local_quality_check` | `SUBSTATE_COMPLETE` | Diff produit dans le scope autorise. | diff evidence |
| BLD-07 | `build.local_quality_check` | `build.integration_hardening` | `SUBSTATE_COMPLETE` | Verification locale executee selon policy. | command results |
| BLD-08 | `build.integration_hardening` | `build.change_summary` | `SUBSTATE_COMPLETE` | Edge cases et checks risque traites ou notes. | hardening evidence |
| BLD-09 | `build.change_summary` | `build.validation_handoff` | `SUBSTATE_COMPLETE` | Changement, risques ouverts et tests resumes. | change summary |

### Validation

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| VAL-01 | `validation.evidence_plan` | `validation.environment_ready` | `SUBSTATE_COMPLETE` | Preuves attendues derivees de risk/policy. | validation plan |
| VAL-02 | `validation.environment_ready` | `validation.criteria_alignment` | `SUBSTATE_COMPLETE` | Environnement de verification disponible ou gap explicite. | env check |
| VAL-03 | `validation.criteria_alignment` | `validation.test_execution` | `SUBSTATE_COMPLETE` | AC/DoD mappes au resultat produit. | criteria map |
| VAL-04 | `validation.test_execution` | `validation.acceptance_check` | `SUBSTATE_COMPLETE` | Tests auto/manuels/exploratoires executes. | test results |
| VAL-05 | `validation.acceptance_check` | `validation.defect_triage` | `SUBSTATE_COMPLETE` | Besoin utilisateur ou objectif harness evalue. | acceptance verdict |
| VAL-06 | `validation.defect_triage` | `validation.quality_verdict` | `SUBSTATE_COMPLETE` | Defauts classes et route proposes. | defect log |
| VAL-07 | `validation.quality_verdict` | `validation.release_handoff` | `SUBSTATE_COMPLETE` | Verdict `GO`, `NO-GO` ou `GO_WITH_GAPS` emis. | validation verdict |

### Release

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| REL-01 | `release.candidate_declared` | `release.release_scope_defined` | `SUBSTATE_COMPLETE` | Candidate et scope release identifies. | release candidate |
| REL-02 | `release.release_scope_defined` | `release.rollback_ready` | `SUBSTATE_COMPLETE` | Frontieres, changements inclus/exclus et rollback attentes sont explicites. | release scope |
| REL-03 | `release.rollback_ready` | `release.approval_gate` | `SUBSTATE_COMPLETE` | Rollback, flag ou migration strategy definis. | rollback plan |
| REL-04 | `release.approval_gate` | `release.artifact_packaged` | `SUBSTATE_COMPLETE` | Approval automatique/humain selon risk obtenu. | approval decision |
| REL-05 | `release.artifact_packaged` | `release.deployment_executed` | `SUBSTATE_COMPLETE` | Artefacts/version/changelog/SBOM si requis produits. | artifact evidence |
| REL-06 | `release.deployment_executed` | `release.smoke_verified` | `SUBSTATE_COMPLETE` | Deploiement ou simulation execute. | deploy evidence |
| REL-07 | `release.smoke_verified` | `release.release_notes_capture` | `SUBSTATE_COMPLETE` | Smoke tests et SLO initial OK ou gap accepte. | smoke result |
| REL-08 | `release.release_notes_capture` | `release.run_handoff` | `SUBSTATE_COMPLETE` | Notes, decisions et risques residuels captures. | release notes |

### Run

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| RUN-01 | `run.baseline_observed` | `run.health_monitoring` | `SUBSTATE_COMPLETE` | Baseline SLO/SLI/logs/couts observee. | baseline metrics |
| RUN-02 | `run.health_monitoring` | `run.incident_triage` | `SUBSTATE_COMPLETE` | Snapshot operationnel capture. | monitoring snapshot |
| RUN-03 | `run.incident_triage` | `run.mitigation_decision` | `SUBSTATE_COMPLETE` | Incident ou no-op classifie. | incident class or no-op |
| RUN-04 | `run.mitigation_decision` | `run.mitigation_executed` | `SUBSTATE_COMPLETE` | Decision rollback/hotfix/no-action/escalation prise. | ops decision |
| RUN-05 | `run.mitigation_executed` | `run.stability_window` | `SUBSTATE_COMPLETE` | Mitigation appliquee ou non-action justifiee. | action log |
| RUN-06 | `run.stability_window` | `run.operational_learning` | `SUBSTATE_COMPLETE` | Stabilite observee sur fenetre definie. | stability evidence |
| RUN-07 | `run.operational_learning` | `run.learning_sample_handoff` | `SUBSTATE_COMPLETE` | Lessons/runbook/postmortem captures comme sample d'apprentissage, sans fermer le Run long-lived. | run learning sample |

### Apprentissage

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| LRN-01 | `learning.evidence_replay` | `learning.prediction_delta` | `SUBSTATE_COMPLETE` | Preuves, decisions, metrics et incidents rejoues. | replay summary |
| LRN-02 | `learning.prediction_delta` | `learning.pattern_extraction` | `SUBSTATE_COMPLETE` | Ecarts prediction vs realite identifies. | delta report |
| LRN-03 | `learning.pattern_extraction` | `learning.rule_update_design` | `SUBSTATE_COMPLETE` | Patterns positifs/negatifs retenus. | pattern list |
| LRN-04 | `learning.rule_update_design` | `learning.policy_or_doc_update` | `SUBSTATE_COMPLETE` | Changement policy/doc propose et approuve si requis. | update proposal |
| LRN-05 | `learning.policy_or_doc_update` | `learning.calibration_verdict` | `SUBSTATE_COMPLETE` | Update applique ou explicitement reporte. | update diff or waiver |
| LRN-06 | `learning.calibration_verdict` | `learning.memory_capture` | `SUBSTATE_COMPLETE` | Impact systeme evalue. | calibration verdict |
| LRN-07 | `learning.memory_capture` | `learning.discovery_seed_handoff` | `SUBSTATE_COMPLETE` | Lessons consolidees. | learning record |

## Nominal - Macro-Cycle Handoffs

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| MAC-01 | `discovery.cadrage_handoff` | `cadrage.candidate_selected` | `CYCLE_COMPLETE` | Discovery verdict != `no-go`. | handoff artifact |
| MAC-02 | `cadrage.conception_handoff` | `conception.constraints_loaded` | `CYCLE_COMPLETE` | DoR package valide, risk class officielle. | cadrage handoff |
| MAC-03 | `conception.build_handoff` | `build.work_scope_loaded` | `CYCLE_COMPLETE` | Route/design/gates definis; ADR si requis. | build handoff |
| MAC-04 | `build.validation_handoff` | `validation.evidence_plan` | `CYCLE_COMPLETE` | Change summary et build evidence disponibles. | validation handoff |
| MAC-05 | `validation.release_handoff` | `release.candidate_declared` | `CYCLE_COMPLETE` | Verdict `GO` ou `GO_WITH_GAPS`, pas de blocker E/C non traite. | release handoff |
| MAC-06 | `release.run_handoff` | `run.baseline_observed` | `CYCLE_COMPLETE` | Release proof ou no-release reason explicite. | run handoff |
| MAC-07 | `run.learning_sample_handoff` | `learning.evidence_replay` | `RUN_SAMPLE_READY` | Sample operationnel, incident report ou no-run reason explicite pret pour apprentissage; le Run peut rester vivant. | learning sample handoff |
| MAC-08 | `learning.discovery_seed_handoff` | `pipeline_activation=closing` | `CYCLE_COMPLETE` | Learning capture et final state candidate disponibles. | discovery seeds + final candidate |

## Rollback Et Rework

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| RWK-01 | `discovery.discovery_verdict` | `discovery.context_inventory` | `DISCOVERY_GAP` | Context insuffisant ou contradictoire. | gap note |
| RWK-02 | `cadrage.cadrage_review` | `cadrage.scope_boundary` | `DOR_FAIL_SCOPE` | Scope instable ou non testable. | review verdict |
| RWK-03 | `cadrage.cadrage_review` | `cadrage.requirements_model` | `DOR_FAIL_REQUIREMENTS` | AC/ENF incomplets. | review verdict |
| RWK-04 | `conception.design_review` | `conception.option_space` | `DESIGN_REWORK` | Decision non defendable ou alternative manquante. | review verdict |
| RWK-05 | `conception.design_review` | `conception.risk_model` | `RISK_MODEL_REWORK` | Risques sous-classes ou gates insuffisants. | review verdict |
| RWK-06 | `build.local_quality_check` | `build.implementation_slice` | `QUALITY_FAIL` | Tests/lint/typecheck/build rouges avec correction locale possible. | command failure |
| RWK-07 | `build.integration_hardening` | `build.slice_plan` | `INTEGRATION_REPLAN` | Edge case ou integration invalide l'increment. | hardening evidence |
| RWK-08 | `validation.defect_triage` | `build.slice_plan` | `DOD_FAIL_REWORK` | Defaut corrigeable par nouveau slice. | defect log |
| RWK-09 | `validation.defect_triage` | `conception.gate_design` | `DOD_FAIL_DESIGN_GAP` | Defaut vient d'un gate/design absent. | defect log |
| RWK-10 | `release.approval_gate` | `release.rollback_ready` | `APPROVAL_REWORK` | Rollback/flag/migration insuffisant. | approval decision |
| RWK-11 | `release.smoke_verified` | `release.rollback_ready` | `SMOKE_FAIL_ROLLBACK` | Smoke rouge apres deploy/simulation. | smoke failure |
| RWK-12 | `run.incident_triage` | `release.rollback_ready` | `PROD_ROLLBACK_REQUEST` | Incident rattache a release recente et rollback disponible. | incident log |
| RWK-13 | `run.mitigation_decision` | `build.work_scope_loaded` | `HOTFIX_REQUEST` | Mitigation exige un correctif de code/docs/config. | ops decision |
| RWK-14 | `learning.calibration_verdict` | `learning.rule_update_design` | `CALIBRATION_REWORK` | Update propose n'ameliore pas le systeme. | calibration verdict |

## Risk Promotion

Une promotion de risque est une transition orthogonale: elle modifie
`risk_class` et peut suspendre ou rerouter le run sans perdre le substate courant.

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| RSK-01 | any active substate, `risk_class=UNCLASSIFIED` | same substate, `risk_class=T/F/M/E/C` | `RISK_CLASS_SET` | Classe justifiee avant bypass ou macro handoff. | risk decision |
| RSK-02 | any active substate, `risk_class=T/F` | same substate, higher `risk_class` | `RISK_CLASS_PROMOTE` | Signal d'impact utilisateur, donnees, auth, infra, API publique ou compliance. | promotion rationale |
| RSK-03 | any active substate, new `risk_class=E/C` | `pipeline_activation=suspended`, same last stable substate | `RISK_PROMOTION_CHECKPOINT` | Checkpoint humain ou review independante requis. | checkpoint request |
| RSK-04 | any active substate, `supervision_mode=bypass`, new `risk_class=M/E` | same substate, `supervision_mode=auto_decision` or `pairing` | `BYPASS_REVOKED` | Bypass incompatible avec la nouvelle classe; auto-decision reste soumise aux gates de risque. | mode change log |
| RSK-04C | any active substate, `supervision_mode=bypass`, new `risk_class=C` | `pipeline_activation=suspended`, same last stable substate, `supervision_mode=pairing` | `BYPASS_REVOKED_CRITICAL` | Risque critique: checkpoint humain obligatoire avant reprise. | mode change log + checkpoint request |
| RSK-05 | `build.implementation_slice` with auth/PII/payment/schema/prod signal | `conception.risk_model` | `PROMOTE_AND_REROUTE_DESIGN` | Le risque implique un design/gate absent. | promotion rationale |
| RSK-06 | `release.deployment_executed` or `run.mitigation_executed` with production risk | `release.rollback_ready` | `PROMOTE_AND_REQUIRE_ROLLBACK` | Rollback non teste ou production risk eleve. | production risk note |
| RSK-07 | any active substate with compliance signal | `cadrage.risk_officialized` | `PROMOTE_AND_RECADRAGE` | La classe officielle ou le scope doit etre revise. | compliance note |

## Meta-Region Transitions

Ces transitions ne remplacent pas le macro/substate actif; elles changent une
region orthogonale et peuvent bloquer la sortie du substate courant.

| ID | Region | From | To | Event | Effet |
|---|---|---|---|---|---|
| MTA-01 | attention | `nominal` | `ambiguous_intent` | `INTENT_CONFLICT` | Revenir au dernier substate de definition pertinent: `discovery.problem_frame`, `cadrage.scope_boundary` ou `conception.design_problem`. |
| MTA-02 | attention | `nominal` | `scope_drift` | `SCOPE_DRIFT_DETECTED` | Bloquer les writes hors scope; rerouter vers `cadrage.scope_boundary`. |
| MTA-03 | policy | `clear` | `blocked` | `POLICY_BLOCK` | Interdire la transition demandee; produire blocker evidence. |
| MTA-04 | policy | `clear` | `risk_promotion_pending` | `RISK_SIGNAL_DETECTED` | Declencher `RISK_CLASS_PROMOTE` avant tout handoff. |
| MTA-05 | runtime | `available` | `capability_degraded` | `FALLBACK_SELECTED` | Continuer avec evidence de route degradee si policy permet. |
| MTA-06 | runtime | any | `runtime_missing` | `RUNTIME_MISSING` | Aller vers final candidate `BLOCKED_RUNTIME_MISSING` si aucun fallback autorise. |
| MTA-07 | derived_status.evidence | `partial` | `sufficient` | `EVIDENCE_SET_COMPLETE` | Autoriser macro handoff ou final candidate selon contexte. |
| MTA-08 | derived_status.evidence | `sufficient` | `verified` | `STOP_GATE_VERIFIED` | Autoriser `DONE_VERIFIED`. |
| MTA-09 | derived_status.evidence | any | `conflicted` | `EVIDENCE_CONFLICT` | Rerouter vers `validation.criteria_alignment` ou substate source du conflit. |
| MTA-10 | derived_status.convergence | `converging` | `flat` | `NO_PROGRESS_SAMPLE` | Re-evaluer route; ne pas clore. |
| MTA-11 | derived_status.convergence | `flat` | `diverging` | `DIVERGENCE_SIGNAL` | Suspendre ou rerouter vers Cadrage/Conception selon cause. |
| MTA-12 | human | `checkpoint_required` | `waiting_user` | `CHECKPOINT_OPENED` | Bloquer transition jusqu'a validation, rejet ou abort. |
| MTA-13 | human | `waiting_user` | `human_rejected` | `HUMAN_REJECTED` | Rerouter vers rework adapte ou final candidate `CANCELLED`. |

## Final-State Transitions

| ID | From | To | Event | Guard minimale | Evidence |
|---|---|---|---|---|---|
| FIN-01 | `pipeline_activation=closing` | `final_state=DONE_VERIFIED`, `pipeline_activation=closed` | `FINAL_COMMIT` | `derived_view.evidence_status=verified`, `derived_view.convergence_status=verified`, risk gates satisfaits, pas de blocker ouvert. | Evidence Set + final record |
| FIN-02 | `pipeline_activation=closing` | `final_state=DONE_WITH_GAPS`, `pipeline_activation=closed` | `FINAL_COMMIT_WITH_GAPS` | `derived_view.evidence_status=with_gaps`, convergence suffisante, gaps explicites, non bloquants et non E/C residuels. | gap list + owner |
| FIN-03 | any active/suspended state | `final_state=BLOCKED_NEEDS_USER`, `pipeline_activation=closed` | `BLOCK_USER_REQUIRED` | Checkpoint humain obligatoire sans reponse ou decision externe manquante. | blocker report |
| FIN-04 | any active/suspended state | `final_state=BLOCKED_RUNTIME_MISSING`, `pipeline_activation=closed` | `BLOCK_RUNTIME_MISSING` | Runtime/outillage requis absent et fallback impossible ou interdit. | missing runtime log |
| FIN-05 | any state | `final_state=BLOCKED_POLICY`, `pipeline_activation=closed` | `BLOCK_POLICY` | Action ou bypass structurellement interdit par risk/policy. | policy block log |
| FIN-06 | any active state | `final_state=MAX_ATTEMPTS_REACHED`, `pipeline_activation=closed` | `MAX_ATTEMPTS` | Meme recovery tentee 3 fois sans progres. | attempts log |
| FIN-07 | any active state | `final_state=LOOP_DETECTED`, `pipeline_activation=closed` | `LOOP_DETECTED` | Meme state pattern visite 3 fois sans convergence. | loop evidence |
| FIN-08 | any active/suspended state | `final_state=CANCELLED`, `pipeline_activation=closed` | `CYCLE_ABORT` | Annulation humaine explicite. | abort report |
| FIN-09 | any state with unrecoverable invariant break | `final_state=ABORTED`, `pipeline_activation=closed` | `ERROR_UNRECOVERABLE` | Etat corrompu, invariant impossible a reparer ou audit-only impose. | abort report |

## Invariants De Transition

1. Une transition interne ne peut cibler qu'un `cycle_substate` appartenant au
   meme `macro_cycle`.
2. Une transition macro ne peut partir que du substate de handoff du cycle
   source et entrer dans le premier substate semantique du cycle cible.
3. `pipeline_activation=inactive` impose `harness_machine.status=NOT_ACTIVE`;
   aucun `macro_cycle` ni `cycle_substate` ne doit etre interprete.
4. `pipeline_activation=active` impose un vrai `macro_cycle`, un
   `cycle_substate` appartenant a ce cycle, et une lens derivee depuis le
   registre de substates.
5. `risk_class=UNCLASSIFIED` interdit `supervision_mode=bypass` et interdit les
   macro handoffs apres Cadrage.
6. Une promotion vers `E` ou `C` interdit `bypass` et impose un checkpoint ou une
   review independante avant reprise.
7. `DONE_VERIFIED` exige `derived_view.evidence_status=verified` et
   `derived_view.convergence_status=verified`; `DONE_WITH_GAPS` exige des gaps
   explicites et acceptables selon la classe de risque.
8. Une transition bloquee doit produire une evidence de blocage, pas disparaitre
   silencieusement.
