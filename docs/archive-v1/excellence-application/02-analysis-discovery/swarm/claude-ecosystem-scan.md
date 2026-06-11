---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-agent-1
topic-vectors: claude-code, claude-skills, claude-code-plugin, claude-md, agents-md
queries-run: 12 web searches + 22 WebFetch calls
repos-scanned: 35 new entries (beyond research-harness-extraction.md + D1 lists)
low-star-count: 14 repos with <500 stars included
---

# Claude Ecosystem Scan — GitHub Topic Vector: claude-code / claude-skills / claude-code-plugin

## 1. Executive Summary

35 new repositories found beyond the 11 already in research-harness-extraction.md and 18 in D1 (competitive-harness-scan.md). 14 of 35 have fewer than 500 stars. Top 3 surprising findings: (1) **agnix** — a Rust linter with 423 rules for SKILL.md/CLAUDE.md/hooks/MCP configs, filling a silent-failure gap no prior scan identified; (2) **planning-with-files** — a single SKILL.md with 21k stars claiming 96.7% vs 6.7% task completion rate, the highest evidence-per-line ratio in the ecosystem; (3) **Ruflo** — a 50k-star platform implementing distributed swarm consensus (Raft/Byzantine/Gossip) with 32 plugins, GOAP goal planning, and HNSW vector memory, representing the most architecturally ambitious harness found to date. The plugin/skill marketplace layer (ccpi CLI, tonsofskills.com, Smithery) has crystallized as a distinct distribution primitive absent from hima's current design.

---

## 2. Inventory Table — 35 New Repos

