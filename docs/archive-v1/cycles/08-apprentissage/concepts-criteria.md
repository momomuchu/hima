# Cycle 08 — learning : Concepts et Critères

> **Pipeline fractale v4 — Cycle 8/8**
> Statut : référence architecturale — lecture seule en phase build
> Source de vérité : `docs/cycles/08-apprentissage/concepts-criteria.md`
> Date : 2026-05-03
> Contrat PFV4 : macro cycles `discovery → cadrage → conception → build → validation → release → run → learning`

---

## 1. Résumé exécutif

Le cycle learning est le huitième et dernier cycle de la pipeline fractale v4. Il ferme la boucle : toute énergie dépensée dans les cycles 1-7 doit produire un apprentissage explicite qui alimente le cycle discovery suivant.

Ce cycle n'est pas un moment de repos ni un simple bilan. C'est le mécanisme par lequel le système se régénère. Sans lui, la pipeline est une séquence linéaire qui répète ses erreurs. Avec lui, la pipeline devient un système apprenant.

Trois modèles théoriques structurent ce cycle :

- **PDCA (Deming)** — Plan/Do/Check/Act : le cycle learning est la phase Check+Act du cycle complet de la pipeline.
- **Kolb** — Expérience concrète → Observation réflexive → Conceptualisation abstraite → Expérimentation active : les quatre étapes du sous-cycle fractal de learning suivent cette progression.
- **Argyris — Double boucle** — Single-loop learning corrige les actions (ex : améliorer un test) ; double-loop learning remet en question les règles du jeu (ex : remettre en question la classification de risque elle-même). Le cycle learning vise systématiquement la double boucle.

Le résultat obligatoire du cycle est un **diff de harness** : quelles règles, quels seuils, quels standards ont été mis à jour en conséquence de ce cycle. Si aucune règle n'a changé, le cycle learning n'a pas été complété.

**Portée** : rétrospective de cycle, postmortem blameless (si incident), capture de connaissances, analyse des métriques collectées, inventaire de la dette technique, mise à jour des standards internes, alimentation du cycle discovery suivant.

---

## 2. Position dans le pipeline

```
[01-discovery] → [02-cadrage] → [03-conception] → [04-build]
      ↑                                                  ↓
[08-learning] ←─────────────────────────── [05-validation]
      │                                                  ↓
      └──── alimente ──────────────────→        [06-release]
                                                         ↓
                                               [07-run] ──→ signaux → [08]
```

Le cycle learning reçoit ses entrées de **run** (métriques live, incidents, SLO) et de **validation** (résultats de tests, quality gates, écarts découverts). Il transmet ses sorties vers **discovery** (backlog enrichi, hypothèses reformulées, standards mis à jour).

**Position fractale** : chaque cycle (01 à 07) contient lui-même ses propres étapes Capitalize et Transmit (étapes 6 et 7 du sous-cycle universel). Le cycle 08 learning est la version amplifiée de ces deux étapes à l'échelle de la pipeline complète.

**Fréquence** : à la fin de chaque cycle complet (ou à intervalles fixes si la pipeline tourne en continu). Pour un dev solo en mode sprint, cela correspond à la fin de chaque sprint ou release.

---

## 3. Objectif du cycle

### Objectif principal

Transformer l'expérience brute du cycle en connaissance structurée, actionnable, et persistante — pour que le prochain cycle démarre avec plus de clarté et moins de risques que le précédent.

### Objectifs secondaires

| Objectif | Mesure de succès |
|---|---|
| Identifier les écarts entre prévisions et réalité | Ratio prévisions/réalité documenté pour chaque classe de risque |
| Mettre à jour les standards internes | Au moins 1 règle harness modifiée par cycle |
| Inventorier la dette technique créée ou remboursée | Registre de dette mis à jour avec delta net |
| Alimenter le prochain cycle discovery | Au moins 3 inputs structurés livrés à `discovery` |
| Valider ou invalider les hypothèses posées en cadrage | Taux d'hypothèses confrontées au réel |
| Détecter les patterns récurrents d'échec | Base de patterns mise à jour |

### Ce que ce cycle ne fait pas

