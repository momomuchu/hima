# Cycle 02 — Cadrage : Concepts et Critères

> Document de référence architectural pour le cycle Cadrage de la Pipeline Fractale v4.
> Sources : rapport-discovery-cadrage.md (source de vérité), r1.md, compass_artifact (v3), folder.md, ISO/IEC 25010:2023, DORA 2024/2025, NIST SSDF SP 800-218 v1.1 (v1.2 en draft public depuis déc. 2025), OWASP ASVS 5.0 (mai 2025), WCAG 2.2 + EAA 2025.
> Version : 2026-05-03. Langue : FR. Scope : architecture only — aucune implémentation.

---

## 1. Résumé exécutif

Le cycle Cadrage est le **verrou de périmètre** de la Pipeline Fractale v4. Il transforme le problème validé en Discovery en un engagement partagé contractualisé : périmètre IN/OUT explicite, exigences fonctionnelles et non fonctionnelles mesurables, classification de risque formelle T/L/M/H/C, priorisation MoSCoW + RICE, contraintes techniques/budget/délais/réglementaires identifiées, critères d'acceptation testables, et DoR formelle pour le cycle Conception.

Sans cadrage solide, toute l'énergie de Conception, Build et Validation est susceptible d'être mal orientée. C'est le cycle où le coût de l'erreur est encore minimal — une décision de périmètre corrigée ici coûte 1×, corrigée en Build elle coûte 10×, corrigée en production elle coûte 100×.

**Invariants de ce cycle :**
- Tout ce qui n'est pas explicitement inclus est hors périmètre.
- Toute exigence sans critère d'acceptation testable n'est pas une exigence.
- Toute décision architecturale préliminaire génère un ADR, même provisoire.
- La classe de risque est proposée par l'auteur et validée par une deuxième lecture (ou l'agent IA en mode antagoniste en solo).

---

## 2. Position dans le pipeline

```
[discovery] ──▶ [cadrage] ──▶ [conception] ──▶ [build] ──▶ [validation] ──▶ [release] ──▶ [run] ──▶ [learning]
                    ▲
                 Cycle 02
```

**Entrée** : Note de Discovery avec problème validé, hypothèses confirmées, taille d'effort à l'ordre de grandeur.

**Sortie** : Dossier de cadrage complet respectant la DoR Conception (§4 et §5), comprenant périmètre figé, exigences, risques classifiés, ADR préliminaires, et estimation macro.

**Feedbacks reçus** : Discovery (re-validation problème si scope pivot), Apprentissage (patterns récurrents de cadrage insuffisant).

**Feedbacks envoyés** : Conception (DoR formelle), Run (contraintes opérationnelles early), Apprentissage (hypothèses de cadrage à confronter).

---

## 3. Objectif du cycle

### 3.1 Objectif principal

Produire un **dossier de cadrage** suffisamment précis pour que le cycle Conception puisse démarrer sans ambiguïté majeure sur le périmètre, les exigences, les risques ou les contraintes.

### 3.2 Objectifs secondaires

- Éliminer l'implicite : tout élément est Défini / Non défini / Non applicable / À confirmer / Risque accepté / Hors périmètre / Bloquant.
- Créer la première version de la matrice de risque projet avec classification T/L/M/H/C.
- Identifier les décisions architecturales préliminaires nécessitant un ADR.
- Établir le performance budget (technique ET financier) dès le cadrage.
- Déclencher l'AIPD/DPIA préliminaire si le seuil RGPD est atteint.
- Poser les bases de l'estimation macro pour arbitrage MoSCoW/RICE.

### 3.3 Ce que le cadrage n'est PAS

- Ce n'est pas le moment de concevoir la solution technique détaillée — c'est le rôle de Conception.
- Ce n'est pas une phase one-shot : si un scope pivot est détecté en Build, on revient en Cadrage.
- Ce n'est pas un document exhaustif sur tous les sujets — c'est un dossier ciblé sur les décisions bloquantes.

---

## 4. Entrées (DoR — Conditions d'entrée en Cadrage)

Le cycle Cadrage ne démarre que si **tous** les critères stricts ci-dessous sont satisfaits. Les critères souhaitables peuvent être incomplets mais doivent être explicitement marqués.

### 4.1 Critères stricts (bloquants)

