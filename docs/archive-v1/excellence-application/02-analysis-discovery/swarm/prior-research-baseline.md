---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-agent-0
source-files-distilled: 18
---

# Prior Research Baseline — swarm-agent-0

## Executive Summary (10 lines)

1. hima is a quality governance harness (runtime management system) for AI coding agents, not a coding agent itself. Positioning: "Cursor/Devin writes the code; Pipeline Fractale guarantees it's correct."
2. The $7.65B AI dev tools market has a validated governance gap: 92% of agentic deployment failures are governance/evaluation failures, not model failures. Qodo raised $70M in March 2026 on exactly this thesis.
3. Revenue architecture is settled: MIT open core + cloud platform (BYOK, $29–$5K/mo by tier) + skill packs (~95% margin). Lifetime pricing was explicitly dropped — zero precedent in cloud AI dev tools.
4. The PR quality comment as viral loop is the highest-leverage distribution primitive (CodeRabbit: 0 to $40M ARR, 2M repos, via branded PR comments alone).
5. 10 harness patterns from 11 external repos are ready to harvest; the most critical is the `deliverables.json` machine-verified gate (OMC) — no competitor offers this as a standard primitive.
6. The canonical implementation contract is fully specified in specs 01-10 (`packages/core/` exists with ~100 source files), but the doc corpus has 0/13 files passing the compliance audit — vocabulary and storage-model drift are the main blockers.
7. hima's actual code state: `packages/core` (state-machine, risk-classifier, gates, planning-store, catalogs, evidence, install, runtime, policy, convergence), `packages/cli`, `packages/mcp-server`, `packages/adapter-{claude,codex,hermes}` all exist with tests. The contract layer is ahead of the doc layer.
8. The hook formula for viral growth is Irreversibility + Evidence + Instant Value (<5 min TTV). The PR quality report is the strongest candidate — it hits all three.
9. Microsoft Agent Governance Toolkit (MIT, April 2026) is the live competitive threat. Differentiator: Microsoft governs what agents *can do*; hima governs whether what agents *did do* meets quality standards.
10. Five open questions remain from prior research that the swarm (S1-S6) must close: see §E.

---

## §A — Pre-existing Harness Intelligence

Source: `research-harness-extraction.md` + `omx-architecture-deep-dive.md`
Audited: 11 external harnesses (OpenHands, OMC, oh-my-codex/OMX, 12-factor-agents, oh-my-openagent, hermes-agent, opencode, goose, claw-code, Cursor, SWE-agent scaffolding).

