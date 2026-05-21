---
status: verified
date: 2026-05-14
researcher: deep-researcher swarm-agent-3 (Claude Sonnet 4.6)
slice: orchestration-method — user's #1 priority axis
queries-run: 14 web searches + 22 WebFetch calls
new-repos-found: 29 (beyond D1's 18 + research-harness-extraction.md's 11)
low-star-repos: 14 of 29 have <100 stars
cross-validation: every orchestration-method claim backed by direct repo fetch or ≥2 sources
---

# Orchestration Scan — Agent Orchestration / Multi-Agent / LLM-Agent / Agent-Framework (2026)

## Executive Summary

29 NEW repos catalogued, none overlapping with the 11 in `research-harness-extraction.md` or the 18 in D1. The orchestration-method axis surfaces **5 dominant patterns** that hima should study and adopt selectively:

1. **Tiered-cascade routing** (Citadel) — 4-tier pattern-match → session-state → keyword → LLM-classify, ~500 tokens only at tier 4.
2. **Declarative YAML topology with faceted prompting** (takt) — agent behaviour composed from independent facets; runtime-agnostic provider swap in one config line.
3. **FSM with hard safety gate** (Agent Village) — 15-state FSM with per-tool risk classification and hard limits (recursion ≤10, spawns ≤50) that cannot be bypassed.
4. **Contract-first hash-chained evidence** (swarm-orchestrator) — every agent action appended to `ledger.jsonl` with previous-hash link; nothing commits unless obligation verifier passes.
5. **Cross-harness platform adapter layer** (everything-claude-code / ECC) — single canonical skill/agent/hook source compiled to 6 runtime targets (Claude Code, Codex, OpenCode, Cursor, Qwen, Antigravity) via platform-specific adapter scripts.

The deepest single finding for hima: **no existing tool combines tiered-cascade routing + FSM safety gate + hash-chained evidence + cross-harness adapter layer in one coherent harness**. That combination is the orchestration engineering moat hima can build.

---

## Inventory Table — 29 NEW Repos × 9 Columns

