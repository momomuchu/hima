# Réponses aux Questions Ouvertes — Sections 3 & 4

> **Sections couvertes** : §3 Modes opératoires (Q3.1–Q3.12), §4 Hooks et événements (Q4.1–Q4.14)
> **Date** : 2026-05-03
> **Sources** :
> - `05-gates-policy-spec.md` — gates, politique par classe, modes
> - `04-runtime-bindings-spec.md` — bindings hooks par plateforme
> - `02-risk-classifier-spec.md` — matrice risque × mode, matrice risque × profondeur

---

## Section 3 — Modes opératoires

### Q3.1 — Granularité de définition du mode (projet / session / story)

**Réponse** : Le mode est défini par story (item backlog / run). La classe de risque, calculée par `classifyRisk(changeset)` à la création de l'item, détermine les modes autorisés pour ce run précis. Un projet peut donc avoir simultanément un run T en bypass et un run É en auto-décision+checkpoint. La granularité story est la seule cohérente avec le principe "la politique suit le risque, pas l'intention".

**Justification** : Un mode global projet écraserait la modulation per-run qui est le cœur de la pipeline. La matrice `05-gates-policy-spec.md §4.1` est définie par classe, pas par projet.

**Référence spec** : `02-risk-classifier-spec.md §6` (Matrice Risque × Mode) ; `05-gates-policy-spec.md §4.1` (colonne `allowedModes` par classe)

---

### Q3.2 — Changement de mode en cours de session

**Réponse** : Le changement de mode est explicite via commande (`harness mode set <mode>`). La détection automatique est rejetée : le mode est une décision de supervision humaine, pas une inférence comportementale. Le harness accepte le changement uniquement si le mode cible est dans `allowedModes` de la classe courante du run actif. Un changement vers bypass sur un run M/É/C est refusé avec `BLOCK` et log dans `events.jsonl`.

**Justification** : La détection automatique crée un biais d'optimisme (l'agent déclare "auto-décision" pour éviter des frictions). L'explicite est le seul guard fiable.

**Référence spec** : `05-gates-policy-spec.md §4.1` (colonne `allowedModes`) ; `02-risk-classifier-spec.md §6`

---

### Q3.3 — Interaction modes × classes de risque (pairing sur T, bypass sur É)

**Réponse** : Bypass sur É/C est interdit absolu — aucune exception, aucun override. Pairing sur T est autorisé mais jamais requis (overkill toléré, jamais bloqué). La matrice est asymétrique : les modes sont un plancher (mode minimum forcé par la classe), pas un plafond. On peut toujours monter le niveau de supervision.

**Justification** : "Pairing sur T" ne crée aucun risque. "Bypass sur É" viole la règle D4 non négociable.

**Référence spec** : `02-risk-classifier-spec.md §6` (Matrice Risque × Mode, colonnes T/F/M) ; `05-gates-policy-spec.md §6.2` (bypass T autorisé, É/C interdit)

---

### Q3.4 — Mode minimum forcé vs conseillé

**Réponse** : Le harness force un mode minimum selon la classe — ce n'est pas un conseil. La gate `user_prompt` bloque tout prompt qui tenterait d'activer bypass sur M/É/C avec `HARD_BLOCK` et `ViolationType.BYPASS_ATTEMPTED`. L'enforcement est au niveau gate, pas au niveau UI.

**Justification** : Un conseil sans enforcement est un guide de style, pas un harness. La valeur du système est précisément dans le blocage mécanique.

**Référence spec** : `05-gates-policy-spec.md §4.1` (colonne `allowedModes`) ; `05-gates-policy-spec.md §5.2` (ligne "Bypass tenté sans autorisation") ; `02-risk-classifier-spec.md §4.3` (garde-fou 1)

---

### Q3.5 — Garantie de qualité du mode auto-décision

**Réponse** : Le format de proposition est imposé et non négociable : `[problème][alternatives][choix][critère de succès][classe de risque]`. Un prompt en mode auto-décision qui ne respecte pas ce format est rejeté par la gate `user_prompt` avec `WARN` (T/F) ou `BLOCK` (M/É/C). En complément : quota de rejets ≥ 20 % sur 7 jours glissants, et audit aléatoire hebdomadaire d'une proposition acceptée.

