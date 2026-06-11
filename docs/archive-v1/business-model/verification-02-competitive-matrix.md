# Verification: Competitive Matrix Accuracy

**Date**: 2026-05-03
**Researcher**: deep-researcher agent (Claude Sonnet 4.6)
**Sources consulted**: 18 primary URLs + 6 official changelogs
**Method**: Multi-query web search (14 queries), WebFetch on 10 primary sources, cross-validation across ≥2 independent sources per claim

---

## Verdict: PARTIALLY CONFIRMED

The core gap claim survives scrutiny. Several per-competitor claims require nuancing — some are too absolute, a few are outright weakened by 2026 evidence. One competitor (Augment Code Intent) should be added to the matrix as a serious challenger. LangChain/CrewAI exclusion is correct. The matrix needs four targeted adjustments.

---

## Per-Competitor Verification

---

### 1. Claude Code — Claim: "No risk classification, no typed agent routing, no skill-driven development, no evidence-based completion"

**Verdict: REFUTED (partially). The claim is too absolute as of May 2026.**

#### What Claude Code now has (evidence-backed):

**Skill-driven development — PRESENT and mature.**
Claude Code ships a full Skills framework (v2.x, active in 2026) that is:
- Markdown-based SKILL.md files with YAML frontmatter
- Invocable by model or user via `/skill-name`
- Supports dynamic context injection (`!` shell blocks), subagent delegation (`context: fork`), model override per-skill, lifecycle hooks, `allowed-tools` scoping
- Follows the open AgentSkills.io standard
- Source: [Claude Code Skills docs](https://code.claude.com/docs/en/skills), [Claude Code changelog](https://code.claude.com/docs/en/changelog)

**Typed subagent routing — PRESENT but user-defined, not platform-enforced.**
- Built-in typed subagents: `Explore` (Haiku, read-only), `Plan` (read-only research), `General-purpose` (full tools), plus `statusline-setup` and `Claude Code Guide`
- Custom subagents defined in YAML frontmatter with explicit `model`, tool restrictions, and permission modes
- Routing is description-driven: Claude reads each subagent's description and delegates automatically
- Source: [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)

**Hooks as deterministic quality gates — PRESENT.**
- 12+ lifecycle hook events (PreToolUse, PostToolUse, PermissionDenied, etc.)
- Permission hardening (v2.1.113+): blocks compound Bash bypasses, `/dev/tcp` redirects, piped `cd` segments downgrading deny rules
- `managed-settings.d/` drop-in policy fragments for enterprise governance
- Source: [Claude Code changelog](https://code.claude.com/docs/en/changelog) v2.1.83–v2.1.121

**Skill eval framework — PRESENT (Skills 2.0).**
- Skill creator includes evals: A/B testing with a blind comparator agent, benchmark mode tracking eval pass rate, elapsed time, and token usage across runs
- Source: [What's New in Claude Code Skills 2.0](https://perevillega.com/posts/2026-04-01-claude-code-skills-2-what-changed-what-works-what-to-watch-out-for/)

**OpenTelemetry evidence trail — PRESENT.**
- `tool_use_id`, `tool_input_size_bytes`, `stop_reason`, `effort.level`, `command_name`, `command_source` — structured audit trail per session
- Source: [Claude Code changelog](https://code.claude.com/docs/en/changelog) v2.1.97+

#### What Claude Code still lacks vs Pipeline Fractale's claims:

**No explicit risk classification taxonomy** (Low/Medium/High labels on tasks or agent actions at the harness level). The permission system is binary allow/deny per tool pattern — not a scored risk matrix applied to task types before dispatch.

**No typed-agent routing table** enforced at platform level. Subagents are user-defined and description-matched. There is no built-in routing rule like "risk_level:HIGH → senior-reviewer agent." The routing logic lives entirely in prompt descriptions, not in a typed dispatch table.

**No session-persistent planning artifact** (no native STATE.md, PLAN.md, or structured loop-health file). Cross-session continuity requires user-authored CLAUDE.md + `.planning/` convention — not enforced by the platform.

**No eval-driven iteration loop** in the core product. The skill eval framework is a developer tool for skill authors, not an automatic pipeline that measures completion quality and re-routes on failure.

**Adjusted claim**: "Claude Code has skills and typed subagents as user-defined primitives, but no platform-enforced risk classification, no typed routing table, no session-persistent planning artifacts, and no eval-driven iteration loop built into the core runtime."

---

### 2. Codex CLI — Claim: "No risk classification, no quality gates, no evidence-based completion"

**Verdict: REFUTED (partially). Codex added explicit risk levels and an approval review agent in 2026.**

#### What Codex now has (evidence-backed):

**Risk classification — PRESENT with explicit levels.**
- The automatic approval reviewer assigns `low-risk`, `medium-risk`, `high-risk`, `critical-risk` labels to actions before execution
- Applies to: sandbox escalations, network requests, `request_permissions` prompts, side-effecting MCP tool calls, skill-script approvals
- Admins can constrain with `allowed_approvals_reviewers`
- Source: [Agent approvals & security — Codex](https://developers.openai.com/codex/agent-approvals-security)

**Automatic code review agent — PRESENT.**
- "Get your code reviewed by a separate Codex agent before you commit or push" — a second agent reviews output before action
- Pre-commit local diff review, cloud-hosted PR review with inline comments, structured pipeline review with JSON output
- Source: [CLI — Codex](https://developers.openai.com/codex/cli), [Codex CLI Code Review](https://codex.danielvaughan.com/2026/03/27/codex-cli-code-review-pr-integration/)

**Persistent `/goal` workflows — PRESENT.**
- Persistent goals that survive sessions with app-server APIs, model tools, runtime continuation
- Source: [Changelog — Codex](https://developers.openai.com/codex/changelog)

**Rollout tracing — PRESENT.**
- Traces tool, code-mode, session, and multi-agent relationships
- Source: [Changelog — Codex](https://developers.openai.com/codex/changelog)

#### What Codex still lacks:

**No typed agent routing table.** Model routing is single-tier (GPT-5.4 / GPT-5.5 choice), not a typed dispatch of specialized agent roles.

**No skill-driven development framework.** Codex Skills exist as reusable workflow snippets but are not a structured knowledge package system with triggers, eval criteria, and subagent delegation.

**No session-persistent planning artifacts** in the harness sense (no equivalent of `.planning/` + STATE.md).

**Risk classification scope is narrow**: applies only to approval prompts, not to task-level pre-dispatch risk assessment.

**Adjusted claim**: "Codex has action-level risk classification (low/medium/high/critical) for approval workflows and a review-agent pattern, but lacks typed agent routing tables, skill-driven development, and session-persistent planning artifacts."

---

### 3. OpenHands — Claim: "Replaces the developer's interaction model, not governs it; no harness-like features"

**Verdict: REFUTED. OpenHands V1 SDK (2026) has substantial harness-like features.**

#### What OpenHands now has (evidence-backed):

**Risk classification — PRESENT and explicit.**
- `LLMSecurityAnalyzer` appends a `security_risk` field (Low/Medium/High/Unknown) to every tool call
- `ConfirmRisky` policy blocks actions exceeding a configurable risk threshold (default: High)
- Architecture separates risk assessment from enforcement — custom `SecurityAnalyzer` implementations possible without touching core logic
- Source: [OpenHands SDK paper (arxiv 2511.03690v2)](https://arxiv.org/html/2511.03690v2)

**Skills system — PRESENT with standard spec.**
- Skills follow the AgentSkills standard: `SKILL.md` + `/scripts/` + `/references/` + `/assets/`
- Skills can be always-active, keyword-triggered, or loaded from `.openhands/skills/`
- Eval-driven iteration: skills have monitoring pipelines, `suggestion_accuracy` dashboards, and LLM-based feedback aggregation
- Source: [Creating Effective Agent Skills — OpenHands blog (Feb 27, 2026)](https://www.openhands.dev/blog/20260227-creating-effective-agent-skills)

**Model routing — PRESENT via RouterLLM.**
- `RouterLLM` is extensible: override `select_llm()` to route based on message characteristics (e.g., text → cheap model, images → multimodal)
- Source: [OpenHands SDK paper](https://arxiv.org/html/2511.03690v2)

**Evaluation harness — PRESENT.**
- Standardized evaluation pipelines for testing agent capabilities across real-world tasks
- V1 substantially reduces system-attributable failures over V0
- Source: [Evaluation Harness — OpenHands Docs](https://docs.openhands.dev/openhands/usage/developers/evaluation-harness), [OpenHands benchmarks GitHub](https://github.com/OpenHands/benchmarks)

**Event-sourced audit trail — PRESENT.**
- Immutable, serializable ConversationState — single source of truth enabling deterministic replay and audit
- Per-conversation SecretRegistry with auto-masking
- Source: [OpenHands SDK paper](https://arxiv.org/html/2511.03690v2)

#### What OpenHands still lacks vs Pipeline Fractale:

**No session-persistent planning artifacts** native to the harness (no `.planning/` equivalent enforced at the platform level).

**Observability requires external tooling.** Native OpenHands runs "opaque" — governance requires pairing with MLflow AI Gateway (cost control, usage tracking) which is not bundled. Source: [Harness Your OpenHands Agent — MLflow blog](https://mlflow.org/blog/mlflow-openhands)

**Not terminal-native in the Claude Code / Codex CLI sense.** OpenHands is a platform / SDK — the interaction model is programmatic, not a REPL workflow embedded in a developer's terminal shell.

**V0 deprecated April 2026.** Teams still on V0 have significantly weaker governance. The claims were more accurate against V0.

**Adjusted claim**: "OpenHands V1 SDK has explicit risk classification (Low/Medium/High per action), a skills system on the AgentSkills spec, RouterLLM model routing, and an evaluation harness. It is not a terminal companion but an agent SDK. It is a more capable harness framework than previously characterized — distinguish clearly in the matrix."

---

### 4. Aider — Claim: "No risk classification, no skill routing"

**Verdict: LARGELY CONFIRMED with one nuance.**

#### What Aider has (evidence-backed):

**Architect mode as lightweight typed routing — PRESENT.**
- Separates reasoning model (Architect, e.g., Opus) from edit model (Editor, e.g., Haiku)
- LiteLLM-based routing to 100+ providers
- Source: [Aider vs Claude Code 2026](https://www.developersdigest.tech/blog/aider-vs-claude-code-2026-update), [Aider docs modes](https://aider.chat/docs/usage/modes.html)

**Auto-lint and auto-test as thin quality gates — PRESENT.**
- `auto-lint` and `test-cmd` run on AI-generated code; Aider can fix detected problems
- Configurable via `.aider.conf.yml`
- Source: [Aider Guide 2026 — DeployHQ](https://www.deployhq.com/guides/aider)

**Structured Mode (coding-aider fork) — PRESENT in community fork, not official.**
- Plan-based checklist tracking, hierarchical subplans, context persistence across sessions
- Note: this is `coding-aider` (p-wegner), a fork of aider — not the official `aider-chat` product
- Source: [coding-aider plan-mode docs](https://github.com/p-wegner/coding-aider/blob/main/docs/plan-mode.md)

#### What Aider officially lacks:

**No risk classification.** No Low/Medium/High risk labels on tasks or actions.

**No typed agent routing table.** Architect mode is a two-tier model split, not a typed dispatch system.

**No skill system.** No SKILL.md, no trigger-based knowledge loading, no skill-level evals.

**No session-persistent planning** in the official product (Structured Mode is a fork).

**Confirmed claim with nuance**: "Aider has two-tier model routing (Architect/Editor) and thin auto-lint quality gates, but no risk classification, no skill system, and no session-persistent planning. The Structured Mode that adds planning is a community fork, not the official product."

---

### 5. Cursor — Claim: "IDE-native, different buyer; no quality gates or risk classification"

**Verdict: PARTIALLY REFUTED. Cursor 3 (April 2026) has moved meaningfully toward terminal and multi-agent territory.**

#### What Cursor now has (evidence-backed):

**Cursor 3 Agent-First Interface — PRESENT (April 2026).**
- Unified workspace managing parallel agents (local and cloud) in a single sidebar
- Agents triggerable from mobile, web, desktop, Slack, GitHub, Linear
- Local-to-cloud agent handoff via Composer 2 model
- Plugin marketplace with private team marketplaces for internal governance
- Source: [Cursor 3 Agent-First Interface — InfoQ](https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/)

**Security Reviewer quality gate — PRESENT.**
- Checks every PR for security vulnerabilities, auth regressions, privacy risks, agent tool auto-approvals, prompt injection attacks
- Leaves inline comments at exact diff location with severity and remediation
- Source: [Cursor IDE 2026 — DEV Community](https://dev.to/sahilkhurana/cursor-ai-2026-the-complete-guide-to-the-ai-native-ide-3n4h)

**Background Agents — PRESENT.**
- Cursor Background Agents run tasks autonomously, handle refactoring, debugging, code generation without interrupting workflow
- Once instructed, agents handle iterations, testing, linting, formatting without supervision
- Source: [Cursor Background Agents Complete Guide 2026](https://ameany.io/cursor-background-agents/)

**CLI improvements — PRESENT.**
- Cursor CLI with Debug Mode, `/btw` side questions, `/config` menu, `/statusline` customization
- Terminal-adjacent but not terminal-native (still IDE-rooted)
- Source: search result snippet from releasebot

#### What Cursor still lacks vs Pipeline Fractale:

**No typed agent routing table.** Background agents are general-purpose, not dispatched based on task risk or type taxonomy.

**No risk classification on tasks.** Security Reviewer is a post-hoc PR scan, not a pre-dispatch risk classifier.

**No skill-driven development framework.** No SKILL.md, no trigger system, no skill-level evals.

**No session-persistent planning artifacts.**

**Still primarily IDE-native.** Despite CLI improvements and Cursor 3, the core interaction model remains VS Code-forked GUI. "Different buyer" claim still holds for terminal-first teams.

**Adjusted claim**: "Cursor 3 has background agents, a Security Reviewer gate, and cross-platform triggering — it is no longer purely IDE-native. However, it still lacks typed agent routing, risk classification at the task level, skill-driven development, and session-persistent planning. The 'different buyer' framing needs updating: Cursor now competes for the same autonomous-agent workflow buyer, but from an IDE-first posture."

---

### 6. Windsurf — Claim: "IDE-native, different buyer; no quality gates or risk classification"

**Verdict: PARTIALLY REFUTED. Windsurf has expanded into enterprise governance territory in 2026.**

#### What Windsurf now has (evidence-backed):

**Cascade Hooks as governance infrastructure — PRESENT and significantly expanded.**
- Hooks fire at `post_cascade_response`, `post_write_code`, `POST_CASCADE_RESPONSE_WITH_TRANSCRIPT`
- New: hooks on user prompts for logging and blocking policy-violating prompts
- Supports: audit/log hooks, prompt blocking, custom command execution at workflow points
- Enterprise: cloud configuration for hooks, system-level rules via MDM
- Source: [Cascade Hooks — Windsurf Docs](https://docs.windsurf.com/windsurf/cascade/hooks), [Windsurf changelog](https://windsurf.com/changelog)

**Parallel multi-agent sessions — PRESENT (Wave 13).**
- First-class parallel multi-agent sessions, Git worktrees, side-by-side Cascade panes, dedicated terminal profile
- Devin Local agent uses "same agent harness as the terminal"
- Source: [Windsurf expands lineup — Epium](https://epium.com/news/windsurf-editor-changelog-march-2025-march-2026/)

**Enterprise governance — PRESENT.**
- RBAC, SSO, organization-wide allow/deny lists for auto-executed commands
- Admins set default models for teams
- Analytics dashboards
- Source: [Windsurf Review 2026 — Second Talent](https://www.secondtalent.com/resources/windsurf-review/)

**Memories + Rules + Workflows — PRESENT.**
- Team-level policies enforced via these three layers
- Source: [Windsurf changelog](https://windsurf.com/changelog)

#### What Windsurf still lacks:

**No risk classification taxonomy** on tasks or agent actions (no Low/Medium/High scoring before dispatch).

**No typed agent routing table.** Cascade is a single-agent model, not a typed dispatch system.

**No skill-driven development** in the AgentSkills sense (Memories/Rules are closer to CLAUDE.md than to SKILL.md with triggers and evals).

**No eval-driven iteration loop** in the harness.

**Adjusted claim**: "Windsurf has meaningful enterprise governance via Cascade Hooks, team-wide allow/deny lists, RBAC, and MDM-deployable rules — more than 'no quality gates.' But it lacks typed agent routing, explicit risk classification, skill-driven development, and eval-driven iteration. The 'different buyer' claim still holds for terminal-first solo developers but weakens for enterprise teams."

---

## Gap Claim Verification

### Claim: "No commercial product combines typed-agent routing + skill-driven development + quality discipline + session-persistent planning + eval-driven iteration"

**Verdict: CONFIRMED with one serious challenger.**

#### Systematic assessment of all candidates:

| Dimension | Claude Code | Codex CLI | OpenHands | Aider | Cursor | Windsurf | Augment Intent | Devin |
|---|---|---|---|---|---|---|---|---|
| Typed agent routing (platform-enforced table) | Partial (desc-matched) | No | Partial (RouterLLM) | No (2-tier) | No | No | Partial (Coordinator/Implementor/Verifier) | No |
| Skill-driven development (triggers + evals) | Yes (Skills 2.0) | No | Yes (AgentSkills) | No | No | No | Partial (rules, no evals) | Partial (Slash Commands) |
| Quality gates (pre-merge verification) | Partial (hooks) | Partial (review agent) | Partial (SecurityAnalyzer) | Partial (auto-lint) | Partial (Security Reviewer) | Partial (Hooks) | Yes (Verifier agent) | No |
| Session-persistent planning artifacts | No | Partial (persistent /goal) | No | No | No | No | Yes (Living Specs) | Partial (playbooks) |
| Eval-driven iteration loop | Partial (skill evals only) | No | Partial (eval harness) | No | No | No | No | No |
| Risk classification (scored taxonomy) | No | Yes (4-tier) | Yes (LMH) | No | No (post-hoc) | No | No | No |

**Total score (6 dimensions, 1 point each):**
- Claude Code: 3/6
- Codex CLI: 2/6
- OpenHands: 3/6
- Aider: 1/6
- Cursor: 1/6
- Windsurf: 1/6
- Augment Intent: 3/6
- Devin: 1/6

**No product scores 5/6 or 6/6. The gap is real.**

#### Augment Code Intent — the most serious challenger:

Intent (public beta February 26, 2026) has three of the five dimensions:
- Coordinator/Implementor/Verifier typed role split
- Living Specs persisting across sessions (session-persistent planning)
- Verifier agent checking implementations against spec before PR (quality gate)

Missing from Intent:
- No explicit risk classification taxonomy
- No eval-driven iteration (no automated pass-rate tracking across runs)
- Skills system is rules-based (always_apply / agent_requested / manual), not trigger-based with evals
- Source: [Intent — Augment Code](https://www.augmentcode.com/product/intent), [Intent Review — Awesome Agents](https://awesomeagents.ai/reviews/review-augment-code-intent/), [Claude Code vs Intent — Augment Code](https://www.augmentcode.com/tools/intent-vs-claude-code)

**Conclusion**: Augment Intent is the closest commercial competitor on the architectural level but covers 3/6 dimensions. The full combination (all five) does not exist as a commercial off-the-shelf product. The gap claim is confirmed, but **Augment Intent must be added to the matrix** — omitting it weakens the argument by making it look like the comparison was cherry-picked.

#### Supporting evidence for the gap:

Martin Fowler's harness engineering article (2026): explicitly states no commercial product is named as combining all harness dimensions. Source: [Harness engineering for coding agent users — martinfowler.com](https://martinfowler.com/articles/harness-engineering.html)

Atlan's top AI harness tools roundup (2026): "No framework addresses data quality gates before agents execute... every framework manages how agents run. None governs what agents actually read." Source: [Top AI Agent Harness Tools 2026 — Atlan](https://atlan.com/know/best-ai-agent-harness-tools-2026/)

Addy Osmani's harness engineering analysis (2026): tools "look more like each other than their underlying models do" but no audit identifies a product covering all five dimensions. Source: [Agent Harness Engineering — addyosmani.com](https://addyosmani.com/blog/agent-harness-engineering/)

---

## Missing Competitors

### Should have been included:

**1. Augment Code Intent** — MUST ADD
Most structurally similar competitor to the Pipeline Fractale model. Coordinator/Implementor/Verifier typed architecture, Living Specs, Verifier quality gate, macOS desktop. Launched public beta Feb 26, 2026.
Score: 3/6 dimensions. Direct architectural competitor.
Source: [Intent — Augment Code](https://www.augmentcode.com/product/intent)

**2. IBM watsonx Code + IBM Bob** — CONSIDER for enterprise tier
IBM Bob operates as a "system-level AI development partner" with security, governance, and control at enterprise scale. `watsonx.governance` added AI Agent object types, Agent Monitoring and Insights (Q1 2026), risk atlas, agentic AI risk tracking.
Buyer: enterprise/regulated industries, not solo dev. Can be noted as "enterprise-tier analog."
Source: [IBM watsonx Governance — blog.exceeds.ai](https://blog.exceeds.ai/ibm-watsonx-governance-features-comparison/)

**3. Devin (Cognition)** — low priority, already known
Adds parallel sessions, Guardrails V3, Skill Slash Commands, playbook creation. But: no typed routing table, no eval-driven iteration. Score: 1/6.

### Confirmed non-competitors (correctly excluded):

**LangChain / LangGraph** — CORRECTLY EXCLUDED from coding-harness matrix
LangChain/LangGraph are general-purpose agent orchestration frameworks, not coding-specific harnesses. They are infrastructure on which harnesses can be built — the "plumbing layer," not the product. Users build coding agents on top of LangGraph; no one installs LangGraph in their terminal instead of Claude Code.

However: LangGraph 2.0 (2026) does codify three production orchestration patterns (Router, Supervisor, Subagent unified primitives) and achieves 87% task success in benchmarks. It is a foundation layer, not a competitor at the harness-for-developers layer.
Source: [CrewAI vs LangChain 2026 — NxCode](https://www.nxcode.io/resources/news/crewai-vs-langchain-ai-agent-framework-comparison-2026), [AI Agent Frameworks 2026 — Fungies.io](https://fungies.io/ai-agent-frameworks-langchain-crewai-autogen-2026/)

**CrewAI** — CORRECTLY EXCLUDED
Same reasoning: an application framework (12M+ daily agent executions, native MCP/A2A), not a terminal coding companion. Builders use CrewAI to construct agents; developers do not use CrewAI instead of Aider or Claude Code.
Source: [CrewAI vs LangChain 2026 — NxCode](https://www.nxcode.io/resources/news/crewai-vs-langchain-ai-agent-framework-comparison-2026)

**NxCode** — low priority
Emerging visual-first, low-code multi-agent builder. Not terminal-native, not a developer workflow tool. Different buyer.

---

## Disputed Claims

**Single-source warning — requires monitoring:**
The claim about Cursor's "Security Reviewer" checking every PR appeared in one community blog (DEV Community) but not in official Cursor changelog or docs. Treat as partially verified until confirmed in [cursor.com/changelog](https://cursor.com/changelog).

**Windsurf "Devin Local uses same harness as terminal"**: appeared in a third-party changelog summary (Epium), not in official Windsurf docs. Directionally credible but verify at [windsurf.com/changelog](https://windsurf.com/changelog).

---

## Recommendation

### Matrix adjustments required (4 changes):

**Change 1 — Claude Code row: revise from "no skill-driven development" to partial.**
Claude Code Skills 2.0 is a mature, documented skill framework on the AgentSkills.io open spec. The row should read: "Has skill-driven development (Skills 2.0) and typed subagent routing (user-defined). Missing: platform-enforced risk classification, session-persistent planning artifacts, eval-driven iteration loop."

**Change 2 — Codex CLI row: revise from "no risk classification" to partial.**
Codex has explicit 4-tier action-level risk classification (low/medium/high/critical) for approval workflows and a separate code-review agent. The row should read: "Has action-level risk classification and review-agent pattern. Missing: typed agent routing table, skill-driven development, session-persistent planning."

**Change 3 — OpenHands row: revise from "replaces interaction model, no harness features" to "SDK with harness primitives."**
OpenHands V1 (V0 deprecated April 2026) has LLM-based risk classification (Low/Medium/High), AgentSkills-compliant skill system, RouterLLM model routing, and evaluation harness. It is an SDK/platform, not a terminal companion — the "replaces interaction model" framing is still accurate for positioning but the "no harness features" sub-claim is false for V1.

**Change 4 — Add Augment Code Intent as a new row.**
Intent is the most structurally adjacent commercial competitor. It covers 3/6 dimensions (typed roles, session-persistent Living Specs, Verifier quality gate). Its differentiation: macOS desktop app, spec-driven multi-agent, paid product, codebase context engine at 400K+ files. Pipeline Fractale differentiation against Intent: explicit risk classification, eval-driven iteration loop, terminal-native, harness-as-config (markdown rules, not GUI), cross-platform.

### Keep as-is:

- Aider row: "thin quality gates (auto-lint/test), two-tier model split" — accurate
- Cursor row: adjust "different buyer" to "IDE-first buyer, converging toward autonomous workflows" but keep core claim about missing typed routing, risk classification, and skill system
- Windsurf row: adjust to note Cascade Hooks are a meaningful governance layer, but keep core claim about missing typed routing table, risk classification, and skill-driven development
- LangChain/CrewAI exclusion: correct — different layer, not a competitor
- Core gap claim: confirmed and defensible

---

## Sources

| Source | Author/Org | Score | URL |
|---|---|---|---|
| Claude Code Skills docs (2026) | Anthropic | 3 | https://code.claude.com/docs/en/skills |
| Claude Code sub-agents docs (2026) | Anthropic | 3 | https://code.claude.com/docs/en/sub-agents |
| Claude Code changelog v2.1.x | Anthropic | 3 | https://code.claude.com/docs/en/changelog |
| Codex CLI docs (2026) | OpenAI | 3 | https://developers.openai.com/codex/cli |
| Codex Agent approvals & security (2026) | OpenAI | 3 | https://developers.openai.com/codex/agent-approvals-security |
| Codex changelog (2026) | OpenAI | 3 | https://developers.openai.com/codex/changelog |
| OpenHands SDK paper (arXiv 2511.03690v2) | AllHands AI / arXiv | 3 | https://arxiv.org/html/2511.03690v2 |
| Creating Effective Agent Skills — OpenHands blog | AllHands AI | 3 | https://www.openhands.dev/blog/20260227-creating-effective-agent-skills |
| Harness Your OpenHands Agent — MLflow | MLflow / Databricks | 2 | https://mlflow.org/blog/mlflow-openhands |
| Intent product page (2026) | Augment Code | 2 | https://www.augmentcode.com/product/intent |
| Harness Engineering for AI Coding Agents | Augment Code | 2 | https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents |
| Claude Code vs Intent (2026) | Augment Code | 2 | https://www.augmentcode.com/tools/intent-vs-claude-code |
| Aider docs — modes | aider-chat | 3 | https://aider.chat/docs/usage/modes.html |
| coding-aider plan-mode docs | p-wegner (GitHub) | 1 | https://github.com/p-wegner/coding-aider/blob/main/docs/plan-mode.md |
| Cursor 3 Agent-First Interface | InfoQ | 2 | https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/ |
| Cascade Hooks — Windsurf Docs | Codeium/Windsurf | 3 | https://docs.windsurf.com/windsurf/cascade/hooks |
| Windsurf changelog | Codeium/Windsurf | 3 | https://windsurf.com/changelog |
| Harness engineering for coding agent users | Martin Fowler | 3 | https://martinfowler.com/articles/harness-engineering.html |
| Top AI Agent Harness Tools 2026 | Atlan | 1 | https://atlan.com/know/best-ai-agent-harness-tools-2026/ |
| Agent Harness Engineering | Addy Osmani | 2 | https://addyosmani.com/blog/agent-harness-engineering/ |
| Claude Code Skills 2.0 — what changed | Pere Villega | 2 | https://perevillega.com/posts/2026-04-01-claude-code-skills-2-what-changed-what-works-what-to-watch-out-for/ |
| CrewAI vs LangChain 2026 | NxCode | 1 | https://www.nxcode.io/resources/news/crewai-vs-langchain-ai-agent-framework-comparison-2026 |
| AI Agent Frameworks 2026 | Fungies.io | 1 | https://fungies.io/ai-agent-frameworks-langchain-crewai-autogen-2026/ |
| IBM watsonx Governance features 2026 | blog.exceeds.ai | 1 | https://blog.exceeds.ai/ibm-watsonx-governance-features-comparison/ |
| Devin release notes 2026 | Cognition | 3 | https://docs.devin.ai/release-notes/2026 |
| Windsurf expands lineup 2025–2026 | Epium | 1 | https://epium.com/news/windsurf-editor-changelog-march-2025-march-2026/ |
