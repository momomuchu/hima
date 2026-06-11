# Classification des risques — Document transversal
## Pipeline fractale v4 — Mécanisme pivot central

> **Statut** : document de référence transversal, version 2 (fixes audit GAP-1 à GAP-5)
> **Date** : 2026-05-03
> **Scope** : tous les cycles (`discovery → cadrage → conception → build → validation → release → run → learning`), tous les modes (`bypass` / `auto` / `pairing`)
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

- la **profondeur** de chaque sous-cycle (Observer → Transmit)
- le **mode de supervision** autorisé (`bypass` / `auto` / `pairing`)
- les **activités obligatoires** vs allégées vs skippables
- les **quality gates** bloquants dans le CI/CD
- la **stratégie de déploiement** (direct → canary + feature flag)

**Cinq classes** ordonnées par niveau de risque composite (impact × probabilité) :

| Classe | Libellé | Décision de supervision |
|--------|---------|------------------------|
| **T** | Trivial | Bypass autorisé |
| **L** | Low | Bypass autorisé sous conditions |
| **M** | Moyen | `auto` (défaut) |
| **H** | High | `auto` avec validation humaine obligatoire |
| **C** | Critique | Pairing obligatoire ou validation humaine explicite |

**Règle absolue** : le mode `bypass` est interdit pour H et C. Non négociable.

**Principe de fonctionnement** : l'auteur propose la classe → le harness la vérifie via l'arbre de décision déterministe (4 passes séquentielles) → la classe détermine le chemin obligatoire. Une promotion de classe (L → H découvert en cours de cycle) déclenche un protocole d'escalade immédiat.

---

## 2. Portée transversale

La classification des risques s'applique **à chaque changement individuel** traversant le pipeline, sans exception, quel que soit le cycle en cours.

### 2.1 Cycles couverts

Tous les 8 cycles de la pipeline fractale :

1. **discovery** — classification du risque de l'opportunité (construire la mauvaise chose, validation insuffisante du problème)
2. **cadrage** — classification du risque de l'item au moment de la DoR (avant engagement de build)
3. **conception** — reclassification possible selon la profondeur des décisions techniques
4. **build** — classification de chaque PR / incrément
5. **validation** — profondeur de test déterminée par la classe
6. **release** — stratégie de déploiement déterminée par la classe
7. **run** — severity des incidents entrants classifiés sur la même échelle
8. **learning** — analyse de la justesse des classifications passées (feedback loop)

### 2.2 Sous-cycles couverts

Les 7 étapes fractales — **Observer → Define → Design → Execute → Verify → Capitalize → Transmit** — sont traversées à une profondeur variable selon la classe :

- **T/L** : traverse les 7 étapes en chemin court (secondes à minutes)
- **M** : traverse les 7 étapes en chemin standard (heures)
- **H** : traverse les 7 étapes avec checkpoints obligatoires (heures à jours)
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
- Garantir que les changements à fort risque (H/C) ne passent jamais en Bypass
- Permettre aux changements T/L d'avancer sans friction inutile
- Créer une base de données d'apprentissage pour améliorer la classification future
- Aligner la profondeur de test sur le risque réel (risk-based testing per ISO/IEC/IEEE 29119)

**Ce que le système doit produire** : pour chaque changement, une décision claire sous la forme `[CLASSE] : [JUSTIFICATION EN 1 LIGNE]` inscrite dans le PR template avant tout développement.

---

## 4. Entrées — quand classifier

La classification est déclenchée **systématiquement** aux moments suivants :

### 4.1 Déclencheurs principaux

