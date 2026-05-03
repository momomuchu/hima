# Classification des risques — Document transversal
## Pipeline fractale v4 — Mécanisme pivot central

> **Statut** : document de référence transversal, version initiale  
> **Date** : 2026-05-03  
> **Scope** : tous les cycles (Discovery → Apprentissage), tous les modes (Pairing / Auto-décision / Bypass)  
> **Rôle dans le système** : pivot de modulation — sans classification robuste, le reste du pipeline perd son adaptabilité

---

## Sommaire

1. Résumé exécutif
2. Portée transversale
3. Objectif
4. Entrées — quand classifier
5. Sorties — artefacts produits
6. Concepts clés
7. Critères qualité (ISO 25010:2023 — dimension Safety)
8. Matrice de modulation par classe de risque — THE core deliverable
9. Application fractale par cycle
10. Activités transversales impactées
11. Artefacts produits
12. Métriques et indicateurs
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations avec chaque cycle

---

## 1. Résumé exécutif

La classification des risques est **le mécanisme pivot** de la Pipeline fractale v4. Elle conditionne :

- la **profondeur** de chaque sous-cycle (Observer → Transmettre)
- le **mode de supervision** autorisé (Pairing / Auto-décision / Bypass)
- les **activités obligatoires** vs allégées vs skippables
- les **quality gates** bloquants dans le CI/CD
- la **stratégie de déploiement** (direct → canary + feature flag)

**Cinq classes** ordonnées par niveau de risque composite (impact × probabilité) :

| Classe | Libellé | Décision de supervision |
|--------|---------|------------------------|
| **T** | Trivial | Bypass autorisé |
| **F** | Faible | Bypass autorisé sous conditions |
| **M** | Moyen | Auto-décision (défaut) |
| **É** | Élevé | Auto-décision avec validation humaine obligatoire |
| **C** | Critique | Pairing obligatoire ou validation humaine explicite |

**Règle absolue** : le Bypass est interdit pour É et C. Non négociable.

**Principe de fonctionnement** : l'auteur propose la classe → le harness la vérifie via l'arbre de décision → la classe détermine le chemin obligatoire. Une promotion de classe (F → É découvert en cours de cycle) déclenche un protocole d'escalade immédiat.

---

## 2. Portée transversale

La classification des risques s'applique **à chaque changement individuel** traversant le pipeline, sans exception, quel que soit le cycle en cours.

### 2.1 Cycles couverts

Tous les 8 cycles de la pipeline fractale :

1. **Discovery** — classification du risque de l'opportunité (construire la mauvaise chose, validation insuffisante du problème)
2. **Cadrage** — classification du risque de l'item au moment de la DoR (avant engagement de build)
3. **Conception** — reclassification possible selon la profondeur des décisions techniques
4. **Build** — classification de chaque PR / incrément
5. **Validation** — profondeur de test déterminée par la classe
6. **Release** — stratégie de déploiement déterminée par la classe
7. **Run** — severity des incidents entrants classifiés sur la même échelle
8. **Apprentissage** — analyse de la justesse des classifications passées (feedback loop)

### 2.2 Sous-cycles couverts

Les 7 étapes fractales — **Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre** — sont traversées à une profondeur variable selon la classe :

- **T/F** : traverse les 7 étapes en chemin court (secondes à minutes)
- **M** : traverse les 7 étapes en chemin standard (heures)
- **É** : traverse les 7 étapes avec checkpoints obligatoires (heures à jours)
- **C** : traverse les 7 étapes avec traces et validations humaines à chaque étape (jours)

### 2.3 Ce que la classification ne couvre PAS

- La classification individuelle d'un item ne constitue pas une évaluation de risque projet global. Le risque global est une agrégation, pas une classe individuelle.
- La classification ne remplace pas le threat modeling STRIDE (qui est une activité déclenchée par la classe, pas confondue avec elle).
- La classification ne remplace pas l'AIPD/DPIA (idem : déclenchée, pas confondue).

---

## 3. Objectif

**Objectif principal** : transformer chaque changement logiciel en une décision objective de profondeur de traitement, en éliminant l'implicite et le dogme.

