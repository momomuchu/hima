# Cycle 04 — Build : Concepts et Critères

> **Version** : 1.0 — 2026-05-03
> **Statut** : Référence architecture — cycle Build de la Pipeline Fractale v4
> **Source de vérité** : `docs/cycles/04-build/concepts-criteria.md`
> **Standards** : ISO/IEC 25010:2023 · DORA 2024/25 · NIST SSDF SP 800-218 · OWASP SAMM v2 · Tidy First (Beck 2023)

---

## 1. Résumé exécutif

Le cycle Build est le quatrième des huit cycles de la Pipeline Fractale v4. Il transforme un plan validé issu de la Conception en incréments de code déployables, couverts par des tests automatisés, soumis aux quality gates CI, et enregistrés dans Git via des commits typés (S ou B, jamais mixtes).

Le Build n'est pas une phase de production libre. C'est une discipline contrainte : chaque incrément doit respecter la Definition of Done au niveau code, traverser les quality gates sans dérogation humaine non tracée, et être classé par classe de risque T/F/M/É/C avant toute décision sur la profondeur du processus.

**Trois invariants du cycle Build :**
1. Aucun code ne merge sans quality gates CI verts.
2. Chaque commit est S (Structural) OU B (Behavioral) — jamais les deux (Tidy First, Beck 2023).
3. Toute dérogation à un quality gate est tracée, temporelle, et approuvée explicitement.

**Résultat attendu en sortie du cycle :** incrément de code mergé sur la branche principale, quality gates verts, DoD code satisfaite, artefact versionnée prête pour le cycle Validation.

---

## 2. Position dans le pipeline

```
[01-Discovery] → [02-Cadrage] → [03-Conception] → [04-BUILD] → [05-Validation] → [06-Release] → [07-Run] → [08-Apprentissage]
                                        ↓                  ↑
                              Plan validé (DoR)    Incrément mergé (DoD code)
```

**Cycle précédent (03-Conception)** fournit :
- ADR signés, design doc finalisé
- Threat model STRIDE si É/C
- Plan de tests défini
- SLI/SLO documentés pour les nouveaux services
- Quality gates CI définis pour le changement

**Cycle suivant (05-Validation)** attend :
- Code mergé sur branche principale
- Quality gates CI verts (rapport CI exporté)
- Artefact buildé et versionné (SemVer + tag Git)
- SBOM généré (CycloneDX ou SPDX)
- Documentation à jour (README, ADR si nouvelle décision, changelog si user-facing)

**Relation avec les activités transverses :** sécurité shift-left, observabilité by design, tests automatisés, FinOps, accessibilité, i18n sont actifs pendant tout le Build — pas en post-Build.

---

## 3. Objectif du cycle

### 3.1 Objectif principal

Produire des incréments de code de qualité mesurable, livrables de façon autonome, qui satisfont la Definition of Done au niveau code et sont prêts pour la validation externe.

### 3.2 Objectifs spécifiques

| Objectif | Critère de succès | Mesure |
|---|---|---|
| Qualité du code | Complexité cognitive ≤ 15, lignes/fichier ≤ 300 | SonarQube / analyse statique |
| Couverture de tests | Cohérente avec le risk-based testing (zones critiques ≥ 80 %) | nyc / coverage.py |
| Sécurité shift-left | SAST + SCA + secrets scan verts en CI | Semgrep / OSV-Scanner / gitleaks |
| Discipline commits | 100 % des commits S ou B (jamais mixtes) | Convention Commits + hook pre-commit |
| Traçabilité | Chaque commit référence un PBI ou CHG | PR template + CI check |
| Observabilité | Logs structurés + métriques ajoutés au moment de l'écriture | OpenTelemetry |

### 3.3 Ce que le Build n'est PAS

