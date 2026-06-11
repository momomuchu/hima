# 10 - Revue Critique

Statut: revue critique V1

Portee: proposition V2 dans ce dossier, confrontee aux docs sources
`docs/transversal/*` et `docs/conception/*`.

Note d'integration: cette revue capture les contradictions detectees avant la
passe d'integration du dossier. Les corrections appliquees apres revue sont
resumees dans `07-architecture-critique.md`; les constats ci-dessous restent
utiles comme stress test, meme lorsque certains exemples de lignes ont ete
corriges dans les fichiers sources.

## Verdict Court

La V2 corrige une faiblesse importante de la V1: elle separe mieux le cycle
metier reel de la lens fractale commune. Mais elle n'est pas encore prete pour
implementation. Les concepts sont plus riches, sans que la source canonique,
les precedences de guard, les invariants inter-axes et les chemins de
degradation runtime soient assez fermes.

Le risque principal n'est pas un manque d'ambition. C'est l'inverse: la V2
ajoute `run_kind`, `pipeline_activation`, `cycle_substate`, `fractal_lens`,
`meta_regions`, `convergence`, `evidence_status`, `runtime_context` et
`supervision_mode` sans encore dire quels champs sont derives, quels champs sont
autoritatifs, et quels champs bloquent effectivement une transition.

## 1. Surface V2 Encore Instable

Le `README.md` annonce une surface complete allant jusqu'a `10`, avec notamment
`07-architecture-critique.md` (`README.md:57` a `README.md:62`). Dans l'etat
observe, `05`, `06`, `08`, `09` et cette revue existent, mais `07` manque
encore. Ce n'est pas seulement une lacune documentaire: `00-work-breakdown.md:22`
donne explicitement a L7 la question des corrections architecturales restantes.

Les nouveaux documents confirment aussi que la proposition n'est pas
implementation-ready:

- `06-open-decisions.md:292` a `06-open-decisions.md:305` liste les decisions
  P0 qui bloquent la premiere implementation executable;
- `09-validation-checklist.md:16` a `09-validation-checklist.md:29` dit que la
  proposition n'est prete que si les decisions sont fermees, les guards sont
  derivables, la convergence mesurable, les bindings runtime explicites et les
  transitions auditables;
- plusieurs decisions P0 recoupent les contradictions relevees ci-dessous:
  substate cardinality, transition topology, non-dev representation, activation
  gate, risk/supervision canonicalization, risk classifier, evidence semantics
  et closing protocol.

Conclusion critique: la V2 est une bonne surface de convergence, pas encore un
contrat stable. Le `README.md` devrait distinguer "documents presents",
"documents attendus" et "documents bloquants pour implementation".

## 2. Conflit De Canon Entre V2 Et Les Specs "Implementation-Ready"

La decision V2 dit que les 7 etapes fractales "ne doivent pas etre les
substates stockes de chaque cycle" (`README.md:28`) et que chaque macro-cycle
doit avoir ses propres substates semantiques (`README.md:32`). C'est sain.

Mais les docs sources restent en contradiction directe:

- `docs/conception/01-state-machine-spec.md:3` se declare
  "implementation-ready";
- le meme document definit un "universal sub-cycle" (`01-state-machine-spec.md:27`),
  enumere 56 etats `8 cycles x 7 sub-phases`
  (`01-state-machine-spec.md:41`) et dit que le meme pattern vaut pour les 8
  cycles (`01-state-machine-spec.md:217`);
- `docs/transversal/harness-state-machine.md:36` formalise aussi des
  sous-etats orthogonaux comme sous-cycle universel a 7 etapes, et
  `harness-state-machine.md:223` dit que la sous-etape active est l'une des 7
  etapes universelles.

Tant que cette contradiction n'est pas tranchee, un implementateur peut choisir
soit `BUILD.Executer`, soit `build.implementation_slice` comme etat stocke, et
les deux choix auront une source locale credible. Il faut un ADR ou une note de
supersession qui dise clairement:

- V2 remplace-t-elle `docs/conception/01-state-machine-spec.md` ou seulement la
  nuance-t-elle ?
- l'implementation cible doit-elle stocker `cycle_substate` semantique et
  deriver `fractal_lens`, ou conserver `subPhase` universel pour compatibilite ?
- quels noms restent autorises dans les logs existants et dans
  `current-state.yaml` ?

## 3. L'Objet D'Etat Est Trop Redondant Pour Etre Sur

