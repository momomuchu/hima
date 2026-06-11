# Runtime Bindings Specification — Pipeline Fractale v4

> Status: conception v1
> Scope: Claude Code, Codex, Hermes Agent
> Depends on: `report-hermes-cdx-cld.md`, `rms-runtime-sets-v1-draft.md`, `checkpoint-implementation.md`
> Date: 2026-05-03

---

## 1. Binding Table — RMS Abstractions to Platform Primitives

Each RMS abstract concept maps to a concrete primitive on each platform. When a platform has no equivalent, the binding is `no-op` (traced, not silently dropped).

| RMS Concept | Claude Code | Codex | Hermes |
|---|---|---|---|
| **gate** | hook (command/http/mcp_tool/prompt/agent) | hook (command) behind `codex_hooks = true` flag | shell hook (script) or plugin hook (Python) or gateway hook |
| **session_start** | `SessionStart` hook | `SessionStart` hook | `on_session_start` plugin hook or `session:start` gateway hook |
| **user_prompt** | `UserPromptSubmit` hook | `UserPromptSubmit` hook | `pre_llm_call` plugin hook (closest semantic match) |
| **pre_tool** | `PreToolUse` hook | `PreToolUse` hook | `pre_tool_call` plugin/shell hook |
| **post_tool** | `PostToolUse` hook | `PostToolUse` hook | `post_tool_call` plugin/shell hook |
| **pre_compact** | `PreCompact` hook | `PreCompact` hook | `pre_compact` plugin/shell hook |
| **post_compact** | `PostCompact` hook | `PostCompact` hook | `post_compact` plugin/shell hook |
| **stop** | `Stop` hook | `Stop` hook | `on_session_end` + `on_session_finalize` plugin hooks |
| **subagent_start** | `SubagentStart` hook | no native executable MVP hook | no native executable MVP hook |
| **subagent_stop** | `SubagentStop` hook | no equivalent — `no-op` with capability flag `subagent_stop_hook: false` | `subagent_stop` plugin hook |
| **procedure.reusable** | skill in `.claude/skills/<name>/SKILL.md` or `~/.claude/skills/<name>/SKILL.md` | skill in `.agents/skills/<name>/SKILL.md` or `~/.agents/skills/<name>/SKILL.md` | skill in `~/.hermes/skills/<name>/SKILL.md` |
| **procedure.slash_command** | `/skill-name` (skills merged with commands) | `/skill-name` via skills; custom prompts deprecated | `/<skill-name>` via installed skill or `quick_commands` in config |
| **worker.isolated** | subagent (Markdown frontmatter in `.claude/agents/` or `~/.claude/agents/`) | subagent (TOML in `.codex/agents/` or `~/.codex/agents/`) | `delegate_task` (config in `~/.hermes/config.yaml`) |
| **worker.spawn_mode** | auto (by description match) or explicit | explicit only | explicit (`delegate_task` call) |
| **worker.max_depth** | 1 (subagents cannot spawn subagents) | `agents.max_depth` default 1 | `max_spawn_depth` default 1, cap 3 |
| **worker.max_concurrent** | not exposed as single global quota | `agents.max_threads` default 6 | `max_concurrent_children` default 3 |
| **external_tool** | MCP server (stdio / HTTP / SSE deprecated) | MCP server (stdio / Streamable HTTP) | MCP server (stdio / HTTP / StreamableHTTP) |
| **permission.allow** | `allow` rule in `settings.json` permissions block | `approval_policy: never` or `sandbox_mode: workspace-write` | `approvals.mode: off` or permanent allowlist |
| **permission.ask** | `ask` rule (default for most tools) | `approval_policy: on-request` | `approvals.mode: smart` (default) |
| **permission.deny** | `deny` rule in `settings.json` | `sandbox_mode: read-only` | tool disabled, or blocklist entry |
| **permission.sandbox** | macOS Seatbelt / Linux bubblewrap for Bash subprocess | macOS Seatbelt / Linux bubblewrap / Windows native sandbox | configurable backend: local, Docker (hardened), SSH, Modal, Daytona, Vercel Sandbox |
| **instructions.persistent** | `CLAUDE.md`, `~/.claude/CLAUDE.md`, `.claude/rules/*.md` | `AGENTS.md`, `AGENTS.override.md`, `~/.codex/AGENTS.md` | `.hermes.md` or `AGENTS.md` (priority order), `SOUL.md` for global |
| **observability.events** | run events stored through `.planning/run-set.json`; OpenTelemetry native (OTLP) | `~/.codex/log/codex-tui.log`; no native OTel documented | `~/.hermes/logs/agent.log`, `errors.log`, `gateway.log`; `hermes insights` for analytics |

---

## 2. Hook Event Mapping

The canonical `GateType` values and their full adapter bindings per platform. Runtime hooks are adapters/triggers for `GateType` decisions; native labels such as `PreToolUse` or `pre_tool_call` are external adapter event names, not canonical gate values.

