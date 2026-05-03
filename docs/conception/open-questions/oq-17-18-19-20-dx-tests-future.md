# Réponses aux questions ouvertes — Sections 17, 18, 19, 20

> **Statut** : tranché — réponses définitives, opiniâtres.
> **Source questions** : `docs/research-reports/openquestion.md` §17-20.
> **Refs** : `09-cli-commands-spec.md`, `10-core-api-spec.md`, `checkpoint-implementation.md`.
> **Date** : 2026-05-03.
> **Contexte auteur** : dev solo polymath, outil personnel à potentiel produit, risque dominant = procrastination architecturale.

---

## Section 17 — Expérience utilisateur (DX)

### Q17.1 — Comment annoncer le mode courant de manière non intrusive ?

**Réponse** : via `harness status` à la demande, jamais en push automatique. Pas de bannière au démarrage de session.

**Justification** : un affichage systématique à chaque action devient du bruit en 48h. Le mode est lisible dans `state.yaml` à tout moment. La plateforme affiche déjà son propre contexte — en rajouter crée de la compétition visuelle. L'intrusion est l'ennemi du flow.

**Référence spec** : `09-cli-commands-spec.md` §4 — `harness status` retourne `mode` dans le tableau principal. Flag `--json` pour les intégrations.

---

### Q17.2 — Comment l'utilisateur sait-il qu'un hook a été déclenché ?

**Réponse** : silencieux par défaut. Visible uniquement avec `--verbose` sur stderr. Les hooks ayant décidé `block` affichent un message structuré clair sur stderr — jamais silencieux sur un block.

**Justification** : `harness hook` est appelé à chaque outil utilisé par l'agent (potentiellement des centaines par session). Le moindre bruit sur allow transforme la DX en cauchemar. Le contrat est : silence = allow, message = block. C'est le même contrat que les linters et les pre-commit hooks.

**Référence spec** : `09-cli-commands-spec.md` §5 — "Logs sur stderr uniquement", format block avec `reason` + `hint`. La distinction `--verbose` est dans les flags globaux.

---

### Q17.3 — Comment réagit le harness en cas de désaccord humain-agent ?

**Réponse** : le harness bloque l'action et retourne un message avec code 2, un `reason` lisible et un `hint` actionnable. Il ne négocie pas, ne demande pas de confirmation — il bloque et donne la sortie de secours.

**Justification** : un système qui "demande si on est sûr" à chaque friction forme des habitudes de rubber-stamp. Un block dur avec hint clair (`run harness transition build` ou `run harness classify --manual`) est éducatif sans être paternaliste. L'humain garde le dernier mot via `--force` sur T/F, ou via `HUMAN_OVERRIDE` sur É/C.

**Référence spec** : `09-cli-commands-spec.md` — code de sortie `2` = "Gate bloquée". `10-core-api-spec.md` §9 `GateBlockedError` + `InvalidTransitionError` avec `reason` structuré.

---

### Q17.4 — Quelle est la commande d'aide ?

**Réponse** : `harness --help` (flag POSIX standard) + `harness <command> --help` pour chaque sous-commande. Pas de `harness help` (verbe séparé = doublon inutile).

**Justification** : cohérence avec l'écosystème npm/CLI (git, npm, pnpm utilisent tous `--help`). Pas de surface API supplémentaire. Le temps consacré à une commande `help` dédiée est mieux investi ailleurs.

**Référence spec** : `09-cli-commands-spec.md` flags globaux — pattern `--flag` uniforme dans tout le CLI.

---

### Q17.5 — Y a-t-il un tutoriel intégré `harness tour` ?

**Réponse** : non pour v1. `harness doctor` + un `README.md` clair suffisent.

**Justification** : `harness tour` est un investissement DX pour une audience large. Pour un outil solo à usage quotidien, la documentation statique et `harness doctor --fix` couvrent le besoin. Revenir sur cette décision quand un deuxième utilisateur existe. Ajouter `harness tour` prématurément est un classique de la procrastination sur le packaging.

**Référence spec** : `checkpoint-implementation.md` §1 — "risque dominant : procrastination architecturale".

---

### Q17.6 — Comment afficher les erreurs de manière compréhensible ?

**Réponse** : toutes les erreurs harness héritent de `HarnessError` avec un `code` machine-readable et un `message` humain. En CLI, affichage formaté : `[ERROR code] message\n  Context: key=value`. Stack trace uniquement avec `--verbose`. Jamais de stack raw par défaut.

**Justification** : une stack trace brute est utile aux développeurs du harness, pas aux utilisateurs. La hiérarchie d'erreurs est déjà formalisée — l'effort de formatage CLI est minimal.