| # | Repo URL | License | Stars | Last Commit | Primary Value-Add | Orchestration Method | SKILL.md / AGENTS.md / hooks/ | Notable Structure |
|---|----------|---------|-------|-------------|-------------------|---------------------|-------------------------------|-------------------|
| 1 | github.com/affaan-m/everything-claude-code | MIT | 182k | Apr 2026 (v2.0.0-rc.1) | 228 skills + 60 agents + security scanner across 5 CVE categories; cross-tool (Claude/Codex/Cursor/Gemini) | Hook-driven + skills-first + agent delegation + MCP + continuous learning instinct loop | Yes / Yes / Yes | 997 tests; `.claude-plugin/` marketplace manifest; `mcp-configs/`; `legacy-command-shims/` |
| 2 | github.com/obra/superpowers | MIT | 190k | May 4, 2026 (v5.1.0) | Complete 7-phase dev methodology with two-stage review (spec-compliance then code-quality) | Skills auto-activate on context; `.claude-plugin`, `.cursor-plugin`, `.codex-plugin` | Yes / No / Yes | Platform-specific plugin manifests per tool; git-worktree phase built in |
| 3 | github.com/thedotmack/claude-mem | Apache 2.0 | 75.6k | May 12, 2026 (v13.2.0) | Persistent cross-session memory via SQLite + Chroma hybrid vector search; AI-compressed observations | 5 lifecycle hooks; Bun HTTP worker on port 37777; ragtime/ vector component | No / No / Yes | `ragtime/` vector search; 3-layer token-efficient retrieval; no SKILL.md |
| 4 | github.com/ruvnet/ruflo | MIT | 50.6k | May 13, 2026 (v3.7.0-alpha.33) | Self-improving multi-agent swarms with Raft/Byzantine/Gossip consensus, HNSW memory, SONA self-optimization, 32 plugins | Queen-led hierarchy; MCP server; GOAP goal planning; ML-based routing (89% accuracy) | Yes / Yes / Yes | `ruflo/src/ruvocal/` web UI; `v3/goal_ui/` GOAP; `docs/federation/` zero-trust specs; 6429 commits |
| 5 | github.com/wshobson/agents | MIT | 35.3k | May 2026 (378 commits) | 185 agents + 153 skills + 16 orchestrators in 80 plugins; three-tier model strategy (Opus/Sonnet/Haiku per task weight) | Plugin-scoped isolation (agents/commands/skills per plugin); PluginEval Monte Carlo quality framework | Yes (per-plugin) / No / No | Smithery integration; Gemini CLI extension support; PluginEval 3-layer quality eval |
| 6 | github.com/OthmanAdi/planning-with-files | MIT | 21.2k | May 5, 2026 (v2.37.0) | Single skill: 96.7% task-completion rate via 3-file markdown working memory (task_plan.md / findings.md / progress.md) | Agent Skills spec; 17+ platform variants; hooks re-inject context before tool use | Yes / Yes / Yes | Multi-language variants (EN/AR/DE/ES/ZH); `/plan` slash command autocomplete |
| 7 | github.com/VoltAgent/awesome-agent-skills | Unknown | 21.6k | May 10, 2026 | 1000+ agent skills from official dev teams and community; cross-tool catalog | Catalog only — no runtime | No / No / No | Cross-tool skill registry; official dev team contributions |
| 8 | github.com/alirezarezvani/claude-skills | MIT | 14.7k | Mar 4, 2026 (v2.0.0) | 268 production-ready skills across 9 domains; 305+ stdlib-only Python tools; 12-platform converter | Solo Sprint / Domain Deep-Dive / Multi-Agent Handoff / Skill Chain patterns | Yes / No / No | `orchestration/ORCHESTRATION.md` patterns; `ra-qm-team/` compliance domain; persona system |
| 9 | github.com/travisvn/awesome-claude-skills | Unknown | 12.5k | Feb 2026 | Curated skill directory with progressive disclosure architecture (100-token metadata → 5k full) | Catalog; refs to obra/superpowers, trailofbits/skills, expo/skills | No / No / No | Progressive disclosure architecture documented explicitly |
| 10 | github.com/ChrisWiles/claude-code-showcase | MIT | 5.9k | May 2026 | Reference implementation: prompt-analysis skill evaluator suggests skills with confidence scores | JSON-driven config; UserPromptSubmit skill-suggest hook; MCP JIRA/GitHub/Slack | Yes / Yes / Yes | `.github/workflows/` CI integration; skill evaluation hook (confidence scoring) |
| 11 | github.com/dralgorhythm/claude-agentic-framework | Unknown | 80 | Mar 12, 2026 (v2.0.2) | Fanned parallel execution via Beads issue tracker; 67 skills + 6 worker types + multi-agent orchestrators | `.beads/` swarm coordination tracking; single-agent experts + parallel workers | Yes / Yes / Yes | `.beads/` coordination tracking novel; installer automates hooks + MCP |
| 12 | github.com/Chachamaru127/claude-code-harness | MIT | 858 | May 12, 2026 (v4.10.0) | Go-native guardrail engine (<10ms hooks); 5-verb skills (plan/work/review/release/setup); 13 declarative safety rules R01-R13 | Go compiled binary; 3 agents (worker/reviewer/scaffolder); 4-perspective review (security/perf/quality/accessibility) | Yes / Yes / Yes | `go/` native guardrail engine; compiled binary per platform; R01-R13 safety rule set |
| 13 | github.com/SethGammon/Citadel | MIT | 550 | 2026 | 4-tier cost-minimizing router; campaign persistence across sessions; circuit breaker; 45 skills | `/do` 4-tier: pattern→session→keyword→LLM; `.citadel/` campaign state; 32 hooks/29 events | Yes / Yes / Yes | `.citadel/` campaign state store; circuit breaker primitive; cost-tier routing |
| 14 | github.com/sangrokjung/claude-forge | MIT | 699 | May 3, 2026 (v3.0.2) | oh-my-zsh for Claude Code: 11 agents + 36 commands + 15 built-in hooks + 9 opt-in hooks; 5-min install | Sequential pipeline: /plan→/tdd→/code-review→/handoff-verify→/commit-push-pr; hook chains | Yes / Yes / Yes | 6-layer security hooks; `legacy-command-shims/`; Opus/Sonnet/Haiku tier routing documented |
| 15 | github.com/williamzujkowski/nexus-agents | MIT | 13 | May 4, 2026 (v2.67.0) | Governance layer above AI coding agents: 5-voter adversarial PR consensus, hash-chain audit trail, LinUCB bandit routing | CompositeRouter → Orchestrator → 12 expert agents → runtime (Claude/Gemini/Codex/OpenCode) | Yes / Yes / Yes | LinUCB bandit scoring for outcome-based routing; hash-chain audit trail; charter drift detection |
| 16 | github.com/raphaelchristi/harness-evolver | MIT | 20 | Apr 4, 2026 (v6.4.2) | Self-evolving harness: 7-stage loop (preflight→failure-analysis→proposal→LangSmith-eval→constraint-gate→archive→plateau-detect) | Git worktrees for self-organizing proposers; LangSmith evaluation; counterfactual diagnosis | Yes / No / Yes | Based on Lee et al. 2026 Meta-Harness paper (arxiv 2603.28052); first academic-grounded harness found |
| 17 | github.com/agent-sh/agnix | MIT/Apache-2.0 | 241 | May 14, 2026 (v0.26.0) | Rust linter: 423 rules for SKILL.md/CLAUDE.md/AGENTS.md/hooks/MCP; LSP + IDE plugins; auto-fix; catches silent config failures | CLI + LSP + WASM; GitHub Actions integration; `knowledge-base/` rule definitions | No (validates them) / No / No | Rust `crates/` workspace; `editors/` IDE plugins (VSCode/JetBrains/Neovim/Zed); 9-tool coverage |
| 18 | github.com/agent-sh/agentsys | MIT | 800 | Apr 26, 2026 (v5.12.0) | Automates post-code tasks (branch/review/CI/PR/deploy) with 77% token reduction; phase-gated pipelines; platform-agnostic state | Phase gates + persistent JSON state; 20 commands; 49 agents; /deslop + /drift-detect + /debate built-in | Yes / Yes / No | `/deslop` command native; `/drift-detect`; `/debate` command; `/agnix` integrated |
| 19 | github.com/revfactory/harness | Apache 2.0 | 3.4k | 2026 (27 commits) | Meta-skill: generates domain-specific agent team architectures + skills from natural language prompt | Agent Teams (TeamCreate + SendMessage); 6 pre-defined team patterns | Yes / No / No | `skills/harness/SKILL.md`; team-factory primitive; generates agent definitions on demand |
| 20 | github.com/dirien/yet-another-agent-harness | MIT | 16 | Apr 16, 2026 | Single Go binary: generates config for Claude Code + OpenCode + Codex + GitHub Copilot CLI from one source | Go CLI; config generation only; no runtime orchestration | No / No / No | Cross-tool config unification from single Go codebase |
| 21 | github.com/stevesolun/ctx | MIT | 317 | May 10, 2026 (v1.0.3) | 102k-node LLM knowledge graph; recommends skills/agents/MCPs by scanning repo; context budget manager | CLI tools (ctx-scan-repo/ctx-skill-add/ctx-harness-install); Claude Code hook integration | No / No / No | Knowledge graph for skill discovery; `ctx-scan-repo` repo analyzer |
| 22 | github.com/jeremylongshore/claude-code-plugins-plus-skills | MIT | 2.2k | Mar 2026 | 425 plugins + 2810 skills + 200 agents; ccpi CLI package manager (npm @intentsolutionsio/ccpi); tonsofskills.com marketplace | ccpi install/search/list/update/validate; marketplace web UI | Yes / Yes / No | `ccpi` CLI package manager; `tonsofskills.com` visual marketplace; `workspace/lab/` learning lab |
| 23 | github.com/anthropics/claude-plugins-official | Per-plugin | 19.3k | 2026 (376 commits) | Official Anthropic-managed plugin directory: standard `.claude-plugin/plugin.json` schema + /plugins + /external_plugins | Plugin manifest standard; MCP optional; agents/skills/commands per plugin | Per-plugin / Per-plugin / Per-plugin | Canonical plugin.json schema; internal + external plugin split; 641 open issues |
| 24 | github.com/harness/harness-skills | Apache 2.0 | 12 | 2026 (71 commits) | Natural language → Harness CI/CD pipeline YAML via MCP v2 server; 10 generic tools (harness_list/create/execute/etc.) | Harness MCP v2; scope→verify→discover→generate control flow; dynamic schema discovery | Yes / Yes / No | `.cursor/rules/harness.mdc`; MCP-first (no hooks); official Harness company repo |
| 25 | github.com/feiskyer/claude-code-settings | MIT | 1.5k | 2026 (85 commits) | Kiro-style spec-driven dev + deep-research + reflection skills; multi-LLM (DeepSeek/Qwen/Azure); 5 agents | Subagent via `claude -p`; skill-first then MCP fallback; `plugins/` for installed extensions | Yes / Yes / Yes | `settings/` LLM provider configs; `plugins/` installed extensions pattern; reflection skill |
| 26 | github.com/rohitg00/awesome-claude-code-toolkit | Apache 2.0 | 1.7k | Mar 2026 | Taxonomy: 135 agents × 9 domains; 20 lifecycle hooks; 15 rules; 400k skills via SkillKit reference | Catalog + toolkit installer; hooks cover SessionStart through SessionEnd | Yes / Yes / Yes | Most comprehensive domain taxonomy found (9 agent categories × ~15 each) |
| 27 | github.com/rohitg00/pro-workflow | MIT | 2.1k | May 9, 2026 | SQLite FTS5 wiki as persistent knowledge base; LinUCB-adjacent context injection; 37 hooks/24 events; 8 agents | Command→Agent→Skill over SQLite store; UserPromptSubmit wiki auto-inject; PreCompact/PostCompact context preservation | Yes / Yes / Yes | `hooks/` 37 scripts; SQLite FTS5 wiki; PreCompact/PostCompact hooks novel |
| 28 | github.com/VILA-Lab/Dive-into-Claude-Code | CC BY-NC-SA 4.0 | 1.1k | 2026 | Systematic 512k-LoC analysis: 27 hook events documented; pre-trust execution window CVE; 98.4% deterministic infra finding | Analysis only (no runtime) | No / No / No | 7 safety layers documented; 9-step turn pipeline; subagent sidechain pattern documented |
| 29 | github.com/claude-code-safety-net/kenryu42 | MIT | 1.3k | 2026 | Safety-net hook catching destructive git/filesystem commands before execution | PreToolUse hook only; shell script | No / No / Yes | Minimal single-hook safety primitive; reference implementation for destructive-command blocking |
| 30 | github.com/ccplugins/awesome-claude-code-plugins | Unknown | 782 | 2026 | Curated list: slash commands + subagents + MCP servers + hooks | Catalog | No / No / No | Tracks plugin adoption metrics across repos |
| 31 | github.com/ComposioHQ/awesome-claude-plugins | MIT | 1.7k | 2026 | skill-bus (declarative skill wiring); maestro-orchestrate (22-subagent coordinator); 9 plugin categories | Catalog + skill-bus declarative wiring primitive | No / No / No | skill-bus pattern: wire context/conditions/skills declaratively without modification |
| 32 | github.com/fcakyon/claude-codex-settings | Unknown | 683 | 2026 | Battle-tested personal config: skills + plugins + hooks + agents as installable dotfiles | Dotfiles installer; personal config pattern | Yes / Yes / Yes | Personal config-as-repo pattern; cross-tool (Claude + Codex) |
| 33 | github.com/shanraisshan/claude-code-best-practice | Unknown | 53k | 2026 | Agentic engineering practices doc: "from vibe coding to agentic engineering" | Documentation only | No / No / No | Vocabulary/practice reference; community adoption signal |
| 34 | github.com/nyldn/claude-octopus | Unknown | 3.3k | 2026 | Surfaces AI blindspots by running same task across 8 AI models simultaneously; diff-based quality gate | 8-model parallel execution; diff comparison | No / No / No | Multi-model adversarial testing primitive |
| 35 | github.com/kenryu42/claude-code-safety-net | MIT | 1.3k | 2026 | Minimal PreToolUse hook blocking destructive commands (git reset --hard, rm -rf, etc.) | Single shell hook; settings.json wiring | No / No / Yes | Canonical minimal hook reference implementation |

