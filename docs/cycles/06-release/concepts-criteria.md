# Cycle 06 — Release : Concepts et Critères

> **Statut** : document de référence architectural — v1.0 — 2026-05-03
> **Cycle** : 06 — Release (sixième des 8 cycles de la Pipeline fractale v4)
> **Standards** : DORA 2024/2025, NIST SSDF SP 800-218 v1.1, SemVer 2.0, ISO/IEC 25010:2023
> **Portée** : solo dev + agents IA, contexte web/SaaS, sans contrainte d'équipe
> **Document source de vérité** : rapport-discovery-cadrage.md (2026-05-02)

---

## Table des matières

1. Résumé exécutif
2. Position dans le pipeline
3. Objectif du cycle
4. Entrées (DoR Release)
5. Sorties (DoD Release)
6. Concepts clés
7. Critères qualité (ISO 25010:2023)
8. Modulation par classe de risque
9. Sous-cycle fractal (7 étapes)
10. Activités transversales
11. Artefacts produits
12. Métriques et indicateurs
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations inter-cycles

---

## 1. Résumé exécutif

Le cycle Release est le **point de basculement** entre le monde du développement et le monde de la production. C'est ici que le code validé devient une réalité utilisateur.

La proposition centrale de ce cycle est la **séparation stricte entre déploiement et release** : déployer du code en production ne signifie pas libérer une fonctionnalité aux utilisateurs. Cette séparation — opérée par les feature flags — est le levier le plus puissant pour réduire le change failure rate (DORA 2024 : cible < 5 %, seuls 8,5 % des équipes atteignent 0-2 %).

Trois décisions architecturales invariantes pour ce cycle :

1. **Versioning SemVer 2.0 obligatoire** avec Conventional Commits — le changelog s'écrit dans les commits, pas après coup.
2. **Stratégie de déploiement proportionnelle au risque** : direct pour T/F, rolling pour stateless M, canary progressif pour É/C.
3. **Rollback en un clic** testé en staging avant toute promotion en production — un rollback non testé n'est pas un plan de rollback.

Performance DORA 2024 de référence pour ce cycle :
- Elite (top 15 %) : déploiement à la demande, multiples fois par jour
- High : quotidien à hebdomadaire
- Medium : hebdomadaire à mensuel
- Low : mensuel à trimestriel

Le cycle Release est mesurable, automatisable, et doit atteindre le niveau High en régime de croisière pour un solo dev mûr.

---

## 2. Position dans le pipeline

### 2.1 Flux global Pipeline fractale v4

```
[Discovery] → [Cadrage] → [Conception] → [Build] → [Validation] → [RELEASE] → [Run] → [Apprentissage]
                                                                         ↑
                                                               CYCLE COURANT
```

### 2.2 Place du cycle Release

| Cycle amont | Cycle courant | Cycle aval |
|-------------|---------------|------------|
| **Validation** (cycle 05) | **Release** (cycle 06) | **Run** (cycle 07) |
| Fournit : build approuvé, gates CI verts, smoke tests staging OK | Produit : artefact déployé, release notes, version taggée, rollback testé | Reçoit : version en production, SLO définis, runbooks activés |

### 2.3 Positionnement dans la pipeline v3 (référence compass_artifact)

Le cycle Release correspond aux phases 12–13 du cadre v3 :
- Phase 12 — Préparation déploiement (environnements, migrations, stratégies)
- Phase 13 — Déploiement (pipeline automatisé, smoke tests, watch SLO)

La pipeline fractale v4 réorganise ces deux phases en un cycle complet traversant lui-même les 7 étapes Observer → Transmettre.

### 2.4 Frontières strictes

Ce cycle **commence** quand : le cycle Validation a rendu un verdict Go (DoD Validation satisfaite, quality gates verts).

Ce cycle **se termine** quand : l'artefact est en production, les smoke tests post-déploiement sont verts, le rollback est confirmé opérationnel, et les destinataires aval (cycle Run) ont été notifiés.

---

## 3. Objectif du cycle

### 3.1 Intention principale

Livrer en production un artefact versionné, traçable, réversible et documenté, avec un impact maîtrisé sur les utilisateurs existants.

### 3.2 Ce que le cycle Release accomplit

- Transformer un incrément validé en version de production déployée
- Découpler le déploiement technique de la libération fonctionnelle aux utilisateurs
- Garantir la réversibilité rapide (rollback < 1 h pour le niveau High DORA)
- Produire une release notes exploitable par les parties prenantes
- Enregistrer les preuves d'audit (SLSA provenance, SBOM, signature artefact)
- Alimenter la métrique DORA Deployment Frequency

### 3.3 Ce que le cycle Release ne fait pas

- Il ne décide pas si le code est fonctionnellement correct (cycle Validation)
- Il ne surveille pas la production en continu (cycle Run)
- Il ne tire pas les enseignements de l'incident (cycle Apprentissage)
- Il ne classe pas le risque du changement (cycle Cadrage)

---

## 4. Entrées — Definition of Ready (DoR Release)

Le cycle Release **ne peut démarrer** que si tous les critères suivants sont satisfaits. Un critère manquant est un bloquant explicite, pas un risque accepté silencieusement.

### 4.1 Critères obligatoires (toutes classes de risque)

- [ ] Cycle Validation clôturé avec verdict **Go** documenté
- [ ] Quality gates CI verts et persistants (SAST, SCA, lint, type-check, tests, couverture)
- [ ] Aucune CVE Critical/High non triée dans les dépendances
- [ ] Version SemVer calculée et proposée (ex: `1.3.0`, `2.0.0-rc.1`)
- [ ] Changelog draft généré depuis les Conventional Commits depuis le dernier tag
- [ ] Artefact de build identifié et immuable (hash, digest ou tag)
- [ ] Environnement staging/preprod validé avec parité de configuration prod
- [ ] Smoke tests staging exécutés et verts

### 4.2 Critères additionnels selon la classe de risque

| Critère | T/F | M | É | C |
|---------|:---:|:---:|:---:|:---:|
| Plan de rollback documenté | implicite | requis | requis + testé | requis + répété |
| Feature flag configuré OFF par défaut | — | recommandé | obligatoire | obligatoire |
| Communication parties prenantes préparée | — | équipe | équipe + PO | élargie |
| Migrations expand-phase vérifiée (pas de contract dans ce déploiement) | — | ○ | obligatoire | obligatoire |
| SLSA provenance générée et vérifiée | — | — | obligatoire | obligatoire |
| SBOM CycloneDX/SPDX attaché à l'artefact | — | ○ | obligatoire | obligatoire |
| Signature Cosign/Sigstore | — | — | obligatoire | obligatoire |
| Gate d'approbation humaine explicite | — | — | obligatoire | obligatoire |
| Tests de charge / performance sur staging | — | — | recommandé | obligatoire |
| Runbooks activés et vérifiés | — | ○ | obligatoire | obligatoire |

### 4.3 Anti-pattern de DoR

Commencer le déploiement en production avec un "ça marche en staging" verbal, sans artefact identifié, sans changelog, sans rollback plan documenté. C'est l'anti-pattern numéro un du cycle Release — il transforme chaque déploiement en pari.

