 Rapport Documentaire - Mai 2026

  Périmètre: Claude Code, Codex et Hermes Agent, avec sources officielles et dépôts éditeurs consultés le 2 mai 2026. Les informations non trouvées
  ou ambiguës dans les sources consultées sont signalées explicitement.

  ## 1. Vue D’ensemble Par Plateforme

  ### Claude Code

  | Champ | Faits documentés |
  |---|---|
  | Éditeur | Anthropic |
  | Distribution | CLI, Desktop, web/remote, IDE integrations. Installation native via scripts, Homebrew, WinGet, gestion npm par package
  @anthropic-ai/claude-code. La documentation décrit aussi Claude Code dans l’Agent SDK. |
  | Licence | Aucune licence open source de Claude Code CLI n’est publiée dans les pages consultées. Le package npm indique SEE LICENSE IN
  README.md, donc le statut open source n’est pas établi par la doc consultée. |
  | Version actuelle observée | @anthropic-ai/claude-code npm latest: 2.1.126 au 2 mai 2026. Les release notes officielles consultées contiennent au  moins 2.1.120 du 28 avril 2026. |
  | Compatibilité | macOS 13+, Windows 10 1809+ / Windows Server 2019+, Ubuntu 20.04+, Debian 10+, Alpine 3.19+, 4 Go RAM minimum, x64 ou ARM64. Wi
  ndows natif utilise Git Bash si présent, sinon PowerShell; WSL2 est supporté pour le sandbox Linux. Source: Claude setup
  (https://code.claude.com/docs/en/setup). |
  | Modèles | La configuration documente les alias sonnet, opus, haiku et des IDs complets comme claude-sonnet-4-6, avec restrictions selon modes et  comptes. Source: subagents (https://code.claude.com/docs/en/sub-agents), permission modes (https://code.claude.com/docs/en/permission-modes). |
  | Extensibilité | Instructions CLAUDE.md, rules .claude/rules, skills SKILL.md, subagents Markdown, hooks, MCP, plugins, slash commands/skills. S
  ource: features overview (https://code.claude.com/docs/en/features-overview), skills (https://code.claude.com/docs/en/skills), hooks
  (https://code.claude.com/docs/en/hooks). |
  | Maturité documentaire | Très détaillée sur hooks, permissions, MCP, sandboxing, skills, subagents, observabilité. Gaps: licence CLI et statut
  open source non établis dans les pages docs; limites de concurrence subagents non exposées comme un simple quota global dans la page subagents
  consultée. |

  ### Codex

  | Champ | Faits documentés |
  |---|---|
  | Éditeur | OpenAI |
  | Distribution | Codex CLI local, IDE extension, Codex app, Codex web/cloud, SDK et automation. Source: Codex overview
  (https://developers.openai.com/codex/). |
  | Licence | Le dépôt officiel openai/codex est open source sous Apache-2.0. Source: GitHub openai/codex (https://github.com/openai/codex). |
  | Version actuelle observée | @openai/codex npm latest: 0.128.0; release GitHub rust-v0.128.0, publiée le 30 avril 2026. |
  | Compatibilité CLI | macOS 12+, Ubuntu 20.04+ / Debian 10+, Windows 11 via WSL2; 4 Go RAM minimum, 8 Go recommandés. Source: openai/codex instal
  l.md (https://github.com/openai/codex/blob/main/docs/install.md). |
  | Modèles | Docs Codex listent gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.3-codex-spark; Codex peut aussi pointer vers des fournisseurs
  compatibles Chat Completions ou Responses API. Source: Codex models (https://developers.openai.com/codex/models/). |
  | Extensibilité | AGENTS.md, hooks, skills, subagents, MCP, plugins, custom prompts dépréciés, slash commands. Source: Codex docs
  (https://developers.openai.com/codex/). |
  | Maturité documentaire | Très structurée sur config TOML, sandbox, AGENTS.md, hooks, skills, MCP, subagents. Gaps: les hooks sont encore derrière
  feature flag codex_hooks; certains champs de sortie sont documentés comme parsés mais non implémentés pour certains événements. Source: Codex hoo
  ks (https://developers.openai.com/codex/hooks/). |

  ### Hermes Agent

  | Champ | Faits documentés |
  |---|---|
  | Éditeur | Nous Research |
  | Distribution | Projet open source Python, installation par script depuis GitHub, CLI/TUI, gateway de messagerie, modes locaux et backends cloud
  /container. Source: Hermes quickstart (https://hermes-agent.nousresearch.com/docs/getting-started/quickstart). |
  | Licence | MIT License dans le dépôt officiel. Source: NousResearch/hermes-agent (https://github.com/NousResearch/hermes-agent). |
  | Version actuelle observée | Release GitHub v2026.4.30, nommée Hermes Agent v0.12.0 (2026.4.30), publiée le 30 avril 2026. |
  | Compatibilité | Linux, macOS, WSL2, Android Termux. Windows documenté via WSL2. Source: Hermes quickstart
  (https://hermes-agent.nousresearch.com/docs/getting-started/quickstart). |
  | Modèles | Providers documentés: Nous Portal, OpenAI Codex, Anthropic, OpenRouter, Z.AI, Kimi, MiniMax, Alibaba/Qwen, Hugging Face, Copilot, Ver
  cel AI Gateway, endpoints OpenAI-compatible, etc. Hermes exige au moins 64K tokens de contexte. Source: Hermes quickstart
  (https://hermes-agent.nousresearch.com/docs/getting-started/quickstart). |
  | Extensibilité | Context files, skills, hooks, plugins, MCP, delegate_task, terminal backends, cron, gateway commands, toolsets. Source: Hermes
  features overview (https://hermes-agent.nousresearch.com/docs/user-guide/features/overview). |
  | Maturité documentaire | Large couverture, avec détails précis pour context files, skills, delegation, security, config et MCP. Hooks documentés,
  mais répartis entre trois systèmes distincts, ce qui impose de distinguer gateway hooks, plugin hooks et shell hooks. |

  ## 2. Comparaison Des Primitives D’extension

  ### 2.1 Fichier D’instructions Persistant

  | Plateforme | Nom exact | Emplacement et chargement | Limites et interpolation |
  |---|---|---|---|
  | Claude Code | CLAUDE.md, CLAUDE.local.md, .claude/rules/*.md | Managed policy, projet ./CLAUDE.md ou ./.claude/CLAUDE.md, utilisateur ~/.claude
  /CLAUDE.md, local ./CLAUDE.local.md. Les fichiers dans les parents du cwd sont chargés au lancement; ceux des sous-dossiers sont chargés à la dem
  ande quand Claude lit des fichiers dans l’arborescence. Source: memory (https://code.claude.com/docs/en/memory). | Markdown. Cible recommandée: m
  oins de 200 lignes. Imports via @path/to/import, chemins relatifs ou absolus, profondeur récursive max 5. Les commentaires HTML bloc sont retirés
  avant injection. Pas de substitution générale de variables documentée pour CLAUDE.md. |
  | Codex | AGENTS.md, AGENTS.override.md | Global dans CODEX_HOME/~/.codex; projet depuis la racine jusqu’au cwd. À chaque niveau, Codex cherche A
  GENTS.override.md, puis AGENTS.md, puis les fallback filenames configurés. Les fichiers plus proches du cwd arrivent plus tard et peuvent préciser
  les règles. Source: AGENTS.md guide (https://developers.openai.com/codex/guides/agents-md/). | Markdown. Limite combinée projet project_doc_max_b
  ytes, défaut 32 KiB. Aucune interpolation de variables documentée dans AGENTS.md; CODEX_HOME contrôle le home Codex. |
  | Hermes | .hermes.md / HERMES.md, AGENTS.md, CLAUDE.md, SOUL.md, .cursorrules, .cursor/rules/*.mdc | Un seul type de contexte projet est chargé
  au démarrage selon priorité: .hermes.md -> AGENTS.md -> CLAUDE.md -> .cursorrules; SOUL.md est global et chargé séparément depuis HERMES_HOME. Les  AGENTS.md, CLAUDE.md, .cursorrules de sous-dossiers sont découverts progressivement. Source: Hermes context files
  (https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files). | UTF-8 text/Markdown. Limite: 20 000 caractères au démarrage, tr
  oncature head/tail; 8 000 caractères pour les hints progressifs. Les fichiers sont scannés contre prompt injection. Pas d’interpolation propre aux  context files documentée; ${VAR} existe dans config.yaml, pas dans les context files. |

  ### 2.2 Hooks Lifecycle Events

  | Dimension | Claude Code | Codex | Hermes |
  |---|---|---|---|
  | Événements documentés | SessionStart, Setup, UserPromptSubmit, UserPromptExpansion, PreToolUse, PermissionRequest, PermissionDenied, PostToolUs
  e, PostToolUseFailure, PostToolBatch, Notification, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, Ins
  tructionsLoaded, ConfigChange, CwdChanged, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, Elicitation, ElicitationResult,
  SessionEnd. Source: Claude hooks (https://code.claude.com/docs/en/hooks). | SessionStart, PreToolUse, PermissionRequest, PostToolUse, UserPromptS
  ubmit, Stop. Feature flag requis: [features] codex_hooks = true. Source: Codex hooks (https://developers.openai.com/codex/hooks/). | Trois systèm
  es. Gateway: gateway:startup, session:start, session:end, session:reset, agent:start, agent:step, agent:end, command:*. Plugin/shell: pre_tool_ca
  ll, post_tool_call, pre_llm_call, post_llm_call, on_session_start, on_session_end, on_session_finalize, on_session_reset, subagent_stop, pre_gate
  way_dispatch, pre_approval_request, post_approval_response, transform_tool_result, transform_terminal_output. Source: Hermes hooks
  (https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks). |
  | Configuration | JSON hooks dans ~/.claude/settings.json, .claude/settings.json, .claude/settings.local.json, managed policy, plugin hooks/
  hooks.json, frontmatter de skills/agents. | hooks.json ou tables [hooks] dans ~/.codex/ et <repo>/.codex/, plus plugins. | Gateway: ~/.hermes/
  hooks/<name>/HOOK.yaml + handler.py. Plugin: ctx.register_hook() dans plugin Python. Shell: bloc hooks: dans ~/.hermes/config.yaml, scripts sous
  ~/.hermes/agent-hooks/ par convention. |
  | Types d’exécution | command, http, mcp_tool, prompt, agent. Les hooks HTTP reçoivent POST JSON; les hooks agent peuvent lancer un subagent de
  vérification. | command documenté. Commandes lancées avec cwd de session et timeout. | Gateway et plugin sont Python; shell hooks acceptent
  n’importe quel exécutable avec shebang. Les handlers Python peuvent appeler HTTP ou lancer un agent manuellement, mais il n’y a pas un type hook
  déclaratif prompt/agent équivalent à Claude dans la config shell. |
  | Données | JSON commun avec session_id, transcript_path, cwd, permission_mode, champs spécifiques; stdin pour command, body POST pour HTTP. |
  JSON stdin/stdout; champs communs selon événement; matchers par outil ou source. | Gateway: handle(event_type, context). Plugin: kwargs Python.
  Shell: JSON stdin avec hook_event_name, tool_name, tool_input, session_id, cwd, extra; stdout JSON. |
  | Blocage | exit 2 ou JSON. Blocage documenté pour PreToolUse, PermissionRequest, UserPromptSubmit, UserPromptExpansion, Stop, SubagentStop,
  PostToolBatch, PreCompact, etc. PostToolUse ne peut pas annuler l’action déjà passée. | PreToolUse peut deny; PermissionRequest allow/deny;
  UserPromptSubmit peut bloquer; Stop peut continuer/bloquer l’arrêt. Certains champs sont explicitement non supportés selon événement. |
  pre_tool_call peut retourner {"action":"block"}; pre_llm_call peut injecter contexte; pre_gateway_dispatch peut skip, rewrite, allow; transform_*
  peut remplacer résultats. Les erreurs de hook sont loggées et ne crashent pas l’agent. |
  | Injection de contexte | additionalContext, systemMessage, stdout de certains événements. Limite de 10 000 caractères pour sortie injectée. |
  UserPromptSubmit et PostToolUse peuvent fournir du contexte additionnel selon docs. | pre_llm_call retourne {"context": ...} ou string; injection
  dans le message utilisateur courant, éphémère, non persistée. |

  ### 2.3 Skills

  | Plateforme | Format et découverte | Fichiers liés | Partage/versioning |
  |---|---|---|---|
  | Claude Code | Répertoire avec SKILL.md, YAML frontmatter, Markdown. Emplacements: enterprise, ~/.claude/skills/<skill>/SKILL.md, .claude/skills
  /<skill>/SKILL.md, plugin skills. Claude peut charger automatiquement par description ou l’utilisateur invoque /skill-name. Source: Claude skills
  (https://code.claude.com/docs/en/skills). | references/, scripts/, templates, autres fichiers. Supporte substitutions $ARGUMENTS, arguments nommé
  s, ${CLAUDE_SESSION_ID}, ${CLAUDE_EFFORT}, ${CLAUDE_SKILL_DIR} et dynamic shell injection dans le contenu. | Bundled skills, plugins, marketplace.
  Les anciens fichiers .claude/commands/*.md restent pris en charge, mais les custom commands ont été fusionnées dans les skills. |
  | Codex | Répertoire avec SKILL.md. Découverte dans .agents/skills du cwd vers la racine, $HOME/.agents/skills, /etc/codex/skills; symlinks suppo
  rtés. Invocation explicite par prompt, /skills, mention $; invocation implicite par description selon config. Source: Codex skills
  (https://developers.openai.com/codex/skills/). | scripts/, assets/, fichiers de référence; chargement progressif du SKILL.md seulement quand séle
  ctionné. | Distribution via plugins; config [[skills.config]]; métadonnées agents/openai.yaml; curated skills via installateur. |
  | Hermes | Tous les skills locaux vivent sous ~/.hermes/skills/, source primaire et modifiable. Répertoires externes configurables via skills.ext
  ernal_dirs, en lecture seule. SKILL.md avec frontmatter name, description, version, platforms, metadata.hermes. Source: Hermes skills
  (https://hermes-agent.nousresearch.com/docs/user-guide/features/skills). | references/, templates/, scripts/, assets. Skills peuvent déclarer req
  uired_environment_variables et fichiers de credential à passer au sandbox. | Skills Hub, catalogue bundled/optional, agent-created skills via ski
  ll_manage. Les skills installés deviennent des slash commands. Différence notable: pas de notion “project skill” équivalente à .claude/skills; les  external dirs peuvent fournir un partage lecture seule. |

  ### 2.4 Subagents

  | Dimension | Claude Code | Codex | Hermes |
  |---|---|---|---|
  | Spawn | Claude délègue automatiquement si la description correspond, ou explicitement via demande utilisateur//agents. Built-ins: Explore, Plan,  general-purpose. | Codex ne spawn des subagents que si demandé explicitement. Built-ins: default, worker, explorer. /agent inspecte ou change de
  thread. Source: Codex subagents (https://developers.openai.com/codex/subagents/). | delegate_task lance des enfants; l’agent peut décider de délé
  guer selon complexité. Source: Hermes delegation (https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation). |
  | Définition | Markdown avec YAML frontmatter dans .claude/agents/, ~/.claude/agents/, managed, plugin, ou JSON CLI --agents. | TOML dans
  ~/.codex/agents/ ou .codex/agents/, avec name, description, instructions, options modèle, sandbox, MCP, skills. | Config delegation: dans
  ~/.hermes/config.yaml; pas un format de “custom subagent file” comparable dans la page delegation consultée. |
  | Isolation contexte | Chaque subagent a son propre contexte; il ne reçoit pas l’historique complet parent, seulement son prompt système et
  contexte projet, puis retourne un résultat. | Threads enfants séparés; option de fork selon mécanisme runtime, mais la doc produit décrit
  l’orchestration de threads et résultats. | Conversation fraîche isolée; seul le résumé final entre dans le contexte parent. Chaque subagent a sa
  propre session terminal. |
  | Communication | Parent délègue une tâche, enfant retourne une réponse finale. | Parent route input, attend ou ferme threads; output final
  remonte. | delegate_task est synchrone; parent bloque jusqu’à fin ou interruption. Enfants annulés si parent interrompu. |
  | Limites | maxTurns configurable. Les subagents ne peuvent pas spawn d’autres subagents. Pas de quota global simple trouvé dans la page. |
  agents.max_threads défaut 6; agents.max_depth défaut 1; timeout CSV jobs défaut 1800 s si non défini. | max_concurrent_children défaut 3;
  max_iterations défaut 50; max_spawn_depth défaut 1, cap 3; role="leaf" ou orchestrator. |

  ### 2.5 MCP Servers

  | Plateforme | Transports | Configuration et auth | Scopes/limites |
  |---|---|---|---|
  | Claude Code | stdio, HTTP, SSE. La doc signale SSE comme déprécié et recommande HTTP pour remote. Source: Claude MCP
  (https://code.claude.com/docs/en/mcp). | claude mcp add --transport http|sse|stdio; headers Bearer; env vars; OAuth 2.0 via /mcp; .mcp.json proje
  t, ~/.claude.json local/user, plugins. | Scopes local, project, user; precedence local > project > user > plugin > connectors; managed allow/deny;  variable expansion ${VAR} dans .mcp.json; output warning > 10 000 tokens. |
  | Codex | STDIO local et Streamable HTTP. Pas de SSE/websocket documenté pour Codex dans les pages consultées. Source: Codex MCP
  (https://developers.openai.com/codex/mcp/). | ~/.codex/config.toml et .codex/config.toml trusted; [mcp_servers.<name>]; command, args, env; HTTP
  url, bearer_token_env_var, headers; OAuth via codex mcp login. | enabled_tools, disabled_tools, scopes OAuth, remote/local env vars, timeouts. |
  | Hermes | stdio et HTTP/StreamableHTTP. Source: Hermes MCP config (https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference). |
  mcp_servers: dans ~/.hermes/config.yaml; command, args, env ou url, headers; auth: oauth pour OAuth 2.1 PKCE; tokens dans ~/.hermes/mcp-tokens/<s
  erver>.json. | tools.include, tools.exclude, resources, prompts; enabled:false; /reload-mcp; noms outils mcp_<server>_<tool> avec sanitization. |

  ### 2.6 Slash Commands Et Commandes Personnalisées

  | Plateforme | Format | Emplacement | Arguments | Différence avec skill |
  |---|---|---|---|---|
  | Claude Code | Les custom commands historiques sont des Markdown files, mais la doc indique qu’elles ont été fusionnées dans skills. .claude/com
  mands/deploy.md et .claude/skills/deploy/SKILL.md créent tous deux /deploy. Source: Claude skills (https://code.claude.com/docs/en/skills). | .cl
  aude/commands/, ~/.claude/commands/ legacy; skills dans .claude/skills ou ~/.claude/skills. | argument-hint, arguments, $ARGUMENTS, arguments nom
  més. | Skill ajoute répertoire de support, frontmatter riche, invocation automatique possible, hooks, modèle/effort/outils. |
  | Codex | Slash commands intégrées CLI/IDE; custom prompts Markdown dépréciés. Source: Codex slash commands
  (https://developers.openai.com/codex/cli/slash-commands/), custom prompts (https://developers.openai.com/codex/custom-prompts/). | Custom prompts:  ~/.codex/prompts/*.md, top-level seulement. | $1-$9, $ARGUMENTS, placeholders nommés, $$. | OpenAI recommande skills pour prompts réutilisables;
  custom prompts locaux, non partagés repo. |
  | Hermes | Registry central pour CLI et gateway; installed skills exposés comme /<skill-name>; quick commands dans ~/.hermes/config.yaml. Source:
  Hermes slash commands (https://hermes-agent.nousresearch.com/docs/reference/slash-commands). | quick_commands: dans config; skills dans ~/.hermes
  /skills/. | Quick commands type: exec ou type: alias; pas de prompt shortcut string-only supporté. | Skill est le support pour prompts longs/réut
  ilisables; quick command mappe vers shell ou autre slash command. |

  ## 3. Système De Permissions Et Sandbox

  | Plateforme | Permissions | Sandbox | Mode autonome/yolo |
  |---|---|---|---|
  | Claude Code | Règles allow, ask, deny dans settings, UI /permissions. Ordre d’évaluation: deny -> ask -> allow. Granularité par outil (Read, Ed
  it, Bash, WebFetch(domain:...), Agent(...), MCP tools). Source: permissions (https://code.claude.com/docs/en/permissions). | Sandboxed Bash docum
  enté, activable via /sandbox; filesystem et réseau via primitives OS: Seatbelt macOS, bubblewrap Linux; WSL2 supporté, WSL1 non. S’applique à Bash  et sous-processus, pas à tous les outils. Source: sandboxing (https://code.claude.com/docs/en/sandboxing). | Modes default, acceptEdits, plan, au
  to, dontAsk, bypassPermissions; --dangerously-skip-permissions active le bypass. Même en bypass, suppressions racine/home peuvent rester circuit
  breaker. |
  | Codex | Permissions/sandbox coordonnés par sandbox_mode, approval_policy, permission profiles. Granularité filesystem/network domains/unix sock
  ets, writable roots, command prefixes. Source: Codex sandbox (https://developers.openai.com/codex/concepts/sandboxing/). | Sandbox natif pour com
  mandes: macOS Seatbelt, Linux/WSL2 bubblewrap, Windows sandbox natif PowerShell et Linux sandbox via WSL2. Modes: read-only, workspace-write, dan
  ger-full-access. | Full access = sandbox_mode="danger-full-access" + approval_policy="never". Approval policies: untrusted, on-request, never. |
  | Hermes | Approval des commandes dangereuses via approvals.mode: manual, smart, off; allowlist permanente; outils activables/désactivables; webs
  ite blocklist et SSRF protection. Source: Hermes security (https://hermes-agent.nousresearch.com/docs/user-guide/security). | Backends terminal:
  local sans isolation, Docker, SSH, Modal, Daytona, Vercel Sandbox, Singularity. Docker durci avec cap-drop, no-new-privileges, pids-limit, tmpfs.
  Source: configuration (https://hermes-agent.nousresearch.com/docs/user-guide/configuration). | --yolo, /yolo, ou HERMES_YOLO_MODE=1 désactivent l
  es prompts de commande dangereuse, sauf hardline blocklist toujours active. |

  ## 4. Configuration

  | Plateforme | Fichier principal | Format | Hiérarchie | Profils/env |
  |---|---|---|---|---|
  | Claude Code | ~/.claude/settings.json, .claude/settings.json, .claude/settings.local.json; autres états dans ~/.claude.json; MCP projet dans .m
  cp.json. Source: settings (https://code.claude.com/docs/en/settings). | JSON avec schema officiel. | Managed highest, puis policy, local, project,
  user. Managed peut venir serveur, plist/registry, ou fichiers système. | Variables dans clé env; nombreuses variables CLAUDE_CODE_*, ANTHROPIC_*,
  OTEL. Pas de profils nommés génériques documentés dans les pages consultées. |
  | Codex | ~/.codex/config.toml, .codex/config.toml, hooks JSON, agents TOML. Source: Codex config basics
  (https://developers.openai.com/codex/config-basic/). | TOML, plus JSON pour hooks. | CLI flags/--config > profile > project config trusted root-t
  o-cwd > user > system /etc/codex/config.toml > defaults. | Profils nommés via [profiles.<name>] et --profile; env: CODEX_HOME, RUST_LOG, auth/pro
  vider vars, MCP env. |
  | Hermes | ~/.hermes/config.yaml, .env, auth.json, SOUL.md. Source: Hermes configuration
  (https://hermes-agent.nousresearch.com/docs/user-guide/configuration). | YAML + .env + JSON auth. | CLI args > ~/.hermes/config.yaml > ~/.hermes/
  .env > defaults. | Profils: hermes profile, chaque profil a son home/config/sessions/skills. ${VAR} interpolation dans config.yaml; bare $VAR non
  supporté. |

  ## 5. Observabilité Et Logging

  | Plateforme | Logs natifs | Audit/actions | Métriques |
  |---|---|---|---|
  | Claude Code | Transcripts de session, debug logs; hooks reçoivent transcript_path. Source: hooks (https://code.claude.com/docs/en/hooks). | Ope
  nTelemetry officiel: metrics, logs/events, traces beta; variables CLAUDE_CODE_ENABLE_TELEMETRY, OTEL_METRICS_EXPORTER, OTEL_LOGS_EXPORTER, endpoi
  nts OTLP, headers, gates pour prompts/tool details. Source: monitoring usage (https://code.claude.com/docs/en/monitoring-usage). | Tokens input/o
  utput/cache, coûts, durée, tool spans, permission duration, hook duration, API errors. |
  | Codex | CLI TUI log par défaut ~/.codex/log/codex-tui.log; RUST_LOG; log_dir configurable. Source: openai/codex install.md
  (https://github.com/openai/codex/blob/main/docs/install.md). | Hooks et conversation logs selon interface; docs consultées ne montrent pas un exp
  ort OpenTelemetry natif Codex CLI. | Analytics/config existent, mais la page consultée ne documente pas un schéma métrique comparable à Claude OT
  el. |
  | Hermes | ~/.hermes/logs/ avec agent.log, errors.log, gateway.log; hermes logs filtre par niveau, session, temps, composant; rotation via Python
  RotatingFileHandler. Source: Hermes CLI commands (https://hermes-agent.nousresearch.com/docs/reference/cli-commands). | hermes debug share inclut
  infos système et logs récents avec clés redacted; gateway/auth logs. | hermes insights fournit analytics token/coût/activité sur une fenêtre temp
  orelle. Pas d’OpenTelemetry natif trouvé dans les docs consultées. |

  ## 6. Tableau De Synthèse Cross-Plateforme

  | Primitive | Claude Code | Codex | Hermes | Portabilité |
  |---|---|---|---|---|
  | Instructions persistantes | Supporté, mature: CLAUDE.md, rules, imports @. | Supporté, mature: AGENTS.md, override, hiérarchie, limite 32 KiB. |  Supporté, mature/partiel: multiples noms, priorité stricte, limites 20K/8K. | Portable si contenu Markdown séparé; créer adaptateurs CLAUDE.md ->
  import AGENTS.md, ou choisir AGENTS.md pour Codex/Hermes. |
  | Hooks | Supporté, très riche: nombreux événements, command/http/mcp/prompt/agent. | Supporté mais feature flag; 6 événements, command hooks. |
  Supporté mais hétérogène: gateway/plugin/shell. | Portable seulement pour noyau pre_tool, post_tool, pre_prompt/pre_llm, stop/subagent_stop;
  adapter noms et décisions. |
  | Skills | Supporté, SKILL.md, Agent Skills, personal/project/plugin/enterprise. | Supporté, SKILL.md, .agents/skills, plugins. | Supporté,
  SKILL.md, ~/.hermes/skills, external dirs, skill_manage. | Très portable au niveau contenu SKILL.md; chemins, frontmatter avancé et invocation
  diffèrent. |
  | Subagents | Supporté, auto ou explicite; Markdown; pas de nested subagents. | Supporté, explicite seulement; TOML; max threads/depth. | Supporté  via delegate_task; sync; 3 enfants défaut; nested opt-in. | Concept portable: tâche isolée + résumé. Mécanismes et limites non portables. |
  | MCP | Supporté: stdio, HTTP, SSE déprécié, OAuth. | Supporté: stdio, Streamable HTTP, OAuth/Bearer. | Supporté: stdio, HTTP/StreamableHTTP,
  OAuth 2.1 PKCE. | MCP est la primitive la plus standardisée. Config et auth restent spécifiques. |
  | Slash/custom commands | Supporté via skills; commands legacy fusionnées. | Built-ins; custom prompts dépréciés; skills préférés. | Built-ins
  CLI/gateway, skills slash, quick commands. | Portable si représenté comme skill; moins portable si commande shell/alias spécifique. |

  ## 7. Patterns Communs Et Différences Structurelles

  Primitives sémantiquement proches: les trois plateformes reconnaissent des instructions persistantes Markdown, des skills sous forme de dossier
  avec SKILL.md, des serveurs MCP, des subagents avec contexte isolé, et des commandes slash ou assimilées. Le modèle commun le plus robuste est:
  “document Markdown léger pour contexte permanent, skill SKILL.md pour procédure réutilisable, MCP pour intégration externe, subagent pour travail
  isolé avec retour synthétique”.

  Divergences principales: les hooks ne sont pas isomorphes. Claude Code expose la matrice la plus large, avec hooks HTTP, prompt et agent; Codex
  documente un noyau plus petit derrière feature flag; Hermes sépare gateway hooks, plugin hooks et shell hooks. Les systèmes de permissions
  divergent aussi: Claude part de règles outils + modes + sandbox Bash; Codex part d’un sandbox général de commandes avec approval policy; Hermes
  part d’approvals de commandes dangereuses + choix du backend terminal.

  Conventions partagées: MCP est le standard explicite commun. SKILL.md est également convergent, Claude et Hermes déclarant une compatibilité Agent  Skills, et Codex reprenant ce format pour ses skills. Markdown frontmatter apparaît dans Claude skills/subagents, Hermes skills, et Codex custom
  agents TOML côté subagents mais SKILL.md côté skills.

  Capacités présentes sur une seule plateforme dans les sources consultées: Claude Code documente officiellement OpenTelemetry complet et hook types  http, mcp_tool, prompt, agent. Codex documente un système AGENTS.override.md, des profils TOML et des sandbox modes très explicites pour CLI.
  Hermes documente skill_manage, gateway multi-messagerie, quick_commands, profils isolés Hermes, delegate_task avec arbre de spawn configurable et
  backends terminal nombreux.

  ## 8. Sources Consultées

  Toutes consultées le 2 mai 2026.

  Claude Code:

  - https://code.claude.com/docs/en/setup
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/settings
  - https://code.claude.com/docs/en/permissions
  - https://code.claude.com/docs/en/permission-modes
  - https://code.claude.com/docs/en/sandboxing
  - https://code.claude.com/docs/en/hooks
  - https://code.claude.com/docs/en/mcp
  - https://code.claude.com/docs/en/monitoring-usage
  - https://registry.npmjs.org/@anthropic-ai/claude-code/latest

  Codex:

  - https://developers.openai.com/codex/
  - https://developers.openai.com/codex/models/
  - https://developers.openai.com/codex/guides/agents-md/
  - https://developers.openai.com/codex/hooks/
  - https://developers.openai.com/codex/skills/
  - https://developers.openai.com/codex/subagents/
  - https://developers.openai.com/codex/mcp/
  - https://developers.openai.com/codex/cli/slash-commands/
  - https://developers.openai.com/codex/custom-prompts/
  - https://developers.openai.com/codex/config-basic/
  - https://developers.openai.com/codex/concepts/sandboxing/
  - https://github.com/openai/codex
  - https://github.com/openai/codex/blob/main/docs/install.md
  - https://registry.npmjs.org/@openai/codex/latest
  - https://api.github.com/repos/openai/codex/releases/latest

  Hermes:

  - https://hermes-agent.nousresearch.com/docs
  - https://hermes-agent.nousresearch.com/docs/getting-started/quickstart
  - https://hermes-agent.nousresearch.com/docs/user-guide/configuration
  - https://hermes-agent.nousresearch.com/docs/user-guide/security
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation
  - https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference
  - https://hermes-agent.nousresearch.com/docs/reference/slash-commands
  - https://hermes-agent.nousresearch.com/docs/reference/cli-commands
  - https://github.com/NousResearch/hermes-agent
  - https://api.github.com/repos/NousResearch/hermes-agent
  - https://api.github.com/repos/NousResearch/hermes-agent/releases/latest