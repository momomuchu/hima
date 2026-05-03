# 00 - Repartition Du Travail

Statut: plan de travail actif

## Objectif

Repartir la conception de la state machine Pipeline Fractale V4 en objets
distincts, pour eviter un draft monolithique et permettre une analyse plus
profonde de chaque weakness.

## Lanes

| Lane | Fichier | Ownership | Question principale |
|---|---|---|---|
| L0 | `README.md` | Integration | Quelle est la surface de travail et comment lire la proposition V2 ? |
| L1 | `01-state-model.md` | Integration | Quel est l'objet d'etat canonique, sans FSM plate ni `null` implicite ? |
| L2 | `02-cycle-specific-substates.md` | Integration | Quels substates propres a chaque macro-cycle remplacent les substates generiques ? |
| L3 | `03-meta-states-and-modes.md` | Integration | Comment representer modes, activation developpement et meta-regions exhaustives ? |
| L4 | `04-guard-matrix.md` | Integration | Comment les guards dependent de cycle, risque, mode, runtime, evidence et convergence ? |
| L5 | `05-convergence-model.md` | Subagent convergence | Comment prouver que le run converge, au lieu de compter seulement des iterations ? |
| L6 | `06-open-decisions.md` | Subagent decisions | Quelles decisions restent a trancher avant implementation ? |
| L7 | `07-architecture-critique.md` | Subagent architecture | Quelles corrections architecturales restent necessaires ? |
| L8 | `08-transition-catalog.md` | Subagent transitions | Quelles transitions concretes existent avec les substates specifiques ? |
| L9 | `09-validation-checklist.md` | Subagent verification | Comment valider la coherence de la conception avant implementation ? |
| L10 | `10-critical-review.md` | Subagent critique | Quelles contradictions ou hypotheses faibles restent dans la proposition ? |

## Regles De Coordination

1. Un fichier = un owner principal.
2. Les agents ne doivent pas modifier les fichiers hors ownership.
3. Les corrections transversales passent par Integration.
4. Les substates generiques `Cycle.Observer` / `Cycle.Executer` ne doivent plus
   etre utilises comme etats stockes.
5. Les 7 etapes fractales restent une lens commune, pas une liste obligatoire de
   substates identiques.
6. Toute assertion de final state doit passer par Evidence Set et convergence.
7. Les cas non-developpement doivent etre couverts par `run_kind` et
   `pipeline_activation`.
8. Les modes `pairing`, `auto_decision`, `bypass` sont orthogonaux a l'etat, mais
   changent les guards.

## Definition De Done Pour Cette Proposition

La proposition V2 est utilisable pour discussion quand:

- chaque macro-cycle a ses substates propres;
- les meta-regions couvrent les situations non nominales principales;
- les guards sont derives d'une matrice, pas de booleens vagues;
- la convergence est formalisee;
- les decisions ouvertes sont explicites;
- la validation checklist peut detecter les incoherences avant implementation;
- les termes obscurs sont expliques ou evites.