**Objectifs secondaires** :
- Protéger le développeur solo contre la dérive en rubber-stamp (validation aveugle de l'agent)
- Garantir que les changements à fort risque (É/C) ne passent jamais en Bypass
- Permettre aux changements T/F d'avancer sans friction inutile
- Créer une base de données d'apprentissage pour améliorer la classification future
- Aligner la profondeur de test sur le risque réel (risk-based testing per ISO/IEC/IEEE 29119)

**Ce que le système doit produire** : pour chaque changement, une décision claire sous la forme `[CLASSE] : [JUSTIFICATION EN 1 LIGNE]` inscrite dans le PR template avant tout développement.

---

## 4. Entrées — quand classifier

La classification est déclenchée **systématiquement** aux moments suivants :

### 4.1 Déclencheurs principaux

| Moment | Déclencheur | Qui |
|--------|-------------|-----|
| Entrée en Cadrage | Item candidat ajouté au backlog | Agent (proposition) + Développeur (validation) |
| Création de PR/branche | Début de développement d'un incrément | Agent (proposition automatique via arbre) |
| Revue de PR | Gate CI obligatoire | Harness (vérification) |
| Découverte en cours de cycle | Signal d'escalade de classe | Agent (détection) + Développeur (confirmation) |
| Incident en Run | Ticket d'incident entrant | Agent (classification initiale) |
| Rétrospective Apprentissage | Audit des classifications passées | Développeur |

### 4.2 Entrées nécessaires pour classifier

Pour classer un item, les informations minimales suivantes doivent être disponibles :

```
- Périmètre fonctionnel : quels fichiers / modules / services touchés
- Type de changement : feature / fix / refactor / migration / infra / dépendance
- Données impliquées : aucune / données app / PII / données de santé / financières
- Interfaces touchées : interne / API publique / contrat inter-services
- État actuel des tests : chemin de code couvert ou non
- Signaux d'escalade automatique : auth / paiement / schéma DB / multi-services
```

### 4.3 Signaux d'escalade automatique (arbre de décision)

Les signaux ci-dessous forcent une classe minimale, indépendamment de l'estimation subjective :

| Signal détecté | Classe minimale forcée |
|----------------|----------------------|
| Touche auth / autorisation / sessions | **É** |
| Touche paiement / facturation | **É** |
| Touche schéma DB (migration) | **É** |
| Touche API publique / contrat inter-services | **É** |
| Touche infra de production | **É** |
| Données personnelles (PII) | **É** |
| Données de santé / biométrie | **C** |
| Données financières réglementées | **C** |
| Impact multi-services / multi-repos | **C** |
| Refonte d'architecture (strangler, pivot) | **C** |
| Exigence réglementaire (RGPD, NIS2, EAA, DORA financier) | **C** |

**Règle** : si un signal de forçage est présent, la classe proposée ne peut être INFÉRIEURE au seuil forcé. Elle peut être supérieure.

---

## 5. Sorties — artefacts produits

### 5.1 Par changement individuel

```yaml
# Exemple de métadonnée de classification (en-tête PR / item backlog)
risk_class: "É"
risk_justification: "Touche le schéma d'authentification et la table sessions"
risk_proposed_by: "agent"
risk_validated_by: "developer"
risk_override: false
risk_classification_date: "2026-05-03"
escalation_history: []
supervision_mode_required: "auto-decision+human-validation"
deployment_strategy: "canary+feature-flag"
```

### 5.2 Au niveau du Risk Register projet

Le risk register (`.planning/08-risks/risk-register.md`) est mis à jour à chaque nouveau changement É/C avec :

- ID du risque
- Classe courante
- Impact estimé
- Probabilité estimée
- Score composite
- Traitement (mitigé / accepté / transféré / évité)
- Responsable
- Statut
- Date de revue suivante

### 5.3 Au niveau du cycle Apprentissage

Un rapport de calibration des classifications est produit à chaque cycle, contenant :
- Taux de promotions de classe (F → É, M → C, etc.) — indicateur de sous-estimation systématique
- Taux de déclassements (É → M, etc.) — indicateur de sur-estimation systématique
- Corrélation classe initiale / incidents réels en production

---

## 6. Concepts clés

### 6.1 Les 5 classes — définitions précises

#### T — Trivial

**Définition** : changement cosmétique ou mécanique sans modification du comportement observable ni du code path critique.

**Critères d'inclusion** :
- Documentation pure (README, commentaires, ADR rétrospectif)
- Refactor mécanique sans changement de comportement (renommage variable locale, reformatage)
- Mise à jour de dépendance — patch sans CVE (ex : v1.2.3 → v1.2.4, correctif bugfix sans sécurité)
- Changement cosmétique UI non user-critical (couleur de fond, espacement non-fonctionnel)
- Tests ajoutés sur un code path déjà testé (renforcement de suite existante)

**Critères d'exclusion** (forçage vers F au minimum) :
- Toute modification de logique, même d'une ligne
- Toute dépendance avec CVE, même Low
- Tout changement dans un fichier de configuration de sécurité

**Chemin** : CI verts → merge. Pas de gate humain requis.

#### F — Faible

**Définition** : nouvelle fonctionnalité isolée ou correction de bug non-critique, derrière feature flag, sans données personnelles, sans migration de schéma, sans impact sur des tiers.

**Critères d'inclusion** :
- Nouvelle feature UI isolée derrière feature flag
- Bug fix sur code path non-critique sans changement de contrat
- Mise à jour de dépendance mineure sans migration
- Ajout de tests d'intégration sur périmètre existant
- Changement de configuration non-sécuritaire dans un service non-critique

**Critères d'exclusion** :
- Tout signal de forçage É (voir §4.3)
- Feature sans feature flag qui modifie un flux utilisateur existant

**Chemin** : review de code ≥1 + CI verts → merge.

#### M — Moyen

**Définition** : nouvelle fonctionnalité visible utilisateur, pas de PII sensible, pas de migration de schéma DB, pas d'impact tiers, impact limité à un seul service.

**Critères d'inclusion** :
- Feature visible utilisateur derrière ou sans feature flag (mais risque contenu)
- Bug fix sur un flux critique mais sans données sensibles
- Refactor structurel modifiant des interfaces internes (mais non-publiques)
- Dépendance minor upgrade avec changements non-breaking documentés

**Critères d'exclusion** :
- Dès qu'un signal É apparaît (auth, PII, migration DB, API publique)

**Chemin** : Discovery partielle + analyse fonctionnelle + review ≥1 + tests intégration + CI verts → merge. Validation produit requise.

#### É — Élevé

**Définition** : changement touchant un système sensible (auth, paiement, données perso, infra prod, API publique, schéma DB). Risque de régression grave ou d'incident de sécurité si mal traité.

**Critères d'inclusion** : voir signaux de forçage §4.3 (auth, paiement, PII, schéma DB, API publique, infra prod).

**Chemin obligatoire** :
- Discovery complète avec validation du problème
- ADR documenté
- Threat modeling STRIDE (si touche sécurité)
- AIPD si données personnelles
- Tests E2E sur parcours critiques
- DAST sur preprod
- Review ≥2 (ou développeur + self-review différée + agent antagoniste en solo)
- Déploiement canary 5%→25%→50%→100% avec gates SLO
- Feature flag obligatoire
- Plan de rollback testé
- Validation humaine explicite avant merge

**Mode supervision** : Auto-décision avec checkpoint humain obligatoire. Bypass interdit.

#### C — Critique

**Définition** : changement à impact transverse ou réglementaire — données de santé/biométrie/financières, refonte d'architecture, rupture de contrat API publique, exigence NIS2/RGPD/DORA financier/EAA. Peut impacter plusieurs services, des utilisateurs tiers, ou créer une obligation légale.

**Critères d'inclusion** : voir signaux de forçage §4.3 (santé, biométrie, financier réglementé, multi-services, refonte archi, réglementaire).

**Chemin obligatoire** :
- Tout ce qui est obligatoire pour É, PLUS :
- Threat modeling complet (STRIDE + LINDDUN si privacy)
- AIPD obligatoire
- Revue sécurité indépendante (ou agent antagoniste en solo avec trace)
- Tests de charge si applicable
- Canary + feature flag + communication aux parties prenantes
- Plan de rollback répété (testé plusieurs fois)
- Postmortem prévu si échec (template pré-rempli)
- Validation humaine avec signature explicite (log)

**Mode supervision** : Pairing recommandé. Auto-décision uniquement si le développeur a une visibilité complète sur le changement. Bypass absolument interdit.

---

### 6.2 Impact — définition et niveaux

L'impact mesure **la gravité des conséquences** si le risque se matérialise.

| Niveau | Score | Définition |
|--------|-------|-----------|
| Négligeable | 1 | Aucun utilisateur impacté, récupération immédiate, aucune donnée perdue |
| Mineur | 2 | Quelques utilisateurs impactés, récupération < 1h, aucune donnée sensible |
| Modéré | 3 | Flux important dégradé, récupération < 4h, pas de perte de données permanente |
| Majeur | 4 | Service critique indisponible, perte de données possible, impact réputationnel |
| Catastrophique | 5 | Atteinte aux données sensibles, obligation réglementaire violée, impact financier grave, récupération > 24h |

### 6.3 Probabilité — définition et niveaux

La probabilité mesure **la vraisemblance** que le risque se matérialise dans le cycle courant.

| Niveau | Score | Définition |
|--------|-------|-----------|
| Très improbable | 1 | Survient < 1 fois par an dans des conditions similaires |
| Improbable | 2 | Survient quelques fois par an |
| Possible | 3 | Survient dans environ 30% des cas similaires |
| Probable | 4 | Survient dans environ 60% des cas similaires |
| Quasi-certain | 5 | Survient dans > 80% des cas similaires |

### 6.4 Score composite et mapping vers les 5 classes

Score = Impact × Probabilité (1–25)

| Score | Classe | Interprétation |
|-------|--------|---------------|
| 1–2 | **T** | Trivial — aucune attention particulière requise |
| 3–5 | **F** | Faible — traitement standard allégé |
| 6–10 | **M** | Moyen — traitement standard complet |
| 11–17 | **É** | Élevé — traitement renforcé, validation humaine |
| 18–25 | **C** | Critique — traitement maximal, pairing recommandé |

**Note sur la combinatoire** : un impact catastrophique (5) même avec une probabilité très faible (1) donne un score de 5 = classe F. C'est intentionnel — dans le contexte dev solo, on ne peut pas traiter chaque changement théoriquement risqué comme critique. Cependant, les signaux de forçage §4.3 surchargent ce calcul pour les domaines où le développeur a démontré des conséquences concrètes (auth, PII, etc.).

### 6.5 Risk appetite — profil du développeur solo

Le risk appetite du développeur solo + agent IA est le suivant :

| Dimension | Tolérance | Justification |
|-----------|-----------|--------------|
| Vitesse de livraison T/F | Élevée | Friction nulle justifiée pour les changements réversibles à faible impact |
| Sécurité applicative | Zéro tolérance pour É/C | Bypass interdit sur auth/PII/paiement — non négociable |
| Disponibilité | Tolérance faible | Solo dev : pas de garde de nuit, incident = perte de productivité significative |
| Compliance réglementaire | Zéro tolérance | Sanctions RGPD (jusqu'à 4% CA ou 20M€) et EAA rendent l'acceptation impossible |
| Dette technique | Tolérance moyenne | Acceptable si trackée et remboursée dans les 2 cycles suivants |
| Coût LLM/infra | Tolérance moyenne | Budget cap requis mais non bloquant si ROI positif documenté |

**Seuil d'acceptation du risque résiduel** : après traitement, un risque est acceptable si son score résiduel est ≤ 5 (classes T/F). Un risque résiduel M (6-10) est acceptable uniquement avec une décision documentée et une date de revue. Un risque résiduel É/C n'est jamais acceptable sans traitement complémentaire.

### 6.6 Risk tolerance — limites non négociables

Quatre limites absolues, jamais overridables :

1. **Bypass interdit sur É/C** — quelle que soit la confiance dans l'agent
2. **Aucun changement de schéma DB sans plan expand/contract documenté** — classe É minimum
3. **Aucune donnée de santé/biométrie sans AIPD et chiffrement validés** — classe C minimum
4. **Aucune CVE Critical non triée en production > 24h** — déclenche une escalade immédiate vers C si non corrigée

---

## 7. Critères qualité — ISO 25010:2023 — dimension Safety

ISO 25010:2023 introduit **Safety** comme 9e caractéristique produit (nouveauté par rapport à la version 2011). Elle est directement liée à la classification des risques.

### 7.1 Sous-caractéristiques Safety applicables

| Sous-caractéristique | Application à la classification |
|---------------------|--------------------------------|
| **Operational constraint** | Les limites de bypass (T/F uniquement) constituent une contrainte opérationnelle formelle |
| **Risk identification** | L'arbre de décision §4.3 est le mécanisme d'identification des risques |
| **Fail safe** | La promotion de classe déclenchée par les signaux de forçage est le comportement fail-safe |
| **Hazard warning** | Les RED CARDS §14 sont les avertissements de danger actifs |
| **Safe integration** | La stratégie de déploiement modulée par classe (canary pour É/C) est le mécanisme de safe integration |

### 7.2 Interaction avec les autres caractéristiques ISO 25010:2023

- **Security** : directement pilotée par les classes É/C (threat modeling, DAST, revue sécurité)
- **Reliability** : la stratégie de déploiement canary pour M+ protège la fiabilité en production
- **Maintainability** : la traçabilité de la classification (arbre + justification) améliore l'analysabilité
- **Functional suitability** : la Discovery obligatoire pour É/C valide l'adéquation fonctionnelle

---

## 8. Matrice de modulation par classe de risque

**C'est le livrable central.** Cette matrice définit ce qui est obligatoire (✅), recommandé (○), allégé (◔), conditionnel (≈), ou skippable (—) pour chaque activité de la pipeline, selon la classe de risque.

### 8.1 Matrice complète — 27 activités × 5 classes

| Activité | T (Trivial) | F (Faible) | M (Moyen) | É (Élevé) | C (Critique) |
|----------|:-----------:|:----------:|:---------:|:---------:|:------------:|
| **DISCOVERY** | | | | | |
| Validation problème / Discovery formelle | — | ◔ | ○ | ✅ | ✅ |
| Entretiens utilisateurs / JTBD | — | — | ○ | ✅ | ✅ |
| Opportunity Solution Tree | — | — | ◔ | ✅ | ✅ |
| Spike technique timeboxé | — | — | ○ | ○ | ○ |
| **CADRAGE** | | | | | |
| DoR formelle | ◔ | ○ | ✅ | ✅ | ✅ |
| Classification de risque explicite | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analyse fonctionnelle | — | ◔ | ✅ | ✅ | ✅ |
| **CONCEPTION** | | | | | |
| ADR (Architecture Decision Record) | — | ◔ | ○ | ✅ | ✅ |
| Threat modeling STRIDE | — | — | ○ | ✅ | ✅ |
| AIPD / DPIA | — | — | ≈ données perso | ✅ si PII | ✅ |
| Threat modeling LINDDUN (privacy) | — | — | — | ≈ si PII | ✅ si PII |
| Estimation FinOps | — | ◔ | ○ | ✅ | ✅ |
| Conception détaillée (design doc) | — | ◔ | ○ | ✅ | ✅ |
| Plan de migration expand/contract | — | — | ≈ si schéma | ✅ si schéma | ✅ |
| **BUILD** | | | | | |
| Tests unitaires | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests d'intégration | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests E2E parcours critiques | — | ◔ | ○ | ✅ | ✅ |
| SAST / SCA (CI) | ✅ | ✅ | ✅ | ✅ | ✅ |
| DAST (preprod) | — | — | ○ | ✅ | ✅ |
| IaC / container scanning | ≈ si touché | ✅ | ✅ | ✅ | ✅ |
| Secrets scan | ✅ | ✅ | ✅ | ✅ | ✅ |
| SBOM (CycloneDX/SPDX) | — | — | ○ | ✅ | ✅ |
| Signature artefact (Cosign/Sigstore) | — | — | — | ✅ | ✅ |
| **VALIDATION** | | | | | |
| Revue de code (peer / self-review différée) | ◔ | ✅ | ✅ | ✅ (≥2 ou solo+agent) | ✅ (≥2) |
| Quality gates CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Validation produit / acceptance | — | ◔ | ✅ | ✅ | ✅ |
| QA risk-based | — | ◔ | ○ | ✅ | ✅ |
| Tests d'accessibilité automatisés (axe-core) | ◔ | ✅ auto | ✅ auto | ✅ + manuel | ✅ + audit |
| Tests de charge / performance | — | — | ○ | ✅ | ✅ |
| Tests i18n / RTL | — | ◔ | ○ | ✅ | ✅ |
| Vérification budget FinOps | — | ◔ | ○ | ✅ | ✅ |
| **RELEASE** | | | | | |
| Stratégie déploiement | direct | direct | canary 10% | canary + blue/green | canary + feature flag obligatoire |
| Feature flag | — | ○ | ○ | ✅ | ✅ |
| Plan de rollback | implicite | ✅ | ✅ | ✅ + testé | ✅ + répété |
| Smoke tests post-déploiement | — | ◔ | ✅ | ✅ | ✅ |
| Communication parties prenantes | — | équipe | équipe | élargie | élargie + externe |
| **RUN** | | | | | |
| Surveillance SLO active | ◔ | ◔ | ✅ | ✅ | ✅ |
| Postmortem si incident | léger | ✅ | ✅ | ✅ + revue | ✅ + audit indépendant |
| **MODE DE SUPERVISION** | | | | | |
| Bypass autorisé | ✅ | ✅ (conditions) | ✗ | ✗ | ✗ |
| Auto-décision | ✅ | ✅ | ✅ (défaut) | ✅ + checkpoint | ✗ (si doute) |
| Pairing | ○ | ○ | ○ | ○ | ✅ recommandé |
| Validation humaine explicite requise | — | — | — | ✅ | ✅ |

### 8.2 Légende

| Symbole | Signification |
|---------|--------------|
| ✅ | Obligatoire — bloquant si absent |
| ○ | Recommandé — attendu sauf justification documentée |
| ◔ | Allégé — version simplifiée suffisante |
| ≈ | Conditionnel — obligatoire si condition précisée |
| — | Skippable — non requis pour cette classe |
| ✗ | Interdit — violation des règles de supervision |

### 8.3 Règles de calcul du chemin

```
SI classe == T :
  chemin = CI verts → merge
  supervision = Bypass autorisé
  
SI classe == F :
  chemin = review ≥1 + CI verts → merge
  supervision = Bypass autorisé (si CI verts ET aucun signal d'escalade)
  
SI classe == M :
  chemin = analyse fonctionnelle + review ≥1 + tests intégration + CI verts + validation produit → merge
  supervision = Auto-décision (mode par défaut)
  
SI classe == É :
  chemin = Discovery + ADR + Threat model + review ≥2 + DAST + canary + feature flag + rollback testé + VALIDATION HUMAINE → merge
  supervision = Auto-décision avec checkpoint humain obligatoire
  Bypass = INTERDIT
  
SI classe == C :
  chemin = Tout É PLUS threat model complet + AIPD + audit sécurité + canary + communication + rollback répété + VALIDATION HUMAINE EXPLICITE + LOG → merge
  supervision = Pairing recommandé, auto-décision uniquement si visibilité totale
  Bypass = ABSOLUMENT INTERDIT
```

---

## 9. Application fractale par cycle

### 9.1 Discovery

**Risques spécifiques** : construire la mauvaise chose, valider un problème fictif, spike sans fin.

| Activité Discovery | Modulation |
|-------------------|-----------|
| Validation du problème | Obligatoire si É/C, optionnelle si M, skippable si T/F |
| Nombre d'entretiens utilisateurs requis | T/F : 0, M : ≥3, É : ≥5, C : ≥5 + source quantitative |
| Spike timeboxé | T/F : non requis, M/É/C : max 5 jours, sortie = décision + ADR |
| Classification de l'opportunité | Se fait en sortie de Discovery, avant entrée en Cadrage |

**Mécanisme fractal** : l'étape Observer de la Discovery classe d'abord l'opportunité. Si É/C, l'étape Définir est approfondie (entretiens, JTBD complet). Si T/F, l'étape Définir est réduite à un one-liner.

### 9.2 Cadrage

**Risques spécifiques** : engagement de build sans DoR suffisante, périmètre flou, dépendances non identifiées.

La classification se cristallise en Cadrage : c'est ici que la classe devient officielle et est inscrite dans le backlog item.

| Sortie obligatoire du Cadrage | T | F | M | É | C |
|------------------------------|---|---|---|---|---|
| Classe de risque inscrite | ✅ | ✅ | ✅ | ✅ | ✅ |
| DoR formelle complète | ◔ | ○ | ✅ | ✅ | ✅ |
| Dépendances identifiées | ◔ | ✅ | ✅ | ✅ | ✅ |
| Impact privacy identifié | — | ◔ | ✅ | ✅ | ✅ |
| Impact accessibility identifié | — | ◔ | ✅ | ✅ | ✅ |
| Périmètre IN/OUT explicite | — | ◔ | ✅ | ✅ | ✅ |

### 9.3 Conception

**Risques spécifiques** : décision d'architecture non documentée, surface d'attaque non modélisée, migration de schéma sans plan.

Pour É/C, la Conception est une phase non-négociable. Elle produit l'ADR, le threat model, et déclenche l'AIPD si applicable.

**Pattern Strangler Fig** : tout changement d'architecture classé C doit être décomposé via Strangler Fig en une séquence de changements M/É. Chaque étape de la décomposition est reclassifiée individuellement. Ce pattern transforme un C en séquence F/M, réduisant le risque à chaque étape tout en maintenant la traçabilité du changement global.

### 9.4 Build

**Risques spécifiques** : régression, dette technique accumulée, sécurité non implémentée.

L'inner loop du Build traverse le sous-cycle Observer → Vérifier pour chaque incrément. La classe détermine le niveau de quality gates CI bloquants :

| Gate CI | T | F | M | É | C |
|---------|---|---|---|---|---|
| Lint/format | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests unitaires | ✅ | ✅ | ✅ | ✅ | ✅ |
| SAST | ✅ | ✅ | ✅ | ✅ | ✅ |
| SCA dépendances | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secrets scan | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests intégration | ◔ | ✅ | ✅ | ✅ | ✅ |
| DAST | — | — | ○ | ✅ | ✅ |
| Couverture critique | — | ◔ | ✅ | ✅ | ✅ |
| SBOM | — | — | ○ | ✅ | ✅ |
| Signature artefact | — | — | — | ✅ | ✅ |

### 9.5 Validation

**Risques spécifiques** : défaut non détecté avant production, test coverage inadéquat.

Le risk-based testing (ISO/IEC/IEEE 29119) alloue l'effort de test proportionnellement au produit vraisemblance × impact. Pour É/C :

- Tests exploratoires sur les zones rouges (chemin happy + chemins d'erreur + edge cases sécurité)
- Tests de régression complète (non seulement la zone touchée)
- Tests d'authz/authn pour É
- Fuzzing pour C sur les endpoints exposés

### 9.6 Release

**Risques spécifiques** : incident de déploiement, rollback impossible, communication insuffisante.

| Stratégie de déploiement | Justification |
|--------------------------|--------------|
| T/F → direct | Changement réversible, impact minimal |
| M → canary 10% | Valide en production avant exposition totale |
| É → canary 5%→25%→50%→100% avec gates SLO | Chaque palier conditionné au maintien des SLO |
| C → canary + feature flag obligatoire | Découplage déploiement / release ; rollback en un toggle |

### 9.7 Run

**Risques spécifiques** : dégradation silencieuse, erreur budget épuisé, incident non détecté.

La classification des incidents entrants utilise la même échelle T/F/M/É/C :

| Sévérité incident | Classe | Action |
|------------------|--------|--------|
| Cosmétique, aucun utilisateur impacté | T | Log uniquement |
| Impact partiel, <10 utilisateurs, récupération <1h | F | Hotfix dans le sprint courant |
| Flux dégradé, >10 utilisateurs, récupération <4h | M | Hotfix prioritaire + postmortem léger |
| Service critique indisponible, toute user-base | É | War room immédiate + postmortem complet |
| Atteinte données sensibles, violation réglementaire | C | War room + notification CNIL 72h + postmortem + audit |

### 9.8 Apprentissage

**C'est ici que le système s'améliore.** Chaque cycle Apprentissage produit :

1. **Calibration report** : combien de promotions de classe ont eu lieu, dans quel sens, sur quel type de changement
2. **Pattern update** : l'arbre de décision §4.3 est mis à jour avec les nouveaux signaux identifiés
3. **Biais détectés** : l'agent sous-estime-t-il systématiquement certaines classes ? (ex : migration DB classée M au lieu de É)
4. **Risk appetite review** : les seuils de tolérance §6.5 sont-ils encore calibrés correctement ?

---

## 10. Activités transversales impactées

Ces activités ne sont pas des phases — elles imprègnent tous les cycles. La classification module leur intensité.

### 10.1 Sécurité shift-left (DevSecOps)

| Classe | Threat Modeling | SAST | DAST | IaC/Container | Supply chain (SLSA) |
|--------|----------------|------|------|---------------|---------------------|
| T | — | ✅ CI | — | ≈ si touché | — |
| F | — | ✅ CI | — | ✅ | — |
| M | ○ (STRIDE léger) | ✅ CI | ○ preprod | ✅ | ○ |
| É | ✅ STRIDE complet | ✅ + revue | ✅ bloquant | ✅ | ✅ SLSA 2+ |
| C | ✅ STRIDE + LINDDUN | ✅ + audit | ✅ + fuzzing | ✅ | ✅ SLSA 3 |

### 10.2 Privacy / RGPD by Design

| Classe | Registre traitement | AIPD | Droits personnes | Pseudonymisation |
|--------|--------------------|----|-----------------|-----------------|
| T/F | — | — | — | ≈ si logs |
| M | ≈ si nouvelles données | ≈ conditionnel | ✅ si nouvelles données | ✅ si données staging |
| É | ✅ mise à jour | ✅ si PII | ✅ | ✅ |
| C | ✅ mise à jour | ✅ obligatoire | ✅ + délai ≤30j | ✅ + chiffrement validé |

### 10.3 FinOps

| Classe | Impact coût documenté | Budget cap LLM | Anomaly detection |
|--------|-----------------------|----------------|------------------|
| T/F | — | ◔ | ◔ |
| M | ○ | ✅ | ✅ |
| É | ✅ | ✅ | ✅ |
| C | ✅ + revue architecture | ✅ | ✅ bloquant |

### 10.4 Accessibilité by design (EAA — en vigueur depuis 28 juin 2025)

| Classe | Tests auto (axe-core CI) | Tests manuels | Audit expert |
|--------|--------------------------|---------------|-------------|
| T/F | ◔ | — | — |
| M | ✅ | — | — |
| É | ✅ | ✅ sur parcours touchés | ○ |
| C | ✅ | ✅ complet | ✅ si produit critique EAA |

### 10.5 Tests (risk-based testing, ISO/IEC/IEEE 29119)

La profondeur de test est **directement fonction de la classe** :

```
Classe T : tests existants verts suffisent (pas de nouveaux tests requis si refactor)
Classe F : nouveaux tests unitaires + intégration sur les fonctionnalités ajoutées
Classe M : tests pyramide / trophée selon le type de code, mutation testing ○
Classe É : tests pyramide + contrat inter-services + mutation testing ✅ > 70% score zones critiques
Classe C : tout É + property-based testing + tests de charge + fuzzing endpoints exposés
```

---

## 11. Artefacts produits

### 11.1 Par changement

| Artefact | T | F | M | É | C |
|---------|---|---|---|---|---|
| Classe dans PR metadata | ✅ | ✅ | ✅ | ✅ | ✅ |
| Justification 1 ligne | ✅ | ✅ | ✅ | ✅ | ✅ |
| ADR | — | ◔ | ○ | ✅ | ✅ |
| Threat model | — | — | ○ | ✅ | ✅ |
| AIPD | — | — | ≈ | ✅ si PII | ✅ |
| Risk register entry | — | — | ○ | ✅ | ✅ |
| Plan de rollback | implicite | ✅ | ✅ | ✅ tracé | ✅ tracé + testé |
| Log de validation humaine | — | — | — | ✅ | ✅ |

### 11.2 Risk Register — structure de chaque entrée

```yaml
# .planning/08-risks/risk-register.md — entrée individuelle
id: "RISK-042"
item_ref: "PBI-017"
class: "É"
title: "Migration schéma auth — risque de régression session"
description: >
  La migration du champ user_role vers une table séparée peut casser
  les sessions actives si le rollback n'est pas propre.
impact_level: 4           # Majeur
impact_description: "Service auth indisponible, tous les utilisateurs déconnectés"
probability_level: 2       # Improbable
probability_description: "Stratégie expand/contract réduit la probabilité"
score: 8                   # = 4 × 2
residual_class: "F"        # Après mitigation
treatment: "mitigate"
treatment_actions:
  - "Pattern expand/contract documenté dans ADR-028"
  - "Migration en 3 déploiements distincts"
  - "Tests de régression session ajoutés (TEST-089)"
  - "Canary 5% avec gate SLO sessions/s"
owner: "developer"
status: "in-progress"
review_date: "2026-05-10"
escalation_history: []
created: "2026-05-03"
```

### 11.3 Template de classification dans PR

```markdown
## Classification de risque

**Classe proposée** : [ ] T  [ ] F  [x] É  [ ] M  [ ] C

**Justification** :
Touche le schéma d'authentification (table sessions, migration expand/contract).
Signaux de forçage actifs : schéma DB ✅, auth ✅.

**Signaux de forçage actifs** :
- [x] Auth / autorisation / sessions
- [ ] Paiement / facturation
- [x] Schéma DB (migration)
- [ ] API publique
- [ ] PII / données personnelles
- [ ] Données de santé / biométrie
- [ ] Multi-services
- [ ] Réglementaire

**Mode de supervision requis** : Auto-décision + validation humaine explicite
**Bypass autorisé** : NON

**Chemin obligatoire activé** :
- [x] ADR documenté (ADR-028)
- [x] Threat modeling STRIDE effectué
- [ ] AIPD (non applicable — pas de données personnelles nouvelles)
- [x] Review ≥2 (ou solo + agent antagoniste avec trace)
- [x] DAST sur preprod
- [x] Canary 5%→25%→50%→100%
- [x] Feature flag activé OFF par défaut
- [x] Plan de rollback testé en staging
- [x] Validation humaine avant merge : _________________ (signature)
```

---

## 12. Métriques et indicateurs

### 12.1 Métriques de calibration de la classification

| Métrique | Définition | Cible | Alerte |
|---------|-----------|-------|--------|
| **Taux de promotion de classe** | % de changements dont la classe initiale a été augmentée en cours de cycle | < 10% | > 20% → l'arbre de décision est insuffisant |
| **Taux de déclassement** | % de changements dont la classe initiale a été réduite | < 15% | > 30% → sur-classification systématique |
| **Corrélation classe / incident** | % des incidents en production provenant de changements classés T/F | < 5% | > 15% → les signaux de forçage ne capturent pas les vrais risques |
| **Délai de classification** | Temps entre création de l'item et classification dans le backlog | < 1h pour T/F/M, < 4h pour É/C | > 24h → goulot d'étranglement au Cadrage |
| **Override rate** | % de classes overridées par le développeur vs l'arbre automatique | À mesurer | Tout override É→M ou C→É doit être justifié par écrit |

### 12.2 Métriques DORA corrélées à la classification

| Métrique DORA | Lien avec la classification |
|--------------|---------------------------|
| **Change Failure Rate** (cible < 5%) | Si CFR > 10% : audit des changements récents T/F, peut indiquer une sous-classification |
| **Failed Deployment Recovery Time** (cible < 1h) | Si FDRT > 4h sur un É/C : le plan de rollback était insuffisant |
| **Rework Rate** (2024) | Si rework sur des changements T : revoir les critères de classification T |
| **Change Lead Time** | Mesure l'impact de la friction introduite par le chemin obligatoire selon la classe |

### 12.3 Métriques de risk appetite

| Indicateur | Mesure | Seuil d'alerte |
|-----------|--------|---------------|
| Score risque résiduel moyen (É/C) | Moyenne des scores résiduels après traitement | > 5 → traitement insuffisant |
| Backlog risques É/C ouverts | Nombre de risques É/C sans owner ou sans date de revue | > 3 ouverts → risque de drift |
| CVE Critical en prod non triées | Âge des CVE Critical non corrigées | > 0 après 24h = violation risk tolerance |
| Bypasses non autorisés | Nombre de merges É/C sans validation humaine tracée | 0 toléré → tout écart = incident de processus |

---

## 13. Standards de référence

| Standard | Aspect couvert | Lien avec la classification |
|---------|---------------|---------------------------|
| **ISO 31000:2018** — Risk management guidelines | Framework de gestion des risques, processus en 8 étapes | Les 5 classes T/F/M/É/C implémentent le processus ISO 31000 adapté au contexte solo |
| **NIST SP 800-30 Rev.1** — Guide for Conducting Risk Assessments | Impact × likelihood matrix, 5 niveaux qualitatives | La grille d'impact (1-5) et probabilité (1-5) s'aligne sur les 5 niveaux NIST |
| **OWASP Risk Rating Methodology** | Likelihood factors (skill, motive, opportunity, ease of exploit) × Impact factors (financial, reputation, non-compliance, privacy) | Les signaux de forçage §4.3 capturent les impact factors OWASP les plus élevés (privacy violation, non-compliance) |
| **ISO/IEC/IEEE 29119** — Software Testing | Risk-based testing : depth of test proportional to risk | La modulation de la profondeur de tests dans la matrice §8.1 implémente directement ISO 29119 |
| **ISO/IEC 25010:2023** — Software Quality Model | Safety (nouveau en 2023) : operational constraint, risk identification, fail safe, hazard warning, safe integration | §7 couvre intégralement la dimension Safety |
| **DORA 2024/2025** | Change Failure Rate, Rework Rate, Failed Deployment Recovery Time | §12.2 lie les métriques DORA aux classes de risque |
| **NIST SP 800-218 SSDF v1.1** | Secure Software Development Framework | Les activités obligatoires pour É/C (threat modeling, SAST, DAST, SBOM) implémentent SSDF |
| **OWASP SAMM v2** | Security maturity dans le cycle de développement | Le niveau de maturité sécurité attendu varie par classe (T/F = niveau 1, É/C = niveau 2-3) |

---

## 14. Questions ouvertes (RED CARDS)

Les RED CARDS sont des questions non résolues dont la non-résolution crée un risque systémique pour la classification.

### RED-01 — Mécanisation de la classification (HAUTE PRIORITÉ)

**Question** : comment automatiser la proposition de classe par l'agent, de façon déterministe, sans que l'auteur du changement influe sur la classification ?

**Risque d'inaction** : la classification reste subjective. L'agent peut sous-estimer une classe pour éviter le chemin long.

**Pistes** :
- Parser les fichiers touchés dans le diff → matching avec l'arbre de forçage §4.3
- Lire les labels du PR (auth, payment, migration, etc.)
- Scanner les migrations DB automatiquement
- Croiser avec un catalogue de patterns risqués (ex : `.env`, `migrations/`, `auth/`, `payment/`)

**Critère de résolution** : l'arbre produit une classe proposée en < 30 secondes sur tout diff, avec justification automatique, avant toute interaction humaine.

**Deadline cible** : premier sprint de Build.

### RED-02 — Protocole de promotion de classe en cours de cycle (HAUTE PRIORITÉ)

**Question** : quand un changement classé F s'avère É en cours de Build (ex : découverte d'une table auth dans le diff), quel est le protocole exact ?

**Pistes** :
- Détection : l'agent scanne chaque commit et signale si un signal de forçage apparaît
- Action immédiate : pause de la PR, re-Classification, notification développeur
- Traçabilité : log de la promotion dans `escalation_history`
- Impact sur le sprint : l'item F promu É peut exiger un re-planification de sprint

**Format de log de promotion** :
```yaml
escalation_history:
  - date: "2026-05-05T14:32:00Z"
    from_class: "F"
    to_class: "É"
    trigger: "Fichier auth/session.ts modifié dans commit abc123"
    detected_by: "agent"
    confirmed_by: "developer"
    action: "PR pausée, ADR et threat modeling requis avant reprise"
```

**Critère de résolution** : protocole formalisé dans `.planning/agent/boundaries.yaml` avec test de simulation.

### RED-03 — Granularité M / ambiguïté M↔É (MOYENNE PRIORITÉ)

**Question** : la frontière M/É est la plus floue. Une feature visible utilisateur touchant des données d'usage (non-PII mais comportementales) est-elle M ou É ?

**Tension** : trop de É = sur-friction, vélocité dégradée. Trop de M = sous-protection des données comportementales.

**Piste** : définir explicitement une liste de "données quasi-sensibles" (comportementales, géolocalisation imprécise, préférences révélatrices) avec leur classe minimum.

**Critère de résolution** : liste documentée dans l'arbre de forçage §4.3, avec exemples concrets du projet réel.

### RED-04 — Bypass conditionnel pour F (BASSE PRIORITÉ)

**Question** : les conditions exactes du Bypass pour F ne sont pas encore formalisées. "Bypass autorisé sous conditions" est insuffisamment précis.

**Proposition** :
```
Bypass F autorisé si ET SEULEMENT SI :
  - CI 100% verts (tous gates)
  - Aucun signal de forçage détecté par l'arbre automatique
  - Diff < 100 lignes
  - Aucune modification dans les répertoires : auth/, migrations/, payments/, .env*, config/security*
  - Pas de nouveaux endpoints exposés
```

**Critère de résolution** : conditions formalisées et implémentées dans le harness.

### RED-05 — Mémoire à long terme des classifications (BASSE PRIORITÉ)

**Question** : comment utiliser l'historique des classifications pour informer les futures (ex : "ce type de migration DB a été classé É 3 fois et a généré un incident 2 fois") ?

**Piste** : index sémantique dans `.planning/` permettant de requêter les décisions passées.

**Critère de résolution** : reporté à après stabilisation du cycle mono-état.

---

## 15. Relations avec chaque cycle

### 15.1 Vue de synthèse des points de contact

```
[Discovery]
  └── Classe de l'opportunité → profondeur Discovery (entretiens, OST, spike)
  └── Sortie : class_proposal dans note Discovery

[Cadrage]
  └── Classe cristallisée dans le backlog item (DoR)
  └── Signaux de forçage vérifiés → classe validée ou forcée
  └── Sortie : risk_class dans backlog item metadata

[Conception]
  └── Classe É/C → ADR + Threat model + AIPD déclenchés
  └── Strangler Fig pour C → décomposition en M/É
  └── Sortie : ADR, threat model, AIPD (selon classe)

[Build]
  └── Classe → quality gates CI activés / désactivés
  └── Promotion de classe possible (RED-02)
  └── Sortie : CI report avec classe actée, risk_class dans PR metadata

[Validation]
  └── Classe → profondeur de tests (risk-based testing)
  └── Classe É/C → tests manuels, DAST, mutation testing
  └── Sortie : rapport de validation avec couverture risk-aligned

[Release]
  └── Classe → stratégie de déploiement (direct / canary / canary+flag)
  └── Classe É/C → feature flag, rollback plan testé
  └── Sortie : deployment-evidence.md avec classe + stratégie appliquée

[Run]
  └── Incidents classifiés T→C (même échelle)
  └── Classe incident → protocole de réponse (log → war room → CNIL 72h)
  └── Sortie : incident report avec classe, durée, actions

[Apprentissage]
  └── Audit des classifications passées (promotions, déclassements, corrélation incidents)
  └── Mise à jour de l'arbre de forçage §4.3
  └── Révision du risk appetite §6.5
  └── Sortie : calibration-report.md, arbre mis à jour
```

### 15.2 Invariants inter-cycles

Ces règles s'appliquent **quelle que soit la position dans le pipeline** :

1. **Une classe ne peut pas être réduite sans trace** — tout déclassement doit être justifié et loggué
2. **Le Bypass É/C est interdit dans tous les cycles** — cette règle est indépendante du cycle
3. **La classe d'un incident Run est indépendante de la classe du changement qui l'a causé** — un changement T peut causer un incident É si le contexte a changé
4. **La classification est la première action documentée**, avant tout développement ou analyse approfondie
5. **L'arbre de forçage §4.3 prime sur l'estimation humaine** — si un signal de forçage est présent, la classe minimum est forcée, non négociable

### 15.3 Feedback loops inter-cycles

```
Apprentissage → Discovery   : patterns de mauvaise identification du problème (taux d'abandon M+)
Apprentissage → Cadrage     : mise à jour de l'arbre de forçage
Apprentissage → Conception  : patterns de threat models insuffisants
Run           → Cadrage     : incidents récurrents → nouveau signal de forçage dans l'arbre
Validation    → Cadrage     : défauts échappés post-release → révision des seuils de test par classe
Build         → Conception  : promotions de classe en Build → renforcer la Conception pour ce type de changement
```

---

## Annexe A — Arbre de décision complet (format algorithmique)

```
FONCTION classifier(changement):

  // Étape 1 : signaux de forçage — non négociables
  SI changement.touche(auth | autorisation | sessions) → classe_min = É
  SI changement.touche(paiement | facturation) → classe_min = É
  SI changement.touche(migration_db | schema_db) → classe_min = É
  SI changement.touche(api_publique | contrat_inter_services) → classe_min = É
  SI changement.touche(infra_production) → classe_min = É
  SI changement.touche(pii | données_personnelles) → classe_min = É
  SI changement.touche(données_santé | biométrie) → classe_min = C
  SI changement.touche(données_financières_réglementées) → classe_min = C
  SI changement.touche(multi_services | multi_repos) → classe_min = C
  SI changement.type == "refonte_architecture" → classe_min = C
  SI changement.touche(réglementaire: RGPD | NIS2 | EAA | DORA_financier) → classe_min = C

  // Étape 2 : calcul score composite (si pas de forçage)
  score = impact_estimé × probabilité_estimée

  // Étape 3 : mapping score → classe
  SI score IN [1-2]  → classe_calculée = T
  SI score IN [3-5]  → classe_calculée = F
  SI score IN [6-10] → classe_calculée = M
  SI score IN [11-17] → classe_calculée = É
  SI score IN [18-25] → classe_calculée = C

  // Étape 4 : classe finale = max(classe_min, classe_calculée)
  classe_finale = MAX(classe_min, classe_calculée)

  RETOURNER {
    classe: classe_finale,
    justification: liste_des_signaux_actifs,
    supervision_mode: supervision_mapping[classe_finale],
    deployment_strategy: deployment_mapping[classe_finale],
    mandatory_activities: activities_matrix[classe_finale]
  }
```

---

## Annexe B — Mapping modes de supervision

| Classe | Mode par défaut | Bypass | Auto-décision | Pairing |
|--------|----------------|--------|---------------|---------|
| T | Bypass | ✅ autorisé | ✅ | ○ |
| F | Bypass (conditionnel) | ✅ si conditions RED-04 | ✅ | ○ |
| M | Auto-décision | ✗ | ✅ (défaut) | ○ |
| É | Auto-décision + checkpoint | ✗ | ✅ + validation humaine | ○ |
| C | Pairing recommandé | ✗ ABSOLU | ✅ seulement si visibilité totale | ✅ recommandé |

**Définition des modes** :

- **Bypass** : l'agent fait tout, y compris le triage. Aucune validation humaine active. Acceptable seulement sur T/F car le CI bloquant reste le garde-fou.
- **Auto-décision** : l'agent fait Discovery + propose la solution + le chemin. Le développeur valide au triage. Mode par défaut.
- **Auto-décision + checkpoint** : comme Auto-décision, mais la validation humaine est obligatoire avant merge. L'agent ne peut pas merger seul.
- **Pairing** : le développeur est présent en continu. L'agent suit le flux de pensée. Recommandé pour C, non imposé mais fortement suggéré.

**Garde-fous anti-rubber-stamp** (s'appliquent en Auto-décision) :
- Format de proposition obligatoire : `[problème][alternatives][choix][critère de succès][classe de risque]`
- Quota mental de rejets : ≥ 20% des propositions doivent être challengées ou rejetées
- Audit aléatoire hebdomadaire : une proposition acceptée la veille est relue à froid

---

*Document transversal — Pipeline fractale v4*  
*Maintenu dans : `harness-architecture/docs/transversal/risk-classification.md`*  
*Référence les standards : ISO 31000:2018, NIST SP 800-30 Rev.1, OWASP Risk Rating, ISO/IEC 25010:2023, ISO/IEC/IEEE 29119, DORA 2024/2025*
