# Proposition V1 - State Machine Spec Pour Pipeline Fractale V4

Statut: draft de conception

Langue: francais de travail. Une version canonique anglaise pourra etre
produite apres stabilisation.

Sources de depart:

- `docs/transversal/harness-state-machine.md`
- `docs/conception/01-state-machine-spec.md`
- `docs/conception/03-rms-sets-schema.md`
- `docs/conception/04-runtime-bindings-spec.md`
- `docs/conception/05-gates-policy-spec.md`
- `docs/transversal/risk-classification.md`
- `docs/sub-cycle-fractal/seven-steps.md`

## Intention

Cette proposition reformule la state machine de la Pipeline Fractale v4 comme
un objet pilotable par le RMS.

Le but n'est pas d'ajouter une deuxieme spec concurrente a
`01-state-machine-spec.md`. Le but est de rendre le tableau de conception plus
lisible:

- quels axes d'etat existent vraiment
- quels axes doivent etre stockes separement
- quels gates autorisent les transitions
- quels artefacts prouvent chaque passage
- quelles decisions restent ouvertes avant implementation

## Position De Conception

La machine ne doit pas etre implementee comme un enorme graphe plat de 56 etats
plus toutes les variantes de risque, mode, runtime et erreur.

Elle doit etre modelisee comme un etat compose:

```text
PipelineState =
  MacroCycle
  + MicroStep
  + RiskClass
  + OperatingMode
  + MetaState
  + RuntimeExecution
  + EvidenceStatus
```

Les 56 etats `8 cycles x 7 sous-etapes` restent utiles pour raisonner, mais ils
ne doivent pas exploser en cartesian product dans l'implementation.

Le RMS doit stocker les axes separement et deriver les permissions, gates et
obligations a partir de ces axes.

## Tableau 1 - Axes D'Etat Canoniques

| Axe | Valeurs | Set RMS proprietaire | Persistance | Raison |
|---|---|---|---|---|
| MacroCycle | `IDLE`, `DISCOVERY`, `CADRAGE`, `CONCEPTION`, `BUILD`, `VALIDATION`, `RELEASE`, `RUN`, `APPRENTISSAGE` | Run Set | snapshot + events | Situe le run dans les 8 cycles. |
| MicroStep | `Observer`, `Definir`, `Concevoir`, `Executer`, `Verifier`, `Capitaliser`, `Transmettre` | Run Set | snapshot + events | Applique la discipline fractale dans chaque cycle. |
| RiskClass | `T`, `F`, `M`, `E`, `C` | Policy Set + Route Set | snapshot + decisions | Module profondeur, gates, bypass et validation humaine. |
| OperatingMode | `pairing`, `auto_decision`, `bypass` | Route Set | snapshot + decisions | Definit le degre d'autonomie autorise. |
| MetaState | `none`, `ERROR_RECOVERABLE`, `ERROR_ESCALATED`, `SUSPENDED`, `ABORTED` | Run Set | snapshot + events | Permet pause, erreur, escalation, abort sans perdre l'etat precedent. |
| RuntimeExecution | runtime actif, capability set, binding set, agents actifs, locks | Runtime Capability Set + Runtime Binding Set + Run Set | snapshot + events | Evite de supposer que Claude, Codex et Hermes ont les memes primitives. |
| EvidenceStatus | `missing`, `partial`, `sufficient`, `with_gaps`, `verified` | Evidence Set | evidence + events | Determine si `DONE_VERIFIED` est autorise. |
| TerritoryState | zones lisibles/ecrites/interdites | Policy Set + Run Set | snapshot + events | Fait respecter les frontieres selon cycle et micro-step. |

### Consequence

Le vrai etat courant n'est pas seulement:

```text
BUILD.Executer
```

mais plutot:

```text
macro=BUILD
micro=Executer
risk=M
mode=auto_decision
meta=none
runtime=codex
territory=code_write_allowed
evidence=partial
```

Cette forme est plus stable pour le RMS, les hooks, les skills et les subagents.

## Tableau 2 - Macro-Cycles Et Gates De Sortie