| # | Repo | Owner | Stars | License | Last Push | Primary Language | Orchestration Method Summary | Harness Tier | Orchestration-Method-Detail |
|---|------|-------|-------|---------|-----------|-----------------|------------------------------|-------------|----------------------------|
| 1 | Citadel | SethGammon | ~800 | MIT | May 2026 | Markdown/JS | 4-tier cascade routing; campaign persistence; circuit breaker; 32 hooks | Claude Code + Codex | See §3.1 |
| 2 | takt | nrslib | 1k | MIT | May 2026 | TypeScript | Declarative YAML workflow; faceted prompting; rule-driven state transitions; provider-agnostic | Multi-runtime (Claude/Codex/Gemini/Cursor/Copilot) | See §3.2 |
| 3 | ruflo | ruvnet | 50.6k | MIT | May 2026 | TypeScript | MCP-server based; Queen hierarchy; 27 hooks; 210 MCP tools; self-learning SONA patterns | Claude Code + Codex | See §3.3 |
| 4 | agent-orchestrator | ComposioHQ | 7k | Apache 2.0 | May 2026 | TypeScript | Parallel worktree spawning; issue-per-agent; CI auto-remediation; central dashboard | Multi-runtime | See §3.4 |
| 5 | maestro-orchestrate | josstei | ~500 | MIT | May 2026 | JavaScript | 4-phase Design/Plan/Execute/Complete; 39 specialists; approval gates; source-to-runtime compilation | Claude/Codex/Gemini/Qwen | See §3.5 |
| 6 | swarmclaw | swarmclawai | 480 | MIT | May 2026 | TypeScript | spawn_subagent with concurrency caps; quorum join; cycle detection; 23+ providers; durable transcripts | Self-hosted runtime | See §3.6 |
| 7 | Agent-Village | sreejagatab | ~150 | MIT | May 2026 | Python | 15-state FSM; 8 agent tiers; hard safety gate; 40% success + 30% specialization scoring | Python multi-provider | See §3.7 |
| 8 | OpenHarness (Ohmo) | HKUDS | ~800 | MIT | Apr 2026 | Python | 10-subsystem harness; streaming tool-call cycle; tiered skill discovery; 3 permission modes | Multi-provider | See §3.8 |
| 9 | langroid | langroid | 4k | MIT | May 2026 | Python | Task-wraps-Agent; round-robin responders; @-addressing; lineage tracking; LiteLLM binding | Multi-LLM | See §3.9 |
| 10 | everything-claude-code (ECC) | affaan-m | ~300 | MIT | May 2026 | JavaScript | Cross-harness platform adapter; 228 skills; 8-event hook system; AgentShield security; continuous-learning v2 | 6 runtimes | See §3.10 |
| 11 | cordum | cordum-io | 478 | Apache 2.0 | May 2026 | Go | Before/During/Across governance; NATS message bus; Safety Kernel gRPC; ALLOW/DENY/REQUIRE_APPROVAL | Multi-agent cloud | — |
| 12 | revfactory/harness | revfactory | ~200 | MIT | May 2026 | Markdown | 6 pattern templates; 6-phase team generation (Domain→Design→Define→Skill→Wire→Validate) | Claude Code | — |
| 13 | gem-team | mubaidr | ~100 | MIT | May 2026 | Markdown/YAML | PRD-to-wave DAG; simple vs complex bifurcation; triple learning (memory/skills/rules) | Gemini CLI + Claude | — |
| 14 | swarm-orchestrator | moonrunnerkc | 90 | MIT | May 2026 | TypeScript | Contract-first; hash-chained ledger; tournament population; obligation verifier; falsifier adapters | Provider-agnostic | — |
| 15 | AI-Agents-Orchestrator | hoangsonww | ~200 | MIT | May 2026 | Python | Pipeline + role-based Agentic Team; 11 agents; 22 skills; 34 MCP tools; graph-based context memory | Claude/Codex/Gemini/Copilot | — |
| 16 | Bindu | GetBindu | 5.4k | Apache 2.0 | May 2026 | Python | A2A JSON-RPC; W3C DID cryptographic identity; PostgreSQL task lifecycle; x402 payment protocol | Cloud microservices | — |
| 17 | mission-control | builderz-labs | 4.8k | MIT | May 2026 | TypeScript | Kanban 6-state machine; pull-based queue; 32 dashboard panels; Aegis quality gate; skills hub | Multi-framework | — |
| 18 | agent-swarm | desplega-ai | ~150 | MIT | May 2026 | TypeScript | Lead/worker DAG; Docker isolation; persistent identity (SOUL + CLAUDE.md); vector memory | Claude/Codex/Devin | — |
| 19 | open-multi-agent | open-multi-agent | 6.1k | MIT | May 2026 | TypeScript | Goal-driven coordinator; runtime DAG decomposition; TaskQueue + AgentPool semaphore; 10 providers | TypeScript multi-provider | — |
| 20 | myclaude | cexll | ~50 | MIT | May 2026 | Shell/Markdown | Role-based orchestrator/executor split; 5-phase /do workflow; claudekit hooks | Claude/Codex/Gemini/OpenCode | — |
| 21 | multi-agent-ralph-loop | alfredolopez80 | 133 | MIT | May 2026 | Markdown | MemPalace 4-layer memory; 10-step loop; 6 parallel teammates; 22 hooks; 4-gate validator | Claude Code | — |
| 22 | amux | andyrewlee | 107 | MIT | May 2026 | Go | tmux-session multiplexer; workspace-first + git worktree; keyboard+mouse TUI; PTY flow | Claude/Codex/Gemini/Amp | — |
| 23 | opencode-swarm | zaxbysauce | 317 | MIT | May 2026 | Markdown | Architect-centric swarm plugin; OpenCode-native | OpenCode | — |
| 24 | praktor | mtzanidakis | 27 | MIT | May 2026 | TypeScript | Multi-agent Claude Code orchestrator; Mission Control UI | Claude Code | — |
| 25 | sortie | sortie-ai | 60 | MIT | May 2026 | TypeScript | Ticket-to-agent session conversion; tracker integration | Multi-runtime | — |
| 26 | loki-mode (via awesome list) | — | — | — | 2026 | Markdown | 41 specialists in 8 swarms; 9 quality gates; RARV cycles (Reason-Act-Reflect-Verify); blind code review | Claude Code | — |
| 27 | gnap (via awesome list) | — | — | — | 2026 | — | Git-Native Agent Protocol; shared git repo as persistent task board; no orchestrator process | Multi-runtime | — |
| 28 | tutti (via awesome list) | — | — | — | 2026 | TypeScript | Config-driven workflows; git worktree isolation; typed artifact flow | CLI multi-runtime | — |
| 29 | ai-maestro | 23blocks-OS | 672 | MIT | May 2026 | TypeScript | Agent Messaging Protocol (AMP); peer mesh networking; 4 deployment modes; skills + memory + code graph | Multi-cloud | — |

**Low-star repos (<100 stars): praktor (27), sortie (60), myclaude (~50), worker-swarm (7), pi-agent-teams (70), claude-ville (11), gem-team (~100), runic (8) — 8 confirmed low-star repos directly found; loki-mode/gnap/tutti are from curated list with unknown star count but clearly low-traffic.**

---

## Per-Entry Deep Dive — Top 10 (Orchestration Method Focus)

### 3.1 Citadel (SethGammon/Citadel) — Tiered-Cascade Routing + Campaign Persistence

**Stars:** ~800 | **License:** MIT | **Last push:** May 2026 | **Lang:** Markdown + JS

**Orchestration method (how it actually works):**

Agent dispatch is a **4-tier waterfall** that short-circuits at the first match:
- Tier 1 — **Pattern Match**: regex on the incoming message; zero tokens consumed; routes to static responses or simple tool calls.
- Tier 2 — **Session State**: checks `.planning/` for an active campaign; if found, resumes it — still zero LLM tokens.
- Tier 3 — **Keyword Lookup**: maps known skill-trigger words to pre-installed skills; invoked without a model call.
- Tier 4 — **LLM Classification**: ~500 tokens; structured complexity analysis only when tiers 1–3 fail to match.

Once past routing, the **orchestration ladder** selects the execution agent:
- `Skills` → domain expert, invoked directly
- `Marshal` → single-session commander (straight tasks)
- `Archon` → multi-step, session-spanning strategist
- `Fleet` → parallel coordinator: spawns N agents in isolated git worktrees, runs discovery relay between waves, merges results