### 2.1 session_start

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `SessionStart` | `SessionStart` | `on_session_start` (plugin) / `session:start` (gateway) |
| Config location | `~/.claude/settings.json` or `.claude/settings.json` | `~/.codex/config.toml` or `.codex/config.toml` | `hooks:` block in `~/.hermes/config.yaml` (shell) or `ctx.register_hook()` in plugin Python |
| Config format | JSON | TOML `[[hooks]]` tables behind `[features] codex_hooks = true` | YAML (shell) / Python (plugin) |
| Blocking | No — SessionStart is informational | Not documented as blocking | Not documented as blocking |
| Output format | stdout text injected as `additionalContext` (≤10 000 chars) | stdout text | `{"context": "..."}` for `pre_llm_call`; plain stdout for shell hooks |
| Harness use | load project state, inject phase + risk class into context | same | same |

### 2.2 user_prompt

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `UserPromptSubmit` | `UserPromptSubmit` | `pre_llm_call` (plugin) — closest semantic match |
| Config location | `~/.claude/settings.json` | `~/.codex/config.toml` | plugin Python via `ctx.register_hook("pre_llm_call", handler)` |
| Config format | JSON | TOML `[[hooks]]` tables behind `[features] codex_hooks = true` | Python |
| Blocking | Yes — `exit 2` or JSON `{"decision":"block","reason":"..."}` | Yes — can block with deny decision | Yes — return `{"action": "block"}` |
| Output format | JSON with optional `additionalContext` field | JSON stdout | Python dict returned from handler |
| Harness use | enforce mode rules, check risk class vs requested action, inject current phase |  same | same |

### 2.3 pre_tool

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `PreToolUse` | `PreToolUse` | `pre_tool_call` |
| Config location | `~/.claude/settings.json` | `~/.codex/config.toml` | `~/.hermes/config.yaml` hooks block or plugin |
| Config format | JSON | TOML `[[hooks]]` tables behind `[features] codex_hooks = true` | YAML or Python |
| Blocking | Yes — `exit 2` blocks the tool call | Yes — `deny` decision blocks | Yes — `{"action": "block"}` |
| Output format | JSON: `{"decision":"block","reason":"..."}` or `{"decision":"allow"}` | JSON stdout with allow/deny | JSON stdout (shell) or Python dict (plugin) |
| Payload received | `tool_name`, `tool_input`, `session_id`, `cwd`, `permission_mode` | same schema | `hook_event_name`, `tool_name`, `tool_input`, `session_id`, `cwd` in JSON stdin |
| Harness use | enforce write-protection by phase, block destructive ops in wrong phase |  same | same |

### 2.4 post_tool

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `PostToolUse` | `PostToolUse` | `post_tool_call` |
| Config location | `~/.claude/settings.json` | `~/.codex/config.toml` | `~/.hermes/config.yaml` or plugin |
| Config format | JSON | TOML `[[hooks]]` tables behind `[features] codex_hooks = true` | YAML or Python |
| Blocking | No — action already completed; can inject context and affect later finalization | PostToolUse context injection documented; cannot undo completed tool action | `transform_tool_result` can replace output, but cannot undo completed side effects |
| Output format | `additionalContext` in stdout injected into next turn | `additionalContext` | `{"result": ...}` from `transform_tool_result` |
| Harness use | record/evaluate output in `.planning/run-set.json`, update route state, check evidence accumulation for later gates |  same | same; `transform_tool_result` used for evidence capture |

### 2.5 stop

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `Stop` | `Stop` | `on_session_end` + `on_session_finalize` |
| Config location | `~/.claude/settings.json` | `~/.codex/config.toml` | plugin or `~/.hermes/config.yaml` |
| Config format | JSON | TOML `[[hooks]]` tables behind `[features] codex_hooks = true` | YAML or Python |
| Blocking | Yes — `exit 2` prevents stop, agent continues | Yes — can continue/block stop | Not documented as hard-blocking on session_end |
| Output format | JSON with `continue: true` to prevent stop | JSON | Return value from Python handler |
| Harness use | enforce Evidence Set sufficiency check before DONE; loop if evidence incomplete |  same | on_session_finalize used; no hard block available — record DONE_WITH_GAPS instead |

### 2.6 subagent_start

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `SubagentStart` | no native hook in executable MVP profile | no native hook in executable MVP profile |
| Config location | `~/.claude/settings.json` | no runtime config entry | no runtime config entry |
| Config format | JSON or wrapper contract | wrapper contract | Python / YAML gateway |
| Blocking | Yes when adapter supports a pre-spawn hook or wrapper | Yes only when harness owns spawn | Yes if plugin/gateway returns block action |
| Output format | JSON | JSON | Python dict |
| Harness use | record and authorize spawned-agent scope, max depth, write zones, and required evidence contract | same when launch is harness-mediated; otherwise capability gap | same |
| Degradation | Native hook in executable profile | Capability flag `subagent_start_hook: false` when unmanaged launches cannot be intercepted | Capability flag `subagent_start_hook: false`; future plugin/gateway support is not part of the executable MVP profile |

### 2.7 subagent_stop

| Dimension | Claude Code | Codex | Hermes |
|---|---|---|---|
| Event name | `SubagentStop` | **No equivalent** | `subagent_stop` (plugin hook) |
| Config location | `~/.claude/settings.json` | — | plugin Python |
| Config format | JSON | — | Python |
| Blocking | Yes | — | Not explicitly documented as blocking |
| Output format | JSON | — | Python dict |
| Degradation | Full support | Capability flag `subagent_stop_hook: false` — harness skips check, records DONE_WITH_GAPS | Partial support via plugin |

---