**Justification** : Le format imposé est le garde-fou anti-rubber-stamp documenté dans la spec. Sans lui, le mode auto-décision dégénère en bypass implicite.

**Référence spec** : `02-risk-classifier-spec.md §6` (Garde-fous anti-rubber-stamp)

---

### Q3.6 — Quota de rejets ≥ 20 % — mesure et conséquences

**Réponse** : Le quota est mesuré par le harness dans `active-run.json` sur une fenêtre glissante de 7 jours. Si le taux de rejet tombe sous 20 %, le harness déclenche une alerte via `events.jsonl` (type `LOW_REJECTION_RATE`) et force la revue du prochain run M/É en mode pairing (escalade automatique du mode). Il ne force pas le pairing rétroactivement, mais conditionne le run suivant.

**Justification** : Un taux < 20 % sur 7 jours indique soit un agent trop conservateur, soit un humain qui n'exerce pas sa supervision. Les deux dégradent la valeur du système.

**Référence spec** : `02-risk-classifier-spec.md §6` (Garde-fous anti-rubber-stamp — quota 20 %)

---

### Q3.7 — Audit aléatoire hebdomadaire — automatisé ou discipline humaine

**Réponse** : Automatisé par le harness. À J+1, le harness sélectionne aléatoirement une proposition acceptée de la veille et la présente au développeur via `harness audit weekly` (ou via le hook `SessionStart` du lundi). Le développeur doit confirmer ou contester. Sans réponse dans 24h, l'item est loggué `AUDIT_PENDING` dans `events.jsonl`. L'audit ne bloque pas le run en cours — il crée une dette documentée.

**Justification** : Laisser l'audit à la discipline humaine crée un angle mort systématique. L'automatisation est la seule garantie que l'audit a lieu.

**Référence spec** : `02-risk-classifier-spec.md §6` (Garde-fous anti-rubber-stamp — audit aléatoire hebdomadaire)

---

### Q3.8 — Information a posteriori en mode bypass

**Réponse** : En mode bypass, le harness produit un rapport de run dans `events.jsonl` à chaque `stop`. Le rapport est consultable via `harness status --run <runId>`. Pas de notification push (pas de daemon). Le développeur consulte activement. Pour la visibilité passive, le hook `SessionStart` du lendemain injecte dans le contexte un résumé des runs bypass des dernières 24h (via `injectedContext`).

**Justification** : "Rapport quotidien" via `SessionStart` est le vecteur naturel — c'est déjà le point d'injection de contexte documenté dans les specs.

**Référence spec** : `05-gates-policy-spec.md §7.2` (notification synchrone + persistée + consultable) ; `04-runtime-bindings-spec.md §2.1` (session_start — injectedContext)

---

### Q3.9 — Mode "shadow" entre pairing et bypass

**Réponse** : Il n'y a pas de mode shadow dans la spec v1. Le mode le plus proche est `auto-decision` sans checkpoint : l'agent propose, pas besoin de présence continue. Un mode shadow (agent exécute sans appliquer) n'est pas prévu — il introduirait une complexité d'implémentation élevée pour un cas d'usage marginal. À ajouter en backlog si un besoin concret émerge.

**Justification** : La spec définit quatre modes distincts (bypass / auto-décision / auto-décision+checkpoint / pairing). Un cinquième mode augmente la surface de la matrice sans résoudre un problème identifié.

**Référence spec** : `02-risk-classifier-spec.md §6` (Définitions des modes — 4 modes définis) ; non couvert pour shadow

---

### Q3.10 — Mode courant et marquage dans Git

**Réponse** : Le mode courant n'est pas inscrit dans le message de commit Git (évite la pollution du log). Il est tracé dans `events.jsonl` avec chaque action et dans `active-run.json` (`mode` field de `RunContext`). Si le développeur veut un marquage Git explicite, le hook `stop` peut ajouter un trailer Git (`Harness-Mode: bypass`) via `injectedContext` — mais ce comportement est opt-in, pas par défaut.

**Justification** : Le log Git appartient au projet, pas au harness. La traçabilité harness vit dans `.rms/` et `events.jsonl`.

**Référence spec** : `05-gates-policy-spec.md §3.3` (GateEvent — champ `mode`) ; `05-gates-policy-spec.md §3.5` (events.jsonl — champ `verdict` + contexte run)