| # | Harness | What it is | What hima should harvest | Gap if not harvested | Source cite |
|---|---------|-----------|--------------------------|---------------------|-------------|
| 1 | OpenHands | Multi-agent OSS framework, MIT, `{org}/.openhands` auto-loaded | 4-tier skill scope: public/user/project/org — org-level = paid team tier primitive | No viral B2B distribution mechanism; org adoption stays manual | `research-harness-extraction.md:13` |
| 2 | OMC | oh-my-claudecode, 40 skills, machine-verified deliverables | `deliverables.json` gate: per-stage file presence + min-size + required-sections, checked at SubagentStop | Nobody can verify "the agent actually wrote the spec" — enterprise blocker | `research-harness-extraction.md:14` |
| 3 | OMX (oh-my-codex) | Node+Rust CLI, 39 skills, 33 agents, 5 MCP servers, tmux team mode | Keyword registry with priority disambiguation (70 keywords → 17 skills, priority 5-11); triage heuristic (PASS/LIGHT/HEAVY lanes); ralplan gate for vague prompts | hima's AUTO-INVOQUER is prose-only; no testable code-side registry | `omx-architecture-deep-dive.md:136-180` |
| 4 | opencode | Reads `~/.claude/skills/` natively, plan-mode anti-bypass clause | SKILL.md cross-tool standard already won; plan-mode `sed/tee/echo/cat` guard | Skills advertise on tools where they can't run; plan-mode escape hatch unguarded | `research-harness-extraction.md:30-34` |
| 5 | 12-factor-agents | Typed human-handoff `request_human_input` + `thread.jsonl` event log | Structured handoff event with `{urgency, format, choices, threadId}` to `handoffs.jsonl` | M/H/C risk gating has no auditable event stream — "pause for irreversible" is a rule not a primitive | `research-harness-extraction.md:16` |
| 6 | hermes-agent | Python agent with prompt-injection scanner + skill conditional activation | 10 regex + 10 invisible-unicode detectors at context load; skills hide when required tools absent | Claude Code reads CLAUDE.md blindly — CVE-class attack surface unclosed | `research-harness-extraction.md:17,19` |
| 7 | oh-my-openagent | 52 hooks, path-based runtime enforcement, Lore git trailer protocol | Runtime block on `rules/*` writes by sub-agents (hard guarantee, not soft rule) | "Sub-agents must NEVER edit rules/" is currently prompt-side only | `research-harness-extraction.md:20` |
| 8 | goose | 70 production-grade YAML recipes, SmartApprove LLM-as-judge permission tier | `Auto/Approve/SmartApprove/Chat` modes map to T/L/M/H/C risk classes | Risk gating has no per-tool-call LLM classification — only static allowlist | `research-harness-extraction.md:21` |
| 9 | claw-code | `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` pattern, pre-fetch session context hook | Static/dynamic prompt boundary for cache-hit discipline; auto-inject git status + last 3 ADRs at session start | Every session wastes 2-3 roundtrips re-asking for state the harness already knows | `research-harness-extraction.md:22,10` |
| 10 | opencode plan-mode | Plan-mode anti-bypass clause | Explicit `sed/tee/echo/cat` filesystem manipulation block in plan mode | Plan mode has no guard against filesystem escape via shell commands | `research-harness-extraction.md:48` |
| 11 | OMX MCP servers | 5 first-party MCP servers (state, memory, code-intel, trace, wiki) | CLI parity for every MCP tool; duplicate server self-exit via PID watchdog | Without CLI fallback, MCP transport failure = state loss | `omx-architecture-deep-dive.md:296-364` |

**Table stakes** (must-have to compete, already partially present in hima):
- SKILL.md discovery with YAML frontmatter: confirmed cross-tool standard (opencode, goose, OpenHands). `research-harness-extraction.md:30`
- Hook enforcement at runtime (not just prompt): 22 hooks (OMC), 52 (oh-my-openagent), 17 (hermes). hima has ~10 wired. `research-harness-extraction.md:36`
- Mandatory deslop pass after critic approval: OMC ralph Step 7.5 + OMX both run `ai-slop-cleaner` unconditionally. `research-harness-extraction.md:40`
- Per-agent tool disallow list: OMC critic blocks `Write, Edit`; opencode blocks `question/plan_enter/plan_exit`. `research-harness-extraction.md:44`

**Anti-patterns to never build** (validated from 11 harness audit):
- Persona-stuffing in skills (73% of cursorrules — no measurable benefit). `research-harness-extraction.md:123`
- BSL/SSPL licensing (Redis/HashiCorp cautionary). `research-harness-extraction.md:137`
- Execution-based pricing (CrewAI $0.50/execution creates cost anxiety). `research-harness-extraction.md:139`
- Crippled core (<10% of users can run free in production breaks the flywheel). `research-harness-extraction.md:141`

---

## §B — Pre-existing Competitive Intel

Source: `competitive-landscape-2026.md` + `research-gamechangers.md`

| Finding | Strategic lesson for hima | Source cite |
|---------|--------------------------|-------------|
| AI dev tools market: $7.65B (2025), $9.46B (2026), 24% CAGR. Cursor $2B ARR in 26 months — fastest SaaS ramp in history. | Market timing is exceptional. Cursor doubled revenue every ~2 months via 3 distinct triggers (Tab model March 2024, Composer multi-file mid-2024, Agent mode default late 2024). hima is not competing with Cursor — it governs above it. | `competitive-landscape-2026.md:9`, `research-gamechangers.md:18-32` |
| Governance gap: only 2% of tech leaders say AI agents are "fully governed." 92% of agentic failures are governance/eval/integration failures, not model failures. | This is hima's primary market thesis and it's validated by live VC money. | `competitive-landscape-2026.md:12`, `cloud-platform-revenue-research.md:7` |
| Qodo raised $70M (March 2026), 10x revenue YoY, ranked #1 Code Review Bench. BUT: operates inside PR/review cycle, not as governance orchestrator at the orchestration layer. | Qodo validates the market but is NOT a direct competitor — it reviews code after the agent writes it; hima governs the agent during the cycle. Differentiation: timing and surface. | `competitive-landscape-2026.md:71-76` |
| Microsoft Agent Governance Toolkit (MIT, April 2026): 7 components, covers all 10 OWASP Agentic AI Top 10 risks, <0.1ms p99 policy enforcement. | This is the most dangerous competitive threat. BUT: Microsoft governs what agents *can do* (tool misuse, identity, sandboxing). hima governs whether what agents *did do* meets quality standards. Clear differentiation lane exists. | `competitive-landscape-2026.md:63-69` |
| Devin: $500/mo → $20/mo in 6 months (96% price cut = structural churn, not democratization). Root cause: no quality evidence during task execution. Trust problem killed retention before product problem did. | Evidence is the enterprise unlock. "Your agent passed 47 gates, here's the proof" is not a dashboard feature — it's the answer to AI tool trust falling from 40% to 29% (Stack Overflow 2025). | `research-gamechangers.md:56-64` |
| Cline: 5M installs, zero marketing. Growth driven by: Cursor BYOK restriction (drove installs), SWE-bench 80.8% (matched paid tools at zero cost), BYOM (any OpenAI-compatible endpoint). | OSS + BYOK + benchmark credibility is the distribution formula. hima should publish a quality benchmark (pipeline-fractale quality index) as a community flywheel. | `research-gamechangers.md:69-85` |
| Lovable: $400M ARR in 14 months. Key differentiator: pivoted to non-technical users (orthogonal to Cursor). Growth lever: "Launched" showcase — user creates app, shares it, viewer clicks "Edit with Lovable" = acquisition. | The shareable artifact with your brand embedded is the viral loop. hima equivalent: PR quality report with "Pipeline Fractale audit" header — every reviewer who sees it is a potential user. | `research-gamechangers.md:89-119` |
| AI tool trust: fell from 40% (2023) to 29% (2025) despite 80% adoption. AI-coauthored PRs show 1.7x more issues than human-only PRs (GitClear, 153M lines). | This is hima's tailwind. Trust fell because there's no evidence layer. hima IS the evidence layer. | `research-gamechangers.md:203-211` |
| MIT is safe for workflow/governance tools. VSCode (MIT) never forked. Fork risk is infrastructure-layer only (databases, runtimes). The actual risk: first-party solutions from Anthropic/Google. | Stay MIT. The moat is integrations (Claude Code hooks, Codex MCP, community skill packs), community trust, and update velocity — none of which a fork captures. | `competitive-landscape-2026.md:162-171` |
| Conversion reality: website→signup 10%, signup→paid 5% (6 months). Combined: ~0.5-1%. Pure self-serve does not reach revenue targets. PLG + targeted outreach doubles conversion. | Individual dev installs free → team lead sees PR quality → PLG signal → outreach → enterprise contract. One enterprise = 500 individual conversions at 10-100x ACV. | `competitive-landscape-2026.md:107-119` |

Falsifies-If:
  kill-condition: A later source refresh contradicts the baseline market, competitive, revenue, or harness-harvest assumptions used for cycle-02 planning.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm/prior-research-baseline.md
  on-fail: Mark the affected baseline item stale and rerun the corresponding discovery lane before using it as planning evidence.

---

## §C — Pre-existing Business-Model Assumptions

Source: `research-buyer-psychology.md` + `research-distribution.md` + `research-revenue-innovations.md` + `research-viral-hook.md` + `BUSINESS-MODEL-v2.md` + `cloud-platform-revenue-research.md`

**Pricing architecture (SETTLED — BUSINESS-MODEL-v2.md supersedes all prior decisions):**

| Tier | Price | Risk classes | Notes | Source cite |
|------|-------|-------------|-------|-------------|
| Core (MIT) | Free | T + L | Full local harness, BYOK | `BUSINESS-MODEL-v2.md:23-32` |
| Solo cloud | $29/mo or $290/yr | T + L | 100 tasks/mo, BYOK, web dashboard | `BUSINESS-MODEL-v2.md:44` |
| Pro cloud | $79/mo or $790/yr | T + L + M | 500 tasks/mo, PR integration | `BUSINESS-MODEL-v2.md:44` |
| Team cloud | $39/user/mo | T + L + M + H | Unlimited (fair use), SSO, audit logs | `BUSINESS-MODEL-v2.md:44` |
| Enterprise | Custom $80-150/user/mo | T + L + M + H + C | VPC, SLA, compliance reports | `BUSINESS-MODEL-v2.md:44` |
| Skill packs | $29-99/mo or $199 one-time | — | Security, Compliance, Performance, Migration | `BUSINESS-MODEL-v2.md:56-66` |

