# Cycle 01 — Discovery : Concepts et Critères

> **Version** : 1.0 — 2026-05-03
> **Statut** : Référence architectural validée
> **Périmètre** : Pipeline fractale v4 — Cycle Discovery, tous modes (Produit / Self-feedback / Technique)
> **Auteur** : Deep-researcher + sources croisées (≥ 2 sources par claim)
> **Standards** : ISO/IEC 25010:2023 · NIST SSDF 1.1/1.2-draft · OWASP Top 10:2025 · WCAG 2.2 · DORA 2024 · FinOps Foundation 2024
> **Contrat PFV4** : macro cycles `discovery → cadrage → conception → build → validation → release → run → learning` ; `RiskClass = T/L/M/H/C` ; `OperatingMode = bypass/auto/pairing`

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Position dans le pipeline](#2-position-dans-le-pipeline)
3. [Objectif du cycle](#3-objectif-du-cycle)
4. [Entrées — Definition of Ready (DoR)](#4-entrées--definition-of-ready-dor)
5. [Sorties — Definition of Done (DoD)](#5-sorties--definition-of-done-dod)
6. [Concepts clés](#6-concepts-clés)
7. [Critères qualité — ISO/IEC 25010:2023](#7-critères-qualité--isoiec-250102023)
8. [Modulation par classe de risque](#8-modulation-par-classe-de-risque)
9. [Sous-cycle fractal — 7 étapes](#9-sous-cycle-fractal--7-étapes)
10. [Activités transversales](#10-activités-transversales)
11. [Artefacts produits](#11-artefacts-produits)
12. [Métriques et indicateurs](#12-métriques-et-indicateurs)
13. [Standards de référence](#13-standards-de-référence)
14. [Questions ouvertes — RED CARDS](#14-questions-ouvertes--red-cards)
15. [Relations inter-cycles](#15-relations-inter-cycles)

---

## 1. Résumé exécutif

Le cycle Discovery est le **point d'entrée de la pipeline fractale v4**. Sa mission exclusive est d'éviter de construire la mauvaise chose — la phase la plus rentable du cycle, car chaque heure investie ici économise des jours en aval.

**Contexte spécifique** : le développeur est solo, assisté d'agents IA sous supervision graduée. Le Discovery s'applique à trois modes selon la source du besoin : Produit (utilisateurs externes), Self-feedback (développeur = utilisateur), Technique (changement d'architecture). Ces trois modes partagent le même cycle, pas trois cycles séparés.

**Ce que ce document établit** :
- Les 19 sections de clarification obligatoires (Phase 0 — r1.md) comme ossature de l'exploration
- La classification T/L/M/H/C comme mécanisme central de modulation de profondeur
- La DoR et DoD spécifiques à Discovery
- Les critères qualité ISO/IEC 25010:2023 applicables à cette phase
- Les 7 étapes du sous-cycle fractal appliquées à Discovery
- Les RED CARDS (questions ouvertes bloquantes ou à surveiller)

**Verdict de maturité (2026-05-03)** : les critères stricts de sortie de Discovery sont remplis (architecture conceptuelle figée, pipeline v4 définie, state management externe opérationnel). Les critères souhaitables (classification mécanique, state machine formalisée, modèle ISO 25010 instancié) restent ouverts — ils ne bloquent pas le Build mais doivent être formalisés dans les deux premiers cycles.

---

## 2. Position dans le pipeline

```
Pipeline fractale v4 — vue macro

[01 discovery] ──► [02 cadrage] ──► [03 conception] ──► [04 build]
     │                                                        │
     │                  ◄──────────────────────────────────────
     │                         feedbacks de cycle
     ▼
[08 learning] ◄── [07 run] ◄── [06 release] ◄── [05 validation]
```

**Rôle de Discovery dans ce flux** :
- Premier cycle — aucun prédécesseur dans la pipeline principale
- Reçoit des feedbacks entrants de [08 learning] (rétros, postmortems) et de [07 run] (signaux production)
- Alimente [02 Cadrage] avec un problème validé, une recommandation (build / pivot / kill) et une première estimation de classe de risque

**Pattern fractal** : Discovery applique lui-même le sous-cycle universel à 7 étapes (Observer → Define → Design → Execute → Verify → Capitalize → Transmit). La même discipline s'applique à tous les niveaux de la pipeline.

**Modes opératoires actifs dans ce cycle** :

| Mode | Description | Usage Discovery |
|------|-------------|-----------------|
| pairing | Développeur présent en continu | Entretiens utilisateurs, décisions ambiguës |
| auto | Agent autonome par défaut, avec checkpoints et validation humaine quand le risque ou la politique l'exige | Mode par défaut — exploration, analyse |
| bypass | Agent fait tout, périmètre borné | T/L uniquement — recherche documentaire, veille |

---

## 3. Objectif du cycle

### 3.1 Objectif primaire

Transformer une idée ou un signal en **intention claire, problème validé et recommandation décidée** (build / pivot / kill), de sorte que le cycle suivant (Cadrage) puisse s'engager sans ambiguïté majeure.

### 3.2 Ce que Discovery doit produire — pas produire

**Doit produire** :
- Une fiche idée structurée (titre, contexte, problème observé, population concernée, impact actuel, opportunité, hypothèses, contraintes, décision attendue)
- Un problem statement validé (pas supposé)
- Une première estimation de classe de risque (T/L/M/H/C)
- Une recommandation explicite : build / pivot / kill
- Les hypothèses classées : définies / non définies / à confirmer / bloquantes

**Ne doit pas produire** :
- De design technique détaillé (appartient à [03 Conception])
- De backlog raffiné (appartient à [02 Cadrage])
- De code, même de spike (sauf spike timeboxé ≤ 5 jours pour valider faisabilité)
- Des engagements de livraison

### 3.3 Trois modes de Discovery selon la source du besoin

```
Mode Produit
  Source : utilisateurs externes
  Méthodes : entretiens JTBD, Opportunity Solution Tree, Continuous Discovery (Torres)
  Critère de sortie : ≥ 5 conversations utilisateurs OU source quantitative équivalente

Mode Self-feedback
  Source : développeur = utilisateur principal
  Méthodes : formalisation écrite, tests de nécessité, agent IA en "mauvais utilisateur"
  Critère de sortie : problème écrit, formalisé, stressé par l'agent — pas seulement oral

Mode Technique
  Source : signal d'architecture (dette, opportunité, contrainte nouvelle)
  Méthodes : document de justification, alternatives documentées, critères ex-post mesurables
  Critère de sortie : justification ≥ 3 alternatives considérées, critères mesurables définis
```

---

## 4. Entrées — Definition of Ready (DoR)

Discovery peut démarrer seulement si les conditions suivantes sont remplies.

### 4.1 DoR minimale (T/L)

- [ ] Signal d'entrée identifié : idée, feedback, signal production, opportunité technique
- [ ] Source du signal documentée (qui, quand, contexte)
- [ ] Aucun cycle Discovery actif en parallèle sur le même domaine (mono-état strict actuel)

### 4.2 DoR standard (M)

Tout ce qui précède, plus :
- [ ] Idée formulée en 1-3 phrases : quel problème, pour qui, pourquoi maintenant
- [ ] Impact potentiel estimé à l'ordre de grandeur (pas précis)
- [ ] Fenêtre de Discovery timeboxée définie (ex. : 2 jours max pour M)

### 4.3 DoR renforcée (H/C)

Tout ce qui précède, plus :
- [ ] Sponsor ou décideur identifié (pour ce projet solo : développeur en tant que PO)
- [ ] Contraintes réglementaires ou de conformité pré-identifiées (RGPD, EAA, sectorielles)
- [ ] Ressources disponibles (temps, accès utilisateurs, accès données)
- [ ] Dépendances critiques identifiées (systèmes tiers, données, intégrations)
- [ ] Domaine à risque élevé explicitement nommé (sécurité, données personnelles, finance, santé)

### 4.4 Signaux d'entrée valides pour déclencher Discovery

```
Signal produit          → feedback utilisateur, NPS bas, support ticket récurrent, JTBD non satisfait
Signal technique        → dette technique critique, opportunité d'architecture, contrainte de performance
Signal réglementaire    → nouvelle norme EAA/RGPD/DORA applicable, audit de conformité
Signal stratégique      → pivot de vision, nouvelle opportunité marché, changement de contexte
Signal d'apprentissage  → postmortem révélant un problème systémique, rétro recommandant Discovery
```

**Anti-pattern** : démarrer un cycle Build sans avoir fait Discovery ("on sait ce que veut l'utilisateur sans entretien depuis 3 mois"). C'est l'anti-pattern numéro un — construire la mauvaise chose de manière optimale.

---

## 5. Sorties — Definition of Done (DoD)

Discovery est terminé quand **tous** les critères stricts sont remplis ET les critères conditionnels applicable à la classe de risque.

### 5.1 Critères stricts (toutes classes)

- [ ] L'idée est formulée en intention claire (fiche idée complète)
- [ ] Le problème est nommé : réel, observé ou supposé — distinction explicite
- [ ] La recommandation est tranchée : build / pivot / kill (pas "à étudier")
- [ ] La classe de risque initiale est proposée : T / L / M / H / C avec justification
- [ ] Les hypothèses sont listées et classées (définies / à confirmer / bloquantes)
- [ ] Les questions ouvertes ont un responsable, un impact et une échéance
- [ ] Le livrable Discovery est versionné dans `docs/03-discovery/`

### 5.2 Critères conditionnels par classe de risque

| Critère | T | L | M | H | C |
|---------|---|---|---|---|---|
| Entretiens utilisateurs (≥ 5 ou équivalent quant.) | — | — | ○ | Obligatoire | Obligatoire |
| Problem Statement formalisé (r1.md §2) | — | ○ | Obligatoire | Obligatoire | Obligatoire |
| Parties prenantes identifiées (r1.md §4) | — | ○ | Obligatoire | Obligatoire | Obligatoire |
| Usage prévu écrit, exclusions explicites (r1.md §5-6) | — | ○ | Obligatoire | Obligatoire | Obligatoire |
| Risques principaux listés (r1.md §12) | — | — | ○ | Obligatoire | Obligatoire |
| Contraintes conformité identifiées (r1.md §11) | — | — | ○ | Obligatoire | Obligatoire |
| Hypothèses à valider formalisées (r1.md §16) | — | ○ | Obligatoire | Obligatoire | Obligatoire |
| Première estimation FinOps (ordre de grandeur) | — | — | ○ | Obligatoire | Obligatoire |
| Signal privacy/RGPD identifié (oui/non + détail) | — | — | ○ | Obligatoire | Obligatoire |
| Spike technique timeboxé si faisabilité incertaine | — | — | ○ | ○ | Obligatoire |

Légende : Obligatoire = blocage de sortie · ○ = recommandé · — = optionnel

### 5.3 Critères de sortie — les 19 points de r1.md

La Phase 0 de r1.md définit 19 sections de clarification. Pour sortir de Discovery en direction du Cadrage, chaque section doit être dans l'une des catégories suivantes — **aucun "implicite" toléré** :

```
Défini           → la section est complète et validée
Non défini       → la section n'est pas encore remplie (acceptable si non bloquant)
Non applicable   → la section ne s'applique pas à ce contexte (justification obligatoire)
À confirmer      → la section nécessite une validation externe (responsable + échéance)
Risque accepté   → la section est partiellement remplie, le risque est explicitement accepté
Hors périmètre   → la section sera traitée dans un cycle ultérieur (décision consciente)
Bloquant         → la section manquante bloque le Cadrage (ne pas avancer sans)
```

Les 19 sections (r1.md) et leur statut attendu à la sortie de Discovery :

| # | Section | T/L | M | H/C |
|---|---------|-----|---|-----|
| 1 | Idée initiale | Défini | Défini | Défini |
| 2 | Problème à résoudre | À confirmer | Défini | Défini |
| 3 | Objectifs | Défini | Défini | Défini |
| 4 | Utilisateurs et parties prenantes | Non applicable si solo | Défini | Défini |
| 5 | Usage prévu | Défini | Défini | Défini |
| 6 | Périmètre fonctionnel | Hors périmètre | À confirmer | Défini |
| 7 | Parcours utilisateur | — | Hors périmètre | À confirmer |
| 8 | Règles métier | — | Hors périmètre | À confirmer |
| 9 | Données | — | À confirmer | Défini |
| 10 | Permissions et sécurité fonctionnelle | — | À confirmer | Défini |
| 11 | Contraintes réglementaires | À confirmer | Défini | Défini |
| 12 | Risques | À confirmer | Défini | Défini |
| 13 | Exigences qualité (ISO 25010) | — | À confirmer | Défini |
| 14 | Exigences non fonctionnelles | — | À confirmer | Défini |
| 15 | Intégrations | — | À confirmer | Défini |
| 16 | Hypothèses et zones inconnues | Défini | Défini | Défini |
| 17 | Critères d'acceptation | Hors périmètre | Hors périmètre | À confirmer |
| 18 | Critères de test | Hors périmètre | Hors périmètre | À confirmer |
| 19 | Critères de sortie avant développement | À confirmer | Défini | Défini |

---

## 6. Concepts clés

### 6.1 Discovery continue vs Discovery one-shot

**Discovery continue (Continuous Discovery — Teresa Torres)** : engagement régulier avec les utilisateurs ou signaux, au moins une interaction par semaine, maintenu tout au long du cycle de vie du produit. L'Opportunity Solution Tree est l'artefact central : outcome au sommet → opportunités → solutions candidates → tests d'hypothèse. La Discovery n'est pas une phase initiale one-shot — c'est une pratique permanente.

**Anti-pattern nommé** : faire une phase Discovery en début de projet puis ne plus jamais revenir aux utilisateurs. "On saura ce qu'ils veulent" — ce présupposé est la cause la plus fréquente de rework massif.

**Adaptation solo + IA** : interviewer des utilisateurs cibles ET faire jouer l'agent en "mauvais utilisateur" pour stresser les hypothèses. Maintenir un fichier `discovery.md` versionné comme mémoire de la pratique continue.

### 6.2 Problem-Solution Fit

Avant de passer en Cadrage, une condition nécessaire : le **problem-solution fit**. On a validé non seulement que le problème existe et que des gens souffrent de ne pas avoir de solution, mais aussi que la solution envisagée adresse réellement ce problème de manière préférable aux alternatives existantes.

Critères de problem-solution fit :
- Le problème est réel (observé, mesuré — pas supposé)
- ≥ 5 utilisateurs cibles confirment le problème (ou source quantitative équivalente)
- La solution préférée a au moins une hypothèse falsifiable
- L'effort est estimable à un ordre de grandeur

### 6.3 Hypothèses et zones inconnues

Les hypothèses sont les fondations du Discovery. Chaque hypothèse doit être explicite, pas implicite. Format (r1.md §16) :

```
Hypothèse H-XXX
Nous supposons que [affirmation].
À confirmer par : [qui]
Impact si faux : [conséquence sur le projet]
Décision attendue : [avant quelle étape]
```

Les hypothèses actives sur la pipeline fractale v4 (rapport-discovery-cadrage.md §8) :
- H1 : classification T/L/M/H/C en 5 niveaux est suffisante
- H2 : auto tenable sans dérive rubber-stamp
- H3 : harness mono-état tenable pour dev solo
- H4 : économiser sur le planning ne dégrade pas la traçabilité utile
- H5 : l'agent respecte les frontières du harness
- H6 : Strangler Fig applicable à tous les changements d'architecture significatifs
- H7 : le cycle s'auto-améliore via rétros et postmortems

### 6.4 Classification de risque T/L/M/H/C

Mécanisme central de modulation de toute la pipeline. Défini en Discovery, propagé à tous les cycles aval.

| Classe | Critères de classification |
|--------|---------------------------|
| **T — Trivial** | Changement cosmétique, doc, refactor sans comportement, dépendance patch sans CVE. Code path déjà testé. |
| **L — Low** | Nouvelle fonctionnalité isolée derrière feature flag, pas de PII, pas de migration. |
| **M — Moyen** | Fonctionnalité visible utilisateur, pas de PII sensible, pas de schéma DB, pas d'impact tiers. |
| **H — High** | Touche auth, autorisation, paiement, PII, schéma DB, API publique, infra de production. |
| **C — Critique** | Impact transverse multi-services, données santé/biométrie/financières, refonte architecture, rupture contrat API, exigence réglementaire (RGPD, EAA, NIS2, DORA financier). |

**Règle anti-pattern** : ne jamais laisser la classification à la seule discrétion de l'auteur. En mode solo, l'agent propose la classe, le développeur la valide explicitement — trace dans l'artefact Discovery.

**Protocole de promotion en cours de cycle** (fermé par PFV4) : quand un changement L se révèle être H en cours d'exploration, la promotion est tracée dans `.planning/current-risk.yaml`, la transition est enregistrée dans `.planning/state.yaml`, le cycle reprend à la SubPhase appropriée, et l'apprentissage est archivé pour améliorer la classification future.

### 6.5 Mode opératoire et frontières de contrôle humain

Les trois modes (pairing / auto / bypass) ne créent pas trois cycles différents. Ils définissent où se situe la frontière de contrôle humain dans le même cycle.

**En Discovery** :
- Mode auto (par défaut) : l'agent fait l'exploration, analyse les signaux, propose la fiche idée et la classe de risque. Le développeur valide uniquement aux checkpoints requis par le risque ou la politique.
- Mode bypass : acceptable uniquement pour T/L — recherche documentaire, veille technologique, analyse de logs. Interdit pour H/C où la décision de classification engage des ressources importantes.
- Garde-fous obligatoires en auto : format de proposition obligatoire (problème + alternatives + choix + critère de succès + classe de risque), quota mental de rejets ≥ 20 %, audit aléatoire hebdomadaire.

### 6.6 State management externe — harness

Le harness contrôle ce que l'agent peut écrire selon la phase courante. En phase Discovery :
- **Autorisé** : écriture dans `docs/03-discovery/`, `.planning/02-backlog/spikes/`, `.planning/08-risks/`, `.planning/09-logs/decision-log.md`
- **Interdit** : écriture dans `code/`, `.planning/03-sprints/`, fichiers de Cadrage non encore ouverts
- **Frontières déclaratives** dans `.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json` doublées par les contraintes effectives du harness

### 6.7 Trois territoires et artefacts Discovery

```
docs/03-discovery/          → vérité actuelle (note Discovery, problem statement, OST)
.planning/02-backlog/spikes/ → spikes timeboxés actifs
.planning/08-risks/          → risques identifiés en Discovery
.planning/09-logs/           → décisions prises, hypothèses tracées
```

La règle d'économie des tokens s'applique au `.planning/` : écrire ce qui est nécessaire à la prochaine décision, pas ce qui serait théoriquement traçable. La documentation produit (`docs/`) reste à fond.

---

## 7. Critères qualité — ISO/IEC 25010:2023

La révision 2023 d'ISO/IEC 25010 introduit 9 caractéristiques (vs 8 en 2011), avec l'ajout de **Safety**, le renommage de *Usability* en **Interaction Capability**, et de *Portability* en **Flexibility**. Nouveaux sous-caractères : inclusivité, self-descriptiveness, resistance, scalability.

En phase Discovery, les caractéristiques qualité sont **définies et priorisées** — elles ne sont pas encore mesurées (mesure = Validation, Run). L'artefact attendu est un **modèle qualité instancié** : 3-5 caractéristiques prioritaires avec seuils mesurables définis.

### 7.1 Caractéristiques applicables en Discovery

| Caractéristique ISO 25010:2023 | Rôle en Discovery | Priorité type |
|-------------------------------|-------------------|---------------|
| **Functional suitability** | Valider que le problème ciblé est réel et que la solution envisagée y répond (completeness, correctness, appropriateness) | Critique — toujours |
| **Interaction capability** | Identifier les utilisateurs, leurs contextes, leurs besoins d'accessibilité, niveau technique, fréquence (ex-Usability) | High si UI |
| **Reliability** | Identifier les exigences de disponibilité, tolérance aux pannes, recoverability | High si service critique |
| **Security** | Identifier les données personnelles, les surfaces d'attaque, les contraintes d'authentification/autorisation | Critique si H/C |
| **Safety** *(nouveau 2023)* | Identifier les risques opérationnels, fail-safe requirements, contraintes réglementaires de sécurité fonctionnelle | Critique si santé/finance/transport |
| **Maintainability** | Identifier les contraintes de modularité, testabilité, évolutivité — impacte les choix d'architecture en Conception | High si projet long |
| **Flexibility** | Identifier scalabilité, adaptabilité aux changements de contexte, installatibilité (ex-Portability) | Selon roadmap |
| **Performance efficiency** | Identifier les budgets de latence, de charge, de consommation de ressources | Selon classe de risque |
| **Compatibility** | Identifier les contraintes d'interopérabilité, coexistence avec systèmes existants | Si intégrations identifiées |

### 7.2 Priorisation des caractéristiques par domaine

Le modèle ISO 25010 doit être **instancié par projet** — pas appliqué uniformément. Exemples de priorisation selon le contexte du projet solo + IA :

**Harness de développement (ce projet)** :
1. Maintainability (modularity, analysability, testability) — priorité max : un harness non maintenable se dégrade rapidement
2. Reliability (availability, fault tolerance) — le harness doit tenir sous charge et sur la durée
3. Functional suitability — les fonctions couvertes doivent être correctes et complètes
4. Security — les politiques de l'agent et les frontières doivent être robustes
5. Safety — les décisions de classification H/C ne doivent pas passer en bypass

**Application utilisateur (projet futur)** :
1. Functional suitability — résoudre le bon problème
2. Interaction capability + Safety — selon domaine
3. Security — toujours

### 7.3 Seuils attendus en sortie de Discovery

En Discovery, les seuils ne sont pas encore mesurés — ils sont **déclarés** sous forme d'exigences. Format attendu :

```
Caractéristique : Reliability
Sous-caractéristique : Availability
Exigence Discovery : Le harness doit être disponible pour toute session de développement
                     sans interruption non planifiée > 30 min.
Seuil cible (à mesurer en Run) : SLO ≥ 99 % des sessions sans interruption
Justification : Interruption = perte de contexte = dette de recontextualisation
Classification : Exigence obligatoire (non négociable)
```

---

## 8. Modulation par classe de risque

La matrice suivante définit la **profondeur du Discovery** selon la classe de risque. Un Discovery T traverse les 7 étapes du sous-cycle en quelques minutes. Un Discovery C prend des jours et produit tous les artefacts.

### 8.1 Matrice Discovery × Classe de risque

| Activité Discovery | T | L | M | H | C |
|-------------------|---|---|---|---|---|
| Fiche idée | Informel | Minimal | Structuré | Complet | Complet + validé |
| Problem statement (r1.md §2) | — | Résumé | Obligatoire | Obligatoire | Obligatoire + peer review IA |
| Entretiens utilisateurs | — | — | ≥ 3 | ≥ 5 | ≥ 5 + source quantitative |
| Opportunity Solution Tree | — | — | Ébauche | Complet | Complet |
| Spike technique timeboxé | — | — | Si incertitude | ≤ 5 jours | Obligatoire si faisabilité inconnue |
| Identification parties prenantes | — | Minimal | Obligatoire | Obligatoire | Obligatoire |
| Hypothèses formalisées (r1.md §16) | Informal | Minimal | Obligatoire | Obligatoire | Obligatoire |
| Analyse risques préliminaire | — | — | ○ | Obligatoire | Obligatoire |
| Signal privacy/RGPD | — | — | Checklist | Checklist + analyse | AIPD trigger check |
| Signal accessibilité EAA/WCAG 2.2 | — | — | Checklist | Checklist | Checklist + plan |
| Estimation FinOps (ordre de grandeur) | — | — | ○ | Obligatoire | Obligatoire |
| Classification de risque explicite | ✅ | ✅ | ✅ | ✅ + justification | ✅ + justification + validation |
| Note Discovery (`discovery.md`) | Informel | ✅ | ✅ | ✅ complet | ✅ complet + versionné |
| Checkpoint de sortie explicite | Implicite | Checklist | Checklist | Review développeur | Review développeur + IA antagoniste |

Légende : ✅ = obligatoire · ○ = recommandé · — = skip autorisé

### 8.2 Chemin court vs chemin long

**Chemin court (T/L)** : Discovery peut être fait en 5-30 minutes. Fiche idée informelle, classification explicite, note minimale dans `docs/03-discovery/`. L'essentiel : la classification de risque est toujours tracée, même sur T.

**Chemin long (H/C)** : Discovery prend 1 à plusieurs jours. Les 19 sections de r1.md sont traitées, les hypothèses formalisées, les risques listés, les contraintes réglementaires identifiées, un spike technique lancé si la faisabilité est incertaine. La recommandation build/pivot/kill est validée par le développeur avant de passer en Cadrage.

### 8.3 bypass et ses limites

Le bypass est **autorisé uniquement pour T/L** en Discovery. Exemples légitimes :
- Recherche documentaire (agent cherche, synthétise, présente)
- Analyse de logs ou de métriques (agent parse, statistiques, anomalies)
- Veille technologique (agent lit, classe, résume les alternatives)

**Interdit en bypass pour H/C** : la classification de risque est une décision du développeur, pas de l'agent. Si l'agent propose H ou C, c'est une requête de décision humaine — pas une action autonome.

---

## 9. Sous-cycle fractal — 7 étapes

Chaque cycle de la pipeline fractale suit le même sous-cycle universel. Voici son application spécifique à Discovery.

### Étape 1 — Observer

**But** : capter les signaux sans les interpréter. Résister à la tentation de sauter directement à la solution.

**Activités** :
- Recenser tous les signaux d'entrée : feedback utilisateurs, métriques Run, postmortems, signaux techniques, veille réglementaire
- En mode Produit : lire les tickets de support, NPS, reviews app store, transcriptions d'entretiens
- En mode Self-feedback : tenir un journal d'observations pendant la semaine précédant Discovery
- En mode Technique : analyser les logs d'incidents, les métriques de performance, les alertes

**Artefact** : journal d'observation brut (ne pas trier à ce stade)

**Durée** : T = 5 min, L = 15 min, M = 1-2 h, H = demi-journée, C = 1-2 jours

### Étape 2 — Define

**But** : transformer les observations en problème clair et en intention formulée.

**Activités** :
- Rédiger la fiche idée (r1.md §1) : titre, contexte, problème observé, population, impact, opportunité
- Formuler le Problem Statement (r1.md §2) : problème exact, réel/mesuré/supposé, depuis quand, fréquence, impact
- Identifier les objectifs (r1.md §3) : obligatoires, souhaitables, hors périmètre
- Premières parties prenantes (r1.md §4) : qui utilise, qui décide, qui peut bloquer
- Usage prévu et exclusions (r1.md §5-6)

**Artefact** : fiche idée v0 + problem statement v0

**Garde-fou** : distinguer explicitement "problème observé" vs "problème supposé". Un problème supposé sans validation utilisateur reste une hypothèse, pas un fait.

### Étape 3 — Design

**But** : générer des options d'exploration, pas une solution finale.

**Activités** :
- Construire ou mettre à jour l'Opportunity Solution Tree
- Identifier 2-3 approches possibles pour valider le problème (entretiens, spike, benchmark, données quantitatives)
- Si H/C : lancer un spike technique timeboxé ≤ 5 jours pour valider la faisabilité
- Identifier les hypothèses clés à tester en priorité (r1.md §16)
- Première estimation FinOps à l'ordre de grandeur (combien ça coûte de construire, combien ça coûte de ne pas construire)

**Artefact** : plan d'exploration Discovery (qui, quoi, comment, timeboxé)

**Règle spike** : un spike a une seule question, un seul livrable (décision + trace dans `.planning/02-backlog/spikes/`). Un spike qui dépasse 5 jours est de l'implémentation déguisée — stopper et reclassifier.

### Étape 4 — Execute

**But** : explorer, ne pas construire. Collecter des preuves, pas des certitudes.

**Activités** :
- Conduire les entretiens utilisateurs (JTBD : "Quand [situation], je veux [motivation] pour [résultat]")
- En solo : l'agent joue le "mauvais utilisateur" pour stresser les hypothèses
- Réaliser le spike technique si planifié
- Collecter des données quantitatives si disponibles
- Documenter chaque entretien : verbatim, observations, surprises, contradictions

**Règle** : en mode bypass (T/L), l'agent peut exécuter l'exploration documentaire. Pour M+, le développeur conduit ou co-conduit les entretiens — l'agent ne peut pas remplacer l'empathie directe.

**Durée** : respecter le timebox défini en Design. Une Discovery sans fin est de la procrastination architecturale sophistiquée.

### Étape 5 — Verify

**But** : confronter les observations à la réalité, valider ou invalider les hypothèses.

**Activités** :
- Appliquer la grille de sortie DoD (§5) : tous les critères de la classe de risque sont-ils remplis ?
- Vérifier le problem-solution fit : le problème est-il validé par ≥ 5 utilisateurs ou équivalent quant. ?
- Vérifier que la recommandation (build/pivot/kill) est défendable avec les preuves collectées
- Auditer les 19 sections r1.md : classer chaque section (défini / à confirmer / bloquant / etc.)
- Vérifier l'absence de "implicite" : tout ce qui n'est pas explicitement classé est un risque

**Artefact** : grille de vérification DoD complétée (toutes classes tracées)

**Vérification IA antagoniste** : pour M+, l'agent joue l'avocat du diable sur la recommandation. Il doit produire ≥ 3 arguments contre la recommandation. Le développeur doit y répondre explicitement dans la note Discovery.

### Étape 6 — Capitalize

**But** : transformer les apprentissages en mémoire réutilisable pour les cycles futurs.

**Activités** :
- Mettre à jour `docs/03-discovery/discovery.md` versionné
- Archiver les transcriptions d'entretiens (résumé + verbatim clé)
- Mettre à jour le registre des hypothèses : validées, invalidées, encore ouvertes
- Ajouter les patterns récurrents au journal de biais (`docs/03-discovery/bias-log.md`)
- Si une hypothèse s'avère fausse : documenter l'impact sur les décisions passées et les corrections nécessaires

**Règle d'économie** : ne pas archiver tout ce qui a été produit — archiver ce qui est utile pour la prochaine décision ou le prochain Discovery similaire.

### Étape 7 — Transmit

**But** : rendre la sortie de Discovery explicite et actionnable pour le cycle Cadrage.

**Activités** :
- Produire la Note de Discovery finale (1-3 pages) : problème, utilisateur cible, hypothèses validées/invalidées, recommandation, classification de risque, critères de passage en Cadrage
- Renseigner les 19 sections r1.md dans leur statut final (§5.3)
- Mettre à jour `.planning/00-dashboard/current-status.md` : cycle = DISCOVERY, statut = DONE
- Déclencher le cycle Cadrage (si recommandation = build) ou archiver (si pivot/kill)
- Si pivot : décrire ce qu'on a appris, pourquoi on pivote, quelle direction alternative
- Si kill : documenter explicitement pourquoi — c'est aussi de la valeur

**Artefact final** : Note Discovery (`docs/03-discovery/<id>-discovery-note.md`) + mise à jour dashboard

---

## 10. Activités transversales

Ces activités ne sont pas spécifiques à Discovery — elles imprègnent tous les cycles de la pipeline. En Discovery, leur rôle est d'**identifier les contraintes** qui devront être intégrées dès la Conception, pas de les résoudre.

### 10.1 Sécurité — détection précoce

**En Discovery** : identification des surfaces de risque, pas du threat model complet.

Checklist minimale (M+) :
- [ ] Des données personnelles sont-elles impliquées ? (OUI/NON + catégories)
- [ ] Des données sensibles (santé, finance, biométrie) ? (OUI/NON)
- [ ] Des systèmes tiers avec accès authentifié ? (OUI/NON)
- [ ] Des APIs publiques exposées ? (OUI/NON)
- [ ] Des contraintes réglementaires sécurité (NIS2, DORA financier, HDS) ? (OUI/NON)

Si OUI sur l'un des points → classification minimale M, et signal pour threat modeling STRIDE en [03 Conception].

Référence : NIST SSDF SP 800-218 v1.1 (officiel) — v1.2 en draft public (commentaires clôturés Jan 2026, pas encore final).

### 10.2 Privacy — signal RGPD

**En Discovery** : identifier si un traitement de données personnelles est envisagé et si une AIPD est susceptible d'être requise.

Checklist RGPD Discovery (r1.md §11) :
- [ ] Y a-t-il traitement de données personnelles ? → base légale à identifier
- [ ] Y a-t-il données de santé / biométrie / financières ? → classification C minimum
- [ ] Le traitement coche-t-il ≥ 2 critères WP29 (profilage, données sensibles, grande échelle, surveillance systématique, décision automatisée, technologie innovante) ? → AIPD obligatoire art. 35 RGPD
- [ ] Y a-t-il transfert hors UE ? → clauses contractuelles types ou équivalent
- [ ] Y a-t-il enfants dans la population cible ? → GDPR-K considérations

**Conséquence d'inaction** : RGPD art. 35 impose l'AIPD *avant* la mise en œuvre du traitement. Sanction jusqu'à 10 M€ ou 2 % du CA mondial pour défaut d'AIPD. La Privacy by Design (Cavoukian, 7 principes) doit être intégrée dès la Conception, pas ajoutée en QA.

### 10.3 Accessibilité — EAA en vigueur depuis le 28 juin 2025

**En Discovery** : identifier si le produit est soumis à l'European Accessibility Act (EAA / Directive UE 2019/882, en vigueur depuis le 28/06/2025) et si WCAG 2.2 AA s'applique.

Checklist accessibilité Discovery :
- [ ] Le produit est-il destiné à des utilisateurs UE ? → EAA applicable si secteur couvert
- [ ] Y a-t-il une interface utilisateur ? → WCAG 2.2 AA baseline (même si EAA référence encore WCAG 2.1, viser 2.2 pour anticiper)
- [ ] Des utilisateurs en situation de handicap sont-ils dans la population cible ? → tests manuels obligatoires en Validation
- [ ] Le produit relève-t-il du secteur public ? → RGAA 4.x en France

**Note 2026** : EN 301 549 v3.2.1 référence encore WCAG 2.1 AA pour la conformité juridique stricte, mais WCAG 2.2 AA est la baseline industry et sera intégré à la prochaine version harmonisée EN 301 549. Viser WCAG 2.2 AA dès aujourd'hui.

### 10.4 FinOps — ordre de grandeur

**En Discovery** : estimer à l'ordre de grandeur le coût de construction et le coût opérationnel. Pas une estimation précise — un ordre de grandeur pour éviter les surprises en Cadrage.

Éléments à estimer pour M+ :
- Coût de construction : jours de développement × coût horaire (ou coût en tokens IA)
- Coût opérationnel mensuel : cloud, LLM/API, observabilité, SaaS tiers
- Coût de ne pas construire : impact métier du problème non résolu
- Coût de l'accessoire : si le projet requiert AIPD, threat modeling, audit sécurité → budget séparé

**Règle FinOps IA** : un agent en boucle sans cap de budget peut brûler un budget mensuel en une nuit. Tout projet impliquant des appels LLM doit avoir un budget cap explicite défini en Discovery.

### 10.5 Observabilité — instrumentation future

**En Discovery** : identifier quels signaux seront nécessaires pour valider que le problème est résolu en Run.

```
Question clé : Comment saurons-nous que le problème est résolu une fois en production ?
Réponse attendue : SLI identifiés (disponibilité, latence, satisfaction, taux d'erreur...)
Artefact : liste de 2-3 SLI candidats à formaliser en Conception
```

---

## 11. Artefacts produits

### 11.1 Artefacts obligatoires

| Artefact | Chemin | Format | Classe minimale |
|----------|--------|--------|-----------------|
| Note Discovery | `docs/03-discovery/<id>-discovery-note.md` | Markdown | L |
| Fiche idée | Dans la Note Discovery (r1.md §1) | Section structurée | T |
| Problem Statement | Dans la Note Discovery (r1.md §2) | Section structurée | M |
| Grille DoD Discovery | `docs/03-discovery/<id>-dod-check.md` | Checklist | M |
| Classification de risque | Dans la Note Discovery | T/L/M/H/C + justification | T (toujours) |
| Recommandation | Dans la Note Discovery | build / pivot / kill | T (toujours) |
| Hypothèses formalisées | `docs/03-discovery/<id>-hypotheses.md` | Liste H-XXX | M |
| Décision-log entry | `.planning/09-logs/decision-log.md` | Ligne chronologique | M |
| Dashboard update | `.planning/00-dashboard/current-status.md` | Statut cycle | T (toujours) |

### 11.2 Artefacts conditionnels

| Artefact | Chemin | Condition |
|----------|--------|-----------|
| Spike report | `.planning/02-backlog/spikes/<id>-spike.md` | Si spike technique lancé |
| Opportunity Solution Tree | `docs/03-discovery/<id>-ost.md` | Mode Produit, M+ |
| Transcriptions entretiens | `docs/03-discovery/interviews/<date>-<personne>.md` | Mode Produit, M+ |
| Risk register entries | `.planning/08-risks/<type>/RISK-XXX.md` | H/C |
| AIPD trigger memo | `docs/09-security-compliance/aipd-trigger.md` | Si RGPD trigger détecté |
| FinOps estimation | Dans la Note Discovery | H/C |
| Bias log entry | `docs/03-discovery/bias-log.md` | Si biais détecté |

### 11.3 Artefacts jamais produits en Discovery

- Code (sauf prototype jetable de spike, NON déployé, effacé à la fin du spike)
- Backlog raffiné avec story points (appartient à Cadrage)
- ADR (Architecture Decision Records) sauf si décision architecturale prise dans un spike
- Plan de sprint ou roadmap (appartient à Cadrage/Planification)

---

## 12. Métriques et indicateurs

### 12.1 Métriques de performance de Discovery

| Métrique | Définition | Cible | Source |
|----------|------------|-------|--------|
| **Durée de Discovery** | Temps entre ouverture et clôture du cycle Discovery | T ≤ 30 min, L ≤ 2h, M ≤ 2j, H ≤ 5j, C ≤ 10j | `.planning/07-metrics/` |
| **Taux de pivot/kill** | % de Discoveries qui ne passent pas en Build | Healthy range : 20-40 % (trop bas = pas assez d'exploration, trop haut = DoR trop stricte) | Calculé trimestriellement |
| **Précision de classification** | % de changements dont la classe initiale correspond à la classe finale après Build | Cible : ≥ 80 % sans promotion | Comparaison Discovery vs Apprentissage |
| **Hypothèses validées / invalidées** | Ratio hypothèses confirmées vs infirmées par cycle | Valeur neutre — suivre la tendance | Log des hypothèses |
| **Taux de complétude DoR** | % de cycles Cadrage qui démarrent sans question bloquante ouverte | Cible : ≥ 90 % | Audit Cadrage |

### 12.2 Métriques DORA applicables à Discovery

DORA 2024 mesure 5 métriques officielles. En Discovery, les métriques directement applicables sont :

- **Change Lead Time** : la durée du Discovery contribue au lead time global. Un Discovery trop long (H prenant 3 semaines) détériore le lead time. Objectif : Discovery timeboxé par classe.
- **Rework Rate** *(nouveau DORA 2024)* : un Discovery incomplet génère du rework en Build ou Validation. Mesurer le rework issu d'hypothèses Discovery non validées.

### 12.3 Métriques qualité ISO 25010 à déclarer en Discovery

Pour chaque caractéristique prioritaire identifiée, déclarer :

```
Caractéristique : [nom]
Seuil de discovery : [valeur cible à mesurer en Run]
Méthode de mesure : [comment on mesurera]
GateType `stop` : [seuil en dessous duquel on retourne en Discovery ou on stoppe]
```

### 12.4 Indicateurs de santé du Discovery continu

- Fréquence d'entretiens utilisateurs : ≥ 1 par semaine (Torres) en mode Produit
- Âge du dernier entretien : alerte si > 4 semaines sans contact utilisateur
- Backlog d'opportunités OST : > 0 opportunités ouvertes (sinon le pipeline Discovery est vide)
- Hypothèses ouvertes > 90 jours sans confirmation : RED CARD automatique

---

## 13. Standards de référence

| Domaine | Standard | Version | Statut 2026 | URL |
|---------|----------|---------|-------------|-----|
| Qualité produit | ISO/IEC 25010 | 2023 | Référence officielle courante — 9 caractéristiques, Safety ajouté | iso.org/standard/78176.html |
| Sécurité SDLC | NIST SSDF | SP 800-218 v1.1 | Officiel. v1.2 en draft public (jan 2026) — ne pas citer v1.2 comme officiel | csrc.nist.gov |
| Sécurité applicative | OWASP Top 10 | 2025 | Publié — 175 000 CVEs analysés. A01 Broken Access Control, A02 Security Misconfiguration, A10 Mishandling Exceptional Conditions (nouveau) | owasp.org/Top10/2025 |
| Maturité sécurité | OWASP SAMM | v2 | Référence courante | owaspsamm.org |
| Exigences sécurité | OWASP ASVS | v5 (draft) | Check final version | owasp.org |
| Accessibilité | WCAG | 2.2 (oct 2023) | Baseline industry. EAA en vigueur depuis 28/06/2025. EN 301 549 v3.2.1 référence encore WCAG 2.1 légalement | w3.org/TR/WCAG22 |
| Accessibilité UE | EAA / Directive 2019/882 | En vigueur | 28/06/2025 — pénalités nationales actives | eur-lex.europa.eu |
| Performance livraison | DORA | Rapport 2024 | 5 métriques : CLT, DF, FDRT (ex-MTTR), CFR, Rework Rate (nouveau). 19 % d'équipes Elite | dora.dev/research/2024 |
| Privacy | RGPD | UE 2016/679 | Art. 25 (by design), 32 (sécurité), 33 (notification), 35 (AIPD) | eur-lex.europa.eu |
| Privacy méthode | CNIL PIA | Actuel | Guide + logiciel libre | cnil.fr |
| FinOps | FinOps Foundation | Framework 2024 | Inclut LLM/AI cost management. 30x-200x variance coût optimisé vs non optimisé | finops.org |
| Discovery | Continuous Discovery | Torres 2021 | Méthode de référence — OST, JTBD, product trio | producttalk.org |
| Observabilité | OpenTelemetry | Actuel | Standard de facto | opentelemetry.io |
| Rétrospective | Google SRE | Livre + Workbook | Postmortem blameless | sre.google |
| Culture | Westrum | Typology | Prédicteur DORA le plus fort | dora.dev |
| Harness IA | Anthropic Engineering | 2025-2026 | Patterns officiels : harness design, effective long-running agents | anthropic.com/engineering |

---

## 14. Questions ouvertes — RED CARDS

Les RED CARDS listent les risques de décision encore ouverts ou récemment fermés par le contrat PFV4. Les entrées fermées ne bloquent plus discovery ; les entrées ouvertes doivent garder un responsable, une échéance et un impact documenté.

### RC-001 — Classification de risque mécanique

**Question** : Comment opérationnaliser la classification T/L/M/H/C de manière déterministe et résistante au biais de l'auteur ?

**Impact** : sans mécanisation, la classification reste subjective. Le système fonctionne mais avec un curseur flou — risque de sous-estimer H/C et de passer en bypass sur des changements risqués.

**Pistes** :
- Arbre de décision déterministe (touche auth → H minimum, touche données santé → C minimum)
- Critères automatisables : parsing des fichiers touchés, labels git, scan de migrations
- Critères ambigus → requête humaine obligatoire

**Priorité** : ÉLEVÉE — à formaliser dans les deux premiers cycles Build

**Propriétaire** : Développeur (décision architecturale)

**Statut** : fermé par le contrat PFV4 pour la taxonomie (`RiskClass = T/L/M/H/C`) ; la mécanisation fine reste une amélioration non bloquante.

---

### RC-002 — State machine du harness formalisée

**Question** : Quel est le schéma formel des états, transitions, conditions, et actions autorisées du harness ?

**Impact** : sans state machine formalisée, le harness reste une boîte noire. Évolution risquée de désynchroniser avec l'architecture des fichiers.

**Pistes** :
- `docs/01-governance/operating-model.md` (conceptuel)
- `.planning/state.yaml` (état canonique)
- `.planning/current-risk.yaml` (risque courant)
- `.planning/run-set.json` (ensemble d'exécution)

**Priorité** : ÉLEVÉE — à formaliser avant le premier sprint de complexité M+

**Propriétaire** : Développeur

**Statut** : fermé par le contrat PFV4 storage strict (`.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json`).

---

### RC-003 — Protocole de promotion de classe en cours de cycle

**Question** : Quand une classe L se révèle H en cours d'exploration, quel est le protocole exact ?

**Impact** : sans protocole, la promotion reste un concept — la classification initiale ne s'améliore jamais, et les sous-estimations se répètent.

**Pistes** :
- Détection (qui, quand, déclencheur)
- Action immédiate (pause du cycle, re-Discovery, re-Conception)
- Traçabilité (log de la promotion, métadonnées)
- Apprentissage (feed-forward vers amélioration de la classification future)

**Priorité** : MOYENNE — à formaliser avant le premier incident de promotion

**Propriétaire** : Développeur

**Statut** : fermé par le contrat PFV4 : promotion tracée dans `.planning/current-risk.yaml`, transition enregistrée dans `.planning/state.yaml`, puis reprise du cycle à la SubPhase appropriée.

---

### RC-004 — Modèle ISO 25010:2023 instancié

**Question** : Pour ce projet (harness de développement solo + IA), quelles sont les 3-5 caractéristiques ISO 25010 prioritaires avec des seuils mesurables ?

**Impact** : sans modèle instancié, les quality gates ressemblent à une checklist arbitraire plutôt qu'à l'expression d'un modèle conscient.

**Pistes** :
- `docs/08-quality/quality-model-instance.md` par projet
- Caractéristiques critiques (Security, Reliability) avec seuils mesurables
- Caractéristiques importantes avec budgets
- Caractéristiques explicitement dépriorisées

**Priorité** : MOYENNE — à formaliser en Cadrage ou au plus tard en Conception

**Propriétaire** : Développeur

**Statut** : Ouvert (rapport-discovery-cadrage.md §4.4)

---

### RC-005 — Mémoire à long terme structurée

**Question** : Comment transformer l'archive des cycles passés en mémoire active interrogeable pour informer les décisions présentes ?

**Impact** : sans mémoire active, chaque cycle Discovery redémarre à zéro. L'historique existe mais n'informe pas.

**Pistes** :
- Index sémantique des décisions passées (ADR searchable)
- Base de patterns récurrents (bugs, classes de risque sous-estimées)
- Journal des biais détectés (agent + développeur)

**Priorité** : BASSE — peut attendre Build. Reporté explicitement.

**Propriétaire** : Développeur

**Statut** : Reporté (rapport-discovery-cadrage.md §3.7 + §4.3)

---

### RC-006 — Validation des hypothèses H1-H7

**Question** : Parmi les 7 hypothèses fondatrices (rapport-discovery-cadrage.md §8), au moins une doit être confrontée au réel avant de sortir de Discovery en direction du Build réel.

**Hypothèses** :
- H1 : classification 5 niveaux suffisante
- H2 : auto tenable sans rubber-stamp
- H3 : mono-état tenable pour dev solo
- H4 : économie planning ne dégrade pas la traçabilité utile
- H5 : agent respecte les frontières du harness
- H6 : Strangler Fig applicable à tous changements architecture significatifs
- H7 : cycle s'auto-améliore via rétros/postmortems

**Priorité** : ÉLEVÉE pour H2, H3, H5 — les plus risquées si fausses

**Statut** : Ouvert — critère souhaitable de sortie de Discovery (rapport-discovery-cadrage.md §9.2)

---

## 15. Relations inter-cycles

### 15.1 Discovery → Cadrage (cycle suivant)

Discovery alimente Cadrage avec :
- Problem statement validé (r1.md §2) — checkpoint obligatoire M+
- Classification de risque initiale (T/L/M/H/C) — always
- Recommandation build/pivot/kill — always
- Hypothèses formalisées (r1.md §16) — à partir de L
- Liste des contraintes réglementaires identifiées — à partir de M
- Première estimation FinOps (ordre de grandeur) — à partir de H
- Liste des parties prenantes (r1.md §4) — à partir de M
- 19 sections r1.md avec statut (défini/à confirmer/bloquant/etc.) — à partir de M

**Ce que Discovery ne livre PAS à Cadrage** : backlog raffiné, story points, plan de sprint, ADR complets, threat model. Ces éléments appartiennent à Cadrage, Conception ou Build.

### 15.2 Cadrage → Discovery (feedback)

Cadrage peut renvoyer en Discovery si :
- La DoR de Cadrage n'est pas satisfaite (problème insuffisamment validé)
- Un nouveau scope émerge en Cadrage qui nécessite une exploration préalable
- La classification de risque initiale est promue (L → H) suite à l'analyse fonctionnelle

### 15.3 Apprentissage → Discovery (feedback entrant)

Le cycle [08 Apprentissage] est le principal fournisseur de signaux entrants pour Discovery :
- Rétros de cycle : apprentissages transposables en nouvelles opportunités
- Postmortems blameless : causes racines qui révèlent un problème systémique non encore exploré
- Métriques DORA dégradées : Rework Rate élevé peut indiquer Discovery insuffisant en amont

### 15.4 Run → Discovery (signal continu)

Le cycle [07 Run] génère des signaux continus qui alimentent le Discovery continu :
- SLO dégradés → signal de fiabilité à explorer
- Error budget brûlé → signal de stabilité à explorer
- Support tickets récurrents → opportunité Discovery mode Produit
- Coût unitaire en dérive > 20 % sans justification → signal FinOps à explorer

### 15.5 Parallélisme et mono-état actuel

La contrainte actuelle est le **mono-état strict** : un seul cycle Discovery actif à la fois. Si un signal entrant de Run arrive pendant un Discovery H en cours, il est enregistré dans le backlog d'opportunités OST mais ne déclenche pas un second Discovery parallèle. Cette limitation est assumée et reportée (RC-005 adjacent — multi-états par objet est le chemin cible).

```
Règle de non-préemption :
Un Discovery de classe inférieure ne préempte pas un Discovery de classe supérieure en cours.
Un signal C peut interrompre un Discovery L en cours (et seulement C).
```

### 15.6 Vue des relations inter-cycles

```
[08 learning]
  postmortems, rétros, patterns récurrents
         │
         ▼
[01 discovery] ◄─── [07 run] (SLO, error budget, tickets, FinOps drift)
     │
     │ Problem validé + classification + recommandation
     ▼
[02 cadrage]
     │
     │ (si retour) DoR non satisfaite → retour Discovery
     │
     ▼
[03 conception]
...
[05 validation]
     │
     │ (si problème non résolu détecté) → retour Discovery
     ▼
[06 release] → [07 run] → [08 learning] → (nouveau signal) → [01 discovery]
```

---

## Annexe A — Checklist Discovery (paste-ready)

```markdown
## Discovery — Checklist de sortie

### Identification
- Cycle ID : DISC-XXX
- Date ouverture :
- Date clôture :
- Classe de risque : [ ] T  [ ] L  [ ] M  [ ] H  [ ] C
- Mode : [ ] Produit  [ ] Self-feedback  [ ] Technique
- Recommandation : [ ] Build  [ ] Pivot  [ ] Kill

### DoD stricte (toutes classes)
- [ ] Fiche idée complète (r1.md §1)
- [ ] Problème nommé : réel / observé / supposé (distinction explicite)
- [ ] Recommandation tranchée (build/pivot/kill)
- [ ] Classe de risque proposée avec justification
- [ ] Hypothèses listées et classées
- [ ] Questions ouvertes avec responsable + impact + échéance
- [ ] Note Discovery versionnée dans docs/03-discovery/

### DoD conditionnelle M+
- [ ] Problem Statement formalisé (r1.md §2)
- [ ] Parties prenantes identifiées (r1.md §4)
- [ ] Usage prévu + exclusions (r1.md §5-6)
- [ ] Signal privacy/RGPD (OUI/NON + détail)
- [ ] Signal accessibilité EAA/WCAG 2.2 (OUI/NON)
- [ ] Hypothèses formalisées format H-XXX
- [ ] 19 sections r1.md avec statut

### DoD conditionnelle H/C
- [ ] Entretiens utilisateurs ≥ 5 ou source quantitative équivalente
- [ ] Risques principaux listés (r1.md §12)
- [ ] Contraintes réglementaires identifiées (r1.md §11)
- [ ] Estimation FinOps ordre de grandeur
- [ ] Spike technique si faisabilité incertaine
- [ ] Review développeur + IA antagoniste (≥ 3 arguments contre validés)
- [ ] AIPD trigger check (si données personnelles)

### Transmission vers Cadrage
- [ ] Dashboard mis à jour : cycle = DISCOVERY, statut = DONE
- [ ] Cycle Cadrage déclenché (si build) avec tous les livrables listés ci-dessus
```

---

## Annexe B — Fiche idée (template)

```markdown
## Fiche Idée — [DISC-XXX]

**Titre** :
**Date** :
**Classe de risque** : T / L / M / H / C
**Mode** : Produit / Self-feedback / Technique

### Contexte
[Quelle est la situation actuelle ? Pourquoi cette idée émerge maintenant ?]

### Problème observé
[Quel est le problème exact ? Est-il réel, mesuré, ou supposé ?]

### Population concernée
[Qui souffre du problème ? Qui est impacté ?]

### Impact actuel
[Que se passe-t-il si on ne fait rien ?]

### Opportunité
[Quelle valeur attend-on de la résolution ?]

### Hypothèses
- H-001 : [affirmation] — à confirmer par [qui] avant [quand]
- H-002 : ...

### Contraintes connues
[Réglementaires, techniques, budgétaires, temporelles]

### Recommandation
[ ] Build — [justification]
[ ] Pivot — [direction alternative]
[ ] Kill — [pourquoi]

### Critères de passage en Cadrage
[Qu'est-ce qui doit être vrai pour aller en Cadrage ?]
```

---

## Annexe C — Tensions et arbitrages actifs

Ces tensions sont documentées depuis le rapport-discovery-cadrage.md §7 et restent actives en Discovery.

| Tension | Description | Arbitrage actuel |
|---------|-------------|-----------------|
| **Rigueur vs vélocité** | Cadre détaillé protège contre les oublis mais ralentit | Modulation par risque — T/L chemin court, H/C chemin long |
| **auto vs rubber-stamp** | auto dégrade silencieusement en bypass si on valide sans lire | Format de proposition obligatoire, quota mental ≥ 20 % rejets, audit aléatoire |
| **bypass vs perte de contrôle** | bypass libère du temps mais risque de décision mal prise | bypass borné aux T/L, jamais H/C, quality gates bloquants |
| **Documentation vs économie tokens** | Tracer permet la mémoire mais coûte des tokens | Doc produit à fond, planning au strict nécessaire à la prochaine décision |
| **Discovery continue vs procrastination** | Continuer à raffiner sans confronter au réel est procrastination sophistiquée | Timebox par classe, critères de sortie binaires, recommandation tranchée |

---

*Document de référence — Pipeline fractale v4 — Cycle 01 Discovery*
*Sources croisées : rapport-discovery-cadrage.md (SOURCE OF TRUTH) · r1.md (19 sections) · compass-v3.md · folder.md · ISO/IEC 25010:2023 · NIST SSDF v1.1 · OWASP Top 10:2025 · WCAG 2.2 + EAA 2025 · DORA 2024 · FinOps Foundation 2024 · Anthropic Engineering 2025-2026*