- Pas une phase de refactoring libre (tout refactoring est un commit S, séparé des commits B)
- Pas une phase de Discovery (aucune nouvelle fonctionnalité non planifiée sans DoR)
- Pas une phase où les quality gates peuvent être contournés par urgence sans trace
- Pas une phase de livraison en production (c'est le rôle du cycle Release)

---

## 4. Entrées — Definition of Ready (DoR) pour entrer en Build

Un incrément peut entrer en Build ssi **toutes** les conditions suivantes sont satisfaites.

### 4.1 DoR stricte (bloquante)

- [ ] **Problème formulé** : story ou PBI avec critères d'acceptation en format Given-When-Then.
- [ ] **Classe de risque assignée** : T / F / M / É / C — proposée par l'auteur, validée par le cycle Conception.
- [ ] **Design doc existant** (si M+) : interfaces, contrats, schémas DB, modèles d'événements — lisible dans `docs/07-architecture/`.
- [ ] **ADR signés** pour toute décision d'architecture nouvelle.
- [ ] **Plan de tests défini** : unitaires, intégration, E2E si requis par classe de risque — documenté dans `docs/10-testing/`.
- [ ] **Quality gates CI configurés** pour ce changement : seuils de couverture, listes interdites, scans applicables.
- [ ] **Dépendances résolues** : aucune dépendance bloquante non planifiée.
- [ ] **Impacts privacy/accessibilité/i18n identifiés** : oui/non + détail dans le PBI.

### 4.2 DoR souhaitée (non bloquante, mais tracée si absente)

- [ ] Spike de faisabilité conclu (si technologie nouvelle).
- [ ] Threat model STRIDE produit (si É/C).
- [ ] AIPD en cours ou validée (si traitement de données personnelles sensibles).
- [ ] Estimation de coût FinOps documentée (si É/C).

### 4.3 Modulation par classe de risque

| Classe | DoR minimale | Design doc | Threat model | Plan tests |
|---|---|---|---|---|
| T | Critères d'acceptation | Non requis | Non requis | Tests existants couvrent |
| F | Critères d'acceptation + classe | Non requis | Non requis | Plan unitaires |
| M | Complet | Recommandé | Non requis | Plan unitaires + intégration |
| É | Complet + ADR | Obligatoire | Obligatoire | Plan complet |
| C | Complet + ADR + review Conception | Obligatoire | Obligatoire | Plan complet + contrats |

---

## 5. Sorties — Definition of Done (DoD) au niveau code

Un incrément est **Done** au niveau code quand **tous** les points suivants sont vrais sans exception.

### 5.1 DoD invariante (toutes classes de risque)

- [ ] **Code revu** : self-review différée ≥ 4h avec checklist explicite en mode solo ; peer review pour F+ avec deux reviewers pour É/C.
- [ ] **Tests automatisés écrits et passants** : cohérents avec le plan de tests défini en Conception.
- [ ] **Quality gates CI verts** : lint, type-check, SAST, SCA, secrets scan, tests, couverture.
- [ ] **Aucune CVE Critical/High non triée** dans les dépendances introduites.
- [ ] **Documentation à jour** : README si comportement change, ADR si nouvelle décision, changelog si user-facing.
- [ ] **Commits Tidy First** : chaque commit est S (refactoring pur) OU B (feature/fix/perf) — jamais mixte.
- [ ] **Commits Conventional** : `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `perf:`, `docs:`, `ci:`.
- [ ] **Observabilité** : logs structurés, métriques, traces ajoutés au moment de l'écriture (pas après).
- [ ] **Métriques de complexité respectées** : complexité cognitive ≤ 15 par fonction, lignes/fichier ≤ 300 (warn) / 500 (block), lignes/fonction ≤ 50 (warn) / 80 (block).

### 5.2 DoD additionnelle par classe de risque

| Condition | F | M | É | C |
|---|:---:|:---:|:---:|:---:|
| Tests d'intégration passants | ✅ | ✅ | ✅ | ✅ |
| Tests E2E sur parcours critique | — | ○ | ✅ | ✅ |
| WCAG 2.2 AA — axe-core vert | auto | auto | auto | auto + manuel |
| i18n : aucune chaîne hardcodée | ✅ | ✅ | ✅ | ✅ |
| Privacy : registre à jour si nouvelles données | ○ | ✅ | ✅ | ✅ |
| Impact FinOps documenté | ○ | ✅ | ✅ | ✅ |
| Feature flag actif | — | — | ✅ | ✅ |
| Plan de rollback testé | — | ✅ | ✅ (+ testé) | ✅ (+ répété) |
| SBOM généré (CycloneDX/SPDX) | ○ | ✅ | ✅ | ✅ |
| Signature artefact (Cosign/Sigstore) | — | — | ✅ | ✅ |
| SLSA provenance | — | — | ✅ | ✅ |

---

## 6. Concepts clés

### 6.1 Tidy First S/B — discipline des commits (Beck 2023)

Le principe central de Kent Beck dans *Tidy First?* (O'Reilly, 2023) : séparer les changements structurels et les changements comportementaux dans des commits distincts.

**Commit S (Structural)** : renommer, réordonner, extraire, déplacer — zéro changement de comportement observable. Type Git : `refactor:`. Durée maximale d'une session S : 1h sans B.

**Commit B (Behavioral)** : feature, fix, perf, test — change ce que le système fait. Type Git : `feat:`, `fix:`, `perf:`, `test:`.

**Règle absolue** : un commit ne peut pas être S et B simultanément. Si un refactoring est nécessaire pour implémenter une feature, l'ordre est :
1. Commit S — prépare le terrain (refactoring pur)
2. Commit B — implémente la feature sur le terrain préparé

**Exemple :**
```
refactor: extract validateEmail() from UserService
feat: add email validation on registration
```

**Anti-pattern** : `feat: add email validation + refactor UserService` → un seul commit mélangé, interdit.

**Bénéfice** : les commits S sont réversibles sans impact fonctionnel. Les commits B sont lisibles seuls. La revue de code est 3× plus rapide sur des commits atomiques.

### 6.2 Inner loop de développement

L'unité de travail en Build est l'**incrément quotidien** : un changement complet (S ou B), testé, qui intègre le trunk sans casser les gates.

```
Observer (contexte actuel)
  → Définir (scope de l'incrément)
    → Concevoir (design local — ≤ 30 min)
      → Exécuter (code + tests TDD/BDD)
        → Vérifier (quality gates CI)
          → Capitaliser (commit + documentation)
            → Transmettre (merge + notification)
```

Ce sous-cycle fractal (7 étapes) s'applique à chaque incrément, quelle que soit la classe de risque. La profondeur de chaque étape est modulée par T/F/M/É/C.

### 6.3 TDD et BDD — intégration dans le Build

**TDD (Test-Driven Development)** : écrire le test avant le code de production. Cycle RED → GREEN → REFACTOR.
- RED : le test échoue pour la bonne raison (fonction non encore implémentée).
- GREEN : code minimal pour faire passer le test.
- REFACTOR : commit S séparé pour améliorer la structure sans changer le comportement.

**BDD (Behavior-Driven Development)** : traduire les critères d'acceptation (Given-When-Then de la DoR) en tests exécutables. Lien direct entre la spécification et les tests d'intégration / E2E.

**Recommandation par contexte :**
- Backend à logique métier dense → TDD + pyramide de tests (beaucoup d'unitaires)
- Frontend / API orchestration → BDD + trophée (Kent C. Dodds : statique > unitaires < intégration > E2E)
- Microservices → honeycomb (Spotify : intégration dominante, peu d'unitaires bas niveau)

**Mode solo + IA :** l'agent IA joue le rôle du navigator en TDD pair programming — il rédige les tests à partir des critères d'acceptation, le développeur valide que les tests échouent pour la bonne raison avant de coder.

### 6.4 Pipeline CI — architecture des quality gates

Le pipeline CI est la frontière d'entrée vers le trunk. Aucun merge sans gates verts. Aucun override humain sans waiver tracé.

**Séquence des gates (ordre d'exécution recommandé pour le feedback rapide en premier) :**

```
Stage 1 — Rapide (< 2 min)
  lint + format + type-check + secrets scan

Stage 2 — Tests (< 10 min)
  tests unitaires + tests intégration + couverture

Stage 3 — Sécurité (< 5 min)
  SAST (Semgrep/CodeQL) + SCA (OSV-Scanner/Trivy) + IaC scan si touché

Stage 4 — Artefact (< 3 min)
  build + SBOM generation + container scan si image

Stage 5 — Accessibilité + performance (sur preview env)
  axe-core + Lighthouse CI + size-limit
```

**Principe d'échec rapide** : les gates les plus rapides passent en premier pour écourter le feedback loop. Un test unitaire qui échoue ne doit pas attendre 10 min de SAST pour le signaler.

### 6.5 Revue de code — critères et pratiques

**Solo avec IA :** self-review différée (≥ 4h) avec l'agent IA en reviewer antagoniste. Checklist explicite, lecture inversée (commencer par les tests, pas par le code de production).

**En équipe (F+) :** au moins un reviewer indépendant. Pour É/C : deux reviewers minimum.

**Checklist du reviewer :**
1. Correctness : le code fait-il ce qu'il prétend faire ?
2. Tests : les tests couvrent-ils les chemins critiques et les cas d'erreur ?
3. Sécurité : lecture STRIDE rapide sur les nouveaux flux de données.
4. Observabilité : logs, métriques, traces présents sur les chemins critiques ?
5. Accessibilité : HTML sémantique, pas de chaîne hardcodée, axe-core vert ?
6. Privacy : registre à jour si nouvelle donnée personnelle ?
7. Performance : pas de N+1, pas de regex catastrophique, pas de O(n²) évitable ?
8. FinOps : impact coût documenté si M+ ?
9. Lisibilité : complexité cognitive ≤ 15 par fonction ?
10. Tidy First : chaque commit est-il S ou B sans mélange ?

**Limite de taille de PR :** pas de PR > 400 lignes de diff (hors refactoring mécanique). Au-delà, la qualité de la revue chute fortement (source : rapport v3, §Phase 8).

### 6.6 Branching strategy — Trunk-Based Development

**Recommandation principale pour le mode solo + CI/CD continue :** Trunk-Based Development.

- Commits directs sur `main` (solo, changements T/F/M) ou branches éphémères < 24h (É/C).
- Feature flags pour les fonctionnalités É/C non terminées : déployer sans activer.
- Aucun long-lived branch (> 2 jours) sauf hotfix ou release branch.
- Hotfix : branche depuis le tag de release prod, correctif minimal, même pipeline CI, merge back vers `main`.

**Quand Git Flow est justifié :** produits versionnés à cycles longs (bibliothèques publiques, firmware, CLI maintenant plusieurs versions simultanées). Non adapté au mode solo + déploiement continu.

**Conventional Commits** obligatoires pour permettre le changelog automatique et l'incrémentation SemVer automatique (semantic-release, Release Please, Changesets).

### 6.7 Gestion des dépendances et supply chain

**SCA (Software Composition Analysis)** en CI sur chaque commit : scanner les dépendances directes et transitives pour CVE connues et licences incompatibles.

**SBOM (Software Bill of Materials)** généré à chaque build pour É/C, recommandé pour M. Format CycloneDX ou SPDX. Associé à l'artefact dans le registre.

**SLA de remédiation des CVE :**
- Critical : 24h
- High : 7 jours
- Medium : 30 jours
- Low : prochain cycle planifié

**Gestion du versionning des dépendances :**
- Dependabot ou Renovate bot pour les mises à jour automatiques.
- Lock files (`package-lock.json`, `yarn.lock`, `Cargo.lock`, `poetry.lock`) versionnés en Git.
- Pas de dépendance sans licence compatible explicite.

### 6.8 Métriques de qualité du code

| Métrique | Seuil warn | Seuil block | Outil |
|---|---|---|---|
| Complexité cognitive | > 10 | > 15 | SonarQube / Semgrep |
| Complexité cyclomatique | > 10 | > 20 | SonarQube |
| Lignes par fichier | > 300 | > 500 | lint / SonarQube |
| Lignes par fonction | > 50 | > 80 | lint / SonarQube |
| Couverture de tests (zones critiques) | < 80 % | < 60 % | nyc / coverage.py |
| Duplication de code | > 5 % | > 15 % | SonarQube / jscpd |
| Dépendances avec CVE High | > 0 | > 0 (unreviewed) | OSV-Scanner / Trivy |
| Secrets détectés | > 0 | > 0 | gitleaks / TruffleHog |

### 6.9 Dette technique — tracking et gestion

La dette technique n'est pas un problème à éliminer immédiatement, mais à rendre visible et délibéré.

**Catégories de dette en Build :**
- **Dette intentionnelle** (décision consciente, trade-off de vitesse) : tracée avec un tag `tech-debt` dans le backlog, estimation de remboursement, classe de risque.
- **Dette découverte** : identifiée pendant le Build, ajoutée immédiatement au registre `Planning/02-backlog/tech-debt/`.
- **Dette de qualité** : violations de quality gates temporairement waiverées (avec justification + date d'expiration du waiver).

**Règle de la Dette** : le total de dette non adressée ne doit pas dépasser 20 % de la capacité d'un cycle. Au-delà, le prochain cycle commence par du remboursement de dette avant toute nouvelle feature.

**Intégration dans la DoD :** toute dette créée intentionnellement pendant un incrément est capturée dans le backlog avant que l'incrément soit considéré Done.

---

## 7. Critères qualité selon ISO/IEC 25010:2023

La norme ISO/IEC 25010:2023 définit 9 caractéristiques de qualité produit. Le cycle Build est le moment où ces caractéristiques sont concrètement instanciées dans le code.

### 7.1 Maintenabilité (priorité maximale en Build)

La maintenabilité est la caractéristique la plus directement adressée par le Build.

| Sous-caractéristique | Critère de Build | Mesure |
|---|---|---|
| **Modularité** | Dépendances entre modules : couplage faible (Dependency Inversion Principle). Aucun cycle de dépendance. | Analyse statique des imports. |
| **Réutilisabilité** | Extraire toute logique réutilisée ≥ 3 fois (Rule of Three). Jamais < 3 fois (AHA — Avoid Hasty Abstractions). | Détection de duplication. |
| **Analysabilité** | Chaque fonction fait une seule chose. Nommage expressif (ubiquitous language du domaine). Pas de commentaires compensatoires (le code doit être auto-documenté). | Revue manuelle + complexité cognitive ≤ 15. |
| **Modifiabilité** | Commits S séparés des commits B (Tidy First). Aucune logique métier dans les controllers. | Inspection des commits. |
| **Testabilité** | Toute fonction métier est testable sans mock complexe. Injection de dépendance sur les frontières externes. | Couverture + facilité d'écriture des tests. |

### 7.2 Fiabilité

| Sous-caractéristique | Critère de Build |
|---|---|
| **Sans défauts** | Quality gates verts, mutation testing sur zones critiques (score > 70 %). |
| **Disponibilité** | Aucun code qui bloque le thread principal sans timeout. Toujours un timeout sur les appels externes. |
| **Tolérance aux pannes** | Gestion d'erreur explicite sur tous les appels externes (4xx non retryés, 5xx retryés max 3 fois avec backoff). |
| **Recoverabilité** | Feature flags activables/désactivables sans redéploiement pour É/C. Plan de rollback défini. |

### 7.3 Sécurité

| Sous-caractéristique | Critère de Build |
|---|---|
| **Confidentialité** | Aucune donnée personnelle en clair dans les logs. Pseudonymisation des PII en observabilité. |
| **Intégrité** | Validation des entrées côté serveur (pas seulement client). Paramétrage préparé (pas de concaténation SQL). |
| **Non-répudiation** | Actions sensibles journalisées avec user_id, timestamp, action. Logs append-only. |
| **Authenticité** | Signature des artefacts (Cosign/Sigstore) pour É/C. SBOM associé au build. |
| **Résistance** | Rate limiting implémenté sur les endpoints exposés. Pas d'information disclosure dans les messages d'erreur. |

### 7.4 Performance

| Sous-caractéristique | Critère de Build |
|---|---|
| **Comportement temporel** | Pas de N+1 (aucun appel DB/API dans une boucle). Timeout sur tous les appels externes. |
| **Utilisation des ressources** | Pas de fuite mémoire évidente (streams fermés, connexions relâchées). |
| **Capacité** | Queries DB avec index sur les colonnes filtrées. |

### 7.5 Capacité d'interaction (anciennement Usability)

| Sous-caractéristique | Critère de Build |
|---|---|
| **Accessibilité** | HTML sémantique, ARIA seulement si HTML ne suffit pas. axe-core vert en CI. Contraste ≥ 4.5:1. |
| **Protection contre les erreurs utilisateur** | Messages d'erreur explicites, pas de codes internes exposés. |

### 7.6 Sûreté (Safety — nouveau en ISO 25010:2023)

Applicable aux produits avec impact sur la sécurité des personnes (médical, transport, financier).

| Critère | Application en Build |
|---|---|
| **Contrainte opérationnelle** | Les limites du système sont codées (pas de décision automatique irréversible sans confirmation humaine). |
| **Fail safe** | Dégradation gracieuse : si un service tiers échoue, le système se replie sur un état sûr (pas une erreur 500 propagée). |
| **Avertissement de risque** | Toute action irréversible (suppression, envoi, paiement) demande confirmation explicite. |

---

## 8. Modulation par classe de risque

La profondeur du Build est déterminée par la classe de risque assignée en Conception. Cette section définit précisément ce qui change selon la classe.

### 8.1 Tableau de modulation Build

| Activité | T | F | M | É | C |
|---|:---:|:---:|:---:|:---:|:---:|
| TDD obligatoire | ◔ | ○ | ✅ | ✅ | ✅ |
| BDD sur critères d'acceptation | — | ◔ | ✅ | ✅ | ✅ |
| Tests unitaires | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests intégration | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests E2E parcours critique | — | — | ○ | ✅ | ✅ |
| Mutation testing zones critiques | — | — | ○ | ✅ | ✅ |
| Self-review solo (checklist) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Peer review | ◔ | ✅ | ✅ | ✅ (≥2) | ✅ (≥2) |
| Revue IA antagoniste | ◔ | ✅ | ✅ | ✅ | ✅ |
| SAST en CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| SCA en CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secrets scan en CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| IaC scan si touché | ✅ | ✅ | ✅ | ✅ | ✅ |
| Container scan si image | ✅ | ✅ | ✅ | ✅ | ✅ |
| SBOM généré | — | ○ | ✅ | ✅ | ✅ |
| Signature artefact Cosign | — | — | — | ✅ | ✅ |
| SLSA provenance | — | — | — | ✅ | ✅ |
| Feature flag obligatoire | — | — | — | ✅ | ✅ |
| Plan de rollback défini | implicite | ✅ | ✅ | ✅ (testé) | ✅ (répété) |
| Complexité cognitive ≤ 15 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documentation à jour | ✅ | ✅ | ✅ | ✅ | ✅ |
| Impact FinOps documenté | — | — | ✅ | ✅ | ✅ |
| Privacy : registre à jour | — | ○ | ✅ | ✅ | ✅ |
| WCAG 2.2 AA axe-core | auto | auto | auto | auto + manuel | auto + audit |
| Durée max de branche feature | — | < 4h | < 8h | < 24h | < 24h |

### 8.2 Règles de promotion de classe en cours de Build

Si, pendant le Build, le développeur ou l'IA identifie que la classe de risque réelle est plus élevée que la classe assignée :

1. **Pause immédiate** du Build sur cet incrément.
2. **Commit WIP** sur branche temporaire pour préserver l'état.
3. **Re-classification** : mise à jour du PBI avec la nouvelle classe et justification.
4. **Retour en Conception** si la nouvelle classe est É ou C (threat model, plan de tests, ADR peuvent être requis).
5. **Log de promotion** dans `Planning/08-risks/` : classe initiale, classe réelle, date, raison.
6. **Apprentissage** : la promotion alimente l'amélioration de la classification future (rétro de cycle).

**Seuil de déclenchement de promotion :**
- Touche auth, autorisation, paiement → É minimum
- Touche données de santé / biométrie / financières → C minimum
- Touche API publique ou schéma DB → É minimum
- Impact multi-services non anticipé → É minimum

---

## 9. Sous-cycle fractal du Build (7 étapes)

Chaque incrément de Build suit les 7 étapes du sous-cycle universel. La profondeur de chaque étape est modulée par la classe de risque.

### Étape 1 — Observer

**But :** comprendre le contexte exact avant de toucher au code.

Activités :
- Lire le PBI / ADR / design doc de l'incrément.
- Lancer les tests existants (ils doivent être verts avant de commencer).
- Inspecter le code existant autour de la zone à modifier.
- Identifier les dépendances et les effets de bord potentiels.

Livrable : compréhension validée, tests existants verts.

Durée : T/F = 5-15 min. M = 15-30 min. É/C = 30-60 min.

### Étape 2 — Définir

**But :** délimiter précisément ce que l'incrément va changer, et rien de plus.

Activités :
- Formuler l'intention de l'incrément en une phrase (quoi + pourquoi).
- Identifier si l'incrément est S ou B (Tidy First).
- Si B : identifier les commits S préalables nécessaires (refactorings pour préparer le terrain).
- Vérifier que l'incrément respecte la DoR.

Livrable : décision explicite S ou B. Liste des commits S préalables si nécessaire.

### Étape 3 — Concevoir

**But :** design local avant de coder.

Activités :
- TDD : écrire le test avant le code. Le test doit être RED pour la bonne raison.
- BDD : traduire les Given-When-Then en scénarios de test exécutables.
- Si É/C : vérifier que le design respecte le threat model et le plan de tests de la Conception.

Livrable : tests RED (si TDD), ou plan de test validé par l'IA.

Durée : T/F = 5-10 min. M = 15-30 min. É/C = 30-60 min.

### Étape 4 — Exécuter

**But :** implémenter l'incrément en code minimal pour rendre les tests verts.

Pratiques :
- Cycle TDD : RED → GREEN → (commit B minimal) → REFACTOR (commit S séparé).
- Branches éphémères (< 24h pour É/C, direct sur main pour T/F/M).
- Pré-commit hooks : lint, format, secrets scan, conventional commits validator.
- Logs/métriques/traces ajoutés au moment de l'écriture.
- Aucune logique métier dans les controllers/handlers.
- Money = Int (cents) — jamais float.
- Retry seulement 5xx/timeout (max 3, backoff exponentiel + jitter). Jamais retry 4xx.
- Timeout obligatoire sur tout appel externe.

### Étape 5 — Vérifier

**But :** confirmer que le code satisfait la DoD au niveau code avant merge.

Activités (dans l'ordre) :
1. Tests verts en local (unit + integration).
2. Quality gates CI verts (pipeline déclenché par push).
3. Self-review différée ou peer review selon la classe de risque.
4. Revue IA antagoniste (si solo) : l'agent liste les objections, le développeur répond à chacune.
5. Vérification de la DoD complète (checklist de PR).

Gate de sortie : tous les quality gates CI verts + DoD code satisfaite.

### Étape 6 — Capitaliser

**But :** enregistrer l'incrément de façon permanente et traçable.

Activités :
- Merge sur la branche principale (ou merge de la branche éphémère).
- Tag SemVer si incrément user-facing (MAJOR si breaking change, MINOR si nouvelle feature, PATCH si fix).
- Mise à jour du PBI : statut → Done.
- Mise à jour de la dette technique si créée intentionnellement.
- Documentation à jour (README, ADR, changelog).

### Étape 7 — Transmettre

**But :** notifier les cycles aval et préparer la transition vers la Validation.

Activités :
- Notification au cycle Validation : incrément mergé, quality gates verts, lien vers le rapport CI.
- Mise à jour du tableau de bord `Planning/00-dashboard/current-status.md`.
- Si dernier incrément du sprint : déclenchement de la clôture de sprint.
- Si anomalie détectée post-merge : ouverture immédiate d'un PBI de correction classé F minimum.

---

## 10. Activités transversales pendant le Build

Ces activités ne sont pas des étapes séquentielles. Elles sont actives en permanence pendant tout le Build.

### 10.1 Sécurité shift-left (NIST SSDF PW + OWASP SAMM Implementation)

**En continu :**
- SAST, SCA, secrets scan, IaC scan dans chaque run CI (pas seulement hebdo).
- Toute CVE Critical détectée bloque le merge immédiatement — pas d'exception.
- Threat model STRIDE : si une nouvelle surface d'attaque est identifiée pendant le Build (non anticipée en Conception), pause et re-Conception partielle.
- OWASP SAMM v2 Practice SB (Secure Build) :
  - Niveau 1 : build automatisé, dépendances déclarées, scan basique.
  - Niveau 2 : SAST intégré, SBOM généré, signature artefact.
  - Niveau 3 : SLSA niveau 2+, vérification de provenance, supply chain scanning.

**Solo + IA :** l'agent IA joue le rôle du security reviewer — il applique la checklist STRIDE rapide sur chaque PR avant merge.

### 10.2 Observabilité by design (OpenTelemetry)

Les logs, métriques, et traces sont écrits **au moment de l'implémentation**, pas après.

- **Logs structurés** : JSON, avec `trace_id`, `user_id` (pseudonymisé), `level`, `message`, `timestamp`.
- **Métriques** : RED (Rate, Errors, Duration) sur les endpoints publics. USE (Utilization, Saturation, Errors) sur les ressources.
- **Traces distribuées** : W3C Trace Context sur les appels inter-services.
- **Règle de qualité des logs** : aucune PII en clair dans les logs. Aucun log de niveau DEBUG en production sans circuit breaker sur le volume.

### 10.3 Accessibilité by design (WCAG 2.2 AA)

- HTML sémantique : `<button>` pas `<div onclick>`. `<label>` associé à chaque `<input>`.
- Contraste : ≥ 4.5:1 (texte normal), ≥ 3:1 (texte large, composants UI).
- axe-core en CI : vert obligatoire avant merge pour tout composant UI.
- Aucun nouveau composant sans alternative textuelle sur les éléments informatifs.
- Target size ≥ 24×24 px (WCAG 2.2 SC 2.5.8).

### 10.4 i18n by design

- Aucune chaîne hardcodée dans le code. Toutes les chaînes passent par la lib i18n.
- Formats régionaux (dates, nombres, devises) délégués aux libs CLDR.
- CSS logical properties (`margin-inline-start` au lieu de `margin-left`).
- Pseudo-localisation en CI pour détecter les chaînes oubliées.

### 10.5 FinOps en Build

- Toute dépendance introduite avec coût variable (API LLM, cloud, SaaS) est documentée avec son coût unitaire estimé.
- Pas d'appel LLM sans cap de tokens et sans logging du coût réel.
- Pas de régression de coût unitaire > 10 % sans justification de valeur.

### 10.6 Privacy by design

- Nouvelle donnée personnelle : mise à jour du registre de traitement avant merge.
- Données de test : jamais de données de production réelles en tests locaux ou CI.
- Pseudonymisation : les user_id dans les logs sont hashés (SHA-256 + salt rotatif).

---

## 11. Artefacts produits

Les artefacts suivants sont produits pendant et à la fin du cycle Build.

### 11.1 Artefacts code

| Artefact | Emplacement | Responsable | Quand |
|---|---|---|---|
| Code source versionnée | `git` — branche principale | Agent / Développeur | À chaque commit |
| Tests automatisés | Même repo, `tests/` | Agent / Développeur | Avec le code (TDD) |
| Commits typés S/B | `git log` | Agent / Développeur | Chaque incrément |
| Tag SemVer | `git tag` | CI (semantic-release) | Merge user-facing |
| SBOM (CycloneDX/SPDX) | Registre artefacts | CI | À chaque build M+ |
| Signature artefact | Registre artefacts | CI (Cosign) | Build É/C |

### 11.2 Artefacts qualité

| Artefact | Emplacement | Responsable | Quand |
|---|---|---|---|
| Rapport CI (quality gates) | CI system + `Planning/06-quality/` | CI | Chaque run |
| Rapport couverture | CI + `Planning/06-quality/` | CI | Chaque run |
| Checklist PR (DoD code) | PR description | Auteur | Avant merge |
| Rapport de revue IA | `.planning/<feature>/` | Agent IA | Avant merge M+ |
| Mise à jour registre dette | `Planning/02-backlog/tech-debt/` | Développeur | Si dette créée |

### 11.3 Artefacts documentation

| Artefact | Emplacement | Quand |
|---|---|---|
| README mis à jour | `README.md` | Si comportement change |
| ADR si nouvelle décision | `docs/13-decisions/ADR-NNN-*.md` | Si décision d'architecture |
| Changelog | `CHANGELOG.md` | Si changement user-facing |
| Mise à jour registre de traitement | `docs/09-security-compliance/` | Si nouvelle donnée personnelle |

---

## 12. Métriques et indicateurs

### 12.1 Métriques DORA pertinentes au Build (version 2024/25)

| Métrique | Définition | Cible top 15 % | Mesure en Build |
|---|---|---|---|
| **Change Lead Time** | Temps entre le premier commit et le merge | < 1 jour | Git timestamps |
| **Deployment Frequency** | Fréquence de merge sur la branche principale | À la demande | CI events |
| **Change Failure Rate** | % des incréments nécessitant un hotfix post-merge | < 5 % | Bug tracker |
| **Rework Rate** (nouveau 2024) | % du temps passé à refaire ce qui était considéré Done | Suivre la tendance | Git blame + estimation |

Note : la cinquième métrique DORA (Failed Deployment Recovery Time, anciennement MTTR) est gérée par le cycle Run, pas par le Build.

### 12.2 Métriques de qualité code

| Métrique | Cible | Fréquence de mesure |
|---|---|---|
| Complexité cognitive moyenne | < 10 | Par PR |
| % fonctions > complexité 15 | 0 % | Par PR |
| Couverture zones critiques | ≥ 80 % | Par PR |
| Score mutation testing | ≥ 70 % (zones critiques) | Par sprint |
| CVE Critical ouvertes | 0 | Continu |
| CVE High ouvertes > 7j | 0 | Continu |
| Duplication code | < 5 % | Par sprint |
| PR > 400 lignes diff | 0 | Par PR |
| Commits mixtes S+B | 0 | Par commit |

### 12.3 Métriques Tidy First

| Métrique | Mesure | Cible |
|---|---|---|
| % commits S purs | git log filter | > 30 % (signe de refactoring proactif) |
| % commits B purs | git log filter | > 60 % |
| % commits mixtes | git log filter | 0 % |
| Durée max session S sans B | Timestamps commits | < 1h |

### 12.4 Indicateurs d'alerte (RED FLAGS)

Ces indicateurs déclenchent une pause et une analyse avant de continuer :

- Change failure rate > 15 % sur 3 sprints consécutifs → geler les features, renforcer les tests.
- CVE Critical ouverte > 24h → escalade immédiate.
- Complexité cognitive > 15 sur > 5 % des fonctions → sprint de remboursement de dette.
- Couverture zones critiques < 60 % → retour en Conception pour plan de tests.
- Commits mixtes S+B > 5 % → formation / rappel de la discipline Tidy First.
- PR > 400 lignes sur > 20 % des merges → décomposition insuffisante des incréments.

---

## 13. Standards de référence

| Domaine | Standard | Applicabilité au Build | Source |
|---|---|---|---|
| Qualité produit | ISO/IEC 25010:2023 | Maintainability, Security, Reliability, Safety | iso.org |
| Tests | ISO/IEC/IEEE 29119 | Risk-based testing, plan de tests | iso.org |
| Sécurité cycle | NIST SSDF SP 800-218 v1.1 (v1.2 en draft) | PW Produce Well-Secured Software | csrc.nist.gov |
| Sécurité applicative | OWASP SAMM v2 — Implementation (Secure Build) | Pratique SB niveaux 1-3 | owaspsamm.org |
| Sécurité exigences | OWASP ASVS v5 | Référentiel d'exigences applicatives | owasp.org |
| Supply chain | SLSA + SBOM (CycloneDX, SPDX) | SLSA niveau 2 minimum pour É/C | slsa.dev |
| Performance livraison | DORA 2024/25 (5 métriques) | Change Lead Time, Frequency, CFR, Rework Rate | dora.dev |
| Design commits | Tidy First (Beck 2023) | S/B séparation — invariant absolu | O'Reilly 2023 |
| Versioning | SemVer 2.0 | MAJOR.MINOR.PATCH | semver.org |
| Commits | Conventional Commits 1.0 | `type(scope): description` | conventionalcommits.org |
| Branching | Trunk-Based Development | Direct sur main ou branches < 24h | trunkbaseddevelopment.com |
| Observabilité | OpenTelemetry | Logs, métriques, traces by design | opentelemetry.io |
| Accessibilité | WCAG 2.2 AA + EN 301 549 | axe-core en CI, tests manuels É/C | w3.org/TR/WCAG22 |
| Privacy | RGPD art. 25 + Privacy by Design | Pseudonymisation logs, registre traitement | eur-lex.europa.eu |
| Qualité metric | SonarQube Cognitive Complexity | Seuil 15 (default SonarQube) | docs.sonarsource.com |

---

## 14. Questions ouvertes — RED CARDS

Les questions suivantes sont ouvertes à la date de rédaction de ce document. Elles doivent être tranchées avant ou pendant les premiers cycles Build réels.

### RC-01 — Seuil de couverture par classe de risque

**Question :** quel seuil exact de couverture par classe de risque (T, F, M, É, C) ?

**Contexte :** le seuil de 80 % pour les zones critiques est issu de la pratique courante. Mais « zone critique » n'est pas encore définie mécaniquement. Un coverage 80 % uniforme est un anti-pattern (peut masquer des zones non couvertes importantes).

**Piste :** définir la couverture par *type de code* plutôt que par fichier global :
- Logique métier (domain/ layer) : ≥ 90 %
- Infrastructure / adapters : ≥ 70 %
- Configuration / scripts : pas de seuil

**Responsable :** développeur — à trancher au premier sprint Build.
**Bloquant :** non — valeur par défaut 80 % en attendant.

### RC-02 — Automatisation de la classification Tidy First

**Question :** comment détecter automatiquement les commits mixtes S+B en CI ?

**Contexte :** la discipline Tidy First repose actuellement sur l'auto-discipline du développeur. Aucun outil ne détecte automatiquement si un commit mélange refactoring et behavior change.

**Piste :** hook pre-commit qui force le développeur à déclarer le type (S ou B) + vérification par l'IA du code diff — si le diff contient des changements de tests ET des changements de logique non testés → alerte.

**Responsable :** développeur + IA.
**Bloquant :** non — honor system jusqu'à automatisation.

### RC-03 — Seuil de waiver de quality gate

**Question :** quel processus exact pour le waiver temporaire d'un quality gate ?

**Contexte :** le principe est qu'aucun humain ne peut override un quality gate sans trace. Mais le processus de waiver n'est pas encore formalisé (qui approuve, quelle durée maximale, quel format de trace).

**Format proposé :**
```
WAIVER-NNN
Gate : SAST — CVE-2025-XXXXX
Justification : dépendance transitive, aucun code path exploitable (analyse manuelle)
Durée : 7 jours (jusqu'au YYYY-MM-DD)
Approbateur : développeur (solo) | tech lead (équipe)
Action de remédiation : upgrade dépendance X vers v2.x planifié sprint N+1
```

**Responsable :** développeur — à formaliser en début de Build.
**Bloquant :** non.

### RC-04 — Mutation testing en CI

**Question :** intégrer Stryker (JS/TS) / PITest (Java) / mutmut (Python) en CI ou seulement en local ?

**Contexte :** le mutation testing est coûteux en temps (facteur 5-20× sur les tests). L'intégrer en CI sur chaque PR est prohibitif. L'intégrer uniquement localement ou en nightly build le rend optionnel en pratique.

**Piste :** run de mutation testing uniquement sur les zones critiques (dossiers `domain/`, `services/`) en nightly CI. Bloquer seulement si le score chute sous 70 % sur ces zones.

**Responsable :** développeur.
**Bloquant :** non — mutation testing recommandé mais non bloquant jusqu'à intégration CI nightly.

### RC-05 — AI self-review vs peer review

**Question :** la revue IA antagoniste est-elle équivalente à une peer review pour les classes F et M ?

**Contexte :** en mode solo, la peer review est remplacée par la self-review différée + revue IA. Le DORA 2024 Report note que les outils IA accélèrent les tâches bas niveau mais n'ont pas encore démontré d'impact significatif sur le change failure rate. La revue IA peut avoir des angles morts (biais d'entraînement sur les patterns communs).

**Tension :** utiliser le même modèle IA pour générer et reviewer le code est un angle mort reconnu (single-source-of-failure sur les biais).

**Piste :** pour les classes M+, utiliser deux passes IA avec des prompts antagonistes différents (un reviewer cherche les bugs fonctionnels, un reviewer cherche les vulnérabilités de sécurité). Pour É/C, exiger une revue humaine même en mode solo (délai de 24h, lecture fraîche).

**Responsable :** développeur.
**Bloquant :** non — procédure actuelle en attente de validation empirique.

### RC-06 — Intégration du protocole de promotion de classe dans le harness

**Question :** le harness (state management externe) doit-il bloquer automatiquement le Build quand une promotion de classe est détectée ?

**Contexte :** actuellement, la promotion est un protocole manuel. Le harness pourrait détecter certains déclencheurs automatiquement (ex : si le diff touche un fichier `auth/`, promotion automatique à É).

**Risque :** faux positifs sur les promotions automatiques qui bloquent inutilement le Build.

**Décision à prendre** : règles de promotion automatique vs liste de vérification manuelle.
**Responsable :** développeur — à trancher au premier cycle Build réel.
**Bloquant :** non.

---

## 15. Relations inter-cycles

### 15.1 Cycle 03-Conception → Cycle 04-Build

| Livrable de Conception | Utilisation en Build |
|---|---|
| ADR signés | Guide les choix d'implémentation. Non négociable. |
| Design doc | Plan de l'incrément. Référence pour la self-review. |
| Plan de tests | Base pour l'écriture TDD/BDD. Gate de DoD. |
| Threat model STRIDE | Checklist sécurité pour la revue de code. |
| Quality gates configurés | Seuils CI utilisés dans les pipelines. |
| SLI/SLO documentés | Base pour l'observabilité by design. |

### 15.2 Cycle 04-Build → Cycle 05-Validation

| Livrable de Build | Utilisation en Validation |
|---|---|
| Code mergé (quality gates verts) | Base de la validation produit. |
| Rapport CI | Preuve que la DoD code est satisfaite. |
| SBOM + artefact signé | Vérification de provenance avant déploiement staging. |
| Changelog / ADR mis à jour | Scope de la validation produit. |
| Feature flags configurés (É/C) | Activation progressive pendant la Validation. |

### 15.3 Cycle 04-Build → Cycle 08-Apprentissage (feedback direct)

Le Build alimente directement l'Apprentissage via :
- **Promotions de classe** : chaque promotion est une signal de classification initiale erronée → améliore le modèle de classification.
- **Waivers de quality gates** : chaque waiver est un signal d'insuffisance de processus → revue en rétro.
- **Commits mixtes S+B** : chaque violation de Tidy First → alerte dans la rétro.
- **Change failure rate** : si > 15 % sur 3 sprints → décision de pause feature.

### 15.4 Activités transverses — raccordements

| Activité transverse | Entrée en Build depuis | Sortie de Build vers |
|---|---|---|
| Sécurité shift-left | Threat model (Conception) | Vulnérabilités détectées → backlog (Validation) |
| Privacy | Registre de traitement (Cadrage) | Registre mis à jour (Run) |
| Accessibilité | Plan d'accessibilité (Conception) | Rapport axe-core (Validation) |
| FinOps | Budget feature (Cadrage) | Impact coût réel mesuré (Run) |
| Observabilité | SLO définis (Conception) | Instrumentation active (Run) |
| Dette technique | Backlog dette (Discovery/Cadrage) | Registre dette mis à jour (.planning/) |

---

## Annexe A — Checklist PR Build (à intégrer dans `.github/pull_request_template.md`)

```markdown
## Classe de risque
- [ ] T (Trivial)  - [ ] F (Faible)  - [ ] M (Moyen)  - [ ] É (Élevé)  - [ ] C (Critique)
Justification : ...

## Tidy First
- [ ] Ce commit est S (Structural — zéro changement de comportement)
  OU
- [ ] Ce commit est B (Behavioral — feature/fix/perf)
- [ ] JAMAIS les deux dans le même commit

## DoD code
- [ ] Tests automatisés écrits et passants (TDD : RED → GREEN confirmé)
- [ ] Quality gates CI verts : lint / type-check / tests / couverture / SAST / SCA / secrets
- [ ] Aucune CVE Critical/High non triée
- [ ] Complexité cognitive ≤ 15 sur chaque fonction modifiée
- [ ] Lignes/fichier ≤ 300 (warn) sur chaque fichier modifié
- [ ] Documentation à jour (README / ADR / changelog si applicable)
- [ ] Observabilité : logs structurés / métriques / traces sur chemins critiques
- [ ] Aucune chaîne hardcodée (i18n)
- [ ] WCAG 2.2 AA : axe-core vert sur tout composant UI touché
- [ ] Privacy : registre à jour si nouvelle donnée personnelle
- [ ] Impact FinOps documenté si M+
- [ ] Feature flag configuré si É/C
- [ ] Plan de rollback défini si M+
- [ ] SBOM généré si M+
- [ ] Conventional commit : type(scope): description

## Revue
- [ ] Self-review différée ≥ 4h avec checklist (solo)
  OU
- [ ] Peer review par (nom du reviewer)
- [ ] Revue IA antagoniste effectuée (objections listées + réponses)

## PBI / CHG référencé
Ref : PBI-NNN / CHG-NNN
```

---

## Annexe B — Configuration quality gates CI recommandée (GitHub Actions, exemple TypeScript)

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  stage-1-fast:
    name: "Stage 1 — Rapide"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint + Format
        run: pnpm lint && pnpm format:check
      - name: Type-check
        run: pnpm type-check
      - name: Secrets scan
        uses: gitleaks/gitleaks-action@v2

  stage-2-tests:
    name: "Stage 2 — Tests"
    needs: stage-1-fast
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Tests unitaires + intégration
        run: pnpm test --coverage
      - name: Vérification couverture zones critiques
        run: pnpm coverage:check  # seuil configuré dans package.json

  stage-3-security:
    name: "Stage 3 — Sécurité"
    needs: stage-1-fast
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: SAST (Semgrep)
        uses: semgrep/semgrep-action@v1
        with:
          config: auto
      - name: SCA (OSV-Scanner)
        uses: google/osv-scanner-action@v1
      - name: IaC scan (Checkov)
        uses: bridgecrewio/checkov-action@v12
        if: contains(github.event.head_commit.modified, 'infra/')

  stage-4-artifact:
    name: "Stage 4 — Artefact"
    needs: [stage-2-tests, stage-3-security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: pnpm build
      - name: Générer SBOM (CycloneDX)
        uses: CycloneDX/gh-node-module-generatebom@v1
      - name: Container scan (si Dockerfile présent)
        if: hashFiles('Dockerfile') != ''
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: image
          severity: HIGH,CRITICAL
          exit-code: 1
```

---

*Document produit par le deep-researcher pour le Cycle 04 — Build de la Pipeline Fractale v4.*
*Sources primaires : rapport-discovery-cadrage.md (SOURCE OF TRUTH) · compass v3 · r1.md · folder.md · ISO 25010:2023 · DORA 2024/25 · NIST SSDF SP 800-218 · OWASP SAMM v2 · Tidy First (Beck 2023) · Trunk-Based Development.*
