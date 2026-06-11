# Proposition v2 - Mapping portable RMS entre Claude Code, Codex et Hermes

Statut: convergence de recherche et architecture
Date: 2026-05-03
Portee: couche RMS portable au-dessus de Claude Code, Codex et Hermes Agent
Entrees: rapport v1, notes provider independantes, critique architecturale, probe local non destructif

## 1. Decision de cadrage

Le mapping portable ne doit pas partir des noms natifs des providers. Il doit
partir de primitives RMS semantiques, puis produire des bindings par provider.
Les trois plateformes convergent sur les memes familles visibles:
instructions persistantes, hooks, skills, subagents/delegation, MCP, commandes,
permissions, configuration et observabilite. Elles divergent sur les garanties:
chargement, blocage, injection de contexte, isolation, scopes, maturite et
preuve runtime.

Le modele stable est donc:

```text
RMS semantic primitive
-> provider binding
-> runtime capability probe
-> route
-> provider execution
-> evidence
```

Le point critique est l'ordre d'autorite. Une source documentaire ne prouve pas
que le runtime local a charge la primitive. Un fichier genere ne prouve pas que
l'agent l'applique. Une sortie d'agent ne prouve pas la completion tant qu'elle
n'est pas enregistree comme evidence.

La conclusion de convergence v2 est:

```text
Registry-first -> thin control-plane/probe -> limited compiler -> full control-plane
```

Cette sequence garde les trois propositions demandees, mais les stabilise comme
trois etapes compatibles plutot que trois directions concurrentes.

## 2. Methode appliquee

La recherche v2 a ete conduite en quatre lanes separees:

- lane Claude Code: lecture officielle Claude Code, primitives et gaps RMS;
- lane Codex: docs OpenAI Codex + depot officiel `openai/codex`;
- lane Hermes: docs Hermes Agent + depot officiel `NousResearch/hermes-agent`;
- lane architecture: critique des trois solutions et ordre de convergence.

Les sorties sont persistees dans:

- `.omx/specs/autoresearch-provider-portability/provider-notes/claude-code.md`
- `.omx/specs/autoresearch-provider-portability/provider-notes/codex.md`
- `.omx/specs/autoresearch-provider-portability/provider-notes/hermes.md`
- `.omx/specs/autoresearch-provider-portability/provider-notes/architecture-review.md`
- `.omx/specs/autoresearch-provider-portability/iteration-log.md`

Le journal d'iteration enregistre le cycle de seed, les lanes provider
paralleles, la synthese v2 et la verification independante. Le verifier final a
approuve le document v2 sans finding bloquant; son seul point non bloquant etait
de rendre cette provenance plus explicite.

Un probe local non destructif a aussi ete execute:

| Runtime | Resultat local |
|---|---|
| Claude Code | present: `2.1.126 (Claude Code)` |
| Codex | present: `codex-cli 0.128.0` |
| Hermes | absent du PATH local |

Les versions externes verifiees pendant la boucle sont:

| Provider | Version/release observee | Licence observee |
|---|---|---|
| Claude Code | NPM `@anthropic-ai/claude-code` latest `2.1.126` | NPM: `SEE LICENSE IN README.md` |
| Codex | NPM `@openai/codex` `0.128.0`; GitHub release `rust-v0.128.0`, publiee le 2026-04-30 | Apache-2.0 |
| Hermes Agent | GitHub release `v2026.4.30`, `Hermes Agent v0.12.0 (2026.4.30)`, publiee le 2026-04-30 | MIT |

La doc officielle des trois providers est non versionnee page par page. Les
claims doivent donc rester lies a la date d'acces `2026-05-03` et aux versions
runtime detectees au moment de l'execution.

## 3. Modele canonique RMS

Le noyau portable doit rester plus petit que les providers. Il doit exposer les
intentions stables suivantes:

| Primitive RMS | Semantique portable |
|---|---|
| `instruction.project` | Charger un contexte projet stable au debut ou pendant une session. |
| `instruction.local` | Charger des instructions propres a une machine ou un utilisateur. |
| `rule.path_scoped` | Appliquer des consignes seulement pour certains chemins. |
| `procedure.skill` | Declencher une procedure reutilisable avec fichiers lies. |
| `command.slash` | Exposer une commande conversationnelle ou interactive. |
| `gate.session_start` | Agir au debut d'une session. |
| `gate.user_prompt` | Inspecter ou enrichir le prompt utilisateur. |
| `gate.pre_tool` | Inspecter, modifier, bloquer ou approuver avant un outil. |
| `gate.permission_request` | Participer a une decision d'autorisation. |
| `gate.post_tool` | Auditer ou transformer le resultat d'un outil. |
| `gate.stop` | Autoriser, bloquer ou enrichir la cloture. |
| `worker.isolated` | Deleguer a un agent avec contexte/isolation limites. |
| `tool.mcp` | Connecter un serveur MCP et borner ses outils. |
| `policy.permission` | Decrire la politique d'autorisation. |
| `policy.sandbox` | Decrire la frontiere d'execution. |
| `config.profile` | Selectionner une variante runtime/configuration. |
| `observe.log` | Recuperer les logs natifs. |
| `observe.metric` | Recuperer des metriques si disponibles. |
| `observe.trace` | Recuperer des traces si disponibles. |
| `evidence.final` | Produire une preuve finale suffisante pour cloture. |

Chaque primitive doit avoir:

- un statut provider: `supported`, `partial`, `unsupported`, `unknown`;
- une source officielle;
- une perte explicite quand le statut est `partial`;
- un fallback ou un blocage RMS;
- une evidence attendue prouvant que le binding est actif.

## 4. Mapping provider consolide

