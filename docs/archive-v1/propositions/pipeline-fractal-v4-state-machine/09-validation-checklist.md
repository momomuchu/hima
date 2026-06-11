# 09 - Validation Checklist

Statut: draft de conception

## Objectif

Ce document definit comment prouver que la proposition de state machine
Pipeline Fractale V4 est coherente avant implementation.

La validation ne cherche pas a prouver que l'implementation marche. Elle cherche
a bloquer les contradictions de conception qui rendraient l'implementation
ambigue, non portable ou impossible a tester.

## Verdict De Coherence

La proposition est prete pour implementation seulement si:

```text
schema coherent
+ invariants satisfaits
+ substates couverts par cycle
+ guards evaluables
+ no-null rule applicable
+ runs non-dev representables
+ modes de supervision couverts
+ convergence mesurable
+ bindings runtime explicites
+ transitions auditables
= READY_FOR_IMPLEMENTATION
```

Tout point bloque doit produire une decision ouverte ou une correction du
document concerne.

## Documents Sources A Verifier

| Document | Role dans la validation |
|---|---|
| `01-state-model.md` | Champs canoniques, enums, no-null rule, invariants, final states. |
| `02-cycle-specific-substates.md` | Substates propres par macro-cycle et mapping vers la lens fractale. |
| `03-meta-states-and-modes.md` | Run kinds, activation pipeline, supervision modes, meta-regions. |
| `04-guard-matrix.md` | Guards, overlays risque/mode/runtime/territoire/evidence/convergence. |
| `05-convergence-model.md` | Score, stagnation, divergence, max iterations comme fusible. |
| `06-open-decisions.md` | Decisions qui doivent etre tranchees avant implementation. |
| `08-transition-catalog.md` | Transitions concretes entre substates semantiques. |
| `docs/conception/03-rms-sets-schema.md` | Alignement avec Run Set, Evidence Set, Capability Set et Binding Set. |
| `docs/conception/04-runtime-bindings-spec.md` | Portabilite runtime, no-op traces, fallback/degradation. |
| `docs/conception/05-gates-policy-spec.md` | Semantique des gates et evidence attendue. |

## 1. Invariants D'Etat

- [ ] `pipeline_activation=inactive` implique toujours `harness_machine.status=NOT_ACTIVE`.
- [ ] `harness_machine.status=NOT_ACTIVE` interdit d'interpreter `macro_cycle` ou `cycle_substate`.
- [ ] `pipeline_activation=armed` implique `harness_machine.status=IDLE`, `macro_cycle=IDLE` et `cycle_substate=IDLE`.
- [ ] `pipeline_activation=active` interdit `harness_machine.status=NOT_ACTIVE`.
- [ ] `pipeline_activation=active` impose un vrai `macro_cycle` et un `cycle_substate` appartenant au cycle actif.
- [ ] `derived_view.primary_lens` est derive depuis le registre de substates, pas saisi comme etat autoritatif.
- [ ] `risk_class=UNCLASSIFIED` est autorise seulement avant la gate de classification.
- [ ] `risk_class=UNCLASSIFIED` interdit `supervision_mode=bypass`.
- [ ] `risk_class=E` ou `risk_class=C` interdit `supervision_mode=bypass`.
- [ ] `risk_class=C` interdit l'auto-decision autonome sans checkpoint humain obligatoire.
- [ ] `DONE_VERIFIED` exige `derived_view.evidence_status=verified` et `derived_view.convergence_status=verified`.
- [ ] `DONE_WITH_GAPS` interdit de masquer des gaps E/C non acceptes.
- [ ] Toute modification de `macro_cycle`, `cycle_substate`, `risk_class`, `supervision_mode`, `pipeline_activation` ou `final_state` produit un evenement append-only.
- [ ] Le snapshot courant et `events.jsonl` ne peuvent pas raconter deux etats differents pour le meme run.

## 2. Schema Checks