---

### Q3.11 — Mélange de modes au sein d'un même cycle

**Réponse** : Non — le mode est uniforme pour un run donné. Changer de mode en cours de run (code en auto-décision, conception en pairing) contredit la sémantique d'un run cohérent. Si le développeur veut un mode différent pour une phase spécifique, il doit ouvrir un run séparé avec sa propre classification. La gate `user_prompt` vérifie le mode au niveau du run, pas de la phase individuelle.

**Justification** : Un mode hybride par phase crée des zones grises d'enforcement. La simplicité — un run = un mode — est préférable à la flexibilité qui dilue la garantie.

**Référence spec** : `05-gates-policy-spec.md §3.3` (GateEvent — `mode` est un champ du run, pas de la phase) ; `02-risk-classifier-spec.md §6`

---

### Q3.12 — Comment l'agent IA "sait" dans quel mode il opère

**Réponse** : Via trois canaux combinés : (1) la gate `session_start` injecte le mode actif dans `additionalContext` à chaque ouverture de session, (2) la gate `user_prompt` enrichit chaque prompt avec `{ riskClass, mode, activeGates, mandatoryActivities }`, (3) un skill `harness-core` chargé automatiquement par description contient les règles de comportement par mode. L'agent n'a pas besoin de variable d'environnement séparée — le contexte injecté est suffisant et re-injecté à chaque action.

**Justification** : Variable d'environnement seule est fragile (non ré-injectée après compaction). La combinaison session_start + user_prompt + skill garantit que le mode est toujours visible dans la fenêtre de contexte active.

**Référence spec** : `05-gates-policy-spec.md §1.1` (session_start — injecte mode opératoire actif) ; `05-gates-policy-spec.md §1.1` (user_prompt — injecte mode autorisé) ; `04-runtime-bindings-spec.md §3.3` (harness-core skill)

---

## Section 4 — Hooks et événements

### Q4.1 — Liste exhaustive des hooks canoniques

**Réponse** : Six hooks canoniques, figés avant implémentation :

| Hook canonique | CLI harness | Rôle |
|---|---|---|
| `session_start` | `harness hook session-start` | Injection de contexte au démarrage |
| `user_prompt` | `harness hook user-prompt-submit` | Contrôle des demandes, enforcement du mode |
| `pre_tool` | `harness hook pre-tool-use` | Enforcement des zones d'écriture par phase |
| `post_tool` | `harness hook post-tool-use` | Détection patterns interdits, collecte Evidence |
| `stop` | `harness hook stop` | Vérification suffisance Evidence Set |
| `subagent_stop` | `harness hook subagent-stop` | Traçabilité résultats sous-agents |

**Justification** : Ces six hooks couvrent l'intégralité du cycle de vie d'un run agent. Tout événement harness peut être rattaché à l'un d'eux.

**Référence spec** : `05-gates-policy-spec.md §1` (Catalogue des gates) ; `04-runtime-bindings-spec.md §2` (Hook Event Mapping) ; `04-runtime-bindings-spec.md Appendix`

---

### Q4.2 — Signature de chaque hook canonique

**Réponse** : Tous les hooks partagent le même protocole stdin/stdout :

- **Entrée** (`stdin`) : `GateEvent` — champs communs : `{ gate, timestamp, runId, riskClass, phase, mode }` + champs optionnels par gate (`toolName`, `toolInput`, `toolOutput`, `agentId`, `evidenceSummary`)
- **Sortie** (`stdout`) : `GateDecision` — `{ gate, verdict: "allow"|"block"|"warn", reason, violationType?, finalState?, injectedContext?, timestamp }`
- **Effet de bord** : append dans `events.jsonl`

Les champs spécifiques par gate : `pre_tool` reçoit `toolName + toolInput` ; `post_tool` reçoit `toolName + toolOutput` ; `stop` reçoit `evidenceSummary` ; `subagent_stop` reçoit `agentId + evidenceSummary`.

**Justification** : Interface uniforme = adaptateurs plus simples. La plateforme appelle toujours `harness hook <name>` — le harness dispatche en interne.

