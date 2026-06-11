# Le Sous-Cycle Fractal à 7 Étapes — Architecture

> **Statut** : document d'architecture — version 1.0
> **Date** : 2026-05-03
> **Auteur** : deep-researcher agent, synthèse multi-sources
> **Objet** : définition exhaustive du sous-cycle universel Observer → Define → Design → Execute → Verify → Capitalize → Transmit, applicable à chacun des 8 cycles de la Pipeline fractale v4.
> **Source de vérité** : §2.2 de `rapport-discovery-cadrage.md`

---

## Sommaire

1. Résumé exécutif
2. Position dans l'architecture (le pattern universel)
3. Objectif du sous-cycle
4. Entrées — DoR par étape
5. Sorties — DoD par étape
6. Concepts clés — les 7 étapes, invariants, variables, récursion fractale
7. Critères qualité (ISO 25010:2023)
8. Modulation par classe de risque (compression/expansion T/L/M/H/C)
9. Manifestation par cycle — matrice 7 étapes × 8 cycles
10. Activités transversales
11. Artefacts produits par étape
12. Métriques et indicateurs
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations avec les cycles et les transversaux

---

## 1. Résumé exécutif

La Pipeline fractale v4 repose sur une idée centrale : **la même discipline s'applique à tous les niveaux**. Chacun des 8 cycles macroscopiques (`discovery → cadrage → conception → build → validation → release → run → learning`) est lui-même un mini-cycle structuré selon 7 étapes invariantes :

```
Observer → Define → Design → Execute → Verify → Capitalize → Transmit
```

Ce sous-cycle est le **pattern fractal fondamental** du système. Il ne se substitue pas aux cycles macroscopiques — il en est le mode opératoire interne. Traverser ces 7 étapes peut prendre 30 secondes sur un changement Trivial, ou plusieurs jours sur un changement Critique. La profondeur varie ; la structure, jamais.

La propriété d'auto-similarité est exacte au sens strict : le même patron se répète à l'échelle du cycle (semaines), à l'échelle de l'incrément (heures), et potentiellement à l'échelle de la tâche (minutes). C'est ce que LeSS nomme "fractal within a sprint" et que Boyd nomme la récursivité des boucles OODA imbriquées.

**Trois tensions structurantes à garder en tête :**
1. Rigueur vs vélocité → résolue par la modulation par risque (T/L = chemin court, H/C = chemin long).
2. Traçabilité vs économie de tokens → résolue par le principe "minimum nécessaire à la prochaine décision".
3. Universalité vs adaptation → résolue par la séparation invariants/variables dans chaque étape.

---

## 2. Position dans l'architecture (le pattern universel)

### 2.1 Vue de la Pipeline fractale

```
MACRO-CYCLES (8)
┌─────────────────────────────────────────────────────────────────┐
│  discovery → cadrage → conception → build →                     │
│  validation → release → run → learning                          │
└─────────────────────────────────────────────────────────────────┘
         │ chacun contient ↓
         ▼
SOUS-CYCLE UNIVERSEL (7 étapes, répété dans chaque macro-cycle)
┌─────────────────────────────────────────────────────────────────┐
│  Observer → Define → Design → Execute →                    │
│  Verify → Capitalize → Transmit                           │
└─────────────────────────────────────────────────────────────────┘
         │ chaque étape peut elle-même contenir ↓
         ▼
MICRO-CYCLES (facultatif, profondeur 3)
┌─────────────────────────────────────────────────────────────────┐
│  Même structure 7 étapes, à l'échelle d'une tâche ou d'une      │
│  session de travail (inner OODA loop, TDD red-green-refactor)   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Propriété d'auto-similarité

La propriété est identique à celle décrite par LeSS pour les sprints fractals : quand on "zoome" à l'intérieur d'un cycle, on retrouve la même structure de feedback. Ce n'est pas une métaphore — c'est une contrainte architecturale : **chaque niveau doit produire un incrément vérifiable et transmettre un apprentissage**.

### 2.3 Relation avec les 3 territoires

| Territoire | Rôle dans le sous-cycle |
|---|---|
| `docs/` | Réceptacle de Capitalize et Transmit — vérité actuelle mise à jour |
| `.planning/` | Registre d'exécution d'Observer à Verify — pilotage vivant |
| `code/tests/infra` | Territoire d'Execute — seule zone touchable en phase `build` |

### 2.5 Matrice de permissions territoire × sous-étape (R007)

Chaque sous-étape du sous-cycle détermine ce que l'agent peut lire (R) ou écrire (W) dans chaque territoire. Cette matrice est dérivée de la matrice complète de `harness-state-machine.md` §5.2, ici projetée sur le sous-cycle universel.

```
LÉGENDE : W=write autorisé | R=read autorisé | — = interdit
```

| Sous-étape | `docs/` | `.planning/` | `code/ tests/` | État harness (MICRO-FSM) |
|---|---|---|---|---|
| Observer | R (W en discovery/cadrage/learning) | W | R | `{CYCLE}.Observer` |
| Define | R (W en discovery/cadrage/learning) | W | R | `{CYCLE}.Define` |
| Design | W (si ADR, en `conception`+) | W | R | `{CYCLE}.Design` |
| Execute | — (sauf `discovery`: W) | W | **W** (`build` seulement) | `{CYCLE}.Execute` |
| Verify | R | W | R | `{CYCLE}.Verify` |
| Capitalize | W | W | R | `{CYCLE}.Capitalize` |
| Transmit | W | R | R | `{CYCLE}.Transmit` |

**Règles dérivées** :
- `code/ tests/` est W **uniquement** en `build.Execute` — c'est la contrainte la plus forte du harness.
- Les frontières de permission sont persistées dans `.planning/state.yaml`; toute modification passe par une transition tracée.
- En état ERROR ou SUSPENDED, tous les territoires passent en R (sauf logs en append).
- La permission la plus restrictive entre la matrice du cycle macroscopique et celle du sous-cycle s'applique (fail-safe).

> **Référence** : `docs/transversal/harness-state-machine.md` §5.2 pour la matrice complète avec les 8 cycles.

### 2.6 Lien MACRO-FSM / MICRO-FSM (R008)

Chaque sous-étape du sous-cycle universel correspond à un **état MICRO-FSM** dans la machine à états du harness (cf. `docs/transversal/harness-state-machine.md` §9). La notation formelle d'un état est `CYCLE.Sous-étape [mode, classe]` — par exemple `build.Execute [auto, M]`.

```
MACRO-FSM (inter-cycles) : IDLE → discovery → cadrage → conception → build → validation → release → run → learning → IDLE
MICRO-FSM (intra-cycle)  : .Observer → .Define → .Design → .Execute → .Verify → .Capitalize → .Transmit
```

Chaque transition MICRO-FSM est un événement `SUBSTEP_COMPLETE` ajouté à `.planning/run-set.json#history`. L'état courant est persisté dans `.planning/state.yaml` avec les champs `macro_state` et `micro_state`.

> **Référence** : `docs/transversal/harness-state-machine.md` §9.1–§9.3 pour les diagrammes MACRO-FSM et MICRO-FSM complets.

### 2.4 Relation avec les 3 modes opératoires

| Mode | Impact sur le sous-cycle |
|---|---|
| Pairing | L'agent traverse toutes les étapes avec le développeur. Validation humaine à chaque étape. |
| `auto` (défaut) | L'agent traverse Observer→Design seul et propose. Le développeur valide avant Execute lorsque la classe ou la policy l'exige. |
| Bypass | L'agent traverse toutes les étapes sans validation humaine. Autorisé seulement sur T/L. |

---

## 3. Objectif du sous-cycle

Le sous-cycle à 7 étapes a **un seul objectif** : garantir que **chaque cycle macroscopique produit un incrément vérifiable et un apprentissage capitalisé**, quelle que soit sa durée ou sa classe de risque.

Les 4 fonctions du sous-cycle :

1. **Alignement** : s'assurer qu'on travaille sur le bon problème avant d'agir (Observer + Define).
2. **Direction** : choisir la meilleure approche avant d'implémenter (Design).
3. **Exécution contrôlée** : implémenter de façon traçable et réversible (Execute).
4. **learning systématique** : capturer ce qui a marché, ce qui n'a pas marché, et transmettre pour le cycle suivant (Verify + Capitalize + Transmit).

Sans Capitalize et Transmit, le système ne s'améliore pas — il répète. C'est l'erreur structurelle de la majorité des processus de développement.

---

## 4. Entrées — DoR par étape

La Definition of Ready (DoR) pour chaque étape définit la **condition minimale d'entrée**. Une étape ne démarre pas si sa DoR n'est pas satisfaite.

### Étape 1 — Observer

**DoR** :
- [ ] Le cycle macroscopique courant est identifié (ex : "nous sommes en cycle `build`, incrément PBI-003").
- [ ] Les sources d'observation sont connues (métriques, logs, feedback utilisateur, backlog, état CI, état prod).
- [ ] Le contexte du dernier sous-cycle est accessible (si récurrent : artefact Transmit du cycle précédent).

### Étape 2 — Define

