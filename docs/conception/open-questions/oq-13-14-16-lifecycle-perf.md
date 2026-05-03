# OQ-13-14-16 — Cycle de vie projet, cycle de vie harness, performance et coût

> **Statut** : décisions arrêtées.
> **Sections couvertes** : §13 (Q13.1–Q13.7), §14 (Q14.1–Q14.10), §16 (Q16.1–Q16.9).
> **Références** : `09-cli-commands-spec.md` §10, `checkpoint-implementation.md` §6 D11/D16, §9.
> **Date** : 2026-05-03.

---

## Section 13 — Cycle de vie d'un projet

---

### Q13.1 — Comment archiver un projet terminé ? Le harness fournit-il `harness archive` ?

**Réponse** : Non, pas de commande `harness archive` dans le MVP. L'archivage se fait par convention Git : tag de release final (`v1.0.0`), puis le repo reste en l'état. Le harness ne gère pas l'archivage de projet comme primitive.

**Justification** : D16 impose un single package sans surface CLI inutile. Un projet "terminé" dans ce contexte signifie phase Run active ou phase Apprentissage close — il reste dans `.planning/timeline/` avec ses snapshots immuables. L'outillage Git (tag, branch, archive) couvre 100 % du besoin sans ajouter une commande qui serait appelée une fois par projet. Si le besoin s'avère récurrent en pratique, ajouter `harness archive` en v1.1.

**Référence spec** : `checkpoint-implementation.md` §3.5 — `.planning/timeline/` : snapshots immuables (sprints clos, releases déployées). `09-cli-commands-spec.md` Annexe — liste de commandes MVP sans `archive`.

---

### Q13.2 — Comment forker un projet sans dupliquer tout l'historique `.planning/` ?

**Réponse** : `git clone --no-local` + `harness init --force` sur le fork. Le `--force` réinitialise `state.yaml` en phase Discovery et vide les logs JSONL (nouveaux fichiers vides), mais préserve les templates dans `.planning/agent/policies.yaml` et les schémas de registry. Le `.planning/timeline/` de l'original n'est pas copié — l'utilisateur le supprime manuellement s'il ne veut pas l'historique.

**Justification** : un fork est un nouveau projet avec une base de code partagée. Il doit repartir de Discovery. Réutiliser les politiques et les gates (`.planning/agent/`) est légitime — ce sont des artefacts de gouvernance, pas d'historique. Pas besoin d'une commande dédiée.

**Référence spec** : `09-cli-commands-spec.md` §3 `harness init --force` — "Réinitialise même si déjà initialisé (préserve les logs JSONL)" — à interpréter comme réinitialisation de state, pas conservation des événements d'un autre projet.

---

### Q13.3 — Comment fusionner deux projets en un seul ?

**Réponse** : Hors scope du harness MVP. La fusion de projets est une opération Git (`git merge --allow-unrelated-histories`) + réconciliation manuelle du `.planning/registry/`. Le harness expose `harness check` (Q9.8) pour valider la cohérence post-fusion, mais ne gère pas la fusion elle-même.

**Justification** : la fusion de projets est rare, complexe, et irréductiblement contextuelle (quels PBI garder, quels risques fusionner, quel état de phase retenir). Automatiser cela dans le MVP serait over-engineering pur. `harness check` couvre le besoin de validation post-opération.

**Référence spec** : `checkpoint-implementation.md` §1 — "Risque dominant : procrastination architecturale." Toute feature rare ajoutée au MVP nourrit ce risque.

---

### Q13.4 — Comment importer un projet existant (sans `.planning/` initial) dans le système ?

**Réponse** : `harness init` dans le répertoire du projet existant, sans `--force` (premier init). Cela crée le squelette `.planning/` et initialise `state.yaml` en phase Discovery. L'agent IA peut ensuite être invité à faire un Discovery rétroactif : analyser le code existant et proposer un premier `registry/` peuplé (PBI inférés, risques identifiés). Ce n'est pas une commande automatique — c'est un workflow documenté dans `docs/playbooks/import-existing.md`.

**Justification** : un projet existant sans `.planning/` est traité comme un greenfield du point de vue du harness. La valeur est dans la discipline future, pas dans la reconstruction de l'historique passé. L'analyse rétroactive (Q13.5) reste optionnelle.

