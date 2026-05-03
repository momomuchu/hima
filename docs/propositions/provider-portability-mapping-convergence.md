# Proposition - Mapping portable RMS entre Claude Code, Codex et Hermes

Statut: proposition de recherche et d'architecture
Date: 2026-05-03
Portee: RMS / Runtime Meta-Supervisor au-dessus de Claude Code, Codex et Hermes Agent

## 1. But

Le but n'est pas seulement de comparer trois coding agents. Le but est de
construire une couche centrale capable de traduire les intentions RMS vers les
primitives reelles de chaque provider, sans perdre les garanties importantes:
instructions persistantes, hooks, skills, subagents, MCP, permissions,
configuration, observabilite et preuves de completion.

Le probleme structurel est que les trois providers convergent sur les memes
familles de primitives, mais pas sur les memes semantiques exactes:

- Claude Code expose une surface tres riche: `CLAUDE.md`, `.claude/rules`,
  skills `SKILL.md`, subagents Markdown, hooks multi-types, MCP, permissions,
  sandbox Bash et OpenTelemetry.
- Codex expose une surface plus TOML/configuration: `AGENTS.md`,
  `AGENTS.override.md`, skills `SKILL.md`, subagents explicites, hooks derriere
  feature flag, MCP, sandbox/approval policies et profils.
- Hermes expose une surface plus runtime/gateway: context files multiples,
  skills `SKILL.md`, delegation `delegate_task`, hooks gateway/plugin/shell,
  MCP, approvals, terminal backends, profils, logs et insights.

Conclusion de depart: la couche RMS ne doit pas modeliser "un hook Claude" ou
"un agent Codex" comme concept central. Elle doit modeliser des intentions
abstraites, puis maintenir un mapping provider par provider.

```text
RMS concept -> provider binding -> runtime execution -> evidence
```

## 2. Protocole de recherche pour ne rien manquer

Pour converger vers une cartographie complete, la recherche doit etre
industrialisee en cycles repetables. Une lecture manuelle ponctuelle des docs ne
suffit pas: les docs changent, les CLI changent, et certaines capacites sont
documentees dans des pages secondaires.

### Cycle 1 - Source Coverage Set

Creer un inventaire des sources officielles par provider.

Pour Claude Code:

- `https://code.claude.com/docs/llms.txt`
- overview, memory, settings, permissions, permission modes, sandboxing
- hooks, skills, subagents, MCP, commands, plugins
- monitoring, env vars, CLI reference, Agent SDK pages pertinentes

Pour Codex:

- `https://developers.openai.com/codex`
- AGENTS.md, config basics/reference, hooks, skills, subagents, MCP
- sandboxing, slash commands, custom prompts, plugins, open source, CLI docs
- depot officiel `https://github.com/openai/codex`

Pour Hermes:

- `https://hermes-agent.nousresearch.com/docs`
- context files, skills, hooks, delegation, MCP config, security, configuration
- slash commands, CLI commands, profiles, logs/insights
- depot officiel `https://github.com/NousResearch/hermes-agent`

Sortie du cycle: `source-coverage-set.json`, avec URL, date d'acces, categorie,
statut lu/non lu, et primitive couverte.

### Cycle 2 - Primitive Inventory Set

Pour chaque provider, extraire les primitives dans une grille stable:

- instructions persistantes
- rules/context files secondaires
- hooks et lifecycle events
- skills/procedures reutilisables
- subagents/delegation/forks/teams
- MCP servers
- slash commands/custom commands
- permissions et sandbox
- config et profils
- plugins/distribution
- observabilite/logging/traces
- sessions, compaction, resume/fork si documentes
- scheduler/cron/routines si documentes

Chaque entree doit distinguer:

- `documented`: source officielle explicite
- `inferred`: inference depuis une source officielle
- `missing`: non trouve dans les sources lues
- `ambiguous`: source presente mais semantique incomplete

### Cycle 3 - Capability Binding Set

Transformer l'inventaire provider en capabilities RMS:

```yaml
id: gate.pre_tool
semantic_goal: inspect_or_block_before_tool_execution
portable_level: core
bindings:
  claude:
    primitive: hook
    event: PreToolUse
    blocking: true
    context_injection: limited
  codex:
    primitive: hook
    event: PreToolUse
    blocking: true
    feature_flag: codex_hooks
  hermes:
    primitive: hook
    event: pre_tool_call
    blocking: true
    systems: [plugin, shell]
losses: []
fallback: post_tool_audit_if_pre_hook_unavailable
sources:
  - https://code.claude.com/docs/en/hooks
  - https://developers.openai.com/codex/hooks
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
```

Le point important est de capturer les pertes. Une primitive peut etre "supportee"
sur les trois providers tout en perdant des options: hook HTTP chez Claude, hook
command seulement chez Codex, hooks gateway/plugin/shell chez Hermes.