| Moment | Déclencheur | Qui |
|--------|-------------|-----|
| Entrée en `cadrage` | Item candidat ajouté au backlog | Agent (proposition) + Développeur (validation) |
| Création de PR/branche | Début de développement d'un incrément | Agent (proposition automatique via arbre) |
| Revue de PR | Gate CI obligatoire | Harness (vérification) |
| Découverte en cours de cycle | Signal d'escalade de classe | Agent (détection) + Développeur (confirmation) |
| Incident en `run` | Ticket d'incident entrant | Agent (classification initiale) |
| Rétrospective learning | Audit des classifications passées | Développeur |

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
| Touche auth / autorisation / sessions | **H** |
| Touche paiement / facturation | **H** |
| Touche schéma DB (migration) | **H** |
| Touche API publique / contrat inter-services | **H** |
| Touche infra de production | **H** |
| Données personnelles (PII) | **H** |
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
risk_class: "H"
risk_justification: "Touche le schéma d'authentification et la table sessions"
risk_proposed_by: "agent"
risk_validated_by: "developer"
risk_override: false
risk_classification_date: "2026-05-03"
escalation_history: []
supervision_mode_required: "auto"
deployment_strategy: "canary-progressive"
```

### 5.2 Au niveau du Risk Register projet

Le risk register (`.planning/08-risks/risk-register.md`) est mis à jour à chaque nouveau changement H/C avec :

- ID du risque
- Classe courante
- Impact estimé
- Probabilité estimée
- Score composite
- Traitement (mitigé / accepté / transféré / évité)
- Responsable
- Statut
- Date de revue suivante

### 5.3 Au niveau du cycle learning

Un rapport de calibration des classifications est produit à chaque cycle, contenant :
- Taux de promotions de classe (L → H, M → C, etc.) — indicateur de sous-estimation systématique
- Taux de déclassements (H → M, etc.) — indicateur de sur-estimation systématique
- Corrélation classe initiale / incidents réels en production

### 5.4 Evidence Set obligatoire pour H et C

Pour qu'un item H ou C puisse atteindre le statut `DONE_VERIFIED`, l'Evidence Set doit contenir :

| Preuve | H | C |
|--------|---|---|
| `human_approval_log` — horodatage + identifiant humain | ✅ | ✅ |
| `threat_model_ref` — référence fichier ADR/threat model | ✅ | ✅ |
| `dast_report_ref` — résultat DAST préprod | ✅ | ✅ |
| `rollback_test_evidence` — résultat test rollback staging | ✅ | ✅ |
| `aipd_ref` — référence AIPD produite | ✅ si PII | ✅ |
| `security_audit_ref` — trace revue sécurité indépendante | — | ✅ |

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

**Critères d'exclusion** (forçage vers L au minimum) :
- Toute modification de logique, même d'une ligne
- Toute dépendance avec CVE, même Low
- Tout changement dans un fichier de configuration de sécurité
- Tout fichier dans `auth/`, `security/`, `.env*`, `config/security*`, `migrations/`

**Chemin** : CI verts → merge. Pas de gate humain requis.

**Exemples** : `README.md` mis à jour, variable locale renommée, `lodash@4.17.20 → 4.17.21`

#### L — Low

**Définition** : nouvelle fonctionnalité isolée ou correction de bug non-critique, derrière feature flag, sans données personnelles, sans migration de schéma, sans impact sur des tiers.

**Critères d'inclusion** :
- Nouvelle feature UI isolée derrière feature flag
- Bug fix sur code path non-critique sans changement de contrat API
- Mise à jour de dépendance mineure sans migration
- Ajout de tests d'intégration sur périmètre existant
- Changement de configuration non-sécuritaire dans un service non-critique

**Critères d'exclusion** :
- Tout signal de forçage H (voir §4.3)
- Feature sans feature flag qui modifie un flux utilisateur existant → M minimum
- Diff net > 300 lignes de code de production → M minimum

**Chemin** : review de code ≥1 + CI verts → merge.

**Bypass conditionnel** : autorisé si ET SEULEMENT SI les cinq conditions suivantes sont toutes vraies :
1. CI 100% verts (tous gates : lint, unit, SAST, secrets scan)
2. Aucun signal de forçage H/C détecté par l'arbre automatique
3. Diff net ≤ 100 lignes de code de production
4. Aucun fichier dans : `auth/`, `migrations/`, `payments/`, `.env*`, `config/security*`
5. Aucun nouvel endpoint exposé ni modification de contrat API

**Exemples** : bouton "dark mode" derrière `ff_dark_mode`, correction d'une typo dans un message d'erreur non sécuritaire

#### M — Moyen

**Définition** : nouvelle fonctionnalité visible utilisateur, pas de PII sensible, pas de migration de schéma DB, pas d'impact tiers, impact limité à un seul service.

**Critères d'inclusion** :
- Feature visible utilisateur derrière ou sans feature flag (mais risque contenu)
- Bug fix sur un flux critique mais sans données sensibles
- Refactor structurel modifiant des interfaces internes (mais non-publiques)
- Dépendance minor upgrade avec changements non-breaking documentés
- Changement de configuration avec impact sur le comportement visible

**Critères d'exclusion** :
- Dès qu'un signal H apparaît (auth, PII, migration DB, API publique)

**Chemin** : `discovery` partielle + analyse fonctionnelle + review ≥1 + tests intégration + CI verts → merge. Validation produit requise.

**Bypass** : INTERDIT. Exception unique : si un HUMAN_OVERRIDE est enregistré avec justification documentée et CI 100% verts et aucun signal de forçage actif, le bypass M peut être autorisé. Ce cas est tracé dans `escalation_history` avec `type: "bypass_override_M"`.

**Exemples** : nouvelle page de résultats de recherche, refactor du service de recommandations, upgrade `react@18.2 → 18.3`

#### H — High

**Définition** : changement touchant un système sensible (auth, paiement, données perso, infra prod, API publique, schéma DB). Risque de régression grave ou d'incident de sécurité si mal traité.

**Critères d'inclusion** : voir signaux de forçage §4.3 (auth, paiement, PII, schéma DB, API publique, infra prod).

**Chemin obligatoire** :
- `discovery` complète avec validation du problème
- ADR documenté
- Threat modeling STRIDE (si touche sécurité)
- AIPD si données personnelles
- Tests E2E sur parcours critiques
- DAST sur preprod
- Review ≥2 (ou développeur + self-review différée + agent antagoniste en solo)
- Déploiement canary 5%→25%→50%→100% avec gates SLO à chaque palier
- Feature flag obligatoire
- Plan de rollback testé en staging
- Validation humaine explicite et loggée avant merge

**Mode supervision** : `auto` avec checkpoint humain obligatoire. `bypass` interdit.

**Exemples** : modification du flux d'authentification, migration de la table `users`, ajout d'un endpoint REST public, changement de politique de session

#### C — Critique

**Définition** : changement à impact transverse ou réglementaire — données de santé/biométrie/financières, refonte d'architecture, rupture de contrat API publique, exigence NIS2/RGPD/DORA financier/EAA. Peut impacter plusieurs services, des utilisateurs tiers, ou créer une obligation légale.

**Critères d'inclusion** : voir signaux de forçage §4.3 (santé, biométrie, financier réglementé, multi-services, refonte archi, réglementaire).

**Chemin obligatoire** :
- Tout ce qui est obligatoire pour H, PLUS :
- Threat modeling complet (STRIDE + LINDDUN si privacy)
- AIPD obligatoire
- Revue sécurité indépendante (ou agent antagoniste en solo avec trace)
- Tests de charge si applicable
- Canary + feature flag + communication aux parties prenantes
- Plan de rollback répété (testé ≥ 2 fois en staging)
- Postmortem prévu si échec (template pré-rempli avant déploiement)
- Validation humaine avec signature explicite (log)

**Mode supervision** : `pairing` recommandé. `auto` uniquement si le développeur a une visibilité complète sur le changement. `bypass` absolument interdit.

**Exemples** : intégration paiements Stripe production, modification schéma données santé, refonte architecture multi-tenant, mise en conformité NIS2

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
| 3–5 | **L** | Low — traitement standard allégé |
| 6–10 | **M** | Moyen — traitement standard complet |
| 11–17 | **H** | High — traitement renforcé, validation humaine |
| 18–25 | **C** | Critique — traitement maximal, pairing recommandé |

**Note sur la combinatoire** : un impact catastrophique (5) même avec une probabilité très faible (1) donne un score de 5 = classe L. C'est intentionnel — dans le contexte dev solo, on ne peut pas traiter chaque changement théoriquement risqué comme critique. Cependant, les signaux de forçage §4.3 surchargent ce calcul pour les domaines où le développeur a démontré des conséquences concrètes (auth, PII, etc.).

### 6.5 Risk appetite — profil du développeur solo

Le risk appetite du développeur solo + agent IA est le suivant :

| Dimension | Tolérance | Justification |
|-----------|-----------|--------------|
| Vitesse de livraison T/L | High | Friction nulle justifiée pour les changements réversibles à faible impact |
| Sécurité applicative | Zéro tolérance pour H/C | Bypass interdit sur auth/PII/paiement — non négociable |
| Disponibilité | Tolérance faible | Solo dev : pas de garde de nuit, incident = perte de productivité significative |
| Compliance réglementaire | Zéro tolérance | Sanctions RGPD (jusqu'à 4% CA ou 20M€) et EAA rendent l'acceptation impossible |
| Dette technique | Tolérance moyenne | Acceptable si trackée et remboursée dans les 2 cycles suivants |
| Coût LLM/infra | Tolérance moyenne | Budget cap requis mais non bloquant si ROI positif documenté |

**Seuil d'acceptation du risque résiduel** : après traitement, un risque est acceptable si son score résiduel est ≤ 5 (classes T/L). Un risque résiduel M (6-10) est acceptable uniquement avec une décision documentée et une date de revue. Un risque résiduel H/C n'est jamais acceptable sans traitement complémentaire.

### 6.6 Risk tolerance — limites non négociables

Quatre limites absolues, jamais overridables :

1. **`bypass` interdit sur H/C** — quelle que soit la confiance dans l'agent
2. **Aucun changement de schéma DB sans plan expand/contract documenté** — classe H minimum
3. **Aucune donnée de santé/biométrie sans AIPD et chiffrement validés** — classe C minimum
4. **Aucune CVE Critical non triée en production > 24h** — déclenche une escalade immédiate vers C si non corrigée

---

## 7. Critères qualité — ISO 25010:2023 — dimension Safety

ISO 25010:2023 introduit **Safety** comme 9e caractéristique produit (nouveauté par rapport à la version 2011). Elle est directement liée à la classification des risques.

### 7.1 Sous-caractéristiques Safety applicables

| Sous-caractéristique | Application à la classification |
|---------------------|--------------------------------|
| **Operational constraint** | Les limites de bypass (T/L uniquement) constituent une contrainte opérationnelle formelle |
| **Risk identification** | L'arbre de décision §4.3 est le mécanisme d'identification des risques |
| **Fail safe** | La promotion de classe déclenchée par les signaux de forçage est le comportement fail-safe |
| **Hazard warning** | Les RED CARDS §14 sont les avertissements de danger actifs |
| **Safe integration** | La stratégie de déploiement modulée par classe (canary pour H/C) est le mécanisme de safe integration |

### 7.2 Interaction avec les autres caractéristiques ISO 25010:2023

- **Security** : directement pilotée par les classes H/C (threat modeling, DAST, revue sécurité)
- **Reliability** : la stratégie de déploiement canary pour M+ protège la fiabilité en production
- **Maintainability** : la traçabilité de la classification (arbre + justification) améliore l'analysabilité
- **Functional suitability** : la Discovery obligatoire pour H/C valide l'adéquation fonctionnelle

---

## 8. Matrice de modulation par classe de risque

**C'est le livrable central.** Cette matrice définit ce qui est obligatoire (✅), recommandé (○), allégé (◔), conditionnel (≈), ou skippable (—) pour chaque activité de la pipeline, selon la classe de risque.

### 8.1 Matrice complète — 48 activités × 5 classes

| Activité | T (Trivial) | L (Low) | M (Moyen) | H (High) | C (Critique) |
|----------|:-----------:|:----------:|:---------:|:---------:|:------------:|
| **discovery** | | | | | |
| Validation problème / discovery formelle | — | ◔ | ○ | ✅ | ✅ |
| Entretiens utilisateurs / JTBD | — | — | ○ | ✅ | ✅ |
| Opportunity Solution Tree | — | — | ◔ | ✅ | ✅ |
| Spike technique timeboxé | — | — | ○ | ○ | ○ |
| **cadrage** | | | | | |
| DoR formelle | ◔ | ○ | ✅ | ✅ | ✅ |
| Classification de risque explicite | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analyse fonctionnelle | — | ◔ | ✅ | ✅ | ✅ |
| **conception** | | | | | |
| ADR (Architecture Decision Record) | — | ◔ | ○ | ✅ | ✅ |
| Threat modeling STRIDE | — | — | ○ | ✅ | ✅ |
| AIPD / DPIA | — | — | ≈ données perso | ✅ si PII | ✅ |
| Threat modeling LINDDUN (privacy) | — | — | — | ≈ si PII | ✅ si PII |
| Estimation FinOps | — | ◔ | ○ | ✅ | ✅ |
| Conception détaillée (design doc) | — | ◔ | ○ | ✅ | ✅ |
| Plan de migration expand/contract | — | — | ≈ si schéma | ✅ si schéma | ✅ |
| **build** | | | | | |
| Tests unitaires | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests d'intégration | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests E2E parcours critiques | — | ◔ | ○ | ✅ | ✅ |
| SAST / SCA (CI) | ✅ | ✅ | ✅ | ✅ | ✅ |
| DAST (preprod) | — | — | ○ | ✅ | ✅ |
| IaC / container scanning | ≈ si touché | ✅ | ✅ | ✅ | ✅ |
| Secrets scan | ✅ | ✅ | ✅ | ✅ | ✅ |
| SBOM (CycloneDX/SPDX) | — | — | ○ | ✅ | ✅ |
| Signature artefact (Cosign/Sigstore) | — | — | — | ✅ | ✅ |
| TDD obligatoire | ◔ | ○ | ✅ | ✅ | ✅ |
| Mutation testing zones critiques | — | — | ○ | ✅ | ✅ |
| **validation** | | | | | |
| Revue de code (peer / self-review différée) | ◔ | ✅ | ✅ | ✅ (≥2 ou solo+agent) | ✅ (≥2) |
| Quality gates CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Validation produit / acceptance | — | ◔ | ✅ | ✅ | ✅ |
| QA risk-based | — | ◔ | ○ | ✅ | ✅ |
| Tests d'accessibilité automatisés (axe-core) | ◔ | ✅ auto | ✅ auto | ✅ + manuel | ✅ + audit |
| Tests de charge / performance | — | — | ○ | ✅ | ✅ |
| Tests i18n / RTL | — | ◔ | ○ | ✅ | ✅ |
| Vérification budget FinOps | — | ◔ | ○ | ✅ | ✅ |
| Tests de contrat (Pact / OpenAPI) | — | — | ○ | ✅ | ✅ |
| ASVS L1/L2/L3 | — | — | L1 | L2 | L3 |
| Fuzzing endpoints API | — | — | — | ○ | ✅ |
| Revue de sécurité indépendante | — | — | — | ○ | ✅ |
| **release** | | | | | |
| Stratégie déploiement | direct | direct | canary 10% | canary 5%→25%→50%→100% gates SLO | canary 5%→25%→50%→100% + feature flag obligatoire |
| Feature flag | — | ○ | ○ | ✅ | ✅ |
| Plan de rollback | implicite | ✅ | ✅ | ✅ + testé | ✅ + répété |
| Smoke tests post-déploiement | — | ◔ | ✅ | ✅ | ✅ |
| Communication parties prenantes | — | équipe | équipe | élargie | élargie + externe |
| **run** | | | | | |
| Surveillance SLO active | ◔ | ◔ | ✅ | ✅ | ✅ |
| Postmortem si incident | léger | ✅ | ✅ | ✅ + revue | ✅ + audit indépendant |
| **MODE DE SUPERVISION** | | | | | |
| `bypass` autorisé | ✅ | ✅ (5 conditions §6.1.L) | ✗ sauf HUMAN_OVERRIDE | ✗ | ✗ |
| `auto` | ✅ | ✅ | ✅ (défaut) | ✅ + checkpoint | ✗ (si doute) |
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

SI classe == L :
  chemin = review ≥1 + CI verts → merge
  supervision = bypass autorisé (si CI verts ET 5 conditions §6.1.L réunies)

SI classe == M :
  chemin = analyse fonctionnelle + review ≥1 + tests intégration + CI verts + validation produit → merge
  supervision = auto (mode par défaut)
  Bypass = INTERDIT (sauf HUMAN_OVERRIDE enregistré, tracé, CI verts, aucun signal forçage)

SI classe == H :
  chemin = discovery + ADR + Threat model + review ≥2 + DAST + canary 5%→100% + feature flag + rollback testé + VALIDATION HUMAINE → merge
  supervision = auto avec checkpoint humain obligatoire
  Bypass = INTERDIT

SI classe == C :
  chemin = Tout H PLUS threat model complet + AIPD + audit sécurité + canary + communication + rollback répété + VALIDATION HUMAINE EXPLICITE + LOG → merge
  supervision = pairing recommandé, auto uniquement si visibilité totale
  Bypass = ABSOLUMENT INTERDIT
```