`01-state-model.md` introduit un objet compose qui inclut notamment
`meta_regions`, `convergence` et `evidence_status` (`01-state-model.md:35` a
`01-state-model.md:46`). L'exemple stocke ensuite la preuve a deux endroits:
`meta_regions.evidence = partial` (`01-state-model.md:67`) et
`evidence_status = partial` (`01-state-model.md:82`). La convergence est aussi
representee comme region (`03-meta-states-and-modes.md:187` a
`03-meta-states-and-modes.md:196`) et comme objet score/detail dans
`01-state-model.md`. `05-convergence-model.md` precise que `evidence_score`
alimente `evidence_status` sans le remplacer (`05-convergence-model.md:156` a
`05-convergence-model.md:161`) et que le `convergence_guard` ne decide jamais
seul (`05-convergence-model.md:446` a `05-convergence-model.md:468`). C'est une
amelioration, mais pas encore une regle de coherence complete.

Cette duplication cree des etats impossibles a interpreter sans regle de
resolution. Exemple: que fait le RMS si `meta_regions.evidence=verified`,
`evidence_status=partial` et `convergence.score=0.42` ? L'invariant actuel dit
seulement que `DONE_VERIFIED` interdit `evidence_status != verified`
(`01-state-model.md:293`), mais ne dit pas si la region evidence est derivee,
cachee, ou aussi bloquante. `06-open-decisions.md:172` a
`06-open-decisions.md:190` reconnait d'ailleurs que les semantiques exactes
`evidence_status` / `meta_regions.evidence` restent une decision P0.

Recommendation:

- declarer `evidence_status` comme champ canonique et `meta_regions.evidence`
  comme vue derivee, ou supprimer l'un des deux;
- declarer `meta_regions.convergence` comme vue derivee du modele de
  convergence, pas comme deuxieme source de verite;
- ajouter des invariants de coherence inter-champs avant toute implementation.

## 4. Source Canonique De L'Etat Encore Floue

La V2 parle d'un `State` compose, mais ne fixe pas le fichier ou set RMS
autoritatif. Les docs conception existantes divergent:

- `docs/conception/01-state-machine-spec.md:954` et
  `01-state-machine-spec.md:961` font de `.planning/agent/current-state.yaml`
  le snapshot primaire et autoritatif;
- `01-state-machine-spec.md:1014` dit que la machine lit ce fichier a chaque
  invocation de hook;
- `docs/conception/05-gates-policy-spec.md:44` et
  `05-gates-policy-spec.md:94` parlent plutot de `active-run.json`;
- la V1 proposait deja une autre option: `.rms/runs/<run-id>/run-set.json`
  comme source RMS canonique.

Sans arbitrage, les hooks peuvent lire `active-run.json`, la machine persister
`current-state.yaml`, et le RMS raisonner sur un Run Set different. C'est une
source directe de desynchronisation.

Decision necessaire: choisir une seule source autoritative pour les guards
runtime. Les autres fichiers doivent etre des vues derivees, avec regles de
reconstruction et de conflit explicites.

## 5. Activation, Suspension Et Finalisation Sont Mal Fermees

La V2 separe correctement `run_kind`, `pipeline_activation` et
`supervision_mode` (`03-meta-states-and-modes.md:36` a
`03-meta-states-and-modes.md:37`). Mais les transitions et invariants associes
sont incomplets.

Points faibles:

- `pipeline_activation=suspended` dit "Aucun write hors logs/state"
  (`03-meta-states-and-modes.md:71`), mais `01-state-model.md` ne donne pas
  d'invariant pour `macro_cycle`, `cycle_substate`, `final_state` ou
  `meta_regions` pendant `suspended`;
- les final states sont separes des macro-cycles (`01-state-model.md:269` a
  `01-state-model.md:282`), mais la relation entre `pipeline_activation=closed`
  et `final_state` n'est pas definie;
- l'invariant append-only couvre les changements de champs majeurs
  (`01-state-model.md:294`), mais pas les changements de `meta_regions`,
  `convergence.score`, `runtime_context` ou `evidence_status`, alors que ces
  champs peuvent bloquer ou autoriser un stop.

Il manque une table "activation x final_state x permissions" qui dise, par
exemple, si un run `closing` peut encore lancer des tests, si un run `closed`
peut recevoir une evidence tardive, et si `suspended` est une activation, une
meta-region, ou les deux.

## 6. Guard Matrix Encore Trop Declarative

La guard matrix pose une formule utile:
`base_guard + risk_overlay + supervision_overlay + runtime_overlay +
territory_overlay + evidence_overlay + convergence_overlay`
(`04-guard-matrix.md:23` a `04-guard-matrix.md:30`). Mais elle ne donne pas
encore de precedence entre overlays. `08-transition-catalog.md` ajoute des
transitions concretes, mais ses colonnes restent "Guard minimale" et
"Evidence" (`08-transition-catalog.md:17`, `08-transition-catalog.md:35`,
`08-transition-catalog.md:134`), pas un algorithme de decision executable.