**Lifetime pricing explicitly dropped**: zero precedent in AI dev tools. Cloud services have ongoing COGS. `BUSINESS-MODEL-v2.md:219`

**BYOK is mandatory default**: provided API is startup-killing at scale. 500 Pro users × 400 tasks × $0.80/task COGS = -$123,500/mo at $79 subscription revenue. BYOK eliminates API cost risk. `cloud-platform-revenue-research.md:295-309`

**Unit economics (BYOK, 60% utilization)**: Solo 75% margin, Pro 54%, Team 63%, Enterprise 86%. Blended target: 65-75%. `BUSINESS-MODEL-v2.md:92-110`

**Buyer psychology (evidence-based, no speculation):**
- Purchase authority threshold: engineering manager signs alone under ~$500/mo; above that, VP Eng or procurement co-sign. `research-buyer-psychology.md:28-31`
- Top purchase triggers in order: (1) production incident from AI code, (2) compliance/audit request, (3) team scaling 5→20+, (4) tech debt accumulation. `research-buyer-psychology.md:49-76`
- Messaging that converts: "Reduces change failure rate" (DORA metric they report), "Audit trail for AI-generated code," "Catches issues at PR time not production." `research-buyer-psychology.md:119-122`
- Snyk pattern: 5,000 developer users, $0 revenue → built governance/reporting/centralized controls for CISOs → $100K ARR in 5 months. Developer love is necessary but not sufficient. `research-buyer-psychology.md:158-191`

**Distribution (concrete playbook):**
- PR comment as viral loop: Snyk's entire PLG growth from "[Snyk]" PR prefix. Viral coefficient: each active user exposes 2-5 new potential users per week passively. `research-distribution.md:39-58`
- HN beats Product Hunt 3:1 on install quality. HN launch = 50-300 installs, 50+ GH stars. `research-distribution.md:8`
- GitHub Marketplace is the most underrated channel for a CI-first tool. `research-distribution.md:207-219`
- Paid ads = confirmed waste for dev tools. 80%+ of paying customers come from organic search. 40-60% of developer audience uses ad blockers. `research-distribution.md:308-320`
- PLG signals: 3+ installs from same company domain within 60 days = Product Qualified Lead converting 3x better than marketing leads. `research-distribution.md:282-290`

**Revenue model innovations (validated):**
- Open-core + risk-gated premium ranks #1 for solo dev feasibility (HIGH evidence, GitLab/PostHog/SonarQube proof). `research-revenue-innovations.md:356`
- Per-quality-event pricing (per clean PR, $0.99-2.00) ranks #2 (Intercom Fin proof: "tens of millions" in year 1). `research-revenue-innovations.md:357`
- AppSumo revenue dropped 50% in 2024-2025; 70% cut to AppSumo means developer gets only 30%. Use for distribution, not revenue. `research-revenue-innovations.md:401`

**Viral hook research (validated formula):**
- Irreversibility + Evidence + Instant Value (<5 min TTV). `research-viral-hook.md:14`
- The PR comment artifact IS the demo. Format proposed: table with Finding/Severity/File/Fix + "Powered by Pipeline Fractale" footer. `research-viral-hook.md:294-309`
- CodeRabbit: #1 most-installed AI GitHub Marketplace app, 2M repos, $40M ARR — purely bottom-up via free tier for open source + branded PR comments. `research-viral-hook.md:248-253`
- Devin's demo-reality gap: backlash video hit HN #1, permanent credibility damage. Never demo capabilities not reproducible on demand. `research-viral-hook.md:27-35`

**Claims the new D1 scan may sharpen (flagged):**
- Conversion 5% signup-to-paid is a median; tools with strong activation loops achieve 9-12%. hima's PR comment loop is a strong activation signal — real conversion may exceed median.
- AppSumo lifetime deal as early-adopter program: the research recommends it cautiously (40% 3-year failure rate) — swarm should validate whether this remains a Phase 1 option given AppSumo's own decline.

