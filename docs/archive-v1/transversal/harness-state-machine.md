# Harness State Machine — Document Transversal

> **Statut** : v1.0 — Architecture uniquement, aucune implémentation.
> **Date** : 2026-05-03
> **Portée** : transversale — gouverne l'intégralité de la Pipeline fractale v4.
> **Auteur** : deep-researcher (synthèse multi-sources)

---

## Sommaire

1. Résumé exécutif
2. Portée transversale
3. Objectif du document
4. Entrées (événements et déclencheurs)
5. Sorties (transitions d'état et permissions accordées)
6. Concepts clés
7. Critères qualité (ISO 25010:2023)
8. Modulation par classe de risque
9. Application fractale (state machine à chaque niveau)
10. Activités transversales
11. Artefacts produits
12. Métriques et indicateurs
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations avec chaque cycle

---

## 1. Résumé exécutif

La Pipeline fractale v4 est un système de développement logiciel piloté par un agent IA en mode solo. Son cœur opérationnel est le **harness** — une couche de contrôle externe qui détermine, à chaque instant, ce que l'agent peut lire et écrire, dans quel territoire, et sous quelle condition.

Sans formalisation de ce harness en machine à états, le système reste une boîte noire : son évolution désynchronise l'architecture de fichiers, les frontières d'agent dérivent, et les garanties de contrôle humain se dégradent silencieusement.

Ce document formalise le **harness comme un statechart de Harel** : une machine à états hiérarchique, avec états composites (les 8 cycles), sous-états orthogonaux (le sous-cycle universel à 7 étapes), gardes formels (DoR/DoD, classe de risque), permissions de territoire dérivées de l'état courant, et transitions événementielles traçables dans un log append-only.

**Trois décisions fondatrices issues des rapports de Discovery** :
1. Le harness est en **mono-état strict** (un seul cycle/sprint actif à la fois) — limite assumée, multi-états reporté.
2. Le **bypass est limité aux classes T/L** — interdit pour H/C sans dérogation explicite enregistrée.
3. Les **frontières déclaratives** sont dérivées des contraintes effectives du harness et persistées uniquement dans `.planning/state.yaml` ; aucun fichier de frontières séparé ne fait partie du contrat physique PFV4.

---

## 2. Portée transversale

Ce document couvre **l'intégralité de la pipeline** et non un cycle particulier. Il est transversal parce que :

- La machine à états **précède** le premier cycle et **survit** au dernier.
- Les règles de territoire s'appliquent indépendamment du cycle actif.
- Les modes opératoires (`pairing` / `auto` / `bypass`) sont des configurations de la machine, pas des propriétés d'un cycle.
- Les erreurs, les pauses, les rollbacks, et les promotions de classe de risque sont des événements traités par la machine quel que soit l'état courant.

**Ce document NE couvre PAS** :
- Le contenu métier de chaque cycle (couvert par les documents de cycle individuels).
- L'implémentation technique du harness (fichiers, scripts, hooks — hors périmètre Discovery/Cadrage actuel).
- La gestion multi-projets / multi-repos (reportée explicitement en §5 du rapport Discovery).
- La collaboration multi-développeurs.

---

## 3. Objectif du document

### 3.1 Objectif principal

Fournir le **schéma formel** des états, transitions, gardes, et permissions du harness, de sorte que :
- Tout développeur (ou agent) puisse déterminer, depuis l'état courant, quelles actions sont autorisées.
- Toute évolution du harness soit évaluée contre ce schéma avant implémentation.
- Toute déviation détectée puisse être diagnostiquée par lecture des artefacts seuls.

### 3.2 Objectifs secondaires

- Servir de référence pour la formalisation exécutable de `.planning/state.yaml`.
- Alimenter les sections `history` et `evidence` de `.planning/run-set.json`.
- Constituer la source de vérité pour les règles de territoire dans `docs/01-governance/operating-model.md`.

### 3.3 Ce que ce document résout

Du rapport Discovery (§4.2) : *"Comment formaliser la state machine du harness ? Conséquence d'inaction : le harness reste une boîte noire, son évolution risque de désynchroniser avec l'architecture des fichiers."*

Ce document est la réponse architecturale à cette question ouverte.

---

## 4. Entrées — Événements et déclencheurs

La machine à états est **événementielle** (EDA — Event-Driven Architecture). Elle ne transite pas sur le temps mais sur des événements explicites.

### 4.1 Taxonomie des événements

```
ÉVÉNEMENTS DE CYCLE
├── CYCLE_START          — démarrage d'un nouveau cycle (Discovery, Build, etc.)
├── CYCLE_COMPLETE       — cycle terminé avec DoD vérifiée
├── CYCLE_ABORT          — abandon explicite du cycle
└── CYCLE_SUSPEND        — suspension temporaire (WIP commit, attente externe)

ÉVÉNEMENTS DE SOUS-CYCLE (sous-cycle universel)
├── SUBSTEP_ENTER        — entrée dans une étape (Observer, Define, etc.)
├── SUBSTEP_COMPLETE     — étape terminée
└── SUBSTEP_SKIP         — étape skippée (autorisé sur T/L uniquement)

ÉVÉNEMENTS DE GATE
├── DOR_CHECK            — vérification Definition of Ready
├── DOR_PASS             — DoR satisfaite → transition autorisée
├── DOR_FAIL             — DoR non satisfaite → blocage
├── DOD_CHECK            — vérification Definition of Done
├── DOD_PASS             — DoD satisfaite → cycle fermable
└── DOD_FAIL             — DoD non satisfaite → retour à build ou validation

ÉVÉNEMENTS DE MODE
├── MODE_SET_PAIRING     — passage en mode Pairing
├── MODE_SET_AUTO        — passage en mode auto
├── MODE_SET_BYPASS      — passage en mode Bypass (guard: classe T/L seulement)
└── MODE_OVERRIDE        — dérogation explicite avec enregistrement obligatoire

ÉVÉNEMENTS DE RISQUE
├── RISK_CLASS_SET       — classification initiale T/L/M/H/C
├── RISK_CLASS_PROMOTE   — promotion de classe en cours de cycle (ex: L→H)
└── RISK_CLASS_DEMOTE    — reclassification à la baisse (rare, nécessite justification)

ÉVÉNEMENTS D'ERREUR ET RÉCUPÉRATION
├── ERROR_DETECTED       — erreur détectée (quality gate rouge, invariant violé)
├── ERROR_RECOVERED      — récupération réussie
├── ERROR_UNRECOVERABLE  — erreur irrécupérable → state ABORTED
├── ROLLBACK_REQUEST     — demande de rollback (humain ou gate)
└── ROLLBACK_COMPLETE    — rollback terminé, état stable restauré

ÉVÉNEMENTS HUMAINS
├── HUMAN_VALIDATE       — validation humaine explicite (requis sur H/C)
├── HUMAN_REJECT         — rejet humain → retour à l'état précédent
└── HUMAN_OVERRIDE       — dérogation humaine (enregistrée, time-bound)

ÉVÉNEMENTS SYSTÈME
├── SESSION_START        — démarrage d'une session Claude Code
├── SESSION_END          — fin de session
└── HARNESS_SYNC         — resynchronisation harness ↔ état effectif
```

### 4.2 Sources des événements

| Source | Exemples d'événements générés |
|--------|------------------------------|
| Agent IA | SUBSTEP_COMPLETE, DOR_CHECK, RISK_CLASS_SET |
| Humain (dev) | HUMAN_VALIDATE, HUMAN_REJECT, MODE_SET_*, CYCLE_ABORT |
| CI/CD pipeline | DOD_PASS, DOD_FAIL, ERROR_DETECTED |
| Hooks Claude Code | SESSION_START, SESSION_END, HARNESS_SYNC |
| Horloge / timer | (aucun — la machine ne transite pas sur le temps) |

### 4.3 GateType canoniques

Les points d'interception du harness utilisent exclusivement les GateType suivants : `session_start`, `user_prompt`, `pre_tool`, `post_tool`, `stop`, `subagent_start`, `subagent_stop`.

Ces valeurs sont des tokens de contrat. Elles ne portent aucun préfixe textuel et ne remplacent pas les gardes métier (`dor_satisfied`, `dod_satisfied`, etc.), qui restent des conditions évaluées dans les transitions.

---

## 5. Sorties — Transitions d'état et permissions accordées

### 5.1 Transitions d'état

Chaque transition produit :
1. Un **nouvel état courant** mis à jour dans `.planning/state.yaml`.
2. Une entrée dans la section `history.transitions[]` de `.planning/run-set.json`.
3. Les preuves associées dans la section `evidence[]` de `.planning/run-set.json`.

```json
{
  "ts": "2026-05-03T14:32:00Z",
  "from": "build.Execute",
  "to": "build.Verify",
  "event": "SUBSTEP_COMPLETE",
  "guard_checked": ["dor_pass", "risk_class_m"],
  "mode": "auto",
  "risk_class": "M",
  "triggered_by": "agent",
  "session_id": "sess_abc123"
}
```

### 5.2 Permissions de territoire accordées par état

La sortie principale de la machine est la **matrice de permissions territoire × état courant**. Elle détermine ce que l'agent peut lire (R) ou écrire (W) dans chaque territoire à chaque instant.

```
LÉGENDE : W=write autorisé | R=read autorisé | — = interdit
```

| État harness courant | docs/ | .planning/ | code/ tests/ | history/evidence dans `.planning/run-set.json` |
|---------------------|-------|-----------|-------------|-----------------------------------------------|
| IDLE (entre cycles) | R | R | R | W |
| discovery.Observer | W | W | — | W |
| discovery.Define | W | W | — | W |
| discovery.Design | W | W | — | W |
| discovery.Execute | W | W | R(spike) | W |
| discovery.Verify | R | W | — | W |
| discovery.Capitalize | W | W | — | W |
| discovery.Transmit | W | R | — | W |
| cadrage.* | W | W | — | W |
| conception.* | W | W | R(lecture) | W |
| build.Observer | W | W | R | W |
| build.Define | W | W | R | W |
| build.Design | W | W | R | W |
| build.Execute | — | W | W | W |
| build.Verify | — | W | R | W |
| build.Capitalize | W | W | R | W |
| build.Transmit | W | R | R | W |
| validation.* | — | W | R | W |
| release.* | — | W | R | W |
| run.* | R | W | R | W |
| learning.* | W | W | — | W |
| ERROR | R | W | — | W |
| SUSPENDED | R | R | R | W |
| ABORTED | R | R(lecture) | — | W |

**Note critique** : les frontières de permission sont un contenu de `.planning/state.yaml`, pas un fichier séparé. Toute modification doit passer par une transition tracée dans `.planning/run-set.json`.

### 5.3 Règle de permission par défaut

> **Deny-by-default** : tout ce qui n'est pas explicitement W dans la matrice est interdit en écriture. L'agent ne peut pas inférer une permission non listée.

---

## 6. Concepts clés

### 6.1 État (State)

Un état harness est la combinaison de :
- **Cycle actif** : l'un des 8 cycles de la pipeline fractale.
- **Sous-étape active** : l'une des 7 étapes du sous-cycle universel.
- **Mode opératoire** : `pairing` | `auto` | `bypass`.
- **Classe de risque** : T | L | M | H | C.

La notation complète d'un état est : `CYCLE.Sous-étape [mode, classe]`

Exemples :
- `build.Execute [auto, M]`
- `validation.Verify [pairing, H]`
- `discovery.Observer [bypass, T]`

### 6.2 Transition

Une transition est le passage d'un état source à un état cible, déclenché par un événement, conditionnel à un ou plusieurs gardes. Formellement :

```
transition(état_source, événement, [gardes], état_cible, [actions])
```

Les transitions sont **déterministes** : depuis le même état, le même événement avec les mêmes gardes produit toujours le même état cible.

### 6.3 Garde (Guard)

Un garde est une condition booléenne évaluée **avant** la transition. Si le garde est faux, la transition est bloquée. Les gardes sont :
- **Purs** : pas d'I/O, pas d'effets de bord.
- **Rapides** : évaluation synchrone, résultat immédiat.
- **Déterministes** : même entrée → même résultat.

Gardes principaux du harness :

```yaml
# Gardes de transition inter-cycle
dor_satisfied:
  description: "Tous les critères DoR sont cochés pour l'item actif"
  checked_at: [cadrage→conception, conception→build]

dod_satisfied:
  description: "Tous les critères DoD sont cochés pour le cycle actif"
  checked_at: [build→validation, validation→release]

human_validation_obtained:
  description: "Une validation humaine explicite a été enregistrée"
  required_when: [risk_class IN [H, C]]

# Gardes de classe de risque
bypass_allowed:
  description: "Le bypass est autorisé pour la classe de risque actuelle"
  condition: "risk_class IN [T, L]"
  # Jamais vrai pour M, H, C

critical_path_clear:
  description: "Aucun quality gate rouge sur le chemin critique"
  evaluated_by: CI/CD

# Gardes de territoire
territory_write_authorized:
  description: "L'écriture dans le territoire cible est autorisée pour l'état courant"
  source: matrice §5.2

# Gardes de promotion
risk_promotion_acknowledged:
  description: "La promotion de classe a été enregistrée et le cycle a été repriorisé"
  required_when: RISK_CLASS_PROMOTE event
```

### 6.4 Territoire

Un territoire est un espace de fichiers avec des droits d'accès homogènes, dérivés de l'état harness courant.

| Territoire | Rôle | Modifié par |
|-----------|------|-------------|
| `docs/` | Vérité actuelle du produit | Agent (selon état) + Humain toujours |
| `.planning/` | Pilotage et mémoire d'exécution | Agent (selon état) + Humain toujours |
| `code/ tests/ infra/` | Implémentation | Agent en `build.Execute` seulement |
| `.planning/run-set.json#history` | Historique append-only des transitions et décisions | Agent (append) + Humain (lecture) |
| `.planning/run-set.json#evidence` | Preuves de vérification, validations, contrôles et overrides | Agent (append) + Humain (lecture) |

### 6.5 Permission

Une permission est la combinaison d'un territoire, d'une opération (R/W), et d'un état harness. Elle est **dérivée** de la matrice §5.2 — elle n'est jamais stockée indépendamment pour éviter la désynchronisation.

### 6.6 Contrôle inter-cycle

Un contrôle inter-cycle est un point de décision entre deux cycles consécutifs. Il est implémenté comme un garde composite qui doit être intégralement satisfait avant toute transition inter-cycle. Contrairement aux validations humaines classiques (validation par un comité), ces contrôles du harness sont **automatisés et bloquants** — une dérogation requiert un `HUMAN_OVERRIDE` explicitement enregistré dans `.planning/run-set.json#evidence`.

```
Contrôle cadrage → conception :
  ✓ dor_satisfied
  ✓ risk_class_defined
  ✓ human_validation_obtained (si risk_class IN [H, C])

Contrôle build → validation :
  ✓ dod_satisfied (partiel : code + tests verts)
  ✓ critical_path_clear
  ✓ no_open_critical_risk

Contrôle validation → release :
  ✓ dod_satisfied (complet)
  ✓ human_validation_obtained (toujours requis)
  ✓ rollback_plan_tested (si risk_class IN [H, C])
```

---

## 7. Critères qualité (ISO 25010:2023)

### 7.1 Caractéristiques prioritaires pour le harness

La machine à états est un composant d'infrastructure interne. Les caractéristiques ISO 25010:2023 pertinentes, par ordre de priorité :

| Caractéristique | Sous-caractéristique | Exigence concrète | Seuil |
|----------------|---------------------|-------------------|-------|
| **Fiabilité** | Faultlessness | La machine ne doit jamais rester dans un état indéterminé | 0 état indéterminé admis |
| **Fiabilité** | Availability | L'état courant doit être lisible à tout moment depuis `.planning/` | < 1s de lecture |
| **Maintenabilité** | Analysability | L'état courant + l'historique doivent permettre le diagnostic post-incident | Log complet sur 90 jours |
| **Maintenabilité** | Modifiability | Ajouter un nouveau cycle ou sous-état ne doit pas casser les transitions existantes | Tests de régression passants |
| **Sécurité** | Integrity | Un agent ne peut jamais écrire dans un territoire non autorisé par l'état courant | 0 violation de territoire admise |
| **Sécurité** | Accountability | Chaque transition est tracée avec acteur, horodatage, et contexte | 100% des transitions loguées |
| **Safety** *(nouveau 2023)* | Operational constraint | Le bypass sur H/C est structurellement impossible, pas seulement interdit | Enforce par garde, non par convention |
| **Flexibilité** | Adaptability | La machine doit supporter l'ajout de nouveaux modes sans refonte | Extension par configuration |

### 7.2 Caractéristiques dépriorisées

- **Performance efficiency** : non critique (la machine est du contrôle, pas du hot path).
- **Interaction capability** : hors périmètre (pas d'UI directe).
- **Compatibility** : mono-projet, mono-repo.

---

## 8. Modulation par classe de risque

La classe de risque T/L/M/H/C est le **pivot central** de la machine à états. Elle configure simultanément :
1. La profondeur du sous-cycle (étapes obligatoires vs skippables).
2. Le mode opératoire autorisé (bypass impossible sur H/C).
3. Les gardes de gate (validation humaine obligatoire sur H/C).
4. Les permissions de territoire (plus restrictives sur H/C).
5. Les artefacts obligatoires (ADR, threat model, rollback plan).

### 8.1 Tableau de modulation

| Dimension | T (Trivial) | L (Low) | M (Moyen) | H (High) | C (Critique) |
|-----------|:-----------:|:----------:|:---------:|:---------:|:------------:|
| Bypass autorisé | Oui | Oui | Non | Non | Non |
| Mode auto-décision | Oui | Oui | Oui | Oui | Non |
| Validation humaine inter-cycle | — | — | Recommandée | Obligatoire | Obligatoire |
| DoR formelle | Allégée | Standard | Standard | Stricte | Stricte + |
| DoD formelle | Allégée | Standard | Standard | Stricte | Stricte + |
| Sous-étapes skippables | Toutes sauf Execute | Observer optionnel | Aucune | Aucune | Aucune |
| ADR obligatoire | — | — | Si décision arch. | Oui | Oui |
| Threat model | — | — | Recommandé | Obligatoire | Obligatoire |
| Plan de rollback | Implicite | Oui | Oui | Oui + testé | Oui + répété |
| Historique de transitions | Allégé | Standard | Standard | Complet | Complet + audit |
| Contrôle de sortie cycle | Automatique | Auto + spot-check | Auto + review | Humain requis | Humain + pair review |

### 8.2 Promotion de classe en cours de cycle

La **promotion de classe** est l'événement `RISK_CLASS_PROMOTE`. Elle déclenche un protocole spécifique :

```
Détection →
  1. RISK_CLASS_PROMOTE enregistré (qui, quand, justification)
  2. CYCLE_SUSPEND automatique
  3. Re-vérification DoR avec la nouvelle classe
  4. Si nouvelle classe H/C : HUMAN_VALIDATE requis avant reprise
  5. Ajout au log avec métadonnées de promotion
  6. Reprise avec les règles de la nouvelle classe appliquées rétroactivement
     aux étapes déjà complétées (re-audit, pas re-exécution)
```

**Anti-pattern** : laisser la promotion de classe sans traçabilité. Une promotion silencieuse est un bug de processus.

---

## 9. Application fractale — La machine à états à chaque niveau

### 9.1 Principe fractal

La même discipline s'applique à deux niveaux imbriqués :

```
Niveau 1 — MACRO-FSM (inter-cycles)
  IDLE → discovery → cadrage → conception → build → validation
       → release → run → learning → IDLE

Niveau 2 — MICRO-FSM (intra-cycle, le sous-cycle universel)
  Pour chaque cycle actif :
  .Observer → .Define → .Design → .Execute
             → .Verify → .Capitalize → .Transmit
```

### 9.2 Macro-FSM — Diagramme d'états des 8 cycles

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                  HARNESS STATE MACHINE                  │
                    │                                                         │
         ┌──────────▼──────────┐                                             │
   ●───▶ │        IDLE         │ ◀────── SESSION_END (tout état)             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_START + dor_check_pass                           │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │     discovery       │ ──── CYCLE_ABORT ──▶ IDLE                   │
         │  [micro-fsm actif]  │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + control(discovery→cadrage)            │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │      cadrage        │ ──── CYCLE_ABORT ──▶ IDLE                   │
         │  [micro-fsm actif]  │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + control(cadrage→conception)           │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │     conception      │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + control(conception→build)             │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │       build         │ ◀── ROLLBACK_COMPLETE (depuis validation)   │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + control(build→validation)             │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │     validation      │ ──── DOD_FAIL ──▶ build                     │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + control(validation→release)           │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │       release       │ ──── ERROR_DETECTED ──▶ ERROR               │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE                                         │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │        run          │ ──── ERROR_DETECTED ──▶ ERROR               │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE                                         │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │      learning       │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE                                         │
                    └──────────────────────────────────────────────────────▶│
                                                               IDLE (bouclage)│
                    ┌───────────────────────────────────────────────────────▼┤
              ●───▶ │   ERROR (état transversal, activable depuis tout état)  │
                    │   SUSPENDED (état transversal)                          │
                    │   ABORTED (état terminal)                               │
                    └─────────────────────────────────────────────────────────┘
```

### 9.3 Micro-FSM — Le sous-cycle universel (intra-cycle)

Le sous-cycle est le même pour **chaque cycle actif**, avec modulation par classe de risque :

```
                       ┌─────────────────────────────────────────┐
                       │    MICRO-FSM (intra-cycle universel)     │
                       │                                         │
              ●───▶ [Observer] ──SUBSTEP_COMPLETE──▶ [Define]   │
                       │                                │         │
              SUBSTEP_SKIP (T/L)                 SUBSTEP_COMPLETE │
                       │                                ▼         │
                       │                         [Design]      │
                       │                                │         │
                       │                         SUBSTEP_COMPLETE │
                       │                                ▼         │
                       │                         [Execute] ◀─────┼─ point pivot :
                       │                                │         │   territoire code/
                       │                         SUBSTEP_COMPLETE │   ouvert ici seulement
                       │                                ▼         │   (en build)
                       │                         [Verify]       │
                       │                                │         │
                       │                         SUBSTEP_COMPLETE │
                       │                                ▼         │
                       │                         [Capitalize]    │
                       │                                │         │
                       │                         SUBSTEP_COMPLETE │
                       │                                ▼         │
                       └──────────────────────▶ [Transmit] ───▶ CYCLE_COMPLETE
                                                                  │
                    └─────────────────────────────────────────────┘
```

**Règle de skippage** :
- T : toutes les étapes sauf Execute sont skippables (traversée en quelques secondes).
- L : Observer est optionnel ; les autres suivent l'ordre.
- M, H, C : aucun skip autorisé.

### 9.4 États transversaux (activables depuis tout état)

Trois états sont **orthogonaux** au cycle courant — ils peuvent être activés depuis n'importe quel état :

```yaml
ERROR:
  description: "Erreur détectée nécessitant attention"
  triggers: [quality_gate_rouge, invariant_violé, territoire_violation]
  sub-états:
    RECOVERABLE: "agent peut corriger seul (max 3 tentatives)"
    ESCALATED: "humain requis"
  exit_events: [ERROR_RECOVERED → reprend état précédent, ERROR_UNRECOVERABLE → ABORTED]
  territory_permissions: docs/ R, .planning/ W (logs seulement), code/ —

SUSPENDED:
  description: "Pipeline en pause volontaire"
  triggers: [CYCLE_SUSPEND, SESSION_END sur cycle actif]
  exit_events: [SESSION_START → reprend depuis last_known_state]
  territory_permissions: tous R, aucun W
  persistence: état sauvegardé dans `.planning/state.yaml`, transition tracée dans `.planning/run-set.json#history`

ABORTED:
  description: "État terminal, cycle abandonné"
  triggers: [ERROR_UNRECOVERABLE, HUMAN_REJECT (3x consécutifs), CYCLE_ABORT]
  exit_events: [SESSION_START → nouvel état IDLE uniquement]
  territory_permissions: tous R, `.planning/run-set.json#history` W (append audit)
  required_artifact: entrée `abort_report` dans `.planning/run-set.json#evidence`
```

---

## 10. Activités transversales

Ces activités ne sont pas des cycles : elles opèrent **dans tous les états** de la machine.

### 10.1 Surveillance de territoire (Territory Watch)

La machine maintient en continu une assertion sur le territoire courant :

```
À chaque action d'écriture de l'agent :
  1. Lire l'état courant depuis `.planning/state.yaml`
  2. Verify la matrice §5.2 pour le territoire cible
  3. Si W autorisé → action permise
  4. Si W interdit → action bloquée + ERROR_DETECTED
  5. Ajouter l'action (autorisée ou bloquée) dans `.planning/run-set.json#history`
```

**Invariant absolu** : un agent ne peut pas contourner la matrice en "oubliant" de vérifier l'état. La vérification est préalable à toute écriture.

### 10.2 Synchronisation état déclaré ↔ état effectif

L'événement `HARNESS_SYNC` est déclenché :
- À chaque `SESSION_START`.
- Après toute modification validée de `.planning/state.yaml`.
- En réponse à une anomalie détectée.

Le sync vérifie que les permissions déclaratives dans `.planning/state.yaml` sont **cohérentes** avec la matrice §5.2 pour l'état courant. En cas d'incohérence, l'état le plus restrictif prévaut (fail-safe) et l'anomalie est tracée dans `.planning/run-set.json#evidence`.

### 10.3 Gestion du mode opératoire

Le mode est une **configuration de la machine**, pas un état. Il est orthogonal à l'état cycle × sous-étape.

```
MODE pairing :
  → L'agent propose, le développeur valide chaque substep
  → Aucun SUBSTEP_COMPLETE sans ACK humain explicite
  → Disponible pour toutes classes de risque

MODE auto (défaut) :
  → L'agent exécute de façon autonome avec visibilité complète
  → Le développeur valide aux contrôles inter-cycles quand la classe ou la policy l'exige
  → SUBSTEP_COMPLETE autonome (sauf H/C inter-cycle)
  → Disponible pour T/L/M/H ; disponible pour C seulement avec visibilité totale et validation humaine explicite
  → Garde-fous : format de proposition obligatoire, quota de rejets ≥ 20%

MODE bypass :
  → L'agent exécute sans validation inter-étape
  → GUARD STRICT : bypass_allowed = true uniquement si risk_class IN [T, L]
  → Si risk_class = M et bypass demandé : HUMAN_OVERRIDE requis + enregistrement
  → Si risk_class IN [H, C] : bypass structurellement impossible (non overridable)
```

### 10.4 Traçabilité et économie de tokens

Conformément à la décision §3.8 du rapport Discovery : l'agent écrit dans `.planning/` **ce qui est nécessaire à la prochaine décision**, pas tout ce qui serait théoriquement traçable.

Règle opérationnelle :
- **`.planning/state.yaml`** : état courant strict, sans historique long.
- **`.planning/current-risk.yaml`** : classe de risque courante et justification active.
- **`.planning/run-set.json`** : sections `history`, `evidence`, `decisions`, `quality`, `abort_reports` et `risk_promotions` ; append-only logique, tous les événements utiles, no exception.
- **Quality controls** : toujours évalués, résultats ajoutés à `run-set.json#evidence`, pas forcément documentés en prose.

---

## 11. Artefacts produits

### 11.1 Artefacts permanents (existent pour toute la durée de vie du projet)

| Artefact | Chemin | Format | Mis à jour par |
|---------|--------|--------|---------------|
| État courant | `.planning/state.yaml` | YAML | Agent à chaque transition |
| Risque courant | `.planning/current-risk.yaml` | YAML | Agent à chaque reclassification |
| Run set | `.planning/run-set.json` | JSON | Agent append logique pour history/evidence/decisions |
| Modèle de la state machine | `docs/transversal/harness-state-machine.md` | Markdown | Humain (ce document) |

### 11.2 Structure de `.planning/state.yaml`

```yaml
# .planning/state.yaml
# Mis à jour à chaque transition — source de vérité de l'état courant
version: "1"
updated_at: "2026-05-03T14:32:00Z"
session_id: "sess_abc123"

macro_state: "build"           # discovery|cadrage|conception|build|validation|release|run|learning|IDLE|ERROR|SUSPENDED|ABORTED
micro_state: "Execute"        # une des 7 sous-étapes (ou null si IDLE/ERROR/ABORTED)
mode: "auto"                   # pairing | auto | bypass

active_item_ref: ".planning/02-backlog/items/PBI-042.md"
active_cycle_start: "2026-05-03T09:00:00Z"
controls_passed: ["dor_satisfied"]
controls_pending: ["dod_satisfied", "human_validation"]

last_transition:
  from: "build.Design"
  to: "build.Execute"
  event: "SUBSTEP_COMPLETE"
  ts: "2026-05-03T14:32:00Z"
  triggered_by: "agent"

error_state: null              # null | RECOVERABLE | ESCALATED
suspend_reason: null           # null | raison de suspension
```

### 11.3 Structure de `.planning/current-risk.yaml`

```yaml
# .planning/current-risk.yaml
version: "1"
updated_at: "2026-05-03T14:32:00Z"
item_ref: ".planning/02-backlog/items/PBI-042.md"
risk_class: "M"                # T | L | M | H | C
justification: "Feature visible utilisateur, service unique, aucun signal de forçage H/C"
forced_minimum: null
validated_by: "developer"
```

### 11.4 Structure de `.planning/run-set.json`

```json
{
  "version": "1",
  "run_id": "run_20260503_143200",
  "history": {
    "transitions": [
      {
        "ts": "2026-05-03T14:32:00Z",
        "session": "sess_abc123",
        "from": "build.Design",
        "to": "build.Execute",
        "event": "SUBSTEP_COMPLETE",
        "guards": {"dor_satisfied": true, "bypass_allowed": false},
        "mode": "auto",
        "risk_class": "M",
        "triggered_by": "agent",
        "item": "PBI-042"
      }
    ]
  },
  "evidence": [],
  "decisions": [],
  "quality": [],
  "abort_reports": [],
  "risk_promotions": []
}
```

### 11.5 Entrée d'abort (produite à chaque ABORTED)

```json
{
  "cycle_aborted": "build",
  "substep_at_abort": "Execute",
  "risk_class": "M",
  "event_trigger": "HUMAN_REJECT (3x)",
  "item_ref": ".planning/02-backlog/items/PBI-042.md",
  "abort_ts": "2026-05-03T16:45:00Z",
  "session_id": "sess_abc123",
  "last_stable_state": "cadrage.Transmit",
  "human_action_required": "Reclassifier PBI-042 ou respecifier les critères d'acceptation"
}
```

---

## 12. Métriques et indicateurs

### 12.1 Métriques de santé de la machine à états

| Métrique | Description | Cible | Alerte si |
|---------|-------------|-------|-----------|
| `sm.transitions.total` | Nombre de transitions loguées par session | — | Chute à 0 (machine bloquée) |
| `sm.territory.violations` | Tentatives d'écriture hors matrice | 0 | > 0 (invariant brisé) |
| `sm.control.fail_rate` | Taux de contrôles bloquants / total contrôles | < 10% | > 25% (DoR/DoD insuffisantes) |
| `sm.error.escalation_rate` | Taux d'erreurs escaladées à l'humain | < 5% | > 15% |
| `sm.bypass.override_count` | Nombre de HUMAN_OVERRIDE sur bypass M | 0 visé | > 2/mois |
| `sm.risk.promotion_rate` | Taux de promotions de classe en cours de cycle | < 10% | > 20% (classification initiale insuffisante) |
| `sm.suspend.duration_avg` | Durée moyenne en état SUSPENDED | < 24h | > 72h (cycle abandonné en pratique) |
| `sm.cycle.completion_rate` | % de cycles terminés sans abort | > 85% | < 70% |

### 12.2 Corrélation avec les métriques DORA

La machine à états alimente directement les métriques DORA 2024 :

- **Change Lead Time** : temps entre `discovery.Observer` et `release.Transmit`.
- **Deployment Frequency** : nombre de `release.CYCLE_COMPLETE` par période.
- **Failed Deployment Recovery Time** : temps entre `ERROR_DETECTED` (en `release`/`run`) et `ERROR_RECOVERED`.
- **Change Failure Rate** : ratio (`release→ERROR`) / (`release→run`).
- **Rework Rate** : nombre de `ROLLBACK_REQUEST` / total transitions `build`.

### 12.3 Log des promotions de classe (anti-pattern tracker)

Chaque `RISK_CLASS_PROMOTE` est un signal d'amélioration de la classification initiale. Analyser mensuellement :
- Quelle classe initiale → quelle classe finale (ex: L→M le plus fréquent ?).
- Quel cycle déclenche le plus de promotions (`build`, `conception`, `validation` ?).
- Quelle catégorie de PBI est systématiquement sous-classifiée.

---

## 13. Standards de référence

| Standard | Application au harness state machine | Source |
|---------|--------------------------------------|--------|
| **Harel Statecharts (1987)** | Hiérarchie d'états (macro-fsm + micro-fsm imbriqués), états orthogonaux, transitions événementielles | Harel, "Statecharts: A Visual Formalism for Complex Systems", Science of Computer Programming, 1987 |
| **UML State Machine (OMG)** | Notation formelle des gardes `[condition]`, actions d'entrée/sortie, pseudo-états (initial ●, history ⊙) | UML 2.5.1 Specification, Object Management Group |
| **XState v5 (Stately)** | Pattern Actor, persistance d'état, receptionist pattern pour états distribués | stately.ai/docs/xstate |
| **ISO/IEC 25010:2023** | Fiabilité, Maintenabilité, Sécurité, Safety comme critères qualité du harness | iso.org |
| **Bell-LaPadula model** | Inspiration pour la matrice de permissions territoire × état (deny-by-default, no write down) | Bell & LaPadula, 1973 ; CISSP reference |
| **Phase-Gate Process (Cooper)** | Structure DoR/DoD comme gardes de transition inter-cycles | Stage-Gate International, R.G. Cooper |
| **Temporal.io durable execution** | Pattern pause/resume, event history append-only, replay déterministe | temporal.io/blog |
| **LangGraph (LangChain)** | State machine pour agents IA en production, checkpointing, gestion des erreurs | langchain.com/langgraph |
| **DORA 2024/2025** | 5 métriques corrélées aux transitions de la state machine | dora.dev |
| **Event Sourcing (Fowler)** | Log JSONL append-only comme source de vérité reconstituable | martinfowler.com/eaaDev/EventSourcing.html |
| **Symfony Workflow Component** | Configuration YAML de state machines, guard conditions, transitions nommées | symfony.com/doc/current/workflow.html |

---

## 14. Décisions closes et suivis résiduels (RED CARDS)

Les anciennes RED CARDS répondues par les specs PFV4 sont closes ici. Les points encore incomplets sont demoted en suivis d'implémentation, pas en questions d'architecture ouvertes.

### RED CARD 1 — Mécanisation de la classification de risque (CLOSE)

**Statut** : CLOSE — répondu par `docs/conception/02-risk-classifier-spec.md` et résumé dans `docs/transversal/risk-classification.md`.

**Décision** : le harness consomme `RiskClass = T/L/M/H/C` depuis `.planning/current-risk.yaml`. La classe est produite par un arbre déterministe à 4 passes, avec signaux de forçage H/C et score composite impact × probabilité.

**Effet sur la machine** : `bypass_allowed`, la profondeur du sous-cycle et les validations humaines sont évaluables sans décision subjective implicite.

---

### RED CARD 2 — Transition vers le multi-états (SUIVI REPORTÉ)

**Question** : comment passer du mono-état strict actuel au multi-états par objet (chaque PBI/sprint/release a son propre état) ?

**Impact sur la machine** : nécessite une refonte de la macro-FSM pour devenir un ensemble de machines parallèles (orthogonal regions au sens Harel). La matrice de permissions §5.2 devra être étendue pour gérer des territoires partagés entre plusieurs états actifs simultanément.

**Condition préalable** : stabilisation et validation du mono-état sur au moins 2 cycles complets.

**Statut** : reporté explicitement (§4.7 rapport Discovery, §3.7 décision). Non bloquant pour le contrat mono-état PFV4.

---

### RED CARD 3 — Enforcement effectif vs déclaratif (SUIVI D'IMPLÉMENTATION)

**Question** : comment le harness fait-il respecter la matrice §5.2 de façon effective, et non seulement déclarative ?

**Impact sur la machine** : l'hypothèse H5 du rapport Discovery pose la question : *"L'agent IA respecte les frontières du harness. Risque : un mode jailbreak involontaire (interprétation créative d'une contrainte)."*

**Pistes** : GateType `pre_tool` qui vérifie `.planning/state.yaml` avant chaque écriture, GateType `post_tool` qui ajoute l'évidence dans `.planning/run-set.json`, test de régression territoire quotidien.

**Statut** : suivi d'implémentation critique ; le contrat d'artefacts est désormais défini.

---

### RED CARD 4 — Modèle de capacité et arbitrage du backlog (SUIVI PRODUIT)

**Question** : quand le backlog dépasse la capacité, quel mécanisme d'arbitrage utilise la machine pour décider quel cycle démarrer ?

**Impact sur la machine** : état IDLE est actuellement défini comme "entre cycles". Si plusieurs PBI sont prêts, l'état IDLE ne peut pas décider seul — il faut un mécanisme d'arbitrage.

**Pistes** : score de priorité (impact × risque × coût), capacité en tokens LLM, modèle de coût par classe (§4.5 rapport Discovery).

**Statut** : suivi produit, basse priorité immédiate. Ne bloque pas la state machine mono-item.

---

### RED CARD 5 — Définition formelle des DoR/DoD par cycle (SUIVI)

**Question résiduelle** : les gardes `dor_satisfied` et `dod_satisfied` sont binaires, mais les critères varient par cycle. Où sont-ils définis formellement ?

**Impact sur la machine** : sans définition formelle par cycle et par classe de risque, les gardes sont non évaluables de façon déterministe.

**Pistes** : fichiers `docs/01-governance/dor-{cycle}.md` et `docs/01-governance/dod-{cycle}.md` avec checklists versionées, référencées depuis `.planning/state.yaml`.

**Statut** : suivi ouvert, bloquant pour l'implémentation complète des contrôles.

---

## 15. Relations avec chaque cycle

### 15.1 discovery

**Rôle de la machine** : premier cycle actif après IDLE. La machine passe de IDLE à `discovery` sur `CYCLE_START`.

**Permissions spécifiques** : docs/ W (note de discovery, opportunity solution tree), .planning/ W, code/ fermé sauf en sous-étape Execute pour les spikes timeboxés (T/L uniquement).

**Contrôle de sortie** : `dor_satisfied` = problème validé (≥ 5 sources ou équivalent quantitatif), solution hypothèse falsifiable, taille estimée à l'ordre de grandeur.

**Mode typique** : `auto` ou `pairing` selon disponibilité du développeur.

---

### 15.2 cadrage

**Rôle de la machine** : transforme l'opportunité validée en engagement. La machine vérifie que le DoR de `cadrage` est satisfait avant d'entrer dans le cycle.

**Permissions spécifiques** : docs/ W (charter, one-pager), .planning/ W (backlog initial), code/ fermé.

**Contrôle de sortie** : vision validée + performance budget négocié + classification de risque globale décidée. Sur H/C : `human_validation_obtained`.

**Événement clé** : `RISK_CLASS_SET` — c'est ici que la classification initiale est formalisée et entre dans la machine.

---

### 15.3 conception

**Rôle de la machine** : plans techniques et ADR. Lecture du code autorisée (analyse), écriture interdite.

**Permissions spécifiques** : docs/ W (ADR, threat model, design doc), .planning/ W, code/ R (lecture pour analyse).

**Contrôle de sortie** : ADR signés + threat model (si M+) + AIPD (si requis) + DoD de conception vérifiée.

**Interaction mode** : si risk_class H/C et mode auto → obligation de proposer avant d'écrire l'ADR (format : problème, alternatives, choix, critère de succès).

---

### 15.4 build

**Rôle de la machine** : seul cycle où code/ est W. La sous-étape Execute est le **seul état de toute la machine** où l'agent peut écrire dans le code.

**Permissions spécifiques** : code/ W en `build.Execute` uniquement. Toutes autres sous-étapes : code/ R.

**Contrôle de sortie** : tests verts + quality controls CI verts + `dod_satisfied` (partiel).

**Cas error** : `ERROR_DETECTED` sur quality gate rouge → état ERROR.RECOVERABLE → max 3 tentatives → escalade si non résolu.

**Point d'attention** : la restriction code/ W à la seule sous-étape Execute est la contrainte la plus forte du harness. Elle prévient les modifications de code non intentionnelles pendant l'analyse, la conception, ou la vérification.

---

### 15.5 validation

**Rôle de la machine** : vérification que le DoD est pleinement satisfait. Code en lecture seulement.

**Permissions spécifiques** : .planning/ W (résultats de test, qualité), code/ R.

**Contrôle de sortie** : `dod_satisfied` complet + `human_validation_obtained` (toujours requis ici, indépendamment de la classe).

**Transition vers build** : si `DOD_FAIL` → `ROLLBACK_REQUEST` → retour en `build.Verify` (pas en IDLE).

---

### 15.6 release

**Rôle de la machine** : déploiement progressif. La machine surveille activement les SLO pendant cet état — c'est le seul état où `ERROR_DETECTED` est automatiquement généré sur burn rate SLO.

**Permissions spécifiques** : .planning/ W (release checklist, déploiement evidence), code/ R.

**Contrôle de sortie** : smoke tests verts + SLO stables + rollback plan testé (H/C).

**Transition d'urgence** : ERROR_DETECTED → ROLLBACK_REQUEST → code en R seulement pendant le rollback → ERROR_RECOVERED → `run`.

---

### 15.7 run

**Rôle de la machine** : surveillance continue post-release. Boucle OODA implicite.

**Permissions spécifiques** : docs/ R, .planning/ W (métriques, SLO, postmortem si incident), code/ R.

**Contrôle de sortie** : après la durée d'observation définie (proportionnelle à la classe de risque), signal pour `learning`.

**Interaction avec learning** : les signaux de `run` (incidents, régression SLO, feedback utilisateur) sont la matière première de `learning`. La machine trace ces signaux dans `.planning/run-set.json`.

---

### 15.8 learning

**Rôle de la machine** : rétrospective + postmortem + mise à jour des patterns. Alimente le prochain cycle Discovery.

**Permissions spécifiques** : docs/ W (rétro, postmortem, patterns appris), .planning/ W (retrospective sprint, quality retro), code/ fermé.

**Contrôle de sortie** : ≤ 3 actions concrètes avec owner + éventuelles promotions de règles dans `.planning/state.yaml` (via transition humaine tracée).

**Transition vers IDLE** : `CYCLE_COMPLETE` → IDLE. Le prochain `CYCLE_START` peut démarrer directement en `discovery` ou `cadrage` selon la nature du prochain PBI.

**Cas d'apprentissage structurel** : si la rétro identifie une faille dans la machine elle-même (ex: garde insuffisant, matrice de permissions trop restrictive) → `HARNESS_SYNC` + mise à jour de `.planning/state.yaml` + `docs/transversal/harness-state-machine.md`, avec trace dans `.planning/run-set.json`.

---

## Annexe A — Transitions nominales complètes (catalogue)

```
T001: IDLE --CYCLE_START--> discovery.Observer
      guard: dor_check_initiated

T002: discovery.Observer --SUBSTEP_COMPLETE--> discovery.Define
      guard: substep_output_exists

T003: discovery.* --SUBSTEP_COMPLETE (séquence)--> discovery.Transmit
      [séquence T002 à T007 pour chaque sous-étape]

T008: discovery.Transmit --CYCLE_COMPLETE--> cadrage.Observer
      guard: dor_satisfied, risk_class_defined
      guard (H/C only): human_validation_obtained

T009–T014: cadrage.* --séquence sous-cycle-->
T015: cadrage.Transmit --CYCLE_COMPLETE--> conception.Observer
      guard: vision_validated, perf_budget_set

T016–T021: conception.*
T022: conception.Transmit --CYCLE_COMPLETE--> build.Observer
      guard: adr_signed, dod_conception_satisfied

T023–T028: build.*
T029: build.Execute --spécifique--> territoire code/ W ouvert
T030: build.Transmit --CYCLE_COMPLETE--> validation.Observer
      guard: tests_green, ci_controls_green

T031–T036: validation.*
T037: validation.Transmit --CYCLE_COMPLETE--> release.Observer
      guard: dod_satisfied_full, human_validation_obtained
      guard (H/C): rollback_plan_tested

T038–T043: release.*
T044: release.Transmit --CYCLE_COMPLETE--> run.Observer

T045–T050: run.*
T051: run.Transmit --CYCLE_COMPLETE--> learning.Observer

T052–T057: learning.*
T058: learning.Transmit --CYCLE_COMPLETE--> IDLE

# Transitions d'erreur (depuis tout état)
E001: ANY --ERROR_DETECTED--> ERROR.RECOVERABLE
E002: ERROR.RECOVERABLE --ERROR_RECOVERED--> last_state (restauré)
E003: ERROR.RECOVERABLE (tentative 3) --ERROR_UNRECOVERABLE--> ABORTED
E004: ERROR.RECOVERABLE --HUMAN_VALIDATE--> ERROR.ESCALATED --résolution--> last_state

# Transitions de rollback
R001: validation.* --DOD_FAIL--> ROLLBACK_REQUEST --> build.Verify
R002: release.* --ROLLBACK_REQUEST--> build.Verify (avec état pré-release restauré)

# Transitions de mode (depuis tout état, sauf ABORTED)
M001: ANY --MODE_SET_PAIRING--> même état, mode=pairing
M002: ANY --MODE_SET_AUTO--> même état, mode=auto
M003: ANY --MODE_SET_BYPASS--> même état, mode=bypass
      guard: bypass_allowed (risk_class IN [T, L])
      ou: HUMAN_OVERRIDE enregistré (risk_class = M seulement)

# Suspension / reprise
S001: ANY --CYCLE_SUSPEND--> SUSPENDED (état courant sauvegardé)
S002: SUSPENDED --SESSION_START--> état sauvegardé restauré
S003: SUSPENDED --CYCLE_ABORT--> ABORTED
```

---

## Annexe B — Anti-patterns à éviter

1. **Écrire dans code/ hors de `build.Execute`** : l'anti-pattern le plus critique. Même en "lecture d'abord puis écriture rapide", la règle est absolue.

2. **Modifier les frontières effectives sans transition tracée** : les permissions déclarées dans `.planning/state.yaml` doivent évoluer par événement contrôlé. Une modification directe non tracée court-circuite le contrôle humain fondamental.

3. **Laisser une promotion de classe sans trace** : si une promotion L→H est identifiée et non enregistrée, tous les gardes qui suivent s'appliquent à la mauvaise classe.

4. **Bypasser sur M/H/C par fatigue** : le guard `bypass_allowed` est structurel. Tenter de le contourner via HUMAN_OVERRIDE répété est un signal que le cycle est mal dimensionné.

5. **État SUSPENDED > 72h sans intention explicite** : une suspension longue sans journal d'intention est équivalente à un abandon silencieux. Passer explicitement en ABORTED si le cycle ne reprend pas.

6. **Transitions sans log** : même les transitions triviales (T, micro-fsm) doivent être loguées. Le log est la seule mémoire de la machine — un trou dans le log est un trou dans la traçabilité.

7. **Initialiser `.planning/state.yaml` manuellement sans événement** : l'état ne doit évoluer que par événements tracés dans `.planning/run-set.json`. Une modification directe sans entrée d'historique crée une incohérence entre l'état affiché et l'état réel.

8. **Define DoR/DoD dans la tête** : les gardes `dor_satisfied` et `dod_satisfied` doivent référencer des checklists explicites dans `docs/01-governance/`. Un garde non documenté est non évaluable de façon déterministe.

---

*Document de référence — à versionner dans `docs/transversal/harness-state-machine.md`. Toute évolution doit passer par une mise à jour humaine explicite (Main Thread uniquement, per rules/core.md §7).*