Cas non resolus:

- si `risk_overlay` dit `block`, `runtime_overlay` dit `degrade` et
  `evidence_overlay` dit `warn`, quel verdict sort ?
- `Guard Decision Output` autorise `allow`, `warn`, `block`, `escalate`,
  `degrade`, `reroute` (`04-guard-matrix.md:134` a `04-guard-matrix.md:155`),
  alors que `docs/conception/05-gates-policy-spec.md:204` reduit les gates a
  `allow | block | warn`;
- la base matrix macro et le transition catalog restent vagues sur des
  transitions critiques: `RELEASE -> RUN` peut passer avec "explicit
  no-release reason" et `RUN -> APPRENTISSAGE` avec "explicit no-run reason"
  (`04-guard-matrix.md:65` a `04-guard-matrix.md:67`;
  `08-transition-catalog.md:141` a `08-transition-catalog.md:142`), sans dire
  quelles classes de risque et quels modes l'autorisent.

La matrice doit devenir un algorithme compilable: ordre de precedence,
monoid/merge des decisions, severite, actions obligatoires, et mapping unique
vers les final states.

## 7. Runtime Degradation Contredit Les Hard Guards

`04-guard-matrix.md` dit que si un hook manque, un post-run check peut suffire
pour T/F, mais doit bloquer M+ si l'enforcement est requis
(`04-guard-matrix.md:100`, `04-guard-matrix.md:214` a
`04-guard-matrix.md:215`). En face, `docs/conception/04-runtime-bindings-spec.md`
dit que si `codex_hooks = false`, le harness "Skip all gate enforcement"
(`04-runtime-bindings-spec.md:611`) et que sur erreur non geree il sort en
fail-open (`04-runtime-bindings-spec.md:638` a `04-runtime-bindings-spec.md:641`).

Ce n'est pas seulement un detail d'implementation. C'est une contradiction de
surete. Si les hooks sont la gate principale pour bloquer les ecritures
(`05-gates-policy-spec.md:59`) et pour bloquer `DONE_VERIFIED` sans evidence
(`05-gates-policy-spec.md:126`), alors un runtime sans hooks ne peut pas etre
traite comme simple degradation pour M/E/C.

Proposition de decision:

- T/F: fail-open autorise avec `DONE_WITH_GAPS` si la preuve est incomplete;
- M: fail-open seulement si une verification post-run exhaustive est possible,
  sinon `BLOCKED_RUNTIME_MISSING`;
- E/C: runtime sans pre-tool/stop bloquants = `BLOCKED_RUNTIME_MISSING` par
  defaut, sauf pairing humain explicite avec trace.

## 8. Bypass Et Override Humain Restent Ambigus Pour M

La V2 dit que `bypass` est autorise T/F seulement et interdit M/E/C par defaut
(`03-meta-states-and-modes.md:92`), puis ajoute "M seulement avec override
humain explicite" (`03-meta-states-and-modes.md:104`). Le document transversal
dit aussi que M peut avoir `HUMAN_OVERRIDE` pour bypass
(`harness-state-machine.md:589` a `harness-state-machine.md:591`), tandis que
la risk spec presente M comme mode auto-decision, avec bypass interdit dans les
matrices principales (`02-risk-classifier-spec.md:386` a
`02-risk-classifier-spec.md:397`).

Il faut distinguer trois concepts qui sont actuellement trop proches:

- mode `bypass` du run;
- bypass d'une gate individuelle;
- override humain ponctuel d'une politique.

Sinon, un implementateur peut legalement encoder "M + human override => mode
bypass", alors qu'un autre encodera "M + human override => une seule gate
contournee, mode inchange". Ces deux comportements n'ont pas le meme niveau de
risque.

## 9. Les Substates Specifiques Sont Prometteurs Mais Pas Encore Normalises

`02-cycle-specific-substates.md` fait le bon mouvement en remplacant les noms
generiques par des substates semantiques. Mais le document reconnait lui-meme
que la relation substate/lens n'est pas bijective (`02-cycle-specific-substates.md:145`)
et introduit `secondary_lenses` (`02-cycle-specific-substates.md:162`).

Cette souplesse peut redevenir une explosion de complexite:

- certains cycles ont 8 ou 9 substates, pas 7;
- certains n'ont pas de substate explicite pour toutes les lenses;
- les transitions peuvent etre lineaires ou avec retours locaux, question
  encore ouverte (`02-cycle-specific-substates.md:192` a
  `02-cycle-specific-substates.md:193`);