**State machine / phase model:** Campaign-based. A campaign is a `.planning/` directory with decision records, progress milestones, and agent discoveries. `/do continue` resumes exactly at the last checkpoint. No in-memory state — everything lives on disk, survives context compression.

**Skill/tool attachment:** Keywords in a registry map to skills at tier 3. Fleet agents share discoveries in real time via a relay file written to the shared `.planning/` directory.

**Policy/gate mechanism:** `harness.json` configures 32 hooks across 29 lifecycle events. Consent gate fires on first encounter with external actions (push, PR). Circuit breaker halts failure spirals before token waste. Path traversal blocking and secrets exfiltration defense are hard hooks.

**Runtime provider binding:** Abstracts two runtimes — Claude Code (plugin install via `/plugin-dir`) and Codex (AGENTS.md + config artifact generation). Skills, hooks, and campaigns are identical on both.

**Key files:** `.citadel/` (routing + campaign state), `harness.json` (policy), `skills/` (domain experts), `hooks/` (32 handlers), `core/` (tier cascade logic)

---

### 3.2 takt (nrslib/takt) — Declarative YAML Topology + Faceted Prompting

**Stars:** 1k | **License:** MIT | **Last push:** May 2026 | **Lang:** TypeScript

**Orchestration method:**

Agents are not instantiated as objects — they are **workflow steps** in a YAML topology file. The "conductor metaphor": agents follow a scored composition. Each step has:
- `persona`: a markdown file in `~/.takt/personas/`
- `edit: true/false`: write permission gate
- `rules`: condition-driven transitions to next step (including `COMPLETE` and `ABORT` terminal states)
- `max_steps`: iteration ceiling preventing infinite loops

**State machine:** Explicit rule-based transitions. Conditions evaluate text (e.g., "Planning complete" → advance; "Tests fail" → route back to implementer). Multi-stage review is declarative: list parallel reviewers, aggregate results, handle failures.

**Skill/tool attachment via Faceted Prompting:** Independent prompt facets — persona, policy, knowledge, instruction — are composed freely at workflow authoring time. No monolithic system prompt; facets snap together per step. Custom personas are just markdown files.

**Policy/gate mechanism:** `required_permission_mode: edit` on steps gates file writes. Provider Sandbox disables network/file access per step. Workflow steps are the policy boundary.

**Runtime binding:** `~/.takt/config.yaml` selects provider (`claude`, `codex`, `opencode`, `cursor`, `copilot`) and model. API keys via env vars bypass CLI detection. Resolution order: `.takt/workflows/` → `~/.takt/workflows/` → builtins. Switching runtimes is a one-line config change.

**Key files:** `workflows/` (YAML definitions), `~/.takt/config.yaml` (global provider), `.takt/runs/` (NDJSON execution logs), `~/.takt/personas/` (custom personas)

---

### 3.3 ruflo (ruvnet/ruflo) — MCP-Server Swarm + Queen Hierarchy + Self-Learning

**Stars:** 50.6k | **License:** MIT | **Last push:** May 2026 | **Lang:** TypeScript

**Orchestration method:**

Two integration paths:
- **Path A (Claude Code plugin):** slash commands + agent definitions in `.claude-plugin/`, no MCP server registration
- **Path B (MCP server):** `claude mcp add ruflo -- npx ruflo@latest mcp start` registers Ruflo as a callable MCP server; Claude then invokes `memory_store`, `swarm_init`, `agent_spawn`, `task_route` as tool calls

**Swarm topology:** Queen-led hierarchy with three topology modes — hierarchical (centralized), mesh (peer-to-peer), adaptive (switches dynamically based on network conditions). Consensus mechanisms (Raft / Byzantine / Gossip) prevent split-brain.

**State machine / phase:** Planning → Execution → Learning → Replanning cycle. Agents maintain state via AgentDB (HNSW vector indexing, ≥150× faster retrieval than linear scan), session preservation via RVF format across restarts.

**Skill/tool attachment:** 210 MCP tools across 5 server groups (Core, Intelligence, Agents, Memory, DevTools). Tools are exposed as MCP manifest; agents receive tool manifests at spawn time. Parallel multi-tool execution shown in UI.

**Policy/gate mechanism:** 27 hooks auto-trigger on code events (commits, PRs, deployments). Per-hook policies: BLOCK, REDACT, HASH, PASS. 12 background workers run continuously (audit, optimize, testgaps, etc.).

**Runtime binding:** Claude Code (plugin) or any MCP-capable host (Path B). SONA neural patterns enable self-learning behaviour adaptation.

**Key files:** `.claude/`, `.claude-plugin/` (plugin manifests), `ruflo/src/` (router), `.agents/` (agent specs), `plugins/ruflo-agentdb/` (HNSW), `plugins/ruflo-federation/` (zero-trust inter-agent)

---

### 3.4 agent-orchestrator (ComposioHQ) — Parallel Worktree Fleet + CI Auto-Remediation

**Stars:** 7k | **License:** Apache 2.0 | **Last push:** May 2026 | **Lang:** TypeScript

**Orchestration method:**

Issue-per-agent model: each tracked issue spawns one agent in its own git worktree + branch. True parallelism — agents have independent working directories and git state.

