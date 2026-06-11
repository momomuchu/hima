# 05 - Modele De Convergence

Statut: draft de conception

## Probleme A Corriger

La V1 assimilait la securite de boucle a deux mecanismes trop pauvres:

```text
attemptCount >= 3
stateVisitCounts[key] >= 3
```

Ces seuils restent utiles comme fusibles, mais ils ne disent pas si le run se
rapproche vraiment du but.

Un run peut consommer peu d'iterations et diverger fortement. Inversement, un
run de risque Eleve ou Critique peut avoir besoin de plusieurs boucles
validation -> build -> validation tout en convergeant correctement.

La V2 doit donc separer:

- la convergence: preuve que l'etat du run s'ameliore;
- les max-iterations: limite de securite contre les boucles non maitrisees;
- les final states: decision de cloture, jamais simple compteur.

## Principe V2

La convergence est une region de controle orthogonale au macro-cycle.

Elle repond a la question:

```text
Les preuves, les risques et le scope evoluent-ils dans la bonne direction ?
```

Elle alimente:

- `derived_view.convergence_status`;
- `convergence_guard` dans la guard matrix;
- `evidence_overlay` pour les final states;
- les decisions de reroute, escalation ou blocage;
- la profondeur de supervision selon `pairing`, `auto_decision` ou `bypass`.

## State Object De Convergence

Objet conceptuel attendu dans l'etat compose:

```json
{
  "convergence": {
    "score": 0.61,
    "evidence_score": 0.54,
    "risk_adjusted_score": 0.49,
    "trend": "improving",
    "last_progress_event": "LOCAL_TESTS_PASSED",
    "samples": 4,
    "stalled_samples": 0,
    "repeated_state_pattern": "none",
    "divergence_signals": [],
    "oscillation_signals": [],
    "max_iteration_budget": 5,
    "iteration_count": 2
  }
}
```

Ce document ne fixe pas encore les noms de champs implementables. Il fixe la
semantique que l'implementation devra respecter.

## Convergence Vs Max-Iterations

`max_iteration_budget` est un fusible, pas une preuve d'echec par lui-meme.

| Situation | Interpretation | Decision attendue |
|---|---|---|
| Score augmente, iterations sous budget | Convergence normale. | Continuer. |
| Score augmente, budget presque atteint | Travail long mais sain. | Continuer ou checkpoint selon risque. |
| Score plat, budget sous controle | Stagnation possible. | Reroute locale ou re-cadrage. |
| Score baisse, budget sous controle | Divergence precoce. | Stop local, promotion de risque possible. |
| Budget atteint, score bas ou plat | Boucle non productive. | `MAX_ATTEMPTS_REACHED` ou `LOOP_DETECTED`. |
| Budget atteint, score haut mais evidence incomplete | Presque fini mais pas cloturable. | Checkpoint, extension explicite ou `DONE_WITH_GAPS` si autorise. |

Regle centrale:

```text
Une iteration supplementaire est autorisee seulement si elle a une hypothese de
progres explicite et un signal attendu mesurable.
```

Sans hypothese nouvelle, repeter la meme action est une boucle.

## Progress Signals

Un signal de progres est un evenement qui reduit l'incertitude, le risque
residuel, la dette de preuve ou l'ecart aux criteres d'acceptation.

### Signaux Positifs

| Signal | Sens |
|---|---|
| `intent_clarified` | Le probleme ou le scope est moins ambigu. |
| `risk_class_confirmed` | La classe T/F/M/E/C est justifiee et stable. |
| `risk_promoted_correctly` | Une sous-classification a ete detectee puis corrigee. |
| `design_option_eliminated` | Une alternative a ete rejetee avec raison explicite. |
| `decision_recorded` | Une decision de conception est tracable. |
| `guard_test_added` | Un risque de regression a une preuve executable ou inspectable. |
| `defect_count_reduced` | Les defauts ouverts diminuent sans creer de nouveaux defauts majeurs. |
| `tests_or_checks_passed` | Les checks attendus pour la classe passent. |
| `evidence_gap_closed` | Une preuve manquante devient presente et fraiche. |
| `rollback_ready` | Le risque operationnel residuel diminue. |
| `human_checkpoint_resolved` | Une validation humaine obligatoire est obtenue. |
| `handoff_artifact_complete` | La transmission au cycle suivant est exploitable. |

