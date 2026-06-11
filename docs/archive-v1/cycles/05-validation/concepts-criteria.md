# Cycle 05 — Validation : Concepts et Critères

> **Pipeline fractale v4** — Document de référence conceptuel et architectural.
> **Statut** : v1.1 — 2026-05-03
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

En mode solo + IA, ce cycle s'exécute avec un agent IA qui joue le rôle de "reviewer antagoniste" et de "testeur exploratoire simulé", sous supervision du développeur pour les classes H et C.

---

## 2. Position dans le pipeline

```
[discovery] → [cadrage] → [conception] → [build] → [validation] → [release] → [run] → [learning]
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
| Conception (03) | Défaut d'architecture révélé par les tests | ADR de correction + re-threat-model si H/C |
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
- [ ] Classe de risque confirmée (T/L/M/H/C) pour chaque changement de l'incrément

### 4.2 Critères contextuels (selon classe de risque)

| Critère | M | H | C |
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

- [ ] Mutation score zones critiques atteint selon la classe : ≥ 60 % pour M (logique métier uniquement), ≥ 70 % pour H, ≥ 80 % pour C — non requis pour T/L (voir §6.4 et §8.1)
- [ ] Tenue des SLO sous charge nominale + stress (résultats mesurés, pas estimés) — SLO load par défaut : p95 < 500 ms / p99 < 1 s ; override possible si SLO différents définis en Conception
- [ ] SAST / SCA : aucune CVE Critical ou High non triée et justifiée
- [ ] DAST (classes H/C) : aucune vulnérabilité High non mitigée
- [ ] IaC/container scan : aucun finding Critical non traité
- [ ] Intégrité SBOM vérifiée (présent, signé, 0 CVE CVSS ≥ 9.0) — obligatoire L+ (voir §11.2)

### 5.3 Sécurité (OWASP ASVS v5)

- [ ] Niveau ASVS approprié à la classe de risque atteint (voir §8)
- [ ] Les contrôles ASVS pertinents aux changements apportés ont été vérifiés
- [ ] Aucune finding de sécurité active sans ticket de remédiation planifié

### 5.4 Accessibilité (WCAG 2.2 AA)

- [ ] axe-core / Pa11y CI vert sur toutes les pages touchées (0 violation A/AA)
- [ ] Tests manuels : navigation clavier + lecteur d'écran sur les parcours critiques modifiés
- [ ] Contrastes ≥ 4.5:1 (texte normal), ≥ 3:1 (UI) vérifiés visuellement

### 5.5 Privacy

- [ ] Les mesures techniques de l'AIPD sont vérifiées implémentées (pas seulement décrites) — si une AIPD est ouverte (risques M+), l'AIPD doit être validée avant le Go
- [ ] Aucune donnée de prod non anonymisée présente en staging
- [ ] Logs : aucune PII en clair dans les logs de staging

### 5.6 Artefacts obligatoires

- [ ] `.planning/03-sprints/.../04-test-and-validation-results.md` complété
- [ ] `.planning/06-quality/quality-gates-results.md` mis à jour
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
**Quand** : dès qu'il y a une frontière inter-service (microservices, API publique, BFF). En solo monorepo, préférer les tests d'intégration avec le consommateur réel — réserver Pact aux frontières inter-repo ou inter-équipe.
**Avantage** : détecte les ruptures de compatibilité **avant** le déploiement, sans tests E2E coûteux.
**Outil** : Pact v11 (2025) + Pact Broker / PactFlow.
**Complémentarité** : les tests de contrat remplacent les tests d'intégration inter-services, pas les tests unitaires ni les E2E smoke tests.

#### Tests de mutation

**Concept** : introduire des mutations dans le code (changer `>` en `>=`, supprimer une condition, etc.) et vérifier que les tests existants les détectent ("killent" le mutant).
**Métriques** :
- **Mutation score** = mutants tués / mutants totaux.
- Cibles par classe : ≥ 60 % pour M (logique métier), ≥ 70 % pour H, ≥ 80 % pour C.
- **Survivants** = lacunes dans les assertions ou les cas de test.
**Outils** : Stryker (JS/TS, .NET, Scala), PIT (Java), mutmut (Python).
**Quand appliquer** : sur les modules de logique métier dense, auth, calculs financiers, règles métier critiques. Pas sur tout le codebase (coût exponentiel).
**Optimisation** : run incrémental (uniquement modules touchés) pour les PRs ; run asynchrone nightly pour H/C — bloquant sur le checkpoint pre-release uniquement.
**Limite** : les mutants équivalents (mutations sémantiquement sans effet) gonflent artificiellement les survivants. Il faut les identifier et les exclure.
**Seuils Stryker par défaut** : high: 80, low: 60, break: 50.

#### Tests par propriétés (Property-based testing)

**Concept** : au lieu de définir des exemples discrets, on spécifie des **propriétés** que la fonction doit respecter pour toute entrée générée aléatoirement. Le framework génère des milliers de cas, y compris les cas limites, et cherche à falsifier la propriété.

**Exemple** :
```typescript
// Propriété : le tri ne perd pas d'éléments et produit une séquence ordonnée
fc.assert(
  fc.property(fc.array(fc.integer()), (arr) => {
    const sorted = sort(arr);
    return sorted.length === arr.length && isSorted(sorted);
  })
);
```

**Outils** :
- **fast-check** (TypeScript/JavaScript) — intégration Vitest/Jest native
- **Hypothesis** (Python) — shrinking automatique des contre-exemples
- **jqwik** (Java) — intégration JUnit 5

**Cibles prioritaires** : parsers (CSV, JSON, XML), validateurs de formulaires, calculs financiers (commutatif, associatif, inverse), algorithmes de tri/déduplication/pagination, codecs/sérialiseurs, règles métier complexes.

**Modulation par classe** : recommandé H/C — le coût est justifié là où une seule entrée mal gérée peut corrompre des données ou créer une vulnérabilité. Optionnel (○) pour M sur logique critique.

**Complémentarité** : complète les tests unitaires (exemples explicites) et les tests de mutation (robustesse des assertions) — ne les remplace pas.

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
| **Spy** | Records received calls, may delegate to the real dependency | Post-assertion | Check that a method was called N times |
| **Mock** | Checks predeclared expectations and fails if they are not met | During the test | Check a precise interaction contract |

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
| T/L | ≥ 60 % | Non requis |
| M | ≥ 70 % | ≥ 60 % sur logique métier |
| H | ≥ 80 % | ≥ 70 % sur zones critiques |
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
- **STRIDE light** : pour les fonctionnalités à composante sécurité (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)
- **LINDDUN** : pour les fonctionnalités traitant des données personnelles — Linkability (combinaison de données révélant une identité), Identifiability (identification directe), Non-repudiation (traçabilité non désirée), Detectability (révélation d'existence), Disclosure of information (exposition involontaire), Unawareness (utilisateur non informé), Non-compliance (violation réglementaire). Recommandé en complément de STRIDE sur toute feature impliquant des PII, emails, données de santé ou financières.

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
| L | ✅ CI | — | — |
| M | ✅ CI | Smoke test clavier | — |
| H | ✅ CI | Clavier + lecteur d'écran | — |
| C | ✅ CI | Clavier + lecteur d'écran + zoom | Expert ou utilisateurs en situation de handicap |

---

### 6.8 Validation de sécurité — OWASP ASVS v5 (2025)

OWASP ASVS v5.0.0 a été publié en mai 2025 à Global AppSec EU Barcelona. Il couvre ~350 exigences réparties en 17 chapitres.

**Trois niveaux cumulatifs** :

| Niveau | Portée | Classe de risque correspondante |
|---|---|---|
| L1 — Hygiene | Sécurité de base, première couche de défense | T/L |
| L2 — Standard | Pratiques standard complètes, la majorité des applications | M/H |
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
- Pour chaque changement de classe H/C : vérifier les chapitres ASVS pertinents aux flux modifiés
- DAST (OWASP ZAP, Burp Suite) sur preprod pour les classes H/C
- Fuzzing sur les endpoints d'API publique pour la classe C
- Tests d'authentification et d'autorisation (AuthZ matrix testing) pour tout changement touchant des permissions

**Risques spécifiques au code généré par IA** :
Des études récentes documentent que le code généré par IA présente des taux de défauts sécurité significativement plus élevés : 19.6 % de hallucinations de packages (dépendances inexistantes pouvant être détournées — Chen et al. 2024) et 29–45 % de vulnérabilités sécurité introduites involontairement (Perry et al. 2023). En Validation, les modules à forte proportion de code généré par IA doivent faire l'objet d'un audit SAST/DAST renforcé et d'une vérification explicite de chaque dépendance introduite, indépendamment de la classe de risque nominale.

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

**Conformité RGPD** : les données anonymisées au sens RGPD doivent être irréversiblement anonymisées — hash + salt sur PII directes, génération synthétique sur PII indirectes, k-anonymity sur datasets analytiques. La pseudonymisation n'est **pas** de l'anonymisation au sens du RGPD (ICO guidance 2025).

---

### 6.10 Assurance qualité risk-based (ISO/IEC/IEEE 29119)

ISO/IEC/IEEE 29119 est la norme internationale pour les processus de test logiciel. Le **risk-based testing** est le cœur de la partie 5 de la norme.

**Principe** : allouer l'effort de test proportionnellement au produit `vraisemblance × impact` sur chaque zone fonctionnelle.

**Matrice de risque de test** :

```
              IMPACT
              Low      Moyen   High