**Référence spec** : `10-core-api-spec.md` §9 — `HarnessError`, `GateBlockedError`, `TerritoryViolationError`, etc. Tous ont `code` + `message` + `context`.

---

### Q17.7 — Y a-t-il un mode TUI interactif ?

**Réponse** : non. CLI pur, pas de TUI.

**Justification** : une TUI (Ink, Blessed, etc.) multiplie la complexité de maintenance, crée des incompatibilités terminal, et rend le CLI non-scriptable. L'utilisateur cible est un dev qui pipe des commandes et lit du JSON. `harness status --json | jq` est plus puissant que n'importe quelle TUI. Si la visualisation devient un besoin, la sortie JSON vers un dashboard externe (Grafana, Observable) est la bonne réponse.

**Référence spec** : `09-cli-commands-spec.md` — flag `--json` présent sur toutes les commandes pertinentes.

---

### Q17.8 — Comment consulter l'historique des décisions/actions ?

**Réponse** : `harness evidence show --run <id>` pour un run donné. Pour l'historique complet, lire `.planning/logs/events.jsonl` et `.planning/logs/state-transitions.jsonl` directement (JSONL + jq). Pas de commande `harness history` en v1.

**Justification** : JSONL + jq est plus flexible que tout format custom qu'on pourrait inventer. L'investissement dans une commande `history` se justifie quand les fichiers JSONL deviennent trop longs à parser à la main (>10 000 lignes). Ce n'est pas le cas pour un dev solo en v1.

**Référence spec** : `10-core-api-spec.md` §7 `queryEvents()` + `queryTransitions()` — la couche d'interrogation existe dans le core, exposable en CLI plus tard sans refactoring.

---

### Q17.9 — Y a-t-il des rappels automatiques (retro manquée, etc.) ?

**Réponse** : non en v1. Un signal dans `harness status` si la dernière transition date de plus de N jours, c'est tout.

**Justification** : les rappels push (notifications, cron) ajoutent un vecteur de configuration et de friction à l'installation. Pour un dev solo discipliné, un signal dans `harness status` — consulté naturellement en début de session — est suffisant. Le harness ne doit pas devenir un coach de vie.

**Référence spec** : `09-cli-commands-spec.md` §4 — `harness status` lit `state.yaml` y compris `updatedAt`.

---

### Q17.10 — Comment configurer la verbosité ?

**Réponse** : flag global `--verbose` pour détails sur stderr. Silencieux par défaut. Variable d'environnement `HARNESS_VERBOSE=1` pour persister sans flag. Pas de niveaux multiples (DEBUG/INFO/WARN) en v1 — c'est du sur-engineering.

**Justification** : trois niveaux de verbosité pour un outil personnel, c'est deux de trop. La distinction utile est : normal (résultat seulement) vs verbose (résultat + chemin pris + timings). Le reste se lit dans les JSONL.

**Référence spec** : `09-cli-commands-spec.md` — flags globaux : `--verbose`, `--json`, `--no-color`.

---

### Q17.11 — Faut-il un mode `--no-color` ?

**Réponse** : oui, flag global déjà présent. Également respecter la variable d'environnement `NO_COLOR` (standard de facto, https://no-color.org/).

**Justification** : coût d'implémentation quasi nul (une condition sur l'output), valeur réelle pour CI, pipes, terminaux dégradés. Ne pas le faire est du mépris pour l'outillabilité.

**Référence spec** : `09-cli-commands-spec.md` — `--no-color` listé dans les flags globaux.

---

### Q17.12 — Quelle langue pour le harness ?

**Réponse** : anglais partout dans le code, les messages CLI, les erreurs, les JSONL. Le README principal en anglais. Un `README.fr.md` optionnel pour la documentation narrative. Les artefacts portables (skills, subagents) peuvent être bilingues FR/EN dans les sections descriptives.

**Justification** : l'écosystème npm, les issues GitHub, les PR, les messages d'erreur — tout est en anglais. Un outil en français dans cet écosystème est exclu d'emblée des contributeurs potentiels et des outils de recherche. La friction de lire les messages en anglais pour un dev polyglotte est nulle. Le code en français c'est le piège du confort.

**Référence spec** : `10-core-api-spec.md` — tous les messages d'erreur sont en français dans le prototype, à corriger en anglais avant publication.

---

## Section 18 — Tests et qualité du harness

### Q18.1 — Quelle couverture de tests viser sur le `core` ?

**Réponse** : 90 % de couverture ligne sur `@harness/core`, avec 100 % obligatoire sur `state-machine/`, `risk-classifier/`, et `gates/`. Les modules `planning/` (I/O filesystem) et `logging/` (append-only) à 80 % suffisent.