### Signaux Negatifs

| Signal | Sens |
|---|---|
| `scope_expanded` | Le perimetre augmente sans nouvelle decision de cadrage. |
| `risk_signal_discovered` | Un signal de forcage T/F/M -> E/C apparait. |
| `evidence_conflicted` | Les preuves se contredisent. |
| `test_regression_added` | Un nouveau defaut apparait pendant la correction. |
| `runtime_degraded_without_plan` | Un fallback est utilise sans decision tracee. |
| `decision_reopened` | Une decision deja stabilisee est reouverte sans nouvelle evidence. |
| `same_fix_failed_again` | La meme tentative echoue plusieurs fois. |
| `human_checkpoint_blocked` | Une validation obligatoire reste absente. |

Un signal negatif ne bloque pas toujours. Il diminue le score et peut forcer une
promotion de risque, une reroute ou un checkpoint.

## Evidence Score

`evidence_score` mesure la qualite des preuves disponibles, pas le volume de
texte produit.

Il est compose de cinq dimensions:

| Dimension | Question |
|---|---|
| Presence | Les preuves requises existent-elles ? |
| Pertinence | Ces preuves couvrent-elles les risques et criteres actifs ? |
| Fraicheur | Les preuves correspondent-elles au dernier etat du run ? |
| Independence | Les preuves viennent-elles de sources suffisamment distinctes ? |
| Decision power | Permettent-elles une decision allow/warn/block/escalate ? |

Exemples:

| Evidence | Score qualitatif |
|---|---|
| Diff summary seul pour un changement T docs-only. | Suffisant. |
| Tests unitaires verts mais acceptance non verifiee pour M. | Partiel. |
| CI verte avant le dernier changement. | Stale. |
| Deux subagents donnent des verdicts incompatibles. | Conflicted. |
| ADR + threat model + tests critiques + rollback teste pour E/C. | Renforce ou maximal. |

`evidence_score` alimente `evidence_status`, mais ne le remplace pas:

- score bas -> `missing` ou `partial`;
- score moyen avec gaps explicites -> `with_gaps`;
- score suffisant pour la classe -> `sufficient`;
- score suffisant, frais et non contradictoire -> `verified`.

## Convergence Score

`score` represente l'avancement global vers une cloture valide.

Il doit combiner au minimum:

| Composant | Effet attendu |
|---|---|
| Progres de substate | Sorties semantiques produites pour le cycle actif. |
| Evidence score | Preuves presentes, pertinentes, fraiches et decidables. |
| Defect delta | Defauts, contradictions et gaps diminuent. |
| Risk delta | Risque residuel stable ou en baisse apres mitigation. |
| Scope stability | Le perimetre ne derive pas sans recadrage. |
| Runtime stability | Les outils/capabilities requis restent disponibles. |
| Human gates | Les checkpoints obligatoires sont resolus. |

Le score n'est pas une moyenne naive. Une preuve critique manquante doit pouvoir
plafonner le score, meme si plusieurs signaux mineurs sont positifs.

Exemple:

```text
risk_class=E
tests=passed
rollback_plan=missing
human_checkpoint=missing
```

Le run peut progresser, mais il ne converge pas vers `DONE_VERIFIED` tant que
les gates E obligatoires restent ouvertes.

## Seuils Qualitatifs

Les seuils exacts pourront etre calibres plus tard. La V2 impose seulement les
bandes de decision:

| Bande | Sens | Effet |
|---|---|---|
| `0.00 - 0.24` | Non convergent. | Reroute, re-cadrage ou blocage. |
| `0.25 - 0.49` | Progres faible ou fragile. | Continuer seulement avec hypothese claire. |
| `0.50 - 0.74` | Convergence plausible. | Continuer, evidence a renforcer. |
| `0.75 - 0.89` | Presque cloturable. | Stop gate possible si gaps acceptables. |
| `0.90 - 1.00` | Cloture verifiee possible. | `DONE_VERIFIED` si `derived_view.evidence_status=verified`. |

Ces bandes sont risk-adjusted avant decision.

## Stagnation

La stagnation signifie que les samples successifs n'ameliorent plus le run.

Elle peut apparaitre meme sans erreur technique.

Signaux typiques:

- memes gaps d'evidence apres plusieurs samples;
- meme substate visitee sans sortie semantique nouvelle;
- meme test rouge sans hypothese differente;
- discussion qui reformule le scope sans le stabiliser;
- delegation terminee mais resultats non integres;
- validation impossible faute d'environnement non resolu.

Effet sur `derived_view.convergence_status`:

```text
not_sampled -> converging -> flat
```

Decision attendue:

| Risque | Reaction a `flat` |
|---|---|
| T | Une reroute rapide ou cloture avec gap explicite si non bloquant. |
| F | Une reroute; budget court. |
| M | Re-cadrage local ou retour Conception/Build selon le gap. |
| E | Checkpoint recommande ou requis selon gate touchee. |
| C | Checkpoint humain requis; pas de poursuite silencieuse. |

## Divergence

La divergence signifie que le run s'eloigne du but.

Elle est plus grave que la stagnation: les actions recentes augmentent le risque,
le scope, les defauts ou les contradictions.

Signaux de divergence:

- defauts plus nombreux ou plus graves apres correction;
- classe de risque sous-estimee et non encore traitee;
- scope drift non valide par Cadrage;
- preuves qui deviennent conflictuelles;
- rollback ou recovery moins clair qu'au debut;
- runtime capability degradee sans fallback decide;
- action tentee dans un territoire non autorise;
- checkpoints humains obligatoires contournes ou absents.

Effet:

```text
derived_view.convergence_status = diverging
```

Decision attendue:

- bloquer les transitions de macro-cycle;
- suspendre ou rerouter le run;
- promouvoir la classe de risque si un signal de forcage apparait;
- produire une evidence de divergence;
- ouvrir un checkpoint humain pour M ambigu, E et C;
- interdire bypass.

## Oscillation

L'oscillation est un va-et-vient entre les memes etats, options ou corrections
sans accumulation de preuve.

Elle peut etre plus difficile a voir qu'une divergence, parce que chaque etape
semble localement raisonnable.

Patterns typiques:

| Pattern | Exemple |
|---|---|
| State ping-pong | `validation.defect_triage -> build.implementation_slice -> validation.defect_triage` sans baisse des defauts. |
| Design ping-pong | Option A puis B puis A sans nouveau critere de decision. |
| Test ping-pong | Un test passe pendant qu'un ancien test critique redevient rouge. |
| Risk ping-pong | Classe M puis E puis M sans justification de declassement. |
| Human ping-pong | Demande de validation repetee sans decision nouvelle a prendre. |

Effet:

```text
derived_view.convergence_status = oscillating
```

Decision attendue:

- figer l'option courante ou expliciter le critere manquant;
- revenir a `DEFINE` ou `DESIGN` du cycle concerne;
- demander checkpoint humain si la decision ne peut pas etre automatique;
- emettre `LOOP_DETECTED` si le pattern se repete sans evidence de progres.

## Risk-Adjusted Convergence

La convergence doit etre ajustee par la classe T/F/M/E/C.

Plus le risque est eleve, plus:

- le score doit etre echantillonne frequemment;
- les preuves critiques plafonnent le score;
- la tolerance aux gaps diminue;
- la supervision humaine devient structurante;
- les signaux de divergence ont un poids plus fort.

### Matrix De Modulation

