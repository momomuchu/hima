# Le Sous-Cycle Fractal à 7 Étapes — Architecture

> **Statut** : document d'architecture — version 1.0
> **Date** : 2026-05-03
> **Auteur** : deep-researcher agent, synthèse multi-sources
> **Objet** : définition exhaustive du sous-cycle universel Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre, applicable à chacun des 8 cycles de la Pipeline fractale v4.
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
8. Modulation par classe de risque (compression/expansion T/F/M/É/C)
9. Manifestation par cycle — matrice 7 étapes × 8 cycles
10. Activités transversales
11. Artefacts produits par étape
12. Métriques et indicateurs
13. Standards de référence
14. Questions ouvertes (RED CARDS)
15. Relations avec les cycles et les transversaux

---

## 1. Résumé exécutif

La Pipeline fractale v4 repose sur une idée centrale : **la même discipline s'applique à tous les niveaux**. Chacun des 8 cycles macroscopiques (Discovery → Cadrage → Conception → Build → Validation → Release → Run → Apprentissage) est lui-même un mini-cycle structuré selon 7 étapes invariantes :

```
Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre
```

Ce sous-cycle est le **pattern fractal fondamental** du système. Il ne se substitue pas aux cycles macroscopiques — il en est le mode opératoire interne. Traverser ces 7 étapes peut prendre 30 secondes sur un changement Trivial, ou plusieurs jours sur un changement Critique. La profondeur varie ; la structure, jamais.

La propriété d'auto-similarité est exacte au sens strict : le même patron se répète à l'échelle du cycle (semaines), à l'échelle de l'incrément (heures), et potentiellement à l'échelle de la tâche (minutes). C'est ce que LeSS nomme "fractal within a sprint" et que Boyd nomme la récursivité des boucles OODA imbriquées.

**Trois tensions structurantes à garder en tête :**
1. Rigueur vs vélocité → résolue par la modulation par risque (T/F = chemin court, É/C = chemin long).
2. Traçabilité vs économie de tokens → résolue par le principe "minimum nécessaire à la prochaine décision".
3. Universalité vs adaptation → résolue par la séparation invariants/variables dans chaque étape.

---

## 2. Position dans l'architecture (le pattern universel)

### 2.1 Vue de la Pipeline fractale