**Justification** : `core` est le pivot critique. Une régression dans `classifyRisk()` ou `evaluateGate()` se propage silencieusement sur les 3 plateformes. 100 % sur le noyau logique pur (zéro I/O) est atteignable et se maintient. 90 % global est réaliste sans tester l'impossible (chemins d'erreur OS, race conditions filesystem). Viser 100 % global mène au testing de mocks, pas de comportements.

**Référence spec** : `10-core-api-spec.md` §1 — séparation nette entre modules purs (`state-machine`, `risk-classifier`, `gates`) et modules avec I/O (`planning`, `logging`).

---

### Q18.2 — Comment tester les adaptateurs plateforme ?

**Réponse** : mocks en tests unitaires. Un test d'intégration manuel documenté pour chaque plateforme, exécuté avant chaque release. Pas de CI automatisée contre les vraies plateformes en v1.

**Justification** : les vraies plateformes (Claude Code, Codex, Hermes) ne sont pas mockables de manière fiable en CI sans abonnements actifs et sans environnement stable. Les adapters sont des traducteurs thin (format JSON → format TOML, chemins de fichiers) — la logique est dans `core`. Tester l'I/O filesystem des adapters avec des vraies installations est un luxe pour v2+.

**Référence spec** : `10-core-api-spec.md` §8 `RuntimeAdapter` — interface contractuelle simple ; les adapters n'ont pas de logique métier propre.

---

### Q18.3 — Y a-t-il des tests end-to-end ?

**Réponse** : oui, mais uniquement pour Claude Code (plateforme prioritaire), et uniquement sous forme de smoke tests manuels documentés dans `tests/e2e/README.md`. Pas de E2E automatisés en v1.

**Justification** : un E2E automatisé contre Claude Code nécessite une vraie session agent, des tokens, et un environnement stable. Le ROI est négatif pour un dev solo. La discipline de "faire tourner le cycle de bout en bout avant chaque release" est suffisante et plus honnête que des E2E qui testent surtout les mocks.

**Référence spec** : `checkpoint-implementation.md` §9 Étape 2 — "Critère de sortie : on peut faire un cycle de bout en bout sur un projet jouet."

---

### Q18.4 — Comment tester les state machines ?

**Réponse** : tests de modèle (model-based testing) : décrire les transitions attendues comme données de test, vérifier que `transition()` produit le `TransitionResult` attendu pour chaque input. Pas besoin des outils xstate si on implémente `state-machine` en logique pure avec `transition()` fonctionnel.

**Justification** : `transition()` est déclaré comme déterministe dans la spec (`même snapshot + même événement → même résultat`). C'est testable en pure unit : table de transitions en données, un test par ligne. Si on adopte xstate, son `createActor` + `actor.getSnapshot()` couvrent le même besoin. L'important est la déterminisme, pas le framework.

**Référence spec** : `10-core-api-spec.md` §3 — "Déterministe : même snapshot + même événement → même résultat."

---

### Q18.5 — Comment tester les hooks en isolation ?

**Réponse** : `harness hook <event>` lit depuis stdin et écrit sur stdout — c'est testable sans aucun mock de plateforme. Tests unitaires : pipe JSON sur stdin, assert JSON sur stdout. Tests d'intégration : script shell qui enchaîne plusieurs hooks et vérifie l'état `.planning/`.

**Justification** : le design stdio de `harness hook` est délibérément testable (D14 — "simple à debug"). Le vrai test d'un hook est un `echo '...' | harness hook pre_tool_use` et vérifier le code de sortie + stdout. Pas besoin de Claude Code installé.

**Référence spec** : `09-cli-commands-spec.md` §5 — "Event JSON lu sur stdin. Décision JSON écrite sur stdout."

---

### Q18.6 — Stratégie de mutation testing pour les zones critiques ?

**Réponse** : mutation testing sur `risk-classifier/` et `state-machine/` uniquement, avec Stryker.js. Une passe avant chaque release majeure, pas en CI permanente.

**Justification** : le mutation testing est coûteux en temps CPU. Le cibler sur les 2 modules où une mutation silencieuse est catastrophique (mauvaise classification de risque, transition autorisée à tort) est la bonne proportion. En CI permanente c'est une taxe de build injustifiée pour un outil solo.

**Référence spec** : `10-core-api-spec.md` §4 `classifyRisk()` — "En cas d'ambiguïté, retourne la classe la plus haute (fail-safe)." C'est exactement le type de comportement que les mutations cherchent à invalider.

---

### Q18.7 — Property-based testing pour les fonctions critiques ?

**Réponse** : oui, sur `classifyRisk()` et `evaluateGate()`. Bibliothèque : fast-check. Propriétés à vérifier : monotonie de la classification (plus de signaux négatifs → classe ≥), idempotence des gates, pas de DONE_VERIFIED sans Evidence Set suffisant.

**Justification** : `classifyRisk()` a une sémantique monotone formalisée. Les propriétés sont naturellement exprimables. Fast-check + 500 runs couvre des combinaisons impossibles à écrire à la main. C'est l'un des rares cas où PBT a un ROI clairement positif sur un système de règles déterministe.

**Référence spec** : `10-core-api-spec.md` §4 — règles de `classifyRisk()` sont des implications logiques pures, idéales pour PBT.

---

### Q18.8 — Comment tester la portabilité (Linux/macOS/Windows) ?

**Réponse** : CI GitHub Actions sur les 3 runners (`ubuntu-latest`, `macos-latest`, `windows-latest`). Tests qui valident les chemins de fichiers, les séparateurs, et les opérations atomiques de write sur chaque OS. Aucune dépendance à bash dans `@harness/core` ou `@harness/cli`.

**Justification** : l'auteur est sur Windows (PowerShell). Claude Code tourne sur macOS/Linux en production principale. Les deux doivent fonctionner. La CI 3-OS est la seule garantie honnête — les "je pense que ça marche cross-platform" sont toujours faux.

**Référence spec** : `checkpoint-implementation.md` §7.3 — `@harness/core` est pur TypeScript sans dépendances OS. Les adapters gèrent les chemins spécifiques.

---

### Q18.9 — Stratégie de non-régression ?

**Réponse** : snapshot testing sur les sorties JSON de `harness status --json` et `harness hook` pour des scénarios canoniques. Tout changement de sortie est une régression explicite à confirmer. Les snapshots sont versionnés dans `tests/snapshots/`.

**Justification** : le contrat de sortie JSON est le contrat d'intégration avec les 3 plateformes. Une régression silencieuse sur ce format casse les hooks natifs sans erreur visible. Snapshot testing + review obligatoire du diff snapshot = filet de sécurité minimal et efficace.

**Référence spec** : `09-cli-commands-spec.md` — tous les formats JSON de sortie sont spécifiés. Ce sont les snapshots naturels.

---

### Q18.10 — Le harness est-il bootstrappable (développé en s'auto-utilisant) ?

**Réponse** : oui, dès l'Étape 2 (MVP Claude Code fonctionnel). Le repo `@harness/` doit lui-même avoir un `.planning/` valide. Le développement du harness passe par le harness. C'est un critère de qualité non négociable.

**Justification** : un système qu'on ne s'impose pas à soi-même est un système qu'on n'a pas vraiment testé. Le dogfooding révèle les frictions DX en 10 minutes que des semaines de tests ne trouvent pas. Toute décision "trop lourde pour nous-mêmes" est une décision à réviser.

**Référence spec** : `checkpoint-implementation.md` §9 Étape 2 — critère de sortie inclut un cycle de bout en bout. Ce cycle doit être dans le repo harness lui-même.

---

## Section 19 — Évolution future et compatibilité

### Q19.1 — Comment ajouter une nouvelle phase sans casser les projets existants ?

**Réponse** : SemVer strict. Une nouvelle phase = bump majeur. Migration automatique via `harness migrate` : détecte la version dans `state.yaml` (`version: "1"`) et applique la migration. Les projets sur ancienne version continuent de fonctionner jusqu'à `harness migrate` explicite.

**Justification** : `PlanningState.version` est dans le schéma pour exactement ce cas. Une phase supplémentaire change les transitions valides, les guards, les politiques — c'est une breaking change. Pas de migration silencieuse : l'utilisateur doit confirmer.

**Référence spec** : `10-core-api-spec.md` §6 `PlanningState` — champ `version: "1"` présent dès v1. `09-cli-commands-spec.md` §3 `harness init` — initialise avec version explicite.

---

### Q19.2 — Comment ajouter une nouvelle classe de risque sans casser les classifications passées ?

**Réponse** : ne pas le faire en v1 ou v2. La matrice T/F/M/É/C est suffisante. Si jamais nécessaire : nouvelle valeur dans le type union `RiskClass`, migration des logs JSONL via script, bump majeur. Les classifications passées gardent leur valeur historique — ne pas reclassifier rétroactivement.

**Justification** : cinq niveaux couvrent tous les cas réels identifiés. "É+" ou "F-" sont des projections théoriques sans base empirique. Ajouter une classe avant d'avoir eu des faux-positifs ou faux-négatifs documentés est de l'architecture prématurée.

**Référence spec** : `10-core-api-spec.md` §2.1 `RiskClass = "T" | "F" | "M" | "E" | "C"` — union fermée par design. Extensible sans effort quand le besoin est avéré.

---

### Q19.3 — Comment gérer l'évolution des standards (DORA 2027, ISO 25010 révision) ?

**Réponse** : les standards sont des références dans `docs/`, pas du code dur. Quand DORA 2027 sort, on met à jour les fichiers de référence et les métriques cibles dans `policies.yaml`. Pas de code à changer. Le harness est agnostique aux valeurs des métriques.

**Justification** : la bonne séparation est : le harness impose la *discipline* (mesurer, logger, gate), pas les *valeurs cibles* (4 deploys/semaine, MTTR < 1h). Ces valeurs sont dans la config du projet. Changer une cible DORA ne nécessite pas de bump de version.

**Référence spec** : `10-core-api-spec.md` §2.4 `PolicySet` — `testingThresholds` et `documentationRequirements` sont configurables par projet, pas hardcodés.

---

### Q19.4 — Le multi-état (cycles parallèles) — quand l'introduire ?

**Réponse** : pas avant d'avoir souffert de l'absence. Le signal concret est : "j'ai perdu du travail ou bloqué un cycle réel à cause du mono-état." Jusqu'à ce signal, le mono-état est la bonne décision (D7).

**Justification** : le multi-état est la feature la plus complexe architecturalement (state machine parallèle, conflits de locks sur `.planning/`, fusion de context). La valider théoriquement avant d'avoir eu la douleur pratique est exactement le type de sur-engineering que ce projet doit éviter. D7 dit "reporté" — il faut respecter cette décision.

**Référence spec** : `checkpoint-implementation.md` §4 D7 — "Limite reconnue : ne reflète pas la réalité du dev solo qui fait plusieurs choses en parallèle." La limite est reconnue, pas résolue.

---

### Q19.5 — Si Hermes abandonne, comment déprécier le support ?

**Réponse** : `@harness/adapter-hermes` passe en `deprecated` dans package.json. `harness install --target hermes` affiche un warning. Le code reste fonctionnel mais sans maintenance active. Annonce dans CHANGELOG. Suppression au prochain bump majeur si zéro usage.

**Justification** : les adapters sont des packages séparés — la dépréciation d'un adapter n'impacte pas `core` ni les autres adapters. C'est exactement pour ça que l'architecture est modulaire.

**Référence spec** : `checkpoint-implementation.md` §7.2 — packages `adapter-claude`, `adapter-codex`, `adapter-hermes` sont indépendants.

---

### Q19.6 — Comment intégrer de nouvelles primitives (ex : "memory" native) ?

**Réponse** : via un nouvel adapter ou une extension de `RuntimeCapabilitySet`. Si Claude Code ajoute une primitive "memory" native, `adapter-claude` l'expose dans `detectCapabilities()` et `getBindings()`. Le `core` ne change pas. Les skills peuvent en tirer parti si présent.

**Justification** : `RuntimeCapabilitySet` liste `availableHooks`, `availableSkills`, `availableMcpServers` — la liste est ouverte. Une nouvelle primitive ne casse rien : elle est détectée ou absente, jamais assumée.

**Référence spec** : `10-core-api-spec.md` §2.3 `RuntimeCapabilitySet` — `knownLimitations: string[]` et listes ouvertes.

---

### Q19.7 — Le harness pourrait-il devenir un standard de fait ?

**Réponse** : possiblement, mais ce n'est pas l'objectif v1 et ce ne doit pas être une motivation de conception. Les conditions seraient : adoption par >5 devs indépendants avec feedback public, stabilité de l'API sur 6+ mois, présence sur les 3 plateformes, documentation en anglais irréprochable. Aucune de ces conditions n'est remplie aujourd'hui.

**Justification** : concevoir pour "devenir un standard" avant d'être utile à un seul utilisateur réel est la définition de l'overdesign. MCP est devenu un standard parce qu'il résolvait un vrai problème simplement, pas parce qu'Anthropic l'a conçu pour être un standard.

**Référence spec** : `checkpoint-implementation.md` §1 — "outil personnel qui pourrait devenir un produit." Dans cet ordre.

---

### Q19.8 — Comment gérer l'évolution des modèles (GPT-6, Claude 5, etc.) ?

**Réponse** : le harness est model-agnostic. Il contrôle les *actions* de l'agent (quel fichier peut écrire, quelle phase), pas les *capacités* (quel modèle tourne). La seule interaction : si un modèle plus puissant respecte moins bien les instructions, les gates le détectent via `TerritoryViolationError`.

**Justification** : coupler le harness aux versions de modèle serait une erreur fondamentale. Le harness est un gardien d'état, pas un wrapper LLM. Les comportements des modèles sont la responsabilité des plateformes. Le harness observe les *effets* (actions tools) pas les *intentions* (sorties LLM).

**Référence spec** : `10-core-api-spec.md` §8 `RuntimeAdapter` — `runtimeId` identifie la plateforme, pas le modèle.

---

### Q19.9 — Le harness sera-t-il intégré nativement dans une plateforme ?

**Réponse** : c'est un scénario plausible pour Claude Code (Anthropic a tous les incentives à intégrer des systèmes de discipline de cycle dans son produit). La bonne réponse est : concevoir `@harness/core` comme une bibliothèque propre avec une API stable, de sorte qu'une intégration native soit un portage d'adapter, pas une réécriture.

**Justification** : l'architecture adapter pattern (`RuntimeAdapter` interface) rend ce scénario techniquement trivial. Anthropic n'a qu'à implémenter `RuntimeAdapter` en interne. Cette option a de la valeur même si elle ne se réalise jamais — elle prouve que le design est propre.

**Référence spec** : `10-core-api-spec.md` §8 — `RuntimeAdapter` est le seul contrat entre `core` et les plateformes.

---

### Q19.10 — Quelle est la durée de vie estimée du projet ?

**Réponse** : 3-5 ans d'utilisation active pour l'auteur. Obsolescence probable si les plateformes intègrent nativement des systèmes de cycle équivalents (ce qui arrivera). L'objectif n'est pas l'immortalité du code — c'est d'imposer une discipline pendant la fenêtre où les plateformes ne le font pas encore.

**Justification** : les bons outils ont une durée de vie limitée et honnête. Le harness résout un vide temporel — l'absence de discipline de cycle dans les agents IA actuels. Ce vide se comblera. Le bon scénario de fin est "remplacé par mieux intégré nativement", pas "abandonné faute d'usage."

**Référence spec** : `checkpoint-implementation.md` §3.1 — la liste des standards (DORA, ISO 25010, NIST SSDF) sont tous des référentiels actifs avec des cycles de révision. Le harness vit dans cet écosystème.

---

## Section 20 — Questions philosophiques et stratégiques

### Q20.1 — Le harness est-il un outil personnel ou un produit ?

**Réponse** : outil personnel d'abord, produit possible ensuite. Dans cet ordre strict. Jusqu'à ce qu'un deuxième utilisateur réel (non-auteur) l'utilise en production pendant 30 jours, traiter toute décision "produit" comme une distraction.

**Justification** : la distinction change tout l'arbitrage de priorité. Un outil personnel optimise pour l'auteur : installa rapide, comportement prédictible, documentation minimale, pas de rétrocompatibilité rigide. Un produit optimise pour des inconnus : onboarding, documentation exhaustive, compatibilité, feedback loops. Faire les deux en même temps garantit de mal faire les deux.

---

### Q20.2 — Si c'est un produit, quel marché cible ?

**Réponse** : devs solo et très petites équipes (1-3 personnes) utilisant au moins une des 3 plateformes agent IA. Pas les entreprises — les entreprises ont des processus existants et des budgets pour des outils commerciaux. La niche est exactement : dev solo polymathe qui veut la rigueur d'une équipe sans son overhead.

**Justification** : c'est le profil de l'auteur lui-même. Le meilleur marché initial est toujours celui qu'on incarne. Viser les équipes ou les entreprises nécessiterait RBAC, compliance, SSO, SLA — hors scope et hors vision.

---

### Q20.3 — Faut-il vraiment 3 plateformes pour un outil personnel ?

**Réponse** : non. Pour usage strictement personnel : Claude Code uniquement. Le portage vers Codex et Hermes se justifie si et seulement si l'auteur les utilise réellement et régulièrement. Chaque adapter non utilisé est de la dette de maintenance latente.

**Justification** : l'architecture permet le portage propre plus tard (adapter pattern). Il est infiniment plus sage de livrer un excellent adapter Claude Code que trois adapters moyens. La multi-plateforme est une feature de produit, pas une nécessité d'outil personnel.

---

### Q20.4 — La "bonne façon de développer" est-elle universelle ou personnelle ?

**Réponse** : les standards sont universels (DORA, ISO 25010, NIST SSDF) ; leur application est personnelle. Le harness codifie la couche universelle (quoi mesurer, quelles gates, quelle structure de fichiers) et laisse la couche personnelle configurable (seuils, modes par défaut, profondeur par classe). Ne pas confondre les deux niveaux.

**Justification** : un système qui prétend imposer une façon universelle de coder finit comme ESLint version initiale — rejeté car trop prescriptif. Un système qui fournit le cadre et laisse les valeurs configurables finit comme TypeScript — adopté parce qu'il ajoute de la rigueur sans dicter le style.

---

### Q20.5 — Quelle part de la valeur est dans le harness vs dans la discipline qu'il impose ?

**Réponse** : 80 % dans la discipline, 20 % dans le harness. Le harness vaut uniquement comme exosquelette pour rendre la discipline costless à maintenir. Un dev discipliné sans harness bat un dev indiscipliné avec harness. Le harness ne crée pas la discipline — il la rend durable sous la pression.

**Justification** : c'est le pattern de tous les bons outils de processus. Git ne crée pas la discipline de commit — il rend costless de l'avoir. Les linters ne créent pas le style — ils rendent costless de le maintenir. Le harness a exactement le même rôle pour le cycle de développement.

---

### Q20.6 — Le système gagne-t-il à être complet ou minimal et extensible ?

**Réponse** : minimal et extensible sans hésitation. Le MVP doit tenir en 5 commandes (`install`, `init`, `status`, `hook`, `transition`) et 3 modules core (`state-machine`, `risk-classifier`, `gates`). Tout le reste est une extension optionnelle.

**Justification** : la complétude est le chemin direct vers la non-livraison. Le risque dominant est la procrastination — et la complétude est la justification préférée de la procrastination. Un harness minimal utilisé chaque jour bat un harness complet jamais fini. La règle du rasoir d'Ockham appliquée au code : si ça peut vivre dans une extension, ça n'a pas sa place dans le core.

---

### Q20.7 — Quand arrêter d'ajouter des fonctionnalités et stabiliser ?

**Réponse** : quand le cycle de bout en bout (Discovery → Apprentissage) tourne sur un vrai projet pendant 4 semaines consécutives sans nécessiter de modification du harness. C'est le signal que le core est stable. Avant ce signal, tout ajout de feature est prématuré.

**Justification** : 4 semaines = approximativement 2 sprints = assez de cycles pour que les frictions réelles émergent. Moins que ça : trop court pour distinguer les bugs des lacunes de design. Plus que ça : risque d'ossification de patterns sous-optimaux.

---

### Q20.8 — Comment savoir si le système marche ?

**Réponse** : trois indicateurs concrets, dans l'ordre de valeur décroissante :
1. **Lead time personnel** : temps entre "idée" et "en production" pour une feature F. Doit diminuer ou rester stable malgré la complexité croissante du projet.
2. **Taux de régressions** : nombre de bugs introduits en production par sprint. Doit baisser.
3. **Friction subjective** : est-ce que le harness ralentit ou accélère ? Réponse honnête, pas défensive.

**Justification** : les DORA metrics sont des proxies pour la productivité. Pour un dev solo, le ressenti de friction est un signal au moins aussi fiable que les métriques. Un système qui améliore les métriques mais augmente la friction est un mauvais deal.

---

### Q20.9 — Quelle est la différence entre ce harness et un `CONTRIBUTING.md` bien tenu ?

**Réponse** : un `CONTRIBUTING.md` est consultatif. Le harness est exécutoire. Un `CONTRIBUTING.md` dit "tu devrais classifier le risque avant de coder." Le harness bloque l'écriture de code si la classification n'a pas eu lieu. La différence est la même qu'entre un panneau "ne pas entrer" et une serrure.

**Justification** : la discipline codifiée en texte s'effondre sous la pression (deadline, fatigue, "juste cette fois"). La discipline codifiée en code tient parce qu'elle est appliquée automatiquement. C'est le seul argument qui justifie la complexité du harness par rapport à un fichier Markdown.

---

### Q20.10 — Le harness reflète-t-il une vision mature ou idéalisée du dev ?

**Réponse** : les deux, dans des proportions déséquilibrées. La discipline de base (phases, risque, Evidence Set) est mature — issue de 10 sessions de réflexion sur des erreurs réelles. Les sections "standards" (DORA, ISO 25010, etc.) sont partiellement idéalisées — aucun dev solo ne les applique intégralement. La honnêteté exige de séparer le core (mature, déployable) des aspirations (inspirantes mais optionnelles).

**Justification** : la maturité d'une vision se teste en production, pas en réflexion. Le vrai test est : que reste-t-il après 3 mois d'usage réel ? Ce qui reste est la vision mature. Ce qu'on abandonne était idéalisé.

---

### Q20.11 — Peut-on imaginer le projet comme un échec utile ?

**Réponse** : oui, et c'est une frame saine. Si le harness n'est jamais utilisé en production ou abandonné après 2 mois, la valeur est dans la réflexion architecturale produite : le checkpoint, les specs de conception, la formalisation de la state machine. Ces artefacts sont réutilisables indépendamment du code.