| Classe | Sampling minimal | Score de cloture attendu | Gaps acceptables | Bypass |
|---|---|---|---|---|
| T | Final seulement. | Evidence suffisante simple. | Oui si non fonctionnel. | Autorise. |
| F | Par cycle ou gate importante. | Light evidence complete. | Oui si trackes. | Conditionnel. |
| M | Par macro gate. | Evidence standard. | `DONE_WITH_GAPS` possible si gaps non critiques. | Interdit par defaut. |
| E | Par macro gate + evenement de risque. | Evidence renforcee + checkpoint humain. | Gaps residuels E interdits. | Interdit. |
| C | Frequent + visible humain. | Evidence maximale + review independante/humaine. | Gaps critiques interdits. | Interdit. |

### Plafonds De Score

Exemples de plafonds conceptuels:

| Condition | Plafond |
|---|---|
| `risk_class=UNCLASSIFIED` | Pas de convergence cloturable. |
| Evidence conflictuelle | Score plafonne sous la zone de cloture. |
| Checkpoint humain obligatoire absent | Pas de `DONE_VERIFIED`. |
| Signal E/C decouvert mais non promu | Score non fiable; transition bloquee. |
| Runtime capability inconnue pour gate bloquant | Score plafonne jusqu'a discovery runtime. |
| Scope drift non recadre | Score plafonne sous la zone de macro-transition. |

## Interaction Avec Les 3 Modes De Supervision

Les modes ne changent pas la definition de la convergence. Ils changent qui peut
accepter une incertitude, quand un checkpoint est requis, et quelle tolerance au
risque residuel est autorisee.

### `pairing`

En pairing, l'humain est present comme superviseur actif.

Effets:

- les signaux `flat`, `oscillating` et `diverging` sont rendus visibles vite;
- l'humain peut choisir une nouvelle hypothese de progres;
- l'humain peut accepter certains gaps pour T/F/M si le risque residuel est
  documente;
- E/C restent soumis aux preuves obligatoires, meme si l'humain est present;
- la presence humaine ne transforme jamais une evidence conflictuelle en
  evidence verifiee.

Convergence gate:

```text
allow si evidence suffisante pour la classe;
warn si humain accepte un gap non critique;
escalate si le run diverge ou oscille sur une decision structurante.
```

### `auto_decision`

En auto-decision, l'agent pilote le run et l'humain intervient aux gates
critiques.

Effets:

- T/F/M peuvent etre reroutes automatiquement si la nouvelle route est dans le
  scope et la policy;
- M ambigu requiert checkpoint si la convergence depend d'une decision produit,
  securite ou architecture;
- E requiert checkpoint humain aux gates critiques;
- C requiert pairing recommande ou validation humaine explicite avec visibilite
  complete;
- toute promotion vers E/C suspend la poursuite silencieuse.

Convergence gate:

```text
allow si score risk-adjusted suffisant et evidence_status compatible;
reroute si flat avec hypothese nouvelle;
block/escalate si diverging, oscillating structurant, ou evidence conflicted.
```

### `bypass`

En bypass, l'agent avance sans validation humaine active, mais les gates
automatiques restent obligatoires.

Effets:

- autorise seulement pour T et F selon les conditions de risque;
- interdit si `risk_class=UNCLASSIFIED`;
- interdit si signal M/E/C apparait;
- budget d'iteration plus court;
- aucune acceptation implicite de gaps ambigus;
- stagnation rapide devient block ou sortie avec gap explicite si le gap est non
  bloquant.

Convergence gate:

```text
allow seulement si T/F, evidence non conflictuelle, et aucun signal de risque
superieur;
block si ambiguity, divergence, oscillation, promotion pending ou evidence stale.
```

## Transitions De Meta-Region

La region convergence evolue avec les samples:

```text
not_sampled
  -> converging
  -> flat
  -> oscillating
  -> diverging
  -> verified
```

Transitions usuelles:

