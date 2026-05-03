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
2. Le **bypass est limité aux classes T/F** — interdit pour É/C sans dérogation explicite enregistrée.
3. Les **frontières déclaratives** (`boundaries.yaml`) sont doublées par les **contraintes effectives** du harness — les deux niveaux doivent rester synchronisés.

---

## 2. Portée transversale

Ce document couvre **l'intégralité de la pipeline** et non un cycle particulier. Il est transversal parce que :

- La machine à états **précède** le premier cycle et **survit** au dernier.
- Les règles de territoire s'appliquent indépendamment du cycle actif.
- Les modes opératoires (Pairing / Auto-décision / Bypass) sont des configurations de la machine, pas des propriétés d'un cycle.
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

- Servir de référence pour la formalisation exécutable `.planning/agent/state-machine.yaml`.
- Alimenter le log de transitions `logs/state-transitions.jsonl`.
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
├── SUBSTEP_ENTER        — entrée dans une étape (Observer, Définir, etc.)
├── SUBSTEP_COMPLETE     — étape terminée
└── SUBSTEP_SKIP         — étape skippée (autorisé sur T/F uniquement)

ÉVÉNEMENTS DE GATE
├── DOR_CHECK            — vérification Definition of Ready
├── DOR_PASS             — DoR satisfaite → transition autorisée
├── DOR_FAIL             — DoR non satisfaite → blocage
├── DOD_CHECK            — vérification Definition of Done
├── DOD_PASS             — DoD satisfaite → cycle fermable
└── DOD_FAIL             — DoD non satisfaite → retour à BUILD ou VALIDATION

ÉVÉNEMENTS DE MODE
├── MODE_SET_PAIRING     — passage en mode Pairing
├── MODE_SET_AUTO        — passage en mode Auto-décision
├── MODE_SET_BYPASS      — passage en mode Bypass (guard: classe T/F seulement)
└── MODE_OVERRIDE        — dérogation explicite avec enregistrement obligatoire

ÉVÉNEMENTS DE RISQUE
├── RISK_CLASS_SET       — classification initiale T/F/M/É/C
├── RISK_CLASS_PROMOTE   — promotion de classe en cours de cycle (ex: F→É)
└── RISK_CLASS_DEMOTE    — reclassification à la baisse (rare, nécessite justification)

ÉVÉNEMENTS D'ERREUR ET RÉCUPÉRATION
├── ERROR_DETECTED       — erreur détectée (quality gate rouge, invariant violé)
├── ERROR_RECOVERED      — récupération réussie
├── ERROR_UNRECOVERABLE  — erreur irrécupérable → state ABORTED
├── ROLLBACK_REQUEST     — demande de rollback (humain ou gate)
└── ROLLBACK_COMPLETE    — rollback terminé, état stable restauré

ÉVÉNEMENTS HUMAINS
├── HUMAN_VALIDATE       — validation humaine explicite (requis sur É/C)
├── HUMAN_REJECT         — rejet humain → retour à l'état précédent
└── HUMAN_OVERRIDE       — dérogation humaine (enregistrée, time-bound)

