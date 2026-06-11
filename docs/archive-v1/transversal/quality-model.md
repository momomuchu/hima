# Modèle Qualité — Document Transversal
> Pipeline Fractale v4 — Référence qualité universelle pour les 8 cycles
> Statut : RÉFÉRENCE STABILISÉE
> Date : 2026-05-03
> Version : 1.0

---

## Sommaire

1. Résumé exécutif
2. Portée transversale
3. Objectif
4. Entrées (exigences qualité de chaque cycle)
5. Sorties (rapports qualité, résultats fitness functions)
6. Concepts clés — ISO/IEC 25010:2023 complet (9 dimensions + sous-caractéristiques)
7. Critères qualité (méta : qualité de la mesure qualité)
8. Modulation par classe de risque
9. Application fractale par cycle
10. Activités transversales
11. Artefacts produits
12. Métriques et indicateurs — catalogue complet
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations avec chaque cycle

---

## 1. Résumé exécutif

Le modèle qualité est la **colonne vertébrale transversale** de la Pipeline Fractale v4. Il ne s'applique pas à une phase : il imprègne les 8 cycles, les 7 sous-étapes de chaque cycle, et les 3 modes opératoires.

Fondation normative : **ISO/IEC 25010:2023** (9 dimensions produit) + **ISO/IEC 25019:2023** (qualité en usage) + **DORA 2024/2025** (5 métriques de livraison) + **Building Evolutionary Architectures** (fitness functions automatisées).

Trois décisions structurantes de ce modèle :

1. **La qualité est mesurable ou elle n'existe pas.** Toute exigence qualité sans métrique associée est une opinion, pas un contrat.
2. **La profondeur qualité se module par classe de risque T/L/M/H/C**, pas par dogme. Appliquer ISO 25010 intégralement à un changement trivial est un anti-pattern aussi grave qu'ignorer la qualité sur un changement critique.
3. **Les fitness functions automatisent la gouvernance qualité.** Ce qui peut être vérifié par la machine doit l'être. Le jugement humain est réservé au risque, à l'ambiguïté et aux décisions stratégiques.

Résultat attendu : un système de développement solo + IA où la qualité n'est pas un audit de fin de cycle mais une propriété continue, mesurable, et auto-régulée.

---

## 2. Portée transversale

Ce document s'applique à **tous les cycles** de la pipeline :

| Cycle | Rôle dans le modèle qualité |
|-------|----------------------------|
| discovery | Définit les exigences qualité métier (quelles dimensions ISO 25010 prioritaires pour ce projet) |
| cadrage | Formalise le quality model instance + les seuils + la DoR/DoD qualité |
| conception | Traduit les exigences qualité en contraintes d'architecture (fitness functions à créer) |
| build | Exécute les contrôles qualité continus (CI gates, fitness functions, tests) |
| validation | Vérifie que les critères qualité sont atteints sur le produit réel |
| release | Quality gate de sortie obligatoire avant promotion en production |
| run | Surveille la qualité en production (SLO, observabilité, dégradation continue) |
| learning | Capitalise sur les écarts qualité pour améliorer le modèle (postmortem, rétrospective) |

Ce document ne remplace pas les documents de cycle. Il est leur **référence qualité commune**. Chaque cycle y fait référence, ne le duplique pas.

Territoire de fichiers :
- **Définition** : `docs/transversal/quality-model.md` (ce fichier)
- **Instance projet** : `docs/08-quality/quality-model-instance.md` (par projet)
- **Exécution** : `.planning/06-quality/` (résultats mesurés par sprint/cycle)
- **Métriques** : `.planning/07-metrics/quality-metrics.md` (append-only)

---

## 3. Objectif

Le modèle qualité poursuit **cinq objectifs** :

**O1 — Référence commune** : fournir un langage qualité partagé entre le développeur et l'agent IA, ancré sur des standards ouverts (pas des opinions).

**O2 — Prévention plutôt que détection** : déplacer les contrôles qualité vers l'amont (shift-left). Chaque dimension ISO 25010 doit avoir des vérifications actives dès `conception`, pas seulement en `validation`.

**O3 — Adaptabilité par risque** : modeler la profondeur qualité sur la classe de risque T/L/M/H/C. Ni sur-ingénierie sur les changements triviaux, ni sous-protection sur les changements critiques.

**O4 — Automatisation prioritaire** : tout contrôle qualité automatisable doit être automatisé dans le pipeline CI/CD sous forme de fitness function ou contrôle qualité automatisé. Le coût de vérification manuelle répétée est éliminé.

**O5 — Amélioration continue** : le modèle lui-même est une cible d'amélioration. Chaque cycle `learning` peut proposer des ajustements aux seuils, aux dimensions prioritaires, ou aux fitness functions.

---

## 4. Entrées (exigences qualité de chaque cycle)

### 4.1 Ce que chaque cycle fournit au modèle qualité

| Cycle | Entrée fournie |
|-------|---------------|
| discovery | Contexte métier, profil utilisateur, secteur (détermine quelles dimensions ISO 25010 sont critiques), contraintes réglementaires initiales |
| cadrage | Exigences qualité formalisées (seuils cibles par dimension), classe de risque globale du projet, DoR/DoD qualité initiale, budget qualité |
| conception | Contraintes architecturales qualité (ex : latence cible, disponibilité SLO), liste des fitness functions à implémenter, threat model (sécurité), AIPD si applicable |
| build | Résultats des contrôles CI (SAST, SCA, coverage, lint, type-check), feedback continu des fitness functions, métriques de qualité de code |
| validation | Résultats des tests risk-based (fonctionnel, sécurité, performance, accessibilité, i18n), validation produit sur critères d'acceptation |
| release | Quality gate de release (synthèse de tous les contrôles), go/no-go basé sur les seuils définis en `cadrage` |
| run | Métriques de qualité en production (SLO réels, error rate, latence p99, incidents), signaux de dégradation continue |
| learning | Écarts qualité identifiés (pourquoi les seuils ont été manqués ou pourquoi ils étaient trop stricts), amélioration des fitness functions |

### 4.2 Format d'exigence qualité standard

Chaque exigence qualité formalisée en Cadrage doit respecter ce format :

```yaml
# Exigence qualité — format standard
id: QR-001
dimension: reliability          # Dimension ISO 25010:2023
sous_caracteristique: availability
enonce: "Le service principal doit être disponible 99.5% du temps (mensuel)"
seuil_bloquant: 99.0%           # En-dessous = bloquant
seuil_cible: 99.5%              # Cible nominale
seuil_aspirationnel: 99.9%      # Si ressources disponibles
mesure: "uptime mensuel calculé depuis les SLO Prometheus"
fitness_function: "slo-availability-check"
classe_risque_min: M            # Applicable à partir de cette classe
cycle_verification: [Build, Run]
owner: "@dev"
```

---

## 5. Sorties (rapports qualité, résultats fitness functions)

### 5.1 Artefacts produits par le modèle qualité

| Artefact | Format | Emplacement | Fréquence |
|----------|--------|-------------|-----------|
| Quality Gate Report | Markdown + JSON | `.planning/06-quality/quality-gates-results.md` | Par PR / déploiement |
| Fitness Function Dashboard | JSONL append-only | `.planning/07-metrics/quality-metrics.jsonl` | Par run CI |
| Quality Model Instance | Markdown | `docs/08-quality/quality-model-instance.md` | Par projet (mis à jour si seuils changent) |
| Sprint Quality Execution | Markdown | `.planning/03-sprints/SPRINT-NNN/02-quality-execution.md` | Par sprint |
| Quality Debt Register | Markdown | `.planning/06-quality/quality-debt-register.md` | Mis à jour si dette créée / remboursée |
| Release Quality Gate | Markdown | `.planning/04-releases/REL-NNN/release-readiness.md` | Par release |
| Production Quality Report | Markdown | `.planning/07-metrics/stability-metrics.md` | Mensuel |
| Defect Escape Analysis | Markdown | `.planning/06-quality/defect-escape-analysis.md` | Après chaque incident |

### 5.2 Rapport Quality Gate — structure minimale

```markdown
## Quality Gate — PR-NNN / REL-NNN
Date: YYYY-MM-DD
Classe de risque: M

| Dimension ISO 25010 | Fitness Function | Seuil | Résultat | Statut |
|---------------------|-----------------|-------|----------|--------|
| Performance Efficiency | response-time-p99 | < 200ms | 145ms | PASS |
| Reliability | slo-availability | > 99.5% | 99.7% | PASS |
| Security | sast-critical | 0 critical | 0 | PASS |
| Security | sca-cve | 0 High non triée | 0 | PASS |
| Maintainability | cyclomatic-complexity | ≤ 15 | 12 | PASS |
| Functional Suitability | test-coverage-critical | ≥ 80% | 84% | PASS |

Verdict: GO
Waivers: aucun
```

---

## 6. Concepts clés — ISO/IEC 25010:2023 complet

### 6.1 Vue d'ensemble du modèle