- Il ne remet pas en question la décision de livrer (c'est validation qui le fait).
- Il ne bloque pas la prochaine feature (sauf si un RED CARD est levé).
- Il ne remplace pas le postmortem d'incident (le postmortem est distinct de la rétrospective).
- Il ne produit pas de documentation produit (c'est le rôle de `docs/`).

---

## 4. Entrées (Definition of Ready)

Le cycle learning peut démarrer quand **tous** les points suivants sont vrais :

### 4.1 Entrées obligatoires

- [ ] Le cycle précédent est **clos** : DoD validée, release déployée ou sprint terminé.
- [ ] Les **métriques DORA** du cycle sont disponibles : Change Lead Time, Deployment Frequency, Failed Deployment Recovery Time, Change Failure Rate, Rework Rate.
- [ ] Le **registre de la dette technique** est à jour : dette créée et dette remboursée pendant le cycle.
- [ ] Les **résultats des quality gates** sont disponibles (CI, SAST, SCA, tests, couverture).
- [ ] Si un incident s'est produit : le **postmortem blameless** est rédigé (ou en cours et non bloquant si très récent).
- [ ] Les **anomalies de SLO** du cycle run sont documentées.

### 4.2 Entrées recommandées (M+)

- [ ] Résultats des tests d'accessibilité et de performance.
- [ ] Métriques FinOps du cycle (coût unitaire, anomalies de budget).
- [ ] Score SPACE (si mesuré périodiquement).
- [ ] Logs des décisions de l'agent IA (audit trail `.planning/agent/audit.jsonl`).
- [ ] Feedback utilisateur collecté pendant run.

### 4.3 Entrées conditionnelles (H/C uniquement)

- [ ] Rapport de revue de sécurité (DAST, résultats de threat modeling).
- [ ] Validation DPO si des traitements de données personnelles ont été modifiés.
- [ ] Rapport de conformité si un référentiel réglementaire a été touché (RGPD, EAA, etc.).

---

## 5. Sorties (Definition of Done)

Le cycle learning est **terminé** quand **tous** les points suivants sont vrais :

### 5.1 Sorties obligatoires (tous cycles)

- [ ] **Rétrospective de cycle** rédigée et archivée dans `.planning/03-sprints/<sprint>/07-retrospective.md` — format structuré, ≤ 3 actions concrètes avec owner et date.
- [ ] **Delta de harness documenté** : quelles règles ont changé, lesquelles ont été confirmées, lesquelles restent ouvertes. Fichier : `.planning/09-logs/harness-delta.md`.
- [ ] **Registre de dette mis à jour** : dette nette du cycle calculée et trackée dans `.planning/02-backlog/tech-debt/`.
- [ ] **Métriques DORA archivées** dans `.planning/07-metrics/dora-metrics.md` — tendance vs cycle précédent documentée.
- [ ] **Au moins 1 input discovery** créé : PBI, hypothèse à tester, ou question de discovery dans `.planning/02-backlog/`.

### 5.2 Sorties recommandées (M+)

- [ ] **Base de patterns** mise à jour : `.planning/09-logs/patterns-recurrents.md` — pattern confirmé, infirmé, ou nouveau détecté.
- [ ] **Revue des hypothèses du cadrage** : chaque hypothèse du cadrage est marquée Validée / Invalidée / Toujours ouverte.
- [ ] **Lessons learned** formalisées et indexées dans `docs/13-decisions/` si elles constituent une décision d'architecture.

### 5.3 Sorties conditionnelles

- [ ] **Postmortem blameless publié** si incident pendant le cycle (distinct de la rétrospective).
- [ ] **ADR mis à jour** si une décision d'architecture précédente doit être révisée à la lumière des résultats.
- [ ] **Mise à jour des quality gates** si des seuils doivent être ajustés.

---

## 6. Concepts clés

### 6.1 PDCA (Deming) — Plan/Do/Check/Act

Le cycle PDCA est le modèle fondateur de l'amélioration continue. Dans la pipeline fractale :

- **Plan** = cycles discovery + cadrage + conception
- **Do** = cycle build + release
- **Check** = cycles validation + run (mesure des SLO, quality gates)
- **Act** = cycle learning

La phase **Act** ne se contente pas de corriger des actions (single-loop). Elle doit aussi remettre en question les règles de décision elles-mêmes (double-loop). Un seul cycle PDCA complet = un cycle de la pipeline fractale.

**Règle opératoire** : toute action identifiée en phase Act qui ne peut pas être réduite à un PBI ou à une règle harness modifiée est une action fantôme — elle ne compte pas.

### 6.2 Kaizen — amélioration continue incrémentale

Kaizen (改善 : « changer en mieux ») s'oppose aux grandes réformes ponctuelles. En contexte pipeline :

- Chaque rétrospective produit des **micro-améliorations** (≤ 3 actions) plutôt qu'un plan de transformation massif.
- L'amélioration est **continue**, pas saisonnière : chaque cycle, même T/L, traverse Capitalize et Transmit.
- La **discipline Kaizen** exige que les actions des rétrospectives précédentes soient **revues au début de chaque nouvelle rétrospective** — pour vérifier qu'elles ont bien été réalisées, pas juste promises.
- En solo + agents IA : l'agent peut être instrumenté pour tracker automatiquement les actions de rétrospective et signaler les actions non closes.

**Anti-pattern Kaizen** : rétrospective qui produit 10 actions et n'en réalise aucune. Mieux vaut 1 action systématiquement réalisée que 10 actions théoriques.

### 6.3 Cycle de Kolb — apprentissage expérientiel

Le cycle de Kolb (1984) décrit comment l'expérience se transforme en connaissance :

```
Expérience concrète (CE)
         ↓
Observation réflexive (RO)
         ↓
Conceptualisation abstraite (AC)
         ↓
Expérimentation active (AE)
         ↓
(nouvelle) Expérience concrète
```

Mapping sur le sous-cycle fractal learning :

| Étape Kolb | Étape fractal | Activité concrète |
|---|---|---|
| CE — Expérience concrète | Observer | Relire métriques, incidents, résultats de tests du cycle |
| RO — Observation réflexive | Define + Design | Rétrospective, postmortem, analyse des écarts |
| AC — Conceptualisation | Execute | Formuler des règles généralisables, mettre à jour les standards |
| AE — Expérimentation | Verify + Capitalize + Transmit | Décider les actions, les injecter dans discovery |

Le style d'apprentissage dominant en développement logiciel est **Convergent** (AC + AE) — on préfère appliquer des concepts à des problèmes concrets. Le cycle learning doit donc toujours produire une action concrète testable (AE), pas seulement une réflexion (RO).

### 6.4 Double boucle d'apprentissage (Argyris & Schön)

Argyris distingue deux niveaux d'apprentissage :

**Single-loop learning** (boucle simple) :
- Détecte une erreur → corrige l'action → continue avec les mêmes règles.
- Exemple : un test a raté → on fixe le test.
- Exemple : le déploiement a été lent → on optimise le CI.

**Double-loop learning** (double boucle) :
- Détecte une erreur → interroge les règles sous-jacentes → modifie les règles → corrige l'action.
- Exemple : un test a raté → on se demande pourquoi on n'a pas eu ce test en amont → on modifie la DoR pour exiger ce type de test dès le cadrage.
- Exemple : la classification de risque était systématiquement sous-estimée → on modifie l'arbre de décision de classification.

**Triple-loop learning** (méta-apprentissage, rarement formalisé) :
- Interroge les principes qui gouvernent les règles elles-mêmes.
- Exemple : notre pipeline est-elle trop orientée livraison et pas assez orientée apprentissage ? Faut-il revoir la structure des 8 cycles ?

**Règle opératoire** : chaque rétrospective doit contenir au moins 1 question de type double-loop : "Quelle règle avons-nous suivie qui a causé ce problème ?"

**Obstacle connu** : les individus résistent au double-loop learning parce qu'il expose les croyances implicites (Argyris, 1990). En solo + agents IA, cet obstacle se manifeste par la tendance à accepter les propositions de l'agent sans les questionner (rubber-stamping). Le quota de rejets mental (≥ 20 %) et l'audit aléatoire hebdomadaire sont les gardes-fous.

### 6.5 Rétrospective de cycle vs Postmortem blameless

Ce sont deux pratiques **fondamentalement distinctes**. Les confondre détruit les deux.

| Dimension | Rétrospective | Postmortem |
|---|---|---|
| Déclencheur | Calendrier (fin de cycle) | Événement (incident) |
| Focus | Processus d'équipe | Système défaillant |
| Périmètre | Tout le cycle | L'incident spécifique |
| Questions | Qu'est-ce qu'on peut améliorer ? | Pourquoi le système a-t-il failli ? |
| Sortie | ≤ 3 actions d'amélioration de processus | Action items SMART + lessons learned |
| Ton | Constructif / formatif | Blameless / analytique |
| Distribution | Équipe | Large (organisation apprenante) |

**Postmortem blameless — critères de déclenchement** (à définir avant tout incident) :
- Indisponibilité user-visible > X minutes (seuil à définir par projet).
- Brèche ou near-miss de sécurité ou de privacy.
- Perte de données.
- Régression de SLO majeure.
- Incident FinOps : dépassement de budget > Y %.
- Promotion de classe de risque imprévue (L → H ou H → C découvert en cours de cycle).
- Demande de toute partie prenante.

**Postmortem blameless — structure** (Google SRE, adapté solo) :

```
1. Résumé (≤ 5 lignes : quoi, quand, impact, résolution)
2. Impact (utilisateurs, durée, données, coût)
3. Timeline (UTC : alerte → première réponse → mitigation → résolution)
4. Cause racine (5 Whys ou fishbone — cause systémique, pas individuelle)
5. Ce qui a bien fonctionné
6. Ce qui n'a pas fonctionné
7. Où on a eu de la chance (fragilités non manifestées)
8. Action items (correctifs, prévention, détection, processus) — SMART, owner, date
```

**En mode solo** : tenir un journal d'incident avec ces sections le jour même, le relire une semaine plus tard avec une grille STRIDE/5 Whys. L'agent IA joue l'avocat du diable à la relecture.

### 6.6 DORA 2024/2025 — Métriques et apprentissage

Le rapport DORA 2024 (39 000+ professionnels) a confirmé 5 métriques officielles. Le rapport 2025 (« State of AI-assisted Software Development ») a introduit 7 archetypes d'équipe et identifié l'**effet amplificateur de l'IA** : l'IA amplifie ce qui est déjà là — les équipes fortes deviennent plus fortes, les équipes fragiles deviennent plus fragiles.

**Les 5 métriques DORA à archiver à chaque cycle** :

| Métrique | Top 15 % | High | Medium | Low |
|---|---|---|---|---|
| Change Lead Time | < 1 jour | < 1 semaine | < 1 mois | > 1 mois |
| Deployment Frequency | À la demande | Quotidien-hebdo | Hebdo-mensuel | Mensuel-trimestriel |
| Failed Deployment Recovery Time | < 1 h | < 1 j | < 1 semaine | > 1 semaine |
| Change Failure Rate | < 5 % | < 10 % | < 15 % | > 15 % |
| Rework Rate | Tendance ↓ | Stable | Légère ↑ | ↑ marquée |

**Loi de Goodhart appliquée** : si une métrique DORA devient une cible isolée, elle cesse d'être informative. Ne jamais gamifier la Deployment Frequency (découpage artificiel de PR) ni le Change Lead Time (merge sans review). Suivre les 5 ensemble.

**DORA 2025 — findings clés pour learning** :
- L'adoption de l'IA corrèle positivement avec le throughput en 2025 (reversement du finding 2024).
- L'instabilité reste corrélée à l'adoption IA sans garde-fous (quality gates, tests solides).
- La documentation de qualité reste l'un des prédicteurs les plus forts de la performance de livraison.
- Les 7 capabilities organisationnelles de l'IA incluent le travail en petits lots et le focus utilisateur — deux éléments directement mesurables en learning.

### 6.7 Knowledge Management — capture et diffusion du savoir

Le cycle learning produit trois niveaux de connaissance :

**Niveau 1 — Connaissance épisodique** (ce qui s'est passé)
- Artefacts : rétrospective, postmortem, logs de décisions.
- Durée de vie : permanente, archivée dans `.planning/99-archive/`.

**Niveau 2 — Connaissance sémantique** (ce qu'on en retire)
- Artefacts : patterns récurrents, règles mises à jour, hypothèses validées/invalidées.
- Durée de vie : vivante, dans `.planning/09-logs/patterns-recurrents.md` et harness.

**Niveau 3 — Connaissance procédurale** (comment faire différemment)
- Artefacts : ADR mis à jour, DoR/DoD modifiées, quality gates ajustés.
- Durée de vie : courante, dans `docs/` et fichiers de configuration.

**Antipattern knowledge management** : capturer sans indexer. Une base de 50 postmortems non indexés et non reliés aux règles courantes est du savoir mort. Chaque lesson learned doit être reliée à au moins une règle (harness, DoR, DoD, quality gate) ou marquée explicitement "orpheline — décision ouverte".

### 6.8 Dette technique — inventaire de cycle

La dette technique n'est pas un mal absolu. Ward Cunningham (créateur du concept) distingue :

- **Dette délibérée et consciente** : on sait ce qu'on fait, on documente, on planifie le remboursement.
- **Dette accidentelle** : on ne savait pas qu'on en créait (mauvaise compréhension, complexité émergente).
- **Dette irresponsable** : on sait, on ne documente pas, on n'en tient pas compte.

Le cycle learning traite uniquement les deux premières catégories. La troisième est un signal de double-loop learning défaillant.

**Registre de dette — entrée type** :

```
ID: DEBT-<NNN>
Type: technique | test | doc | architecture | sécurité
Origine: cycle <N>, sprint <M>
Description: ...
Impact si non traité: ...
Coût estimé de remboursement: T/L/M/H (classe de risque)
Priorité: critique | haute | moyenne | basse
Décision: rembourser sprint <P> | accepter | surveiller | invalide
Owner: ...
```

**Règle de gestion** : 15-20 % de la capacité de chaque sprint allouée au remboursement de dette (best practice industrie 2025, confirmée DORA). Toute dette marquée "critique" bloque la sortie de release.

### 6.9 Alimentation du cycle discovery suivant

Le cycle learning est le **seul mécanisme officiel** par lequel les apprentissages du passé informent le futur. Sans cette connexion explicite, chaque discovery repart de zéro.

Les **inputs discovery** produits par learning sont de 4 types :

1. **Hypothèse invalidée → nouvelle question de discovery** : "On pensait que X était vrai. Ce n'est pas le cas. Pourquoi ? Qu'est-ce que ça change ?"
2. **Pattern de problème récurrent → opportunité** : "On a eu 3 incidents liés à Y en 2 cycles. Est-ce un signal d'un besoin non adressé ?"
3. **Écart de valeur détecté** : "La feature Z a été livrée mais pas utilisée. Qu'est-ce qu'on a mal compris ?"
4. **Standard mis à jour → question de cohérence** : "La règle R a été changée. Est-ce que les features en backlog restent cohérentes avec la nouvelle règle ?"

---

## 7. Critères qualité (ISO 25010:2023)

Le cycle learning est évalué sur les caractéristiques ISO 25010:2023 **du cycle lui-même** — pas du produit livré.

| Caractéristique ISO 25010:2023 | Critère pour le cycle learning | Seuil |
|---|---|---|
| **Adéquation fonctionnelle** | Les sorties obligatoires (§5.1) sont toutes produites | 100 % des sorties obligatoires présentes |
| **Fiabilité** | Les métriques archivées sont exactes et traçables | Toutes métriques liées à une source vérifiable |
| **Maintenabilité** | Les artefacts produits sont lisibles et maintenables sans contexte additionnel | Tout artefact compréhensible sans la conversation qui l'a produit |
| **Sécurité** | Les lessons learned de sécurité sont transmises aux quality gates | Toute lesson learned sécurité → quality gate mis à jour ou RED CARD |
| **Interaction** | Le cycle learning est réalisable dans le temps alloué sans surcharge | Durée ≤ budget défini par classe de risque (§8) |
| **Safety** *(nouveau 2023)* | Aucune contrainte de risque identifiée n'est ignorée sans décision explicite | Zéro risque H/C non adressé |
| **Flexibilité** | Le cycle s'adapte à la classe de risque sans perdre ses invariants | Chaque variante produit au minimum les sorties §5.1 |

---

## 8. Modulation par classe de risque

Le sous-cycle fractal learning se module selon la classe de risque du cycle qui vient de se terminer.

| Activité | T | L | M | H | C |
|---|:---:|:---:|:---:|:---:|:---:|
| Rétrospective formelle structurée | — | ◔ | ✅ | ✅ | ✅ |
| Review informelle (agent + dev) | ✅ | ✅ | ◔ | — | — |
| Archivage métriques DORA | ◔ | ✅ | ✅ | ✅ | ✅ |
| Revue des actions rétrospective précédente | — | ◔ | ✅ | ✅ | ✅ |
| Update registre dette technique | ◔ | ✅ | ✅ | ✅ | ✅ |
| Postmortem blameless (si incident) | ◔ | ✅ | ✅ | ✅ | ✅ |
| validation/invalidation hypothèses cadrage | — | ◔ | ✅ | ✅ | ✅ |
| Mise à jour base patterns récurrents | — | ◔ | ✅ | ✅ | ✅ |
| Alimentation inputs discovery (≥ 1) | ◔ | ✅ | ✅ | ✅ | ✅ |
| Double-loop inquiry (questionnement des règles) | — | — | ◔ | ✅ | ✅ |
| Revue ADR à la lumière des résultats | — | — | ◔ | ✅ | ✅ |
| Update quality gates | — | ◔ | ○ | ✅ | ✅ |
| Revue des frontières du harness agent | — | — | ◔ | ✅ | ✅ |
| Audit trail agent IA relu et validé | — | ◔ | ✅ | ✅ | ✅ |

**Légende** : ✅ obligatoire — ○ recommandé — ◔ allégé — — skippable

### Budget temps par classe de risque

| Classe | Budget learning |
|---|---|
| T | 5-15 min — review informelle, archivage minimal |
| L | 30-45 min — rétrospective courte, métriques archivées |
| M | 1-2 h — rétrospective formelle, analyse métriques, 1 input discovery |
| H | 2-4 h — rétrospective complète, double-loop, revue ADR, update harness |
| C | 4-8 h — cycle complet incluant postmortem, revue architecture, communication élargie |

---

## 9. Sous-cycle fractal (7 étapes)

Chaque cycle de la pipeline suit le sous-cycle universel à 7 étapes. Voici son instanciation pour le cycle learning.

### Étape 1 — Observer

**But** : collecter les données brutes du cycle sans interprétation prématurée.

**Activités** :
- Relire les métriques DORA du cycle : Change Lead Time, Deployment Frequency, Failed Deployment Recovery Time, Change Failure Rate, Rework Rate.
- Relire les anomalies de SLO pendant run : quels SLO ont été stressés, lesquels ont été violés.
- Relire les quality gates : quels gates ont bloqué, combien de fois, pour quelles raisons.
- Relire les logs de l'agent IA : quelles décisions auto, quelles décisions ont été rejetées, quel est le taux de rejet effectif.
- Relire les incidents et near-misses.
- Relire les feedbacks utilisateurs (si disponibles).
- Relire la dette technique accumulée vs remboursée.

**Artefact** : `.planning/03-sprints/<sprint>/07-retrospective.md` section "Données brutes".

**Durée** : 15-30 min pour M, proportionnel à la classe.

### Étape 2 — Define

**But** : sélectionner les signaux pertinents parmi les données brutes. Distinguer les symptômes des causes.

**Activités** :
- Identifier les **écarts significatifs** : prévision vs réalité sur les métriques, les estimations, les classifications de risque.
- Identifier les **anomalies récurrentes** : même type d'écart sur plusieurs cycles → pattern.
- Formuler les **questions de rétrospective** : 3-5 questions spécifiques basées sur les données, pas génériques.
- Formuler au moins 1 **question de double-loop** : "Quelle règle avons-nous suivie qui a causé/permis ce problème ?"

**Artefact** : section "Écarts et questions" de la rétrospective.

### Étape 3 — Design

**But** : structurer la rétrospective et le postmortem si applicable.

**Activités** :
- Choisir le format de rétrospective selon le besoin du cycle :
  - **Start/Stop/Continue** : pour ajustements de processus courants.
  - **4L (Liked/Learned/Lacked/Longed for)** : pour cycles avec beaucoup d'apprentissage nouveau.
  - **Mad/Sad/Glad** : pour cycles avec friction émotionnelle ou burn-out signal.
  - **Sailboat/Speedboat** : pour cycles avec obstacles structurels.
  - **Double-loop matrix** (custom) : pour cycles H/C avec hypothèses à remettre en question.
- Préparer les questions du postmortem si applicable (5 Whys sur la cause racine).
- Préparer la revue des hypothèses du cadrage.

**Artefact** : plan de rétrospective dans la rétrospective.

### Étape 4 — Execute

**But** : réaliser la rétrospective, le postmortem, et les analyses prévues.

**Activités** :
- **Rétrospective** : répondre aux questions définies en Étape 2 avec le format choisi en Étape 3. Limiter à 3 actions concrètes avec owner et date.
- **Revue des actions** de la rétrospective précédente : faites / partiellement faites / non faites. Les non faites deviennent des RED CARDs si elles ont causé des problèmes.
- **Postmortem** (si applicable) : compléter les 8 sections du template blameless.
- **Analyse des métriques** : calculer les deltas vs cycles précédents, identifier les tendances.
- **Revue de la dette** : mettre à jour le registre, décider pour chaque item.
- **Revue des hypothèses** : valider, invalider, ou rouvrir chaque hypothèse du cadrage.

**Artefact** : rétrospective complétée, postmortem si applicable, delta métriques dans `.planning/07-metrics/`.

### Étape 5 — Verify

**But** : valider que les artefacts produits sont complets, actionnables, et cohérents.

**Checklist de vérification** :

- [ ] Chaque action de rétrospective a un owner nommé et une date.
- [ ] Chaque action est réalisable dans le prochain cycle (pas une promesse abstraite).
- [ ] Les métriques archivées sont tracées à une source (lien CI, log, export).
- [ ] Le delta harness est explicite : au moins 1 règle modifiée, confirmée, ou question ouverte documentée.
- [ ] Le registre de dette est cohérent avec les commits du cycle (vérification croisée git log).
- [ ] Les inputs discovery sont formulés en questions testables, pas en solutions.
- [ ] Si postmortem : chaque action item a un tracker (issue, ticket, ou entrée backlog).

### Étape 6 — Capitalize

**But** : transformer les insights en connaissance persistante réutilisable.

**Activités** :
- Mettre à jour `.planning/09-logs/patterns-recurrents.md` avec les patterns confirmés, infirmés, ou nouveaux.
- Mettre à jour `docs/13-decisions/` avec les ADR modifiés ou créés.
- Mettre à jour les fichiers de harness (DoR, DoD, quality gates, règles de classification de risque) si une règle change.
- Mettre à jour `.planning/09-logs/harness-delta.md` avec le diff du cycle.
- Archiver les artefacts de cycle dans `.planning/99-archive/` si le cycle est clos définitivement.

**Règle de capitalisation** : toute insight non persistée dans un fichier versionné est une insight perdue. La mémoire de conversation ne compte pas.

### Étape 7 — Transmit

**But** : injecter les apprentissages dans le cycle discovery suivant et les rendre disponibles.

**Activités** :
- Créer les **inputs discovery** dans `.planning/02-backlog/` : PBI de discovery, hypothèses à tester, questions ouvertes.
- Mettre à jour `.planning/00-dashboard/current-status.md` avec l'état post-cycle.
- Communiquer les lessons learned à toutes les parties concernées (en solo : versionné dans git, accessible).
- Si un postmortem a été rédigé : le rendre lisible et accessible (bibliothèque de postmortems).
- Vérifier que le prochain cycle discovery peut démarrer avec les DoR satisfaites grâce aux inputs livrés.

**Artefact final** : `.planning/00-dashboard/current-status.md` mis à jour + inputs discovery créés.

---

## 10. Activités transversales

Ces activités ne sont pas propres au cycle learning mais s'y appliquent avec une intensité particulière.

### 10.1 Observabilité de l'observabilité

Le cycle learning doit aussi évaluer la **qualité des données de monitoring** elles-mêmes :
- Les SLI mesurent-ils vraiment ce qui compte pour l'utilisateur ?
- Les alertes ont-elles bien détecté les incidents avant les utilisateurs ?
- Les logs ont-ils fourni assez d'information pour diagnostiquer rapidement ?
- L'instrumentation OpenTelemetry est-elle complète ou lacunaire ?

### 10.2 Revue de la classification de risque

La classification T/L/M/H/C est le pivot du système. Elle doit être auditée à chaque cycle H/C :
- Y a-t-il eu des promotions de classe imprévues pendant le cycle ? (L classé L mais comportait une migration — était H en réalité.)
- Les règles de classification actuelles ont-elles bien prédit le niveau d'effort et de risque réel ?
- L'arbre de décision doit-il être mis à jour ?

### 10.3 Revue de l'agent IA

En mode solo + agents IA, le cycle learning inclut une revue spécifique du comportement de l'agent :
- Taux de propositions acceptées vs rejetées (cible : taux de rejet ≥ 20 %).
- Qualité des propositions : les propositions rejetées l'ont-elles été pour une bonne raison, ou le développeur a-t-il simplement accepté sans lire ?
- Frontières respectées : l'agent a-t-il opéré dans les territoires autorisés ?
- Audit trail complet : chaque décision auto est-elle tracée dans `.planning/agent/audit.jsonl` ?
- Biais détectés : l'agent a-t-il montré des patterns de sur-confiance, de sous-estimation, ou de contournement des règles ?

### 10.4 FinOps de cycle

Coûts à analyser en learning :
- Coût LLM du cycle (tokens, appels, coût total) — vs budget alloué.
- Coût CI/CD (minutes de pipeline) — anomalies vs baseline.
- Coût unitaire (€/feature livrée, €/incrément) — tendance.
- Recommendations de rightsizing si des ressources ont été sur-allouées.

### 10.5 Accessibilité et i18n — dette spécifique

La dette d'accessibilité et d'i18n doit être trackée séparément de la dette technique générale car son coût de correction est exponentiel avec le temps (retrofitter coûte 5-10× plus cher que prévoir dès la conception). À chaque cycle learning :
- Combien de violations axe-core ont été introduites vs corrigées ?
- Y a-t-il des chaînes hardcodées introduites qui n'ont pas été catchées ?

---

## 11. Artefacts produits

| Artefact | Localisation | Format | Obligatoire |
|---|---|---|---|
| Rétrospective de cycle | `.planning/03-sprints/<sprint>/07-retrospective.md` | Markdown structuré | ✅ (M+) |
| Delta harness | `.planning/09-logs/harness-delta.md` | Markdown append-only | ✅ (tous) |
| Métriques DORA archivées | `.planning/07-metrics/dora-metrics.md` | Tableau Markdown | ✅ (L+) |
| Registre dette mis à jour | `.planning/02-backlog/tech-debt/` | Fichiers par item | ✅ (L+) |
| Inputs discovery | `.planning/02-backlog/` | PBI ou question ouverte | ✅ (L+, ≥ 1) |
| Postmortem blameless | `.planning/03-sprints/<sprint>/postmortem-<id>.md` | Template structuré 8 sections | Si incident |
| Patterns récurrents mis à jour | `.planning/09-logs/patterns-recurrents.md` | Markdown append-only | ○ (M+) |
| ADR mis à jour / créé | `docs/13-decisions/ADR-<NNN>.md` | Standard ADR | Si décision d'architecture |
| Quality gates mis à jour | Config CI / `.planning/06-quality/quality-gates-results.md` | Config + doc | Si seuil change |
| Rapport audit agent IA | `.planning/09-logs/agent-audit-cycle-<N>.md` | Markdown | ✅ (L+) |
| Revue hypothèses cadrage | `.planning/03-sprints/<sprint>/07-retrospective.md` section hypothèses | Tableau | ○ (M+) |
| Dashboard mis à jour | `.planning/00-dashboard/current-status.md` | Markdown | ✅ (tous) |

---

## 12. Métriques et indicateurs

### 12.1 Métriques de performance du cycle learning lui-même

| Métrique | Formule | Cible | Fréquence |
|---|---|---|---|
| **Taux de complétion DoD** | Sorties obligatoires produites / Sorties obligatoires totales | 100 % | Chaque cycle |
| **Actions de rétro réalisées** | Actions clôturées cycle N / Actions promises cycle N-1 | ≥ 80 % | Chaque cycle |
| **Taux double-loop** | Questions double-loop posées / Rétrospectives | ≥ 1 par H/C | Par cycle H/C |
| **Delta harness** | Règles modifiées par cycle | ≥ 1 | Chaque cycle |
| **Délai postmortem** | Temps entre incident et postmortem publié | ≤ 48 h | Par incident |
| **Inputs discovery créés** | Inputs créés en learning | ≥ 1 par L+ | Chaque cycle |
| **Taux rejet agent** | Propositions rejetées / Propositions totales | ≥ 20 % | Chaque cycle |

### 12.2 Métriques de santé du système (archivées en learning)

**DORA 5 métriques** — archivées à chaque cycle (voir §6.6 pour les seuils).

**SPACE** (si mesuré trimestriellement) :
- Satisfaction : qualité perçue des outils, fatigue, burnout signal.
- Performance : defects user-reported, qualité livrée.
- Activity : indicateurs de flux (commits, PRs, deployments) — ne pas évaluer les individus.
- Communication : qualité revue de code, doc accessible.
- Efficiency : lead time, handoffs, temps de flow ininterrompu.

**Qualité produit ISO 25010** — snapshot de cycle :
- Couverture de tests : tendance vs cycle précédent.
- Taux de défauts échappés en production.
- Violations de SLO : nombre et durée.

**Dette technique** :
- Delta dette = dette créée - dette remboursée (cible : delta ≤ 0 sur 3 cycles consécutifs).
- Âge moyen des items de dette critique (cible : < 2 cycles).

### 12.3 Seuils déclencheurs de changement de cap

| Signal | Seuil | Action requise |
|---|---|---|
| Change Failure Rate > 15 % pendant 3 cycles | Arrêt feature, focus fiabilité | Gel des nouvelles features, investissement tests et risk-based testing |
| Error budget brûlé > 100 % en milieu de période | Focus fiabilité 100 % | Aucune nouvelle feature avant reconstitution du budget |
| Actions de rétro réalisées < 50 % sur 3 cycles | RED CARD processus | Revue du format et de la charge de travail |
| Taux rejet agent < 10 % sur 2 cycles | RED CARD gouvernance | Audit du rubber-stamping, renforcement du quota de rejets |
| Delta dette > 0 sur 5 cycles consécutifs | RED CARD dette | Sprint dédié 100 % remboursement de dette |
| Aucun input discovery produit sur 3 cycles | RED CARD pipeline | Revue de la connexion learning → discovery |
| Coût unitaire dérive > 20 % sans justification | Audit FinOps + revue architecture | FinOps owner + tech lead |

---

## 13. Standards de référence

| Domaine | Standard | Source |
|---|---|---|
| Qualité produit | ISO/IEC 25010:2023 (9 caractéristiques, dont Safety) | iso.org |
| Amélioration continue | Cycle PDCA (Deming / Shewhart) | deming.org |
| Amélioration continue (méthode) | Kaizen — Masaaki Imai, 1986 ; Agile Kaizen — Ángel Medinilla, 2014 | springer.com |
| learning expérientiel | Kolb Experiential Learning Cycle (1984) | simplypsychology.org |
| learning organisationnel | Double-loop learning, Argyris & Schön (1978, 1996) | infed.org |
| Performance livraison | DORA 2024 + DORA 2025 (State of AI-assisted Software Development) | dora.dev |
| Rétrospectives Agile | Scrum Guide 2020, Agile Retrospectives (Derby & Larsen) | scrumguides.org |
| Postmortem blameless | Google SRE Book, Postmortem Culture | sre.google |
| Gestion de la dette | Ward Cunningham (1992) ; Technical Debt Retrospective | teamretro.com |
| Knowledge Management | MemoryBank (AAAI 2024), CoALA (TMLR 2024), Lessons Learned frameworks | asana.com |
| Bien-être et productivité | SPACE (Forsgren et al., ACM Queue) | queue.acm.org |
| Culture organisationnelle | Westrum (3 typologies : pathologique, bureaucratique, générative) + DORA culture | dora.dev |
| Fiabilité | Google SRE Book — SLO, error budgets, multi-burn-rate alerting | sre.google |
| Harness AI agent | Harness Engineering (OpenAI, Arize, 2025-2026) | openai.com, arize.com |

---

## 14. Questions ouvertes (RED CARDS)

Les RED CARDs sont des questions qui bloquent ou menacent la cohérence du système si elles ne sont pas résolues. Elles ne bloquent pas le build mais doivent être adressées avant la prochaine phase de cadrage.

### RED-CARD-A01 — Mécanisation de la mémoire à long terme

**Question** : Comment transformer l'archive des postmortems et rétrospectives en mémoire interrogeable pour informer une décision présente ?

**Contexte** : Le rapport discovery+cadrage (§4.3) identifie cette question comme ouverte. Sans mémoire sémantique structurée, chaque cycle learning repart de zéro. Les 50 postmortems archivés n'informent pas le prochain cadrage.

**Pistes** :
- Index sémantique des décisions passées (`.planning/09-logs/` avec tags + search).
- Base de patterns récurrents avec fréquence et classe de risque associée.
- Agent IA instrumenté pour lire les patterns avant de proposer une classification.

**Priorité** : Haute — à traiter avant le cycle 3 de production.

**Owner** : Architecture harness.

---

### RED-CARD-A02 — Protocole de promotion de classe en cours de cycle

**Question** : Quand on découvre en cours de build qu'un changement classé L est en réalité H, quel est le protocole exact ?

**Contexte** : Identifié en discovery+cadrage §4.6. La promotion de classe est un signal d'apprentissage fort — elle indique que la classification initiale était incorrecte et que l'arbre de décision doit être mis à jour. Sans protocole, la promotion reste un concept.

**Protocole PFV4** :
1. Détection (qui peut détecter : agent, dev, quality gate).
2. Action immédiate : pause de la PR, mise à jour de `.planning/current-risk.yaml`, puis reprise à la SubPhase appropriée.
3. Traçabilité : transition enregistrée dans `.planning/state.yaml`.
4. Alimentation learning : la promotion déclenche une question de double-loop en rétrospective.

**Statut** : fermé par le contrat PFV4 ; les heuristiques de détection restent à calibrer.

**Owner** : Architecture harness.

---

### RED-CARD-A03 — Frontière rétrospective / postmortem en mode solo

**Question** : En mode solo, quand un incident est à la fois un sujet de rétrospective (le processus a raté) et un sujet de postmortem (le système a failli), comment éviter de fusionner les deux et de détruire la valeur des deux ?

**Contexte** : La séparation rétrospective/postmortem est clairement définie (§6.5) mais difficile à maintenir en solo où une seule personne joue tous les rôles. Le risque est que le postmortem devienne accusatoire envers soi-même (le blameless perd son sens) ou que la rétrospective dégénère en analyse d'incident.

**Piste** : protocole d'alternance temporelle — écrire le postmortem le jour même, faire la rétrospective une semaine plus tard. L'agent joue l'avocat du diable à la relecture du postmortem.

**Priorité** : Moyenne.

---

### RED-CARD-A04 — validation de l'hypothèse H7

**Question** : L'hypothèse H7 (« le cycle s'auto-améliore via les rétros et les postmortems ») sera-t-elle tenue ou dégénèrera-t-elle en rituel sans effet ?

**Contexte** : Identifié en discovery+cadrage §8. Le risque est que les rétrospectives deviennent rituelles et non actionnables — particulièrement en solo où il n'y a pas de pression sociale pour maintenir la discipline.

**Indicateur de validation** : au bout de 5 cycles, le Change Failure Rate a baissé, le taux de réalisation des actions de rétro est ≥ 80 %, et au moins 3 règles harness ont été modifiées grâce aux rétrospectives.

**Priorité** : Haute — valider dès le cycle 5.

---

### RED-CARD-A05 — Cohérence métriques DORA 2025 vs 2024

**Question** : Le rapport DORA 2025 a introduit 7 archetypes d'équipe et modifié la lecture des métriques (plus de tiers linéaires). Comment adapter le tableau de métriques (§6.6) à cette nouvelle lecture sans perdre la comparabilité historique ?

**Contexte** : DORA 2025 abandonne les labels Elite/High/Medium/Low au profit de 7 archetypes multidimensionnels. Les seuils du §6.6 sont issus du rapport 2024. La transition nécessite une décision de gouvernance : conserver les seuils 2024 pour la comparabilité ou migrer vers les archetypes 2025.

**Décision recommandée** : conserver les seuils 2024 comme baseline jusqu'au prochain cycle majeur de la pipeline, puis réviser annuellement avec le rapport DORA le plus récent.

**Priorité** : Low — non bloquant, à traiter lors du premier audit annuel.

---

## 15. Relations inter-cycles

### 15.1 Entrées reçues des autres cycles

| Cycle source | Ce qui est transmis | Artefact |
|---|---|---|
| 07 — run | Métriques SLO, incidents, signaux utilisateurs, error budgets consommés | `.planning/07-metrics/`, logs run |
| 05 — validation | Résultats quality gates, défauts découverts, écarts DoD | `.planning/06-quality/`, CI reports |
| 04 — build | Dette technique créée, décisions d'agent, commits, PRs | git log, `.planning/agent/audit.jsonl` |
| 06 — release | Résultats post-déploiement, smoke tests, rollbacks éventuels | `.planning/04-releases/<REL>/` |
| 02 — cadrage | Hypothèses posées, DoR, classification de risque initiale | `docs/03-discovery/`, `.planning/01-roadmap/` |

### 15.2 Sorties transmises aux autres cycles

| Cycle cible | Ce qui est transmis | Artefact |
|---|---|---|
| 01 — discovery | Hypothèses à tester, questions ouvertes, opportunités détectées | `.planning/02-backlog/` — PBI discovery |
| 02 — cadrage | Standards mis à jour, classification de risque révisée, leçons sur les hypothèses | Harness delta, DoR/DoD mis à jour |
| 03 — conception | ADR révisés, patterns à éviter, patterns à reproduire | `docs/13-decisions/`, patterns récurrents |
| 04 — build | Quality gates mis à jour, règles agent mises à jour | Config CI, `.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json` |
| Tous | Culture générative Westrum — blameless, apprentissage systémique | Postmortems publiés, rétrospectives accessibles |

### 15.3 Boucles de feedback court/moyen/long terme

**Court terme (cycle à cycle)** :
- Actions de rétrospective → PBI du prochain sprint.
- Lessons learned postmortem → quality gate ou test ajouté dans le prochain build.
- Delta de classification de risque → arbre de décision mis à jour avant le prochain cadrage.

**Moyen terme (release à release)** :
- Patterns récurrents → décisions d'architecture (ADR).
- Tendances DORA → ajustement de la stratégie de déploiement et de test.
- Tendances de dette → décisions de sprint entier dédié au remboursement.

**Long terme (pipeline à pipeline)** :
- Double-loop learning accumulé → révision des principes invariants de la pipeline (§6.3 du rapport discovery+cadrage).
- validation/invalidation des 7 hypothèses H1-H7 du cadrage → évolution de l'architecture du harness.
- Métriques DORA sur 10+ cycles → calibration des seuils et des règles de classification.

### 15.4 Invariant inter-cycles

Le cycle learning ne modifie **jamais** le périmètre ou les objectifs d'un cycle en cours. Il alimente exclusivement le prochain cycle discovery. Toute modification urgente qui ne peut pas attendre discovery passe par le protocole de promotion de classe (RED-CARD-A02) et le mécanisme de changement de scope (§7 du rapport discovery+cadrage — scope pivot).

---

## Annexe A — Templates d'artefacts

### A.1 Rétrospective de cycle (template)

```markdown
---
id: RETRO-<SPRINT>
cycle: <N>
classe_risque: T/L/M/H/C
date: YYYY-MM-DD
format: Start-Stop-Continue | 4L | Mad-Sad-Glad | Sailboat | Double-loop
durée: XX min
---

## 1. Revue des actions de la rétrospective précédente

| Action | Owner | Faite ? | Impact observé |
|---|---|---|---|
| ... | ... | Oui/Non/Partiel | ... |

## 2. Données brutes du cycle

- Change Lead Time : XX h
- Deployment Frequency : X/semaine
- Failed Deployment Recovery Time : XX min
- Change Failure Rate : X %
- Rework Rate : X %
- SLO violations : X (durée totale XX min)
- Quality gates bloqués : X fois
- Taux rejet agent : X %
- Dette nette : +X items / -X items

## 3. Écarts significatifs

| Écart | Prévu | Réel | Cause supposée |
|---|---|---|---|
| ... | ... | ... | ... |

## 4. Questions de réflexion

*(Format selon le format choisi en §2)*

## 5. Question double-loop

> Quelle règle avons-nous suivie qui a causé ou permis ce problème ?

Réponse : ...

Règle candidate à modifier : ...

## 6. Actions (≤ 3)

| Action | Owner | Date limite | Lié à |
|---|---|---|---|
| ... | ... | YYYY-MM-DD | PBI/DEBT/RULE |

## 7. Hypothèses cadrage — revue

| Hypothèse | Statut | Evidence |
|---|---|---|
| H1 — classification T/L/M/H/C suffisante | Validée / Invalidée / Ouverte | ... |
| ... | ... | ... |

## 8. Inputs discovery générés

- [ ] INPUT-001 : ...
- [ ] INPUT-002 : ...
```

### A.2 Delta harness (template)

```markdown
---
cycle: <N>
date: YYYY-MM-DD
classe_risque: T/L/M/H/C
---

## Règles modifiées

| Règle | Ancienne valeur | Nouvelle valeur | Justification | Source |
|---|---|---|---|---|
| ... | ... | ... | Rétrospective RETRO-X / Postmortem PM-Y | ... |

## Règles confirmées (non modifiées mais validées)

- Règle A : confirmée — aucun écart observé en cycle N.

## Questions ouvertes (non résolues)

- Question X : ... → RED-CARD si bloquant.
```

### A.3 Pattern récurrent (template)

```markdown
## PATTERN-<NNN> — <Titre>

**Première occurrence** : Cycle <N>, Sprint <M>
**Occurrences confirmées** : Cycle <N>, <N+2>, <N+5>
**Classe de risque typique** : L/M/H

**Description** :
...

**Cause racine typique** :
...

**Indicateurs de détection** :
- ...

**Action préventive recommandée** :
- Règle harness : ...
- Quality gate : ...
- DoR / DoD : ...

**Statut** : Actif | Résolu | Atténué
```

---

*Document produit dans le cadre de la pipeline fractale v4 — architecture seule, pas d'implémentation. Versionner dans `docs/cycles/08-apprentissage/`.*
*Références croisées : rapport-discovery-cadrage.md (SOURCE OF TRUTH), compass_artifact_...md (v3 cadre qualité), r1.md (phase 0 clarification), folder.md (architecture .planning/).*