- [ ] Le State Object minimal separe `run_envelope`, `harness_machine`, `derived_view` et `events`; les champs de machine active ne flottent pas au top-level.
- [ ] `run_envelope` contient au minimum `run_id`, `run_kind`, `pipeline_activation`, `intent_ref` et `route_ref`.
- [ ] `harness_machine` contient, quand actif, `status`, `macro_cycle`, `cycle_substate`, `risk_class`, `supervision_mode`, `runtime_context`, `meta_regions` et `convergence`.
- [ ] `derived_view` contient les vues calculees: `primary_lens`, `secondary_lenses`, `evidence_status` et `convergence_status`.
- [ ] Chaque champ enumere a une liste de valeurs fermee ou une regle d'extension explicite.
- [ ] Les valeurs sentinelles sont definies: `NOT_ACTIVE`, `IDLE`, `NOT_APPLICABLE`, `UNKNOWN`, `UNSET`, `UNCLASSIFIED`.
- [ ] Les sentinelles ne sont pas interchangeables: `UNKNOWN` signifie attendu mais inconnu; `NOT_APPLICABLE` signifie non applicable; `UNSET` signifie pas initialise.
- [ ] Les final states sont modelises hors `macro_cycle`.
- [ ] `meta_regions` contient les regions obligatoires: `attention`, `policy`, `runtime`, `delegation`, `human`, `safety`; evidence et convergence restent des statuts derives.
- [ ] Le schema interdit les proprietes critiques absentes quand `pipeline_activation=active`.
- [ ] Le schema autorise les runs hors developpement sans forcer un macro-cycle.
- [ ] Le schema de Run Set cible dans `03-rms-sets-schema.md` peut porter les champs V2 sans perte semantique ou liste une migration necessaire.

## 3. No-Null Rule

- [ ] Aucun exemple JSON de la proposition V2 n'utilise `null` pour l'etat courant.
- [ ] Chaque champ optionnel apparent a une valeur explicite ou une justification de non-applicabilite.
- [ ] Les bindings runtime `no-op` restent autorises seulement dans le Binding Set, avec trace et raison, pas comme trou silencieux dans l'etat du run.
- [ ] Les specs existantes qui utilisent encore `null` pour des bindings ou versions runtime sont identifiees comme incompatibilites a resoudre ou a adapter.
- [ ] Les tests de schema prevus incluent un fixture qui echoue si un champ d'etat V2 vaut `null`.

## 4. Per-Cycle Substate Coverage

- [ ] Chaque macro-cycle reel a au moins un substate semantique par lens primaire necessaire a son role: OBSERVE, DEFINE, DESIGN, EXECUTE, VERIFY, CAPITALIZE, TRANSMIT.
- [ ] Les cycles peuvent avoir un nombre variable de substates, mais chaque omission de lens primaire est justifiee.
- [ ] Aucun substate stocke n'est du type generique `Cycle.Observer`, `Cycle.Definir`, `Cycle.Executer` ou equivalent.
- [ ] Chaque substate a un nom stable, un role, une lens primaire et une evidence de sortie.
- [ ] Les lenses secondaires sont autorisees seulement si la lens primaire reste unique.
- [ ] Chaque substate est prefixe par son cycle en minuscule, par exemple `build.local_quality_check`.
- [ ] Chaque macro-cycle a une substate de handoff ou une transition de sortie equivalente.
- [ ] Les substates non-dev, operations et learning sont traites comme des cycles a part entiere quand la pipeline est active.

## 5. Guard Matrix Checks