```
MACRO-CYCLES (8)
┌─────────────────────────────────────────────────────────────────┐
│  Discovery → Cadrage → Conception → Build →                     │
│  Validation → Release → Run → Apprentissage                     │
└─────────────────────────────────────────────────────────────────┘
         │ chacun contient ↓
         ▼
SOUS-CYCLE UNIVERSEL (7 étapes, répété dans chaque macro-cycle)
┌─────────────────────────────────────────────────────────────────┐
│  Observer → Définir → Concevoir → Exécuter →                    │
│  Vérifier → Capitaliser → Transmettre                           │
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
| `docs/` | Réceptacle de Capitaliser et Transmettre — vérité actuelle mise à jour |
| `.planning/` | Registre d'exécution d'Observer à Vérifier — pilotage vivant |
| `code/tests/infra` | Territoire d'Exécuter — seule zone touchable en phase Build |

### 2.4 Relation avec les 3 modes opératoires

| Mode | Impact sur le sous-cycle |
|---|---|
| Pairing | L'agent traverse toutes les étapes avec le développeur. Validation humaine à chaque étape. |
| Auto-décision (défaut) | L'agent traverse Observer→Concevoir seul et propose. Le développeur valide avant Exécuter. |
| Bypass | L'agent traverse toutes les étapes sans validation humaine. Autorisé seulement sur T/F. |

---

## 3. Objectif du sous-cycle

Le sous-cycle à 7 étapes a **un seul objectif** : garantir que **chaque cycle macroscopique produit un incrément vérifiable et un apprentissage capitalisé**, quelle que soit sa durée ou sa classe de risque.

Les 4 fonctions du sous-cycle :

1. **Alignement** : s'assurer qu'on travaille sur le bon problème avant d'agir (Observer + Définir).
2. **Direction** : choisir la meilleure approche avant d'implémenter (Concevoir).
3. **Exécution contrôlée** : implémenter de façon traçable et réversible (Exécuter).
4. **Apprentissage systématique** : capturer ce qui a marché, ce qui n'a pas marché, et transmettre pour le cycle suivant (Vérifier + Capitaliser + Transmettre).

Sans Capitaliser et Transmettre, le système ne s'améliore pas — il répète. C'est l'erreur structurelle de la majorité des processus de développement.

---

## 4. Entrées — DoR par étape

La Definition of Ready (DoR) pour chaque étape définit la **condition minimale d'entrée**. Une étape ne démarre pas si sa DoR n'est pas satisfaite.

### Étape 1 — Observer

**DoR** :
- [ ] Le cycle macroscopique courant est identifié (ex : "nous sommes en cycle Build, incrément PBI-003").
- [ ] Les sources d'observation sont connues (métriques, logs, feedback utilisateur, backlog, état CI, état prod).
- [ ] Le contexte du dernier sous-cycle est accessible (si récurrent : artefact Transmettre du cycle précédent).

### Étape 2 — Définir

**DoR** :
- [ ] Les observations de l'étape 1 sont formalisées (même de façon minimaliste).
- [ ] Un problème ou une opportunité a été identifié(e) — pas encore une solution.
- [ ] La classe de risque pressentie est posée (T/F/M/É/C) — confirmée ou révisée à l'étape suivante.

### Étape 3 — Concevoir

**DoR** :
- [ ] Le problème est défini en termes mesurables (critère d'acceptation ou signal de succès).
- [ ] La classe de risque est confirmée (pilote le niveau de rigueur de la conception).
- [ ] Les contraintes sont connues (techniques, réglementaires, budgétaires, temporelles).

### Étape 4 — Exécuter

**DoR** :
- [ ] Un plan ou une approche est choisie et documentée (même en une ligne pour T/F).
- [ ] Les dépendances sont résolues ou explicitement notées comme risques.
- [ ] Pour É/C : feature flag en place, plan de rollback rédigé, gates CI définis.

### Étape 5 — Vérifier

**DoR** :
- [ ] L'incrément produit par Exécuter est disponible (code, doc, décision, artefact).
- [ ] Les critères d'acceptation de l'étape Définir sont accessibles pour comparaison.
- [ ] L'environnement de vérification est prêt (CI, staging, outil de validation approprié).

### Étape 6 — Capitaliser

**DoR** :
- [ ] La vérification a produit un verdict (PASS / FAIL / PARTIEL) avec preuves.
- [ ] Les écarts entre attendu et réalisé sont documentés.

### Étape 7 — Transmettre

**DoR** :
- [ ] La capitalisation est complète (patterns identifiés, anomalies notées).
- [ ] Les destinataires du cycle suivant sont identifiés (cycle macroscopique suivant, ou prochaine itération du même cycle).

---

## 5. Sorties — DoD par étape

La Definition of Done (DoD) par étape définit la **condition minimale de sortie**. Une étape n'est pas terminée si sa DoD n'est pas satisfaite.

### Étape 1 — Observer

**DoD** :
- [ ] Un rapport d'observation existe — même en 3 lignes pour T/F, exhaustif pour É/C.
- [ ] Les signaux faibles et forts sont distingués.
- [ ] L'observation est horodatée et versionnable.

### Étape 2 — Définir

**DoD** :
- [ ] Un énoncé de problème/opportunité est écrit (pas une solution).
- [ ] La classe de risque T/F/M/É/C est assignée avec justification.
- [ ] Le critère de succès est testable (au moins un signal mesurable).

### Étape 3 — Concevoir

**DoD** :
- [ ] Au moins une approche est décrite et comparée à ses alternatives (pour M+ : 2+ alternatives documentées).
- [ ] Pour É/C : ADR rédigé, threat model révisé, AIPD déclenchée si applicable.
- [ ] La décision est tracée dans `.planning/` (même une ligne pour T/F).

### Étape 4 — Exécuter

**DoD** :
- [ ] L'incrément est produit et lisible (code mergé, doc mise à jour, décision prise, artefact créé).
- [ ] Conventional commits appliqués (si code).
- [ ] Quality gates CI verts (si code) : lint, types, SAST, SCA, tests.

### Étape 5 — Vérifier

**DoD** :
- [ ] Chaque critère d'acceptation de Définir est évalué avec un résultat PASS/FAIL.
- [ ] Les bugs bloquants sont ouverts dans le backlog (pas ignorés).
- [ ] Un verdict global est émis : GO / NO-GO / GO avec réserves.

### Étape 6 — Capitaliser

**DoD** :
- [ ] Les patterns positifs et négatifs sont nommés et classifiés.
- [ ] Les hypothèses initiales sont révisées (confirmées, infirmées, affinées).
- [ ] Les métriques DORA pertinentes sont mises à jour.

### Étape 7 — Transmettre

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
- En Discovery : entretiens utilisateurs, données produit, analyses de marché.
- En Build : métriques CI, état du backlog, feedback de la revue de code précédente.
- En Run : SLO, error budgets, alertes, traces, logs structurés.
- En Apprentissage : postmortem, rétrospective, métriques DORA du cycle passé.

**Comportement de l'agent IA** :
- Mode Pairing : observation conjointe, l'agent suggère des sources non consultées.
- Mode Auto-décision : l'agent collecte les signaux disponibles (CI, logs, backlog) et présente un rapport d'observation concis.
- Mode Bypass : l'agent observe et décide seul — acceptable seulement T/F.

**Durée typique** :
- T : 0–30 secondes.
- F/M : 5–30 minutes.
- É/C : 1 h–1 jour (si entretiens, threat model review, etc.).

**Lien Boyd** : "Observe" dans l'OODA loop correspond exactement. Boyd insiste sur l'importance d'observer *plusieurs* niveaux : physique (faits), mental (modèle mental), moral (confiance). En développement logiciel : signaux techniques, signaux produit, signaux équipe.

---

### 6.2 Étape 2 — Définir

**Définition** : transformer les observations brutes en un problème ou une opportunité bien posé(e), avec des critères de succès mesurables. C'est "Orient" dans l'OODA loop — la phase la plus critique selon Boyd car c'est là que les biais cognitifs opèrent.

**Invariant** : toujours présente. La tentation de sauter Définir pour aller directement à la solution est l'anti-pattern numéro un (cf. rapport v3 §Key Findings #1 : "La Discovery n'est pas optionnelle"). Sur un changement T, Définir prend 10 secondes ("le bug est : la fonction X retourne null au lieu de []"). Sur un changement C, Définir prend des jours.

**Variable** : le niveau de formalisme.
- T/F : une phrase suffit.
- M : critères d'acceptation INVEST.
- É/C : Problem Statement complet (§2 du rapport r1.md) avec population, impact, alternatives existantes, risques.

**Rôle de la classe de risque** : c'est à l'étape Définir que la classe T/F/M/É/C est assignée ou confirmée. Cette classification est le pivot central de tout le système (décision 3.2 du rapport Discovery). Une mauvaise classification ici propage une erreur dans toutes les étapes suivantes.

**Arbre de décision de classification** :
```
Touche authentification/autorisation → É minimum
Touche données personnelles/santé → C minimum
Touche schéma DB ou API publique → É minimum
Touche infra de production → É minimum
Nouvelle fonctionnalité derrière feature flag, pas de PII → F
Refactor sans changement de comportement → T
Doc seule → T
```

**Lien Kolb** : "Reflective Observation" + "Abstract Conceptualization" — on réfléchit sur l'expérience (étape Observer) pour former une représentation conceptuelle du problème.

---

### 6.3 Étape 3 — Concevoir

**Définition** : choisir une approche de résolution parmi les alternatives, en tenant compte des contraintes. C'est "Decide" dans l'OODA loop, "Plan" dans PDCA.

**Invariant** : toujours présente — même implicite. Sur un T ("typo dans un commentaire"), la conception est : "corriger directement, sans branche, sans test". C'est une décision. La rendre explicite, même en 5 secondes, évite les surprises.

**Variable** : le format de sortie.
- T/F : décision implicite ou une phrase.
- M : design doc 1 page ou ADR court.
- É/C : ADR formel, threat model STRIDE, AIPD si données perso., plan de migration expand/contract si schéma DB.

**Propriété critique** : Concevoir est la seule étape où on peut encore **changer d'avis sans coût**. Une fois qu'on entre dans Exécuter, le coût de changement monte. C'est pourquoi la conception insuffisante sur É/C est l'anti-pattern le plus coûteux — "pay now or pay more later" (cf. report PDCA).

**Alternatives et décision** : pour M+, la conception doit toujours comparer au moins 2 approches. La décision doit être justifiée, pas juste choisie. L'ADR (Architecture Decision Record) est le format cible pour É/C.

**Lien PDCA** : "Plan" dans PDCA. La différence avec PDCA pur : dans le sous-cycle fractal, "Concevoir" est précédé d'une étape d'observation et de définition explicites — ce que PDCA omet souvent en pratique (le "Plan" PDCA absorbe trop facilement les biais non contrôlés).

---

### 6.4 Étape 4 — Exécuter

**Définition** : implémenter l'approche choisie, de façon traçable, réversible, et conforme aux standards de qualité du cycle macroscopique courant. C'est "Act" dans l'OODA loop, "Do" dans PDCA, "Active Experimentation" dans Kolb.

**Invariant** : toujours présente. C'est l'étape de production de l'incrément. La qualité d'Exécuter dépend directement de la qualité de Concevoir — exécuter une mauvaise plan parfaitement ne produit pas de valeur.

**Variable** : le périmètre d'action et les standards applicables.
- En Discovery : rédaction d'une note, conduite d'entretiens, spike technique.
- En Build : écriture du code (TDD recommandé), tests, logs/métriques, PR.
- En Conception : rédaction d'ADR, threat model, AIPD.
- En Run : réponse à une alerte, mitigation d'un incident, mise à jour de runbook.

**Principe de réversibilité** : toute exécution doit être réversible ou arrêtable. Pour le code : feature flags. Pour les migrations : pattern expand/contract. Pour les décisions : ADR révisable. L'irréversibilité augmente le risque — elle est un signal de montée en classe de risque.

**Harness et permissions** : le harness contrôle ce que l'agent peut écrire selon la phase macroscopique. En phase Build, il peut toucher code/ et tests. Pas `.planning/` du cycle courant (frontières déclaratives + effectives, §2.6 rapport Discovery).

**Granularité** : préférer les petits incréments (≤ 1 jour lead time DORA) même sur des tâches longues. Chaque incrément déclenche un mini-sous-cycle de Vérification avant de continuer. C'est la récursivité fractale à l'œuvre.

---

### 6.5 Étape 5 — Vérifier

**Définition** : comparer l'incrément produit aux critères de succès définis à l'étape Définir. Produire un verdict explicite. C'est "Check" dans PDCA, la boucle de feedback dans OODA, "Reflective Observation" dans Kolb après l'expérimentation.

**Invariant** : toujours présente. C'est la plus souvent sautée sous contrainte de temps — et la plus coûteuse à sauter. Un incrément non vérifié crée de la dette invisible. Sur un T : "le lint passe, le comportement est correct visuellement". Sur un C : campagne de tests complète, validation produit, smoke tests post-déploiement.

**Variable** : les mécanismes de vérification.
- T : vérification mentale ou lint automatique.
- F/M : tests automatisés, CI verte, peer review.
- É : tests de régression, DAST, validation produit en staging, peer review ≥2.
- C : audit de sécurité, tests de charge, validation utilisateur réelle, smoke tests post-déploiement.

**Verdict possible** :
- GO : incrément conforme, on continue.
- NO-GO : incrément non conforme, on revient à Exécuter (ou Concevoir si l'approche est mauvaise).
- GO avec réserves : incrément acceptable avec risques explicites, dette ouverte dans le backlog.

**Lien PDCA** : "Check" dans PDCA. Distinction importante : dans PDCA classique, "Check" évalue si le plan a fonctionné. Dans le sous-cycle fractal, Vérifier évalue si l'incrément satisfait les critères de succès formulés lors de Définir — critères qui peuvent avoir été affinés pendant la conception. L'ancrage est toujours sur le problème initial, pas sur le plan.

---

### 6.6 Étape 6 — Capitaliser

**Définition** : extraire et formaliser les apprentissages du sous-cycle. Identifier les patterns positifs (à réutiliser), les anomalies (à corriger), et les hypothèses qui ont été confirmées ou infirmées. C'est "Act" dans PDCA (la standardisation), "Abstract Conceptualization" dans Kolb.

**Invariant** : toujours présente — même minimale. Sans Capitaliser, le système répète sans apprendre. C'est l'étape qui transforme l'expérience en compétence organisationnelle.

**Variable** : le niveau de formalisme.
- T/F : rien à écrire explicitement si tout s'est passé comme prévu. Un mot si anomalie.
- M : mise à jour du backlog, note dans l'ADR si décision révisée.
- É/C : rétrospective de cycle, mise à jour des métriques DORA, consolidation des patterns dans la mémoire système, mise à jour des templates si pertinent.

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

### 6.7 Étape 7 — Transmettre

**Définition** : rendre les apprentissages capitalisés accessibles au cycle macroscopique suivant (ou à la prochaine itération du même cycle). Mettre à jour les territoires `docs/` et `.planning/` appropriés. Clore le sous-cycle proprement.

**Invariant** : toujours présente. Un sous-cycle sans Transmettre est un sous-cycle mort — ses apprentissages meurent avec lui. C'est l'étape qui crée la continuité inter-cycles, la mémoire du système.

**Variable** : le territoire de destination et le format.
- Fin d'un cycle Discovery → vers Cadrage : mettre à jour `docs/03-discovery/`, ouvrir les items de backlog.
- Fin d'un Build incrément → vers le prochain incrément : commit + PR + mise à jour `.planning/`.
- Fin d'un cycle Apprentissage → vers le prochain Discovery : rétrospective capitalisée, patterns mis à jour dans les règles ou templates.

**Distinction Capitaliser / Transmettre** :
- Capitaliser = extraction (travail interne : "qu'ai-je appris ?").
- Transmettre = diffusion (travail externe : "qui a besoin de quoi pour la suite ?").
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

1. **Séquentialité** : les étapes ne peuvent pas être permutées. Observer avant Définir, Définir avant Concevoir, etc. On peut compresser mais pas réordonner.
2. **Présence de toutes les étapes** : même compressée à 1 seconde, chaque étape est traversée. "Skipping" n'existe pas — seulement "compression".
3. **Traçabilité minimale** : chaque sous-cycle laisse une trace, aussi courte soit-elle. La trace d'un T peut être un commit message. La trace d'un C est un dossier complet.
4. **Verdict explicite à Vérifier** : GO / NO-GO / GO avec réserves — jamais implicite.
5. **Transmission vers le cycle suivant** : le cycle suivant dispose toujours d'une entrée, même minimale.

### 6.9 Variables du sous-cycle (ce qui s'adapte)

| Dimension | T | F | M | É | C |
|---|---|---|---|---|---|
| Durée totale | Minutes | Heures | Heures-Jours | Jours | Semaines |
| Profondeur Observer | Mental/auto | 5 min | 30 min | 1-2h | 1 jour+ |
| Profondeur Définir | 1 phrase | Critères | INVEST | Problem Statement | Complet |
| Profondeur Concevoir | Implicite | 1 ligne | Design note | ADR | ADR + TM |
| Profondeur Exécuter | Direct | Branche courte | TDD + PR | TDD + review ≥2 | TDD + review ≥2 + flags |
| Profondeur Vérifier | Mental | CI | CI + staging | CI + DAST + prod staging | CI + audit + utilisateurs |
| Profondeur Capitaliser | Rien si OK | 1 ligne si anomalie | Backlog MàJ | Rétro partielle | Rétro complète |
| Profondeur Transmettre | Commit msg | Note | Artefact court | Artefact structuré | Dossier complet |

### 6.10 Récursion fractale — profondeur 3

Le sous-cycle peut s'instancier à 3 profondeurs :

**Profondeur 1 — Niveau macro-cycle** (semaines/mois) :
Un cycle complet Discovery traverse les 7 étapes à l'échelle d'une phase produit entière.

**Profondeur 2 — Niveau incrément** (heures/jours) :
Un incrément PBI dans le cycle Build traverse les 7 étapes à l'échelle d'une PR ou d'une session de travail.

**Profondeur 3 — Niveau tâche** (minutes) :
Une tâche TDD (red-green-refactor) traverse les 7 étapes à l'échelle d'un test. Observer = lire l'échec du test. Définir = comprendre pourquoi. Concevoir = choisir l'implémentation minimale. Exécuter = écrire le code. Vérifier = le test passe. Capitaliser = refactorer. Transmettre = commit.

**Limite de profondeur recommandée** : 3 niveaux maximum. Au-delà, la surcharge cognitive dépasse le bénéfice structurel.

---

## 7. Critères qualité (ISO 25010:2023)

Les 9 caractéristiques ISO 25010:2023 se mappent sur les étapes du sous-cycle :

| Caractéristique ISO 25010:2023 | Étapes primaires | Signal de défaut |
|---|---|---|
| Functional suitability | Définir, Vérifier | Critères d'acceptation non testables |
| Performance efficiency | Concevoir, Vérifier | Absence de benchmark ou de SLO dans Vérifier |
| Compatibility | Concevoir, Exécuter | ADR absent sur les dépendances |
| Interaction capability (ex-Usability) | Observer, Définir | Pas d'observation utilisateur réelle |
| Reliability | Exécuter, Vérifier | Feature flags absents sur É/C |
| Security | Concevoir, Vérifier | Threat model absent sur É/C |
| Maintainability | Capitaliser, Transmettre | Pas d'ADR, pas de doc mise à jour |
| Flexibility | Concevoir | Architecture rigide choisie sans alternatives |
| Safety (nouveau 2023) | Définir, Concevoir | Risques patient/utilisateur non identifiés |

**Critères qualité spécifiques du sous-cycle lui-même** (méta-qualité) :
- Le sous-cycle est **complet** : les 7 étapes sont traversées à la profondeur requise par la classe de risque.
- Le sous-cycle est **tracé** : chaque étape a laissé un artefact minimal.
- Le sous-cycle est **cohérent** : les critères de Vérifier correspondent aux objectifs de Définir.
- Le sous-cycle est **économe** : pas d'artefacts superflus (anti-pattern : sur-documentation de T/F).

---

## 8. Modulation par classe de risque

### 8.1 Compression pour T/F

Sur les changements Trivial et Faible, le sous-cycle est **compressé** mais pas supprimé. Les étapes fusionnent de façon mentale ou automatisée.

**Exemple T — correction d'un commentaire incorrect** :
```
Observer  : le commentaire est faux (3 secondes de lecture)
Définir   : "commentaire incorrect ligne 42" (implicite)
Concevoir : "corriger directement" (implicite)
Exécuter  : modifier le fichier, commit "docs: fix incorrect comment on line 42"
Vérifier  : CI passe (automatique)
Capitaliser: rien
Transmettre: le commit message est la transmission
Durée totale : ~2 minutes
```

**Exemple F — nouvelle fonctionnalité derrière feature flag, pas de PII** :
```
Observer  : lire le ticket PBI + state CI actuel (5-10 min)
Définir   : critères d'acceptation (15 min)
Concevoir : approche choisie, 1 ligne de décision (10 min)
Exécuter  : TDD, PR, feature flag OFF (heures)
Vérifier  : CI verte, peer review (30-60 min)
Capitaliser: mise à jour ticket (5 min)
Transmettre: PR merge + planning update (5 min)
Durée totale : quelques heures
```

### 8.2 Expansion pour É/C

Sur les changements Élevés et Critiques, chaque étape est **expansée** avec des sous-activités obligatoires.

**Exemple É — ajout d'un endpoint d'authentification** :
```
Observer  : lecture SLO actuels, threat model existant, backlog sécurité, incidents récents (1-2h)
Définir   : Problem Statement complet, classe É confirmée, critères d'acceptation avec cas
            de sécurité (authn/authz failures, rate limiting) (2-4h)
Concevoir : ADR rédigé, threat model STRIDE mis à jour, 2 alternatives comparées,
            plan de tests de sécurité, feature flag design (4-8h)
Exécuter  : TDD avec tests de sécurité, PR ≤400 lignes, logs structurés, métriques
            ajoutées, feature flag OFF par défaut (1-2 jours)
Vérifier  : CI verte, DAST sur preprod, peer review ≥2, validation produit en staging,
            smoke tests, SLO surveillés (4-8h)
Capitaliser: rétrospective partielle, métriques DORA mises à jour, threat model archivé (1h)
Transmettre: artefact structuré dans .planning/ + docs/ mis à jour, prochaine action
             notée (30 min)
Durée totale : 2-4 jours
```

### 8.3 Matrice de compression/expansion

| Étape | T | F | M | É | C |
|---|---|---|---|---|---|
| Observer | Mental/auto | 5-15 min | 15-60 min | 1-2h | 1j+ |
| Définir | Implicite | 15 min | 30 min-1h | 2-4h | 4-8h |
| Concevoir | Implicite | 10 min | 30 min-1h | 4-8h | 1-2j |
| Exécuter | Minutes | Heures | Heures-1j | 1-2j | 2-5j |
| Vérifier | Auto | 30-60 min | 1-4h | 4-8h | 1-2j |
| Capitaliser | Rien | 5 min | 15-30 min | 1h | 2-4h |
| Transmettre | Commit msg | 10 min | 20 min | 30-60 min | 1-2h |
| **Total** | **~2 min** | **~4h** | **1-2j** | **3-5j** | **1-3 sem** |

### 8.4 Promotion de classe en cours de cycle

Quand une observation en cours d'Exécuter révèle que la classe réelle est supérieure à la classe assignée (ex : F classé → É découvert) :

1. **Stop** : arrêter Exécuter immédiatement.
2. **Revenir à Définir** : reclassifier, reformuler le problème avec la nouvelle classe.
3. **Revenir à Concevoir** : refaire la conception avec les contraintes É/C (ADR, threat model, etc.).
4. **Reprendre Exécuter** avec le niveau de rigueur approprié.
5. **Logger la promotion** : dans `.planning/` — date, ancien risque, nouveau risque, cause.
6. **Apprentissage systémique** : la promotion doit alimenter l'arbre de décision de classification pour éviter la répétition.

---

## 9. Manifestation par cycle — matrice 7 étapes × 8 cycles

### 9.1 Cycle 1 — Discovery

| Étape | Manifestation concrète |
|---|---|
| Observer | Entretiens utilisateurs, données produit, analyse concurrents, JTBD, signaux marché |
| Définir | Problem Statement, Opportunity Solution Tree, hypothèses falsifiables |
| Concevoir | Note de Discovery (1-3 pages), prototype/spike, critères de problem-solution fit |
| Exécuter | Entretiens formels, prototypage, spike technique timeboxé (max 5 jours) |
| Vérifier | Validation problem-solution fit, ≥5 conversations utilisateurs confirmant le problème |
| Capitaliser | Décisions Discovery, hypothèses confirmées/infirmées, backlog initial |
| Transmettre | Note de Discovery versionnée dans `docs/03-discovery/`, entrée pour Cadrage |

### 9.2 Cycle 2 — Cadrage

| Étape | Manifestation concrète |
|---|---|
| Observer | Lire note Discovery, backlog initial, contraintes (budget, temps, réglementaires) |
| Définir | Vision produit (1 phrase), objectifs SMART/OKR, périmètre IN/OUT explicite |
| Concevoir | Charter/one-pager, RACI léger, performance budget technique ET financier |
| Exécuter | Rédaction Charter, backlog raffiné avec DoR, classification de risque du projet |
| Vérifier | Validation sponsor + PO + tech lead, performance budget négocié |
| Capitaliser | Décisions de cadrage, contraintes identifiées, hypothèses H1-H7 posées |
| Transmettre | Charter dans `docs/01-governance/`, backlog dans `.planning/02-backlog/`, entrée pour Conception |

### 9.3 Cycle 3 — Conception

| Étape | Manifestation concrète |
|---|---|
| Observer | Lire Charter, backlog raffiné, état de l'existant technique |
| Définir | Choix d'architecture à décider, flux RGPD, parcours d'accessibilité critiques |
| Concevoir | ADR, threat model STRIDE, AIPD si applicable, design docs, SLI/SLO, plan de tests |
| Exécuter | Rédaction ADR, maquettes, modélisation domaine (Event Storming), spécifications |
| Vérifier | Review ADR par tech lead + sécurité (É/C) + DPO (si AIPD) |
| Capitaliser | Architecture décidée et justifiée, risques techniques documentés |
| Transmettre | ADR dans `docs/13-decisions/`, design docs dans `docs/07-architecture/`, entrée pour Build |

### 9.4 Cycle 4 — Build

| Étape | Manifestation concrète |
|---|---|
| Observer | CI state, backlog sprint, feedback review précédente, SLO actuels |
| Définir | Story sélectionnée (DoR OK), critères d'acceptation, classe de risque confirmée |
| Concevoir | Approche TDD, plan de branche/feature flag, structure de la PR |
| Exécuter | Code + tests + logs/métriques, commits Conventional, PR ≤400 lignes |
| Vérifier | CI verte (lint, types, tests, SAST, SCA), peer review, staging si M+ |
| Capitaliser | DoD vérifiée, dette créée/remboursée notée, flaky tests identifiés |
| Transmettre | PR mergée, `.planning/` mis à jour, ticket clôturé, entrée pour Validation |

**Note — récursivité dans Build** : chaque PBI traverse un sous-cycle complet. À l'intérieur d'un PBI, chaque session TDD (red-green-refactor) traverse un micro-sous-cycle. C'est la profondeur 3 de la récursivité fractale.

### 9.5 Cycle 5 — Validation

| Étape | Manifestation concrète |
|---|---|
| Observer | Incrément produit par Build, métriques CI, résultats tests automatisés |
| Définir | Scope de validation (périmètre de changement, risques résiduels, cas critiques) |
| Concevoir | Plan de validation risk-based (ISO 29119), matrice probabilité × impact |
| Exécuter | Tests exploratoires zones rouges, DAST si É/C, tests accessibilité manuels, tests de charge |
| Vérifier | Verdict GO/NO-GO, critères d'acceptation évalués un à un |
| Capitaliser | Bugs ouverts, matrice de couverture mise à jour, patterns de défauts identifiés |
| Transmettre | Rapport de validation dans `.planning/04-releases/`, recommandation pour Release |

### 9.6 Cycle 6 — Release

| Étape | Manifestation concrète |
|---|---|
| Observer | Rapport Validation, SLO actuels, error budget disponible, planning de déploiement |
| Définir | Stratégie de déploiement (direct/canary/blue-green/feature flag), plan de rollback |
| Concevoir | Release plan détaillé, communication aux parties prenantes, migration expand si applicable |
| Exécuter | Pipeline de déploiement automatisé, vérification SLSA/SBOM, smoke tests post-déploiement |
| Vérifier | SLO surveillés en temps réel, smoke tests verts, error budget non dégradé |
| Capitaliser | Release notes, métriques DORA (deployment frequency, lead time), incident éventuel loggé |
| Transmettre | Release notes dans `docs/`, état prod à jour dans `.planning/04-releases/`, entrée pour Run |

### 9.7 Cycle 7 — Run

| Étape | Manifestation concrète |
|---|---|
| Observer | SLO, error budgets, alertes, logs, traces, métriques RED/USE, feedback utilisateurs |
| Définir | Identifier dérives ou incidents (SLO breach, anomalie coût, signaux support) |
| Concevoir | Plan de réponse (runbook, mitigation, escalade), décision gel features si error budget épuisé |
| Exécuter | Mitigation incident, correctif hotfix, communication statut, on-call response |
| Vérifier | SLO restaurés, incident mitigé, erreur budget stabilisé |
| Capitaliser | Incident loggé, métriques DORA (recovery time), causes identifiées |
| Transmettre | Postmortem blameless dans `docs/`, alerte dans backlog si pattern récurrent, entrée pour Apprentissage |

**Note** : Run est le cycle le plus OODA-pur. La boucle se ferme en minutes (incident) ou heures (dérive). Observer et Décider sont critiques — c'est dans Run que Boyd's "getting inside the opponent's decision cycle" est le plus littéralement applicable.

### 9.8 Cycle 8 — Apprentissage

| Étape | Manifestation concrète |
|---|---|
| Observer | Métriques DORA du cycle passé, postmortems, rétrospectives, hypothèses H1-H7 confirmées/infirmées |
| Définir | Identifier les patterns systémiques (bugs récurrents, classes de risque mal estimées, anti-patterns) |
| Concevoir | Plan d'amélioration du processus, décisions architecturales à réviser, templates à mettre à jour |
| Exécuter | Mise à jour des règles/templates/agents, correction des outils de classification de risque |
| Vérifier | Les améliorations du processus sont vérifiables sur le prochain cycle ? Métriques cibles définies |
| Capitaliser | Patterns capitalisés dans la mémoire système (décision 4.3 rapport Discovery), biais documentés |
| Transmettre | Retrospective doc dans `docs/`, rules/agents mis à jour, entrée enrichie pour le prochain Discovery |

---

## 10. Activités transversales

Ces activités ne sont pas des étapes — elles imprègnent toutes les étapes de tous les cycles.

### 10.1 Sécurité shift-left (DevSecOps)

Présente à chaque étape :
- Observer : surveillance des CVE, alertes sécurité.
- Définir : identifier si le changement touche une surface d'attaque.
- Concevoir : threat model STRIDE itératif (90 min max pour É/C).
- Exécuter : SAST, secrets scan, SCA en CI.
- Vérifier : DAST sur preprod, validation contremesures STRIDE.
- Capitaliser : CVE gérées, patterns de vulnérabilités identifiés.
- Transmettre : threat model à jour dans `docs/09-security-compliance/`.

### 10.2 Privacy by Design

- Observer : signaux de nouveaux traitements de données personnelles.
- Définir : identifier si AIPD est déclenchée (≥2 critères WP29).
- Concevoir : Privacy by Design (Cavoukian 7 principes), minimisation des données.
- Exécuter : chiffrement, pseudonymisation, registre de traitement.
- Vérifier : AIPD validée, droits personnes implémentés.
- Capitaliser : registre de traitement à jour.
- Transmettre : AIPD dans `docs/09-security-compliance/`.

### 10.3 FinOps

- Observer : coûts actuels (cloud, LLM tokens, CI/CD minutes).
- Définir : si M+ : impact coût estimé.
- Concevoir : performance budget €/feature.
- Exécuter : tagging des ressources, pas de cap LLM absent.
- Vérifier : pas de régression coût >10% sans justification.
- Capitaliser : coût unitaire mis à jour.
- Transmettre : budget mis à jour dans métriques.

### 10.4 Accessibilité et i18n by Design

- Définir : identifier si des parcours utilisateurs critiques sont touchés.
- Concevoir : plan accessibilité WCAG 2.2 AA, CSS logical properties pour RTL.
- Exécuter : HTML sémantique, ARIA minimal, aucune chaîne hardcodée.
- Vérifier : axe-core en CI, test clavier manuel si É/C.
- Transmettre : déclaration d'accessibilité mise à jour si applicable.

---

## 11. Artefacts produits par étape

| Étape | Artefact T/F | Artefact M | Artefact É/C |
|---|---|---|---|
| Observer | Mental / CI report | Note d'observation | Rapport d'observation structuré |
| Définir | 1 phrase / ticket | Critères INVEST + classe risque | Problem Statement + arbre décision |
| Concevoir | Commit implicite | Design note / ADR court | ADR formel + threat model + AIPD |
| Exécuter | Commit/PR | PR + tests + logs | PR + tests + feature flag + plan rollback |
| Vérifier | CI résultat | Rapport de test + peer review | Rapport complet + DAST + verdict GO/NO-GO |
| Capitaliser | Rien / 1 ligne | Backlog MàJ + métriques delta | Rétro + DORA MàJ + patterns capitalisés |
| Transmettre | Commit message | Note courte dans .planning/ | Artefact structuré docs/ + .planning/ |

### Territoires de persistance des artefacts

```
docs/
├── 01-governance/         ← Transmettre (Cadrage, Apprentissage)
├── 03-discovery/          ← Transmettre (Discovery)
├── 07-architecture/       ← Transmettre (Conception, Build ADR)
├── 08-quality/            ← Capitaliser (patterns qualité)
├── 09-security-compliance/← Transmettre (threat model, AIPD)
├── 13-decisions/          ← Transmettre (ADR)
└── 90-templates/          ← Transmettre (Apprentissage)