### 2.8 Executable Runtime Profile Contract

This table is the implementation-facing contract for runtime hook profiles. It is synchronized with `packages/core/src/runtime/runtime-profiles.ts` by `packages/core/test/runtime-profiles.test.ts`.

| Target | GateType | Native event | Can block | Supported | Command |
|---|---|---|---|---|---|
| `claude` | `session_start` | `SessionStart` | false | true | `harness hook session-start --format claude` |
| `claude` | `user_prompt` | `UserPromptSubmit` | true | true | `harness hook user-prompt-submit --format claude` |
| `claude` | `pre_tool` | `PreToolUse` | true | true | `harness hook pre-tool-use --format claude` |
| `claude` | `post_tool` | `PostToolUse` | false | true | `harness hook post-tool-use --format claude` |
| `claude` | `pre_compact` | `PreCompact` | true | true | `harness hook pre-compact --format claude` |
| `claude` | `post_compact` | `PostCompact` | false | true | `harness hook post-compact --format claude` |
| `claude` | `stop` | `Stop` | true | true | `harness hook stop --format claude` |
| `claude` | `subagent_start` | `SubagentStart` | true | true | `harness hook subagent-start --format claude` |
| `claude` | `subagent_stop` | `SubagentStop` | true | true | `harness hook subagent-stop --format claude` |
| `codex` | `session_start` | `SessionStart` | false | true | `harness hook session-start --format codex` |
| `codex` | `user_prompt` | `UserPromptSubmit` | true | true | `harness hook user-prompt-submit --format codex` |
| `codex` | `pre_tool` | `PreToolUse` | true | true | `harness hook pre-tool-use --format codex` |
| `codex` | `post_tool` | `PostToolUse` | false | true | `harness hook post-tool-use --format codex` |
| `codex` | `pre_compact` | `PreCompact` | true | true | `harness hook pre-compact --format codex` |
| `codex` | `post_compact` | `PostCompact` | false | true | `harness hook post-compact --format codex` |
| `codex` | `stop` | `Stop` | true | true | `harness hook stop --format codex` |
| `codex` | `subagent_start` | null | false | false | `harness hook subagent-start --format codex` |
| `codex` | `subagent_stop` | null | false | false | `harness hook subagent-stop --format codex` |
| `hermes` | `session_start` | `on_session_start` | false | true | `harness hook session-start` |
| `hermes` | `user_prompt` | `pre_llm_call` | true | true | `harness hook user-prompt-submit` |
| `hermes` | `pre_tool` | `pre_tool_call` | true | true | `harness hook pre-tool-use` |
| `hermes` | `post_tool` | `post_tool_call` | false | true | `harness hook post-tool-use` |
| `hermes` | `pre_compact` | `pre_compact` | true | true | `harness hook pre-compact` |
| `hermes` | `post_compact` | `post_compact` | false | true | `harness hook post-compact` |
| `hermes` | `stop` | `on_session_end` | false | true | `harness hook stop` |
| `hermes` | `subagent_start` | null | false | false | `harness hook subagent-start` |
| `hermes` | `subagent_stop` | `subagent_stop` | false | true | `harness hook subagent-stop` |

The profile contract is intentionally narrower than future platform possibilities. Plugin or gateway hooks that are not represented here are candidate extensions, not v0.1 enforcement proof.

Each target also carries a canonical runtime profile version. The current executable versions are `claude-profile-v2`, `codex-profile-v1`, and `hermes-profile-v1`. Runtime profile digest computation includes this version, so a profile-version change invalidates stale capability and binding evidence even when hook names stay unchanged.

### 2.9 Executable Blocking Proof Contract

`Can block` in the profile table is a runtime capability claim, not an enforcement authorization by itself. A blocking hook becomes usable for governed M/H/C enforcement only when its binding also has accepted executable proof.

Canonical proof types:

| Proof type | Native-equivalent use |
|---|---|
| `config_read` | Confirms configuration was read; does not prove runtime firing or blocking. |
| `manifest_digest` | Confirms installed file identity; does not prove runtime firing or blocking. |
| `dry_run` | Confirms `harness hook <event>` handles a fixture payload; does not prove runtime firing. |
| `negative_fixture` | Native-equivalent only when core-minted, `status=accepted`, and verifier-bound metadata is present; proves the runtime's documented block response shape. |
| `event_fire` | Native-equivalent only when core-minted, `status=accepted`, and verifier-bound metadata is present; proves the runtime invoked the hook in a real session. |
| `manual_attestation` | Checkpoint evidence only; never native-equivalent blocking proof. |

Binding rule:

| Hook shape | Required result |
|---|---|
| `canBlock=false`, native event present, digest proof current | `native`, `canBlock=false` |
| `canBlock=true`, native event present, digest proof current, core-minted accepted `negative_fixture` or `event_fire` with `observedAt`, `verifier`, `target`, `runtimeVersion`, `gateType`, `configDigest`, `result`, and `proofDigest`; proof `observedAt` is no earlier than the capability inspection, no later than the binding inspection, and no older than 15 minutes at binding time | `native`, `canBlock=true` |
| `canBlock=true`, native event present, digest proof current, only `manual_attestation` or no executable proof | `stale`, `canBlock=false` |
| `canBlock=true`, native event present, digest proof missing or mismatched | `stale`, `canBlock=false` |
| `canBlock=true`, native event present, digest proof current, but executable proof predates capability inspection, is future-dated against binding inspection, or exceeds the 15-minute trusted proof freshness window | `stale`, `canBlock=false` |

