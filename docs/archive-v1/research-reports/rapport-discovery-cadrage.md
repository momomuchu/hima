# Rapport de Discovery et Cadrage — État actuel

> **Statut** : phase Discovery + Cadrage en cours, depuis plusieurs sessions de réflexion.
> **Objet** : système de développement logiciel piloté par un agent IA, en mode solo, avec state management externe.
> **Format** : rapport consolidé, vérité actuelle de la phase Discovery/Cadrage.
> **Date** : 2026-05-02.

---

## Sommaire

1. Contexte et intention
2. Ce qui a été défini (acquis stables)
3. Ce qui a été décidé en cours de Discovery (décisions prises)
4. Ce qui reste ouvert (questions actives)
5. Ce qui est explicitement reporté (out of scope pour la phase actuelle)
6. Architecture conceptuelle consolidée
7. Tensions et arbitrages identifiés
8. Hypothèses à valider
9. Critères de sortie de phase Discovery
10. Prochaines étapes possibles

---

## 1. Contexte et intention

### 1.1 Profil du développeur

- **Mode opératoire** : développement solo, en s'appuyant sur des agents IA pour la majorité de l'exécution.
- **Posture** : maître d'ouvrage et maître d'œuvre simultanés. Le développeur a la vision, oriente, valide ; l'agent exécute, propose, instruit.
- **Cible technique** : développement logiciel et applications web, principalement.

### 1.2 Intention du système à construire

- Un **système de développement complet** dans lequel un agent IA peut piloter la majorité du cycle de développement, sous supervision graduée.
- Un **cadre architectural** suffisamment robuste pour fonctionner sans pilotage humain permanent, mais suffisamment souple pour s'adapter à la classe de risque du changement.
- Un **système qui apprend** de ses cycles passés (postmortems, rétrospectives, classification des bugs récurrents).

### 1.3 Ce que le système n'est pas