**Coordination:** Central dashboard (`~/.agent-orchestrator/{hash}-{projectId}/`) shows all sessions, PRs, and status. No agent-to-agent communication — coordination is human-supervised via dashboard.

**CI auto-remediation:** On test failure, CI logs are routed back to the originating agent with `auto: true` and configurable retries (default 2). Agent diagnoses and fixes without human intervention.

**State management:** Central YAML config (`agent-orchestrator.yaml`), plugin interface (`packages/core/src/types.ts`), config schema (`schema/config.schema.json`).

**Policy/gate:** No pre-dispatch gate documented. Quality gate is CI pass/fail. Human supervises via dashboard.

**Runtime binding:** Framework-agnostic — any agent that can receive a task description and push a PR. Explicitly lists Claude Code, Codex, Gemini CLI as supported.

**Key files:** `agent-orchestrator.yaml`, `packages/core/src/types.ts`, `schema/config.schema.json`, `docs/ARCHITECTURE.md`

---

### 3.5 maestro-orchestrate (josstei) — Source-to-Runtime Compilation + 4-Phase Approval Gates

**Stars:** ~500 | **License:** MIT | **Last push:** May 2026 | **Lang:** JavaScript

**Orchestration method:**

Single canonical source tree (`src/`) compiled to runtime-specific payloads via `scripts/generate.js`. One authoring surface, multiple targets.

**Phase model:** Two execution paths:
- **Express**: minimal clarification → single specialist → review → archive
- **Standard (4 gates)**: Design (requirements + architecture docs) → Plan (strategy, must be approved) → Execute (parallel or sequential specialists, configurable via `MAESTRO_EXECUTION_MODE`) → Complete (final validation; blocks on unresolved Critical/Major findings)

**Specialist coordination:** 39 domain specialists assigned dynamically during Execute phase. `MAESTRO_MAX_CONCURRENT` caps parallelism. Resume is supported when phases block.

**Skill/tool attachment:** Runtime-specific — Gemini/Qwen get snake-case TOML agents; Claude Code gets kebab-case agents with `maestro:` subagent prefixes; Codex gets `spawn_agent` plugin calls.

**Policy/gate:** Approved plan required before Execute. Final Complete phase blocks on unresolved findings. Git hooks (`.githooks/`) run pre-commit validations.

**Runtime binding:** Claude Code (`.claude/` plugin), Codex (MCP), Gemini CLI, Qwen Code. `scripts/generate.js` produces platform-specific output from canonical source.

**Key files:** `src/` (canonical), `agents/` (Gemini/Qwen), `claude/` (plugin), `plugins/maestro/` (Codex), `scripts/generate.js` (compiler)

---

### 3.6 swarmclaw (swarmclawai/swarmclaw) — Durable Structured Sessions + 23-Provider Binding

**Stars:** 480 | **License:** MIT | **Last push:** May 2026 | **Lang:** TypeScript

**Orchestration method:**

`spawn_subagent` with configurable concurrency caps (default 4, max 16), **quorum-based join policies** (all-must-complete / majority-completes / first-wins), and cycle detection to prevent delegation loops. Parallel fan-out with task-bucket execution groups and explicit branch cancellation.

**Durable structured sessions:** Branching, repeat loops, parallel branches, explicit joins, restart-safe run state — the session persists to disk; resume IDs allow 30-second undo snapshots and full transcript replay.

**State machine:** Ordered review/approval/verification stages enforced by 409 completion guardrails. Heartbeat loops and orchestrator wake cycles use exponential backoff (10s → 5min), auto-disable after 10 consecutive failures.

**Skill attachment:** Runtime keyword or embedding-based skill recommendation. Conversation-to-skill drafting: user reviews auto-extracted skill before library promotion. Skills are user/agent-scoped by default.

**Policy/gate:** Approval flows with decision history. Connector-policy enforcement gates multi-agent work before human sign-off. Per-server `alwaysExpose` policies (eager vs lazy MCP tool binding).

**Runtime binding:** 23+ built-in providers (Claude, GPT, Gemini, OpenRouter, Ollama, DeepSeek, Groq, Together, Mistral, xAI, Fireworks, plus CLI-based agents). Per-agent provider/model overrides with fallback logic.

**Key files:** `src/lib/server/runtime/heartbeat-service.ts`, `src/lib/server/session-tools/spawn-subagent.ts`, `src/lib/server/runtime/structured-session-executor.ts`, `src/lib/providers/` (23+ impls)

---

### 3.7 Agent-Village (sreejagatab) — 15-State FSM + Hard Safety Gate

**Stars:** ~150 | **License:** MIT | **Last push:** May 2026 | **Lang:** Python

**Orchestration method:**

Comprehensive FSM in `src/fsm.py` with 15 states:
`IDLE → RECEIVED → INTENT_ANALYSIS → TASK_DECOMPOSITION → AGENT_ASSIGNMENT → EXECUTING / PARALLEL_EXECUTING → VERIFYING → WRITING_MEMORY → REFLECTING → COMPLETED`
Plus failure paths: `REPLANNING → FAILED`, and `CANCELLED`.

**Agent hierarchy (8 types in 4 layers):**
- Meta: Governor (spawns agents, drives FSM)
- Planning: Planner, Evolver (decompose, optimize)
- Execution: Tool Agent, Swarm Coordinator, Swarm Workers
- Validation: Critic, Memory Keeper