---

## §D — hima Current State

Source: `full-compliance-audit.md` + `pfv4-alignment-implementation-summary.md` + `harness-state-machine.audit.md` + `seven-steps.audit.md` + `cross-cutting-activities.audit.md` + conception specs 01, 04, 06, 07, 10 + `packages/` glob

**Canonical contract vocabulary (post-alignment-pass, SETTLED):**
```typescript
type MacroCycle = "discovery"|"cadrage"|"conception"|"build"|"validation"|"release"|"run"|"learning"
type SubPhase = "Observer"|"Define"|"Design"|"Execute"|"Verify"|"Capitalize"|"Transmit"
type RiskClass = "T"|"L"|"M"|"H"|"C"          // RISK_CLASS_RANK = {T:0,L:1,M:2,H:3,C:4}
type OperatingMode = "bypass"|"auto"|"pairing"
type GateType = "session_start"|"user_prompt"|"pre_tool"|"post_tool"|"stop"|"subagent_start"|"subagent_stop"
```
Source: `pfv4-alignment-implementation-summary.md:82-114`

**Storage model (SETTLED — strict three-file only):**
- `.planning/state.yaml` — machine state + current cycle/subphase/mode
- `.planning/current-risk.yaml` — active risk class + classification evidence
- `.planning/run-set.json` — all RMS logical sets (project, intent, capability, state, risk, route, gate, run) as sections, NOT separate files
Source: `pfv4-alignment-implementation-summary.md:56-60`

**Conception specs status (10 specs, 01-10):**
| Spec | Status | Key content | Gaps |
|------|--------|-------------|------|
| 01 state-machine | PARTIAL | 56 composite states, 4 meta-states, 8 final states, full transition table | `.planning/agent/state-machine.yaml` executable xstate schema not produced; `current-state.yaml` bootstrap not created | `harness-state-machine.audit.md:41,129` |
| 02 risk-classifier | PARTIAL | T/L/M/H/C definitions, promotion protocol, `SupervisionMode`→`OperatingMode` rename | Renaming applied in alignment pass | `full-compliance-audit.md:75` |
| 03 rms-sets-schema | PARTIAL | 8 logical RMS sets defined | Old `.rms/` path tokens; requires policy decision on separate files vs three-file model | `full-compliance-audit.md:76-77` |
| 04 runtime-bindings | COMPLETE | Full binding table Claude Code / Codex / Hermes for all 7 GateTypes | `CanonicalHook`/`CanonicalGate` → `GateType` rename needed | `full-compliance-audit.md:78-79` |
| 05 gates-policy | PARTIAL | Gate evaluation policy, evidence types | `active-run.json` → `run-set.json`; `PipelinePhase` → `SubPhase` | `full-compliance-audit.md:80-82` |
| 06 skills-catalog | COMPLETE | 13 skills defined (5 core MVP: hima-enter, classify-risk, propose-change, transition-phase, status) | No SKILL.md files exist yet (spec only) | `06-skills-catalog-spec.md:1-35` |
| 07 subagents-catalog | COMPLETE | 9 subagents (reviewer, threat-modeler, test-writer, evidence-collector, security-auditor, accessibility-checker, perf-profiler, doc-generator, retro-facilitator) | Old path references; `'stop-gate'` → `stop` | `full-compliance-audit.md:83-86` |
| 08 planning-state-schema | PARTIAL | Three-file schema | `mode.yaml`/`final-state.yaml` still mentioned; needs removal | `full-compliance-audit.md:86-87` |
| 09 cli-commands-spec | PARTIAL | CLI command surface | Still writes risk to `state.yaml` instead of `current-risk.yaml` | `full-compliance-audit.md:88-89` |
| 10 core-api-spec | PARTIAL | Full TypeScript API types, 5 modules | Phase enum uppercase vs lowercase storage mismatch; path `agent/current-state.yaml` vs `state/state.yaml` | `full-compliance-audit.md:90-91` |