ÉVÉNEMENTS SYSTÈME
├── SESSION_START        — démarrage d'une session Claude Code
├── SESSION_END          — fin de session
└── HARNESS_SYNC         — resynchronisation harness ↔ boundaries.yaml
```

### 4.2 Sources des événements

| Source | Exemples d'événements générés |
|--------|------------------------------|
| Agent IA | SUBSTEP_COMPLETE, DOR_CHECK, RISK_CLASS_SET |
| Humain (dev) | HUMAN_VALIDATE, HUMAN_REJECT, MODE_SET_*, CYCLE_ABORT |
| CI/CD pipeline | DOD_PASS, DOD_FAIL, ERROR_DETECTED |
| Hooks Claude Code | SESSION_START, SESSION_END, HARNESS_SYNC |
| Horloge / timer | (aucun — la machine ne transite pas sur le temps) |

---

## 5. Sorties — Transitions d'état et permissions accordées

### 5.1 Transitions d'état

Chaque transition produit :
1. Un **nouvel état courant** (mis à jour dans `.planning/agent/current-state.yaml`).
2. Une **entrée JSONL** dans `logs/state-transitions.jsonl` avec la forme :

```json
{
  "ts": "2026-05-03T14:32:00Z",
  "from": "BUILD.Exécuter",
  "to": "BUILD.Vérifier",
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

| État harness courant | docs/ | .planning/ | code/ tests/ | logs/ | boundaries.yaml |
|---------------------|-------|-----------|-------------|-------|-----------------|
| IDLE (entre cycles) | R | R | R | R | R |
| DISCOVERY.Observer | W | W | — | W | R |
| DISCOVERY.Définir | W | W | — | W | R |
| DISCOVERY.Concevoir | W | W | — | W | R |
| DISCOVERY.Exécuter | W | W | R(spike) | W | R |
| DISCOVERY.Vérifier | R | W | — | W | R |
| DISCOVERY.Capitaliser | W | W | — | W | R |
| DISCOVERY.Transmettre | W | R | — | W | R |
| CADRAGE.* | W | W | — | W | R |
| CONCEPTION.* | W | W | R(lecture) | W | R |
| BUILD.Observer | W | W | R | W | R |
| BUILD.Définir | W | W | R | W | R |
| BUILD.Concevoir | W | W | R | W | R |
| BUILD.Exécuter | — | W | W | W | R |
| BUILD.Vérifier | — | W | R | W | R |
| BUILD.Capitaliser | W | W | R | W | R |
| BUILD.Transmettre | W | R | R | W | R |
| VALIDATION.* | — | W | R | W | R |
| RELEASE.* | — | W | R | W | R |
| RUN.* | R | W | R | W | R |
| APPRENTISSAGE.* | W | W | — | W | R |
| ERROR | R | W(logs) | — | W | R |
| SUSPENDED | R | R | R | R | R |
| ABORTED | R | R(lecture) | — | W | R |

**Note critique** : `boundaries.yaml` est en lecture seule pour l'agent dans TOUS les états. Seul le développeur (main thread) peut le modifier.

### 5.3 Règle de permission par défaut

> **Deny-by-default** : tout ce qui n'est pas explicitement W dans la matrice est interdit en écriture. L'agent ne peut pas inférer une permission non listée.

---

## 6. Concepts clés

### 6.1 État (State)

Un état harness est la combinaison de :
- **Cycle actif** : l'un des 8 cycles de la pipeline fractale.
- **Sous-étape active** : l'une des 7 étapes du sous-cycle universel.
- **Mode opératoire** : Pairing | Auto-décision | Bypass.
- **Classe de risque** : T | F | M | É | C.

La notation complète d'un état est : `CYCLE.Sous-étape [mode, classe]`

Exemples :
- `BUILD.Exécuter [auto, M]`
- `VALIDATION.Vérifier [pairing, É]`
- `DISCOVERY.Observer [bypass, T]`

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
# Gardes de phase gate
dor_satisfied:
  description: "Tous les critères DoR sont cochés pour l'item actif"
  checked_at: [CADRAGE→CONCEPTION, CONCEPTION→BUILD]

dod_satisfied:
  description: "Tous les critères DoD sont cochés pour le cycle actif"
  checked_at: [BUILD→VALIDATION, VALIDATION→RELEASE]

human_validation_obtained:
  description: "Une validation humaine explicite a été enregistrée"
  required_when: [risk_class IN [É, C]]

# Gardes de classe de risque
bypass_allowed:
  description: "Le bypass est autorisé pour la classe de risque actuelle"
  condition: "risk_class IN [T, F]"
  # Jamais vrai pour M, É, C

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
| `code/ tests/ infra/` | Implémentation | Agent en BUILD.Exécuter seulement |
| `logs/` | Trace append-only | Agent (append) + Humain (lecture) |
| `boundaries.yaml` | Frontières déclaratives | Humain seulement (jamais l'agent) |

### 6.5 Permission

Une permission est la combinaison d'un territoire, d'une opération (R/W), et d'un état harness. Elle est **dérivée** de la matrice §5.2 — elle n'est jamais stockée indépendamment pour éviter la désynchronisation.

### 6.6 Gate de phase (Phase Gate)

Un gate de phase est un point de contrôle entre deux cycles consécutifs. Il est implémenté comme un garde composite qui doit être intégralement satisfait avant toute transition inter-cycle. Contrairement aux gates humains classiques (validation par un comité), les gates du harness sont **automatisés et bloquants** — une dérogation requiert un `HUMAN_OVERRIDE` explicitement enregistré.

```
Gate CADRAGE → CONCEPTION :
  ✓ dor_satisfied
  ✓ risk_class_defined
  ✓ human_validation_obtained (si risk_class IN [É, C])

Gate BUILD → VALIDATION :
  ✓ dod_satisfied (partiel : code + tests verts)
  ✓ critical_path_clear
  ✓ no_open_critical_risk

Gate VALIDATION → RELEASE :
  ✓ dod_satisfied (complet)
  ✓ human_validation_obtained (toujours requis)
  ✓ rollback_plan_tested (si risk_class IN [É, C])
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
| **Safety** *(nouveau 2023)* | Operational constraint | Le bypass sur É/C est structurellement impossible, pas seulement interdit | Enforce par garde, non par convention |
| **Flexibilité** | Adaptability | La machine doit supporter l'ajout de nouveaux modes sans refonte | Extension par configuration |

### 7.2 Caractéristiques dépriorisées

- **Performance efficiency** : non critique (la machine est du contrôle, pas du hot path).
- **Interaction capability** : hors périmètre (pas d'UI directe).
- **Compatibility** : mono-projet, mono-repo.

---

## 8. Modulation par classe de risque

La classe de risque T/F/M/É/C est le **pivot central** de la machine à états. Elle configure simultanément :
1. La profondeur du sous-cycle (étapes obligatoires vs skippables).
2. Le mode opératoire autorisé (bypass impossible sur É/C).
3. Les gardes de gate (validation humaine obligatoire sur É/C).
4. Les permissions de territoire (plus restrictives sur É/C).
5. Les artefacts obligatoires (ADR, threat model, rollback plan).

### 8.1 Tableau de modulation

| Dimension | T (Trivial) | F (Faible) | M (Moyen) | É (Élevé) | C (Critique) |
|-----------|:-----------:|:----------:|:---------:|:---------:|:------------:|
| Bypass autorisé | Oui | Oui | Non | Non | Non |
| Mode auto-décision | Oui | Oui | Oui | Oui | Non |
| Validation humaine inter-cycle | — | — | Recommandée | Obligatoire | Obligatoire |
| DoR formelle | Allégée | Standard | Standard | Stricte | Stricte + |
| DoD formelle | Allégée | Standard | Standard | Stricte | Stricte + |
| Sous-étapes skippables | Toutes sauf Exécuter | Observer optionnel | Aucune | Aucune | Aucune |
| ADR obligatoire | — | — | Si décision arch. | Oui | Oui |
| Threat model | — | — | Recommandé | Obligatoire | Obligatoire |
| Plan de rollback | Implicite | Oui | Oui | Oui + testé | Oui + répété |
| Log de transitions | Allégé | Standard | Standard | Complet | Complet + audit |
| Gate sortie cycle | Automatique | Auto + spot-check | Auto + review | Humain requis | Humain + pair review |

### 8.2 Promotion de classe en cours de cycle

La **promotion de classe** est l'événement `RISK_CLASS_PROMOTE`. Elle déclenche un protocole spécifique :

```
Détection →
  1. RISK_CLASS_PROMOTE enregistré (qui, quand, justification)
  2. CYCLE_SUSPEND automatique
  3. Re-vérification DoR avec la nouvelle classe
  4. Si nouvelle classe É/C : HUMAN_VALIDATE requis avant reprise
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
  IDLE → DISCOVERY → CADRAGE → CONCEPTION → BUILD → VALIDATION
       → RELEASE → RUN → APPRENTISSAGE → IDLE

Niveau 2 — MICRO-FSM (intra-cycle, le sous-cycle universel)
  Pour chaque cycle actif :
  .Observer → .Définir → .Concevoir → .Exécuter
             → .Vérifier → .Capitaliser → .Transmettre
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
         │     DISCOVERY       │ ──── CYCLE_ABORT ──▶ IDLE                   │
         │  [micro-fsm actif]  │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + gate(discovery→cadrage)               │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │      CADRAGE        │ ──── CYCLE_ABORT ──▶ IDLE                   │
         │  [micro-fsm actif]  │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + gate(cadrage→conception)              │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │     CONCEPTION      │                                             │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + gate(conception→build)                │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │       BUILD         │ ◀── ROLLBACK_COMPLETE (depuis VALIDATION)   │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + gate(build→validation)                │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │     VALIDATION      │ ──── DOD_FAIL ──▶ BUILD                     │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE + gate(validation→release)              │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │       RELEASE       │ ──── ERROR_DETECTED ──▶ ERROR               │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE                                         │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │        RUN          │ ──── ERROR_DETECTED ──▶ ERROR               │
         └──────────┬──────────┘                                             │
                    │ CYCLE_COMPLETE                                         │
                    ▼                                                         │
         ┌─────────────────────┐                                             │
         │   APPRENTISSAGE     │                                             │
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
              ●───▶ [Observer] ──SUBSTEP_COMPLETE──▶ [Définir]   │
                       │                                │         │
              SUBSTEP_SKIP (T/F)                 SUBSTEP_COMPLETE │
                       │                                ▼         │
                       │                         [Concevoir]      │
                       │                                │         │
                       │                         SUBSTEP_COMPLETE │
                       │                                ▼         │
                       │                         [Exécuter] ◀─────┼─ point pivot :
                       │                                │         │   territoire code/
                       │                         SUBSTEP_COMPLETE │   ouvert ici seulement
                       │                                ▼         │   (en BUILD)
                       │                         [Vérifier]       │
                       │                                │         │
                       │                         SUBSTEP_COMPLETE │
                       │                                ▼         │
                       │                         [Capitaliser]    │
                       │                                │         │
                       │                         SUBSTEP_COMPLETE │
                       │                                ▼         │
                       └──────────────────────▶ [Transmettre] ───▶ CYCLE_COMPLETE
                                                                  │
                    └─────────────────────────────────────────────┘
```

**Règle de skippage** :
- T : toutes les étapes sauf Exécuter sont skippables (traversée en quelques secondes).
- F : Observer est optionnel ; les autres suivent l'ordre.
- M, É, C : aucun skip autorisé.

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
  persistence: état sauvegardé dans .planning/agent/current-state.yaml

ABORTED:
  description: "État terminal, cycle abandonné"
  triggers: [ERROR_UNRECOVERABLE, HUMAN_REJECT (3x consécutifs), CYCLE_ABORT]
  exit_events: [SESSION_START → nouvel état IDLE uniquement]
  territory_permissions: tous R, logs W (append audit)
  required_artifact: .planning/agent/abort-report-{timestamp}.md
```

---

## 10. Activités transversales

Ces activités ne sont pas des cycles : elles opèrent **dans tous les états** de la machine.

### 10.1 Surveillance de territoire (Territory Watch)

La machine maintient en continu une assertion sur le territoire courant :

```
À chaque action d'écriture de l'agent :
  1. Lire l'état courant depuis current-state.yaml
  2. Vérifier la matrice §5.2 pour le territoire cible
  3. Si W autorisé → action permise
  4. Si W interdit → action bloquée + ERROR_DETECTED
  5. Loguer l'action (autorisée ou bloquée) dans state-transitions.jsonl
```

**Invariant absolu** : un agent ne peut pas contourner la matrice en "oubliant" de vérifier l'état. La vérification est préalable à toute écriture.

### 10.2 Synchronisation boundaries.yaml ↔ état effectif

L'événement `HARNESS_SYNC` est déclenché :
- À chaque `SESSION_START`.
- Après toute modification manuelle de `boundaries.yaml`.
- En réponse à une anomalie détectée.

Le sync vérifie que les permissions déclaratives dans `boundaries.yaml` sont **cohérentes** avec la matrice §5.2 pour l'état courant. En cas d'incohérence, l'état le plus restrictif prévaut (fail-safe).

### 10.3 Gestion du mode opératoire

Le mode est une **configuration de la machine**, pas un état. Il est orthogonal à l'état cycle × sous-étape.

```
MODE PAIRING :
  → L'agent propose, le développeur valide chaque substep
  → Aucun SUBSTEP_COMPLETE sans ACK humain explicite
  → Disponible pour toutes classes de risque

MODE AUTO-DÉCISION (défaut) :
  → L'agent exécute, le développeur valide aux gates inter-cycles
  → SUBSTEP_COMPLETE autonome (sauf É/C inter-cycle)
  → Disponible pour T/F/M/É (pas C seul)
  → Garde-fous : format de proposition obligatoire, quota de rejets ≥ 20%

MODE BYPASS :
  → L'agent exécute sans validation inter-étape
  → GUARD STRICT : bypass_allowed = true uniquement si risk_class IN [T, F]
  → Si risk_class = M et bypass demandé : HUMAN_OVERRIDE requis + enregistrement
  → Si risk_class IN [É, C] : bypass structurellement impossible (non overridable)
```

### 10.4 Traçabilité et économie de tokens

Conformément à la décision §3.8 du rapport Discovery : l'agent écrit dans `.planning/` **ce qui est nécessaire à la prochaine décision**, pas tout ce qui serait théoriquement traçable.

Règle opérationnelle :
- **Logs** (`state-transitions.jsonl`) : append-only, tous les événements, no exception.
- **`.planning/` artefacts** : seulement si l'artefact sera consulté avant la prochaine décision.
- **Quality gates** : toujours évalués, résultats loggés, pas forcément documentés en prose.

---

## 11. Artefacts produits

### 11.1 Artefacts permanents (existent pour toute la durée de vie du projet)

| Artefact | Chemin | Format | Mis à jour par |
|---------|--------|--------|---------------|
| État courant | `.planning/agent/current-state.yaml` | YAML | Agent à chaque transition |
| Log de transitions | `logs/state-transitions.jsonl` | JSONL append-only | Agent à chaque transition |
| Frontières déclaratives | `.planning/agent/boundaries.yaml` | YAML | Humain seulement |
| Modèle de la state machine | `docs/transversal/harness-state-machine.md` | Markdown | Humain (ce document) |

### 11.2 Structure de current-state.yaml

```yaml
# .planning/agent/current-state.yaml
# Mis à jour à chaque transition — source de vérité de l'état courant
version: "1"
updated_at: "2026-05-03T14:32:00Z"
session_id: "sess_abc123"

macro_state: "BUILD"           # un des 8 cycles + IDLE + ERROR + SUSPENDED + ABORTED
micro_state: "Exécuter"        # une des 7 sous-étapes (ou null si IDLE/ERROR/ABORTED)
mode: "auto"                   # pairing | auto | bypass
risk_class: "M"                # T | F | M | É | C

active_item_ref: ".planning/02-backlog/items/PBI-042.md"
active_cycle_start: "2026-05-03T09:00:00Z"
gates_passed: ["dor_satisfied"]
gates_pending: ["dod_satisfied", "human_validation"]

last_transition:
  from: "BUILD.Concevoir"
  to: "BUILD.Exécuter"
  event: "SUBSTEP_COMPLETE"
  ts: "2026-05-03T14:32:00Z"
  triggered_by: "agent"

error_state: null              # null | RECOVERABLE | ESCALATED
suspend_reason: null           # null | raison de suspension
```

### 11.3 Structure de state-transitions.jsonl (ligne type)

```json
{"ts":"2026-05-03T14:32:00Z","session":"sess_abc123","from":"BUILD.Concevoir","to":"BUILD.Exécuter","event":"SUBSTEP_COMPLETE","guards":{"dor_satisfied":true,"bypass_allowed":false},"mode":"auto","risk_class":"M","triggered_by":"agent","item":"PBI-042","notes":null}
```

### 11.4 Structure de boundaries.yaml

```yaml
# .planning/agent/boundaries.yaml
# MODIFIABLE PAR L'HUMAIN UNIQUEMENT — jamais par l'agent
version: "1"
last_updated: "2026-05-03"
updated_by: "human"

territories:
  docs:
    description: "Vérité actuelle du produit"
    agent_write_states: ["DISCOVERY.*", "CADRAGE.*", "CONCEPTION.*",
                         "BUILD.Observer", "BUILD.Définir", "BUILD.Concevoir",
                         "BUILD.Capitaliser", "BUILD.Transmettre",
                         "APPRENTISSAGE.*"]
    agent_read_states: ["*"]  # toujours lisible
    human_write: always

  planning:
    description: "Pilotage et mémoire d'exécution"
    agent_write_states: ["*"]  # toujours écrivable (sauf SUSPENDED et ABORTED)
    agent_write_exceptions: ["SUSPENDED", "ABORTED"]
    human_write: always

  code:
    description: "Implémentation, tests, infra"
    agent_write_states: ["BUILD.Exécuter"]
    agent_read_states: ["BUILD.*", "VALIDATION.*", "RELEASE.*", "RUN.*",
                        "CONCEPTION.*"]
    human_write: always

  logs:
    description: "Trace append-only"
    agent_write_mode: "append_only"
    agent_write_states: ["*"]
    human_write: always

  boundaries_yaml:
    description: "Ce fichier — frontières déclaratives"
    agent_write_states: []   # jamais
    agent_read_states: ["*"]
    human_write: always
```

### 11.5 Artefact d'abort (produit à chaque ABORTED)

```yaml
# .planning/agent/abort-report-{timestamp}.md
---
cycle_aborted: "BUILD"
substep_at_abort: "Exécuter"
risk_class: "M"
event_trigger: "HUMAN_REJECT (3x)"
item_ref: ".planning/02-backlog/items/PBI-042.md"
abort_ts: "2026-05-03T16:45:00Z"
session_id: "sess_abc123"
last_stable_state: "CADRAGE.Transmettre"
human_action_required: "Reclassifier PBI-042 ou respecifier les critères d'acceptation"
---
```

---

## 12. Métriques et indicateurs

### 12.1 Métriques de santé de la machine à états

| Métrique | Description | Cible | Alerte si |
|---------|-------------|-------|-----------|
| `sm.transitions.total` | Nombre de transitions loguées par session | — | Chute à 0 (machine bloquée) |
| `sm.territory.violations` | Tentatives d'écriture hors matrice | 0 | > 0 (invariant brisé) |
| `sm.gate.fail_rate` | Taux de gates bloquants / total gates | < 10% | > 25% (DoR/DoD insuffisantes) |
| `sm.error.escalation_rate` | Taux d'erreurs escaladées à l'humain | < 5% | > 15% |
| `sm.bypass.override_count` | Nombre de HUMAN_OVERRIDE sur bypass M | 0 visé | > 2/mois |
| `sm.risk.promotion_rate` | Taux de promotions de classe en cours de cycle | < 10% | > 20% (classification initiale insuffisante) |
| `sm.suspend.duration_avg` | Durée moyenne en état SUSPENDED | < 24h | > 72h (cycle abandonné en pratique) |
| `sm.cycle.completion_rate` | % de cycles terminés sans abort | > 85% | < 70% |

### 12.2 Corrélation avec les métriques DORA

La machine à états alimente directement les métriques DORA 2024 :

- **Change Lead Time** : temps entre DISCOVERY.Observer et RELEASE.Transmettre.
- **Deployment Frequency** : nombre de RELEASE.CYCLE_COMPLETE par période.
- **Failed Deployment Recovery Time** : temps entre ERROR_DETECTED (en RELEASE/RUN) et ERROR_RECOVERED.
- **Change Failure Rate** : ratio (RELEASE→ERROR) / (RELEASE→RUN).
- **Rework Rate** : nombre de ROLLBACK_REQUEST / total transitions BUILD.

### 12.3 Log des promotions de classe (anti-pattern tracker)

Chaque `RISK_CLASS_PROMOTE` est un signal d'amélioration de la classification initiale. Analyser mensuellement :
- Quelle classe initiale → quelle classe finale (ex: F→M le plus fréquent ?).
- Quel cycle déclenche le plus de promotions (BUILD, CONCEPTION, VALIDATION ?).
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

## 14. Questions ouvertes (RED CARDS)

Les questions suivantes sont en attente de décision. Elles sont **bloquantes** pour la formalisation exécutable du harness, mais pas pour ce document d'architecture.

### RED CARD 1 — Mécanisation de la classification de risque

**Question** : qui ou quoi décide la classe T/F/M/É/C de façon déterministe ?

**Impact sur la machine** : le garde `bypass_allowed` et la profondeur du sous-cycle dépendent entièrement de la classe. Si la classification est subjective, tous les gardes qui en dépendent sont potentiellement invalides.

**Pistes** : arbre de décision déterministe (si touche auth → É minimum, si touche données santé → C minimum), scan automatique des fichiers touchés, labels de backlog forcés.

**Statut** : ouvert, priorité haute (§4.1 du rapport Discovery).

---

### RED CARD 2 — Transition vers le multi-états

**Question** : comment passer du mono-état strict actuel au multi-états par objet (chaque PBI/sprint/release a son propre état) ?

**Impact sur la machine** : nécessite une refonte de la macro-FSM pour devenir un ensemble de machines parallèles (orthogonal regions au sens Harel). La matrice de permissions §5.2 devra être étendue pour gérer des territoires partagés entre plusieurs états actifs simultanément.

**Condition préalable** : stabilisation et validation du mono-état sur au moins 2 cycles complets.

**Statut** : reporté explicitement (§4.7 rapport Discovery, §3.7 décision).

---

### RED CARD 3 — Enforcement effectif vs déclaratif

**Question** : comment le harness fait-il respecter la matrice §5.2 de façon effective, et non seulement déclarative ?

**Impact sur la machine** : l'hypothèse H5 du rapport Discovery pose la question : *"L'agent IA respecte les frontières du harness. Risque : un mode jailbreak involontaire (interprétation créative d'une contrainte)."*

**Pistes** : hooks Claude Code PreToolUse qui vérifient l'état courant avant chaque écriture, pattern de validation synchrone, test de régression territoire quotidien.

**Statut** : ouvert, critique pour la sécurité opérationnelle du système.

---

### RED CARD 4 — Modèle de capacité et arbitrage du backlog

**Question** : quand le backlog dépasse la capacité, quel mécanisme d'arbitrage utilise la machine pour décider quel cycle démarrer ?

**Impact sur la machine** : état IDLE est actuellement défini comme "entre cycles". Si plusieurs PBI sont prêts, l'état IDLE ne peut pas décider seul — il faut un mécanisme d'arbitrage.

**Pistes** : score de priorité (impact × risque × coût), capacité en tokens LLM, modèle de coût par classe (§4.5 rapport Discovery).

**Statut** : ouvert, basse priorité immédiate.

---

### RED CARD 5 — Définition formelle des DoR/DoD par cycle

**Question** : les gardes de gate utilisent `dor_satisfied` et `dod_satisfied` comme conditions binaires. Mais les critères varient par cycle. Où sont-ils définis formellement ?

**Impact sur la machine** : sans définition formelle par cycle et par classe de risque, les gardes sont non évaluables de façon déterministe.

**Pistes** : fichiers `docs/01-governance/dor-{cycle}.md` et `docs/01-governance/dod-{cycle}.md` avec checklists versionées, référencées dans `boundaries.yaml`.

**Statut** : ouvert, bloquant pour l'implémentation des gates.

---

## 15. Relations avec chaque cycle

### 15.1 DISCOVERY

**Rôle de la machine** : premier cycle actif après IDLE. La machine passe de IDLE à DISCOVERY sur `CYCLE_START`.

**Permissions spécifiques** : docs/ W (note de discovery, opportunity solution tree), .planning/ W, code/ fermé sauf en sous-étape Exécuter pour les spikes timeboxés (T/F uniquement).

**Gate de sortie** : `dor_satisfied` = problème validé (≥ 5 sources ou équivalent quantitatif), solution hypothèse falsifiable, taille estimée à l'ordre de grandeur.

**Mode typique** : Auto-décision ou Pairing selon disponibilité du développeur.

---

### 15.2 CADRAGE

**Rôle de la machine** : transforme l'opportunité validée en engagement. La machine vérifie que le DoR de CADRAGE est satisfait avant d'entrer dans le cycle.

**Permissions spécifiques** : docs/ W (charter, one-pager), .planning/ W (backlog initial), code/ fermé.

**Gate de sortie** : vision validée + performance budget négocié + classification de risque globale décidée. Sur É/C : `human_validation_obtained`.

**Événement clé** : `RISK_CLASS_SET` — c'est ici que la classification initiale est formalisée et entre dans la machine.

---

### 15.3 CONCEPTION

**Rôle de la machine** : plans techniques et ADR. Lecture du code autorisée (analyse), écriture interdite.

**Permissions spécifiques** : docs/ W (ADR, threat model, design doc), .planning/ W, code/ R (lecture pour analyse).

**Gate de sortie** : ADR signés + threat model (si M+) + AIPD (si requis) + DoD de conception vérifiée.

**Interaction mode** : si risk_class É/C et mode auto → obligation de proposer avant d'écrire l'ADR (format : problème, alternatives, choix, critère de succès).

---

### 15.4 BUILD

**Rôle de la machine** : seul cycle où code/ est W. La sous-étape Exécuter est le **seul état de toute la machine** où l'agent peut écrire dans le code.

**Permissions spécifiques** : code/ W en BUILD.Exécuter uniquement. Toutes autres sous-étapes : code/ R.

**Gate de sortie** : tests verts + quality gates CI verts + `dod_satisfied` (partiel).

**Cas error** : `ERROR_DETECTED` sur quality gate rouge → état ERROR.RECOVERABLE → max 3 tentatives → escalade si non résolu.

**Point d'attention** : la restriction code/ W à la seule sous-étape Exécuter est la contrainte la plus forte du harness. Elle prévient les modifications de code non intentionnelles pendant l'analyse, la conception, ou la vérification.

---

### 15.5 VALIDATION

**Rôle de la machine** : vérification que le DoD est pleinement satisfait. Code en lecture seulement.

**Permissions spécifiques** : .planning/ W (résultats de test, qualité), code/ R.

**Gate de sortie** : `dod_satisfied` complet + `human_validation_obtained` (toujours requis ici, indépendamment de la classe).

**Transition vers BUILD** : si `DOD_FAIL` → `ROLLBACK_REQUEST` → retour en BUILD.Vérifier (pas en IDLE).

---

### 15.6 RELEASE

**Rôle de la machine** : déploiement progressif. La machine surveille activement les SLO pendant cet état — c'est le seul état où `ERROR_DETECTED` est automatiquement généré sur burn rate SLO.

**Permissions spécifiques** : .planning/ W (release checklist, déploiement evidence), code/ R.

**Gate de sortie** : smoke tests verts + SLO stables + rollback plan testé (É/C).

**Transition d'urgence** : ERROR_DETECTED → ROLLBACK_REQUEST → code en R seulement pendant le rollback → ERROR_RECOVERED → RUN.

---

### 15.7 RUN

**Rôle de la machine** : surveillance continue post-release. Boucle OODA implicite.

**Permissions spécifiques** : docs/ R, .planning/ W (métriques, SLO, postmortem si incident), code/ R.

**Gate de sortie** : après la durée d'observation définie (proportionnelle à la classe de risque), signal pour Apprentissage.

**Interaction avec Apprentissage** : les signaux de RUN (incidents, régression SLO, feedback utilisateur) sont la matière première d'Apprentissage. La machine trace ces signaux en JSONL pour alimentation directe.

---

### 15.8 APPRENTISSAGE

**Rôle de la machine** : rétrospective + postmortem + mise à jour des patterns. Alimente le prochain cycle Discovery.

**Permissions spécifiques** : docs/ W (rétro, postmortem, patterns appris), .planning/ W (retrospective sprint, quality retro), code/ fermé.

**Gate de sortie** : ≤ 3 actions concrètes avec owner + éventuelles promotions de règles dans `boundaries.yaml` (via humain).

**Transition vers IDLE** : `CYCLE_COMPLETE` → IDLE. Le prochain `CYCLE_START` peut démarrer directement en DISCOVERY ou CADRAGE selon la nature du prochain PBI.

**Cas d'apprentissage structurel** : si la rétro identifie une faille dans la machine elle-même (ex: garde insuffisant, matrice de permissions trop restrictive) → `HARNESS_SYNC` + mise à jour manuelle de `boundaries.yaml` + `docs/transversal/harness-state-machine.md`.

---

## Annexe A — Transitions nominales complètes (catalogue)

```
T001: IDLE --CYCLE_START--> DISCOVERY.Observer
      guard: dor_check_initiated

T002: DISCOVERY.Observer --SUBSTEP_COMPLETE--> DISCOVERY.Définir
      guard: substep_output_exists

T003: DISCOVERY.* --SUBSTEP_COMPLETE (séquence)--> DISCOVERY.Transmettre
      [séquence T002 à T007 pour chaque sous-étape]

T008: DISCOVERY.Transmettre --CYCLE_COMPLETE--> CADRAGE.Observer
      guard: [gate discovery→cadrage] dor_satisfied, risk_class_defined
      guard (É/C only): human_validation_obtained

T009–T014: CADRAGE.* --séquence sous-cycle-->
T015: CADRAGE.Transmettre --CYCLE_COMPLETE--> CONCEPTION.Observer
      guard: [gate cadrage→conception] vision_validated, perf_budget_set

T016–T021: CONCEPTION.*
T022: CONCEPTION.Transmettre --CYCLE_COMPLETE--> BUILD.Observer
      guard: [gate conception→build] adr_signed, dod_conception_satisfied

T023–T028: BUILD.*
T029: BUILD.Exécuter --spécifique--> territoire code/ W ouvert
T030: BUILD.Transmettre --CYCLE_COMPLETE--> VALIDATION.Observer
      guard: [gate build→validation] tests_green, ci_gates_green

T031–T036: VALIDATION.*
T037: VALIDATION.Transmettre --CYCLE_COMPLETE--> RELEASE.Observer
      guard: [gate validation→release] dod_satisfied_full, human_validation_obtained
      guard (É/C): rollback_plan_tested

T038–T043: RELEASE.*
T044: RELEASE.Transmettre --CYCLE_COMPLETE--> RUN.Observer

T045–T050: RUN.*
T051: RUN.Transmettre --CYCLE_COMPLETE--> APPRENTISSAGE.Observer

T052–T057: APPRENTISSAGE.*
T058: APPRENTISSAGE.Transmettre --CYCLE_COMPLETE--> IDLE

# Transitions d'erreur (depuis tout état)
E001: ANY --ERROR_DETECTED--> ERROR.RECOVERABLE
E002: ERROR.RECOVERABLE --ERROR_RECOVERED--> last_state (restauré)
E003: ERROR.RECOVERABLE (tentative 3) --ERROR_UNRECOVERABLE--> ABORTED
E004: ERROR.RECOVERABLE --HUMAN_VALIDATE--> ERROR.ESCALATED --résolution--> last_state

# Transitions de rollback
R001: VALIDATION.* --DOD_FAIL--> ROLLBACK_REQUEST --> BUILD.Vérifier
R002: RELEASE.* --ROLLBACK_REQUEST--> BUILD.Vérifier (avec état pré-release restauré)

# Transitions de mode (depuis tout état, sauf ABORTED)
M001: ANY --MODE_SET_PAIRING--> même état, mode=pairing
M002: ANY --MODE_SET_AUTO--> même état, mode=auto
M003: ANY --MODE_SET_BYPASS--> même état, mode=bypass
      guard: bypass_allowed (risk_class IN [T, F])
      ou: HUMAN_OVERRIDE enregistré (risk_class = M seulement)

# Suspension / reprise
S001: ANY --CYCLE_SUSPEND--> SUSPENDED (état courant sauvegardé)
S002: SUSPENDED --SESSION_START--> état sauvegardé restauré
S003: SUSPENDED --CYCLE_ABORT--> ABORTED
```

---

## Annexe B — Anti-patterns à éviter

1. **Écrire dans code/ hors de BUILD.Exécuter** : l'anti-pattern le plus critique. Même en "lecture d'abord puis écriture rapide", la règle est absolue.

2. **Modifier `boundaries.yaml` via l'agent** : la frontière déclarative est maintenue par l'humain. Un agent qui la modifie court-circuite le contrôle humain fondamental.

3. **Laisser une promotion de classe sans trace** : si une promotion F→É est identifiée et non enregistrée, tous les gardes qui suivent s'appliquent à la mauvaise classe.

4. **Bypasser sur M/É/C par fatigue** : le guard `bypass_allowed` est structurel. Tenter de le contourner via HUMAN_OVERRIDE répété est un signal que le cycle est mal dimensionné.

5. **État SUSPENDED > 72h sans intention explicite** : une suspension longue sans journal d'intention est équivalente à un abandon silencieux. Passer explicitement en ABORTED si le cycle ne reprend pas.

6. **Transitions sans log** : même les transitions triviales (T, micro-fsm) doivent être loguées. Le log est la seule mémoire de la machine — un trou dans le log est un trou dans la traçabilité.

7. **Initialiser current-state.yaml manuellement sans événement** : l'état ne doit évoluer que par événements tracés. Une modification directe de `current-state.yaml` sans log correspondant crée une incohérence entre l'état affiché et l'état réel.

8. **Définir DoR/DoD dans la tête** : les gardes `dor_satisfied` et `dod_satisfied` doivent référencer des checklists explicites dans `docs/01-governance/`. Un garde non documenté est non évaluable de façon déterministe.

---

*Document de référence — à versionner dans `docs/transversal/harness-state-machine.md`. Toute évolution doit passer par une mise à jour humaine explicite (Main Thread uniquement, per rules/core.md §7).*