| From | To | Condition |
|---|---|---|
| `not_sampled` | `converging` | Premier signal positif + evidence initiale. |
| `converging` | `flat` | Pas de hausse utile sur N samples selon risque. |
| `flat` | `converging` | Nouvelle hypothese produit un signal positif. |
| `flat` | `oscillating` | Pattern de retour entre memes options/etats. |
| `converging` | `diverging` | Signal negatif majeur ou accumulation de signaux negatifs. |
| `oscillating` | `converging` | Critere de decision stabilise et preuve nouvelle. |
| `converging` | `verified` | Score risk-adjusted + evidence_status satisfont la stop gate. |
| `diverging` | `flat` | Stop de la degradation, mais pas encore de progres. |

`verified` dans le statut derive ne suffit pas pour `DONE_VERIFIED`: le final
state exige aussi `derived_view.evidence_status=verified`, les guards de cycle, et les
invariants d'etat.

## Interaction Avec Les Guards

`convergence_guard` ne decide jamais seul. Il enrichit la decision de guard:

```text
GuardDecision =
  base_guard
  + risk_overlay
  + supervision_overlay
  + runtime_overlay
  + territory_overlay
  + evidence_overlay
  + convergence_overlay
```

Effets possibles:

| Etat de convergence | Guard decision typique |
|---|---|
| `not_sampled` | warn ou block selon transition. |
| `converging` | allow si autres overlays OK. |
| `flat` | warn, reroute ou block selon risque/mode. |
| `oscillating` | reroute ou escalate. |
| `diverging` | block ou escalate. |
| `verified` | allow final candidate si evidence OK. |

## Final States

| Final state | Relation avec convergence |
|---|---|
| `DONE_VERIFIED` | Requiert convergence verified + derived evidence status verified. |
| `DONE_WITH_GAPS` | Requiert convergence suffisante, gaps explicites, non critiques et owned. |
| `BLOCKED_NEEDS_USER` | Convergence depend d'une decision humaine absente ou refusee. |
| `BLOCKED_RUNTIME_MISSING` | Runtime bloque une preuve ou action necessaire a la convergence. |
| `BLOCKED_POLICY` | La route choisie viole policy ou supervision autorisee. |
| `MAX_ATTEMPTS_REACHED` | Budget atteint sans convergence suffisante ou extension validee. |
| `LOOP_DETECTED` | Oscillation ou repetition sans preuve de progres. |
| `CANCELLED` / `ABORTED` | Cloture hors convergence normale. |

## Invariants

1. `DONE_VERIFIED` interdit `derived_view.convergence_status != verified`.
2. `DONE_VERIFIED` interdit `derived_view.evidence_status != verified`.
3. `DONE_WITH_GAPS` interdit les gaps residuels E/C non traites.
4. `bypass` interdit `risk_class=UNCLASSIFIED`, `M`, `E` et `C`.
5. Une promotion de risque remet la convergence en evaluation: le score
   precedent ne peut pas etre reutilise tel quel.
6. Une evidence stale ou conflicted interdit la cloture verifiee.
7. Une oscillation repetee sans preuve nouvelle doit produire `LOOP_DETECTED`
   ou un checkpoint humain.
8. Une divergence sur territoire, policy, safety ou risk forcing bloque les
   macro-transitions.
9. Une iteration supplementaire doit avoir une hypothese de progres distincte
   de l'iteration precedente.
10. Le max-iteration budget peut etre etendu seulement par une decision tracee,
    avec raison et condition de stop renouvelee.

## Questions A Stabiliser

1. Les seuils numeriques doivent-ils etre globaux ou propres a chaque
   macro-cycle ?
2. Quels signaux doivent etre calcules automatiquement par le runtime, et
   lesquels restent declaratifs dans les evidence sets ?
3. Quelle formule initiale utiliser pour `risk_adjusted_score` sans donner une
   fausse precision ?
4. Combien de samples sont requis pour declarer `flat` par classe T/F/M/E/C ?
5. Faut-il stocker les samples de convergence dans le state snapshot, dans le
   log append-only, ou les deux ?