ISO/IEC 25010:2023 (révision de novembre 2023) définit **9 caractéristiques** de qualité produit, chacune décomposée en sous-caractéristiques mesurables. Par rapport à la version 2011 :
- **Safety** : nouvelle caractéristique (5 sous-caractéristiques)
- **Usability** renommé **Interaction Capability** + 3 nouvelles sous-caractéristiques (inclusivity, self-descriptiveness, user engagement)
- **Portability** renommé **Flexibility** + scalability ajoutée
- **Security** : resistance ajoutée comme sous-caractéristique
- **Reliability** : maturity renommé faultlessness

Complément : **ISO/IEC 25019:2023** couvre la **qualité en usage** (Quality-in-Use) — ce que l'utilisateur perçoit effectivement en contexte réel : effectiveness, efficiency, satisfaction, freedom from risk, context coverage. À utiliser pour les dimensions centrées utilisateur (Interaction Capability, Reliability côté perception).

---

### 6.2 Dimension 1 — Adéquation Fonctionnelle (Functional Suitability)

> Degré auquel le produit fournit des fonctions couvrant les besoins explicites et implicites des utilisateurs dans des conditions spécifiées.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Complétude fonctionnelle** (Functional Completeness) | Degré auquel l'ensemble des fonctions couvre toutes les tâches spécifiées et les objectifs des utilisateurs | % user stories avec critères d'acceptation PASS |
| **Exactitude fonctionnelle** (Functional Correctness) | Degré auquel le produit fournit des résultats exacts pour les utilisateurs ciblés | Taux d'erreur sur les calculs critiques ; mutation score ≥ 70% sur la logique métier |
| **Adéquation fonctionnelle** (Functional Appropriateness) | Degré auquel les fonctions facilitent l'accomplissement des tâches et objectifs spécifiés | Score de task completion en tests utilisateur ; coverage sur les parcours critiques |

**Fitness functions associées :**
- `test-coverage-critical` : couverture ≥ 80% sur les chemins critiques (pas sur la totalité du code)
- `mutation-score-domain` : mutation score ≥ 70% sur la logique métier (Stryker/PIT)
- `acceptance-criteria-pass` : 100% des critères d'acceptation verts avant release

**Mapping cycles prioritaires :** Cadrage (définition), Build (verification), Validation (acceptance)

---

### 6.3 Dimension 2 — Efficacité de Performance (Performance Efficiency)

> Performance relative aux ressources utilisées dans les conditions spécifiées.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Comportement temporel** (Time Behaviour) | Degré auquel les temps de réponse et de débit répondent aux exigences | Latence p50/p95/p99 par endpoint ; throughput (req/s) |
| **Utilisation des ressources** (Resource Utilization) | Degré auquel les ressources utilisées répondent aux exigences | CPU %, mémoire %, I/O, tokens LLM consommés |
| **Capacité** (Capacity) | Degré auquel les limites maximales répondent aux exigences | Charge maximale supportée avant dégradation ; concurrent users |

**Fitness functions associées :**
- `response-time-p99` : latence p99 < seuil défini (ex: 200ms API, 3s page web)
- `bundle-size-limit` : taille bundle JS ≤ seuil (size-limit)
- `load-test-slo` : tests de charge k6 — pas de dégradation > 10% sous charge nominale
- `resource-regression` : pas de régression > 10% sur CPU/mémoire entre builds
- `llm-cost-cap` : coût LLM par requête ≤ seuil FinOps défini

**Mapping cycles prioritaires :** Conception (budgets), Build (surveillance), Validation (tests charge H/C), Run (monitoring continu)

---

### 6.4 Dimension 3 — Compatibilité (Compatibility)

> Degré auquel le produit peut échanger des informations et/ou fonctionner dans un environnement partagé.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Coexistence** (Co-existence) | Degré auquel le produit peut fonctionner efficacement en partageant un environnement commun sans impact négatif | Absence de conflits de dépendances ; isolation des ressources partagées |
| **Interopérabilité** (Interoperability) | Degré auquel le système peut échanger et utiliser mutuellement des informations avec d'autres systèmes | Tests de contrat (Pact/OpenAPI) verts ; conformité aux standards d'API |

**Fitness functions associées :**
- `contract-tests` : tests Pact / OpenAPI contract verts à chaque PR
- `dependency-conflict` : absence de conflits de version détectés (SCA)
- `api-breaking-change` : détection de breaking changes non annoncés (openapi-diff, spectral)

**Mapping cycles prioritaires :** Conception (interfaces), Build (tests contrat), Release (validation interop)

---

### 6.5 Dimension 4 — Capacité d'Interaction (Interaction Capability)

> Degré auquel le produit peut être utilisé par des utilisateurs spécifiés pour atteindre des objectifs spécifiés avec efficacité, efficience et satisfaction dans un contexte d'usage spécifié.

Anciennement *Usability* (2011). Enrichie de 3 nouvelles sous-caractéristiques en 2023.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Reconnaissance d'adéquation** (Appropriateness Recognizability) | Capacité pour l'utilisateur à identifier si le produit répond à ses besoins | Score de première impression en tests utilisateur |
| **Facilité d'apprentissage** (Learnability) | Degré auquel les fonctions peuvent être apprises dans un temps spécifié | Temps d'onboarding ; taux d'erreur première utilisation |
| **Opérabilité** (Operability) | Degré auquel le produit est facile à opérer et contrôler | Nombre d'étapes pour accomplir les tâches critiques |
| **Protection contre les erreurs utilisateur** (User Error Protection) | Degré auquel le système prévient les erreurs d'opération | Taux d'erreurs utilisateur récupérables ; validation UX |
| **Engagement utilisateur** (User Engagement) | Degré auquel l'interface présente les fonctions de façon motivante | Rétention, temps dans l'app, NPS |
| **Inclusivité** (Inclusivity) | Degré auquel le produit peut être utilisé par des personnes de divers profils (âge, capacités, cultures, langues) | Score WCAG 2.2 AA ; couverture axe-core ; tests avec utilisateurs en situation de handicap |
| **Assistance utilisateur** (User Assistance) | Capacité à supporter les caractéristiques diverses des utilisateurs pour atteindre leurs objectifs | Disponibilité et qualité de l'aide contextuelle |
| **Auto-descriptivité** (Self-descriptiveness) | Degré auquel le produit présente les informations appropriées pour rendre ses capacités immédiatement évidentes | Tests de discoverability ; taux de consultation de la doc |

**Fitness functions associées :**
- `axe-core-violations` : 0 violation A/AA sur les pages critiques (axe-core en CI)
- `wcag-auto-coverage` : Lighthouse accessibility score ≥ 90 sur parcours critiques
- `i18n-no-hardcoded-strings` : 0 chaîne hardcodée (détection via pseudo-localisation en CI)
- `keyboard-navigation-test` : tests de navigation clavier sur parcours critiques (Playwright)

**Mapping cycles prioritaires :** Conception (design accessible), Build (axe-core CI), Validation (tests manuels WCAG H/C), Run (monitoring NPS)

---

### 6.6 Dimension 5 — Fiabilité (Reliability)

> Degré auquel un système, produit ou composant réalise des fonctions spécifiées dans des conditions spécifiées pour une période de temps spécifiée.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Absence de défauts** (Faultlessness) | Degré auquel un système fonctionne sans défaut en opération normale | Taux d'erreur en production ; change failure rate DORA |
| **Disponibilité** (Availability) | Degré auquel le système est opérationnel et accessible quand requis | Uptime % (SLO) ; MTTA (Mean Time To Acknowledge) |
| **Tolérance aux pannes** (Fault Tolerance) | Degré auquel le système fonctionne comme prévu malgré des pannes matérielles ou logicielles | Résultats des chaos engineering tests ; fallback behavior |
| **Récupérabilité** (Recoverability) | Degré auquel le produit peut récupérer les données directement affectées et rétablir l'état souhaité après une interruption | FDRT (Failed Deployment Recovery Time) DORA ; RTO/RPO testés |

**Fitness functions associées :**
- `slo-availability` : disponibilité ≥ seuil SLO défini (Prometheus/Datadog)
- `error-rate-threshold` : error rate production ≤ seuil (ex: < 0.1% sur endpoints critiques)
- `chaos-engineering` : tests de résilience automatisés (Chaos Monkey / Toxiproxy) pour H/C
- `rto-rpo-test` : test de restauration trimestriel avec mesure du temps réel (obligatoire H/C)
- `flaky-test-detector` : 0 test flaky non résolu dans la suite principale

**Mapping cycles prioritaires :** `conception` (SLO définis), `build` (tests résilience), `release` (smoke tests), `run` (monitoring SLO), `learning` (postmortem si incident)

---

### 6.7 Dimension 6 — Sécurité (Security)