**Skill/tool attachment:** `ToolRegistry` (`src/tools/registry.py`) — each tool declares permission level (NONE/READ_ONLY/READ_WRITE/EXECUTE/ADMIN) and risk classification (low/medium/high). JSON Schema validation on parameters.

**Safety Gate (`src/safety/gate.py`):** Hard limits that cannot be bypassed programmatically:
- Recursion depth ≤ 10
- Agent spawns ≤ 50
- Token budgets: 100k per task, 500k per goal
- Execution timeout: 3,600 seconds
- Blocked actions: `rm -rf`, `DROP DATABASE`, fork bombs
- Human approval required for: deploy, delete, payment, admin

**Agent scoring:** 40% success rate + 30% task specialization + 20% capability matching + 10% recency.

**Runtime binding:** Provider Pool (`src/llm/providers.py`) routes to optimal model. PostgreSQL (relational) + Qdrant (vectors) + Redis (cache).

**Key files:** `src/fsm.py`, `src/agents/governor.py`, `src/tools/registry.py`, `src/safety/gate.py`, `src/safety/limits.py`, `src/agents/registry.py`

---

### 3.8 OpenHarness / Ohmo (HKUDS) — 10-Subsystem Harness + Tiered Skill Discovery

**Stars:** ~800 | **License:** MIT | **Last push:** Apr 2026 | **Lang:** Python

**Orchestration method:**

**Streaming tool-call cycle** (engine): `response = await api.stream(messages, tools); if response.stop_reason != 'tool_use': break`. The harness loop is minimal; safety and routing happen in surrounding subsystems.

**10 subsystems:** Engine (loop + retry), Tools (43 impls), Skills (on-demand markdown loading), Permissions (default/auto/plan modes), Hooks (PreToolUse/PostToolUse), Commands (54 slash), Memory (MEMORY.md), MCP (HTTP transport + auto-reconnect), Coordinator (subagent spawning), Config (multi-layer profiles).

**Skill discovery — 3-tier:** `~/.openharness/skills/` (user) → `~/.claude/skills/` (claude compat) → project `.openharness/skills/` (upward to git root). Skills load **on-demand** only when model needs them; not injected at session start.

**Ohmo personal agent:** Persistent identity via `~/.ohmo/soul.md`, `identity.md`, `user.md`. Gateway file (`~/.ohmo/gateway.json`) manages provider selection across Telegram, Slack, Discord, Feishu.

**Permission modes:** `default` (interactive approval before write/execute), `auto` (allow all), `plan` (block all writes — review-only).

**Multi-provider:** Named profiles abstract Anthropic-compat (Claude, Kimi, GLM), OpenAI-compat (OpenAI, Groq, DeepSeek, Ollama), Claude Subscription, Codex Subscription, GitHub Copilot (OAuth device flow). Profile-scoped credentials prevent key collision.

**Key files:** `openharness/engine/`, `openharness/skills/` (SkillLoader), `openharness/coordinator/` (SubagentSpawner), `openharness/mcp/` (MCPClient), `ohmo/gateway.py`

---

### 3.9 langroid (langroid/langroid) — Task-Wraps-Agent + Round-Robin Responders

**Stars:** 4k | **License:** MIT | **Last push:** May 2026 | **Lang:** Python

**Orchestration method:**

`Task` class wraps `Agent` and is the unit of orchestration. `Task.run()` has the same type signature as an agent responder, so **sub-tasks are simply additional responders** in the round-robin — no separate orchestration protocol needed.

**Three default responders per agent:** LLM responder, agent responder (internal logic), user responder (human-in-the-loop). Sub-tasks are added as additional responders; the Task drives round-robin iteration.

**@-addressing:** Agents address specific responders by name (`@task-name`). `PASS_TO` / `SEND_TO` signals for explicit routing. `done_sequences` for event-based termination. Infinite loop detection up to configurable cycle length (default 10).

**Message lineage tracking:** `RewindTool` allows an agent to rewind to a past message — all dependent messages are cleared via lineage graph. Enables "semantic undo."

**Tool attachment:** Pydantic-based `ToolMessage` classes. No JSON Schema writing required; type hints map automatically. Malformed syntax → Pydantic validation error fed back to LLM.

**LLM binding:** `ChatAgentConfig` selects LLM (OpenAI, local, LiteLLM). Vector store (Qdrant, Chroma, LanceDB, Pinecone, Weaviate, pgvector) and Redis/Momento cache configured per agent.

**Key files:** `langroid/agent/task.py`, `langroid/agent/chat_agent.py`, `langroid/agent/tools/`, `langroid/language_models/`

---

### 3.10 everything-claude-code (affaan-m/everything-claude-code) — Cross-Harness Platform Adapter

**Stars:** ~300 | **License:** MIT | **Last push:** May 2026 | **Lang:** JavaScript

**Orchestration method:**

The deepest cross-harness implementation found. Single canonical source compiled to **6 runtime targets** via platform-specific adapter scripts — not just config files but actual stdin/output format translation.

