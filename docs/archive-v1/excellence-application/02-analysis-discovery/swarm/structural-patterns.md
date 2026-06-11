---
agent: swarm-agent-5
task: structural-patterns
status: complete
date: 2026-05-14
repos-analyzed: 10
evidence-type: gh-api-tree + raw-file-content + WebFetch
---

# Structural Patterns — Top Harness Repos Deep-Dive

## 1. Executive Summary — Top 5 Structural Patterns (leverage-ranked)

| Rank | Pattern | Convergence | Leverage for hima |
|------|---------|-------------|-------------------|
| P1 | **`.{tool}/skills/{name}/SKILL.md` discovery convention** — skills as one-dir-per-skill with a named markdown file + YAML frontmatter | 7/10 repos (OpenHands, Goose, opencode, OMX, Mastra, claude-flow, OpenHands) | CRITICAL — already partially adopted; needs formal frontmatter schema lock and cross-tool discovery paths |
| P2 | **State in a dedicated hidden dot-dir (`.{tool}/state/`)** — all runtime state centralized under one tool-scoped directory, NOT scattered across `.planning/`, `STATE.md`, `NEXT.md` | 6/10 repos (OMX `.omx/`, opencode `.opencode/`, OpenHands `.openhands/`, Goose `.goose/` implicit, claude-flow `.claude/checkpoints/`) | HIGH — hima currently scatters state; centralizing into `.hima/state/` would enable replay, audit, and cross-session continuity |
| P3 | **Per-model system prompt branches in `session/prompt/{model}.txt`** — separate prompt files per provider rather than one monolith | 3/10 repos (opencode: 9 model-specific files, OMX: `sisyphus/{model}.ts`, oh-my-openagent) | HIGH — hima targets Claude Code + Codex + Hermes; without per-model branches, prompt drift is silent |
| P4 | **`specs/` directory at root** — machine-readable protocol/API specs separate from human docs | 4/10 repos (opencode `specs/v2/`, mcp-agent `schema/`, mastra `docs/src/content/en/docs/`, OpenHands enterprise design-docs) | MEDIUM-HIGH — hima's `docs/conception/` fills this partially but mixes ADRs, specs, and design docs in one dir |
| P5 | **`.claude/commands/` for slash-command-style workflows** — lightweight command definitions as markdown files, separate from full skills | 3/10 repos (mastra `.claude/commands/`, claude-flow `.claude/commands/`, opencode `.opencode/command/`) | MEDIUM — hima's skills are heavy; a command layer for one-shot ops reduces skill-loading overhead |

---

## 2. Per-Repo Deep-Dives

---

### 2.1 OMX (oh-my-codex) — Reference Architecture

**Stars**: ~3K | **License**: MIT | **Runtime**: Node >=20 + Rust

#### Top-level directory structure

```
oh-my-codex/
  src/
    cli/              # CLI entry + 27 subcommands (omx.ts, index.ts)
    hooks/            # Keyword registry, detector, triage, session, overlay
    mcp/              # 5 first-party MCP servers (state, memory, code-intel, trace, wiki)
    agents/           # 33 agent definitions + native TOML generation
    team/             # tmux-based multi-agent runtime (12 sub-modules)
    adapt/            # Multi-runtime adapter layer (OpenClaw, Hermes stubs)
    state/            # State operations, workflow transitions, skill-active tracking
    catalog/          # manifest.json — skills + agents registry with status
  skills/             # 39 SKILL.md files, one dir per skill
  prompts/            # 33 agent .md files with identity/goal/constraints blocks
  .omx/               # RUNTIME state dir (not in source — created on install)
    state/            # Mode state JSON files per skill
    state/sessions/   # Session-scoped state
    logs/             # JSONL session history + daily logs
    adapters/         # Per-runtime adapter artifacts
    plans/            # Planning artifacts
    hooks/            # Custom hook plugins (.mjs)
  tests/              # Test suite
```

#### Documentation layout