- [ ] **Note de Discovery** produite : problème formulé, utilisateur cible identifié, hypothèses écrites.
- [ ] **Validation problème** : ≥ 5 échanges utilisateurs (ou source quantitative équivalente) ; en mode Self-feedback solo, ≥ 3 itérations écrites de formalisation.
- [ ] **Solution candidate** : au moins une hypothèse falsifiable sur l'approche de solution.
- [ ] **Taille d'effort** : estimée à l'ordre de grandeur (S/M/L/XL ou jours/semaines/mois).
- [ ] **Source du besoin identifiée** : mode Produit (utilisateurs externes) / Self-feedback (développeur = utilisateur) / Technique (changement d'architecture).
- [ ] **OperatingMode décidé** : `pairing` / `auto` / `bypass` — et classe de risque global pressentie.

### 4.2 Critères souhaitables

- [ ] Opportunity Solution Tree existant (Discovery mode Produit).
- [ ] ADR ou note de spike si décision technique en Discovery.
- [ ] Contraintes connues listées (budget, deadline, réglementaire).

### 4.3 Critères différés acceptés

- Classification de risque mécanisée (arbre de décision déterministe).
- Modèle ISO 25010 instancié pour le projet.
- State machine du harness formalisée.

---

## 5. Sorties (DoD — Conditions de sortie du Cadrage)

Le cycle Cadrage est terminé et la DoR Conception est satisfaite quand **tous** les points suivants sont vrais.

### 5.1 Périmètre

- [ ] Périmètre IN explicite (fonctions, parcours, utilisateurs, données, interfaces inclus).
- [ ] Périmètre OUT explicite (exclusions formelles, non-ambiguës).
- [ ] Périmètre DEFERRED explicite (éléments identifiés mais reportés avec justification).
- [ ] Usage prévu écrit : « Le système est destiné à… Il ne fait pas… Il ne remplace pas… ».

### 5.2 Exigences

- [ ] Exigences fonctionnelles (EF) écrites avec identifiant (EF-NNN).
- [ ] Exigences non fonctionnelles (ENF) écrites avec seuils mesurables (ENF-NNN).
- [ ] Chaque EF a ≥ 1 critère d'acceptation testable (format Given-When-Then ou équivalent).
- [ ] Chaque ENF a un seuil numérique ou une règle vérifiable.
- [ ] Règles métier critiques documentées (RM-NNN) avec tests attendus.

### 5.3 Risques

- [ ] Registre de risques initialisé (RIS-NNN) avec classification T/L/M/H/C.
- [ ] Risques H et C ont une mesure de mitigation proposée.
- [ ] Première classification de risque global du projet (T/L/M/H/C).

### 5.4 Priorisation

- [ ] Priorisation MoSCoW appliquée aux exigences : Must / Should / Could / Won't.
- [ ] Score RICE calculé pour les Must Have ambigus (Reach × Impact × Confidence / Effort).

### 5.5 Contraintes

- [ ] Contraintes réglementaires identifiées : RGPD, EAA, sectorielles.
- [ ] Contraintes budgétaires et temporelles explicites.
- [ ] Contraintes techniques explicites (stack, compatibilité, dépendances imposées).
- [ ] Performance budget défini : latence cible, disponibilité cible, €/utilisateur ou €/transaction.

### 5.6 Décisions architecturales

- [ ] ADR préliminaires produits pour toute décision structurante identifiée.
- [ ] AIPD/DPIA déclenchée si données personnelles à risque élevé (checklist CNIL WP29).

### 5.7 Estimation

- [ ] Estimation macro par classe de risque : nombre d'items T/L/M/H/C pressentis.
- [ ] Hypothèses de cadrage listées (H-NNN) avec impact si fausse.
- [ ] Questions ouvertes listées (RED CARDS §14) avec responsable et échéance.

---

## 6. Concepts clés

### 6.1 Périmètre (Scope)

Le périmètre est la **frontière contractuelle** entre ce que le système fait et ce qu'il ne fait pas. Tout ce qui n'est pas explicitement inclus est exclu par défaut.

Structure en trois zones :

```
INCLUS          → développé dans ce cycle ou cette release
EXCLU           → hors périmètre, jamais dans ce projet
DIFFÉRÉ         → identifié mais reporté (version suivante ou phase ultérieure)
```

Anti-pattern majeur : laisser des éléments dans une zone grise « on verra plus tard ». Chaque élément identifié **doit** être classé dans une des trois zones ou marqué explicitement comme décision ouverte avec responsable et date.

### 6.2 Exigences fonctionnelles (EF)

Ce que le système **fait** : les comportements, fonctions, règles métier, et transformations que le système doit réaliser.

Format recommandé :

```
EF-001 — [Titre court]
Description : Le système doit permettre [à qui] de [faire quoi] [dans quel contexte].
Critères d'acceptation :
  - Étant donné [contexte], quand [action], alors [résultat attendu].
  - Étant donné [contexte d'erreur], quand [action], alors [message d'erreur explicite].
Règle métier liée : RM-NNN (si applicable)
Classe de risque : T / L / M / H / C
MoSCoW : Must / Should / Could / Won't
```

### 6.3 Exigences non fonctionnelles (ENF)

Ce que le système **est** : les qualités, contraintes de performance, sécurité, disponibilité, maintenabilité. Référencées sur ISO/IEC 25010:2023 (9 caractéristiques).

Format recommandé :

```
ENF-001 — [Titre court]
Caractéristique ISO 25010 : [ex. Performance efficiency / Reliability / Security]
Seuil mesurable : [ex. p99 < 200 ms sous charge nominale de 100 rps]
Méthode de vérification : [outil, test de charge, monitoring]
Classe de risque : T / L / M / H / C
```

### 6.4 Classification de risque T/L/M/H/C

La classification est le **pivot d'adaptation** de toute la pipeline. Elle détermine la profondeur du cycle, les gates obligatoires, le mode opératoire par défaut, et la stratégie de déploiement.

| Classe | Définition | Chemin pipeline |
|--------|-----------|----------------|
| **T — Trivial** | Cosmétique, doc, refactor sans changement de comportement, patch sans CVE. Code path testé par des tests existants. | Chemin ultra-court : commit direct, CI vert, merge. |
| **L — Low** | Nouvelle fonctionnalité isolée derrière feature flag, pas de donnée perso., pas de migration. | Chemin court : DoR légère, tests unitaires + intégration, revue solo. |
| **M — Moyen** | Fonctionnalité visible utilisateur, pas de PII sensible, pas de schéma DB, pas d'impact tiers. | Chemin standard : DoR formelle, analyse fonctionnelle, tests, QA. |
| **H — High** | Touche authentification, autorisation, paiement, données personnelles, schéma DB, API publique, infra prod. | Chemin long : threat modeling STRIDE, AIPD si données perso., tests de charge, canary deploy. |
| **C — Critique** | Impact transverse multi-services, données sensibles (santé, biométrie, financières), refonte d'architecture, rupture contrat API, exigence réglementaire (RGPD, EAA, NIS2, DORA UE). | Chemin complet : tout le cycle, audit indépendant, feature flag obligatoire, postmortem prévu. |

**Règle de classification en cadrage** : l'auteur propose, une deuxième lecture valide ou conteste. En solo, l'agent IA joue le rôle de reviewer antagoniste. La classification est inscrite dans chaque EF, ENF et item de backlog.

**Règle de promotion** : si en cours de cycle on découvre qu'un item classé L est en réalité H, on déclenche une re-classification formelle avec re-cadrage partiel des activités obligatoires manquantes.

### 6.5 MoSCoW (priorisation qualitative)

Cadre de priorisation pour le périmètre et les exigences, issu du DSDM Agile Business Consortium.

| Catégorie | Signification | Règle solo |
|-----------|--------------|-----------|
| **Must Have** | Non négociable — sans ça, le système ne répond pas au problème. | ≤ 60 % de la capacité estimée. |
| **Should Have** | Important mais contournable temporairement. | ≤ 20 % de la capacité. |
| **Could Have** | Souhaitable, faible impact si absent. | ≤ 20 % de la capacité. |
| **Won't Have** | Hors périmètre pour ce cycle — explicitement reporté, pas oublié. | Documenté avec justification. |

Anti-pattern : tout mettre en Must Have (si tout est prioritaire, rien ne l'est). La discipline MoSCoW exige une sélection stricte : les Must ne doivent pas dépasser la capacité réaliste du cycle.

### 6.6 RICE (priorisation quantitative)

Score RICE = (Reach × Impact × Confidence) / Effort

| Facteur | Définition | Échelle recommandée solo |
|---------|-----------|------------------------|
| **Reach** | Nombre d'utilisateurs/sessions touchés par période | 0–10 (10 = tous les utilisateurs) |
| **Impact** | Impact sur l'objectif principal si délivré | 0.25 / 0.5 / 1 / 2 / 3 |
| **Confidence** | Certitude sur Reach et Impact | 50 % / 80 % / 100 % |
| **Effort** | Nombre de semaines-personne | Estimation en jours ou points |

Usage en cadrage : RICE est appliqué aux Must Have ambigus pour arbitrer l'ordre de traitement quand la capacité est contrainte. Ne pas sur-mécaniser — RICE est un aide à la décision, pas un oracle.

### 6.7 ADR préliminaire

Un ADR (Architecture Decision Record) de cadrage est produit quand une décision structurante est identifiée **avant** d'entrer en Conception. Il est marqué « PRÉLIMINAIRE » et sera confirmé ou amendé en Conception.

Format MADR 4.0 minimum :

```markdown
# ADR-NNN — [Titre de la décision]

Status: PRELIMINARY | ACCEPTED | SUPERSEDED
Date: YYYY-MM-DD
Deciders: [auteur + reviewer]

## Contexte
[Pourquoi cette décision doit être prise maintenant]

## Options considérées
1. [Option A]
2. [Option B]
3. [Option C — ne rien décider maintenant]

## Décision
[Option choisie] parce que [critères de décision]

## Conséquences
Positives : ...
Négatives : ...
Risques résiduels : ...

## Critères d'invalidation
[Conditions qui remettraient cette décision en question]
```

### 6.8 Performance budget

Le performance budget est la **promesse mesurable** faite à l'utilisateur et à l'organisation sur les qualités non fonctionnelles. Il couvre deux dimensions :

**Budget technique** : latence (p50, p99), disponibilité (SLO), taille de payload, temps de chargement, débit.

**Budget financier** (FinOps) : €/utilisateur actif, €/transaction, €/requête API/LLM, €/build CI. Sans budget financier explicite, les dérives de coût sont invisibles jusqu'à la facture.

### 6.9 AIPD/DPIA — déclencheur en cadrage

L'AIPD (Analyse d'Impact relative à la Protection des Données) est **obligatoire** selon l'art. 35 RGPD si le traitement envisagé coche ≥ 2 des critères WP29. En cadrage, la vérification se fait via une checklist rapide — si le seuil est atteint, l'AIPD est lancée en parallèle de la Conception.

Critères WP29 de déclenchement :
1. Évaluation ou scoring (y compris profilage)
2. Décision automatisée avec effet juridique ou significatif
3. Surveillance systématique
4. Données sensibles (santé, biométrie, convictions, etc.)
5. Données à grande échelle
6. Croisement ou combinaison de jeux de données
7. Données de personnes vulnérables (enfants, patients, etc.)
8. Usage innovant ou nouvelle technologie
9. Transfert hors UE sans garanties adéquates
10. Empêche l'exercice d'un droit ou l'accès à un service

---

## 7. Critères qualité — ISO/IEC 25010:2023

ISO/IEC 25010:2023 définit 9 caractéristiques de qualité produit. En cadrage, l'objectif est de **sélectionner 3 à 5 caractéristiques prioritaires** pour le projet en cours, définir des seuils mesurables, et déprioriser explicitement les autres.

### 7.1 Les 9 caractéristiques (version 2023)

| # | Caractéristique | Sous-caractéristiques clés | Évolution vs 2011 |
|---|----------------|---------------------------|-------------------|
| 1 | **Functional Suitability** | Completeness, Correctness, Appropriateness | Inchangé |
| 2 | **Performance Efficiency** | Time behaviour, Resource utilization, Capacity | Inchangé |
| 3 | **Compatibility** | Co-existence, Interoperability | Inchangé |
| 4 | **Interaction Capability** | Appropriateness, Learnability, Operability, **Accessibility**, UX, User error protection | Renommé (ex-Usability) |
| 5 | **Reliability** | Faultlessness, Availability, Fault tolerance, Recoverability | Inchangé |
| 6 | **Security** | Confidentiality, Integrity, Non-repudiation, Accountability, Authenticity, Resistance | Inchangé |
| 7 | **Maintainability** | Modularity, Reusability, Analysability, Modifiability, Testability | Inchangé |
| 8 | **Flexibility** | Adaptability, Scalability, Installability, Replaceability | Renommé (ex-Portability) |
| 9 | **Safety** | Operational constraint, Risk identification, Fail safe, Hazard warning, Safe integration | **NOUVEAU en 2023** |

### 7.2 Modèle ISO 25010 instancié par projet

En cadrage, produire un document `quality-model-instance.md` selon ce patron :

```markdown
# Modèle qualité — [Nom du projet]

## Caractéristiques prioritaires (top 3-5)

| Caractéristique | Pourquoi prioritaire | Seuil mesurable | Méthode de vérification |
|----------------|---------------------|-----------------|------------------------|
| Reliability | Système critique, downtime = perte directe | Disponibilité ≥ 99.5 % / mois | SLO monitoring, alerting multi-burn-rate |
| Security | Données personnelles manipulées | Zéro CVE Critical en prod | SAST + SCA en CI, DAST sur preprod |
| Performance Efficiency | Expérience utilisateur temps réel | p99 < 200 ms sous 100 rps | Tests de charge k6, Lighthouse CI |

## Caractéristiques importantes (budget alloué)

| Caractéristique | Budget |
|----------------|--------|
| Maintainability | Couverture ≥ 80 % zones critiques, mutation score > 70 % |
| Interaction Capability | WCAG 2.2 AA, axe-core vert en CI |

## Caractéristiques explicitement dépriorisées

| Caractéristique | Justification |
|----------------|--------------|
| Safety | Pas de risque physique ou d'intégrité corporelle dans ce contexte |
| Flexibility | Pas de besoin de portabilité multiplateforme à ce stade |
```

### 7.3 Mapping ISO 25010 → classes de risque

| Caractéristique ISO 25010 | Classe minimale déclenchée |
|--------------------------|--------------------------|
| Security (confidentiality, integrity) | H si données personnelles, C si données sensibles |
| Reliability (availability) | M si SLO défini, H si service critique |
| Safety | C systématiquement (nouveau critère 2023) |
| Functional Suitability (correctness) | M minimum sur toute fonctionnalité visible utilisateur |
| Performance Efficiency | M si SLO latence défini |
| Interaction Capability (accessibility) | M minimum (EAA en vigueur depuis juin 2025) |

---

## 8. Modulation par classe de risque

### 8.1 Profondeur des activités de cadrage selon la classe

| Activité de cadrage | T | L | M | H | C |
|--------------------|:-:|:-:|:-:|:-:|:-:|
| Périmètre IN/OUT | ◔ | ○ | ✅ | ✅ | ✅ |
| EF avec AC testables | ◔ | ○ | ✅ | ✅ | ✅ |
| ENF avec seuils | — | ◔ | ✅ | ✅ | ✅ |
| Règles métier documentées | — | ◔ | ○ | ✅ | ✅ |
| Registre risques | — | ◔ | ✅ | ✅ | ✅ |
| MoSCoW | — | ◔ | ✅ | ✅ | ✅ |
| RICE sur ambiguïtés | — | — | ○ | ✅ | ✅ |
| Performance budget technique | — | ◔ | ✅ | ✅ | ✅ |
| Performance budget financier | — | — | ○ | ✅ | ✅ |
| ADR préliminaires | — | ◔ | ○ | ✅ | ✅ |
| Checklist AIPD/DPIA | — | — | conditionnel | ✅ si perso. | ✅ |
| Checklist accessibilité EAA | — | ◔ | ✅ | ✅ | ✅ |
| Matrice permissions initiale | — | — | ○ | ✅ | ✅ |
| Contraintes réglementaires | — | ◔ | ✅ | ✅ | ✅ |
| Estimation macro | ◔ | ✅ | ✅ | ✅ | ✅ |
| Hypothèses formalisées (H-NNN) | — | ◔ | ✅ | ✅ | ✅ |

Légende : ✅ Obligatoire | ○ Recommandé | ◔ Allégé | — Skippable

### 8.2 Mode opératoire par classe

| Classe | Mode par défaut | bypass autorisé | Validation humaine |
|--------|----------------|-----------------|-------------------|
| T | auto | Oui | Non requise |
| L | auto | Oui | Non requise |
| M | auto | Sous conditions | Checkpoints selon DoR formelle |
| H | pairing recommandé | Non | Sur la DoR + ADR |
| C | pairing obligatoire | Interdit | Sur DoR + ADR + revue externe |

`auto` est le mode autonome par défaut : l'agent avance sans supervision continue, mais déclenche des checkpoints et une validation humaine dès que la classe de risque ou une politique l'exige.

### 8.3 Strangler Fig pour les refontes

Tout changement identifié comme H/C en cadrage et concernant une architecture existante doit déclencher une stratégie Strangler Fig :

1. Définir la façade (interface de routage vers ancien/nouveau).
2. Décomposer le changement H/C en séquence d'items L/M.
3. Chaque item L/M suit le chemin de risque approprié.
4. L'ADR préliminaire documente la stratégie de migration.

---

## 9. Sous-cycle fractal (7 étapes appliquées au Cadrage)

Chaque cycle de la Pipeline Fractale applique le même sous-cycle universel : Observer → Define → Design → Execute → Verify → Capitalize → Transmit. Voici l'instanciation pour le cycle Cadrage.

### 9.1 Observer

**But** : lire et comprendre les artefacts de Discovery sans a priori.

Activités :
- Lire la Note de Discovery en entier, noter les ambiguïtés.
- Identifier les implicites non écrits (ce qui est supposé mais pas dit).
- Lister les tensions connues (rigueur vs vélocité, scope vs délai).
- Appliquer la règle du double regard : une lecture factuelle, une lecture critique.

Artefacts consommés : Note de Discovery, Opportunity Solution Tree, notes de spike.

### 9.2 Define

**But** : transformer les observations en structure de cadrage.

Activités :
- Rédiger le périmètre IN/OUT/DEFERRED.
- Identifier les parties prenantes et leurs rôles (RACI léger en solo : Responsible = dev/agent, Accountable = dev).
- Lister les contraintes connues par catégorie (réglementaire, budgétaire, temporelle, technique).
- Poser la première version de la classification de risque global.

### 9.3 Design

**But** : structurer les exigences et les décisions.

Activités :
- Rédiger les EF (format EF-NNN avec AC testables).
- Rédiger les ENF (format ENF-NNN avec seuils ISO 25010).
- Appliquer MoSCoW sur toutes les exigences.
- Calculer RICE sur les Must Have ambigus.
- Identifier les décisions architecturales préliminaires → ADR PRELIMINARY.
- Vérifier la checklist AIPD/DPIA (déclenchement si ≥ 2 critères WP29).

### 9.4 Execute

**But** : compléter le dossier de cadrage.

Activités :
- Rédiger le registre de risques initial (RIS-NNN).
- Rédiger les hypothèses (H-NNN).
- Rédiger les RED CARDS (questions ouvertes bloquantes).
- Définir le performance budget.
- Produire l'estimation macro.
- Valider le format de chaque EF/ENF : critère d'acceptation testable présent ?

### 9.5 Verify

**But** : s'assurer que la DoR Conception est satisfaite.

Activités :
- Passer en revue la checklist DoD Cadrage (§5) point par point.
- Jouer l'agent IA en mode antagoniste : « Qu'est-ce qui pourrait invalider ce cadrage en Build ? »
- Vérifier que chaque EF a ≥ 1 AC testable, que chaque ENF a un seuil numérique.
- Vérifier que la classification de risque global est cohérente avec les items listés.
- Vérifier que les RED CARDS (§14) ont toutes un responsable et une échéance.

Sortie : DoD Cadrage vert → passer à Conception. Si des points bloquants restent, les documenter comme RED CARDS et décider : bloquer ou accepter le risque explicitement.

### 9.6 Capitalize

**But** : extraire les apprentissages pour améliorer les cadrage futurs.

Activités :
- Documenter les implicites levés pendant ce cadrage (évite de les retrouver en Build).
- Mettre à jour le modèle de classification de risque si un item a été mal classé.
- Alimenter `.planning/08-risks/` avec les risques identifiés.
- Mettre à jour `.planning/09-logs/decision-log.md` avec les ADR préliminaires.

### 9.7 Transmit

**But** : préparer le cycle Conception à démarrer sans friction.

Activités :
- Produire le résumé de cadrage (1 page) : périmètre, risques majeurs, ADR préliminaires, questions ouvertes résiduelles.
- Mettre à jour `.planning/00-dashboard/current-status.md` : statut = CADRAGE-DONE.
- Archiver la note de Discovery dans `.planning/99-archive/` ou `docs/03-discovery/`.
- Notifier le démarrage de Conception (ou prendre la décision consciente de démarrer).

---

## 10. Activités transversales

Ces activités ne sont pas des phases séquentielles : elles s'appliquent **pendant** le cadrage et se prolongent dans tous les cycles suivants.

### 10.1 Sécurité shift-left (NIST SSDF + OWASP)

En cadrage, le shift-left sécurité se traduit par :
- Identification des flux de données sensibles et des trust boundaries dans le périmètre.
- Premier balayage STRIDE sur l'architecture presssentie (pas le code — les flux et composants).
- Vérification que les exigences de sécurité sont dans les ENF avec seuils (ex. « Zéro CVE Critical en prod »).
- Identification des exigences OWASP ASVS 5.0 applicables (350 exigences en 17 chapitres, version mai 2025).

Référence : NIST SSDF SP 800-218 v1.1 (v1.2 en draft public depuis déc. 2025, commentaires jusqu'au 30 jan. 2026). Groupes PO (Prepare the Organization), PS (Protect the Software), PW (Produce Well-secured), RV (Respond to Vulnerabilities).

### 10.2 Privacy by Design (RGPD)

En cadrage :
- Identifier toutes les données personnelles manipulées par les fonctions IN scope.
- Pour chaque catégorie : finalité, base légale, durée de conservation, droits des personnes.
- Appliquer la checklist WP29 (§6.9) pour déclenchement AIPD.
- Documenter dans le registre de traitement préliminaire.

Sanctions RGPD : jusqu'à 20 M€ ou 4 % du CA mondial pour les manquements les plus graves ; jusqu'à 10 M€ ou 2 % pour défaut d'AIPD (art. 35). Ces montants sont des plafonds, pas des amendes mécaniques.

### 10.3 Accessibilité (EAA + WCAG 2.2)

Depuis le 28 juin 2025, l'European Accessibility Act (EAA / Directive (UE) 2019/882) est en vigueur. Il s'applique aux produits et services numériques commerciaux dans l'UE (services bancaires, e-commerce, ebook, transports, communications électroniques).

En cadrage :
- Identifier les parcours utilisateurs critiques qui devront être accessibles.
- Déclarer l'objectif de conformité : WCAG 2.2 AA minimum (EN 301 549 v3.2.1 référence encore WCAG 2.1 AA formellement, mais WCAG 2.2 est la baseline industry en 2025).
- Nouveautés WCAG 2.2 à intégrer dans les ENF : focus appearance (2.4.11), dragging movements (2.5.7), target size ≥ 24×24 px (2.5.8), consistent help (3.2.6), redundant entry (3.3.7), accessible authentication (3.3.8/9).
- ENF accessibilité exemple : « axe-core vert en CI sur tous les parcours critiques ; zéro violation A/AA ».

### 10.4 FinOps

En cadrage, définir le performance budget financier :
- €/utilisateur actif par mois.
- €/transaction ou €/requête API.
- €/build CI.
- Coût LLM/IA si applicable (tokens prompt + completion, cache hit ratio).

Référence : FinOps Foundation Framework 2024 — cycle Inform → Optimize → Operate.

### 10.5 Observabilité early

En cadrage, définir les SLI/SLO cibles (même provisoires) pour les services critiques identifiés dans le périmètre. Un SLO défini en cadrage est plus facile à instrumenter en Build qu'un SLO découvert en Run.

Exemple :
```
SLO-001 : Disponibilité ≥ 99.5 % / fenêtre glissante 30 j
SLO-002 : Latence p99 < 200 ms sur le parcours [NOM] sous charge nominale
```

---

## 11. Artefacts produits

| Artefact | Emplacement | Format | Obligatoire pour |
|----------|------------|--------|-----------------|
| Dossier de cadrage complet | `docs/02-cadrage/` | Markdown | Toutes classes ≥ M |
| Périmètre IN/OUT/DEFERRED | `docs/02-cadrage/scope.md` | Tableau Markdown | Toutes classes ≥ M |
| Catalogue EF (EF-NNN) | `docs/04-requirements/functional/` | Markdown par EF | Toutes classes ≥ L |
| Catalogue ENF (ENF-NNN) | `docs/04-requirements/non-functional/` | Markdown par ENF | Toutes classes ≥ M |
| Règles métier (RM-NNN) | `docs/04-requirements/business-rules/` | Markdown par règle | Classes ≥ M |
| Registre de risques initial | `.planning/08-risks/risk-register.md` | Tableau JSONL ou Markdown | Toutes classes ≥ L |
| Modèle ISO 25010 instancié | `docs/08-quality/quality-model-instance.md` | Tableau Markdown | Classes ≥ M |
| ADR préliminaires (ADR-NNN) | `docs/13-decisions/` | MADR 4.0 | Classes ≥ H ou décisions structurantes |
| Performance budget | `docs/02-cadrage/performance-budget.md` | Tableau | Classes ≥ M |
| Registre de traitement préliminaire | `docs/09-security-compliance/data-register.md` | Tableau CNIL | Si données perso. |
| Hypothèses (H-NNN) | `docs/02-cadrage/assumptions.md` | Tableau | Classes ≥ M |
| Résumé de cadrage (1 page) | `docs/02-cadrage/summary.md` | Markdown | Toutes classes ≥ L |
| Estimation macro | `docs/02-cadrage/estimation-macro.md` | Tableau | Classes ≥ L |
| RED CARDS (questions ouvertes) | `docs/02-cadrage/open-questions.md` | Tableau avec owner/date | Toutes classes |
| Log de décisions cadrage | `.planning/09-logs/decision-log.md` | Append-only ligne | Toutes classes |

---

## 12. Métriques et indicateurs

### 12.1 Métriques de qualité du cadrage

| Métrique | Définition | Seuil cible | Comment mesurer |
|---------|-----------|------------|----------------|
| Taux de couverture AC | % d'EF avec ≥ 1 AC testable | 100 % des Must Have | Comptage manuel ou script |
| Taux de couverture ENF | % d'ENF avec seuil numérique | 100 % des Must Have | Comptage manuel |
| Taux de classification risque | % d'items avec classe T/L/M/H/C | 100 % | Comptage dans backlog |
| RED CARDS résolues | % de questions ouvertes avec owner et date | 100 % | Tableau §14 |
| Hypothèses formalisées | Nombre de H-NNN avec impact documenté | ≥ 3 pour classes ≥ H | Comptage |
| Items Must Have / capacité | Ratio Must Have vs capacité estimée | ≤ 60 % | Calcul MoSCoW |

### 12.2 DORA — applicabilité en cadrage

Le cadrage n'est pas une phase de delivery, donc les métriques DORA (Change Lead Time, Deployment Frequency, Failed Deployment Recovery Time, Change Failure Rate, Rework Rate) ne s'appliquent pas directement. En revanche :

- Le **Rework Rate** est la métrique post-hoc la plus utile pour évaluer la qualité d'un cadrage : si on revient en cadrage depuis Build ou Validation, c'est que le cadrage était insuffisant.
- Le **Change Failure Rate** élevé en production peut signaler des problèmes de classification de risque en cadrage (items classés L qui étaient H).

Note 2024/2025 : le rapport DORA 2024 était le dernier utilisant la classification Elite/High/Medium/Low. Le rapport DORA 2025 adopte 7 archétypes d'équipes. Les seuils Elite restent des références utiles : Change Lead Time < 1 jour, Deployment Frequency à la demande, Failed Deployment Recovery Time < 1 h, Change Failure Rate < 5 %.

### 12.3 Indicateurs de progression du cycle Cadrage

| Indicateur | Valeur de départ | Valeur cible |
|-----------|-----------------|-------------|
| EF documentées | 0 | Couverture complète du périmètre IN |
| ENF documentées | 0 | ≥ 1 par caractéristique ISO prioritaire |
| Risques classifiés | 0 | ≥ 5 risques H/C identifiés et mitigés |
| ADR préliminaires | 0 | ≥ 1 par décision structurante |
| RED CARDS ouvertes | n | 0 bloquant sans owner |
| DoD Cadrage | ≥ 1 point rouge | 0 point rouge |

---

## 13. Standards de référence

| Domaine | Standard | Version | Source | Applicabilité en cadrage |
|---------|---------|---------|--------|--------------------------|
| Qualité produit | ISO/IEC 25010 | 2023 | iso.org | Caractéristiques prioritaires + seuils ENF |
| Tests | ISO/IEC/IEEE 29119 | Courante | iso.org | Stratégie de tests définie en cadrage |
| Sécurité cycle | NIST SSDF SP 800-218 | v1.1 (v1.2 draft déc. 2025) | csrc.nist.gov | Groupes PO/PS/PW/RV — identification early |
| Sécurité IA | NIST SP 800-218A | Finalisé | csrc.nist.gov | Si LLM/AI dans le périmètre |
| Sécurité maturité | OWASP SAMM v2 | 2 | owaspsamm.org | Niveau de maturité cible |
| Sécurité exigences | OWASP ASVS | 5.0 (mai 2025) | asvs.dev | ENF sécurité applicables |
| Sécurité risques web | OWASP Top 10 | 2021 (update 2025 attendu) | owasp.org | Risques web dans registre |
| Threat modeling | STRIDE + LINDDUN | Courante | microsoft.com / linddun.org | Balayage préliminaire en cadrage |
| Supply chain | SLSA + SBOM | SLSA v1.0 | slsa.dev | Niveau cible défini en cadrage |
| Privacy | RGPD art. 25 + 35 | 2016/679 | eur-lex.europa.eu | Checklist AIPD déclenchement |
| Privacy méthode | CNIL Guide PIA | Courant | cnil.fr | AIPD si seuil WP29 atteint |
| Privacy design | Privacy by Design Cavoukian | 7 principes | iapp.org | Embedded dans ENF |
| Accessibilité | WCAG 2.2 | AA | w3.org/TR/WCAG22 | ENF accessibilité + parcours critiques |
| Accessibilité UE | EN 301 549 + EAA (Directive 2019/882) | v3.2.1 | etsi.org | Obligatoire depuis juin 2025 |
| Accessibilité FR | RGAA 4.x | 4.x | accessibilite.numerique.gouv.fr | Secteur public FR |
| FinOps | FinOps Foundation Framework | 2024 | finops.org | Performance budget financier |
| Performance delivery | DORA | 2024 (7 archétypes en 2025) | dora.dev | Seuils cibles définis en cadrage |
| Versioning | SemVer 2.0 | 2.0 | semver.org | Stratégie définie en cadrage |
| Commits | Conventional Commits | 1.0 | conventionalcommits.org | Défini en cadrage |
| ADR | MADR | 4.0 (sept. 2024) | adr.github.io/madr | Format ADR préliminaires |
| Documentation | Diátaxis | Courante | diataxis.fr | Structure docs cadrage |
| Priorisation | MoSCoW | DSDM | agilebusiness.org | Priorisation exigences |
| Discovery | Continuous Discovery (Torres) | Courante | producttalk.org | Validation entrée cadrage |

---

## 14. Questions ouvertes — RED CARDS

Les RED CARDS sont les questions dont la non-résolution est un **risque actif** pour la suite du cycle. Chaque RED CARD a un responsable, une échéance et un impact si non résolue.

Format :

```
RC-NNN | Question | Responsable | Échéance | Impact si non résolu | Statut
```

### 14.1 RED CARDS structurelles (héritées de Discovery)

| ID | Question | Responsable | Échéance | Impact | Statut |
|----|---------|------------|---------|--------|--------|
| RC-001 | Comment mécaniser la classification de risque T/L/M/H/C ? Arbre de décision déterministe vs subjectif. | Dev | Avant Build cycle 1 | Classification reste subjective, le pivot d'adaptation perd en fiabilité | Démotée : taxonomie fermée par PFV4, mécanisation non bloquante |
| RC-002 | Quelle est la state machine formelle du harness ? Schéma états/transitions/actions autorisées. | Dev | Avant Build cycle 1 | Harness reste boîte noire, risque de désynchronisation | Fermée : storage strict `.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json` |
| RC-003 | Quel modèle ISO 25010 instancié pour ce projet ? 3-5 caractéristiques avec seuils. | Dev | Avant fin Cadrage | Quality gates arbitraires sans modèle conscient | Ouverte : non couverte par PFV4 |
| RC-004 | Quel protocole de promotion de classe en cours de cycle ? (L → H découvert en Build) | Dev | Avant Build cycle 2 | Promotion reste implicite, pas d'amélioration de la classification future | Fermée : promotion via `.planning/current-risk.yaml` + transition `.planning/state.yaml` |

### 14.2 RED CARDS propres au Cadrage

| ID | Question | Responsable | Échéance | Impact |
|----|---------|------------|---------|--------|
| RC-005 | Le périmètre IN est-il cohérent avec la capacité estimée ? Ratio Must Have ≤ 60 % validé ? | Dev | Avant DoD Cadrage | Surcharge dès Build, abandon de Should Have en cours de route |
| RC-006 | Les hypothèses H1-H7 (Discovery) ont-elles été confrontées au réel ? Laquelle invalider en premier ? | Dev | Premier cycle Build | Dérives silencieuses sur les fondations de la pipeline |
| RC-007 | L'AIPD/DPIA est-elle nécessaire ? Checklist WP29 appliquée ? | Dev | Avant Conception si données perso. | Violation RGPD art. 35 — sanction jusqu'à 10 M€ ou 2 % CA |
| RC-008 | Le performance budget financier (€/utilisateur, €/transaction) est-il réaliste ? | Dev | Avant Build | Dérives FinOps découvertes à la facture |
| RC-009 | Les ENF ont-elles des seuils numériques ou des règles vérifiables ? Aucune ENF floue acceptée. | Dev | Avant DoD Cadrage | Quality gates arbitraires, validation impossible |
| RC-010 | Mono-état strict : est-ce tenable en pratique pour ce projet ? Contournement du harness détecté ? | Dev | Après cycle Build 1 | Limite assumée ou à faire évoluer vers multi-états |

### 14.3 Règle de gestion des RED CARDS

- Toute RED CARD **bloquante** empêche le passage à la DoD Cadrage.
- Toute RED CARD **non bloquante** peut être acceptée explicitement comme risque avec justification.
- Les RED CARDS résolues sont archivées dans `.planning/09-logs/decision-log.md`.
- Une RED CARD non résolue après deux cycles consécutifs est escaladée en décision explicite (accepter / résoudre / annuler).

---

## 15. Relations inter-cycles

### 15.1 Cycle 01 — Discovery → Cadrage

**Ce que Discovery apporte :**
- Note de Discovery avec problème validé et hypothèses falsifiables.
- Opportunity Solution Tree (mode Produit) ou document de justification (mode Technique).
- Taille d'effort à l'ordre de grandeur.
- Classification de risque global pressentie.

**Ce que Cadrage attend de Discovery :**
- Clarté sur le mode : Produit / Self-feedback / Technique.
- Validation problème (≥ 5 échanges utilisateurs ou équivalent).
- Au moins une hypothèse invalidable sur la solution.

**Déclencheur de retour en Discovery :** découverte pendant le cadrage que le problème est mal posé, ou que la solution candidate est fondamentalement inadéquate (scope pivot).

### 15.2 Cadrage → Cycle 03 — Conception

**Ce que Cadrage livre à Conception :**
- Périmètre IN/OUT/DEFERRED figé.
- Catalogue EF et ENF avec AC testables et seuils.
- Registre de risques initial avec classification T/L/M/H/C.
- ADR préliminaires signés.
- Performance budget technique et financier.
- Modèle ISO 25010 instancié.
- RED CARDS résiduelles avec responsables.

**Ce que Conception ne doit pas faire :** re-ouvrir le périmètre sans déclenchement formel d'un scope change (CHG-NNN dans `.planning/05-changes/`).

### 15.3 Cadrage → Cycle 04 — Build

**Signaux directs :** la classification de risque détermine le chemin Build (matrice §8.1 de ce document).

**Signaux indirects :** le performance budget financier oriente les choix d'architecture de Build (FinOps dès la conception technique).

### 15.4 Cadrage → Cycle 08 — Apprentissage

**Hypothèses H-NNN** produites en cadrage alimentent les rétrospectives et postmortems. Chaque hypothèse invalidée en production est une leçon sur la qualité du cadrage.

**Rework Rate élevé** → signal que le cadrage était insuffisant sur la classification de risque ou la précision des EF.

### 15.5 Cycle 08 — Apprentissage → Cadrage

**Patterns récurrents** de cadrage insuffisant (ex. : ENF manquantes sur la performance, sous-estimation récurrente des items H) sont intégrés dans les templates de cadrage.

**Biais détectés** (agent ou développeur) sont documentés dans `.planning/agent/audit.md` et corrigent les heuristiques de classification.

---

## Sources

- [ISO/IEC 25010:2023 — Product quality model](https://www.iso.org/standard/78176.html) — ISO, 2023
- [Update on ISO 25010 version 2023 — arc42](https://quality.arc42.org/articles/iso-25010-update-2023) — arc42 Quality Model, 2023
- [DORA Accelerate State of DevOps Report 2024](https://dora.dev/research/2024/dora-report/) — Google DORA, 2024
- [State of DevOps 2025 — Seven archetypes](https://axify.io/blog/state-of-devops) — Axify, 2025
- [NIST SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/final) — NIST, 2022 (v1.2 draft déc. 2025)
- [NIST SP 800-218 v1.2 — Public comment draft](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd) — NIST, déc. 2025
- [OWASP ASVS 5.0.0](https://asvs.dev/) — OWASP, mai 2025
- [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html) — OWASP, courant
- [WCAG 2.2 Overview — W3C WAI](https://www.w3.org/WAI/standards-guidelines/wcag/) — W3C, oct. 2023
- [European Accessibility Act 2025 — OneTrust](https://www.onetrust.com/blog/understanding-the-european-accessibility-act-and-wcag-22/) — OneTrust, 2025
- [MoSCoW Prioritisation — DSDM Agile Business Consortium](https://www.agilebusiness.org/dsdm-project-framework/moscow-prioritisation.html) — Agile Business Consortium
- [RICE vs MoSCoW prioritization](https://codewave.com/insights/prioritizing-features-with-impact-rice-vs-moscow/) — Codewave, 2024
- [MADR 4.0 — Markdown Architectural Decision Records](https://adr.github.io/madr/) — adr.github.io, sept. 2024
- [Architecture Decision Records — Fowler](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) — martinfowler.com
- [Definition of Ready — Atlassian](https://www.atlassian.com/agile/project-management/definition-of-ready) — Atlassian, courant
- [FinOps Foundation Framework 2024](https://www.finops.org) — FinOps Foundation, 2024
- rapport-discovery-cadrage.md — Source de vérité interne, 2026-05-02
- compass_artifact (cycle qualité v3) — Source interne, 2026
- r1.md — Phase 0 clarification complète, source interne
- folder.md — Architecture `.planning/` registres + snapshots, source interne