**Référence spec** : `09-cli-commands-spec.md` §3 `harness init` — comportement si `.planning/` absent : crée le squelette, état initial Discovery.

---

### Q13.5 — Le harness peut-il analyser un projet legacy et proposer une structure `.planning/` initiale ?

**Réponse** : Oui, mais pas comme commande CLI native — comme skill. La skill `analyze-legacy` (à ajouter au catalogue `06-skills-catalog-spec.md`) invoque l'agent IA pour inférer PBI, risques et décisions depuis le code existant, les commits Git, les issues GitHub/Linear. Elle écrit dans `.planning/registry/` et marque chaque artefact généré avec `source: inferred` pour distinguer les artefacts validés des artefacts inférés.

**Justification** : cette analyse nécessite des tokens LLM et de l'intelligence contextuelle — c'est un travail d'agent, pas de CLI déterministe. La confiner dans une skill respecte D14 (commande unique `harness hook <event>` pour les hooks, skills pour l'intelligence).

**Référence spec** : `checkpoint-implementation.md` §7.2 — `artifacts/skills/` comme emplacement des skills du harness.

---

### Q13.6 — Quelle est la durée de rétention par défaut des données dans `.planning/timeline/` ?

**Réponse** : Illimitée par défaut. Les données `.planning/timeline/` sont des snapshots immuables versionés dans Git — elles ne grossissent pas dynamiquement (elles sont écrites une fois, jamais modifiées). La rotation ne s'applique qu'aux logs JSONL (`.planning/logs/`), qui suivent une politique de rotation séparée (voir Q10.3). Pour `.planning/timeline/`, l'archivage se fait via Git history — pas de suppression automatique.

**Justification** : les snapshots de sprints et releases sont des artefacts d'audit. Les supprimer automatiquement violerait le principe d'append-only et d'immuabilité des snapshots (D15 : "JSONL append-only pour logs et métriques"). Le coût disque est négligeable (fichiers Markdown/YAML, pas de binaires).

**Référence spec** : `checkpoint-implementation.md` §3.5 — `.planning/timeline/` : snapshots immuables (sprints clos, releases déployées).

---

### Q13.7 — Comment exporter un projet vers un format portable (audit externe, transmission) ?

**Réponse** : `harness status --json` + `git archive HEAD .planning/ docs/` produit un tarball autoportant. Pour un audit formel, la commande est : `git archive --format=zip HEAD .planning/ docs/ -o audit-export-$(date +%Y%m%d).zip`. Pas de commande `harness export` dédiée dans le MVP.

**Justification** : l'export est une opération ponctuelle. `git archive` couvre 100 % du besoin avec zero code supplémentaire. L'Evidence Set (`.planning/state/runs/`) est inclus dans `.planning/` — un auditeur a donc accès aux preuves d'exécution (tests passants, lint, typecheck) via ce tarball.

**Référence spec** : `09-cli-commands-spec.md` §9 `harness evidence show` — l'Evidence Set est la source de vérité pour `DONE_VERIFIED`, accessible dans `.planning/state/runs/<run-id>/evidence-set.json`.

---

## Section 14 — Cycle de vie du harness lui-même

---

### Q14.1 — Le harness suit-il sa propre pipeline (méta) ? Comment ?

**Réponse** : Oui, à partir de la v1.0 stable. Le repo `@harness/cli` lui-même tourne avec `harness install --target claude`. Chaque feature du harness suit la pipeline fractale. Les fichiers `.planning/` du repo harness sont versionés. C'est le dogfooding décrit dans le checkpoint §7.11.

**Justification** : c'est la validation la plus rigoureuse du système. Si le harness ne peut pas se piloter lui-même, il y a un bug de conception. La contrainte est réelle — pendant la phase MVP (Étape 2), le harness est développé sans se piloter lui-même pour éviter l'oeuf/poule. À partir d'Étape 3 (toutes les classes de risque), il s'auto-applique.

**Référence spec** : `checkpoint-implementation.md` §7.11 — "Le code source du harness suit-il lui-même la pipeline qu'il impose (dogfooding) ? À quelle profondeur ?"

---

### Q14.2 — Quelle est la cadence de release prévue ?