**Référence spec** : `05-gates-policy-spec.md §3.3` (GateEvent) ; `05-gates-policy-spec.md §3.4` (GateDecision) ; `05-gates-policy-spec.md §10.1` (types TypeScript complets)

---

### Q4.3 — Hooks présents sur Claude Code mais absents sur Codex/Hermes

**Réponse** : Stratégie no-op tracé — jamais d'erreur silencieuse. Quand un hook n'existe pas sur la plateforme cible, le harness : (1) écrit `GATE_SKIPPED` dans `events.jsonl`, (2) positionne un flag `capabilities.limitations[]` dans `runtime-capability-set.json`, (3) sélectionne la dégradation documentée (ex : `subagent_stop` absent sur Codex → Evidence check reporté au `stop` final → final state `DONE_WITH_GAPS` si sous-agent non tracé). Jamais d'erreur explicite qui bloquerait la session.

**Justification** : Fail-open pour les hooks manquants (pas de crash), fail-closed pour les violations de policy (HARD_BLOCK sur É/C). Les deux principes coexistent.

**Référence spec** : `04-runtime-bindings-spec.md §9` (Graceful Degradation) ; `04-runtime-bindings-spec.md §9.1` (matrice dégradation) ; `04-runtime-bindings-spec.md §9.2` (decision tree — `log GATE_SKIPPED; exit 0`)

---

### Q4.4 — Hooks synchrones ou asynchrones

**Réponse** : Synchrones. Le harness est un process Node.js lancé via `harness hook <name>`, lit stdin, écrit stdout, et sort. La plateforme attend la sortie avant de continuer. Pas d'async au sens callback/event-loop visible depuis la plateforme — tout est request/response bloquant. En interne, le harness peut utiliser des I/O async Node.js (lecture de fichiers YAML, écriture `events.jsonl`), mais la frontière avec la plateforme est toujours synchrone.

**Justification** : Les plateformes (Claude Code, Codex, Hermes) traitent les hooks comme des commandes shell bloquantes. Aucune API de réponse différée n'est documentée sur les trois plateformes.

**Référence spec** : `04-runtime-bindings-spec.md §2` (Output format — stdout text/JSON, pas de callback) ; `05-gates-policy-spec.md §3.1` (stdin → stdout, process bloquant)

---

### Q4.5 — Timeout d'un hook et comportement sur dépassement

**Réponse** : Timeout cible : 200ms pour les hooks non-bloquants (`session_start`, `post_tool`), 500ms pour les hooks bloquants (`user_prompt`, `pre_tool`, `stop`, `subagent_stop`). Sur dépassement : **fail-open** — exit 0, log `HOOK_TIMEOUT` dans `events.jsonl`, pas de blocage de session. Exception : si la class courante est É/C et que le hook bloquant timeout, le harness retourne `warn` (pas `block`) pour éviter un livelock, et log `HOOK_TIMEOUT_HIGH_RISK` comme violation à auditer.

**Justification** : Un hook qui crashe ou timeout ne doit jamais bloquer le développeur. La traçabilité compense l'absence d'enforcement. Livelock sur É/C serait pire que le fail-open.

**Référence spec** : `04-runtime-bindings-spec.md §9.2` (décision tree — "On any unhandled error → log error; exit 0") ; non couvert explicitement pour les valeurs numériques de timeout

---

### Q4.6 — Les hooks peuvent-ils modifier le contexte ou seulement bloquer/autoriser

**Réponse** : Les deux. Le champ `injectedContext` dans `GateDecision` permet d'injecter du texte dans le contexte de la prochaine action de l'agent. `session_start` et `user_prompt` l'utilisent pour injecter classe de risque, mode, gates actives, activités obligatoires. `pre_tool` injecte les zones d'écriture autorisées. `post_tool` ne bloque pas l'action passée mais peut injecter le résultat normalisé. `stop` et `subagent_stop` n'injectent pas (terminaux).

**Justification** : L'injection de contexte est le mécanisme primaire par lequel l'agent "apprend" sa classe, son mode et ses contraintes sans avoir à les demander.

**Référence spec** : `05-gates-policy-spec.md §1` (colonne "Peut injecter contexte" du catalogue) ; `05-gates-policy-spec.md §3.4` (champ `injectedContext` dans GateDecision)

---