### Cycle 4 - Runtime Probe Set

La documentation ne suffit pas. Le RMS doit aussi inspecter le runtime local:

- version CLI installee
- OS/shell effectif
- chemins de config charges
- feature flags actifs
- hooks effectivement detectes
- skills effectivement visibles
- subagents disponibles
- MCP servers disponibles et scopes
- mode permission/sandbox courant
- logs et traces accessibles

Sortie du cycle: `runtime-capability-set.json` par machine/session.

### Cycle 5 - Stress Fixtures Set

Construire des scenarios de test abstraits et les compiler vers chaque provider.

Scenarios minimaux:

1. charger une instruction projet stable;
2. ajouter une rule sous-dossier;
3. creer un skill avec `SKILL.md` + reference + script;
4. invoquer un skill manuellement;
5. laisser l'agent choisir un skill implicitement;
6. bloquer une commande dangereuse avant execution;
7. enrichir le contexte au submit prompt;
8. auditer un resultat apres outil;
9. lancer un worker isole;
10. connecter un MCP stdio;
11. connecter un MCP HTTP avec token;
12. produire une evidence finale lisible par RMS.

La boucle de convergence se termine seulement quand deux cycles consecutifs ne
detectent aucune nouvelle primitive ni perte non documentee.

## 3. Modele canonique RMS a mapper

Le modele central doit rester plus petit que les providers. Il doit porter les
intentions stables, pas les details de syntaxe.

```text
instruction.project
instruction.local
rule.path_scoped
procedure.skill
command.slash
gate.session_start
gate.user_prompt
gate.pre_tool
gate.permission_request
gate.post_tool
gate.stop
worker.isolated
tool.mcp
policy.permission
policy.sandbox
config.profile
observe.log
observe.metric
observe.trace
evidence.final
```

Pour chaque concept:

- `semantics`: ce que le RMS veut garantir;
- `provider_bindings`: implementation par provider;
- `support`: supported / partial / unsupported / no-op;
- `losses`: semantiques perdues;
- `fallback`: comportement RMS si absent;
- `evidence`: comment prouver que le binding est actif.

## 4. Mapping synthetique par primitive

| Concept RMS | Claude Code | Codex | Hermes |
|---|---|---|---|
| `instruction.project` | `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` | `AGENTS.md`, `AGENTS.override.md` | `.hermes.md`/`HERMES.md`, `AGENTS.md`, `CLAUDE.md` |
| `rule.path_scoped` | `.claude/rules/*.md` avec `paths` | AGENTS hierarchiques; fallback filenames configures | AGENTS/CLAUDE sous-dossiers decouverts progressivement |
| `procedure.skill` | `.claude/skills/<name>/SKILL.md`, personnel/projet/plugin | `.agents/skills`, user/admin/system, plugins | `~/.hermes/skills`, external dirs, Skills Hub |
| `command.slash` | skills exposes en `/name`; commands legacy fusionnees | slash commands natifs; custom prompts deprecies; skills preferes | skills exposes en slash; quick commands dans config |
| `gate.pre_tool` | hook `PreToolUse`, blocage possible | hook `PreToolUse`, feature flag `codex_hooks` | `pre_tool_call` plugin/shell, blocage possible |
| `gate.user_prompt` | `UserPromptSubmit`, injection/blocage possible | `UserPromptSubmit`, hook command | `pre_llm_call` ou gateway dispatch selon surface |
| `gate.post_tool` | `PostToolUse`, `PostToolUseFailure`, `PostToolBatch` | `PostToolUse` | `post_tool_call`, `transform_tool_result` |
| `gate.stop` | `Stop`, `StopFailure`, `SessionEnd` | `Stop` | `on_session_end`, `on_session_finalize`, `subagent_stop` |
| `worker.isolated` | subagent Markdown, delegation auto/explicite, contexte propre | subagents explicites, agents TOML, threads | `delegate_task`, conversation fraiche, contexte passe par parent |
| `tool.mcp` | stdio, HTTP, SSE deprecie; OAuth; scopes | stdio, Streamable HTTP; bearer/OAuth; TOML | stdio, HTTP; OAuth 2.1 PKCE; tool include/exclude |
| `policy.permission` | allow/ask/deny par outil; modes | approval policy + sandbox mode + permission profiles | approvals mode, smart/off/manual, hardline blocklist |
| `policy.sandbox` | sandbox Bash OS-level filesystem/network | sandbox commandes OS-native macOS/Linux/WSL2/Windows | backends local/docker/ssh/cloud; yolo + blocklist |
| `config.profile` | scopes managed/user/project/local; JSON | `~/.codex/config.toml`, `.codex/config.toml`, profiles | `~/.hermes/config.yaml`, `.env`, profils Hermes |
| `observe.trace` | OpenTelemetry metrics/logs/traces | logs CLI; pas d'OTel CLI equivalent trouve dans sources lues | logs + `hermes insights`; pas d'OTel natif trouve |

