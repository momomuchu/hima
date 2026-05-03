# Cycle 05 — Validation : Concepts et Critères

> **Pipeline fractale v4** — Document de référence conceptuel et architectural.
> **Statut** : v1.0 — 2026-05-03
> **Portée** : architecture only — aucun artefact d'implémentation dans ce document.
> **Source de vérité** : rapport-discovery-cadrage.md (2026-05-02)

---

## 1. Résumé exécutif

Le cycle Validation est le cinquième cycle de la pipeline fractale v4. Il prend en entrée un incrément mergé dont les quality gates CI sont verts, et produit en sortie une décision binaire : **Go / No-Go / Go avec réserves** vers le cycle Release.

Sa responsabilité centrale est de vérifier que l'incrément satisfait à la fois les **critères d'acceptation fonctionnels** (ce que le système doit faire) et les **critères de qualité non fonctionnels** (comment il doit le faire), avant toute exposition au trafic réel.

Trois principes directeurs régissent ce cycle :

1. **Risk-based testing** (ISO/IEC/IEEE 29119) : l'effort de test est alloué proportionnellement au produit `vraisemblance × impact` par zone fonctionnelle. Un changement T ne reçoit pas le même cérémonial qu'un changement C.
2. **Shift-left** : la Validation n'est pas une phase terminale. Elle prolonge les contrôles continus initiés dès la Conception. Son rôle est d'en valider la complétude, pas d'en être le seul filet.
3. **Automatisation d'abord, jugement humain pour le risque et l'ambiguïté** : les quality gates automatisés bloquent sans dérogation non tracée ; les tests exploratoires et manuels couvrent ce que les scanners ne peuvent pas détecter.

En mode solo + IA, ce cycle s'exécute avec un agent IA qui joue le rôle de "reviewer antagoniste" et de "testeur exploratoire simulé", sous supervision du développeur pour les classes É et C.

---

## 2. Position dans le pipeline

```
[Discovery] → [Cadrage] → [Conception] → [Build] → [VALIDATION] → [Release] → [Run] → [Apprentissage]
                                                          ↑               ↓
                                                    ← feedbacks ←    Go/No-Go
```

### 2.1 Cycle précédent : Build (04)

Le Build livre :
- Du code mergé sur la branche principale (trunk-based) ou sur une branche de release
- Des tests développeur écrits avec le code (unitaires + intégration au minimum)
- Des quality gates CI verts : lint, type-check, SAST, SCA, secrets scan, couverture minimale
- Un environnement de staging avec parité de configuration et données anonymisées
- Un plan de rollback documenté pour les classes M+

### 2.2 Cycle suivant : Release (06)

La Validation remet au Release :
- Un rapport de validation signé (Go / No-Go / Go avec réserves documentées)
- Une liste d'issues résiduelles acceptées (avec justification de classe de risque)
- Un attestation que les critères d'acceptation de chaque PBI/story ont été vérifiés
- Les résultats des tests de performance contre les SLO définis en Conception
- La preuve de conformité WCAG 2.2 AA sur les parcours critiques touchés
- La validation AIPD si un traitement de données personnelles a été modifié

### 2.3 Feedbacks inter-cycles

Le cycle Validation génère trois types de feedbacks :

| Destination | Déclencheur | Contenu |
|---|---|---|
| Build (04) | Défaut critique découvert | Ticket de régression + test de non-régression à ajouter |
| Conception (03) | Défaut d'architecture révélé par les tests | ADR de correction + re-threat-model si É/C |
| Apprentissage (08) | Défaut échappé vers prod (postmortem) | Pattern de défaut + règle de classification ajoutée |

---

## 3. Objectif du cycle

### 3.1 Objectif principal

**Vérifier que l'incrément est prêt à être exposé au trafic de production**, selon des critères définis avant le développement (DoD + critères d'acceptation de chaque story).

