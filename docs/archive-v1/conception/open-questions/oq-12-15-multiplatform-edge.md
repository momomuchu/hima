# Open Questions — Sections 12 & 15 : Multi-plateforme et Cas limites

> **Statut** : tranché — réponses définitives
> **Date** : 2026-05-03
> **Sources** :
> - `docs/conception/04-runtime-bindings-spec.md` (détection, dégradation, adaptateur)
> - `docs/conception/01-state-machine-spec.md` (états d'erreur, rollback, récupération)
> - `docs/conception/09-cli-commands-spec.md` (doctor, recovery, codes de sortie)

---

## Section 12 — Multi-plateforme (Claude Code / Codex / Hermes)

---

### Q12.1 — Y a-t-il un risque que les 3 plateformes divergent significativement, rendant l'abstraction de plus en plus coûteuse ?

**Réponse** : Oui. Le risque est réel et structurel, mais il est contenu par architecture.

**Justification** : Les trois plateformes divergent déjà sur des points non-portables documentés (Tier 4 dans la spec) : types de hooks (`http`, `mcp_tool`, `agent` — Claude Code uniquement), gateway hooks (Hermes uniquement), profils nommés (Codex uniquement), OpenTelemetry natif (Claude Code uniquement). La stratégie d'absorption est la hiérarchie de tiers de portabilité : Tier 1 (copie directe) et Tier 2 (génération) absorbent la majorité des artefacts. Tier 3 (adaptateur) isole la divergence dans les hooks derrière l'interface `PlatformAdapter`. Tier 4 est exposé via des extensions par adaptateur (`ClaudeAdapter`, `HermesAdapter`, `CodexAdapter`) sans contaminer le core. La divergence future se matérialisera dans les Tier 3 et 4 uniquement. Le coût d'abstraction est borné au périmètre de l'interface `PlatformAdapter` (10 méthodes stables), pas à l'ensemble du codebase.

**Référence spec** : `04-runtime-bindings-spec.md §7 Portability Tiers`, `§8 Adapter Interface`.

---

### Q12.2 — Comment détecter automatiquement quelle plateforme tourne dans la session courante ?

**Réponse** : Algorithme à 3 étapes en cascade, implémenté dans `packages/core/src/capability-detector.ts`.

**Justification** : Étape 1 — variables d'environnement (`CLAUDE_SESSION_ID` / `ANTHROPIC_MODEL` → claude ; `CODEX_SESSION_ID` / `OPENAI_MODEL` → codex ; `HERMES_SESSION_ID` / `HERMES_HOME` → hermes). C'est la détection la plus fiable car injectée directement par la plateforme. Étape 2 — payload stdin : si le harness est appelé depuis un hook, la présence de `permission_mode` dans le JSON signale Claude Code ; `hook_event_name` signale Hermes. Étape 3 — présence de fichier de config sur disque (`~/.claude/settings.json`, `~/.codex/config.toml`, `~/.hermes/config.yaml`). Le résultat est écrit dans `.rms/state/runtime-capability-set.json` à chaque `session_start` avec la liste des hooks disponibles et les limitations.

**Référence spec** : `04-runtime-bindings-spec.md §6.1 Detection Algorithm`, `§6.2 Capability Flags`.

---

### Q12.3 — Peut-on basculer de plateforme en cours de projet sans perdre l'état ?

**Réponse** : Oui, sans perte d'état. L'état projet est dans `.planning/` (YAML/JSONL), indépendant de la plateforme.

**Justification** : L'état du harness est stocké exclusivement dans `.planning/agent/current-state.yaml` et `.planning/logs/state-transitions.jsonl`. Ces fichiers sont agnostiques à la plateforme — ils n'encodent aucune référence à Claude Code, Codex ou Hermes. À la reprise sur une autre plateforme, `SESSION_START` lit `current-state.yaml`, restaure le contexte via le pseudo-état XState `hist`, et repart du `lastStableState`. Le seul point de friction est que les hooks actifs sur la nouvelle plateforme peuvent avoir un sous-ensemble différent (ex : `subagent_stop` absent sur Codex) — ce gap est loggé comme `DONE_WITH_GAPS` si des preuves de sous-agents ne peuvent pas être capturées, mais la session continue sans blocage.

**Référence spec** : `01-state-machine-spec.md §9.3 Persistence rules`, `§3.7 Suspension/Resumption (SP02)` ; `04-runtime-bindings-spec.md §9.1 Degradation Strategy Matrix`.

---

### Q12.4 — Les 3 plateformes utilisent-elles les mêmes modèles ? Comment gérer un projet entamé sur GPT-5.5 et continué sur Claude Sonnet 4.6 ?

**Réponse** : Non. Le harness est model-agnostic : le contexte de session (phase, classe de risque, evidence) est préservé ; les artefacts produits restent valides. Le changement de modèle est transparent pour la state machine.

**Justification** : La state machine et les gates évaluent des artefacts sur disque (YAML, JSONL, fichiers `.planning/`) et non des sorties de modèle en mémoire. Un artefact produit par GPT-5.5 en phase `CONCEPTION.Exécuter` (ex : un ADR signé) satisfait la guard `adrSigned` de la même façon que si Claude l'avait produit. La seule variable qui change est la qualité et le style des artefacts — hors périmètre harness. Ce que le harness impose, c'est la structure et la preuve d'existence des artefacts, pas leur auteur. La détection runtime repart à zéro à chaque `SESSION_START` : le nouveau runtime écrase `runtime-capability-set.json` sans toucher `current-state.yaml`.

**Référence spec** : `01-state-machine-spec.md §2 Context Schema` (aucune référence au modèle LLM dans le contexte) ; `04-runtime-bindings-spec.md §6.2` (runtime-capability-set.json est réécrit à chaque session, séparé du state).

---

### Q12.5 — Comment tester le harness sur les 3 plateformes en CI sans avoir 3 abonnements ?

**Réponse** : Tests unitaires et d'intégration via mocks d'adaptateurs ; tests sur plateforme réelle uniquement pour les smoke tests de l'installeur.

**Justification** : L'interface `PlatformAdapter` est testable en isolation totale — un mock implémente l'interface sans lancer aucune plateforme réelle. Les tests unitaires des gates, de la state machine et du CLI couvrent 100% du comportement harness sans abonnement. Les adaptateurs eux-mêmes (`adapter-claude`, `adapter-codex`, `adapter-hermes`) ont des tests d'intégration qui vérifient la lecture/écriture des fichiers de config dans un répertoire temporaire — pas de runtime plateforme nécessaire. Seul `harness install --target <p>` nécessite la plateforme présente ; ce test est conditionnel (`if (platform binary on PATH)`) et peut être skippé en CI standard. La stratégie mirror exactement le pattern déjà validé : tester la mécanique, pas l'infra externe.

**Référence spec** : `04-runtime-bindings-spec.md §8 Adapter Interface` (interface mockable) ; `09-cli-commands-spec.md §1 harness install §7. doctor check` (mode silencieux, testable).

---

### Q12.6 — Quelle plateforme est prioritaire pour les nouvelles fonctionnalités ?

**Réponse** : Claude Code est la plateforme prioritaire. Les nouvelles fonctionnalités sont développées et validées sur Claude Code en premier, puis portées aux autres.

**Justification** : Claude Code est la plateforme la plus complète fonctionnellement : elle est la seule à supporter tous les 6 hook canoniques (y compris `SubagentStop`), les 4 types de hooks (`command`, `http`, `mcp_tool`, `agent`, `prompt`), et OpenTelemetry natif. C'est également la plateforme d'usage principal (contexte utilisateur). La parité stricte entre les 3 plateformes est un objectif de stabilisation, pas un invariant de développement — la spec le matérialise dans la matrice Tier 4 qui documente explicitement les fonctionnalités non-portables. Les adaptateurs Codex et Hermes s'alignent sur ce que Claude Code a validé.

**Référence spec** : `04-runtime-bindings-spec.md §7.4 Tier 4 — Not portable`, `§1 Binding Table` (Claude Code = seule plateforme avec `SubagentStop` et hook types avancés).

---

### Q12.7 — Faut-il une matrice de compatibilité documentée ?

**Réponse** : Oui. Elle existe déjà dans la spec sous la forme de la Binding Table et des Portability Tiers. Il faut la promouvoir en document de référence public séparé.

**Justification** : La Binding Table de `04-runtime-bindings-spec.md §1` couvre les 16 concepts RMS avec leur binding sur les 3 plateformes. La matrice Tier 4 liste les fonctionnalités non-portables. Le fichier `runtime-capability-set.json` est la version machine-readable générée à l'exécution. Ce qui manque est un document synthétique de compatibilité orienté utilisateur (`docs/compatibility-matrix.md`) qui liste par fonctionnalité le support par plateforme (Full / Partial / No-op / Not available). Ce document sera généré automatiquement par `harness doctor --json` lors de la stabilisation.

**Référence spec** : `04-runtime-bindings-spec.md §1 Binding Table`, `§7 Portability Tiers`, `§6.2 Capability Flags`.

---

### Q12.8 — Si Hermes ajoute une nouvelle catégorie de hooks, comment l'intégrer sans casser Claude Code et Codex ?

**Réponse** : Via l'interface `PlatformAdapter` et le système de capability flags. Ajout sans breaking change.

**Justification** : Le processus est : (1) le nouveau hook Hermes est mappé à un nouveau `CanonicalGate` optionnel (ex : `gateway_intercept`) dans `types.ts` ; (2) `buildHermesCapabilities()` ajoute ce gate dans `hookSubset` ; (3) `buildClaudeCapabilities()` et `buildCodexCapabilities()` n'incluent pas ce gate dans leur `hookSubset` — la valeur est absente, pas `false` ; (4) la degradation decision tree du harness vérifie `hookSubset.includes(gate)` avant toute registration — si absent, `GATE_SKIPPED` loggé, exit 0. Claude Code et Codex ne voient jamais cette nouvelle gate ; leurs sessions ne sont pas affectées. Le versioning de l'interface `PlatformAdapter` absorbe les ajouts via extension optionnelle (`HermesAdapter extends PlatformAdapter`).

**Référence spec** : `04-runtime-bindings-spec.md §9.2 Degradation Decision Tree`, `§8 Adapter Interface`, `§10.2 Hermes Gateway Hooks`.

---

### Q12.9 — Comment gérer les plateformes propriétaires vs open source (Hermes est MIT, Claude Code et Codex non) ?

**Réponse** : Le harness lui-même est agnostique à la licence des plateformes. Les adaptateurs s'appuient uniquement sur des interfaces publiques documentées — pas d'ingénierie inverse.

**Justification** : `adapter-claude` lit/écrit `~/.claude/settings.json` (format public documenté) et appelle `claude --version` (CLI public). Aucun binaire propriétaire n'est embarqué ou modifié. Même logique pour Codex. Hermes étant MIT, l'adaptateur peut potentiellement utiliser l'API interne, mais par cohérence avec les autres adaptateurs, seule l'interface publique est utilisée. La licence MIT de Hermes n'impose pas de contrainte supplémentaire sur le harness. Si Claude Code ou Codex changent leur format de config sans préavis (Q12.14), c'est un breaking change upstream traité par `harness doctor` (détection) et par un patch release du harness.

**Référence spec** : `04-runtime-bindings-spec.md §5 Installer Behavior` (tous les adaptateurs opèrent sur des fichiers de config documentés publiquement).

---

### Q12.10 — Y a-t-il d'autres plateformes à supporter à terme (Cursor, Continue.dev, Aider) ?

**Réponse** : Oui, à terme. L'architecture le permet sans modification du core. Cursor et Continue.dev sont les candidats les plus pertinents.

**Justification** : L'interface `PlatformAdapter` est le seul point d'extension requis pour supporter une nouvelle plateforme. Cursor expose un système de Rules (`.cursorrules`) et depuis 2025 un système de hooks expérimental — un `adapter-cursor` est faisable en Tier 1/2 (instructions) mais limité en Tier 3 (hooks) selon la maturité de l'API. Continue.dev supporte les slash commands et les context providers — mappage partiel possible. Aider est un outil CLI sans système de hooks structuré — portabilité limitée à Tier 1 (instructions dans `.aider.conf`). La priorité d'implémentation suit l'adoption réelle : le harness ne supporte que les plateformes utilisées activement. Cursor est le candidat N+1 le plus probable.

**Référence spec** : `04-runtime-bindings-spec.md §8 Adapter Interface` (extensible via nouvelle implémentation de `PlatformAdapter`).

---

## Section 15 — Cas limites et défaillances

---

### Q15.1 — Que fait le harness si `.planning/` est corrompu (YAML invalide) ?

**Réponse** : Fail-open avec log d'erreur. Le harness permet la session, log la corruption sur stderr, et émet le code de sortie `3` sur les commandes qui lisent l'état.

**Justification** : La degradation decision tree spécifie explicitement : en cas d'erreur non gérée dans un hook, `exit 0` (fail-open). Bloquer l'agent parce que son propre fichier d'état est corrompu serait pire que l'état corrompu lui-même. Le harness distingue deux cas : (1) `harness hook` appelé depuis un hook plateforme — fail-open systématique, log stderr, l'agent continue sa session ; (2) `harness status` / `harness transition` appelés par l'humain — erreur explicite code `3`, message indiquant le fichier corrompu et la commande de réparation (`harness doctor --fix`). `harness doctor --fix` tente de reconstruire `current-state.yaml` depuis `state-transitions.jsonl` (source primaire d'event sourcing) si ce log est intact.

**Référence spec** : `04-runtime-bindings-spec.md §9.2 Degradation Decision Tree` (dernière branche : unhandled error → exit 0) ; `09-cli-commands-spec.md §4 harness status code 3`, `§8 harness doctor --fix` ; `01-state-machine-spec.md §9.3 rule 4` (si absent ou invalide → IDLE).

---

### Q15.2 — Que fait le harness si la plateforme cible ne répond plus ?

**Réponse** : Le harness ne dépend pas de la disponibilité de la plateforme à l'exécution des hooks. Si la plateforme crashe, les hooks ne sont plus appelés — le harness n'est pas impliqué.

**Justification** : Le harness est un processus appelé par la plateforme, pas l'inverse. Si la plateforme tombe, le processus `harness hook` n'est plus invoqué. Le harness ne tourne pas en daemon et ne poll pas la plateforme. L'état dans `.planning/` reste cohérent à partir du dernier `persistState` atomique. À la reprise (nouvelle session), `SESSION_START` restaure depuis `current-state.yaml` via le pseudo-état `hist`. Si la plateforme ne répond pas lors de `harness install` ou `harness doctor`, ces commandes retournent code `1` avec un message explicite sur l'absence du binaire. Aucun retry infini.

**Référence spec** : `09-cli-commands-spec.md §5 harness hook` (le hook est invoqué par la plateforme, pas le contraire) ; `01-state-machine-spec.md §9.3 rule 4` (reprise depuis état sauvegardé).

---

### Q15.3 — Que fait le harness si un hook plante (exception non gérée) ?

**Réponse** : Fail-open : exit 0, log de l'exception sur stderr. La session agent n'est jamais bloquée par une exception interne au harness.

**Justification** : La degradation decision tree (§9.2 de la spec bindings) termine explicitement par : `On any unhandled error → log error; exit 0 (fail-open, never crash the agent session)`. Ce choix est délibéré : un hook qui crash et sort avec code non-zéro peut bloquer indéfiniment l'agent selon la plateforme. L'exception est loggée dans `.planning/logs/events.jsonl` sous le type `HOOK_CRASH` avec le stack trace, permettant le diagnostic post-mortem. La prochaine invocation du hook repart de zéro. Si les crashes sont répétés, `harness doctor` les détecte via l'analyse de `events.jsonl`.

**Référence spec** : `04-runtime-bindings-spec.md §9.2 Degradation Decision Tree` (branche finale) ; `09-cli-commands-spec.md §8 harness doctor` (catégorie Hooks dans le diagnostic).

---

### Q15.4 — Que fait le harness en cas de coupure réseau ?

**Réponse** : Aucun impact sur le harness core. Les gates évaluent des fichiers locaux. Les MCP servers distants sont désactivés gracieusement via `MCP_UNAVAILABLE`.

**Justification** : Le chemin critique de `harness hook` est conçu sans I/O réseau : lecture YAML synchrone locale, évaluation de guards pure, écriture JSONL locale. La coupure réseau n'affecte pas les transitions d'état ni les décisions allow/block. Pour les MCP servers qui seraient accessibles en HTTP : si le MCP server `harness-state` ne répond pas, la spec prévoit le fallback `MCP_UNAVAILABLE` — le harness passe en file-only mode (lit/écrit `.rms/` directement). La dépendance réseau n'existe que pour les fonctionnalités optionnelles (OpenTelemetry export sur Claude Code, MCP servers tiers). Ces fonctionnalités se dégradent silencieusement avec log `GATE_SKIPPED` ou `MCP_UNAVAILABLE`.

**Référence spec** : `04-runtime-bindings-spec.md §9.1` (ligne `MCP server registration → file-only mode`) ; `09-cli-commands-spec.md §10 Performance` (zéro I/O réseau dans le chemin critique hook).

---

### Q15.5 — Comment gérer les deadlocks (un hook attend une décision humaine, l'humain n'est pas là) ?

**Réponse** : Le harness ne bloque jamais sur input humain dans les hooks. Les décisions humaines sont requises uniquement lors des transitions explicites (`harness transition`), jamais dans le chemin critique `harness hook`.

**Justification** : La séparation est architecturale. `harness hook pre_tool_use` évalue des guards déterministes (lecture `state.yaml`) et retourne immédiatement allow ou block — aucun prompt interactif, aucune attente. La gate `humanValidationObtained` est un flag booléen dans le contexte, pas un appel synchrone vers un humain. Ce flag est positionné manuellement via `harness transition --reason` ou `harness evidence add review`. Si `humanValidationObtained = false` et que la transition le requiert (É/C), la transition est bloquée avec code `2` et un message explicite — l'agent ne se retrouve pas en deadlock, il reçoit un blocage explicite qu'il peut reporter à l'humain. Le deadlock est structurellement impossible dans ce design.

**Référence spec** : `01-state-machine-spec.md §4 Guards` (`humanValidationObtained` = prédicat sur `ctx.gatesPassed`, pas d'I/O) ; `09-cli-commands-spec.md §6 harness transition` (guards KO → code 2, pas de blocage).

---

### Q15.6 — Comment gérer les race conditions (deux hooks qui modifient le même fichier en même temps) ?

**Réponse** : Écriture atomique de `current-state.yaml` (write-to-temp + rename). Append-only pour `events.jsonl` (atomic appends sur la majorité des OS). Les hooks sont des processus éphémères sans état partagé en mémoire.

**Justification** : `current-state.yaml` est écrit via write-to-`.tmp` + `rename()` — atomic sur POSIX, atomic sur Windows depuis NTFS. Deux processus `harness hook` simultanés ne peuvent pas produire un fichier partiellement écrit : le dernier rename gagne, et le fichier est toujours cohérent. `events.jsonl` utilise des appends POSIX qui sont atomiques pour les petites écritures (< 4KB sur Linux). Pour les races sur `events.jsonl` : le pire cas est deux lignes entrelacées dans le même secteur — géré par une écriture avec flush explicite. Dans la pratique, les hooks plateforme sont séquentiels par session (`pre_tool_use` → agent → `post_tool_use`) — les races inter-hooks dans une même session ne peuvent pas se produire. Les races inter-sessions (deux sessions Claude Code simultanées sur le même projet) sont hors scope initial (mono-état strict, D7).

**Référence spec** : `01-state-machine-spec.md §9.3 rule 2` (écriture atomique) ; `01-state-machine-spec.md §9.3 rule 3` (append-only JSONL).

---

### Q15.7 — Quelle stratégie de retry pour les opérations idempotentes ?

**Réponse** : Max 3 retries avec backoff exponentiel pour les opérations I/O. Aucun retry pour les décisions de gates (déterministes). La state machine gère ses propres retries via `attemptCount`.

**Justification** : La state machine encode directement le retry : `ERROR.RECOVERABLE` → max 3 transitions `ERROR_DETECTED` avant `MAX_ATTEMPTS_REACHED`. Ce compteur (`attemptCount`) se remet à zéro sur toute transition forward. Pour les I/O (lecture YAML, écriture JSONL) : 3 tentatives avec backoff 10ms/50ms/200ms — puis fail avec log d'erreur. Aucun retry pour les décisions gates car elles sont pures (même input → même output). Les installations (`harness install`) sont idempotentes par design (§5 de la spec bindings) — ré-exécuter sans `--force` est safe et converge vers le même état.

**Référence spec** : `01-state-machine-spec.md §3.4 Error transitions (E003)`, `§7 Final States (MAX_ATTEMPTS_REACHED)` ; `04-runtime-bindings-spec.md §5 Installer Behavior` (idempotent).

---

### Q15.8 — Comment gérer un disque plein (`.planning/logs/` sature) ?

**Réponse** : Fail-open avec log stderr. Le harness détecte l'erreur d'écriture JSONL, log sur stderr uniquement (pas de fichier), et continue la session. `harness doctor` signale le volume saturé.

**Justification** : La degradation decision tree s'applique : erreur non gérée sur l'écriture `events.jsonl` → log stderr, exit 0. L'écriture JSONL est fire-and-forget (`setImmediate`) — une erreur sur cette écriture n'est jamais sur le chemin critique de la décision allow/block. `current-state.yaml` est le seul fichier critique ; en cas de disque plein lors de son écriture, le rename échouera — le harness détecte l'échec, log l'erreur, et conserve l'ancienne version cohérente (le rename étant atomic, pas de corruption partielle). `harness doctor` inclut une vérification de l'espace disque disponible dans la catégorie `Projet`.

**Référence spec** : `04-runtime-bindings-spec.md §9.2` (fail-open sur toute erreur) ; `09-cli-commands-spec.md §5 harness hook` (écriture events.jsonl async, ne bloque pas) ; `09-cli-commands-spec.md §8 harness doctor` (catégorie Projet).

---

### Q15.9 — Que se passe-t-il si l'utilisateur supprime manuellement `.planning/state/state.yaml` ?

**Réponse** : La session courante perd son contexte. Le harness redémarre en `IDLE` à la prochaine `SESSION_START`. L'historique complet reste récupérable depuis `state-transitions.jsonl`.

**Justification** : La règle de persistence §9.3 rule 4 est explicite : si `current-state.yaml` est absent, la machine démarre en `IDLE`. Ce comportement est intentionnel : mieux vaut redémarrer proprement que de deviner un état invalide. Le log `state-transitions.jsonl` est append-only et ne dépend pas de `current-state.yaml` — il contient l'intégralité des transitions avec timestamps, permettant la reconstruction de l'état au dernier point cohérent via `harness doctor --fix`. `harness doctor` détecte l'absence de `current-state.yaml` dans sa catégorie `Projet` et propose la reconstruction depuis le log.

**Référence spec** : `01-state-machine-spec.md §9.3 rule 4` ; `01-state-machine-spec.md §10 Q2 resolution` (log = source primaire d'event sourcing) ; `09-cli-commands-spec.md §8 harness doctor --fix`.

---

### Q15.10 — Comment récupérer d'un état incohérent ? `harness recover` ?

**Réponse** : Pas de commande `harness recover` séparée. La récupération est intégrée dans `harness doctor --fix` et le flux `ERROR.RECOVERABLE → ERROR_RECOVERED`.

**Justification** : Deux niveaux de récupération. Niveau runtime : la state machine transite vers `ERROR.RECOVERABLE` sur `ERROR_DETECTED`, tente jusqu'à 3 auto-retries depuis `lastStableState`, puis escalade à `ERROR.ESCALATED` pour intervention humaine. Ce flux couvre la majorité des états incohérents détectés en session. Niveau disque : `harness doctor --fix` reconstruit `current-state.yaml` depuis `state-transitions.jsonl` (si le log est intact), reinstalle les fichiers manquants depuis les templates embarqués, et ne touche jamais aux fichiers édités par l'utilisateur. Ajouter une commande `harness recover` serait redondant — `harness doctor --fix` est la surface d'entrée unique pour les réparations manuelles, conformément au principe de surface CLI minimale (une commande par usage).

**Référence spec** : `01-state-machine-spec.md §3.4 Error transitions (E001-E006)` ; `09-cli-commands-spec.md §8 harness doctor --fix`.

---

### Q15.11 — Comment gérer les conflits Git sur les fichiers générés par l'agent ?

**Réponse** : Les fichiers d'état harness (`.planning/agent/current-state.yaml`, `events.jsonl`) sont ajoutés au `.gitignore` par `harness init`. En cas de conflit sur un fichier `.planning/` éditable, `harness doctor` détecte les marqueurs de conflit et bloque la session avec code `3`.

**Justification** : `current-state.yaml` est régénéré à chaque session depuis le log — le versionner dans Git n'apporte pas de valeur et crée des conflits systématiques en multi-branches. `harness init` écrit un `.gitignore` adapté excluant `.planning/agent/` et `.planning/logs/`. Les fichiers `.planning/` éditables par l'humain (PBI, RISK, ADR) peuvent avoir des conflits Git comme n'importe quel fichier Markdown — ils sont gérés manuellement, hors responsabilité du harness. Si `current-state.yaml` contient des marqueurs de conflit Git (détectés au parsing YAML), `harness hook` passe en fail-open et `harness doctor` signale l'anomalie.

**Référence spec** : `01-state-machine-spec.md §9.1` (fichiers d'état dans `.planning/agent/`) ; `09-cli-commands-spec.md §3 harness init` (création structure `.planning/`) ; `09-cli-commands-spec.md §4 code 3` (state.yaml corrompu ou incohérent).

---

### Q15.12 — Comment éviter qu'un mauvais hook bloque indéfiniment l'agent (livelock) ?

**Réponse** : Timeout de 50 ms sur la lecture stdin. Fail-open systématique sur erreur. Détection de loop par `stateVisitCounts` avec seuil à 3 visites.

**Justification** : Trois protections indépendantes. (1) Timeout stdin : si le harness est appelé mais que stdin est vide ou bloqué, il retourne `allow` après 50ms — aucun blocage possible sur l'entrée. (2) Fail-open sur toute exception : le hook ne peut pas bloquer l'agent même s'il plante. (3) Détection de loop : `loopDetected` guard retourne `true` si `stateVisitCounts[key] >= 3` dans la même session — la state machine transite alors vers `LOOP_DETECTED` (final state) puis `BLOCKED_NEEDS_USER`. Cette détection coupe court à un scénario où l'agent serait renvoyé en arrière indéfiniment (ex : `DOD_FAIL` → retour BUILD → même DOD_FAIL en boucle).

**Référence spec** : `09-cli-commands-spec.md §5 harness hook` (timeout stdin 50ms) ; `04-runtime-bindings-spec.md §9.2` (fail-open) ; `01-state-machine-spec.md §4 Guards` (`loopDetected`), `§7 Final States (LOOP_DETECTED)`.

---

### Q15.13 — Que faire si la classe de risque est ambiguë et l'agent ne peut pas trancher ?

**Réponse** : L'agent conservatif choisit la classe la plus haute des candidats et la soumet via `harness classify --manual <class> --reason`. La classe est révisable. Le harness ne tranche pas l'ambiguité.

**Justification** : `harness classify --auto` implémente un arbre de décision déterministe avec 5 règles ordonnées par sévérité décroissante. Si deux règles se déclenchent simultanément (ex : refactor qui touche `auth.ts` ET est derrière un feature flag), la règle de priorité est la plus haute classe déclenchée — la première règle qui matche l'emporte dans l'ordre de l'arbre. Ce design élimine l'ambiguité algorithmique. Si l'agent considère que la classification auto est incorrecte, il peut émettre `harness classify --manual <class> --reason <justification>` — la justification est persistée dans `promotionHistory` pour traçabilité. Le harness ne consulte pas un LLM pour classifier ; la classification est déterministe ou humaine — jamais une négociation.

**Référence spec** : `09-cli-commands-spec.md §7 harness classify` (arbre à 5 règles ordonnées) ; `01-state-machine-spec.md §3.8 Risk class transitions (RC01, RC02)` ; `01-state-machine-spec.md §2 Context Schema` (`promotionHistory`).

---

### Q15.14 — Comment gérer une plateforme qui change ses formats de hooks sans préavis (breaking change upstream) ?

**Réponse** : `harness doctor` détecte la rupture. L'adaptateur affecté reçoit un patch release. Le core et les autres adaptateurs ne sont pas impactés.

**Justification** : `harness doctor --target <platform>` vérifie à chaque diagnostic que chaque hook enregistré est résolvable et répond au format attendu. Une breaking change upstream (ex : Claude Code renomme `PreToolUse` en `pre_tool_use`) se manifeste immédiatement : les hooks ne sont plus appelés, `events.jsonl` ne reçoit plus d'entrées `pre_tool`, et `harness doctor` signale "Hooks registered: 4/6" avec les hooks manquants. L'interface `PlatformAdapter` isole la rupture dans `adapter-<platform>` uniquement — un patch de l'adaptateur corrige la registration et le parsing du payload sans toucher ni le core ni les autres adaptateurs. Le versioning des adaptateurs est indépendant du core (`packages/adapter-claude` a sa propre version semver).

**Référence spec** : `04-runtime-bindings-spec.md §8 Adapter Interface` (`parseHookPayload` isolé par adaptateur) ; `09-cli-commands-spec.md §8 harness doctor` (catégorie Hooks : "chaque hook enregistré correspond à un event-name valide") ; `04-runtime-bindings-spec.md §3 Skill Installation Paths` (adaptateurs indépendants).