**Réponse** : À la demande, pas de cadence fixe. En pratique : releases groupées quand une étape du plan de travail est franchie (Étape 2 → v0.1.0, Étape 3 → v0.2.0, Étape 4 → v0.3.0, Étape 5 → v0.4.0, Étape 6 → v1.0.0). Pas de release mensuelle forcée.

**Justification** : le harness est un outil solo. Forcer une cadence mensuelle génère des releases vides ou précipitées. Les releases sont pilotées par la valeur livrée (fin d'étape), pas par le calendrier. SemVer garantit la compatibilité — les utilisateurs savent quand mettre à jour.

**Référence spec** : `checkpoint-implementation.md` §9 — plan de travail en 6 étapes, chacune avec un critère de sortie binaire. Ce critère est le déclencheur naturel d'une release.

---

### Q14.3 — Comment versionner ? SemVer strict ?

**Réponse** : SemVer strict. `MAJOR.MINOR.PATCH` :
- MAJOR : breaking change sur le format `.planning/state/` ou sur l'interface `harness hook` (nécessite migration).
- MINOR : nouvelle commande CLI, nouveau hook supporté, nouveau skill/subagent.
- PATCH : bug fix, amélioration de performance, doc.

La version 0.x autorise des breaking changes en MINOR (convention SemVer pre-1.0).

**Justification** : les utilisateurs font `npm install -g @harness/cli`. SemVer strict leur permet de raisonner sur les mises à jour. La distinction MAJOR/MINOR est ancrée dans ce qui casse les projets existants (format `.planning/`) vs ce qui ajoute des capacités.

**Référence spec** : `checkpoint-implementation.md` §6 D16 — single package `@harness/cli`. SemVer s'applique directement à ce package unique.

---

### Q14.4 — Les breaking changes sont-elles annoncées combien de temps à l'avance ?

**Réponse** : Pas d'annonce préalable en phase 0.x (outil solo, pas de communauté). À partir de v1.0 : deprecation sur une MINOR avant suppression en MAJOR. Exemple : `state.yaml` v1 supporté en v1.x, supprimé en v2.0. La commande `harness migrate` (à implémenter en Étape 6) gère la migration automatique entre formats.

**Justification** : en 0.x, l'utilisateur principal c'est toi. La discipline de deprecation s'impose quand il y a des utilisateurs tiers. Ajouter des délais d'annonce en solo génère de la friction sans valeur. Le flag s'active à v1.0.

**Référence spec** : `checkpoint-implementation.md` §9 Étape 6 — "Documentation utilisateur" et "Publication sur npm" marquent le passage à une audience externe.

---

### Q14.5 — Y a-t-il une stratégie de LTS (Long Term Support) ?

**Réponse** : Non, pas de LTS. Outil solo + agents IA — le modèle de support continu de type entreprise n'est pas adapté. La stratégie est `latest` : une seule version active, les utilisateurs sont encouragés à rester à jour. Si un projet ne peut pas migrer immédiatement, il reste sur la version installée — le harness est local, pas un service.

**Justification** : le LTS a du sens pour des frameworks utilisés par des milliers d'équipes avec des contraintes de migration lentes. Ici, le parc d'installation est contrôlé (quelques projets, un utilisateur principal). Le coût de maintenir une branche LTS en parallèle n'est pas justifié.

**Référence spec** : `checkpoint-implementation.md` §6 D16 — "un seul package au début". Un seul package implique une seule ligne de release active.

---

### Q14.6 — Comment recueillir le feedback des utilisateurs ?

**Réponse** : Trois canaux :
1. **Méta-feedback harness** : `.planning/` du repo harness lui-même contient les rétros et postmortems (dogfooding §14.1).
2. **GitHub Issues** : canal principal pour les utilisateurs tiers à partir de v1.0.
3. **Hypothèses H1–H7** (`checkpoint-implementation.md` §8 Q13) : validées empiriquement en pratique, documentées dans `docs/audits/`.

Pas de telemetry automatique, pas de formulaires — trop lourd pour un outil solo.

**Référence spec** : `checkpoint-implementation.md` §8 Q13 — liste des 7 hypothèses à valider en pratique. Ce sont les vecteurs de feedback les plus structurants.

---

### Q14.7 — Le harness est-il publié en open source ? Quelle licence ?

**Réponse** : **MIT**. Publication open source dès v1.0 stable.

**Justification** : le harness est d'abord un outil personnel, mais sa valeur augmente avec l'adoption. MIT est la licence qui maximise l'adoption sans friction (pas de copyleft viral comme GPL, pas de conditions d'attribution lourdes comme Apache 2.0 pour les fichiers modifiés). MIT est la norme de facto de l'écosystème npm. La concession commerciale que GPL ou AGPL procureraient n'est pas pertinente ici — le harness n'est pas un service SaaS qu'on veut protéger d'une exploitation cloud tierce.

