# Checkpoint — Fin Discovery / Cadrage, début Implémentation

> **Statut** : sortie de phase Discovery/Cadrage, entrée en phase Conception/Implémentation.
> **Objet** : système de pilotage de cycle de développement par agent IA, distribué comme plugin pour Claude Code, Codex, Hermes.
> **Format** : checkpoint consolidé, autoportant. Rassemble l'ensemble des décisions prises sur ~10 sessions de réflexion.
> **Date** : 2026-05-02.
> **À utiliser comme** : document de référence pour reprendre le projet, document de transmission à un agent IA, base de la phase Conception.

---

## Sommaire

1. Synthèse en une page
2. Parcours de la réflexion (ce qu'on a traversé)
3. Acquis stables (fondations)
4. Décisions prises pendant la Discovery
5. Architecture conceptuelle consolidée
6. Décisions prises pendant la transition Conception
7. Architecture d'implémentation cible
8. Questions encore ouvertes (à trancher pendant l'implémentation)
9. Plan de travail pour la phase Conception/Implémentation
10. Glossaire

---

## 1. Synthèse en une page

**Ce qu'on construit** : un harness (TypeScript) qui s'installe comme plugin sur les trois principales plateformes d'agent IA pour développeurs (Claude Code, Codex, Hermes). Il impose une discipline de cycle de développement piloté par la qualité, modulée par classe de risque, exploitable en mode solo + agents IA.

**Ce qui rend le projet pertinent** : les trois plateformes partagent un dénominateur commun (skills, subagents, MCP servers, hooks, fichiers d'instructions). Ce dénominateur est suffisant pour porter un système d'orchestration unique, sans avoir à réinventer un orchestrateur séparé.

**Ce qui rend le projet ambitieux** : il combine 4 couches qui se valident mutuellement — un cadre qualité (basé standards), une pipeline fractale (8 cycles, sous-cycle universel à 7 étapes), un système de modes opératoires (pairing/auto-décision/bypass), et une architecture de fichiers (`docs/` + `.planning/`).

**Le pivot central** : la matrice de classe de risque T/F/M/É/C. Tout se module sur elle (profondeur de cycle, mode par défaut, gates obligatoires, type de revue).

**Choix d'architecture pour l'implémentation** : harness en TypeScript, distribué comme plugin npm, qui s'installe nativement dans chaque plateforme. Pas de daemon séparé. Les hooks natifs des plateformes appellent le harness via une commande unique (`harness hook <event>`). État du projet versionné dans `.planning/` du repo.

**Stade actuel** : sortie de Discovery, début de Conception détaillée. Une version simple a déjà tourné en pratique. Le squelette de packages TypeScript est défini.

**Risque dominant** : procrastination architecturale. Continuer à raffiner sans coder.

**Prochaine étape recommandée** : MVP minimal sur une seule plateforme (Claude Code), un seul cycle complet, avant d'étendre à Codex et Hermes.

---

## 2. Parcours de la réflexion

Le projet a traversé 10 grandes étapes de réflexion. Les comprendre permet de saisir pourquoi chaque décision a été prise.

### Étape 1 — Critique d'un cycle de développement classique
Point de départ : un cycle linéaire en 17 étapes (cadrage → analyse → conception → dev → tests → déploiement → maintenance). Identifié comme trop linéaire pour le web moderne. Manques structurels : Discovery amont absente, privacy/RGPD sous-traité, FinOps absent, accessibilité reléguée en QA tardive, versioning non spécifié.

### Étape 2 — Cycle qualité orienté standards (v3)
Production d'une v3 plus solide : 24 sections orientées qualité, basée sur les standards reconnus (ISO/IEC 25010:2023, NIST SSDF, OWASP SAMM/ASVS, RGPD, WCAG 2.2, EAA, FinOps Foundation, DORA, SPACE, Westrum, SRE Google). Validation par recherche documentaire approfondie.

### Étape 3 — Pipeline fractale (v4)
Reformulation : la v3 reste plate. Adoption d'une structure fractale où chaque cycle est lui-même un mini-cycle. Pattern récursif : Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre. Modulation de profondeur par classe de risque (T/F/M/É/C).

### Étape 4 — Comparaison cycle classique vs cycle fractal
Discussion : pour un dev solo orienté web, ni le cycle classique (trop linéaire) ni la v4 complète (trop lourde) ne conviennent strictement. Conclusion : la v4 est juste, mais doit être traversée à profondeur modulée selon le risque. Anti-pattern principal identifié : appliquer le chemin long à tout par dogme.

### Étape 5 — Modes Discovery selon source du besoin
Introduction de trois modes pour la phase Discovery :
- **Produit** : utilisateurs externes (entretiens, JTBD, opportunity tree).
- **Self-feedback** : développeur est l'utilisateur (formalisation écrite, tests de nécessité).
- **Technique** : changement d'architecture (document de justification, alternatives, critères ex-post).

Pour les changements d'architecture spécifiquement : adoption du pattern Strangler Fig (jamais de big bang).

### Étape 6 — Trois modes opératoires (pairing / auto-décision / bypass)
Distinction centrale identifiée : ce ne sont pas trois cycles différents, mais trois positions du curseur de contrôle humain dans le même cycle.
- **Pairing** : présent en continu, intense en attention.
- **Auto-décision** : agent fait Discovery + propose, humain valide au triage. Mode par défaut visé.
- **Bypass** : agent fait tout, autorisé seulement T/F, interdit É/C.

Garde-fous identifiés : format de proposition obligatoire, quota de rejets, audit aléatoire pour éviter le rubber-stamping.

### Étape 7 — Architecture des fichiers `.planning/` + `docs/`
Conception détaillée d'une arborescence de repo en 3 territoires :
- `docs/` : vérité actuelle du produit (humains).
- `.planning/` : pilotage et mémoire d'exécution (agent + humains).
- code/tests/infra : implémentation.

Détail : registres vivants vs snapshots immuables vs état régénéré, métriques et logs append-only, mapping exhaustif des 24 sections du cycle qualité aux deux territoires.

### Étape 8 — State management externe (harness)
Révélation tardive : un harness externe contrôle déjà ce que l'agent peut écrire selon la phase courante. Variables d'environnement, contraintes effectives. Les boundaries déclaratives sont *doublées* par les contraintes techniques du harness. Résout la majorité des problèmes de gouvernance agent.

### Étape 9 — Rapport Discovery + Cadrage consolidé
Production du rapport synthétique : ce qui est figé, ce qui est décidé, ce qui reste ouvert, ce qui est explicitement reporté. Verdict : phase Discovery quasi terminée, le risque dominant n'est plus l'incomplétude architecturale mais la procrastination.

### Étape 10 — Recherche sur Claude Code, Codex, Hermes
Recherche documentaire exhaustive sur les trois plateformes cibles. Confirmation que le dénominateur commun est exploitable : MCP standard, SKILL.md convergent, fichiers d'instructions Markdown hiérarchiques, hooks (avec divergences de richesse), subagents avec sémantique proche.

### Bilan
Le projet a maintenant une fondation conceptuelle solide (4 couches), une architecture de fichiers détaillée, et une cible technique claire (plugin TypeScript pour 3 plateformes). Il est prêt à passer en phase Conception détaillée puis Implémentation.

---

## 3. Acquis stables (fondations)

### 3.1 Cadre qualité de référence (v3)

Standards adoptés :

| Domaine | Référence | Rôle |
|---|---|---|
| Qualité produit | ISO/IEC 25010:2023 | 9 caractéristiques (dont *safety* nouveau) |
| Tests | ISO/IEC/IEEE 29119 | Stratégie de tests basée risque |
| Sécurité — cycle | NIST SSDF SP 800-218 | 4 groupes (PO/PS/PW/RV) |
| Sécurité — maturité | OWASP SAMM v2 | 5 fonctions business |
| Sécurité — exigences | OWASP ASVS | Référentiel de contrôles |
| Sécurité — risques | OWASP Top 10 | Inventaire vulnérabilités web |
| Privacy | RGPD art. 25/35 + méthode CNIL PIA | Privacy by design + AIPD |
| Accessibilité | WCAG 2.2 + EN 301 549 + EAA | Standard ICT européen + directive 2019/882 (en vigueur 28/06/2025) |
| FinOps | FinOps Foundation Framework 2024 | Coût comme dimension de qualité |
| Performance livraison | DORA 2024/2025 (5 métriques) | Lead time, frequency, recovery, failure rate, rework |
| Productivité équipe | SPACE | Bien-être ≥ activité |
| Culture | Westrum | Générative, blameless |
| Fiabilité | Google SRE | SLO, error budgets, postmortems |

### 3.2 Pipeline fractale (v4)

**8 cycles** dans la pipeline :
1. Discovery (valider le problème)
2. Cadrage (engagement partagé)
3. Conception (comment construire)
4. Build (produire le code)
5. Validation (confirmer la qualité)
6. Release (mise en production)
7. Run (exploitation continue)
8. Apprentissage (postmortem + rétrospective)

**Sous-cycle universel à 7 étapes**, traversé dans chaque cycle :
1. Observer
2. Définir
3. Concevoir
4. Exécuter
5. Vérifier
6. Capitaliser
7. Transmettre

**Activités continues transverses** (imprègnent tous les cycles) :
- Sécurité shift-left
- Privacy by design
- FinOps
- Accessibilité by design
- i18n / l10n by design
- Observabilité
- Documentation
- Tests automatisés
- Versioning

### 3.3 Matrice de classe de risque T/F/M/É/C

| Classe | Critère type |
|---|---|
| **T (Trivial)** | Cosmétique, doc, refactor sans changement de comportement |
| **F (Faible)** | Nouvelle fonctionnalité isolée derrière feature flag, pas de PII |
| **M (Moyen)** | Fonctionnalité visible utilisateur, pas de PII sensible |
| **É (Élevé)** | Touche auth, autz, paiement, données personnelles, schéma DB, API publique |
| **C (Critique)** | Données santé/biométrie/financières, refonte archi, exigence réglementaire |

Cette classification module **tout** : profondeur du cycle, mode par défaut, gates obligatoires, profondeur de revue, stratégie de déploiement.

### 3.4 Trois modes opératoires

| Mode | Description | Quand l'utiliser |
|---|---|---|
| **Pairing** | Humain présent en continu, agent suit le flux de pensée | Décisions structurantes, debugging complexe |
| **Auto-décision** | Agent propose, humain valide au triage | **Mode par défaut visé** |
| **Bypass** | Agent fait tout, dans périmètre borné | T/F seulement, jamais É/C |

### 3.5 Architecture des fichiers (3 territoires)

```
repo/
├── docs/         vérité actuelle du produit (humains)
├── .planning/    pilotage et mémoire d'exécution (agent + humain)
└── code/         implémentation
```

Dans `.planning/` :
- **registry/** : objets vivants (PBI, risques, changements, décisions, incidents)
- **timeline/** : snapshots immuables (sprints clos, releases déployées)
- **state/** : vue régénérée à chaque mise à jour
- **metrics/** : append-only JSONL
- **logs/** : append-only JSONL
- **agent/** : politiques, prompts, audit, frontières

Voir document `architecture-planning-docs.md` pour le détail exhaustif.

### 3.6 Mapping cycle qualité → emplacement

Chaque section du cycle qualité (24 sections de la v2/v3) a un **emplacement de définition** dans `docs/` et un **emplacement d'exécution** dans `.planning/`. Aucun contrôle qualité n'est orphelin.

---

## 4. Décisions prises pendant la Discovery

Liste exhaustive des 9 décisions structurantes prises pendant la phase Discovery.

### D1 — Pipeline fractale plutôt que cycle plat
**Justification** : permet la modulation par risque, capture la nature non-séquentielle du dev moderne, explicite les feedbacks inter-cycles.

### D2 — Matrice risque T/F/M/É/C comme pivot central
**Justification** : sans elle, l'adaptabilité du système disparaît. Elle module tout le reste.

### D3 — Auto-décision comme mode par défaut
**Justification** : maximise le temps libéré sans renoncer au contrôle final.
**Garde-fous** : format de proposition obligatoire, quota de rejets ≥ 20 %, audit aléatoire hebdomadaire.

### D4 — Bypass autorisé T/F, interdit É/C
**Justification** : non négociable. Sur les changements à fort risque, le développeur est responsable de la décision.

### D5 — Strangler Fig pour les changements d'architecture
**Justification** : transforme un changement É/C en séquence de F/M, qui repassent par le cycle normal.

### D6 — Discovery a trois modes selon source du besoin
**Modes** : produit / self-feedback / technique.
**Justification** : pas besoin de cycle séparé pour le refactor ou le changement d'archi.

### D7 — Mono-état actuel, multi-états reporté
**Justification** : simplicité, contrainte du harness actuel.
**Limite reconnue** : ne reflète pas la réalité du dev solo qui fait plusieurs choses en parallèle.

### D8 — Économie sur les tokens du planning
**Règle** : l'agent écrit dans `.planning/` ce qui est nécessaire à la prochaine décision, pas ce qui serait théoriquement traçable.
**Pas concerné** : tests, doc produit, code (à fond).
**Concerné** : sprint plans, retrospectives, quality-execution matrices, registry items.

### D9 — Trois territoires `docs/` + `.planning/` + code
**Justification** : séparation des responsabilités. Vérité produit (docs), pilotage (planning), implémentation (code).

---

## 5. Architecture conceptuelle consolidée

### 5.1 Vue en couches

```
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 1 — VISION ET STRATÉGIE                              │
│ • Cadre qualité (v3) : standards de référence               │
│ • Pipeline fractale (v4) : 8 cycles + sous-cycle universel  │
│ • Modes opératoires : pairing / auto-décision / bypass      │
│ • Matrice risque T/F/M/É/C : pivot d'adaptation             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 2 — ARCHITECTURE DES FICHIERS                        │
│ • docs/ : vérité actuelle du produit                        │
│ • .planning/ : pilotage et mémoire d'exécution              │
│ • code/tests/infra : implémentation                         │
│ • Mapping cycle qualité → emplacement explicite             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 3 — STATE MANAGEMENT EXTERNE (HARNESS)               │
│ • Variables d'environnement et d'état                       │
│ • Filtre des actions de l'agent par phase                   │
│ • Frontières effectives (pas seulement déclaratives)        │
│ • Mono-état strict actuel (limite assumée)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 4 — AGENT IA (Claude Code / Codex / Hermes)          │
│ • Politiques (auto / assisté / interdit)                    │
│ • Prompts versionnés                                        │
│ • Audit append-only                                         │
│ • Économie tokens sur le planning                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 5 — DÉVELOPPEUR                                      │
│ • Décideur final, surtout sur É/C                           │
│ • Validateur des transitions critiques                      │
│ • Auteur de la vision et du cadrage                         │
│ • Audit aléatoire et garde-fous anti-rubber-stamp           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Flux principal

```
Idée
  ▼
[Discovery] ───── modes : produit / self-feedback / technique
  ▼ (problème validé)
[Cadrage] ─────── DoR formelle, classification de risque
  ▼ (engagement partagé)
[Conception] ──── ADR, threat model si É/C, AIPD si seuil RGPD
  ▼ (plan validé)
[Build] ───────── inner loop par incrément, conventional commits
  ▼ (code mergé, gates verts)
[Validation] ──── risk-based testing, validation produit
  ▼ (build approuvé)
[Release] ─────── canary progressif, expand/contract migrations
  ▼ (en production)
[Run] ─────────── boucle OODA continue, SLO, error budgets
  ▼ (signaux)
[Apprentissage] ─ rétro de cycle + postmortem si incident
  └─── feedbacks vers cycles amont
```

### 5.3 Principes invariants

1. Standards d'abord, outils ensuite.
2. Mesurable (DORA, SPACE, ISO 25010, FinOps).
3. Quality gates plutôt que checkpoints humains.
4. Blameless (Westrum, génératif).
5. Continu autant que ponctuel (activités transverses ≠ phases).
6. Universel mais ajusté (modulation par risque).
7. Économie sur le planning, pas sur la qualité.

---

## 6. Décisions prises pendant la transition Conception

Décisions plus récentes, qui orientent la phase Implémentation.

### D10 — Cible : 3 plateformes (Claude Code, Codex, Hermes)
**Justification** : ces 3 plateformes ont un dénominateur commun exploitable (skills, subagents, MCP, hooks, fichiers d'instructions Markdown). Recherche documentaire confirmée.

### D11 — Distribution : plugin natif (pas daemon séparé)
**Modèle** : le user fait `npm install -g @harness/cli` puis `harness install --target claude` (ou codex, ou hermes). Après, il utilise sa plateforme normalement (`claude`, `codex`, `hermes`). Le harness est invisible.

**Justification** : zéro friction utilisateur, intégration native, pas de processus à gérer.

### D12 — Langage : TypeScript
**Justification** : écosystème mature, distribution npm naturelle, compile vers JS multi-plateforme, machine d'état mature avec xstate.

### D13 — Interprétation A : portable mais une seule plateforme à la fois
**Justification** : multi-cible simultané (interprétation B) est trop complexe pour le MVP. Reporté.

### D14 — Communication harness ↔ plateforme : option C (commande unique avec sous-commandes)
**Modèle** : les hooks natifs des plateformes appellent `harness hook <event-name>`. Une seule entrée binaire, dispatch interne.
**Justification** : élégant, uniforme entre les 3 plateformes, simple à debug.

### D15 — État du projet : YAML pour state machine, JSONL pour logs
**Modèle** :
- YAML simple en `.planning/state/` pour l'état machine (3-5 fichiers max).
- JSONL append-only pour logs et métriques.
- Pas de SQLite (overkill pour mono-état solo).

### D16 — Distribution package : un seul package au début
**Modèle** : `@harness/cli` qui contient tout (core + adapters + runtime + CLI).
**Évolution future** : split en packages séparés si besoin plus tard.

---

## 7. Architecture d'implémentation cible

### 7.1 Modèle d'installation et d'exécution

```
┌──────────────────────────────────────────────────────────┐
│ INSTALLATION (une fois par machine)                      │
│                                                          │
│  npm install -g @harness/cli                             │
│  harness install --target claude  (ou codex, ou hermes)  │
│                                                          │
│  → installe artefacts dans ~/.claude/ ou ~/.codex/ ou …  │
│  → enregistre hooks natifs de la plateforme              │
│  → configure MCP servers nécessaires                     │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ INITIALISATION D'UN PROJET (une fois par projet)         │
│                                                          │
│  cd mon-nouveau-projet                                   │
│  harness init                                            │
│                                                          │
│  → crée .planning/ et docs/ structurés                   │
│  → initialise state/state.yaml en phase Discovery        │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│ USAGE QUOTIDIEN                                          │
│                                                          │
│  cd mon-projet                                           │
│  claude    (ou codex, ou hermes)     ← user normal       │
│                                                          │
│  Sous le capot :                                         │
│   - La plateforme charge ses settings (avec nos hooks)   │
│   - Au PreToolUse → exécute `harness hook pre-tool-use`  │
│   - Notre script lit/écrit .planning/ du projet          │
│   - Décision allow/deny renvoyée à la plateforme         │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Structure de packages

```
@harness/                               (monorepo TypeScript)
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── packages/
│   ├── core/                           cœur réutilisable
│   │   ├── src/
│   │   │   ├── state-machine/          machine d'état du cycle
│   │   │   ├── risk-classifier/        classification T/F/M/É/C
│   │   │   ├── gates/                  validation de transitions
│   │   │   ├── planning/               lecture/écriture .planning/
│   │   │   └── logging/                JSONL append-only
│   │   └── package.json
│   │
│   ├── cli/                            commande `harness`
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── install.ts          install plugin sur plateforme
│   │   │   │   ├── init.ts             init projet
│   │   │   │   ├── status.ts           état courant
│   │   │   │   ├── doctor.ts           diagnostic
│   │   │   │   └── hook.ts             dispatcher hooks
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── adapter-claude/                 traduit vers Claude Code
│   │   ├── src/
│   │   │   ├── hooks-format.ts         JSON Claude settings
│   │   │   ├── skill-paths.ts          ~/.claude/skills/
│   │   │   └── installer.ts
│   │   └── package.json
│   │
│   ├── adapter-codex/                  traduit vers Codex
│   │   ├── src/
│   │   │   ├── hooks-format.ts         TOML/JSON Codex
│   │   │   ├── skill-paths.ts
│   │   │   └── installer.ts
│   │   └── package.json
│   │
│   ├── adapter-hermes/                 traduit vers Hermes
│   │   └── ...
│   │
│   └── runtime/                        scripts exécutés par les hooks
│       ├── src/
│       │   ├── pre-tool-use.ts
│       │   ├── post-tool-use.ts
│       │   ├── user-prompt-submit.ts
│       │   └── ...
│       └── package.json
│
├── artifacts/                          contenu portable, copy-paste
│   ├── skills/
│   │   ├── classify-risk/
│   │   │   ├── SKILL.md
│   │   │   └── scripts/
│   │   ├── propose-change/
│   │   ├── transition-phase/
│   │   └── ...
│   ├── subagents/
│   │   ├── reviewer.md
│   │   ├── threat-modeler.md
│   │   └── ...
│   └── instructions/
│       ├── base.md                     contenu commun aux 3
│       ├── claude-specific.md
│       ├── codex-specific.md
│       └── hermes-specific.md
│
└── tests/
```

### 7.3 Dénominateur commun exploité

D'après la recherche documentaire :

| Primitive | Portabilité | Stratégie |
|---|---|---|
| Fichier d'instructions | Tier 1 (quasi gratuit) | Markdown commun + suffixe par plateforme |
| Skills (SKILL.md) | Tier 1 | Format identique, juste les chemins changent |
| MCP servers | Tier 1 | Standard MCP, juste reformatage TOML/YAML/JSON |
| Subagents | Tier 2 (générateur) | Concept commun, syntaxe différente |
| Slash commands | Tier 2 | Représentés comme skills sur Claude/Codex, slash sur Hermes |
| Hooks | Tier 3 (vrai abstraction) | Forme canonique → adaptateurs par plateforme |
| Permissions / sandbox | Tier 4 (non portable) | 3 fichiers spécifiques, pas d'abstraction |

### 7.4 Mapping hooks (forme canonique → natif)

Hooks portables identifiés (présents avec sémantique proche sur les 3 plateformes) :
- `pre_tool_use` (avant exécution outil)
- `post_tool_use` (après exécution outil)
- `user_prompt_submit` (avant traitement prompt user)
- `session_start`
- `stop` / `session_end`

Hooks Claude-only acceptés comme tels :
- Hooks de type `agent` (spawn subagent de vérification)
- Hooks `mcp_tool` directs

Hooks Hermes-only acceptés :
- Gateway hooks (multi-messagerie)
- Plugin hooks Python

Stratégie : si un événement n'existe pas sur une plateforme, **le hook n'est juste pas appelé**. Pas d'erreur, pas de fallback.

---

## 8. Questions encore ouvertes

Questions identifiées qui peuvent attendre l'implémentation pour être tranchées.

### Q1 — Comment opérationnaliser la classification de risque
**Statut** : ouvert.
**Question** : qui décide la classe T/F/M/É/C, comment, avec quels critères mécaniques ?
**Pistes** : arbre de décision déterministe, critères automatisables (parsing fichiers touchés, labels), critères ambigus qui exigent humain.

### Q2 — Comment formaliser la state machine
**Statut** : ouvert, prochain sujet structurant en Conception.
**Question** : schéma formel des états, transitions, conditions, actions autorisées.
**Pistes** : `docs/01-governance/operating-model.md` (conceptuel), `.planning/agent/state-machine.yaml` (exécutable), `logs/state-transitions.jsonl`.

### Q3 — Granularité de la mémoire à long terme
**Statut** : ouvert, basse priorité.
**Question** : comment transformer l'archive en mémoire interrogeable ?

### Q4 — Caractéristiques ISO 25010 prioritaires
**Statut** : ouvert, dépend du projet.
**Question** : pour un projet donné, quelles 3-5 caractéristiques avec quels seuils ?

### Q5 — Modèle de capacité et coût
**Statut** : ouvert, peut attendre.
**Question** : comment arbitrer quand backlog dépasse capacité ?

### Q6 — Protocole de promotion de classe
**Statut** : ouvert.
**Question** : si on découvre qu'un changement F est en réalité É, qu'est-ce qui se passe ?

### Q7 — Multi-états (multi-cycles parallèles)
**Statut** : reporté.

### Q8 — Documentation visuelle
**Statut** : ouvert.
**Manque identifié** : C4 niveau 1 du système, diagramme d'états du harness, flowchart sous-cycle, matrice mode × classe × cycle.

### Q9 — Point d'entrée unique pour réentrée
**Statut** : ouvert.
**Manque identifié** : `docs/00-index/start-here.md` comme contrat de réentrée dans le système.

### Q10 — Versioning de l'architecture elle-même
**Statut** : ouvert.
**Manque identifié** : SemVer du système de pilotage, CHANGELOG dédié, MIGRATION.md entre versions.

### Q11 — Playbooks pour situations récurrentes
**Statut** : ouvert.
**Manque identifié** : 5-7 playbooks courts (new-feature, bug-found, incident-prod, archi-change, mode-switch).

### Q12 — Méta-feedback sur l'architecture
**Statut** : ouvert.
**Manque identifié** : rétro de l'architecture distincte des rétros de cycle.

### Q13 — Hypothèses à valider en pratique
- H1 : matrice 5 niveaux suffisante ?
- H2 : auto-décision tenable sans dérive en rubber-stamp ?
- H3 : harness mono-état tenable pour solo ?
- H4 : économie tokens planning ne dégrade pas la traçabilité utile ?
- H5 : agent IA respecte les frontières du harness ?
- H6 : Strangler Fig applicable à tous changements d'architecture significatifs ?
- H7 : cycle s'auto-améliore via rétros et postmortems ?

---

## 9. Plan de travail pour la phase Conception/Implémentation

### Étape 1 — Conception détaillée (estimation : 1-2 semaines)

**Livrables** :
1. **State machine formalisée** : schéma xstate complet (états, transitions, guards, actions).
2. **Catalogue des skills** : liste exhaustive des skills à fournir, avec SKILL.md de chaque.
3. **Catalogue des subagents** : liste des subagents (reviewer, threat-modeler, etc.) avec définitions.
4. **Mapping hooks détaillé** : pour chaque hook canonique, forme natif sur chaque plateforme.
5. **Schéma `.planning/state/`** : YAML schemas pour state.yaml, mode.yaml, current-risk.yaml.
6. **API du `core` package** : signatures TypeScript des fonctions principales.

**Critère de sortie** : on peut commencer à coder sans avoir à inventer en cours de route.

### Étape 2 — MVP Claude Code uniquement (estimation : 2-4 semaines)

**Périmètre** :
- Une seule plateforme : Claude Code.
- Un seul cycle complet : init projet → Discovery → Cadrage → Build → fin.
- Une seule classe de risque : F (faible).
- Un seul mode : auto-décision.

**Livrables** :
1. `harness install --target claude` qui marche (installation propre).
2. `harness init` qui crée un `.planning/` minimal valide.
3. Hooks `pre-tool-use` et `post-tool-use` qui logguent dans `.planning/logs/`.
4. State machine qui transitionne Discovery → Cadrage → Build sur commande utilisateur.
5. Une skill « classify-risk » fonctionnelle.
6. Un subagent « reviewer » fonctionnel.

**Critère de sortie** : on peut faire un cycle de bout en bout sur un projet jouet.

### Étape 3 — Extension aux autres classes de risque (estimation : 1-2 semaines)

**Périmètre** :
- Toujours Claude Code.
- Toutes les classes T/F/M/É/C.
- Tous les modes pairing/auto-décision/bypass.

**Livrables** :
1. Matrice risque → profondeur opérationnelle.
2. Gates de promotion entre classes.
3. Garde-fous anti-rubber-stamp.

**Critère de sortie** : la richesse de la v4 est exploitable en pratique.

### Étape 4 — Portage Codex (estimation : 1-2 semaines)

**Périmètre** :
- Adapter Codex implémenté.
- Mapping hooks Claude → Codex effectué.
- Validation que les artefacts portables (skills, subagents) marchent.

**Critère de sortie** : `harness install --target codex` produit un système fonctionnel.

### Étape 5 — Portage Hermes (estimation : 2-3 semaines)

**Périmètre** :
- Adapter Hermes implémenté (plus complexe car 3 sous-systèmes de hooks).
- Validation portage skills/subagents.

**Critère de sortie** : les 3 plateformes sont supportées.

### Étape 6 — Stabilisation et publication (estimation : 1-2 semaines)

**Livrables** :
- Documentation utilisateur.
- Tests automatisés.
- Publication sur npm.

### Total estimé
**8 à 14 semaines** pour la version 1.0 stable. Selon disponibilité et complexité réelle.

### Recommandation pour démarrer
Commencer par l'**Étape 1 — Conception détaillée**, avec un focus particulier sur la state machine. C'est la pièce qui débloquera le plus de choses. Le reste peut être conçu en parallèle ou différé.

---

## 10. Glossaire

**ADR** — Architecture Decision Record. Document court qui formalise une décision d'architecture.

**AIPD / DPIA** — Analyse d'Impact relative à la Protection des Données. Obligatoire RGPD art. 35 pour traitements à risque.

**Auto-décision** — Mode opératoire où l'agent IA fait Discovery + propose, le développeur valide au triage.

**Bypass** — Mode opératoire où l'agent IA fait tout, y compris le triage. Autorisé seulement sur changements T/F.

**Classe de risque** — Classification d'un changement sur 5 niveaux (T/F/M/É/C). Pivot d'adaptation du cycle.

**DoR / DoD** — Definition of Ready / Definition of Done. Critères d'entrée/sortie d'une story.

**DORA** — DevOps Research and Assessment. Auteur des 5 métriques de performance de livraison.

**EAA** — European Accessibility Act. Directive UE 2019/882, en vigueur 28/06/2025.

**Expand/Contract** — Pattern de migration sans downtime (ajouter, dual-write, switch read, contract).

**Harness** — État management externe. Couche qui filtre ce que l'agent peut écrire selon la phase.

**Hook** — Événement de cycle de vie sur lequel un script peut être déclenché.

**JTBD** — Jobs To Be Done. Méthode de formulation du problème utilisateur.

**MCP** — Model Context Protocol. Standard de communication entre agent IA et outils externes.

**Mode opératoire** — Position du curseur de contrôle humain dans le cycle (pairing/auto-décision/bypass).

**Pairing** — Mode opératoire où le développeur est présent en continu pendant l'exécution de l'agent.

**Pipeline fractale** — Architecture où chaque cycle est lui-même un mini-cycle (pattern récursif).

**Postmortem** — Analyse post-incident, blameless. Distinct de la rétrospective de cycle.

**Quality gate** — Contrôle automatisé bloquant dans la CI/CD.

**Rubber-stamp** — Anti-pattern où le développeur valide sans vraiment lire les propositions de l'agent.

**SBOM** — Software Bill of Materials. Inventaire signé des dépendances logicielles.

**SLI / SLO / SLA** — Service Level Indicator / Objective / Agreement.

**SLSA** — Supply-chain Levels for Software Artifacts. Niveaux de sécurité supply chain.

**Sous-cycle universel** — Pattern à 7 étapes (Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre) traversé dans chaque cycle.

**SPACE** — Framework de mesure de la productivité d'équipe (Satisfaction, Performance, Activity, Communication, Efficiency).

**SSDF** — Secure Software Development Framework. NIST SP 800-218.

**State machine** — Machine à états formalisée du cycle (phase courante, transitions valides).

**Strangler Fig** — Pattern de remplacement progressif d'un système (Martin Fowler).

**Westrum** — Typologie de cultures organisationnelles. Cible : générative.

---

*Checkpoint produit en transition Discovery/Cadrage → Conception/Implémentation. Document de référence à versionner dans `docs/03-discovery/checkpoint-2026-05-02.md` ou équivalent. À utiliser pour reprendre le projet, transmettre le contexte à un agent IA, ou comme base de la phase Conception.*