For trusted probe acquisition, `configDigest` is the observed runtime config content digest: target identity, canonical `runtimeVersion`, runtime profile digest, runtime config file digest, and install manifest digest when present. It is not only the static runtime profile digest. Changing the observed config, manifest, or runtime profile version invalidates the previous native binding unless a fresh probe records matching values.

This preserves the bootstrapping path: installers register supported hooks from the runtime profile before proof exists, but policy gates do not treat those hooks as blocking until `rms.probe_runtime` has stored core-minted accepted executable proof in `run-set.json`. Runtime config registration alone is not executable proof; `negative_fixture` proof is minted only after managed fixture verification, and `event_fire` proof is reserved for real runtime invocation evidence. Caller-submitted proof overrides through CLI or MCP inspection are candidate-only and cannot promote a blocking hook to native-enforceable status.

Runtime proof text fields are persisted in `run-set.json`; implementations must redact known secret patterns in proof `detail`, hook `notes`, and runtime `knownLimitations` before writing them.

Route-required gate handling is an assessment over the canonical binding table, not a second stored binding model. `bindRuntime()` persists a complete `GateType -> RuntimeBinding` map for the active target. `assessRouteRuntimeBindings()` derives the required gate set from baseline risk policy, planned delegation, and explicit per-risk policy overrides, then evaluates those gates against the existing binding table. If a later route requirement adds `subagent_stop` on Codex, the result is a reported `missing` binding gap, not a new synthesized binding record.

---

## 3. Skill Installation Paths

### 3.1 Path Resolution

| Scope | Claude Code | Codex | Hermes |
|---|---|---|---|
| Global (user) | `~/.claude/skills/<name>/SKILL.md` | `~/.agents/skills/<name>/SKILL.md` | `~/.hermes/skills/<name>/SKILL.md` |
| Project | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` (cwd → root traversal) | no project-level skill path; use `skills.external_dirs` (read-only) |
| Enterprise / system | managed policy layer | `/etc/codex/skills/<name>/SKILL.md` | `skills.external_dirs` entries in `~/.hermes/config.yaml` |
| Legacy compat | `.claude/commands/<name>.md` still supported | custom prompts deprecated, use skills | — |

### 3.2 SKILL.md Format Differences

| Feature | Claude Code | Codex | Hermes |
|---|---|---|---|
| Frontmatter fields | `name`, `description`, `argument-hint`, `model`, `effort`, `tools`, `allowed-tools` | `name`, `description`, `argument-hint`, `options` (model/sandbox/MCP) | `name`, `description`, `version`, `platforms`, `metadata.hermes`, `required_environment_variables` |
| Argument substitution | `$ARGUMENTS`, named args, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}` | `$1`–`$9`, `$ARGUMENTS`, named placeholders, `$$` | no documented skill-level argument substitution; quick_commands handle aliases |
| Auto-invocation | yes — by description match in Claude's routing | optional — by description match if configured | yes — installed skills become slash commands |
| Support files | `references/`, `scripts/`, `templates/` alongside SKILL.md | `scripts/`, `assets/` | `references/`, `templates/`, `scripts/`, `assets/` |
| Dynamic shell injection | yes — `${...}` shell expressions in content | not documented | not documented |

### 3.3 Harness Skill Artifacts

The harness ships skills under `artifacts/skills/`. The installer copies them to the correct platform path:

```
artifacts/skills/classify-risk/SKILL.md   →  ~/.claude/skills/classify-risk/SKILL.md   (Claude)
                                           →  ~/.agents/skills/classify-risk/SKILL.md   (Codex)
                                           →  ~/.hermes/skills/classify-risk/SKILL.md   (Hermes)
```

---

## 4. Config File Formats

### 4.1 Claude Code — `settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook session-start --format claude"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook user-prompt-submit --format claude"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook pre-tool-use --format claude"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook post-tool-use --format claude"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook stop --format claude"
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook subagent-start --format claude"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "harness hook subagent-stop --format claude"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [],
    "deny": []
  }
}
```

Written to: `~/.claude/settings.json` (global install) or `.claude/settings.json` (project install).

### 4.2 Codex — `config.toml`

```toml
# ~/.codex/config.toml
[features]
codex_hooks = true

[agents]
max_threads = 6
max_depth = 1

[[hooks.SessionStart]]

[[hooks.SessionStart.hooks]]
type = "command"
command = "harness hook session-start --format codex"

[[hooks.PreToolUse]]

[[hooks.PreToolUse.hooks]]
type = "command"
command = "harness hook pre-tool-use --format codex"

[[hooks.PostToolUse]]

[[hooks.PostToolUse.hooks]]
type = "command"
command = "harness hook post-tool-use --format codex"

[[hooks.UserPromptSubmit]]