**Justification** : "échec utile" n'est pas une consolation — c'est une vraie catégorie de projets qui valent leur investissement même sans livraison. La condition est : les artefacts de réflexion doivent être suffisamment autoportants pour être transmissibles. C'est le cas ici.

---

### Q20.12 — Comment éviter que le harness devienne un projet "infini" ?

**Réponse** : trois garde-fous concrets :
1. **Date limite MVP** : si le MVP Claude Code (Étape 2) n'est pas fonctionnel dans 4 semaines depuis le début de l'implémentation, le projet est déclaré sur-ingénié et on revient à une version plus simple.
2. **Règle de non-ajout** : aucune nouvelle feature ne rentre dans le backlog avant d'avoir utilisé la feature précédente pendant au moins une semaine.
3. **Commit publique** : publier sur GitHub avant d'être "prêt." L'exposition publique est le meilleur antidote au perfectionnisme.

**Justification** : le risque dominant est nommé dans le checkpoint lui-même. Nommer le risque n'est pas suffisant — il faut des mécanismes concrets. Ces trois mécanismes sont délibérément contraignants.

---

### Q20.13 — La complexité du système est-elle justifiée par la complexité du problème ?

**Réponse** : en partie. La complexité du problème (orchestrer un cycle de développement sur 3 plateformes, avec 5 classes de risque, 3 modes, 8 phases) est réelle. Mais la complexité actuelle du système (specs, schémas, types TS) dépasse ce qui est nécessaire pour démarrer. La règle : la complexité du core est justifiée. La complexité de la documentation de conception est de la procrastination architecturale.

**Justification** : il est possible de coder la state machine et le risk classifier en 2 jours si on arrête de les spécifier. La spécification exhaustive a de la valeur jusqu'à un certain point ; au-delà, elle substitue le confort intellectuel à l'exécution.

---

### Q20.14 — Y a-t-il un risque d'over-engineering propre au profil dev solo + agents IA ?

**Réponse** : oui, et c'est le risque le plus sous-estimé du profil. Les agents IA amplifient la capacité de spécification sans coût : produire 10 specs en une session est trivial avec Claude. Sans agents, la friction naturelle du travail manuel limitait la sur-spécification. Avec agents, cette friction disparaît. Le résultat est un système parfaitement spécifié qui n'existe que sur papier.

**Comment le détecter** : ratio `lignes de spec` / `lignes de code`. Si ce ratio dépasse 3:1 après 4 semaines de travail, le projet est en sur-spécification. Ce projet est actuellement dans cette zone.

**Comment en sortir** : fermer les éditeurs de doc et ouvrir l'éditeur de code. Immédiatement.

---

### Q20.15 — Le harness rend-il plus dépendant ou plus autonome ?

**Réponse** : plus autonome, à condition d'un design correct. Le test : si les agents IA disparaissaient demain, est-ce que la discipline (phases, risque, Evidence Set) resterait applicable manuellement ? Si oui, le harness est un amplificateur de discipline existante. Si non, c'est une prothèse.

**Justification** : les phases, la classification de risque, et l'Evidence Set sont toutes des pratiques applicables avec un fichier texte et de la volonté. Le harness les rend automatiques. La discipline reste après que l'outil disparaît — c'est la définition d'un bon outil de processus. Un outil qui capture la discipline dans son code uniquement, sans transférer la compréhension à l'utilisateur, est une prothèse. La documentation du harness doit être lisible comme un manuel de discipline, pas seulement comme une doc d'API.

---

## Résumé des décisions clés

| Section | Décision structurante |
|---------|----------------------|
| DX | CLI pur, pas de TUI. Silencieux = allow, message = block. Anglais partout. |
| DX | `--help` standard. Pas de `harness tour` en v1. Pas de rappels push. |
| Tests | 90 % core, 100 % sur state-machine + risk-classifier + gates. |
| Tests | Mocks pour adapters. Smoke tests manuels E2E. Stryker sur 2 modules critiques. |
| Tests | Fast-check PBT sur `classifyRisk()` + `evaluateGate()`. CI 3-OS. |
| Évolution | SemVer strict. `harness migrate` pour schéma. Pas de nouvelle classe de risque avant besoin avéré. |
| Évolution | Model-agnostic. Adapter pattern = dépréciation propre. Mono-état jusqu'à la douleur réelle. |
| Philosophie | Outil personnel d'abord. Minimal et extensible. MVP en 4 semaines ou révision. |
| Philosophie | 80 % valeur = discipline, 20 % = harness. La différence avec CONTRIBUTING.md = exécutoire vs consultatif. |
| Philosophie | Ratio spec/code > 3:1 = signal d'alarme over-engineering. Fermer les éditeurs de doc, ouvrir le code. |
