# OQ-05 & OQ-06 — Skills, Subagents, MCP Servers

> **Statut** : TRANCHÉES — phase Conception  
> **Date** : 2026-05-03  
> **Sources** : `06-skills-catalog-spec.md`, `07-subagents-catalog-spec.md`, `04-runtime-bindings-spec.md`

---

## Section 5 — Skills et Subagents

---

### Q5.1 — Liste exhaustive des skills à fournir par défaut

**Réponse** : 12 skills au total — 4 core (always-on) + 8 cycle-specific.

Core (toutes classes, tous cycles) :
- `classify-risk` — classification T/F/M/É/C, auto-invoquée avant toute action
- `propose-change` — formalisation Intent Set, scalée à la classe
- `transition-phase` — gate DoD + avancement state machine
- `status` — snapshot read-only de l'état courant

Cycle-specific (M/É/C sauf indication) :
- `discovery-validate` — cycle 01 : note découverte + recommandation build/pivot/kill
- `cadrage-dor` — cycle 02 : Definition of Ready (DoR) complète
- `conception-adr` — cycle 03 : ADRs MADR 4.0, C4, STRIDE, contrats API
- `build-inner-loop` — cycle 04 : boucle TDD RED/GREEN/REFACTOR + Tidy First (actif dès F)
- `validation-report` — cycle 05 : rapport Go/No-Go/Go-with-reservations
- `release-plan` — cycle 06 : SemVer, stratégie déploiement, rollback, smoke tests
- `run-monitor` — cycle 07 : Four Golden Signals, burn rate error budget, OODA
- `apprentissage-retro` — cycle 08 : PDCA/Kaizen + Kolb, DORA archive, harness-delta

**Justification** : chaque skill couvre exactement un cycle ou une responsabilité transverse. La liste est close pour le MVP — toute nouvelle skill passe par le SKILL.md template et le tableau de routage.

**Référence spec** : `06-skills-catalog-spec.md` §1 (inventory table), §2–§3 (skill drafts), §6 (matrice risk × skill).

---

### Q5.2 — Skills tournées vers l'utilisateur (slash commands) ou vers l'agent (auto-chargées) ?

**Réponse** : Les deux simultanément. Chaque skill est à la fois invocable en slash command (`/classify-risk`, `/status`, etc.) et auto-invoquée par le runtime agent via description-match. Il n'y a pas de mode exclusif — la même SKILL.md sert les deux vecteurs.

**Justification** : sur Claude Code et Hermes, les skills installées deviennent automatiquement des slash commands ET des cibles de routing par description. Le champ `AUTO-INVOKE` du SKILL.md template déclare la condition d'auto-déclenchement. Sur Codex, le routing par description est optionnel — le slash command reste le vecteur principal. Les 4 skills core (`classify-risk`, `propose-change`, `status`, `transition-phase`) sont prioritairement auto-invoquées ; les skills cycle-specific sont prioritairement en slash.

**Référence spec** : `06-skills-catalog-spec.md` §4 (template SKILL.md — champ AUTO-INVOKE), `04-runtime-bindings-spec.md` §3.2 (SKILL.md format differences — colonne "Auto-invocation").

---

### Q5.3 — Comment éviter la collision entre nos skills et les skills déjà installées par l'utilisateur ?

**Réponse** : Namespace préfixé `harness-` pour tous les noms de skills harness installées dans les répertoires globaux. Les skills core restent sans préfixe dans la source monorepo (`classify-risk/SKILL.md`) mais sont enregistrées avec préfixe côté plateforme : `harness-classify-risk`. Les trigger keywords du SKILL.md standard sont exclusifs — le harness possède les termes `classify`, `risk`, `advance`, `transition`, `retro`, etc. En cas de collision détectée à l'install, le harness loge un warning et renomme sa skill en `harness-<name>` sans casser l'existant.

**Justification** : `06-skills-catalog-spec.md` §4 Validation Rules impose l'unicité des trigger keywords. L'installateur implémente la détection de collision via `harness skill register --check-conflicts` avant toute écriture.

**Référence spec** : `06-skills-catalog-spec.md` §4 (validation rules — "Trigger keywords must be unique"), `04-runtime-bindings-spec.md` §5.1 step 5 (copy artifacts/skills — merge, pas overwrite).