.planning/
├── 02-backlog/            ← Définir (items créés/raffinés)
├── 03-sprints/            ← Exécuter + Vérifier
├── 04-releases/           ← Vérifier + Transmettre (Release)
├── 06-quality/            ← Vérifier + Capitaliser
├── 07-metrics/            ← Capitaliser (DORA)
├── 08-risks/              ← Observer + Définir
└── 09-logs/decision-log   ← Concevoir + Capitaliser
```

---

## 12. Métriques et indicateurs

### 12.1 Métriques de santé du sous-cycle

| Métrique | Calcul | Cible | Signal d'alarme |
|---|---|---|---|
| Taux de complétion 7 étapes | Sous-cycles avec 7 étapes tracées / total | 100% sur É/C, 80% sur M | < 60% global |
| Taux de promotion de classe | Sous-cycles avec reclassification / total | < 10% (signe de bonne classification initiale) | > 20% |
| Taux NO-GO à Vérifier | Sous-cycles avec verdict NO-GO / total | < 15% | > 25% (conception insuffisante) |
| Délai Définir → Exécuter | Temps médian entre fin Définir et début Exécuter | < 1h pour T/F, < 1j pour M | > 2j pour T/F |
| Taux de skip Capitaliser | Sous-cycles sans artefact Capitaliser sur M+ | 0% | > 10% |
| Taux de skip Transmettre | Sous-cycles sans artefact Transmettre sur M+ | 0% | > 5% |

### 12.2 Métriques DORA liées au sous-cycle

| Métrique DORA | Étape primaire | Interprétation |
|---|---|---|
| Change Lead Time | Définir → Transmettre | Durée totale du sous-cycle. Cible top : < 1 jour |
| Deployment Frequency | Transmettre (Release) | Fréquence de clôture du sous-cycle Release. Cible : quotidien |
| Change Failure Rate | Vérifier (post-déploiement) | % de sous-cycles Release qui génèrent un incident |
| Failed Deployment Recovery Time | Observer + Concevoir (Run) | Vitesse de traversée du sous-cycle Run sur incident |
| Rework Rate | Capitaliser | % de sous-cycles qui génèrent des correctifs sur le prochain cycle |

### 12.3 Indicateurs de qualité du sous-cycle

- **Cohérence Définir-Vérifier** : les critères de Vérifier correspondent-ils aux objectifs de Définir ? (audit manuel, trimestriel)
- **Depth appropriateness** : la profondeur de chaque étape est-elle proportionnelle à la classe de risque ? (audit mensuel)
- **Transmission rate** : le cycle suivant a-t-il pu démarrer son Observer sans ambiguïté ? (mesure qualitative, rétrospective)

---

## 13. Standards de référence

| Standard | Mapping dans le sous-cycle | Source |
|---|---|---|
| OODA Loop (Boyd, 1976) | Observer=Observe, Définir=Orient, Concevoir=Decide, Exécuter=Act | [Wikipedia OODA](https://en.wikipedia.org/wiki/OODA_loop) |
| PDCA / PDSA (Deming/Shewhart) | Concevoir=Plan, Exécuter=Do, Vérifier=Check, Capitaliser+Transmettre=Act | [Deming Institute PDSA](https://deming.org/explore/pdsa/) |
| Kolb Experiential Learning (1984) | Observer=Concrete Experience, Définir=Reflective Observation, Concevoir=Abstract Conceptualization, Exécuter=Active Experimentation | [Kolb Wikipedia](https://en.wikipedia.org/wiki/Kolb%27s_experiential_learning) |
| Scrum Inner/Outer Loop | Sprint = macro-cycle, Daily OODA = micro-cycle. Même récursivité fractale | [Scrum.org fractal systems](https://www.scrum.org/fractal-systems) |
| LeSS Sprint Fractal (2022) | Auto-similarité à 3 niveaux : organisation, équipe, item | [LeSS Blog](https://less.works/blog/2022/03/13/the-less-sprint-fractal.html) |
| Continuous Discovery (Torres) | Observer dans Discovery = entretiens continus | [producttalk.org](https://producttalk.org) |
| ISO/IEC 25010:2023 | Vérifier = test des 9 caractéristiques qualité | [iso.org](https://iso.org) |
| ISO/IEC/IEEE 29119 | Vérifier = risk-based testing framework | [iso.org](https://iso.org) |
| Google SRE (multi-burn-rate) | Observer dans Run = alerting SLO | [sre.google](https://sre.google) |
| DORA 2024/2025 | Métriques de 5 des 7 étapes | [dora.dev](https://dora.dev/research/2024/dora-report/) |
| Tidy First (Beck, 2023) | Exécuter = commit S ou B, jamais mixé | [Tidy First book] |
| ADR (Nygard) | Transmettre (Conception) = Architecture Decision Records | [adr.github.io](https://adr.github.io) |

### 13.1 Mapping détaillé OODA ↔ Sous-cycle

```
OODA Boyd          | Sous-cycle 7 étapes
-------------------+----------------------------------------------
Observe            | Observer (collecte signaux)
Orient             | Définir (synthèse, modèle mental, classe risque)
                   | NOTE : Boyd dit qu'Orient est la plus critique
                   | car c'est là que les biais opèrent — même logique
                   | que Définir où la classification erronée propage