| Cycle | Role | Entree minimale | Gate de sortie | Artefacts attendus | Territoire principal |
|---|---|---|---|---|---|
| `DISCOVERY` | Comprendre probleme, opportunite, contexte | Intent Set initialise | probleme clarifie, opportunite qualifiee, risque propose | note discovery, hypotheses, signaux utilisateur | `docs/`, `.planning/` |
| `CADRAGE` | Transformer opportunite en item cadrable | discovery output | DoR satisfaite, risque officiel, scope/non-scope explicites | backlog item, DoR, acceptance criteria, risk class | `docs/`, `.planning/` |
| `CONCEPTION` | Choisir architecture et contraintes | cadrage valide | design choisi, ADR si necessaire, gates definis | design note, ADR, threat model si requis | `docs/`, `.planning/` |
| `BUILD` | Modifier le produit ou le harness | conception valide | tests/lint/build cibles verts, diff coherent | code, tests, migration, logs build | `code/`, tests, `.planning/` |
| `VALIDATION` | Prouver que le resultat satisfait le besoin | build vert | DoD produit/harness satisfaite, evidence suffisante | test report, review, acceptance, screenshots si UI | produit, tests, `.planning/` |
| `RELEASE` | Preparer ou effectuer promotion | validation ok | smoke tests, rollback/feature flag selon risque | release notes, rollback plan, deployment proof | infra/release docs |
| `RUN` | Observer effet reel ou fonctionnement | release faite ou simulation run | SLO/stability/incident check | telemetry, incident log, health evidence | observability, logs |
| `APPRENTISSAGE` | Capitaliser et corriger le systeme | run evidence | learnings ecrits, policies ajustees si besoin | retro, calibration risk, improvements | `docs/`, `.planning/`, registry si ADR |

### Decision V1

Chaque macro-cycle peut etre traverse rapidement pour `T/F`, mais il doit
laisser au moins un evenement trace. Le bypass reduit la profondeur, il ne rend
pas le cycle invisible.

## Tableau 3 - Micro-Steps Universelles

| MicroStep | Question | Actions typiques | Evidence minimale | Skip possible |
|---|---|---|---|---|
| `Observer` | Qu'est-ce qui est vrai maintenant ? | lire docs/code/logs, inspecter runtime, collecter signaux | observation ou reference d'input | `T/F` selon contexte |
| `Definir` | Quel probleme ou sous-objectif exact ? | reformuler, fixer scope, classifier risque | objectif local + risk class si non definie | `T` seulement si deja trivial |
| `Concevoir` | Quelle route/solution/gate ? | choisir mode, runtime, design, tests, policy | Route Set ou mini-design | `T/F` si route evidente |
| `Executer` | Quelle action transforme l'etat ? | edit, run command, delegate, call MCP | event d'execution + output | jamais si le cycle demande une action |
| `Verifier` | Comment sait-on que c'est correct ? | tests, lint, review, compare evidence | verdict explicite | jamais pour `M/E/C` |
| `Capitaliser` | Qu'est-ce qu'on doit retenir ? | update evidence, decisions, metrics, lessons | decision/evidence entry | `T` possible mais tracee |
| `Transmettre` | Que faut-il remettre au cycle suivant ? | synthese, handoff, final state candidate | handoff ou completion record | non si transition macro |

### Regle V1

Le micro-step `Executer` ne veut pas toujours dire "modifier du code". Il veut
dire "faire l'action qui change l'etat du cycle".

Exemples:

- en `DISCOVERY.Executer`, l'action peut etre une recherche ou un entretien
- en `CONCEPTION.Executer`, l'action peut etre produire un ADR
- en `BUILD.Executer`, l'action peut etre modifier le code
- en `VALIDATION.Executer`, l'action peut etre lancer les tests
- en `APPRENTISSAGE.Executer`, l'action peut etre ajuster une policy

## Tableau 4 - Transitions Nominales

| ID | From | To | Event | Guards minimales | Evidence produite |
|---|---|---|---|---|---|
| `T001` | `IDLE` | `DISCOVERY.Observer` | `CYCLE_START` | Intent Set cree ou source explicite | `INTENT_CAPTURED` |
| `T008` | `DISCOVERY.Transmettre` | `CADRAGE.Observer` | `CYCLE_COMPLETE` | probleme clarifie, risque propose | discovery handoff |
| `T015` | `CADRAGE.Transmettre` | `CONCEPTION.Observer` | `CYCLE_COMPLETE` | DoR satisfaite, risk class officielle | backlog/cadrage record |
| `T022` | `CONCEPTION.Transmettre` | `BUILD.Observer` | `CYCLE_COMPLETE` | route valide, design/gates suffisants | Route Set + design evidence |
| `T030` | `BUILD.Transmettre` | `VALIDATION.Observer` | `CYCLE_COMPLETE` | build evidence presente, pas de violation policy | diff summary + test/lint first pass |
| `T037` | `VALIDATION.Transmettre` | `RELEASE.Observer` | `CYCLE_COMPLETE` | DoD satisfaite, Evidence Set suffisant | validation report |
| `T044` | `RELEASE.Transmettre` | `RUN.Observer` | `CYCLE_COMPLETE` | release/simulation proof | release evidence |
| `T051` | `RUN.Transmettre` | `APPRENTISSAGE.Observer` | `CYCLE_COMPLETE` | run/health evidence ou explicit no-run reason | run report |
| `T058` | `APPRENTISSAGE.Transmettre` | `IDLE` | `CYCLE_COMPLETE` | learnings persisted, final state decided | final state + decisions |