- l'anglais des substates est encore une question ouverte
  (`02-cycle-specific-substates.md:189` a `02-cycle-specific-substates.md:190`),
  alors que les specs TypeScript existantes utilisent des enums localisees et
  parfois accentuees.

Avant implementation, il faut un schema:

- identifiant machine stable en anglais ASCII;
- libelle humain optionnel en francais;
- lens primaire obligatoire;
- lenses secondaires soit interdites en MVP, soit limitees a metadata non
  pilotante;
- transitions autorisees par cycle, y compris retours locaux.

## 10. Les Runs Non-Developpement Sont Nommes, Mais Restent A Fermer

`01-state-model.md` liste des `run_kind` non developpement et montre un run
`architecture` avec `pipeline_activation=inactive` et `fractal_lens=DEFINE`
(`01-state-model.md:101` a `01-state-model.md:112`). C'est utile pour eviter de
forcer toute conversation dans le pipeline.

`08-transition-catalog.md` ajoute une activation progressive
`inactive -> candidate -> armed -> active` (`08-transition-catalog.md:19` a
`08-transition-catalog.md:28`). Mais la gouvernance reste ouverte:
`06-open-decisions.md:72` a `06-open-decisions.md:90` marque la representation
des runs non-dev comme P0, et `06-open-decisions.md:92` a
`06-open-decisions.md:108` marque la gate d'activation comme P0.

Points faibles restants:

- ce qui doit etre loggue pour un run `research` ou `architecture` inactif;
- si les guards de territoire s'appliquent quand la pipeline est inactive;
- comment un artefact de conception produit hors pipeline devient ensuite une
  evidence de `CONCEPTION` ou de `CADRAGE`.

Sans cela, la frontiere "hors pipeline" risque de devenir une zone grise qui
permet de produire des decisions structurantes sans Evidence Set ni transition
append-only.

## 11. DoR/DoD Et Evidence Restent Le Point De Blocage Principal

La proposition V2 reconnait que les guards generiques `dorSatisfied` et
`dodSatisfied` etaient trop vagues (`04-guard-matrix.md:13` a
`04-guard-matrix.md:18`). Mais elle ne remplace pas encore ces guards par des
criteres evaluables.

Le document transversal avait deja classe la definition formelle des DoR/DoD
par cycle comme RED CARD bloquante (`harness-state-machine.md:820` a
`harness-state-machine.md:826`) et rappelle qu'un garde non documente est non
evaluable (`harness-state-machine.md:1018`). La V2 doit donc eviter de
reintroduire des phrases comme "DoR package valide", "validation verdict GO",
"final record" sans schema d'evidence minimum.

Decision necessaire: definir une matrice `cycle_substate x risk_class ->
exit_evidence`, puis une matrice `macro_transition x risk_class ->
blocking_evidence`. Le texte actuel donne des exemples; il ne donne pas encore
un contrat executable.

## Priorites De Correction

1. Clarifier le canon: V2 remplace-t-elle les specs a sous-cycle universel, ou
   reste-t-elle une proposition non normative ?
2. Choisir la source autoritative de l'etat courant et marquer les autres
   fichiers comme vues derivees.
3. Reduire les champs redondants ou ajouter des invariants stricts entre
   `evidence_status`, `meta_regions.evidence`, `convergence` et `final_state`.
4. Transformer la guard matrix en algorithme de merge avec precedence et sortie
   unique compatible avec les specs gates.
5. Fermer la politique runtime: M/E/C ne doivent pas pouvoir dependre d'un
   enforcement fail-open sans final state degrade ou bloque.
6. Produire ou integrer `07-architecture-critique.md`, puis fermer les P0 de
   `06-open-decisions.md` avant toute implementation.

## Tests De Coherence A Ajouter Avant Implementation

- Validation schema: aucun `cycle_substate` ne peut appartenir a un autre
  macro-cycle.
- Validation canon: aucun etat stocke ne peut utiliser `Cycle.Observer` si V2
  devient normative.
- Validation evidence: `DONE_VERIFIED` est impossible si une des representations
  de preuve/convergence contredit le statut canonique.
- Validation runtime: Codex sans `codex_hooks=true` ne peut pas atteindre
  `DONE_VERIFIED` pour M/E/C.
- Validation guard merge: chaque combinaison
  `block/warn/degrade/reroute/escalate` produit une decision finale
  deterministe.
- Validation activation: `inactive`, `candidate`, `armed`, `active`,
  `suspended`, `closing`, `closed` ont chacun permissions, champs obligatoires
  et transitions autorisees.