> Degré auquel le produit ou système protège les informations et données de façon à ce que les personnes ou systèmes aient un niveau d'accès approprié à leurs types et niveaux d'autorisation.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Confidentialité** (Confidentiality) | Les données ne sont accessibles qu'aux personnes autorisées | Tests d'authz ; absence de data leaks en DAST |
| **Intégrité** (Integrity) | Prévention des accès ou modifications non autorisés | Tests de tampering ; contrôles d'intégrité en production |
| **Non-répudiation** (Non-repudiation) | Les actions/événements peuvent être prouvés comme s'étant produits | Logs d'audit immuables ; chaîne de traçabilité |
| **Imputabilité** (Accountability) | Traçabilité des actions non autorisées vers leur origine | Journalisation complète ; gestion des sessions |
| **Authenticité** (Authenticity) | Vérification de l'identité d'un sujet ou d'une ressource | Tests d'authn ; MFA présent pour rôles sensibles |
| **Résistance** (Resistance) | Degré auquel le produit résiste à des attaques connues — **nouvelle en 2023** | Score OWASP ASVS ; résultats DAST ; SBOM propre |

**Fitness functions associées :**
- `sast-critical` : 0 finding Critical/High non trié (Semgrep, CodeQL)
- `sca-cve` : 0 CVE Critical/High non trié dans les dépendances (OSV-Scanner, Trivy)
- `secrets-scan` : 0 secret détecté dans le code (gitleaks, TruffleHog)
- `iac-scan` : 0 finding Critical/High sur IaC (tfsec, Checkov) si IaC touché
- `container-scan` : 0 CVE Critical/High dans les images (Trivy, Grype)
- `sbom-generated` : SBOM CycloneDX/SPDX généré et archivé à chaque build H/C
- `dast-scan` : 0 finding High en DAST sur preprod (OWASP ZAP) pour H/C
- `authz-boundary-test` : tests d'autorisation — aucun accès hors périmètre possible

**SLA de remédiation :**
- Critical : 24h
- High : 7 jours
- Medium : 30 jours
- Low : best-effort

**Mapping cycles prioritaires :** Cadrage (threat model initial), Conception (STRIDE, AIPD), Build (SAST/SCA continu), Validation (DAST), Release (SBOM), Run (surveillance CVE)

---

### 6.8 Dimension 7 — Maintenabilité (Maintainability)

> Degré d'efficacité et d'efficience avec lesquels un produit ou système peut être modifié pour l'améliorer, le corriger ou l'adapter.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Modularité** (Modularity) | Degré auquel le système est composé de composants discrets pouvant être modifiés avec un impact minimal sur les autres | Couplage afférent/efférent ; absence de dépendances circulaires |
| **Réutilisabilité** (Reusability) | Potentiel des actifs à être utilisés dans plusieurs systèmes | % de code partagé vs. dupliqué |
| **Analysabilité** (Analysability) | Efficacité d'évaluation des impacts des changements planifiés | Temps moyen pour localiser un bug ; complexité cognitive |
| **Modifiabilité** (Modifiability) | Facilité de modification sans dégradation de la qualité | Complexité cyclomatique ≤ 15 ; lignes/fonction ≤ 80 |
| **Testabilité** (Testability) | Efficacité d'établissement des critères de test et de leur exécution | Test coverage sur zones critiques ; time-to-test-run |

**Fitness functions associées :**
- `cyclomatic-complexity` : complexité cyclomatique ≤ 15 par fonction (sonar, ruff)
- `lines-per-function` : lignes/fonction ≤ 80 bloquant (warn à 50)
- `lines-per-file` : lignes/fichier ≤ 500 bloquant (warn à 300)
- `circular-dependencies` : 0 dépendance circulaire entre modules (ArchUnit, dependency-cruiser)
- `duplication-rate` : duplication < 3% (sonar) — Rule of Three
- `cognitive-complexity` : complexité cognitive ≤ 15 (Sonar cognitive complexity)
- `dead-code` : 0 code mort non justifié (ts-prune, knip)

**Mapping cycles prioritaires :** `conception` (architecture), `build` (continu), `learning` (remboursement dette)

---

### 6.9 Dimension 8 — Flexibilité (Flexibility)

> Degré d'efficacité et d'efficience avec lesquels un produit ou système peut être adapté pour des hardware, software ou autres environnements opérationnels ou d'utilisation.

Anciennement *Portability* (2011). Scalability ajoutée en 2023.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Adaptabilité** (Adaptability) | Degré auquel le produit peut être adapté à différents environnements, hardware/software | Tests multi-environnements ; configuration sans code |
| **Scalabilité** (Scalability) | Degré auquel le produit peut être mis à l'échelle pour gérer des charges variables — **nouvelle en 2023** | Auto-scaling tests ; performance sous charge 2x/5x/10x nominale |
| **Installabilité** (Installability) | Degré auquel le produit peut être installé dans un environnement spécifié | Tests d'installation fresh ; temps de cold start |
| **Remplaçabilité** (Replaceability) | Degré auquel le produit peut être remplacé par un autre | Interfaces abstraites ; couplage avec dépendances externes |

**Fitness functions associées :**
- `environment-parity` : configuration 100% externalisée (pas de valeur hardcodée par env)
- `scalability-test` : pas de dégradation non-linéaire sous charge 2x nominale (obligatoire H/C)
- `cold-start-time` : temps de démarrage ≤ seuil défini

**Mapping cycles prioritaires :** Conception (architecture scalable), Build (config externalisée), Validation (tests scalabilité H/C)

---

### 6.10 Dimension 9 — Sûreté (Safety)

> Capacité du produit à ne pas mettre en danger la santé humaine, les biens ou l'environnement.

**Nouvelle caractéristique en 2023.** Applicable systématiquement pour les projets avec données de santé, décisions automatisées affectant des personnes, systèmes embarqués, ou tout système où une défaillance logicielle peut causer un préjudice réel.

| Sous-caractéristique | Définition | Mesure principale |
|---------------------|-----------|-------------------|
| **Contrainte opérationnelle** (Operational Constraint) | En situation dangereuse, le produit opère avec des paramètres et des états sûrs | Tests de mode dégradé ; limits enforcement |
| **Identification des risques** (Risk Identification) | Le produit identifie une séquence d'événements avec danger potentiel | Alertes proactives présentes ; risk detection coverage |
| **Sécurité passive** (Fail Safe) | En cas de défaillance, le produit se place dans un état sûr | Tests de fail-safe ; behavior en cas de corruption de données |
| **Avertissement de danger** (Hazard Warning) | Le produit avertit des dangers potentiels dans les délais requis | Temps de détection et notification d'anomalie |
| **Intégration sûre** (Safe Integration) | Le produit s'intègre de façon sûre avec d'autres systèmes | Tests d'intégration avec mode dégradé des systèmes tiers |

**Fitness functions associées :**
- `fail-safe-behavior` : tests de comportement en cas de défaillance (obligatoire C, recommandé H)
- `hazard-detection-latency` : temps de détection d'anomalie ≤ seuil défini
- `safe-defaults` : configuration par défaut la plus restrictive possible

**Mapping cycles prioritaires :** Cadrage (classification comme applicable ou N/A), Conception (FMEA si critique), Build (tests fail-safe), Validation (tests edge cases dangereux)

---

### 6.11 ISO/IEC 25019 — Qualité en usage (Quality-in-Use)

Complément essentiel à ISO 25010. Mesure la qualité **perçue par l'utilisateur** dans son contexte réel d'usage.

| Caractéristique | Sous-caractéristiques | Application pipeline |
|----------------|----------------------|---------------------|
| **Effectiveness** | Task completion | Tests utilisateur ; taux de complétion des parcours critiques |
| **Efficiency** | Task time, Resource usage by user | Temps de complétion ; effort cognitif |
| **Satisfaction** | Usefulness, Trust, Pleasure, Comfort | NPS ; enquêtes satisfaction |
| **Freedom from Risk** | Economic risk mitigation, Health and safety risk mitigation, Environmental risk mitigation | Privacy impact ; safety assessment |
| **Context Coverage** | Context completeness, Flexibility | Tests sur devices cibles ; contextes d'usage réels |

Usage dans la pipeline : prioritaire dans les cycles `discovery` (définition des critères), `validation` (mesure réelle), et `learning` (feedback utilisateur).

---

## 7. Critères qualité (méta : qualité de la mesure qualité)

Un modèle qualité est lui-même soumis à des critères de qualité. Les contrôles qualité de ce modèle sont :

### 7.1 Critères de validité des fitness functions

Une fitness function est valide si et seulement si :
- [ ] Elle est **automatisable** (ou justifiée comme manuelle avec fréquence définie)
- [ ] Elle a un **seuil numérique explicite** (pas "doit être bon")
- [ ] Elle est **reproductible** (même résultat sur le même code)
- [ ] Elle **échoue** sur un code qui viole le critère (test du test)
- [ ] Elle est **assignée** à une dimension ISO 25010 et une sous-caractéristique
- [ ] Elle a un **owner** responsable de son maintien
- [ ] Elle n'est **pas gamifiable** sans détruire sa valeur (ex: augmenter coverage via tests vides)

### 7.2 Critères de validité d'une exigence qualité