## Tableau 5 - Transitions Transversales

| Type | Event | Effet | Guard | Sortie attendue |
|---|---|---|---|---|
| Error | `ERROR_DETECTED` | active `ERROR_RECOVERABLE` | violation ou gate rouge | event + attempt count |
| Recovery | `ERROR_RECOVERED` | reprend `last_stable_state` | evidence de correction | recovery evidence |
| Escalation | `ERROR_ESCALATED` | bloque en attente humaine | `E/C`, policy block, ou 3 warnings | escalation record |
| Abort | `CYCLE_ABORT` | final `CANCELLED` ou `ABORTED` | humain ou unrecoverable | abort report |
| Suspend | `CYCLE_SUSPEND` | active `SUSPENDED` | session pause ou volontaire | saved state |
| Resume | `SESSION_START` | reprend depuis snapshot | snapshot valide | resume event |
| Risk promote | `RISK_CLASS_PROMOTE` | suspend puis reprend avec risk augmente | signal de forcage | promotion decision |
| Mode change | `MODE_SET_*` | change mode sans changer cycle | policy autorise | mode decision |
| Rollback | `DOD_FAIL` / `ROLLBACK_REQUEST` | revient vers `BUILD.Verifier` ou checkpoint | rollback possible | rollback event |

## Tableau 6 - Gates A Rendre Deterministes

| Gate | Question | Input principal | Output | Hard-block quand |
|---|---|---|---|---|
| `risk_classification` | Quelle classe T/F/M/E/C ? | Intent, touched areas, file paths, data sensitivity | risk class + rationale | classe absente pour `M+` |
| `dor` | Peut-on entrer dans le cycle suivant ? | cycle output, policy, risk | pass/warn/block | DoR manquante pour transition macro |
| `dod` | Le cycle courant est-il termine ? | evidence, tests, review, acceptance | pass/warn/block | Evidence insuffisante |
| `territory` | L'action est-elle autorisee ici ? | macro, micro, tool, path, mode | allow/deny | write hors territoire |
| `runtime_capability` | Le runtime peut-il executer la route ? | Capability Set + Binding Set | pass/degrade/block | primitive requise absente sans fallback |
| `stop` | Peut-on conclure ? | Evidence Set + final state candidate | allow/block | `DONE_VERIFIED` sans preuve |
| `subagent_result` | Le resultat enfant est-il utilisable ? | output subagent, task owner, evidence | accept/reject | resultat non trace ou hors scope |

## Tableau 7 - Mapping Vers Les Sets RMS

| Machine concern | Set RMS | Pourquoi |
|---|---|---|
| `macro`, `micro`, `meta`, attempts, active tasks | Run Set | Etat vivant et frequent. |
| risk class et bypass rules | Policy Set + Route Set | La policy definit, la route applique. |
| runtime actif et primitives disponibles | Runtime Capability Set | Evite les hypotheses sur Codex/Claude/Hermes. |
| mapping gate -> hook/skill/subagent/MCP | Runtime Binding Set | Portabilite runtime. |
| decisions de passage, alternatives rejetees | Route Set + decisions log | Replay et audit. |
| tests, logs, reviews, screenshots, subagent outputs | Evidence Set | Autorise ou refuse final state. |
| vision, standards, architecture stable | Project Set | Contexte durable, pas state vivant. |

## Invariants Non-Negociables

1. Un run actif a toujours un `macro` et un `micro`, sauf `IDLE` et final states.
2. Une transition macro ne passe jamais sans event append-only.
3. `E/C` interdit le bypass automatique.
4. `DONE_VERIFIED` exige un Evidence Set suffisant pour la classe de risque.
5. Un hook ou gate ne doit jamais supposer une primitive runtime non declaree dans Capability Set.
6. Un subagent ne modifie pas la machine directement; il retourne un resultat que le RMS accepte ou rejette.
7. `Run Set` est un snapshot pratique; `events.jsonl` garde l'historique.
8. Les ecritures sont derivees de `macro + micro + territory + policy`, pas du prompt seul.
9. Toute promotion de risque produit une decision explicite.
10. Le multi-state reste interdit tant que le mono-state n'a pas ete valide sur des cycles complets.

