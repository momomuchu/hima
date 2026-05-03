# Cycle de développement logiciel piloté par la qualité — v3

> Document de référence opérationnel, en français, format Markdown.
> Améliore et synthétise la v1 (17 étapes linéaires) et la v2 (24 sections orientées qualité). Intègre les axes manquants : Discovery amont, Privacy/RGPD, FinOps, Accessibilité/i18n by design, Versioning, matrice risque → chemin, Sécurité shift-left, DoR/DoD, Postmortem blameless, métriques DORA+SPACE, environnements, migrations sans downtime.
> Universel : applicable en équipe ou en solo (avec ou sans agents IA). Les remarques « Solo » sont marquées explicitement.

---

## TL;DR

- **Le bon cycle n'est pas une séquence figée mais un système à deux couches** : (a) des phases ponctuelles (Discovery → Cadrage → Conception → Build → Validation → Release → Run → Apprentissage), et (b) des activités continues transverses (sécurité shift-left, privacy by design, accessibilité/i18n, FinOps, observabilité, documentation, tests, versioning) — chaque changement traverse un **chemin court ou long** déterminé par sa **classe de risque** (trivial / faible / moyen / élevé / critique), pas par dogme.
- **La qualité est pilotée par des standards ouverts et des métriques mesurables, pas par des opinions** : ISO/IEC 25010:2023 (9 caractéristiques produit, dont la nouvelle « safety »), ISO/IEC/IEEE 29119, NIST SSDF SP 800-218, OWASP SAMM v2 + ASVS + Top 10, RGPD art. 35 / méthode PIA CNIL, WCAG 2.2 + EN 301 549 + European Accessibility Act (en vigueur depuis le 28 juin 2025), FinOps Foundation Framework 2024, SLSA + SBOM (CycloneDX/SPDX), DORA 5-metrics + SPACE, Westrum.
- **Trois conditions non négociables** pour que la v3 fonctionne : (1) une **Definition of Ready** et une **Definition of Done** explicites et partagées ; (2) des **quality gates automatisés** dans le pipeline CI/CD avec une **matrice risque → profondeur de processus** documentée ; (3) une **culture générative Westrum** où les postmortems sont *blameless* et distincts des rétrospectives de cycle.

---

## Key Findings