Low      │   Bas    │  Bas  │ Moyen │
VRAIS.   │         │       │       │
Moyen    │   Bas   │ Moyen │ High  │
         │         │       │       │
High     │  Moyen  │ High  │Critique│
```

**Allocation de l'effort** :
- Zone Critique : tests exhaustifs, mutation testing, tests exploratoires, revue de sécurité
- Zone High : tests complets, couverture renforcée, ET ciblé
- Zone Moyenne : tests standards, couverture nominale
- Zone Basse : smoke tests, couverture minimale

**Processus** :
1. Identifier les zones fonctionnelles de l'incrément
2. Évaluer vraisemblance de défaut × impact métier pour chaque zone
3. Mapper sur la matrice → niveau de risque de test
4. Allouer l'effort en conséquence
5. Documenter les zones non testées et leur justification (risque accepté)

---

## 7. Critères qualité — ISO/IEC 25010:2023 et ISO/IEC 25019:2023

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

### 7.4 ISO/IEC 25019:2023 — Qualité en usage

ISO/IEC 25019:2023 complète ISO 25010 en définissant la **qualité perçue par l'utilisateur en situation réelle** (qualité en usage), distincte de la qualité intrinsèque du produit.

**5 caractéristiques de qualité en usage** :

| Caractéristique | Description | Mesure en Validation |
|---|---|---|
| **Efficacité** | L'utilisateur atteint ses objectifs avec exactitude et complétude | Taux de succès sur parcours utilisateur critiques (tests E2E) |
| **Efficience** | Effort dépensé pour atteindre les objectifs | Temps sur tâche, nombre d'étapes, taux d'erreur utilisateur |
| **Satisfaction** | Confort, plaisir, confiance, et absence de désagrément | SUS score (System Usability Scale), CSAT |
| **Liberté du risque** | Absence de risques économiques, de sécurité, environnementaux, sociaux | Tests de sécurité, conformité RGPD, tests de charge |
| **Couverture du contexte** | Adéquation pour les différents contextes d'utilisation | Tests cross-browser, cross-device, tests d'accessibilité |

Les caractéristiques ISO 25019 sont définies en Cadrage (critères d'acceptation utilisateur) et mesurées en Validation via les tests E2E, les tests d'accessibilité, et les tests de charge.

---

## 8. Modulation par classe de risque

La profondeur de la Validation se module sur la classe de risque T/L/M/H/C de chaque changement. Les classes sont cumulatives : un incrément peut contenir des changements de classes différentes — c'est la **classe maximale** qui détermine le niveau de validation global.

### 8.1 Matrice de modulation

| Activité de Validation | T | L | M | H | C |
|---|:---:|:---:|:---:|:---:|:---:|
| Vérification critères d'acceptation | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests unitaires (CI) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests d'intégration (CI) | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests E2E parcours critiques | — | ◔ | ✅ | ✅ | ✅ |
| Tests de contrat (Pact) | — | — | ○ | ✅ | ✅ |
| Mutation testing zones critiques | — | — | ○ | ✅ | ✅ |
| Tests par propriétés (property-based) | — | — | ○ | ✅ | ✅ |
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
| Tests i18n / RTL | — | ○ | ○ | ✅ | ✅ |
| Vérification budget FinOps | — | — | ○ | ✅ | ✅ |
| Vérification intégrité SBOM | — | ✅ | ✅ | ✅ | ✅ |

**Légende** : ✅ obligatoire — ○ recommandé — ◔ allégé — — non requis

**Tests i18n / RTL** : vérifier la complétude des chaînes de traduction, l'absence de texte dur-codé, le rendu correct des langues RTL (arabe, hébreu) sur les layouts, les formats de date/nombre/devise selon la locale, et la gestion des pluriels. Outils : i18next, Lingui, RTL-aware Playwright tests.

**Vérification budget FinOps** : vérifier que le coût d'infrastructure généré par l'incrément reste dans l'enveloppe budgétaire validée en Conception. Pour H/C, le coût de run est mesuré en staging sur une charge représentative et comparé au budget cible. Seuil d'alarme : dérive > 20 % sans justification → dérogation tracée requise. Source : FinOps Foundation Framework 2024.

### 8.2 Dérogations et protocole de promotion de classe

Toute dérogation à une activité marquée ✅ doit être :
1. Documentée dans `.planning/03-sprints/.../04-test-and-validation-results.md`
2. Justifiée (raison technique ou temporelle explicite)
3. Tracée avec un risk owner et une date de remédiation
4. Approuvée (auto-approbation acceptable en solo T/L, revue obligatoire en H/C)

**Protocole de promotion de classe en cours de Validation** : si un test exploratoire, un DAST, ou une vérification SBOM révèle un risque non anticipé qui élève la classe de risque effective (ex : M → H), le protocole en 4 étapes est :

1. **Déclencheur documenté** : consigner la découverte dans le session report ET ou le rapport DAST avec le signal de forçage identifié (ex : fichier `auth/session.ts` modifié, CVE critique découverte, PII révélées dans les logs)
2. **Upgrade immédiat** : appliquer les gates et exigences de preuve de la nouvelle classe — ne pas attendre la fin du cycle
3. **Notification et log** : créer une entrée dans `.planning/state.yaml` avec `type: class_escalation`, ancienne classe, nouvelle classe, signal déclencheur, et liste des nouvelles exigences de preuve obligatoires
4. **Mise à jour rétroactive des artefacts** : ADR si nécessaire, threat model si sécurité concernée (+ LINDDUN si PII), plan canary si passage en H/C, re-trigger des gates manquantes

Si les exigences de la nouvelle classe ne peuvent pas être satisfaites dans le périmètre de l'incrément courant : No-Go immédiat + retour Build avec la promotion documentée.

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

**Artefacts en entrée** : `.planning/03-sprints/.../01-selected-work.md`, critères d'acceptation des stories, rapport CI

### Étape 2 — Define

**But** : formaliser la stratégie de validation pour cet incrément.

**Activités** :
- Sélectionner les niveaux de test par zone (pyramide/trophée/honeycomb selon architecture)
- Définir les charters de tests exploratoires pour les zones rouges
- Confirmer les seuils de couverture et de mutation score par module
- Identifier les environnements nécessaires et leur disponibilité
- Planifier les tests manuels (accessibilité, exploration) avec fenêtres de temps

**Artefacts produits** : plan de tests de validation (dans `.planning/03-sprints/.../04-test-and-validation-results.md`, section Plan)

### Étape 3 — Design

**But** : préparer les données de test, les scénarios, les charters ET.

**Activités** :
- Préparer les données de test (datasets anonymisés, fakes, factories)
- Écrire les charters de tests exploratoires (cible, heuristiques, durée)
- Configurer les outils de charge (k6 scripts) avec les scénarios définis en Conception
- Préparer les scénarios d'accessibilité manuelle (parcours à tester, outils)
- Configurer les outils DAST (ZAP spider + active scan) sur preprod

### Étape 4 — Execute

**But** : exécuter tous les tests selon le plan, dans l'ordre de priorité (risque décroissant).

**Ordre recommandé** :
1. Quality gates CI (déjà verts, confirmation)
2. Tests de régression automatisés (suite complète)
3. Vérification des critères d'acceptation (automatisés puis manuels)
4. Tests de charge contre les SLO + vérification budget FinOps (si M+)
5. DAST (si H/C)
6. Tests exploratoires (zones rouges en priorité, heuristiques SFDPOT + STRIDE light + LINDDUN si PII)
7. Tests d'accessibilité manuels (si M+)
8. Vérification intégrité SBOM (si L+)

**Collecte de preuves** : chaque test produit une preuve (rapport CI, screenshot, session report ET, rapport k6, rapport axe-core).

### Étape 5 — Verify

**But** : analyser les résultats et prendre la décision Go/No-Go.

**Critères de décision** :

| Décision | Conditions |
|---|---|
| **Go** | Tous les critères DoD Validation satisfaits. Zéro défaut bloquant ouvert. |
| **No-Go** | Au moins un critère DoD Validation non satisfait sans dérogation approuvée. Défaut bloquant ou critique ouvert. |
| **Go avec réserves** | Critères satisfaits, mais défauts mineurs ouverts avec owner + deadline + plan de monitoring. |

**Traçabilité de la décision** : la décision est documentée dans `.planning/03-sprints/.../04-test-and-validation-results.md` avec sa justification complète.

### Étape 6 — Capitalize

**But** : enregistrer ce qui a été appris pour améliorer la prochaine Validation.

**Activités** :
- Mettre à jour `.planning/06-quality/quality-gates-results.md`
- Mettre à jour `.planning/06-quality/defect-escape-analysis.md` si des défauts avaient échappé
- Mettre à jour `.planning/06-quality/flaky-tests-register.md`
- Mettre à jour `.planning/06-quality/quality-debt-register.md` avec la dette qualité identifiée pendant ce cycle (seuils manqués, dérogations accordées, tests différés)
- Identifier les nouveaux patterns de défaut pour `.planning/08-risks/`
- Si un défaut a été trouvé en Validation que les tests développeur auraient dû catcher : créer un test de non-régression (principe "every defect generates a test")

### Étape 7 — Transmit

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
- Mise en quarantaine immédiate — SLA quarantaine : 1 sprint (ne bloquent plus la CI mais sont signalés)
- Fix obligatoire sous 3 sprints maximum — sinon suppression. Owner : QA Lead ; escalade : Validation Lead si backlog flaky > 5 tickets
- Enregistrés dans `.planning/06-quality/flaky-tests-register.md`

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
| Tests de charge | Validation humaine | Par incrément H/C |
| Tests manuels accessibilité | Validation humaine | Par incrément H/C |

**Fonctions fitness** (Building Evolutionary Architectures — Ford, Parsons, Kua 2017) : des fonctions fitness automatisées gouvernent les seuils de qualité en continu, déclenchant une alerte CI ou un blocage si un seuil est franchi. Exemples : couverture de code sous le seuil de classe, mutation score en baisse, temps de réponse p99 en régression > 10 %, score axe-core dégradé, SBOM avec nouvelle CVE critique. Voir `docs/transversal/quality-model.md §fitness-functions` pour le catalogue complet.

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
| Rapport DAST | Changement H/C | `.planning/03-sprints/.../evidence/` |
| Rapport axe-core | Changement UI | `.planning/03-sprints/.../evidence/` |
| Rapport d'accessibilité manuelle | Changement UI H/C | `.planning/03-sprints/.../evidence/` |
| Attestation AIPD | Changement avec données perso. | `docs/09-security-compliance/` |
| Rapport mutation testing | Changement M+ logique critique | `.planning/03-sprints/.../evidence/` |
| Rapport property-based testing | Changement H/C parsers/calculs financiers | `.planning/03-sprints/.../evidence/` |
| SBOM vérifié (intégrité + CVE scan) | Changement L+ — vérification explicite, pas seulement livraison | `.planning/03-sprints/.../evidence/` |
| Rapport FinOps (coût staging mesuré) | Changement H/C | `.planning/03-sprints/.../evidence/` |
| Issues résiduelles acceptées | Go avec réserves | `.planning/03-sprints/.../04-test-and-validation-results.md` |

### 11.3 Artefacts de capitalisation

| Artefact | Emplacement | Fréquence |
|---|---|---|
| Analyse d'échappement des défauts | `.planning/06-quality/defect-escape-analysis.md` | Par défaut escaped |
| Register des tests flaky | `.planning/06-quality/flaky-tests-register.md` | Continu |
| Register de la dette qualité | `.planning/06-quality/quality-debt-register.md` | Par cycle Validation |
| Mise à jour du risk register | `.planning/08-risks/` | Par pattern de risque nouveau |
| Test de non-régression | `tests/` dans le code | Par défaut trouvé en Validation |

**`quality-debt-register.md`** : document vivant listant les écarts de qualité acceptés avec dérogation — défauts mineurs ouverts, seuils de couverture/mutation non atteints avec justification, tests différés. Chaque entrée porte un owner, une priorité (P1/P2/P3), et une date cible de remédiation. Alimenté à chaque cycle Validation, traité et priorisé en Apprentissage.

---

## 12. Métriques et indicateurs

### 12.1 Métriques de qualité de test

| Métrique | Formule | Cible | Cadence |
|---|---|---|---|
| **Taux de pass des critères d'acceptation** | Pass / Total | 100 % (ou dérogations tracées) | Par incrément |
| **Couverture de code (zones critiques)** | Lignes couvertes / Total | Selon classe (§6.4) | Par incrément |
| **Mutation score** | Mutants tués / Total | ≥ 60 % M / ≥ 70 % H / ≥ 80 % C | Par incrément M+ |
| **Taux de défauts résiduels** | Défauts ouverts / Stories livrées | < 5 % bloquants | Par sprint |
| **Défauts échappés** | Défauts trouvés en prod / Défauts totaux | < 2 % | Par release |

### 12.2 Métriques de performance (DORA 2024 — 5 métriques)

| Métrique DORA | Cible top 15 % | Cible haute | Mesure |
|---|---|---|---|
| Change Lead Time | < 1 jour | < 1 semaine | Commit → deploy |
| Deployment Frequency | À la demande | Quotidien à hebdo | Nb de déploiements |
| Change Failure Rate | < 5 % | < 10 % | Déploiements causant incident / Total |
| Failed Deployment Recovery Time | < 1 h | < 1 jour | Détection → résolution |
| **Rework Rate** | **< 15 %** | **< 30 %** | **% PRs avec rework significatif post-merge** |

Le **Rework Rate** est la 5e métrique introduite dans le rapport DORA 2024. Il mesure la proportion de pull requests qui nécessitent un rework significatif après merge (défauts redécouverts, critères d'acceptation manqués, régressions introduites). Un Rework Rate > 30 % est un signal d'alarme sur l'efficacité du processus de Validation — à investiguer avec les métriques SPACE (§12.6).

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
| Parcours critiques manuels PASS | 100 % | Par release H/C |
| Délai moyen de remédiation violation | < 1 sprint | Par violation |

### 12.5 Signaux d'alarme (déclencheurs d'action)

| Signal | Seuil | Action |
|---|---|---|
| Change Failure Rate > 15 % (3 sprints) | Bloquant | Gel features, focus tests et risk-based testing |
| Rework Rate > 30 % | Alerte | Revue du processus Validation + renforcement DoR/DoD |
| Défauts échappés > 5 % | Alerte | Revue stratégie de test + ET renforcé |
| Mutation score < 60 % zones critiques | Alerte | Session de renforcement des assertions |
| Flaky tests > 3 dans la suite | Alerte | Sprint de stabilisation test |
| Violation WCAG AA en prod | Bloquant | Correctif prioritaire + régression test |

### 12.6 Métriques SPACE (équipe)

SPACE (Forsgren, Storey, Maddila et al. 2021 — ACM Queue) mesure la productivité d'équipe sur 5 dimensions, au-delà des seules métriques d'output.

| Dimension | Indicateurs appliqués à la Validation | Instrument |
|---|---|---|
| **Satisfaction** | Confort du développeur avec le processus de Validation | Enquête pulse hebdomadaire (score 1–5) |
| **Performance** | Qualité de la décision Go/No-Go mesurée a posteriori | Défauts échappés en production |
| **Activity** | Nb de sessions ET réalisées, couverture des charters | Comptage dans session reports |
| **Communication** | Temps de réponse sur les tickets de régression | Ticket-to-fix cycle time |
| **Efficiency** | Délai moyen de validation par classe de risque | Temps mesuré par cycle Validation |

Les métriques SPACE complètent les métriques DORA en capturant la dimension bien-être et friction — utiles pour détecter si le processus de Validation génère de la dette organisationnelle plutôt que de la valeur.

---

## 13. Standards de référence

| Domaine | Standard | Version | Source |
|---|---|---|---|
| Qualité produit | ISO/IEC 25010 | 2023 | iso.org |
| Qualité en usage | ISO/IEC 25019 | 2023 | iso.org |
| Processus de test | ISO/IEC/IEEE 29119 | 2022 (Part 1-4), 2024 (Part 5) | iso.org |
| Stratégie de test | Risk-based testing (29119-5) | 2016/2024 | softwaretestingstandard.org |
| Sécurité applicative | OWASP ASVS | v5.0.0 (mai 2025) | owasp.org |
| Risques web | OWASP Top 10 | 2021 (mise à jour 2025 attendue) | owasp.org |
| Modélisation menaces sécurité | STRIDE (Microsoft) | Evergreen | microsoft.com |
| Modélisation menaces privacy | LINDDUN | Evergreen | linddun.org |
| Accessibilité | WCAG 2.2 | Octobre 2023 | w3.org/TR/WCAG22 |
| Accessibilité UE | European Accessibility Act (Directive 2019/882) | En vigueur 28 juin 2025 | eur-lex.europa.eu |
| Accessibilité Europe | EN 301 549 v3.2.1 | — | etsi.org |
| Test doubles | xUnit Test Patterns (Meszaros) | 2007, evergreen | xunitpatterns.com |
| Tests de contrat | Pact | v11 (2025) | docs.pact.io |
| Tests par propriétés | fast-check (TS/JS), Hypothesis (Python), jqwik (Java) | Evergreen | fast-check.dev |
| Performance livraison | DORA State of DevOps | 2024 | dora.dev |
| Productivité équipe | SPACE Framework (Forsgren, Storey, Maddila et al.) | 2021 | queue.acm.org |
| Architecture évolutive | Building Evolutionary Architectures (Ford, Parsons, Kua) | 2017 | oreilly.com |
| Privacy | RGPD art. 25 + 35 | — | eur-lex.europa.eu |
| Privacy | CNIL PIA Guide | — | cnil.fr |
| FinOps | FinOps Foundation Framework | 2024 | finops.org |
| Tests exploratoires | Session-based testing (Bach & Bach) | 2000, evergreen | satisfice.com |
| BDD / Critères d'acceptation | Gherkin / Given-When-Then (Terhorst-North) | Evergreen | cucumber.io |

---

## 14. Questions ouvertes — RED CARDS

Le protocole limite à ≤ 2 RED CARDS par cycle pour forcer la résolution inline. RC-VAL-01 à RC-VAL-03 et RC-VAL-05 à RC-VAL-06 ont été résolus inline dans les sections concernées (§6.2, §5.2, §5.5, §10.1, §10.1 respectivement).

### RC-VAL-04 — Alignement protocole promotion de classe avec GateType `pre_tool`

**Question** : le protocole manuel en 4 étapes défini en §8.2 est-il suffisant, ou le GateType `pre_tool` du harness doit-il automatiser la reclassification quand un signal de forçage est détecté en cours de Validation ?
**Tension** : §8.2 définit un protocole humain-tracé. La spec `docs/conception/05-gates-policy-spec.md §7.4` définit un protocole harness automatisé avec log `class_escalation` dans `.planning/state.yaml`. Les deux protocoles doivent être réconciliés pour éviter une double implémentation divergente.
**Dépendances** : `docs/transversal/risk-classification.md RED-02`, `docs/conception/05-gates-policy-spec.md §7.4`, GateType `pre_tool`.
**Action requise** : aligner §8.2 sur PFV4 : `pre_tool` peut confirmer une promotion, met à jour `.planning/current-risk.yaml`, trace la transition dans `.planning/state.yaml`, puis bloque ou reprend selon la nouvelle classe.
**Statut** : fermé par le contrat PFV4 ; les heuristiques de signal restent à calibrer.

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
3. Une note dans `.planning/06-quality/defect-escape-analysis.md`

**Feedback Validation → Apprentissage** :
Les patterns de défauts récurrents (même classe, même zone) alimentent :
1. Le registre des risques (`.planning/08-risks/`)
2. La classification de risque T/L/M/H/C (améliorant la précision future)
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

### Classe L — Low

```
- [ ] CI vert (lint, tests, SAST, SCA)
- [ ] Tous les critères d'acceptation Pass
- [ ] Tests d'intégration verts
- [ ] axe-core vert sur les pages touchées (si UI)
- [ ] ASVS L1 complet sur les zones modifiées
- [ ] Intégrité SBOM vérifiée (présent, signé, 0 CVE CVSS ≥ 9.0)
- [ ] Go documenté
```

### Classe M — Moyen

```
- [ ] CI vert (tous gates)
- [ ] 100 % des critères d'acceptation vérifiés
- [ ] Tests E2E parcours critiques verts
- [ ] Tests de charge nominale vs SLO (p95 < 500 ms / p99 < 1 s par défaut)
- [ ] Tests exploratoires (1-2 sessions de 60 min, heuristiques SFDPOT + CRUD)
- [ ] axe-core + smoke test clavier (si UI)
- [ ] ASVS L2 sur les zones modifiées
- [ ] Couverture ≥ 70 %
- [ ] Mutation score ≥ 60 % zones critiques (si logique métier)
- [ ] Tests i18n/RTL (si feature multi-langue ou RTL)
- [ ] Plan de rollback documenté
- [ ] Intégrité SBOM vérifiée
- [ ] Go/No-Go documenté
```

### Classe H — High

```
- [ ] CI vert (tous gates)
- [ ] 100 % des critères d'acceptation vérifiés
- [ ] Tests E2E complets (parcours principaux + cas d'erreur)
- [ ] Tests de contrat Pact (si frontières inter-service)
- [ ] Tests par propriétés (fast-check/Hypothesis) sur parsers, validateurs, calculs financiers
- [ ] Tests de charge (nominal + stress) vs SLO
- [ ] DAST sur preprod (ZAP/Burp)
- [ ] Tests exploratoires (2-3 sessions, heuristiques SFDPOT + STRIDE light + LINDDUN si PII)
- [ ] Tests accessibilité manuels (clavier + lecteur d'écran sur parcours critiques)
- [ ] axe-core vert
- [ ] ASVS L2 complet sur toutes les zones modifiées
- [ ] Revue de sécurité indépendante
- [ ] Couverture ≥ 80 %
- [ ] Mutation score ≥ 70 % zones critiques
- [ ] Validation AIPD mesures techniques (si données perso.)
- [ ] Feature flag en place (deployé OFF)
- [ ] Plan de rollback testé en staging
- [ ] Tests i18n/RTL (si feature multi-langue ou marché international)
- [ ] Vérification budget FinOps (coût staging mesuré vs budget cible)
- [ ] Intégrité SBOM vérifiée + SLSA provenance
- [ ] Go/No-Go documenté avec justification complète
```

### Classe C — Critique

```
- [ ] Tous les critères H satisfaits
- [ ] ASVS L3 sur zones critiques
- [ ] Fuzzing endpoints API
- [ ] Audit accessibilité (expert ou utilisateurs en situation de handicap)
- [ ] Mutation score ≥ 80 % zones critiques
- [ ] Tests par propriétés renforcés (propriétés invariantes critiques exhaustives)
- [ ] Tests de charge (soak test 72h si disponibilité critique)
- [ ] Validation AIPD complète et signée (LINDDUN obligatoire si données perso.)
- [ ] SBOM généré, vérifié, archivé + Cosign/Sigstore signature
- [ ] Tests i18n/RTL (si feature multi-langue ou marché international)
- [ ] Vérification budget FinOps avec projection 30 jours
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
**Heuristiques utilisées** : SFDPOT / CRUD / Boundary / Error guessing / STRIDE light / LINDDUN / [autres]
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
*v1.1 — Révision post-audit 05-validation.audit.md (2026-05-03) : DORA Rework Rate §12.2 (R040/R041) ; property-based testing §6.2 + §8.1 (R051) ; i18n/RTL testing §8.1 + Annexe A (R052) ; FinOps Validation §8.1 + Annexe A (R053) ; LINDDUN §6.5 + §8.2 + Annexe A/B (R054) ; fitness functions §10.2 (R055) ; ISO 25019:2023 §7.4 (R056) ; quality-debt-register §11.3 + §9 Étape 6 (R057) ; SPACE metrics §12.6 (R058) ; AI code risks §6.8 (R059) ; SBOM verification explicit §5.2 + §8.1 + §11.2 (R060) ; mutation DoD qualifié par classe §5.2 (C001) ; 5 RED CARDS résolus inline, 1 conservé (C002) ; protocole promotion de classe §8.2 (R047).*