## 5. Proposition 1 - Binding Registry RMS

Cette proposition fait du registre de bindings la source de verite.

Structure:

```text
.rms/
  registry/
    primitives.yaml
    providers/
      claude-code.yaml
      codex.yaml
      hermes.yaml
    scenarios/
      stress-fixtures.yaml
  state/
    runtime-capability-set.json
```

Le RMS lit une demande, choisit des concepts abstraits, puis consulte le registre
pour savoir ce qui existe chez le provider actif.

Exemple:

```yaml
gate.stop:
  claude:
    support: supported
    event: Stop
    can_block: true
    can_continue: true
  codex:
    support: supported
    event: Stop
    feature_flag: codex_hooks
  hermes:
    support: partial
    event: on_session_finalize
    note: depends_on_hook_surface
```

Forces:

- implementation minimale;
- lisible et auditable;
- fonctionne bien avec l'actuel `rms-classifier.ts`;
- permet de dire explicitement "ce provider ne sait pas faire cette garantie".

Limites:

- ne genere pas automatiquement les fichiers provider;
- ne prouve pas seul que la config runtime charge vraiment le binding;
- peut devenir stale sans runtime probe regulier.

Cette option converge vers un RMS declaratif:

```text
Intent + Policy + Capability Registry -> Route Set -> Execution Plan
```

## 6. Proposition 2 - Compilateur d'assets portables

Cette proposition cree une representation canonique des assets, puis genere les
fichiers natifs de chaque provider.

Structure:

```text
rms-portable/
  instructions/
    project.md
    local.md
    rules/
      security.md
      testing.md
  skills/
    review-pr/
      SKILL.md
      references/
      scripts/
  hooks/
    pre-tool-policy.yaml
    stop-evidence.yaml
  mcp/
    servers.yaml
  permissions/
    workspace-policy.yaml

generated/
  claude/.claude/...
  codex/.codex/...
  codex/.agents/...
  hermes/...
```

Le compilateur produit:

- pour Claude: `CLAUDE.md`, `.claude/rules`, `.claude/skills`, hooks/settings,
  subagents, MCP/project config;
- pour Codex: `AGENTS.md`, `.agents/skills`, `.codex/config.toml`,
  `.codex/agents`, hooks;
- pour Hermes: `.hermes.md` ou `AGENTS.md`, skills, `config.yaml`, hook dirs,
  MCP config.

Forces:

- une source canonique pour instructions, skills et policies;
- facilite le partage entre providers;
- permet des tests de compilation par provider;
- rend visible les pertes de semantique a la generation.

Limites:

- risque de "plus petit denominateur commun" si le schema canonique est trop
  pauvre;
- risque inverse si le schema essaye d'absorber toutes les options provider;
- demande une suite de tests de round-trip: portable -> provider -> probe.

Cette option converge vers un systeme de packaging:

```text
Portable Assets -> Provider Generators -> Native Runtime Files -> Probe
```

## 7. Proposition 3 - Control Plane RMS avec adapters vivants

Cette proposition met le RMS au centre de l'execution. Le registre existe, mais
la decision principale vient d'une inspection vivante du provider courant.

Composants:

```text
RMS Classifier
RMS Capability Probe
RMS Policy Engine
RMS Provider Adapter
RMS Event Ledger
RMS Evidence Store
```

Chaque provider a un adapter:

```text
ClaudeCodeAdapter
  discover()
  renderRoute()
  invoke()
  collectEvidence()

CodexAdapter
  discover()
  renderRoute()
  invoke()
  collectEvidence()

HermesAdapter
  discover()
  renderRoute()
  invoke()
  collectEvidence()
```

Le RMS ne suppose pas qu'un binding statique marche. Il demande:

- quelle version est installee ?
- quel mode permission est actif ?
- les hooks sont-ils actifs ?
- les skills sont-ils visibles ?
- quel MCP est connecte ?
- comment prouver que la route a ete respectee ?

Forces:

- robuste contre les differences machine/session;
- aligne avec l'existant `thread.jsonl` et `HermesHarness.startRun()`;
- permet une evidence de completion provider-neutral;
- gere mieux les providers non isomorphes.

Limites:

- plus long a construire;
- exige des probes non destructifs par provider;
- demande une discipline stricte pour ne pas transformer le RMS en super-agent
  opaque.

Cette option converge vers un control plane:

```text
Intent -> Classify -> Probe -> Route -> Invoke Provider -> Ledger -> Evidence
```

## 8. Les trois solutions principales a proposer

### Solution A - Registry-first