---

## 9. Application fractale par cycle

### 9.1 discovery

**Risques spécifiques** : construire la mauvaise chose, valider un problème fictif, spike sans fin.

| Activité discovery | Modulation |
|-------------------|-----------|
| Validation du problème | Obligatoire si H/C, optionnelle si M, skippable si T/L |
| Nombre d'entretiens utilisateurs requis | T/L : 0, M : ≥3, H : ≥5, C : ≥5 + source quantitative |
| Spike timeboxé | T/L : non requis, M/H/C : max 5 jours, sortie = décision + ADR |
| Classification de l'opportunité | Se fait en sortie de discovery, avant entrée en cadrage |

**Mécanisme fractal** : l'étape Observer de `discovery` classe d'abord l'opportunité. Si H/C, l'étape Define est approfondie (entretiens, JTBD complet). Si T/L, l'étape Define est réduite à un one-liner.

### 9.2 cadrage

**Risques spécifiques** : engagement de build sans DoR suffisante, périmètre flou, dépendances non identifiées.

La classification se cristallise en `cadrage` : c'est ici que la classe devient officielle et est inscrite dans le backlog item.

| Sortie obligatoire du cadrage | T | L | M | H | C |
|------------------------------|---|---|---|---|---|
| Classe de risque inscrite | ✅ | ✅ | ✅ | ✅ | ✅ |
| DoR formelle complète | ◔ | ○ | ✅ | ✅ | ✅ |
| Dépendances identifiées | ◔ | ✅ | ✅ | ✅ | ✅ |
| Impact privacy identifié | — | ◔ | ✅ | ✅ | ✅ |
| Impact accessibility identifié | — | ◔ | ✅ | ✅ | ✅ |
| Périmètre IN/OUT explicite | — | ◔ | ✅ | ✅ | ✅ |