**`packages/` implementation inventory (actual code exists):**
- `packages/core/src/`: state-machine/ (machine.ts, transition.ts, subphases.ts), risk-classifier/ (index.ts, types.ts, risk-rank.ts), gates/ (evaluate-gate.ts, policy-event-blockers.ts), planning/ (planning-store.ts, planning-paths.ts, atomic-write.ts, safe-write.ts, file-lock.ts, json.ts, yaml.ts), services/ (init-project.ts, enter-development.ts, handle-hook.ts, request-transition.ts, add-evidence.ts, get-status.ts, close-run.ts), policy/ (baseline-policy.ts, write-zones.ts), runtime/ (runtime-bindings.ts, runtime-probes.ts, runtime-profiles.ts, runtime-probe.ts), evidence/ (evaluate-evidence.ts), convergence/ (evaluate-convergence.ts), catalogs/ (index.ts, operational-catalog.ts, artifact-generation.ts), install/ (artifact-install.ts, artifact-rollback.ts, artifact-paths.ts, platform-install.ts, runtime-lifecycle.ts), security/ (redaction.ts), schemas/ (state.schema.ts, current-risk.schema.ts, run-set.schema.ts, gate-event.schema.ts, common.ts), types/ (canonical.ts, errors.ts)
- `packages/cli/`, `packages/mcp-server/`, `packages/adapter-{claude,codex,hermes}/` — all exist with `src/index.ts` and tests
- Test coverage: ~25 test files covering transitions, state-machine-sequence, write-zones, risk-classifier, gates, planning-store, evidence, convergence, runtime-bindings, runtime-profiles, install, artifact-install/rollback, enter-development, handle-hook, canonical, catalogs, baseline-policy

**Audit verdicts (doc corpus, 2026-05-03):**
- Full compliance audit: **FAIL** — 0/13 files meet all criteria. 69 RED CARDS, 86 grouped naming violations, 24 cross-file contradictions, 15 orphan references. `full-compliance-audit.md:3-11`
- harness-state-machine.md coverage: **93.2% effective** (40/44 in-scope recommendations IMPLEMENTED, 3 PARTIAL, 1 MISSING). `harness-state-machine.audit.md:91-95`
- seven-steps.md coverage: **70%** (25/40 IMPLEMENTED, 3 PARTIAL, 12 MISSING). Key gaps: territory permission matrix, auto-decision guardrails, observer manifest, class promotion YAML schema. `seven-steps.audit.md:94-100`
- cross-cutting-activities.md coverage: **70% scope-adjusted** (32/46 IMPLEMENTED, 9 PARTIAL, 5 MISSING). Key gaps: Strangler Fig absent from any AT, i18n/l10n not a transversal activity, SemVer not in any AT. `cross-cutting-activities.audit.md:126-131`

**Critical blocking gap for executable harness:**
DoR/DoD formal checklists per cycle do not exist. Gates `dor_satisfied` and `dod_satisfied` are used as binary guards throughout the state machine, but the files defining what "satisfied" means per cycle are absent. Path expected: `docs/01-governance/dor-{cycle}.md` and `dod-{cycle}.md` × 8 cycles. `harness-state-machine.audit.md:117-121`

---

## §E — Open Questions the Swarm Should Answer

1. **Cloud execution stack**: `BUSINESS-MODEL-v2.md` proposes Hetzner CCX23 + Daytona for sandbox. Is Daytona still the right choice (vs E2B, Fly.io, Modal)? What is the actual per-task COGS for a typical `build` cycle task at M risk class with Claude Sonnet 4.6 in 2026? Prior research gives $0.12 (BYOK) but this needs validation against current Daytona/Hetzner pricing post April 2026 adjustment.

2. **GitHub Marketplace GitHub Action**: The distribution research identifies this as the "most underrated channel" — but no GitHub Action has been built yet. What is the minimal `action.yml` contract that makes a PR comment appear without requiring any configuration? This is the specific engineering question prior research left open.

3. **OMX keyword registry as model**: The OMX keyword registry (70 keywords → 17 skills, TypeScript, priority 5-11 with disambiguation) is identified as the replacement for hima's prose AUTO-INVOQUER. What is the minimal viable registry schema for hima? Prior research describes the OMX pattern but does not translate it to hima's 13-skill catalog.

4. **DoR/DoD formal checklists content**: The state machine uses `dor_satisfied` and `dod_satisfied` as binary guards, but the 8×2=16 files that define what these mean are absent. What is the minimum viable DoR/DoD content per cycle (especially for the MVP cycles: discovery, cadrage, build, validation)? This is the single most blocking gap for executable harness.