---

### Q5.4 — Les skills sont-elles versionnées séparément ou ensemble avec le harness ?

**Réponse** : Les skills sont versionnées ensemble avec le harness dans le monorepo sous `packages/artifacts/skills/`. Il n'y a pas de versioning indépendant par skill au MVP. La version du harness (SemVer) couvre l'ensemble des skills. Un champ `version` optionnel dans le frontmatter SKILL.md est réservé pour tracking interne mais ne déclenche pas de résolution de dépendance séparée.

**Justification** : les skills sont des artefacts purs (Markdown), sans runtime propre. Leur sémantique est étroitement couplée aux types TS du core (`RiskClass`, `EvidenceSet`). Versionner séparément créerait des incompatibilités silencieuses entre skill v1.2 et core v2.0. Le couplage délibéré simplifie les migrations.

**Référence spec** : `06-skills-catalog-spec.md` §5.4 (monorepo source of truth — `packages/artifacts/skills/`), `04-runtime-bindings-spec.md` §5 (install behavior — skills copiées par l'installateur sans version autonome).

---

### Q5.5 — Liste exhaustive des subagents à fournir

**Réponse** : 9 subagents au total — 4 MVP core + 5 post-MVP étendus.

MVP (livrés avec le harness dès l'Étape 2) :
- `reviewer` — revue de code antagoniste, verdict APPROVED/CHANGES_REQUIRED, obligatoire M+
- `threat-modeler` — analyse STRIDE sur nouveaux flux de données, obligatoire É/C
- `test-writer` — rédige tests TDD RED aveugle à l'implémentation, obligatoire M+ en TDD
- `evidence-collector` — consolide l'Evidence Set, obligatoire toutes classes, toujours séquentiel en dernier

Post-MVP (Étape 3 et au-delà) :
- `security-auditor` — OWASP ASVS + DAST simulé + CVE dependencies, obligatoire É/C
- `accessibility-checker` — WCAG 2.2 AA, accessibility tree, obligatoire M+ (si UI)
- `perf-profiler` — latence p99/throughput/error rate contre SLO, obligatoire É/C
- `doc-generator` — README/ADR/CHANGELOG depuis diff, obligatoire É/C user-facing
- `retro-facilitator` — anime rétrospective cycle, collecte DORA, obligatoire M+

**Justification** : la liste MVP couvre les 4 rôles minimaux pour que l'Evidence Set soit complet (revue qualité, sécurité É/C, tests RED, consolidation). Les 5 post-MVP adressent des dimensions non bloquantes en MVP (a11y, perf, doc, retro animée).

**Référence spec** : `07-subagents-catalog-spec.md` §1 (inventory table), §2 (MVP core), §3 (post-MVP), §6 (matrice risk × subagent).

---

### Q5.6 — Les subagents sont-ils spawnés explicitement ou automatiquement sur certains événements ?

**Réponse** : Le harness spawne toujours explicitement. Aucun subagent ne se déclenche spontanément. C'est le hook `pre_tool` ou la logique de cycle dans le runtime qui appelle `spawnSubagent()` ou `spawnSubagentBatch()` au moment précis défini par le séquençage de cycle. Sur Claude Code, la description-match peut théoriquement auto-sélectionner un subagent, mais le harness désactive ce mode en spawnant toujours par nom pour garantir la portabilité.

**Justification** : `07-subagents-catalog-spec.md` §4 Annexe B — "Spawn : Auto (description match) ou explicite" pour Claude Code, mais "Harness spawn toujours explicite" est la règle transverse. Cela garantit la portabilité sur Codex (explicite uniquement) et Hermes (`delegate_task` explicite).

**Référence spec** : `07-subagents-catalog-spec.md` Annexe B (portabilité — colonne Spawn), `04-runtime-bindings-spec.md` §1 (worker.spawn_mode — "explicit" harness rule).

---

### Q5.7 — Les subagents ont-ils accès à `.planning/` ? En lecture, en écriture ?

**Réponse** : Les subagents n'ont pas accès à `.planning/`. Ils écrivent uniquement dans `.rms/runs/<run-id>/evidence/<subagent-name>/`. L'accès en lecture est limité aux fichiers explicitement passés en input JSON par le thread parent (ex : `diff`, `design_doc`, `interface_contracts`). Le thread parent lit `.planning/` et fournit les extraits pertinents — le subagent ne fait jamais de lecture directe sur le filesystem harness.

**Justification** : l'isolation de contexte est garantie nativement par les 3 plateformes. Le principe "le subagent reçoit uniquement son prompt système + input JSON + fichiers explicitement passés" (§7.2) empêche toute dépendance implicite sur `.planning/`. La règle `allowedTools: Write(path:.rms/runs/**/evidence/*)` dans le frontmatter Claude Code enforce la restriction.

**Référence spec** : `07-subagents-catalog-spec.md` §4.1 (frontmatter `allowedTools` — `Write(path:.rms/runs/**/evidence/*)`), §7.2 (isolation — "Il ne voit pas l'historique complet du thread parent"), §5.1 (circuit obligatoire — écriture dans `.rms/runs/<run-id>/evidence/` uniquement).

---

### Q5.8 — Le mode de l'agent principal s'applique-t-il aussi aux subagents ?

**Réponse** : Oui, par héritage de contrainte — pas par propagation de variable. Le thread parent n'envoie pas le mode (pairing/auto/bypass) au subagent. En revanche, c'est le thread parent qui décide de spawner ou non le subagent selon le mode courant. En mode bypass (T/F uniquement), seul `evidence-collector` est spawné. En mode pairing (É/C), tous les subagents obligatoires sont spawnés et leurs verdicts bloquants suspendent le run en attendant la décision humaine.

**Justification** : les subagents sont des workers techniques sans connaissance du mode opératoire. Le mode est une politique du harness, pas une variable d'exécution subagent. La matrice risk × subagent (§6) encode cette décision : le spawn conditionnel au mode est implicite dans la colonne applicable.

**Référence spec** : `07-subagents-catalog-spec.md` §6 (matrice — règle bypass : "en mode bypass, seul evidence-collector reste mandatory"), §5.3 (traitement des échecs — "verdict bloquant : suspendre le run, notifier le développeur").

---

### Q5.9 — Comment contraindre les subagents à respecter la classe de risque ?

**Réponse** : Deux mécanismes complémentaires. (1) Le champ `risk_class` est passé explicitement dans l'input JSON de chaque subagent — le subagent calibre sa profondeur d'analyse en fonction (ex : `reviewer` applique la checklist sécurité complète pour É/C, allégée pour M). (2) Le harness ne spawne que les subagents dont la colonne dans la matrice risk × subagent est M ou O pour la classe courante — les autres sont skipped sans même être instanciés.

**Justification** : `07-subagents-catalog-spec.md` §2.1 input schema du `reviewer` inclut `"risk_class": "M"`. La matrice §6 encode le filtre au niveau du runtime, via `getRequiredSubagents(riskClass, cycle)` (§8.2).

**Référence spec** : `07-subagents-catalog-spec.md` §2.1–§2.4 (champ `risk_class` dans tous les inputs), §6 (matrice), §8.2 (`getRequiredSubagents` — API TypeScript).

---

### Q5.10 — Les subagents peuvent-ils déclencher des hooks ?

**Réponse** : Non. Les subagents s'exécutent dans un contexte isolé qui n'a pas accès aux hooks du harness. Ils ne peuvent pas émettre d'événements hook vers le parent. Les résultats remontent exclusivement via le circuit Evidence Set → `events.jsonl` → thread parent. Sur Claude Code, un subagent peut potentiellement déclencher des hooks Claude natifs (PreToolUse, etc.) si ses tools sont autorisés à écrire des fichiers, mais le harness n'exploite pas ce canal — tout passe par le JSON structuré.

**Justification** : `07-subagents-catalog-spec.md` §5.2 Interdits explicites — "Un subagent ne doit jamais spawner d'autres subagents". Dans la même logique, déclencher des hooks harness constituerait un couplage implicite au-delà du périmètre déclaré. Le circuit obligatoire (§5.1) est le seul canal de communication autorisé.

**Référence spec** : `07-subagents-catalog-spec.md` §5.1 (circuit obligatoire), §5.2 (interdits explicites — profondeur 0 en MVP).

---

### Q5.11 — Y a-t-il une notion de subagent persistant (survit entre sessions) ou tous sont-ils éphémères ?

**Réponse** : Tous les subagents sont éphémères. Chaque spawn crée une conversation fraîche sans historique partagé. La persistance inter-sessions est assurée exclusivement via les artefacts écrits dans `.rms/runs/<run-id>/evidence/` et consolidés dans `evidence-set.json`. Un subagent spawné dans une session suivante reçoit en input les fichiers evidence de la session précédente si le thread parent juge pertinent de les inclure — mais le subagent lui-même n'a aucune mémoire propre.

**Justification** : `07-subagents-catalog-spec.md` §7.2 — "Chaque subagent reçoit un contexte isolé : il ne voit pas l'historique complet du thread parent." Cette isolation est garantie nativement par les 3 plateformes (Claude Code : contexte propre, Codex : thread séparé, Hermes : conversation fraîche). La persistance via fichiers est la seule mémoire cross-session.

**Référence spec** : `07-subagents-catalog-spec.md` §7.2 (isolation), Annexe B (portabilité — "Isolation contexte : Garantie sur les 3").

---

### Q5.12 — Comment partager du contexte entre subagents sans tout dupliquer ?

**Réponse** : Via les fichiers de l'Evidence Set en lecture partagée. Le thread parent passe à chaque subagent uniquement les références aux fichiers pertinents produits par les subagents précédents (ex : `threat_model_ref` passé au `reviewer` pour qu'il lise le threat model produit par `threat-modeler`). Les subagents ne se lisent pas directement — c'est toujours le thread parent qui orchestre quelles sorties alimentent quels inputs. Le séquençage recommandé (§7.4) encode l'ordre des dépendances : les subagents parallèles n'ont pas de dépendances inter-elles ; les dépendances sont séquentielles.

**Justification** : `07-subagents-catalog-spec.md` §2.1 input `reviewer` — champ `"threat_model_ref"` est un chemin fichier écrit par `threat-modeler`. §7.4 séquençage — les parallèles (`reviewer`, `security-auditor`, `accessibility-checker`) n'ont pas de dépendance mutuelle ; `evidence-collector` séquentiel les consolide en dernier.

**Référence spec** : `07-subagents-catalog-spec.md` §2.1 (reviewer input — `threat_model_ref`), §5.1 (circuit obligatoire — consolidation par evidence-collector), §7.4 (séquençage recommandé par cycle).

---

## Section 6 — MCP Servers

---

### Q6.1 — Le harness expose-t-il lui-même un MCP server ?

**Réponse** : Oui. Le harness expose un MCP server nommé `harness-state` via la commande `harness mcp-server`. Ce server expose les outils permettant à l'agent de lire et écrire l'état harness sans passer par des scripts de hooks — alternative propre aux lectures de `.rms/state/` depuis le contexte LLM. Les outils exposés incluent au minimum : `harness:get_state`, `harness:get_risk_class`, `harness:get_evidence_set`, `harness:log_event`.

**Justification** : `04-runtime-bindings-spec.md` §4.1–§4.3 montrent les trois configs MCP (`.mcp.json`, `config.toml`, `config.yaml`) qui enregistrent toutes `harness-state` avec `command: harness, args: [mcp-server]`. L'installateur écrit ces entrées systématiquement (§5.1 step 7, §5.2 step 7, §5.3 step 5).

**Référence spec** : `04-runtime-bindings-spec.md` §4 (config formats — entrée `harness-state` MCP dans les 3 formats), §5.1–§5.3 (installer steps — écriture `.mcp.json` / `config.toml` / `config.yaml`).

---

### Q6.2 — Quel transport pour le MCP server harness ? Quelle authentification ?

**Réponse** : Transport **stdio** uniquement pour le MVP. Le harness MCP server s'exécute comme sous-processus local lancé par la plateforme via `harness mcp-server` — pas d'exposition réseau, pas de port. L'authentification est implicite par le fait que le processus est lancé localement par l'utilisateur courant (même niveau de confiance que les hooks). Pas de token/OAuth au MVP — le MCP server n'accepte que des connexions stdio (pas HTTP, pas SSE).

**Justification** : stdio est le transport supporté sur les 3 plateformes (Claude Code : stdio/HTTP, Codex : stdio/Streamable HTTP, Hermes : stdio/HTTP/StreamableHTTP — `04-runtime-bindings-spec.md` §1, colonne `external_tool`). Stdio ne requiert aucune configuration réseau, est disponible partout, et correspond au modèle de confiance local. HTTP serait over-engineering pour un outil de développement mono-utilisateur.

**Référence spec** : `04-runtime-bindings-spec.md` §1 (external_tool binding — "MCP server (stdio / HTTP / SSE deprecated)" pour Claude, stdio/HTTP pour les autres), §4.1–§4.3 (configs MCP — `command: harness, args: [mcp-server]`, pas d'URL ni de port configuré).

---

### Q6.3 — Les outils MCP exposés sont-ils accessibles sur les 3 plateformes de la même manière ?

**Réponse** : Oui, avec une nuance de configuration. Le MCP server `harness-state` est enregistré dans trois formats de config différents (JSON pour Claude, TOML pour Codex, YAML pour Hermes) mais avec les mêmes `command` et `args`. Côté runtime, les outils MCP sont invoqués par l'agent de façon identique sur les 3 plateformes — le protocole MCP est le même. La seule différence est la config d'enregistrement (Tier 1 — reformatage seul, pas de transformation sémantique).

**Justification** : `04-runtime-bindings-spec.md` §7 (Portability Tiers) — les configs MCP sont classées Tier 1 : "Same command/args; reformatted as JSON (Claude .mcp.json), TOML (Codex config.toml), YAML (Hermes config.yaml)". La sémantique MCP elle-même est cross-plateforme par construction (standard Anthropic).

**Référence spec** : `04-runtime-bindings-spec.md` §7 (Tier 1 — MCP server configs), §4.1–§4.3 (les 3 formats de config MCP, même command/args).

---

### Q6.4 — Comment configurer les MCP servers tiers (GitHub, Slack, etc.) de manière portable entre les 3 plateformes ?

**Réponse** : Le harness fournit une commande `harness mcp add <name> --command <cmd> --args <args>` qui écrit l'entrée dans les 3 formats de config simultanément (ou pour la plateforme cible si `--target` est précisé). La source de vérité est un `mcp-registry.yaml` dans `.rms/config/` qui liste tous les MCP servers configurés pour le projet. L'installateur régénère les configs plateformes depuis ce fichier à chaque `harness install`. Les MCP servers tiers ne nécessitent pas de transformation — leur `command`/`args`/`env` sont identiques sur les 3 plateformes.

**Justification** : `04-runtime-bindings-spec.md` §8 (`PlatformAdapter` interface) — méthode `registerMcpServer(name, config: McpServerConfig)` est définie sur tous les adapters. `McpServerConfig` contient `command`, `args`, `env`, `transport` — champs identiques sur les 3 plateformes. Le reformatage Tier 1 gère la syntaxe.

**Référence spec** : `04-runtime-bindings-spec.md` §8 (`PlatformAdapter` interface — `registerMcpServer`/`unregisterMcpServer`), §7 Tier 1 (MCP configs — reformatage seul).

---

### Q6.5 — Le harness doit-il proxifier certains MCP servers (intercepter pour appliquer la classe de risque) ou les exposer directement ?

**Réponse** : Exposition directe. Le harness ne proxifie pas les MCP servers tiers. La classe de risque est appliquée en amont via le hook `pre_tool` qui intercepte tous les appels d'outils — y compris les outils MCP — avant leur exécution. Ce hook analyse `tool_name` et `tool_input` pour décider allow/deny selon la phase et la classe courante. Un proxy MCP serait une surcouche redondante et coûteuse en latence.

**Justification** : `04-runtime-bindings-spec.md` §2.3 `gate.pre_tool` — "Payload received : tool_name, tool_input, session_id, cwd, permission_mode". Le hook `PreToolUse` reçoit le nom de l'outil MCP et son input, ce qui suffit pour appliquer les règles harness. La proxification ajouterait un hop réseau sans gain fonctionnel.

**Référence spec** : `04-runtime-bindings-spec.md` §2.3 (gate.pre_tool — payload tool_name/tool_input, harness use : "enforce write-protection by phase, block destructive ops in wrong phase").

---

### Q6.6 — Comment gérer les MCP servers qui exigent OAuth (login interactif) en mode auto-décision ou bypass ?

**Réponse** : Le harness délègue entièrement la gestion OAuth à la plateforme. En mode auto-décision ou bypass, si un MCP server exige un flow OAuth non encore complété, la plateforme (Claude Code, Codex, Hermes) présente le flow interactif à l'utilisateur — le harness ne l'intercepte pas. Le harness logue l'événement `MCP_AUTH_REQUIRED` dans `events.jsonl` et continue. Si l'authentification échoue et que l'outil MCP est critique pour le cycle courant, le harness marque le gap dans l'Evidence Set (`known_gaps`) et continue en mode dégradé.

**Justification** : `04-runtime-bindings-spec.md` §9.1 Degradation Strategy Matrix — "MCP server registration : Any → Skip MCP server ; harness operates in file-only mode ; Log MCP_UNAVAILABLE". La même logique s'applique à l'indisponibilité OAuth. Le harness ne peut pas et ne doit pas tenter de gérer des flows OAuth — c'est le domaine de la plateforme et de l'utilisateur.

**Référence spec** : `04-runtime-bindings-spec.md` §9.1 (degradation matrix — MCP server indisponible → file-only mode), §9.2 (decision tree — fail-open sur erreur non gérée).

---

### Q6.7 — Comment versionner la configuration MCP (changer un endpoint) sans casser les sessions actives ?

**Réponse** : Via le `mcp-registry.yaml` versionné dans Git sous `.rms/config/`. Un changement d'endpoint est un commit dans ce fichier, suivi de `harness mcp sync` qui régénère les configs plateformes. Les sessions actives au moment du changement continuent avec l'ancienne config jusqu'à leur fin — la config MCP est chargée au démarrage de session, pas rechargée dynamiquement. Le changement prend effet à la prochaine session. Pour les endpoints critiques (prod → staging), le harness supporte des profils nommés dans `mcp-registry.yaml` (`env: production|staging`).

**Justification** : `04-runtime-bindings-spec.md` §8 (`PlatformAdapter` interface) — `registerMcpServer` est une opération d'installation, pas de hot-reload. Les configs MCP sont des fichiers statiques lus au démarrage de la plateforme. Aucune des 3 plateformes ne documente un rechargement dynamique de config MCP mid-session.

**Référence spec** : `04-runtime-bindings-spec.md` §8 (interface `registerMcpServer` — opération install-time), §5.1–§5.3 (installer steps — écriture des configs MCP à l'install).

---

### Q6.8 — Le harness fournit-il une CLI `harness mcp test` pour vérifier qu'un MCP server est bien configuré ?

**Réponse** : Oui. `harness mcp test [<name>]` est une commande incluse dans le harness CLI. Sans argument, elle teste tous les MCP servers enregistrés dans `mcp-registry.yaml`. Elle vérifie : (1) que le processus `command` est exécutable, (2) qu'une connexion stdio s'établit, (3) que le server répond à un ping MCP (`initialize` request), (4) que la liste des outils retournée correspond aux outils attendus. Le résultat est un rapport PASS/FAIL par server avec détail de la failure le cas échéant. Cette commande est également invoquée automatiquement par `harness install` en fin d'installation pour valider que les MCP servers configurés sont opérationnels.

**Justification** : la testabilité des intégrations MCP est une condition de DX acceptable. Sans `harness mcp test`, un MCP server mal configuré produit des erreurs silencieuses difficiles à diagnostiquer. La cohérence avec `harness check` (Q9.8 dans le document source) et `harness audit` impose une commande de vérification explicite.

**Référence spec** : `04-runtime-bindings-spec.md` §9.2 (decision tree — "Is this event registered on this platform?" → même logique de vérifiabilité appliquée aux MCP), §5 (installer behavior — la commande de test prolonge la validation post-install).

---

*Toutes les questions Q5.1–Q5.12 et Q6.1–Q6.8 sont tranchées. Aucune n'est différée.*
