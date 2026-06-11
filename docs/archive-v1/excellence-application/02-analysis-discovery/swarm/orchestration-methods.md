---
title: "Orchestration Methods Deep-Dive — Top Harnesses"
agent: swarm-agent-6
scope: How harnesses wire skills / agents / hooks / MCP at runtime
date: 2026-05-14
status: FINAL
pair: swarm-agent-5 (structural layout)
sources: github.com/block/goose, github.com/sst/opencode, github.com/humanlayer/12-factor-agents, github.com/All-Hands-AI/OpenHands, github.com/anthropics/claude-code, oh-my-codex (OMX v0.15.2), hima docs/conception/
---

## 1. Executive Summary — Top 5 Orchestration Patterns for hima

Ranked by leverage (impact on quality × implementation cost):

| Rank | Pattern | Source repos | Leverage |
|------|---------|-------------|---------|
| 1 | **Keyword-typed registry → phase seeding before LLM sees input** | OMX `keyword-registry.ts:1-77`, goose `agent.rs:475` | CRITICAL — prevents wasted compute on vague prompts; maps directly to hima's `hima-enter` skill routing |
| 2 | **MCP-first state persistence (LLM calls tools, not files)** | OMX `state-server.ts`, goose MCP extensions, opencode `session.ts` | HIGH — eliminates context drift; hima's `.planning/run-set.json` is the right primitive but needs MCP tool surface |
| 3 | **tmux/process-isolated multi-agent with filesystem mailbox** | OMX `team.ts:1-150`, `runtime.ts`, goose `subagent_handler.rs` | HIGH — the only portable multi-agent substrate that works without in-process threads |
| 4 | **Per-agent tool disallow list + permission inheritance for subagents** | opencode `subagent-permissions.ts:1-40`, goose `tool_confirmation_router.rs`, OMX `critic.md` | HIGH — without this, subagents escape their lane silently |
| 5 | **Stateless reducer + append-only thread.jsonl** | 12-factor-agents factor-05, factor-08, factor-12 | MEDIUM-HIGH — makes hima's state resumable, forkable, auditable |

---

## 2. Per-Repo Orchestration Deep-Dive

---

### 2.1 OMX (oh-my-codex) v0.15.2

**Source**: `.planning/external-harness-research/clones/oh-my-codex/` + `omx-architecture-deep-dive.md`

#### Agent dispatch
OMX spawns agents via **tmux pane splits** — each worker is a full Codex or Claude CLI process in its own tmux pane. The spawn call is in `src/cli/team.ts:1-150` and `src/team/runtime.ts`. Workers receive a `worker-bootstrap` overlay injected into AGENTS.md. Dispatch parameters: `omx team N:agent-type "task"` — N workers, each of type `agent-type` (maps to a prompt file in `prompts/`).

**Key file**: `src/team/runtime.ts` — imports `tmux-session.ts`, `team-ops.ts`, `mcp-comm.ts`, `worktree.ts`, `worker-bootstrap.ts`, `allocation-policy.ts`, `role-router.ts`, `phase-controller.ts`.

#### Skill routing
Keyword-typed registry at `src/hooks/keyword-registry.ts:1-77`. Data structure: flat array of `KeywordTriggerDefinition { keyword, skill, priority, guidance }`. 70 definitions, 17 skills. Priority 5–11. Tie-breaking: higher priority wins, then longer keyword, then alphabetical (`compareKeywordMatches()`). Detection runs at `UserPromptSubmit` hook before LLM sees the prompt — `src/hooks/keyword-detector.ts:1-1226`.

Ralplan gate (`keyword-detector.ts:177-196`): if prompt is underspecified (< 15 effective words, no file paths, no code symbols), `$ralph` is redirected to `$ralplan` first.

#### Hook architecture
Hooks declared in `settings.json` (Claude Code) or wired via `omx setup`. Events: `UserPromptSubmit`, `SessionStart`, `Stop`, `SubagentStop`, `PreToolUse`. Plugin extensibility: `.omx/hooks/*.mjs` files, loaded by `src/hooks/extensibility/loader.ts`, dispatched as child processes with JSON stdin, 1500ms default timeout, SIGTERM→SIGKILL cascade (`src/hooks/extensibility/dispatcher.ts`). 25+ event types in `types.ts`.

#### State machine
No formal statechart. State is implicit: mode state files at `.omx/state/{mode}-state.json`. Phase tracked as `current_phase` field in mode JSON (e.g., `autopilot-state.json` has `phase_cycle: ["ralplan","ralph","code-review"]`). Workflow transitions enforced by `src/state/workflow-transition.ts` — `evaluateWorkflowTransition()` returns `{allowed, autoCompleteModes, resultingModes}`. Planning modes are exclusive with execution modes.

#### Multi-agent coordination
Filesystem-based: `.omx/state/team/tasks/{taskId}.json`, `mailbox/{messageId}.json`, `events/{eventId}.json`. Workers claim tasks, execute, report via filesystem. Leader polls state files. No in-process message passing. Worktree isolation via `src/team/worktree.ts` for parallel agents writing to overlapping files.

#### Runtime binding
`src/adapt/contracts.ts:1-190` defines adapter targets: OpenClaw (ready) and Hermes (stub). Each adapter has capability ownership flags (`omx-owned | shared-contract | target-observed`). Workers can be Codex or Claude CLI via `OMX_TEAM_WORKER_CLI` env var or `OMX_TEAM_WORKER_CLI_MAP` per-worker.

#### Failure handling
Max 3 iterations on error (in skill SKILL.md instructions). State machines in skills detect if same review cycle repeats — `review_cycle` counter in `autopilot-state.json`. MCP CLI parity: if MCP transport fails, LLM retries via `omx state read` CLI. No formal dead-letter queue.

---

### 2.2 goose (block/goose)

**Source**: `github.com/block/goose` — `crates/goose/src/`

#### Agent dispatch
Main agent struct in `src/agents/agent.rs`. `AgentConfig { session_manager, permission_manager, goose_mode, ... }` passed at construction. Subagents spawned via `src/agents/subagent_handler.rs` — `run_subagent_task(SubagentRunParams)`. `SubagentRunParams` carries `config: AgentConfig`, `recipe: Recipe`, `task_config: TaskConfig`, `cancellation_token`, `on_message` callback, `notification_tx`. Recipe-driven: a `Recipe` struct (`src/recipe/mod.rs:1-80`) carries `title`, `description`, `instructions`, `prompt`, `extensions`, `settings`, `parameters` — this is the config-driven dispatch primitive.

#### Skill routing
At-mention resolution: `agent.rs:505-530` — `resolve_at_mention()` scans last user message for `@agent-name` prefix, looks up filesystem sources via `discover_filesystem_sources(working_dir)`. If match found, injects agent's `content` into system prompt. Extensions (MCP servers or builtin tools) declared in recipe `extensions[]` — loaded by `src/agents/extension_manager.rs`.

Hooks discovery from plugin `hooks/hooks.json` files: `src/hooks/mod.rs:1-120` — plugin hook files loaded via `discover_enabled_plugins()`. Schema: `{ "hooks": { "PostToolUse": [{ "matcher": "tool_regex", "hooks": [{ "type": "command", "command": "..." }] }] } }`.

#### Hook architecture
`src/hooks/mod.rs` defines `HookEvent` enum: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `BeforeReadFile`, `AfterFileEdit`, `BeforeShellExecution`, `AfterShellExecution`, `Stop` (11 events). Hooks live in `<plugin-root>/hooks/hooks.json`. Per-hook 30s default timeout. Hook scripts receive JSON event context on stdin. Unknown event names and action types silently ignored.

In `agent.rs:291-336`: `hook_manager` loaded at agent init (`HookManager::load(current_dir)`). `emit_hook(event, session_id)` called at lifecycle points. `with_post_tool_hook()` wrapper streams tool results and fires `PostToolUse` or `PostToolUseFailure` after completion.

#### State machine
Implicit. No formal statechart. Session state managed via `SessionManager`. `RetryManager` in `src/agents/retry.rs` handles retry logic. Context compaction triggered at threshold (`DEFAULT_COMPACTION_THRESHOLD`) via `src/context_mgmt/`. No explicit phase enum — agent loop runs `reply()` cycles until max turns or cancellation.

#### Multi-agent coordination
Subagents run as separate async tasks (Tokio). `ToolConfirmationRouter` (`src/agents/tool_confirmation_router.rs`) uses oneshot channels to pass permission confirmations from frontend to executing tool. No shared filesystem state between concurrent agents — each subagent gets isolated `Conversation`. Results returned as text to parent via `run_subagent_task()` return value.

#### Runtime binding
GooseMode enum (`src/config/goose_mode.rs:1-35`): `Auto` (default), `Approve`, `SmartApprove`, `Chat`. SmartApprove triggers `PermissionJudge` LLM call (`src/permission/permission_judge.rs:1-80`) — an LLM-as-classifier that inspects tool requests and returns a list of read-only tools. Read-only tools auto-approved; others go to confirmation queue. Non-read-only tools in SmartApprove mode routed to `ToolConfirmationRouter` for user decision.

#### Failure handling
`src/agents/retry.rs` — `RetryManager` and `RetryResult` enum. `src/agents/agent.rs:1000+` — error recovery in the main reply loop. `CancellationToken` passed to subagents for cooperative cancellation. `ActionRequiredManager` (`src/action_required_manager.rs`) handles cases where agent needs human input.

---

### 2.3 opencode (sst/opencode)

**Source**: `github.com/sst/opencode` — `packages/opencode/src/`

#### Agent dispatch
Effect-based service architecture. `Agent.Service` (`src/agent/agent.ts:60-90`) exposes `get`, `list`, `defaultInfo`, `defaultAgent`, `generate`. Agents are data records (`Agent.Info` schema) with fields: `name`, `description`, `mode` (subagent/primary/all), `permission` (Ruleset), `model`, `prompt`, `steps`. Dispatch is config-driven: the session picks an agent by name, the `Agent.Service.get()` resolves the agent record, and the session runner uses its `permission` ruleset and `prompt`.

#### Skill routing
`src/skill/discovery.ts` — `SkillDiscovery.Service` with `pull(url)` method. Downloads an `index.json` from a URL, filters skills that include `SKILL.md`, downloads all skill files to a local cache at `Global.Path.cache/skills/{name}/`. Skill discovery is pull-based (remote registry), not file-scan. Concurrency: 4 skills × 8 files in parallel. Skills listed alongside whitelisted dirs in agent permission ruleset (`src/agent/agent.ts:100-115`).

Plugin loading in `src/plugin/loader.ts` — staged resolution: `plan → resolve → load`. Stages: install npm package if needed, find entrypoint (`server`/`tui` kind), check compatibility, dynamic import. Per-stage error reporting. Plugin kinds are separate from skills.

#### Hook architecture
No explicit hook system in the Claude Code sense. Lifecycle managed via Effect `Layer` composition. `SessionRunState.Service` (`src/session/run-state.ts:1-90`) manages runner lifecycle: `assertNotBusy`, `cancel`, `ensureRunning`, `startShell`. Runners are per-session Effect `Runner` instances. Permission enforcement is pre-call via `Permission.evaluate()` against the agent's `Ruleset` — deny rules from parent propagated to subagent (`src/agent/subagent-permissions.ts`).

#### State machine
`SessionRunState` is the implicit state machine: `idle → busy → idle`. `Runner` struct has `.busy` flag. No formal phase model. Session state persisted in SQLite via `session.sql.ts` (Drizzle ORM). `run-state.ts` uses `Scope` for resource cleanup and `Latch` for synchronization.

#### Multi-agent coordination
Subagent permission derivation at `src/agent/subagent-permissions.ts:1-40`: `deriveSubagentSessionPermission()` combines parent agent's deny rules + parent session's deny rules + external_directory restrictions. `todowrite` and `task` tools denied by default on subagents unless explicitly allowed. This enforces lane boundaries at permission level, not prompt level.

#### Runtime binding
Abstracted via `Provider.Service` (model provider) + `Permission.Service` (tool permission). Model routing via `Agent.Info.model` field — each agent can specify a different `{providerID, modelID}`. No explicit multi-runtime adapter (Claude Code only).

#### Failure handling
Effect error types: `Session.BusyError`, `Provider.ModelNotFoundError`, `NotFoundError`. Effect `Scope` cleanup on interruption. No explicit retry policy documented in reviewed files.

---

### 2.4 12-factor-agents (humanlayer/12-factor-agents)

**Source**: `github.com/humanlayer/12-factor-agents` — `content/` markdown factors

#### Agent dispatch
Factor 10 — "Small, focused agents": dispatch by task decomposition, not capability matching. Each agent has a narrow scope. No framework dispatch; the developer owns the loop (`content/factor-08-own-your-control-flow.md`).

#### Skill routing
Factor 1 — "Natural language to tool calls": LLM outputs structured JSON always; intent field (`request_human_input`, `done_for_now`, `fetch_git_tags`, `deploy_backend`) drives control flow. No keyword registry — the developer's control loop matches on `next_step.intent`.

#### Hook architecture
No hook framework. Factor 8 provides the pattern: explicit `if/elif` on `next_step.intent` — synchronous intents continue loop, async intents break loop and persist thread for webhook resume. Human-in-the-loop via `RequestHumanInput` tool with `{urgency, format, choices}` fields (`content/factor-07-contact-humans-with-tools.md`).

#### State machine
Factor 5 — "Unify execution state and business state": single `thread.events[]` append-only log. Execution state (current step, retry count, waiting status) is derived from the thread — not stored separately. Factor 12 — "Stateless reducer": agent = `foldl(thread, next_step)`. No external state machine library. Factor 6 — "Launch/pause/resume": save `thread_id` to DB, break loop, resume via webhook `thread = load_state(thread_id)`.

#### Multi-agent coordination
Factor 10 — small focused agents, not concurrent. No shared state protocol described. Parent-child by thread forking: copy subset of thread events into new thread.

#### Runtime binding
Language/framework agnostic — Python examples, TypeScript examples. No abstraction layer; developer implements directly against LLM API.

#### Failure handling
Factor 9 — "Compact errors": error messages summarized before appending to thread (prevents context bloat). Retry by appending error to thread and re-calling LLM. Human handoff for unrecoverable errors via `RequestHumanInput`.

---

### 2.5 Claude Code (anthropics/claude-code)

**Source**: `github.com/anthropics/claude-code` — `.claude/`, `plugins/`

#### Agent dispatch
Subagents declared as Markdown files with YAML frontmatter in `.claude/agents/` or `~/.claude/agents/`. Dispatch: auto (Claude matches task description to agent description) or explicit (user invokes by name). Depth limited to 1 (subagents cannot spawn subagents). Plugin-based extensibility: `plugins/` directory with named plugin folders each containing `CLAUDE.md` (instructions), `.claude/` config, hooks.

#### Skill routing
`~/.claude/skills/<name>/SKILL.md` loaded at session start. Auto-invocation by description match — Claude reads skill descriptions and routes based on semantic similarity to user intent. No keyword registry code-side; routing is LLM-driven. Skills discovered from global (`~/.claude/skills/`) and project (`.claude/skills/`) paths.

#### Hook architecture
JSON-declared in `settings.json`. Supported events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart`, `SubagentStop`. Hook types: `command` (shell), `http` (webhook), `mcp_tool`, `prompt`, `agent` (spawn subagent from hook). Blocking: `PreToolUse` exits with code 2 + JSON `{"decision":"block","reason":"..."}` to block. `Stop` exits with code 2 + JSON `{"continue":true}` to prevent stop. Output injected as `additionalContext` into next turn (≤10,000 chars).

#### State machine
No explicit statechart in the harness. State lives in LLM context window + hook-injected context. `SubagentStop` hook enables deliverables gate — verify subagent output before proceeding.

#### Multi-agent coordination
Subagents run with isolated context (no parent conversation history). `SubagentStart` hook can authorize scope and write zones before spawn. `SubagentStop` hook can verify output. No shared state protocol between concurrent subagents beyond filesystem.

#### Runtime binding
Claude Code only. MCP servers via `.mcp.json` (project) or `~/.claude.json` (global) — stdio or HTTP transport. Permission rules in `settings.json` `permissions.allow/deny` arrays with glob patterns.

#### Failure handling
Hook scripts: fail-open (unhandled errors exit 0, not 2). `PreToolUse` can block. `Stop` can continue. No built-in retry policy — retry logic lives in agent SKILL.md instructions.

---

### 2.6 OpenHands (All-Hands-AI/OpenHands)

**Source**: `github.com/All-Hands-AI/OpenHands` — `openhands/`

#### Agent dispatch
`openhands/server/app.py` FastAPI server. Agent types registered in `agenthub/`. Config-driven: `AppConfig.agent_cls` selects the agent class. Microagents (skills) loaded from `~/.openhands/microagents/`, `.openhands/microagents/`, and `{org}/.openhands` GitHub repo (org-level). Four-tier scope: public → user → project → org. Loader in `openhands/runtime/plugins/agent_skills/skill_loader.py:127-165`.

#### Skill routing
Microagents have YAML frontmatter with `triggers[]` — keyword list. When a trigger word appears in user message, the corresponding microagent's instructions are injected into the system prompt. This is pure keyword matching at the framework level, not LLM classification.

#### Hook architecture
Runtime events (tool calls, observations) processed through `EventStream`. No Claude-Code-style pre/post hooks. State change events emitted to event stream. Agent subscribes to event stream and reacts.

#### Multi-agent coordination
Subagents via `AgentDelegateAction` — parent agent delegates a subtask to a child agent. Child runs in its own event stream slice. Results returned as `AgentDelegateObservation`. No shared filesystem state; communication via action/observation pairs.

#### Runtime binding
Docker-based sandbox for code execution. Runtime is abstracted — `ServerRuntime`, `LocalRuntime`, `DockerRuntime`. Model provided via `LiteLLM` — supports 100+ models through a single interface.

#### Failure handling
`AgentState` enum includes `ERROR` state. Max iterations config. `BrowserUnavailableError`, `RuntimeUnavailableError` mapped to terminal states. Auto-retry on transient errors.

---

### 2.7 hermes-agent

**Source**: Referenced from `omx-architecture-deep-dive.md` + hima `docs/conception/04-runtime-bindings-spec.md`

#### Agent dispatch
`delegate_task` call in `~/.hermes/config.yaml` delegation section. Subagents configured as `children[]` entries with `role`, `description`, `instructions_file`, `max_iterations`. `max_concurrent_children: 3`, `max_spawn_depth: 1` (cap 3). No dynamic dispatch — all children pre-declared in config.

#### Skill routing
Skills at `~/.hermes/skills/<name>/SKILL.md`. Frontmatter: `name`, `description`, `version`, `platforms`, `metadata.hermes`, `required_environment_variables`. Installed skills become slash commands. No registry-based keyword routing; Hermes uses intent router from skill descriptions.

#### Hook architecture
Two hook layers: shell hooks in `config.yaml` (`hooks.on_session_start`, `pre_llm_call`, `pre_tool_call`, `post_tool_call`, `on_session_end`, `subagent_stop`) and Python plugin hooks (`ctx.register_hook("pre_llm_call", handler)`). Gateway hooks fire before plugin hooks (transport level). `pre_tool_call` can block with `{"action":"block"}`. `on_session_end` cannot hard-block. `transform_tool_result` can replace output.

#### State machine
No explicit statechart. Session state in `~/.hermes/state.db` SQLite. `gateway-state.json` for gateway-level state. `on_session_finalize` for cleanup.

#### Multi-agent coordination
`delegate_task` with isolated context per child. Results returned synchronously as text summary. No inter-agent messaging. Conflict resolution by sequential evidence collection.

#### Runtime binding
Multiple backends: local, Docker (hardened), SSH, Modal, Daytona, Vercel Sandbox. Backend selected via config. MCP servers via `mcp_servers:` block in `config.yaml`. Permission mode: `approvals.mode: smart` (default) — maps to SmartApprove equivalent.

#### Failure handling
`max_iterations` per subagent. `on_session_finalize` for final state recording. No hard-block on `on_session_end` — harness must record `DONE_WITH_GAPS` when evidence set incomplete.

---

### 2.8 oh-my-openagent (referenced in research-harness-extraction.md)

**Source**: Referenced from `research-harness-extraction.md` — `oh-my-openagent`

#### Agent dispatch
52 hooks wired. `identity-constraints.ts:106-122` enforces path-based write restrictions at execution (not just prompt rules). Prometheus hook blocks sub-agents from writing `rules/*` at runtime. Agent prompts in `sisyphus/{model}.ts` — 9 model-specific system prompt variants correcting drift per model.

#### Skill routing
Multilingual regex-based keyword detection. Covers Korean keyboard typo normalization. AUTO-INVOQUER patterns tested as code-side registry. Priority disambiguation when multiple keywords match.

#### Hook architecture
52 hooks — most comprehensive hook coverage reviewed. Per-path enforcement at `PreToolUse`. `SubagentStop` deliverables gate. `Stop` persistence hook. `SessionStart` context pre-fetch.

#### State machine
Sisyphus mode: persistent loop, anti-stop guard. State tracked in `.omx/state/` equivalent. No formal statechart.

#### Multi-agent coordination
Worktree isolation for parallel agents. Filesystem state for coordination. Team mode similar to OMX.

#### Runtime binding
Multi-model: 9 model-specific prompt branches (anthropic/gpt/gemini/kimi/codex/beast). Model routing by model name detection. Per-model drift corrections in system prompt.

#### Failure handling
Max 3 fix iterations, then change approach. `prometheus-md-only` hook prevents corrupted state writes. Path-based hard enforcement.

---

### 2.9 claw-code / opencode session (referenced from research)

**Source**: Referenced from `research-harness-extraction.md` — `claw-code prompt.rs:238-286`

#### Agent dispatch
CLI wrapper around Claude Code. `prompt.rs:238-286` contains the `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` marker — explicit static/dynamic boundary for prompt caching.

#### Skill routing
No custom routing — uses Claude Code's native skill discovery.

#### Hook architecture
Inherits Claude Code hook architecture. Adds `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` as a cache stability primitive — content before boundary is stable (cached), content after boundary is dynamic (session-specific).

#### State machine
Inherits Claude Code. No additional statechart.

#### Multi-agent coordination
Inherits Claude Code subagent model.

#### Runtime binding
Claude Code adapter only.

#### Failure handling
Inherits Claude Code fail-open hook policy.

---

## 3. hima Alignment / Divergence Matrix

| Dimension | hima's choice (docs/conception/) | Mainstream consensus | Alignment |
|-----------|----------------------------------|---------------------|-----------|
| **Agent dispatch** | `spawnSubagent(type, input)` TypeScript API — explicit, typed | All repos: explicit dispatch (goose `run_subagent_task`, opencode `Agent.Service.get`, OMX `omx team N:agent-type`) | **ALIGNED** — explicit dispatch is the consensus. hima's typed API is stronger than most. |
| **Skill routing** | Keyword triggers in SKILL.md frontmatter + AUTO-INVOKE prose | OMX: code-side typed registry (`keyword-registry.ts`); OpenHands: YAML `triggers[]` in frontmatter; Claude Code: LLM description matching | **PARTIAL** — hima has keywords in prose. Needs code-side registry for testability. |
| **Hook architecture** | 7 GateTypes mapped to platform hooks via adapter (`04-runtime-bindings-spec.md §2`) | Claude Code: 7 hooks; goose: 11 hooks; OMX: 25+ plugin events; oh-my-openagent: 52 hooks | **ALIGNED in design, PARTIAL in implementation** — design covers the right gates, but hima's 9 dormant hook scripts not wired yet. |
| **State machine** | XState v5 Harel statechart with 56 composite states (`01-state-machine-spec.md`) | All others: implicit state (JSON files), no formal statechart | **IDIOSYNCRATIC-ON-PURPOSE** — hima is the only harness with a formal statechart. This is a differentiator, not a liability. |
| **State persistence** | `.planning/state.yaml` + `.planning/run-set.json` atomic writes | OMX: `.omx/state/{mode}-state.json` per mode; opencode: SQLite via Drizzle ORM; 12-factor: `thread.events[]` JSONL | **PARTIALLY ALIGNED** — hima's YAML is correct primitive but lacks an append-only event log. 12-factor's `thread.jsonl` pattern is the missing piece. |
| **Multi-agent coordination** | Max 3 parallel subagents, filesystem evidence return, sequential `evidence-collector` last (`07-subagents-catalog-spec.md §7.4`) | OMX: filesystem mailbox/tasks/events; goose: Tokio async tasks + oneshot channels; opencode: Effect Runners | **ALIGNED** — hima's 3-agent batch + sequential evidence-collector matches the pattern. Missing: explicit conflict resolution rule (hima has "most restrictive verdict wins" which is correct). |
| **Runtime binding** | PlatformAdapter interface with Claude/Codex/Hermes adapters (`04-runtime-bindings-spec.md §8`) | OMX: Adapt system (observation layer); opencode: Provider.Service abstraction | **ALIGNED** — hima's adapter interface is more formal than most. OMX's thin observation-only approach is worth noting as a lighter alternative for v1. |
| **Permission model** | Risk-class gating T/L/M/H/C (`06-skills-catalog-spec.md §6`) | goose: GooseMode (Auto/Approve/SmartApprove/Chat); opencode: per-agent Ruleset; Claude Code: allow/ask/deny per tool | **IDIOSYNCRATIC-ON-PURPOSE** — hima's risk-class model is richer than GooseMode but maps cleanly (T/L→Auto, M→SmartApprove, H→Approve, C→Chat). The mapping is documented in `research-harness-extraction.md §Cross-Cutting`. |
| **Failure handling** | Max 3 retries → `MAX_ATTEMPTS_REACHED` final state; `ERROR.ESCALATED` → human handoff (`01-state-machine-spec.md §3.4`) | OMX: 3 iterations in skill instructions; goose: `RetryManager`; 12-factor: factor-09 compact errors | **ALIGNED** — hima's 3-retry + escalation matches consensus. Missing: compact-error-before-append (12-factor factor-09). |
| **Subagent tool restrictions** | Subagents cannot write `.planning/` directly; parent persists evidence (`07-subagents-catalog-spec.md §5.2`) | opencode `subagent-permissions.ts`: parent deny rules propagated; OMX: `critic.md` blocks Write/Edit; goose: `ToolConfirmationRouter` | **ALIGNED** — hima's pattern matches. Missing: code-side enforcement (currently rules-only). |
| **Multi-runtime abstraction** | Tier 1 (copy) / Tier 2 (generate) / Tier 3 (adapter) / Tier 4 (not portable) | OMX: Adapt observation layer; no other harness attempts full multi-runtime abstraction | **IDIOSYNCRATIC-ON-PURPOSE** — hima's 4-tier portability model is unique and differentiating. |

---

## 4. Recommendations for hima

### R1: Promote keyword routing to a code-side testable registry
**Problem**: hima's AUTO-INVOKE is prose in SKILL.md — not machine-testable, not priority-disambiguating.  
**Pattern**: OMX `src/hooks/keyword-registry.ts:1-77` — flat array of `{keyword, skill, priority}`.  
**Action**: Add `artifacts/skills/keyword-registry.json` with one entry per skill trigger. The `UserPromptSubmit` hook reads this file, detects matches, seeds phase state before LLM sees the prompt.  
**Amends**: `docs/conception/06-skills-catalog-spec.md §2 Trigger` — add `priority: number` field to each skill trigger block.

### R2: Add an append-only `thread.jsonl` as the canonical event log
**Problem**: hima's state is snapshot-only (`.planning/state.yaml` overwritten on each transition). No history for fork/replay/audit.  
**Pattern**: 12-factor-agents factor-05 — `thread.events[]` append-only; OMX `.omx/logs/session-history.jsonl`; opencode session events in SQLite.  
**Action**: Add `.planning/events.jsonl` (append-only, never overwritten). Each state transition and gate decision appends one line: `{ts, event, from, to, risk_class, triggered_by, evidence_ref}`. `run-set.json#transition_history` becomes a derived view of this log.  
**Amends**: `docs/conception/01-state-machine-spec.md §9.3 Persistence rules` — add rule 8: every transition also appends to `.planning/events.jsonl`.

### R3: Wire `SubagentStop` hook with deliverables gate as blocking MVP
**Problem**: hima has 9 dormant hook scripts. The highest-value unimplemented hook is `SubagentStop` — it's the evidence gate that proves the subagent actually produced required output.  
**Pattern**: OMC `verify-deliverables.mjs` + `templates/deliverables.json`; Claude Code `SubagentStop` is blocking.  
**Action**: Wire `harness hook subagent-stop --format claude` in `settings.json`. The hook reads `artifacts/deliverables/{subagent-type}.json` schema, checks file presence + min size + required sections. Returns exit 2 if evidence missing.  
**Amends**: `docs/conception/04-runtime-bindings-spec.md §2.7` — add implementation evidence once wired.

### R4: Implement per-subagent tool disallow at the adapter layer (not just rules prose)
**Problem**: `07-subagents-catalog-spec.md §5.2` says "subagent must never write `.planning/` directly" — but this is enforced only by prompt instructions.  
**Pattern**: opencode `src/agent/subagent-permissions.ts:1-40` — `deriveSubagentSessionPermission()` builds a deny ruleset programmatically from parent agent's deny rules; OMX `critic.md` lists blocked tools in frontmatter `tools:` disallow list.  
**Action**: Add `disallowedTools: string[]` to each `artifacts/subagents/<name>.md` frontmatter. The `SubagentStart` hook reads the definition and injects a `PreToolUse` deny rule for those tools for the duration of the subagent's session.  
**Amends**: `docs/conception/07-subagents-catalog-spec.md §4.1 Claude Code template` — add `disallowedTools:` frontmatter field.

### R5: Add SmartApprove equivalent — map GooseMode tiers to hima's risk classes explicitly
**Problem**: hima's risk-class model (T/L/M/H/C) has no runtime enforcement for M class (SmartApprove zone). M tasks currently run fully autonomously, same as T/L.  
**Pattern**: goose `src/config/goose_mode.rs:24-34` — `SmartApprove` triggers LLM classification of each tool call before execution; `src/permission/permission_judge.rs:1-80` — LLM classifier returns list of read-only tools.  
**Action**: Add a `PreToolUse` hook path for M-class sessions: call a lightweight LLM classifier (Haiku/fast model) on the tool call, auto-approve read-only ops, route write ops to confirmation queue. Log all M-class tool decisions to `.planning/run-set.json#events`.  
**Amends**: `docs/conception/04-runtime-bindings-spec.md §3 Permission Model` — add `SmartApprove` as the runtime enforcement mechanism for M-class.

### R6: Add `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` marker for prompt-cache stability
**Problem**: No explicit static/dynamic boundary in hima's system prompt. Every session may miss cache hits.  
**Pattern**: claw-code `prompt.rs:238-286` — `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` divides stable content from session-specific content.  
**Action**: Add `<!-- HARNESS_CACHE_BOUNDARY -->` comment in `harness-core/SKILL.md` after stable instructions and before session-injected context (phase, risk class, active item). Cost: 5 lines.  
**Amends**: `docs/conception/06-skills-catalog-spec.md §5.1 Claude Code` — add note on cache boundary placement.

### R7: Compact errors before appending to thread (12-factor factor-09)
**Problem**: Error messages from tool failures are appended raw to the context window. Long stack traces bloat the context and reduce effective turns.  
**Pattern**: 12-factor-agents `content/factor-09-compact-errors.md` — summarize errors before appending.  
**Action**: In the `PostToolUse` hook, if tool result contains error patterns (stack trace, exception), pass through a template that extracts: error type, one-line message, relevant file:line. Append the compact form, not the full output.  
**Amends**: `docs/conception/04-runtime-bindings-spec.md §2.4 post_tool` — add error-compaction step to harness use description.

### R8: Expose MCP tools as the primary state-write surface for skills
**Problem**: hima's skills currently write state by calling `harness` CLI commands. MCP tools are more reliable (JSON round-trip, structured errors, no shell escaping).  
**Pattern**: OMX has 5 first-party MCP servers (`state-server.ts`, `memory-server.ts`, etc.) — skills call `state_write` MCP tool, not CLI. CLI parity exists as fallback.  
**Action**: Register a `harness-state` MCP server (in `.mcp.json`) exposing: `state_read`, `state_write`, `state_list_active`, `evidence_append`. Skills call these tools. CLI fallback remains for degraded mode.  
**Amends**: `docs/conception/04-runtime-bindings-spec.md §4.3 Hermes config` — already shows MCP server entry; ensure Claude Code `.mcp.json` example is present.

---

## 5. Sources / Repo URLs

| Repo | URL | Key files reviewed |
|------|-----|--------------------|
| OMX (oh-my-codex) | internal clone `.planning/external-harness-research/clones/oh-my-codex/` | `src/hooks/keyword-registry.ts`, `src/hooks/keyword-detector.ts`, `src/hooks/session.ts`, `src/mcp/state-server.ts`, `src/team/runtime.ts`, `src/agents/definitions.ts`, `src/adapt/contracts.ts` |
| goose | github.com/block/goose | `crates/goose/src/agents/agent.rs`, `src/agents/subagent_handler.rs`, `src/agents/tool_confirmation_router.rs`, `src/agents/prompt_manager.rs`, `src/hooks/mod.rs`, `src/config/goose_mode.rs`, `src/permission/permission_judge.rs`, `src/recipe/mod.rs` |
| opencode | github.com/sst/opencode | `packages/opencode/src/agent/agent.ts`, `src/agent/subagent-permissions.ts`, `src/skill/discovery.ts`, `src/plugin/loader.ts`, `src/session/run-state.ts`, `src/session/session.ts` |
| 12-factor-agents | github.com/humanlayer/12-factor-agents | `content/factor-05-unify-execution-state.md`, `content/factor-06-launch-pause-resume.md`, `content/factor-07-contact-humans-with-tools.md`, `content/factor-08-own-your-control-flow.md`, `content/factor-12-stateless-reducer.md` |
| Claude Code | github.com/anthropics/claude-code | `.claude/` plugins, `plugins/` directory listing |
| OpenHands | github.com/All-Hands-AI/OpenHands | `openhands/server/app.py`, `openhands/core/`, `openhands/runtime/plugins/agent_skills/skill_loader.py` (referenced in research) |
| hermes-agent | referenced via `docs/conception/04-runtime-bindings-spec.md` + `omx-architecture-deep-dive.md §7.4` | Config patterns, gateway hooks, plugin hooks |
| oh-my-openagent | referenced via `research-harness-extraction.md` | `identity-constraints.ts:106-122`, `prometheus-md-only` hook, `sisyphus/{model}.ts` |
| claw-code | referenced via `research-harness-extraction.md` | `prompt.rs:238-286` SYSTEM_PROMPT_DYNAMIC_BOUNDARY |
| hima (own specs) | `docs/conception/` | `01-state-machine-spec.md`, `04-runtime-bindings-spec.md`, `06-skills-catalog-spec.md`, `07-subagents-catalog-spec.md` |
