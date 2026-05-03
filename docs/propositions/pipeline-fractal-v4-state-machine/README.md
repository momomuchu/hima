# Pipeline Fractale V4 State Machine - Proposition V2

Statut: draft de conception, remplace le draft monolithique V1 comme surface de
travail. Pas encore implementation-ready: les decisions P0 de
`06-open-decisions.md` doivent etre tranchees avant registre executable.

## Pourquoi Cette V2 Existe

Le draft V1 a correctement pose l'idee d'un RMS au-dessus des runtimes, mais il
a trop aplati la machine d'etat:

- les 8 macro-cycles avaient les memes substates;
- les meta-states etaient trop pauvres;
- les 3 modes de supervision n'etaient pas assez structurants;
- la convergence etait reduite a un max d'iterations;
- les guards n'etaient pas explicitement derivees de la matrice de risque;
- les cas non-developpement etaient mal representes;
- les champs `null` rendaient l'etat moins lisible.

Cette V2 corrige cela en separant les objets de conception.

## Decision De Conception Centrale

Les 7 etapes fractales:

```text
Observer -> Definir -> Concevoir -> Executer -> Verifier -> Capitaliser -> Transmettre
```

ne doivent pas etre les substates stockes de chaque cycle.

Elles sont une grammaire commune, ou une lens d'analyse.

Chaque macro-cycle doit avoir ses propres substates semantiques.

Exemple:

```text
BUILD.implementation_slice
```

peut etre mappe a la lens:

```text
primary_lens = EXECUTE
```

mais l'etat stocke reste specifique au cycle Build.

## Documents Dans Ce Dossier

| Fichier | Role |
|---|---|
| `00-work-breakdown.md` | Repartition active du travail et ownership des lanes. |
| `01-state-model.md` | Modele d'etat corrige: pas de FSM plate, pas de `null`, prise en compte des runs non-dev. |
| `02-cycle-specific-substates.md` | Substates propres a chaque macro-cycle, avec mapping vers la lens fractale. |
| `03-meta-states-and-modes.md` | Meta-states plus exhaustifs, modes de supervision, activation du mode developpement. |
| `04-guard-matrix.md` | Guards derivees de cycle + substate + risque + mode + runtime + evidence. |
| `05-convergence-model.md` | Modele de convergence: score, signaux, stagnation, divergence, max iteration comme fusible seulement. |
| `06-open-decisions.md` | Decisions ouvertes a trancher avant implementation. |
| `07-architecture-critique.md` | Critique architecturale dediee. |
| `08-transition-catalog.md` | Catalogue de transitions avec substates specifiques. |
| `09-validation-checklist.md` | Checklist de validation de coherence avant implementation. |
| `10-critical-review.md` | Revue critique des contradictions et hypotheses faibles. |

## Glossaire Minimal

| Terme | Definition |
|---|---|
| Machine a etats | Systeme qui sait dans quel etat il est, quels evenements peuvent le faire changer d'etat, et quelles conditions doivent etre vraies pour changer. |
| FSM | Abreviation anglaise de "Finite State Machine". A eviter dans les docs utilisateur si possible. |
| Macro-cycle | Un des 8 grands cycles: Discovery, Cadrage, Conception, Build, Validation, Release, Run, Apprentissage. |
| Substate | Etat interne propre a un macro-cycle. Il doit etre semantique, pas seulement "Observer" ou "Executer". |
| Fractal lens | Mapping commun vers les 7 etapes fractales. Sert a garder l'auto-similarite sans forcer les memes substates partout. |
| T/F/M/E/C | Classes de risque: Trivial, Faible, Moyen, Eleve, Critique. |
| Guard | Condition qui autorise ou bloque une transition. |
| Gate | Point de controle qui produit une decision: allow, warn, block, escalate. |
| Meta-state | Etat orthogonal qui decrit la situation du run: bloque, degrade, en convergence, en attente humaine, etc. |
| Convergence | Preuve que le run se rapproche du but, au lieu de simplement consommer des iterations. |

## Relation Avec Le Draft V1

Le fichier parent `../pipeline-fractal-v4-state-machine-v1-draft.md` reste comme
trace historique, mais la presente proposition V2 doit etre utilisee pour la
suite de la conception.