## Ce Que Je Changerais Par Rapport A La Spec Actuelle

La spec `01-state-machine-spec.md` est deja tres avancee. Mais pour une
implementation robuste, je proposerais ces ajustements de conception:

| Sujet | Spec actuelle | Proposition V1 |
|---|---|---|
| Etat composite | enumere 56 etats utiles conceptuellement | stocker `macro` + `micro` + overlays separes |
| Event sourcing | parle de reconstruction complete depuis log | garder snapshot autoritatif + log append-only; event sourcing complet plus tard |
| Runtime | peu central dans la machine principale | ajouter `RuntimeExecution` comme axe explicite |
| Evidence | final states mentionnes | faire de `EvidenceStatus` un axe et une gate `stop` bloquante |
| Risk promotion | transition presente | en faire une suspension explicite avec decision record |
| Territory | documente dans transversal | le rendre calculable depuis `macro + micro + policy` |
| Multi-state | chemin defini | maintenir comme non-objectif V1 avec precondition stricte |

## Decisions Ouvertes A Resoudre Avant Implementation

| ID | Decision | Pourquoi c'est important | Proposition initiale |
|---|---|---|---|
| `D-SM-01` | Source canonique de l'etat courant | eviter `.planning` vs `.rms` incoherents | `.rms/runs/<run-id>/run-set.json` pour RMS; `.planning/state/` comme vue compatible si necessaire |
| `D-SM-02` | Format des states | lisibilite vs validation machine | JSON pour RMS sets, YAML seulement pour fichiers humains |
| `D-SM-03` | DoR/DoD par cycle | guards non evaluables sans criteria | fichiers declaratifs par cycle + risk class |
| `D-SM-04` | Risk classifier | conditionne bypass et profondeur | arbre deterministe + signaux de forcage |
| `D-SM-05` | Enforcement runtime | declaratif ne suffit pas | gates RMS + bindings runtime + fallback block |
| `D-SM-06` | Evidence minimum par classe | eviter faux done | matrice Evidence Set par T/F/M/E/C |
| `D-SM-07` | Rollback semantics | RELEASE/RUN peuvent casser | checkpoint explicite + rollback evidence |
| `D-SM-08` | English canonicalization | docs mixtes FR/EN | garder drafts FR, produire spec canonique EN apres decisions |

## MVP De La State Machine

Le MVP ne doit pas essayer de couvrir toute la richesse de la Pipeline V4.

Il doit prouver ce noyau:

```text
Intent Set
  -> risk classification
  -> Route Set
  -> macro/micro execution
  -> gates
  -> Evidence Set
  -> final state
```

MVP propose:

1. stocker `macro`, `micro`, `risk`, `mode`, `meta`, `runtime`, `evidence_status`
2. implementer les transitions nominales `T001` a `T058`
3. implementer les micro transitions `Observer -> ... -> Transmettre`
4. implementer `ERROR_RECOVERABLE`, `SUSPENDED`, `CANCELLED`
5. bloquer `DONE_VERIFIED` sans Evidence Set minimal
6. tracer chaque transition dans `events.jsonl`
7. interdire multi-state et parallel cycles en V1

## Table De Travail Pour La Suite

| Priorite | Travail de conception | Sortie attendue |
|---|---|---|
| P0 | Valider les axes d'etat | liste canonique des champs du Run Set |
| P0 | Valider les final states | enum finale + conditions |
| P0 | Definir DoR/DoD par cycle | matrice cycle x risk class |
| P0 | Definir risk classifier | arbre de decision initial |
| P1 | Definir territory matrix | paths/actions autorises par macro/micro |
| P1 | Definir event schema | `events.jsonl` minimal |
| P1 | Definir binding runtime | mapping Codex/Claude/Hermes pour gates |
| P2 | Definir rollback/checkpoints | strategie Build/Validation/Release |
| P2 | Preparer spec anglaise | version canonique apres arbitrage |

## Conclusion V1

La Pipeline Fractale v4 ne doit pas etre vue comme une seule machine geante.

Elle doit etre vue comme:

```text
une macro-FSM
+ une micro-FSM reutilisee dans chaque cycle
+ des overlays de gouvernance
+ des bindings runtime
+ une evidence gate finale
```

C'est cette decomposition qui permet de garder la complexite controlable tout en
respectant l'ambition fractale du systeme.