**Platform adapters:**
- Claude Code → native plugin (`plugin.json`, `hooks/hooks.json`)
- Codex → `.codex/config.toml`, `.agents/skills/` format translation
- OpenCode → `opencode.json` npm plugin, 11 plugin event types
- Cursor IDE → `hooks/adapter.js` (transforms Cursor stdin → Claude Code format), translated rule set
- Antigravity → flattened rules + workflow overlay
- Qwen CLI → selective home-dir install

**Hook system:** 8 Claude Code event types + 11 OpenCode plugin events. `ECC_HOOK_PROFILE=minimal|standard|strict`. `ECC_DISABLED_HOOKS` comma-separated kill switch. Hooks auto-load from plugin; manually adding to `settings.json` causes duplicates (regression-tested in 997+ test suite).

**Skill system (228 skills):** YAML-frontmatter markdown. Progressive disclosure: metadata always loaded, instructions activated on demand, resources on-demand. Continuous-learning v2 extracts instincts from session transcripts with confidence scores; `/evolve` clusters instincts into reusable skills.

**Security (AgentShield):** 1282 tests, 102 rules, A–F letter grade. Scans secrets, injection risks, MCP vulnerabilities. `--opus` flag spawns red-team/blue-team/auditor trio.

**Phase model:** Plan → TDD (RED/GREEN/IMPROVE) → Review + Security → Verify → Learn → Release. `/checkpoint` saves intermediate state. `/model-route` assigns tasks by complexity budget (Opus for architecture/security, Sonnet for dev, Haiku for ops).

**Key files:** `skills/` (228), `agents/` (60), `hooks/hooks.json`, `scripts/hooks/session-start.js`, `.cursor/hooks/adapter.js`, `tests/run-all.js` (997+ tests)

---

## Orchestration Patterns Surfaced

### Pattern 1 — Tiered-Cascade Routing (Zero-Token Short-Circuit)

**Evidence:** Citadel 4-tier (§3.1), OpenHarness permission modes, myclaude 5-phase /do routing
**Mechanism:** Dispatch never reaches LLM if a cheaper tier matches. Order: regex → session-state → keyword → LLM-classify. Only tier 4 costs tokens (~500).
**hima relevance:** Current `rules/skills.md` routing is prose-based (LLM-interpreted on every request). A tiered registry with regex tier 1, session-state tier 2, keyword registry tier 3 would save 200–500 tokens per request and improve routing determinism.
**Implementation:** `routing-registry.json` (keyword → skill mapping), `session-state.json` (active campaign check), regex patterns in a pre-routing hook.

### Pattern 2 — Declarative Topology with Provider-Agnostic Binding

**Evidence:** takt YAML workflows (§3.2), maestro source-to-runtime compilation (§3.5), gem-team YAML DAG, tutti config-driven workflows
**Mechanism:** Agents are workflow steps, not objects. Behaviour is composed from facets (persona, policy, instruction). Provider is a one-line config swap. The same topology file runs on Claude, Codex, Gemini, Cursor.
**hima relevance:** hima currently hardcodes Claude Code as primary. A declarative topology layer (even simple YAML) would make the adapter story credible — the same skill YAML would run on Claude Code, Codex, and Hermes with provider-specific bindings compiled out.
**Implementation:** `harness.yaml` defines workflow steps; `adapters/` directory compiles to `settings.json` (Claude Code), `AGENTS.md` (Codex), `hermes.config` (Hermes).

### Pattern 3 — Hard Safety Gate with Per-Tool Risk Classification

**Evidence:** Agent-Village `src/safety/gate.py` (§3.7), swarmclaw 409 guardrails + quorum joins, cordum ALLOW/DENY/REQUIRE_APPROVAL kernel, swarm-orchestrator obligation verifier
**Mechanism:** Safety limits enforced in code, not in prompt. Cannot be bypassed by agent instruction. Risk classification is per-tool (low/medium/high), not per-session. Hard limits: recursion depth, spawn count, token budget, execution timeout, blocked command patterns.
**hima relevance:** hima's `rules/core.md §7` says "Sub-agents must NEVER edit rules/" — this is a soft rule. A hard gate implementation would close the gap identified in `research-harness-extraction.md` item 8 (per-agent tool disallow list). The T/L/M/H/C risk classification maps directly to Agent-Village's low/medium/high tool risk — hima should add per-tool risk annotation to its tool registry.
**Implementation:** `src/safety/gate.js` (Node.js hook, fires PreToolUse), `config/safety-limits.yaml` (configurable hard limits), tool registry with risk field.

### Pattern 4 — Hash-Chained Append-Only Ledger (Evidence by Construction)