Une exigence qualité est valide si :
- [ ] Elle est **mesurable** — pas "rapide", mais "latence p99 < 200ms"
- [ ] Elle est **testable** — il existe un test ou une mesure qui peut la vérifier
- [ ] Elle est **tracée** vers une dimension ISO 25010
- [ ] Elle a un **seuil bloquant** (en dessous duquel le livrable est rejeté) et un **seuil cible**
- [ ] Elle est **proportionnée** à la classe de risque du changement
- [ ] Elle est **révisable** — les seuils peuvent changer si le contexte change (avec justification)

### 7.3 Critères de santé du modèle qualité lui-même

Indicateurs à mesurer trimestriellement :

| Indicateur | Formule | Seuil santé |
|-----------|---------|-------------|
| Couverture des dimensions | Nombre de dimensions ISO 25010 avec ≥ 1 fitness function active / 9 | ≥ 7/9 |
| Taux de fitness functions valides | FF valides (critères §7.1) / FF totales | ≥ 95% |
| Taux de quality gates bloquants | Gates bloquants dans la CI / gates définis | 100% |
| Dette qualité actuelle | Nombre de QR ouvertes non adressées (> 30j) | 0 pour sécurité ; ≤ 3 pour autres |
| Défauts échappés en production | Bugs post-release / bugs détectés pre-release | < 5% |
| Waivers actifs | Nombre de quality gate bypasses actifs | 0 |

---

## 8. Modulation par classe de risque

La profondeur qualité est modulée sur la classe de risque T/L/M/H/C. Tableau de référence :

### 8.1 Matrice qualité × risque

| Dimension ISO 25010 | T (Trivial) | L (Low) | M (Moyen) | H (High) | C (Critique) |
|--------------------|:-----------:|:----------:|:---------:|:---------:|:------------:|
| Adéquation Fonctionnelle | CI auto | CI auto | CI + AC tests | CI + AC + acceptance | CI + AC + acceptance + mutation |
| Performance Efficiency | — | Smoke | Budget défini | Tests charge | Tests charge + SLO stricts |
| Compatibilité | CI auto | CI auto | Contract tests | Contract + intégration | Contract + intégration + API review |
| Interaction Capability | axe-core auto | axe-core auto | axe + keyboard | axe + manual WCAG | axe + manual + audit expert |
| Fiabilité | CI auto | CI + rollback | SLO défini | SLO + chaos eng | SLO + chaos + RTO/RPO test |
| Sécurité | SAST/SCA | SAST/SCA | + DAST smoke | + DAST + threat model | + DAST + STRIDE + SBOM + pentest |
| Maintenabilité | CC ≤ 15 | CC ≤ 15 | CC ≤ 15 + duplication | + architecture test | + architecture review |
| Flexibilité | Config ext. | Config ext. | + env parity | + scalability test | + scalability + replaceability |
| Sûreté | N/A si hors scope | N/A si hors scope | Évaluer | Fail-safe tests | FMEA + fail-safe + hazard warning |

| OperatingMode | `bypass` | `bypass` cond. | `auto` | `auto` + checkpoint | `pairing` recommandé |

**Légende :** CI auto = quality gate automatisé en CI ; — = non requis pour cette classe

**Règle non négociable :** `bypass` est interdit pour les classes H et C — aucune dérogation possible. Voir risk-classification.md §6.6 pour les limites de risk tolerance et l'Annexe B pour le mapping complet des modes de supervision. Les garde-fous anti-rubber-stamp (format de proposition, quota de rejets ≥ 20 %, audit aléatoire hebdomadaire) s'appliquent en mode `auto` — voir risk-classification.md Annexe B.

**Référence :** la classification de risque T/L/M/H/C qui module cette matrice est définie dans `docs/transversal/risk-classification.md`. Le score composite (impact × probabilité), les signaux de forçage automatique, et le protocole de promotion de classe y sont formalisés.

### 8.2 Règles de dérogation (waivers)

Un waiver (dérogation temporaire à un quality gate) est exceptionnellement autorisé si :
1. La dérogation est **écrite** dans `.planning/06-quality/quality-gates-results.md`
2. Elle a une **date d'expiration** (max 7 jours pour sécurité, max 30 jours pour autres)
3. Elle a un **owner** responsable de la résolution
4. Elle est **référencée** dans le registre de dette qualité
5. Un quality gate de sécurité (SAST Critical, SCA CVE Critical) ne peut **jamais** recevoir de waiver

---

## 9. Application fractale par cycle

### 9.1 Principe fractal

Le sous-cycle universel `Observer → Define → Design → Execute → Verify → Capitalize → Transmit` s'applique à chaque cycle avec une dimension qualité propre.

| Sous-étape | Rôle qualité universel |
|-----------|----------------------|
| **Observer** | Collecter les signaux qualité existants (métriques, incidents, feedbacks) |
| **Define** | Préciser les exigences qualité pour ce cycle (quelles dimensions, quels seuils) |
| **Design** | Planifier les fitness functions et contrôles qualité adaptés à la classe de risque |
| **Execute** | Implémenter en maintenant les quality gates actifs |
| **Verify** | Évaluer les résultats des fitness functions ; go/no-go |
| **Capitalize** | Documenter les résultats, mettre à jour le registre de dette qualité |
| **Transmit** | Passer le rapport quality gate au cycle suivant |

### 9.2 Cycle 1 — discovery

**Dimensions ISO 25010 prioritaires :** Adéquation Fonctionnelle (comprendre ce que le produit doit faire), Interaction Capability (comprendre les utilisateurs réels), Safety (identifier si applicable).

**Activités qualité :**
- Identifier les 3-5 dimensions ISO 25010 critiques pour ce projet spécifique (ex : un SaaS de e-commerce : Performance + Reliability + Security prioritaires ; une app médicale : Safety + Security + Reliability prioritaires)
- Définir les contraintes réglementaires qualité (RGPD, EAA, DORA financier, HDS, etc.)
- Identifier les anti-patterns qualité du domaine métier

**Livrable qualité :** Section "Exigences qualité initiales" dans la Note de Discovery

### 9.3 Cycle 2 — cadrage

**Dimensions ISO 25010 prioritaires :** Toutes, pour établir la priorité relative.

