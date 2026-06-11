# Activités Transversales — Architecture Cross-Cutting

> **Document** : Architecture des activités qui traversent les 8 cycles de la Pipeline Fractale v4
> **Statut** : Référence normative
> **Date** : 2026-05-03
> **Version** : 1.0
> **Périmètre** : Solo dev + AI — Architecture uniquement, aucune implémentation

---

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Portée transversale](#2-portée-transversale)
3. [Objectif](#3-objectif)
4. [Entrées — déclencheurs par cycle](#4-entrées--déclencheurs-par-cycle)
5. [Sorties — preuves et artefacts de conformité](#5-sorties--preuves-et-artefacts-de-conformité)
6. [Concepts clés — chaque activité définie](#6-concepts-clés--chaque-activité-définie)
7. [Critères qualité — ISO 25010:2023](#7-critères-qualité--iso-250102023)
8. [Modulation par classe de risque](#8-modulation-par-classe-de-risque)
9. [Application par cycle — matrice activité × cycle](#9-application-par-cycle--matrice-activité--cycle)
10. [Interactions entre activités transversales](#10-interactions-entre-activités-transversales)
11. [Artefacts produits](#11-artefacts-produits)
12. [Métriques et indicateurs](#12-métriques-et-indicateurs)
13. [Standards de référence](#13-standards-de-référence)
14. [Questions ouvertes — RED CARDS](#14-questions-ouvertes--red-cards)
15. [Relations avec chaque cycle](#15-relations-avec-chaque-cycle)

---

## 1. Résumé exécutif

La Pipeline Fractale v4 repose sur deux couches complémentaires : les **8 cycles séquentiels** (`discovery → cadrage → conception → build → validation → release → run → learning`) et les **activités transversales**, qui s'appliquent en continu à travers tous les cycles, indépendamment de la phase en cours.

Ce document formalise les 12 disciplines transversales :

| # | Activité | Standard pivot |
|---|----------|----------------|
| AT-01 | Sécurité (DevSecOps) | NIST SSDF SP 800-218 v1.1 + OWASP SAMM v2 |
| AT-02 | Documentation vivante | Diátaxis + ADR (Nygard) |
| AT-03 | Tests non fonctionnels transversaux | ISO/IEC/IEEE 29119 |
| AT-04 | Accessibilité | WCAG 2.2 AA + EAA (28 juin 2025) |
| AT-05 | Conformité réglementaire (Privacy) | RGPD art. 25/35 + CNIL PIA |
| AT-06 | Performance | Core Web Vitals + SLO/SLI |
| AT-07 | Observabilité | OpenTelemetry + Google SRE |
| AT-08 | Gestion de configuration | IaC + Secrets Management |
| AT-09 | Dette technique | SQALE + TDR |
| AT-10 | Revue de code | PR checklist + quality gates |
| AT-11 | Formation continue (harness self-improvement) | DORA + SPACE |
| AT-12 | Internationalisation / Localisation (i18n/l10n) | ICU MessageFormat + CLDR |

**Principe directeur** : ces activités ne sont pas des phases — elles n'ont ni début ni fin dans le cycle. Elles sont **toujours actives**, avec une intensité modulée par la **classe de risque T/L/M/H/C** du changement en cours.

**Top 3 points critiques** :
1. L'EAA est en vigueur depuis le 28 juin 2025 : pénalités jusqu'à 100 000 € ou 4 % du CA annuel pour non-conformité. WCAG 2.2 AA est la baseline de fait.
2. NIST SSDF v1.2 est en draft public (publié 17/12/2025, commentaires fermés 30/01/2026) — v1.1 reste la référence officielle opérationnelle.
3. OWASP Top 10 2025 est officiel : A01 Broken Access Control reste en tête ; A10 Mishandling of Exceptional Conditions est nouveau ; A06 renommé Software Supply Chain Failures.

---

## 2. Portée transversale

### 2.1 Ce qui est IN SCOPE

Les activités transversales couvrent **tous les artefacts produits** dans les 8 cycles :

- Code source, tests, migrations de schéma
- Infrastructure as Code (IaC), configuration, secrets
- Documentation (specs, ADR, runbooks, changelog)
- Pipelines CI/CD et scripts d'automatisation
- Données — notamment données personnelles et données de santé
- Interfaces utilisateur (accessibilité, performance front)
- Contrats d'API (sécurité des surfaces d'exposition)

### 2.2 Ce qui est OUT OF SCOPE

- La logique fonctionnelle métier spécifique à un cycle (ex : stratégie canary → cycle Release)
- Les décisions d'architecture de features (→ cycle Conception)
- Les postmortems d'incident (→ cycle `learning`)
- La certification réglementaire externe (ISO 9001, SOC 2, HDS) — compatible mais non couverte ici

### 2.3 Relation phases / activités

```
┌──────────────────────────────────────────────────────────────────────────┐
│         ACTIVITÉS TRANSVERSALES (toujours actives, intensité modulée)    │
│  AT-01 Sécurité │ AT-02 Docs │ AT-03 Tests NF │ AT-04 A11y │ AT-05 RGPD │
│  AT-06 Perf │ AT-07 Obs │ AT-08 Config │ AT-09 Dette │ AT-10 Review │ AT-11 │ AT-12 │
└──────┬───────────────────────────────────────────────────────────────────┘
       │ imprègnent
       ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│discovery │→│ cadrage  │→│conception│→│  build   │→│validation│
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
                                                           │
┌──────────┐ ┌──────────┐ ┌──────────┐ ◄──────────────────┘
│ learning │←│   run    │←│ release  │
└──────────┘ └──────────┘ └──────────┘
```

---

## 3. Objectif

### 3.1 Objectif principal

Garantir que **toute modification du système**, indépendamment de sa taille ou de son cycle d'appartenance, satisfait un ensemble invariant d'exigences non fonctionnelles, réglementaires et de qualité — sans friction excessive sur les petits changements et sans compromis sur les changements à risque élevé.

### 3.2 Objectifs spécifiques par discipline

| Activité | Objectif |
|----------|---------|
| AT-01 Sécurité | Zéro CVE Critical non traitée en production ; threat model à jour pour tout flux H/C |
| AT-02 Documentation | Aucune décision technique orpheline ; docs as code synchronisées avec le code |
| AT-03 Tests NF | Régressions de perf/sécurité/a11y détectées avant merge, pas après déploiement |
| AT-04 Accessibilité | Conformité WCAG 2.2 AA vérifiable par audit ; EAA-ready pour toute UI livrée |
| AT-05 Privacy | RGPD art. 35 respecté ; AIPD à jour pour tout traitement à risque ; droits des personnes implémentés |
| AT-06 Performance | SLO et budgets de performance respectés ; régressions bloquées en CI |
| AT-07 Observabilité | Toute anomalie en production détectable via logs/métriques/traces avant impact utilisateur |
| AT-08 Config | Zéro secret en clair dans le code ; IaC versionnée et auditée |
| AT-09 Dette | TDR < 5 % maintenu ; dette identifiée et tracée dans le backlog |
| AT-10 Revue | Quality gates non contournables ; revue couvre sécurité, a11y, privacy, perf |
| AT-11 Formation | Harness auto-amélioré ; rétrospectives actionnables ≤ 3 items par cycle |

---

## 4. Entrées — déclencheurs par cycle

Chaque activité transversale est **déclenchée différemment selon le cycle** dans lequel un changement se trouve. Le tableau suivant liste les déclencheurs principaux.

### 4.1 Déclencheurs AT-01 Sécurité

| Cycle | Déclencheur |
|-------|------------|
| discovery | Classification initiale du risque — touche-t-on authentification, données perso, paiement ? |
| cadrage | Contraintes réglementaires identifiées (RGPD, secteur financier, santé) |
| conception | Nouveau flux de données → threat modeling STRIDE ; nouvelle API publique → OWASP ASVS |
| build | Tout commit → SAST + SCA + secrets scan en pré-commit |
| validation | Tout PR en classe H/C → DAST sur preprod |
| release | Vérification SLSA provenance + signature artefact + SBOM avant promotion |
| run | CVE nouvellement publiée affectant une dépendance → déclenchement SCA différentiel |
| learning | Incident de sécurité → postmortem + threat model mis à jour |

### 4.2 Déclencheurs AT-02 Documentation

| Cycle | Déclencheur |
|-------|------------|
| discovery | Décision de ne pas construire / pivot → note de discovery versionnée |
| cadrage | Nouvelle contrainte, scope change → mise à jour charter |
| conception | Décision architecturale → ADR obligatoire ; nouveau service → doc API (OpenAPI/AsyncAPI) |
| build | Feature user-facing → changelog ; comportement observable → inline doc |
| validation | Critères d'acceptation finaux → docs produit |
| release | Release notes ; mise à jour status page |
| run | Nouveau mode de défaillance → runbook |
| learning | Postmortem publié → base de connaissance interne |

### 4.3 Déclencheurs AT-04 Accessibilité

| Cycle | Déclencheur |
|-------|------------|
| cadrage | Produit destiné à des utilisateurs EU → EAA applicable → budget a11y inclus |
| conception | Nouveaux composants UI → plan d'accessibilité (ARIA, sémantique, contrastes) |
| build | Tout commit touchant du HTML/CSS → axe-core en CI |
| validation | Parcours critiques → test manuel lecteur d'écran ; régression WCAG bloque le merge |
| release | Déclaration d'accessibilité mise à jour |
| learning | Rapport de conformité → backlog remédiation |

### 4.4 Déclencheurs AT-05 Privacy

| Cycle | Déclencheur |
|-------|------------|
| discovery | Identification de données personnelles dans la solution envisagée |
| cadrage | ≥ 2 critères WP29 cochés → AIPD obligatoire avant `conception` |
| conception | Nouveau traitement → registre de traitement ; AIPD si seuil RGPD atteint |
| build | Nouvelle collecte de données → consentement + durée de conservation |
| validation | Vérification que les mesures AIPD sont effectivement implémentées |
| release | Mention légale et politique de confidentialité à jour |
| run | Exercice de droits des personnes → traitement ≤ 30 jours |
| learning | Violation de données → notification CNIL ≤ 72 h + revue AIPD |

---

## 5. Sorties — preuves et artefacts de conformité

### 5.1 Preuves de sécurité (AT-01)

| Artefact | Format | Cycle source |
|----------|--------|-------------|
| Rapport SAST | JSON/HTML (Semgrep, CodeQL) | Build / CI |
| Rapport SCA | JSON (OSV-Scanner, Trivy) | Build / CI |
| Rapport DAST | HTML (OWASP ZAP, Burp) | Validation |
| Threat model | Markdown (DFD + table STRIDE) | Conception |
| SBOM | CycloneDX JSON ou SPDX | Release / CI |
| Signature artefact | Cosign bundle | Release |
| SLSA provenance | SLSA attestation JSON | Release |
| Registre CVE | JSONL append-only | Run |
| VEX | CycloneDX VEX | Run |

### 5.2 Preuves de conformité RGPD (AT-05)

| Artefact | Format | Responsable |
|----------|--------|------------|
| Registre de traitement | Markdown / CNIL template | Solo dev / DPO |
| AIPD complète | Logiciel PIA CNIL | Solo dev + DPO |
| Preuve de consentement | Log signé (timestamp, version texte) | Application |
| Déclaration de violation | Email CNIL structuré + log | Solo dev |
| Politique de durée de conservation | Markdown + job de purge | Application |

### 5.3 Preuves d'accessibilité (AT-04)

| Artefact | Format | Fréquence |
|----------|--------|----------|
| Rapport axe-core | JSON / HTML | Chaque CI run |
| Rapport Lighthouse a11y | JSON | Chaque PR sur UI |
| Rapport test manuel NVDA/VoiceOver | Markdown | Chaque livraison M+ |
| Déclaration d'accessibilité | HTML public | À chaque release |

### 5.4 Preuves de qualité (AT-09, AT-10)

| Artefact | Format | Cycle source |
|----------|--------|-------------|
| Quality execution matrix | Markdown (02-quality-execution.md) | Chaque sprint |
| SonarQube / Semgrep TDR | JSON | CI |
| PR review checklist | Markdown template | Build |
| ADR signé | Markdown (docs/13-decisions/) | Conception / Build |

---

## 6. Concepts clés — chaque activité définie

### AT-01 — Sécurité DevSecOps

**Définition** : Intégration de la sécurité dans chaque étape du cycle de développement (shift-left), plutôt qu'en contrôle tardif. Repose sur la combinaison SAST + DAST + SCA + IaC scanning + container scanning + secrets scan + SBOM + threat modeling.

**Cadre normatif** :
- **NIST SSDF SP 800-218 v1.1** — 4 groupes de pratiques : PO (Prepare the Organization), PS (Protect the Software), PW (Produce Well-secured Software), RV (Respond to Vulnerabilities). Draft v1.2 publié 17/12/2025 — ajoute des pratiques pour IA/ML et supply chain ; v1.1 reste la référence opérationnelle.
- **OWASP SAMM v2** — 5 business functions (Governance, Design, Implementation, Verification, Operations), 15 pratiques de sécurité, 3 niveaux de maturité.
- **OWASP Top 10:2025** — officiel, basé sur 175 000 CVE et 589 CWE. Nouveauté : A10 Mishandling of Exceptional Conditions ; A06 renommé Software Supply Chain Failures.
- **OWASP ASVS v5** — référentiel d'exigences applicatives.

**Threat modeling** :
- Méthode STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) — sur tout flux nouveau ou modifié, H/C obligatoire.
- Méthode LINDDUN pour les menaces privacy.
- Format : DFD au tableau / Excalidraw, 90 min max, sortie = table de menaces priorisées dans le backlog.

**Supply chain** :
- **SLSA niveau ≥ 2 obligatoire** (provenance signée et vérifiable sur CI hosted), niveau 3 visé pour produits critiques (build hermétique et auditable).
- **SBOM CycloneDX ou SPDX** — généré à chaque release, attaché à l'artefact dans le registre immuable.
- **Signature Cosign/Sigstore** — signature cryptographique de tout artefact de release, vérifiable avant déploiement.
- VEX (Vulnerability Exploitability eXchange) pour qualifier les CVE non exploitables.

**SLA de remédiation CVE** :

| Sévérité | SLA |
|----------|-----|
| Critical | 24 heures |
| High | 7 jours |
| Medium | 30 jours |
| Low | 90 jours ou next release |

---

### AT-02 — Documentation vivante

**Définition** : La documentation vit dans le même dépôt que le code, versionnée, mise à jour en continu — jamais en fin de cycle. Elle suit le framework **Diátaxis** (4 types) et les **ADR** pour les décisions architecturales.

**4 types Diátaxis** :
1. **Tutoriels** — apprentissage guidé (nouveaux devs, onboarding)
2. **How-to guides** — résolution d'un besoin précis (runbooks, recettes)
3. **Référence** — description exhaustive (API, schémas, configuration)
4. **Explication** — compréhension approfondie (ADR, design docs, postmortems)

**ADR (Architecture Decision Records)** — standard Nygard/adr.github.io :
- Un ADR par décision qui affecte structure, caractéristiques non-fonctionnelles, dépendances, interfaces.
- Statuts : Proposed → Accepted → Superseded / Deprecated / Rejected.
- Emplacement : `docs/13-decisions/ADR-NNN-titre.md`.
- Peer review systématique avant finalisation (en solo : relecture différée + agent IA antagoniste).
- Revue périodique pour détecter les décisions "decay" (Amazon AWS Well-Architected recommande la revue annuelle).

**Docs as code** :
- Markdown versionné, pas de Notion/Confluence/Obsidian (désynchronisation, rupture d'ingestion LLM).
- Validation orthographe + liens cassés en CI (vale, markdownlint, lychee).
- MkDocs / Docusaurus pour les docs publiées.

**Économie de tokens** : `.planning/` = minimum nécessaire à la prochaine décision. `docs/` = fond, complet, à jour.

---

### AT-03 — Tests non fonctionnels transversaux

**Définition** : Ensemble des tests qui valident les qualités du système (comment il se comporte) plutôt que ses fonctionnalités (ce qu'il fait). Comprend tests de performance, sécurité, accessibilité, compatibilité, robustesse.

**Portée** (complémentaire aux tests fonctionnels du cycle Build) :

| Type | Outils | Déclenchement |
|------|--------|--------------|
| Tests de charge / stress | k6, Artillery, Locust | H/C — staging pre-release |
| Tests de sécurité (DAST) | OWASP ZAP, Burp Suite | H/C — staging pre-release |
| Tests d'accessibilité auto | axe-core, Pa11y, Lighthouse | Chaque PR (UI touchée) |
| Tests d'accessibilité manuels | NVDA, VoiceOver, TalkBack | M+ — pre-release |
| Tests de contrat | Pact | Toute API inter-services |
| Tests de mutation | Stryker, PIT | Zones critiques — score > 70 % |
| Tests de compatibilité navigateur | BrowserStack / Playwright | M+ |
| Tests de régression visuelle | Percy, Chromatic | UI stable uniquement |

**Pyramid vs Trophy vs Honeycomb** — choix explicite, documenté en ADR :
- Backend dense en logique → Pyramide (Cohn/Fowler)
- Frontend / intégration API → Trophée (Dodds)
- Microservices → Honeycomb (Spotify)

**Flaky tests** : quarantaine immédiate + fix ≤ 1 sprint, sinon suppression. Un flaky test non résolu dégrade la confiance dans la CI entière.

**Incident → test** : tout incident de production génère au moins un test de non-régression.

---

### AT-04 — Accessibilité

**Définition** : Conception et vérification continues de l'accessibilité numérique selon WCAG 2.2 AA, conformément aux obligations légales de l'European Accessibility Act (EAA) en vigueur depuis le 28 juin 2025.

**Cadre légal 2025** :
- **EAA / Directive (UE) 2019/882** — en vigueur depuis le 28 juin 2025. S'applique à tout service numérique proposé dans l'UE : e-commerce, services bancaires, transport, communications, ebooks. Sanctions : jusqu'à 100 000 € ou 4 % du CA annuel.
- **EN 301 549 v3.2.1** — standard harmonisé européen. Référence WCAG 2.1 aujourd'hui ; mise à jour en cours vers WCAG 2.2 — viser WCAG 2.2 AA dès maintenant pour anticiper.
- **WCAG 2.2 AA** (W3C, octobre 2023) — 6 nouveaux critères à intégrer.

**6 nouveaux critères WCAG 2.2 à intégrer dès la Conception** :
- **2.4.11 Focus Appearance** — focus visible suffisamment contrasté (≥ 3:1) et épais (≥ 2 px)
- **2.5.7 Dragging Movements** — alternative à tout geste de drag
- **2.5.8 Target Size** — cible interactive ≥ 24×24 px (exceptions limitées)
- **3.2.6 Consistent Help** — aide toujours au même endroit dans les pages similaires
- **3.3.7 Redundant Entry** — ne pas redemander des informations déjà saisies dans le même formulaire
- **3.3.8 / 3.3.9 Accessible Authentication** — pas de test cognitif pour s'authentifier

**Règle ARIA** : « First rule of ARIA: don't use ARIA ». HTML sémantique d'abord.

**Seuils minimaux** :
- Contraste texte ≥ 4.5:1 (texte normal), ≥ 3:1 (texte large ≥ 18 pt, UI)
- Navigation clavier complète, ordre de focus logique
- Tests automatisés (axe-core) couvrent 30–40 % des critères WCAG — tests manuels indispensables

**Déclaration d'accessibilité** : obligatoire EAA + secteur public français. À publier, à maintenir, à dater.

---

### AT-05 — Conformité réglementaire (Privacy / RGPD)

**Définition** : Mise en œuvre continue du Privacy by Design (Cavoukian, 7 principes) et des obligations RGPD — registre de traitement, AIPD, droits des personnes, durées de conservation, notification de violation.

**Cadre légal** :
- **RGPD art. 25** — Privacy by Design and by Default
- **RGPD art. 35** — Analyse d'Impact relative à la Protection des Données (AIPD/DPIA) obligatoire avant la mise en œuvre si risque élevé
- **Méthode CNIL PIA** — logiciel open source + guide méthodologique en 4 étapes

**Déclencheur AIPD — 9 critères CNIL (≥ 2 = obligation)** :
1. Évaluation ou scoring
2. Décision automatisée avec effets légaux
3. Surveillance systématique
4. Données sensibles ou hautement personnelles
5. Traitement à grande échelle
6. Croisement ou combinaison de données
7. Données de personnes vulnérables (enfants, patients, salariés)
8. Usage innovant ou application de nouvelles solutions technologiques
9. Empêche l'exercice d'un droit ou l'accès à un service/contrat

**Registre de traitement** — éléments obligatoires :
- Responsable du traitement, finalité, base légale
- Catégories de données et de personnes concernées
- Destinataires, transferts hors UE
- Durée de conservation + mécanisme de purge automatisé
- Mesures de sécurité techniques et organisationnelles

**Droits des personnes** — implémentés avant mise en production :
- Accès, rectification, effacement, portabilité, opposition, limitation, décision automatisée
- Délai légal : 1 mois (prorogeable 2 mois si complexité justifiée)
- Self-service ou process documenté ≤ 30 jours

**Notification de violation** :
- 72 h à la CNIL après constatation
- Sans délai aux personnes concernées si risque élevé
- Documentation interne systématique (registre de violations)

**Spécificités sectorielles** : données de santé → HDS obligatoire ; bancaire → DORA (règlement UE 2022/2554) ; enfants → GDPR-K.

---

### AT-06 — Performance

**Définition** : Définition, mesure et respect continu des budgets de performance technique et financier à travers tout le cycle de développement.

**Budgets de performance technique** — à définir en Cadrage, à défendre en CI :

| Métrique | Cible recommandée | Outil |
|----------|------------------|-------|
| LCP (Largest Contentful Paint) | ≤ 2,5 s (Good) | Lighthouse CI, CrUX |
| INP (Interaction to Next Paint) | ≤ 200 ms (Good) | Lighthouse CI |
| CLS (Cumulative Layout Shift) | ≤ 0,1 (Good) | Lighthouse CI |
| Bundle JS | Défini par projet | size-limit, bundlesize |
| TTFB (Time To First Byte) | ≤ 800 ms | WebPageTest |
| Latence API p99 | Défini en SLO | OpenTelemetry, k6 |
| Disponibilité | Défini en SLO (ex : 99,9 %) | Uptime monitoring |

**Budgets de performance financier (FinOps)** — à documenter en Cadrage :
- €/utilisateur actif mensuel
- €/transaction ou €/requête critique
- €/build CI
- €/token LLM (si applicable)
- Seuil d'anomalie : alerte si > +20 % vs baseline sur 24 h

**FinOps Foundation — 6 principes directeurs** (finops.org/framework, 2024) :

1. **Inform** — Rendre les coûts visibles et transparents à tous les niveaux (dashboard coût par service, par feature, par environnement).
2. **Optimize** — Identifier et éliminer le gaspillage (ressources idle, overprovisioning, instances non utilisées).
3. **Operate** — Intégrer la conscience coût dans les processus quotidiens de développement et d'opérations.
4. **Value** — Aligner les dépenses cloud sur la valeur métier délivrée (coût par utilisateur, coût par transaction).
5. **Align** — Garantir que les équipes (ici : le solo dev + agent) sont responsables de leurs coûts et ont les outils pour les gérer.
6. **Improve** — Améliorer continuellement les pratiques FinOps via des rétrospectives et des benchmarks.

Référence : `docs/transversal/quality-model.md` §6.3 (Performance Efficiency — Resource Utilization) et FinOps Foundation Framework 2024.

**Profiling first** : ne pas optimiser sans mesurer. Profiling continu sur les services critiques.

**Tests de charge** — obligatoires pour H/C sur staging avec données anonymisées de production.

**Régression de performance** : tout PR qui dégrade un budget de performance de plus de 10 % est bloqué en CI (sauf waiver explicite tracé).

---

### AT-07 — Observabilité

**Définition** : Capacité à comprendre l'état interne du système à partir de ses sorties externes — sans avoir besoin de relancer le système ou d'inspecter le code. Repose sur les 3 piliers : logs structurés, métriques, traces distribuées.

**Standard** : **OpenTelemetry** — vendor-neutral, CNCF, supporté par 90+ vendors. Stabilisé en 2025 sur Traces, Metrics, Logs. Profiling en cours de stabilisation. Standard de fait pour l'instrumentation.

**3 piliers + profiling** :

| Pilier | Format | Standard |
|--------|--------|---------|
| **Logs structurés** | JSON, niveau, trace_id, user_id pseudonymisé | OpenTelemetry Logs |
| **Métriques** | RED (Rate, Errors, Duration) ou USE (Utilization, Saturation, Errors) ou Four Golden Signals | OpenTelemetry Metrics |
| **Traces distribuées** | W3C Trace Context | OpenTelemetry Traces |
| **Profiling continu** | CPU/mémoire/IO | Pyroscope, pprof |

**SLO / error budgets (Google SRE)** :
- 2–3 SLI par service critique (disponibilité, latence p99, exactitude)
- SLO interne plus strict que SLA externe (buffer)
- **Multi-burn-rate alerting** :
  - 14.4× sur 1 h + 5 min → page (2 % budget brûlé en 1 h)
  - 6× sur 6 h → ticket haute priorité
  - 1× sur 3 j → tendance information
- **Politique error budget** : si épuisé → gel features non urgentes, focus fiabilité

**Observabilité IA/LLM** (si applicable) :
- Tracer chaque appel : modèle, tokens in/out, coût estimé, latence, user_id, feature_id
- Métriques de qualité : taux de hallucination, taux de refus, satisfaction
- Outils : Langfuse, OpenLLMetry, Helicone

**Principe** : observabilité *by design* — instrumentation au moment de l'écriture du code, jamais ajoutée après.

---

### AT-08 — Gestion de configuration

**Définition** : Gestion sécurisée et versionnée de toute configuration système, infrastructure, secrets — avec le principe du moindre privilège et zéro secret en clair dans le code.

**Infrastructure as Code (IaC)** :
- Toute infrastructure décrite en code (Terraform, Pulumi, CDK, Ansible)
- IaC versionnée dans le même repo ou repo dédié
- IaC scanning en CI : tfsec, Checkov, kube-score — bloquant si High/Critical
- Policy as Code : OPA (Open Policy Agent) pour les contrôles automatisés

**Secrets management** :
- **Zéro secret en clair** dans le code, les logs, les environnements non protégés
- Vault centralisé : HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager
- Rotation automatique pour les secrets supportés
- Secrets éphémères (OIDC, workload identity) préférés aux secrets long-lived
- Secrets scan en pré-commit : gitleaks, TruffleHog

**Principe du moindre privilège** :
- Chaque service/agent n'a accès qu'à ce dont il a besoin
- IAM roles over static credentials
- MFA sur tous les accès critiques

**Dérive de configuration (configuration drift)** :
- Infrastructure immutable préférée (remplacer vs modifier en place)
- Contrôles de drift automatisés (Terraform plan en CI)
- GitOps pour la réconciliation continue

**Versioning sémantique** :
- **SemVer 2.0 obligatoire** — MAJOR.MINOR.PATCH. Une version publiée ne doit JAMAIS être modifiée ; toute correction = nouvelle version.
- **Conventional Commits** (feat/fix/refactor/chore/break) — pivot de génération automatique CHANGELOG et d'incrémentation SemVer automatique (semantic-release, Release Please, Changesets).
- Le changelog n'est pas rédigé manuellement après coup. Il est la conséquence directe de la discipline des commits.
- Lien : `docs/cycles/06-release/concepts-criteria.md` §6.2 (Versioning sémantique) et §6.8 (Changelog et Release Notes).

**Protocole de migration Expand/Contract** :
- Toute migration de schéma ou de contrat d'API suit le pattern Expand/Contract (parallel change), toujours en plusieurs déploiements distincts : EXPAND → MIGRATE (dual-write) → SWITCH READ → CONTRACT.
- Règle invariante : aucune opération de CONTRACT (DROP, RENAME, suppression de champ) dans le même déploiement qu'une fonctionnalité utilisateur.
- Référence : `docs/cycles/06-release/concepts-criteria.md` §6.5 et `docs/transversal/risk-classification.md` §6.6.

**Parité d'environnements** : dev → CI → staging → preprod → prod. Toute différence de configuration documentée et justifiée.

---

### AT-09 — Dette technique

**Définition** : Ensemble des compromis techniques conscients (ou non) qui augmentent le coût futur des changements. La dette doit être rendue visible, trackée, et remboursée de façon délibérée.

**Méthode SQALE** — Software Quality Assessment based on Lifecycle Expectations :
- Quantifie la dette en heures de remédiation
- **Technical Debt Ratio (TDR)** = dette totale / coût de construction × 100
- Cible : TDR < 5 % pour une livraison à haute vélocité (McKinsey : la dette représente 20–40 % d'un estate technologique typique)

**Catégories de dette** :
1. **Dette de code** — code smell, duplication, complexité excessive (cognitive complexity > 15)
2. **Dette de test** — couverture insuffisante sur zones critiques, flaky tests non résolus
3. **Dette architecturale** — couplage fort, violations de bounded context, dépendances circulaires
4. **Dette de sécurité** — CVE non triées, patterns dépréciés, secrets potentiels
5. **Dette d'accessibilité** — violations WCAG non résolues
6. **Dette de documentation** — ADR manquants, runbooks obsolètes, README désynchronisés

**Tracking** :
- Registre `planning/02-backlog/tech-debt/` — un item par dette identifiée
- Labels dans le backlog : `tech-debt`, `security-debt`, `a11y-debt`, `doc-debt`
- Revue mensuelle : priorisation selon TDR × impact livraison
- Règle : aucun sprint sans au moins un item de remédiation de dette (sauf sprint de crise)

**Anti-pattern** : rembourser la dette comme projet séparé. La bonne pratique est de l'intégrer dans les sprints normaux — "Boy Scout Rule" : laisser le code meilleur qu'on ne l'a trouvé. **Boy Scout Rule active à chaque PR — minimum 1 smell corrigé si TDR > 3 %.**

**Rule of Three** (AHA — Avoid Hasty Abstractions) : duplication acceptable 1× et 2×, extraire à 3×. Ne jamais abstraire plus tôt. Référence : `rules/core.md` §6.

#### Migrations architecturales

- **Pattern obligatoire : Strangler Fig** (jamais big bang) — tout changement d'architecture existante classé ≥ M doit être décomposé en une séquence de changements progressifs via le Strangler Fig pattern (Martin Fowler). Chaque étape de la décomposition est reclassifiée individuellement. Ce pattern transforme un C en séquence L/M, réduisant le risque à chaque étape tout en maintenant la traçabilité du changement global.
- Référence : `docs/research-reports/checkpoint-implementation.md` D5 (décision Discovery : Strangler Fig pour les changements d'architecture).
- Trigger : tout changement d'architecture existante (classe ≥ M).

---

### AT-10 — Revue de code

**Définition** : Inspection systématique de tout changement avant merge, couvrant exactitude fonctionnelle, sécurité, tests, observabilité, accessibilité, privacy, performance, FinOps, lisibilité.

**Règles structurelles** :
- PR > 400 lignes diff (hors refactor mécanique) → diviser avant review (qualité de revue chute fortement au-delà)
- PR sans tests associés pour des changements fonctionnels → bloquée
- Revue par ≥ 1 reviewer indépendant pour L+ ; ≥ 2 pour H/C
- En solo : self-review différée (≥ 24 h) + checklist explicite + agent IA en relecteur antagoniste

**Checklist de revue obligatoire** :

```markdown
## Classe de risque
- [ ] T  - [ ] L  - [ ] M  - [ ] H  - [ ] C
Justification : ...

## DoD
- [ ] Tests automatisés écrits et passants
- [ ] Quality gates CI verts (SAST/SCA/lint/types/secrets)
- [ ] Couverture cohérente avec le risque
- [ ] Documentation à jour (README/ADR/changelog si applicable)
- [ ] Observabilité : logs/métriques/traces en place
- [ ] Sécurité : lecture STRIDE rapide pour H/C
- [ ] WCAG 2.2 AA respectée sur l'UI touchée (axe-core vert)
- [ ] Aucune chaîne hardcodée (i18n)
- [ ] Privacy : registre/consentement/durée à jour si nouvelles données
- [ ] Impact FinOps documenté si M/H/C
- [ ] Feature flag si H/C
- [ ] Plan de rollback si H/C
- [ ] Conventional commit
- [ ] Tidy First S/B : ce commit est S (Structural — zéro changement de comportement) OU B (Behavioral — feature/fix/perf) — jamais les deux (Beck 2023). Référence : `docs/cycles/04-build/concepts-criteria.md` §6.1.
```

**Quality gates CI non contournables** :

| Gate | Outil | Bloquant si... |
|------|-------|---------------|
| Lint/format | ESLint, ruff, golangci-lint | Erreur |
| Type-check | TypeScript/mypy | Erreur |
| Tests | jest/pytest/JUnit | Échec |
| Couverture critique | nyc/coverage.py | < seuil défini |
| SAST | Semgrep/CodeQL | High/Critical |
| SCA | OSV-Scanner/Trivy | CVE Critical/High non triée |
| Secrets scan | gitleaks/TruffleHog | Secret détecté |
| IaC scan | Checkov/tfsec | High/Critical |
| Container scan | Trivy/Grype | High/Critical |
| SBOM | Syft/cdxgen | Non généré |
| A11y auto | axe-core | Violation A/AA |
| Performance | Lighthouse CI/size-limit | Régression > seuil |

**Principe** : *no human can override a failing gate without an explicit, time-bound, recorded waiver*.

---

### AT-11 — Formation continue et harness self-improvement

**Définition** : Capacité du système (humain + agent IA) à s'améliorer de façon délibérée à travers les cycles — via rétrospectives actionnables, postmortems blameless, et mécanismes d'auto-amélioration du harness.

**Rétrospective de cycle** (≠ postmortem) :
- Périodique (fin de sprint / release)
- Format : Start/Stop/Continue, 4L, Mad/Sad/Glad
- Sortie : ≤ 3 actions avec owner et date — pas de longue liste sans suite
- Mesure SPACE périodique (Satisfaction, Performance, Activity, Communication, Efficiency)

**Postmortem blameless** (déclenché par incident, ≠ rétrospective) :
- Critères : indisponibilité user-visible > X min, brèche sécurité/privacy, perte de données, régression SLO majeure, dépassement budget FinOps
- Structure : TL;DR → impact → timeline UTC → cause racine (5 Whys) → ce qui a bien marché → ce qui n'a pas bien marché → où on a eu de la chance → action items SMART
- Bibliothèque interne : tous les postmortems lisibles par le système (apprentissage systémique)

**Harness self-improvement** :
- Audits périodiques du harness (couverture des skills, règles orphelines, hooks dormants)
- Self-improver agent déclenché sur `/improve`
- Chaque changement de comportement du harness documenté en ADR
- Métriques DORA mesurées et publiées : change lead time, deployment frequency, change failure rate, failed deployment recovery time, rework rate

**Garde-fous anti-rubber-stamp** (s'appliquent en mode `auto`) :
- **Format de proposition obligatoire** avant toute approbation en `auto` : `[problème][alternatives][choix][critère de succès][classe de risque]`. Aucune approbation sans ce format rempli.
- **Quota de rejets** : ≥ 20 % des PRs/mois doivent avoir ≥ 1 commentaire de correction (challenge, objection, demande de modification). Un taux d'approbation de 100 % est un signal de rubber-stamping, pas de qualité.
- **Audit aléatoire** : 1 PR/semaine révisée rétrospectivement — une proposition acceptée la veille est relue à froid le lendemain avec regard critique. Résultat documenté dans `.planning/06-quality/anti-rubber-stamp-audit.md`.
- **Cadence de vérification** : mensuelle — vérifier le taux de rejet réel vs quota cible. Si < 20 % sur 2 mois consécutifs → alerte dans la rétrospective de cycle.

---

### AT-12 — Internationalisation et Localisation (i18n/l10n)

**Définition** : Conception et vérification continues de la capacité du système à s'adapter à différentes langues, régions et cultures — intégrée dès la construction, pas ajoutée en fin de cycle. L'i18n (internationalisation) est la préparation technique du code ; la l10n (localisation) est l'adaptation à un locale spécifique.

**i18n par construction** — principes obligatoires :
- **ICU MessageFormat** — standard de facto pour le formatage de messages pluriels, genrés, et conditionnels. Pas de concaténation de chaînes pour construire des phrases.
- **CLDR (Unicode Common Locale Data Repository)** — source de vérité pour les formats de dates, nombres, devises, fuseaux horaires, noms de pays, calendriers. Toujours déléguer aux libs CLDR (Intl API, date-fns, Luxon).
- **RTL (Right-to-Left)** — support obligatoire si le produit cible des marchés arabes/hébreux. CSS logical properties (`margin-inline-start` au lieu de `margin-left`, `padding-block-end` au lieu de `padding-bottom`). Test avec au moins une langue RTL (arabe).
- **Locale-aware formatting** — dates, nombres, devises formatés selon le locale de l'utilisateur, pas hardcodés en format français ou américain. `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`.
- **Aucune chaîne hardcodée** dans le code source — toutes les chaînes passent par la lib i18n (react-intl, next-intl, i18next, vue-i18n, etc.).
- **Pseudo-localisation en CI** — détection automatique des chaînes non externalisées via pseudo-locale (ex : `[!!Ĥéļļö Ŵöŕļð!!]`). Gate bloquant si chaîne hardcodée détectée.

**Seuils et vérifications** :

| Vérification | Déclenchement | Outil |
|-------------|--------------|-------|
| Aucune chaîne hardcodée | Chaque PR (UI touchée) | Pseudo-localisation CI, lint i18n |
| Formats régionaux corrects | Chaque PR (dates/nombres) | Tests unitaires avec locales multiples |
| Support RTL | M+ si marché RTL ciblé | Tests Playwright avec `dir="rtl"` |
| Clés i18n orphelines | Mensuel | i18n-unused, i18next-parser |
| Longueur de traduction | Avant release | Vérification expansion texte (DE +30%, JA -30%) |

**Mapping ISO 25010:2023** : Interaction Capability — Inclusivity (sous-caractéristique ajoutée en 2023). L'i18n est une dimension de l'inclusivité au même titre que l'accessibilité.

**Relation avec AT-04 (Accessibilité)** : l'attribut `lang` sur les éléments HTML est un critère WCAG (SC 3.1.1 Language of Page, SC 3.1.2 Language of Parts). Un contenu non marqué linguistiquement est une violation d'accessibilité.

---

## 7. Critères qualité — ISO 25010:2023

La norme ISO/IEC 25010:2023 (révisée en novembre 2023) définit 9 caractéristiques de qualité produit. Les activités transversales couvrent directement 7 d'entre elles.

| Caractéristique ISO 25010:2023 | Sous-caractéristiques clés | Activités transversales couvrant |
|-------------------------------|---------------------------|----------------------------------|
| **Functional Suitability** | Completeness, Correctness, Appropriateness | AT-10 Revue, AT-03 Tests NF |
| **Performance Efficiency** | Time behaviour, Resource utilization, Capacity | AT-06 Performance, AT-07 Observabilité |
| **Compatibility** | Co-existence, Interoperability | AT-08 Config, AT-10 Revue |
| **Interaction Capability** | Accessibility, UX, Learnability, Self-descriptiveness | AT-04 Accessibilité, AT-02 Docs |
| **Reliability** | Faultlessness, Availability, Fault tolerance, Recoverability | AT-07 Observabilité, AT-06 Performance |
| **Security** | Confidentiality, Integrity, Non-repudiation, Accountability, Authenticity, Resistance | AT-01 Sécurité, AT-05 Privacy, AT-08 Config |
| **Maintainability** | Modularity, Reusability, Analysability, Modifiability, Testability | AT-09 Dette, AT-10 Revue, AT-02 Docs |
| **Flexibility** | Adaptability, Scalability, Installability, Replaceability | AT-08 Config, AT-09 Dette |
| **Safety** *(nouveau 2023)* | Operational constraint, Risk identification, Fail safe, Hazard warning, Safe integration | AT-01 Sécurité, AT-05 Privacy |

**Priorisation par projet** : choisir 3–5 caractéristiques prioritaires avec seuils mesurables. Les documenter dans `docs/08-quality/quality-model-instance.md`.

---

## 8. Modulation par classe de risque

C'est le **mécanisme pivot** du système. Chaque activité transversale s'applique à une intensité différente selon la classe de risque T/L/M/H/C du changement.

**Rappel des classes** :
- **T (Trivial)** : changement cosmétique, doc, refactor sans changement de comportement, dépendance patch sans CVE
- **L (Low)** : nouvelle fonctionnalité isolée derrière feature flag, pas de PII, pas de migration
- **M (Moyen)** : nouvelle fonctionnalité visible utilisateur, pas de PII sensible, pas de schéma DB
- **H (High)** : touche authentification, autorisation, paiement, données personnelles, schéma DB, API publique
- **C (Critique)** : impact transverse, données sensibles (santé, biométrie, financier), refonte d'architecture, rupture contrat API, exigence réglementaire

### 8.1 Matrice de modulation principale

Légende : ✅ Obligatoire | ○ Recommandé | ◔ Allégé | — Skippable | conditionnel = selon contexte

| Activité transversale | T | L | M | H | C |
|----------------------|:--:|:--:|:--:|:--:|:--:|
| **AT-01 — SÉCURITÉ** | | | | | |
| SAST en CI | ✅ | ✅ | ✅ | ✅ | ✅ |
| SCA (dépendances) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Secrets scan | ✅ | ✅ | ✅ | ✅ | ✅ |
| IaC / container scan | ✅ si touché | ✅ | ✅ | ✅ | ✅ |
| Threat modeling STRIDE | — | — | ○ | ✅ | ✅ |
| DAST sur preprod | — | — | ○ | ✅ | ✅ |
| SBOM généré | ◔ | ✅ | ✅ | ✅ | ✅ |
| SLSA provenance | — | — | — | ✅ | ✅ |
| Signature Cosign | — | — | — | ✅ | ✅ |
| **AT-02 — DOCUMENTATION** | | | | | |
| ADR si décision archi | — | ◔ | ○ | ✅ | ✅ |
| Changelog si user-facing | — | ✅ | ✅ | ✅ | ✅ |
| Doc API mise à jour | — | ◔ | ✅ | ✅ | ✅ |
| Runbook si nouveau mode défaillance | — | — | ○ | ✅ | ✅ |
| **AT-03 — TESTS NF** | | | | | |
| Tests de régression existants | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tests de performance / charge | — | — | ○ | ✅ | ✅ |
| Tests de contrat inter-services | — | — | ○ | ✅ | ✅ |
| Tests de mutation (score > 70 %) | — | — | ○ | ✅ zones crit. | ✅ |
| **AT-04 — ACCESSIBILITÉ** | | | | | |
| axe-core en CI (UI touchée) | ◔ auto | ✅ auto | ✅ auto | ✅ auto | ✅ auto |
| Tests manuels lecteur d'écran | — | — | ◔ | ✅ | ✅ + audit |
| Tests manuels zoom 400 % | — | — | ◔ | ✅ | ✅ |
| Mise à jour déclaration d'accessibilité | — | — | — | ✅ | ✅ |
| **AT-05 — PRIVACY / RGPD** | | | | | |
| Registre de traitement à jour | — | — | conditionnel | ✅ si données perso | ✅ |
| AIPD/DPIA | — | — | conditionnel | ✅ si données perso | ✅ |
| Consentement implémenté | — | conditionnel | conditionnel | ✅ si requis | ✅ |
| Durée de conservation configurée | — | — | conditionnel | ✅ si nouvelles données | ✅ |
| **AT-06 — PERFORMANCE** | | | | | |
| Vérification budget perf technique | — | ◔ | ○ | ✅ | ✅ |
| Lighthouse CI / Core Web Vitals | — | ◔ auto | ✅ auto | ✅ | ✅ |
| Tests de charge sur staging | — | — | — | ✅ | ✅ |
| Vérification budget FinOps | — | ◔ | ○ | ✅ | ✅ |
| **AT-07 — OBSERVABILITÉ** | | | | | |
| Logs structurés (traces ajoutées) | ◔ | ✅ | ✅ | ✅ | ✅ |
| Métriques applicatives | — | ◔ | ✅ | ✅ | ✅ |
| Traces distribuées | — | — | ○ | ✅ | ✅ |
| SLO inchangé ou mis à jour | — | ◔ | ✅ | ✅ | ✅ |
| Dashboard mis à jour | — | — | ○ | ✅ | ✅ |
| **AT-08 — CONFIGURATION** | | | | | |
| Aucun secret en clair | ✅ | ✅ | ✅ | ✅ | ✅ |
| Variables d'env externalisées | ◔ | ✅ | ✅ | ✅ | ✅ |
| IaC scan si IaC touchée | ✅ si touché | ✅ | ✅ | ✅ | ✅ |
| Parité environnement vérifiée | — | ◔ | ✅ | ✅ | ✅ |
| **AT-09 — DETTE TECHNIQUE** | | | | | |
| Boy Scout Rule (laisser mieux) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Item de dette dans backlog si créé | — | ◔ | ✅ | ✅ | ✅ |
| Revue TDR | — | — | mensuelle | mensuelle | mensuelle |
| **AT-10 — REVUE DE CODE** | | | | | |
| Self-review / checklist PR | ◔ | ✅ | ✅ | ✅ | ✅ |
| Reviewer indépendant | — | ✅ | ✅ | ✅ (≥2) | ✅ (≥2) |
| Quality gates CI bloquants | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AT-11 — FORMATION** | | | | | |
| Rétro de cycle | — | — | ○ | ✅ | ✅ |
| Postmortem si incident | — | léger | ✅ | ✅ + revue | ✅ + audit |
| Mise à jour harness / patterns | — | — | ○ | ✅ | ✅ |
| **AT-12 — i18n/l10n** | | | | | |
| Aucune chaîne hardcodée (pseudo-l10n CI) | ◔ | ✅ | ✅ | ✅ | ✅ |
| Formats régionaux CLDR | — | ◔ | ✅ | ✅ | ✅ |
| Support RTL si marché ciblé | — | — | ○ | ✅ | ✅ |
| Tests multi-locale | — | — | ○ | ✅ | ✅ |

### 8.2 Règles d'escalade de classe — protocole en 4 étapes

Si en cours de cycle un changement classé L se révèle H (ou toute promotion de classe) :

1. **Détection** — Signal dans le diff, le test, ou la revue (reviewer, agent IA, ou quality gate CI). Déclencheurs automatiques : si le diff touche un fichier `auth/`, `migrations/`, `payments/`, `.env*`, `config/security*` → promotion automatique vers H minimum. Si données de santé/biométrie → C minimum. Référence : `docs/transversal/risk-classification.md` §4.3 (signaux de forçage).
2. **Action immédiate** — Bloquer la PR. Pause du Build sur cet incrément. Commit WIP sur branche temporaire pour préserver l'état. Re-classifier le changement avec la nouvelle classe et justification. Retour en Conception si la nouvelle classe est H ou C (threat model, plan de tests, ADR peuvent être requis).
3. **Traçabilité** — Entrée obligatoire dans `planning/09-logs/risk-escalations.jsonl` (append-only) avec : date, classe initiale, classe réelle, trigger, detected_by, confirmed_by, action prise. Format :
   ```yaml
   escalation_history:
     - date: "2026-05-05T14:32:00Z"
       from_class: "L"
       to_class: "H"
       trigger: "Fichier auth/session.ts modifié dans commit abc123"
       detected_by: "agent"
       confirmed_by: "developer"
       action: "PR pausée, ADR et threat modeling requis avant reprise"
   ```
4. **learning** — La promotion alimente la calibration future de la classification dans le cycle `learning`. Chaque promotion est un signal de classification initiale erronée → améliore le modèle de classification et l'arbre de décision des signaux de forçage.

---

## 9. Application par cycle — matrice activité × cycle

Cette matrice indique l'intensité de chaque activité transversale dans chaque cycle de la pipeline. Elle complète la matrice de risque (§8) — ici l'axe est le cycle, pas la classe de risque.

| Activité | discovery | cadrage | conception | build | validation | release | run | learning |
|----------|:---------:|:-------:|:----------:|:-----:|:----------:|:-------:|:---:|:-------------:|
| AT-01 Sécurité | Identification risques | Contraintes réglementaires | Threat model + AIPD trigger | SAST/SCA/secrets CI | DAST sur preprod | SLSA/SBOM/signature | CVE monitoring | Postmortem sécurité |
| AT-02 Documentation | Note Discovery | Charter + scope | ADR + API contract | Inline doc + changelog | Critères acceptance finaux | Release notes | Runbooks | Postmortem publié |
| AT-03 Tests NF | — | Budget NF défini | Plan de tests NF | Tests NF en CI | Tests charge/sécu/a11y | Smoke tests prod | Régression continue | Test généré depuis incident |
| AT-04 Accessibilité | — | Budget a11y + EAA scope | Plan a11y (ARIA, contrastes) | axe-core CI | Tests manuels parcours | Déclaration mise à jour | Monitoring a11y RUM | Backlog remédiation |
| AT-05 Privacy | PII identifiées | AIPD déclenchée si ≥ 2 critères | Registre + AIPD | Consentement + purge | Validation mesures AIPD | Mentions légales | Droits des personnes | Notification violation |
| AT-06 Performance | — | Budget perf défini | SLO définis | Lighthouse CI | Tests charge staging | Canary SLO-gated | Error budget SLO | Analyse régression perf |
| AT-07 Observabilité | — | SLI/SLO esquissés | Plan instrumentation | Logs/métriques/traces | Vérification couverture obs | Smoke post-deploy | Multi-burn-rate alerting | Timeline incident UTC |
| AT-08 Config | — | Stratégie IaC | IaC design | IaC + secrets | Parité environnement | SLSA + config review | Drift detection | Config root cause |
| AT-09 Dette | — | — | Dette architecturale identifiée | Boy Scout Rule | Défauts détectés | TDR mesuré | Monitoring TDR | Rétrospective dette |
| AT-10 Revue | — | Charter validé | Design doc reviewé | PR checklist + quality gates | Acceptance validée | Release checklist | — | Revue patterns |
| AT-11 Formation | — | Mode opératoire | Patterns retenus | Feedback temps réel | Leçons QA | Release retrospective | DORA mesurées | Rétro + postmortem |
| AT-12 i18n/l10n | — | Budget i18n défini | Plan i18n (ICU, CLDR, RTL) | Pseudo-l10n CI | Tests multi-locale | Vérification expansion texte | Monitoring locale errors | Backlog clés orphelines |

---

## 10. Interactions entre activités transversales

Les activités transversales ne sont pas indépendantes. Certaines se renforcent, d'autres créent des tensions à gérer.

### 10.1 Synergies

```
AT-01 Sécurité ──────────────────────► AT-05 Privacy
  (threat model révèle PII exposées)      (AIPD couvre les risques sécurité)

AT-02 Documentation ─────────────────► AT-11 Formation
  (ADR alimente la mémoire du harness)     (postmortems = formation systémique)

AT-06 Performance ───────────────────► AT-07 Observabilité
  (SLO sont les cibles de performance)     (métriques mesurent les SLO)

AT-08 Config ────────────────────────► AT-01 Sécurité
  (IaC scan = partie du pipeline sécurité) (secrets management = sécurité opérationnelle)

AT-09 Dette ─────────────────────────► AT-10 Revue
  (la revue identifie la dette)            (la revue bloque l'accumulation)

AT-03 Tests NF ──────────────────────► AT-04 Accessibilité
  (axe-core = test NF d'accessibilité)     (AT-04 spécialise AT-03 pour l'a11y)

AT-12 i18n/l10n ─────────────────────► AT-04 Accessibilité
  (lang attribute = critère WCAG 3.1.1)    (inclusivité linguistique = a11y)
```

### 10.2 Tensions à gérer

| Tension | Description | Arbitrage |
|---------|-------------|-----------|
| AT-01 vs AT-06 | SAST/DAST ralentissent le pipeline | SAST en pré-commit (rapide) ; DAST sur preprod uniquement (async) |
| AT-02 vs Économie tokens | Documenter coûte des tokens/attention | `docs/` à fond ; `.planning/` au minimum nécessaire |
| AT-05 vs AT-07 | Les logs doivent observer sans exposer de PII | Pseudonymisation obligatoire des user_id dans les logs |
| AT-04 vs vélocité | Tests a11y manuels prennent du temps | Auto (30–40 %) en CI ; manuel ciblé sur parcours critiques M+ |
| AT-09 vs livraison | Rembourser la dette ralentit les features | Intégrer dans chaque sprint (Boy Scout), pas de sprint "dette" séparé |
| AT-11 vs AT-03 | "Incident → test" peut gonfler la suite | Quarantaine des tests flaky ; stratégie de tests documentée en ADR |

### 10.3 Séquence d'activation

Pour un changement H typique (touche authentification et données personnelles) :

```
1. AT-01 → Threat modeling STRIDE (Conception)
2. AT-05 → AIPD déclenchée (Conception)
3. AT-08 → IaC et secrets design validés (Conception)
4. AT-10 → Revue design doc (Conception)
5. AT-01 + AT-10 → SAST/SCA/secrets scan + PR checklist (Build CI)
6. AT-04 → axe-core CI si UI touchée (Build CI)
6b. AT-12 → pseudo-localisation CI, aucune chaîne hardcodée (Build CI)
7. AT-07 → Logs/métriques/traces en place (Build)
8. AT-03 + AT-06 → Tests de charge + DAST sur staging (Validation)
9. AT-05 → Vérification mesures AIPD implémentées (Validation)
10. AT-01 → SLSA + SBOM + signature (Release)
11. AT-02 → Mentions légales + release notes (Release)
12. AT-04 → Déclaration d'accessibilité mise à jour (Release)
13. AT-07 → Multi-burn-rate alerting actif (Run)
14. AT-11 → Rétro + harness update si apprentissage (`learning`)
```

---

## 11. Artefacts produits

### 11.1 Artefacts vivants (mis à jour en continu)

| Artefact | Emplacement | Responsable | Fréquence de mise à jour |
|----------|------------|-------------|--------------------------|
| Registre de traitement RGPD | `docs/09-security-compliance/registre-traitement.md` | Solo dev | À chaque nouveau traitement |
| Threat model courant | `docs/09-security-compliance/threat-model.md` | Solo dev | À chaque flux H/C |
| ADR index | `docs/13-decisions/INDEX.md` | Solo dev | À chaque décision architecturale |
| Registre de dette technique | `planning/02-backlog/tech-debt/` | Solo dev + agent | Continu |
| SBOM courant | `releases/latest/sbom.json` | CI | À chaque release |
| Déclaration d'accessibilité | URL publique | Solo dev | À chaque release avec UI |
| SLO dashboard | `planning/07-metrics/dora-metrics.md` | Solo dev | Hebdomadaire |
| Registre CVE | `planning/08-risks/security-risks/cve-register.jsonl` | Agent (auto) | Continu |
| Registre de violations RGPD | `docs/09-security-compliance/violations.jsonl` | Solo dev | À chaque incident |

### 11.2 Artefacts ponctuels (produits à un moment précis)

| Artefact | Déclencheur | Format |
|----------|------------|--------|
| AIPD complète | ≥ 2 critères WP29 | Logiciel PIA CNIL |
| Rapport DAST | Chaque PR H/C vers staging | HTML (ZAP/Burp) |
| Rapport de test de charge | Chaque release M+ | HTML/JSON (k6) |
| Postmortem | Incident qualifié | Markdown structuré |
| Rapport d'audit a11y | Produits critiques / EAA | PDF + Markdown |
| VEX | CVE non exploitable détectée | CycloneDX VEX JSON |
| Release notes | Chaque release | Markdown (changelog automatisé) |

---

## 12. Métriques et indicateurs

### 12.1 Métriques de sécurité (AT-01)

| Métrique | Cible | Fréquence |
|----------|-------|----------|
| CVE Critical/High en production | 0 non triée | Temps réel |
| Délai de remédiation CVE Critical | < 24 h | Par incident |
| Couverture SAST (% de repos scannés) | 100 % | Par CI run |
| Score OWASP SAMM par practice | Progression vers niveau 2 | Trimestriel |
| PRs bloquées par SAST | Tendance (viser décroissant) | Hebdomadaire |

### 12.2 Métriques DORA (AT-11) — version 2024/2025

| Métrique | Top (≈ top 15 %) | Cible projet | Fréquence |
|----------|-----------------|-------------|----------|
| Change Lead Time | < 1 jour | À définir en Cadrage | Par PR |
| Deployment Frequency | À la demande | À définir | Par release |
| Failed Deployment Recovery Time | < 1 h | < 4 h | Par incident |
| Change Failure Rate | < 5 % | < 10 % | Par sprint |
| Rework Rate | Tendance décroissante | Mesurer baseline | Par sprint |

### 12.3 Métriques d'accessibilité (AT-04)

| Métrique | Cible | Outil |
|----------|-------|-------|
| Violations WCAG A/AA auto | 0 sur parcours critiques | axe-core CI |
| Score Lighthouse A11y | ≥ 90/100 | Lighthouse CI |
| % parcours critiques testés manuellement | 100 % (pour M+) | Checklist manuelle |
| Délai moyen remédiation violation | < 1 sprint | Backlog |

### 12.4 Métriques privacy (AT-05)

| Métrique | Cible | Fréquence |
|----------|-------|----------|
| AIPD à jour vs traitements à risque | 100 % | Annuel + à chaque changement |
| Délai réponse droits des personnes | ≤ 30 jours | Par demande |
| Délai notification CNIL en cas de violation | < 72 h | Par incident |
| Volume de données (data minimization) | Décroissant ou stable | Audit annuel |

### 12.5 Métriques de performance (AT-06)

| Métrique | Cible | Outil |
|----------|-------|-------|
| LCP | ≤ 2,5 s (p75) | Lighthouse CI / CrUX |
| INP | ≤ 200 ms (p75) | Lighthouse CI |
| CLS | ≤ 0,1 (p75) | Lighthouse CI |
| Latence API p99 | Défini par SLO | OpenTelemetry |
| Disponibilité | Défini par SLO | Uptime monitoring |
| Coût unitaire (€/user, €/transaction) | Stable ou décroissant | FinOps dashboard |

### 12.6 Métriques de dette technique (AT-09)

| Métrique | Cible | Outil |
|----------|-------|-------|
| Technical Debt Ratio (TDR) | < 5 % | SonarQube / Semgrep |
| Cognitive Complexity (max par fonction) | ≤ 15 | Lint + SonarQube |
| Duplication de code | < 3 % | SonarQube |
| Flaky tests | 0 en quarantaine > 1 sprint | Test dashboard |

---

## 13. Standards de référence

| Domaine | Standard | Version / Statut | Source |
|---------|----------|-----------------|--------|
| Sécurité — cycle de dev | NIST SP 800-218 SSDF | v1.1 officiel ; v1.2 draft (17/12/2025) | csrc.nist.gov |
| Sécurité — IA/ML | NIST SP 800-218A | Finalisé | csrc.nist.gov |
| Sécurité — maturité org | OWASP SAMM v2 | v2.0 | owaspsamm.org |
| Sécurité — exigences appli | OWASP ASVS | v5 (draft) ; v4.0 stable | owasp.org |
| Sécurité — risques web | OWASP Top 10 | **2025 officiel** | owasp.org/Top10/2025 |
| Threat modeling | STRIDE (Microsoft) | Evergreen | microsoft.com |
| Threat modeling privacy | LINDDUN | v2 | linddun.org |
| Supply chain | SLSA + SBOM | SLSA v1.0 ; CycloneDX 1.6 / SPDX 2.3 | slsa.dev / cyclonedx.org |
| Qualité produit | ISO/IEC 25010 | **2023** (9 caractéristiques, +Safety) | iso.org |
| Tests | ISO/IEC/IEEE 29119 | Courant | iso.org |
| Privacy — règlement | RGPD (UE) 2016/679 | Art. 25, 32, 33, 35 | eur-lex.europa.eu |
| Privacy — méthode | CNIL Guide PIA | 2018 + logiciel open source | cnil.fr |
| Privacy — design | Privacy by Design | Cavoukian 7 principes | iapp.org |
| Accessibilité — technique | WCAG 2.2 | **AA** — W3C octobre 2023 | w3.org/TR/WCAG22 |
| Accessibilité — EU | EN 301 549 | v3.2.1 (mise à jour vers WCAG 2.2 en cours) | etsi.org |
| Accessibilité — légal EU | EAA / Directive (UE) 2019/882 | **En vigueur 28 juin 2025** | digital-strategy.ec.europa.eu |
| Accessibilité — FR public | RGAA | 4.x | accessibilite.numerique.gouv.fr |
| Performance livraison | DORA | State of DevOps **2024/2025** | dora.dev |
| Productivité | SPACE | Forsgren et al. | queue.acm.org |
| Fiabilité | Google SRE Book + SRE Workbook | Courant | sre.google |
| Observabilité | OpenTelemetry | Stable (Traces, Metrics, Logs) | opentelemetry.io |
| FinOps | FinOps Foundation Framework | **2024** | finops.org |
| Documentation | Diátaxis Framework | Courant | diataxis.fr |
| ADR | adr.github.io + Nygard | Standard de fait | adr.github.io |
| Versioning | SemVer 2.0 | Courant | semver.org |
| Commits | Conventional Commits | 1.0 | conventionalcommits.org |
| Culture | Westrum | DORA 6-question survey | dora.dev |
| Dette technique | SQALE Method | Courant | SQALE |
| IaC sécurité | CIS Benchmarks + Checkov | Courant | cisecurity.org |
| i18n — message format | ICU MessageFormat | Courant | unicode.org/icu |
| i18n — locale data | Unicode CLDR | Courant | cldr.unicode.org |

---

## 14. Questions ouvertes — RED CARDS

Ces questions sont non résolues et peuvent impacter l'architecture si elles ne sont pas tranchées avant la phase Build.

### RC-01 — Mécanisation de la classification T/L/M/H/C
**Question** : Comment automatiser (partiellement) la classification de risque pour réduire la subjectivité ?
**Impact** : Sans classification fiable, les gates transversaux sont appliqués à la mauvaise intensité.
**Piste** : Arbre de décision déterministe basé sur les fichiers touchés (auth → H minimum ; données de santé → C minimum ; migrations → M minimum).
**Statut** : Ouvert — priorité haute avant Build.

### RC-02 — WCAG 2.2 vs EN 301 549 : quelle version est légalement exigée ?
**Question** : EN 301 549 v3.2.1 référence WCAG 2.1 AA. La mise à jour vers WCAG 2.2 n'est pas encore officiellement harmonisée. Faut-il viser WCAG 2.1 AA (légalement exigé) ou WCAG 2.2 AA (recommandé) ?
**Réponse provisoire** : Viser WCAG 2.2 AA dès maintenant pour anticiper la mise à jour harmonisée d'EN 301 549 et éviter deux audits.
**Statut** : Décision provisoire prise — à valider par juriste EAA avant release publique.

### RC-03 — NIST SSDF v1.2 : adoption du draft ?
**Question** : Le draft v1.2 de SSDF (publié 17/12/2025, commentaires clos 30/01/2026) ajoute des pratiques importantes pour IA/ML et supply chain. Faut-il l'anticiper ?
**Réponse provisoire** : Suivre v1.1 comme référence officielle, adopter les pratiques AI/supply chain du draft v1.2 si applicables (notamment pour les projets utilisant des LLM).
**Statut** : À re-évaluer à la finalisation de v1.2.

### RC-04 — Outils DAST en mode solo
**Question** : DAST (OWASP ZAP, Burp) est difficile à configurer et maintenir en mode solo. Quel niveau d'automatisation est réaliste ?
**Piste** : ZAP en mode headless CI pour les scans H/C ; Nuclei pour les tests de templates automatiques ; Burp Community pour les audits manuels ponctuels.
**Statut** : Ouvert — à résoudre avant premier cycle H.

### RC-05 — Budget de performance FinOps : €/token LLM
**Question** : Comment définir un budget réaliste de coût LLM quand l'usage est incertain en phase Discovery ?
**Piste** : Budget d'exploration timeboxé (ex : X€/semaine de Discovery), budget de production basé sur le coût par fonctionnalité livrée.
**Statut** : Ouvert — à définir en Cadrage de chaque feature IA.

### RC-06 — AIPD en solo sans DPO formel
**Question** : Le RGPD recommande l'avis DPO pour les AIPD. En solo sans DPO, comment assurer la qualité de l'AIPD ?
**Réponse provisoire** : Utiliser le logiciel PIA CNIL open source + faire relire l'AIPD par un juriste RGPD externe pour les traitements à risque élevé.
**Statut** : Décision provisoire prise.

### RC-07 — Intégration AT-03 tests NF dans le sous-cycle fractal à 7 étapes / Anti-rubber-stamp enforcement
**Question** : Les tests non fonctionnels s'intègrent-ils dans le sous-cycle Observer/Define/Design/Execute/Verify/Capitalize/Transmit, et si oui, dans quelle étape ?
**Piste** : Verify = AT-03 obligatoire ; Capitalize = résultats documentés ; Transmit = feedback vers cycles amont.

**Enforcement anti-rubber-stamp (applicable à AT-10 et AT-11)** :
- **Quota rejets** : ≥ 20 % des PRs/mois avec ≥ 1 commentaire correction — un taux d'approbation de 100 % est un signal de rubber-stamping
- **Audit aléatoire** : 1 PR/semaine révisée rétrospectivement le lendemain avec regard critique
- **Format proposition obligatoire** avant approbation auto-décision : `[problème][alternatives][choix][critère de succès][classe de risque]`
- **Mesure** : taux de rejet mensuel suivi dans `.planning/07-metrics/quality-metrics.md` ; alerte si < 20 % sur 2 mois consécutifs

**Statut** : Ouvert — nécessite formalisation dans le document du sous-cycle fractal.

### RC-08 — Catalogue d'anti-patterns transversal

**Question** : Les anti-patterns identifiés dans ce document (rubber-stamping, big bang migration, dette comme projet séparé, EAA repoussé, AIPD après Conception, déploiement sans rollback plan, etc.) sont dispersés dans les sections AT-*. Faut-il un catalogue centralisé ?

**Piste** : Créer un catalogue d'anti-patterns avec :
- Nom de l'anti-pattern
- Activité transversale concernée (AT-01 à AT-12)
- Description du pattern toxique
- Pattern correct de remplacement
- Classe de risque minimale où le pattern est bloquant

**Anti-patterns déjà identifiés dans ce document** :
1. Rubber-stamping des propositions agent (AT-10, AT-11) → garde-fous anti-rubber-stamp §6 AT-11
2. Big bang migration (AT-09) → Strangler Fig obligatoire §6 AT-09
3. Dette comme projet séparé (AT-09) → Boy Scout Rule intégrée §6 AT-09
4. EAA repoussé "on verra plus tard" (AT-04) → budget a11y en Cadrage §15 Cycle 2
5. AIPD après Conception (AT-05) → AIPD déclenchée dès Discovery §4.4
6. Déploiement sans rollback testé (AT-08) → Expand/Contract §6 AT-08
7. Commits mixtes S+B (AT-10) → Tidy First checklist §6 AT-10
8. Optimisation sans mesure (AT-06) → Profiling first §6 AT-06
9. Observabilité ajoutée après (AT-07) → Observabilité by design §6 AT-07
10. Feature flags accumulés sans nettoyage (AT-08) → toggle expiration date obligatoire

**Statut** : Ouvert — à formaliser comme document dédié (`docs/transversal/anti-patterns-catalogue.md`) ou comme annexe de ce document.

---

## 15. Relations avec chaque cycle

### Cycle 1 — discovery

**Activités transversales principalement actives** : AT-01 (identification risques), AT-05 (identification PII)

- AT-01 : La Discovery identifie si la solution envisagée touche des surfaces sensibles (auth, PII, paiement). Cette information conditionne la classification de risque initiale.
- AT-05 : Si la solution implique des données personnelles, l'obligation d'AIPD est évaluée dès cette phase. Démarrer l'AIPD après la Conception est une violation du RGPD art. 35.
- AT-11 : Le format de Discovery (produit/self-feedback/technique) est lui-même un artefact d'apprentissage continu.

**Artefact attendu** : Classification risque initiale dans la note de Discovery. Indicateur "données personnelles : oui/non" et "AIPD déclenchée : oui/non".

---

### Cycle 2 — cadrage

**Activités transversales principalement actives** : AT-01, AT-04, AT-05, AT-06, AT-08, AT-11

- AT-01 : Les contraintes réglementaires de sécurité (NIS2, DORA financier, HDS) sont identifiées et intégrées au charter.
- AT-04 : Si le produit est concerné par l'EAA, le budget accessibilité est négocié ici. "On verra plus tard" est un anti-pattern EAA.
- AT-05 : Si ≥ 2 critères WP29 sont cochés, l'AIPD est planifiée dans le Cadrage avec budget et responsable.
- AT-06 : Le performance budget technique ET financier est négocié. Les SLO cibles sont esquissés.
- AT-08 : La stratégie IaC et secrets est décidée (quel vault, quelle stratégie d'environnements).
- AT-11 : le `OperatingMode` (`pairing`/`auto`/`bypass`) est configuré pour le projet.

**Artefact attendu** : Charter avec section "activités transversales applicables" et budgets associés.

---

### Cycle 3 — conception

**Activités transversales principalement actives** : AT-01, AT-02, AT-04, AT-05, AT-06, AT-07, AT-08

- AT-01 : Threat modeling STRIDE sur les nouveaux flux (obligatoire H/C). ADR de sécurité si choix d'architecture sécurité.
- AT-02 : ADR obligatoire pour toute décision architecturale. Plan de documentation API (OpenAPI/AsyncAPI).
- AT-04 : Plan d'accessibilité : composants ARIA, sémantique HTML, contrastes prévus, focus management, alternatives dragging.
- AT-05 : AIPD conduite (si déclenchée). Registre de traitement complété. Plan de minimisation et durées de conservation.
- AT-06 : SLI/SLO définis pour les nouveaux services/endpoints. Plan de profiling.
- AT-07 : Plan d'instrumentation OpenTelemetry. Quels logs, métriques, traces — sur quels chemins critiques.
- AT-08 : Architecture IaC détaillée. Plan de rotation des secrets. Stratégie de parité d'environnements.

**Artefact attendu** : Design doc complet incluant sections sécurité, privacy, a11y, performance, observabilité.

---

### Cycle 4 — build

**Activités transversales principalement actives** : AT-01, AT-02, AT-03, AT-04, AT-07, AT-08, AT-09, AT-10

- AT-01 : SAST + SCA + secrets scan à chaque commit (pré-commit hooks + CI). Bloquant.
- AT-02 : Documentation inline, changelog si feature user-facing, ADR si décision de build.
- AT-03 : Tests de régression NF en CI. Tests de mutation sur zones critiques.
- AT-04 : axe-core en CI sur toute UI touchée. Bloquant si violation A/AA.
- AT-07 : Logs structurés + métriques + traces ajoutés au moment de l'écriture du code.
- AT-08 : IaC scan si IaC touchée. Variables externalisées. Zéro secret en clair.
- AT-09 : Boy Scout Rule. Item de dette créé si compromis conscient.
- AT-10 : PR checklist + quality gates bloquants. Self-review différée en solo.

**Artefact attendu** : CI entièrement verte sur tous les gates. PR template renseigné.

---

### Cycle 5 — validation

**Activités transversales principalement actives** : AT-01, AT-03, AT-04, AT-05, AT-06

- AT-01 : DAST sur preprod (H/C). Validation que le threat model est couvert par les tests.
- AT-03 : Tests de charge sur staging (H/C). Tests de contrat inter-services. Tests E2E sur parcours critiques.
- AT-04 : Tests manuels lecteur d'écran sur parcours critiques (M+). Tests zoom 400 %, contraste élevé OS.
- AT-05 : Vérification que toutes les mesures techniques de l'AIPD sont effectivement implémentées.
- AT-06 : Tests de performance contre les SLO. Validation budget perf technique et financier.

**Artefact attendu** : Rapport de validation NF. Go/No-Go signé.

---

### Cycle 6 — release

**Activités transversales principalement actives** : AT-01, AT-02, AT-04, AT-05, AT-07

- AT-01 : SLSA provenance vérifiée + SBOM déposé + signature artefact Cosign. Sans cela, la release est bloquée pour H/C.
- AT-02 : Release notes publiées (générées depuis Conventional Commits). Politique de confidentialité mise à jour si nouvelles données.
- AT-04 : Déclaration d'accessibilité mise à jour avec date et scope.
- AT-05 : Mentions légales à jour. Politique de durée de conservation en production.
- AT-07 : Smoke tests post-déploiement. Watch actif des SLO et error budget pendant la fenêtre de déploiement. Rollback automatique si error budget brûle trop vite.

**Artefact attendu** : Release checklist complète. SBOM archivé. Déclaration d'accessibilité publiée.

---

### Cycle 7 — run

**Activités transversales principalement actives** : AT-01, AT-06, AT-07, AT-08, AT-09

- AT-01 : Monitoring CVE continu (SCA différentiel). Si nouvelle CVE Critical sur dépendance en prod → SLA 24 h.
- AT-06 : Error budget en temps réel. Politique : si épuisé → gel features.
- AT-07 : Multi-burn-rate alerting actif. Traitement des exercices de droits RGPD (≤ 30 jours).
- AT-08 : Détection de drift de configuration. Rotation planifiée des secrets.
- AT-09 : Monitoring TDR. Revue mensuelle backlog dette.

**Artefact attendu** : Dashboard SLO/SLI actif. Registre CVE à jour. Registre de traitement à jour.

---

### Cycle 8 — learning

**Activités transversales principalement actives** : AT-02, AT-09, AT-11

- AT-02 : Postmortem publié dans la base de connaissance interne. Runbook mis à jour si nouveau mode de défaillance.
- AT-09 : Rétrospective dette. Patterns de dette récurrents documentés.
- AT-11 : Rétro de cycle (≤ 3 actions). Postmortem blameless si incident. Harness mis à jour si apprentissage systémique. DORA mesurées.

**Feed-back vers cycles amont** :
- Si change failure rate > 15 % sur 3 sprints → retour Cadrage pour renforcer quality gates
- Si error budget brûlé > 100 % → retour Conception pour revoir l'architecture de fiabilité
- Si CVE récurrente sur même classe → retour Build pour changer les patterns de code
- Si violations WCAG répétées → retour Conception pour revoir l'architecture des composants UI

**Artefact attendu** : Rétro documentée (≤ 3 actions avec owner + date). Postmortem si déclenché. DORA sprint mises à jour.

---

*Document produit dans le cadre de la Pipeline Fractale v4 — Architecture transversale*
*Prochaine révision : après premier cycle Build complet, pour valider les hypothèses H1-H7 du rapport Discovery*

---

## Sources

- [NIST SP 800-218 SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/final) — NIST, 2022
- [NIST SP 800-218 v1.2 Draft](https://csrc.nist.gov/pubs/sp/800/218/r1/ipd) — NIST, 17/12/2025
- [NIST SP 800-218A (AI/ML)](https://csrc.nist.gov/pubs/sp/800/218/a/ipd) — NIST, 2024
- [OWASP SAMM v2](https://owaspsamm.org/model/) — OWASP Foundation
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/) — OWASP Foundation, 2025
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) — OWASP
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — W3C, octobre 2023
- [European Accessibility Act EAA Guide 2025](https://ergomania.eu/european-accessibility-act-2025-wcag-guide/) — Ergomania
- [EAA Compliance WCAG.com](https://www.wcag.com/compliance/european-accessibility-act/) — WCAG.com, 2025
- [CNIL — AIPD/PIA](https://www.cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd) — CNIL
- [CNIL — Outil PIA open source](https://www.cnil.fr/fr/outil-pia-telechargez-et-installez-le-logiciel-de-la-cnil) — CNIL
- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) — ISO, 2023
- [ISO 25010:2023 update](https://quality.arc42.org/articles/iso-25010-update-2023) — arc42, 2023
- [OpenTelemetry — Documentation](https://opentelemetry.io/docs/) — OpenTelemetry, 2025
- [DORA Report 2024](https://dora.dev/research/2024/dora-report/) — Google DORA, 2024
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/) — Google
- [ADR — adr.github.io](https://adr.github.io/) — adr.github.io
- [Architecture Decision Records — Martin Fowler](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) — martinfowler.com, 2011
- [Diátaxis Framework](https://diataxis.fr/) — Daniele Procida
- [FinOps Foundation Framework 2024](https://www.finops.org/framework/) — FinOps Foundation
- [Technical Debt Ratio](https://getdx.com/blog/technical-debt-ratio/) — GetDX
- [DevSecOps in 2025](https://www.oligo.security/academy/devsecops-in-2025-principles-technologies-best-practices) — Oligo Security
- [SLSA](https://slsa.dev/) — OpenSSF
- [SemVer 2.0](https://semver.org/) — Tom Preston-Werner
- [Conventional Commits 1.0](https://www.conventionalcommits.org/) — conventionalcommits.org