Construire d'abord le registre declaratif des primitives et bindings.

Livrables:

- `primitives.yaml`
- `providers/claude-code.yaml`
- `providers/codex.yaml`
- `providers/hermes.yaml`
- `stress-fixtures.yaml`
- rapport de gaps documentes

Cette solution repond vite au besoin de "ne rien manquer", car elle force chaque
primitive a avoir un statut explicite par provider.

### Solution B - Compiler-first

Construire d'abord une source portable et des generateurs provider.

Livrables:

- schema portable pour instructions, skills, hooks, MCP, permissions;
- generateur Claude;
- generateur Codex;
- generateur Hermes;
- tests snapshot des fichiers generes;
- rapport de pertes de semantique.

Cette solution est adaptee si l'objectif prioritaire est de maintenir un seul
pack d'instructions/skills et de le deployer vers plusieurs harnesses.

### Solution C - Control-plane-first

Construire d'abord le RMS vivant: classifier, probe, adapter, ledger, evidence.

Livrables:

- extension de `src/rms/rms-classifier.ts` vers un `RuntimeCapabilitySet`;
- adapters provider typés;
- `thread.jsonl` enrichi avec `provider.discovered`, `route.bound`,
  `provider.invoked`, `evidence.collected`;
- probes non destructifs;
- final states RMS: `DONE_VERIFIED`, `DONE_WITH_GAPS`,
  `BLOCKED_RUNTIME_MISSING`, `BLOCKED_POLICY`, `LOOP_DETECTED`.

Cette solution est adaptee si l'objectif prioritaire est l'autonomie controlee
sur de vraies sessions, pas seulement la generation de fichiers.

## 9. Convergence proposee

Les trois solutions ne sont pas incompatibles. Elles representent trois ordres
de construction possibles.

Le chemin de convergence le plus coherent avec l'existant du repo est:

```text
Registry-first -> Control-plane-first -> Compiler-first
```

Raison technique:

1. Le repo possede deja un classifier RMS et un ledger Hermes.
2. Il manque un registre provider exhaustif pour eviter les oublis.
3. Une fois le registre stabilise, les probes peuvent prouver la realite runtime.
4. Le compilateur d'assets devient utile apres stabilisation du schema, pas avant.

La boucle de developpement a appliquer:

```text
Read official docs
-> update source coverage
-> update primitive inventory
-> update provider bindings
-> run stress fixture compile/probe
-> record losses and gaps
-> repeat until no new gaps for two cycles
```

Critere d'arret:

- toutes les primitives RMS ont un statut par provider;
- chaque statut `supported` a au moins une source officielle;
- chaque statut `partial` a une perte explicite;
- chaque statut `unsupported` a un fallback ou un blocage RMS;
- les stress fixtures passent en dry-run ou documentent un blocage;
- aucune nouvelle primitive n'apparait sur deux cycles consecutifs.

## 10. Gaps a traiter explicitement

Gaps documentaires ou structurels deja visibles:

- les hooks ne sont pas isomorphes: Claude est le plus riche, Codex est plus
  restreint et feature-flagged, Hermes se divise entre gateway/plugin/shell;
- les subagents ne sont pas equivalents: Claude peut deleguer automatiquement,
  Codex demande une instruction explicite, Hermes exige que le parent passe le
  contexte au `delegate_task`;
- les permissions ne se transposent pas directement: Claude raisonne par outil,
  Codex par sandbox/approval profiles, Hermes par approvals/backends/blocklist;
- l'observabilite n'est pas uniforme: Claude documente OpenTelemetry, Codex
  documente surtout logs/config, Hermes documente logs et insights;
- les skills convergent sur `SKILL.md`, mais les emplacements, l'invocation et
  les metadonnees provider-specific divergent;
- MCP est le standard commun le plus propre, mais la config, les scopes, l'auth
  et les filtres restent provider-specific.

## 11. Sources officielles consultees

Claude Code:

- https://code.claude.com/docs/llms.txt
- https://code.claude.com/docs/en/overview
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/permissions
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/sandboxing
- https://code.claude.com/docs/en/monitoring-usage

Codex:

- https://developers.openai.com/codex
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/hooks
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/concepts/sandboxing
- https://developers.openai.com/codex/config-basic
- https://developers.openai.com/codex/cli/slash-commands
- https://developers.openai.com/codex/custom-prompts
- https://github.com/openai/codex

Hermes:

- https://hermes-agent.nousresearch.com/docs
- https://hermes-agent.nousresearch.com/docs/user-guide/features/overview
- https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files
- https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation
- https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference
- https://hermes-agent.nousresearch.com/docs/user-guide/security
- https://hermes-agent.nousresearch.com/docs/user-guide/configuration
- https://github.com/NousResearch/hermes-agent