**Activités qualité :**
- Produire le `quality-model-instance.md` : quelles dimensions sont prioritaires, souhaitables, ou explicitement déprioritées pour ce projet
- Définir les seuils bloquants et cibles pour chaque exigence qualité retenue
- Intégrer le performance budget (€/requête, latence cible, disponibilité SLO, taille bundle)
- Établir la DoR qualité (une story est Ready si elle a des critères d'acceptation incluant les dimensions qualité pertinentes)
- Établir la DoD qualité (un incrément est Done si les quality gates associés à sa classe de risque sont verts)

**Livrable qualité :** `docs/08-quality/quality-model-instance.md` + DoR/DoD qualité dans le Charter

### 9.4 Cycle 3 — conception

**Dimensions ISO 25010 prioritaires :** Maintenabilité (architecture), Sécurité (threat model), Fiabilité (SLO design), Performance Efficiency (budgets).

**Activités qualité :**
- Définir la liste complète des fitness functions à implémenter dans le pipeline CI
- Créer les SLI/SLO pour chaque service/endpoint critique
- Mener le threat modeling STRIDE sur les nouveaux flux (Sécurité — sous-caractéristique Résistance)
- Déclencher l'AIPD si applicable (Sécurité — Confidentialité + Safety si données de santé). L'AIPD est obligatoire dès que ≥ 2 des 9 critères WP29/CNIL sont remplis : (1) évaluation/scoring, (2) décision automatisée avec effets légaux, (3) surveillance systématique, (4) données sensibles ou hautement personnelles, (5) traitement à grande échelle, (6) croisement/combinaison de données, (7) données de personnes vulnérables, (8) usage innovant/nouvelles technologies, (9) empêche l'exercice d'un droit ou l'accès à un service. Voir cross-cutting-activities.md §AT-05 pour le protocole complet
- Définir la stratégie de tests (pyramide, trophée, honeycomb selon contexte)
- Définir les quality gates CI (liste et seuils) pour ce projet
- Changements C architecturaux : décomposer via Strangler Fig en séquence M/H — chaque étape reclassifiée individuellement, réduisant le risque à chaque incrément tout en maintenant la traçabilité du changement global (voir risk-classification.md §9.3)

**Livrable qualité :** Liste des fitness functions dans le Design Doc + SLI/SLO documentés + Quality gates CI définis

### 9.5 Cycle 4 — build

**Dimensions ISO 25010 prioritaires :** Maintenabilité (continu), Adéquation Fonctionnelle (tests), Sécurité (SAST/SCA continu), Performance (benchmarks).

**Stratégie de branchement :** Trunk-Based Development (TBD) — les développeurs mergent sur la branche principale (trunk) au moins quotidiennement. Les feature branches sont de courte durée (< 2 jours). Ce modèle est corrélé positivement avec les métriques DORA (change lead time, deployment frequency) et réduit le risque de conflits de merge. Les changements H/C utilisent des feature flags pour découpler déploiement et release.

**Activités qualité — inner loop :**

Chaque incrément (PR) passe par les quality gates CI automatisés :

```
PR créée
   → lint + format (Maintenabilité)
   → type-check (Adéquation Fonctionnelle)
   → tests unitaires + intégration (Adéquation Fonctionnelle)
   → coverage check (Adéquation Fonctionnelle)
   → SAST (Sécurité)
   → SCA + licences (Sécurité + Compatibilité)
   → secrets scan (Sécurité — Confidentialité)
   → IaC scan si touché (Sécurité)
   → container scan si touché (Sécurité)
   → cyclomatic complexity check (Maintenabilité)
   → circular dependency check (Maintenabilité)
   → bundle size check si front (Performance Efficiency)
   → axe-core si UI (Interaction Capability — Inclusivité)
   → i18n check si UI (Interaction Capability)
   → contract tests si API (Compatibilité)
PR mergeable si et seulement si tous les gates verts (0 waiver sauf exception documentée)
```

**Spécificités code IA généré :**

Le code généré par un agent IA est soumis aux mêmes quality gates que le code humain, sans exception. Points de vigilance supplémentaires :
- **Hallucinations de packages** : SCA systématique — 19.6% des packages recommandés par LLM sont fictifs ou malveillants (USENIX Security 2025)
- **Vulnérabilités silencieuses** : 29-45% du code IA contient des vulnérabilités (SAST obligatoire, pas optionnel)
- **Correctness sémantique** : mutation testing sur la logique métier générée par IA (syntaxiquement correct ≠ sémantiquement correct)
- **Conformité architecturale** : architecture tests (dependency-cruiser, ArchUnit) pour s'assurer que le code IA respecte les boundaries modulaires
- **Couverture des tests** : les tests générés par IA doivent eux-mêmes être mutés pour valider qu'ils testent réellement le comportement (mutation testing des tests)

**DORA 2024 finding :** L'adoption d'IA individuelle corrèle avec -7.2% de stabilité de livraison. Le remède : small batch sizes et robust testing — exactement ce que les quality gates enforced assurent.

**Livrable qualité :** Quality gate results dans chaque PR ; `quality-metrics.jsonl` mis à jour

### 9.6 Cycle 5 — validation

**Dimensions ISO 25010 prioritaires :** Adéquation Fonctionnelle (acceptance), Interaction Capability (WCAG manuel), Fiabilité (tests charge H/C), Sécurité (DAST), Safety si applicable.

**Activités qualité (risk-based testing) :**

L'effort de test est alloué proportionnellement au produit *probabilité × impact*.

| Type de test | T | L | M | H | C |
|-------------|:-:|:-:|:-:|:-:|:-:|
| Acceptance criteria | CI | CI | CI + manual | CI + manual | CI + manual + stakeholder |
| Tests d'accessibilité manuels | — | — | keyboard + reader | keyboard + reader + contrast | full audit WCAG 2.2 AA |
| Tests de performance | — | — | smoke perf | k6 load test | k6 + chaos |
| Tests de sécurité (DAST) | — | — | smoke DAST | DAST complet | DAST + pentest partiel |
| Tests i18n / RTL | — | smoke | smoke + pseudo-l10n | ≥1 RTL language | multi-language |
| Tests Safety | — | — | N/A sauf scope | fail-safe tests | FMEA validation |

**Livrable qualité :** Test and Validation Results (`04-test-and-validation-results.md`) avec go/no-go explicite

### 9.7 Cycle 6 — release

**Dimensions ISO 25010 prioritaires :** Fiabilité (rollback), Sécurité (SBOM, signature), Compatibilité (rétrocompatibilité API), Flexibilité (déploiement progressif).

**Quality gate de release — liste complète :**

```yaml
Release Quality Gate — BLOQUANTS ABSOLUS (0 dérogation possible) :
  - sast-critical: 0 finding Critical/High non trié
  - sca-cve: 0 CVE Critical/High non triée
  - secrets-scan: 0 secret dans le code
  - tests-passing: 100% des tests verts
  - acceptance-criteria: 100% des AC validés

Release Quality Gate — BLOQUANTS MODULÉS par classe de risque :
  M:
    - performance-regression: pas de régression > 10% vs baseline
    - rollback-plan: plan documenté
  H:
    - load-test: tests de charge verts
    - sbom-generated: SBOM archivé
    - canary-ready: feature flag OFF configuré
    - rollback-tested: plan de rollback testé en staging
  C:
    - sbom-signed: SBOM + signature Cosign/Sigstore
    - slsa-provenance: provenance SLSA ≥ 2
    - change-comms: communication aux parties prenantes faite
    - canary-plan: plan canary documenté (5% → 25% → 50% → 100%)
```

**Règle schéma DB :** tout changement de schéma DB = plan expand/contract documenté avant release. Le pattern expand/contract (ajouter → dual-write → switch read → contract) garantit zéro downtime et rollback possible à chaque étape. Classe H minimum pour toute migration de schéma — voir risk-classification.md §6.6 limite non négociable n°2.

**Livrable qualité :** Release Readiness document (`release-readiness.md`) avec verdict explicite go/no-go

### 9.8 Cycle 7 — run

**Dimensions ISO 25010 prioritaires :** Fiabilité (SLO en production), Performance Efficiency (latence réelle), Sécurité (surveillance CVE), Interaction Capability (NPS, satisfaction).

**Activités qualité en production :**
- Surveillance SLO multi-burn-rate (Google SRE) :
  - 14.4× sur 1h + 5min → alerte urgente (2% budget brûlé en 1h)
  - 6× sur 6h → ticket haute priorité
  - 1× sur 3j → information tendance
- Surveillance des métriques DORA en continu (change failure rate, FDRT)
- Scan CVE continu sur les dépendances en production
- Surveillance de la dégradation progressive (drift de performance, accumulation d'erreurs)
- Monitoring LLM si applicable (tokens, coût, taux d'hallucination, taux de refus)

**Déclencheurs de Quality Incident (dégradation qualité en production) :**
- Disponibilité < seuil SLO bloquant → alerte + potentiellement gel des features
- Error budget épuisé → focus fiabilité, gel features non urgentes jusqu'à reconstitution
- CVE Critical découverte en production → remédiation sous 24h

**Livrable qualité :** `stability-metrics.md` mis à jour ; Quality Incident si déclencheur atteint

### 9.9 Cycle 8 — learning

**Dimensions ISO 25010 prioritaires :** Toutes, pour analyse rétrospective.

**Activités qualité :**
- Rétrospective qualité : les seuils étaient-ils corrects ? Trop stricts ? Trop permissifs ?
- Analyse des défauts échappés : quelle fitness function manquait pour les détecter ?
- Mise à jour du registre de dette qualité
- Proposition de nouvelles fitness functions si patterns récurrents identifiés
- Mise à jour du `quality-model-instance.md` si seuils doivent changer
- Postmortem blameless si incident de qualité en production — voir cross-cutting-activities.md §AT-11 pour le protocole complet. Postmortem ≠ rétrospective de cycle.
- Mesurer SPACE trimestriellement (Satisfaction, Performance, Activity, Communication, Efficiency) pour évaluer la productivité au-delà de la simple activité
- Culture Westrum sondée via les 6 questions DORA — viser une culture générative (information flows, messengers not shot, responsibilities shared, bridging encouraged, failure leads to inquiry, novelty implemented)

**Anti-patterns à détecter :**
- Fitness functions qui n'ont jamais échoué en 6 mois → peut-être trop permissives
- Waivers répétés sur le même gate → dette structurelle, traiter en tant que telle
- Change failure rate > 15% sur 3 sprints → geler les features, renforcer les tests

**Livrable qualité :** Rétrospective qualité dans `07-retrospective.md` + mise à jour `quality-model-instance.md` si applicable

---

## 10. Activités transversales

Les activités suivantes ne sont pas des phases — elles opèrent en permanence, dans tous les cycles.

### 10.1 Gestion de la dette qualité

La **dette qualité** est distincte de la dette technique ordinaire. Elle représente l'écart entre le niveau de qualité défini dans le `quality-model-instance.md` et le niveau de qualité actuel.

**Types de dette qualité :**

| Type | Définition | Exemples |
|------|-----------|---------|
| Dette de couverture | Zones du code sans fitness function active | Module critique sans tests de charge |
| Dette de seuil | Fitness function présente mais seuil trop permissif | Coverage à 40% alors que cible est 80% |
| Dette de dimension | Dimension ISO 25010 non couverte | Aucun test d'accessibilité malgré le scope UE |
| Dette de conformité | Exigence réglementaire non implémentée | AIPD manquante, EAA non testé |
| Dette de monitoring | Absence de surveillance en production | Pas d'alerting sur le SLO défini |

**Règle de gestion :**
- Toute dette qualité est **enregistrée** dans `.planning/06-quality/quality-debt-register.md`
- Chaque item a un owner, une date de création, et une date cible de remboursement
- La dette de sécurité (confidentialité, intégrité, sûreté) est **non reportable** — doit être traitée dans le sprint courant
- La dette qualité est présentée à chaque rétrospective de cycle

**Format du registre :**
```markdown
## QD-001 — Absence de tests de charge sur l'API /search
- Type: dette de couverture
- Dimension: Performance Efficiency — Time Behaviour
- Créée: 2026-05-10
- Classe de risque concernée: H
- Owner: @dev
- Date cible: 2026-06-15
- Impact: SLO de latence non vérifié sous charge nominale
- Action: Implémenter k6 load test sur /search dans la CI
```

### 10.2 Quality gates — gouvernance

**Principe non négociable :** aucun humain ne peut merger une PR ou déployer une release si un quality gate bloquant est rouge, sans exception documentée. C'est ce qui distingue un "process document" d'un système de qualité réel.

**Implémentation technique :**
- Branch protection rules dans le SCM (GitHub/GitLab) : status checks required
- Pipeline défaillant = build bloqué = pas de déploiement possible
- Waivers actifs = entrée dans le quality debt register + alerte dans le dashboard

### 10.3 Continuous quality monitoring

Tableau de bord qualité maintenu en continu dans `.planning/07-metrics/quality-metrics.md` :

```
DORA throughput : Change Lead Time | Deployment Frequency
DORA stability  : Change Failure Rate | Failed Deployment Recovery Time | Rework Rate
ISO 25010       : Disponibilité SLO | Latence p99 | Error rate | Security findings | Coverage
Quality debt    : Items ouverts | Items > 30j | Waivers actifs
```

### 10.4 Qualité spécifique au code IA généré

Le contexte solo + IA est un contexte d'amplification des risques qualité. Le modèle qualité s'adapte :

**Risques spécifiques documentés (sources 2024-2025) :**
- 19.6% des packages recommandés par LLM sont fictifs (package hallucinations — USENIX Security 2025)
- 29-45% du code IA contient des vulnérabilités sécurité
- 39% des développeurs ont peu confiance dans le code IA généré (DORA 2024)
- Correctness syntaxique ≠ correctness sémantique : le code IA a l'air correct mais ne fait pas toujours la bonne chose

**Mesures d'adaptation :**
1. SAST et SCA sont non-skippables même pour le code généré (pas de "l'IA a déjà vérifié")
2. Tests de mutation obligatoires sur la logique métier générée par IA (classe M et au-delà)
3. Review humaine différée (24h) avant merge pour le code IA sur des changements H/C
4. Architecture tests automatisés pour vérifier que le code IA respecte les limites architecturales
5. Observabilité spécifique LLM : tokens, coût, latence, taux d'erreur, hallucination rate si l'IA est dans la boucle produit

---

## 11. Artefacts produits

### 11.1 Artefacts permanents (référence)

| Artefact | Emplacement | Propriétaire | Cycle de vie |
|----------|-------------|--------------|--------------|
| `quality-model.md` (ce document) | `docs/transversal/` | Architecture | Mis à jour si standards évoluent |
| `quality-model-instance.md` | `docs/08-quality/` | @dev | Mis à jour si seuils changent ou nouveau projet |
| `quality-gates.md` | `docs/08-quality/` | @dev | Mis à jour si gates changent |
| `fitness-functions-catalogue.md` | `docs/08-quality/` | @dev | Mis à jour si nouvelles FF ajoutées |

### 11.2 Artefacts opérationnels (exécution)

| Artefact | Emplacement | Fréquence | Format |
|----------|-------------|-----------|--------|
| Quality gate results | `.planning/06-quality/quality-gates-results.md` | Par PR / déploiement | Markdown table |
| Quality metrics | `.planning/07-metrics/quality-metrics.jsonl` | Par run CI | JSONL append-only |
| Sprint quality execution | `.planning/03-sprints/SPRINT-NNN/02-quality-execution.md` | Par sprint | Markdown table |
| Quality debt register | `.planning/06-quality/quality-debt-register.md` | Continu | Markdown liste |
| Defect escape analysis | `.planning/06-quality/defect-escape-analysis.md` | Après chaque incident | Markdown |
| Release readiness | `.planning/04-releases/REL-NNN/release-readiness.md` | Par release | Markdown + verdict |
| Stability metrics | `.planning/07-metrics/stability-metrics.md` | Mensuel | Markdown table |

---

## 12. Métriques et indicateurs — catalogue complet

### 12.1 Métriques de livraison — DORA 2024/2025

DORA a officialisé **5 métriques** en 2024 (l'ancienne MTTR est remplacée par FDRT et déplacée en throughput ; Rework Rate est nouvelle).

| Métrique | Définition | Cible Top (≈15%) | High | Medium | Low |
|----------|-----------|:--------------:|:----:|:------:|:---:|
| **Change Lead Time** | Temps entre commit et déploiement production | < 1 jour | < 1 semaine | < 1 mois | > 1 mois |
| **Deployment Frequency** | Fréquence des déploiements en production | À la demande | Quotidien–hebdo | Hebdo–mensuel | Mensuel–trimestriel |
| **Failed Deployment Recovery Time (FDRT)** | Temps pour récupérer d'un déploiement échoué | < 1h | < 1 jour | < 1 semaine | > 1 semaine |
| **Change Failure Rate** | % des déploiements causant un incident en production | < 5% | 5–10% | 10–15% | > 15% |
| **Deployment Rework Rate** | % des déploiements non planifiés résultant d'un incident | À mesurer et suivre la tendance | — | — | — |

**Attention Loi de Goodhart :** quand une mesure devient une cible, elle cesse d'être une bonne mesure. Ne jamais gamifier (ex : découper artificiellement des PRs pour gonfler la Deployment Frequency sans valeur réelle).

### 12.2 Métriques par dimension ISO 25010

#### Adéquation Fonctionnelle

| Métrique | Formule | Seuil recommandé |
|---------|---------|-----------------|
| Test coverage zones critiques | Lignes couvertes dans les modules critiques / total | ≥ 80% |
| Mutation score domaine | Mutants tués / mutants générés sur logique métier | ≥ 70% |
| Acceptance criteria pass rate | AC passés / AC total par release | 100% avant release |
| Bug escape rate | Bugs détectés en prod / bugs détectés total | < 5% |

#### Performance Efficiency

| Métrique | Formule | Seuil recommandé |
|---------|---------|-----------------|
| Latence p50 / p95 / p99 | Mesurée en production (Prometheus) | Défini par projet en Cadrage |
| Throughput | Requêtes/secondes traitées sans erreur | Défini par projet |
| Bundle size (front) | Taille JS/CSS compressée | Défini par projet (size-limit) |
| Coût LLM par requête | Tokens × prix / requête | Défini en FinOps budget |
| Ressource CPU/mémoire | % utilisation sous charge nominale | CPU < 70%, mémoire < 80% |

#### Fiabilité

| Métrique | Formule | Seuil recommandé |
|---------|---------|-----------------|
| Disponibilité (SLO) | Uptime mesuré sur 30j rolling | Défini par projet (ex: 99.5%) |
| Error rate production | Erreurs 5xx / total requêtes | < 0.1% sur endpoints critiques |
| FDRT (DORA) | Temps moyen de récupération après déploiement échoué | < 1h (top quartile) |
| Change Failure Rate (DORA) | % déploiements causant un incident | < 5% |
| Flaky test rate | Tests flaky / tests total | 0% (quarantaine + fix obligatoires) |

#### Sécurité

| Métrique | Formule | Seuil bloquant |
|---------|---------|---------------|
| SAST findings Critical | Nombre de findings critiques non triés | 0 — BLOQUANT |
| SAST findings High | Nombre de findings High non triés | 0 — BLOQUANT |
| CVE Critical non triées | CVE Critical en production non adressées | 0 sous 24h |
| CVE High non triées | CVE High en production non adressées | 0 sous 7j |
| Secrets détectés | Secrets dans le code | 0 — BLOQUANT |
| SLA remédiation respecté | % CVE traitées dans le SLA défini | 100% |
| Couverture SBOM | % builds H/C avec SBOM archivé | 100% |

#### Maintenabilité

| Métrique | Formule | Seuil recommandé |
|---------|---------|-----------------|
| Complexité cyclomatique max | Complexité maximale par fonction | ≤ 15 (bloquant) |
| Complexité cognitive max | Score Sonar max par fonction | ≤ 15 (bloquant) |
| Lignes par fonction | LOC par fonction | ≤ 80 (bloquant), warn ≤ 50 |
| Lignes par fichier | LOC par fichier | ≤ 500 (bloquant), warn ≤ 300 |
| Duplication | % code dupliqué | < 3% |
| Dépendances circulaires | Nombre de cycles dans le graphe de dépendances | 0 — BLOQUANT |
| Code mort | % code non référencé | 0 non justifié |

#### Interaction Capability (Accessibilité)

| Métrique | Formule | Seuil recommandé |
|---------|---------|-----------------|
| Violations axe-core (A/AA) | Violations sur pages critiques | 0 — BLOQUANT |
| Lighthouse Accessibility score | Score Lighthouse sur parcours critiques | ≥ 90 |
| Chaînes hardcodées | Chaînes non externalisées détectées | 0 — BLOQUANT |
| WCAG 2.2 AA manuel | % critères PASS sur parcours critiques | 100% sur critères applicables |

#### Qualité en usage — ISO 25019

| Métrique | Formule | Seuil recommandé |
|---------|---------|-----------------|
| Task completion rate | Tâches critiques complétées / tentatives | ≥ 90% |
| NPS | Net Promoter Score | ≥ 40 (B2B) ; ≥ 50 (B2C) — à calibrer par projet |
| Support tickets qualité | Tickets liés à des problèmes de qualité perçue | Tendance décroissante |

### 12.3 Métriques de santé du modèle qualité

| Métrique | Formule | Seuil santé |
|---------|---------|------------|
| Couverture dimensions ISO 25010 | Dimensions avec ≥ 1 FF active / 9 | ≥ 7/9 |
| Fitness functions valides | FF respectant les 7 critères §7.1 / total | ≥ 95% |
| Quality gates bloquants actifs | Gates bloquants dans CI / gates définis | 100% |
| Waivers actifs | Nombre de dérogations en cours | 0 (sécurité) ; ≤ 3 (autres) |
| Dette qualité ouverte > 30j | Items quality debt sans action depuis > 30j | 0 (sécurité) ; ≤ 5 (autres) |
| Défauts échappés | Bugs post-release / bugs détectés pre-release | < 5% |

### 12.4 Indicateurs d'alerte (dégradation)

Seuils déclenchant une action immédiate :

| Indicateur | Seuil d'alerte | Action |
|-----------|---------------|--------|
| Change Failure Rate > 15% pendant 3 sprints | Gel des features, focus tests et risk-based testing | Obligatoire |
| Error budget épuisé > 100% en milieu de période | Gel features non urgentes, focus fiabilité | Obligatoire |
| CVE Critical non traitée > 24h | Escalade, remédiation immédiate | Obligatoire |
| Waivers actifs > 3 simultanément | Revue de la dette qualité | Obligatoire |
| Défauts échappés > 5% sur 2 releases consécutives | Audit complet de la stratégie de tests | Obligatoire |
| Coût unitaire dérive > 20% sans justification | Audit FinOps + revue architecture | Recommandé |
| Complexité cyclomatique max > 20 sur 3 PRs | Refactoring obligatoire avant merge | Recommandé |

---

## 13. Standards de référence

| Standard | Version | Domaine | Usage dans ce modèle |
|---------|---------|---------|---------------------|
| ISO/IEC 25010 | 2023-11 | Qualité produit | Référence principale des 9 dimensions et sous-caractéristiques |
| ISO/IEC 25019 | 2023 | Qualité en usage | Complément centré utilisateur (effectiveness, efficiency, satisfaction) |
| DORA | 2024 / 2025 | Performance de livraison | 5 métriques de throughput + stability |
| Building Evolutionary Architectures | Ford, Parsons, Kua — 2e éd. 2022 | Fitness functions | Taxonomy, implémentation, CI/CD integration |
| NIST SSDF SP 800-218 | v1.1 | Sécurité du cycle | Cadre sécurité shift-left (PO/PS/PW/RV) |
| OWASP SAMM | v2 | Maturité sécurité | Governance, Design, Implementation, Verification, Operations |
| OWASP ASVS | v5.0.0 (mai 2025) | Exigences de sécurité | Référentiel d'exigences de sécurité applicatives — 17 chapitres, ~350 exigences, 3 niveaux (L1/L2/L3) |
| OWASP Top 10 | 2025 (officiel) | Risques web | Inventaire des risques courants — A10 renommé Mishandling of Exceptional Conditions ; A06 renommé Software Supply Chain Failures |
| WCAG | 2.2 AA | Accessibilité | Baseline accessibilité (incluse dans Interaction Capability) |
| EN 301 549 | v3.2.1 | Accessibilité UE | Obligation légale EAA depuis 28 juin 2025 |
| RGPD | 2016/679 + art.25/35 | Privacy | Privacy by design + AIPD (Sécurité — Confidentialité) |
| FinOps Foundation Framework | 2024 | Coût cloud | Performance budget financier (Performance Efficiency) |
| Google SRE Book | 2016 + Workbook 2018 | Fiabilité | SLO, error budgets, multi-burn-rate alerting |
| OpenTelemetry | 1.x (stable) | Observabilité | Instrumentation standard (Fiabilité — Disponibilité) |
| SLSA | 1.0 | Supply chain | Provenance (Sécurité — Résistance) |
| ISO/IEC/IEEE 29119 | Parties 1-5 | Tests | Risk-based testing strategy |
| SPACE | Forsgren et al. 2021 | Productivité | Mesure bien-être vs activité — Satisfaction, Performance, Activity, Communication, Efficiency |
| Westrum | Typologie organisationnelle | Culture | Postmortem blameless, culture générative — sondée via 6 questions DORA |
| Diátaxis Framework | Courant | Documentation | 4 types docs : tutoriels, how-to guides, référence, explication |
| Conventional Commits | 1.0 | Versioning | Format de commits standardisé — changelog automatique |
| SemVer 2.0 | Courant | Versioning | MAJOR.MINOR.PATCH — contrat de compatibilité |

---

## 14. Questions ouvertes et suivis (RED CARDS)

### RC-001 — Classification automatique vs manuelle pour Safety

**Statut :** Suivi ouvert — priorité haute

**Question :** Pour un projet donné, comment déterminer automatiquement si la dimension Safety est applicable ? Quels critères objectifs déclenchent l'application des sous-caractéristiques Safety (operational constraint, fail safe, etc.) ?

**Pistes :** Critères déclencheurs : (1) données de santé présentes, (2) décisions automatisées affectant des personnes physiques, (3) contrôle d'infrastructures critiques, (4) impact financier automatisé > seuil. Classification = Safety applicable si ≥ 1 critère.

**Conséquence d'inaction :** Safety ignorée sur des systèmes où elle s'applique → risque réel non géré.

**Owner :** @dev — à résoudre en `cadrage` du premier projet.

### RC-002 — Seuils ISO 25010 par profil de projet

**Statut :** Suivi ouvert — priorité normale

**Question :** Les seuils dans ce document sont des recommandations génériques. Pour un SaaS B2C, une app médicale, un outil interne, ou une API publique, les seuils sont différents. Comment paramétrer le `quality-model-instance.md` de façon assez précise pour que les fitness functions soient calibrées au vrai contexte ?

**Pistes :** Créer 3-4 profils de base (SaaS grand public / outil interne / API publique / données sensibles) avec des seuils pré-configurés dans des templates. Chaque projet choisit un profil et ajuste.

**Conséquence d'inaction :** Seuils trop génériques → quality gates soit trop stricts (tue la vélocité), soit trop permissifs (qualité réelle dégradée).

### RC-003 — Fitness functions pour le code IA généré

**Statut :** Suivi ouvert — priorité haute (contexte solo + IA)

**Question :** Au-delà des fitness functions classiques (SAST, SCA, coverage), quelles fitness functions sont spécifiques au code généré par IA ? Comment détecter automatiquement la correctness sémantique plutôt que syntaxique ?

**Pistes :** (1) Mutation testing systématique sur tout code de logique métier (pas seulement H/C) ; (2) Architecture conformance tests pour vérifier que le code IA respecte les boundaries ; (3) Hallucination detection pour les packages référencés (vérification d'existence dans les registres officiels) ; (4) Property-based testing sur les fonctions générées par IA.

**Conséquence d'inaction :** Le code IA passe les quality gates classiques mais contient des bugs sémantiques invisibles.

### RC-004 — Intégration ISO 25019 dans la pipeline

**Statut :** Suivi ouvert — priorité basse

**Question :** ISO 25019 (qualité en usage) est référencée mais pas encore intégrée dans des fitness functions automatisées. Comment mesurer automatiquement l'effectiveness et l'efficiency en contexte réel, sans requérir de tests utilisateur manuels à chaque cycle ?

**Pistes :** RUM (Real User Monitoring) — temps de complétion de tâches mesurés en production (via Datadog RUM, PostHog, etc.) ; funnel analytics sur les parcours critiques.

### RC-005 — Promotion de classe de risque en cours de build (CLOSE)

**Statut :** CLOSE — répondu par `docs/transversal/risk-classification.md` §14 RED-02 et par `docs/conception/02-risk-classifier-spec.md §5`.

**Décision :** quand un changement classé L s'avère être H en cours de build, le harness suspend le cycle, reclassifie dans `.planning/current-risk.yaml`, ajoute la promotion dans `.planning/run-set.json#risk_promotions`, puis relance les contrôles H obligatoires avant toute reprise.

**Effet qualité :** les contrôles de rattrapage sont ceux de la nouvelle classe H/C, pas ceux de la classe initiale.

---

## 15. Relations avec chaque cycle

### Carte de dépendance

```
quality-model.md (ce document)
        │
        ├── RÉFÉRENCÉ PAR → discovery
        │   → Détermine quelles dimensions ISO 25010 sont critiques pour le projet
        │
        ├── RÉFÉRENCÉ PAR → cadrage
        │   → Produit quality-model-instance.md (instance projet)
        │   → Définit DoR/DoD qualité
        │   → Définit les seuils bloquants par dimension
        │
        ├── RÉFÉRENCÉ PAR → Conception
        │   → Traduit les exigences en fitness functions concrètes
        │   → Définit les quality gates CI
        │   → SLO design
        │
        ├── EXÉCUTÉ PAR → Build
        │   → Quality gates CI à chaque PR
        │   → Fitness functions automatisées
        │   → Quality debt register alimenté
        │
        ├── VÉRIFIÉ PAR → Validation
        │   → Risk-based testing conforme au quality-model-instance.md
        │   → Go/no-go basé sur les seuils définis
        │
        ├── CONTRÔLE FINAL → release
        │   → Release quality control (synthèse)
        │   → SBOM, provenance, rollback plan
        │
        ├── SURVEILLÉ PAR → run
        │   → SLO en production
        │   → DORA metrics réels
        │   → Security monitoring
        │
        └── AMÉLIORÉ PAR → learning
            → Ajustements des seuils
            → Nouvelles fitness functions
            → Remboursement dette qualité
```

### Contrats inter-cycles

| Cycle source | Cycle cible | Contrat qualité |
|-------------|------------|-----------------|
| discovery → cadrage | cadrage reçoit les dimensions ISO 25010 prioritaires + contraintes réglementaires | Si discovery ne fournit pas ces données, cadrage ne peut pas produire un quality-model-instance.md valide |
| cadrage → conception | conception reçoit les seuils qualité et la liste des dimensions à couvrir | Si les seuils ne sont pas définis, les fitness functions seront arbitraires |
| conception → build | build reçoit la liste complète des fitness functions et quality controls CI à implémenter | Si les FF ne sont pas spécifiées, le pipeline CI sera incomplet |
| build → validation | validation reçoit les résultats des quality controls CI + couverture test | Si les quality controls ne sont pas verts, la validation ne peut pas commencer |
| validation → release | release reçoit le rapport go/no-go de validation | Un no-go bloque la release sans exception |
| release → run | run reçoit les SLO définis + les fitness functions de monitoring | Sans cette donnée, run ne peut pas alerter sur les bonnes métriques |
| run → learning | learning reçoit les métriques de production + incidents | Sans ces données, la rétrospective qualité est aveugle |
| learning → discovery | discovery suivant reçoit les learnings qualité + la dette restante | Ferme la boucle d'amélioration continue |

---

## Annexe A — Catalogue de fitness functions prêtes à l'emploi

Référence opérationnelle — à adapter selon le stack technique du projet.

### A.1 Maintenabilité

```yaml
# cyclomatic-complexity — ESLint / SonarQube
eslint-plugin-complexity:
  rule: complexity
  max: 15
  errorLevel: error

# circular-dependencies — dependency-cruiser
dependency-cruiser:
  forbidden:
    - name: no-circular
      severity: error
      from: {}
      to: { circular: true }

# lines-per-function — ESLint
max-lines-per-function:
  max: 80
  skipBlankLines: true
  skipComments: true
```

### A.2 Sécurité

```yaml
# SAST — Semgrep
semgrep:
  rules: ["p/security-audit", "p/owasp-top-ten", "p/secrets"]
  severity_threshold: WARNING
  fail_on: ["ERROR"]

# SCA — osv-scanner
osv-scanner:
  format: table
  fail_on_vuln: true
  # Fail sur CRITICAL et HIGH

# Secrets — gitleaks
gitleaks:
  config: .gitleaks.toml
  exit_code: 1
```

### A.3 Performance

```yaml
# Bundle size — size-limit
size-limit:
  - path: dist/main.js
    limit: 150 kB
  - path: dist/vendor.js
    limit: 300 kB

# Load test — k6 (CI, classe H+)
k6:
  vus: 50
  duration: 60s
  thresholds:
    http_req_duration: ["p(99)<200"]
    http_req_failed: ["rate<0.001"]
```

### A.4 Fiabilité

```yaml
# SLO check — Prometheus alertrule
groups:
  - name: slo-availability
    rules:
      - alert: SLOBudgetBurn
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[1h]))
          / sum(rate(http_requests_total[1h])) > 0.001
        for: 5m
        labels:
          severity: critical
```

### A.5 Accessibilité (Interaction Capability)

```yaml
# axe-core — Playwright CI
accessibility_test:
  pages:
    - url: /
    - url: /dashboard
    - url: /settings
  wcag_level: AA
  fail_on_violations: true
  # Déclenche un échec CI si violation A ou AA détectée
```

---

## Annexe B — Quality Model Instance Template

À copier dans `docs/08-quality/quality-model-instance.md` en début de projet.

```markdown
# Quality Model Instance — [Nom Projet]
Date de création : YYYY-MM-DD
Version : 1.0

## Profil de base
- Type : SaaS B2C / outil interne / API publique / données sensibles (choisir)
- Secteur : [ex: fintech, santé, retail, outil dev]
- Réglementation applicable : [RGPD, EAA, DORA financier, HDS, autre]
- Safety applicable : Oui / Non — justification : [critères §14 RC-001]

## Dimensions ISO 25010 — priorisation

| Dimension | Priorité | Justification | Seuil bloquant | Seuil cible |
|-----------|---------|---------------|----------------|-------------|
| Functional Suitability | CRITIQUE | Raison d'être du produit | 100% AC pass | 100% + mutation ≥70% |
| Performance Efficiency | HAUTE | SaaS — latence perçue | p99 < 300ms | p99 < 150ms |
| Compatibility | NORMALE | APIs publiques | Contract tests verts | + openapi-diff |
| Interaction Capability | HAUTE | App grand public | 0 violation A/AA | WCAG 2.2 AA complet |
| Reliability | HAUTE | SaaS production | Disponibilité ≥ 99.5% | ≥ 99.9% |
| Security | CRITIQUE | Données utilisateurs | 0 CVE Critical, 0 SAST Critical | + SBOM + SLSA |
| Maintainability | NORMALE | Solo dev — dette coûteuse | CC ≤ 15, 0 circular dep | + mutation testing |
| Flexibility | BASSE | Pas de multi-cloud immédiat | Config externalisée | — |
| Safety | N/A | Pas de données médicales / décisions auto | — | — |

## SLO définis
- Disponibilité : 99.5% mensuel (SLI : uptime Prometheus)
- Latence p99 API : < 300ms (SLI : histogram)
- Error rate : < 0.1% (SLI : taux 5xx)

## Quality gates CI — liste active
[Référencer fitness-functions-catalogue.md]

## DoR qualité
Une story est Ready si :
- [ ] Critères d'acceptation incluent les dimensions qualité applicables à sa classe de risque
- [ ] Aucune dépendance qualité non résolue (ex : AIPD requise mais non déclenchée)

## DoD qualité
Un incrément est Done si :
- [ ] Tous les quality gates CI verts (0 waiver)
- [ ] Coverage ≥ 80% sur les modules touchés
- [ ] 0 CVE Critical/High non triée
- [ ] 0 violation A/AA accessibilité sur l'UI touchée
- [ ] Documentation à jour si interface modifiée

## Historique des révisions
| Date | Version | Changement | Justification |
|------|---------|-----------|---------------|
| YYYY-MM-DD | 1.0 | Création | Cadrage initial |
```

---

*Sources utilisées pour ce document :*

- [ISO/IEC 25010:2023 — iso25000.com](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010) — standard officiel
- [ISO/IEC 25019:2023 — iso.org](https://www.iso.org/standard/78177.html) — qualité en usage
- [arc42 Quality Model — ISO 25010 update 2023](https://quality.arc42.org/articles/iso-25010-update-2023) — analyse des changements 2023
- [DORA 2024 Report — dora.dev](https://dora.dev/research/2024/dora-report/) — 5 métriques officielles
- [DORA Metrics History — dora.dev](https://dora.dev/insights/dora-metrics-history/) — évolution des métriques
- [Fitness Functions — continuous-architecture.org](https://continuous-architecture.org/practices/fitness-functions/) — taxonomy et implémentation
- [Fitness Functions Architecture — InfoQ](https://www.infoq.com/articles/fitness-functions-architecture/) — CI/CD integration
- [Building Evolutionary Architectures — O'Reilly](https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/ch04.html) — automating architectural governance
- [Package Hallucinations LLM — USENIX Security 2025](https://www.usenix.org/publications/loginonline/we-have-package-you-comprehensive-analysis-package-hallucinations-code) — 19.6% hallucination rate
- [DORA 2024 AI Impact — dora.dev](https://dora.dev/research/2024/ai-preview/) — -7.2% delivery stability avec adoption IA
- [Quality Gates CI/CD — InfoQ](https://www.infoq.com/articles/pipeline-quality-gates/) — implémentation pratique
- [ISO 25010 Codacy Analysis](https://blog.codacy.com/iso-25010-software-quality-model) — sous-caractéristiques détaillées
- [spree.de ISO 25010 2023 update](https://blog.spree.de/2024/01/02/iso-iec-25010-news-from-the-2nd-edition-2023-11/) — nouvelles sous-caractéristiques