[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = "harness hook user-prompt-submit --format codex"

[[hooks.Stop]]

[[hooks.Stop.hooks]]
type = "command"
command = "harness hook stop --format codex"
```

Note: `codex_hooks = true` is required. The installer must write this flag. Without it, all hooks are silently inactive.

### 4.3 Hermes — `config.yaml`

```yaml
# ~/.hermes/config.yaml
hooks:
  on_session_start:
    command: harness hook session-start
  pre_llm_call:
    command: harness hook user-prompt-submit
  pre_tool_call:
    command: harness hook pre-tool-use
  post_tool_call:
    command: harness hook post-tool-use
  on_session_end:
    command: harness hook stop
  subagent_stop:
    command: harness hook subagent-stop

skills:
  external_dirs: []

approvals:
  mode: smart
```

MCP servers (shared format across platforms, reformatted):

```yaml
# Hermes MCP entry in config.yaml
mcp_servers:
  harness-state:
    command: harness-mcp-server
    args: []
    enabled: true
```

```toml
# Codex MCP entry in config.toml
[mcp_servers.harness-state]
command = "harness-mcp-server"
args = []
```

```json
// Claude Code MCP entry in .mcp.json
{
  "mcpServers": {
    "harness-state": {
      "command": "harness-mcp-server",
      "args": []
    }
  }
}
```

---

## 5. Installer Behavior

`harness install <platform>` is idempotent. Running it twice must produce the same state.

### 5.1 Claude Code

Steps executed by `adapter-claude/src/installer.ts`:

1. Detect `~/.claude/` exists; abort with error if not found.
2. Read existing `~/.claude/settings.json` (or create empty `{}`).
3. Merge harness hooks into `hooks` block — do not overwrite existing non-harness hooks.
4. Write `HARNESS_INSTRUCTIONS` import into `~/.claude/CLAUDE.md` via `@~/.claude/skills/harness-core/SKILL.md`.
5. Copy `artifacts/skills/*` to `~/.claude/skills/`.
6. Copy `artifacts/subagents/*` to `~/.claude/agents/`.
7. Write `.mcp.json` entry for `harness-state` MCP server in project root (or `~/.claude.json` for global).
8. Write `~/.claude/skills/harness-core/SKILL.md` with harness context injection instructions.
9. Log installation manifest to `~/.claude/harness-install.json` (version, date, files written).

### 5.2 Codex

Steps executed by `adapter-codex/src/installer.ts`:

1. Detect `~/.codex/` exists; abort with error if not found.
2. Read existing `~/.codex/config.toml`; ensure `[features] codex_hooks = true` is present.
3. Merge harness hooks into `~/.codex/config.toml` as managed `[[hooks]]` tables.
4. Inject harness instructions into `~/.codex/AGENTS.md` (append section, do not replace existing content).
5. Copy `artifacts/skills/*` to `~/.agents/skills/`.
6. Copy `artifacts/subagents/*` to `~/.codex/agents/` (TOML format — generate from Markdown via `adapter-codex` transformer).
7. Write `[mcp_servers.harness-state]` into `~/.codex/config.toml`.
8. Write `artifacts/instructions/codex-specific.md` content into `~/.codex/AGENTS.md` under `## Harness` section.
9. Log installation manifest to `~/.codex/harness-install.json`.

### 5.3 Hermes

Steps executed by `adapter-hermes/src/installer.ts`:

1. Detect `~/.hermes/` exists; abort with error if not found.
2. Read existing `~/.hermes/config.yaml`; merge `hooks:` block (shell hooks approach — no Python plugin required for MVP).
3. Copy `artifacts/skills/*` to `~/.hermes/skills/`.
4. Write harness instructions into `~/.hermes/SOUL.md` under `## Harness` section (SOUL.md is global context, loaded separately).
5. Write `mcp_servers:` entry into `~/.hermes/config.yaml`.
6. No subagent file format — `delegate_task` is configured via `config.yaml` delegation section.
7. Write `artifacts/instructions/hermes-specific.md` as `~/.hermes/skills/harness-core/SKILL.md`.
8. Log installation manifest to `~/.hermes/harness-install.json`.

---

## 6. Capability Detection

### 6.1 Detection Algorithm

```typescript
// packages/core/src/capability-detector.ts

interface DetectionResult {
  runtime: 'claude' | 'codex' | 'hermes' | 'unknown';
  version: string | null;
  os: 'macos' | 'linux' | 'windows' | 'wsl';
  hooksAvailable: boolean;
  hooksFeatureFlag: boolean;  // Codex-specific
  hookSubset: GateType[];
  skillPaths: string[];
  subagentMaxDepth: number;
  subagentMaxConcurrent: number;
  mcpTransports: ('stdio' | 'http' | 'sse')[];
  sandboxMode: string | null;
  limitations: string[];
}

type GateType =
  | 'session_start'
  | 'user_prompt'
  | 'pre_tool'
  | 'post_tool'
  | 'stop'
  | 'subagent_start'
  | 'subagent_stop';

async function detectRuntime(): Promise<DetectionResult> {
  // Step 1 — environment variable probe (most reliable)
  if (process.env.CLAUDE_SESSION_ID || process.env.ANTHROPIC_MODEL) {
    return buildClaudeCapabilities();
  }
  if (process.env.CODEX_SESSION_ID || process.env.OPENAI_MODEL) {
    return buildCodexCapabilities();
  }
  if (process.env.HERMES_SESSION_ID || process.env.HERMES_HOME) {
    return buildHermesCapabilities();
  }

  // Step 2 — hook payload probe (harness is called from a hook)
  const stdinPayload = await readStdinJson();
  if (stdinPayload) {
    if ('permission_mode' in stdinPayload) return buildClaudeCapabilities();
    if ('hook_event_name' in stdinPayload) return buildHermesCapabilities();
    // Codex uses same JSON schema as Claude — disambiguate by config file presence
  }

  // Step 3 — config file presence on disk
  if (await fileExists(path.join(os.homedir(), '.claude', 'settings.json'))) {
    return buildClaudeCapabilities();
  }
  if (await fileExists(path.join(os.homedir(), '.codex', 'config.toml'))) {
    return buildCodexCapabilities();
  }
  if (await fileExists(path.join(os.homedir(), '.hermes', 'config.yaml'))) {
    return buildHermesCapabilities();
  }

  return { runtime: 'unknown', hooksAvailable: false, hookSubset: [], limitations: ['runtime not detected'] };
}

function buildCodexCapabilities(): DetectionResult {
  // Codex-specific: check feature flag
  const config = readToml(path.join(os.homedir(), '.codex', 'config.toml'));
  const featureFlag = config?.features?.codex_hooks === true;
  return {
    runtime: 'codex',
    hooksAvailable: featureFlag,
    hooksFeatureFlag: featureFlag,
    hookSubset: featureFlag
      ? ['session_start', 'user_prompt', 'pre_tool', 'post_tool', 'stop']
      : [],  // unmanaged subagent_start/subagent_stop absent on Codex
    subagentMaxDepth: config?.agents?.max_depth ?? 1,
    subagentMaxConcurrent: config?.agents?.max_threads ?? 6,
    mcpTransports: ['stdio', 'http'],
    limitations: featureFlag
      ? ['subagent_start_hook and subagent_stop_hook not available for unmanaged launches']
      : ['hooks disabled: set [features] codex_hooks = true in ~/.codex/config.toml'],
  };
}
```

### 6.2 Capability Flags Written to Runtime Capability Set

The detector records runtime capabilities under the strict PFV4 storage contract: summary fields in `.planning/state.yaml` and per-run evidence/events in `.planning/run-set.json`.

```json
{
  "runtime": "codex",
  "version": "0.128.0",
  "os": "macos",
  "hooksAvailable": true,
  "hooksFeatureFlag": true,
  "hookSubset": ["session_start", "user_prompt", "pre_tool", "post_tool", "stop"],
  "missingHooks": ["subagent_start", "subagent_stop"],
  "skillPaths": ["~/.agents/skills", ".agents/skills"],
  "subagentMaxDepth": 1,
  "subagentMaxConcurrent": 6,
  "mcpTransports": ["stdio", "http"],
  "sandboxMode": "workspace-write",
  "limitations": ["subagent_start_hook and subagent_stop_hook not available for unmanaged launches"],
  "detectedAt": "2026-05-03T10:00:00Z"
}
```

---

## 7. Portability Tiers

From `checkpoint-implementation.md §7.3`, refined with binding details.

### Tier 1 — Copy-paste (quasi-free)

These artifacts are written once, installed to different paths. No transformation.

| Artifact | Strategy |
|---|---|
| Instructions (CLAUDE.md / AGENTS.md / .hermes.md) | Single `artifacts/instructions/base.md` + per-platform suffixes (`claude-specific.md`, `codex-specific.md`, `hermes-specific.md`) |
| Skills (SKILL.md) | Identical SKILL.md content; only the destination path changes |
| MCP server configs | Same command/args; reformatted as JSON (Claude `.mcp.json`), TOML (Codex `config.toml`), YAML (Hermes `config.yaml`) |

### Tier 2 — Generate (per-platform transformation)

The harness generates platform-specific artifacts from a canonical source.

| Artifact | Source | Generated output |
|---|---|---|
| Subagent definitions | `artifacts/subagents/<name>.md` (canonical Markdown) | `.claude/agents/<name>.md` as-is (Claude); `~/.codex/agents/<name>.toml` generated from frontmatter (Codex); `config.yaml` delegation section (Hermes) |
| Slash commands | Represented as skills in `artifacts/skills/` | `/skill-name` on all three platforms automatically; no extra generation needed |

### Tier 3 — Abstract (true platform adapter)

Hooks require a platform adapter. The canonical gate interface is translated at install time.

| Gate | Claude binding | Codex binding | Hermes binding |
|---|---|---|---|
| `pre_tool` | `PreToolUse` command hook in settings.json | `PreToolUse` command hook in config.toml (requires feature flag) | `pre_tool_call` YAML hook in config.yaml |
| `stop` | `Stop` command hook | `Stop` command hook | `on_session_end` hook (no hard-block capability) |
| `subagent_start` | `SubagentStart` command hook | **no-op** for unmanaged launches | **no-op** in executable MVP profile |
| `subagent_stop` | `SubagentStop` command hook | **no-op** | `subagent_stop` plugin hook |

All three Tier 3 adapters call the same harness binary entry point: `harness hook <GateType>`. Claude Code appends `--format claude` and Codex appends `--format codex` so each executable output matches the target hook response schema; Hermes keeps native harness JSON in the executable MVP profile. The adapter abstracts registration and output transport, not policy logic.

### Tier 4 — Not portable (platform-specific only)

These features have no cross-platform semantic equivalent. The harness exposes them via platform-specific extensions (§10) but does not abstract them.

| Feature | Platform | Why not portable |
|---|---|---|
| Permission rules (allow/ask/deny per tool) | Claude Code | Codex uses sandbox_mode + approval_policy; Hermes uses approvals.mode — different granularity, different config format |
| Sandbox configuration (Seatbelt, bubblewrap) | Claude + Codex | Hermes uses backend selection (Docker, SSH, Modal) — entirely different model |
| Hook types `http`, `mcp_tool`, `prompt`, `agent` | Claude Code only | Codex documents `command` only; Hermes has no declarative equivalent |
| Gateway hooks (multi-messaging channels) | Hermes only | Claude and Codex have no gateway layer |
| Plugin hooks (Python, `ctx.register_hook`) | Hermes only | Claude and Codex hooks are script/command only |
| Profiles (`[profiles.<name>]`) | Codex only | Claude has no named profiles; Hermes uses separate profile homes |
| `AGENTS.override.md` | Codex only | No equivalent on Claude or Hermes |
| OpenTelemetry native export | Claude Code only | Codex and Hermes have no native OTel documented |

---

## 8. Adapter Interface

Each adapter package must implement this TypeScript interface.

```typescript
// packages/core/src/adapter.ts

export interface PlatformAdapter {
  readonly platform: 'claude' | 'codex' | 'hermes';
  readonly version: string;

  // Installation
  install(options: InstallOptions): Promise<InstallResult>;
  uninstall(): Promise<void>;
  isInstalled(): Promise<boolean>;

  // Hook registration
  registerHook(gateType: GateType, command: string): Promise<void>;
  unregisterHook(gateType: GateType): Promise<void>;
  getRegisteredHooks(): Promise<GateType[]>;

  // Skill management
  installSkill(name: string, sourcePath: string): Promise<void>;
  uninstallSkill(name: string): Promise<void>;
  skillInstallPath(name: string): string;

  // Subagent management
  installSubagent(name: string, sourcePath: string): Promise<void>;
  subagentFromMarkdown(mdPath: string): Promise<string>;  // returns platform-native path

  // MCP configuration
  registerMcpServer(name: string, config: McpServerConfig): Promise<void>;
  unregisterMcpServer(name: string): Promise<void>;

  // Instructions injection
  injectInstructions(content: string, section: string): Promise<void>;

  // Capability detection
  detectCapabilities(): Promise<RuntimeCapabilitySet>;

  // Hook payload parsing
  parseHookPayload(stdin: string): HookPayload;

  // Hook response formatting
  formatBlockDecision(reason: string): string;    // platform-specific JSON/exit code
  formatAllowDecision(): string;
  formatContextInjection(context: string): string;
}

export interface InstallOptions {
  scope: 'global' | 'project';
  projectPath?: string;
  dryRun?: boolean;
}

export interface InstallResult {
  filesWritten: string[];
  hooksRegistered: GateType[];
  skillsInstalled: string[];
  warnings: string[];
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'http';
  url?: string;
}

export interface HookPayload {
  event: GateType;
  toolName?: string;
  toolInput?: unknown;
  sessionId?: string;
  cwd?: string;
  raw: Record<string, unknown>;
}

export type GateType =
  | 'session_start'
  | 'user_prompt'
  | 'pre_tool'
  | 'post_tool'
  | 'stop'
  | 'subagent_start'
  | 'subagent_stop';
```

---

## 9. Graceful Degradation

When a platform lacks a feature, the harness must not error — it must trace the gap and select the best available fallback.

### 9.1 Degradation Strategy Matrix

| Missing capability | Platform | Fallback strategy | Trace |
|---|---|---|---|
| Hooks entirely (`codex_hooks = false`) | Codex | Skip all gate enforcement; inject harness context via `AGENTS.md` instructions; run post-session verification only | `capabilities.limitations = ["hooks disabled"]`; record `GATE_SKIPPED` in `.planning/run-set.json` |
| `subagent_start` hook | Codex | Cannot intercept unmanaged subagent launches; authorize scope only for harness-mediated launches | `DONE_WITH_GAPS` if spawned-agent scope was not authorized before finalization |
| `subagent_stop` hook | Codex | Cannot intercept subagent results; run final evidence check at `Stop` instead | `DONE_WITH_GAPS` if subagent evidence unverified |
| Hard-block on `stop` | Hermes | Use `on_session_finalize` to write final state; cannot re-invoke agent; classify as `DONE_WITH_GAPS` if evidence set incomplete | Record `STOP_UNBLOCKABLE` in `.planning/run-set.json` |
| `pre_llm_call` context injection | Hermes shell hooks | Inject context via SOUL.md or skill instructions instead; runtime context injection not available | Record `CONTEXT_INJECTION_DEGRADED` |
| MCP server registration | Any | Skip MCP server; harness operates in file-only mode against `.planning/state.yaml`, `.planning/current-risk.yaml`, and `.planning/run-set.json` | Record `MCP_UNAVAILABLE` |
| Subagent definition format | Any | If format conversion fails, skip subagent install; use inline skill instructions as fallback for review/verification | Record `SUBAGENT_INSTALL_FAILED` |
| OpenTelemetry export | Codex / Hermes | Write run events to `.planning/run-set.json` only; no OTLP push | No OTel spans emitted |
| Sandbox | Hermes local backend | Harness records a warning; approval mode `smart` used as compensating control | `capabilities.sandboxMode = null`; record `SANDBOX_UNAVAILABLE` |

### 9.2 Degradation Decision Tree

```
harness hook <GateType> called
  │
  ├─ Is this event registered on this platform?
  │     No → record GATE_SKIPPED; exit 0 (no-op, allow)
  │     Yes ↓
  │
  ├─ Can this event block on this platform?
  │     No → execute logic; record result; exit 0 regardless
  │     Yes ↓
  │
  ├─ Execute gate logic
  │     Allow → exit 0
  │     Block → format platform-specific block decision; exit 2 (Claude/Codex)
  │                                                      return {"action":"block"} (Hermes pre_tool_call)
  │
  └─ On any unhandled error → record error; exit 0 (fail-open, never crash the agent session)
```

Fail-open is deliberate for errors. A crashing hook blocks the user's session. The harness records the error and yields control to the platform.

---

## 10. Platform-Specific Extensions

Features unique to one platform that the harness should expose — not abstracted, but available via platform-specific API surface.

### 10.1 Claude Code — Agent Hooks and HTTP Hooks

Claude Code supports hook types `agent`, `http`, `mcp_tool`, and `prompt` in addition to `command`. These enable verification subagents launched directly from a hook.

```json
// Advanced Claude hook: launch a reviewer subagent at Stop
{
  "Stop": [
    {
      "hooks": [
        {
          "type": "agent",
          "agent": "harness-evidence-reviewer",
          "prompt": "Review the current evidence set and return APPROVED or REJECTED with reason."
        }
      ]
    }
  ]
}
```

The harness exposes this via `adapter-claude` only:

```typescript
// adapter-claude extension (not in base PlatformAdapter)
interface ClaudeAdapter extends PlatformAdapter {
  registerAgentHook(gateType: GateType, agentName: string, prompt: string): Promise<void>;
  registerHttpHook(gateType: GateType, url: string, headers?: Record<string, string>): Promise<void>;
}
```

Claude Code also provides native OpenTelemetry export. The harness enables it by writing OTEL env vars into `settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318"
  }
}
```

### 10.2 Hermes — Gateway Hooks

Hermes has a unique gateway layer for multi-messaging-channel routing (CLI, API, messaging platforms). Gateway hooks fire before/after the agent processes a message at the transport level — earlier than plugin hooks.

```yaml
# ~/.hermes/hooks/harness-gateway/HOOK.yaml
name: harness-gateway
events:
  - session:start
  - agent:start
  - agent:end
handler: handler.py
```

The harness exposes this via `adapter-hermes` only as an opt-in advanced mode:

```typescript
// adapter-hermes extension
interface HermesAdapter extends PlatformAdapter {
  installGatewayHook(name: string, events: string[], handlerPy: string): Promise<void>;
  installPluginHook(eventName: string, handlerPy: string): Promise<void>;
  registerQuickCommand(name: string, type: 'exec' | 'alias', target: string): Promise<void>;
}
```

### 10.3 Codex — Cloud Mode and Profiles

Codex supports named configuration profiles (`[profiles.<name>]` in `config.toml`) and a cloud/automation mode where sessions run headlessly. The harness can install profile-specific hook configurations:

```toml
[profiles.harness-strict]
model = "gpt-5.4"
approval_policy = "on-request"

[profiles.harness-bypass]
model = "gpt-5.4-mini"
approval_policy = "never"
sandbox_mode = "workspace-write"
```

```typescript
// adapter-codex extension
interface CodexAdapter extends PlatformAdapter {
  createProfile(name: string, config: CodexProfileConfig): Promise<void>;
  ensureFeatureFlag(flag: string, value: boolean): Promise<void>;
  generateAgentToml(markdownPath: string): Promise<string>;  // returns TOML string
}
```

Codex also uses `AGENTS.override.md` for local overrides without modifying the shared `AGENTS.md`. The installer writes a project-level `AGENTS.override.md` with harness-specific instructions rather than modifying the user's root `AGENTS.md`, avoiding contamination.

---

## Appendix — GateType Adapter Event Map

Quick reference for `harness hook <GateType>` CLI argument to platform event name:

| GateType / CLI argument | Claude Code adapter event | Codex adapter event | Hermes shell/plugin adapter event |
|---|---|---|---|
| `session_start` | `SessionStart` | `SessionStart` | `on_session_start` |
| `user_prompt` | `UserPromptSubmit` | `UserPromptSubmit` | `pre_llm_call` |
| `pre_tool` | `PreToolUse` | `PreToolUse` | `pre_tool_call` |
| `post_tool` | `PostToolUse` | `PostToolUse` | `post_tool_call` |
| `pre_compact` | `PreCompact` | `PreCompact` | `pre_compact` |
| `post_compact` | `PostCompact` | `PostCompact` | `post_compact` |
| `stop` | `Stop` | `Stop` | `on_session_end` |
| `subagent_start` | `SubagentStart` | **(no-op for unmanaged launches)** | **(no-op in executable MVP profile)** |
| `subagent_stop` | `SubagentStop` | **(no-op)** | `subagent_stop` |

The harness binary dispatches on `GateType`, not the platform event name. Adapters handle platform-native registration; the runtime logic is platform-agnostic.
