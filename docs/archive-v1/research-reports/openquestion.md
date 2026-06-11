# Open Questions — Phase Conception/Implémentation

> **Statut** : questions à trancher avant ou pendant l'implémentation.
> **Objet** : système de pilotage de cycle de développement par agent IA, distribué comme plugin TypeScript pour Claude Code, Codex, Hermes.
> **Format** : liste exhaustive, organisée par domaine. Pas de réponses imposées — chaque question a des pistes et des contraintes.
> **Date** : 2026-05-02.
> **Usage** : checklist à parcourir progressivement. Toutes ne se tranchent pas tout de suite. Certaines se tranchent par la pratique.

---

## Sommaire

1. State machine et phases
2. Classification de risque
3. Modes opératoires
4. Hooks et événements
5. Skills et subagents
6. MCP servers
7. Architecture du harness (TypeScript)
8. Distribution et installation
9. Gestion des fichiers `.planning/` et `docs/`
10. Logging, métriques, observabilité
11. Sécurité et permissions
12. Multi-plateforme (Claude Code / Codex / Hermes)
13. Cycle de vie d'un projet
14. Cycle de vie du harness lui-même
15. Cas limites et défaillances
16. Performance et coût
17. Expérience utilisateur (DX)
18. Tests et qualité du harness
19. Évolution future et compatibilité
20. Questions philosophiques et stratégiques

---

## 1. State machine et phases

**Q1.1** — Quel framework de state machine en TypeScript ? xstate, robot, ou implémentation maison ?

**Q1.2** — Les 8 phases (Discovery → Apprentissage) sont-elles toutes des états distincts dans la state machine, ou certaines sont-elles regroupées ?

**Q1.3** — Quels sont les états transitoires (en cours de transition, en attente de validation humaine) vs les états stables ?

**Q1.4** — Comment représenter les phases concurrentes (mono-état strict actuel vs multi-états futur) dans la state machine ? Le passage de l'un à l'autre va-t-il casser la persistence des sessions en cours ?

**Q1.5** — Les transitions sont-elles toujours initiées par l'humain, ou certaines peuvent-elles être déclenchées automatiquement (ex : passer de Build à Validation quand toutes les PR sont mergées) ?

**Q1.6** — Quelles sont les **guards** (conditions de transition) précises pour chaque transition ? Sont-elles formellement définies ou laissées à l'appréciation de l'agent ?

**Q1.7** — Que se passe-t-il si une transition échoue (guard non satisfait) ? On reste dans l'état courant, on retourne en arrière, on bloque l'agent ?

**Q1.8** — Comment gérer les rollbacks de phase (revenir de Build à Conception parce qu'on s'est trompé) ?

**Q1.9** — La phase Run est continue par nature. Comment la modélise-t-on dans une state machine ? Sous-état permanent ? État parallèle ?

**Q1.10** — Comment le harness gère-t-il une interruption (`Ctrl+C`, crash) en milieu de phase ? Reprend-il automatiquement, ou demande-t-il confirmation à l'utilisateur ?