- Pas un cadre destiné à une équipe de plusieurs personnes (même si universel sur le papier, l'optimisation est solo).
- Pas un produit générique destiné à être vendu — c'est un **outillage personnel**.
- Pas un système qui élimine le développeur — le développeur reste le décideur final, surtout sur les changements à fort risque.

---

## 2. Ce qui a été défini (acquis stables)

Les éléments suivants sont considérés stabilisés et constituent les **fondations**.

### 2.1 Cadre qualité de référence (v3)

Un cycle de développement piloté par la qualité, structuré autour des standards ouverts :

- **ISO/IEC 25010:2023** pour les caractéristiques produit (9 dimensions, dont *safety* nouveau)
- **ISO/IEC/IEEE 29119** pour la stratégie de tests
- **NIST SSDF SP 800-218** pour la sécurité du cycle
- **OWASP SAMM v2 + ASVS + Top 10** pour la sécurité applicative
- **RGPD art. 35 + méthode CNIL PIA** pour la privacy
- **WCAG 2.2 + EN 301 549 + European Accessibility Act** pour l'accessibilité (en vigueur depuis le 28 juin 2025)
- **FinOps Foundation Framework 2024** pour la gestion des coûts
- **DORA 2024/2025** (5 métriques) + **SPACE** pour la performance et le bien-être
- **Google SRE** pour l'observabilité (SLO, error budgets, postmortem blameless)
- **Westrum** pour la culture organisationnelle

### 2.2 Pipeline fractale (v4)

La pipeline globale est composée de **8 cycles** :

1. Discovery
2. Cadrage
3. Conception
4. Build
5. Validation
6. Release
7. Run
8. Apprentissage

Chacun de ces cycles suit le même **sous-cycle universel à 7 étapes** :

Observer → Définir → Concevoir → Exécuter → Vérifier → Capitaliser → Transmettre

C'est le **pattern fractal** : la même discipline s'applique à tous les niveaux.

### 2.3 Modulation par classe de risque

Tout changement est classé sur 5 niveaux : **T (Trivial) / F (Faible) / M (Moyen) / É (Élevé) / C (Critique)**.

La profondeur de chaque sous-cycle se module sur cette classe. Sur un changement T, on traverse les 7 étapes en quelques secondes. Sur un C, chaque étape est tracée et validée.

### 2.4 Trois modes opératoires

Le développeur peut être dans trois modes selon l'intensité de sa supervision :

- **Mode Pairing** : présent en continu, l'agent suit le flux de pensée.
- **Mode Auto-décision** : l'agent fait Discovery + propose, le développeur valide au triage. **Mode par défaut visé.**
- **Mode Bypass** : l'agent fait tout, y compris le triage, dans un périmètre borné.

Les modes ne créent pas trois cycles différents. Ils configurent **où se situe la frontière de contrôle humain** dans le même cycle.

### 2.5 Architecture des fichiers : trois territoires

Le repo est structuré en trois territoires séparés :

- **`docs/`** : vérité actuelle du produit (lisible humain, source de référence)
- **`.planning/`** : système de pilotage et mémoire d'exécution (maintenu par agent + humain)
- **code, tests, infra** : implémentation

Dans `.planning/`, séparation claire entre :

- **Registry** (objets vivants : PBI, risques, changements, décisions)
- **Timeline** (snapshots immuables : sprints clos, releases déployées)
- **State** (vue régénérée à chaque mise à jour)
- **Metrics et Logs** (append-only JSONL)
- **Agent** (politiques, prompts, audit, frontières)

### 2.6 State management externe (harness)

Un harness externe contrôle ce que l'agent peut écrire selon la phase courante. Concrètement :

- Variables d'environnement et d'état contrôlent ce qui est autorisé.
- En phase planning, l'agent peut toucher `.planning/` et la doc, pas le code.
- En phase build, il peut toucher le code et les tests, pas la planification du sprint en cours.
- Les frontières déclaratives de `.planning/agent/boundaries.yaml` sont **doublées** par les contraintes effectives du harness.

C'est ce qui rend le système opérable dans la pratique, pas juste sur le papier.

### 2.7 Les 24 sections du cycle qualité mappées aux deux territoires

Chaque section du cycle qualité (de « Définir la qualité avant » à « Anti-patterns ») a un **emplacement de définition** dans `docs/` et un **emplacement d'exécution** dans `.planning/`. Aucun contrôle qualité n'est orphelin.

---

## 3. Ce qui a été décidé en cours de Discovery

Décisions prises au fur et à mesure des échanges.

### 3.1 Décision : pipeline fractale plutôt que cycle plat

**Contexte** : v3 présentait un cycle plat à 24 sections. Trop linéaire pour le web.

**Décision** : adopter une structure fractale (v4) où chaque cycle est lui-même un mini-cycle.

**Justification** : permet de moduler la profondeur par risque, d'expliciter les feedbacks inter-cycles, de capturer la nature non-séquentielle du dev moderne.

**Conséquences** : la pipeline est plus complexe à présenter mais plus juste à appliquer.

### 3.2 Décision : matrice risque comme pivot central

**Décision** : la classification de risque T/F/M/É/C est le **mécanisme principal de modulation** de tout le reste (profondeur du cycle, mode par défaut, gates obligatoires, type de revue).

**Conséquences** : la classification doit être *robuste*. Sans elle, le système entier perd son adaptabilité.

**Risque associé** : la classification reste subjective si elle n'est pas mécanisée. Voir §4.

### 3.3 Décision : auto-décision comme mode par défaut

**Décision** : le mode par défaut est l'auto-décision, pas le pairing.

**Justification** : maximiser le temps libéré, sans renoncer au contrôle final.

**Garde-fous** :
- Format de proposition obligatoire (problème, alternatives, choix, critère de succès, classe de risque).
- Quota de rejets mental (≥ 20 %) pour éviter le rubber-stamping.
- Audit aléatoire hebdomadaire d'une proposition acceptée la veille.

**Conséquences** : exige un harness suffisamment robuste pour empêcher l'agent de dériver sans humain.

### 3.4 Décision : bypass autorisé seulement T/F, interdit É/C

**Décision** : le bypass est acceptable pour T et F (et éventuellement M sous conditions strictes), interdit pour É et C.

**Justification** : sur les changements à fort risque, le développeur doit être responsable de la décision même si l'analyse est faite par l'agent. Non négociable.

### 3.5 Décision : Strangler Fig pour les changements d'architecture

**Décision** : aucun big bang sur les changements d'architecture. Tout passe par un strangler fig (façade qui route vers ancien ou nouveau, migration progressive, cas par cas).

**Justification** : transforme un changement É/C en séquence de changements F/M, qui repassent chacun par le cycle normal.

### 3.6 Décision : « Discovery » a trois modes selon la source du besoin

**Décision** : la phase Discovery du cycle reste valide mais joue dans trois modes :

- **Mode Produit** : utilisateurs externes → entretiens, JTBD, opportunity tree.
- **Mode Self-feedback** : développeur est l'utilisateur → formalisation écrite + tests de nécessité.
- **Mode Technique** : changement d'architecture → document de justification + alternatives + critères ex-post mesurables.

**Conséquences** : pas besoin de cycle séparé pour le refactor ou le changement d'archi. C'est le même cycle, mode différent.

### 3.7 Décision : mono-état actuel, multi-états reporté

**Décision** : pour l'instant, le harness est en **mono-état strict** (un seul cycle/sprint actif à la fois).

**Justification** : simplicité, contrainte du harness actuel.

**Limite reconnue** : ne reflète pas la réalité du dev solo où plusieurs choses se font en parallèle.

**Reporté** : passage en multi-états par objet (chaque PBI/sprint/release a son propre état) à étudier ultérieurement.

### 3.8 Décision : économie sur les tokens du planning

**Décision** : l'agent écrit dans `.planning/` **ce qui est nécessaire à la prochaine décision**, pas ce qui serait théoriquement traçable.

**Justification** : sans cette discipline, l'agent va remplir le `.planning/` avec des artefacts qu'il ne consultera jamais. Coût en tokens, fatigue cognitive, dilution du signal.

**Pas concerné par cette restriction** : tests (à fond), documentation produit (à fond), code (à fond).

**Concerné** : sprint plans, retrospectives, quality-execution matrices, registry items. Le minimum nécessaire, à jour, sans broderie.

### 3.9 Décision : trois territoires `docs/` + `.planning/` + code

**Décision** : architecture détaillée des fichiers acceptée comme socle. Voir document `architecture-planning-docs.md` pour le détail.

**Conséquences** : structure projet stabilisée, peut servir de référence pour les futurs projets.

---

## 4. Ce qui reste ouvert (questions actives)

Questions identifiées comme nécessitant une décision avant la sortie de Discovery, ou explicitement laissées en attente.

### 4.1 Comment opérationnaliser la classification de risque

**Statut** : ouvert, non bloquant immédiat.

**Question** : qui décide la classe T/F/M/É/C, comment, avec quels critères mécaniques ?

**Pistes identifiées** :
- Un arbre de décision déterministe (touche auth → É minimum, touche données santé → C minimum, etc.).
- Critères automatisables (parsing des fichiers touchés, labels, scan des migrations).
- Critères ambigus qui exigent un humain.

**Conséquence d'inaction** : la classification reste subjective. Le système fonctionne mais avec un curseur flou.

### 4.2 Comment formaliser la state machine du harness

**Statut** : ouvert, prochain sujet structurant.

**Question** : quel est le schéma formel des états, transitions, conditions, actions autorisées ?

**Pistes identifiées** :
- Document `docs/01-governance/operating-model.md` (conceptuel).
- Fichier `.planning/agent/state-machine.yaml` (exécutable).
- Log des transitions dans `logs/state-transitions.jsonl`.

**Conséquence d'inaction** : le harness reste une boîte noire, son évolution risque de désynchroniser avec l'architecture des fichiers.

### 4.3 Quelle granularité pour la mémoire à long terme

**Statut** : ouvert, basse priorité.

**Question** : comment transformer l'archive en mémoire utile (interrogeable pour informer une décision présente) ?

**Pistes identifiées** :
- Index sémantique des décisions passées.
- Base de patterns récurrents (bugs, classes de risque sous-estimées).
- Journal des biais détectés (agent + développeur).

**Conséquence d'inaction** : chaque cycle redémarre à zéro sur le plan de la mémoire active. L'historique existe mais n'informe pas.

### 4.4 Quelles caractéristiques ISO 25010 prioriser

**Statut** : ouvert, dépend du projet réel.

**Question** : pour un projet donné, quelles sont les 3-5 caractéristiques ISO 25010 prioritaires avec quels seuils ?

**Pistes identifiées** :
- Document `docs/08-quality/quality-model-instance.md` par projet.
- Caractéristiques critiques (security, reliability) avec seuils mesurables.
- Caractéristiques importantes avec budgets.
- Caractéristiques explicitement dépriorisées.

**Conséquence d'inaction** : les quality gates ressemblent à une checklist arbitraire plutôt qu'à l'expression d'un modèle conscient.

### 4.5 Modèle de capacité et de coût

**Statut** : ouvert, peut attendre.

**Question** : comment arbitrer rationnellement quand le backlog dépasse la capacité ?

**Pistes identifiées** :
- Modèle de capacité (cycles parallèles, tokens LLM, compute CI/CD).
- Modèle de coût par classe (T = X, F = Y, M = Z…).
- Mécanisme d'arbitrage explicite.

**Conséquence d'inaction** : pas de critère pour décider quoi *ne pas* faire. Tout finit en backlog.

### 4.6 Protocole de promotion de classe en cours de cycle

**Statut** : ouvert, à formaliser.

**Question** : quand on découvre en cours de cycle qu'un changement classé F est en réalité É, qu'est-ce qui se passe précisément ?

**Pistes identifiées** :
- Détection (qui, quand, comment).
- Action immédiate (pause de la PR, re-Discovery, re-Conception).
- Traçabilité (log de la promotion, métadonnées).
- Apprentissage (la promotion alimente un feedback pour améliorer la classification future).

**Conséquence d'inaction** : la promotion reste un concept, la classification initiale ne s'améliore jamais.

### 4.7 Comment intégrer plusieurs cycles parallèles à terme

**Statut** : reporté explicitement.

**Question** : passer du mono-état strict au multi-états par objet sans casser l'architecture existante.

**Conséquence d'inaction** : limitation actuelle assumée. À traiter après stabilisation du mono-état.

---

## 5. Ce qui est explicitement reporté (out of scope)

Pour discipline, ce qui a été identifié mais explicitement mis hors périmètre de la phase Discovery actuelle.

- **Multi-projets / multi-repos** : un système qui gère plusieurs projets simultanément. Reporté.
- **Collaboration multi-développeurs** : le cadre est universel mais l'optimisation est solo. Pas d'effort dédié à l'adaptation équipe.
- **Certification réglementaire** (ISO 9001, SOC 2, HDS) : le cadre est compatible mais pas optimisé pour l'audit externe. Reporté.
- **Marketplace de templates** : idée parfois évoquée d'extraire les `.planning/` et `docs/` en templates publiables. Reporté.
- **Outils de visualisation** : dashboards, mermaid graphs, vues web sur l'état. Reporté.

---

## 6. Architecture conceptuelle consolidée

Vue synthétique de l'architecture telle que définie aujourd'hui.

### 6.1 Couches du système

```
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 1 — VISION ET STRATÉGIE                              │
│ • Cadre qualité (v3) : standards de référence               │
│ • Pipeline fractale (v4) : 8 cycles + sous-cycle universel  │
│ • Modes opératoires : pairing / auto-décision / bypass      │
│ • Matrice risque T/F/M/É/C : pivot d'adaptation             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 2 — ARCHITECTURE DES FICHIERS                        │
│ • docs/ : vérité actuelle du produit                        │
│ • .planning/ : pilotage et mémoire d'exécution              │
│ • code/tests/infra : implémentation                         │
│ • Mapping cycle qualité → emplacement explicite             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 3 — STATE MANAGEMENT EXTERNE (HARNESS)               │
│ • Variables d'environnement et d'état                       │
│ • Filtre des actions de l'agent par phase                   │
│ • Frontières effectives (pas seulement déclaratives)        │
│ • Mono-état strict actuel (limite assumée)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 4 — AGENT IA                                         │
│ • Politiques (auto / assisté / interdit)                    │
│ • Prompts versionnés                                        │
│ • Audit append-only                                         │
│ • Détection d'incohérences                                  │
│ • Économie tokens sur le planning                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COUCHE 5 — DÉVELOPPEUR (TOI)                                │
│ • Décideur final, surtout sur É/C                           │
│ • Validateur des transitions critiques                      │
│ • Auteur de la vision et du cadrage                         │
│ • Audit aléatoire et garde-fous anti-rubber-stamp           │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Flux principal

```
Idée
  │
  ▼
[Discovery] ───── modes : produit / self-feedback / technique
  │
  ▼ (problème validé)
[Cadrage] ─────── DoR formelle, classification de risque
  │
  ▼ (engagement partagé)
[Conception] ──── ADR, threat model si É/C, AIPD si seuil RGPD
  │
  ▼ (plan validé)
[Build] ───────── inner loop par incrément, conventional commits
  │
  ▼ (code mergé, gates verts)
[Validation] ──── risk-based testing, validation produit
  │
  ▼ (build approuvé)
[Release] ─────── canary progressif, expand/contract migrations
  │
  ▼ (en production)
[Run] ─────────── boucle OODA continue, SLO, error budgets
  │
  ▼ (signaux)
[Apprentissage] ─ rétro de cycle + postmortem si incident
  │
  └─── feedbacks vers cycles amont
```

Activités continues transverses (sécurité, privacy, FinOps, accessibilité, i18n, observabilité, doc, tests, versioning) imprègnent **tous** les cycles.

### 6.3 Principes invariants

1. **Standards d'abord, outils ensuite**.
2. **Mesurable** (DORA, SPACE, ISO 25010, FinOps).
3. **Quality gates plutôt que checkpoints humains**.
4. **Blameless** (Westrum, génératif).
5. **Continu autant que ponctuel** (activités transverses ≠ phases).
6. **Universel mais ajusté** (modulation par risque).
7. **Économie sur le planning, pas sur la qualité**.

---

## 7. Tensions et arbitrages identifiés

### 7.1 Rigueur vs vélocité

**Tension** : un cadre détaillé protège contre les oublis mais ralentit. Un cadre léger libère mais expose aux dérives.

**Arbitrage actuel** : modulation par risque. T/F en chemin court rapide, É/C en chemin long rigoureux. Ne pas appliquer le chemin long à tout par dogme.

### 7.2 Auto-décision vs rubber-stamp

**Tension** : l'auto-décision libère du temps mais dégrade silencieusement vers le bypass si on valide sans lire.

**Arbitrage actuel** : format de proposition obligatoire, quota de rejets mental, audit aléatoire.

### 7.3 Bypass vs perte de contrôle

**Tension** : le bypass maximise le temps libéré mais crée le risque de découvrir trop tard que l'agent a mal décidé.

**Arbitrage actuel** : bypass borné aux T/F, jamais sur É/C. Quality gates CI bloquants sans dérogation.

### 7.4 Documentation vs économie de tokens

**Tension** : tracer permet la mémoire et l'audit, mais coûte en tokens et en attention.

**Arbitrage actuel** : doc produit et tests à fond ; planning au strict nécessaire à la prochaine décision.

### 7.5 Mono-état vs réalité du dev

**Tension** : le mono-état strict est simple à raisonner mais ne reflète pas le fait qu'on développe plusieurs choses en parallèle.

**Arbitrage actuel** : accepté comme limite temporaire. Multi-états reporté.

### 7.6 Architecture parfaite vs lancement réel

**Tension** : continuer à raffiner l'architecture sans la confronter au réel est une forme sophistiquée de procrastination.

**Arbitrage actuel** : phase Discovery prolongée volontairement parce qu'une version plus simple a déjà tourné. Le raffinement actuel est pour la version suivante.

---

## 8. Hypothèses à valider

Hypothèses sur lesquelles repose le système, à confronter au réel quand le système tournera.

- **H1** : la classification T/F/M/É/C en 5 niveaux est suffisante. *Risque* : peut s'avérer trop grossière, demander plus de finesse.
- **H2** : le mode auto-décision sera tenable comme mode par défaut sans dérive en rubber-stamp. *Risque* : la fatigue cognitive l'emporte, on dérive en bypass de fait.
- **H3** : le harness mono-état est tenable pour un dev solo. *Risque* : trop bloquant en pratique, on contourne le harness.
- **H4** : économiser sur les tokens du planning ne dégrade pas la traçabilité utile. *Risque* : on regrette en postmortem de ne pas avoir tracé certaines décisions intermédiaires.
- **H5** : l'agent IA respecte les frontières du harness. *Risque* : un mode jailbreak involontaire (interprétation créative d'une contrainte).
- **H6** : Strangler Fig est applicable à tous les changements d'architecture significatifs. *Risque* : certains changements (ex : changement de framework frontend complet) ne s'y prêtent pas.
- **H7** : le cycle s'auto-améliore via les rétros et les postmortems. *Risque* : sans discipline, ces réunions deviennent rituelles et non actionnables.

---

## 9. Critères de sortie de phase Discovery

Quand peut-on dire que la phase Discovery est terminée et qu'on peut passer en Build ?

### 9.1 Critères stricts (non négociables)

- [x] L'architecture conceptuelle des fichiers est figée (voir document architecture-planning-docs.md).
- [x] Le cycle de qualité de référence est figé (v3).
- [x] La pipeline fractale est figée (v4).
- [x] Les modes opératoires sont définis.
- [x] La matrice risque est définie (T/F/M/É/C).
- [x] Le state management externe existe (harness opérationnel selon le développeur).
- [x] Une version simple a déjà tourné en pratique (validation par expérience).

### 9.2 Critères souhaitables (à compléter avant Build)

- [ ] Classification de risque mécanisée (arbre de décision déterministe).
- [ ] State machine du harness formalisée (schéma écrit).
- [ ] Modèle ISO 25010 instancié pour le projet réel.
- [ ] Au moins une hypothèse parmi H1-H7 confrontée au réel.

### 9.3 Critères différés (peuvent attendre Build)

- [ ] Mémoire à long terme structurée.
- [ ] Modèle de capacité et de coût.
- [ ] Protocole de promotion de classe formalisé.
- [ ] Multi-états.

### 9.4 Verdict actuel

**Phase Discovery quasi terminée**. Les critères stricts sont remplis. Les critères souhaitables peuvent l'être de deux manières : (a) en finissant l'architecture avant de coder, (b) en commençant à coder et en formalisant ces points en parallèle. Voir §10.

---

## 10. Prochaines étapes possibles

Trois options principales pour la suite, selon le degré de raffinement architectural souhaité.

### Option A — Sortie immédiate de Discovery, démarrage Build

**Acte** : démarrer le projet réel maintenant, avec l'architecture actuelle. Traiter les questions ouvertes (§4) en cours de route.

**Avantages** :
- Évite la procrastination architecturale.
- Confronte les hypothèses (§8) au réel rapidement.
- Apporte du feedback concret pour affiner ce qui reste flou.

**Risques** :
- Découvrir tardivement qu'un point flou (ex : classification mécanique) est en fait bloquant.
- Refondre l'architecture en cours de Build (coûteux en énergie).

### Option B — Finir 2-3 points clés avant Build

**Acte** : prioriser la classification de risque mécanique + la state machine formalisée + le modèle ISO 25010 instancié. Démarrer Build après.

**Avantages** :
- Lance le Build avec un système plus complet.
- Réduit le risque de refonte en cours de route.
- Donne un cadre clair à l'agent dès le début.

**Risques** :
- Procrastination déguisée si on ne fixe pas une deadline.
- Sur-ingénierie sur des points qui ne se révéleront pas critiques.

### Option C — Phase pilote sur un projet jetable

**Acte** : démarrer un projet *exprès simple* pour tester l'architecture complète. Apprendre, ajuster, puis attaquer le projet réel.

**Avantages** :
- Valide l'architecture sans engagement sur le projet réel.
- Apprentissage rapide, refonte facile.
- Donne un retour d'expérience documenté.

**Risques** :
- Coût de temps non négligeable.
- Le projet pilote peut être trop simple pour révéler les vrais problèmes.

### Recommandation honnête

Pour un dev solo qui a déjà fait tourner une version plus simple : **Option A**, avec discipline.

Concrètement : démarrer le projet réel, mais avec un engagement écrit que les trois points (classification mécanique, state machine formalisée, modèle ISO 25010 instancié) seront formalisés dans les **deux premiers cycles de Build**. Pas après, pas plus tard.

L'argument central : les points ouverts sont des raffinements, pas des fondations. Les fondations sont posées. Continuer à peaufiner sans coder est de la procrastination cognitive sophistiquée — exactement ce que la pipeline est censée prévenir avec la phase Discovery limitée dans le temps.

---

## Conclusion

La phase Discovery + Cadrage est largement avancée. L'architecture conceptuelle est solide, cohérente, alignée sur des standards reconnus, et adaptée au contexte (dev solo + agents IA + state management externe).

Trois choses sont à retenir :

1. **L'architecture est suffisante pour démarrer**. Pas parfaite — elle ne le sera jamais — mais suffisante.
2. **Les vrais arbitrages sont identifiés**. Rigueur vs vélocité, auto-décision vs rubber-stamp, bypass vs perte de contrôle. Connaître ces tensions, c'est déjà la moitié du travail.
3. **Le risque dominant maintenant n'est plus l'incomplétude de l'architecture, c'est la procrastination architecturale**. Le système est prêt à tourner. Il faut maintenant l'éprouver.

La prochaine décision à prendre est binaire : **continuer la Discovery, ou démarrer le Build**. Les deux sont défendables. Mais elle doit être prise consciemment, pas par dérive.

---

*Rapport produit en clôture de la phase Discovery + Cadrage. Document de référence à versionner dans `docs/03-discovery/discovery-cadrage-state-2026-05-02.md`.*