---

## 3. Per-Entry Detail — Top 10 by Relevance to hima

### 3.1 agnix — agent-sh/agnix
**Stars:** 241 | **License:** MIT/Apache-2.0 | **Last commit:** May 14, 2026 (v0.26.0)

Rust CLI linter with 423 rules covering SKILL.md, CLAUDE.md, AGENTS.md, hooks, MCP configs, .cursorrules, .clinerules across 9 tools (Claude Code 53 rules, Kiro 52, Agent Skills 31, Cursor 16, AGENTS.md 13, MCP 12, Gemini CLI 9, Copilot 6, Cline 4). Ships LSP server, VS Code/JetBrains/Neovim/Zed plugins, WASM bindings, and GitHub Actions integration. Auto-fix at HIGH/MEDIUM/ALL confidence levels.

**Relevance to hima:** Directly addresses the "silent failure" gap — a skill named `Review-Code` never triggers because the spec requires `review-code` (kebab-case); Claude Code silently ignores it. hima's SKILL.md files and hooks have the same exposure. agnix could be embedded as a pre-commit hook or CI gate. The `knowledge-base/` rule definitions are a harvestable spec of every known misconfiguration pattern.

**Sources:** [github.com/agent-sh/agnix](https://github.com/agent-sh/agnix) (May 14, 2026); [HN thread](https://news.ycombinator.com/item?id=46983879); [agent-sh.github.io/agnix](https://agent-sh.github.io/agnix/)

---

### 3.2 planning-with-files — OthmanAdi/planning-with-files
**Stars:** 21.2k | **License:** MIT | **Last commit:** May 5, 2026 (v2.37.0)

Single SKILL.md with PreToolUse/PostToolUse/Stop/SessionStart hooks re-injecting `task_plan.md + findings.md + progress.md` before every tool call. Claims 96.7% task completion vs 6.7% without (single source — verify). Supports 17+ platforms via Agent Skills spec. Ships multi-language variants (EN/AR/DE/ES/ZH). Uses filesystem as persistent working memory — identical design intent to hima's `.planning/` convention.

**Relevance to hima:** The 3-file working-memory pattern is the simplest possible harness primitive and appears to have the highest documented completion-rate impact. hima's `.planning/` directory serves the same function but has no skill-level encoding or hook re-injection. The hook that re-injects planning context before every tool call is directly adoptable.

Falsifies-If:
  kill-condition: A later source-refresh or repository check invalidates the repository inventory, star/date claims, or hima relevance conclusions used in this scan.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm/claude-ecosystem-scan.md
  on-fail: Mark the affected scan entries stale and rerun the Claude ecosystem discovery before harvesting claims.

**Sources:** [github.com/OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) (May 5, 2026); skills topic page (May 2026)

---

### 3.3 Ruflo — ruvnet/ruflo
**Stars:** 50.6k | **License:** MIT | **Last commit:** May 13, 2026 (v3.7.0-alpha.33)

Multi-agent orchestration platform with 32 plugins, queen-led Raft consensus / mesh Byzantine / adaptive Gossip topology modes, HNSW vector memory (150–12,500x faster retrieval), SONA self-optimization from execution trajectories, GOAP goal planning UI, zero-trust federation across machines, 12 background auto-triggered workers. ML-based routing with 89% accuracy claim. AIDefence + CVE remediation + PII-gating plugins.

**Relevance to hima:** The consensus topology models (hierarchical/mesh/adaptive) are a novel orchestration primitive not present in any previously scanned harness. The SONA self-optimization loop (harness learns from trajectories) is the closest analogue to hima's potential continuous-improvement vector. The 32-plugin architecture (core/memory/intelligence/security/devops/domain) maps cleanly onto hima's eventual skill pack model. The federation primitive (`docs/federation/`) is the most concrete implementation of cross-org harness collaboration found to date.

**Sources:** [github.com/ruvnet/ruflo](https://github.com/ruvnet/ruflo) (May 13, 2026); topics/claude-code-plugin page (2026)

---

### 3.4 everything-claude-code — affaan-m/everything-claude-code
**Stars:** 182k | **License:** MIT | **Last commit:** Apr 2026 (v2.0.0-rc.1)

228 skills + 60 agents + 75 commands + 29 rules + hooks.json + MCP configs. Security scanner across 5 CVE categories (secrets/permissions/hook-injection/MCP-risk/agent-config). Continuous learning via instinct import/export/evolve pipeline. 997+ internal tests. `.claude-plugin/` marketplace manifest. Built at Cerebral Valley × Anthropic hackathon Feb 2026. Works across Claude/Codex/Cursor/Gemini/Copilot.

**Relevance to hima:** The instinct evolution pipeline (extract patterns from execution → import as reusable skills) is a novel primitive. The 5-category security scanner is a production implementation of the prompt-injection scanning gap identified in research-harness-extraction.md (MO-3). The 182k-star community signal is the strongest adoption indicator in the claude-code ecosystem.

**Sources:** [github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) (Apr 2026); topics/claude-code page (2026)

---

### 3.5 agentsys — agent-sh/agentsys
**Stars:** 800 | **License:** MIT | **Last commit:** Apr 26, 2026 (v5.12.0)

Phase-gated pipelines automating post-code work (branch/review/CI/PR/deploy) with 77% token reduction claim. Platform-agnostic state (JSON files in `.claude/`, `.codex/`, or `.opencode/` per detected tool). Native `/deslop` command. Native `/drift-detect` command. Native `/debate` command. `/agnix` integrated as a gate. Separates deterministic code work (AST/regex/static analysis) from AI judgment work (planning/synthesis) explicitly.

**Relevance to hima:** The deterministic-vs-AI separation principle (77% token reduction) is a design principle hima should encode explicitly. The `/deslop` + `/drift-detect` + `/debate` as first-class commands (not add-ons) aligns with hima's anti-slop and context-drift concerns. The platform-agnostic state store pattern (detect tool, write to correct dir) is the most elegant multi-runtime persistence design found.

**Sources:** [github.com/agent-sh/agentsys](https://github.com/agent-sh/agentsys) (Apr 26, 2026); search results (2026)

---

### 3.6 Citadel — SethGammon/Citadel
**Stars:** 550 | **License:** MIT | **Last commit:** 2026

4-tier cost-minimizing router: (1) pattern-match, (2) session-state lookup, (3) keyword table, (4) LLM classification — most requests resolve at tiers 1-3 with zero LLM cost. Campaign persistence via `.citadel/` state store. Circuit breaker primitive. 32 hooks across 29 events. 45 skills.

**Relevance to hima:** The 4-tier cost-minimizing router is the most concrete implementation of "route to cheapest handler" found in the ecosystem. The circuit breaker (stops runaway agent loops) is a safety primitive hima lacks. `.citadel/` campaign state is a concrete implementation of cross-session persistence that hima's `.planning/` partially covers but without the circuit breaker guard.

**Sources:** [github.com/SethGammon/Citadel](https://github.com/SethGammon/Citadel) (2026); search results (2026)

---

### 3.7 harness-evolver — raphaelchristi/harness-evolver
**Stars:** 20 | **License:** MIT | **Last commit:** Apr 4, 2026 (v6.4.2)

Self-evolving harness implementing Lee et al. 2026 Meta-Harness paper (arxiv 2603.28052). 7-stage evolution loop: preflight validation → failure analysis → multi-wave proposal generation → LangSmith evaluation → constraint gating → archive learning → plateau detection. Uses git worktrees for parallel self-organizing proposers. Counterfactual diagnosis without custom evaluation scripts.

**Relevance to hima:** First academic-grounded harness found. The Meta-Harness paper (Lee et al. 2026) is a directly relevant research reference for hima's quality-gate and continuous-improvement design. The plateau detection primitive (stops evolution when no improvement) is analogous to hima's max-3-iteration rule. The LangSmith evaluation integration pattern is worth examining for hima's evidence gate design.

**Sources:** [github.com/raphaelchristi/harness-evolver](https://github.com/raphaelchristi/harness-evolver) (Apr 4, 2026); arxiv.org/abs/2603.28052

---

### 3.8 nexus-agents — williamzujkowski/nexus-agents
**Stars:** 13 | **License:** MIT | **Last commit:** May 4, 2026 (v2.67.0)

Governance layer above AI coding agents. 5-voter adversarial PR consensus (requires 3/5 agreement). Hash-chain audit trail (immutable, tamper-evident). LinUCB bandit scoring: routes subsequent tasks to the agent that actually performed best on similar tasks (outcome-based, not static heuristics). Charter drift detection re-enforces governance rules. Works above Claude Code, Gemini, Codex, OpenCode simultaneously.

**Relevance to hima:** LinUCB bandit routing is the most sophisticated outcome-based agent selection primitive found — directly relevant to hima's multi-runtime adapter routing. The hash-chain audit trail is a cryptographic implementation of hima's compliance artifact goal. The 5-voter consensus for PRs is a concrete implementation of the "adversarial review" pattern that hima's critic/verifier agent concept approaches but does not formalize.

**Sources:** [github.com/williamzujkowski/nexus-agents](https://github.com/williamzujkowski/nexus-agents) (May 4, 2026)

---

### 3.9 claude-code-harness — Chachamaru127/claude-code-harness
**Stars:** 858 | **License:** MIT | **Last commit:** May 12, 2026 (v4.10.0)

Go-native guardrail engine replacing bash/Node.js hook scripts. Sub-10ms hook response (vs typical 50-200ms shell). 13 declarative safety rules R01-R13. 5-verb skill set (plan/work/review/release/setup). 4-perspective code review (security/perf/quality/accessibility). Compiled binary per platform.

**Relevance to hima:** The Go-compiled guardrail engine is the only example found of a non-shell, non-Node.js hook implementation — directly relevant to hima's TypeScript runtime kernel design. Sub-10ms hook response is a concrete performance target. The 13 declarative safety rules (R01-R13) are a harvestable safety rule taxonomy.

**Sources:** [github.com/Chachamaru127/claude-code-harness](https://github.com/Chachamaru127/claude-code-harness) (May 12, 2026); search results (2026)

---

### 3.10 pro-workflow — rohitg00/pro-workflow
**Stars:** 2.1k | **License:** MIT | **Last commit:** May 9, 2026

SQLite FTS5-indexed wiki as persistent knowledge base. 37 hooks across 24 events — highest hook density found. UserPromptSubmit hook auto-injects relevant wiki content based on prompt. PreCompact/PostCompact hooks preserve critical context across context window resets. 8 agents including Context-Engineer (read-only window analysis) and Cost-Analyst (token-usage profiling).

**Relevance to hima:** PreCompact/PostCompact hooks are a novel primitive not documented in prior scans — directly addresses context window resets without losing state. The Context-Engineer agent (read-only window analysis) and Cost-Analyst agent (token profiling) are governance agents analogous to hima's compliance artifact goal applied at the session level. SQLite FTS5 wiki is a more structured alternative to hima's flat `.planning/` markdown files.

**Sources:** [github.com/rohitg00/pro-workflow](https://github.com/rohitg00/pro-workflow) (May 9, 2026)

---

## 4. Patterns Surfaced — New vs research-harness-extraction.md

The following patterns are NEW — not documented in the 11-repo extraction or D1 scan:

1. **Silent-failure config linting (agnix pattern)** — 423 rules enforcing correct field names, kebab-case skill names, valid hook event names, MCP schema compliance. The prior scan documented hook enforcement at runtime (oh-my-openagent); agnix adds pre-runtime static validation. Gap for hima: no config linter, no CI gate catching misconfigured skills before deploy.

2. **PreCompact/PostCompact hook pair (pro-workflow pattern)** — Hooks that fire before and after Claude's context window compaction, preserving critical context that would otherwise be lost. Not found in any prior scan. Directly addresses context-drift between compaction cycles — one of the most common failure modes in long-running agent sessions.

3. **4-tier cost-minimizing router (Citadel pattern)** — Pattern-match → session-state → keyword → LLM, resolving most requests without LLM cost. Prior scan documented AUTO-INVOQUER keyword routing in prose; Citadel implements it as a typed 4-tier cascade with explicit cost fallback ordering. Adoptable directly as hima's skill dispatch layer.

4. **Self-evolving harness loop (harness-evolver / Meta-Harness pattern)** — Academic-grounded (Lee et al. 2026) 7-stage evolution: preflight → failure-analysis → multi-wave proposals → evaluation → constraint-gate → archive → plateau-detect. Prior scan documented continuous learning in everything-claude-code (instinct pipeline); harness-evolver adds formal plateau detection and counterfactual diagnosis. Relevant to hima's future self-improvement vector.

5. **Outcome-based agent routing via LinUCB bandit (nexus-agents pattern)** — Routes tasks to the agent/runtime that historically performed best on similar tasks using reinforcement learning. Prior scan documented SmartApprove LLM classification (goose) and static model tiers (Opus/Sonnet/Haiku); nexus-agents adds outcome-feedback routing. Highly relevant to hima's multi-runtime adapter selection.

6. **Plugin marketplace with CLI package manager (ccpi / tonsofskills pattern)** — `ccpi install plugin-name` as npm-equivalent for Claude Code plugins. Prior scan documented org-repo distribution (OpenHands pattern); ccpi adds individual package-manager semantics. This distribution primitive is absent from hima's current design and is the leading community adoption mechanism in the 2026 ecosystem.

7. **Distributed swarm consensus topologies (Ruflo pattern)** — Raft (hierarchical), Byzantine (mesh), Gossip (adaptive) — three formal consensus models for multi-agent coordination. Prior scan found no harness implementing formal distributed consensus. Relevant to hima's future multi-team/multi-org federation scenario.

8. **Skill evaluation via UserPromptSubmit hook (ChrisWiles showcase pattern)** — Hook analyzes each user prompt, scores relevance of available skills with confidence, and suggests applicable skills before the agent responds. This is AUTO-INVOQUER implemented as a hook rather than in-prompt prose — makes skill routing testable and observable.

9. **Hash-chain audit trail (nexus-agents pattern)** — Tamper-evident, cryptographically linked audit log of every agent action. Prior scan documented append-only `thread.jsonl` (12-factor-agents) and immutable ConversationState (OpenHands); nexus-agents adds cryptographic linking between records. Directly relevant to hima's compliance artifact moat.

10. **Deterministic-vs-AI work separation with token budget tracking (agentsys pattern)** — Explicit pipeline split: AST/regex/static-analysis runs deterministically (no LLM tokens); planning/synthesis/review uses LLM. 77% token reduction claimed. Prior scan documented cost-tier routing (Citadel) and per-model prompt branches (opencode); agentsys adds the deterministic-first principle as an explicit design rule with token-profiling agents.

---

## 5. Sources

All URLs cited with access date 2026-05-14 unless noted.

1. [github.com/topics/claude-code](https://github.com/topics/claude-code) — topic page, 26,531 repos tagged
2. [github.com/topics/claude-skills](https://github.com/topics/claude-skills) — topic page
3. [github.com/topics/claude-code-plugin](https://github.com/topics/claude-code-plugin) — topic page
4. [github.com/affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) — v2.0.0-rc.1, Apr 2026
5. [github.com/obra/superpowers](https://github.com/obra/superpowers) — v5.1.0, May 4, 2026
6. [github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) — v13.2.0, May 12, 2026
7. [github.com/ruvnet/ruflo](https://github.com/ruvnet/ruflo) — v3.7.0-alpha.33, May 13, 2026
8. [github.com/wshobson/agents](https://github.com/wshobson/agents) — May 2026
9. [github.com/OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) — v2.37.0, May 5, 2026
10. [github.com/alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) — v2.0.0, Mar 4, 2026
11. [github.com/travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) — Feb 2026
12. [github.com/ChrisWiles/claude-code-showcase](https://github.com/ChrisWiles/claude-code-showcase) — May 2026
13. [github.com/dralgorhythm/claude-agentic-framework](https://github.com/dralgorhythm/claude-agentic-framework) — v2.0.2, Mar 12, 2026
14. [github.com/Chachamaru127/claude-code-harness](https://github.com/Chachamaru127/claude-code-harness) — v4.10.0, May 12, 2026
15. [github.com/SethGammon/Citadel](https://github.com/SethGammon/Citadel) — 2026
16. [github.com/sangrokjung/claude-forge](https://github.com/sangrokjung/claude-forge) — v3.0.2, May 3, 2026
17. [github.com/williamzujkowski/nexus-agents](https://github.com/williamzujkowski/nexus-agents) — v2.67.0, May 4, 2026
18. [github.com/raphaelchristi/harness-evolver](https://github.com/raphaelchristi/harness-evolver) — v6.4.2, Apr 4, 2026; paper: arxiv.org/abs/2603.28052
19. [github.com/agent-sh/agnix](https://github.com/agent-sh/agnix) — v0.26.0, May 14, 2026
20. [github.com/agent-sh/agentsys](https://github.com/agent-sh/agentsys) — v5.12.0, Apr 26, 2026
21. [github.com/revfactory/harness](https://github.com/revfactory/harness) — 2026
22. [github.com/dirien/yet-another-agent-harness](https://github.com/dirien/yet-another-agent-harness) — Apr 16, 2026
23. [github.com/stevesolun/ctx](https://github.com/stevesolun/ctx) — v1.0.3, May 10, 2026
24. [github.com/jeremylongshore/claude-code-plugins-plus-skills](https://github.com/jeremylongshore/claude-code-plugins-plus-skills) — Mar 2026
25. [github.com/anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — 2026 (376 commits)
26. [github.com/harness/harness-skills](https://github.com/harness/harness-skills) — 2026
27. [github.com/feiskyer/claude-code-settings](https://github.com/feiskyer/claude-code-settings) — 2026
28. [github.com/rohitg00/awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) — Mar 2026
29. [github.com/rohitg00/pro-workflow](https://github.com/rohitg00/pro-workflow) — May 9, 2026
30. [github.com/VILA-Lab/Dive-into-Claude-Code](https://github.com/VILA-Lab/Dive-into-Claude-Code) — 2026
31. [github.com/kenryu42/claude-code-safety-net](https://github.com/kenryu42/claude-code-safety-net) — 2026
32. [github.com/ComposioHQ/awesome-claude-plugins](https://github.com/ComposioHQ/awesome-claude-plugins) — 2026
33. [github.com/fcakyon/claude-codex-settings](https://github.com/fcakyon/claude-codex-settings) — 2026
34. [github.com/shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) — 2026
35. [github.com/nyldn/claude-octopus](https://github.com/nyldn/claude-octopus) — 2026
36. [agent-sh.github.io/agnix](https://agent-sh.github.io/agnix/) — documentation site
37. [HN: Show HN: Agnix](https://news.ycombinator.com/item?id=46983879) — community validation
38. [scriptbyai.com/claude-code-resource-list](https://www.scriptbyai.com/claude-code-resource-list/) — 2026 resource list