**Q1.11** — Y a-t-il un état "frozen" (gel volontaire) ou "incident" (gel d'urgence) qui bypass les règles normales ?

**Q1.12** — Comment représenter le sous-cycle à 7 étapes (Observer → Transmettre) dans la state machine globale ? Sub-state machine imbriquée ?

---

## 2. Classification de risque

**Q2.1** — Qui propose la classe de risque initiale : l'humain, l'agent IA, un script déterministe ?

**Q2.2** — Si c'est l'agent IA, comment éviter le biais d'optimisme (sous-estimer la classe pour aller plus vite) ?

**Q2.3** — Quels sont les critères mécaniques de classification ? Liste exhaustive d'indicateurs (touche `auth.ts` → É minimum, etc.) ?

**Q2.4** — La classification est-elle binaire (cette feature est É) ou par dimension (impact utilisateur = 4, exposition sécurité = 5, complexité = 3, etc.) ?

**Q2.5** — Comment combiner les dimensions pour produire une classe finale ? Max, somme pondérée, règle métier ?

**Q2.6** — Quels sont les **fichiers ou dossiers sentinelles** dont la modification déclenche une classe minimale ? Liste à formaliser.

**Q2.7** — Comment le harness détecte-t-il qu'un fichier sensible va être touché ? Hook `PreToolUse` qui parse le `tool_input` ?

**Q2.8** — Comment gérer les **classifications fausses** (l'agent dit F, c'est en fait É) ? Mécanisme de promotion en cours de cycle.

**Q2.9** — La promotion est-elle réversible ? Peut-on rétrograder une classe ?

**Q2.10** — Doit-on logger toutes les classifications, même les fausses, pour apprendre ?

**Q2.11** — La classe de risque est-elle figée pour une story, ou peut-elle évoluer entre les phases (ex : classée F en Discovery, promue M en Build) ?

**Q2.12** — Faut-il des classes intermédiaires (T+, F-, M+, etc.) ou la matrice à 5 niveaux est-elle suffisante ?

**Q2.13** — Comment classifier les changements transverses (ex : refactor qui touche 50 fichiers de gravité hétérogène) ?

**Q2.14** — La classe doit-elle être stockée par story (PBI) ou par PR ? Et si une PR couvre plusieurs stories ?

**Q2.15** — Comment la classification interagit-elle avec les classes de stories (feature/bug/refactor/spike) ?

---

## 3. Modes opératoires

**Q3.1** — Le mode (pairing/auto-décision/bypass) est-il défini globalement par projet, par session, ou par story ?

**Q3.2** — Comment l'humain change-t-il de mode en cours de session ? Commande explicite (`harness mode set pairing`) ou détection automatique ?

**Q3.3** — Les modes interagissent-ils avec les classes de risque ? Peut-on être en bypass sur une classe É (réponse : non, déjà décidé), mais peut-on être en pairing sur du T (overkill) ?

**Q3.4** — Le harness force-t-il un mode minimum selon la classe (ex : É force pairing ou auto-décision) ou conseille-t-il seulement ?

**Q3.5** — Comment garantir la "qualité" du mode auto-décision ? Format de proposition imposé ?

**Q3.6** — Le quota de rejets (≥ 20 %) est-il mesuré par le harness, et que se passe-t-il si on tombe en dessous ? Alerte ? Forçage en pairing ?

**Q3.7** — L'audit aléatoire hebdomadaire est-il automatisé (le harness sélectionne et présente) ou laissé à la discipline humaine ?

**Q3.8** — En mode bypass, comment l'humain est-il informé a posteriori des décisions prises ? Rapport quotidien ?

**Q3.9** — Y a-t-il un mode "shadow" (l'agent fait, mais sans appliquer, juste pour rapport) entre le pairing et le bypass ?

**Q3.10** — Comment le mode courant interagit-il avec les autres outils (ex : un commit en mode bypass est-il marqué différemment dans Git) ?

**Q3.11** — Peut-on mélanger les modes au sein d'un même cycle (ex : auto-décision pour le code, pairing pour la conception architecturale) ?

**Q3.12** — Comment s'assurer que l'agent IA "sait" dans quel mode il opère ? Variable d'environnement, prompt dynamique, skill spécifique ?

---

## 4. Hooks et événements

**Q4.1** — Liste exhaustive des hooks **canoniques** que le harness expose. À figer avant l'implémentation.

**Q4.2** — Pour chaque hook canonique, quelle est sa **signature** (input attendu, output attendu) ?

**Q4.3** — Comment gérer les hooks que Claude Code expose mais pas Codex/Hermes (ex : `SubagentStart`, `PreCompact`) ? Désactivés silencieusement, ou erreur explicite ?

**Q4.4** — Les hooks sont-ils synchrones ou asynchrones ? Si async, comment l'agent attend-il la réponse ?

**Q4.5** — Quel est le timeout d'un hook ? Que faire si on dépasse (laisser passer, bloquer, demander à l'humain) ?

**Q4.6** — Les hooks peuvent-ils **modifier** le contexte (injecter du texte) ou seulement bloquer/autoriser ?

**Q4.7** — Les hooks Hermes (gateway/plugin/shell) — lesquels utilise-t-on ? Tous ? Un seul ?

**Q4.8** — Comment authentifier les appels de hooks (s'assurer que c'est bien la plateforme qui appelle, pas un script malveillant) ?

**Q4.9** — Les hooks doivent-ils logger systématiquement leurs entrées/sorties dans `.planning/logs/` ?

**Q4.10** — Quelle granularité de hooks ? Un hook par événement, ou un méga-hook qui dispatche en interne ?

**Q4.11** — Comment versionner les hooks ? Si on change la signature d'un hook entre v1 et v2 du harness, comment migrer ?

**Q4.12** — Les hooks doivent-ils être **idempotents** (rejouables sans effet de bord) ?

**Q4.13** — Comment tester les hooks en isolation (sans lancer une vraie plateforme) ?

**Q4.14** — Existe-t-il des hooks "compound" (déclenchés par plusieurs événements) ?

---

## 5. Skills et subagents

**Q5.1** — Liste exhaustive des skills à fournir par défaut. Au minimum : classify-risk, propose-change, transition-phase, run-postmortem, run-retrospective. Quoi d'autre ?

**Q5.2** — Les skills sont-elles tournées **vers l'utilisateur** (slash commands) ou **vers l'agent** (chargées automatiquement par description) ?

**Q5.3** — Comment éviter la collision entre nos skills et les skills déjà installées par l'utilisateur ?

**Q5.4** — Les skills sont-elles versionnées séparément ou ensemble avec le harness ?

**Q5.5** — Liste exhaustive des subagents à fournir. Au minimum : reviewer, threat-modeler, accessibility-auditor, performance-analyst. Quoi d'autre ?

**Q5.6** — Les subagents sont-ils **spawnés explicitement** (l'utilisateur ou l'agent principal demande) ou **automatiquement** sur certains événements (ex : reviewer auto-spawné sur PR ouverte) ?

**Q5.7** — Les subagents ont-ils accès à `.planning/` ? En lecture, en écriture ?

**Q5.8** — Le mode de l'agent principal s'applique-t-il aussi aux subagents ?

**Q5.9** — Comment contraindre les subagents à respecter la classe de risque ?

**Q5.10** — Les subagents peuvent-ils déclencher des hooks ?

**Q5.11** — Y a-t-il une notion de "subagent persistant" (qui survit entre sessions) ou tous sont-ils éphémères ?

**Q5.12** — Comment partager du contexte entre subagents sans tout dupliquer (ex : threat model produit par threat-modeler doit être lu par reviewer) ?

---

## 6. MCP servers

**Q6.1** — Le harness expose-t-il **lui-même** un MCP server (ex : pour exposer des outils `harness:transition_phase`, `harness:classify_risk`, etc.) ?

**Q6.2** — Si oui, quel transport (stdio ou HTTP) ? Quelle authentification ?

**Q6.3** — Les outils MCP exposés sont-ils accessibles sur les 3 plateformes de la même manière ?

**Q6.4** — Comment configurer les MCP servers tiers (GitHub, Slack, etc.) de manière portable entre les 3 plateformes ?

**Q6.5** — Le harness doit-il **proxifier** certains MCP servers (intercepter pour appliquer la classe de risque) ou les exposer directement ?

**Q6.6** — Comment gérer les MCP servers qui exigent OAuth (login interactif) en mode auto-décision ou bypass ?

**Q6.7** — Comment versionner la configuration MCP (changer un endpoint) sans casser les sessions actives ?

**Q6.8** — Le harness fournit-il une CLI `harness mcp test` pour vérifier qu'un MCP server est bien configuré ?

---

## 7. Architecture du harness (TypeScript)

**Q7.1** — Build tool : `tsc`, `tsup`, `bun`, `esbuild` ? Critères : vitesse, single-binary, compatibilité Node.

**Q7.2** — Cible runtime : Node.js (quelle version min ?) ou Bun ou Deno ? Implications sur la portabilité.

**Q7.3** — Monorepo manager : pnpm workspaces, Turborepo, Nx, Lerna ?

**Q7.4** — Tests : Jest, Vitest, node:test ?

**Q7.5** — Linter : ESLint + Prettier, Biome ?

**Q7.6** — Logging : pino, winston, console + écriture manuelle ?

**Q7.7** — CLI framework : commander, oclif, citty, yargs ?

**Q7.8** — Validation des données (YAML, JSON) : zod, ajv, yup ?

**Q7.9** — Quelle stratégie de gestion des erreurs ? Result types (neverthrow), exceptions classiques, mix ?

**Q7.10** — Comment gérer les configurations utilisateur ? Cosmiconfig, dotenv, format custom ?

**Q7.11** — Le code source du harness suit-il **lui-même** la pipeline qu'il impose (dogfooding) ? À quelle profondeur ?

**Q7.12** — Y a-t-il un mode "debug" qui affiche tous les hooks en clair, pour développer le harness ?

**Q7.13** — Comment versionner le format des fichiers `.planning/` ? Si un fichier change de schéma entre v1 et v2 du harness, comment migrer ?

**Q7.14** — Le harness est-il monolithique (un seul binaire) ou modulaire (plusieurs sous-commandes en sous-binaires) ?

**Q7.15** — Quelle stratégie de release ? GitHub Releases + npm publish, ou pipeline custom ?

---

## 8. Distribution et installation

**Q8.1** — `npm install -g @harness/cli` est la cible. Mais quid des utilisateurs sous Windows sans WSL ?

**Q8.2** — Le harness fonctionne-t-il sous Windows natif, ou seulement sous WSL2 / macOS / Linux ?

**Q8.3** — Comment gérer les chemins de fichiers cross-platform (`~`, `\\` vs `/`, etc.) ?

**Q8.4** — `harness install --target claude` doit-il être idempotent (relancer ne casse rien) ?

**Q8.5** — Comment désinstaller proprement (`harness uninstall`) ? Restaurer les hooks/configs précédents ?

**Q8.6** — Que se passe-t-il si l'utilisateur a déjà des hooks installés sur Claude Code/Codex/Hermes ? Merge, écrasement, refus ?

**Q8.7** — Comment détecter automatiquement quelle plateforme est installée et configurée ?

**Q8.8** — Y a-t-il une commande `harness install --target all` qui installe sur les 3 plateformes en même temps ?

**Q8.9** — Comment gérer les mises à jour du harness ? `harness update`, `npm update -g`, auto-update ?

**Q8.10** — Comment communiquer une **breaking change** à l'utilisateur (ex : nouvelle structure `.planning/` requise) ?

**Q8.11** — Le harness gère-t-il plusieurs versions installées simultanément (ex : v1 sur projet A, v2 sur projet B) ?

**Q8.12** — Faut-il publier sur npm uniquement, ou aussi sur Homebrew, Scoop, AUR ?

**Q8.13** — Comment signer les releases (Sigstore, GPG) pour la supply chain security ?

---

## 9. Gestion des fichiers `.planning/` et `docs/`

**Q9.1** — `harness init` produit quoi exactement ? Squelette minimal ou complet ?

**Q9.2** — Les templates de fichiers (PBI, RISK, ADR) sont-ils dans le harness ou dans `.planning/_templates/` du projet ?

**Q9.3** — Comment l'utilisateur surcharge-t-il un template par défaut sans forker le harness ?

**Q9.4** — Le harness modifie-t-il **directement** les fichiers `.planning/`, ou propose-t-il des modifications via PR/diff ?

**Q9.5** — Comment éviter les conflits Git si l'humain modifie un fichier en même temps que l'agent ?

**Q9.6** — Les fichiers de l'agent (`registry/state/dashboard.md` régénéré) sont-ils committés dans Git ou ignorés ?

**Q9.7** — Faut-il un `.harnessignore` pour exclure certains chemins du contrôle ?

**Q9.8** — Comment valider la cohérence de `.planning/` (référence à PBI inexistant, statut incohérent) ? Commande `harness check` ?

**Q9.9** — `harness check` est-il bloquant en CI, ou seulement informatif ?

**Q9.10** — Comment le harness gère-t-il un projet où `.planning/` n'existe pas ? Refuse, propose `init`, agit en mode dégradé ?

**Q9.11** — Comment migrer un projet d'une ancienne version du schéma vers la nouvelle ? Commande `harness migrate` ?

**Q9.12** — Le harness lit-il `docs/` ou seulement `.planning/` ? Si oui, à quelles fins (vérifier la cohérence) ?

**Q9.13** — Comment gérer les très gros backlogs (1000+ PBI) ? Performance de lecture/parsing.

**Q9.14** — Faut-il un index machine-readable global (`.planning/index.json` régénéré) pour accélérer les requêtes ?

**Q9.15** — Comment archiver les anciens sprints/releases tout en gardant la mémoire active accessible ?

---

## 10. Logging, métriques, observabilité

**Q10.1** — Quels événements sont systématiquement loggés (par catégorie : décisions, transitions, hooks, MCP calls, etc.) ?

**Q10.2** — Format des logs : JSONL strict, JSON pretty, format custom ?

**Q10.3** — Politique de rotation des logs (`logs/*.jsonl` peut grossir indéfiniment) ?

**Q10.4** — Faut-il un niveau de log configurable (DEBUG, INFO, WARN, ERROR) ?

**Q10.5** — Les logs contiennent-ils des données sensibles (tokens, secrets, contenu utilisateur) ? Stratégie de redaction.

**Q10.6** — Le harness exporte-t-il en OpenTelemetry (comme Claude Code) ?

**Q10.7** — Quelles métriques DORA sont automatiquement calculées par le harness vs manuellement renseignées ?

**Q10.8** — Le harness expose-t-il un dashboard (CLI ou web) ? Ou juste des fichiers à lire ?

**Q10.9** — Faut-il un `harness status` qui résume l'état courant (phase, mode, classe, dernière action) ?

**Q10.10** — Comment l'utilisateur visualise-t-il les métriques dans le temps (séries temporelles) ? CLI graphique, export vers Grafana ?

**Q10.11** — Les logs et métriques sont-ils committés dans Git ou exclus ?

**Q10.12** — Comment partager des métriques entre projets (vue agrégée multi-projets) ?

---

## 11. Sécurité et permissions

**Q11.1** — Le harness lui-même peut-il être un vecteur d'attaque (un mauvais hook qui exfiltre `.planning/`) ?

**Q11.2** — Comment auditer les hooks installés par le harness pour vérifier qu'ils ne font que ce qu'ils doivent ?

**Q11.3** — Le harness peut-il être désactivé localement (`harness off`) sans tout désinstaller ?

**Q11.4** — Quels sont les chemins **non éditables par l'agent**, garantis par le harness ? `.git/`, `~/.ssh/`, secrets, autres ?

**Q11.5** — Comment gérer les secrets (clés API, tokens) qui transitent par les hooks ? Ne jamais logger ?

**Q11.6** — Le harness vérifie-t-il les signatures des artefacts (skills, subagents) avant installation ?

**Q11.7** — Y a-t-il une **liste de permissions explicites** par mode (en bypass, l'agent peut écrire dans `src/` mais jamais dans `infra/`) ?

**Q11.8** — Comment gérer les CVE qui apparaîtraient dans les dépendances du harness lui-même ?

**Q11.9** — Le harness expose-t-il une commande `harness audit` qui scanne le projet pour les violations de politique ?

**Q11.10** — Comment gérer la conformité RGPD pour les données traversant le harness (logs avec PII) ?

**Q11.11** — Quelle politique de "secrets in git" ? Est-ce que le harness scanne et bloque ?

---

## 12. Multi-plateforme (Claude Code / Codex / Hermes)

**Q12.1** — Y a-t-il un risque que les 3 plateformes divergent significativement dans leur évolution, rendant l'abstraction de plus en plus coûteuse ?

**Q12.2** — Comment détecter automatiquement quelle plateforme tourne dans la session courante ?

**Q12.3** — Peut-on basculer de plateforme en cours de projet (commencer sur Claude Code, finir sur Codex) sans perdre l'état ?

**Q12.4** — Les 3 plateformes utilisent-elles les mêmes modèles ? Si non, comment gérer un projet entamé sur GPT-5.5 et continué sur Claude Sonnet 4.6 ?

**Q12.5** — Comment tester le harness sur les 3 plateformes en CI sans avoir 3 abonnements ?

**Q12.6** — Quelle plateforme est **prioritaire** pour les nouvelles fonctionnalités ? Claude Code (la plus complète), ou maintenir parité stricte ?

**Q12.7** — Faut-il une **matrice de compatibilité** documentée (quelle fonctionnalité du harness marche sur quelle plateforme) ?

**Q12.8** — Si Hermes ajoute une nouvelle catégorie de hooks, comment l'intégrer sans casser Claude Code et Codex ?

**Q12.9** — Comment gérer les plateformes propriétaires vs open source (Hermes est MIT, Claude Code et Codex non) ?

**Q12.10** — Y a-t-il d'autres plateformes à supporter à terme (Cursor, Continue.dev, Aider) ?

---

## 13. Cycle de vie d'un projet

**Q13.1** — Comment archiver un projet terminé ? Le harness fournit-il `harness archive` ?

**Q13.2** — Comment **forker** un projet (créer une variante) sans dupliquer tout l'historique `.planning/` ?

**Q13.3** — Comment **fusionner** deux projets en un seul ?

**Q13.4** — Comment **importer** un projet existant (sans `.planning/` initial) dans le système ?

**Q13.5** — Le harness peut-il analyser un projet legacy et **proposer** une structure `.planning/` initiale ?

**Q13.6** — Quelle est la durée de rétention par défaut des données dans `.planning/timeline/` ?

**Q13.7** — Comment exporter un projet vers un format portable (audit externe, transmission) ?

---

## 14. Cycle de vie du harness lui-même

**Q14.1** — Le harness suit-il sa propre pipeline (méta) ? Comment ?

**Q14.2** — Quelle est la cadence de release prévue (mensuelle, à la demande) ?

**Q14.3** — Comment versionner ? SemVer strict ?

**Q14.4** — Les breaking changes sont-elles annoncées combien de temps à l'avance ?

**Q14.5** — Y a-t-il une stratégie de LTS (Long Term Support) pour les versions majeures ?

**Q14.6** — Comment recueillir le feedback des utilisateurs (toi-même, futurs collaborateurs, communauté) ?

**Q14.7** — Le harness est-il publié en open source ? Si oui, quelle licence (MIT, Apache, GPL) ?

**Q14.8** — Stratégie de contribution externe : ouverte, fermée, restreinte aux trusted ?

**Q14.9** — Comment gérer les forks (le harness étant solo + agents IA, est-ce un produit ou un outil personnel) ?

**Q14.10** — Y a-t-il une roadmap publique ?

---

## 15. Cas limites et défaillances

**Q15.1** — Que fait le harness si `.planning/` est corrompu (YAML invalide) ?

**Q15.2** — Que fait le harness si la plateforme cible ne répond plus ?

**Q15.3** — Que fait le harness si un hook plante (exception non gérée) ?

**Q15.4** — Que fait le harness en cas de coupure réseau (impact sur les MCP servers, l'API LLM) ?

**Q15.5** — Comment gérer les **deadlocks** (un hook attend une décision humaine, l'humain n'est pas là) ?

**Q15.6** — Comment gérer les **race conditions** (deux hooks qui modifient le même fichier en même temps) ?

**Q15.7** — Quelle stratégie de retry pour les opérations idempotentes ?

**Q15.8** — Comment gérer un disque plein (`.planning/logs/` sature) ?

**Q15.9** — Que se passe-t-il si l'utilisateur supprime manuellement un fichier critique (`.planning/state/state.yaml`) ?

**Q15.10** — Comment **récupérer** d'un état incohérent ? `harness recover` ?

**Q15.11** — Comment gérer les conflits Git sur les fichiers générés par l'agent ?

**Q15.12** — Comment éviter qu'un mauvais hook bloque indéfiniment l'agent (livelock) ?

**Q15.13** — Que faire si la classe de risque est ambiguë et l'agent ne peut pas trancher ?

**Q15.14** — Comment gérer une plateforme qui change ses formats de hooks sans préavis (breaking change upstream) ?

---

## 16. Performance et coût

**Q16.1** — Quel est le coût en latence d'un hook (idéalement < 100ms) ?

**Q16.2** — Comment optimiser le démarrage à froid du harness (chaque appel de hook ne doit pas relancer Node) ?

**Q16.3** — Le harness consomme-t-il des tokens LLM directement (pour ses propres décisions) ?

**Q16.4** — Si oui, quel modèle pour quel besoin (classification de risque vs proposition de solution) ?

**Q16.5** — Comment limiter le coût en tokens du harness lui-même (cap mensuel, alerte) ?

**Q16.6** — Comment cacher les résultats (ex : classification de risque déjà calculée) ?

**Q16.7** — Le harness ralentit-il significativement la session par rapport à un usage natif de Claude Code/Codex/Hermes ?

**Q16.8** — Quelle empreinte mémoire en runtime ?

**Q16.9** — Quelle taille du package npm ?

---

## 17. Expérience utilisateur (DX)

**Q17.1** — Comment annoncer le mode courant à l'utilisateur de manière non intrusive ?

**Q17.2** — Comment l'utilisateur sait-il qu'un hook a été déclenché (logs visibles, notification, silencieux) ?

**Q17.3** — Comment réagit le harness en cas de désaccord humain-agent (l'humain veut faire X, le harness refuse) ?

**Q17.4** — Quelle est la commande d'aide (`harness help` ? `harness --help`) ?

**Q17.5** — Y a-t-il un tutoriel intégré (`harness tour`) pour les nouveaux utilisateurs ?

**Q17.6** — Comment afficher les erreurs de manière compréhensible (sans dumps stack trace bruts) ?

**Q17.7** — Y a-t-il un **mode interactif** (TUI) pour piloter le harness, ou tout passe par CLI ?

**Q17.8** — Comment l'utilisateur consulte-t-il l'historique de ses décisions/actions ?

**Q17.9** — Y a-t-il des **rappels** automatiques (ex : "tu n'as pas fait de retro depuis 3 sprints") ?

**Q17.10** — Comment configurer le niveau de verbosité (silencieux par défaut, verbeux sur demande) ?

**Q17.11** — Faut-il un mode "no-color" pour les terminaux qui ne supportent pas ?

**Q17.12** — Comment localiser le harness (français, anglais, autre) ? Toi tu écris en français, mais l'écosystème est anglais.

---

## 18. Tests et qualité du harness

**Q18.1** — Quelle couverture de tests viser sur le `core` (pivot critique) ? 70 %, 90 %, 100 % ?

**Q18.2** — Comment tester les adaptateurs (qui dépendent des plateformes externes) ? Mocks, sandbox, intégration réelle ?

**Q18.3** — Y a-t-il des **tests end-to-end** (lancer Claude Code avec le harness, vérifier le comportement) ?

**Q18.4** — Comment tester les state machines (xstate fournit des outils, lesquels utiliser) ?

**Q18.5** — Comment tester les hooks (en isolation et en intégration) ?

**Q18.6** — Stratégie de mutation testing pour les zones critiques (state machine, classification) ?

**Q18.7** — Property-based testing pour les fonctions critiques (parsing YAML, hash de classification) ?

**Q18.8** — Comment tester la portabilité (CI sur Linux/macOS/Windows) ?

**Q18.9** — Quelle stratégie pour les régressions (un sprint produit un bug, comment garantir qu'il ne revient pas) ?

**Q18.10** — Le harness est-il "bootstrappable" (peut-on le développer en s'auto-utilisant) ?

---

## 19. Évolution future et compatibilité

**Q19.1** — Comment ajouter une **nouvelle phase** dans la pipeline sans casser les projets existants ?

**Q19.2** — Comment ajouter une **nouvelle classe de risque** (ex : entre M et É) sans casser les classifications passées ?

**Q19.3** — Comment évolueront les standards (DORA 2027 changera, ISO 25010 sera révisée) ? Stratégie de mise à jour.

**Q19.4** — Le multi-état (multi-cycles parallèles) — quand l'introduire, et comment garder la rétrocompatibilité ?

**Q19.5** — Si une plateforme (ex : Hermes) abandonne, comment "déprécier" le support sans casser les utilisateurs ?

**Q19.6** — Comment intégrer de nouvelles primitives qui apparaîtraient (ex : "memory" comme primitive de premier ordre) ?

**Q19.7** — Le harness pourrait-il un jour devenir un **standard de fait** (comme MCP) ? À quelles conditions ?

**Q19.8** — Comment gérer l'évolution des modèles (GPT-5.5 → GPT-6, Claude Opus 4.7 → 5.0) ?

**Q19.9** — Le harness sera-t-il un jour intégré nativement dans une plateforme (acquisition, fork) ?

**Q19.10** — Quelle est la durée de vie estimée du projet ?

---

## 20. Questions philosophiques et stratégiques

**Q20.1** — Le harness est-il un **outil personnel** (pour toi) ou un **produit** (à diffuser) ? La réponse change tout.

**Q20.2** — Si c'est un produit, quel est le marché cible ? Devs solo, équipes, entreprises ?

**Q20.3** — Si c'est un outil personnel, faut-il vraiment tout porter sur 3 plateformes, ou se concentrer sur celle qu'on utilise vraiment ?

**Q20.4** — Le système prétend codifier "la bonne façon de développer". À quel point cette bonne façon est-elle universelle vs personnelle ?

**Q20.5** — Quelle part de la valeur est dans le **harness lui-même** vs dans la **discipline qu'il impose** ?

**Q20.6** — Le système gagne-t-il à être complet, ou serait-il plus utile en étant minimal et extensible ?

**Q20.7** — À quel moment on **arrête** d'ajouter des fonctionnalités et on **stabilise** ?

**Q20.8** — Comment savoir si le système marche ? Quels indicateurs (DORA personnel, satisfaction, productivité subjective) ?

**Q20.9** — Quelle est la différence entre ce harness et un simple fichier `CONTRIBUTING.md` bien tenu ? À quel moment la complexité ajoutée se justifie ?

**Q20.10** — Le harness reflète-t-il une vision **mature** du dev (ce que tu as appris) ou une vision **idéalisée** (ce que tu voudrais) ?

**Q20.11** — Peut-on imaginer le projet comme un échec utile (même si le harness ne marche jamais comme prévu, la réflexion architecturale a de la valeur) ?

**Q20.12** — Comment éviter que le harness devienne un projet "infini" (toujours en raffinement, jamais en production) ?

**Q20.13** — La complexité du système est-elle justifiée par la complexité du problème, ou est-elle une projection ?

**Q20.14** — Y a-t-il un risque d'**over-engineering** propre au profil dev solo + agents IA ? Comment le détecter ?

**Q20.15** — Le harness rend-il le développeur plus **dépendant** des agents IA (impossible de coder sans), ou plus **autonome** (la discipline reste même sans agent) ?

---

## Comment utiliser ce document

**Lecture initiale** : ne pas tenter de répondre à tout en une fois. Identifier 3-5 questions critiques à trancher pour démarrer, et différer les autres.

**Lecture en phase de Conception** : sections 1-3 (state machine, classification, modes) sont prioritaires. Sections 7-8 (architecture, distribution) viennent ensuite.

**Lecture en phase d'Implémentation** : sections 4-6 (hooks, skills/subagents, MCP), puis 11 (sécurité), 15 (cas limites).

**Lecture en phase de Stabilisation** : sections 17-19 (DX, tests, évolution).

**Lecture périodique** : section 20 (questions stratégiques) — à relire tous les mois pour éviter la dérive.

**Mise à jour** : ce document est vivant. Quand une question est tranchée, la déplacer dans le rapport de décisions. Quand une nouvelle question apparaît, l'ajouter ici.

---

*Document produit comme complément du checkpoint Discovery/Cadrage. À versionner dans `docs/03-discovery/open-questions-2026-05-02.md` ou équivalent.*