1. **La Discovery n'est pas optionnelle**. Sauter cette phase est l'anti-pattern numéro un : on construit une solution avant d'avoir validé le problème. Le cadre Continuous Discovery (Teresa Torres) avec opportunity solution tree, JTBD, problem-solution fit, et spikes timeboxés réduit massivement le rework et le change failure rate.
2. **Privacy et accessibilité doivent être *by design*, pas en QA tardive**. RGPD art. 35 impose une AIPD/DPIA *avant* la mise en œuvre du traitement (sanction : jusqu'à 10 M€ ou 2 % du CA mondial). L'EAA est en vigueur depuis le 28 juin 2025 ; EN 301 549 référence aujourd'hui WCAG 2.1 AA, et l'industrie traite WCAG 2.2 AA comme baseline. Retrofitter coûte 5 à 10× plus cher que prévoir dès la conception.
3. **Le coût est une dimension de qualité**. La FinOps Foundation a redéfini sa pratique en 2024 autour de la *valeur* (pas seulement du coût), incluant explicitement les coûts LLM/AI, l'observabilité, et le SaaS. Un *performance budget financier* (€/requête, €/utilisateur, €/build, €/feature) doit accompagner les SLO techniques.
4. **Sécurité shift-left = combinaison SAST + DAST + SCA + IaC scanning + container scanning + SBOM + threat modeling**. NIST SSDF (PO/PS/PW/RV) + OWASP SAMM v2 fournissent le cadre. Le threat modeling STRIDE doit être *itératif et léger*, pas un grand atelier annuel.
5. **DORA 2024/2025 a évolué** : 5 métriques officielles désormais (Change Lead Time, Deployment Frequency, **Failed Deployment Recovery Time** — qui remplace MTTR et passe en throughput, **Change Failure Rate**, **Rework Rate** — nouveau en 2024) + Reliability comme quasi-métrique via SLO. À combiner avec SPACE (Satisfaction, Performance, Activity, Communication, Efficiency) pour ne pas optimiser au détriment du bien-être.
6. **Les migrations sans downtime suivent le pattern expand/contract** (parallel change) : ajouter en parallèle, double-écriture, backfill, basculer la lecture, supprimer l'ancien. Un schéma renommé en un déploiement = anti-pattern garanti d'incident.
7. **Le postmortem blameless est distinct de la rétrospective de cycle**. Le premier est déclenché par incident et focalisé sur le système ; la seconde est périodique et focalisée sur le processus. Les confondre détruit les deux.
8. **Trunk-Based Development + Conventional Commits + SemVer + feature flags** est aujourd'hui le standard de fait pour les équipes qui visent le top 25 % DORA. Git Flow reste pertinent pour les produits versionnés à cycles longs (firmware, bibliothèques publiques).
9. **La matrice risque → chemin est la pièce manquante de la v2**. Sans elle, le cycle complet est appliqué à un changement de typo CSS comme à une refonte d'authentification, ce qui détruit la vélocité ET la confiance dans le processus.

---

## Details

# 0. Préambule et principes directeurs

## 0.1 Pourquoi une v3

La v1 décrit un *workflow* (17 étapes en file d'attente). La v2 le habille de standards qualité (ISO 25010, OWASP, DORA). La v3 ajoute trois choses essentielles :

1. **Une couche amont** (Discovery) avant le cadrage — sans elle, on optimise un cycle qui produit la mauvaise chose.
2. **Une matrice de routage par risque** — sans elle, on applique le même cérémonial à un fix d'une ligne et à une refonte d'architecture.
3. **Des dimensions transverses non techniques** souvent oubliées — Privacy, Accessibilité, FinOps, i18n — qui, traitées en QA tardive, deviennent des dettes cataclysmiques.

## 0.2 Six principes directeurs

1. **Universel mais ajusté** : un seul cadre, plusieurs profondeurs (chemin court vs long).
2. **Continu autant que ponctuel** : ne pas confondre les phases (linéaires) et les pratiques (continues).
3. **Quality gates plutôt que checkpoints humains** : automatiser ce qui peut l'être, garder le jugement humain pour le risque et l'ambiguïté.
4. **Mesurable** : DORA pour la performance de livraison, SPACE pour le bien-être, ISO 25010 pour la qualité produit, FinOps pour le coût.
5. **Blameless** : tout incident est une défaillance du système avant d'être une erreur d'individu (Westrum, génératif).
6. **Standards d'abord, outils ensuite** : choisir un framework reconnu (NIST SSDF, OWASP ASVS, WCAG 2.2) avant de choisir un outil.

## 0.3 Note pour le mode solo / solo + agents IA

Le cycle complet reste applicable même seul ; certaines pratiques (revue de code, postmortem) sont dégradées en :

- **Revue solo** : self-review différée (24 h ou plus), checklist explicite, lecture inversée (commencer par les tests), agent IA en relecteur antagoniste.
- **Postmortem solo** : journal de bord d'incident écrit le jour même, relecture une semaine plus tard avec une grille STRIDE/5 Whys.
- **Pair planning** : remplacé par un brouillon de design doc *avant* le code, validé par un agent IA jouant l'avocat du diable.
- **DoR/DoD** : doivent être plus stricts en solo, car il n'y a pas de garde-fou social.

---

# 1. Vue d'ensemble : phases ponctuelles, activités continues, matrice risque

## 1.1 Architecture du cycle

```
                ┌─────────────────────────────────────────────────────────┐
                │   ACTIVITÉS CONTINUES TRANSVERSES (toujours actives)    │
                │ Sécurité shift-left  •  Privacy/RGPD  •  FinOps         │
                │ Accessibilité / i18n  •  Tests automatisés              │
                │ Observabilité  •  Documentation  •  Versioning          │
                └─────────────────────────────────────────────────────────┘
                          ▲     ▲     ▲     ▲     ▲     ▲     ▲
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ DISCOVERY│→ │ CADRAGE  │→ │ CONCEPTION│→│  BUILD   │→ │ VALIDATION│
   │   (0)    │  │   (1-4)  │  │  (5)      │ │ (6-9)    │  │ (10-11)  │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
                                                                  │
                                                                  ▼
                ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
                │ RELEASE  │→ │   RUN    │→ │APPRENTIS-│  │ INCIDENT │
                │ (12-13)  │  │ (14-16)  │  │SAGE (17) │  │ → POSTM. │
                └──────────┘  └──────────┘  └──────────┘  │   (18)   │
                                                          └──────────┘
```

Les phases ponctuelles (numérotées) ont des *entrées*, *sorties*, et *gates* explicites. Les activités continues n'ont pas de phase : elles imprègnent toutes les phases.

## 1.2 Matrice risque → profondeur de processus

C'est la **pièce centrale** du cycle. Chaque changement est classé en 5 niveaux. Le tableau ci-dessous indique ce qui est obligatoire (✅), recommandé (○), allégé (◔), ou skippable (—).

| Phase / activité                       | T (Trivial) | F (Faible) | M (Moyen) | É (Élevé) | C (Critique) |
|----------------------------------------|:---:|:---:|:---:|:---:|:---:|
| Discovery / validation problème        | — | ◔ | ○ | ✅ | ✅ |
| Cadrage / DoR formelle                 | ◔ | ○ | ✅ | ✅ | ✅ |
| Analyse fonctionnelle                  | — | ◔ | ✅ | ✅ | ✅ |
| Analyse technique / ADR                | — | ◔ | ○ | ✅ | ✅ |
| Threat modeling STRIDE                 | — | — | ○ | ✅ | ✅ |
| AIPD / DPIA                            | — | — | conditionnel | ✅ si données perso. | ✅ |
| Conception détaillée                   | — | ◔ | ○ | ✅ | ✅ |
| Spike technique timeboxé               | — | — | ○ | ○ | ○ |
| Tests unitaires                        | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests intégration                      | ◔ | ✅ | ✅ | ✅ | ✅ |
| Tests E2E sur parcours critique        | — | ◔ | ○ | ✅ | ✅ |
| SAST / SCA                             | ✅ (CI) | ✅ | ✅ | ✅ | ✅ |
| DAST                                   | — | — | ○ | ✅ | ✅ |
| IaC / container scanning               | ✅ si touché | ✅ | ✅ | ✅ | ✅ |
| Revue de code (peer)                   | ◔ | ✅ | ✅ | ✅ (≥2) | ✅ (≥2) |
| Quality gates CI                       | ✅ | ✅ | ✅ | ✅ | ✅ |
| Validation produit / acceptance        | — | ◔ | ✅ | ✅ | ✅ |
| QA risk-based                          | — | ◔ | ○ | ✅ | ✅ |
| Tests d'accessibilité (axe-core, manuel) | ◔ auto | ✅ auto | ✅ auto | ✅ + manuel | ✅ + audit |
| Tests de charge / performance          | — | — | ○ | ✅ | ✅ |
| Tests i18n / RTL                       | — | ◔ | ○ | ✅ | ✅ |
| Vérification budget FinOps             | — | ◔ | ○ | ✅ | ✅ |
| Stratégie de déploiement progressif    | direct | direct | canary 10 % | canary + blue/green | canary + feature flag obligatoire |
| Plan de rollback explicite             | implicite | ✅ | ✅ | ✅ + testé | ✅ + répété |
| Communication aux parties prenantes    | — | équipe | équipe + PO | élargie | élargie + comm. ext. |
| Postmortem si incident                 | léger | ✅ | ✅ | ✅ + revue exec. | ✅ + audit indépendant |

**Règles de classification** :

- **T (Trivial)** : changement cosmétique, doc, refactor sans changement de comportement, dépendance patch sans CVE. Code path testé par des tests existants.
- **F (Faible)** : nouvelle fonctionnalité isolée derrière un feature flag, pas de donnée perso., pas de migration.
- **M (Moyen)** : nouvelle fonctionnalité visible utilisateur, pas de PII sensible, pas de schéma DB, pas d'impact tiers.
- **É (Élevé)** : touche authentification, autorisation, paiement, données personnelles, schéma DB, API publique, infra de production.
- **C (Critique)** : impact transverse (multi-services), données de santé/biométrie/financières, refonte d'architecture, rupture de contrat API, exigence réglementaire (RGPD, EAA, eIDAS, DORA financier, NIS2).

**Anti-pattern** : laisser la classification à la discrétion de l'auteur du changement. Bonne pratique : l'auteur propose la classe, le reviewer la valide ou la conteste, le PR template force l'explicitation.

## 1.3 Definition of Ready et Definition of Done génériques

### DoR (à adapter par équipe)

Une story / un incrément est *Ready* quand :

- [ ] Problème utilisateur formulé (JTBD ou « As a ... I want ... so that ... »).
- [ ] Critères d'acceptation testables, INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable).
- [ ] Classe de risque proposée (T/F/M/É/C).
- [ ] Dépendances identifiées et résolues ou planifiées.
- [ ] Impacts privacy/accessibilité/i18n identifiés (oui/non + détail).
- [ ] Estimable par l'équipe (sinon → spike timeboxé).
- [ ] Découpe possible dans un cycle (sinon → décomposer).

### DoD (à adapter par équipe, mais avec des invariants)

Un incrément est *Done* quand **tous** les points ci-dessous sont vrais :

- [ ] Code revu par au moins une autre personne (ou self-review différée + checklist en solo).
- [ ] Tests automatisés écrits et passants : couverture cohérente avec le risk-based testing (pas un seuil arbitraire).
- [ ] Quality gates CI verts : SAST, SCA, lint, type-check, tests, couverture, secrets scan, IaC scan si applicable.
- [ ] Aucune CVE Critical / High non triée dans les dépendances introduites.
- [ ] Documentation à jour : README, ADR si décision d'architecture, changelog si user-facing.
- [ ] Observabilité en place : logs structurés, métriques, traces si chemin critique, SLO inchangé ou mis à jour.
- [ ] Critères d'accessibilité WCAG 2.2 AA respectés sur l'UI touchée (axe-core vert + smoke test clavier/lecteur d'écran).
- [ ] i18n : aucune chaîne hardcodée, formats régionaux délégués à la lib i18n, RTL non cassé.
- [ ] Privacy : registre de traitement à jour si nouvelles données personnelles, consentement implémenté si requis, durée de conservation paramétrée, AIPD validée si seuil RGPD atteint.
- [ ] FinOps : impact coût estimé (cloud, LLM, observabilité) documenté si M/É/C ; pas de régression > 10 % sur le coût unitaire.
- [ ] Déployable derrière feature flag si É/C.
- [ ] Plan de rollback testé si É/C.
- [ ] Validé en staging avec parité de données (anonymisées) et de configuration.
- [ ] Communiqué aux parties prenantes prévues par la classe de risque.

---

# 2. Phases ponctuelles

## Phase 0 — DISCOVERY (validation du problème)

> **But** : éviter de construire la mauvaise chose. La phase la plus rentable du cycle.

### 2.0.1 Activités

- **Recherche utilisateur continue** (Continuous Discovery, Teresa Torres) : au moins une conversation utilisateur par semaine pour le PO/PM/designer/lead dev (« product trio »).
- **Cadrage du problème en JTBD** (« Jobs To Be Done ») : « Quand [situation], je veux [motivation] pour que [résultat attendu] ».
- **Opportunity Solution Tree** : outcome au sommet → opportunités (besoins, douleurs, désirs) → solutions candidates → tests d'hypothèse.
- **Spike technique timeboxé** (1–5 j max) : valider la faisabilité, l'API tierce, l'ordre de grandeur de coût/latence. Une seule question, un seul livrable (décision + ADR + éventuellement prototype jetable).
- **Prototypage** : maquette papier, clickable Figma, ou prototype technique jetable. Jamais le « MVP » qui finit en production.
- **Design Sprint** (Google Ventures, 5 jours) ou **Lean Startup MVP** quand le domaine est inconnu.
- **Critères de problem-solution fit** explicites avant de passer en cadrage.

### 2.0.2 Livrables

- Note de Discovery (1–3 pages) : problème, utilisateur cible, hypothèses validées et invalidées, recommandation (build / pivot / kill).
- Mise à jour de l'Opportunity Solution Tree.
- ADR ou note de spike si décision technique.

### 2.0.3 Gate de sortie

Aller en cadrage ssi : problème validé par ≥ 5 conversations utilisateurs (ou source quantitative équivalente), solution préférée a au moins une hypothèse falsifiable, taille d'effort estimée à un ordre de grandeur près.

### 2.0.4 Solo / IA

Solo : interviewer 5 utilisateurs cibles + faire jouer un agent IA en « mauvais utilisateur » pour stresser les hypothèses ; maintenir un fichier `discovery.md` versionné.

### 2.0.5 Anti-patterns

- « On est sûrs de ce que veut l'utilisateur » sans entretien depuis 3 mois.
- Spikes ouverts > 5 jours (signe qu'ils sont devenus de l'implémentation déguisée).
- MVP qui n'est qu'un prototype packagé en prod.
- Discovery comme phase one-shot en début de projet (doit être *continuous*).

---

## Phase 1 — CADRAGE

> **But** : transformer une opportunité validée en engagement partagé.

### Activités
- Vision produit (1 phrase), objectifs business mesurables (idéalement OKR ou North Star Metric).
- Périmètre IN / OUT explicite.
- Parties prenantes et RACI léger.
- Contraintes : réglementaires (RGPD, EAA, sectorielles), budgétaires, temporelles, techniques.
- **Performance budget**, technique ET financier (€/utilisateur, €/transaction, latence cible, taille bundle, etc.).
- Première classification de risque global du projet.

### Livrables
- Charter / one-pager.
- Backlog initial avec items respectant la DoR.

### Gate
- Vision validée par sponsor + PO + tech lead. Performance budget négocié.

---

## Phase 2 — ANALYSE FONCTIONNELLE

### Activités
- User stories ou use-cases avec critères d'acceptation testables (Given-When-Then ou équivalent).
- Modélisation du domaine (Domain Storytelling, Event Storming light).
- **Flux RGPD** : pour chaque story, identifier les données personnelles manipulées, leur finalité, leur base légale, leur durée de conservation.
- **Parcours d'accessibilité** : identifier les *flux utilisateurs critiques* qui devront être testables au clavier et au lecteur d'écran.
- **Parcours i18n** : recenser les contenus localisables et formats régionaux requis.

### Livrables
- Backlog raffiné, stories *Ready*.
- Registre de traitement préliminaire (modèle CNIL).
- Matrice de criticité d'accessibilité.

---

## Phase 3 — ANALYSE TECHNIQUE

### Activités
- Choix d'architecture (monolithe modulaire, microservices, event-driven, etc.) — documenté en ADR (Architecture Decision Records).
- Choix de stack et de dépendances ; vérification SCA et licence.
- **Threat modeling STRIDE** itératif sur les flux nouveaux ou modifiés (DFD au tableau, 90 min max, sortie = liste de menaces priorisées dans le backlog).
- Cartographie des données pour Privacy by Design (Cavoukian, 7 principes : proactif, default, embedded, full functionality, end-to-end security, visibility, user-centric).
- **AIPD/DPIA** déclenchée si traitement entre dans la liste CNIL ou coche ≥ 2 critères du WP29 (profilage, données sensibles, données vulnérables, traitement à grande échelle, croisement, surveillance systématique, prise de décision automatisée, technologie innovante, empêche l'exercice d'un droit).
- **Estimation FinOps** : tarif par requête API/LLM, coût stockage, coût observabilité (les outils APM/logs représentent souvent 5–15 % du coût cloud).
- **Stratégie de versioning** : SemVer (MAJOR.MINOR.PATCH), Conventional Commits, choix Trunk-Based (recommandé pour CI/CD continue) vs Git Flow (recommandé pour produits versionnés à cycles longs).
- **Stratégie de migration** : tout changement de schéma touche à *expand/contract* (parallel change).

### Livrables
- ADR signés.
- Threat model (DFD + table de menaces + mitigations).
- AIPD si requise (méthode CNIL, 7 étapes : description, nécessité/proportionnalité, risques, mesures, documentation + DPO, consultation CNIL si nécessaire, révision périodique).
- Estimation de coût mensuel à régime de croisière.

### Gate
- Tech lead + sécurité (pour C/É) + DPO (si AIPD) + FinOps owner (pour C/É).

---

## Phase 4 — PLANIFICATION

### Activités
- Découpe en incréments livrables (recommandé : ≤ 1 jour de lead time chacun pour viser le top DORA).
- Identification des feature flags nécessaires.
- Plan de release (continuous, trains, ou jalonné).
- Capacité équipe (avec marge pour incidents — typiquement 20 %).

### Livrables
- Roadmap incrémentale.
- Plan de release.

---

## Phase 5 — CONCEPTION DÉTAILLÉE

### Activités
- Conception au niveau composant : interfaces, contrats, schémas DB, modèles d'événements.
- Définition des SLI/SLO pour les nouveaux services ou endpoints (latence, disponibilité, fraîcheur, exactitude).
- Plan d'observabilité (quels logs, métriques, traces — RED, USE, ou les Four Golden Signals).
- Plan de tests : unitaires, intégration, contrat (Pact), property-based si logique riche, mutation testing pour les zones critiques, charge si É/C.
- **Plan d'accessibilité** : sémantique HTML, ARIA si dynamique, focus visible, contrastes, alternatives textuelles, dragging movements (WCAG 2.2 SC 2.5.7), target size (2.5.8), redundant entry (3.3.7), focus appearance (2.4.11), consistent help (3.2.6).
- **Plan i18n/l10n** : extraction des chaînes (ICU MessageFormat, gettext, ARB, etc.), CSS logical properties, support RTL, formats CLDR (dates, nombres, devises, pluriels).
- **Quality gates CI** définis pour ce changement : seuils de couverture, listes interdites, scan IaC, signature SBOM.

### Livrables
- Design doc (1–5 pages) + ADR si nouvelle décision.
- SLI/SLO documentés.

---

## Phase 6 — DÉVELOPPEMENT

### Activités
- Implémentation par petits incréments (≤ 1 jour, principe Trunk-Based).
- Commits Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `BREAKING CHANGE:`).
- Branches courtes (< 24 h) ou direct sur `main` derrière feature flag.
- Tests écrits *avec* le code (TDD si possible, sinon avec).
- Logs/métriques/traces ajoutés au moment de l'écriture, pas après.
- Pré-commit hooks : lint, format, secrets scan (gitleaks/trufflehog), conventional commits validator.

### Solo
- Self-review systématique avant push (PR template à soi-même).

---

## Phase 7 — TESTS DÉVELOPPEUR

### Choix du modèle de tests

- **Pyramide classique (Cohn/Fowler)** : beaucoup d'unitaires, moyennement d'intégration, peu d'E2E. Recommandé pour les backends à logique métier dense.
- **Trophée (Kent C. Dodds)** : statique > unitaires < intégration > E2E. Recommandé pour les frontends et les codes orientés intégration (API/orchestration).
- **Honeycomb (Spotify)** : peu d'unitaires de bas niveau, beaucoup d'intégration, peu d'E2E. Recommandé pour les microservices.

Choisir consciemment, documenter la stratégie de tests.

### Pratiques recommandées

- **Tests de contrat** (Pact ou équivalent) pour les frontières inter-services.
- **Property-based testing** (Hypothesis, fast-check, jqwik) pour la logique riche (parsers, validators, calculs financiers).
- **Mutation testing** (Stryker, PIT) pour mesurer la *qualité* des tests, pas juste leur quantité — sur les zones critiques, viser un mutation score > 70 %.
- **Snapshot tests** uniquement pour les UI stables ; sinon source de fragilité.

---

## Phase 8 — REVUE DE CODE

- Au moins un reviewer indépendant pour F+ ; deux pour É/C.
- Checklist du reviewer : correctness, sécurité (au moins lecture STRIDE rapide), tests, observabilité, accessibilité, privacy, performance, FinOps, lisibilité.
- Pas de fusion sans tous les quality gates verts.
- Pas de PR > 400 lignes diff (sauf refactor mécanique) — au-delà, la qualité de la revue chute fortement.

---

## Phase 9 — INTÉGRATION CONTINUE / QUALITY GATES

Quality gates non négociables (à automatiser dans la CI) :

| Gate                                | Outils typiques                                       | Bloquant si...                       |
|-------------------------------------|-------------------------------------------------------|--------------------------------------|
| Lint / format                       | ESLint, ruff, golangci-lint                           | erreur                               |
| Type-check                          | TypeScript, mypy, Pyright                             | erreur                               |
| Tests unitaires + intégration       | jest, pytest, JUnit                                   | échec                                |
| Couverture (zones critiques)        | nyc, coverage.py                                      | < seuil défini                       |
| **SAST**                            | Semgrep, CodeQL, SonarQube, Checkmarx                 | High/Critical                        |
| **SCA** (dépendances + licences)    | OSV-Scanner, Trivy, Snyk, Dependabot                  | CVE Critical/High non triée          |
| **Secrets scan**                    | gitleaks, TruffleHog                                  | secret détecté                       |
| **IaC scan**                        | tfsec, Checkov, kube-score                            | High/Critical                        |
| **Container scan**                  | Trivy, Grype                                          | High/Critical                        |
| **SBOM** (CycloneDX ou SPDX)        | Syft, cdxgen                                          | non généré                           |
| **Signature artefact**              | Cosign / Sigstore                                     | non signé pour É/C                   |
| **DAST** (sur preprod)              | OWASP ZAP, Burp                                       | High pour É/C                        |
| Tests d'accessibilité automatisés   | axe-core, Pa11y, Lighthouse                           | violation A/AA                       |
| Performance / bundle size           | Lighthouse CI, k6, size-limit                         | régression > seuil                   |
| **SLSA provenance** pour É/C        | GitHub Actions OIDC + slsa-github-generator           | absente                              |

Concept central : *no human can override a failing gate without an explicit, time-bound, recorded waiver*.

---

## Phase 10 — VALIDATION PRODUIT

- Démonstration au PO sur preprod / environnement de validation.
- Vérification critères d'acceptation un à un.
- Validation parcours utilisateur réel sur un device cible (mobile inclus).
- Ne jamais déclarer *Done* avant cette validation pour M+.

---

## Phase 11 — ASSURANCE QUALITÉ (risk-based testing)

ISO/IEC/IEEE 29119 fournit le cadre. Le **risk-based testing** consiste à allouer l'effort de test proportionnellement au produit *vraisemblance × impact*.

Activités :
- Matrice de risque (probabilité × impact) sur les fonctionnalités touchées.
- Tests exploratoires sur les zones rouges.
- Tests de charge / performance contre les SLO.
- Tests de sécurité (DAST, fuzzing, tests d'authz/authn) pour É/C.
- **Tests d'accessibilité manuels** : lecteur d'écran (NVDA/VoiceOver), zoom 400 %, navigation clavier exclusive, contraste sur les états (focus, hover, disabled).
- **Tests i18n** : pseudo-localisation (allongement +30 %), langues RTL (arabe, hébreu), formats locaux (dates JJ/MM vs MM/JJ, séparateur décimal, devise locale).
- Validation AIPD : les mesures techniques décrites sont-elles effectivement implémentées ?

---

## Phase 12 — PRÉPARATION DÉPLOIEMENT

### Environnements

| Env       | Données           | Conf            | But                          |
|-----------|-------------------|-----------------|------------------------------|
| dev       | synthétiques      | locale          | feedback rapide              |
| CI        | synthétiques      | éphémère        | quality gates                |
| review    | synthétiques      | preview/PR      | démonstration revue          |
| staging   | anonymisées prod  | parité prod     | validation produit / QA      |
| preprod   | anonymisées prod  | identique prod  | tests release / smoke        |
| prod      | réelles           | prod            | utilisateurs                 |
| dr (cold) | réplique chiffrée | prod            | reprise d'activité           |

**Parité d'environnements** : configuration par variables, secrets en gestionnaire dédié (Vault, KMS, sealed-secrets), images de conteneur identiques, mêmes versions runtime. Toute différence doit être *documentée* et *justifiée*.

**Anonymisation des données de prod vers staging** : techniques irréversibles (hash + salt sur PII directes, génération synthétique pour PII indirectes, k-anonymity pour les datasets analytiques). Outils : pgroll/pg_anonymizer, Greenmask, Gretel, ou scripts maison versionnés. Préserver l'intégrité référentielle (clés étrangères cohérentes) et la distribution statistique.

### Sauvegardes

- Stratégie 3-2-1 : 3 copies, 2 supports différents, 1 hors site.
- **Restauration testée** au moins trimestriellement (un backup non restauré n'est pas un backup).
- Chiffrement au repos et en transit.
- Durée de conservation alignée sur le registre de traitement RGPD.

### Migrations sans downtime — pattern expand/contract

Toujours en plusieurs déploiements distincts :

1. **Expand** : ajouter le nouveau (colonne, table, index, champ d'API). Backward-compatible.
2. **Migrate (dual-write)** : l'application écrit dans l'ancien ET le nouveau. Backfill des données existantes en lots.
3. **Switch read** : la lecture passe sur le nouveau. L'ancien reste écrit comme filet de sécurité.
4. **Contract** : suppression de l'ancien, après vérification qu'aucun client n'y accède (logs, requêtes).

Toute opération bloquante (ALTER lourd, RENAME, DROP) doit être faite avec des outils non bloquants : `pg_repack`, `gh-ost`, `pt-online-schema-change`, ou index `CONCURRENTLY` en PostgreSQL.

### Stratégies de déploiement

- **Direct** : seulement pour T/F.
- **Rolling** : par défaut pour stateless.
- **Blue/Green** : pour basculement instantané et rollback rapide.
- **Canary** (5 % → 25 % → 50 % → 100 %) : pour M+ ; piloté par SLO et erreurs.
- **Feature flags** : indispensable pour É/C ; permet de découpler déploiement et release.
- **Shadow / dark launch** : pour valider sous trafic réel sans impact utilisateur.

---

## Phase 13 — DÉPLOIEMENT

- Pipeline automatisé déclenché par merge sur `main` (Trunk-Based) ou tag SemVer (release branches).
- Vérification SLSA provenance et signature artefact avant promotion.
- Dépôt SBOM associé à l'artefact.
- Smoke tests post-déploiement (synthetic monitoring sur parcours critiques).
- Watch actif des SLO et error budget pendant la fenêtre de déploiement.
- Rollback en un clic (ou auto, si error budget brûle trop vite — *automated rollback on burn rate*).

---

## Phase 14 — SURVEILLANCE / OBSERVABILITÉ

L'observabilité est *by design* : pas un add-on de fin.

### Trois piliers + un (OpenTelemetry)
- **Logs structurés** (JSON, niveau, trace_id, user_id pseudonymisé).
- **Métriques** (RED : Rate, Errors, Duration ; USE : Utilization, Saturation, Errors ; ou Four Golden Signals : latency, traffic, errors, saturation).
- **Traces distribuées** (W3C Trace Context).
- **Profiling continu** pour les services critiques.

### SLO et error budgets

- Définir 2–3 SLI par service critique (ex : disponibilité, latence p99, exactitude).
- SLO interne plus strict que SLA externe (créer un buffer).
- **Multi-burn-rate alerting** (Google SRE) :
  - 14.4× sur 1 h + 5 min → page (urgence : 2 % budget brûlé en 1 h)
  - 6× sur 6 h → ticket (priorité haute)
  - 1× sur 3 j → info (tendance)
- **Politique d'error budget** : si épuisé, gel des features non urgentes, focus sur fiabilité jusqu'à reconstitution.

### Observabilité IA / LLM si applicable

- Tracer chaque appel LLM avec : modèle, tokens in/out, coût estimé, latence, user_id, feature_id.
- Métriques de qualité : taux de hallucination, taux de refus, satisfaction (pouce up/down).
- Outils : OpenLLMetry, Langfuse, Helicone, Datadog LLM Observability.

---

## Phase 15 — DOCUMENTATION

Documentation *en continu*, jamais en fin de cycle. Quatre types (Diátaxis) :

1. **Tutoriels** (apprentissage) : pour les nouveaux utilisateurs/devs.
2. **How-to guides** (tâches) : pour résoudre un besoin précis.
3. **Référence** (description) : API, schémas, configuration.
4. **Explication** (compréhension) : ADR, design docs, postmortems publiés.

Documentation *as code* : Markdown versionné, MkDocs/Docusaurus/Antora, ou Backstage TechDocs. Validation orthographe + liens en CI.

DORA a démontré qu'une documentation de qualité est un des prédicteurs les plus forts de la performance de livraison.

---

## Phase 16 — SUPPORT

- Runbooks par scénario (un runbook = un alert).
- On-call rotation équilibrée et pas plus d'une semaine consécutive.
- Outils : ticketing, status page publique, communication d'incident structurée (impact, ETA, actions).
- Capture systématique des nouveaux modes de défaillance dans les runbooks.

---

## Phase 17 — RÉTROSPECTIVE DE CYCLE

> **À ne pas confondre avec le postmortem (phase 18).**

- Périodique (fin de sprint / itération / release).
- Focus *processus* : qu'est-ce qui aide / freine l'équipe ?
- Format : Start/Stop/Continue, 4L, Mad/Sad/Glad, etc.
- Sortie : ≤ 3 actions concrètes avec owner et date.
- Mesurer SPACE périodiquement (Satisfaction, Performance, Activity, Communication, Efficiency) pour ne pas optimiser DORA au détriment du bien-être.

---

## Phase 18 — POSTMORTEM BLAMELESS (déclenché par incident)

> **Distinct de la rétrospective.** Déclenché par un événement, pas par un calendrier.

### Critères de déclenchement (à définir *avant* tout incident)

- Indisponibilité user-visible > X minutes
- Brèche ou near-miss de sécurité ou de privacy
- Perte de données
- Régression de SLO majeure
- Incident financier (FinOps : dépassement budget X %)
- Demande de toute partie prenante

### Principes (Google SRE)

- **Blameless** : on cherche les causes systémiques, pas les coupables. « Toute personne impliquée a agi avec de bonnes intentions sur la base de l'information dont elle disposait ».
- **Largement diffusé** : une organisation apprend si tout le monde lit les postmortems.
- **Action items SMART** avec owner, date, et issue tracker.
- Distinguer **trigger** (déclencheur), **cause root** (cause profonde), **où on a eu de la chance** (zones de fragilité non manifestées).

### Structure type

1. Résumé (TL;DR ≤ 5 lignes)
2. Impact (utilisateurs, durée, revenu, données)
3. Timeline (UTC, sources horodatées : alerte, première réponse, mitigation, résolution)
4. Cause racine (5 Whys, fishbone, ou méthode causale)
5. Ce qui a bien marché
6. Ce qui n'a pas bien marché
7. Où on a eu de la chance
8. Action items (correctifs immédiats, prévention, détection, processus)

### Solo

Tenir un journal d'incident avec ces sections, relu une semaine plus tard.

---

# 3. Activités continues transverses

Ces activités ne sont *pas* des phases : elles vivent dans toutes les phases.

## 3.1 Sécurité shift-left (DevSecOps)

Cadre : **NIST SSDF SP 800-218** (4 groupes : PO Prepare the Organization, PS Protect the Software, PW Produce Well-secured software, RV Respond to Vulnerabilities) + **OWASP SAMM v2** (Governance, Design, Implementation, Verification, Operations) + **OWASP ASVS v5** comme référentiel d'exigences applicables + **OWASP Top 10** comme inventaire des risques courants.

Pratiques :
- Threat modeling STRIDE itératif (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) sur les nouveaux flux.
- Pour menaces orientées privacy : LINDDUN.
- SAST + SCA + IaC scan + container scan + secrets scan en CI.
- DAST sur preprod.
- Supply-chain : SLSA niveau 2 minimum (provenance signée), niveau 3 visé pour produits critiques. SBOM CycloneDX ou SPDX. Signature Cosign/Sigstore. VEX pour exprimer la non-exploitabilité de CVE détectées.
- Gestion des vulnérabilités : SLA de remédiation par sévérité (ex : Critical 24 h, High 7 j, Medium 30 j).
- Rotation des secrets, principe du moindre privilège, MFA, zero-trust pour les ressources sensibles.

## 3.2 Privacy / RGPD by Design

Cadre : **Privacy by Design (Cavoukian, 7 principes)** + **RGPD art. 25 (Privacy by Design and by Default)** + **art. 35 (AIPD)** + **méthode CNIL PIA**.

Pratiques :
- **Registre de traitement** maintenu (responsable, finalité, base légale, catégories de données et de personnes, destinataires, transferts hors UE, durée de conservation, mesures de sécurité).
- **Minimisation** : ne collecter et ne stocker que le nécessaire (data audit annuel).
- **Durée de conservation** explicite par catégorie de données, automatisée (jobs de purge / archivage).
- **Droits des personnes** implémentés *avant* la mise en production : accès, rectification, effacement, portabilité, opposition, limitation, décision automatisée. Idéalement self-service ou délai contractuel ≤ 30 j.
- **Consentement** : explicite, granulaire, retirable aussi facilement que donné. Pas de cases pré-cochées. Stocker la preuve (timestamp, version du texte, contexte).
- **AIPD/DPIA** : obligatoire si traitement à risque élevé (art. 35 RGPD). Méthode CNIL en 7 étapes : description précise, évaluation nécessité/proportionnalité, identification risques (atteinte à la confidentialité, à l'intégrité, à la disponibilité), mesures techniques et organisationnelles, documentation avec avis DPO, consultation CNIL si risque résiduel élevé, révision périodique. Logiciel libre PIA de la CNIL disponible.
- **Pseudonymisation** des données en dev/staging/observabilité.
- **Chiffrement** : TLS en transit, AES-256 ou équivalent au repos, gestion de clés (KMS, HSM pour critique).
- **DPO** consulté pour tout nouveau traitement à risque.
- **Notification de violation** : 72 h à la CNIL, sans délai aux personnes si risque élevé.

Sectoriel : règles spécifiques santé (HDS), bancaire (DORA), enfants (GDPR-K), eIDAS pour identité.

## 3.3 FinOps / gestion des coûts

Cadre : **FinOps Foundation Framework 2024** (orienté *valeur*, pas seulement coût). 6 principes : collaboration des équipes, valeur métier guide les décisions, chacun s'approprie son usage, données accessibles et fiables, équipe FinOps centralisée habilite, modèle de coût variable du cloud.

Cycle FinOps : **Inform → Optimize → Operate**.

Pratiques :
- **Performance budget financier** : €/utilisateur actif, €/transaction, €/build, €/feature livrée.
- **Tagging** systématique des ressources cloud (équipe, produit, environnement, feature) — sans tag pas d'attribution.
- **Showback / chargeback** mensuel par équipe.
- **Coûts spécifiques à intégrer** :
  - Cloud (compute, storage, network egress).
  - **LLM/API** : tokens prompt + completion, latence, cache hit ratio. *« Be concise »* dans les prompts réduit 15–25 % du coût. Stratégies : caching sémantique (GPTCache), routing par tier (RouteLLM), prompt compression (LLMLingua), batch APIs (-50 %), gateway (LiteLLM, Portkey, Helicone) pour budget caps.
  - **Observabilité** : 5–15 % typique du coût cloud — un poste à surveiller (sampling intelligent, rétention différenciée).
  - **SaaS** (CI/CD minutes, IDE, error tracking, etc.).
- **Anomaly detection** : alerte si coût > X % au-dessus de la baseline.
- **Rightsizing** mensuel, suppression des ressources orphelines, réservations / savings plans pour la baseline.
- **Unit economics** : marge contributive d'une fonctionnalité IA = revenu - (coût LLM + coût infra + coût support).

## 3.4 Accessibilité by design

Cadre : **WCAG 2.2 niveau AA** (W3C, octobre 2023) + **EN 301 549 v3.2.1** (standard européen ICT) + **European Accessibility Act / Directive (UE) 2019/882** en vigueur depuis le **28 juin 2025** (pénalités nationales, exclusion de marché). En France : RGAA 4.x pour le secteur public, EAA pour le privé (services bancaires, e-commerce, ebook, transports, communications électroniques, etc.).

Principes WCAG (POUR) : Perceivable, Operable, Understandable, Robust.

Nouveautés WCAG 2.2 à intégrer :
- 2.4.11 Focus appearance (focus visible suffisamment contrasté et épais)
- 2.5.7 Dragging movements (alternative au drag)
- 2.5.8 Target size (≥ 24×24 px, exceptions limitées)
- 3.2.6 Consistent help (placement cohérent du support)
- 3.3.7 Redundant entry (pas redemander les mêmes infos)
- 3.3.8/9 Accessible authentication (pas de tests cognitifs)

Pratiques :
- HTML sémantique d'abord, ARIA seulement quand nécessaire (« first rule of ARIA: don't use ARIA »).
- Contraste ≥ 4.5:1 (texte normal), ≥ 3:1 (texte large, UI).
- Navigation clavier complète, focus visible et logique.
- Alternatives textuelles pour images informatives, vidéo sous-titrée, audio transcrit.
- Tests automatisés (axe-core, Pa11y, Lighthouse) en CI : couvre 30–40 % des critères.
- Tests manuels : lecteur d'écran (NVDA Windows, VoiceOver macOS/iOS, TalkBack Android), zoom 400 %, contraste élevé OS.
- Audit par expert et par utilisateurs en situation de handicap pour les produits critiques.
- **Déclaration d'accessibilité** publiée (obligatoire EAA + secteur public).

## 3.5 Internationalisation (i18n) et localisation (l10n) by design

Pratiques :
- **Aucune chaîne hardcodée** : tout passe par la lib i18n (i18next, FormatJS, gettext, ARB, Fluent, etc.).
- Format de message **ICU** pour gérer pluriels, genres, sélections.
- **Formats CLDR** délégués pour dates, heures, nombres, devises, durées, listes, unités.
- **CSS logical properties** (`margin-inline-start` au lieu de `margin-left`) pour préparer le RTL.
- **Attribut `dir`** et inversion d'icônes directionnelles pour les langues RTL (ar, he, fa, ur).
- **Pseudo-localisation** en CI (allongement +30 %, accentuation) pour détecter les chaînes oubliées et les troncatures.
- **Fallback** systématique vers une langue par défaut.
- **Pipeline TMS** (Phrase, Lokalise, Crowdin, Weblate) intégré en CI/CD.
- Test sur au moins une langue RTL et une langue à allongement (DE, FI).

## 3.6 Tests automatisés (continu)

Voir Phase 7 pour le modèle. À noter en continu :
- Les tests vivent *avec* le code, pas dans un repo séparé.
- Flaky tests = dette à éliminer (quarantaine + fix sous 1 sprint, sinon supprimer).
- Tests de non-régression issus des incidents (*every incident generates a test*).

## 3.7 Observabilité (continu)

Voir Phase 14. À noter en continu :
- Instrumentation **OpenTelemetry** standard, agnostique du backend.
- SLO documentés, error budget visible sur dashboard d'équipe.

## 3.8 Documentation (continu)

Voir Phase 15. *Docs as code*, dans le même repo que le code.

## 3.9 Versioning et stratégie de branches

### SemVer 2.0 (https://semver.org)

`MAJOR.MINOR.PATCH` (+ pré-release et build metadata)
- MAJOR : breaking change
- MINOR : nouvelle fonctionnalité backward-compatible
- PATCH : correctif backward-compatible

### Conventional Commits (https://www.conventionalcommits.org)

`type(scope): description` avec types `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `style`, `revert`. `BREAKING CHANGE:` dans le footer ou `!` après le type.

Permet le **changelog** automatique et l'incrémentation **SemVer** automatique (semantic-release, Release Please, Changesets).

### Stratégies de branches

| Stratégie              | Quand                                                       |
|------------------------|-------------------------------------------------------------|
| **Trunk-Based**        | CI/CD continue, équipes matures, déploiement multi-quotidien|
| **GitHub Flow**        | Web/SaaS, équipes intermédiaires                            |
| **Git Flow**           | Produits versionnés (firmware, lib publique, CLI), maintenance simultanée de plusieurs versions |
| **Release Trains**     | Grands programmes (SAFe), coordination multi-équipes        |

Trunk-Based est la stratégie qui corrèle le plus fortement avec la performance DORA top.

### Hotfix

- Branche éphémère depuis le tag de release prod.
- Correctif minimal, tests, déploiement express *avec* le même pipeline (pas de raccourci de quality gates).
- Merge back vers `main`.

---

# 4. Métriques

## 4.1 DORA (5 métriques officielles, version 2024/2025)

### Throughput
| Métrique                          | Top (≈ top 15 %) | High        | Medium       | Low           |
|-----------------------------------|------------------|-------------|--------------|---------------|
| **Change Lead Time**              | < 1 jour         | < 1 semaine | < 1 mois     | > 1 mois      |
| **Deployment Frequency**          | À la demande     | quotidien à hebdo | hebdo à mensuel | mensuel à trimestriel |
| **Failed Deployment Recovery Time** (anciennement MTTR, déplacé en throughput en 2024) | < 1 h | < 1 j | < 1 semaine | > 1 semaine |

### Stability
| Métrique                  | Cible                  |
|---------------------------|------------------------|
| **Change Failure Rate**   | < 5 %                  |
| **Rework Rate** (nouveau 2024) | À mesurer en interne, suivre la tendance |

### Reliability (quasi-métrique)
- Mesurée via SLO/SLI métier : disponibilité, latence, exactitude, fraîcheur.

⚠️ Loi de Goodhart : « lorsqu'une mesure devient une cible, elle cesse d'être une bonne mesure ». Ne pas gamifier. Suivre les *4 ensemble* — high deployment frequency + high change failure rate = problème, pas progrès.

## 4.2 SPACE (bien-être et productivité d'équipe)

5 dimensions, 1–3 indicateurs par dimension :
- **Satisfaction & well-being** : eNPS, fréquence de burnout, satisfaction outils.
- **Performance** : qualité livrée (defects user-reported), satisfaction client.
- **Activity** : commits, PRs, issues, déploiements (à *ne pas* utiliser pour évaluer un individu).
- **Communication & collaboration** : qualité de revue de code, doc accessibilité, temps de réponse PR.
- **Efficiency & flow** : temps non interrompu / jour, lead time, nombre de handoffs.

Mesurer SPACE *en plus* de DORA, jamais pour individu, jamais pour comparer équipes.

## 4.3 Qualité produit (ISO/IEC 25010:2023)

9 caractéristiques (révision 2023, ajout de **Safety**, renommages : *interaction capability* anciennement *usability*, *flexibility* anciennement *portability*) :

1. **Functional suitability** (completeness, correctness, appropriateness)
2. **Performance efficiency** (time behaviour, resource utilization, capacity)
3. **Compatibility** (co-existence, interoperability)
4. **Interaction capability** (appropriateness, learnability, operability, accessibility, UX, user error protection, self-descriptiveness)
5. **Reliability** (faultlessness, availability, fault tolerance, recoverability)
6. **Security** (confidentiality, integrity, non-repudiation, accountability, authenticity, resistance)
7. **Maintainability** (modularity, reusability, analysability, modifiability, testability)
8. **Flexibility** (adaptability, scalability, installability, replaceability)
9. **Safety** *(nouveau en 2023)* (operational constraint, risk identification, fail safe, hazard warning, safe integration)

Choisir 3–5 caractéristiques *prioritaires* par produit et définir des seuils mesurables.

## 4.4 Privacy

- Nombre d'AIPD à jour vs. traitements à risque.
- Délai moyen de réponse aux droits des personnes.
- Taux de consentement par catégorie.
- Volume de données minimisé par traitement (audit annuel).
- Délai de notification de violation (cible : 24 h interne, 72 h CNIL).

## 4.5 FinOps

- Coût unitaire (€/utilisateur, €/transaction, €/feature, €/token, €/build).
- Anomalie de coût (% > baseline).
- Couverture de tagging (% de ressources taguées).
- Utilisation des ressources (CPU, mémoire, GPU pour IA).
- Cache hit ratio (LLM, CDN).

## 4.6 Accessibilité

- Conformité WCAG 2.2 AA automatisée (% de violations / page critique).
- Conformité manuelle par parcours critique (% PASS).
- Délai moyen de remédiation des violations.
- NPS / satisfaction des utilisateurs en situation de handicap.

## 4.7 Culture (Westrum)

Sondage anonyme 6 questions (DORA) :
1. L'information est activement recherchée
2. Les messagers de mauvaises nouvelles ne sont pas punis
3. Les responsabilités sont partagées
4. La collaboration cross-fonctionnelle est encouragée et récompensée
5. Les échecs sont d'abord traités comme des opportunités d'amélioration du système
6. Les nouvelles idées sont bienvenues

Score moyen sur Likert 1–7. Cible : > 5,5. La culture générative est un *prédicteur* de la performance DORA.

---

# 5. Standards et frameworks de référence

| Domaine               | Référence                                    | Source                            |
|-----------------------|----------------------------------------------|-----------------------------------|
| Qualité produit       | ISO/IEC 25010:2023                           | iso.org                           |
| Tests                 | ISO/IEC/IEEE 29119                           | iso.org                           |
| Sécurité — cycle      | NIST SP 800-218 SSDF v1.1                    | csrc.nist.gov                     |
| Sécurité — IA         | NIST SP 800-218A                             | csrc.nist.gov                     |
| Sécurité — maturité   | OWASP SAMM v2                                | owaspsamm.org                     |
| Sécurité — exigences  | OWASP ASVS                                   | owasp.org                         |
| Sécurité — risques web| OWASP Top 10 (2021, mise à jour 2025)        | owasp.org                         |
| Threat modeling       | STRIDE (Microsoft) / LINDDUN (privacy)       | microsoft.com / linddun.org       |
| Supply chain          | SLSA + SBOM (CycloneDX, SPDX)                | slsa.dev / cyclonedx.org / spdx.dev |
| Privacy — règlement   | RGPD (UE) 2016/679 — art. 25, 32, 33, 35     | eur-lex.europa.eu                 |
| Privacy — méthode     | CNIL Guide PIA + logiciel PIA libre          | cnil.fr                           |
| Privacy — design      | Privacy by Design (Cavoukian, 7 principes)   | iapp.org                          |
| Accessibilité         | WCAG 2.2 (W3C)                               | w3.org/TR/WCAG22                  |
| Accessibilité — UE    | EN 301 549 v3.2.1, Directive (UE) 2019/882   | etsi.org / digital-strategy.ec.europa.eu |
| Accessibilité — FR    | RGAA                                         | accessibilite.numerique.gouv.fr   |
| FinOps                | FinOps Foundation Framework 2024 + FOCUS     | finops.org                        |
| Performance livraison | DORA (Accelerate, State of DevOps)           | dora.dev                          |
| Productivité équipe   | SPACE (Forsgren et al.)                      | queue.acm.org                     |
| Culture               | Westrum (typologie) + DORA culture           | dora.dev                          |
| Fiabilité             | Google SRE Book + SRE Workbook               | sre.google                        |
| Versioning            | SemVer 2.0                                   | semver.org                        |
| Commits               | Conventional Commits 1.0                     | conventionalcommits.org           |
| Observabilité         | OpenTelemetry                                | opentelemetry.io                  |
| Documentation         | Diátaxis Framework                           | diataxis.fr                       |
| Discovery             | Continuous Discovery Habits (T. Torres) ; JTBD ; Lean Startup | producttalk.org |

---

# 6. Anti-patterns à éviter

### Cycle et processus
- **Waterfall déguisé** : sprints de 2 semaines mais design 4 mois en avance, livraison en fin de trimestre.
- **No DoR / no DoD** : « on saura quand on y sera ».
- **Cycle complet pour tout changement** : la matrice risque → chemin n'est pas appliquée.
- **Discovery one-shot** : phase initiale puis plus jamais.
- **Tests en fin** : QA gate après dev, pas de shift-left.
- **MVP qui n'est qu'un prototype** envoyé en prod tel quel.

### Qualité et tests
- **100 % de couverture comme cible** au lieu de couverture des chemins critiques.
- **Tests E2E partout** : lents, fragiles, masquent l'absence d'unitaires.
- **Snapshot tests massifs** sur UI instable.
- **Mocks à tous les étages** qui testent les mocks, pas le code.

### Sécurité
- **Pen-test annuel = sécurité** : audit ponctuel sans shift-left.
- **CVE Critical ouverte > 30 j**.
- **Secrets en clair en repo** (un grep `password=` règle souvent ce point).
- **Threat modeling en grand atelier annuel** : il sera obsolète à la première feature.

### Privacy
- **AIPD après lancement** : violation directe de l'art. 35.
- **Données de prod en staging sans anonymisation**.
- **Consentement par cases pré-cochées** (illégal RGPD).
- **Pas de durée de conservation** : on garde tout « au cas où ».
- **Logs avec PII** non pseudonymisés.

### Accessibilité / i18n
- **Audit accessibilité une semaine avant release** : tout est à refaire.
- **Chaînes hardcodées** : « on internationalisera plus tard » → réécriture coûteuse.
- **Test sur RTL = jamais**.
- **Tests automatisés sans tests manuels** : 60 % des critères sont invisibles aux scanners.

### FinOps
- **Pas de tagging** : aucune attribution possible.
- **Pas de budget par feature** : explosions surprises.
- **Observabilité non échantillonnée** : peut représenter 30 % du cloud.
- **LLM facturé sans cap** : un agent en boucle peut brûler un budget mensuel en une nuit.

### Déploiement
- **Big-bang releases** : refonte de schéma + déploiement application en une nuit.
- **Pas de feature flag** pour les changements à risque.
- **Pas de plan de rollback testé**.
- **Données prod dans git** (commit accidentel = catastrophe).

### Culture
- **Postmortem = recherche du coupable** : tue la transparence pour des années.
- **Confondre rétrospective et postmortem**.
- **Métriques DORA gamifiées** : équipes qui découpent artificiellement leurs PR pour gonfler la deployment frequency.
- **Mesurer SPACE pour évaluer un individu** : transforme un outil de bien-être en outil de contrôle.

---

# 7. Annexes — checklists actionnables

## 7.1 Checklist de PR (à coller dans le template)

```
## Classe de risque
- [ ] T  - [ ] F  - [ ] M  - [ ] É  - [ ] C
Justification : ...

## DoD
- [ ] Tests automatisés écrits et passants
- [ ] Quality gates CI verts (SAST/SCA/lint/types)
- [ ] Couverture cohérente avec le risque
- [ ] Pas de secret commité (gitleaks vert)
- [ ] Documentation mise à jour (README/ADR/changelog)
- [ ] Observabilité (logs/metrics/traces) en place
- [ ] WCAG 2.2 AA respectée sur l'UI touchée
- [ ] Aucune chaîne hardcodée (i18n)
- [ ] Privacy : registre/consentement/durée à jour
- [ ] Impact FinOps documenté si M+
- [ ] Feature flag si É/C
- [ ] Plan de rollback si É/C
- [ ] Conventional commit
```

## 7.2 Checklist de threat modeling éclair (90 min max)

1. Dessiner le DFD (Data Flow Diagram) au tableau / Excalidraw.
2. Identifier les *trust boundaries*.
3. Pour chaque flux et chaque magasin de données, parcourir STRIDE :
   - **S**poofing : qui prétend être qui ?
   - **T**ampering : que peut-on modifier ?
   - **R**epudiation : qui peut nier l'action ?
   - **I**nformation disclosure : que peut-on lire ?
   - **D**enial of service : que peut-on saturer ?
   - **E**levation of privilege : que peut-on escalader ?
4. Lister les menaces, prioriser (impact × vraisemblance).
5. Définir les contremesures (mapper à OWASP ASVS si possible).
6. Pousser les contremesures dans le backlog avec owner.

## 7.3 Checklist AIPD / DPIA (méthode CNIL)

1. **Description précise** du traitement : finalités, parties prenantes, périmètre, support, données, processus.
2. **Nécessité et proportionnalité** : finalité explicite, base légale, qualité des données, durée de conservation, droits des personnes, sous-traitants.
3. **Risques** : confidentialité, intégrité, disponibilité — sources, événements redoutés, impacts, vraisemblance, gravité.
4. **Mesures** : techniques (chiffrement, pseudonymisation, contrôle d'accès, sauvegardes) et organisationnelles (politique, formation, audit).
5. **Documentation et avis du DPO**.
6. **Consultation CNIL** si risque résiduel élevé.
7. **Révision périodique** (au moins annuelle ou à chaque changement substantiel).

## 7.4 Checklist accessibilité minimum WCAG 2.2 AA

- [ ] Texte alternatif sur chaque image informative ; `alt=""` pour décoratif.
- [ ] Contraste ≥ 4.5:1 (texte) ; ≥ 3:1 (UI, gros texte).
- [ ] Navigation clavier complète, ordre logique, focus toujours visible.
- [ ] Liens et boutons identifiables hors couleur seule.
- [ ] Formulaires : label associé, message d'erreur explicite, autocomplete.
- [ ] Pas de piège au clavier ni de timeout non négociable.
- [ ] Vidéos sous-titrées ; audios transcrits.
- [ ] Sémantique HTML correcte (`<button>` pas `<div onclick>`).
- [ ] ARIA seulement quand HTML ne suffit pas.
- [ ] Test axe-core en CI ; test manuel avec lecteur d'écran sur parcours critiques.
- [ ] Target size ≥ 24×24 px.
- [ ] Pas de saisie redondante dans un même flow.
- [ ] Help cohérent à la même position.
- [ ] Déclaration d'accessibilité publiée.

## 7.5 Checklist déploiement à risque

- [ ] Annoncé aux parties prenantes.
- [ ] Feature flag activé OFF par défaut.
- [ ] Migrations en mode expand (pas de contract dans ce déploiement).
- [ ] Plan de rollback testé en staging.
- [ ] SLO et error budget surveillés en temps réel.
- [ ] Canary 5 % → 25 % → 50 % → 100 % avec gates SLO.
- [ ] Smoke tests post-déploiement.
- [ ] Statut publié sur status page.
- [ ] Postmortem prévu si échec.

---

## Recommendations

### Étape 1 — Fondations (semaines 0–4)
1. **Adopter immédiatement** : DoR/DoD écrites, Conventional Commits, SemVer, quality gates CI minimaux (lint + tests + SAST + SCA + secrets), feature flags, logs structurés.
2. **Documenter la matrice risque → chemin** et l'afficher dans le repo (`CONTRIBUTING.md` ou `PROCESS.md`).
3. **Mesurer la baseline DORA** (deployment frequency, lead time, change failure rate, recovery time) — même grossièrement.
4. **Lancer le sondage Westrum** (6 questions, anonyme) pour fixer un point de départ culturel.

**Seuil de succès pour passer à l'étape 2** : DoR/DoD respectées sur 80 % des PR, CI rouge bloque le merge dans 100 % des cas, baseline DORA chiffrée.

### Étape 2 — Shift-left et observabilité (mois 2–3)
5. **Compléter le shift-left sécurité** : IaC scan, container scan, threat modeling sur les nouvelles fonctionnalités É/C, SBOM en pipeline, signature artefact (Sigstore).
6. **Instrumenter OpenTelemetry** sur les services critiques + définir 1–2 SLO par service avec alerting multi-burn-rate.
7. **Mettre en place les environnements** (dev / CI / preview / staging / preprod / prod) avec parité de configuration et anonymisation des données vers staging.
8. **Adopter le pattern expand/contract** pour toute migration de schéma.

**Seuil** : SLO mesurés et publics, aucune CVE Critical en prod > 24 h, expand/contract appliqué à 100 % des migrations.

### Étape 3 — Privacy, accessibilité, FinOps (mois 3–6)
9. **Privacy by design** : registre de traitement vivant, AIPD pour traitements à risque, droits des personnes self-service ou ≤ 30 j, anonymisation prod → staging.
10. **Accessibilité by design** : axe-core en CI, audit manuel WCAG 2.2 AA sur 1–3 parcours critiques, déclaration d'accessibilité publiée, formation équipe.
11. **i18n by design** : extraction des chaînes, pseudo-localisation, tests RTL si marché concerné.
12. **FinOps** : tagging 100 %, performance budget par feature critique, monitoring coût LLM si applicable.

**Seuil** : EAA-ready si UE, AIPD à jour, coût unitaire (€/utilisateur ou €/transaction) connu et stable.

### Étape 4 — Discovery et apprentissage (mois 6+)
13. **Continuous Discovery** : product trio, ≥ 1 entretien utilisateur / semaine, opportunity solution tree à jour.
14. **Postmortem blameless** systématique, distinct de la rétrospective ; bibliothèque de postmortems internes lisible par tous.
15. **Mesurer SPACE** trimestriellement, jamais individuellement.
16. **Viser top quartile DORA** : Trunk-Based Development complet, déploiements multi-quotidiens, lead time < 1 jour, change failure rate < 5 %, recovery < 1 h.

**Seuils déclencheurs de changement de cap** :
- Si change failure rate > 15 % pendant 3 sprints → geler les features, renforcer les tests et le risk-based testing.
- Si error budget brûlé > 100 % en milieu de période → focus fiabilité 100 % jusqu'à reconstitution.
- Si eNPS / satisfaction SPACE en chute > 1 point → audit charge de travail et on-call.
- Si coût unitaire dérive > 20 % sans justification de valeur → audit FinOps + revue d'architecture.
- Si > 1 incident/mois sur la même classe de cause → arrêt et investissement structurel.

---

## Caveats

- **Ce document est un cadre, pas un dogme**. Toute équipe doit l'adapter à son contexte (taille, secteur, réglementation, maturité). Une startup pré-PMF n'aura pas le même seuil de rigueur qu'une banque sous DORA UE.
- **Les seuils DORA évoluent**. Les valeurs « top / high / medium / low » sont issues du rapport DORA 2024/2025 ; le rapport 2025 a abandonné le label « Elite » au profit d'une distribution en percentiles. Recalibrer annuellement.
- **L'OWASP Top 10 « 2024 » n'existe pas** : la mise à jour officielle de la liste 2021 est attendue en 2025. Référencer la version courante à la date du document.
- **WCAG 2.2 vs EN 301 549** : EN 301 549 v3.2.1 référence encore WCAG 2.1 AA pour la conformité juridique stricte ; WCAG 2.2 est best-practice et sera intégré à la prochaine version harmonisée d'EN 301 549. Viser WCAG 2.2 AA aujourd'hui pour anticiper.
- **NIST SSDF v1.2 est en draft** (dépôt initial public 17/12/2025) ; v1.1 reste la version officielle de référence.
- **ISO/IEC 25010:2023** introduit *safety* et renomme *usability* en *interaction capability* et *portability* en *flexibility* ; certaines sources continuent d'utiliser la terminologie 2011.
- **Métriques d'IA et DORA** : le rapport DORA 2024 montre que l'adoption d'outils IA *individuels* corrèle avec une *baisse* de la performance de livraison globale (effet *batch size* qui augmente). Adopter avec discernement et mesurer.
- **Mode solo** : certaines pratiques perdent de leur force (peer review, postmortem collectif, sondage culture). Les compenser par discipline écrite (journal, ADR systématiques, self-review différée, agent IA antagoniste) sans les abandonner.
- **Réglementaire** : ce document n'est pas un avis juridique. Pour RGPD, EAA, DORA, NIS2, secteur santé/finance, consulter un DPO ou conseil juridique. Les sanctions citées (RGPD jusqu'à 20 M€ ou 4 % du CA mondial pour les manquements les plus graves, 10 M€ ou 2 % pour défaut d'AIPD) sont des plafonds, pas des amendes mécaniques.
- **Sources commerciales et marketing** : plusieurs sources consultées (vendeurs de plateformes FinOps, outils d'accessibilité, observabilité) présentent leurs produits sous un jour favorable. Les concepts retenus dans ce document sont ceux qui font consensus dans la littérature ouverte (W3C, NIST, OWASP, FinOps Foundation, Google SRE, DORA), pas dans le marketing produit.