Position sur le compromis MIT vs Apache 2.0 : Apache 2.0 ajoute une protection de brevet explicite. Pour un outil CLI sans IP brevetable, cette protection est théorique. MIT suffit.

**Référence spec** : `checkpoint-implementation.md` §9 Étape 6 — "Publication sur npm." La publication npm avec MIT est la trajectoire naturelle.

---

### Q14.8 — Stratégie de contribution externe : ouverte, fermée, restreinte aux trusted ?

**Réponse** : **Fermée jusqu'à v1.0, puis ouverte avec CLA léger**.

En phase 0.x : PRs non acceptées (trop tôt, architecture encore instable). Issues bienvenues pour le feedback.

À partir de v1.0 : contributions ouvertes avec un CLA minimaliste (cession des droits de la contribution au projet, pas à une entité commerciale). Les contributions touchant le `core/` (state machine, risk-classifier, gates) passent par une review plus stricte car ce sont les pièces pivot.

**Justification** : ouvrir les contributions avant que l'architecture soit stable génère de la dette de revue et des conflits de direction. Attendre v1.0 est le bon équilibre. Le CLA léger protège contre la réclamation de droits a posteriori sur une contribution — problème réel sur les projets MIT qui deviennent populaires.

**Référence spec** : `checkpoint-implementation.md` §7.2 — `packages/core/` identifié comme le cœur réutilisable. C'est la zone à protéger en review.

---

### Q14.9 — Comment gérer les forks ?

**Réponse** : Les forks sont bienvenus (MIT le permet). Le harness ne cherche pas à contrôler les forks. Si un fork diverge significativement (autre paradigme, autre plateforme cible), il devient son propre projet — pas un problème.

Le vrai risque n'est pas les forks, c'est la fragmentation du format `.planning/`. Si un fork change le schéma `state.yaml`, les projets deviennent incompatibles. Mitigation : le schéma `state.yaml` est versionné explicitement (`schema_version: 1` dans le fichier) — un fork qui change le schéma doit bumper ce numéro, et les projets savent quelle version du harness ils requièrent.

**Justification** : outil solo + potentiel produit = le fork sain est une preuve de valeur. Le contrôle n'est pas l'objectif. La coordination sur le schéma de state est la seule contrainte qui mérite attention.

**Référence spec** : `checkpoint-implementation.md` §6 D15 — "YAML simple en `.planning/state/`". Le schéma est le contrat d'interopérabilité.

---

### Q14.10 — Y a-t-il une roadmap publique ?

**Réponse** : Oui, à partir de v1.0. Sous la forme d'un `ROADMAP.md` dans le repo, mis à jour à chaque release MAJOR/MINOR. Pas de board GitHub Projects public en 0.x (trop tôt, génère des attentes non satisfaites). Le plan de travail §9 du checkpoint est la roadmap interne jusqu'à v1.0.

**Justification** : une roadmap publique signale que le projet est actif et orienté. Elle attire les bons contributeurs (ceux qui s'alignent sur la direction). En 0.x, la roadmap est le plan de travail §9 — inutile de la dupliquer publiquement pendant que l'architecture est instable.

**Référence spec** : `checkpoint-implementation.md` §9 — plan de travail 6 étapes comme roadmap interne de référence jusqu'à v1.0.

---

## Section 16 — Performance et coût

---

### Q16.1 — Quel est le coût en latence d'un hook (idéalement < 100 ms) ?

**Réponse** : Cible formelle : **p50 < 30 ms, p99 < 100 ms**. Seuil d'alerte : p50 > 50 ms, p99 > 150 ms.

**Justification** : `harness hook` est appelé à chaque outil utilisé par l'agent (PreToolUse). Sur une session intensive (100 appels d'outils), 100 ms de latence ajoutée par appel = 10 secondes de latence totale perceptible. 30 ms p50 est le budget confortable pour rester sous le seuil de perception.