- [ ] Chaque transition macro a une `base_guard` et une evidence minimale.
- [ ] Chaque transition interne entre substates a une guard evaluable ou herite explicitement d'une guard du cycle.
- [ ] Chaque guard declare son type: `entry_guard`, `exit_guard`, `transition_guard`, `territory_guard`, `runtime_guard`, `evidence_guard`, `human_guard`, `convergence_guard`.
- [ ] La decision de guard utilise seulement les valeurs autorisees: `allow`, `warn`, `block`, `escalate`, `degrade`, `reroute`.
- [ ] Une guard ne depend pas d'un booleen vague comme `dorSatisfied` sans criteres par cycle et risque.
- [ ] Le risk overlay couvre T, F, M, E et C pour evidence, tests, rollback, checkpoint humain, bypass et convergence sampling.
- [ ] Le supervision overlay couvre `pairing`, `auto_decision` et `bypass` pour sortie de substate, transition macro, ambiguite, E/C et final state.
- [ ] Le runtime overlay distingue primitive disponible, fallback declare, primitive absente, hook non bloquant et capability inconnue.
- [ ] Le territory overlay depend au minimum de `macro_cycle + cycle_substate + tool + target_path + action_type`.
- [ ] L'evidence overlay bloque `DONE_VERIFIED` si l'Evidence Set ne satisfait pas la classe de risque.
- [ ] Le convergence overlay peut bloquer ou rerouter en cas de stagnation, oscillation ou divergence.

## 6. Non-Dev Run Coverage

- [ ] Chaque `run_kind` est couvert par au moins un exemple valide: `conversation`, `research`, `architecture`, `planning`, `development`, `validation`, `release`, `operations`, `learning`.
- [ ] Les runs `conversation`, `research`, `architecture` et `planning` peuvent rester `pipeline_activation=inactive` sans macro-cycle.
- [ ] Un run non-dev peut exposer une `derived_view.primary_lens` utile sans activer toute la pipeline.
- [ ] L'activation `candidate -> armed -> active` est definie quand un run non-dev devient un run pipeline.
- [ ] La validation partielle d'un resultat existant est representable sans mentir sur un cycle Build qui n'a pas eu lieu.
- [ ] Les runs `operations` et `learning` peuvent activer respectivement `RUN` et `APPRENTISSAGE` sans passer artificiellement par Build.

## 7. Mode Coverage

- [ ] Les trois modes `pairing`, `auto_decision`, `bypass` sont orthogonaux a `run_kind`, `pipeline_activation` et `macro_cycle`.
- [ ] Chaque mode a des consequences explicites sur guards, evidence, checkpoints humains et droits de bypass.
- [ ] `bypass` garde les gates automatiques actifs.
- [ ] `bypass` est limite a T/F sauf override humain explicite documente pour M.
- [ ] E/C impose un checkpoint humain ou un mode non-bypass.
- [ ] C interdit l'auto-decision autonome; toute poursuite hors pairing exige une validation humaine explicite et tracee.
- [ ] Les changements de mode produisent une decision ou un evenement append-only.

## 8. Convergence Checks

- [ ] Le modele de convergence contient au minimum `score`, `last_progress_event`, `stalled_samples` et `divergence_signals`.
- [ ] Le score a une echelle definie, par exemple 0.0 a 1.0, avec seuils de progression, stagnation et verification.
- [ ] Les signaux de convergence sont lies a des preuves, pas seulement a une impression narrative.
- [ ] `last_progress_event` reference un evenement existant.
- [ ] `stalled_samples` augmente seulement quand une iteration ne produit pas de progres mesurable.
- [ ] Les signaux de divergence couvrent au moins scope drift, defauts croissants, evidence conflictuelle, oscillation de route et risk promotion.
- [ ] `MAX_ATTEMPTS_REACHED` reste un fusible, pas la definition principale de non-convergence.
- [ ] `LOOP_DETECTED` exige un pattern repete plus absence de preuve de convergence.
- [ ] Le final state ne peut pas etre choisi si la convergence est `diverging` ou `oscillating`, sauf final blocked explicite.

## 9. Runtime Binding Checks