---

## 5. Sorties — Definition of Done (DoD Release)

Le cycle Release est **Done** quand tous les critères suivants sont vérifiables objectivement.

### 5.1 Critères obligatoires (toutes classes de risque)

- [ ] Artefact déployé en production (hash identique à celui validé en staging)
- [ ] Version SemVer taggée dans le repository Git (`git tag v1.3.0`)
- [ ] Changelog / release notes publiés (format exploitable par non-dev)
- [ ] Smoke tests post-déploiement prod verts (parcours critiques fonctionnels)
- [ ] SLO et error budget sous surveillance active (pas d'anomalie dans la fenêtre de déploiement)
- [ ] Rollback confirmé opérationnel (pas seulement planifié)

### 5.2 Critères additionnels selon la classe de risque

| Critère | T/F | M | É | C |
|---------|:---:|:---:|:---:|:---:|
| Notification parties prenantes envoyée | — | équipe | équipe + PO | élargie + status page |
| Feature flag en état nominal (ON ou OFF selon le plan) | — | ○ | obligatoire | obligatoire |
| Fenêtre de monitoring post-déploiement fermée (min. 30 min) | — | ○ | obligatoire | obligatoire |
| Artefact de release archivé (registre immuable) | ○ | ✅ | ✅ | ✅ |
| SBOM attaché à la release sur registre | — | ○ | obligatoire | obligatoire |
| Signature artefact vérifiée en prod | — | — | obligatoire | obligatoire |
| Post-deploy validation rapport écrit | — | ○ | obligatoire | obligatoire |
| Cycle Run notifié avec runbooks actifs | — | ○ | obligatoire | obligatoire |
| Enregistrement dans le release register (Planning/04-releases/) | ✅ | ✅ | ✅ | ✅ |

---

## 6. Concepts clés

### 6.1 Séparation déploiement / release (concept central)

**Déploiement** = acte technique de placer un artefact en production. Peut se produire silencieusement, sans impact utilisateur visible, grâce aux feature flags.

**Release** = acte métier de rendre une fonctionnalité accessible aux utilisateurs. Peut se produire sans nouveau déploiement, simplement en activant un flag.

Cette séparation est le fondement de la stratégie de réduction de risque. Elle permet :
- De déployer fréquemment (améliore la Deployment Frequency DORA)
- De libérer les fonctionnalités progressivement (réduit le Change Failure Rate)
- De revenir en arrière en quelques secondes sur une feature sans rollback de code

```
Flux traditionnel (risqué) :
  merge → build → DÉPLOIEMENT + RELEASE simultanés → incident potentiel

Flux Pipeline v4 (maîtrisé) :
  merge → build → DÉPLOIEMENT (flag OFF) → smoke tests → RELEASE progressive (flag ON 5% → 100%)
```

### 6.2 Versioning sémantique (SemVer 2.0)

Format : `MAJOR.MINOR.PATCH[-prerelease][+buildmetadata]`

| Segment | Signification | Exemple de déclencheur |
|---------|--------------|------------------------|
| MAJOR | Breaking change — incompatibilité API | Suppression d'endpoint, refonte d'auth |
| MINOR | Nouvelle fonctionnalité backward-compatible | Nouvel endpoint, nouvelle feature |
| PATCH | Correctif backward-compatible | Fix de bug, correctif de sécurité |
| Pré-release | Version instable | `1.3.0-rc.1`, `2.0.0-beta.3` |

**Règles invariantes** :
- 0.y.z = phase de développement initial, API instable — acceptable pour projets pré-lancement
- Une version publiée ne doit JAMAIS être modifiée — toute correction = nouvelle version
- MAJOR 0 est une exception : tout peut changer à tout moment

**Automatisation** : Conventional Commits → semantic-release → tag SemVer + changelog. Le changelog n'est pas rédigé manuellement après coup. Il est la conséquence directe de la discipline des commits.

```
feat: ajouter authentification OAuth          → MINOR bump (1.2.0 → 1.3.0)
fix: corriger la validation du formulaire     → PATCH bump (1.3.0 → 1.3.1)
feat!: refactorer l'API publique              → MAJOR bump (1.3.1 → 2.0.0)
BREAKING CHANGE: dans le footer du commit     → MAJOR bump
```

### 6.3 Stratégies de déploiement

Cinq stratégies, choisies selon la classe de risque et la nature de l'application.

#### Déploiement direct
- Remplace l'ancienne version par la nouvelle en une seule opération
- Risque : temps d'indisponibilité potentiel, rollback complexe
- Usage : T/F uniquement, jamais en production critique

#### Rolling deployment
- Mise à jour progressive des instances (N instances à la fois)
- Pendant la transition, les deux versions coexistent
- Rollback possible mais pas instantané
- Usage : défaut pour les applications stateless, classe M

#### Blue-Green deployment
- Deux environnements identiques (blue = current, green = new)
- Bascule du trafic instantanée via load balancer
- Rollback en quelques secondes : rerouter vers blue
- Coût : 2× l'infrastructure pendant la fenêtre de déploiement
- Usage : quand le rollback instantané est non-négociable, classe É

#### Canary deployment
- Routage progressif : 5 % → 25 % → 50 % → 100 % du trafic
- Chaque palier = gate SLO : pas de progression si les métriques dérivent
- Infrastructure : une seule pool, pas de duplication complète
- Usage : standard pour M/É, pilote les décisions par la donnée réelle

```
Canary gates (exemple) :
  Palier 5%  → attendre 15 min, vérifier error rate < 1%
  Palier 25% → attendre 30 min, vérifier p99 latency < 500ms
  Palier 50% → attendre 1h, vérifier SLO intact
  Palier 100% → déploiement complet + smoke tests finaux
```

#### Shadow / Dark launch
- Le trafic réel est dupliqué vers la nouvelle version, sans impact utilisateur
- Permet de valider le comportement sous charge réelle avant toute exposition
- Usage : validation technique pré-canary pour les changements critiques

### 6.4 Feature flags / Feature toggles

Mécanisme de contrôle de la visibilité des fonctionnalités en production, indépendamment du code déployé.

**Types de toggles (Martin Fowler, taxonomy) :**

| Type | Durée | Usage |
|------|-------|-------|
| Release toggle | Court (1-7 jours) | Découpler déploiement/release |
| Experiment toggle | Court-moyen | A/B testing, canary par segment |
| Ops toggle | Moyen-long | Kill switch, circuit breaker manuel |
| Permission toggle | Long | Accès par rôle, tier, géographie |

**Règles de gestion :**
- Chaque toggle a un owner et une date d'expiration
- Les toggles Release sont supprimés dès que le rollout est complet (dette technique si maintenus)
- Les toggles Ops (kill switches) sont permanents par design
- Tests avec toggle ON et toggle OFF obligatoires

**Anti-pattern** : accumuler des toggles sans les nettoyer. Un système avec > 20 toggles actifs simultanément devient non-testable et source de bugs de configuration.

### 6.5 Gestion des migrations sans downtime (pattern expand/contract)

Toute migration de schéma ou de contrat d'API suit le pattern expand/contract (parallel change), **toujours en plusieurs déploiements distincts** :

```
Déploiement 1 — EXPAND :
  - Ajouter la nouvelle colonne/endpoint/champ (nullable, backward-compatible)
  - L'ancienne version continue de fonctionner sans modification
  - Déploiement à risque faible

Déploiement 2 — MIGRATE (dual-write) :
  - L'application écrit dans l'ancien ET le nouveau
  - Backfill des données existantes en lots (évite les locks)
  - Validation : les deux sources sont cohérentes

Déploiement 3 — SWITCH READ :
  - La lecture bascule vers le nouveau
  - L'ancien reste en écriture comme filet de sécurité

Déploiement 4 — CONTRACT :
  - Suppression de l'ancien après vérification (logs, queries)
  - Opérations non-bloquantes : pg_repack, CONCURRENTLY, gh-ost
```

**Règle invariante** : aucune opération de CONTRACT (DROP, RENAME, suppression de champ) dans le même déploiement qu'une fonctionnalité utilisateur. Ces deux choses ne partagent jamais un tag SemVer sans une phase MIGRATE intermédiaire.

### 6.6 Plan de rollback

Le rollback n'est pas un plan optionnel. C'est une exigence de la DoR Release pour tout changement M/É/C.

**Trois niveaux de rollback :**

| Niveau | Mécanisme | Temps de récupération |
|--------|-----------|----------------------|
| Feature rollback | Désactiver le feature flag | < 1 minute |
| Deployment rollback | Revenir au tag précédent (blue-green ou rolling backward) | < 5 minutes |
| Database rollback | Point-in-time recovery + scripts de migration inverse | > 30 minutes (risque élevé) |

**Règle pour le rollback base de données** : si le rollback de base de données nécessite plus de 30 minutes ou est destructeur, alors la stratégie de migration expand/contract est obligatoire — le contract n'est jamais dans la même release que le code qui dépend de la nouvelle structure.

**Test du rollback** : tout plan de rollback É/C doit être exécuté en staging avant la promotion en prod. La phrase "on pourra rollback si besoin" sans test préalable est un anti-pattern documenté.

### 6.7 Smoke tests post-déploiement

Tests rapides (< 5 minutes) exécutés immédiatement après tout déploiement en production pour valider que le système est fondamentalement opérationnel.

**Caractéristiques d'un smoke test de qualité :**
- Couvre les parcours critiques (login, transaction principale, API health)
- Exécution rapide (< 5 minutes total)
- Résultat binaire : pass = système vivant, fail = rollback immédiat
- Automatisé, pas de validation manuelle requise
- Idempotent : peut être rejoué sans effet de bord

**Ne pas confondre avec :**
- Tests de régression complète (cycle Validation)
- Tests de performance (phase de validation É/C)
- Tests d'acceptation produit (cycle Validation)

### 6.8 Changelog et Release Notes

**Deux artefacts distincts :**

| Artefact | Audience | Format | Source |
|----------|----------|--------|--------|
| CHANGELOG | Développeurs, équipes techniques | Markdown technique, par version | Conventional Commits automatisés |
| Release Notes | Parties prenantes, utilisateurs | Prose, bénéfices métier | Extrait du changelog + reformulation |

**Pipeline d'automatisation :**
```
Conventional Commits
  → semantic-release (analyze commits)
  → version bump SemVer
  → CHANGELOG.md update
  → git tag + GitHub/GitLab Release
  → Release Notes draft (à compléter si besoin)
```

**Format CHANGELOG standard (Keep a Changelog) :**
```markdown
## [1.3.0] - 2026-05-03
### Added
- Authentification OAuth Google (#123)
### Fixed
- Validation du formulaire d'inscription (#119)
### Security
- Mise à jour lodash 4.17.21 → 4.17.22 (CVE-2024-XXXX)
```

### 6.9 Gestion des artefacts et supply chain

**Registre d'artefacts immuable** : tout artefact de release est identifié par un digest cryptographique immuable. Personne ne peut modifier un artefact après sa publication dans le registre.

**SBOM (Software Bill of Materials)** : inventaire complet des composants logiciels d'un artefact. Formats standard : CycloneDX ou SPDX. Généré automatiquement (Syft, cdxgen) et attaché à chaque release.

**SLSA (Supply-chain Levels for Software Artifacts)** :
- Niveau 1 : build scriptable, provenance générée (pas encore vérifiable)
- Niveau 2 : build sur CI hosted, provenance signée et vérifiable — objectif pour régime de croisière
- Niveau 3 : build hermétique et auditable — pour produits critiques

**Signature Cosign/Sigstore** : signature cryptographique de l'artefact, vérifiable avant tout déploiement. Protège contre la substitution malveillante d'artefacts.

### 6.10 Environnements et promotion

La promotion est le flux d'un artefact à travers les environnements successifs. Chaque franchissement de frontière est une gate explicite.

```
dev → CI → review/preview → staging → preprod → PROD
          ↓                   ↓           ↓
      quality gates      smoke tests  release gate
      (auto-bloquant)    (go/no-go)   (humain É/C)
```

**Parité d'environnements** : la configuration doit être identique entre staging/preprod et prod, à l'exception des secrets et des endpoints externes. Toute différence documentée et justifiée. Une divergence non documentée est un risk silencieux.

**Données anonymisées** : prod → staging utilise des techniques irréversibles (hash+salt sur PII, données synthétiques). L'intégrité référentielle doit être préservée.

### 6.11 Gates d'approbation Release

| Classe | Type de gate | Approbateur |
|--------|-------------|-------------|
| T | Automatique (CI vert) | Aucun humain |
| F | Automatique (CI + smoke tests) | Aucun humain |
| M | Semi-automatique | Auto si hors heures creuses, sinon validation asynchrone |
| É | Gate humain explicite | Developer (solo) ou tech lead |
| C | Gate humain + checklist | Developer + revue de la checklist C obligatoire |

En mode solo : le gate humain É/C signifie que le developer **lit la checklist complète**, signe mentalement ou dans le fichier de release, puis déclenche manuellement le déploiement. L'auto-approbation reflexe sans lecture est l'anti-pattern rubber-stamp documenté dans le rapport-discovery-cadrage.

---

## 7. Critères qualité (ISO 25010:2023)

Les 9 caractéristiques ISO 25010:2023 appliquées au cycle Release, avec les critères mesurables et les seuils cibles.

### 7.1 Caractéristiques primaires pour ce cycle

| Caractéristique | Critères Release | Seuil cible |
|-----------------|-----------------|-------------|
| **Reliability** (disponibilité, fault tolerance, recoverability) | Uptime post-déploiement, MTTR, smoke tests pass rate | Smoke tests 100% pass, MTTR < 1h (High DORA) |
| **Security** (intégrité, authenticité, non-répudiation) | Signature artefact, SBOM complet, provenance SLSA | SLSA niveau 2 pour É/C, secrets scan vert |
| **Maintainability** (modifiabilité, testabilité) | Changelog à jour, artefact immuable identifié, rollback documenté | Changelog auto-généré, rollback testé É/C |
| **Flexibility** (installabilité, remplaçabilité) | Déploiement progressif, compatibilité backward, expand/contract | Zero breaking change non-annoncé en MAJOR |
| **Performance efficiency** (time behaviour) | Temps de déploiement, temps de rollback, durée smoke tests | Déploiement < 15 min, smoke tests < 5 min |

### 7.2 Caractéristiques secondaires applicables

| Caractéristique | Application au Release | Critère |
|-----------------|----------------------|---------|
| **Functional suitability** | Les fonctionnalités déployées correspondent exactement à celles validées | Hash artefact identique staging → prod |
| **Interaction capability** | Release notes lisibles par les parties prenantes non-techniques | Release notes validées par un non-dev |
| **Compatibility** | Backward compatibility respectée ou MAJOR bump | Aucune régression de contrat non annoncée |
| **Safety** *(nouveau ISO 25010:2023)* | Opérations à risque derrière gate humain, rollback automatique si seuil SLO atteint | Automated rollback on burn rate activé pour C |

### 7.3 Caractéristique non applicable à ce cycle

| Caractéristique | Justification |
|-----------------|---------------|
| Usability (interaction capability complète) | Relève du cycle Build/Conception |
| Privacy/RGPD complet | Vérifié en cycle Validation, référencé ici mais non testé |

---

## 8. Modulation par classe de risque

La matrice ci-dessous définit ce qui est obligatoire (✅), recommandé (○), allégé (◔), ou ignoré (—) pour chaque activité du cycle Release selon la classe de risque du changement (T/F/M/É/C).

### 8.1 Matrice Release par classe de risque

| Activité Release | T | F | M | É | C |
|-----------------|:---:|:---:|:---:|:---:|:---:|
| Calcul SemVer automatique | ✅ | ✅ | ✅ | ✅ | ✅ |
| Changelog auto (semantic-release) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Release notes lisibles | — | ◔ | ✅ | ✅ | ✅ |
| Smoke tests post-deploy | ✅ | ✅ | ✅ | ✅ | ✅ |
| Feature flag (deploy sans libération) | — | ◔ | ○ | ✅ | ✅ |
| Stratégie déploiement : direct | ✅ | ✅ | — | — | — |
| Stratégie déploiement : rolling | — | ○ | ✅ | ○ | — |
| Stratégie déploiement : canary | — | — | ○ | ✅ | ✅ |
| Stratégie déploiement : blue-green | — | — | — | ○ | ✅ |
| Rollback plan documenté | implicite | ◔ | ✅ | ✅ testé | ✅ répété |
| Rollback testé en staging | — | — | ◔ | ✅ | ✅ |
| SBOM attaché à la release | — | ◔ | ○ | ✅ | ✅ |
| Signature Cosign/Sigstore | — | — | — | ✅ | ✅ |
| SLSA provenance | — | — | — | ✅ (L2) | ✅ (L2+) |
| Gate d'approbation humaine | — | — | — | ✅ | ✅ |
| Watch SLO + error budget (30 min) | — | ◔ | ✅ | ✅ | ✅ |
| Automated rollback on burn rate | — | — | — | ○ | ✅ |
| Communication parties prenantes | — | — | équipe | élargie | élargie + ext. |
| Expand/contract vérifiée (pas de contract) | — | — | ✅ si migration | ✅ | ✅ |
| Fenêtre de monitoring post-deploy | — | 15 min | 30 min | 1 h | 2 h min |
| Post-deploy validation rapport | — | — | ○ | ✅ | ✅ |

### 8.2 Règles de classification pour ce cycle

Les critères du rapport-discovery-cadrage s'appliquent directement :

- **T** : cosmétique, doc, dépendance patch sans CVE, refactor pur sans changement de comportement
- **F** : nouvelle feature isolée derrière feature flag, pas de donnée perso, pas de migration
- **M** : feature visible utilisateur, pas de PII sensible, pas de schéma DB, pas d'impact tiers
- **É** : touche auth, autorisation, paiement, données personnelles, schéma DB, API publique, infra prod
- **C** : impact transverse multi-services, données santé/biométrie/financières, refonte architecture, rupture contrat API, exigence réglementaire

**Anti-pattern** : auto-classification vers le bas par commodité. Le rapport-discovery-cadrage identifie ce risque explicitement : "la classification reste subjective si elle n'est pas mécanisée". En solo, le developer doit challenger sa propre classification avant de lancer le déploiement.

---

## 9. Sous-cycle fractal (7 étapes)

Le cycle Release est lui-même un mini-cycle suivant les 7 étapes universelles : Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre.

La profondeur de chaque étape se module par la classe de risque.

### Étape 1 — Observer

**Intention** : lire l'état actuel avant d'agir. Ne jamais déployer sans avoir observé l'état de production.

**Activités** :
- Vérifier les SLO en production : error budget disponible ? Si < 20% restant, stop — pas de déploiement non critique.
- Vérifier les alertes actives : déployer sur un système déjà en incident est interdit.
- Vérifier l'état du registre de releases : aucune release en cours / en rollback.
- Lire les smoke tests staging : verts depuis combien de temps ?
- Vérifier les dépendances amont : migration en cours ? Déploiement d'un service dépendant attendu ?

**Livrables** : tableau d'état Go/No-Go (peut être mental pour T/F, écrit pour É/C).

**T/F** : vérification en 2 minutes, mentale ou automatisée.
**É/C** : checklist écrite dans le fichier `.planning/04-releases/REL-XXX/release-readiness.md`.

### Étape 2 — Définir

**Intention** : figer ce qui va être déployé, dans quel état, avec quelles frontières.

**Activités** :
- Identifier l'artefact exact (hash/digest immuable)
- Confirmer la version SemVer (automatique ou calculée manuellement)
- Définir le périmètre de la release : quelles fonctionnalités sont exposées vs. derrière flag
- Définir la stratégie de déploiement (direct / rolling / canary / blue-green)
- Identifier les feature flags concernés et leur état cible
- Confirmer le plan de rollback
- Identifier les destinataires de la communication

**Livrables** : release plan (`.planning/04-releases/REL-XXX/release-plan.md`).

### Étape 3 — Concevoir

**Intention** : préparer l'exécution pour qu'elle soit sans surprise.

**Activités** :
- Séquencer les étapes de déploiement (migrations d'abord si expand, déploiement ensuite)
- Configurer les paliers canary et les gates SLO associés
- Préparer les scripts de rollback (ou vérifier leur présence)
- Préparer la communication (draft de release notes, message équipe)
- Préparer les smoke tests (liste des parcours à vérifier)
- Définir les seuils de rollback automatique (error rate, p99 latency thresholds)
- Prévoir la fenêtre de monitoring post-deploy

**T/F** : cette étape est implicite (CI/CD gère tout).
**É/C** : plan écrit, rollback script testé en staging dans cette étape.

### Étape 4 — Exécuter

**Intention** : déployer de manière contrôlée, avec les yeux sur les métriques.

**Activités** :
- Déclencher le pipeline de déploiement (merge sur main ou tag SemVer)
- Vérification SLSA provenance et signature artefact avant promotion (É/C)
- Suivi en temps réel : SLO, error budget, logs, alertes
- Activation progressive des paliers canary avec validation à chaque palier
- Smoke tests post-déploiement (automatiques)
- Activation feature flag si le plan le prévoit (déclenchement de la "release" réelle)
- Publication du changelog / release notes

**Anti-patterns à ce stade** :
- Déclencher le déploiement et "ne pas regarder" pendant 1 heure
- Activer tous les feature flags simultanément sans paliers
- Fusionner le contract d'une migration dans ce déploiement

### Étape 5 — Vérifier

**Intention** : confirmer objectivement que le déploiement a réussi et que la production est saine.

**Activités** :
- Smoke tests résultats : 100% pass obligatoire
- Monitoring SLO : error budget intact dans la fenêtre de 30 min minimum
- Vérification des logs structurés : pas d'erreur inattendue
- Vérification des métriques RED (Rate, Errors, Duration) sur les endpoints touchés
- Validation de la version déployée (endpoint /version ou équivalent)
- Si canary : vérification des métriques comparées entre la flotte canary et la flotte stable

**Critères de rollback automatique** :
- Error rate > seuil défini pendant > 5 minutes consécutives → rollback
- p99 latency > 2× baseline → rollback
- SLO burn rate > 14.4× sur 1 heure → rollback (Google SRE multi-burn-rate alerting)

### Étape 6 — Capitaliser

**Intention** : enregistrer les preuves et les apprentissages pour améliorer le prochain cycle.

**Activités** :
- Finaliser le rapport post-deploy (`.planning/04-releases/REL-XXX/post-deploy-validation.md`)
- Archiver l'artefact avec ses métadonnées (version, hash, SBOM, provenance)
- Enregistrer les métriques DORA : Deployment Frequency +1, durée du déploiement, incidents éventuels
- Identifier les frictions du cycle (étapes lentes, steps manuels qui pourraient être automatisés)
- Mettre à jour le risk register si de nouveaux patterns de risque ont été observés
- Nettoyer les feature flags obsolètes (si rollout complet)

**Indicateur de maturité** : si la phase Capitaliser dure moins de 10 minutes, le cycle est bien automatisé. Si elle dure > 1 heure, des parties du cycle Release doivent être automatisées.

### Étape 7 — Transmettre

**Intention** : passer la main au cycle Run avec toutes les informations nécessaires.

**Activités** :
- Notifier le cycle Run : nouvelle version en production, runbooks activés
- Publier la release sur la status page (si applicable)
- Envoyer la communication parties prenantes (selon classe de risque)
- Mettre à jour le `.planning/00-dashboard/current-release-status.md`
- Fermer la release dans le release register

**Transition Run** : le cycle Run a besoin de savoir exactement ce qui a changé, quels runbooks sont associés, et quels SLO sont en vigueur. La Transmission est le contrat entre Release et Run.

---

## 10. Activités transversales

Ces activités ne sont pas des phases séquentielles — elles traversent tout le cycle Release et doivent être actives en permanence.

### 10.1 Sécurité shift-left (NIST SSDF SP 800-218)

Applicable au Release dans les groupes **PS (Protect the Software)** et **RV (Respond to Vulnerabilities)** :
- PS.2 : protéger l'intégrité de l'artefact (signature Cosign, SBOM, SLSA)
- PS.3 : archiver et protéger les artefacts de release
- RV.1 : identifier et confirmer les CVE dans les dépendances avant release
- RV.2 : disposer d'un processus de réponse aux vulnérabilités post-release

### 10.2 Observabilité continue

Durant toute la fenêtre de déploiement et les 2 heures qui suivent :
- Tableau de bord SLO visible en temps réel
- Alertes multi-burn-rate actives (Google SRE : 14.4× sur 1h, 6× sur 6h, 1× sur 3j)
- Logs structurés filtrables par version deployée
- Traces distribuées avec tag version (permet de comparer canary vs stable)

### 10.3 FinOps

- Vérifier que le coût post-déploiement ne dérive pas de la baseline
- Pour les changements d'infrastructure : mesurer l'impact coût dans la première heure
- Les ressources éphémères de déploiement (blue-green second environment) doivent être détruites après le rollout complet

### 10.4 Documentation en continu

- Changelog généré automatiquement, pas rédigé manuellement après coup
- Release notes publiées dans les 24h du déploiement
- ADR mis à jour si la stratégie de déploiement a évolué pour ce cycle
- Runbooks activés et référencés dans la transmission au cycle Run

### 10.5 Privacy / RGPD

- Si le déploiement concerne de nouvelles données personnelles : vérifier que l'AIPD validée en cycle Conception est référencée dans les artefacts de la release
- Les migrations de données respectent la durée de conservation RGPD
- Aucune donnée de prod dans les artefacts de déploiement (logs de build, artefacts CI)

---

## 11. Artefacts produits

### 11.1 Artefacts primaires

| Artefact | Localisation | Format | Responsable |
|----------|-------------|--------|-------------|
| Artefact de release signé | Registre immuable (Docker Registry, npm, GitHub Releases) | Image/package + digest | Pipeline CI/CD |
| SBOM (Software Bill of Materials) | Attaché à la release dans le registre | CycloneDX JSON ou SPDX | Syft / cdxgen |
| SLSA Provenance (É/C) | Attaché à la release | JSON signé | slsa-github-generator |
| CHANGELOG.md | Root du repo | Markdown (Keep a Changelog) | semantic-release |
| Git tag SemVer | Repository Git | `vMAJOR.MINOR.PATCH` | semantic-release / manuel |
| Release Notes | GitHub/GitLab Releases + status page | Markdown lisible | Auto + reformulation si besoin |

### 11.2 Artefacts de traçabilité

| Artefact | Localisation | Format |
|----------|-------------|--------|
| Release Plan | `.planning/04-releases/REL-XXX/release-plan.md` | Markdown |
| Release Readiness checklist | `.planning/04-releases/REL-XXX/release-readiness.md` | Checklist Markdown |
| Post-Deploy Validation Report | `.planning/04-releases/REL-XXX/post-deploy-validation.md` | Markdown |
| Rollback Plan | `.planning/04-releases/REL-XXX/rollback-plan.md` | Markdown + scripts |
| Deployment Evidence | `.planning/04-releases/REL-XXX/deployment-evidence.md` | Logs + screenshots |
| Release Retrospective (É/C) | `.planning/04-releases/REL-XXX/release-retrospective.md` | Markdown |

### 11.3 Structure du dossier release (Planning/)

```
.planning/04-releases/
├── release-index.md
├── REL-001/
│   ├── release-plan.md
│   ├── release-readiness.md
│   ├── release-notes.md
│   ├── rollback-plan.md
│   ├── deployment-evidence.md
│   ├── post-deploy-validation.md
│   └── release-retrospective.md (É/C uniquement)
└── release-history.md
```

### 11.4 Format Release Readiness (template)

```markdown
---
release_id: REL-XXX
version: 1.3.0
risk_class: É
date: 2026-05-03
status: pending | go | no-go | rollback
---

# Release Readiness — REL-XXX — v1.3.0

## Artefact
- Hash: sha256:abc123...
- Image: registry.example.com/app:1.3.0
- SBOM: SBOM-1.3.0.cdx.json (attaché)

## Checklist DoR
- [x] Quality gates CI verts
- [x] Smoke tests staging verts
- [x] SemVer calculée : 1.3.0 (MINOR : nouvelle feature)
- [x] Rollback plan documenté et testé
- [x] Feature flags configurés OFF
- [x] Communication préparée

## Stratégie de déploiement
Canary : 5% → 25% → 50% → 100%
Gates : error rate < 1% à chaque palier

## Verdict
Go — approuvé le [date] par [developer]
```

---

## 12. Métriques et indicateurs

### 12.1 Métriques DORA applicables à ce cycle

| Métrique DORA | Définition | Cible High | Cible Elite | Mesure |
|---------------|-----------|-----------|-------------|--------|
| **Deployment Frequency** | Fréquence des déploiements en production | Quotidien à hebdomadaire | À la demande / multiples par jour | Count de releases taggées / période |
| **Change Failure Rate** | % de déploiements causant un incident ou rollback | < 15-20% | < 5% (idéal : < 2%) | Rollbacks / Total déploiements |
| **Failed Deployment Recovery Time** | Temps de récupération d'un déploiement raté (ex-MTTR, déplacé en throughput en 2024) | < 1 jour | < 1 heure | Temps rollback déclenché → production stable |
| **Rework Rate** *(nouveau 2024)* | % de déploiements non planifiés pour corriger un problème visible utilisateur | Tendance à la baisse | Tendance à la baisse | Hotfixes / Total releases |

### 12.2 Métriques techniques du cycle Release

| Métrique | Description | Seuil recommandé |
|----------|-------------|-----------------|
| Durée du pipeline de déploiement | Du déclenchement au smoke tests verts | < 15 minutes |
| Durée des smoke tests | Exécution complète de la suite smoke | < 5 minutes |
| Temps de rollback | Du déclenchement rollback à la production stable | < 5 minutes (feature flag), < 15 min (deployment) |
| Taux de succès des smoke tests | % des runs smoke tests ayant passé | > 99% |
| Coverage feature flags | % des features É/C derrière un flag | 100% |
| Taux d'artefacts signés | % des releases É/C avec signature Cosign | 100% |
| Délai changelog | Temps entre merge et publication changelog | < 1 heure (automatisé) |

### 12.3 Tableau de bord Release (Planning/07-metrics/release-metrics.md)

```
Période : [mois courant]
Deployment Frequency : X déploiements
Change Failure Rate   : X% (X rollbacks / X total)
Recovery Time moyen   : X minutes
Rework Rate           : X% (X hotfixes)
Durée moy. pipeline   : X min
Durée moy. smoke tests: X min
Releases avec SBOM    : X%
```

### 12.4 Seuils d'alerte et actions correctives

| Métrique | Seuil d'alerte | Action |
|----------|---------------|--------|
| CFR > 15% sur 3 releases consécutives | Critique | Stop les features, audit du processus de validation |
| Recovery Time > 1 heure | Élevé | Revoir le plan de rollback, automatiser le rollback |
| Smoke tests failure rate > 5% | Élevé | Analyser les flaky tests, revoir le scope des smoke tests |
| Pipeline duration > 30 min | Moyen | Profiler le pipeline, paralléliser les étapes lentes |
| Rework Rate > 20% | Élevé | Renforcer le cycle Validation, revoir la DoR |

---

## 13. Standards de référence

| Standard | Version | Application au cycle Release | Source |
|----------|---------|------------------------------|--------|
| **DORA** (Accelerate State of DevOps) | 2024/2025 | Deployment Frequency, Change Failure Rate, Failed Deployment Recovery Time, Rework Rate | [dora.dev](https://dora.dev/research/2024/) |
| **SemVer 2.0** | 2.0.0 | Versioning de tout artefact de release | [semver.org](https://semver.org/) |
| **Conventional Commits** | 1.0 | Source du changelog automatisé et de la classification SemVer | [conventionalcommits.org](https://www.conventionalcommits.org/) |
| **NIST SSDF SP 800-218** | v1.1 (v1.2 en draft déc. 2025) | PS.2/PS.3 protection artefact, RV.1/RV.2 gestion vulnérabilités | [csrc.nist.gov](https://csrc.nist.gov/pubs/sp/800/218/final) |
| **SLSA** (Supply-chain Levels for Software Artifacts) | v1.1 stable | Provenance et intégrité des artefacts de release | [slsa.dev](https://slsa.dev/) |
| **SBOM CycloneDX** | v1.5+ | Inventaire des composants logiciels de la release | [cyclonedx.org](https://cyclonedx.org/) |
| **SBOM SPDX** | v2.3 / v3.0 | Alternative à CycloneDX | [spdx.dev](https://spdx.dev/) |
| **Sigstore / Cosign** | Stable | Signature cryptographique des artefacts | [sigstore.dev](https://www.sigstore.dev/) |
| **ISO/IEC 25010:2023** | 2023 | Critères qualité (Reliability, Security, Maintainability, Flexibility) | iso.org |
| **Google SRE** (Site Reliability Engineering) | Book + Workbook | SLO, error budgets, multi-burn-rate alerting, rollback automated | [sre.google](https://sre.google/) |
| **AWS Well-Architected Framework** | 2024 | Automated rollback best practices ([DL.ADS.2]) | [docs.aws.amazon.com](https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.2-implement-automatic-rollbacks-for-failed-deployments.html) |
| **Keep a Changelog** | 1.0.0 | Format CHANGELOG.md | [keepachangelog.com](https://keepachangelog.com/) |
| **GitFlow / Trunk-Based Development** | — | Stratégies de branches, release branches | [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/) |
| **semantic-release** | v24+ | Automatisation version + changelog | [github.com/semantic-release](https://github.com/semantic-release/semantic-release) |

### 13.1 Positionnement des stratégies de branches pour le Release

| Stratégie | Quand utiliser | Déclencheur de release |
|-----------|---------------|----------------------|
| **Trunk-Based Development** | SaaS/web, CI/CD mature, déploiements fréquents | Merge sur `main` → release automatique |
| **GitHub Flow** | Web, équipes intermédiaires | Merge PR → release |
| **Git Flow** | Produits versionnés (firmware, bibliothèques publiques, mobile app stores) | Tag sur `release/x.y.z` |
| **Release Flow** (Microsoft) | Balance entre contrôle et vitesse | Branch release depuis main + cherry-pick fixes critiques |

Pour ce système (solo dev + SaaS web) : **Trunk-Based Development** est le choix aligné avec les objectifs DORA. Git Flow reste pertinent uniquement si le projet produit des livrables versionnés à destination d'un store ou d'un gestionnaire de paquets public.

---

## 14. Questions ouvertes (RED CARDS)

Les RED CARDS sont des questions architecturales sans réponse définitive à ce stade. Elles doivent être résolues avant d'implémenter ce cycle, ou explicitement marquées comme "risque accepté" avec un responsable.

### RC-01 — Automatisation complète vs gate humain solo

**Question** : en mode solo, le gate d'approbation humaine pour É/C doit-il être un frein dans le pipeline (le pipeline s'arrête et attend) ou un pré-requis documenté (le developer confirme manuellement puis déclenche) ?

**Tension** : un frein dans le pipeline améliore la traçabilité mais peut bloquer des déploiements urgents (incident). Un pré-requis documenté est plus souple mais peut dériver en rubber-stamp.

**Piste** : pré-requis documenté + checklist obligatoire dans le fichier release-readiness.md + audit aléatoire hebdomadaire (aligné sur l'anti-rubber-stamp du rapport-discovery-cadrage §3.3).

**Statut** : ouvert — à décider avant Build du cycle Release.

### RC-02 — Stratégie de feature flags : in-house vs service externe

**Question** : gérer les feature flags en interne (config file, database table, env vars) ou via un service externe (LaunchDarkly, Unleash, Flagsmith) ?

**Tension** : service externe = opérationnel immédiatement, coût FinOps, dépendance externe. In-house = zéro dépendance, effort de build initial, maintenance.

**Piste** : pour solo dev, un système simple in-house (table DB `feature_flags` + middleware) suffit pour les cas Release/Ops toggles. Service externe justifié si les A/B tests et les toggles par segment utilisateur deviennent fréquents.

**Statut** : ouvert — à décider par projet.

### RC-03 — Niveau SLSA cible

**Question** : quel niveau SLSA viser en régime de croisière ? Niveau 1 (provenance générée) vs Niveau 2 (provenance signée et vérifiable sur CI hosted) vs Niveau 3 (build hermétique) ?

**Tension** : Niveau 2 est atteignable en quelques semaines avec GitHub Actions OIDC. Niveau 3 nécessite un effort significatif (build hermétique, reproductible). La valeur marginale de 3 vs 2 est faible pour un projet solo non soumis à des contraintes réglementaires strictes.

**Piste** : Niveau 2 pour É/C, Niveau 1 acceptable pour M, pas de SLSA pour T/F. Réévaluer si le projet devient un composant de supply chain tiers.

**Statut** : décision recommandée Niveau 2 — à valider par projet.

### RC-04 — Rollback automatique sur burn rate : seuils et périmètre

**Question** : quels seuils de SLO burn rate déclenchent un rollback automatique ? Et pour quelle classe de risque ?

**Tension** : un seuil trop bas génère des rollbacks intempestifs (faux positifs). Un seuil trop haut laisse un incident se développer.

**Piste** : adopter les seuils Google SRE Multi-burn-rate alerting (14.4× sur 1h = rollback immédiat, 6× sur 6h = investigation urgente). Activer le rollback automatique uniquement pour C, décision humaine assistée pour É.

**Statut** : ouvert — à instrumenter en cycle Run, référencé ici pour la définition des gates.

### RC-05 — Gestion des hotfixes en mode Trunk-Based

**Question** : en Trunk-Based Development, comment gérer un hotfix critique sur une version de production quand main a déjà progressé significativement depuis le tag de release ?

**Piste** : branche éphémère depuis le tag de release prod (`hotfix/v1.3.1`), correctif minimal, pipeline complet (sans raccourci de quality gates), tag `v1.3.1`, merge back vers main. Durée max de la branche : 24h. Si > 24h, le hotfix est devenu une feature et doit passer par le cycle complet.

**Statut** : pratique recommandée — pattern décrit dans le compass_artifact §3.9, à implémenter dans le harness.

### RC-06 — Expand/contract et timing des Contract deployments

**Question** : comment s'assurer que le déploiement Contract (suppression de l'ancien schéma) n'est pas déclenché trop tôt ? Qui vérifie que "aucun client n'y accède encore" ?

**Tension** : sans automatisation, le Contract peut être oublié ou déclenché prématurément. Avec automatisation, il faut un système de détection d'accès à la colonne/endpoint ancien.

**Piste** : tracking d'accès via logs + requêtes DB sur la colonne ancienne. Seuil : zéro accès pendant 72h consécutives = safe to contract. Automatisable via script de vérification dans le pipeline.

**Statut** : ouvert — à automatiser, risque élevé si manuel.

### RC-07 — Release Approval pour le mode Bypass (classe T/F)

**Question** : en mode Bypass (l'agent fait tout, sans supervision humaine), quelle est la frontière acceptable pour les releases T/F ?

**Piste** : le mode Bypass est autorisé pour T/F seulement (décision §3.4 du rapport-discovery-cadrage). Pour le cycle Release, cela signifie que l'agent peut déclencher un déploiement direct pour T/F sans intervention humaine, si et seulement si les quality gates CI sont verts et les smoke tests staging sont passés.

**Statut** : décision prise en Discovery — à implémenter comme règle harness.

---

## 15. Relations inter-cycles

### 15.1 Dépendances amont

| Cycle | Ce que Release reçoit | Condition |
|-------|----------------------|-----------|
| **Cycle 05 — Validation** | Build approuvé avec verdict Go, quality gates CI verts persistants, smoke tests staging verts, rapport de validation | Obligatoire — Release ne peut commencer sans |
| **Cycle 04 — Build** | Artefact de build identifié (hash), Conventional Commits respectés, feature flags configurés | Obligatoire — l'artefact doit exister avant la release |
| **Cycle 03 — Conception** | Stratégie de déploiement choisie (ADR), plan de migration expand/contract défini, runbooks pré-configurés | Obligatoire pour É/C |
| **Cycle 02 — Cadrage** | Classification de risque T/F/M/É/C validée, gate d'approbation défini | Obligatoire — la modulation par risque dépend de cette classification |

### 15.2 Dépendances aval

| Cycle | Ce que Release transmet | Condition |
|-------|------------------------|-----------|
| **Cycle 07 — Run** | Version en production, runbooks activés, SLO en vigueur, dashboard de monitoring opérationnel | Obligatoire — Run ne peut surveiller sans ces informations |
| **Cycle 08 — Apprentissage** | Métriques DORA du cycle Release, incidents durant la fenêtre de déploiement, post-deploy validation rapport | Obligatoire pour la rétro |

### 15.3 Feedbacks inverses (boucles correctives)

```
Cycle Run → Release
  Si un incident est causé par un défaut de release management (mauvaise stratégie de déploiement,
  rollback plan insuffisant, smoke tests trop légers) → feedback vers la DoR Release

Cycle Apprentissage → Release
  Si la rétrospective identifie un pattern de Change Failure Rate élevé →
  renforcement du canary / ajout de smoke tests / revue des gates

Cycle Release → Validation
  Si un déploiement génère un rollback systématique sur un type de changement →
  les tests de validation doivent couvrir ce cas
```

### 15.4 Activités transversales partagées entre cycles

| Activité | Cycle qui la définit | Cycle qui l'exécute | Release y contribue |
|----------|---------------------|--------------------|--------------------|
| SBOM | Release (génération) | Run (consommation) | Génère et attache le SBOM |
| SLO/SLI | Conception (définition) | Run (surveillance) | Vérifie l'intégrité pendant le déploiement |
| Conventional Commits | Build (discipline) | Release (consommation) | Génère changelog et version |
| Feature flags | Conception (design) | Release (configuration) + Run (surveillance) | Configure l'état initial, transmet l'état à Run |
| Threat model | Conception (STRIDE) | Release (vérification supply chain) | Vérifie que les mitigations supply chain sont en place |

### 15.5 Matrice de responsabilité Release

```
              Discovery Cadrage Conception Build Validation RELEASE Run  Apprentissage
Classification T/F/M/É/C   [R]     [A]       [C]    [I]     [I]      [C]   [I]     [I]
Stratégie déploiement [I]   [C]     [A+R]     [C]    [I]     [I]      [A+R] [C]     [I]
Artefact signé        [I]   [I]     [I]       [C]    [I]     [A+R]    [C]   [I]     [I]
Changelog/SemVer      [I]   [I]     [C]       [A+R]  [I]     [A+R]    [C]   [I]     [I]
Smoke tests post-dep  [I]   [I]     [C]       [C]    [A]     [R]      [C]   [I]     [I]
Rollback exécuté      [I]   [I]     [C]       [C]    [I]     [A+R]    [C]   [I]     [I]

R = Responsible | A = Accountable | C = Consulted | I = Informed
```

---

## Annexe A — Checklist déploiement à risque (usage direct)

Checklist opérationnelle à utiliser pour tout déploiement M/É/C. Extraite du cadre v3 (compass_artifact §7.5) et adaptée au cycle 06.

```
## Checklist Release — REL-XXX — vX.Y.Z — Classe [M/É/C]

### Pré-déploiement
- [ ] Artefact identifié (hash immuable) et conforme à celui validé en staging
- [ ] SemVer calculée et justifiée
- [ ] Changelog / release notes draft prêt
- [ ] Quality gates CI verts (dernière exécution < 24h)
- [ ] Smoke tests staging verts (dernière exécution < 4h)
- [ ] Feature flags configurés OFF (pour les features É/C)
- [ ] Plan de rollback documenté et testé en staging
- [ ] Expand/contract : aucune opération CONTRACT dans ce déploiement
- [ ] SLO et error budget vérifiés (aucune alerte active, budget > 20%)
- [ ] Communication préparée (draft message équipe / parties prenantes)
- [ ] SBOM généré et attaché (É/C)
- [ ] Signature Cosign vérifiée (É/C)
- [ ] SLSA provenance vérifiée (É/C)
- [ ] Gate d'approbation humaine : [développeur a lu la checklist] (É/C)

### Déploiement
- [ ] Pipeline déclenché sur l'artefact identifié
- [ ] Paliers canary respectés (5% → 25% → 50% → 100% pour É/C)
- [ ] Smoke tests post-déploiement verts à chaque palier
- [ ] SLO surveillé en temps réel (dashboard ouvert)
- [ ] Error rate et p99 latency sous les seuils de rollback

### Post-déploiement
- [ ] Smoke tests prod finaux verts
- [ ] Fenêtre de monitoring fermée (30 min minimum)
- [ ] Changelog / release notes publiés
- [ ] Communication parties prenantes envoyée
- [ ] Feature flags activés selon le plan (si release fonctionnelle)
- [ ] Release archivée (Planning/04-releases/REL-XXX/)
- [ ] Cycle Run notifié
- [ ] Métriques DORA mises à jour
```

---

## Annexe B — Format Conventional Commits pour SemVer automatique

```
# PATCH bump (fix de bug)
fix(auth): corriger la validation du token expirée

# MINOR bump (nouvelle feature)
feat(dashboard): ajouter le widget de métriques DORA

# MAJOR bump (breaking change — deux formes)
feat(api)!: restructurer l'API de webhooks (format incompatible)

feat(payments): migrer vers Stripe Payment Intents

BREAKING CHANGE: l'endpoint /v1/charge est supprimé, utiliser /v1/payment-intent

# Hotfix sécurité (patch)
fix(deps): mise à jour lodash 4.17.21 → 4.17.22 (CVE-2024-xxxxx)

# Chore (pas de version bump)
chore(ci): optimiser le cache du pipeline de déploiement

# Docs (pas de version bump)
docs(release): ajouter le guide de rollback manuel
```

---

## Sources

| Source | Auteur | Année | Score |
|--------|--------|-------|-------|
| [DORA 2024 Accelerate State of DevOps Report](https://dora.dev/research/2024/) | DORA Research (Google) | 2024 | 3 |
| [DORA Metrics — 5 Key Metrics](https://cd.foundation/blog/2025/10/16/dora-5-metrics/) | CD Foundation | 2025 | 3 |
| [NIST SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | NIST | 2022 (actif) | 3 |
| [NIST SP 800-218 Rev.1 Draft v1.2](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd) | NIST | Déc. 2025 (draft) | 3 |
| [SemVer 2.0.0](https://semver.org/) | Tom Preston-Werner | 2013 (stable) | 3 |
| [Conventional Commits 1.0](https://www.conventionalcommits.org/) | Communauté | 2020 (stable) | 3 |
| [SLSA v1.1](https://slsa.dev/) | OpenSSF | 2024 | 3 |
| [Keep a Changelog 1.0](https://keepachangelog.com/) | Olivier Lacan | 2023 | 3 |
| [Trunk-Based Development](https://trunkbaseddevelopment.com/) | Paul Hammant | Continu | 3 |
| [Google SRE Book](https://sre.google/sre-book/table-of-contents/) | Beyer, Jones et al. | 2016 (evergreen) | 3 |
| [AWS Well-Architected DevOps Guidance — Automated Rollbacks](https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.2-implement-automatic-rollbacks-for-failed-deployments.html) | AWS | 2024 | 2 |
| [Harness — Blue-Green/Canary Deployments Explained](https://www.harness.io/blog/blue-green-canary-deployment-strategies) | Harness | 2024 | 2 |
| [LaunchDarkly — What Are Feature Flags?](https://launchdarkly.com/blog/what-are-feature-flags/) | LaunchDarkly | 2025 | 2 |
| [Unleash — Feature Flag Best Practices](https://docs.getunleash.io/topics/feature-flags/feature-flag-best-practices) | Unleash | 2025 | 2 |
| [semantic-release](https://semantic-release.gitbook.io/) | semantic-release team | 2025 | 2 |
| [HashiCorp Well-Architected — Zero Downtime Deployments](https://developer.hashicorp.com/well-architected-framework/define-and-automate-processes/deploy/zero-downtime-deployments) | HashiCorp | 2024 | 2 |
| rapport-discovery-cadrage.md | Source de vérité interne | 2026-05-02 | 3 |
| compass_artifact (cycle v3 complet) | Source de vérité interne | 2026-05-02 | 3 |