**DoR** :
- [ ] Les observations de l'étape 1 sont formalisées (même de façon minimaliste).
- [ ] Un problème ou une opportunité a été identifié(e) — pas encore une solution.
- [ ] La classe de risque pressentie est posée (T/L/M/H/C) — confirmée ou révisée à l'étape suivante.

### Étape 3 — Design

**DoR** :
- [ ] Le problème est défini en termes mesurables (critère d'acceptation ou signal de succès).
- [ ] La classe de risque est confirmée (pilote le niveau de rigueur de la conception).
- [ ] Les contraintes sont connues (techniques, réglementaires, budgétaires, temporelles).

### Étape 4 — Execute

**DoR** :
- [ ] Un plan ou une approche est choisie et documentée (même en une ligne pour T/L).
- [ ] Les dépendances sont résolues ou explicitement notées comme risques.
- [ ] Pour H/C : feature flag en place, plan de rollback rédigé, gates CI définis.

### Étape 5 — Verify

**DoR** :
- [ ] L'incrément produit par Execute est disponible (code, doc, décision, artefact).
- [ ] Les critères d'acceptation de l'étape Define sont accessibles pour comparaison.
- [ ] L'environnement de vérification est prêt (CI, staging, outil de validation approprié).

### Étape 6 — Capitalize

**DoR** :
- [ ] La vérification a produit un verdict (PASS / FAIL / PARTIEL) avec preuves.
- [ ] Les écarts entre attendu et réalisé sont documentés.

### Étape 7 — Transmit

**DoR** :
- [ ] La capitalisation est complète (patterns identifiés, anomalies notées).
- [ ] Les destinataires du cycle suivant sont identifiés (cycle macroscopique suivant, ou prochaine itération du même cycle).

---

## 5. Sorties — DoD par étape

La Definition of Done (DoD) par étape définit la **condition minimale de sortie**. Une étape n'est pas terminée si sa DoD n'est pas satisfaite.

### Étape 1 — Observer

**DoD** :
- [ ] Un rapport d'observation existe — même en 3 lignes pour T/L, exhaustif pour H/C.
- [ ] Les signaux faibles et forts sont distingués.
- [ ] L'observation est horodatée et versionnable.

### Étape 2 — Define

**DoD** :
- [ ] Un énoncé de problème/opportunité est écrit (pas une solution).
- [ ] La classe de risque T/L/M/H/C est assignée avec justification.
- [ ] Le critère de succès est testable (au moins un signal mesurable).

### Étape 3 — Design

**DoD** :
- [ ] Au moins une approche est décrite et comparée à ses alternatives (pour M+ : 2+ alternatives documentées).
- [ ] Pour H/C : ADR rédigé, threat model révisé, AIPD déclenchée si applicable.
- [ ] La décision est tracée dans `.planning/` (même une ligne pour T/L).

### Étape 4 — Execute

**DoD** :
- [ ] L'incrément est produit et lisible (code mergé, doc mise à jour, décision prise, artefact créé).
- [ ] Conventional commits appliqués (si code).
- [ ] Quality gates CI verts (si code) : lint, types, SAST, SCA, tests.

### Étape 5 — Verify

**DoD** :
- [ ] Chaque critère d'acceptation de Define est évalué avec un résultat PASS/FAIL.
- [ ] Les bugs bloquants sont ouverts dans le backlog (pas ignorés).
- [ ] Un verdict global est émis : GO / NO-GO / GO avec réserves.

### Étape 6 — Capitalize

**DoD** :
- [ ] Les patterns positifs et négatifs sont nommés et classifiés.
- [ ] Les hypothèses initiales sont révisées (confirmées, infirmées, affinées).
- [ ] Les métriques DORA pertinentes sont mises à jour.

### Étape 7 — Transmit

**DoD** :
- [ ] L'artefact de transmission est écrit dans le territoire cible (`docs/` ou `.planning/`).
- [ ] Le cycle macroscopique suivant dispose d'une entrée exploitable.
- [ ] Les décisions ouvertes sont assignées à un responsable avec une échéance.

---

## 6. Concepts clés — les 7 étapes en détail

### 6.1 Étape 1 — Observer

**Définition** : collecter les signaux pertinents de l'environnement avant toute décision ou action. C'est la phase OODA-Observe de Boyd, la "Concrete Experience" de Kolb, et le "Check" du cycle PDCA dans sa dimension initiatrice.

**Invariant** : toujours présente. Même sur un changement T, une observation minimale (ex : "le lint échoue sur ce fichier") précède l'action. Sauter Observer, c'est agir sur une hypothèse non vérifiée — l'anti-pattern central du développement réactif.

**Variable** : la profondeur et les sources varient selon le cycle macroscopique.
- En `discovery` : entretiens utilisateurs, données produit, analyses de marché.
- En `build` : métriques CI, état du backlog, feedback de la revue de code précédente.
- En `run` : SLO, error budgets, alertes, traces, logs structurés.
- En `learning` : postmortem, rétrospective, métriques DORA du cycle passé.

**Comportement de l'agent IA** :
- Mode Pairing : observation conjointe, l'agent suggère des sources non consultées.
- Mode `auto` : l'agent collecte les signaux disponibles (CI, logs, backlog) et présente un rapport d'observation concis.
- Mode Bypass : l'agent observe et décide seul — acceptable seulement T/L.

**Durée typique** :
- T : 0–30 secondes.
- L/M : 5–30 minutes.
- H/C : 1 h–1 jour (si entretiens, threat model review, etc.).

**Lien Boyd** : "Observe" dans l'OODA loop correspond exactement. Boyd insiste sur l'importance d'observer *plusieurs* niveaux : physique (faits), mental (modèle mental), moral (confiance). En développement logiciel : signaux techniques, signaux produit, signaux équipe.

---

### 6.2 Étape 2 — Define

**Définition** : transformer les observations brutes en un problème ou une opportunité bien posé(e), avec des critères de succès mesurables. C'est "Orient" dans l'OODA loop — la phase la plus critique selon Boyd car c'est là que les biais cognitifs opèrent.

**Invariant** : toujours présente. La tentation de sauter Define pour aller directement à la solution est l'anti-pattern numéro un (cf. rapport v3 §Key Findings #1 : "La Discovery n'est pas optionnelle"). Sur un changement T, Define prend 10 secondes ("le bug est : la fonction X retourne null au lieu de []"). Sur un changement C, Define prend des jours.

**Variable** : le niveau de formalisme.
- T/L : une phrase suffit.
- M : critères d'acceptation INVEST.
- H/C : Problem Statement complet (§2 du rapport r1.md) avec population, impact, alternatives existantes, risques.

**Rôle de la classe de risque** : c'est à l'étape Define que la classe T/L/M/H/C est assignée ou confirmée. Cette classification est le pivot central de tout le système (décision 3.2 du rapport Discovery). Une mauvaise classification ici propage une erreur dans toutes les étapes suivantes.

**Arbre de décision de classification** :
```
Touche authentification/autorisation → H minimum
Touche données personnelles/santé → C minimum
Touche schéma DB ou API publique → H minimum
Touche infra de production → H minimum
Nouvelle fonctionnalité derrière feature flag, pas de PII → L
Refactor sans changement de comportement → T
Doc seule → T
```

**Lien Kolb** : "Reflective Observation" + "Abstract Conceptualization" — on réfléchit sur l'expérience (étape Observer) pour former une représentation conceptuelle du problème.

---

### 6.3 Étape 3 — Design

**Définition** : choisir une approche de résolution parmi les alternatives, en tenant compte des contraintes. C'est "Decide" dans l'OODA loop, "Plan" dans PDCA.

**Invariant** : toujours présente — même implicite. Sur un T ("typo dans un commentaire"), la conception est : "corriger directement, sans branche, sans test". C'est une décision. La rendre explicite, même en 5 secondes, évite les surprises.

**Variable** : le format de sortie.
- T/L : décision implicite ou une phrase.
- M : design doc 1 page ou ADR court.
- H/C : ADR formel, threat model STRIDE, AIPD si données perso., plan de migration expand/contract si schéma DB.

**Propriété critique** : Design est la seule étape où on peut encore **changer d'avis sans coût**. Une fois qu'on entre dans Execute, le coût de changement monte. C'est pourquoi la conception insuffisante sur H/C est l'anti-pattern le plus coûteux — "pay now or pay more later" (cf. report PDCA).

**Alternatives et décision** : pour M+, la conception doit toujours comparer au moins 2 approches. La décision doit être justifiée, pas juste choisie. L'ADR (Architecture Decision Record) est le format cible pour H/C.

**Lien PDCA** : "Plan" dans PDCA. La différence avec PDCA pur : dans le sous-cycle fractal, "Design" est précédé d'une étape d'observation et de définition explicites — ce que PDCA omet souvent en pratique (le "Plan" PDCA absorbe trop facilement les biais non contrôlés).

---

### 6.4 Étape 4 — Execute

**Définition** : implémenter l'approche choisie, de façon traçable, réversible, et conforme aux standards de qualité du cycle macroscopique courant. C'est "Act" dans l'OODA loop, "Do" dans PDCA, "Active Experimentation" dans Kolb.

**Invariant** : toujours présente. C'est l'étape de production de l'incrément. La qualité d'Execute dépend directement de la qualité de Design — exécuter une mauvaise plan parfaitement ne produit pas de valeur.

**Variable** : le périmètre d'action et les standards applicables.
- En `discovery` : rédaction d'une note, conduite d'entretiens, spike technique.
- En `build` : écriture du code (TDD recommandé), tests, logs/métriques, PR.
- En `conception` : rédaction d'ADR, threat model, AIPD.
- En `run` : réponse à une alerte, mitigation d'un incident, mise à jour de runbook.

**Principe de réversibilité** : toute exécution doit être réversible ou arrêtable. Pour le code : feature flags. Pour les migrations : pattern expand/contract. Pour les décisions : ADR révisable. L'irréversibilité augmente le risque — elle est un signal de montée en classe de risque.

**Harness et permissions** : le harness contrôle ce que l'agent peut écrire selon la phase macroscopique. En phase `build`, il peut toucher code/ et tests. Pas `.planning/` du cycle courant (frontières déclaratives + effectives, §2.6 rapport Discovery).

**Granularité** : préférer les petits incréments (≤ 1 jour lead time DORA) même sur des tâches longues. Chaque incrément déclenche un mini-sous-cycle de Vérification avant de continuer. C'est la récursivité fractale à l'œuvre.

**Invariant Execute — Tidy First S/B (R023)** :

Conformément à *Tidy First?* (Kent Beck, 2023) et au `docs/cycles/04-build/concepts-criteria.md` §6.1, chaque commit produit pendant l'étape Execute est soit **S** (Structural) soit **B** (Behavioral), **jamais les deux** :

```
Invariant Execute — Tidy First:
- Commit S (Structural): renommer, réordonner, extraire, déplacer — ZÉRO changement de comportement.
  Types Git: refactor:
- Commit B (Behavioral): feature, fix, perf, test — change ce que le système fait.
  Types Git: feat:, fix:, perf:, test:
- Règle absolue: un commit ne peut pas être S et B simultanément.
- Ordre obligatoire: S d'abord (prépare le terrain), puis B (implémente sur le terrain préparé).
- Limite temporelle: max 1h de travail S sans B (éviter le refactoring sans fin).
- Mesure: 0% de commits mixtes S+B toléré. Signal d'alarme si > 5%.
```

Cette règle s'applique à **tous les cycles** où Execute produit du code (principalement `build`, mais aussi les spikes en `discovery`). En dehors du code (rédaction de docs, ADR), la distinction ne s'applique pas.

---

### 6.5 Étape 5 — Verify

**Définition** : comparer l'incrément produit aux critères de succès définis à l'étape Define. Produire un verdict explicite. C'est "Check" dans PDCA, la boucle de feedback dans OODA, "Reflective Observation" dans Kolb après l'expérimentation.

**Invariant** : toujours présente. C'est la plus souvent sautée sous contrainte de temps — et la plus coûteuse à sauter. Un incrément non vérifié crée de la dette invisible. Sur un T : "le lint passe, le comportement est correct visuellement". Sur un C : campagne de tests complète, validation produit, smoke tests post-déploiement.

**Variable** : les mécanismes de vérification.
- T : vérification mentale ou lint automatique.
- L/M : tests automatisés, CI verte, peer review.
- H : tests de régression, DAST, validation produit en staging, peer review ≥2.
- C : audit de sécurité, tests de charge, validation utilisateur réelle, smoke tests post-déploiement.

**Verdict possible** :
- GO : incrément conforme, on continue.
- NO-GO : incrément non conforme, on revient à Execute (ou Design si l'approche est mauvaise).
- GO avec réserves : incrément acceptable avec risques explicites, dette ouverte dans le backlog.

**Lien PDCA** : "Check" dans PDCA. Distinction importante : dans PDCA classique, "Check" évalue si le plan a fonctionné. Dans le sous-cycle fractal, Verify évalue si l'incrément satisfait les critères de succès formulés lors de Define — critères qui peuvent avoir été affinés pendant la conception. L'ancrage est toujours sur le problème initial, pas sur le plan.

**Invariant Verify — anti-rubber-stamp (R012)** :

Ce bloc est **non négociable** pour empêcher la dégénérescence de Verify en validation automatique aveugle :

```
Invariant Verify — anti-rubber-stamp:
- Format obligatoire: chaque vérification documente OK/NOK + justification ≥ 1 phrase
- Quota rejets: ≥ 20% des vérifications doivent produire NOK sur une fenêtre de 10 runs
- Audit aléatoire: 1 vérification/semaine auditée par agent tiers
```

**Détail des garde-fous** :
- Un verdict "GO" sans justification documentée est un anti-pattern. Chaque critère d'acceptation évalué doit être accompagné d'une justification en au moins une phrase — pas un simple checkmark.
- Le quota de 20% NOK sur 10 runs est un indicateur de santé : si 100% des vérifications passent, c'est un signal fort de rubber-stamp (cf. `docs/transversal/risk-classification.md` §Annexe B, garde-fous anti-rubber-stamp). Le quota est mesuré par rolling window et tracé dans `.planning/07-metrics/`.
- L'audit aléatoire hebdomadaire est réalisé par un agent tiers (ou par le développeur en self-review différée ≥ 24h). Une vérification acceptée est relue à froid pour détecter les biais de confirmation.

---

### 6.6 Étape 6 — Capitalize

**Définition** : extraire et formaliser les apprentissages du sous-cycle. Identifier les patterns positifs (à réutiliser), les anomalies (à corriger), et les hypothèses qui ont été confirmées ou infirmées. C'est "Act" dans PDCA (la standardisation), "Abstract Conceptualization" dans Kolb.

**Invariant** : toujours présente — même minimale. Sans Capitalize, le système répète sans apprendre. C'est l'étape qui transforme l'expérience en compétence organisationnelle.

**Variable** : le niveau de formalisme.
- T/L : rien à écrire explicitement si tout s'est passé comme prévu. Un mot si anomalie.
- M : mise à jour du backlog, note dans l'ADR si décision révisée.
- H/C : rétrospective de cycle, mise à jour des métriques DORA, consolidation des patterns dans la mémoire système, mise à jour des templates si pertinent.

**Principe économique** : capitaliser au strict nécessaire pour la prochaine décision (décision 3.8 du rapport Discovery). L'agent ne doit pas remplir `.planning/` d'artefacts qu'il ne consultera jamais. La règle : "si cet apprentissage ne change pas une prochaine décision, il n'a pas besoin d'être formalisé".

**Contenu type d'une capitalisation** :
```
Patterns confirmés : [liste]
Hypothèses infirmées : [liste + révision]
Anomalies : [liste + tickets ouverts]
Métriques : [DORA deltas, budget consommé]
Templates mis à jour : [liste]
```

---

### 6.7 Étape 7 — Transmit

**Définition** : rendre les apprentissages capitalisés accessibles au cycle macroscopique suivant (ou à la prochaine itération du même cycle). Mettre à jour les territoires `docs/` et `.planning/` appropriés. Clore le sous-cycle proprement.

**Invariant** : toujours présente. Un sous-cycle sans Transmit est un sous-cycle mort — ses apprentissages meurent avec lui. C'est l'étape qui crée la continuité inter-cycles, la mémoire du système.

**Variable** : le territoire de destination et le format.
- Fin d'un cycle `discovery` → vers `cadrage` : mettre à jour `docs/03-discovery/`, ouvrir les items de backlog.
- Fin d'un incrément `build` → vers le prochain incrément : commit + PR + mise à jour `.planning/`.
- Fin d'un cycle `learning` → vers le prochain `discovery` : rétrospective capitalisée, patterns mis à jour dans les règles ou templates.

**Distinction Capitalize / Transmit** :
- Capitalize = extraction (travail interne : "qu'ai-je appris ?").
- Transmit = diffusion (travail externe : "qui a besoin de quoi pour la suite ?").
Ces deux étapes sont souvent confondues. Les séparer garantit que les apprentissages ne restent pas dans la tête de l'auteur.

**Forme de l'artefact de transmission** :
```
Contexte : [état du cycle à la clôture]
Décisions prises : [liste avec liens ADR]
Travail accompli : [incréments livrés]
Travail reporté : [avec raison]
Risques ouverts : [avec owner et échéance]
Prochaine action recommandée : [une phrase]
```

---

### 6.8 Invariants du sous-cycle (ce qui ne change jamais)

Les invariants suivants sont **non négociables** à tous les niveaux (macro, micro) et pour toutes les classes de risque :

1. **Séquentialité** : les étapes ne peuvent pas être permutées. Observer avant Define, Define avant Design, etc. On peut compresser mais pas réordonner.
2. **Présence de toutes les étapes** : même compressée à 1 seconde, chaque étape est traversée. "Skipping" n'existe pas — seulement "compression".
3. **Traçabilité minimale** : chaque sous-cycle laisse une trace, aussi courte soit-elle. La trace d'un T peut être un commit message. La trace d'un C est un dossier complet.
4. **Verdict explicite à Verify** : GO / NO-GO / GO avec réserves — jamais implicite.
5. **Transmission vers le cycle suivant** : le cycle suivant dispose toujours d'une entrée, même minimale.

### 6.9 Variables du sous-cycle (ce qui s'adapte)

| Dimension | T | L | M | H | C |
|---|---|---|---|---|---|
| Durée totale | Minutes | Heures | Heures-Jours | Jours | Semaines |
| Profondeur Observer | Mental/auto | 5 min | 30 min | 1-2h | 1 jour+ |
| Profondeur Define | 1 phrase | Critères | INVEST | Problem Statement | Complet |
| Profondeur Design | Implicite | 1 ligne | Design note | ADR | ADR + TM |
| Profondeur Execute | Direct | Branche courte | TDD + PR | TDD + review ≥2 | TDD + review ≥2 + flags |
| Profondeur Verify | Mental | CI | CI + staging | CI + DAST + prod staging | CI + audit + utilisateurs |
| Profondeur Capitalize | Rien si OK | 1 ligne si anomalie | Backlog MàJ | Rétro partielle | Rétro complète |
| Profondeur Transmit | Commit msg | Note | Artefact court | Artefact structuré | Dossier complet |

### 6.10 Récursion fractale — profondeur 3

Le sous-cycle peut s'instancier à 3 profondeurs :

**Profondeur 1 — Niveau macro-cycle** (semaines/mois) :
Un cycle complet `discovery` traverse les 7 étapes à l'échelle d'une phase produit entière.

**Profondeur 2 — Niveau incrément** (heures/jours) :
Un incrément PBI dans le cycle `build` traverse les 7 étapes à l'échelle d'une PR ou d'une session de travail.

**Profondeur 3 — Niveau tâche** (minutes) :
Une tâche TDD (red-green-refactor) traverse les 7 étapes à l'échelle d'un test. Observer = lire l'échec du test. Define = comprendre pourquoi. Design = choisir l'implémentation minimale. Execute = écrire le code. Verify = le test passe. Capitalize = refactorer. Transmit = commit.

**Limite de profondeur recommandée** : 3 niveaux maximum. Au-delà, la surcharge cognitive dépasse le bénéfice structurel.

---

## 7. Critères qualité (ISO 25010:2023)

Les 9 caractéristiques ISO 25010:2023 se mappent sur les étapes du sous-cycle :

| Caractéristique ISO 25010:2023 | Étapes primaires | Signal de défaut |
|---|---|---|
| Functional suitability | Define, Verify | Critères d'acceptation non testables |
| Performance efficiency | Design, Verify | Absence de benchmark ou de SLO dans Verify |
| Compatibility | Design, Execute | ADR absent sur les dépendances |
| Interaction capability (ex-Usability) | Observer, Define | Pas d'observation utilisateur réelle |
| Reliability | Execute, Verify | Feature flags absents sur H/C |
| Security | Design, Verify | Threat model absent sur H/C |
| Maintainability | Capitalize, Transmit | Pas d'ADR, pas de doc mise à jour |
| Flexibility | Design | Architecture rigide choisie sans alternatives |
| Safety (nouveau 2023) | Define, Design | Risques patient/utilisateur non identifiés |

**Critères qualité spécifiques du sous-cycle lui-même** (méta-qualité) :
- Le sous-cycle est **complet** : les 7 étapes sont traversées à la profondeur requise par la classe de risque.
- Le sous-cycle est **tracé** : chaque étape a laissé un artefact minimal.
- Le sous-cycle est **cohérent** : les critères de Verify correspondent aux objectifs de Define.
- Le sous-cycle est **économe** : pas d'artefacts superflus (anti-pattern : sur-documentation de T/L).

---

## 8. Modulation par classe de risque

### 8.1 Compression pour T/L

Sur les changements Trivial et Low, le sous-cycle est **compressé** mais pas supprimé. Les étapes fusionnent de façon mentale ou automatisée.

**Exemple T — correction d'un commentaire incorrect** :
```
Observer  : le commentaire est faux (3 secondes de lecture)
Define   : "commentaire incorrect ligne 42" (implicite)
Design : "corriger directement" (implicite)
Execute  : modifier le fichier, commit "docs: fix incorrect comment on line 42"
Verify  : CI passe (automatique)
Capitalize: rien
Transmit: le commit message est la transmission
Durée totale : ~2 minutes
```

**Exemple L — nouvelle fonctionnalité derrière feature flag, pas de PII** :
```
Observer  : lire le ticket PBI + state CI actuel (5-10 min)
Define   : critères d'acceptation (15 min)
Design : approche choisie, 1 ligne de décision (10 min)
Execute  : TDD, PR, feature flag OFF (heures)
Verify  : CI verte, peer review (30-60 min)
Capitalize: mise à jour ticket (5 min)
Transmit: PR merge + planning update (5 min)
Durée totale : quelques heures
```

### 8.2 Expansion pour H/C

Sur les changements High et Critiques, chaque étape est **expansée** avec des sous-activités obligatoires.

**Exemple H — ajout d'un endpoint d'authentification** :
```
Observer  : lecture SLO actuels, threat model existant, backlog sécurité, incidents récents (1-2h)
Define   : Problem Statement complet, classe H confirmée, critères d'acceptation avec cas
            de sécurité (authn/authz failures, rate limiting) (2-4h)
Design : ADR rédigé, threat model STRIDE mis à jour, 2 alternatives comparées,
            plan de tests de sécurité, feature flag design (4-8h)
Execute  : TDD avec tests de sécurité, PR ≤400 lignes, logs structurés, métriques
            ajoutées, feature flag OFF par défaut (1-2 jours)
Verify  : CI verte, DAST sur preprod, peer review ≥2, validation produit en staging,
            smoke tests, SLO surveillés (4-8h)
Capitalize: rétrospective partielle, métriques DORA mises à jour, threat model archivé (1h)
Transmit: artefact structuré dans .planning/ + docs/ mis à jour, prochaine action
             notée (30 min)
Durée totale : 2-4 jours
```

### 8.3 Matrice de compression/expansion

| Étape | T | L | M | H | C |
|---|---|---|---|---|---|
| Observer | Mental/auto | 5-15 min | 15-60 min | 1-2h | 1j+ |
| Define | Implicite | 15 min | 30 min-1h | 2-4h | 4-8h |
| Design | Implicite | 10 min | 30 min-1h | 4-8h | 1-2j |
| Execute | Minutes | Heures | Heures-1j | 1-2j | 2-5j |
| Verify | Auto | 30-60 min | 1-4h | 4-8h | 1-2j |
| Capitalize | Rien | 5 min | 15-30 min | 1h | 2-4h |
| Transmit | Commit msg | 10 min | 20 min | 30-60 min | 1-2h |
| **Total** | **~2 min** | **~4h** | **1-2j** | **3-5j** | **1-3 sem** |

### 8.4 Promotion de classe en cours de cycle

Quand une observation en cours d'Execute révèle que la classe réelle est supérieure à la classe assignée (ex : L classé → H découvert) :

1. **Stop** : arrêter Execute immédiatement.
2. **Revenir à Define** : reclassifier, reformuler le problème avec la nouvelle classe.
3. **Revenir à Design** : refaire la conception avec les contraintes H/C (ADR, threat model, etc.).
4. **Reprendre Execute** avec le niveau de rigueur approprié.
5. **Logger la promotion** : dans `.planning/` — date, ancien risque, nouveau risque, cause.
6. **learning systémique** : la promotion doit alimenter l'arbre de décision de classification pour éviter la répétition.

**Schéma YAML de l'historique de promotion (R018)** :

Chaque promotion de classe est enregistrée dans le champ `escalation_history` de l'item de backlog ou du PR metadata. Le format est append-only :

```yaml
escalation_history:
  - from: T
    to: M
    trigger: "auth surface touched"
    timestamp: 2026-05-03T14:32:00Z
    agent: <agent-id>
    approved_by: human|auto
  - from: M
    to: H
    trigger: "migration DB détectée dans le diff"
    timestamp: 2026-05-04T09:15:00Z
    agent: agent-reviewer-042
    approved_by: human
```

**Champs** :
- `from` / `to` : classe de risque avant et après promotion (T/L/M/H/C).
- `trigger` : signal de forçage qui a déclenché la promotion (cf. `docs/transversal/risk-classification.md` §4.3).
- `timestamp` : horodatage ISO 8601.
- `agent` : identifiant de l'agent qui a détecté la promotion.
- `approved_by` : `human` si validée explicitement par le développeur, `auto` si la promotion est automatique via l'arbre de forçage (seulement pour les promotions vers H minimum ou C minimum déclenchées par les signaux non négociables).

---

## 9. Manifestation par cycle — matrice 7 étapes × 8 cycles

### 9.1 Cycle 1 — discovery

**Trois sous-modes de discovery (R013)** — Le cycle `discovery` s'applique à trois modes selon la source du besoin (cf. `docs/cycles/01-discovery/concepts-criteria.md` §3.3). Ces trois modes partagent le même sous-cycle à 7 étapes, pas trois cycles séparés :

| Sous-mode | Source du besoin | Méthodes clés | Critère de sortie spécifique |
|---|---|---|---|
| **Produit** | Utilisateurs externes | Entretiens JTBD, Opportunity Solution Tree, Continuous Discovery (Torres) | ≥ 5 conversations utilisateurs OU source quantitative équivalente |
| **Self-feedback** | Développeur = utilisateur principal | Formalisation écrite, tests de nécessité, agent IA en "mauvais utilisateur" | Problème écrit, formalisé, stressé par l'agent — pas seulement oral |
| **Technique** | Signal d'architecture (dette, opportunité, contrainte nouvelle) | Document de justification, alternatives documentées, critères ex-post mesurables | Justification ≥ 3 alternatives considérées, critères mesurables définis |

| Étape | Manifestation concrète |
|---|---|
| Observer | Entretiens utilisateurs, données produit, analyse concurrents, JTBD, signaux marché |
| Define | Problem Statement, Opportunity Solution Tree, hypothèses falsifiables |
| Design | Note de discovery (1-3 pages), prototype/spike, critères de problem-solution fit |
| Execute | Entretiens formels, prototypage, spike technique timeboxé (max 5 jours) |
| Verify | Validation problem-solution fit, ≥5 conversations utilisateurs confirmant le problème |
| Capitalize | Décisions discovery, hypothèses confirmées/infirmées, backlog initial |
| Transmit | Note de discovery versionnée dans `docs/03-discovery/`, entrée pour `cadrage` |

### 9.2 Cycle 2 — cadrage

| Étape | Manifestation concrète |
|---|---|
| Observer | Lire note discovery, backlog initial, contraintes (budget, temps, réglementaires) |
| Define | Vision produit (1 phrase), objectifs SMART/OKR, périmètre IN/OUT explicite |
| Design | Charter/one-pager, RACI léger, performance budget technique ET financier |
| Execute | Rédaction Charter, backlog raffiné avec DoR, classification de risque du projet |
| Verify | Validation sponsor + PO + tech lead, performance budget négocié |
| Capitalize | Décisions de cadrage, contraintes identifiées, hypothèses H1-H7 posées |
| Transmit | Charter dans `docs/01-governance/`, backlog dans `.planning/02-backlog/`, entrée pour `conception` |

### 9.3 Cycle 3 — conception

| Étape | Manifestation concrète |
|---|---|
| Observer | Lire Charter, backlog raffiné, état de l'existant technique |
| Define | Choix d'architecture à décider, flux RGPD, parcours d'accessibilité critiques |
| Design | ADR, threat model STRIDE, AIPD si applicable, design docs, SLI/SLO, plan de tests |
| Execute | Rédaction ADR, maquettes, modélisation domaine (Event Storming), spécifications |
| Verify | Review ADR par tech lead + sécurité (H/C) + DPO (si AIPD) |
| Capitalize | Architecture décidée et justifiée, risques techniques documentés |
| Transmit | ADR dans `docs/13-decisions/`, design docs dans `docs/07-architecture/`, entrée pour `build` |

### 9.4 Cycle 4 — build

| Étape | Manifestation concrète |
|---|---|
| Observer | CI state, backlog sprint, feedback review précédente, SLO actuels |
| Define | Story sélectionnée (DoR OK), critères d'acceptation, classe de risque confirmée |
| Design | Approche TDD, plan de branche/feature flag, structure de la PR |
| Execute | Code + tests + logs/métriques, commits Conventional, PR ≤400 lignes |
| Verify | CI verte (lint, types, tests, SAST, SCA), peer review, staging si M+ |
| Capitalize | DoD vérifiée, dette créée/remboursée notée, flaky tests identifiés |
| Transmit | PR mergée, `.planning/` mis à jour, ticket clôturé, entrée pour `validation` |

**Note — récursivité dans build** : chaque PBI traverse un sous-cycle complet. À l'intérieur d'un PBI, chaque session TDD (red-green-refactor) traverse un micro-sous-cycle. C'est la profondeur 3 de la récursivité fractale.

### 9.5 Cycle 5 — validation

| Étape | Manifestation concrète |
|---|---|
| Observer | Incrément produit par `build`, métriques CI, résultats tests automatisés |
| Define | Scope de validation (périmètre de changement, risques résiduels, cas critiques) |
| Design | Plan de validation risk-based (ISO 29119), matrice probabilité × impact |
| Execute | Tests exploratoires zones rouges, DAST si H/C, tests accessibilité manuels, tests de charge |
| Verify | Verdict GO/NO-GO, critères d'acceptation évalués un à un |
| Capitalize | Bugs ouverts, matrice de couverture mise à jour, patterns de défauts identifiés |
| Transmit | Rapport de validation dans `.planning/04-releases/`, recommandation pour `release` |

### 9.6 Cycle 6 — release

| Étape | Manifestation concrète |
|---|---|
| Observer | Rapport validation, SLO actuels, error budget disponible, planning de déploiement |
| Define | Stratégie de déploiement (direct/canary/blue-green/feature flag), plan de rollback |
| Design | Release plan détaillé, communication aux parties prenantes, migration expand si applicable |
| Execute | Pipeline de déploiement automatisé, vérification SLSA/SBOM, smoke tests post-déploiement |
| Verify | SLO surveillés en temps réel, smoke tests verts, error budget non dégradé |
| Capitalize | Release notes, métriques DORA (deployment frequency, lead time), incident éventuel loggé |
| Transmit | Release notes dans `docs/`, état prod à jour dans `.planning/04-releases/`, entrée pour `run` |

### 9.7 Cycle 7 — run

| Étape | Manifestation concrète |
|---|---|
| Observer | SLO, error budgets, alertes, logs, traces, métriques RED/USE, feedback utilisateurs |
| Define | Identifier dérives ou incidents (SLO breach, anomalie coût, signaux support) |
| Design | Plan de réponse (runbook, mitigation, escalade), décision gel features si error budget épuisé |
| Execute | Mitigation incident, correctif hotfix, communication statut, on-call response |
| Verify | SLO restaurés, incident mitigé, erreur budget stabilisé |
| Capitalize | Incident loggé, métriques DORA (recovery time), causes identifiées |
| Transmit | Postmortem blameless dans `docs/`, alerte dans backlog si pattern récurrent, entrée pour `learning` |

**Note** : `run` est le cycle le plus OODA-pur. La boucle se ferme en minutes (incident) ou heures (dérive). Observer et Décider sont critiques — c'est dans `run` que Boyd's "getting inside the opponent's decision cycle" est le plus littéralement applicable.

### 9.8 Cycle 8 — learning

| Étape | Manifestation concrète |
|---|---|
| Observer | Métriques DORA du cycle passé, postmortems, rétrospectives, hypothèses H1-H7 confirmées/infirmées |
| Define | Identifier les patterns systémiques (bugs récurrents, classes de risque mal estimées, anti-patterns) |
| Design | Plan d'amélioration du processus, décisions architecturales à réviser, templates à mettre à jour |
| Execute | Mise à jour des règles/templates/agents, correction des outils de classification de risque |
| Verify | Les améliorations du processus sont vérifiables sur le prochain cycle ? Métriques cibles définies |
| Capitalize | Patterns capitalisés dans la mémoire système (décision 4.3 rapport Discovery), biais documentés |
| Transmit | Retrospective doc dans `docs/`, rules/agents mis à jour, entrée enrichie pour le prochain `discovery` |

---

## 10. Activités transversales

Ces activités ne sont pas des étapes — elles imprègnent toutes les étapes de tous les cycles.

### 10.1 Sécurité shift-left (DevSecOps)

Présente à chaque étape :
- Observer : surveillance des CVE, alertes sécurité.
- Define : identifier si le changement touche une surface d'attaque.
- Design : threat model STRIDE itératif (90 min max pour H/C).
- Execute : SAST, secrets scan, SCA en CI.
- Verify : DAST sur preprod, validation contremesures STRIDE.
- Capitalize : CVE gérées, patterns de vulnérabilités identifiés.
- Transmit : threat model à jour dans `docs/09-security-compliance/`.

### 10.2 Privacy by Design

- Observer : signaux de nouveaux traitements de données personnelles.
- Define : identifier si AIPD est déclenchée (≥2 critères WP29).
- Design : Privacy by Design (Cavoukian 7 principes), minimisation des données.
- Execute : chiffrement, pseudonymisation, registre de traitement.
- Verify : AIPD validée, droits personnes implémentés.
- Capitalize : registre de traitement à jour.
- Transmit : AIPD dans `docs/09-security-compliance/`.

### 10.3 Privacy — LINDDUN (R015)

Pour les changements H/C impliquant des données personnelles, le threat modeling privacy utilise la méthodologie **LINDDUN** (Linkability, Identifiability, Non-repudiation, Detectability, Disclosure of information, Unawareness, Non-compliance) en complément de STRIDE :

- Observer : identifier si de nouveaux traitements de données personnelles sont envisagés.
- Define : vérifier si ≥ 2 critères WP29 sont cochés (profilage, données sensibles, grande échelle, surveillance systématique, décision automatisée, technologie innovante) → AIPD obligatoire art. 35 RGPD.
- Design : appliquer LINDDUN sur les flux de données personnelles (7 catégories de menaces privacy). Produire les contremesures privacy (minimisation, pseudonymisation, chiffrement, consentement).
- Execute : implémenter les contremesures identifiées (pseudonymisation logs, chiffrement at-rest, droits personnes).
- Verify : valider que l'AIPD est complète, que les droits des personnes sont implémentés.
- Capitalize : registre de traitement mis à jour.
- Transmit : AIPD dans `docs/09-security-compliance/`.

> **Référence** : `docs/transversal/risk-classification.md` §10.2 pour le mapping Privacy/RGPD par classe de risque. LINDDUN est obligatoire pour classe C si PII (cf. §6.1 classe C, chemin obligatoire : "STRIDE + LINDDUN si privacy").

### 10.4 FinOps

- Observer : coûts actuels (cloud, LLM tokens, CI/CD minutes).
- Define : si M+ : impact coût estimé.
- Design : performance budget €/feature.
- Execute : tagging des ressources, pas de cap LLM absent.
- Verify : pas de régression coût >10% sans justification.
- Capitalize : coût unitaire mis à jour.
- Transmit : budget mis à jour dans métriques.

### 10.5 Accessibilité et i18n by Design

- Define : identifier si des parcours utilisateurs critiques sont touchés.
- Design : plan accessibilité WCAG 2.2 AA, CSS logical properties pour RTL.
- Execute : HTML sémantique, ARIA minimal, aucune chaîne hardcodée.
- Verify : axe-core en CI, test clavier manuel si H/C.
- Transmit : déclaration d'accessibilité mise à jour si applicable.

### 10.6 Supply Chain — SLSA / SBOM (R026)

La sécurité de la chaîne d'approvisionnement logicielle est une activité transversale active **à partir du cycle Build** et persistante dans tous les cycles aval (Validation, Release, Run) :

- **SLSA L2 minimum** pour H/C : provenance vérifiable des artefacts, build automatisé, source versionnée.
- **SBOM** généré à chaque build (format **CycloneDX** ou **SPDX**) : inventaire complet des dépendances directes et transitives, associé à l'artefact dans le registre.
- **Signature artefact** via **Cosign/Sigstore** pour H/C : garantit l'authenticité et l'intégrité de l'artefact déployé.
- **SCA en CI** : scan des dépendances pour CVE connues et licences incompatibles à chaque commit.

| Classe | SBOM | Signature artefact | SLSA provenance |
|---|---|---|---|
| T | — | — | — |
| L | — | — | — |
| M | ○ recommandé | — | — |
| H | ✅ obligatoire | ✅ Cosign/Sigstore | ✅ SLSA L2 |
| C | ✅ obligatoire | ✅ Cosign/Sigstore | ✅ SLSA L3 |

> **Référence** : `docs/transversal/risk-classification.md` §10.1 (Supply chain colonne dans la matrice sécurité) et `docs/cycles/04-build/concepts-criteria.md` §6.7 (gestion des dépendances et supply chain).

---

## 11. Artefacts produits par étape

| Étape | Artefact T/L | Artefact M | Artefact H/C |
|---|---|---|---|
| Observer | Mental / CI report | Note d'observation | Rapport d'observation structuré |
| Define | 1 phrase / ticket | Critères INVEST + classe risque | Problem Statement + arbre décision |
| Design | Commit implicite | Design note / ADR court | ADR formel + threat model + AIPD |
| Execute | Commit/PR | PR + tests + logs | PR + tests + feature flag + plan rollback |
| Verify | CI résultat | Rapport de test + peer review | Rapport complet + DAST + verdict GO/NO-GO |
| Capitalize | Rien / 1 ligne | Backlog MàJ + métriques delta | Rétro + DORA MàJ + patterns capitalisés |
| Transmit | Commit message | Note courte dans .planning/ | Artefact structuré docs/ + .planning/ |

### Territoires de persistance des artefacts

```
docs/
├── 01-governance/         ← Transmit (cadrage, learning)
├── 03-discovery/          ← Transmit (Discovery)
├── 07-architecture/       ← Transmit (Conception, Build ADR)
├── 08-quality/            ← Capitalize (patterns qualité)
├── 09-security-compliance/← Transmit (threat model, AIPD)
├── 13-decisions/          ← Transmit (ADR)
└── 90-templates/          ← Transmit (learning)

.planning/
├── 02-backlog/            ← Define (items créés/raffinés)
├── 03-sprints/            ← Execute + Verify
├── 04-releases/           ← Verify + Transmit (Release)
├── 06-quality/            ← Verify + Capitalize
├── 07-metrics/            ← Capitalize (DORA)
├── 08-risks/              ← Observer + Define
└── 09-logs/decision-log   ← Design + Capitalize
```

### Artefacts harness — état et contrôle

Les artefacts suivants sont produits et maintenus par le harness pour le contrôle du sous-cycle. Ils sont transversaux à toutes les étapes.

| Artefact | Chemin | Format | Rôle | Mis à jour par |
|---|---|---|---|---|
| **État courant (R010)** | `.planning/state.yaml` | YAML | Persiste le `macro_state`, `micro_state`, `mode`, `last_transition` et les frontières de permission effectives. Source de vérité de l'état courant du harness. | Agent à chaque transition contrôlée |
| **Risque courant (R010)** | `.planning/current-risk.yaml` | YAML | Persiste `risk_class`, justification, signaux de forçage et validation active. | Agent à chaque classification/reclassification |
| **Run set (R010/R011/R016/R017)** | `.planning/run-set.json` | JSON | Contient `history`, `evidence`, `risk_promotions`, `observer_manifest` et `checkpoints`. Reconstituable sans fichiers de log séparés. | Agent en append logique |

> **Référence** : `docs/transversal/harness-state-machine.md` §4 (événements), §5.2 (matrice permissions), §11 (artefacts permanents).

**Format d'une entrée `checkpoints[]` de sous-cycle interrompu (R017)** :

```json
{
  "checkpoint_ts": "2026-05-03T16:32:00Z",
  "session_id": "sess_abc123",
  "cycle": "build",
  "etape_courante": "Execute",
  "etapes_completees": ["Observer", "Define", "Design"],
  "etapes_restantes": ["Execute", "Verify", "Capitalize", "Transmit"],
  "risk_class": "M",
  "mode": "auto",
  "active_item_ref": ".planning/02-backlog/items/PBI-042.md",
  "resume": "TDD en cours sur le module auth — 3 tests verts sur 7 prévus",
  "artefacts_produits": [
    ".planning/03-sprints/sprint-005/PBI-042-design-note.md",
    ".planning/09-logs/decision-log.md"
  ],
  "interrupt_reason": "SESSION_END"
}
```

Ce checkpoint est lu lors du prochain `SESSION_START` pour reprendre le sous-cycle exactement où il a été interrompu. Il fait partie de la DoR de l'étape Observer lorsqu'un sous-cycle reprend après interruption.

---

## 12. Métriques et indicateurs

### 12.1 Métriques de santé du sous-cycle

| Métrique | Calcul | Cible | Signal d'alarme |
|---|---|---|---|
| Taux de complétion 7 étapes | Sous-cycles avec 7 étapes tracées / total | 100% sur H/C, 80% sur M | < 60% global |
| Taux de promotion de classe | Sous-cycles avec reclassification / total | < 10% (signe de bonne classification initiale) | > 20% |
| Taux NO-GO à Verify | Sous-cycles avec verdict NO-GO / total | < 15% | > 25% (conception insuffisante) |
| Délai Define → Execute | Temps médian entre fin Define et début Execute | < 1h pour T/L, < 1j pour M | > 2j pour T/L |
| Taux de skip Capitalize | Sous-cycles sans artefact Capitalize sur M+ | 0% | > 10% |
| Taux de skip Transmit | Sous-cycles sans artefact Transmit sur M+ | 0% | > 5% |

### 12.2 Métriques DORA liées au sous-cycle

| Métrique DORA | Étape primaire | Interprétation |
|---|---|---|
| Change Lead Time | Define → Transmit | Durée totale du sous-cycle. Cible top : < 1 jour |
| Deployment Frequency | Transmit (Release) | Fréquence de clôture du sous-cycle Release. Cible : quotidien |
| Change Failure Rate | Verify (post-déploiement) | % de sous-cycles Release qui génèrent un incident |
| Failed Deployment Recovery Time | Observer + Design (Run) | Vitesse de traversée du sous-cycle Run sur incident |
| Rework Rate | Capitalize | % de sous-cycles qui génèrent des correctifs sur le prochain cycle |

### 12.3 Indicateurs de qualité du sous-cycle

- **Cohérence Define-Verify** : les critères de Verify correspondent-ils aux objectifs de Define ? (audit manuel, trimestriel)
- **Depth appropriateness** : la profondeur de chaque étape est-elle proportionnelle à la classe de risque ? (audit mensuel)
- **Transmission rate** : le cycle suivant a-t-il pu démarrer son Observer sans ambiguïté ? (mesure qualitative, rétrospective)

---

## 13. Standards de référence

| Standard | Mapping dans le sous-cycle | Source |
|---|---|---|
| OODA Loop (Boyd, 1976) | Observer=Observe, Define=Orient, Design=Decide, Execute=Act | [Wikipedia OODA](https://en.wikipedia.org/wiki/OODA_loop) |
| PDCA / PDSA (Deming/Shewhart) | Design=Plan, Execute=Do, Verify=Check, Capitalize+Transmit=Act | [Deming Institute PDSA](https://deming.org/explore/pdsa/) |
| Kolb Experiential Learning (1984) | Observer=Concrete Experience, Define=Reflective Observation, Design=Abstract Conceptualization, Execute=Active Experimentation | [Kolb Wikipedia](https://en.wikipedia.org/wiki/Kolb%27s_experiential_learning) |
| Scrum Inner/Outer Loop | Sprint = macro-cycle, Daily OODA = micro-cycle. Même récursivité fractale | [Scrum.org fractal systems](https://www.scrum.org/fractal-systems) |
| LeSS Sprint Fractal (2022) | Auto-similarité à 3 niveaux : organisation, équipe, item | [LeSS Blog](https://less.works/blog/2022/03/13/the-less-sprint-fractal.html) |
| Continuous Discovery (Torres) | Observer dans Discovery = entretiens continus | [producttalk.org](https://producttalk.org) |
| ISO/IEC 25010:2023 | Verify = test des 9 caractéristiques qualité | [iso.org](https://iso.org) |
| ISO/IEC/IEEE 29119 | Verify = risk-based testing framework | [iso.org](https://iso.org) |
| Google SRE (multi-burn-rate) | Observer dans Run = alerting SLO | [sre.google](https://sre.google) |
| DORA 2024/2025 | Métriques de 5 des 7 étapes | [dora.dev](https://dora.dev/research/2024/dora-report/) |
| Tidy First (Beck, 2023) | Execute = commit S ou B, jamais mixé | [Tidy First book] |
| ADR (Nygard) | Transmit (Conception) = Architecture Decision Records | [adr.github.io](https://adr.github.io) |

### 13.1 Mapping détaillé OODA ↔ Sous-cycle

```
OODA Boyd          | Sous-cycle 7 étapes
-------------------+----------------------------------------------
Observe            | Observer (collecte signaux)
Orient             | Define (synthèse, modèle mental, classe risque)
                   | NOTE : Boyd dit qu'Orient est la plus critique
                   | car c'est là que les biais opèrent — même logique
                   | que Define où la classification erronée propage
Decide             | Design (choix approche)
Act                | Execute (implémentation)
[feedback loop]    | Verify (retour dans Observe du prochain OODA)
[absent in OODA]   | Capitalize (apprentissage formalisé)
[absent in OODA]   | Transmit (diffusion explicite)
```

**Apport du sous-cycle vs OODA pur** : OODA s'arrête à Act. Le sous-cycle ajoute Verify (qui referme proprement la boucle), Capitalize (qui transforme l'expérience en mémoire) et Transmit (qui diffuse l'apprentissage). Sans ces 3 étapes supplémentaires, un système solo-dev converge vers la répétition des mêmes erreurs — Boyd lui-même le reconnaît en notant que l'Orient s'enrichit de l'expérience accumulée.

### 13.2 Mapping PDCA ↔ Sous-cycle

```
PDCA               | Sous-cycle 7 étapes
-------------------+----------------------------------------------
[absent in PDCA]   | Observer (observation continue pré-Plan)
[absent in PDCA]   | Define (formulation explicite du problème)
Plan               | Design (plan d'action)
Do                 | Execute (implémentation)
Check              | Verify (évaluation résultats)
Act                | Capitalize + Transmit (standardisation + diffusion)
```

**Apport du sous-cycle vs PDCA pur** : PDCA commence à "Plan" sans forcer une phase d'observation et de formulation du problème. Dans la pratique, cela conduit à planifier la mauvaise chose — c'est l'anti-pattern #1 du rapport v3. Observer + Define en amont de Design/Plan est l'ajout structurellement le plus important.

### 13.3 Mapping Kolb ↔ Sous-cycle

```
Kolb (1984)                    | Sous-cycle 7 étapes
-------------------------------+----------------------------------------------
Concrete Experience            | Observer (+ Execute du cycle précédent)
Reflective Observation         | Define (réflexion sur l'observation)
Abstract Conceptualization     | Design (formation d'un modèle d'action)
Active Experimentation         | Execute
[retour à Concrete Experience] | Verify → Observer (du prochain cycle)
[absent in Kolb]               | Capitalize (formalisation explicite)
[absent in Kolb]               | Transmit (diffusion organisationnelle)
```

**Apport du sous-cycle vs Kolb pur** : Kolb est un modèle d'apprentissage individuel. Le sous-cycle ajoute la dimension organisationnelle (Capitalize) et la diffusion explicite inter-cycles (Transmit). En contexte solo-dev + agent IA, Transmit remplace la diffusion naturelle qui s'opère dans une équipe — sans cela, l'apprentissage meurt à la fin de la session.

---

## 14. Questions ouvertes (RED CARDS)

Ces questions nécessitent une décision avant ou pendant la phase Build.

### RED-001 — Opérationnalisation de l'Observer en mode automatique

**Statut** : partiellement résolu (R016 — observer manifest spécifié en §11), priorité moyenne.

**Question** : quelles sont exactement les sources que l'agent consulte automatiquement lors de l'étape Observer, par cycle macroscopique ? Quand l'agent doit-il demander des informations supplémentaires vs inférer ?

**Impact** : si non défini, l'agent Observer sera soit trop verbeux (demande tout), soit trop silencieux (inère mal).

**Résolution partielle (R016)** : un artefact `observer-manifest.md` est désormais spécifié dans §11 (artefacts harness). Il liste les sources primaires et secondaires consultées par l'agent lors de l'étape Observer, par cycle macroscopique. Ce qui reste ouvert : le contenu concret du manifest par cycle (quelles sources exactes pour Discovery vs Build vs Run).

**Décision attendue** : compléter le contenu du manifest pendant les premiers cycles Build réels.

---

### RED-002 — Conditions de skip de Capitalize sur T/L

**Statut** : ouvert, priorité basse.

**Question** : la règle actuelle est "rien à écrire si tout s'est passé comme prévu sur T/L". Mais comment l'agent détermine-t-il que "tout s'est passé comme prévu" sans un minimum d'évaluation qui est elle-même une forme de Capitalize ?

**Piste** : définir un seuil automatique. Si le sous-cycle T/L a duré moins de X minutes ET la CI est verte ET aucune reclassification n'a eu lieu → Capitalize = vide. Sinon → au moins 1 ligne.

**Décision attendue** : pendant Build (peut évoluer par expérience).

---

### RED-003 — Format de l'artefact de Transmit inter-cycles

**Statut** : ouvert, priorité haute.

**Question** : chaque cycle macroscopique doit recevoir un artefact de Transmit du cycle précédent. Quel est le format standard de cet artefact ? Comment éviter qu'il soit trop long (sur-documentation) ou trop court (perte d'information) ?

**Piste** : template fixe de 5-7 champs (cf. §6.7). Limité à N lignes selon la classe de risque du cycle. Validation automatique par le harness (lint sur l'artefact).

**Décision attendue** : avant Build — template à créer dans `.planning/_templates/`.

---

### RED-004 — Gestion des sous-cycles interrompus

**Statut** : résolu (R017 — format de checkpoint spécifié en §11).

**Question** : que se passe-t-il quand un sous-cycle est interrompu entre deux étapes (session de travail terminée, context window saturée, changement de priorité) ? Comment reprendre sans recommencer ?

**Résolution (R017)** : un artefact de checkpoint est désormais spécifié dans §11 (artefacts harness) avec le format YAML complet : `checkpoint-{cycle}-{timestamp}.yaml`. Il persiste le cycle, l'étape courante, les étapes complétées/restantes, la classe de risque, le mode, l'item actif, un résumé de l'état, et la raison de l'interruption. Ce checkpoint est produit automatiquement lors de `SESSION_END` ou `CYCLE_SUSPEND` et lu lors du prochain `SESSION_START` pour reprendre exactement où le sous-cycle a été interrompu. Il fait partie de la DoR de l'étape Observer lors de la reprise.

**Décision** : résolu — voir §11 pour le schéma YAML complet.

---

### RED-005 — Profondeur de récursion optimale

**Statut** : ouvert, investigation recommandée.

**Question** : la récursion à 3 niveaux est une hypothèse. En pratique, est-ce que le niveau 3 (tâche TDD) produit de la valeur réelle, ou est-ce un overhead cognitif ?

**Piste** : tester sur un premier projet réel. Mesurer le taux de conformité aux 7 étapes au niveau 3. Si < 50% des tâches appliquent consciemment le niveau 3 → le supprimer de l'architecture et documenter que la récursion s'arrête à 2.

**Décision attendue** : après premiers cycles Build réels (retour d'expérience).

---

### RED-006 — Articulation Verify et les quality gates CI

**Statut** : ouvert, précision requise.

**Question** : les quality gates CI (lint, SAST, tests) sont-ils une partie de Verify ou une précondition à Verify ?

**Piste recommandée** : les quality gates CI sont une **sous-activité automatique de Verify** — ils ne la remplacent pas. Verify inclut les gates CI PLUS la validation humaine (pour M+) PLUS le verdict GO/NO-GO. Un CI vert n'est pas un sous-cycle Verify complet sur M+.

**Décision attendue** : avant Build — documenter dans le template DoD.

---

## 15. Relations avec les cycles et les transversaux

### 15.1 Relations inter-cycles via Transmit

```
Discovery ──[Transmit]──→ Cadrage
  Note de Discovery, hypothèses, backlog initial

Cadrage ──[Transmit]──→ Conception
  Charter, backlog DoR-ready, classification risque projet

Conception ──[Transmit]──→ Build
  ADR, design docs, SLI/SLO, plan de tests

Build ──[Transmit]──→ Validation
  Incrément (PR mergée), rapport CI, DoD attestée

Validation ──[Transmit]──→ Release
  Rapport validation, verdict GO/NO-GO, risques résiduels

release ──[Transmit]──→ run
  Release notes, état déploiement, SLO baseline post-release

run ──[Transmit]──→ learning
  Incidents (postmortems), métriques DORA run, signaux prod

learning ──[Transmit]──→ discovery (prochain cycle)
  Patterns systémiques, hypothèses révisées, règles/templates MàJ
```

### 15.2 Relations avec les activités transversales

Les activités transversales (Sécurité, Privacy, FinOps, Accessibilité, i18n, Tests, Observabilité, Documentation, Versioning) ne sont pas des étapes du sous-cycle. Elles sont des **contraintes qui modulent chaque étape** :

- Elles interviennent dans Observer (sources de signaux),
- dans Define (identification des dimensions qualité concernées),
- dans Design (intégration by design),
- dans Execute (implémentation),
- dans Verify (validation de conformité),
- dans Capitalize (patterns de conformité),
- dans Transmit (documentation mise à jour).

La règle : **aucune transversale ne peut être "faite à la fin"**. Si une transversale n'apparaît pas avant Execute, c'est un signal d'alarme — elle arrivera en QA tardive, ce qui coûte 5 à 10× plus cher à corriger (cf. rapport v3 §Key Findings #2).

### 15.3 Relations avec le harness et les modes

```
Sous-cycle                    | Contrôle harness
──────────────────────────────+─────────────────────────────────
Observer (auto)               | Lecture autorisée : tout
Define (auto ou humain)      | Écriture : .planning/ uniquement
Design (auto ou humain)    | Écriture : .planning/ + docs/ si ADR
Execute (selon mode)         | Écriture : périmètre du cycle courant
                              | (Build → code/tests, pas .planning/)
Verify (auto + humain M+)   | Lecture + contrôle : CI résultat
Capitalize (auto)            | Écriture : .planning/ + docs/
Transmit (auto + humain H) | Écriture : docs/ + .planning/
```

### 15.4 Événements harness du sous-cycle (R011)

Les événements suivants sont émis par le harness lors de la traversée du sous-cycle. Chaque événement est ajouté à `.planning/run-set.json#history` (cf. `docs/transversal/harness-state-machine.md` §4.1).

| Événement | Déclencheur | Conditions / Gardes | Effet |
|---|---|---|---|
| `SUBSTEP_ENTER` | Entrée dans une sous-étape | DoR de la sous-étape satisfaite | Met à jour `micro_state` dans `.planning/state.yaml` |
| `SUBSTEP_COMPLETE` | Sous-étape terminée | DoD de la sous-étape satisfaite | Transition vers la sous-étape suivante |
| **`SUBSTEP_SKIP`** | Sous-étape sautée (compression) | **Autorisé uniquement sur T/L**. Sur T : toutes les étapes sauf Execute sont skippables. Sur L : Observer est optionnel ; les autres suivent l'ordre. Sur M/H/C : **aucun skip autorisé** — le garde `risk_class IN [T, L]` doit être vrai. | Transition directe vers la sous-étape N+1 sans traverser N. Log obligatoire avec justification de skip. |
| `RISK_CLASS_PROMOTE` | Promotion de classe détectée | Signal de forçage actif (cf. `risk-classification.md` §4.3) | `CYCLE_SUSPEND` automatique, re-vérification DoR avec la nouvelle classe |
| `CYCLE_COMPLETE` | Sous-étape Transmit terminée | DoD du cycle macroscopique satisfaite | Transition vers le cycle suivant (MACRO-FSM) |
| `CYCLE_SUSPEND` | Interruption volontaire ou forcée | SESSION_END, HUMAN_REJECT, ERROR_DETECTED | Checkpoint ajouté à `.planning/run-set.json#checkpoints` |

**Règle de skippage détaillée** :

```
SI risk_class == T :
  SUBSTEP_SKIP autorisé sur : Observer, Define, Design, Verify, Capitalize, Transmit
  SUBSTEP_SKIP interdit sur : Execute (toujours traversé)

SI risk_class == L :
  SUBSTEP_SKIP autorisé sur : Observer (optionnel)
  SUBSTEP_SKIP interdit sur : Define, Design, Execute, Verify, Capitalize, Transmit

SI risk_class IN [M, H, C] :
  SUBSTEP_SKIP interdit sur : toutes les sous-étapes (aucun skip)
```

> **Référence** : `docs/transversal/harness-state-machine.md` §9.3 (règle de skippage) et §4.1 (taxonomie des événements).

### 15.5 Dépendances critiques

1. **Define → tout le reste** : une classe de risque mal assignée dans Define propage une erreur dans les 5 étapes suivantes. C'est la dépendance la plus critique.

2. **Design → Execute** : entrer dans Execute sans Design terminé est un anti-pattern. L'exception : T/L où Design est implicite et dure < 1 minute.

3. **Verify → Transmit** : on ne Transmet pas sans verdict Verify. Transmit un incrément non vérifié crée une dette invisible dans le cycle suivant.

4. **Capitalize → cycle suivant Observer** : le cycle suivant commence par Observer, qui dépend des artefacts de Capitalize + Transmit du cycle précédent. Si ces deux étapes ont été sautées, le cycle suivant démarre à l'aveugle.

---

## Annexe A — Comparaison synthétique des frameworks sources

| Dimension | OODA (Boyd) | PDCA (Deming) | Kolb (1984) | Sous-cycle 7 étapes |
|---|---|---|---|---|
| Nb d'étapes | 4 | 4 | 4 | 7 |
| Origine | Militaire / décision rapide | Qualité industrielle | Apprentissage individuel | Synthèse adaptée au dev |
| Force | Vitesse, adaptabilité | Standardisation, amélioration | Apprentissage expérientiel | Complétude + traçabilité |
| Weakness | Pas de capitalisation formelle | Pas d'observation préalable | Pas de transmission organisationnelle | Complexité à moduler |
| Récursivité | Implicite (boucles imbriquées) | Explicite (cycles successifs) | Implicite | Explicite (3 niveaux) |
| Adapté à solo-dev IA | Partiellement | Partiellement | Non | Oui (conçu pour) |

---

## Annexe B — Template d'artefact de Transmit

```markdown
---
cycle: [nom du cycle macroscopique]
sous_cycle_id: [SC-YYYYMMDD-NNN]
classe_risque: [T/L/M/H/C]
date_cloture: [ISO 8601]
verdict_verifier: [GO / NO-GO / GO avec réserves]
---

## Contexte
[État du cycle à la clôture — 2-5 lignes]

## Décisions prises
- [Décision 1 — lien ADR si H/C]
- [Décision 2]

## Travail accompli
- [Incrément 1]
- [Incrément 2]

## Travail reporté
- [Item reporté] — Raison : [...]

## Risques ouverts
| ID | Description | Owner | Échéance |
|---|---|---|---|
| R-001 | ... | ... | ... |

## Prochaine action recommandée
[Une phrase — entrée pour l'étape Observer du cycle suivant]
```

---

## Sources

- [OODA Loop — Wikipedia](https://en.wikipedia.org/wiki/OODA_loop)
- [PDSA Cycle — The W. Edwards Deming Institute](https://deming.org/explore/pdsa/)
- [PDCA Cycle — ASQ](https://asq.org/quality-resources/pdca-cycle)
- [Kolb's Experiential Learning — Wikipedia](https://en.wikipedia.org/wiki/Kolb%27s_experiential_learning)
- [The Fractal Within a Sprint of Large-Scale Scrum — LeSS Blog (2022)](https://less.works/blog/2022/03/13/the-less-sprint-fractal.html)
- [Scrum Fractal Systems — Scrum.org](https://www.scrum.org/fractal-systems)
- [OODA vs PDCA — The Knowledge Academy](https://www.theknowledgeacademy.com/blog/ooda-vs-pdca/)
- [OODA Loop in DevOps — Copado](https://www.copado.com/resources/blog/how-the-ooda-loop-decision-making-model-drives-devops-success)
- [Mimicking Mother Nature: Fractal Patterns in Agile Scaling — Medium](https://medium.com/@alexdh359/mimicking-mother-nature-the-art-of-fractal-patterns-in-agile-scaling-297d35a3bb5c)
- [DORA State of DevOps Report 2024](https://dora.dev/research/2024/dora-report/)
- [Architectural Decision Records — adr.github.io](https://adr.github.io)
- [ISO/IEC 25010:2023 — iso.org](https://iso.org)
- **Rapport Discovery + Cadrage (Source de vérité)** — `rapport-discovery-cadrage.md`, §2.2, 2026-05-02
- **Cycle qualité v3** — `compass_artifact_...text_markdown.md`, section complète
- **Phase 0 Clarification** — `r1.md`
- **Architecture Planning/** — `folder.md`