**Référence spec** : `09-cli-commands-spec.md` §10 — tableau de performance : "Latence p50 < 30 ms, p99 < 100 ms, Mémoire RSS < 50 MB."

---

### Q16.2 — Comment optimiser le démarrage à froid du harness (chaque appel de hook ne doit pas relancer Node) ?

**Réponse** : Quatre stratégies combinées :
1. **Pré-compilation TypeScript → JS** : le binaire `harness` est du JS compilé (tsup ou esbuild), jamais `ts-node` en production.
2. **Pas de require dynamique dans le chemin chaud** : toutes les dépendances du path `harness hook` sont importées statiquement à l'entrée.
3. **Lecture `state.yaml` synchrone** : `fs.readFileSync` + parsing YAML synchrone sur un fichier ≤ 2 KB. Pas de promesses dans le chemin critique.
4. **Écriture `events.jsonl` async fire-and-forget** : `setImmediate` après l'émission de la décision — ne bloque pas stdout.

Il n'y a pas de daemon. Chaque invocation est un process Node.js frais — mais les 4 stratégies ci-dessus permettent de tenir 30 ms p50 sans daemon.

**Référence spec** : `09-cli-commands-spec.md` §5 — "Chemin critique (doit tenir <100 ms)" avec la liste exacte des 4 stratégies.

---

### Q16.3 — Le harness consomme-t-il des tokens LLM directement (pour ses propres décisions) ?

**Réponse** : **Non dans le chemin des hooks**. `harness hook <event>` est 100 % déterministe — logique pure sur `state.yaml` et le payload de l'événement, zéro appel LLM. Les décisions du harness (allow/block) ne consomment pas de tokens.

Les tokens LLM sont consommés uniquement par les **skills** (ex : `classify-risk` en mode interactif, `analyze-legacy`) et les **subagents** — ces invocations sont initiées par l'utilisateur ou l'agent, pas par le harness lui-même.

**Justification** : un hook qui consomme des tokens LLM introduirait une latence de 500 ms–2 s incompatible avec la cible < 100 ms, et un coût non borné par session. La classification de risque déterministe (Q16.3/Q16.4) couvre 90 % des cas sans LLM.

**Référence spec** : `09-cli-commands-spec.md` §5 — "Évaluation gates : logique pure, pas de I/O réseau."

---

### Q16.4 — Si oui, quel modèle pour quel besoin ?

**Réponse** : Hors chemin des hooks (voir Q16.3), les appels LLM des skills suivent cette matrice :

| Besoin | Modèle | Justification |
|--------|--------|---------------|
| Classification de risque (mode interactif, cas ambigus) | Haiku | Décision rapide, contexte court |
| Proposition de solution (skill `propose-change`) | Sonnet | Raisonnement moyen, qualité requise |
| Threat modeling, analyse legacy | Sonnet | Analyse structurée |
| Conception architecturale (skill complexe) | Opus | Profondeur requise |

**Référence spec** : règles de routing OMC (`CLAUDE-omc.md`) — "haiku (quick lookups), sonnet (standard), opus (architecture, deep analysis)."

---

### Q16.5 — Comment limiter le coût en tokens du harness lui-même (cap mensuel, alerte) ?

**Réponse** : Pas de cap automatique dans le MVP. La politique est : les skills qui consomment des tokens sont invoquées explicitement par l'utilisateur — le coût est visible et volontaire. D8 ("économie sur les tokens du planning") s'applique : l'agent n'écrit dans `.planning/` que ce qui est nécessaire à la prochaine décision.

Si un monitoring de coût est souhaité : `harness status --json` expose la session courante, et un script externe peut agréger les coûts via l'API Anthropic/OpenAI (hors scope harness).

**Justification** : le harness lui-même ne consomme pas de tokens (Q16.3). Les tokens sont consommés par l'agent IA hôte — surveiller cela depuis le harness serait une couche d'indirection inutile. D8 est la vraie politique de contrôle des coûts.