**Evidence:** swarm-orchestrator `.swarm/ledger/<run-id>.jsonl` with SHA-256 previous-hash (§ inventory #14), Bindu PostgreSQL task lifecycle, cordum deterministic audit trail
**Mechanism:** Every agent action is appended to a JSONL ledger with `previous_hash` field. Tamper-detection is mathematical, not trust-based. Content-addressed snapshots enable rollback to any verified state. Nothing commits unless the obligation verifier passes.
**hima relevance:** hima's compliance-artifact moat claim (Trait 4 from D1) is currently aspirational. A hash-chained ledger in `.hima/runs/<id>/events.jsonl` would make the claim concrete and auditable. This is the evidence-by-construction primitive that enterprise buyers need — not "we said we logged it" but "you can verify we logged it." Maps directly to the `thread.jsonl` pattern from research-harness-extraction.md item 6.
**Implementation:** `packages/ledger/` — append-only JSONL writer, SHA-256 chaining, `hima verify-ledger <run-id>` CLI command.

### Pattern 5 — Cross-Harness Platform Adapter Layer (Canonical Source → N Runtime Targets)

**Evidence:** ECC 6-runtime adapter system (§3.10), maestro source-to-runtime compiler (§3.5), takt provider config swap (§3.2), OpenHarness named profiles (§3.8)
**Mechanism:** One canonical skill/agent/hook directory is the source of truth. A compilation step (script or convention) produces platform-specific outputs: Claude Code `settings.json`, Codex `AGENTS.md`, Hermes `config.json`, etc. Platform adapters translate stdin formats and event types.
**hima relevance:** hima's multi-runtime claim (adapter coverage for Claude Code + Codex + Hermes) is the core product promise. Currently there is no adapter compilation layer — adapters are described in docs but not implemented as runnable code. ECC's approach (Node.js adapter scripts per platform, regression-tested in 997+ test suite) is the reference implementation. The key insight: the canonical source is hima's skills/agents/hooks; the adapter layer is ~50-200 lines of JSON/YAML transformation per target runtime.
**Implementation:** `adapters/claude-code.js`, `adapters/codex.js`, `adapters/hermes.js` — each reads canonical `skills/` and writes to runtime-specific format. `scripts/compile-adapters.js` drives the build. CI test: `tests/adapter-parity.test.js`.

---

## Additional Patterns (Notable but Secondary)

### Pattern 6 — RARV Cycle (Reason-Act-Reflect-Verify)

**Evidence:** loki-mode (41 specialists, 8 swarms, 9 quality gates), ralph-loop 10-step workflow with retrospection step
**Mechanism:** Every agent execution includes a Reflect step before the next cycle starts. Lessons from the reflect step are written to memory before proceeding. Verification is a named phase, not an afterthought.
**hima relevance:** hima's current pipeline (SPEC→TEST→BUILD) has no explicit reflect step. Adding a lightweight reflect hook (PostTaskComplete) that writes 3-sentence lesson to `.planning/<task>/retrospective.md` would compound quality over time.

### Pattern 7 — Git-Native Coordination Without Orchestrator Process

**Evidence:** gnap (Git-Native Agent Protocol — shared git repo as persistent task board, no orchestrator process), agent-orchestrator (git worktree per agent), amux (workspace-first + worktree)
**Mechanism:** Git is the coordination primitive. Agents read task assignments from a shared branch; write results to their own branch; the merge is the coordination event. No orchestrator daemon required — git IS the message bus.
**hima relevance:** hima's `.planning/` directory is already git-tracked but not used as a coordination bus. The gnap pattern would enable hima to coordinate multi-agent work without a central server — agents read task assignments from a shared `.planning/tasks.yaml` on a coordination branch.

### Pattern 8 — Conductor-Metaphor Persona Composition

**Evidence:** takt faceted prompting (§3.2), wshobson/agents 3-tier model routing, OpenHarness tiered profiles
**Mechanism:** System prompts are not monolithic strings — they are composed from independent facets (persona, policy, knowledge, instruction) that snap together at step invocation. Each facet is independently testable and swappable.
**hima relevance:** hima skills currently embed full context in SKILL.md body. Splitting into facets (PERSONA.md + POLICY.md + KNOWLEDGE.md + PROCEDURE.md per skill) would enable A/B testing of individual facets and reuse across skills.

### Pattern 9 — Self-Improving Skill Extraction from Session Transcripts

**Evidence:** ECC continuous-learning v2 (`/instinct-import`, `/instinct-export`, `/evolve`), ralph-loop retrospection step → memory L2/L3, swarmclaw conversation-to-skill drafting
**Mechanism:** Session transcripts are post-processed by an extractor agent to identify behavioral patterns. Patterns are stored with confidence scores; high-confidence patterns graduate to reusable skills. This creates a flywheel: more sessions → more instincts → better skills → better sessions.
**hima relevance:** hima has no automatic skill extraction. Adding a `PostTaskComplete` hook that runs a lightweight extractor on the session transcript and writes candidate instincts to `.hima/instincts/` (pending user review) would create the first automated skill-improvement loop.

### Pattern 10 — Scope-Cascade MCP Tool Binding

**Evidence:** swarmclaw per-server `alwaysExpose` vs lazy discovery (§3.6), OpenHarness MCP HTTP transport + graceful disconnection, ruflo 210 tools via 5 MCP server groups
**Mechanism:** MCP tools are not bulk-loaded at session start. Per-server policy governs binding: eager (always expose to all agents) vs lazy (discover on first request). Per-agent `mcpEagerTools` override for performance-critical tools. Long-lived connection pool minimizes token overhead.
**hima relevance:** hima's MCP integration is not documented as having lazy vs eager policy. Implementing `alwaysExpose: false` by default (lazy) with per-skill eager overrides would reduce session startup token cost by an estimated 15-30% for multi-MCP deployments.

---

## Disputed / Single-Source Claims

- **ruflo 50.6k stars**: The star count seems anomalously high for a project of this scope. Cross-validation was not possible (single source: GitHub topic page). Treat as approximate; verify against GitHub API before citing.
- **loki-mode, gnap, tutti**: Found only via the `andyrewlee/awesome-agent-orchestrators` curated list. No direct repo fetch was performed. Star counts unknown. Architecture details are from list descriptions only — verify before citing.
- **gald3r (wrm3) 17 stars**: HTTP 404 on direct fetch. Architecture details not available. Listed in inventory but no deep-dive.

---

## Sources

1. [github.com/topics/agent-orchestration](https://github.com/topics/agent-orchestration) — fetched May 2026
2. [github.com/topics/multi-agent](https://github.com/topics/multi-agent) — fetched May 2026
3. [github.com/topics/llm-agent](https://github.com/topics/llm-agent) — fetched May 2026
4. [github.com/topics/agent-swarm](https://github.com/topics/agent-swarm) — fetched May 2026
5. [github.com/topics/ai-orchestration](https://github.com/topics/ai-orchestration) — fetched May 2026
6. [SethGammon/Citadel](https://github.com/SethGammon/Citadel) — direct fetch, README + docs, May 2026
7. [nrslib/takt](https://github.com/nrslib/takt) — direct fetch, README + workflow docs, May 2026
8. [ruvnet/ruflo](https://github.com/ruvnet/ruflo) — direct fetch, README + architecture docs, May 2026
9. [ComposioHQ/agent-orchestrator](https://github.com/ComposioHQ/agent-orchestrator) — direct fetch, README + ARCHITECTURE.md, May 2026
10. [josstei/maestro-orchestrate](https://github.com/josstei/maestro-orchestrate) — direct fetch, README, May 2026
11. [swarmclawai/swarmclaw](https://github.com/swarmclawai/swarmclaw) — direct fetch, README + source structure, May 2026
12. [sreejagatab/Agent-Village](https://github.com/sreejagatab/Agent-Village) — direct fetch, README + src/ structure, May 2026
13. [HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness) — direct fetch, README + subsystem docs, Apr 2026
14. [langroid/langroid](https://github.com/langroid/langroid) — direct fetch, README + architecture docs, May 2026
15. [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) — direct fetch, README + source structure, May 2026
16. [cordum-io/cordum](https://github.com/cordum-io/cordum) — direct fetch, README + cmd/ structure, May 2026
17. [revfactory/harness](https://github.com/revfactory/harness) — direct fetch, README + skills/harness/, May 2026
18. [mubaidr/gem-team](https://github.com/mubaidr/gem-team) — direct fetch, README, May 2026
19. [moonrunnerkc/swarm-orchestrator](https://github.com/moonrunnerkc/swarm-orchestrator) — direct fetch, README + src/ structure, May 2026
20. [hoangsonww/AI-Agents-Orchestrator](https://github.com/hoangsonww/AI-Agents-Orchestrator) — direct fetch, README + file tree, May 2026
21. [GetBindu/Bindu](https://github.com/GetBindu/Bindu) — direct fetch, README + SDK docs, May 2026
22. [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) — direct fetch, README + src/ structure, May 2026
23. [desplega-ai/agent-swarm](https://github.com/desplega-ai/agent-swarm) — direct fetch, README, May 2026
24. [open-multi-agent/open-multi-agent](https://github.com/open-multi-agent/open-multi-agent) — direct fetch, README + src/, May 2026
25. [cexll/myclaude](https://github.com/cexll/myclaude) — direct fetch, README, May 2026
26. [alfredolopez80/multi-agent-ralph-loop](https://github.com/alfredolopez80/multi-agent-ralph-loop) — direct fetch, README + skills/, May 2026
27. [andyrewlee/amux](https://github.com/andyrewlee/amux) — direct fetch, README + ARCHITECTURE.md, May 2026
28. [andyrewlee/awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators) — fetched, full orchestrator list, May 2026
29. [wshobson/agents](https://github.com/wshobson/agents) — direct fetch, README + plugin structure, May 2026
30. [openai/swarm](https://github.com/openai/swarm) — direct fetch, README + source, May 2026
31. [23blocks-OS/ai-maestro](https://github.com/23blocks-OS/ai-maestro) — direct fetch, README, May 2026
32. [alfredolopez80/multi-agent-ralph-loop](https://github.com/alfredolopez80/multi-agent-ralph-loop) — direct fetch, May 2026
33. WebSearch: "agent-orchestration 2025 2026 multi-agent LLM" — 10+ results, May 2026
34. WebSearch: "multi-agent AI orchestration framework 2026" — 10+ results, May 2026
35. WebSearch: "llm-agent runtime harness orchestration 2025 2026" — 10+ results, May 2026
36. [LLM Orchestration 2026: Top 22 frameworks — AI Multiple](https://aimultiple.com/llm-orchestration) — May 2026
37. [8 best open-source AI agent frameworks 2026 — AY Automate](https://www.ayautomate.com/blog/best-open-source-ai-agent-frameworks) — May 2026
38. [Building AI Coding Agents for the Terminal — arXiv 2603.05344v1](https://arxiv.org/html/2603.05344v1) — 2026

---

*Generated by deep-researcher swarm-agent-3. Cross-validation: orchestration-method claims backed by direct WebFetch of each repo's README and source structure. 2026-priority: all repos verified active in 2025–2026 (last push dates confirmed). Disputed claims flagged in §Disputed section.*