### Q4.7 — Hooks Hermes (gateway/plugin/shell) — lesquels utiliser

**Réponse** : MVP = shell hooks uniquement (`hooks:` block dans `config.yaml`). Les plugin hooks Python sont un opt-in avancé exposé via `adapter-hermes` (`installPluginHook`, `installGatewayHook`), pas installés par défaut. Les gateway hooks (couche transport pré-LLM) sont réservés aux cas où on doit intercepter avant même le traitement du message — non requis pour le MVP. Shell hooks couvrent tous les six gates canoniques sur Hermes (avec dégradation documentée pour `stop` et `subagent_stop`).

**Justification** : Shell hooks sont le plus petit dénominateur commun Hermes, idempotents, testables sans Python. Plugin hooks sont puissants mais introduisent une dépendance Python dans un harness TypeScript.

**Référence spec** : `04-runtime-bindings-spec.md §5.3` (Hermes installer — shell hooks pour MVP) ; `04-runtime-bindings-spec.md §10.2` (gateway/plugin = opt-in advanced)

---

### Q4.8 — Authentification des appels de hooks

**Réponse** : Pas d'authentification réseau — les hooks sont des processus locaux lancés par la plateforme, pas des appels HTTP. La surface d'attaque est le filesystem local : un script malveillant pourrait appeler `harness hook pre-tool-use` avec un payload forgé. Mitigation : le harness vérifie que le `runId` dans le payload correspond à un run actif dans `active-run.json`, et que la `phase` déclarée est cohérente avec l'état courant. Payload incohérent → `WARN` + log, pas d'action. La sécurité forte est délégée aux permissions filesystem (qui contrôle `.rms/`).

**Justification** : L'authentification cryptographique des hooks locaux est du sur-engineering pour v1. Le vrai risque est un hook modifié sur disque — mitigé par les checksums de `harness-install.json`.

**Référence spec** : `04-runtime-bindings-spec.md §5` (installer écrit `harness-install.json` avec liste des fichiers écrits) ; non couvert explicitement pour l'auth payload

---

### Q4.9 — Les hooks loggent-ils systématiquement leurs entrées/sorties

**Réponse** : Oui, systématiquement et inconditionnellement. Chaque invocation de hook produit une entrée dans `events.jsonl` en append-only, avec : `ts`, `gate`, `verdict`, `runId`, `riskClass`, `phase`, `reason`, et si applicable `violationType`, `toolName`, `toolInput` (sans secrets). Les secrets sont redactés avant log (remplacés par `[REDACTED]`). Le log est la source de vérité pour l'audit — pas d'exception même pour les verdicts `allow`.

**Justification** : Un log sélectif (seulement les blocks) crée des angles morts d'audit. Logguer les `allow` est nécessaire pour calculer les taux de rejet et détecter les dérives.