**Référence spec** : `checkpoint-implementation.md` §4 D8 — "l'agent écrit dans `.planning/` ce qui est nécessaire à la prochaine décision, pas ce qui serait théoriquement traçable."

---

### Q16.6 — Comment cacher les résultats (ex : classification de risque déjà calculée) ?

**Réponse** : La classification de risque est stockée dans `state.yaml` (`risk_class: F`). Elle n'est pas recalculée à chaque hook — elle est lue depuis `state.yaml` en mémoire. Le cache est donc `state.yaml` lui-même : si `risk_class` est non-null, pas de reclassification automatique.

`harness classify` est la seule commande qui recalcule et écrase `risk_class`. Elle est invoquée explicitement, pas automatiquement.

Pour les résultats de `harness classify --auto` (basé sur `git diff`), le résultat est écrit dans `state.yaml` immédiatement et réutilisé par tous les hooks suivants de la session.

**Référence spec** : `09-cli-commands-spec.md` §5 — "Charge `state.yaml` depuis le projet courant". §7 `harness classify` — résultat écrit dans `state.yaml`.

---

### Q16.7 — Le harness ralentit-il significativement la session par rapport à un usage natif ?

**Réponse** : Non, si les cibles de performance sont respectées (Q16.1). Calcul concret : session typique = 200 appels d'outils. Latence ajoutée : 200 × 30 ms = 6 secondes sur une session entière. Imperceptible à l'échelle d'une session de développement de 30–60 minutes.

La perception de lenteur apparaît uniquement si p99 dépasse 150 ms sur des sessions à haute fréquence d'outils (>500 appels). Dans ce cas, `harness doctor --verbose` expose les timings hook par hook pour diagnostiquer.

**Référence spec** : `09-cli-commands-spec.md` §10 — seuil d'alerte p99 > 150 ms.

---

### Q16.8 — Quelle empreinte mémoire en runtime ?

**Réponse** : Cible : **RSS < 50 MB**. Seuil d'alerte : RSS > 100 MB.

Chaque invocation de `harness hook` est un process Node.js éphémère — le RSS est mesuré à l'exécution d'un seul hook. Le process se termine après émission de la décision, la mémoire est libérée. Pas d'accumulation mémoire entre les invocations.

Le `state.yaml` (≤ 2 KB) + les gates en mémoire ne représentent pas de pression mémoire. Le risque principal est l'overhead du runtime Node.js lui-même (~20–30 MB de base). La cible < 50 MB est conservatrice et atteignable.

**Référence spec** : `09-cli-commands-spec.md` §10 — "Mémoire RSS < 50 MB, seuil d'alerte > 100 MB."

---

### Q16.9 — Quelle taille du package npm ?

**Réponse** : Cible : **< 5 MB** (package publié). Stratégies :
1. **tsup ou esbuild** pour la compilation — bundle tree-shaken, pas de sources TypeScript incluses dans le package publié.
2. **`.npmignore`** strict : exclure `tests/`, `artifacts/` (skills/subagents sont copiés à l'install, pas embarqués dans le bundle JS), sources TypeScript, fichiers de configuration de dev.
3. **Dépendances runtime minimales** : YAML parser (js-yaml ~100 KB), commander (~100 KB). Pas de dépendances lourdes dans le chemin chaud.
4. **Artifacts (skills, subagents, instructions)** : fichiers Markdown ≤ 500 KB total — inclus dans le package car nécessaires à `harness install`. Mais non inclus dans le bundle JS.

Un package npm de < 5 MB est raisonnable pour un CLI. `harness install --target claude` copie ensuite les artefacts vers `~/.claude/` — cette opération est locale, pas un re-téléchargement.

**Référence spec** : `checkpoint-implementation.md` §6 D16 — "un seul package `@harness/cli` qui contient tout (core + adapters + runtime + CLI)." §7.2 — `artifacts/` comme contenu portable distinct du code compilé.

---

*Document produit par l'agent general-purpose. Questions tranchées, décisions définitives. À déplacer section par section dans `docs/decisions/` au fur et à mesure que l'implémentation les confirme ou les infirme.*