La Validation ne définit pas la qualité : elle la mesure. La qualité a été définie en Cadrage (DoD, class de risque) et en Conception (SLO, plan de tests, critères d'accessibilité).

### 3.2 Objectifs secondaires

- Détecter les régressions par rapport aux incréments précédents
- Mesurer l'écart entre le comportement attendu (spécification) et le comportement observé (implémentation)
- Valider la tenue des SLO sous charge représentative
- Vérifier la conformité aux exigences non fonctionnelles (sécurité OWASP ASVS, accessibilité WCAG 2.2, performance ISO 25010)
- Confirmer que les mesures de l'AIPD sont effectivement implémentées (pas seulement documentées)
- Produire des preuves d'audit traçables (artefacts `.planning/` + `docs/`)

### 3.3 Ce que le cycle NE fait PAS

- Il ne corrige pas les défauts — c'est le rôle du Build
- Il ne redéfinit pas les critères d'acceptation — c'est le rôle du Cadrage
- Il ne remplace pas les tests développeur — il les complète
- Il ne décide pas du go-live — la Release prend la décision finale de déploiement progressif

---

## 4. Entrées — Definition of Ready (DoR)

Le cycle Validation ne peut démarrer que si **tous** les critères suivants sont vrais.

### 4.1 Critères stricts (bloquants)

- [ ] Code mergé, pipeline CI vert (lint, type-check, tests, SAST, SCA, secrets scan)
- [ ] Couverture minimale atteinte (seuil défini par classe de risque en Conception)
- [ ] Environnement de staging disponible avec parité de configuration production
- [ ] Données anonymisées provisionées en staging (pas de données réelles)
- [ ] Critères d'acceptation testables documentés pour chaque story/PBI incluse dans l'incrément
- [ ] Plan de tests défini (stratégie, niveaux, portée, exclusions)
- [ ] SLO définis et mesurables (latence p99, disponibilité, taux d'erreur)
- [ ] Classe de risque confirmée (T/F/M/É/C) pour chaque changement de l'incrément

### 4.2 Critères contextuels (selon classe de risque)

| Critère | M | É | C |
|---|---|---|---|
| Plan de rollback documenté | ✅ | ✅ testé | ✅ répété |
| Feature flag en place (déployé OFF) | — | ✅ | ✅ |
| Threat model à jour | ○ | ✅ | ✅ |
| AIPD validée (si données perso.) | conditionnel | ✅ | ✅ |
| Revue de sécurité indépendante | — | ✅ | ✅ |
| Scénarios d'accessibilité documentés | ✅ auto | ✅ + manuel | ✅ + audit |

---

## 5. Sorties — Definition of Done (DoD)

L'incrément est **Done-Validé** quand :

### 5.1 Fonctionnel

- [ ] 100 % des critères d'acceptation de chaque story vérifiés (pass ou déviation documentée)
- [ ] Parcours utilisateur critiques testés sur device/navigateur cible
- [ ] Aucun défaut bloquant ou critique ouvert non résolu
- [ ] Régressions : aucune régression sur les parcours critiques existants

### 5.2 Qualité technique

- [ ] Mutation score > 70 % sur les zones critiques (logique métier, auth, calculs financiers)
- [ ] Tenue des SLO sous charge nominale + stress (résultats mesurés, pas estimés)
- [ ] SAST / SCA : aucune CVE Critical ou High non triée et justifiée
- [ ] DAST (classes É/C) : aucune vulnérabilité High non mitigée
- [ ] IaC/container scan : aucun finding Critical non traité

### 5.3 Sécurité (OWASP ASVS v5)

- [ ] Niveau ASVS approprié à la classe de risque atteint (voir §8)
- [ ] Les contrôles ASVS pertinents aux changements apportés ont été vérifiés
- [ ] Aucune finding de sécurité active sans ticket de remédiation planifié

### 5.4 Accessibilité (WCAG 2.2 AA)

- [ ] axe-core / Pa11y CI vert sur toutes les pages touchées (0 violation A/AA)
- [ ] Tests manuels : navigation clavier + lecteur d'écran sur les parcours critiques modifiés
- [ ] Contrastes ≥ 4.5:1 (texte normal), ≥ 3:1 (UI) vérifiés visuellement

### 5.5 Privacy

- [ ] Les mesures techniques de l'AIPD sont vérifiées implémentées (pas seulement décrites)
- [ ] Aucune donnée de prod non anonymisée présente en staging
- [ ] Logs : aucune PII en clair dans les logs de staging

### 5.6 Artefacts obligatoires

- [ ] `planning/03-sprints/.../04-test-and-validation-results.md` complété
- [ ] `planning/06-quality/quality-gates-results.md` mis à jour
- [ ] Décision Go/No-Go documentée avec justification
- [ ] Issues résiduelles acceptées listées avec owner + deadline de remédiation

---

## 6. Concepts clés

### 6.1 Stratégie de test : Pyramide, Trophée, Honeycomb

La stratégie de test optimale dépend de l'architecture du système et de la répartition de la complexité. Trois modèles sont reconnus :

#### Pyramide classique (Cohn, Fowler)

```
        ┌──────┐
        │ E2E  │  ← peu, lents, fragiles, haute valeur
        ├──────┤
        │ Intég│  ← moyennement nombreux
        ├──────┤
        │ Unit │  ← nombreux, rapides, isolés
        └──────┘
```

**Quand** : backends à logique métier dense, domaines riches (DDD), calculs complexes.
**Avantage** : feedback rapide, isolation des défauts précise.
**Risque** : sous-confiance sur les intégrations réelles si trop d'unitaires isolés par des mocks.

#### Trophée (Kent C. Dodds)

```
        ┌──────┐
        │ E2E  │
        ├──────┤
        │ Intég│  ← couche principale
        ├──────┤
        │ Unit │
        ├──────┤
        │Static│  ← lint, types (base)
        └──────┘
```

**Quand** : frontends React/Vue/Svelte, applications orientées intégration, API d'orchestration.
**Avantage** : teste le comportement réel de l'application (proche de l'utilisateur).
**Risque** : tests plus lents, setup de données de test plus complexe.

#### Honeycomb (Spotify)

```
        ┌──────┐
        │ E2E  │  ← rares, smoke tests
        ├──────┤
        │ Intég│  ← dominant
        ├──────┤
        │ Unit │  ← quelques unitaires d'algo critique
        └──────┘
```

**Quand** : microservices, la complexité est dans les interactions inter-services.
**Avantage** : teste l'intégration réelle entre services, détecte les désaccords de contrat.
**Risque** : setup d'environnement d'intégration coûteux.

**Règle de décision** :

| Architecture | Modèle recommandé |
|---|---|
| Backend logique métier (DDD) | Pyramide |
| Frontend React/Vue/Angular | Trophée |
| Microservices / API-first | Honeycomb + tests de contrat |
| Monolithe modulaire | Pyramide avec intégration renforcée |
| Solo IA + harness | Trophée (confiance sur comportement complet) |

La stratégie choisie est documentée en Conception et ne doit pas changer en cours de cycle sans ADR.

---

### 6.2 Niveaux de test

#### Tests unitaires

**Périmètre** : une unité de code isolée (fonction, méthode, classe) sans dépendances réelles.
**Caractéristiques** : rapides (< 1 ms/test), déterministes, pas de I/O, pas de réseau.
**Ce qu'ils couvrent** : logique métier pure, cas limites, branchements, calculs.
**Ce qu'ils ne couvrent pas** : interactions entre composants, comportement système.
**Threshold recommandé** : 80 % de couverture de lignes sur les modules de logique métier ; pas de seuil global arbitraire.

#### Tests d'intégration

**Périmètre** : plusieurs composants en interaction, potentiellement avec une DB de test, un bus, un cache.
**Caractéristiques** : plus lents (dizaines à centaines de ms), requièrent un environnement.
**Ce qu'ils couvrent** : contrats d'interface entre composants, persistance, sérialisation.
**Outils** : TestContainers (DB réelle éphémère), WireMock (API externes), MSW (frontend).

#### Tests E2E

**Périmètre** : parcours utilisateur complet via l'interface (UI ou API), de bout en bout.
**Caractéristiques** : lents (secondes à minutes), fragiles si les sélecteurs changent.
**Règle** : uniquement sur les **parcours critiques** (checkout, auth, flux principal métier).
**Outils** : Playwright (web), Detox (mobile natif), k6 (API load).
**Anti-pattern** : tests E2E en remplacement des tests d'intégration.

#### Tests de contrat (Contract Testing — Pact)

**Concept** : chaque consommateur d'une API définit ses attentes sous forme de contrat. Le fournisseur vérifie qu'il satisfait tous les contrats de ses consommateurs.
**Quand** : dès qu'il y a une frontière inter-service (microservices, API publique, BFF).
**Avantage** : détecte les ruptures de compatibilité **avant** le déploiement, sans tests E2E coûteux.
**Outil** : Pact + Pact Broker / PactFlow. Le contrat est généré lors des tests du consommateur, vérifié côté fournisseur.
**Complémentarité** : les tests de contrat remplacent les tests d'intégration inter-services, pas les tests unitaires ni les E2E smoke tests.

#### Tests de mutation

**Concept** : introduire des mutations dans le code (changer `>` en `>=`, supprimer une condition, etc.) et vérifier que les tests existants les détectent ("killent" le mutant).
**Métriques** :
- **Mutation score** = mutants tués / mutants totaux. Cible : > 70 % sur les zones critiques.
- **Survivants** = lacunes dans les assertions ou les cas de test.
**Outils** : Stryker (JS/TS, .NET, Scala), PIT (Java), mutmut (Python).
**Quand appliquer** : sur les modules de logique métier dense, auth, calculs financiers, règles métier critiques. Pas sur tout le codebase (coût exponentiel).
**Limite** : les mutants équivalents (mutations sémantiquement sans effet) gonflent artificiellement les survivants. Il faut les identifier et les exclure.
**Seuils recommandés** : high: 80, low: 60, break: 50 (Stryker defaults).

#### Tests de charge et de performance

**Périmètre** : mesurer le comportement du système sous charge croissante (nominal, stress, spike, soak).
**Métriques cibles** : latence p50/p95/p99, throughput (rps), taux d'erreur, saturation CPU/mémoire.
**Comparaison avec SLO** : les résultats mesurés doivent être comparés aux SLO définis en Conception, pas à des benchmarks génériques.
**Outils** : k6 (scripting JS), Gatling, Apache JMeter, Locust.
**Types** :
- Load test : charge nominale soutenue
- Stress test : montée jusqu'à dégradation
- Spike test : pic soudain (marketing, événement)
- Soak test : charge nominale sur durée longue (fuites mémoire, dégradation progressive)

---

### 6.3 Test doubles — Taxonomie Meszaros

Gerard Meszaros a formalisé la taxonomie dans *xUnit Test Patterns* (2007). Elle reste la référence de facto, adoptée par Fowler, Microsoft, et la communauté JVM/JS.

| Type | Définition | Vérifie des interactions ? | Usage typique |
|---|---|---|---|
| **Dummy** | Objet passé mais jamais utilisé | Non | Remplir un paramètre obligatoire |
| **Stub** | Retourne des valeurs prédéfinies sur les appels entrants | Non | Contrôler les entrées indirectes (ex: retourner un utilisateur fictif) |
| **Fake** | Implémentation simplifiée mais fonctionnelle | Non | In-memory DB, fake email service |
| **Spy** | Enregistre les appels reçus, peut déléguer au réel | Post-assertion | Vérifier qu'une méthode a été appelée N fois |
| **Mock** | Vérifie des attentes prédéclarées, échoue si elles ne sont pas remplies | Pendant le test | Vérifier un contrat d'interaction précis |

**Règles d'usage** :
- Préférer les **Fakes** pour les dépendances d'infrastructure (DB, queue) — plus réalistes, moins fragiles.
- Utiliser les **Stubs** pour contrôler les données d'entrée sans surcharger le setup.
- Utiliser les **Mocks** avec parcimonie — ils tendent à tester l'implémentation plutôt que le comportement, créant des tests fragiles lors des refactors.
- Principe : tester le comportement observable, pas les détails d'implémentation.

---

### 6.4 Couverture et ses limites

La couverture de code est un indicateur **nécessaire mais insuffisant** de la qualité des tests.

**Ce qu'elle mesure** : quelles lignes, branches, fonctions ont été exécutées lors des tests.
**Ce qu'elle ne mesure pas** : si les assertions sont correctes, si les cas limites sont couverts, si le comportement est vérifié.

**Limites documentées** :
- 100 % de couverture + 0 assertion = 0 confiance. Le test peut exécuter sans vérifier.
- La couverture incite à écrire des tests pour augmenter le score, pas pour documenter le comportement.
- La couverture de branche est plus significative que la couverture de ligne, mais insuffisante seule.

**Approche recommandée** :
- Définir des seuils **par module** selon son niveau de criticité, pas un seuil global.
- Compléter avec le **mutation score** pour les zones critiques (voir §6.2).
- Identifier les **chemins critiques** (auth, paiement, calcul, sécurité) et viser couverture exhaustive sur ces chemins, pas sur les utilitaires.

**Seuils par classe de risque** :

| Classe | Couverture de lignes | Mutation score zones critiques |
|---|---|---|
| T/F | ≥ 60 % | Non requis |
| M | ≥ 70 % | ≥ 60 % sur logique métier |
| É | ≥ 80 % | ≥ 70 % sur zones critiques |
| C | ≥ 85 % | ≥ 80 % sur zones critiques |

---

### 6.5 Tests exploratoires

Le test exploratoire (ET) est une approche simultanée de conception de tests, d'exécution et d'apprentissage. Il ne remplace pas les tests automatisés : il couvre ce qu'ils ne peuvent pas détecter.

**Quand** : sur les zones rouges de la matrice de risque, lors des nouvelles fonctionnalités, après des refactors d'architecture, avant les releases critiques.

**Session-based testing** (Bach & Bach, 2000) :
- Chaque session est une unité de travail timeboxée (45–90 min recommandé)
- Chaque session a une **charte** : mission, périmètre, heuristiques utilisées
- Chaque session produit un **rapport de session** : couverture réelle, findings, suites suggérées

**Format de charte** :
```
Explorer [cible]
Avec [ressources/outils]
Pour [découvrir/vérifier]
```

**Heuristiques recommandées** :
- **SFDPOT** (Bach) : Structure, Function, Data, Platform, Operations, Time
- **CRUD** : Create, Read, Update, Delete sur toutes les entités
- **Boundary values** : valeurs limites, nulls, vides, très longs, caractères spéciaux
- **Error guessing** : basé sur l'historique de défauts passés (capitalisation)
- **STRIDE light** : pour les fonctionnalités à composante sécurité

**Solo + IA** : l'agent IA joue le rôle d'un "adversarial tester" en parcourant les heuristiques systématiquement, le développeur valide les findings et décide des suites.

---

### 6.6 Validation des critères d'acceptation

Les critères d'acceptation ont été définis en Cadrage/Conception au format Given-When-Then (BDD/Gherkin).

**Format canonique** :
```
Given [contexte préalable]
When [action déclenchante]
Then [résultat observable attendu]
And [résultat complémentaire]
```

**Vérification en Validation** :
1. Chaque critère est exécuté (automatisé ou manuel)
2. Le résultat est consigné : Pass / Fail / Skip (avec justification)
3. Tout Fail ou Skip bloque le Go sauf dérogation tracée et approuvée
4. Les dérogations incluent : classe de risque, impact, owner de remédiation, délai

**Complétude des critères** : un critère d'acceptation valide est :
- Testable (résultat observable, pas "le système est rapide")
- Lié à une règle métier ou à un risque
- Indépendant de l'implémentation
- Non ambigu

---

### 6.7 Tests d'accessibilité (WCAG 2.2 AA)

WCAG 2.2 (octobre 2023) est la baseline de référence. L'European Accessibility Act (Directive 2019/882) est en vigueur depuis le 28 juin 2025 — les violations ne sont plus seulement éthiques, elles sont légales.

**Approche hybride obligatoire** : les outils automatisés couvrent 30–40 % des critères WCAG. Les 60–70 % restants requièrent un test manuel.

**Tests automatisés (CI)** :
- axe-core, Pa11y, ou Lighthouse CI — 0 violation A/AA bloquant
- Intégrés dans la pipeline, exécutés sur toutes les pages touchées
- Résultats enregistrés comme preuve d'audit

**Tests manuels (Validation)** :
- Lecteur d'écran : NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android)
- Navigation clavier exclusive : toutes les interactions accessibles sans souris
- Zoom 400 % : aucune perte d'information ni de fonctionnalité
- Contraste en mode OS haute contraste
- Focus visible et logique sur tous les éléments interactifs

**Nouveaux critères WCAG 2.2 à vérifier** :

| Critère | Code | Description |
|---|---|---|
| Focus appearance | 2.4.11 | Focus visible, suffisamment contrasté et épais (AA) |
| Dragging movements | 2.5.7 | Alternative disponible pour tout drag (AA) |
| Target size | 2.5.8 | ≥ 24×24 px (exceptions limitées) (AA) |
| Consistent help | 3.2.6 | Support à la même position (AA) |
| Redundant entry | 3.3.7 | Pas de saisie redondante dans un même flow (AA) |
| Accessible authentication | 3.3.8 | Pas de test cognitif sans alternative (AA) |

**Portée par classe de risque** :

| Classe | Automatisé | Manuel | Audit |
|---|---|---|---|
| T | ◔ CI | — | — |
| F | ✅ CI | — | — |
| M | ✅ CI | Smoke test clavier | — |
| É | ✅ CI | Clavier + lecteur d'écran | — |
| C | ✅ CI | Clavier + lecteur d'écran + zoom | Expert ou utilisateurs en situation de handicap |

---

### 6.8 Validation de sécurité — OWASP ASVS v5 (2025)

OWASP ASVS v5.0.0 a été publié en mai 2025 à Global AppSec EU Barcelona. Il couvre ~350 exigences réparties en 17 chapitres.

**Trois niveaux cumulatifs** :

| Niveau | Portée | Classe de risque correspondante |
|---|---|---|
| L1 — Hygiene | Sécurité de base, première couche de défense | T/F |
| L2 — Standard | Pratiques standard complètes, la majorité des applications | M/É |
| L3 — High Assurance | Critique, finance, santé, données sensibles | C |

**Les 17 chapitres ASVS v5** (couverture sélective par pertinence) :

1. Architecture, design, threat modeling
2. Authentification
3. Gestion de session
4. Contrôle d'accès / Autorisation
5. Validation, encodage, assainissement
6. Cryptographie
7. Gestion des erreurs et logging
8. Protection des données et privacy
9. Communications
10. Logique métier
11. Fichiers et ressources
12. API et services web
13. Configuration
14. Dépendances
15. SSRF (Server-Side Request Forgery)
16. OAuth/OIDC
17. Autres contrôles

**Application en Validation** :
- Pour chaque changement de classe É/C : vérifier les chapitres ASVS pertinents aux flux modifiés
- DAST (OWASP ZAP, Burp Suite) sur preprod pour les classes É/C
- Fuzzing sur les endpoints d'API publique pour la classe C
- Tests d'authentification et d'autorisation (AuthZ matrix testing) pour tout changement touchant des permissions

---

### 6.9 Gestion des données de test (Test Data Management)

**Principe central** : jamais de données de production réelles en staging ou dans les tests automatisés.

**Techniques par cas d'usage** :

| Cas | Technique | Outillage |
|---|---|---|
| DB relationnelle pour tests d'intégration | TestContainers (DB éphémère) | testcontainers-node, testcontainers-java |
| Staging avec données réalistes | Anonymisation irréversible depuis prod | pg_anonymizer, Greenmask |
| Tests de charge avec volume | Génération synthétique | Faker.js, factory-bot |
| API externes | WireMock / MSW (mock server) | WireMock, msw |
| Données de santé / financières | Génération synthétique structurée | Gretel, Mostly AI |

**Propriétés obligatoires des données de test** :
- **Intégrité référentielle** : les clés étrangères doivent rester cohérentes après anonymisation
- **Distribution statistique** : préserver les proportions réelles (sinon les tests de charge sont faux)
- **Idempotence** : les tests ne doivent pas dépendre de l'ordre d'exécution
- **Isolation** : chaque test setup son propre état, ne dépend pas de l'état laissé par un autre test

**Conformité RGPD** : les données anonymisées au sens RGPD doivent être irréversiblement anonymisées (hash + salt sur PII directes, génération synthétique sur PII indirectes). La pseudonymisation n'est **pas** de l'anonymisation au sens du RGPD (ICO guidance 2025).

---

### 6.10 Assurance qualité risk-based (ISO/IEC/IEEE 29119)

ISO/IEC/IEEE 29119 est la norme internationale pour les processus de test logiciel. Le **risk-based testing** est le cœur de la partie 5 de la norme.

**Principe** : allouer l'effort de test proportionnellement au produit `vraisemblance × impact` sur chaque zone fonctionnelle.

**Matrice de risque de test** :

```
              IMPACT
              Faible   Moyen   Élevé
Faible   │   Bas    │  Bas  │ Moyen │
VRAIS.   │         │       │       │
Moyen    │   Bas   │ Moyen │ Élevé │
         │         │       │       │
Élevé    │  Moyen  │ Élevé │Critique│
```

**Allocation de l'effort** :
- Zone Critique : tests exhaustifs, mutation testing, tests exploratoires, revue de sécurité
- Zone Élevée : tests complets, couverture renforcée, ET ciblé
- Zone Moyenne : tests standards, couverture nominale
- Zone Basse : smoke tests, couverture minimale

**Processus** :
1. Identifier les zones fonctionnelles de l'incrément
2. Évaluer vraisemblance de défaut × impact métier pour chaque zone
3. Mapper sur la matrice → niveau de risque de test
4. Allouer l'effort en conséquence
5. Documenter les zones non testées et leur justification (risque accepté)

---

## 7. Critères qualité — ISO/IEC 25010:2023

ISO/IEC 25010:2023 définit 9 caractéristiques de qualité produit. La Validation les mesure contre les seuils définis en Conception.

### 7.1 Les 9 caractéristiques (version 2023)

| # | Caractéristique | Nouveauté 2023 | Sous-caractéristiques clés |
|---|---|---|---|
| 1 | **Adéquation fonctionnelle** | — | complétude, exactitude, pertinence |
| 2 | **Efficience des performances** | — | comportement temporel, utilisation des ressources, capacité |
| 3 | **Compatibilité** | — | coexistence, interopérabilité |
| 4 | **Capacité d'interaction** | Renommé (ex *utilisabilité*) | appropriateness recognizability, learability, operability, **accessibilité**, UX aesthetics, self-descriptiveness |
| 5 | **Fiabilité** | — | complétude, disponibilité, tolérance aux pannes, récupérabilité |
| 6 | **Sécurité** | + *resistance* | confidentialité, intégrité, non-répudiation, responsabilité, authenticité, **résistance** |
| 7 | **Maintenabilité** | — | modularité, réutilisabilité, analysabilité, modifiabilité, **testabilité** |
| 8 | **Flexibilité** | Renommé (ex *portabilité*) | adaptabilité, **scalabilité**, installabilité, remplaçabilité |
| 9 | **Sûreté** | **Nouveau en 2023** | contrainte opérationnelle, identification des risques, fail safe, avertissement de hazard, intégration sûre |

### 7.2 Application en Validation

**Règle** : chaque projet définit en Conception 3–5 caractéristiques **prioritaires** avec des seuils mesurables. La Validation vérifie ces seuils.

Exemple pour un système de traitement de paiements :

| Caractéristique | Seuil | Méthode de mesure |
|---|---|---|
| Adéquation fonctionnelle | 100 % des critères d'acceptation Pass | Matrice de traçabilité |
| Efficience des performances | p99 < 200 ms, taux d'erreur < 0.1 % | k6 load test |
| Sécurité | ASVS L2 complet, 0 CVE Critical | SAST + DAST + SCA |
| Fiabilité | Disponibilité > 99.9 % en staging 72h | Monitoring staging |
| Maintenabilité / Testabilité | Mutation score > 70 % zones critiques | Stryker |

### 7.3 Testabilité (sous-caractéristique de Maintenabilité)

ISO 25010 définit la testabilité comme la facilité avec laquelle des critères de test peuvent être établis et des tests conduits pour vérifier la conformité.

Indicateurs de bonne testabilité :
- Tests indépendants, déterministes, rapides
- Dependencies injectées (pas de singletons globaux)
- Séparation logique métier / infrastructure
- Interfaces explicites et documentées

Indicateurs de mauvaise testabilité (à détecter en Validation) :
- Tests qui nécessitent un ordre d'exécution particulier
- Tests qui échouent aléatoirement (flaky tests)
- Setup de test > 100 lignes pour une feature simple
- Tests qui testent des détails d'implémentation (fragiles au refactor)

---

## 8. Modulation par classe de risque

La profondeur de la Validation se module sur la classe de risque T/F/M/É/C de chaque changement. Les classes sont cumulatives : un incrément peut contenir des changements de classes différentes — c'est la **classe maximale** qui détermine le niveau de validation global.

### 8.1 Matrice de modulation

| Activité de Validation | T | F | M | É | C |
|---|:---:|:---:|:---:|:---:|:---:|
| Vérification critères d'acceptation | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests unitaires (CI) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests d'intégration (CI) | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests E2E parcours critiques | — | ◔ | ✅ | ✅ | ✅ |
| Tests de contrat (Pact) | — | — | ○ | ✅ | ✅ |
| Mutation testing zones critiques | — | — | ○ | ✅ | ✅ |
| Tests de charge / SLO | — | — | ○ | ✅ | ✅ |
| DAST (preprod) | — | — | ○ | ✅ | ✅ |
| Fuzzing endpoints API | — | — | — | ○ | ✅ |
| Tests exploratoires | — | ◔ | ✅ | ✅ | ✅ |
| Validation AIPD mesures techniques | — | — | conditionnel | ✅ | ✅ |
| Tests accessibilité automatisés | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests accessibilité manuels | — | — | ◔ | ✅ | ✅ |
| Audit accessibilité externe | — | — | — | — | ✅ |
| ASVS L1 | ✅ | ✅ | ✅ | ✅ | ✅ |
| ASVS L2 | — | — | ✅ | ✅ | ✅ |
| ASVS L3 | — | — | — | — | ✅ |
| Revue de sécurité indépendante | — | — | — | ✅ | ✅ |
| Test de rollback | — | — | ✅ | ✅ testé | ✅ répété |

**Légende** : ✅ obligatoire — ○ recommandé — ◔ allégé — — non requis

### 8.2 Dérogations

Toute dérogation à une activité marquée ✅ doit être :
1. Documentée dans `planning/03-sprints/.../04-test-and-validation-results.md`
2. Justifiée (raison technique ou temporelle explicite)
3. Tracée avec un risk owner et une date de remédiation
4. Approuvée (auto-approbation acceptable en solo T/F, revue obligatoire en É/C)

---

## 9. Sous-cycle fractal — 7 étapes

La Validation suit le même sous-cycle universel à 7 étapes que tous les autres cycles.

### Étape 1 — Observer

**But** : comprendre l'état actuel de l'incrément avant de tester.

**Activités** :
- Lire le rapport de Build : quels changements, quelles classes de risque, quels tests déjà écrits
- Parcourir les critères d'acceptation de chaque story incluse
- Identifier les zones de risque élevé à partir de la matrice de risque de test
- Vérifier que la DoR est satisfaite (sinon, retourner en Build)

**Artefacts en entrée** : `planning/03-sprints/.../01-selected-work.md`, critères d'acceptation des stories, rapport CI

### Étape 2 — Définir

**But** : formaliser la stratégie de validation pour cet incrément.

**Activités** :
- Sélectionner les niveaux de test par zone (pyramide/trophée/honeycomb selon architecture)
- Définir les charters de tests exploratoires pour les zones rouges
- Confirmer les seuils de couverture et de mutation score par module
- Identifier les environnements nécessaires et leur disponibilité
- Planifier les tests manuels (accessibilité, exploration) avec fenêtres de temps

**Artefacts produits** : plan de tests de validation (dans `planning/03-sprints/.../04-test-and-validation-results.md`, section Plan)

### Étape 3 — Concevoir

**But** : préparer les données de test, les scénarios, les charters ET.

**Activités** :
- Préparer les données de test (datasets anonymisés, fakes, factories)
- Écrire les charters de tests exploratoires (cible, heuristiques, durée)
- Configurer les outils de charge (k6 scripts) avec les scénarios définis en Conception
- Préparer les scénarios d'accessibilité manuelle (parcours à tester, outils)
- Configurer les outils DAST (ZAP spider + active scan) sur preprod

### Étape 4 — Exécuter

**But** : exécuter tous les tests selon le plan, dans l'ordre de priorité (risque décroissant).

**Ordre recommandé** :
1. Quality gates CI (déjà verts, confirmation)
2. Tests de régression automatisés (suite complète)
3. Vérification des critères d'acceptation (automatisés puis manuels)
4. Tests de charge contre les SLO
5. DAST (si É/C)
6. Tests exploratoires (zones rouges en priorité)
7. Tests d'accessibilité manuels (si M+)

**Collecte de preuves** : chaque test produit une preuve (rapport CI, screenshot, session report ET, rapport k6, rapport axe-core).

### Étape 5 — Vérifier

**But** : analyser les résultats et prendre la décision Go/No-Go.

**Critères de décision** :

| Décision | Conditions |
|---|---|
| **Go** | Tous les critères DoD Validation satisfaits. Zéro défaut bloquant ouvert. |
| **No-Go** | Au moins un critère DoD Validation non satisfait sans dérogation approuvée. Défaut bloquant ou critique ouvert. |
| **Go avec réserves** | Critères satisfaits, mais défauts mineurs ouverts avec owner + deadline + plan de monitoring. |

**Traçabilité de la décision** : la décision est documentée dans `planning/03-sprints/.../04-test-and-validation-results.md` avec sa justification complète.

### Étape 6 — Capitaliser

**But** : enregistrer ce qui a été appris pour améliorer la prochaine Validation.

**Activités** :
- Mettre à jour `planning/06-quality/quality-gates-results.md`
- Mettre à jour `planning/06-quality/defect-escape-analysis.md` si des défauts avaient échappé
- Mettre à jour `planning/06-quality/flaky-tests-register.md`
- Identifier les nouveaux patterns de défaut pour `planning/08-risks/`
- Si un défaut a été trouvé en Validation que les tests développeur auraient dû catcher : créer un test de non-régression (principe "every defect generates a test")

### Étape 7 — Transmettre

**But** : remettre le dossier de validation au cycle Release.

**Livrables transmis** :
- Rapport de validation complété (Go/No-Go + justification)
- Liste des issues résiduelles acceptées
- Preuves d'audit (rapports CI, session reports ET, résultats k6, rapport axe-core)
- Rapport ASVS (exigences vérifiées)
- Déclaration de conformité accessibilité (pour les changements UI)

---

## 10. Activités transversales

Ces activités imprègnent la Validation sans être localisées dans une étape précise.

### 10.1 Tests de régression

**Principe** : chaque incrément ne doit pas régresser les comportements existants.

**Stratégie smart regression (2025)** :
- Exécuter la suite complète sur le pipeline CI de nightly
- Pour les pipelines PR/feature : sélection de tests basée sur les changements (change-based test selection) — exécuter uniquement les tests affectés par les fichiers modifiés
- Réserver la suite complète pour les gates de pre-release

**Règle d'or** : tout défaut découvert en production (postmortem) génère un test de régression avant la correction. Ce test doit être rouge (failing) avant le fix.

**Flaky tests** :
- Mise en quarantaine immédiate (ne bloquent plus la CI mais sont signalés)
- Fix obligatoire sous 1 sprint (sinon suppression)
- Enregistrés dans `planning/06-quality/flaky-tests-register.md`

### 10.2 Assurance qualité continue

La Validation formelle ne substitue pas aux contrôles continus. Le schéma de responsabilités :

| Contrôle | Responsable | Fréquence |
|---|---|---|
| Linting / type-check | CI automatique | Chaque commit |
| Tests unitaires | CI automatique | Chaque commit |
| SAST / SCA | CI automatique | Chaque commit |
| Tests d'intégration | CI automatique | Chaque PR |
| Tests E2E critiques | CI automatique | Chaque merge |
| Suite complète de régression | CI nightly | Quotidien |
| Tests exploratoires | Validation humaine | Par incrément M+ |
| Tests de charge | Validation humaine | Par incrément É/C |
| Tests manuels accessibilité | Validation humaine | Par incrément É/C |

### 10.3 Benchmarks de performance

Les résultats de performance ont de la valeur seulement si comparés à une baseline définie.

**Processus** :
1. La Conception définit les SLO (latence p99, taux d'erreur, throughput)
2. Le Build crée le code
3. La Validation mesure et compare aux SLO
4. Si régression > 10 % sans justification → No-Go ou dérogation tracée

**SLO types par composant** :

| Composant | SLI | SLO typique |
|---|---|---|
| API REST | latence p99 | < 200 ms (sync) |
| API REST | taux d'erreur | < 0.1 % |
| Page web | LCP (Core Web Vitals) | < 2.5 s |
| Page web | CLS | < 0.1 |
| Query DB | latence p99 | < 50 ms |
| Batch | durée totale | < seuil défini en Conception |

---

## 11. Artefacts produits

### 11.1 Artefacts obligatoires (tous changements)

| Artefact | Emplacement | Description |
|---|---|---|
| Résultats de tests de validation | `.planning/03-sprints/.../04-test-and-validation-results.md` | Synthèse complète : plan, exécution, résultats, décision |
| Quality gates CI | `.planning/06-quality/quality-gates-results.md` | Tableau des gates avec statut et preuve |
| Décision Go/No-Go | `.planning/03-sprints/.../04-test-and-validation-results.md` | Justification documentée |

### 11.2 Artefacts conditionnels

| Artefact | Condition | Emplacement |
|---|---|---|
| Rapport de tests de charge | Changement M+ avec SLO | `.planning/03-sprints/.../evidence/` |
| Session reports ET | Changement M+ | `.planning/03-sprints/.../evidence/` |
| Rapport DAST | Changement É/C | `.planning/03-sprints/.../evidence/` |
| Rapport axe-core | Changement UI | `.planning/03-sprints/.../evidence/` |
| Rapport d'accessibilité manuelle | Changement UI É/C | `.planning/03-sprints/.../evidence/` |
| Attestation AIPD | Changement avec données perso. | `docs/09-security-compliance/` |
| Rapport mutation testing | Changement M+ logique critique | `.planning/03-sprints/.../evidence/` |
| Issues résiduelles acceptées | Go avec réserves | `.planning/03-sprints/.../04-test-and-validation-results.md` |

### 11.3 Artefacts de capitalisation

| Artefact | Emplacement | Fréquence |
|---|---|---|
| Analyse d'échappement des défauts | `.planning/06-quality/defect-escape-analysis.md` | Par défaut escaped |
| Register des tests flaky | `.planning/06-quality/flaky-tests-register.md` | Continu |
| Mise à jour du risk register | `.planning/08-risks/` | Par pattern de risque nouveau |
| Test de non-régression | `tests/` dans le code | Par défaut trouvé en Validation |

---

## 12. Métriques et indicateurs

### 12.1 Métriques de qualité de test

| Métrique | Formule | Cible | Cadence |
|---|---|---|---|
| **Taux de pass des critères d'acceptation** | Pass / Total | 100 % (ou dérogations tracées) | Par incrément |
| **Couverture de code (zones critiques)** | Lignes couvertes / Total | Selon classe (§6.4) | Par incrément |
| **Mutation score** | Mutants tués / Total | > 70 % zones critiques | Par incrément M+ |
| **Taux de défauts résiduels** | Défauts ouverts / Stories livrées | < 5 % bloquants | Par sprint |
| **Défauts échappés** | Défauts trouvés en prod / Défauts totaux | < 2 % | Par release |

### 12.2 Métriques de performance (DORA)

| Métrique DORA | Cible top 15 % | Cible haute | Mesure |
|---|---|---|---|
| Change Lead Time | < 1 jour | < 1 semaine | Commit → deploy |
| Deployment Frequency | À la demande | Quotidien à hebdo | Nb de déploiements |
| Change Failure Rate | < 5 % | < 10 % | Déploiements causant incident / Total |
| Failed Deployment Recovery Time | < 1 h | < 1 jour | Détection → résolution |

### 12.3 Métriques de sécurité

| Métrique | Cible | Cadence |
|---|---|---|
| CVE Critical ouvertes | 0 | En continu |
| CVE High non triées > 7 jours | 0 | Hebdomadaire |
| Compliance ASVS niveau cible | 100 % | Par release |
| Délai de remédiation vulnerabilité Critical | < 24 h | Par incident |

### 12.4 Métriques d'accessibilité

| Métrique | Cible | Cadence |
|---|---|---|
| Violations A/AA automatisées | 0 sur pages critiques | Par PR |
| Parcours critiques manuels PASS | 100 % | Par release É/C |
| Délai moyen de remédiation violation | < 1 sprint | Par violation |

### 12.5 Signaux d'alarme (déclencheurs d'action)

| Signal | Seuil | Action |
|---|---|---|
| Change Failure Rate > 15 % (3 sprints) | Bloquant | Gel features, focus tests et risk-based testing |
| Défauts échappés > 5 % | Alerte | Revue stratégie de test + ET renforcé |
| Mutation score < 60 % zones critiques | Alerte | Session de renforcement des assertions |
| Flaky tests > 3 dans la suite | Alerte | Sprint de stabilisation test |
| Violation WCAG AA en prod | Bloquant | Correctif prioritaire + régression test |

---

## 13. Standards de référence

| Domaine | Standard | Version | Source |
|---|---|---|---|
| Qualité produit | ISO/IEC 25010 | 2023 | iso.org |
| Processus de test | ISO/IEC/IEEE 29119 | 2022 (Part 1-4), 2024 (Part 5) | iso.org |
| Stratégie de test | Risk-based testing (29119-5) | 2016/2024 | softwaretestingstandard.org |
| Sécurité applicative | OWASP ASVS | v5.0.0 (mai 2025) | owasp.org |
| Risques web | OWASP Top 10 | 2021 (mise à jour 2025 attendue) | owasp.org |
| Modélisation menaces | STRIDE (Microsoft) / LINDDUN | Evergreen | microsoft.com / linddun.org |
| Accessibilité | WCAG 2.2 | Octobre 2023 | w3.org/TR/WCAG22 |
| Accessibilité UE | European Accessibility Act (Directive 2019/882) | En vigueur 28 juin 2025 | eur-lex.europa.eu |
| Accessibilité Europe | EN 301 549 v3.2.1 | — | etsi.org |
| Test doubles | xUnit Test Patterns (Meszaros) | 2007, evergreen | xunitpatterns.com |
| Tests de contrat | Pact | v11 (2025) | docs.pact.io |
| Performance livraison | DORA State of DevOps | 2024 | dora.dev |
| Privacy | RGPD art. 25 + 35 | — | eur-lex.europa.eu |
| Privacy | CNIL PIA Guide | — | cnil.fr |
| Tests exploratoires | Session-based testing (Bach & Bach) | 2000, evergreen | satisfice.com |
| BDD / Critères d'acceptation | Gherkin / Given-When-Then (Terhorst-North) | Evergreen | cucumber.io |

---

## 14. Questions ouvertes — RED CARDS

Les RED CARDS sont des questions architecturales non résolues qui pourraient influencer des décisions de design du cycle. Elles sont signalées ici pour résolution avant ou pendant la phase de Build.

### RC-VAL-01 — Frontière entre Validation et Build pour les tests développeur

**Question** : où s'arrêtent les tests du Build et où commence la Validation ?
**Tension** : en TDD strict, les tests sont écrits avant le code (Build). Mais les tests de charge, DAST, ET ne peuvent pas être écrits avant d'avoir un système fonctionnel.
**Piste** : définir une taxonomie de phases de test explicite dans la DoD du Build et dans la DoR de la Validation pour éviter le "qui fait quoi".
**Priorité** : haute — à résoudre avant le premier cycle M+.

### RC-VAL-02 — Mutation testing coût vs valeur en mode solo IA

**Question** : le mutation testing (Stryker/PIT) peut prendre des heures sur un codebase réel. Comment l'intégrer en mode solo sans bloquer le flux ?
**Tension** : valeur élevée sur les zones critiques vs coût en temps (4h+ sur 1600 mutants).
**Pistes** :
- Run incrémental : uniquement sur les modules touchés par l'incrément
- Run asynchrone (nightly) : non bloquant sur la PR, bloquant sur la pre-release
- Scope restreint : uniquement les modules avec classe de risque É/C
**Priorité** : moyenne — à décider avant le premier sprint É.

### RC-VAL-03 — Tests de contrat en contexte solo monorepo

**Question** : les tests de contrat Pact ont du sens pour les équipes distribuées. En solo monorepo, sont-ils utiles ou sur-ingénieux ?
**Tension** : une API interne entre deux modules d'un monorepo peut être testée par un test d'intégration classique, ce qui est plus simple.
**Piste** : réserver Pact aux frontières inter-repo ou inter-équipe. Pour les monorepos, préférer les tests d'intégration avec le consommateur réel.
**Priorité** : basse — à décider si architecture microservices confirmée.

### RC-VAL-04 — Promotion de classe en cours de Validation

**Question** : si un test exploratoire révèle un risque non anticipé qui fait passer l'incrément de M à É, quelles sont les étapes précises ?
**Tension** : le rapport-discovery-cadrage identifie ce point comme ouvert (§4.6). La Validation est l'endroit où cela se concrétise.
**Piste** :
1. Documenter la découverte dans le session report ET
2. Évaluer si la correction est dans le périmètre de l'incrément
3. Si oui : ajouter les tests É obligatoires, re-trigger les gates
4. Si non : No-Go + retour Build avec la promotion de classe documentée
**Priorité** : haute — à formaliser en protocole opérationnel.

### RC-VAL-05 — Accessibilité manuelle en mode solo

**Question** : les tests manuels d'accessibilité (lecteur d'écran, clavier) requièrent du temps et une expertise. En solo IA, comment maintenir ce niveau sans se bloquer ?
**Tension** : l'EAA est en vigueur depuis juin 2025 — la conformité n'est plus optionnelle. Mais l'audit expert est coûteux.
**Pistes** :
- L'agent IA peut auditer le HTML sémantique et les attributs ARIA (accessible tree analysis)
- Le développeur fait un smoke test clavier sur les parcours critiques
- Les audits experts (ATAG) sont réservés aux classes C et aux releases majeures
**Priorité** : haute — à décider avant tout changement UI É/C.

### RC-VAL-06 — Données de test et anonymisation RGPD en staging

**Question** : quelle est la frontière entre pseudonymisation (insuffisante selon le RGPD) et anonymisation irréversible ? Les outils automatiques (pg_anonymizer) garantissent-ils suffisamment l'irréversibilité ?
**Tension** : la guidance ICO 2025 rappelle que la pseudonymisation n'est pas de l'anonymisation. Mais les outils de génération synthétique créent des données qui peuvent révéler des patterns de la DB réelle.
**Piste** : appliquer k-anonymity sur les datasets analytiques, hash + salt sur les PII directes, génération synthétique pure pour les nouvelles entités.
**Priorité** : haute si le projet traite des données de santé ou financières.

---

## 15. Relations inter-cycles

### 15.1 Dépendances entrantes

| Cycle source | Artefact reçu | Utilisation en Validation |
|---|---|---|
| Cadrage (02) | DoR/DoD définies, classe de risque initiale | Calibrage de la profondeur de validation |
| Cadrage (02) | Critères d'acceptation testables | Matrice de vérification |
| Conception (03) | Plan de tests défini | Stratégie de validation (pyramide/trophée/honeycomb) |
| Conception (03) | SLO définis et mesurables | Cibles des tests de charge |
| Conception (03) | Threat model | Scope des tests de sécurité |
| Conception (03) | Plan d'accessibilité | Scénarios de tests manuels |
| Build (04) | Code mergé, CI vert | Point de départ de la Validation |
| Build (04) | Tests développeur écrits | Ne pas re-tester, compléter |
| Build (04) | Environnement staging ready | Exécution des tests |

### 15.2 Dépendances sortantes

| Cycle cible | Artefact transmis | Condition |
|---|---|---|
| Release (06) | Rapport de validation (Go/No-Go) | Toujours |
| Release (06) | Issues résiduelles acceptées | Go avec réserves |
| Release (06) | Preuves d'audit (CI, DAST, axe-core) | Toujours |
| Build (04) | Ticket de régression + test de non-régression | Défaut trouvé en Validation |
| Conception (03) | ADR de correction si défaut d'architecture | Défaut architectural découvert |
| Apprentissage (08) | Pattern de défaut pour mémoire à long terme | Toujours (fin de cycle) |

### 15.3 Feedbacks critiques

**Feedback Validation → Build** :
Tout défaut trouvé en Validation qui aurait dû être capturé par les tests développeur génère :
1. Un ticket de défaut (BUG dans le backlog)
2. Un test de non-régression écrit AVANT la correction (rouge → vert)
3. Une note dans `planning/06-quality/defect-escape-analysis.md`

**Feedback Validation → Apprentissage** :
Les patterns de défauts récurrents (même classe, même zone) alimentent :
1. Le registre des risques (`planning/08-risks/`)
2. La classification de risque T/F/M/É/C (améliorant la précision future)
3. Les heuristiques d'exploration (enrichissant les charters ET des prochains cycles)

**Feedback Validation → Conception** :
Si un test exploratoire révèle un défaut de design (architecture de permission incorrecte, absence de rate limiting, flux d'authentification contournable) :
1. No-Go immédiat
2. ADR de correction requis (retour Conception)
3. Threat model mis à jour si le défaut est sécurité

---

## Annexe A — Checklist de validation par classe de risque

### Classe T — Trivial

```
- [ ] CI vert (lint, tests, SAST)
- [ ] Critères d'acceptation vérifiés (si présents)
- [ ] ASVS L1 sur les points pertinents
- [ ] Go documenté
```

### Classe F — Faible

```
- [ ] CI vert (lint, tests, SAST, SCA)
- [ ] Tous les critères d'acceptation Pass
- [ ] Tests d'intégration verts
- [ ] axe-core vert sur les pages touchées (si UI)
- [ ] ASVS L1 complet sur les zones modifiées
- [ ] Go documenté
```

### Classe M — Moyen

```
- [ ] CI vert (tous gates)
- [ ] 100 % des critères d'acceptation vérifiés
- [ ] Tests E2E parcours critiques verts
- [ ] Tests de charge nominale vs SLO
- [ ] Tests exploratoires (1-2 sessions de 60 min)
- [ ] axe-core + smoke test clavier (si UI)
- [ ] ASVS L2 sur les zones modifiées
- [ ] Couverture ≥ 70 %
- [ ] Mutation score ≥ 60 % zones critiques (si logique métier)
- [ ] Plan de rollback documenté
- [ ] Go/No-Go documenté
```

### Classe É — Élevé

```
- [ ] CI vert (tous gates)
- [ ] 100 % des critères d'acceptation vérifiés
- [ ] Tests E2E complets (parcours principaux + cas d'erreur)
- [ ] Tests de contrat Pact (si frontières inter-service)
- [ ] Tests de charge (nominal + stress) vs SLO
- [ ] DAST sur preprod (ZAP/Burp)
- [ ] Tests exploratoires (2-3 sessions, heuristiques SFDPOT + STRIDE light)
- [ ] Tests accessibilité manuels (clavier + lecteur d'écran sur parcours critiques)
- [ ] axe-core vert
- [ ] ASVS L2 complet sur toutes les zones modifiées
- [ ] Revue de sécurité indépendante
- [ ] Couverture ≥ 80 %
- [ ] Mutation score ≥ 70 % zones critiques
- [ ] Validation AIPD mesures techniques (si données perso.)
- [ ] Feature flag en place (deployé OFF)
- [ ] Plan de rollback testé en staging
- [ ] Go/No-Go documenté avec justification complète
```

### Classe C — Critique

```
- [ ] Tous les critères É satisfaits
- [ ] ASVS L3 sur zones critiques
- [ ] Fuzzing endpoints API
- [ ] Audit accessibilité (expert ou utilisateurs en situation de handicap)
- [ ] Mutation score ≥ 80 % zones critiques
- [ ] Tests de charge (soak test 72h si disponibilité critique)
- [ ] Validation AIPD complète et signée
- [ ] SBOM généré et archivé
- [ ] Signature artefact (Cosign/Sigstore)
- [ ] Communication parties prenantes préparée
- [ ] Plan de rollback répété (pas seulement documenté)
- [ ] Go/No-Go avec approbation formelle tracée
```

---

## Annexe B — Format de session report de test exploratoire

```markdown
## Session Report ET

**Charter** : Explorer [cible] avec [outils] pour [découvrir/vérifier]
**Durée** : [HH:MM] — [HH:MM] (XX min)
**Heuristiques utilisées** : SFDPOT / CRUD / Boundary / Error guessing / [autres]
**Tester** : [nom / agent IA + développeur]

### Couverture réelle
- Zones explorées : [liste]
- Zones non couvertes : [liste + justification]

### Findings
| ID | Sévérité | Description | Étapes de reproduction | Zone |
|---|---|---|---|---|
| F-001 | Critique | ... | 1. ... 2. ... | Auth |

### Questions soulevées
- [Questions qui nécessitent clarification métier ou technique]

### Suites suggérées
- [Charters de sessions complémentaires suggérées]

### Décision
[ ] Tous les findings adressés → Go
[ ] Findings critiques ouverts → No-Go
[ ] Findings mineurs avec plan de remédiation → Go avec réserves
```

---

*Document produit par deep-researcher agent — cross-validé sur sources ISO, OWASP, DORA, W3C, Meszaros/Fowler.*
*Prochaine révision prévue : après premier cycle de Build réel sur ce harness.*