5. **Competitive response to CodeRabbit**: CodeRabbit hit $40M ARR (Sacra estimate, April 2026), 2M repos, 13M PRs reviewed, $60M Series B. It operates in the same PR comment space hima targets for viral distribution. Does CodeRabbit change the viral loop strategy, or is the differentiation (governance orchestration vs AI review comments) sufficient? Prior research noted CodeRabbit as a distribution comp but did not assess whether they are converging on governance.

6. **Skill SKILL.md files**: Spec 06 defines 13 skills. Zero SKILL.md files exist in the codebase. What is the priority order for materializing them, and which skill produces the fastest time-to-value demo (candidate: `hima-enter` or `classify-risk`)? Prior research identified skill materialization as a next step but did not sequence it.

7. **ARCHITECTURE.md fidelity**: The audit identified 12 specific fidelity failures in ARCHITECTURE.md (stale CLI table, wrong type definitions, stale storage layout, broken transition guards). Before swarm agents write new content referencing the architecture, which sections of ARCHITECTURE.md are currently authoritative vs stale? `full-compliance-audit.md:199-214`

---

## §F — Anti-Duplication Checklist

**Already fully researched — do NOT re-research or re-recommend:**

Business model:
- Pricing tiers and numbers (Solo $29, Pro $79, Team $39/user, Enterprise custom) — SETTLED in BUSINESS-MODEL-v2.md
- BYOK vs provided API economics — fully modeled with concrete numbers; provided API is startup-killing
- Lifetime pricing — explicitly dropped with market evidence; do not re-raise
- MIT license fork risk — fully analyzed; verdict is safe for workflow/governance tools
- AppSumo strategy — analyzed; revenue dropped 50%, use for distribution not revenue

Competitive landscape:
- Cursor growth mechanics (3 triggers: Tab March 2024, Composer mid-2024, Agent mode late 2024) — documented
- Devin pricing collapse ($500→$20, 96% cut, trust-not-evidence root cause) — documented
- Cline growth mechanics (BYOK, BYOM, Cursor BYOK restriction trigger) — documented
- Lovable viral loop ("Launched" showcase + "Edit with Lovable" CTA) — documented
- CodeRabbit PR comment loop (0→$40M ARR, 2M repos) — documented
- Qodo market position (inside PR/review cycle, not orchestration layer) — documented
- Microsoft Agent Governance Toolkit (security/policy enforcement, NOT quality lifecycle management) — documented

Harness patterns:
- All 10 game-changers from 11 harness repos — documented with file:line citations
- 10 table-stakes features (SKILL.md format, AGENTS.md, keyword routing, runtime hooks, git trailers, deslop pass, deliverables gate, per-agent tool disallow, prompt cache boundary, plan-mode guard) — documented
- 10 anti-patterns to never build (persona-stuffing, 16-commandment list, pseudocode rituals, BSL/SSPL, execution pricing, crippled core, etc.) — documented

Buyer psychology:
- Engineering manager as champion (not economic buyer above $50K/yr) — documented with Snyk parallel
- Top 5 purchase triggers in priority order — documented
- ROI formulas per buyer level (EM, VP Eng, CTO, CISO, CFO) — documented
- Churn reasons and mitigations — documented

Distribution:
- 90-day concrete playbook (HN → Reddit → Twitter build-in-public → GitHub Marketplace) — documented
- Milestone model with realistic timelines (100 installs wk 1-4, $1K MRR mo 6-12, $10K MRR mo 12-24) — documented
- PR comment as viral loop (Snyk mechanism, CodeRabbit flywheel) — documented
- Paid ads = confirmed waste for dev tools — documented

hima architecture:
- Canonical types (MacroCycle, SubPhase, RiskClass, OperatingMode, GateType) — settled
- Three-file storage model (.planning/state.yaml, current-risk.yaml, run-set.json) — settled
- 7 canonical GateType values — settled
- 8 macro-cycles × 7 subphases = 56 composite states — settled
- Runtime bindings table (Claude Code / Codex / Hermes for all 7 gates) — settled in spec 04
- `packages/core/` source file inventory — documented above; do not re-audit