**Référence spec** : `05-gates-policy-spec.md §3.1` (side-effect → events.jsonl append) ; `05-gates-policy-spec.md §3.5` (format de l'entrée events.jsonl)

---

### Q4.10 — Granularité : un hook par événement ou méga-hook dispatch interne

**Réponse** : Un hook par événement au niveau CLI (`harness hook session-start`, `harness hook pre-tool-use`, etc.), avec dispatch interne dans le binaire harness. La plateforme ne voit qu'une commande par event — pas de méga-hook unique. En interne, `evaluateGate(gate, context, event)` dispatche selon le type de gate. Cette architecture donne : isolation des timeouts par gate, testabilité individuelle, et messages d'erreur spécifiques.

**Justification** : Un méga-hook (`harness hook --event X`) imposerait un parsing de l'argument dans la config plateforme. La convention `harness hook <canonical-name>` est plus claire et plus facile à tracer dans les logs.

**Référence spec** : `04-runtime-bindings-spec.md Appendix` (CLI argument map par gate) ; `05-gates-policy-spec.md §10.2` (evaluateGate dispatche en interne par type)

---

### Q4.11 — Versionnement des hooks et migration de signature

**Réponse** : Les hooks sont versionnés par le champ `version` dans `registry/gates.yaml`. Toute modification de signature de `GateEvent` ou `GateDecision` constitue une breaking change qui requiert un ADR, une montée de version majeure du harness, et une migration documentée. La compatibilité ascendante est maintenue via des champs optionnels : les nouveaux champs sont ajoutés en `?` (optionnel TypeScript) et ignorés par les adaptateurs anciens. La `harness-install.json` trace la version installée par plateforme — `harness migrate` utilisera ce fichier pour détecter les gaps.

**Justification** : La signature stdin/stdout est le contrat central du harness. Le versionner explicitement dans `gates.yaml` avec un ADR obligatoire est la seule protection contre les régressions silencieuses.

**Référence spec** : `05-gates-policy-spec.md §9.1` (registry/gates.yaml — "Ne pas modifier sans ADR correspondant") ; `04-runtime-bindings-spec.md §5` (harness-install.json)

---

### Q4.12 — Les hooks doivent-ils être idempotents

**Réponse** : Oui, obligatoirement. Rejouer un hook avec le même `GateEvent` doit produire le même `GateDecision` et la même entrée `events.jsonl` (déduplication par `runId + gate + timestamp`). L'idempotence est garantie par : (1) la décision ne dépend que de l'état lu dans `active-run.json` + `policies.yaml` (state immutable par rapport au hook), (2) `events.jsonl` déduplique par `(runId, gate, ts)` — une entrée déjà présente n'est pas réinscrite. Les hooks ne produisent pas d'effets de bord réseau ou base de données.

**Justification** : Les plateformes peuvent rejouer un hook en cas d'erreur transitoire. Un hook non idempotent créerait des entrées dupliquées et des compteurs de violations incorrects.

**Référence spec** : `05-gates-policy-spec.md §3.1` (flux de traitement — lire état, évaluer, produire, append) ; `05-gates-policy-spec.md §3.5` (format events.jsonl avec timestamps ISO)

---

### Q4.13 — Test des hooks en isolation sans vraie plateforme

**Réponse** : Via l'interface CLI directe. Le harness expose `harness hook <gate> --dry-run < payload.json` qui exécute la gate logic complète et retourne le verdict sur stdout sans écrire dans `events.jsonl`. Pour les tests unitaires, `evaluateGate(gate, context, event)` est une fonction pure exportée testable avec Vitest sans dépendances plateforme. Les tests d'intégration utilisent des fixtures JSON correspondant aux payloads réels de chaque plateforme (Claude `PreToolUse`, Codex `PreToolUse`, Hermes `pre_tool_call` — formats documentés dans `04-runtime-bindings-spec.md §2`).

**Justification** : `evaluateGate` est déjà conçue comme une fonction pure (pas de I/O dans sa signature). La testabilité est architecturale, pas bolted-on.

**Référence spec** : `05-gates-policy-spec.md §10.2` (evaluateGate — fonction pure, params explicites) ; `04-runtime-bindings-spec.md §2` (formats de payload par plateforme — utilisables comme fixtures)

---

### Q4.14 — Hooks "compound" déclenchés par plusieurs événements

**Réponse** : Non dans la spec v1 — un hook canonique correspond à un événement plateforme. Pas de hook compound en v1. Le cas d'usage typique (ex : "déclencher une logique quand pre_tool ET post_tool se sont tous les deux exécutés sur le même outil") est géré en interne par la gate `post_tool` qui lit l'état accumulé dans `evidence-set.json` — pas besoin d'un hook composite. Si un besoin compound émerge, il sera modélisé comme un handler interne à `evaluatePostTool` qui corrèle avec l'historique du run, pas comme un nouveau type de hook.

**Justification** : Les hooks compound complexifient le modèle de déclenchement sans apporter de valeur que l'accumulation d'état dans `evidence-set.json` ne peut pas offrir.

**Référence spec** : `05-gates-policy-spec.md §1` (six gates canoniques — pas de compound documenté) ; `05-gates-policy-spec.md §2.2` (post_tool lit l'Evidence Set accumulé)

---

*Document produit en Conception — Pipeline Fractale v4*
*Sources : `02-risk-classifier-spec.md`, `04-runtime-bindings-spec.md`, `05-gates-policy-spec.md`*
*Questions non couvertes par les specs actuelles : Q3.9 (shadow mode — non prévu v1), Q4.5 (valeurs numériques timeout — non spécifiées), Q4.8 (auth payload — non spécifiée)*