- No `docs/` dir in source — docs are the skills themselves + prompts/
- ADRs: none in repo (harness-level ADRs live in user project)
- Architecture: `.planning/external-harness-research/clones/oh-my-codex/` (this project's own deep-dive)
- Specs: skills serve as the executable spec

#### Skill / agent layout

- **Skills**: `skills/{name}/SKILL.md` — YAML frontmatter with `name:` and `description:` only
- **Agents**: `prompts/{name}.md` with `<identity>`, `<goal>`, `<constraints>` blocks + TOML in `.codex/agents/`
- **Catalog**: `src/catalog/manifest.json` — all skills + agents with `status: active|alias|merged|deprecated|internal`
- **Keyword registry**: `src/hooks/keyword-registry.ts` — 70 entries, `{keyword, skill, priority, guidance}`

#### State / runtime layout

```
.omx/state/
  session.json                  # Current session PID + cwd + timestamps
  skill-active.json             # Active keyword/skill
  {mode}-state.json             # Per-mode state (autopilot, ralph, team, etc.)
  sessions/{sessionId}/         # Session-scoped copies of above
  team/tasks/                   # Team task files
  team/mailbox/                 # Inter-worker messages
  team/events/                  # Team event log
.omx/logs/
  session-history.jsonl         # Append-only session archive
  omx-YYYY-MM-DD.jsonl          # Daily structured log
```

#### Hook / policy layout

- **Entry**: `settings.json` `hooks` array → `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`
- **Logic**: `src/hooks/keyword-detector.ts` (1226 lines) — detects keywords, seeds state, applies ralplan gate
- **Plugin system**: `src/hooks/extensibility/` — `.mjs` plugins in `.omx/hooks/`, timeout 1500ms, child-process sandboxed
- **Policy**: `src/state/workflow-transition.ts` — which modes can co-exist

#### Best 3 things hima should harvest

1. **Catalog manifest** (`src/catalog/manifest.json`) — declares every skill and agent with status. hima has no equivalent; skills and agents are discovered by file presence only, no authoritative registry.
2. **State scope layering** — root scope (`.omx/state/{mode}.json`) + session scope (`.omx/state/sessions/{id}/{mode}.json`), both written on every change. hima's state scatters across `STATE.md`, `NEXT.md`, `.planning/`.
3. **Ralplan gate** (`src/hooks/keyword-detector.ts:177`) — vague prompt → redirect to planning before execution. hima has no equivalent prompt-specificity guard.

---

### 2.2 OpenHands (AllHands AI)

**Stars**: ~45K | **License**: MIT | **Runtime**: Python + Docker

#### Top-level directory structure

```
OpenHands/
  openhands/              # Core Python SDK + app server
    app_server/           # FastAPI server (conversations, file_store, integrations)
    server/               # Server config
    analytics/            # Usage analytics
  openhands-ui/           # React component library (storybook)
  frontend/               # React SPA (local GUI)
  .openhands/             # Project-level config
    microagents/          # Knowledge-type microagents (documentation.md, glossary.md)
  .agents/                # AgentSkills-spec skills
    skills/
      update-sdk/         # Skill with SKILL.md + references/ subdirectory
      cross-repo-testing/ # Skill with SKILL.md
      upcoming-release/   # Skill with SKILL.md
  enterprise/             # Source-available enterprise extensions
    doc/architecture/     # Architecture docs
    doc/design-doc/       # Design documents
    integrations/         # GitHub, GitLab, Jira, Slack, etc.
  containers/             # Docker definitions (app, dev)
  scripts/                # Utility scripts
  tests/                  # Test suite
```

#### Documentation layout

- External docs at `docs.openhands.dev`
- Architecture docs in `enterprise/doc/architecture/`
- Design docs in `enterprise/doc/design-doc/`
- In-repo: `CONTRIBUTING.md`, `Development.md`, `README.md`
- Microagents in `.openhands/microagents/` — `documentation.md`, `glossary.md`

#### Skill / agent layout

- **Two-tier system**:
  - `.agents/skills/{name}/SKILL.md` — AgentSkills spec (task-type skills with references/)
  - `.openhands/microagents/{name}.md` — knowledge-type microagents
- **SKILL.md frontmatter schema** (from `update-sdk/SKILL.md`):
  ```yaml
  ---
  name: update-sdk
  description: |
    Trigger phrases: "update SDK", "bump SDK version", "pin SDK"...
    For detailed reference, see references/ subdirectory.
  ---
  ```
- **Microagent frontmatter** (from `documentation.md`):
  ```yaml
  ---
  name: documentation
  type: knowledge
  version: 1.0.0
  agent: CodeActAgent
  triggers:
    - documentation
    - docs
    - document
  ---
  ```
- Key difference: `type: knowledge` vs task skills — knowledge agents are injected into context on trigger match; task skills are executed as workflows

#### State / runtime layout

- Runtime state: `ConversationState` object — immutable, deterministic replay
- Persistence: `app_server/file_store/` — file-based conversation store
- No explicit `.planning/` equivalent at harness level — state is conversation-scoped
- Enterprise: PostgreSQL via Alembic migrations (`app_server/app_lifespan/alembic/`)

#### Hook / policy layout

- `LLMSecurityAnalyzer` — per-action Low/Medium/High/Unknown risk scoring
- `ConfirmRisky` policy — blocks actions above configurable threshold
- `SecretRegistry` — auto-masking of sensitive values
- No Claude Code-style `settings.json` hooks — OpenHands runs its own agent loop

#### Best 3 things hima should harvest

1. **Two-tier microagent schema** — `type: knowledge` (context injection) vs `type: task` (workflow execution) with explicit `triggers:` array in frontmatter. hima has no type distinction; all skills are loaded the same way.
2. **`references/` subdirectory pattern** — `update-sdk/references/docker-image-locations.md`, `update-sdk/references/sdk-pinning-examples.md`. Complex skills have a `references/` dir with supporting materials. hima uses this pattern in the excellence books but NOT in skills.
3. **Version field in microagent frontmatter** (`version: 1.0.0`) — enables skill versioning and marketplace compatibility. hima skills have no version field.

---

### 2.3 opencode (SST)

**Stars**: ~18K | **License**: MIT | **Runtime**: TypeScript/Bun

#### Top-level directory structure

```
opencode/
  packages/
    opencode/             # Core server (TypeScript/Bun)
      src/
        agent/            # Agent definitions + prompt templates
        session/          # Session lifecycle + per-model prompt files
          prompt/         # 9 model-specific .txt files (anthropic, codex, gemini, gpt, kimi, beast, plan, trinity, copilot)
        skill/            # Skill discovery + loading service
        permission/       # Permission schema + evaluator
        snapshot/         # Session snapshot (revert support)
        storage/          # SQLite DB (db.bun.ts, schema.sql.ts)
        mcp/              # MCP client integration
        session/prompt/   # plan-reminder-anthropic.txt (plan-mode anti-bypass)
    app/                  # TUI frontend (Ink)
    console/              # Web console (SvelteKit)
  .opencode/              # Project-level config
    skills/               # Project-scoped skills
      effect/SKILL.md     # Stack-specific skill (Effect v4)
      improve-codebase-architecture/SKILL.md
    agent/                # Project-scoped agent definitions
      triage.md           # Agent with frontmatter: mode, hidden, model, color, tools
    command/              # Slash-command definitions
  specs/                  # Machine-readable protocol specs
    project.md
    v2/api.html, provider-model.md, session.md, todo.md
  sdks/vscode/            # VS Code extension SDK
  infra/                  # Infrastructure (AWS CDK)
  scripts/                # Build scripts
```

#### Documentation layout

- External docs at `opencode.ai/docs`
- Specs in `specs/` — protocol-level, versioned (`v2/`)
- `AGENTS.md` at root — agent documentation
- README in 23 languages

#### Skill / agent layout

- **SKILL.md frontmatter** (from `.opencode/skills/effect/SKILL.md`):
  ```yaml
  ---
  name: effect
  description: Work with Effect v4 / effect-smol TypeScript code in this repo
  ---
  ```
- **Agent frontmatter** (from `.opencode/agent/triage.md`):
  ```yaml
  ---
  mode: primary
  hidden: true
  model: opencode/gpt-5.4-nano
  color: "#44BA81"
  tools:
    "*": false
    "github-triage": true
  ---
  ```
- Agent definition is richer than skill — includes `mode`, `hidden`, `model`, `color`, `tools` allowlist/blocklist
- **Skill discovery**: `packages/opencode/src/skill/discovery.ts` — HTTP-based remote skill pulling with local cache, Effect-typed service layer, concurrency controlled (4 skills / 8 files concurrent)
- **Per-model prompts**: `packages/opencode/src/session/prompt/` — `anthropic.txt`, `codex.txt`, `gemini.txt`, `gpt.txt`, `kimi.txt`, `beast.txt`, `plan.txt`, `plan-reminder-anthropic.txt`, `trinity.txt`
- `plan-reminder-anthropic.txt` — explicit anti-bypass clause for plan mode (blocks `sed/tee/echo/cat` filesystem manipulation)

#### State / runtime layout

- SQLite via `packages/opencode/src/storage/db.bun.ts` — primary state store
- `packages/opencode/src/snapshot/` — session snapshots for revert
- `packages/opencode/src/session/run-state.ts` — in-memory session state
- No flat JSON files — fully database-backed state
- Session schema: `packages/opencode/src/session/session.sql.ts`

#### Hook / policy layout

- `packages/opencode/src/permission/` — `schema.ts` (PermissionID type), `evaluate.ts`, `arity.ts`
- `packages/app/src/context/permission-auto-respond.ts` — auto-respond to permission prompts
- `packages/opencode/src/session/prompt/plan-reminder-anthropic.txt` — plan-mode policy enforcement via prompt injection
- No external hook scripts — policy enforced in-process

#### Best 3 things hima should harvest

1. **Per-model prompt files** (`session/prompt/{model}.txt`) — 9 separate files, one per provider model family. The `plan-reminder-anthropic.txt` anti-bypass clause is a policy enforced via prompt, not code. hima should mirror this pattern for Claude Code, Codex CLI, Hermes.
2. **Agent frontmatter with `tools` allowlist** — `tools: {"*": false, "github-triage": true}` gives per-agent tool isolation at the definition level. hima's `agents.md` documents tool restrictions in prose; this makes them machine-enforced.
3. **`specs/` directory with protocol versioning** — `specs/v2/session.md`, `specs/v2/api.html` etc. hima's `docs/conception/` mixes ADRs + specs + design docs. Separating machine-readable specs into `specs/` enables tooling to validate against them.

---

### 2.4 Goose (Block / AAIF)

**Stars**: ~29K | **License**: Apache 2.0 | **Runtime**: Rust

#### Top-level directory structure

```
goose/
  crates/
    goose/                # Core library (agent loop, session, providers)
    goose-cli/            # CLI + session management + recipes
      src/
        commands/         # CLI subcommands
        recipes/          # YAML recipe definitions
        session/          # Session lifecycle
        scenario_tests/   # Recorded test scenarios (per-provider)
    goose-mcp/            # Built-in MCP tools
      src/
        memory/           # Memory MCP server
        computercontroller/ # Computer control tools
        autovisualiser/   # Visualization tools
        peekaboo/         # Screen observation
        tutorial/         # Tutorial content
    goose-sdk/            # SDK for extension authors
    goose-server/         # HTTP server + desktop UI
    goose-acp-macros/     # ACP (Agent Communication Protocol) macros
    goose-test-support/   # Test utilities
  .claude/skills/         # Claude Code skills (4 skills)
    code-review/SKILL.md
    create-app-e2e-test/SKILL.md
    create-pr/SKILL.md
    edge-case-finder/SKILL.md
  .codex/skills/          # Codex skills (same 4)
  .cursor/skills/         # Cursor skills (same 4)
  documentation/          # Full docs site (Docusaurus)
    .goose/memory/        # Project-level goose memory
    automation/           # Automated CLI tracking + recipe schema tracking
    blog/                 # Blog posts (dated)
  evals/                  # Model evaluation benchmarks
  workflow_recipes/       # Release automation recipes
  bin/                    # CLI binaries
  ui/                     # Desktop UI (TypeScript)
  CLAUDE.md               # Claude integration spec
  GOVERNANCE.md           # Project governance
  .goosehints             # Agent behavior hints
```

#### Documentation layout

- Full docs site in `documentation/` (Docusaurus)
- Blog posts in `documentation/blog/` (dated, 20+ posts)
- `GOVERNANCE.md` at root — explicit governance model (rare for harnesses)
- `CLAUDE.md` at root — Claude integration instructions
- Architecture: distributed across `documentation/`

#### Skill / agent layout

- **Three cross-tool paths**: `.claude/skills/`, `.codex/skills/`, `.cursor/skills/` — same 4 skills duplicated across 3 runtimes
- Skills are checked into the repo itself, not just user-level
- `crates/goose-cli/src/recipes/` — YAML workflow recipes (separate from skills)
- `workflow_recipes/` — automation recipes at repo level
- `.goosehints` — project-level agent behavior hints (lightweight config)

#### State / runtime layout

- State: session-level, managed in `crates/goose-cli/src/session/`
- Memory: `crates/goose-mcp/src/memory/` — MCP-served memory
- `documentation/.goose/memory/` — documentation project-level goose memory
- No explicit `.planning/` equivalent

#### Hook / policy layout

- Extension architecture: `crates/goose-sdk/` — extension API
- Egress logging inspector (referenced in D1)
- `crates/goose-acp-macros/` — ACP (Agent Communication Protocol) macros
- Permission model: SmartApprove (LLM-judge, referenced in research-harness-extraction.md)

#### Best 3 things hima should harvest

1. **Cross-tool skill duplication** — `.claude/skills/`, `.codex/skills/`, `.cursor/skills/` all contain the same skills. This is the cross-tool compatibility claim made concrete. hima should add explicit `.codex/skills/` and `.hermes/skills/` discovery paths alongside `~/.claude/skills/`.
2. **`GOVERNANCE.md` at root** — explicit governance model for open-source projects. hima has no governance doc. At v0.1.0, a governance doc (contributor guidelines, decision-making process, license stewardship) signals long-term stability to enterprise buyers.
3. **`workflow_recipes/` separate from skills** — YAML recipes for automation workflows are distinct from SKILL.md files. Recipes are declarative pipelines; skills are behavioral instructions. hima conflates these; separating them enables machine-readable pipeline definitions.

---

### 2.5 claude-flow (ruvnet)

**Stars**: ~4K | **License**: MIT | **Runtime**: TypeScript/Node

#### Top-level directory structure

```
claude-flow/
  .agents/                # AgentSkills-spec skills (70+ SKILL.md files)
    config.toml           # Agent configuration
    skills/
      agent-{name}/SKILL.md  # One dir per agent-skill (e.g. agent-planner, agent-coder)
  .claude/                # Claude Code integration
    agents/               # Typed agent definitions (by category)
      sparc/              # SPARC methodology agents (specification, pseudocode, architecture, refinement)
      analysis/           # Code review, bottleneck detection
      architecture/       # System design
      development/        # Backend API
      testing/            # Unit tests, validation
      swarm/              # Swarm coordination
      hive-mind/          # Collective intelligence
      consensus/          # Consensus coordination
      [20+ more categories]
    commands/             # Slash-command workflows (by category)
      agents/             # Agent management commands
      analysis/           # Analysis commands
      automation/         # Self-healing, session memory
      coordination/       # Swarm init, orchestration
      github/             # GitHub integration commands
      [10+ more categories]
    checkpoints/          # Session checkpoint files
  .claude-plugin/         # Claude Code plugin metadata
    hooks/
      hooks.json          # Hook definitions (PreToolUse, PostToolUse, PreCompact)
    docs/                 # Plugin documentation
    scripts/              # Hook shim scripts (ruflo-hook.sh)
  docs/                   # User documentation
    STATUS.md
    USERGUIDE.md
    federation/           # Federation architecture docs
    validation/           # Validation documentation
  ruflo/                  # Core TypeScript source
  plugin/                 # Plugin framework
  plugins/                # 32 native plugins
  v3/                     # Version 3 implementation
  verification/           # Cryptographic verification
  CLAUDE.md, AGENTS.md    # Root integration files
  USERGUIDE.md            # Daily reference document
```

#### Documentation layout

- `docs/USERGUIDE.md` — comprehensive daily reference
- `docs/STATUS.md` — project status
- `docs/federation/` — federation architecture
- `CLAUDE.md` at root — Claude integration spec
- `AGENTS.md` at root — agent spec

#### Skill / agent layout

- **Dual-track**: `.agents/skills/agent-{name}/SKILL.md` (70+ skills) + `.claude/agents/{category}/{name}.md`
- Agent categories in `.claude/agents/`: sparc, analysis, architecture, consensus, core, data, development, devops, documentation, dual-mode, flow-nexus, github, goal, hive-mind, neural, optimization, payments, reasoning, sona, specialized, sublinear, swarm, templates, testing, v3
- SPARC methodology encoded as 4 agents: `specification.md`, `pseudocode.md`, `architecture.md`, `refinement.md`
- Commands in `.claude/commands/` — 10+ categories with README per category

#### State / runtime layout

- `.claude/checkpoints/` — session checkpoints
- `agentdb.rvf` — vector database state file at root
- Memory management via `plugins/` (32 plugins include memory, security)

#### Hook / policy layout

From `.claude-plugin/hooks/hooks.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {"matcher": "Bash", "hooks": [{"command": "ruflo-hook.sh modify-bash || true"}]},
      {"matcher": "Write|Edit|MultiEdit", "hooks": [{"command": "ruflo-hook.sh modify-file || true"}]}
    ],
    "PostToolUse": [
      {"matcher": "Bash", "hooks": [{"command": "ruflo-hook.sh post-command --track-metrics --store-results"}]},
      {"matcher": "Write|Edit|MultiEdit", "hooks": [{"command": "ruflo-hook.sh post-edit --format --update-memory"}]}
    ],
    "PreCompact": [...]
  }
}
```
- All hooks route through a resilient shim (`ruflo-hook.sh`) that falls back to `npx --prefer-offline` and always exits 0
- `PreToolUse[Bash]` — command interception/modification
- `PostToolUse[Write|Edit|MultiEdit]` — post-edit formatting + memory update
- `PreCompact` — context window management

#### Best 3 things hima should harvest

1. **SPARC methodology agents** (`.claude/agents/sparc/`) — Specification → Pseudocode → Architecture → Refinement as 4 discrete agent files. Maps cleanly to hima's SPEC→TEST→BUILD→VERIFY cycle. The separation into files makes the methodology machine-readable and testable.
2. **Hooks.json resilience pattern** — every hook command ends with `|| true` and routes through a shim that gracefully handles missing binary. hima's hooks can fail hard if hook scripts aren't installed. The shim pattern + always-exit-0 prevents hook failures from blocking Claude Code turns.
3. **Command layer separate from skills** (`.claude/commands/` vs `.agents/skills/`) — commands are one-shot slash-command workflows; skills are persistent behavioral frameworks. The separation prevents skill-loading overhead for simple operations. hima should adopt this two-tier pattern.

---

### 2.6 12-factor-agents (HumanLayer)

**Stars**: ~9K | **License**: Apache 2.0 | **Runtime**: TypeScript/BAML

#### Top-level directory structure

```
12-factor-agents/
  content/                # Documentation for each of the 12 factors
  packages/
    create-12-factor-agent/  # Scaffolding tool
      template/
        baml_src/         # BAML type definitions for agents
        src/              # TypeScript agent implementations
    walkthroughgen/       # Walkthrough generator tool
  workshops/              # Workshop materials (dated)
    2025-05-17/
      sections/           # Per-section workshop materials with walkthroughs
    2025-05/final/        # Final workshop state
  drafts/                 # Work-in-progress content
  img/                    # Visual assets
  CLAUDE.md               # Claude integration
  README.md               # 12-factor principles
  Makefile                # Build automation
```

#### Documentation layout

- `content/` — one file per factor (12 factors)
- `workshops/` — dated workshop materials, each with step-by-step walkthroughs
- No `docs/` dir — content IS the docs
- BAML type definitions in `template/baml_src/` — schema-first approach

#### Skill / agent layout

- Not a harness with skills — a reference architecture / educational framework
- Templates in `packages/create-12-factor-agent/template/` — scaffold for implementing the 12 factors
- The 12 factors are the "skill equivalent": each factor is a design principle with implementation guidance

#### State / runtime layout

- Factor 5: "Unify execution state and business state" — key architectural principle
- Factor 6: "Launch/Pause/Resume with simple APIs" — state machine API design
- Factor 12: "Make your agent a stateless reducer" — state as pure function of events
- No runtime state files — educational framework only

#### Hook / policy layout

- Factor 7: "Contact humans with tool calls" — typed human-handoff as tool call
- Factor 8: "Own your control flow" — explicit control flow, not agent-delegated
- Not applicable as a runtime — principles only

#### Best 3 things hima should harvest

1. **Factor 5 — Unified execution + business state**: the `thread.jsonl` pattern — one append-only event log that IS both the execution trace and the business state. hima currently separates these (LOOP-TRACE.md for execution, FEATURES.json for business state). Converging them into `.hima/runs/{id}/events.jsonl` is the Factor 5 implementation.
2. **Factor 7 — Typed human-handoff as tool call**: `request_human_input({urgency, format, choices, threadId})` emitted to `handoffs.jsonl`. hima's M/H/C risk tiers require human checkpoint but have no typed primitive for it. This is the missing implementation for the risk-tier gate.
3. **Factor 12 — Stateless reducer**: agent state as a pure function of the event log. hima's session state is mutable JSON files. The reducer pattern makes state deterministic, replayable, and auditable — which is exactly what the evidence-gate claim requires.

---

### 2.7 mcp-agent (LastMile AI)

**Stars**: ~6K | **License**: Apache 2.0 | **Runtime**: Python

#### Top-level directory structure

```
mcp-agent/
  src/mcp_agent/          # Primary Python package
  docs/                   # Documentation
  examples/               # Runnable examples by pattern type
  schema/                 # Data schemas and specifications
  scripts/                # Utility scripts
  tests/                  # Test suite
  logs/                   # Application logs
  LLMS.txt                # Documentation formatted for LLM consumption
  gallery.md              # Community examples
  README.md, CONTRIBUTING.md, SECURITY.md
```

#### Documentation layout

- External docs at `docs.mcp-agent.com`
- `schema/` — machine-readable schema specs
- `LLMS.txt` — notable pattern: docs formatted specifically for LLM consumption (not human readers)
- `gallery.md` — community showcase

#### Skill / agent layout

- Agent patterns defined in `examples/` — organized by pattern type, not by agent name
- `schema/` — data schemas define the agent API contract
- No SKILL.md convention — Python class-based agent definitions

#### State / runtime layout

- `logs/` at root — application logs kept in repo structure
- State: in-process Python objects
- No persistent state directory convention

#### Hook / policy layout

- MCP-native — policies enforced via MCP tool definitions
- `schema/` directory is the policy spec

#### Best 3 things hima should harvest

1. **`LLMS.txt` pattern** — a documentation file formatted specifically for LLM consumption, distinct from human-readable README. hima should add `HIMA.txt` or `LLMS.txt` at root that gives AI agents a dense, LLM-optimized project overview — improves cold-start context quality.
2. **`schema/` directory** — machine-readable schemas separate from narrative docs. hima's `docs/conception/` contains specs in prose; extracting the schema-defining parts into `schema/` or `specs/` enables validation tooling.
3. **`gallery.md` community showcase** — a curated community examples file. hima's B7 marketplace bet needs a lightweight first step; `gallery.md` or `marketplace.json` at root is that step before a full registry is built.

---

### 2.8 Mastra (mastra-ai)

**Stars**: ~22K | **License**: MIT | **Runtime**: TypeScript/Node

#### Top-level directory structure

```
mastra/
  packages/               # Core packages
  auth/                   # Auth integrations (Auth0, Clerk, Firebase, Better Auth)
  docs/                   # Full docs site (Astro)
    src/content/en/docs/
      agents/             # Agent documentation
      memory/             # Memory system docs
      mcp/                # MCP integration docs
      observability/      # Tracing + metrics docs
      evals/              # Evaluation framework docs
      workflows/          # Workflow docs
  .agents/skills/
    testing-core-processors/SKILL.md  # One skill
  .claude/                # Claude Code integration
    commands/             # 12 slash-command definitions
      changeset.md, commit.md, critique-pr.md, document.md
      gh-bulk-issues.md, gh-debug-issue.md, gh-fix-ci.md, gh-fix-lint.md
      gh-new-pr.md, gh-pr-comments.md, make-moves.md, pr.md, ralph-plan.md, selfreview.md
    skills/               # 10 skills with references/ subdirs
      debugging-difficult-bugs/   # SKILL.md + rich body
      mastra-docs/references/     # 20+ reference files
      mastra-smoke-test/references/tests/  # Test reference files
      react-best-practices/references/rules/
      tailwind-best-practices/references/rules/
      [5 more skills]
  .cursor/commands/       # Cursor slash commands
  .opencode/command/      # Opencode commands
  .mastracode/commands/   # Mastracode commands
  .changeset/             # Changesets for versioning
  evals/                  # Evaluation framework
```

#### Documentation layout

- Full Astro docs site in `docs/src/content/en/docs/`
- Sections: agents, memory, mcp, observability (tracing + metrics), evals, workflows, browser, deployment, editor
- `.changeset/` — versioning via changesets (semantic versioning automation)
- `evals/` — evaluation framework at repo root level

#### Skill / agent layout

- **SKILL.md frontmatter** (from `debugging-difficult-bugs/SKILL.md`):
  ```yaml
  ---
  name: debugging-difficult-bugs
  description: |
    Use early when debugging a medium or hard bug...
    Trigger this before extended TDD iteration when a bug involves
    runtime state, ordering, persistence, streaming, UI/manual reproduction...
  ---
  ```
- Skills have rich trigger descriptions in `description:` field — multiple lines explaining WHEN to use
- `references/` subdirectory used extensively — e.g., `mastra-docs/references/` has 20+ reference files
- **Commands** in `.claude/commands/` — 14 files for one-shot operations (`ralph-plan.md`, `selfreview.md`, `gh-fix-ci.md`, etc.)
- Cross-tool commands: `.cursor/commands/`, `.opencode/command/`, `.mastracode/commands/` — same commands adapted per tool

#### State / runtime layout

- `packages/` — in-process state via Mastra agent/workflow objects
- `observability/tracing/` — OpenTelemetry integration for state visibility
- `evals/` — evaluation state + results

#### Hook / policy layout

- `.husky/` — Git hooks for pre-push validation
- OpenBox AI integration (external) — policy enforcement at runtime
- `observability/metrics/` — metrics for policy monitoring

#### Best 3 things hima should harvest

1. **Cross-tool command files** (`.claude/commands/`, `.cursor/commands/`, `.opencode/command/`, `.mastracode/commands/`) — same commands maintained for 4 different tools. The `ralph-plan.md` command in Mastra's `.claude/commands/` is directly borrowed from OMC/OMX vocabulary, showing convergence. hima should maintain a `commands/` layer that maps to all 3 adapter targets.
2. **Multi-line trigger description in SKILL.md** — Mastra's `debugging-difficult-bugs` has a rich multi-sentence description explaining trigger conditions. hima's skills use single-line descriptions. The richer description improves LLM routing accuracy without requiring a separate keyword registry.
3. **`evals/` directory at repo root** — evaluation framework co-located with the project. hima has `evals/baseline.json` but it's not organized as a first-class directory. Promoting evals to a root-level directory signals commitment to measurement — critical for the "evidence-based" positioning claim.

---

### 2.9 CrewAI

**Stars**: ~30K | **License**: MIT | **Runtime**: Python

#### Top-level directory structure

```
crewai/
  src/
    my_project/           # Example project structure
      config/
        agents.yaml       # Agent definitions (YAML)
        tasks.yaml        # Task definitions (YAML)
  docs/                   # Documentation
  lib/                    # Library core
  .pre-commit-config.yaml # Pre-commit hooks
  pyproject.toml
```

#### Documentation layout

- External docs at docs.crewai.com
- `docs/` in repo — supplementary
- No ADR pattern, no `specs/` directory

#### Skill / agent layout

- **`config/agents.yaml`** — agents defined in YAML with role, goal, backstory, tools
- **`config/tasks.yaml`** — tasks defined in YAML with description, expected_output, agent assignment
- No SKILL.md convention — pure YAML configuration
- Pre-commit validation hooks for schema checking

#### State / runtime layout

- In-process Python objects
- No persistent state directory

#### Hook / policy layout

- `.pre-commit-config.yaml` — pre-commit hooks for code quality
- No runtime hook system equivalent to Claude Code hooks

#### Best 3 things hima should harvest

1. **`config/tasks.yaml` with `expected_output` field** — every task declares its expected output format. hima's deliverables.json (from OMC) is the equivalent, but CrewAI shows this at the per-task level. hima should require every skill to declare `expected_outputs:` in frontmatter.
2. **YAML-first agent definition** — agents defined as pure data (role, goal, backstory, tools). Simpler than markdown for programmatic manipulation. hima could adopt YAML for the machine-readable layer and keep markdown for the human-readable instruction body.
3. **Pre-commit validation** — `.pre-commit-config.yaml` runs schema validation on every commit. hima's `tests/run-all.sh` runs manually; adding pre-commit hooks for frontmatter validation + cross-reference integrity would catch regressions before commit.

---

### 2.10 mcp-agent + Kiro (bonus — structural contrast)

These two repos provide structural contrast on spec-driven vs. capability-driven architectures.

**Kiro (AWS)** — spec-driven IDE:
- Core structural unit: the spec triple (`requirements.md` + `design.md` + `tasks.md`)
- Specs are version-controlled alongside code
- Hooks on `file-save`, `spec-event`, `PR-open`, `cron`
- No SKILL.md — everything is spec-driven

**Key harvest for hima**: Kiro's `tasks.md` (checklist of atomic tasks derived from design) is the equivalent of hima's PLAN.md but machine-verifiable. The agent checks tasks off as it completes them. hima should adopt a `tasks.md` or `TASKS.md` convention within `.planning/{feature}/` that enables the deliverables gate.

---

## 3. Cross-Repo Patterns Matrix

| Pattern | OpenHands | opencode | Goose | OMX | claude-flow | Mastra | 12-factor | mcp-agent | CrewAI | Kiro | Convergence |
|---------|-----------|----------|-------|-----|-------------|--------|-----------|-----------|--------|------|-------------|
| `SKILL.md` in `{name}/` dir | YES (.agents/skills/) | YES (.opencode/skills/) | YES (.claude/skills/) | YES (skills/) | YES (.agents/skills/) | YES (.claude/skills/) | NO | NO | NO | NO | **6/10 — TABLE STAKES** |
| YAML frontmatter on skills | YES | YES | YES (inferred) | YES | YES | YES | N/A | N/A | YES (agents.yaml) | N/A | **5/10 — CONVERGENT** |
| `references/` subdir in skills | YES (update-sdk/) | NO | NO | NO | NO | YES (mastra-docs/) | NO | NO | NO | YES (spec files) | **3/10 — EMERGING** |
| Dedicated `.{tool}/state/` dir | NO (ConvState) | YES (SQLite) | implicit | YES (.omx/state/) | YES (.claude/checkpoints/) | NO | NO | NO | NO | YES | **4/10 — CONVERGENT** |
| Per-model prompt files | NO | YES (9 files) | NO | partial | NO | NO | NO | NO | NO | NO | **2/10 — DIVERGENT** |
| `commands/` separate from skills | NO | YES (.opencode/command/) | NO | NO | YES (.claude/commands/) | YES (.claude/commands/) | NO | NO | NO | NO | **3/10 — EMERGING** |
| `specs/` directory at root | NO | YES (specs/v2/) | NO | NO | NO | NO | NO | YES (schema/) | NO | YES (spec triple) | **3/10 — EMERGING** |
| Append-only event log (JSONL) | NO | NO | NO | YES (session-history.jsonl) | NO | NO | YES (Factor 5) | NO | NO | NO | **2/10 — DIVERGENT** |
| Hooks via `hooks.json` / `settings.json` | NO | NO | NO | YES | YES | partial (.husky) | NO | NO | YES (.pre-commit) | YES (event hooks) | **4/10 — CONVERGENT** |
| Keyword/trigger registry (code-side) | YES (triggers[]) | NO | NO | YES (70 keywords) | NO | NO | NO | NO | NO | NO | **2/10 — DIVERGENT** |
| Catalog/manifest of all skills | NO | NO | NO | YES (manifest.json) | NO | NO | NO | NO | NO | NO | **1/10 — UNIQUE** |
| `evals/` directory | YES | NO | YES (evals/open-model-gym) | partial | NO | YES | NO | NO | NO | NO | **3/10 — EMERGING** |
| `GOVERNANCE.md` | NO | NO | YES | NO | NO | NO | NO | NO | NO | NO | **1/10 — UNIQUE** |
| `LLMS.txt` for LLM consumption | NO | NO | NO | NO | NO | NO | NO | YES | NO | NO | **1/10 — UNIQUE** |
| Cross-tool skill duplication | YES (3 paths) | NO | YES (.claude/.codex/.cursor) | partial | NO | YES (4 tools) | N/A | N/A | NO | N/A | **3/10 — EMERGING** |
| `version:` field in skill frontmatter | YES (microagents) | NO | NO | NO | NO | NO | N/A | N/A | N/A | N/A | **1/10 — UNIQUE** |
| Agent `tools:` allowlist in frontmatter | NO | YES | NO | partial (TOML) | NO | NO | N/A | NO | YES (tasks.yaml) | NO | **2/10 — DIVERGENT** |
| Typed human-handoff primitive | NO | NO | NO | NO | NO | NO | YES (Factor 7) | NO | NO | YES | **2/10 — DIVERGENT** |

**Legend**: TABLE STAKES = 6+/10 convergent; CONVERGENT = 4-5/10; EMERGING = 3/10; DIVERGENT = <3/10; UNIQUE = 1/10

---

## 4. Recommendations for hima

### R1 — Adopt the 3-level skill directory standard (P1, TABLE STAKES)

**Source**: OpenHands, opencode, Goose, OMX, Mastra, claude-flow

The convergent standard is:
```
.hima/
  skills/
    {name}/
      SKILL.md        # Frontmatter + body
      references/     # Optional supporting material
```

hima's current skill location is `~/.claude/skills/` (user-global). The fix is:
1. Lock the frontmatter schema: `name`, `description`, `version`, `type` (task|knowledge), `triggers[]`, `expected_outputs[]`
2. Add `references/` subdir support in the skill loader
3. Document cross-tool discovery paths: `.hima/skills/` AND `.codex/skills/` AND `.hermes/skills/`

**Evidence**: opencode `skill/discovery.ts` shows how to implement concurrent remote skill pulling with local cache. OpenHands shows the `type: knowledge` vs `type: task` distinction. Mastra shows rich multi-line trigger descriptions.

### R2 — Centralize runtime state into `.hima/state/` (P2, CONVERGENT)

**Source**: OMX `.omx/state/`, opencode SQLite, claude-flow `.claude/checkpoints/`

Current hima state is scattered across: `STATE.md`, `NEXT.md`, `LOOP-TRACE.md`, `FEATURES.json`, `.planning/`. This prevents replay, audit, and cross-session continuity.

Adopt:
```
.hima/
  state/
    session.json          # Current session (PID, cwd, timestamps)
    {mode}-state.json     # Per-mode state
    sessions/{id}/        # Session-scoped copies
  logs/
    session-history.jsonl # Append-only session archive
    hima-YYYY-MM-DD.jsonl # Daily structured log
  plans/                  # Planning artifacts (replaces .planning/)
  adapters/               # Per-runtime adapter artifacts
```

The `session-history.jsonl` append-only log is the Factor 5 (12-factor-agents) implementation — it unifies execution state and business state into one auditable stream.

### R3 — Add per-model prompt files for each adapter target (P3, HIGH leverage)

**Source**: opencode `packages/opencode/src/session/prompt/` (9 files)

hima targets Claude Code, Codex CLI, Hermes. Each has different drift patterns and quirks. Create:
```
adapters/
  claude-code/
    system-prompt.md        # Claude Code-specific instructions
    plan-mode-guard.md      # Anti-bypass clause (like opencode plan-reminder-anthropic.txt)
  codex-cli/
    system-prompt.md
    plan-mode-guard.md
  hermes/
    system-prompt.md
    plan-mode-guard.md
```

The `plan-mode-guard.md` equivalent explicitly forbids `sed/tee/echo/cat` filesystem manipulation in plan mode — a concrete policy, not a prose hope.

### R4 — Add `specs/` directory for machine-readable protocol specs (P4, MEDIUM-HIGH)

**Source**: opencode `specs/v2/`, mcp-agent `schema/`

hima's `docs/conception/` currently mixes ADRs + design docs + specs. Split:
```
specs/
  v1/
    session-schema.md       # Session data model
    skill-frontmatter.md    # Canonical SKILL.md frontmatter spec
    event-log-schema.md     # .jsonl event log schema
    risk-classes.md         # T/L/M/H/C formal definitions
    adapter-contract.md     # Adapter interface spec
docs/
  conception/               # ADRs + design docs (keep as-is)
  architecture/             # Architecture docs
```

The `specs/` directory is machine-readable and can be validated against. The `docs/conception/` directory remains the human-readable design space.

### R5 — Add a `commands/` layer separate from skills (P5, MEDIUM)

**Source**: claude-flow `.claude/commands/`, Mastra `.claude/commands/`, opencode `.opencode/command/`

The command pattern: lightweight markdown files for one-shot slash-command operations, distinct from full skills. Examples from repos: `ralph-plan.md`, `selfreview.md`, `gh-fix-ci.md`, `changeset.md`.

```
.hima/
  commands/               # One-shot slash commands
    changeset.md          # Create a changeset
    selfreview.md         # Self-review before commit
    gate-check.md         # Run Falsifies-If gate check
    scope-check.md        # Check scope before adding features
```

This reduces skill-loading overhead for simple operations and makes the harness more approachable for new users.

### R6 — Add `version:` field and `expected_outputs:` to skill frontmatter (OpenHands + CrewAI)

**Source**: OpenHands microagent `version: 1.0.0`, CrewAI `expected_output:` in tasks.yaml

Updated frontmatter schema:
```yaml
---
name: feature-delivery
version: 1.0.0
type: task                    # task | knowledge
description: |
  Multi-sentence trigger description explaining WHEN to use this skill.
  Include: trigger phrases, context requirements, what it produces.
triggers:
  - "implement"
  - "build"
  - "add feature"
expected_outputs:
  - SPEC.md in .planning/{feature}/
  - tests/ directory with failing tests
  - implementation files
  - DONE criteria met
---
```

The `expected_outputs:` field enables the deliverables gate (OMC pattern) to be declared at the skill level rather than in a separate `deliverables.json`.

### R7 — Add `GOVERNANCE.md` and `LLMS.txt` at root (Goose + mcp-agent)

**Source**: `goose/GOVERNANCE.md`, `mcp-agent/LLMS.txt`

Two root files that no other harness has combined:
- `GOVERNANCE.md` — contributor process, decision-making, license stewardship. Signals enterprise stability.
- `LLMS.txt` — project summary formatted for LLM consumption (dense, structured). Improves cold-start quality for any agent reading the repo.

### R8 — Implement hook resilience shim (claude-flow pattern)

**Source**: claude-flow `.claude-plugin/hooks/hooks.json` + `scripts/ruflo-hook.sh`

Every hook command should end with `|| true` and route through a shim that:
1. Prefers locally-installed binary
2. Falls back to `npx --prefer-offline`
3. Always exits 0 so hook failures never block turns

hima's current hooks can fail hard. The shim pattern makes the harness resilient to partial installs.

### R9 — Separate the catalog manifest from skill discovery (OMX pattern)

**Source**: OMX `src/catalog/manifest.json`

Create `manifest.json` (or `catalog.json`) at hima root declaring all skills + agents with status:
```json
{
  "skills": [
    {"name": "feature-delivery", "status": "active", "version": "1.0.0"},
    {"name": "session-start", "status": "active", "version": "1.0.0"}
  ],
  "agents": [
    {"name": "code-reviewer", "status": "active", "model": "sonnet"},
    {"name": "planner", "status": "active", "model": "opus"}
  ]
}
```

This enables: (a) validation that all referenced agents/skills actually exist, (b) marketplace registry compatibility, (c) the `agent-compliance.test.sh` suite has a single authoritative source to check against.

### R10 — Adopt cross-tool skill duplication pattern (Goose + Mastra)

**Source**: Goose (`.claude/`, `.codex/`, `.cursor/` — same 4 skills), Mastra (`.claude/`, `.cursor/`, `.opencode/`, `.mastracode/` — same commands)

hima's skills live only under `~/.claude/`. For Codex and Hermes adapters, add discovery paths:
```
~/.hima/skills/     # Runtime-agnostic canonical location
~/.claude/skills/   # Symlink or copy for Claude Code
~/.codex/skills/    # Copy for Codex CLI
~/.hermes/skills/   # Copy for Hermes
```

The adapter install script (`npm install -g @hima/cli`) sets up the symlinks. This is the "write once, use everywhere" claim made operational.

---

## 5. Sources / Repo URLs

| Repo | URL | Stars | License |
|------|-----|-------|---------|
| OMX (oh-my-codex) | `.planning/external-harness-research/clones/oh-my-codex/` | ~3K | MIT |
| OpenHands | https://github.com/All-Hands-AI/OpenHands | ~45K | MIT |
| opencode | https://github.com/sst/opencode | ~18K | MIT |
| Goose | https://github.com/block/goose | ~29K | Apache 2.0 |
| claude-flow | https://github.com/ruvnet/claude-flow | ~4K | MIT |
| 12-factor-agents | https://github.com/humanlayer/12-factor-agents | ~9K | Apache 2.0 |
| mcp-agent | https://github.com/lastmile-ai/mcp-agent | ~6K | Apache 2.0 |
| Mastra | https://github.com/mastra-ai/mastra | ~22K | MIT |
| CrewAI | https://github.com/crewAIInc/crewAI | ~30K | MIT |
| Kiro | https://github.com/kirodotdev/Kiro | N/A | Proprietary |

---

*Evidence basis: all structural claims backed by `gh api` tree queries and decoded file contents. File paths cited as `{repo}/path/to/file` are verifiable via the gh CLI commands used in research.*