Decide             | Concevoir (choix approche)
Act                | Exécuter (implémentation)
[feedback loop]    | Vérifier (retour dans Observe du prochain OODA)
[absent in OODA]   | Capitaliser (apprentissage formalisé)
[absent in OODA]   | Transmettre (diffusion explicite)
```

**Apport du sous-cycle vs OODA pur** : OODA s'arrête à Act. Le sous-cycle ajoute Vérifier (qui referme proprement la boucle), Capitaliser (qui transforme l'expérience en mémoire) et Transmettre (qui diffuse l'apprentissage). Sans ces 3 étapes supplémentaires, un système solo-dev converge vers la répétition des mêmes erreurs — Boyd lui-même le reconnaît en notant que l'Orient s'enrichit de l'expérience accumulée.

### 13.2 Mapping PDCA ↔ Sous-cycle

```
PDCA               | Sous-cycle 7 étapes
-------------------+----------------------------------------------
[absent in PDCA]   | Observer (observation continue pré-Plan)
[absent in PDCA]   | Définir (formulation explicite du problème)
Plan               | Concevoir (plan d'action)
Do                 | Exécuter (implémentation)
Check              | Vérifier (évaluation résultats)
Act                | Capitaliser + Transmettre (standardisation + diffusion)
```

**Apport du sous-cycle vs PDCA pur** : PDCA commence à "Plan" sans forcer une phase d'observation et de formulation du problème. Dans la pratique, cela conduit à planifier la mauvaise chose — c'est l'anti-pattern #1 du rapport v3. Observer + Définir en amont de Concevoir/Plan est l'ajout structurellement le plus important.

### 13.3 Mapping Kolb ↔ Sous-cycle

```
Kolb (1984)                    | Sous-cycle 7 étapes
-------------------------------+----------------------------------------------
Concrete Experience            | Observer (+ Exécuter du cycle précédent)
Reflective Observation         | Définir (réflexion sur l'observation)
Abstract Conceptualization     | Concevoir (formation d'un modèle d'action)
Active Experimentation         | Exécuter
[retour à Concrete Experience] | Vérifier → Observer (du prochain cycle)
[absent in Kolb]               | Capitaliser (formalisation explicite)
[absent in Kolb]               | Transmettre (diffusion organisationnelle)
```

**Apport du sous-cycle vs Kolb pur** : Kolb est un modèle d'apprentissage individuel. Le sous-cycle ajoute la dimension organisationnelle (Capitaliser) et la diffusion explicite inter-cycles (Transmettre). En contexte solo-dev + agent IA, Transmettre remplace la diffusion naturelle qui s'opère dans une équipe — sans cela, l'apprentissage meurt à la fin de la session.

---

## 14. Questions ouvertes (RED CARDS)

Ces questions nécessitent une décision avant ou pendant la phase Build.

### RED-001 — Opérationnalisation de l'Observer en mode automatique

**Statut** : ouvert, priorité haute.

**Question** : quelles sont exactement les sources que l'agent consulte automatiquement lors de l'étape Observer, par cycle macroscopique ? Quand l'agent doit-il demander des informations supplémentaires vs inférer ?

**Impact** : si non défini, l'agent Observer sera soit trop verbeux (demande tout), soit trop silencieux (inère mal).

**Piste** : définir un "observer manifest" par cycle macroscopique : liste de sources primaires (CI state, backlog index, metrics dashboard) et sources secondaires (logs, alertes, notes passées).

**Décision attendue** : avant Build — phase Conception du harness.

---

### RED-002 — Conditions de skip de Capitaliser sur T/F

**Statut** : ouvert, priorité basse.

**Question** : la règle actuelle est "rien à écrire si tout s'est passé comme prévu sur T/F". Mais comment l'agent détermine-t-il que "tout s'est passé comme prévu" sans un minimum d'évaluation qui est elle-même une forme de Capitaliser ?

**Piste** : définir un seuil automatique. Si le sous-cycle T/F a duré moins de X minutes ET la CI est verte ET aucune reclassification n'a eu lieu → Capitaliser = vide. Sinon → au moins 1 ligne.

**Décision attendue** : pendant Build (peut évoluer par expérience).

---

### RED-003 — Format de l'artefact de Transmettre inter-cycles

**Statut** : ouvert, priorité haute.

**Question** : chaque cycle macroscopique doit recevoir un artefact de Transmettre du cycle précédent. Quel est le format standard de cet artefact ? Comment éviter qu'il soit trop long (sur-documentation) ou trop court (perte d'information) ?

**Piste** : template fixe de 5-7 champs (cf. §6.7). Limité à N lignes selon la classe de risque du cycle. Validation automatique par le harness (lint sur l'artefact).

**Décision attendue** : avant Build — template à créer dans `.planning/_templates/`.

---

### RED-004 — Gestion des sous-cycles interrompus

**Statut** : ouvert, priorité moyenne.

**Question** : que se passe-t-il quand un sous-cycle est interrompu entre deux étapes (session de travail terminée, context window saturée, changement de priorité) ? Comment reprendre sans recommencer ?

**Piste** : checkpoint d'état dans `.planning/` après chaque étape franchie. Format : `{ cycle: "Build", etape_courante: "Exécuter", etape_completees: ["Observer", "Définir", "Concevoir"], resume: "..." }`.

**Décision attendue** : avant Build — state machine du harness (§4.2 rapport Discovery).

---

### RED-005 — Profondeur de récursion optimale

**Statut** : ouvert, investigation recommandée.

**Question** : la récursion à 3 niveaux est une hypothèse. En pratique, est-ce que le niveau 3 (tâche TDD) produit de la valeur réelle, ou est-ce un overhead cognitif ?

**Piste** : tester sur un premier projet réel. Mesurer le taux de conformité aux 7 étapes au niveau 3. Si < 50% des tâches appliquent consciemment le niveau 3 → le supprimer de l'architecture et documenter que la récursion s'arrête à 2.

**Décision attendue** : après premiers cycles Build réels (retour d'expérience).

---

### RED-006 — Articulation Vérifier et les quality gates CI

**Statut** : ouvert, précision requise.

**Question** : les quality gates CI (lint, SAST, tests) sont-ils une partie de Vérifier ou une précondition à Vérifier ?

**Piste recommandée** : les quality gates CI sont une **sous-activité automatique de Vérifier** — ils ne la remplacent pas. Vérifier inclut les gates CI PLUS la validation humaine (pour M+) PLUS le verdict GO/NO-GO. Un CI vert n'est pas un sous-cycle Vérifier complet sur M+.

**Décision attendue** : avant Build — documenter dans le template DoD.

---

## 15. Relations avec les cycles et les transversaux

### 15.1 Relations inter-cycles via Transmettre

```
Discovery ──[Transmettre]──→ Cadrage
  Note de Discovery, hypothèses, backlog initial

Cadrage ──[Transmettre]──→ Conception
  Charter, backlog DoR-ready, classification risque projet

Conception ──[Transmettre]──→ Build
  ADR, design docs, SLI/SLO, plan de tests

Build ──[Transmettre]──→ Validation
  Incrément (PR mergée), rapport CI, DoD attestée

Validation ──[Transmettre]──→ Release
  Rapport validation, verdict GO/NO-GO, risques résiduels

Release ──[Transmettre]──→ Run
  Release notes, état déploiement, SLO baseline post-release

Run ──[Transmettre]──→ Apprentissage
  Incidents (postmortems), métriques DORA run, signaux prod

Apprentissage ──[Transmettre]──→ Discovery (prochain cycle)
  Patterns systémiques, hypothèses révisées, règles/templates MàJ
```

### 15.2 Relations avec les activités transversales

Les activités transversales (Sécurité, Privacy, FinOps, Accessibilité, i18n, Tests, Observabilité, Documentation, Versioning) ne sont pas des étapes du sous-cycle. Elles sont des **contraintes qui modulent chaque étape** :

- Elles interviennent dans Observer (sources de signaux),
- dans Définir (identification des dimensions qualité concernées),
- dans Concevoir (intégration by design),
- dans Exécuter (implémentation),
- dans Vérifier (validation de conformité),
- dans Capitaliser (patterns de conformité),
- dans Transmettre (documentation mise à jour).

La règle : **aucune transversale ne peut être "faite à la fin"**. Si une transversale n'apparaît pas avant Exécuter, c'est un signal d'alarme — elle arrivera en QA tardive, ce qui coûte 5 à 10× plus cher à corriger (cf. rapport v3 §Key Findings #2).

### 15.3 Relations avec le harness et les modes

```
Sous-cycle                    | Contrôle harness
──────────────────────────────+─────────────────────────────────
Observer (auto)               | Lecture autorisée : tout
Définir (auto ou humain)      | Écriture : .planning/ uniquement
Concevoir (auto ou humain)    | Écriture : .planning/ + docs/ si ADR
Exécuter (selon mode)         | Écriture : périmètre du cycle courant
                              | (Build → code/tests, pas .planning/)
Vérifier (auto + humain M+)   | Lecture + gate : CI résultat
Capitaliser (auto)            | Écriture : .planning/ + docs/
Transmettre (auto + humain É) | Écriture : docs/ + .planning/
```

### 15.4 Dépendances critiques

1. **Définir → tout le reste** : une classe de risque mal assignée dans Définir propage une erreur dans les 5 étapes suivantes. C'est la dépendance la plus critique.

2. **Concevoir → Exécuter** : entrer dans Exécuter sans Concevoir terminé est un anti-pattern. L'exception : T/F où Concevoir est implicite et dure < 1 minute.

3. **Vérifier → Transmettre** : on ne Transmet pas sans verdict Vérifier. Transmettre un incrément non vérifié crée une dette invisible dans le cycle suivant.

4. **Capitaliser → cycle suivant Observer** : le cycle suivant commence par Observer, qui dépend des artefacts de Capitaliser + Transmettre du cycle précédent. Si ces deux étapes ont été sautées, le cycle suivant démarre à l'aveugle.

---

## Annexe A — Comparaison synthétique des frameworks sources

| Dimension | OODA (Boyd) | PDCA (Deming) | Kolb (1984) | Sous-cycle 7 étapes |
|---|---|---|---|---|
| Nb d'étapes | 4 | 4 | 4 | 7 |
| Origine | Militaire / décision rapide | Qualité industrielle | Apprentissage individuel | Synthèse adaptée au dev |
| Force | Vitesse, adaptabilité | Standardisation, amélioration | Apprentissage expérientiel | Complétude + traçabilité |
| Faiblesse | Pas de capitalisation formelle | Pas d'observation préalable | Pas de transmission organisationnelle | Complexité à moduler |
| Récursivité | Implicite (boucles imbriquées) | Explicite (cycles successifs) | Implicite | Explicite (3 niveaux) |
| Adapté à solo-dev IA | Partiellement | Partiellement | Non | Oui (conçu pour) |

---

## Annexe B — Template d'artefact de Transmettre

```markdown
---
cycle: [nom du cycle macroscopique]
sous_cycle_id: [SC-YYYYMMDD-NNN]
classe_risque: [T/F/M/É/C]
date_cloture: [ISO 8601]
verdict_verifier: [GO / NO-GO / GO avec réserves]
---

## Contexte
[État du cycle à la clôture — 2-5 lignes]

## Décisions prises
- [Décision 1 — lien ADR si É/C]
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