| RMS concept | Claude Code | Codex | Hermes |
|---|---|---|---|
| Instructions persistantes | `CLAUDE.md`, `.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`, `CLAUDE.local.md`, imports `@path` | `AGENTS.md`, `AGENTS.override.md`, global/projet, limite `project_doc_max_bytes` | `.hermes.md`/`HERMES.md`, `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `SOUL.md` |
| Rules/path scoped | `.claude/rules/*.md` avec frontmatter `paths` | `.rules` Starlark experimental; AGENTS hierarchiques | contexte de sous-dossier progressif; `.cursor/rules/*.mdc` |
| Skills | `SKILL.md`, scopes personnel/projet/plugin/enterprise | `SKILL.md`, repo/user/admin/system/plugins | `SKILL.md`, `~/.hermes/skills`, external dirs, Skills Hub |
| Slash/custom commands | Skills exposes en commandes; legacy `.claude/commands/*.md` | slash commands natifs; custom prompts deprecies; skills preferes | slash commands, skill slash commands, quick commands `exec`/`alias` |
| Hooks pre-tool | `PreToolUse`, blocage, mise a jour input, contexte additionnel | `PreToolUse`, feature flag `codex_hooks`, surface plus etroite | `pre_tool_call` via plugin/shell, blocage possible |
| Hooks prompt | `UserPromptSubmit`, `UserPromptExpansion` | `UserPromptSubmit` | `pre_llm_call`, `pre_gateway_dispatch` selon surface |
| Hooks post-tool | `PostToolUse`, `PostToolUseFailure`, `PostToolBatch` | `PostToolUse` | `post_tool_call`, `transform_tool_result` |
| Hooks stop/session | `Stop`, `StopFailure`, `SessionEnd`, `PreCompact`, `PostCompact` | `Stop`, `SessionStart` | `on_session_end`, `on_session_finalize`, `subagent_stop`, gateway session events |
| Hook action types | `command`, `http`, `mcp_tool`, `prompt`, `agent` | command handlers stables; autres surfaces plus partielles | gateway Python handlers, plugin hooks, shell hooks |
| Subagents/delegation | `.claude/agents`, contexte propre, worktree isolation possible | agents TOML, built-ins `default`/`worker`/`explorer`, spawn explicite | `delegate_task`, fresh context, toolsets restreints, enfants non durables |
| MCP client | stdio, HTTP, SSE, OAuth, scopes local/project/user | stdio, Streamable HTTP, OAuth, bearer/env/header, allow/deny tools | stdio, HTTP, OAuth 2.1 PKCE, include/exclude tools/resources/prompts |
| MCP server | Pas le centre du mapping courant | Pas le centre du mapping courant | `hermes mcp serve` expose conversations/messages/approvals |
| Permissions | allow/ask/deny par outil; modes `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | `approval_policy`, `sandbox_mode`, permission profiles | approvals `manual`/`smart`/`off`, yolo, hardline blocklist |
| Sandbox | OS sandbox pour Bash/subprocesses; pas universel | `read-only`, `workspace-write`, `danger-full-access`, OS sandbox | backend local/docker/ssh/cloud; isolation selon backend |
| Config/profiles | settings JSON par scopes; pas de profil nomme generique trouve | TOML global/projet/system, profiles experimentaux | YAML global, `.env`, `auth.json`, profiles Hermes |
| Observabilite | OpenTelemetry logs/metrics/traces, events hooks/tools/cost | logs, notify, status, feedback, OTEL config keys | `hermes logs`, `hermes insights`, debug share, plugin Langfuse mentionne |
| Schedulers/channels | channels preview, `/loop`, `/schedule`, routines peu detaillees | pas une primitive centrale documentee | cronjob, gateway scheduler, background sessions |

## 5. Gaps structurels a ne pas masquer

### Hooks

Les hooks ne sont pas isomorphes.

Claude Code expose la surface la plus riche: nombreux events, types `command`,
`http`, `mcp_tool`, `prompt` et `agent`, blocage et injection de contexte. Codex
documente un sous-ensemble derriere feature flag `codex_hooks`; les command
handlers sont la base stable. Hermes divise la capacite entre gateway hooks,
plugin hooks et shell hooks.

Conclusion RMS: `gate.*` doit etre une famille de capabilities avec flags:
`can_block`, `can_modify_input`, `can_inject_context`, `can_call_http`,
`can_call_mcp_tool`, `can_spawn_agent`, `requires_feature_flag`,
`hook_surface`.

### Skills

`SKILL.md` est la convention la plus portable entre les trois. La portabilite
est forte pour instructions + fichiers lies, mais faible pour les metadonnees
avancees. Les scopes, l'auto-invocation, les variables, les outils autorises et
la distribution plugin/hub different.

Conclusion RMS: compiler un skill portable en deux couches:

1. `portable_skill`: nom, description, instructions, references, scripts,
   templates, assets;
2. `provider_overlay`: frontmatter et metadata propres a Claude/Codex/Hermes.

### Subagents

Les trois providers supportent une forme de delegation, mais pas la meme
semantique. Claude permet des subagents Markdown riches, avec contexte propre et
event hooks. Codex expose des subagents explicites, TOML/custom, avec limites de
threads/profondeur/timeout. Hermes expose `delegate_task`, frais et isole, mais
non durable et resume au parent.

Conclusion RMS: `worker.isolated` doit distinguer `context_policy`,
`spawn_policy`, `result_policy`, `durability` et `concurrency_limit`. Ne jamais
supposer qu'un subagent voit l'historique complet du parent.

### MCP

MCP est le standard commun le plus stable. Les trois providers supportent au
moins stdio et HTTP/Streamable HTTP selon les docs. Les differences sont dans
l'auth, les scopes, les filtres, les prompts/resources et la configuration.

Conclusion RMS: modeliser MCP comme:

```yaml
mcp_endpoint:
  transport: stdio | http | streamable_http | sse
  command: optional
  url: optional
  env: []
  headers: []
  auth: oauth | bearer | env | none
  tool_filter:
    include: []
    exclude: []
  resources: enabled | disabled | unknown
  prompts: enabled | disabled | unknown
```

### Permissions et sandbox

Les permissions et le sandbox sont deux couches separees. Claude raisonne
principalement par outils et modes, avec sandbox partiel. Codex combine
`approval_policy` et `sandbox_mode`. Hermes combine approvals, yolo, blocklist
et backend d'execution.

Conclusion RMS: ne pas compiler directement `workspace-write` vers un provider
qui n'a pas cette notion. Compiler vers deux objets:

```yaml
permission_policy:
  default_decision: ask | allow | deny
  tool_rules: []
  escalation: prompt | block | auto

execution_boundary:
  filesystem: read_only | workspace_write | unrestricted | backend_defined
  network: blocked | restricted | allowed | backend_defined
  process: sandboxed | local | container | remote
```

### Observabilite

Claude a la surface officielle la plus explicite pour OpenTelemetry. Codex
documente logs, notify, status, feedback et des cles OTEL. Hermes documente
logs, insights et un plugin Langfuse mentionne par la release. Les formats ne
sont pas suffisamment homogenes pour une couche unique sans normalisation.

Conclusion RMS: `Evidence Set` doit etre la source de verite, pas les logs
provider bruts. Les logs alimentent l'evidence, mais ne remplacent pas une
preuve structuree.

## 6. Proposition A - Registry-first

### Objectif

Construire un registre declaratif exhaustif des primitives RMS et des bindings
provider. Cette proposition repond directement au besoin "ne rien manquer".

### Artefacts

```text
.rms/
  sources/
    source-coverage-set.json
  registry/
    primitives.yaml
    providers/
      claude-code.yaml
      codex.yaml
      hermes.yaml
    losses.yaml
    fallbacks.yaml
  scenarios/
    stress-fixtures.yaml
```

### Schema minimal d'une entree

```yaml
id: gate.pre_tool
semantic_goal: inspect_or_block_before_tool_execution
portable_level: core
providers:
  claude-code:
    support: supported
    binding: hook.PreToolUse
    can_block: true
    can_modify_input: true
    can_inject_context: true
    sources:
      - https://code.claude.com/docs/en/hooks
  codex:
    support: partial
    binding: hook.PreToolUse
    requires_feature_flag: codex_hooks
    can_block: true
    can_modify_input: unknown
    losses:
      - hook surface is feature-flagged and narrower than Claude Code
    sources:
      - https://developers.openai.com/codex/hooks
  hermes:
    support: supported
    binding: pre_tool_call
    hook_surfaces: [plugin, shell]
    can_block: true
    losses:
      - event surface differs between gateway, plugin and shell hooks
    sources:
      - https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
fallback: post_tool_audit_if_pre_tool_gate_missing
evidence:
  - runtime probe shows hook installed and enabled
  - dry-run fixture records gate decision
```

### Forces

- Audit humain simple.
- Les pertes deviennent visibles.
- Les docs officielles restent liees a chaque claim.
- Compatible avec l'existant local: classifier RMS, ledger, Evidence Set.

### Limites

- Le registre peut devenir stale.
- Il ne prouve pas que le runtime local a charge les fichiers/configs.
- Il ne genere pas encore les assets providers.

### Role dans la convergence

Registry-first est l'etape 1. Elle fixe le vocabulaire, les statuts et les
fallbacks. Sans elle, un compilateur ou un control-plane risque de transporter
des suppositions invisibles.

## 7. Proposition B - Thin control-plane/probe

### Objectif

Ajouter une couche vivante minimale qui inspecte le runtime courant, produit un
`RuntimeCapabilitySet`, puis refuse les routes qui demandent des capabilities
absentes ou inconnues.

### Artefacts

```text
.rms/
  runtime/
    capability-set.claude-code.json
    capability-set.codex.json
    capability-set.hermes.json
  routes/
    route-set.json
  runs/
    events.jsonl
    evidence-set.json
    final-state.yaml
```

### Probes non destructifs minimaux

| Probe | But |
|---|---|
| version | Capturer CLI/version provider. |
| config paths | Verifier quels fichiers de config peuvent etre lus. |
| instruction discovery | Verifier quels fichiers instructions existent. |
| hook discovery | Verifier si hooks sont configures et feature flags actifs. |
| skill discovery | Lister skills visibles et scopes. |
| subagent discovery | Lister agents disponibles et limites. |
| MCP discovery | Lister serveurs, transports, auth/filtres. |
| permission mode | Capturer approvals/sandbox/modes. |
| observability | Verifier logs/traces exportables. |

### Exemple de RuntimeCapabilitySet

```json
{
  "provider": "codex",
  "version": "0.128.0",
  "detected_at": "2026-05-03",
  "instructions": {
    "project_doc": "AGENTS.md",
    "override_doc": "AGENTS.override.md",
    "max_bytes": 32768
  },
  "hooks": {
    "enabled": "unknown",
    "requires_feature_flag": "codex_hooks",
    "events": ["SessionStart", "PreToolUse", "PermissionRequest", "PostToolUse", "UserPromptSubmit", "Stop"]
  },
  "sandbox": {
    "modes": ["read-only", "workspace-write", "danger-full-access"],
    "current": "unknown"
  },
  "limitations": [
    "hook support must be verified from loaded config before enforcement"
  ]
}
```

### Forces

- Separe docs et realite runtime.
- Permet des final states plus honnetes: `DONE_WITH_GAPS`,
  `BLOCKED_RUNTIME_MISSING`, `BLOCKED_POLICY`.
- Aligne le RMS avec l'Evidence Set: pas de `DONE_VERIFIED` sans preuve.

### Limites

- Plus de code et de tests que le registre seul.
- Les probes doivent rester non destructifs.
- Le control-plane doit rester fin au debut: il inspecte et route, il ne devient
  pas un super-agent autonome.

### Role dans la convergence

Le control-plane thin est l'etape 2. Il verifie la charge reelle des
capabilities avant execution. Il doit preceder le compilateur complet, car la
generation doit etre testee contre le runtime effectif.

## 8. Proposition C - Compiler-first limite

### Objectif

Generer des assets natifs provider a partir d'un pack portable, mais seulement
apres stabilisation du registre et des probes de base.

### Artefacts

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
      templates/
  gates/
    pre-tool-policy.yaml
    stop-evidence.yaml
  mcp/
    servers.yaml
  policies/
    permission.yaml
    boundary.yaml

generated/
  claude-code/
  codex/
  hermes/
```

### Tiers de generation

| Tier | Assets | Risque |
|---|---|---|
| Tier 1 | instructions projet/locales, rules simples, skills sans metadata avancee | faible |
| Tier 2 | MCP stdio/http, subagents simples, permissions non destructives | moyen |
| Tier 3 | hooks bloquants, injection contexte, yolo/bypass, gateway/cron/channels | eleve |

### Principe de compilation

Le compilateur ne doit pas cacher les pertes. Si un asset portable demande un
hook HTTP et que Codex ne garantit que command handler, la compilation doit
produire un diagnostic:

```yaml
asset: gates/pre-tool-policy.yaml
target: codex
status: degraded
losses:
  - no stable http hook handler in documented Codex hook surface
fallback:
  - command hook wrapper
  - post-tool audit if pre-tool unavailable
blocks_done_verified: true
```

### Forces

- Un seul pack portable pour instructions, skills, MCP et policies.
- Tests snapshot faciles pour les fichiers generes.
- Distribution multi-provider plus pratique.

### Limites

- Dangereux s'il demarre avant le registre: risque de faux plus petit
  denominateur commun.
- Dangereux sans probe: fichiers generes, mais non charges.
- Tier 3 exige des adapters provider specifiques.

### Role dans la convergence

Le compilateur est l'etape 3, pas le socle initial. Il devient utile quand la
semantique RMS et les losses provider sont deja connues.

## 9. Patterns portables a garder

### InstructionPack

Portable:

```yaml
instruction_pack:
  project: instructions/project.md
  local: instructions/local.md
  path_rules:
    - paths: ["src/**"]
      file: rules/src.md
```

Bindings:

- Claude Code: `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`.
- Codex: `AGENTS.md`, `AGENTS.override.md`, hierarchical docs.
- Hermes: `.hermes.md`, `HERMES.md`, `AGENTS.md`, `CLAUDE.md`, subdir context.

Portable if treated as context, not hard policy.

### SkillPack

Portable:

```yaml
skill_pack:
  name: review-pr
  description: Review a pull request with repository standards.
  files:
    - SKILL.md
    - references/checklist.md
    - scripts/collect_diff.ps1
```

Bindings:

- Claude Code: `.claude/skills/<name>/SKILL.md`.
- Codex: `.agents/skills/<name>/SKILL.md` or plugin skill.
- Hermes: `~/.hermes/skills/<name>/SKILL.md` or external dir.

Portable for core instructions/files. Metadata overlays are provider-specific.

### GateSpec

Portable:

```yaml
gate:
  id: gate.pre_tool
  phase: pre_tool
  required: true
  decisions: [allow, deny, ask, degrade]
  inject_context: optional
```

Bindings:

- Claude Code: `PreToolUse`, `PermissionRequest`, hook outputs.
- Codex: `PreToolUse`/`PermissionRequest` behind `codex_hooks`.
- Hermes: `pre_tool_call`, `pre_approval_request`, shell/plugin hooks.

Portable only with capability flags.

### DelegationSpec

Portable:

```yaml
delegation:
  id: worker.isolated
  context_policy: fresh | fork | selected
  result_policy: summary | structured_json | evidence_file
  concurrency: bounded
  durability: session | background | scheduled
```

Bindings:

- Claude Code: subagents, worktree isolation, background options.
- Codex: explicit subagents, TOML custom agents, max threads/depth.
- Hermes: `delegate_task`, background sessions, cron where durability matters.

Portable only if result/evidence policy is explicit.

### EvidenceSpec

Portable:

```yaml
evidence:
  required_for_done_verified:
    - runtime_capability_snapshot
    - route_binding_decision
    - provider_execution_log
    - verification_result
    - known_gaps
```

Bindings:

- Claude Code: OTel/log events and hook/tool events can feed evidence.
- Codex: logs/status/notify/OTEL config can feed evidence.
- Hermes: logs/insights/debug share/gateway events can feed evidence.

Portable because the RMS normalizes evidence, not because provider logs match.

## 10. Final states RMS

Le mapping provider doit alimenter des etats finaux explicites:

| Final state | Condition |
|---|---|
| `DONE_VERIFIED` | Evidence Set suffisant, route respectee, capabilities prouvees, aucun blocker. |
| `DONE_WITH_GAPS` | Travail utile termine, mais perte documentee ou evidence incomplete non bloquante. |
| `BLOCKED_RUNTIME_MISSING` | Provider/runtime ne possede pas une capability requise et aucun fallback acceptable. |
| `BLOCKED_POLICY` | Permission/sandbox/policy interdit l'action. |
| `BLOCKED_DOC_AMBIGUOUS` | Source officielle insuffisante pour compiler une garantie. |
| `LOOP_DETECTED` | Deux cycles repetent la meme hypothese sans nouvelle preuve. |

Cette table evite une fausse equivalence entre providers. Par exemple, un
hook post-tool peut suffire pour audit, mais pas pour une garantie de blocage
pre-tool. Le final state doit donc pouvoir degrader.

## 11. Critere d'arret de la recherche

La recherche documentaire peut passer en stabilisation quand:

1. toutes les primitives RMS ont un statut pour Claude Code, Codex et Hermes;
2. chaque statut `supported` possede une source officielle;
3. chaque statut `partial` liste une perte precise;
4. chaque `unsupported` ou `unknown` a un fallback ou un blocage RMS;
5. les stress fixtures couvrent instructions, skills, hooks, subagents, MCP,
   permissions et evidence;
6. les probes runtime dry-run passent ou produisent un blocker documente;
7. deux cycles consecutifs n'ajoutent aucune nouvelle primitive ni perte;
8. `DONE_VERIFIED` reste impossible sans Evidence Set suffisant.

Dans l'etat actuel, la recherche a assez converge pour definir les trois
solutions principales et leur ordre. Elle n'a pas encore execute les stress
fixtures natives sur les trois runtimes, car Hermes n'est pas present sur le
PATH local et les hooks providers n'ont pas ete installes dans un sandbox de
test.

## 12. Sources officielles

Claude Code, acces 2026-05-03:

- https://code.claude.com/docs/llms.txt
- https://code.claude.com/docs/en/overview
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/configuration
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/slash-commands
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/agent-teams
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/permissions
- https://code.claude.com/docs/en/sandboxing
- https://code.claude.com/docs/en/plugins-reference
- https://code.claude.com/docs/en/monitoring-usage
- https://code.claude.com/docs/en/channels
- https://code.claude.com/docs/en/commands

Codex, acces 2026-05-03:

- https://developers.openai.com/codex
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/config-basic
- https://developers.openai.com/codex/config-advanced
- https://developers.openai.com/codex/config-reference
- https://developers.openai.com/codex/rules
- https://developers.openai.com/codex/hooks
- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/plugins
- https://developers.openai.com/codex/plugins/build
- https://developers.openai.com/codex/concepts/sandboxing
- https://developers.openai.com/codex/cli/slash-commands
- https://developers.openai.com/codex/open-source
- https://github.com/openai/codex
- https://github.com/openai/codex/blob/main/LICENSE

Hermes Agent, acces 2026-05-03:

- https://hermes-agent.nousresearch.com/docs/
- https://github.com/NousResearch/hermes-agent
- https://github.com/NousResearch/hermes-agent/releases/tag/v2026.4.30
- https://hermes-agent.nousresearch.com/docs/user-guide/configuration
- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://hermes-agent.nousresearch.com/docs/reference/cli-commands
- https://hermes-agent.nousresearch.com/docs/user-guide/security
- https://hermes-agent.nousresearch.com/docs/user-guide/features/tools
- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files
- https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- https://hermes-agent.nousresearch.com/docs/user-guide/messaging
- https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation
- https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
- https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
- https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins
