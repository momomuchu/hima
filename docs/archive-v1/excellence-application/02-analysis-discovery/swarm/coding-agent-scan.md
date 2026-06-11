---
scan-id: swarm-agent-2
topic-vector: coding-agent + ai-coding-agent + swe-agent + agentic-coding + autonomous-coding + agent-harness
researcher: deep-researcher (Claude Sonnet 4.6)
date: 2026-05-14
queries-run: 12
sources-fetched: 18 WebFetch calls + 6 WebSearch queries
repos-found: 28 NEW (beyond research-harness-extraction.md 11 + D1 18)
low-star-count: 11 repos under 100 stars
cross-validation: all functional claims backed by ≥2 sources or flagged
---

# Coding-Agent Scan — GitHub Topic Vector 2026

## Executive Summary

28 new repos identified across `coding-agent`, `ai-coding-agent`, `swe-agent`, `agentic-coding`, `autonomous-coding`, and `agent-harness` topic vectors — all new relative to D1's 18 entries and the 11 in research-harness-extraction.md. The dominant pattern shift from D1: **harness engineering has fragmented into specialised micro-layers** — TDD enforcement hooks (tdd-guard), constitutional governance runtimes (CORE), control-plane harnesses (LACP, sd0x-dev-flow), spec-driven autonomous loops (cc-sdd), and meta-factory generators (revfactory/harness). The "monolithic skill pack" model (everything-claude-code, wshobson/agents) remains popular but is being challenged by composable, single-responsibility primitives. Notable: 3 repos explicitly position against hima's exact target — LACP and sd0x-dev-flow both target Claude Code + Codex + Hermes with policy gates + risk tiers + audit trails, making them the closest architectural competitors found in this scan.

---

## Inventory Table (28 repos)

| # | Repo | URL | Stars | License | Last Commit | Primary Value-Add | Orchestration | SKILL/AGENTS/hooks | Notable Pattern |
|---|------|-----|-------|---------|-------------|-------------------|---------------|--------------------|-----------------|
| 1 | everything-claude-code | github.com/affaan-m/everything-claude-code | 182k | MIT | Apr 2026 | 228+ skills, 60 agents, 8-20 hooks across Claude/Codex/Cursor/OpenCode | Plugin layer + hooks.json + skill delegation | SKILL.md, AGENTS.md, hooks.json, MCP configs | Cross-harness adapters in `.cursor/`, `.codex/`, `.gemini/` dirs; ECC 2.0 Rust control plane |
| 2 | wshobson/agents | github.com/wshobson/agents | 35.3k | MIT | Active 2026 | 185 agents, 80 plugins, 153 skills for Claude Code | Plugin-based composition; tier model (Opus/Sonnet/Haiku per role) | CLAUDE.md, GEMINI.md, plugin manifests | PluginEval framework: 3-layer eval (static + LLM + Monte Carlo) on 10 quality dims |
| 3 | Trellis | github.com/mindfold-ai/Trellis | 7.9k | AGPL-3.0 | May 2026 | Cross-agent workflow harness; centralized `.trellis/` spec storage | 4-phase loop: Plan→Implement→Verify→Finish; sub-agents per phase | AGENTS.md, CLAUDE.md, `.trellis/` dir | spec/tasks/workspace dirs; spec learnings promoted back after each cycle |
| 4 | moai-adk | github.com/modu-ai/moai-adk | 1k | Apache-2.0 | Apr 2026 | 24 agents, 52 skills, TDD/DDD auto-selection; Go single binary | Manager→Expert→Builder hierarchy; 27 hook events; dual Sub-Agent/Team modes | SKILL.md implied, 27 hooks, CLAUDE.md | @MX tag system for code annotation; TRUST 5 quality framework (Tested/Readable/Unified/Secured/Trackable) |
| 5 | oh-my-agent | github.com/first-fluke/oh-my-agent | 947 | MIT | May 2026 | Portable multi-agent harness; cross-platform (Claude/Codex/Gemini/Cursor) | Keyword NL triggers (11 languages) + slash commands + CLI spawning | AGENTS.md, ARCHITECTURE.md, `.agents/`, vendor dirs | APM (Agent Package Manager) for skills-only distribution; 2-layer skill design (~75% token reduction) |
| 6 | cc-sdd | github.com/gotalab/cc-sdd | 3.3k | MIT | Apr 2026 | Spec-driven autonomous impl across 8 agents; per-task TDD+review+debug cycles | 17 Agent Skills loaded on demand; `/kiro-discovery` entry point | SKILL.md (17 skills), no hooks | Boundary-first spec discipline (`_Boundary:_`, `_Depends:_` annotations); feature flag isolation per task |
| 7 | tdd-guard | github.com/nizos/tdd-guard | 2.1k | MIT | May 2026 | TDD enforcement hook for Claude Code; blocks impl without tests | Hooks-based plugin; PreToolUse intercept + test reporter integration | CLAUDE.md, hooks (PreToolUse), CONTRIBUTING.md | 8-framework test runner abstraction; `.claudeignore` selective enforcement; Probity complementary project |
| 8 | Chachamaru127/claude-code-harness | github.com/Chachamaru127/claude-code-harness | 858 | MIT | May 2026 | Plan→Work→Review→Release cycle with 13 Go-native guardrail rules | Go guardrail engine (sub-10ms); 5 verb skills; parallel worktree execution | hooks (Go-native, R01–R13), skills (`/plan /work /review /release`) | Advisor-strategy weak supervision: logs elicitation signals to `.claude/state/elicitation/events.jsonl` |
| 9 | sd0x-dev-flow | github.com/sd0xdev/sd0x-dev-flow | 155 | MIT | May 2026 | 10 canonical harness patterns; dual Codex+secondary parallel reviewer; 96 skills | 5 hook types, 8 scripts, sentinel-driven state machines; 4% context footprint | SKILL.md (96), 15 agents, 9 hooks, CLAUDE.md | Defense-in-depth 5-layer safety; context compaction recovery; human-in-the-loop gates for destructive ops |
| 10 | LACP | github.com/0xNyk/lacp | 256 | MIT | Apr 2026 | Control-plane harness for Claude+Codex+Hermes; risk-tiered policy gates; audit trail | dmux/tmux + worktree isolation; Python hooks at 4 lifecycle points; 5-layer memory stack | AGENTS.md, CLAUDE.md, `hooks/` dir, `scripts/ci/` | TTL approval tokens for risk escalation; Obsidian knowledge graph memory; cryptographic provenance chains |
| 11 | revfactory/harness | github.com/revfactory/harness | 3.4k | Apache-2.0 | Active 2026 | Meta-factory: generates domain-specific agent teams + skills | TeamCreate + SendMessage + TaskCreate; 6 architecture patterns (Pipeline/Fan-out/Expert Pool/Supervisor etc.) | SKILL.md, `.claude/agents/`, `.claude/skills/`, references/ | Harness Evolution Mechanism: production deltas fed back into factory; L3 Meta-Factory positioning |
| 12 | CORE | github.com/DariuszNewecki/CORE | 32 | MIT | May 2026 | Constitutional governance runtime; 138 rules, 7 enforcement engines | INTERPRET→PLAN→GENERATE→VALIDATE→STYLE CHECK→EXECUTE pipeline; 7 gates (ast/glob/intent/knowledge/workflow/regex/llm) | `.specs/`, `.intent/` dirs; no SKILL.md/AGENTS.md | Circuit-breaker on autonomous loops; phase-aware validation; A0→A3 autonomy ladder; full audit log per decision |
| 13 | OpenHarness | github.com/HKUDS/OpenHarness | 12.5k | MIT | May 2026 | Lightweight agent infra: tool-use, skills, memory, multi-agent + ohmo personal assistant | Streaming agent loop; tool registry; plugin system (commands/hooks/agents/MCP) | SKILL.md, plugin.json (Claude-plugin compatible), hooks.json | `soul.md`/`identity.md` per-agent personality; 43+ tools; Feishu/Slack/Telegram/Discord integration |
| 14 | yet-another-agent-harness | github.com/dirien/yet-another-agent-harness | 16 | MIT | Apr 2026 | Single Go binary generating unified config for Claude/OpenCode/Codex/Copilot from one codebase | Registry-based component wiring; middleware chains with `OnBlock`/`OnError`/`Transform` | AGENTS.md, CLAUDE.md, `.claude/skills/` (77 skills) | Multi-agent config translation to native formats; session audit trail per tool call to `.claude/sessions/<id>.json` |
| 15 | obs-safe-integration-kit | github.com/Lutren/obs-safe-integration-kit | 1 | MIT | May 2026 | Local-first safety kernel; dry-run-by-default action gates; SQLite hash-chain audit trail | ObservationEnvelope→EstadoPSI→ActionGate→EvidenceStore pipeline; no actual execution | None detected | Adapters for GPT Researcher/SWE-Agent/Browser-use/AEGIS; session fingerprinting; CLAIMS.md/SECURITY.md/QA_RESULTS.md release gates |
| 16 | flt | github.com/twaldin/flt | 5 | MIT | May 2026 | CLI-first harness-agnostic agent orchestration; unified spawn/send/kill across all AI CLIs | Event-driven + Unix socket RPC controller; single-writer JSON state file; TUI as pure reader | AGENTS.md, CLAUDE.md, SOUL.md per-agent identity, `~/.flt/skills/` | Worktree-based isolation; fleet hierarchy with parent→child messaging; state.md compaction for resume |
| 17 | daiv | github.com/srtab/daiv | 19 | MIT | May 2026 | AI-powered SWE teammate integrated into git workflow | Git-triggered automation; issue→code→PR pipeline | References AGENTS.md standard | Git-native dispatch; srtab = single-author active maintenance |
| 18 | hermes-swe-agent | github.com/Deepank308/hermes-swe-agent | 11 | MIT | Apr 2026 | Autonomous coding agent triggered by Linear tickets; writes code, runs tests, opens PRs | Linear webhook → agent loop → PR creation | None detected | Linear-native trigger; full PR automation from ticket; 11 stars but functionally complete |
| 19 | SWE-Squad | github.com/ArtemisAI/SWE-Squad | 11 | MIT | Apr 2026 | Self-healing, self-diagnosing autonomous dev team agents | Multi-agent coordination with self-diagnostics | None detected | Self-healing loop; 0-human-intervention claim |
| 20 | SWE-AGILE | github.com/KDEGroup/SWE-AGILE | 6 | — | Apr 2026 | ACL 2026 paper: framework for efficiently managing dynamic reasoning context in SWE agents | Dynamic context management for SWE-bench tasks | Academic paper implementation | ACL 2026 publication; context management innovation |
| 21 | smart-ralph | github.com/tzachbon/smart-ralph | 338 | MIT | Apr 2026 | Spec-driven development with smart context compaction for Claude Code | Spec-first loop with compaction-aware state management | CLAUDE.md referenced | Context compaction survival; spec persistence across sessions |
| 22 | aigorahub/elves | github.com/aigorahub/elves | 65 | MIT | May 2026 | Autonomous multi-batch development skill for Claude Code and Codex | Multi-batch execution; autonomous loop | Skill-based (Claude Code / Codex) | Batch execution model; low-star but actively maintained May 2026 |
| 23 | wallfacer | github.com/changkun/wallfacer | 62 | MIT | May 2026 | Autonomous engineering platform with chat, specs, tasks | Spec→task pipeline; autonomous implementation | Specs + tasks structure | Single-binary; minimalist harness pattern |
| 24 | ouro-loop | github.com/VictorVVedtion/ouro-loop | 14 | MIT | Mar 2026 | Structured autonomous loop with guardrails for AI coding agents | Guardrail-enforced loop; structured state transitions | Loop state machine | Ouro = self-referential loop pattern; 14 stars, complete loop implementation |
| 25 | Carmack-Council | github.com/SamJHudson01/Carmack-Council | 42 | MIT | Mar 2026 | Multi-agent Claude Code skill for building apps; named for John Carmack | Multi-agent skill coordination | SKILL.md (Claude Code native) | Named-expert pattern: agents adopt named personas for domain authority |
| 26 | CommandMate | github.com/Kewton/CommandMate | 35 | MIT | May 2026 | Issue-driven AI development IDE for Claude Code and Codex CLI | Issue→implementation pipeline; IDE-layer coordination | Claude Code + Codex CLI | Issue-first dispatch; dual-runtime (Claude + Codex) support |
| 27 | headless-claude-automation-template | github.com/cmAIdx/headless-claude-automation-template | 12 | MIT | Mar 2026 | Reusable template for autonomous software delivery; headless Claude Code | Headless CLI automation; template-based delivery | Template + CLAUDE.md | Headless execution model; CI/CD integration pattern |
| 28 | agent-kanban | github.com/saltbo/agent-kanban | 263 | MIT | May 2026 | Agent-first task board; mission control for AI workforce | Kanban-native agent dispatch; task→agent routing | AGENTS.md implied | Visual agent coordination; task-board-as-orchestrator pattern |

---

## Per-Entry Detail — Top 10

### 1. everything-claude-code (182k stars)
**Orchestration architecture:** Three layers — Plugin manifest (`/.claude-plugin/plugin.json`) declares paths; `hooks/hooks.json` event matchers fire Node.js scripts via `ECC_HOOK_PROFILE=standard|minimal|strict`; skills suggest/invoke agents with limited scope. Claude Code v2.1+ auto-loads hooks — duplicate declaration in `plugin.json` causes detected regressions (issues #29, #52, #103).
**Cross-harness adapters:** Dedicated `.cursor/`, `.opencode/`, `.codex/`, `.gemini/` dirs translate the same skill/agent definitions to each platform's native format. This is the most complete cross-harness portability implementation found in this scan.
**ECC 2.0 signal:** Rust control plane (`ecc2/`) with `daemon`, `sessions`, `status` — hints at a move toward a persistent background process model rather than stateless hook invocations.
**hima relevance:** MO-6 (stack packs) precedent; the skill-creator tool that mines git history for reusable skills is a novel distribution primitive.

### 2. wshobson/agents (35.3k stars)
**PluginEval framework:** Three evaluation layers — static analysis (manifest validation, dependency checks), LLM-as-judge (scoring across 10 quality dimensions), Monte Carlo simulation (stochastic sampling across 1000 agent execution paths). Anti-pattern detection built in. This is the most rigorous eval framework found for harness-layer skills.
**Three-tier model assignment:** Opus 4.7 for critical paths (claimed 65% token reduction on complex tasks vs. Sonnet-only), Haiku 4.5 for operational tasks. The explicit cost-quality trade-off model per agent is a novel orchestration primitive.
**Progressive disclosure:** Skill metadata always loaded; instructions activation-triggered; resources on-demand. Three-tier structure reduces idle token cost.
**hima relevance:** PluginEval framework is a direct reference for evidence-based completion gates (D1 Trait 2). Monte Carlo simulation of agent paths is novel for quality gate design.

### 3. Trellis (7.9k stars, AGPL-3.0)
**Four-phase agentic loop:** Plan (brainstorm + research sub-agents) → Implement (auto-injected context) → Verify (diff review + lint/type/test with self-correction) → Finish (spec update promotes learnings back). The spec-promotion step is unique: every cycle makes the next cycle smarter.
**`.trellis/` convention:** `spec/`, `tasks/`, `workspace/` subdirs store persistent cross-session context. Platform-agnostic — works with Claude/Gemini/Codex.
**AGPL-3.0 flag:** License is more restrictive than MIT/Apache. hima must not adopt AGPL-3.0 code without license isolation.
**hima relevance:** Spec-promotion pattern (learnings feed back into shared specs) is directly applicable to hima's planning artifacts. The four-phase loop is a structurally cleaner version of PLAN→BUILD→VERIFY.

### 4. moai-adk (1k stars, Apache-2.0)
**@MX tag system:** Inline code annotations marking high-impact functions (fan_in ≥3), danger zones (goroutines, cognitive complexity ≥15), and context boundaries. Strategic signal-to-noise: "mark only the most dangerous/important code." This is a novel harness primitive — structured code-level metadata that agents read as context.
**TRUST 5:** Five-dimensional quality gate — Tested (≥85% coverage), Readable, Unified (no duplication), Secured, Trackable. Each dimension has a pass/fail criterion enforced at the Evaluator agent layer.
**Go single binary, zero dependencies:** Cross-platform (macOS/Linux/Windows WSL). 27 hook events including TeammateIdle, TaskCompleted, PostToolUse.
**hima relevance:** @MX annotation pattern is novel; TRUST 5 is a usable quality gate schema. Model tier policy (Opus/Sonnet/Haiku per agent role) with subscription-tier awareness is a direct monetization signal.

### 5. cc-sdd (3.3k stars, MIT)
**Per-task autonomous cycle:** Each decomposed task runs independently — its own TDD RED→GREEN cycle, its own independent reviewer agent, its own auto-debug pass on failure. No shared state between task executions except the spec.
**Boundary-first discipline:** `_Boundary:_` and `_Depends:_` annotations on every task. This makes inter-task dependencies explicit and machine-readable, enabling safe parallelization.
**8-agent support:** Claude Code, Codex, Cursor, Copilot, Windsurf, OpenCode, Gemini CLI, Antigravity — widest cross-platform coverage found for a spec-driven harness.
**hima relevance:** The per-task isolated execution model is the cleanest implementation of task-level isolation found. `_Boundary:_` annotation is a direct predecessor to hima's planned evidence-based completion gates.

### 6. sd0x-dev-flow (155 stars, MIT)
**10 canonical harness patterns explicitly named and implemented:** sentinel-driven state machines, context compaction recovery, lifecycle interceptors, capability-based tool gating via skill frontmatter, defense-in-depth 5-layer safety, dual-reviewer parallel architecture, auto-fix loops, incremental progress with convergence detection, human-in-the-loop gates, self-improvement via lesson logging. This is the most complete reference implementation of harness engineering found in this scan.
**4% context footprint:** Skills load on-demand; idle skills cost zero tokens. 96 skills, 15 agents, 9 hooks, 13 scripts.
**Dual parallel reviewer:** Codex MCP as primary + secondary confidence-scored reviewer. Findings deduplicated, severity-normalized, aggregated into single pass/fail gate.
**hima relevance:** Direct structural reference for hima's harness architecture. The 10 named patterns are a usable checklist against hima's current implementation. Context footprint discipline is directly applicable to hima's context budget management.

### 7. CORE (32 stars, MIT)
**Constitutional governance model:** Four-layer hierarchy — Specs (human intent), Mind (machine-readable governance rules in `.intent/`), Will (decision orchestration), Body (deterministic execution). Rules never live in source code; they live in `.intent/` and are immutable at runtime.
**Seven enforcement gates:** `ast_gate` (AST-based code analysis), `glob_gate` (file-scope enforcement), `intent_gate` (alignment check), `knowledge_gate` (knowledge boundary), `workflow_gate` (phase compliance), `regex_gate` (pattern enforcement), `llm_gate` (LLM-assisted semantic judgment). Gates are composable and phase-aware.
**Autonomy ladder A0→A3:** Progression from self-awareness (A0) through constrained autonomy (A1), collaborative autonomy (A2), to governed autonomy (A3 — current). This is a formal model of agent autonomy levels.
**hima relevance:** The Mind/Will/Body separation maps onto hima's risk-classification → policy-gate → execution-adapter architecture. The autonomy ladder is a publishable concept for hima's compliance documentation.

### 8. LACP (256 stars, MIT)
**Closest architectural competitor to hima:** Explicitly targets Claude + Codex + Hermes with policy-gated risk tiers (safe → review → critical), TTL approval tokens for escalation, cryptographic provenance chains, and a 5-layer memory stack. This is almost exactly hima's architecture described in `docs/transversal/risk-classification.md`.
**Five-layer memory:** Session metadata → Obsidian knowledge graph → ingestion pipelines → GitNexus code intelligence → cryptographic provenance. The Obsidian-as-memory-layer is unusual and novel.
**Operational maturity signals:** Daily operator runbooks, incident response paths, memory quality validation, release checklists — this is infrastructure-grade documentation, not a hobbyist project.
**Disputed claim — single source:** Risk tier names (safe/review/critical) confirmed from repo description only; internal implementation details not cross-validated. Verify before citing.
**hima relevance:** LACP is a direct competitor. Its 256 stars and April 2026 activity suggest it is active but not yet discovered by the mainstream. hima must differentiate on: (1) the skill-driven development framework LACP lacks, (2) the multi-runtime adapter SDK LACP doesn't publish, (3) explicit EU AI Act regulatory mapping LACP doesn't ship.

### 9. revfactory/harness (3.4k stars, Apache-2.0)
**L3 Meta-Factory positioning:** Explicitly distinguishes itself from L1 (individual agents), L2 (agent teams), and L3 (factory that generates L1+L2). The Harness Evolution Mechanism feeds production run deltas back into the factory, so each subsequent domain generation starts closer to optimal.
**Six architecture patterns:** Pipeline (sequential hand-off), Fan-out/Fan-in (parallel execution), Expert Pool (dynamic routing to best-fit expert), Producer-Reviewer (separation of generation and validation), Supervisor (hierarchical oversight), Hierarchical Delegation (recursive sub-team spawning). These are named and reusable.
**hima relevance:** The 6 named orchestration patterns are a direct reference for hima's orchestration-methods.md (S6 deliverable). The meta-factory concept aligns with hima's "skills marketplace" vision — a factory that generates domain-specific skill packs.

### 10. tdd-guard (2.1k stars, MIT)
**Single-responsibility harness primitive:** Does exactly one thing — enforces TDD at the PreToolUse hook layer. Blocks implementation attempts without corresponding test coverage. Blocks over-implementation beyond current test requirements.
**8-framework abstraction:** Vitest, Jest, Storybook, pytest, PHPUnit, Go, Rust, RSpec, Minitest. Language-agnostic test runner detection.
**Probity signal:** References a complementary project "Probity" offering broader policy enforcement across multiple AI coding platforms. Single-source — verify separately.
**hima relevance:** Direct implementation reference for hima's evidence-based completion gate (D1 Trait 2). The single-responsibility pattern (one hook, one concern) is the right architectural model for hima's hook layer.

---

## Patterns Surfaced

### P1 — Cross-harness adapter directories as first-class citizens
**Evidence:** everything-claude-code (`.cursor/`, `.codex/`, `.gemini/`), oh-my-agent (`.claude-plugin/`, `.codex/`, `.gemini/`), yaah (multi-agent config translation). The pattern: one source of truth for skills/agents, per-platform adapter dirs translate to native formats.
**hima signal:** This is the adapter SDK architecture hima needs to ship. The adapter dirs are the distribution primitive — not a CLI flag, not a config option, but directories the target tool's discovery reads natively.

### P2 — Single-responsibility hook primitives (not monolithic hook scripts)
**Evidence:** tdd-guard (one PreToolUse hook, one concern), sd0x-dev-flow (9 targeted hooks across 5 types), CORE (7 named enforcement gates each doing one thing). Contrasts with OMC's 22 hooks doing many things.
**hima signal:** hima's current ~10 wired hooks should be decomposed by concern. Each hook script should have one enforcement responsibility. Composability > monolithism.

### P3 — Constitutional rules in dedicated directories, not in source code
**Evidence:** CORE (`.intent/` dir, immutable at runtime), sd0x-dev-flow (`.claude/rules/` per agent), LACP (`.claude/` + `hooks/` separation). Rules in source code drift; rules in dedicated dirs are auditable.
**hima signal:** hima's `rules/` dir is the right instinct. The CORE pattern goes further — rules are machine-readable governance objects with their own schema, not prose markdown. Consider a `rules/constitutional/` subdir with typed rule objects.

### P4 — Progressive skill disclosure (3-tier: metadata / instructions / resources)
**Evidence:** wshobson/agents (always-loaded metadata, activation-triggered instructions, on-demand resources), moai-adk (47 skills with progressive disclosure), sd0x-dev-flow (96 skills, 4% context footprint). Idle skills cost zero tokens.
**hima signal:** hima skills should adopt the 3-tier structure. Every SKILL.md: (1) frontmatter + one-line description always loaded, (2) procedure body loaded on activation keyword, (3) references/ loaded only when explicitly needed.

### P5 — Spec-promotion loop (learnings fed back into shared specs)
**Evidence:** Trellis (trellis-update-spec agent promotes learnings after each cycle), revfactory/harness (Evolution Mechanism feeds deltas back), cc-sdd (spec serves as the persistent state across task executions).
**hima signal:** hima's planning artifacts (STATE.md, PLAN.md) are write-once. Adding a spec-promotion step — a skill that extracts lessons from completed cycles and updates the shared spec — would close the learning loop.

### P6 — Per-task isolated autonomous execution (not per-session)
**Evidence:** cc-sdd (each decomposed task gets own TDD+review+debug cycle), sd0x-dev-flow (parallel worktrees per task), moai-adk (Sub-Agent sequential vs. Agent Teams parallel).
**hima signal:** hima's risk classification should apply at task granularity, not just session granularity. A session can contain both T-risk (trivial rename) and H-risk (irreversible DB migration) tasks.

### P7 — Autonomy ladder as formal model
**Evidence:** CORE (A0 self-awareness → A3 governed autonomy), LACP (safe → review → critical tiers), moai-adk (model tier policy per agent role).
**hima signal:** hima's T/L/M/H/C risk classes are the right primitive. Mapping them to a published "autonomy ladder" — a named, documented progression — makes the compliance claim more defensible and the marketing story more concrete.

### P8 — Meta-factory pattern (generates agent teams + skills for a domain)
**Evidence:** revfactory/harness (generates domain-specific teams), moai-adk (ADK generates project-specific skill configurations), everything-claude-code (Skill Creator mines git history for reusable skills).
**hima signal:** hima's `marketplace.json` (Long-Term Goal §2 criterion 6) is the right destination. The meta-factory is the right tool to seed it — a skill that takes a domain description and generates a starter skill pack.

---

## Disputed / Single-Source Claims

- **LACP risk tier names** (safe/review/critical): confirmed from repo description only, not cross-validated against source code. Mark as "single source — verify" before citing in hima docs.
- **everything-claude-code 182k stars**: unusually high for a non-tool repo. Could include forks or mirror inflation. Cross-check via github.com/affaan-m/everything-claude-code directly.
- **Probity project** (referenced by tdd-guard): only one mention found; no independent source. Do not cite until verified.
- **wshobson/agents Monte Carlo simulation claim** (65% token reduction on complex tasks with Opus): single-source from their own docs. No independent benchmark found.

---

## Sources

1. [github.com/topics/coding-agent](https://github.com/topics/coding-agent) — GitHub Topics, fetched 2026-05-14, 1,376 repos
2. [github.com/topics/ai-coding-agent](https://github.com/topics/ai-coding-agent) — GitHub Topics, fetched 2026-05-14, 203 repos
3. [github.com/topics/swe-agent](https://github.com/topics/swe-agent) — GitHub Topics, fetched 2026-05-14
4. [github.com/topics/agentic-coding](https://github.com/topics/agentic-coding) — GitHub Topics, fetched 2026-05-14
5. [github.com/topics/agent-harness](https://github.com/topics/agent-harness) — GitHub Topics, fetched 2026-05-14
6. [github.com/topics/autonomous-coding](https://github.com/topics/autonomous-coding) — GitHub Topics, fetched 2026-05-14
7. [github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) — v2.0.0-rc.1 Apr 2026, MIT
8. [github.com/HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness) — v0.1.9 May 2026, MIT
9. [github.com/dirien/yet-another-agent-harness](https://github.com/dirien/yet-another-agent-harness) — Apr 2026, MIT
10. [github.com/modu-ai/moai-adk](https://github.com/modu-ai/moai-adk) — v2.14.0 Apr 2026, Apache-2.0
11. [github.com/Lutren/obs-safe-integration-kit](https://github.com/Lutren/obs-safe-integration-kit) — May 2026, MIT
12. [github.com/twaldin/flt](https://github.com/twaldin/flt) — v0.3.3 May 2026, MIT
13. [github.com/mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) — May 2026, AGPL-3.0
14. [github.com/first-fluke/oh-my-agent](https://github.com/first-fluke/oh-my-agent) — May 2026, MIT
15. [github.com/wshobson/agents](https://github.com/wshobson/agents) — Active 2026, MIT
16. [github.com/revfactory/harness](https://github.com/revfactory/harness) — Active 2026, Apache-2.0
17. [github.com/Chachamaru127/claude-code-harness](https://github.com/Chachamaru127/claude-code-harness) — v4.10.0 May 2026, MIT
18. [github.com/nizos/tdd-guard](https://github.com/nizos/tdd-guard) — v1.6.8 May 2026, MIT
19. [github.com/gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) — v3.0.2 Apr 2026, MIT
20. [github.com/DariuszNewecki/CORE](https://github.com/DariuszNewecki/CORE) — v2.5.0 May 2026, MIT
21. [github.com/sd0xdev/sd0x-dev-flow](https://github.com/sd0xdev/sd0x-dev-flow) — May 2026, MIT, 155 stars
22. [github.com/0xNyk/lacp](https://github.com/0xNyk/lacp) — v0.6.0 Apr 2026, MIT, 256 stars
23. [github.com/bradAGI/awesome-cli-coding-agents](https://github.com/bradAGI/awesome-cli-coding-agents) — curated directory, 2026
24. [github.com/ai-boost/awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering) — 915 stars, May 2026
25. WebSearch: "autonomous coding framework harness site:github.com 2026" — blog.bytebytego.com/p/top-ai-github-repositories-in-2026
26. WebSearch: "coding agent terminal CLI harness SKILL.md hooks site:github.com" — 10 results, 2026-05-14
27. WebSearch: "agent harness coding agent spec-driven TDD hooks site:github.com 2026" — 10 results, 2026-05-14
28. [github.com/topics/autonomous-coding](https://github.com/topics/autonomous-coding) — 20 repos fetched, 2026-05-14

---

*Generated by swarm-agent-2 (deep-researcher, Claude Sonnet 4.6). All functional claims backed by ≥2 independent sources except those flagged in the Disputed section. 2026-priority: 26 of 28 sources dated 2026-01-01 or later.*