- [ ] `runtime_context.runtime` reference un runtime supporte ou `UNKNOWN` avec guard bloquante.
- [ ] `capability_set_id` reference un Capability Set produit ou declare comme `UNKNOWN` avant discovery.
- [ ] `binding_set_id` reference un Binding Set compatible avec le runtime actif.
- [ ] Une guard runtime ne suppose jamais une primitive absente du Capability Set.
- [ ] Chaque gate canonique a un binding pour Claude, Codex et Hermes, ou un `no-op` trace avec raison.
- [ ] Un `no-op` ne peut pas satisfaire silencieusement une gate bloquante pour M/E/C.
- [ ] Les fallbacks declares produisent `degrade` ou `warn` et ajoutent une evidence de degradation.
- [ ] Quand une plateforme ne peut pas bloquer une action, la matrice precise si le risque autorise un post-run check.
- [ ] Les differences entre hooks, wrappers, MCP et post-run checks restent dans le Binding Set, pas dans la logique metier de la state machine.

## 10. Transition Catalog Checks

- [ ] Chaque transition a un identifiant stable.
- [ ] Chaque transition declare `from`, `to`, `event`, guards, evidence produite et effet sur meta-regions.
- [ ] Les transitions internes utilisent des substates semantiques, pas les lenses comme etats.
- [ ] Les transitions macro respectent l'ordre nominal Discovery -> Cadrage -> Conception -> Build -> Validation -> Release -> Run.
- [ ] Run est long-lived: il peut emettre un sample vers Apprentissage sans etre considere comme termine.
- [ ] Les transitions de retour sont explicites: defect triage vers Build, risk promotion vers Cadrage/Conception, runtime missing vers blocked ou reroute.
- [ ] Les transitions de suspension, resume, cancel, abort et blocked conservent le dernier etat stable.
- [ ] Les transitions de final state passent par evidence et convergence.

## 11. Acceptance Fixtures

La coherence doit etre testee avec des fixtures minimales avant implementation:

| Fixture | Attendu |
|---|---|
| Development M en `BUILD` avec tests partiels | Etat valide, final stop bloque pour `DONE_VERIFIED`. |
| Architecture hors pipeline | `pipeline_activation=inactive`, `harness_machine.status=NOT_ACTIVE`, `derived_view.primary_lens` possible, etat valide. |
| Research qui devient item candidat | Transition vers `candidate`, pas encore de macro-cycle actif. |
| Operations incident | Activation directe possible sur `RUN`, sans Build artificiel. |
| Bypass avec risque E | Guard bloque. |
| Risk UNCLASSIFIED avec bypass | Guard bloque. |
| DONE_VERIFIED avec evidence partial | Guard bloque. |
| Runtime Codex sans `subagent_stop` | `no-op` trace, fallback ou gap explicite selon risque. |
| Primitive requise absente pour M+ | Guard bloque ou reroute, pas de degradation silencieuse. |
| Loop de validation sans progres | `LOOP_DETECTED` ou reroute, pas max iteration seul. |
| State JSON avec `null` | Schema invalide. |
| Substate `BUILD.Executer` | Schema invalide ou lint de proposition bloque. |
| `macro_cycle=NONE` dans un snapshot V2 | Schema invalide; utiliser `harness_machine.status=NOT_ACTIVE` ou `IDLE`. |

## 12. Pre-Implementation Gate

Avant de demarrer l'implementation, le reviewer doit pouvoir cocher:

- [ ] Toutes les valeurs d'enum sont listees et non contradictoires.
- [ ] Toutes les matrices ont une ligne pour chaque cycle, risk class et mode pertinent.
- [ ] Tous les cas `block`, `warn`, `degrade`, `reroute` produisent une evidence ou decision.
- [ ] Les decisions ouvertes restantes sont classees comme bloquantes ou non bloquantes.
- [ ] Les divergences avec les specs existantes sont listees et assignees.
- [ ] Les fixtures d'acceptance couvrent dev, non-dev, runtime degrade, bypass interdit, evidence insuffisante et convergence negative.
- [ ] Le MVP peut etre extrait sans casser les invariants V2.

## Sorties Attendues

La validation produit:

1. un verdict `READY_FOR_IMPLEMENTATION`, `READY_WITH_DECISIONS` ou `BLOCKED`;
2. la liste des documents corriges ou decisions ouvertes;
3. les fixtures de schema/guard/convergence a transformer en tests;
4. les risques residuels acceptes explicitement.