### 9.3 conception

**Risques spécifiques** : décision d'architecture non documentée, surface d'attaque non modélisée, migration de schéma sans plan.

Pour H/C, `conception` est une phase non-négociable. Elle produit l'ADR, le threat model, et déclenche l'AIPD si applicable.

**Pattern Strangler Fig** : tout changement d'architecture classé C doit être décomposé via Strangler Fig en une séquence de changements M/H. Chaque étape de la décomposition est reclassifiée individuellement. Ce pattern transforme un C en séquence L/M, réduisant le risque à chaque étape tout en maintenant la traçabilité du changement global.

### 9.4 build

**Risques spécifiques** : régression, dette technique accumulée, sécurité non implémentée.

L'inner loop de `build` traverse le sous-cycle Observer → Verify pour chaque incrément. La classe détermine le niveau de quality gates CI bloquants :

| Gate CI | T | L | M | H | C |
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

### 9.5 validation

**Risques spécifiques** : défaut non détecté avant production, test coverage inadéquat.

Le risk-based testing (ISO/IEC/IEEE 29119) alloue l'effort de test proportionnellement au produit vraisemblance × impact. Pour H/C :

- Tests exploratoires sur les zones rouges (chemin happy + chemins d'erreur + edge cases sécurité)
- Tests de régression complète (non seulement la zone touchée)
- Tests d'authz/authn pour H
- Fuzzing pour C sur les endpoints exposés
- Tests de contrat (Pact / OpenAPI contract testing) pour les services avec API publique
- ASVS L2 pour H, ASVS L3 pour C

### 9.6 release

**Risques spécifiques** : incident de déploiement, rollback impossible, communication insuffisante.

| Stratégie de déploiement | Justification |
|--------------------------|--------------|
| T/L → direct | Changement réversible, impact minimal |
| M → canary 10% | Valide en production avant exposition totale |
| H → canary 5%→25%→50%→100% avec gates SLO | Chaque palier conditionné au maintien des SLO |
| C → canary 5%→25%→50%→100% + feature flag obligatoire | Découplage déploiement / release ; rollback en un toggle |

### 9.7 run

**Risques spécifiques** : dégradation silencieuse, erreur budget épuisé, incident non détecté.

La classification des incidents entrants utilise la même échelle T/L/M/H/C :

| Sévérité incident | Classe | Action |
|------------------|--------|--------|
| Cosmétique, aucun utilisateur impacté | T | Log uniquement |
| Impact partiel, <10 utilisateurs, récupération <1h | L | Hotfix dans le sprint courant |
| Flux dégradé, >10 utilisateurs, récupération <4h | M | Hotfix prioritaire + postmortem léger |
| Service critique indisponible, toute user-base | H | War room immédiate + postmortem complet |
| Atteinte données sensibles, violation réglementaire | C | War room + notification CNIL 72h + postmortem + audit |

### 9.8 learning

**C'est ici que le système s'améliore.** Chaque cycle learning produit :

1. **Calibration report** : combien de promotions de classe ont eu lieu, dans quel sens, sur quel type de changement
2. **Pattern update** : l'arbre de décision §4.3 est mis à jour avec les nouveaux signaux identifiés
3. **Biais détectés** : l'agent sous-estime-t-il systématiquement certaines classes ? (ex : migration DB classée M au lieu de H)
4. **Risk appetite review** : les seuils de tolérance §6.5 sont-ils encore calibrés correctement ?

---

## 10. Activités transversales impactées

Ces activités ne sont pas des phases — elles imprègnent tous les cycles. La classification module leur intensité.

### 10.1 Sécurité shift-left (DevSecOps)

| Classe | Threat Modeling | SAST | DAST | IaC/Container | Supply chain (SLSA) |
|--------|----------------|------|------|---------------|---------------------|
| T | — | ✅ CI | — | ≈ si touché | — |
| L | — | ✅ CI | — | ✅ | — |
| M | ○ (STRIDE léger) | ✅ CI | ○ preprod | ✅ | ○ |
| H | ✅ STRIDE complet | ✅ + revue | ✅ bloquant | ✅ | ✅ SLSA 2+ |
| C | ✅ STRIDE + LINDDUN | ✅ + audit | ✅ + fuzzing | ✅ | ✅ SLSA 3 |

### 10.2 Privacy / RGPD by Design

| Classe | Registre traitement | AIPD | Droits personnes | Pseudonymisation |
|--------|--------------------|----|-----------------|-----------------|
| T/L | — | — | — | ≈ si logs |
| M | ≈ si nouvelles données | ≈ conditionnel | ✅ si nouvelles données | ✅ si données staging |
| H | ✅ mise à jour | ✅ si PII | ✅ | ✅ |
| C | ✅ mise à jour | ✅ obligatoire | ✅ + délai ≤30j | ✅ + chiffrement validé |

### 10.3 FinOps

| Classe | Impact coût documenté | Budget cap LLM | Anomaly detection |
|--------|-----------------------|----------------|------------------|
| T/L | — | ◔ | ◔ |
| M | ○ | ✅ | ✅ |
| H | ✅ | ✅ | ✅ |
| C | ✅ + revue architecture | ✅ | ✅ bloquant |

### 10.4 Accessibilité by design (EAA — en vigueur depuis 28 juin 2025)

| Classe | Tests auto (axe-core CI) | Tests manuels | Audit expert |
|--------|--------------------------|---------------|-------------|
| T/L | ◔ | — | — |
| M | ✅ | — | — |
| H | ✅ | ✅ sur parcours touchés | ○ |
| C | ✅ | ✅ complet | ✅ si produit critique EAA |

### 10.5 Tests (risk-based testing, ISO/IEC/IEEE 29119)

La profondeur de test est **directement fonction de la classe** :

```
Classe T : tests existants verts suffisent (pas de nouveaux tests requis si refactor)
Classe L : nouveaux tests unitaires + intégration sur les fonctionnalités ajoutées
Classe M : tests pyramide / trophée selon le type de code, mutation testing ○ (≥ 60% zones critiques recommandé)
Classe H : tests pyramide + contrat inter-services + mutation testing ✅ ≥ 70% score zones critiques
Classe C : tout H + mutation testing ≥ 80% zones critiques + property-based testing + tests de charge + fuzzing endpoints exposés
```

---

## 11. Artefacts produits

### 11.1 Par changement

| Artefact | T | L | M | H | C |
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
class: "H"
title: "Migration schéma auth — risque de régression session"
description: >
  La migration du champ user_role vers une table séparée peut casser
  les sessions actives si le rollback n'est pas propre.
impact_level: 4           # Majeur
impact_description: "Service auth indisponible, tous les utilisateurs déconnectés"
probability_level: 2       # Improbable
probability_description: "Stratégie expand/contract réduit la probabilité"
score: 8                   # = 4 × 2
residual_class: "L"        # Après mitigation
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

**Classe proposée** : [ ] T  [ ] L  [ ] M  [x] H  [ ] C

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

**Mode de supervision requis** : auto + validation humaine explicite
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
| **Corrélation classe / incident** | % des incidents en production provenant de changements classés T/L | < 5% | > 15% → les signaux de forçage ne capturent pas les vrais risques |
| **Délai de classification** | Temps entre création de l'item et classification dans le backlog | < 1h pour T/L/M, < 4h pour H/C | > 24h → goulot d'étranglement au Cadrage |
| **Override rate** | % de classes overridées par le développeur vs l'arbre automatique | À mesurer | Tout override H→M ou C→H doit être justifié par écrit |

### 12.2 Métriques DORA corrélées à la classification

| Métrique DORA | Lien avec la classification |
|--------------|---------------------------|
| **Change Failure Rate** (cible < 5%) | Si CFR > 10% : audit des changements récents T/L, peut indiquer une sous-classification |
| **Failed Deployment Recovery Time** (cible < 1h) | Si FDRT > 4h sur un H/C : le plan de rollback était insuffisant |
| **Rework Rate** (2024) | Si rework sur des changements T : revoir les critères de classification T |
| **Change Lead Time** | Mesure l'impact de la friction introduite par le chemin obligatoire selon la classe |

### 12.3 Métriques de risk appetite

| Indicateur | Mesure | Seuil d'alerte |
|-----------|--------|---------------|
| Score risque résiduel moyen (H/C) | Moyenne des scores résiduels après traitement | > 5 → traitement insuffisant |
| Backlog risques H/C ouverts | Nombre de risques H/C sans owner ou sans date de revue | > 3 ouverts → risque de drift |
| CVE Critical en prod non triées | Âge des CVE Critical non corrigées | > 0 après 24h = violation risk tolerance |
| Bypasses non autorisés | Nombre de merges H/C sans validation humaine tracée | 0 toléré → tout écart = incident de processus |

---

## 13. Standards de référence

| Standard | Aspect couvert | Lien avec la classification |
|---------|---------------|---------------------------|
| **ISO 31000:2018** — Risk management guidelines | Framework de gestion des risques, processus en 8 étapes | Les 5 classes T/L/M/H/C implémentent le processus ISO 31000 adapté au contexte solo |
| **NIST SP 800-30 Rev.1** — Guide for Conducting Risk Assessments | Impact × likelihood matrix, 5 niveaux qualitatives | La grille d'impact (1-5) et probabilité (1-5) s'aligne sur les 5 niveaux NIST |
| **OWASP Risk Rating Methodology** | Likelihood factors × Impact factors (financial, reputation, non-compliance, privacy) | Les signaux de forçage §4.3 capturent les impact factors OWASP les plus élevés (privacy violation, non-compliance) |
| **ISO/IEC/IEEE 29119** — Software Testing | Risk-based testing : depth of test proportional to risk | La modulation de la profondeur de tests dans la matrice §8.1 implémente directement ISO 29119 |
| **ISO/IEC 25010:2023** — Software Quality Model | Safety (nouveau en 2023) : operational constraint, risk identification, fail safe, hazard warning, safe integration | §7 couvre intégralement la dimension Safety |
| **DORA 2024/2025** | Change Failure Rate, Rework Rate, Failed Deployment Recovery Time | §12.2 lie les métriques DORA aux classes de risque |
| **NIST SP 800-218 SSDF v1.1** | Secure Software Development Framework | Les activités obligatoires pour H/C (threat modeling, SAST, DAST, SBOM) implémentent SSDF |
| **OWASP SAMM v2** | Security maturity dans le cycle de développement | Le niveau de maturité sécurité attendu varie par classe (T/L = niveau 1, H/C = niveau 2-3) |
| **SPACE Framework** (Forsgren et al., 2021) | Satisfaction, Performance, Activity, Communication/Collaboration, Efficiency | La calibration du risk appetite §6.5 inclut la dimension productivité (Efficiency) et bien-être (Satisfaction) du développeur solo |

---

## 14. Décisions closes et suivis résiduels (RED CARDS)

Les anciennes RED CARDS dont la réponse est couverte par les specs ne restent pas ouvertes dans ce document. Les éléments ci-dessous sont des décisions closes ou des suivis d'implémentation non bloquants.

### RED-01 — Mécanisation de la classification (RÉSOLUE en Conception)

**Statut** : RÉSOLUE — formalisée dans `docs/conception/02-risk-classifier-spec.md`

**Résolution** : classification déterministe en 4 passes séquentielles, proposée par l'agent via `classifyRisk(changeset)` en < 30ms. Les passes 1 et 2 (signaux de forçage C puis H) sont non négociables et produisent une classe minimale forcée. La passe 3 (score composite impact × probabilité) s'applique uniquement en l'absence de signal de forçage. La passe 4 prend le maximum des deux.

```
PASSE 1 — Signaux de forçage C (non négociables)
  a. Fichier dans health/, biometric/, medical/
  b. Types : health_data, biometric, financial_regulated
  c. Changement touchant ≥ 2 services/repos distincts
  d. Type : architecture_refactor ou label arch-refactor
  e. Label/mention : RGPD art.35, NIS2, EAA, DORA-financial, PCI-DSS
  → classe_min = C

PASSE 2 — Signaux de forçage H (non négociables, si classe_min < H)
  a. Fichier dans auth/, authorization/, sessions/, oauth/, sso/
  b. Fichier dans payments/, billing/, invoices/, subscriptions/
  c. Fichier dans migrations/, *.migration.ts, *.sql (DDL)
  d. Contenu diff : CREATE TABLE, ALTER TABLE, DROP, ADD COLUMN
  e. Fichier dans api/public/, openapi.yaml, swagger.json, *.proto
  f. Fichier dans infra/, terraform/, k8s/, docker-compose.prod*
  g. Label : auth, payment, migration, api-breaking, pii, infra-prod
  h. Champ PII dans diff : email, password, ssn, phone, address
  → classe_min = H

PASSE 3 — Score composite (si aucun signal de forçage actif)
  score = impact_estimé × probabilité_estimée (1–25)
  → classe_calculée via mapping §6.4

PASSE 4 — Classe finale
  classe_finale = MAX(classe_min, classe_calculée)
```

**Propriété de monotonie** : la classe finale est toujours ≥ à chaque classe intermédiaire. L'arbre ne peut jamais produire une classe inférieure à un signal de forçage actif.

**Critère atteint** : arbre déterministe, < 30 secondes, justification automatique produite avant toute interaction humaine.

**Référence d'implémentation** : l'arbre algorithmique complet en Annexe A (format pseudocode) constitue la référence exécutable de la classification. En attendant l'automatisation complète dans le harness (`packages/core/src/risk-classifier/`), l'Annexe A sert de spécification de référence pour toute classification manuelle ou semi-automatique.

### RED-02 — Protocole de promotion de classe en cours de cycle (RÉSOLUE en Conception)

**Statut** : RÉSOLUE — formalisée dans `docs/conception/02-risk-classifier-spec.md §5`

**Résolution** : protocole formalisé avec machine à états explicite. Principe central : pause immédiate + notification + re-classification + déclenchement du chemin obligatoire de la nouvelle classe.

**Machine à états de promotion** :
```
État CLASSIFIED(L)
      │
      │ [signal de forçage H détecté dans commit — scan à chaque push]
      ▼
État ESCALATION_DETECTED
      │
      │ [notification immédiate au développeur]
      │ [PR mise en pause — aucun nouveau commit accepté]
      ▼
État AWAITING_HUMAN_CONFIRMATION
      │                    │
      │ [confirmé]         │ [contesté dans < 4h]
      ▼                    ▼
État PROMOTED(H)      État OVERRIDE_REVIEW
```

**Format de log de promotion** :
```yaml
escalation_history:
  - timestamp: "2026-05-05T14:32:00Z"
    from_class: "L"
    to_class: "H"
    trigger_signal: "auth"
    trigger_file: "src/auth/session.ts"
    trigger_commit: "abc1234"
    detected_by: "harness-auto"
    confirmed_by: "developer"
    confirmation_timestamp: "2026-05-05T14:45:00Z"
    actions_triggered:
      - "PR pausée"
      - "ADR requis"
      - "Threat modeling STRIDE requis"
      - "Review ≥2 activée"
      - "Canary 5%→100% activé"
    sprint_impact: "estimation +2 jours"
```

**Règles d'escalade chaînée** :
- Une promotion ne peut sauter qu'une classe à la fois (L → H autorisé, L → C requiert confirmation supplémentaire)
- Chaque promotion est irréversible sans dérogation manuelle explicite (voir §6.1 critères d'exclusion)
- Une promotion ne peut jamais être silencieuse — tout signal de forçage détecté produit soit une promotion tracée, soit une dérogation documentée

**Critère atteint** : protocole formalisé dans la spec de Conception. Implémentation cible : `packages/core/src/risk-classifier/` + section `policy` de `.planning/run-set.json`.

### RED-03 — Granularité M / ambiguïté M↔H (CLOSE)

**Statut** : CLOSE — la frontière M/H est couverte par les signaux de forçage §4.3 et par `docs/conception/02-risk-classifier-spec.md`.

**Décision** : les données personnelles, auth, paiement, schéma DB, API publique, contrat inter-services et infra production forcent H. Les données d'usage non-PII restent M sauf si elles deviennent quasi-sensibles par combinaison, suivi individualisé, décision automatisée à effet significatif, ou obligation réglementaire ; dans ces cas le signal privacy/compliance force H ou C.

**Suivi non bloquant** : enrichir les exemples projet dans la spec quand de nouveaux cas réels apparaissent.

### RED-04 — Bypass conditionnel pour L et M (CLOSE)

**Statut L** : RÉSOLU — les 5 conditions exactes sont formalisées dans §6.1.L ci-dessus et dans `docs/conception/02-risk-classifier-spec.md`.

```
Bypass L autorisé si ET SEULEMENT SI :
  1. CI 100% verts (tous gates : lint, unit, SAST, secrets scan)
  2. Aucun signal de forçage H/C détecté par l'arbre automatique
  3. Diff net ≤ 100 lignes de code de production
  4. Aucun fichier dans : auth/, migrations/, payments/, .env*, config/security*
  5. Aucun nouvel endpoint exposé ni modification de contrat API
```

**Statut M** : PARTIELLEMENT RÉSOLU — conditions définies ci-dessous, implémentation harness à faire.

```
Bypass M autorisé si ET SEULEMENT SI (exception stricte) :
  - HUMAN_OVERRIDE enregistré avec justification documentée
  - CI 100% verts (tous gates)
  - Aucun signal de forçage H/C détecté par l'arbre automatique
  - Développeur présent et confirmant explicitement
  - Tracé dans escalation_history avec type: "bypass_override_M"
```

**Critère de résolution** : conditions M formalisées et implémentées dans le harness. Source de vérité : `docs/conception/02-risk-classifier-spec.md`.

### RED-05 — Mémoire à long terme des classifications (SUIVI)

**Question résiduelle** : comment exploiter les historiques de classification stockés comme sections de `.planning/run-set.json` pour informer les futures décisions (ex : "ce type de migration DB a été classé H 3 fois et a généré un incident 2 fois") ?

**Piste** : index sémantique dérivé de `.planning/run-set.json`, sans introduire de nouveau fichier physique contractuel.

**Critère de résolution** : reporté à après stabilisation du cycle mono-état.

---

## 15. Relations avec chaque cycle

### 15.1 Vue de synthèse des points de contact

```
[discovery]
  └── Classe de l'opportunité → profondeur Discovery (entretiens, OST, spike)
  └── Sortie : class_proposal dans note Discovery

[cadrage]
  └── Classe cristallisée dans le backlog item (DoR)
  └── Signaux de forçage vérifiés → classe validée ou forcée
  └── Sortie : risk_class dans backlog item metadata

[conception]
  └── Classe H/C → ADR + Threat model + AIPD déclenchés
  └── Strangler Fig pour C → décomposition en M/H
  └── Sortie : ADR, threat model, AIPD (selon classe)

[build]
  └── Classe → quality gates CI activés / désactivés
  └── Promotion de classe possible (RED-02 — résolu)
  └── Sortie : CI report avec classe actée, risk_class dans PR metadata

[validation]
  └── Classe → profondeur de tests (risk-based testing)
  └── Classe H/C → tests manuels, DAST, mutation testing
  └── Sortie : rapport de validation avec couverture risk-aligned

[release]
  └── Classe → stratégie de déploiement (direct / canary 10% / canary progressif 5%→100%)
  └── Classe H/C → feature flag, rollback plan testé
  └── Sortie : deployment-evidence.md avec classe + stratégie appliquée

[run]
  └── Incidents classifiés T→C (même échelle)
  └── Classe incident → protocole de réponse (log → war room → CNIL 72h)
  └── Sortie : incident report avec classe, durée, actions

[learning]
  └── Audit des classifications passées (promotions, déclassements, corrélation incidents)
  └── Mise à jour de l'arbre de forçage §4.3
  └── Révision du risk appetite §6.5
  └── Sortie : calibration-report.md, arbre mis à jour
```

### 15.2 Invariants inter-cycles

Ces règles s'appliquent **quelle que soit la position dans le pipeline** :

1. **Une classe ne peut pas être réduite sans trace** — tout déclassement doit être justifié et loggué
2. **Le Bypass H/C est interdit dans tous les cycles** — cette règle est indépendante du cycle
3. **La classe d'un incident run est indépendante de la classe du changement qui l'a causé** — un changement T peut causer un incident H si le contexte a changé
4. **La classification est la première action documentée**, avant tout développement ou analyse approfondie
5. **L'arbre de forçage §4.3 prime sur l'estimation humaine** — si un signal de forçage est présent, la classe minimum est forcée, non négociable

### 15.3 Feedback loops inter-cycles

```
learning   → discovery  : patterns de mauvaise identification du problème (taux d'abandon M+)
learning   → cadrage    : mise à jour de l'arbre de forçage
learning   → conception : patterns de threat models insuffisants
run        → cadrage    : incidents récurrents → nouveau signal de forçage dans l'arbre
validation → cadrage    : défauts échappés post-release → révision des seuils de test par classe
build      → conception : promotions de classe en build → renforcer la conception pour ce type de changement
```

---

## Annexe A — Arbre de décision complet (format algorithmique)

```
FONCTION classifier(changement):

  // Étape 1 (PASSE 1) : signaux de forçage C — non négociables
  SI changement.touche(données_santé | biométrie) → classe_min = C
  SI changement.touche(données_financières_réglementées) → classe_min = C
  SI changement.touche(multi_services | multi_repos) → classe_min = C
  SI changement.type == "refonte_architecture" → classe_min = C
  SI changement.touche(réglementaire: RGPD | NIS2 | EAA | DORA_financier) → classe_min = C

  // Étape 2 (PASSE 2) : signaux de forçage H — non négociables (si classe_min < H)
  SI classe_min < H :
    SI changement.touche(auth | autorisation | sessions) → classe_min = H
    SI changement.touche(paiement | facturation) → classe_min = H
    SI changement.touche(migration_db | schema_db) → classe_min = H
    SI changement.touche(api_publique | contrat_inter_services) → classe_min = H
    SI changement.touche(infra_production) → classe_min = H
    SI changement.touche(pii | données_personnelles) → classe_min = H

  // Étape 3 (PASSE 3) : calcul score composite (si pas de forçage)
  score = impact_estimé × probabilité_estimée

  // Étape 4 (PASSE 4) : mapping score → classe
  SI score IN [1-2]  → classe_calculée = T
  SI score IN [3-5]  → classe_calculée = L
  SI score IN [6-10] → classe_calculée = M
  SI score IN [11-17] → classe_calculée = H
  SI score IN [18-25] → classe_calculée = C

  // Étape finale : classe finale = max(classe_min, classe_calculée)
  classe_finale = MAX(classe_min, classe_calculée)

  RETOURNER {
    classe: classe_finale,
    justification: liste_des_signaux_actifs,
    supervision_mode: supervision_mapping[classe_finale],
    deployment_strategy: deployment_mapping[classe_finale],
    mandatory_activities: activities_matrix[classe_finale],
    bypass_eligible: (classe_finale == T) OU (classe_finale == L ET conditions_bypass_L_réunies)
  }
```

---

## Annexe B — Mapping modes de supervision

| Classe | Mode par défaut | `bypass` | `auto` | `pairing` |
|--------|----------------|----------|--------|-----------|
| T | `bypass` | ✅ autorisé | ✅ | ○ |
| L | `bypass` conditionnel | ✅ si 5 conditions §6.1.L | ✅ | ○ |
| M | `auto` | ✗ (sauf HUMAN_OVERRIDE tracé) | ✅ défaut | ○ |
| H | `auto` + checkpoint | ✗ ABSOLU | ✅ + validation humaine obligatoire | ○ |
| C | `pairing` recommandé | ✗ ABSOLU | ✅ seulement si visibilité totale | ✅ recommandé |

**Définition des modes** :

- **`bypass`** : l'agent fait tout, y compris le triage. Aucune validation humaine active. Acceptable seulement sur T/L car le CI bloquant reste le garde-fou.
- **`auto`** : mode autonome par défaut. L'agent exécute et propose les décisions avec visibilité complète ; les checkpoints, la validation humaine et les restrictions de merge restent obligatoires dès que la classe de risque ou une règle de policy l'exige.
- **`pairing`** : le développeur est présent en continu. L'agent suit le flux de pensée. Recommandé pour C, non imposé mais fortement suggéré.

**Garde-fous anti-rubber-stamp** (s'appliquent en `auto`) :
- Format de proposition obligatoire : `[problème][alternatives][choix][critère de succès][classe de risque]`
- Quota mental de rejets : ≥ 20% des propositions doivent être challengées ou rejetées
- Audit aléatoire hebdomadaire : une proposition acceptée la veille est relue à froid

---

*Document transversal — Pipeline fractale v4*
*Version 4 — alignement PFV4 : RiskClass T/L/M/H/C, OperatingMode `bypass`/`auto`/`pairing`, macro cycles `discovery → cadrage → conception → build → validation → release → run → learning`.*
*Maintenu dans : `hima/docs/transversal/risk-classification.md`*
*Référence les standards : ISO 31000:2018, NIST SP 800-30 Rev.1, OWASP Risk Rating, ISO/IEC 25010:2023, ISO/IEC/IEEE 29119, DORA 2024/2025, SPACE Framework*
*Spec d'implémentation : `docs/conception/02-risk-classifier-spec.md`*
