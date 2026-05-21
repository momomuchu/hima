---
goal-id: complete-construction-v1
claim-bearing: true
status: ACTIVE
opened: 2026-05-14
closed:
priority: PROJECT-DEFINING (this is the master plan for shipping hima v1.0)
supersedes: docs/goals/LONG-TERM-GOAL.md (this file is its operational expansion; LONG-TERM-GOAL.md remains the acceptance contract; this file is HOW)
governing-principles:
  - docs/goals/README.md §"Saturation-based DONE — the harder bar"
  - docs/conception/05-gates-policy-spec.md §8.4 (Falsifies-If on claim-bearing artifacts)
  - rules-of-three (this file's own discipline — see §3.5 below)
intended-invocation: /goal follow the instructions in docs/goals/COMPLETE-CONSTRUCTION-GOAL.md
---

# COMPLETE CONSTRUCTION GOAL — hima v1.0

> **READ THIS FIRST.** You — a future Claude session, an autopilot loop, or the founder reading after weeks of work — are picking up the hima construction in the middle. This file is the master plan. Every decision sequencing, every cycle's deliverables, every cross-cutting concern, every test session, every excellence-book mapping is documented below. Nothing is left to interpretation. If you find a gap, that gap is a defect of this file — file an amendment via §15.

## 0. Preamble — how this file is meant to be used

### 0.1 What this file is

This is the master plan for shipping **hima v1.0** — the public, MIT-licensed, founding-cohort-launched, multi-runtime-adapter-shipping, evidence-gated, falsifiability-enforcing quality discipline kernel for AI coding agents. It is the bridge between `docs/goals/LONG-TERM-GOAL.md` (what shipping looks like = acceptance criteria) and the daily session work that gets there.

It is operational, not aspirational. Every section either tells a future session what to do next, or it cuts.

### 0.2 What this file is not

- It is **not the vision** — that lives at `docs/vision.md`.
- It is **not the strategy diagnosis** — that lives at `docs/business-model/strategy-diagnosis.md`.
- It is **not the long-term goal** — that lives at `docs/goals/LONG-TERM-GOAL.md`.
- It is **not the current cycle's deliverable** — that lives at `docs/goals/SHORT-TERM-GOAL.md`.
- It is **not a substitute for the conception specs** — `docs/conception/01-state-machine-spec.md` through `10-core-api-spec.md` remain authoritative for runtime architecture.
- It is **not the gates policy** — `docs/conception/05-gates-policy-spec.md` is.

This file is the **operational expansion of the long-term goal**. Where LONG-TERM-GOAL.md says "ship v1.0 by 2026-08-01 with ≥3 adapters in production," this file says "here is the 11-phase sequencing, the 8-cycle arc, the work streams in parallel, the test sessions per runtime, the harvested skills, the recursive excellence-book application, and the per-cycle DONE saturation criteria."

### 0.3 How to use it

**At session start** (per `docs/CLAUDE.md` protocol):
1. Read `docs/vision.md`
2. Read `docs/goals/LONG-TERM-GOAL.md`
3. Read `docs/goals/SHORT-TERM-GOAL.md` (current cycle)
4. **Read this file** — it explains what cycle the short-term goal fits into and what comes next.

**For autopilot driving construction** (via `/goal follow the instructions in docs/goals/COMPLETE-CONSTRUCTION-GOAL.md`):
1. Identify which phase (§6 sequencing) is active per current SHORT-TERM-GOAL.md
2. Within that phase, identify the active work stream (§5)
3. Execute against the deliverables in §11 (per-cycle deliverable map / checklist)
4. Apply saturation discipline (§3.1) — never close a deliverable on numeric thresholds alone
5. When a SHORT-TERM cycle reaches DONE per its own criteria + this file's saturation rule, archive it, instantiate the next per §6 sequencing, repeat

**For human review**:
- §1 is the end state (what done looks like)
- §6 is the path (what order)
- §11 is the checklist (what artifacts must exist)
- §14 is what could kill the plan (Falsifies-If)

### 0.4 Tone

This file is written for a future-you who has lost context. Be assumed to be smart, technical, French/English-bilingual, and impatient. Every section starts with the answer, then justifies. No throat-clearing. No "as you may know." Future-you knows; if you don't, read §0.1-0.3 first.

---

## 1. The end state — what v1.0 actually means

### 1.1 Five concrete acceptance facts

When the following are simultaneously true, hima v1.0 ships:

1. **Public repository released** — `github.com/[user]/hima` set to public, MIT license file present, `npm install -g @hima/cli` works on Linux + macOS + Windows (PowerShell).
2. **3 first-party adapters in production** — Claude Code (`packages/adapter-claude`), Codex (`packages/adapter-codex`), Hermes (`packages/adapter-hermes`) each pass a benchmark test session (per §7 test session protocol) against a real coding task end-to-end.
3. **Runtime state machine actually runs** — the 8-cycle DSM (Discovery → Cadrage → Conception → Build → Validation → Release → Run → Apprentissage) can be driven end-to-end via `harness transition <cycle>`, with DoR/DoD gates evaluating real artifacts and the hash-chained ledger recording every transition.
4. **Founding-cohort sale page live** — at `[domain]/founding`, with Stripe Connect wired, 1000-license cap visible, perpetual v1.x license language matching `docs/business-model/strategy-diagnosis.md` R7 refusal rule.
5. **Excellence-book skill catalog functional** — at minimum 7 books from otherskill (00-idea-pmf, 01-strategy-positioning, 02-analysis-discovery, 03-specification, 04-design-ux-ui, 05-architecture, 07-build, 09-quality-release-run; excluding 06-ai-ml and 08-security per LONG-TERM-GOAL §2 acceptance #5) have at least one skill from each book wired into hima's catalog and invokable from a hima cycle.

### 1.2 Five qualitative tests

In addition to the acceptance facts, the v1.0 must pass these qualitative checks (saturation-based, no numerical threshold):

1. **A naive developer can install and reach first quality-gated commit in <15 minutes.** Source: `docs/business-model/strategy-diagnosis.md` Bet B1 explicit success criterion.
2. **A CISO can read the homepage and trust the EU AI Act compliance claim within 60 seconds.** Source: `docs/business-model/strategy-diagnosis.md` Bet B2 + arXiv 2604.09409 empirical citation.
3. **A community contributor can submit a skill via PR and have it merged + appear in the catalog within 1 week.** Source: `docs/business-model/strategy-diagnosis.md` Bet B7.
4. **A code-reviewer can read any claim-bearing markdown file and find its Falsifies-If block within 30 seconds.** Source: `docs/conception/05-gates-policy-spec.md` §8.4.
5. **A hima cycle (any of the 8) can be executed against a real Claude Code session and produce a hash-chained ledger that an external SIEM can ingest.** Source: pattern #22 in `docs/excellence-application/02-analysis-discovery/swarm/SYNTHESIS.md` §13.6 (wirken port).

```yaml
Falsifies-If:
  kill-condition: 2027-08-01 (= 12 months after target v0.1.0 ship date) passes with ≤3 of the 5 acceptance facts in §1.1 met OR ≤3 of the 5 qualitative tests in §1.2 passing
  checkpoint-date: 2026-08-01 (v0.1.0 milestone — at this date, acceptance fact #1 + #2 minimum must hold; #3 #4 #5 can lag to v0.2.0 within 90 days)
  evidence-anchor: docs/goals/COMPLETE-CONSTRUCTION-GOAL.md § 1.1 Five concrete acceptance facts
  on-fail: re-evaluate LONG-TERM-GOAL.md acceptance criteria; either narrow scope (drop ≥1 of the 5 acceptance facts, document why) or pivot to "best-in-class single-runtime quality kernel for Claude Code" per LONG-TERM-GOAL.md §2 on-fail clause
```

---

## 2. The state of hima TODAY (2026-05-14 evening, post cycle-02-deep)

Honest assessment, no marketing gloss. Sources cited.

### 2.1 What exists and works

- **`packages/core/` substantive implementation**: ~100 TypeScript source files across state-machine / risk-classifier / gates / policy / evidence / storage / install / runtime / services / schemas / catalogs / security / convergence. All have tests. Source: `docs/excellence-application/02-analysis-discovery/swarm/packages-layout-snapshot.md` (captured 2026-05-14).
- **`packages/cli/` skeleton with package.json**. Real CLI work pending.
- **`packages/mcp-server/` exposes the first HIMA governance wrappers and namespace policy**. D-M1 through D-M4 are implemented as core-backed MCP tools: `hima_evaluate_completion`, `hima_classify_risk`, `hima_record_evidence`, and `hima_query_compliance`. D-M5 is implemented in `packages/mcp-server/src/policy/namespace-policy.ts` with fail-closed namespace checks.
- **3 adapter packages have package-level hook config code, system prompts, hook-binding modules, and install-facing modules**: `packages/adapter-claude`, `packages/adapter-codex`, and `packages/adapter-hermes` now expose package-level preview/apply/remove functions, runtime-specific system prompts, typed hook-binding surfaces aligned with runtime profiles, and `@harness/adapter-*/install` package exports used by the CLI. Real-runtime E2E tests remain pending in Stream E/F.
- **10 conception specs at `docs/conception/`** — state-machine, risk-classifier, RMS-sets-schema, runtime-bindings, gates-policy (with §8.4 Falsifies-If rule landed 2026-05-14), skills-catalog, subagents-catalog, planning-state, CLI-commands, core-API.
- **Strategy artifacts**: `docs/business-model/strategy-diagnosis.md` (Rumelt kernel, 7 refusal rules + 7 bets, sharpened by cycle-02-deep), `business-model-proposal.md` (800+L), `verification-*` files.
- **Goal cadence**: `docs/vision.md`, `docs/goals/LONG-TERM-GOAL.md`, `docs/goals/SHORT-TERM-GOAL.md`, `docs/goals/README.md` (with saturation rule, landed 2026-05-14 per user critique).
- **Excellence audit traces**: `docs/excellence-application/02-analysis-discovery/` — 4 D-files + 7 S-files + 6 swarm-deep files + SYNTHESIS.md (21 patterns ranked).

### 2.2 What's broken or missing (remaining credibility gaps)

- **Runtime-blocking DoR/DoD file gap RESOLVED 2026-05-14.** The original DS0/S0 baseline finding was valid, but cycle-02b landed the 16 governance files under `docs/01-governance/` plus transition integration. Cycle-03 transition proof confirms Cadrage -> Conception loads `dod:cadrage:3` and `dor:conception:3`.
- **Conception doc audit failing 0/13.** Per S0 baseline citation of `.planning/loop/audit/full-compliance-audit.md`, none of 13 doc files passes the compliance audit despite the code being substantive. Releasing now exposes "the docs do not match the code" credibility risk.
- **9 hook scripts dormant** in spec but not wired in `packages/core/src/services/handle-hook.ts`. Source: `docs/excellence-application/02-analysis-discovery/swarm/orchestration-methods.md` R3 finding (S6).
- **Hash-chained ledger RESOLVED 2026-05-14 for core runtime state.** `packages/core/src/storage/hash-chained-ledger.ts` and `packages/core/test/hash-chained-ledger.test.ts` landed in cycle-02b; broader release evidence still pending in later streams.
- **Append-only events log RESOLVED 2026-05-14 for core runtime state.** `packages/core/src/storage/events-log.ts` and `packages/core/test/events-log.test.ts` landed in cycle-02b; adapter/runtime parity evidence still pending.
- **AUTO-INVOKE keyword routing code registry RESOLVED 2026-05-14 for the core catalog.** `packages/core/src/catalogs/keyword-registry.ts`, `router-cascade.ts`, and tests landed in cycle-02c; install/runtime exposure remains future D-skills work.
- **`.hima/skills/{name}/SKILL.md` core install/resolution surface RESOLVED 2026-05-14.** `packages/core/src/install/skills-install.ts` and `skill-resolver.ts` implement schema-gated public/user/org/project scope planning and resolution. Runtime adapter exposure remains future Stream D adapter work. Source: SYNTHESIS pattern #16 + HARV-10.
- **SKILL.md frontmatter schema locked in core validation as of 2026-05-14.** `packages/core/src/schemas/skill.schema.ts` validates the locked fields and the D-S1 installer now uses it before write planning. Source: SYNTHESIS pattern #16.
- **Per-runtime system prompt, binding, and install-facing files RESOLVED 2026-05-14 for package/CLI scope.** `packages/adapter-{claude,codex,hermes}/src/system-prompt.md`, `src/hook-bindings.ts`, and `src/install.ts` now exist and are covered by adapter/CLI package tests. Real-runtime E2E sessions remain open. Source: SYNTHESIS pattern #18.
- **Real-runtime session protocol and fixture preparation RESOLVED 2026-05-14 for planning scope.** `docs/excellence-application/05-architecture/stream-e-real-runtime-session-plan.md`, `fixtures/runtime-session/small-feature/`, and `scripts/runtime-session-smoke.mjs` define the cross-runtime smoke protocol and prove local fixture/install/hook dry-run shape. Actual Claude/Codex/Hermes model sessions remain open and require explicit runtime access/cost authorization.
- **Real-runtime smoke preflight RESOLVED 2026-05-14 as blocked evidence.** `docs/excellence-application/05-architecture/stream-e-real-runtime-smoke-results.md` records Claude Code and Codex CLI binaries present, Hermes missing, and all external runtime sessions blocked by missing explicit cost/credential authorization. This is not runtime E2E evidence.
- **Local self-test harness RESOLVED 2026-05-14 for deterministic preflight scope.** `harness self-test` runs local install planning and hook dry-runs for selected runtimes, reports unsupported/degraded hooks, and explicitly reports that no external runtime sessions were launched.
- **Benchmark planning harness RESOLVED 2026-05-14 for dry-run scope.** `harness benchmark plan` emits a SWE-bench Verified dry-run plan with required evidence fields, instance-count bounds, no external launches, and `blocked_until_authorized` status.
- **Benchmark result schema RESOLVED 2026-05-14 for validation scope.** `BenchmarkResultSchema` distinguishes planned/blocked/executed benchmark artifacts and rejects executed results without transcripts, tests, HIMA evidence, overhead, and cost or zero-cost accounting.
- **Benchmark result validation command RESOLVED 2026-05-14.** `harness benchmark validate <file>` validates benchmark result JSON against `BenchmarkResultSchema` without launching external sessions or claiming benchmark execution.
- **Benchmark result fixtures RESOLVED 2026-05-14.** `fixtures/benchmark-results/` contains planned, blocked, valid executed, and invalid fake executed examples; core and CLI tests accept the valid set and reject the fake executed artifact.
- **Benchmark result persistence RESOLVED 2026-05-14 for planned/blocked local artifacts.** `harness benchmark write` writes schema-backed planned or blocked benchmark result JSON under `.planning/benchmarks/` and rejects executed writes. This is not benchmark execution evidence.
- **Compliance pack schema RESOLVED 2026-05-14 for draft/blocked local artifacts.** `CompliancePackSchema`, `harness compliance-pack validate`, and `harness compliance-pack write` define and persist local developer-session evidence-pack artifacts with `claimBoundary: evidence_pack_not_compliance_certification`. This is not Article-level compliance evidence.
- **Compliance pack generation RESOLVED 2026-05-14 for local assembled artifacts.** `harness compliance-pack assemble` verifies required evidence files exist inside the project root before writing assembled compliance packs. This is still not legal compliance certification or SIEM ingest evidence.
- **Benchmark authorization boundary RESOLVED 2026-05-14 for fail-closed execution preflight.** `BenchmarkAuthorizationSchema`, `harness benchmark authorization write/validate`, and `harness benchmark execution-preflight` record blocked/authorized execution state and keep preflight closed when authorization is absent or blocked. This did not authorize or run benchmarks.
- **Cross-validation discipline not encoded in protocol.** Cycle-02 swarm showed 600× star-count divergence + fabricated file:line citation (Agent-Village `src/safety/gate.py` which does not exist) — these structural failures need protocol amendments to `docs/goals/README.md` (see §11 stream B). Source: `docs/excellence-application/02-analysis-discovery/swarm-deep/critic-audit.md`.

### 2.3 What's marketed but unverified

- **3 adapters production-ready**: claimed in proposal §3.2, but only package-level hook config code, system prompts, hook-binding declarations, CLI/package install dispatch, local fixture/install/hook dry-runs, blocked runtime preflight, and local `self-test` dry-runs are tested. Real-runtime executed sessions must still verify production readiness.
- **Multi-runtime portability moat**: REFRAMED per S2 finding — raw multi-runtime is table-stakes (5 competitors per `docs/excellence-application/02-analysis-discovery/competitive-harness-scan.md`); hima's bet is "governance-portable across runtimes" (the policy + ledger travel with the developer). Implementation evidence pending.
- **Compliance artifact generation**: spec exists; runtime emission of "developer-session-level EU AI Act evidence packs" not yet implemented. Per §13.4 of SYNTHESIS, this is what differentiates hima from Microsoft AGT (which produces infra-tier compliance, not session-tier).
- **Founding cohort revenue model**: pricing decided ($249-299 perpetual v1.x), Stripe Connect not wired, landing page not built.

### 2.4 What the cycle-02-deep work fundamentally changed

Three things became permanent project rules as of 2026-05-14:

1. **Saturation > thresholds** for cycle close (`docs/goals/README.md` §"Saturation-based DONE").
2. **Cross-agent reconciliation** required for every swarm wave (pending encoding into README — that's stream B in §11 below).
3. **Falsifies-If file:line citations must resolve to actual content** — the §8.4 rule tightened (pending encoding).

These rules now apply to THIS file's own writing too. Every claim below cites file:line or admits "unverified."

---

## 3. Universal principles — applied to every cycle, every work stream

### 3.1 Saturation-based DONE — the recap

Per `docs/goals/README.md` §"Saturation-based DONE — the harder bar". Every cycle and every deliverable in this file closes ONLY when:

1. **A fresh micro-wave returns ≤20% new material** (the empirical saturation test, run as a deliverable, not a closing ceremony).
2. **A critic / adversarial agent has tried to falsify the cycle's headline findings and failed.**
3. **Deep evidence has replaced surface evidence on the foundational claims** — code-level / file:line / direct-inspection citations on at least 5 of the cited sources.
4. **The findings have been used** — applied to hima docs/code, not just reported.

Numeric thresholds (e.g. "≥80% IMPL coverage", "≥3 adapters shipped") are NECESSARY FLOORS but never sufficient. The saturation test is the ceiling check.

Anti-patterns this rule forbids — quoted verbatim from `docs/goals/README.md`:
- "We hit the ≥50 repos threshold, so we're done." (numeric-threshold trap)
- "The agents returned, so let's synthesize." (deliverable-count trap)
- "The synthesis has 12 sections filled, so it's complete." (structural-completion trap)
- "We found a lot of evidence supporting the claim, so the claim holds." (confirmation-bias trap)
- "The agent said X, so X is established." (source-trust trap)
- "The cycle has been open for a while, ship it." (timeboxing trap)

**Applied to this file's own work**: every phase (§6) closes only when (a) its deliverables exist (necessary), AND (b) a saturation pass finds nothing material to add (sufficient).

### 3.2 Falsifies-If on every claim-bearing artifact

Per `docs/conception/05-gates-policy-spec.md` §8.4. Every claim-bearing markdown file in hima (`docs/business-model/*.md` except research-* and verification-*, `docs/decisions/*.md`, any file with frontmatter `claim-bearing: true`) MUST include a `Falsifies-If:` block with kill-condition + checkpoint-date + evidence-anchor + on-fail.

**Tightening per cycle-02-deep DS1 finding**: the `evidence-anchor` field must resolve to actual content. The cycle-02 swarm fabricated `Agent-Village/src/safety/gate.py` — that fabrication would be blocked under the tightened rule because a `gh api` resolve check would fail.

Enforcement plan (stream B in §11): the post-write `post_tool` gate validates `evidence-anchor` paths after file changes. Mismatch → BLOCKED_POLICY violation `MISSING_FALSIFIES_IF`.

### 3.3 Cross-agent reconciliation (new protocol)

Per cycle-02-deep DS1 finding: when 3 swarm agents in the same wave produced 3 different star counts for `everything-claude-code` (300 vs 140K vs 182K, API-truth 181,809), the SYNTHESIS inherited the inconsistency. **Future swarm waves include a final reconciliation step** where each agent verifies the top 3 entity claims (repo names, star counts, file paths, version numbers) of every other agent in the same wave. Mismatches block close.

To encode in `docs/goals/README.md` as a new section under "Wave protocol." Tracked as deliverable B1 in §11 stream B.

### 3.4 DDD for the state manager — the structural rule

Per user direction: "notre state manager doit être vraiment déjà en DDD déjà." The state manager in `packages/core/src/state-machine/` AND `packages/core/src/services/` MUST be refactored to apply DDD tactical patterns from the otherskill `05-architecture/domain-modeling-ddd-excellence-book`:

- **Bounded contexts**: at minimum, identify Run, Cycle, Gate, Skill, Subagent, Evidence as separate bounded contexts. Each owns its own aggregates and language.
- **Aggregates**: `Run` is the aggregate root for lifecycle transitions and finalization consistency. `Gate`, `Evidence`, and domain-event taxonomy remain separate bounded contexts/services where they cross aggregate boundaries.
- **Value objects**: `RiskClass` (T/L/M/H/C), `SubPhase` (Observer/Define/Design/Execute/Verify/Capitalize/Transmit), `OperatingMode` (bypass/auto/pairing), `GateType` — all immutable, validated at construction.
- **Domain events**: `TransitionRequested`, `TransitionExecuted`, `GateEvaluated`, `EvidenceAdded`, `RunClosed`, `RiskClassPromoted`, `SubagentLaunched`, `SubagentReturned`. Each event-sourced into the append-only `events.jsonl` (stream A5).
- **Repositories**: thin layer between `Run` aggregate and `planning-store.ts`. No business logic.
- **Domain services**: classify-risk, evaluate-gate, evaluate-evidence — these stay as services because they cross aggregate boundaries.
- **Always-valid invariant**: a `Run` cannot transition to `DONE_VERIFIED` without a sufficient `Evidence` set per its `RiskClass`. The invariant is enforced in the aggregate, not in a service.
- **Tell-don't-ask**: `run.transition(targetCycle)` instead of `transitionService.transition(run, targetCycle)`. The aggregate owns its lifecycle.

Application timing: refactor lands in phase 1 (§6.1), AFTER the runtime unblockers in phase 0 (cycle-02b). Refactoring a state machine that can't evaluate gates is the wrong order.

Source-of-truth book: otherskill `05-architecture/domain-modeling-ddd-excellence-book/`.

### 3.5 Rule of Three — for this file's own discipline

Where this file makes a claim that's repeated 3+ times, the claim must be extracted to a single source-of-truth and cross-referenced. Example: "saturation > thresholds" is mentioned in §3.1, §6.X, §9, §11. Source-of-truth = `docs/goals/README.md` §"Saturation-based DONE." This file references; it does not re-define.

### 3.6 Excellence books applied at every cycle (recursive)

Per user direction: "tous les excellence book doivent être utilisés à toutes les étapes de développement, donc à toutes les étapes du cycle de développement, et ces principes de cycle de développement à l'intérieur."

Two layers of recursion:

**Layer 1 — hima's runtime invokes book-skills at each of its 8 cycles.** When a hima user runs `harness transition discovery → cadrage`, the runtime invokes the otherskill skills mapped to cadrage (positioning-messaging-category, product-strategy, specification-requirements). The user gets book-level discipline applied to their work, automatically.

**Layer 2 — building hima itself follows the same recursion.** When the founder (or autopilot) develops hima's cycle-04 Build stream, the relevant excellence-book skills (07-build/code-quality + 07-build/testing + 07-build/error-handling) are invoked. The product is its own first user.

Detailed mapping in §4.

### 3.7 Skills + hooks + MCP — the orchestration trinity

Per user direction: "le principe déjà, c'est vraiment bien gérer les skills, les hooks, le MCP serveur."

- **Skills** = the unit of behavioral guidance the model receives. SKILL.md files with locked frontmatter (per SYNTHESIS pattern #16). Auto-detected by hima's keyword registry (per SYNTHESIS pattern #13). Skills are content; they do not enforce.
- **Hooks** = the unit of runtime enforcement. PreToolUse, UserPromptSubmit, SessionStart, SubagentStop, Stop — each a deterministic gate that BLOCKS or WARNS. Hooks are the only thing that actually works for non-functional discipline (per arXiv 2604.09409 empirical evidence).
- **MCP server** = the external API surface. Tools exposed: `hima_evaluate_completion`, `hima_classify_risk`, `hima_record_evidence`, `hima_query_compliance`. Allows non-hima coding agents to call hima's primitives as services. Grows the ecosystem without forcing full harness adoption.

The trinity is co-designed. A skill suggests; a hook enforces; the MCP server exposes. Refactor stream C in §11 applies all three layers together.

---

## 4. The 8-cycle development arc — what hima builds, when

This section maps each of hima's 8 runtime cycles to (a) the excellence books that apply at that cycle, (b) the deliverables hima needs at that cycle, (c) the harvested skills from surveyed harnesses that contribute to it.

The hima cycles are not phases of this file's sequencing (those are §6). They are the runtime's lifecycle stages — when a hima user runs `harness transition`, these are what they transition between.

### 4.1 Cycle 01 — Discovery

**What this cycle is**: the runtime's first stage. The user is exploring a problem space, identifying constraints, surfacing risks. Output = a Discovery Note that informs Cadrage.

**Excellence books mapped to it (otherskill paths)**:
- `02-analysis-discovery/technical-analysis-discovery-excellence-book/` — primary. Sub-stages applied:
  - `01-intake-and-scope/` — scope the work
  - `02-program-comprehension-and-code-reading/` — understand the codebase
  - `03-change-impact-and-blast-radius/` — what blows up if I touch this?
  - `04-dependency-api-evaluation/` — third-party scan (the method DS3 added back via BI-02)
  - `09-root-cause-analysis-for-fixes/` — if Discovery is for a bug, RCA before code
- `00-idea-pmf/` — if Discovery is for a new feature, idea-validation steps apply
- `01-strategy-positioning/product-strategy-excellence-book/` — if Discovery is for a new product surface, strategic-fit check

**hima deliverables for cycle 01**:
- Discovery Note (markdown file in `.hima/state/discovery/<run-id>.md`) with frontmatter + sections per the book chapters
- Risk classification (T/L/M/H/C) preliminary
- Falsifies-If block on every conclusion

**Test session**:
- Run `harness transition discovery` against a real Claude Code session
- Verify Discovery Note is generated, frontmatter-validates, ledger captures the transition event

**Harvested skills for this cycle**:
- From OMC: `session-start` skill (pre-fetches git status, last 3 ADRs, FEATURES.json IN_PROGRESS row) — pattern #6 in `research-harness-extraction.md` MO #10
- From OpenHands: `discovery-validate` analog with `requires_tools` conditional activation — research-harness-extraction.md game-changer #7
- From `02-analysis-discovery/technical-analysis-discovery-excellence-book/` directly: ~6-8 skills extracted via the otherskill `excellence-to-skills` pipeline

### 4.2 Cycle 02 — Cadrage

**What this cycle is**: the runtime's framing stage. The Discovery Note is turned into a Definition of Ready — clear scope, clear acceptance criteria, clear non-goals. Output = DoR signed.

**Excellence books mapped to it**:
- `01-strategy-positioning/positioning-messaging-category-excellence-book/` — for any change that affects positioning (which is most features in a product)
- `01-strategy-positioning/product-strategy-excellence-book/` — applies the Rumelt kernel (diagnosis + guiding policy + coherent actions) at the feature scale
- `01-strategy-positioning/product-goal-sprint-alignment-excellence-book/` — feature-to-sprint mapping
- `03-specification/specification-requirements-excellence-book/` — translate user intent into testable requirements
- `03-specification/spec-driven-development-excellence-book/` — the workflow around the spec

**hima deliverables for cycle 02**:
- Cadrage Note (`.hima/state/cadrage/<run-id>.md`) with definition of ready, scope statement, non-goals, acceptance criteria
- DoR file referenced from `docs/01-governance/dor-02-cadrage.md` (landed in cycle-02b)
- Risk class confirmed (T/L/M/H/C)

**Test session**:
- Discovery → Cadrage transition with DoR evaluation passing/failing as expected

**Harvested skills**:
- From OpenHands/HARV-10 source correction 2026-05-14: current OpenHands loads five skill sources (sandbox/public/user/org/project); HIMA keeps the durable public/user/project/org install scopes and excludes sandbox runtime context — research-harness-extraction.md MO-1
- From `01-strategy-positioning/` excellence books: ~10 skills via pipeline

### 4.3 Cycle 03 — Conception

**What this cycle is**: the runtime's design stage. Cadrage Note + DoR → architecture + design + technical spec. Output = ADR + design doc + interface spec.

**Excellence books mapped to it**:
- `03-specification/spec-driven-development-excellence-book/` — workflow continues
- `03-specification/schema-driven-development-excellence-book/` — if the change involves schemas, contracts, APIs
- `04-design-ux-ui/ui-knowledge-excellence-book/` — UI-touching changes
- `04-design-ux-ui/ux-research-product-experience-excellence-book/` — UX-touching changes
- `05-architecture/architecture-system-design-excellence-book/` — for architectural changes
- `05-architecture/domain-modeling-ddd-excellence-book/` — domain-driven design (THIS IS ALSO USED IN §3.4 FOR HIMA'S OWN STATE-MANAGER REFACTOR)
- `05-architecture/api-design-excellence-book/` — for API surface changes
- `05-architecture/database-storage-performance-excellence-book/` — for data-layer changes
- `05-architecture/cloud-platform-infrastructure-excellence-book/` — for infra changes

**hima deliverables for cycle 03**:
- ADR (`.hima/state/conception/<run-id>-adr.md`) with decision + rationale + alternatives + Falsifies-If
- Technical spec referencing the relevant `docs/conception/0X-*.md` spec for the harness component being changed
- Threat model (STRIDE) for H/C class changes per `docs/conception/05-gates-policy-spec.md` §8.1

**Test session**:
- Cadrage → Conception transition with ADR file evidence-anchor resolution check passing

**Harvested skills**:
- From hermes-agent: `conditional-activation` pattern — only show DDD-relevant prompts when domain modeling is implicated
- From `05-architecture/` excellence books: ~30 skills via pipeline (this is a big bucket)

### 4.4 Cycle 04 — Build

**What this cycle is**: the runtime's implementation stage. Conception artifacts → working code. Output = code + unit tests + integration tests, all green.

**Excellence books mapped to it**:
- `07-build/code-quality-maintainability-excellence-book/`
- `07-build/refactoring-excellence-book/` — for refactors specifically
- `07-build/performance-engineering-excellence-book/` — for perf-touching changes
- `07-build/error-handling-resilience-excellence-book/`
- `07-build/concurrency-distributed-correctness-excellence-book/` — for concurrent code
- `07-build/observability-excellence-book/` — for observability instrumentation
- `07-build/testing-excellence-book/` — test pyramid + mutation + property-based

**hima deliverables for cycle 04**:
- Code commits with Tidy First S/B discipline (per `rules/core.md §4` — every commit is Structural OR Behavioral, never mixed)
- Unit + integration tests green
- Pre-fix RCA + local-vs-systemic scope declaration (the cycle-02-deep gap from `gaps-technical-analysis-discovery.md`)
- For C/H risk: SAST + DAST + threat model artifact + canary plan

**Test session**:
- Conception → Build transition; user actually writes code with hima governing each tool call via `pre_tool` hook
- Evidence collected: diff size, files touched, write-zone compliance per phase

**Harvested skills**:
- From OMC: `ai-slop-cleaner` skill — mandatory deslop pass after critic APPROVED (table-stakes per `research-harness-extraction.md` TS-6). **User explicitly mentioned harvesting this.**
- From goose: SmartApprove LLM-per-call permission classifier (DS2 code-verified) — research-harness-extraction.md game-changer #9
- From `07-build/` excellence books: ~40 skills via pipeline

### 4.5 Cycle 05 — Validation

**What this cycle is**: the runtime's verification stage. Build output → evidence that the work is correct. Output = Evidence Set sufficient for the Risk Class.

**Excellence books mapped to it**:
- `09-quality-release-run/quality-engineering-excellence-book/`
- `07-build/testing-excellence-book/` (continues from Build)
- `14-legal-compliance-risk-excellence-book/` — for compliance-touching changes (subset relevant to v1, full skip per LONG-TERM-GOAL §3 out-of-scope)

**hima deliverables for cycle 05**:
- Evidence Set complete per the risk class (see `docs/conception/05-gates-policy-spec.md` §8.1 matrix)
- For H/C: AIPD/DPIA + DAST report + threat model signed
- DoD signed in `.hima/state/validation/<run-id>-dod.md`

**Test session**:
- Build → Validation transition; `stop` gate evaluates Evidence Set, returns allow/block/warn

**Harvested skills**:
- From OMC: `verify-deliverables.mjs` pattern as a SubagentStop blocking gate (SYNTHESIS pattern #15)
- From `09-quality-release-run/quality-engineering-excellence-book/`: ~15 skills via pipeline

### 4.6 Cycle 06 — Release

**What this cycle is**: the runtime's deployment stage. Validated artifact → production. Output = deployed binary/artifact with rollback plan tested.

**Excellence books mapped to it**:
- `09-quality-release-run/production-reliability-devops-excellence-book/`
- `09-quality-release-run/software-delivery-governance-excellence-book/`

**hima deliverables for cycle 06**:
- Release plan (`.hima/state/release/<run-id>.md`) with canary stages, feature flag config, rollback plan
- For H/C: canary stages explicit (5%→25%→50%→100% per §4 of gates spec)
- SBOM generated + SLSA provenance + cosign signature

**Test session**:
- Validation → Release transition; hash-chained ledger records the deploy event

**Harvested skills**:
- From `09-quality-release-run/` excellence books: ~20 skills via pipeline
- SLSA + cosign integration patterns from open-source CI examples

### 4.7 Cycle 07 — Run

**What this cycle is**: the runtime's operational stage. Deployed → monitored, alerts triaged, runbooks executed.

**Excellence books mapped to it**:
- `09-quality-release-run/production-reliability-devops-excellence-book/` (continues)
- `12-measurement/metrics-analytics-data-excellence-book/`
- `10-growth/` (post-launch acquisition)
- `11-sales-cs-retention/` (post-sale)

**hima deliverables for cycle 07**:
- SLI/SLO tracked + error budget + multi-window multi-burn-rate alerts (per `07-build/observability-excellence-book/`)
- Runbooks executed on incident
- Compliance artifact generated nightly

**Test session**:
- Release → Run transition; observability harness collects metrics

**Harvested skills**:
- From `12-measurement/` excellence books: instrumentation skills
- From `10-growth/` excellence books: acquisition-channel skills (relevant post-v1.0)

### 4.8 Cycle 08 — Apprentissage

**What this cycle is**: the runtime's learning stage. Run data + retros → systemic improvements. Output = post-mortems + ADR amendments + new skills.

**Excellence books mapped to it**:
- `12-measurement/metrics-analytics-data-excellence-book/` (continues)
- `09-quality-release-run/quality-engineering-excellence-book/` (post-mortem chapter)
- Self-improvement protocols (any retrospective book in otherskill)

**hima deliverables for cycle 08**:
- Post-mortem doc for any incidents (`.hima/state/apprentissage/<run-id>-postmortem.md`)
- New skills authored from lessons learned (the discipline-flywheel)
- ADR amendments for systemic decisions

**Test session**:
- Run → Apprentissage transition; learning artifact generated; saturation check on lessons

**Harvested skills**:
- Self-improvement / retro skills from `12-measurement/`
- Memory-consolidation patterns from MemoryBank AAAI 2024 / CoALA TMLR 2024 (referenced in user's global agents.md but not in hima's spec — explicit research needed)

---

## 5. Cross-cutting work streams (parallel-able where possible)

These are the actual work streams hima needs to complete. Each stream is sequenced through the phases in §6 and has its own DONE saturation criteria.

### Stream A — Runtime unblockers (cycle-02b — phase 0, CRITICAL, blocks everything else)

Already specified in `docs/goals/SHORT-TERM-GOAL.md` cycle-02b. Restated here for completeness:

- **A1**: 16 DoR/DoD files at `docs/01-governance/dor-{cycle}.md` × 8 + `dod-{cycle}.md` × 8 + template
- **A2**: `packages/core/src/governance/load-dor-dod.ts` + transition.ts integration
- **A3**: tests for A2 in `packages/core/test/`
- **A4**: hash-chained ledger ported from `gebruder/wirken` → `packages/core/src/storage/hash-chained-ledger.ts`
- **A5**: append-only events.jsonl ported from OMX `session-history.jsonl` (NOT 12-factor-agents — that's prose-only) → `packages/core/src/storage/events-log.ts`

DONE when: A1+A2+A3 minimum (A4+A5 may slip with documented reason). `harness transition discovery → cadrage` runs end-to-end without DoR-file-missing errors.

### Stream B — Protocol amendments (phase 0, parallel with A)

- **B1**: `docs/goals/README.md` += "Wave protocol — cross-agent reconciliation" section. Every swarm wave ends with reconciliation step where each agent verifies top-3 entity claims of every other agent.
- **B2**: `docs/conception/05-gates-policy-spec.md` §8.4 += tightening rule: evidence-anchor must resolve. The gate validator does syntactic path resolve check post-write.
- **B3**: `docs/goals/README.md` += "Vocabulary diversification" section. Before topical research scans, enumerate ≥3 competing paradigm vocabularies. Each gets ≥1 dedicated scan agent.

DONE when: all 3 README sections exist + the next swarm wave actually uses them.

### Stream C — State manager DDD refactor (phase 1, after A unblocks runtime)

- **C1**: bounded contexts identified for `packages/core/`: Run, Cycle, Gate, Skill, Subagent, Evidence
- **C2**: aggregate `Run` is the root for transition orchestration; `requestTransition` delegates to `RunAggregate.transition`, while Cycle-owned code retains transition target resolution, transition validity, and DoR/DoD governance. C2a facade slice and C2b boundary cleanup are complete.
- **C3**: value objects: `RiskClass`, `SubPhase`, `OperatingMode`, `GateType` all immutable + validated at construction
- **C4**: domain events emitted into events.jsonl (depends on A5), including persisted `RiskClassPromoted` emission for the existing `enterDevelopment` project-root risk-promotion path.
- **C5**: repositories as thin adapters over `planning-store.ts`
- **C6**: always-valid invariant enforced inside `Run` aggregate, not in service layer
- **C7**: tests refactored to match — assert via aggregate behavior, not service calls

Apply otherskill `05-architecture/domain-modeling-ddd-excellence-book/` end-to-end.

DONE when: code review passes a DDD discipline check (saturation: a critic agent applies the book's checklist + finds zero structural violations).

### Stream D — Skills / hooks / MCP architecture (phase 2)

Three sub-streams co-designed:

#### D-skills — skill discovery + locked frontmatter + execution surface

- **D-S1**: `.hima/skills/{name}/SKILL.md` install convention. `packages/core/src/install/skills-install.ts` writes to public + user-home + project-local + org-shared durable scopes. Source correction 2026-05-14: current OpenHands docs describe five load sources including sandbox; HIMA implements the four persistent install scopes and excludes sandbox as non-durable runtime context.
- **D-S2**: locked frontmatter schema per SYNTHESIS pattern #16 — `name`, `version`, `type: task|knowledge`, `triggers[]`, `expected_outputs[]`, `requires_tools[]`, `fallback_for_toolsets[]`, `description`
- **D-S3**: Zod schema in `packages/core/src/schemas/skill.schema.ts` validating frontmatter at parse time
- **D-S4**: keyword registry per SYNTHESIS pattern #13 — typed flat array in `packages/core/src/catalogs/keyword-registry.ts`, code-side testable
- **D-S5**: 4-tier cascade router per SYNTHESIS pattern #2 (regex → state → keyword → LLM) saving ~500 tokens per request

#### D-hooks — wire the 9 dormant hooks + decompose monolithic

- **D-H1**: DONE 2026-05-14 — PreToolUse hook wired in `packages/core/src/services/handle-hook.ts`; adapter-style payload fields normalize to canonical `pre_tool`, missing planning state fails closed, write-zone enforcement blocks/warns by risk class, tool-input write intent, HTTP write methods, capability arrays, and create-style tool names are detected, dot-segment write-zone escapes and allowed-prefix symlink/junction escapes are canonicalized before policy matching, secrets are redacted before persistence, and dry-run does not append hook events.
- **D-H2**: DONE 2026-05-14 — SubagentStop hook wired as blocking deliverables gate per SYNTHESIS pattern #15 (port OMC verify-deliverables.mjs pattern)
- **D-H3**: DONE 2026-05-14 — SessionStart hook normalizes adapter payload fields, validates planning route consistency, injects route/risk/gate context, best-effort pre-fetches git status, latest 3 ADRs, and `FEATURES.json` IN_PROGRESS entries, and redacts returned context-injection strings.
- **D-H4**: DONE 2026-05-14 — PreCompact/PostCompact hooks added as first-class canonical gates with runtime profile/spec sync; payload normalization covers compact metadata, missing planning state fails closed, PreCompact returns redacted context, PostCompact blocks M+ route-continuity mismatch, and dry-run does not append hook events.
- **D-H5**: DONE 2026-05-14 — Stop and UserPromptSubmit hooks normalize adapter payload fields, block governed bypass prompt variants by risk class, redact prompt previews before persistence, enforce M+ runtime-binding availability, enforce evidence sufficiency before DONE_VERIFIED, and return a specific H/C human-validation blocker when that evidence is the remaining gap.
- **D-H6**: DONE 2026-05-14 — hook decomposition extracted `packages/core/src/hooks/hook-payload.ts` and `packages/core/src/hooks/subagent-launch-record.ts` from the monolithic hook service without changing gate decisions, redaction, dry-run, or accepted-evidence behavior.
- **D-H7**: DONE for local hard-limits boundary/code-module scope — Cycle 67 selected blocked-command enforcement for normalized PreToolUse shell payloads, and Cycle 77 added a 15-active-subagent spawn cap for persisted `runSet.subagents[]`. NOTE: SYNTHESIS pattern #3 was FALSIFIED (Agent-Village `src/safety/gate.py` does not exist). Token-budget ceilings, inherited subagent tool-deny projection, and real runtime adapter enforcement remain future/runtime-bound concerns, not part of this local D-H7 closure.

#### D-mcp — externally-callable governance tools

- **D-M1**: DONE 2026-05-14 — `hima_evaluate_completion` exposed through `packages/mcp-server/src/index.ts` as a non-mutating evidence-sufficiency + convergence verdict.
- **D-M2**: DONE 2026-05-14 — `hima_classify_risk` exposed through `packages/mcp-server/src/index.ts` as a compatibility wrapper over `classifyRisk()`.
- **D-M3**: DONE 2026-05-14 — `hima_record_evidence` exposed through `packages/mcp-server/src/index.ts` as a governed evidence-write wrapper with root confinement, canonical validation, agent source attribution, and secret redaction before persistence.
- **D-M4**: DONE 2026-05-14 — `hima_query_compliance` exposed through `packages/mcp-server/src/index.ts` as a read-side current-run compliance and ledger-health query.
- **D-M5**: DONE 2026-05-14 — `packages/mcp-server/src/policy/namespace-policy.ts` names the owned `rms` namespace plus `hima_governance` and `harness_compatibility` compatibility units; `tools/call` rejects unknown namespaces and alias-shaped bypasses before dispatch.

DONE floor for D-M1 through D-M5: a non-hima coding agent can call the named HIMA MCP wrappers and receive valid core-backed verdicts or writes, while MCP tool names stay inside the executable namespace policy. Broader five-client compatibility remains future compatibility-matrix work.

### Stream E — Adapter packages (phase 3)

Three first-party adapters, one per first-party runtime per `docs/business-model/strategy-diagnosis.md` Bet B1:

- **Cycle-24 package hardening baseline**: `packages/adapter-claude`, `packages/adapter-codex`,
  and `packages/adapter-hermes` have tested preview/apply/remove lifecycle functions aligned with
  `packages/core/src/runtime/runtime-profiles.ts`. This is not production E2E readiness.
- **Cycle-27 production foundation**: all three adapters now have package-local `system-prompt.md`
  files and profile-backed `hook-bindings.ts` modules. Tests prove prompt boundaries, runtime-profile
  alignment, and unsupported/degraded hook truth. This is still not install command completion or
  real-runtime E2E readiness.
- **Cycle-28 install wiring**: all three adapters now expose `src/install.ts` through
  `@harness/adapter-*/install`, and the CLI dispatches install apply/remove through those modules.
  This is still not real-runtime E2E readiness.
- **E-claude**: `packages/adapter-claude/src/`:
  - `system-prompt.md` (per SYNTHESIS pattern #18 — per-runtime anti-bypass clauses, opencode 9-file pattern adapted to 3)
  - hook bindings: Claude Code `PreToolUse` / `SubagentStart` / `SubagentStop` / `Stop` events forwarded to hima `pre_tool` / `subagent_start` / `subagent_stop` / `stop` gates
  - skill exposure: `~/.claude/skills/` mirror of `~/.hima/skills/`
  - install module: `@harness/adapter-claude/install`, used by `harness install claude`
- **E-codex**: `packages/adapter-codex/src/` — same shape with Codex CLI primitives
- **E-hermes**: `packages/adapter-hermes/src/` — same shape with Hermes ACP plugin hooks

Per SYNTHESIS pattern #5: adapter is a directory the target tool discovers natively, not a CLI flag. ECC `adapter.js` exit-code-2 cross-harness blocking is the reference for cross-tool propagation.

DONE per adapter: an end-to-end test session (§7) runs against that runtime + ledger captures every transition + state machine completes a full 8-cycle pass.

### Stream F — Test sessions (phase 4, after E)

Per user direction: "tu vas lancer des sessions de test, genre Hermes, Codex." End-to-end test runs against each first-party runtime, plus a regression suite hima invokes itself.

- **F1**: golden-path test scenarios (3-5 scenarios per runtime — small feature, refactor, bug fix, RCA-driven fix, compliance-touching change)
- **F2**: benchmark suite — SWE-bench Verified subset (10-20 instances), each run with and without hima governance enabled, measure (a) success rate, (b) gate-block rate (catching mistakes), (c) wall-clock overhead
- **F3**: per-runtime parity check — same scenario on Claude / Codex / Hermes should produce equivalent ledger structure (governance-portable across runtimes claim verification)
- **F4**: stress test on the state machine — 100 concurrent runs, file-lock contention check (atomic-write.ts + file-lock.ts paths)
- **F5**: compliance artifact generation test — generate a developer-session EU AI Act evidence pack from a real run, verify it includes Article 9/12/14/15 mapping data

DONE when: F1-F5 all pass on all 3 runtimes (saturation: a fresh re-run of the same suite finds no flakes + critic verifies the test reports themselves are not fabricating).

### Stream G — Excellence book application + skill harvesting (phase 5, parallel with F)

Two coupled tracks:

#### G-apply — apply otherskill books to hima's runtime per cycle map (§4)

For each of the 7 in-scope books (00-idea-pmf, 01-strategy-positioning, 02-analysis-discovery, 03-specification, 04-design-ux-ui, 05-architecture, 07-build, 09-quality-release-run):

- Pull skills generated by otherskill's `excellence-to-skills` pipeline (`otherskill/dist/excellence-to-skills/plugin/skills/`)
- Adapt frontmatter to hima's locked schema (D-S2)
- Install to `~/.hima/skills/{book}/{skill}/SKILL.md`
- Wire each skill to the appropriate hima cycle per §4 mapping
- Test invocation: when `harness transition discovery → cadrage` fires, the relevant book skills are surfaced

DONE per book: at minimum 5 skills from the book are installed + invokable + at least 1 has actually been used in a hima dogfood session.

#### G-harvest — harvest specific skills from surveyed harnesses

Concrete skills the user mentioned + skills from SYNTHESIS that are high-leverage:

- **G-H1 ai-slop-cleaner** (from OMC) — mandatory deslop pass after critic APPROVED. User explicitly mentioned this. Source: research-harness-extraction.md TS-6. Path target: `~/.hima/skills/quality/ai-slop-cleaner/SKILL.md`
- **G-H2 agnix-style config linting** (from agnix, S1) — 423-rule pre-runtime config validator. Target: `packages/core/src/install/skill-lint.ts` + CI hook
- **G-H3 OMX keyword-registry** (DS2 code-verified) — already part of D-S4
- **G-H4 OMX mode state-machine** (DS2 surprise finding) — port `workflow-transition.ts` PLANNING_LIKE_MODES / EXECUTION_LIKE_MODES / 10 AUTO_COMPLETE_TRANSITIONS into hima's XState
- **G-H5 wirken hash-chain** (already A4)
- **G-H6 auto-harness 3-step evidence gate** (S7) — eval suite + held-out split + suite promotion. Extend `packages/core/src/evidence/evaluate-evidence.ts`
- **G-H7 spec-kit CP-SAT DAG scheduling** (S7, 98.9k⭐) — for the cycle scheduler. DEFERRED to v2 unless solo-bandwidth allows
- **G-H8 typed-handoff** (12-factor-agents concept, code from goose) — request_human_input as structured tool with {urgency, format, choices, threadId} → handoffs.jsonl. Game-changer #4 in research-harness-extraction.md
- **G-H9 prompt-injection scanner on context files** (hermes-agent) — 10 regex threat patterns + 10 invisible-unicode chars. Game-changer #5. Path: `packages/core/src/security/prompt-injection-scan.ts`
- **G-H10 durable skill scope** (OpenHands source correction) — OpenHands loads sandbox/public/user/org/project; HIMA adopts durable public/user/project/org install scopes and excludes sandbox runtime context. Game-changer #1. Embedded in D-S1

DONE: 10/10 harvested + each has a SKILL.md + each has at least one test demonstrating it works in a hima session.

### Stream H — Pre-release polish + beta cohort (phase 6)

- **H1**: documentation pass — every conception spec referenced from this file is read-end-to-end by a fresh agent + amended for any drift between spec and code
- **H2**: API stability check — `packages/core/src/index.ts` exported surface is reviewed; anything labelled "internal" stays out of the public type declarations
- **H3**: SDK + CLI installation tested on Linux + macOS + Windows (PowerShell)
- **H4**: claims register written (`docs/business-model/claims-register.csv`) — every comparative claim tagged T1/T2/T3/T4 substantiation tier with source + falsifier + owner + expiry. Per cycle-02 §3 pattern #6 (originally identified, never executed)
- **H5**: ICP worksheet written (`docs/business-model/icp-worksheet.md`) — pattern #5 in original cycle-02 §3
- **H6**: message hierarchy written (`docs/business-model/message-hierarchy.md`) — pattern #4 in original cycle-02 §3. LEAD WITH the 67% NL-ignore arXiv 2604.09409 finding per §2.4 of the user's review
- **H7**: north-star metric defined (`docs/business-model/north-star-metric.md`) — pattern #3 in original cycle-02 §3
- **H8**: 10-user closed beta — recruited from Claude Code Discord + r/devops + HN posts. Each beta user installs hima, runs through 3 scenarios from F1, fills out a saturation survey

DONE: 8/8 done + the beta survey reports ≥6 of 10 beta users completed all 3 scenarios + at least 3 of them said "I'd pay $249-299 for this"

### Stream I — v1.0 release (phase 7, terminal)

- **I1**: GitHub repo visibility flipped to public
- **I2**: v1.0.0 tagged on main; release notes published
- **I3**: `@hima/cli` published to npm
- **I4**: founding-cohort sale page opens at `[domain]/founding`
- **I5**: Show HN + dev.to + relevant subreddits posted (per `business-model-proposal.md` §7.1 Phase 1 founder distribution)
- **I6**: opening status snapshot in `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md` capturing every metric at T=0 for future Apprentissage cycles

DONE: v1.0.0 npm registry lookup returns the package + the founding sale page accepts a real test transaction + the first external `harness init` run on a fresh machine completes successfully.

---

## 6. Sequencing — the 8 phases

Each phase has prerequisites + parallelisms + DONE criteria. Phases are NOT mutually exclusive — within a phase, streams run parallel where dependency allows.

### Phase 0 — runtime unblock + protocol fix (cycle-02b, DONE 2026-05-14)

**Streams**: A + B
**Parallel**: yes (A and B touch different files)
**Prerequisites**: none (this is the unblocker for everything else)
**Estimated effort**: 14-20h
**DONE**: stream A DONE + stream B DONE per their own criteria. State machine can transition. Cycle-03 proof confirmed Cadrage -> Conception governance loading on a temporary fixture.

### Phase 1 — state manager DDD refactor

**Streams**: C
**Parallel**: yes within C (C1+C2+C3 in parallel; C4 after A5; C5+C6+C7 after C2)
**Prerequisites**: A1+A2+A3 (state machine must actually work first)
**Estimated effort**: 20-30h
**DONE**: code review by a critic agent passes the DDD discipline check

### Phase 2 — skills/hooks/MCP architecture

**Streams**: D
**Parallel**: yes — D-skills, D-hooks, D-mcp are co-designed but can be built in parallel after their schemas converge
**Prerequisites**: A (state machine) + C (DDD aggregate structure for the install pipeline)
**Estimated effort**: 30-40h
**DONE**: 9 dormant hooks wired + MCP server exposes 4 HIMA governance tools with namespace policy + skill catalog discovers `.hima/skills/{name}/SKILL.md`

### Phase 3 — adapter packages

**Streams**: E
**Parallel**: yes (3 adapters can be built simultaneously by different sessions/teams)
**Prerequisites**: D (hooks must exist for adapters to bind to)
**Estimated effort**: 15-25h per adapter × 3 = 45-75h total
**DONE**: each adapter passes its integration tests on its target runtime

### Phase 4 — test sessions

**Streams**: F
**Parallel**: yes (test scenarios run independently)
**Prerequisites**: E (adapters must work)
**Estimated effort**: 20-30h
**DONE**: F1-F5 green on all 3 runtimes; SWE-bench subset run reports hima-with-governance improves correctness ≥X% (X TBD by F2 baseline)

### Phase 5 — excellence book application + skill harvesting

**Streams**: G
**Parallel**: yes (G-apply and G-harvest run in parallel; within G-apply, books are independent)
**Prerequisites**: D (skill catalog must exist), partial E (adapters needed for test invocation)
**Estimated effort**: 40-60h
**DONE**: 7 books each have ≥5 skills installed + 10/10 harvested skills in place

### Phase 6 — pre-release polish + beta

**Streams**: H
**Parallel**: yes (H1-H8 are independent except H8 needs H1-H3 first)
**Prerequisites**: phases 0-5 substantially complete; ≥80% of stream G done
**Estimated effort**: 30-50h + 2-4 weeks beta calendar time
**DONE**: per H stream DONE criteria

### Phase 7 — v1.0 release

**Streams**: I
**Parallel**: no (release is sequential by nature)
**Prerequisites**: phase 6 DONE
**Estimated effort**: 10-15h compressed into a release day
**DONE**: I1-I6 complete + first external install verified

### Total estimated effort

Sum of bounds: low ~165h, high ~245h. At full-time solo pace (8h/day), that's ~3-4 weeks of pure focused work. Realistic for solo with day-job: 8-16 weeks. Target v0.1.0 ship 2026-08-01 = 79 days from 2026-05-14 = 11 weeks. **Tight but feasible if discipline holds and no major architectural surprises emerge.**

If solo bandwidth is the constraint, the cut-line in priority order is: keep phases 0+1+2+3+4 minimum, defer phase 5 G-apply to v1.1, ship v1.0 with only the harvested skills (G-harvest) wired in.

---

## 7. Test session protocol — what an end-to-end run looks like

The user's direction: "tu vas lancer des sessions de test, genre Hermes, essaye de tester hermes codex." Concrete protocol below.

### 7.1 Per-runtime golden-path session

For each of {Claude Code, Codex CLI, Hermes}, run the following 5-scenario suite:

1. **Small feature** — add a simple function with tests. Risk class: T or L expected. Validate: hima allows fast-path, no unnecessary gates fire.
2. **Refactor** — rename a class across N files. Risk class: L. Validate: hima recognizes as Structural per Tidy First, doesn't require behavioral gates.
3. **Bug fix with RCA** — fix a bug, but require pre-fix RCA per the cycle-02-deep gap. Risk class: M. Validate: hima blocks the fix until the RCA artifact exists.
4. **Compliance-touching change** — modify code that touches PII handling. Risk class: H. Validate: hima forces threat-modeling + DPIA artifacts + 2-reviewer + canary plan before merge.
5. **Architecture pivot** — refactor that touches ≥3 services. Risk class: C (per force signal `diff touchant ≥ 3 services distincts` in §4.3 of gates spec). Validate: hima requires AIPD + independent security audit + load tests + 2-reviewer-with-signature.

Each scenario produces:
- A ledger entry chain (cycle transitions, gate evaluations, evidence collected)
- A compliance pack (the EU AI Act evidence map per §13.4 of SYNTHESIS)
- A pass/fail verdict per phase

### 7.2 Cross-runtime parity check

Run scenario 1 (small feature) on all 3 runtimes against the same code change. Compare:
- Ledger structure (should be identical except for runtime-specific event names)
- Risk class assigned (should be identical given same diff)
- Gates fired (should be identical given same risk class)
- Evidence collected (should be functionally equivalent)

If any differ, file as a bug in the adapter layer.

### 7.3 SWE-bench Verified benchmark

Select 10-20 SWE-bench Verified instances. For each:
- Run with hima governance disabled — baseline
- Run with hima governance enabled — measure (a) success rate delta, (b) gates that fired and saved a bad commit, (c) wall-clock overhead, (d) tokens spent
- Target: hima governance should NOT degrade success rate by more than 5% AND should catch ≥3/20 cases where the unsupervised agent would have shipped a regression

### 7.4 Compliance artifact generation test

For one H-class run from §7.1, generate the developer-session EU AI Act evidence pack. Verify it contains:
- Risk classification rationale (mapped to AI Act Title III risk tiers)
- Logging chain (per Article 12)
- Human oversight events (per Article 14)
- Accuracy & robustness records (per Article 15)
- Cryptographic provenance (SLSA + cosign + Ed25519 from wirken)

Verify: the pack is structurally valid + an external SIEM (Splunk / Datadog / Sentinel demo instance) can ingest it.

### 7.5 Stress / concurrency test

100 concurrent `harness transition` calls against the same `.planning/run-set.json` file. Verify:
- No data corruption (atomic-write.ts holds)
- File-lock contention is handled (file-lock.ts holds)
- All 100 transitions are recorded in the hash-chained ledger
- Ledger hash chain is valid end-to-end (no tamper, no skip)

### 7.6 Saturation test on the test sessions themselves

Per §3.1 saturation rule: a critic agent reviews the 5 test sessions × 3 runtimes + the benchmark output + the compliance pack + the stress test results, attempts to find a fabricated result or a misreported gate-fire. If the critic finds even 1, the test sessions re-run. Cycle closes only when the critic finds nothing.

---

## 8. Skill harvest list — concrete bring-in from surveyed harnesses

Catalog of skills/patterns to harvest. Each has a source, a target path in hima, an effort estimate, and an acceptance criterion.

| ID | Source | What | hima target | Effort | Acceptance |
|----|--------|------|------------|--------|-----------|
| HARV-01 | OMC `ai-slop-cleaner` | Mandatory deslop pass after critic approval | `~/.hima/skills/quality/ai-slop-cleaner/SKILL.md` + hook wired in `packages/core/src/services/handle-hook.ts` SubagentStop | 3-5h | Skill invokable; SubagentStop blocks if AI slop detected |
| HARV-02 | agnix (S1, 241⭐) | 423-rule silent-failure linting | `packages/core/src/install/skill-lint.ts` + CI hook | 6-8h | 30+ lints implemented + CI fails on misconfigured SKILL.md |
| HARV-03 | OMX `keyword-registry.ts` (DS2 verified) | Typed flat-array keyword routing with priorities | `packages/core/src/catalogs/keyword-registry.ts` (already stream D-S4) | 3-5h | Keywords route to skills pre-LLM, saving tokens |
| HARV-04 | OMX `workflow-transition.ts` (DS2 surprise) | Mode-exclusion graph: PLANNING_LIKE_MODES vs EXECUTION_LIKE_MODES + 10 AUTO_COMPLETE_TRANSITIONS | `packages/core/src/state-machine/mode-exclusion.ts` (NEW) | 3-5h | hima's XState statechart has parallel mode-exclusion guards |
| HARV-05 | gebruder/wirken (S7, 145⭐) | Per-event Ed25519 + SHA-256 hash-chain + SIEM-friendly JSONL | `packages/core/src/storage/hash-chained-ledger.ts` (already stream A4) | 4-6h | Per-run ledger emitted + tamper-detection round-trip test passes |
| HARV-06 | OMX `session-history.jsonl` (DS2 verified) | Append-only event log | `packages/core/src/storage/events-log.ts` (already stream A5) | 3-5h | Events appended on every transition + replay test works |
| HARV-07 | neosigmaai/auto-harness (S7, 502⭐) | 3-step evidence gate: eval suite + held-out split + suite promotion | extend `packages/core/src/evidence/evaluate-evidence.ts` | 6-8h | Layered gates demonstrable in a test session |
| HARV-08 | 12-factor-agents (concept) + goose (code, DS2) | Typed human-handoff: request_human_input{urgency, format, choices, threadId} → handoffs.jsonl | `packages/core/src/services/request-human-input.ts` + `~/.hima/skills/handoff/SKILL.md` | 4-6h | Skill emits typed event + handoffs.jsonl captured + replayable |
| HARV-09 | hermes-agent `prompt_builder.py:36-73` | 10 regex prompt-injection threats + 10 invisible-unicode char detectors | `packages/core/src/security/prompt-injection-scan.ts` + SessionStart hook | 3-5h | Scanner blocks loading of context files containing injection patterns |
| HARV-10 | OpenHands skills docs + agent-server skill API | Source correction 2026-05-14: OpenHands loads sandbox / public / user / org / project; HIMA adopts durable public / user / project / org install scopes and excludes sandbox runtime context | `packages/core/src/install/artifact-paths.ts` (extend) + `packages/core/src/install/skill-resolver.ts` | 5-7h | Org-level skills resolve for all members of an org (test: scoped fixture) |
| HARV-11 | opencode default-deny subagent tools (DS2 verified) | `todowrite` + `task` denied by default on all subagents | `packages/core/src/services/handle-hook.ts` SubagentStart event handler | 2-4h | SubagentStart blocks if subagent requests denied tools |
| HARV-12 | goose `permission_judge.rs` (DS2 verified, source-reviewed in cycle-22) | LLM-per-call permission classifier concept (per-tool, not static tiers) | DEFERRED to adapter/runtime approval layer; not `packages/core/src/security/permission-judge.ts` | (deferred) | Only eligible if a future adapter can prove classifier output is monotonic, non-authoritative, and cannot weaken deterministic core policy |
| HARV-13 | pro-workflow (S1) | PreCompact + PostCompact hook pair for context-window compaction | `packages/core/src/gates/` += new `pre_compact` / `post_compact` GateType + handlers | 3-5h | Hook pair fires on compaction + preserves critical state |
| HARV-14 | github/spec-kit (S7, 98.9k⭐) | CP-SAT DAG precedence scheduling with hallucination-aware caps | DEFERRED to v2 (substantial; out of v1 scope) | (deferred) | (deferred) |
| HARV-15 | EvoMap/evolver (S7, 7.4k⭐) | GEP protocol — typed Genes/Capsules/EvolutionEvents | DEFERRED to v2 (self-improver design relevance, not v1 blocker) | (deferred) | (deferred) |
| HARV-16 | nexus-agents (S1, 13⭐, DS1 partially falsified) | PreferenceRouter (NOT LinUCB per DS1) — outcome-based routing via preference learning | EVALUATE: read code, decide port-or-skip per actual fit | 4-8h to evaluate + port if useful | If useful, ports as `packages/core/src/routing/preference-router.ts` |
| HARV-17 | claw-code prompt boundary (research-harness-extraction.md TS-9) | `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` for Anthropic prompt-caching | `packages/adapter-claude/src/system-prompt-builder.ts` | 2-3h | Static prefix stable across sessions, cache-hits verified |
| HARV-18 | opencode anti-bypass clause | `plan-reminder-anthropic.txt` — explicit forbidden filesystem manipulation in plan mode | `packages/adapter-claude/src/system-prompt.md` (per-runtime, SYNTHESIS pattern #18) | 1-2h | Anti-bypass clause present in per-runtime system prompt |

Total v1-scoped HARV effort: ~50-80h. Items 14-15 deferred.

**Note on HARV-16 (PreferenceRouter)**: this is the FALSIFIED-then-re-evaluated pattern from DS1. SYNTHESIS pattern #12 was wrong about "LinUCB"; the actual implementation in nexus-agents is preference-learning. DS1's recommendation was to re-name or remove. The right action is to read the actual code + decide: is the underlying pattern useful for hima's multi-adapter routing problem? If yes, port under correct name. If no, remove from §3 entirely.

---

## 9. DONE criteria — per cycle, per stream, per phase, project-level

### 9.1 Per-cycle DONE (hima's 8 runtime cycles)

Each cycle reaches `done` per `docs/conception/05-gates-policy-spec.md` §2.3 — Evidence Set sufficiency check. The exact evidence required depends on the risk class:
- T: CI green + secrets clean
- L: above + integration tests + 1 reviewer + SBOM
- M: above + product validation
- H: above + 2 reviewers OR antagonist agent + ADR + threat model + DAST + canary + rollback + human validation
- C: above + AIPD + load tests + independent security audit + signed log

These are existing in the gates spec; this section is the cross-reference, not redefinition.

### 9.2 Per-stream DONE (the streams A-I from §5)

Each stream has its own DONE criteria specified in §5. Each criterion is saturation-anchored: numerical floors are necessary, saturation pass is sufficient.

### 9.3 Per-phase DONE (the phases 0-7 from §6)

Each phase DONE when its constituent streams' DONE criteria all hold AND a phase-level saturation critic finds nothing material missed.

### 9.4 Project-level DONE (v1.0 shipped)

Per §1.1 acceptance facts + §1.2 qualitative tests + the file-level Falsifies-If in §1.

When v1.0 ships, this entire `COMPLETE-CONSTRUCTION-GOAL.md` archives to `docs/goals/archive/COMPLETE-CONSTRUCTION-GOAL-DONE-YYYY-MM-DD.md` and is replaced by a `v1.1-CONSTRUCTION-GOAL.md` for the next phase.

---

## 10. Test session details — runtime invocation specifics

Beyond §7's protocol, here are the concrete invocations.

### 10.1 Claude Code

```bash
# Install adapter
harness install claude

# Verify install
harness doctor

# Run scenario 1 (small feature)
cd /tmp/hima-test-scenario-1
harness init
harness transition discovery
# Claude Code runs in this directory; user submits a small-feature prompt
# pre_tool hook fires; write-zones enforced per phase
# At end of session, harness stop evaluates Evidence Set

# Inspect ledger
cat .hima/state/ledger/*.jsonl | jq

# Verify hash chain
harness ledger verify
```

### 10.2 Codex CLI

Same flow with `harness install codex`. Codex CLI primitives bind to hima gates via `packages/adapter-codex/src/`.

### 10.3 Hermes

Same flow with `harness install hermes`. Hermes ACP plugin hooks bind to hima gates via `packages/adapter-hermes/src/`.

### 10.4 Self-test mode

`harness self-test` — runs the 5 scenarios from §7.1 in a sandbox + outputs a pass/fail per runtime. Useful for CI + regression detection.

---

## 11. Per-cycle deliverable map — the actual checklist

This is the most operationally important section. A reader who knows everything else in this file can use just this section as a checklist.

Format: each item is a single line with file path + status + which stream it belongs to.

### 11.1 Stream A — Runtime unblockers (PHASE 0)

- [x] `docs/01-governance/_template-dor-dod.md` — DoR/DoD locked-schema template (A1)
- [x] `docs/01-governance/dor-01-discovery.md` (A1)
- [x] `docs/01-governance/dor-02-cadrage.md` (A1)
- [x] `docs/01-governance/dor-03-conception.md` (A1)
- [x] `docs/01-governance/dor-04-build.md` (A1)
- [x] `docs/01-governance/dor-05-validation.md` (A1)
- [x] `docs/01-governance/dor-06-release.md` (A1)
- [x] `docs/01-governance/dor-07-run.md` (A1)
- [x] `docs/01-governance/dor-08-apprentissage.md` (A1)
- [x] `docs/01-governance/dod-01-discovery.md` (A1)
- [x] `docs/01-governance/dod-02-cadrage.md` (A1)
- [x] `docs/01-governance/dod-03-conception.md` (A1)
- [x] `docs/01-governance/dod-04-build.md` (A1)
- [x] `docs/01-governance/dod-05-validation.md` (A1)
- [x] `docs/01-governance/dod-06-release.md` (A1)
- [x] `docs/01-governance/dod-07-run.md` (A1)
- [x] `docs/01-governance/dod-08-apprentissage.md` (A1)
- [x] `packages/core/src/governance/load-dor-dod.ts` (A2)
- [x] integration into `packages/core/src/state-machine/transition.ts` (A2)
- [x] `packages/core/test/dor-dod-loading.test.ts` (A3)
- [x] `packages/core/test/dor-dod-evaluation.test.ts` (A3)
- [x] `packages/core/src/storage/hash-chained-ledger.ts` (A4 — port from wirken)
- [x] `packages/core/test/hash-chained-ledger.test.ts` (A4 — property-based)
- [x] `packages/core/src/storage/events-log.ts` (A5 — port from OMX session-history)
- [x] `packages/core/test/events-log.test.ts` (A5)

### 11.2 Stream B — Protocol amendments (PHASE 0)

- [x] `docs/goals/README.md` += "Wave protocol — cross-agent reconciliation" section (B1)
- [x] `docs/conception/05-gates-policy-spec.md` §8.4 += evidence-anchor resolve check (B2)
- [x] `docs/goals/README.md` += "Vocabulary diversification" section (B3)

### 11.3 Stream C — DDD refactor (PHASE 1)

- [x] Identify 6 bounded contexts in `packages/core/`: Run, Cycle, Gate, Skill, Subagent, Evidence (C1)
- [x] Introduce `packages/core/src/domain/run/run-aggregate.ts` and route `requestTransition` through `RunAggregate.transition` while preserving Cycle-owned legality (C2a)
- [x] Complete remaining transition refactor so Run owns orchestration and Cycle retains transition legality without stale free-service ownership claims (C2b)
- [x] Value objects: `packages/core/src/types/risk-class.ts`, `subphase.ts`, `operating-mode.ts`, `gate-type.ts` — all immutable + validated (C3)
- [x] Domain events emitted via `events-log.ts` for current runtime paths: `TransitionRequested`, `TransitionExecuted`, `GateEvaluated`, `EvidenceAdded`, `RunClosed`, `RiskClassPromoted`, `SubagentLaunched`, `SubagentReturned` (C4)
- [x] Repositories: `packages/core/src/repositories/run-repository.ts` thin over `planning-store.ts` (C5)
- [x] Always-valid invariant in Run aggregate (C6)
- [x] Refactor tests to aggregate-style (C7)

### 11.4 Stream D — Skills + Hooks + MCP (PHASE 2)

D-skills:
- [x] `packages/core/src/install/skills-install.ts` writes `.hima/skills/{name}/SKILL.md` per durable public/user/project/org scope (D-S1, depends HARV-10)
- [x] locked frontmatter field contract for `SKILL.md` (D-S2)
- [x] `packages/core/src/schemas/skill.schema.ts` Zod schema validating locked frontmatter fields (D-S3)
- [x] `packages/core/src/catalogs/keyword-registry.ts` typed flat-array (D-S4, depends HARV-03)
- [x] `packages/core/src/catalogs/router-cascade.ts` 4-tier cascade (D-S5)

D-hooks:
- [x] `packages/core/src/services/handle-hook.ts` + `packages/core/src/gates/evaluate-gate.ts` — SubagentStop deliverables gate wired and tested (D-H2)
- [x] `packages/core/src/services/handle-hook.ts` + `packages/core/src/gates/evaluate-gate.ts` + `packages/core/src/policy/write-zones.ts` — PreToolUse payload normalization, fail-closed planning state, tool-input write-intent detection including HTTP methods and capability arrays, dot-segment- and realpath-safe write-zone enforcement, redaction, and dry-run no-persist behavior wired and tested (D-H1)
- [x] `packages/core/src/services/handle-hook.ts` + `packages/core/src/gates/evaluate-gate.ts` — SessionStart payload normalization/redacted context prefetch, UserPromptSubmit bypass/redaction/dry-run/runtime-binding behavior, and Stop evidence/human-validation/runtime-binding gating wired and tested (D-H3, D-H5)
- [x] `packages/core/src/types/gate-type.ts` + `packages/core/src/runtime/runtime-profiles.ts` + `packages/core/src/services/handle-hook.ts` + `packages/core/src/gates/evaluate-gate.ts` — PreCompact/PostCompact canonical gates, runtime bindings, payload normalization, redacted context, route-continuity checks, and dry-run no-persist behavior wired and tested (D-H4)
- [x] `packages/core/src/services/handle-hook.ts` + `packages/core/src/gates/evaluate-gate.ts` + `packages/core/src/gates/policy-event-blockers.ts` — PostToolUse policy-event persistence, evidence-anchor redaction, non-fabrication of accepted evidence, stop/convergence blocker threading, and stricter Falsifies-If field validation wired and tested (PostToolUse expansion, cycle-19)
- [x] `packages/core/src/services/handle-hook.ts` + `packages/core/src/gates/evaluate-gate.ts` + `packages/core/src/storage/planning-store.ts` — SubagentStart launch policy coverage wired and tested: agent/task/scope/evidence-contract requirements, depth cap, risk no-downgrade, write-zone scope enforcement, redacted `runSet.subagents[]` contract persistence, and dry-run no-persist behavior (cycle-20)
- [x] Hook decomposition: `packages/core/src/hooks/hook-payload.ts` and `packages/core/src/hooks/subagent-launch-record.ts` extracted from `handle-hook.ts` with behavior-preserving tests, docs, and inventory parity (D-H6, cycle-21)
- [x] Hard-limits boundary/code module: `packages/core/src/security/hard-limits.ts` now owns two tested local deterministic boundaries after source review and failing negative tests: blocked remote script pipe commands (cycle-67) and a 15-active-subagent spawn cap (cycle-77; token budgets, inherited tool-deny projection, and real runtime adapter enforcement remain non-goals)
- [x] `packages/core/src/security/hard-limits.ts` implements one narrow D-H7 blocked-command-pattern boundary for normalized PreToolUse shell payloads, with RED/GREEN `handle-hook.test.ts` coverage (cycle-67; token budgets, subagent tool inheritance, spawn limits, and runtime adapter proof still open)
- [x] `packages/core/src/security/hard-limits.ts` implements a second narrow D-H7 active subagent spawn-cap boundary for normalized `subagent_start` payloads and persisted `runSet.subagents[]`, with RED/GREEN `handle-hook.test.ts` coverage (cycle-77; token budgets, inherited tool-deny projection, and runtime adapter proof still open)

D-mcp:
- [x] `hima_evaluate_completion` in `packages/mcp-server/src/index.ts` (D-M1, cycle-23)
- [x] `hima_classify_risk` in `packages/mcp-server/src/index.ts` (D-M2, cycle-23)
- [x] `hima_record_evidence` in `packages/mcp-server/src/index.ts` (D-M3, cycle-23)
- [x] `hima_query_compliance` in `packages/mcp-server/src/index.ts` (D-M4, cycle-23)
- [x] `packages/mcp-server/src/policy/namespace-policy.ts` namespace-as-policy-unit (D-M5, cycle-26)

### 11.5 Stream E — Adapter packages (PHASE 3)

Package-hardening baseline:
- [x] `packages/adapter-claude`, `packages/adapter-codex`, and `packages/adapter-hermes` package-level preview/apply/remove hook config functions aligned with executable runtime profiles and covered by focused lifecycle tests (cycle-24)

E-claude:
- [x] `packages/adapter-claude/src/system-prompt.md` per-runtime prompt with anti-bypass clauses (depends HARV-18, cycle-27)
- [x] `packages/adapter-claude/src/hook-bindings.ts` Claude events -> hima gates (cycle-27)
- [x] `packages/adapter-claude/src/install.ts` `harness install claude` adapter-owned install module (cycle-28)
- [ ] `packages/adapter-claude/test/e2e.test.ts` end-to-end against Claude Code real session

E-codex:
- [x] `packages/adapter-codex/src/system-prompt.md` (cycle-27)
- [x] `packages/adapter-codex/src/hook-bindings.ts` (cycle-27)
- [x] `packages/adapter-codex/src/install.ts` (cycle-28)
- [ ] `packages/adapter-codex/test/e2e.test.ts`

E-hermes:
- [x] `packages/adapter-hermes/src/system-prompt.md` (cycle-27)
- [x] `packages/adapter-hermes/src/hook-bindings.ts` (cycle-27)
- [x] `packages/adapter-hermes/src/install.ts` (cycle-28)
- [ ] `packages/adapter-hermes/test/e2e.test.ts`

E-real-runtime-planning:
- [x] `docs/excellence-application/05-architecture/stream-e-real-runtime-session-plan.md` reusable real-runtime protocol without external-session overclaim (cycle-29)
- [x] `fixtures/runtime-session/small-feature/` portable small-feature fixture and evidence template (cycle-29)
- [x] `scripts/runtime-session-smoke.mjs` local fixture/install/hook dry-run smoke across Claude, Codex, and Hermes targets (cycle-29)
- [x] `docs/excellence-application/05-architecture/stream-e-real-runtime-smoke-results.md` blocked preflight evidence: Claude/Codex binaries present, Hermes missing, external session authorization absent (cycle-30)
- [x] `docs/excellence-application/05-architecture/runtime-session-evidence/cycle-30/preflight.json` machine-readable blocked preflight evidence (cycle-30)
- [x] `docs/goals/adapter-e2e-authorization-blocker-review.md` maps Claude/Codex/Hermes adapter E2E blockers and prerequisites without launching runtime sessions (cycle-80; adapter E2E rows remain open)

### 11.6 Stream F — Test sessions (PHASE 4)

- [ ] `packages/cli/src/commands/self-test.ts` invokes the 5-scenario suite per runtime (F1)
- [x] `harness self-test` local deterministic install/hook dry-run preflight exists in `packages/cli/src/index.ts` (cycle-31; not the full 5-scenario runtime suite)
- [ ] SWE-bench Verified subset wired as a benchmark target (F2)
- [x] `harness benchmark plan` dry-run planning surface for SWE-bench Verified with authorization boundary and evidence contract (cycle-32; not benchmark execution)
- [x] `packages/core/src/schemas/benchmark-result.schema.ts` validates planned/blocked/executed benchmark result artifacts and rejects fake executed results (cycle-33)
- [x] `harness benchmark validate <file>` validates benchmark result JSON and rejects fake executed artifacts without external execution (cycle-34)
- [x] `fixtures/benchmark-results/` canonical planned/blocked/executed-valid/executed-invalid benchmark artifacts with core and CLI validator coverage (cycle-35)
- [x] `harness benchmark write` persists planned/blocked benchmark result artifacts through `BenchmarkResultSchema` without external execution (cycle-36; not benchmark execution)
- [ ] Cross-runtime parity test harness (F3)
- [x] `RuntimeParityFixtureSchema`, `fixtures/runtime-parity/synthetic/`, and `harness runtime parity-fixture-validate` check synthetic Claude/Codex/Hermes governance-shape parity and drift without external execution (cycle-40; not final F3 runtime parity)
- [x] `RuntimeParityAuthorizationSchema`, `harness runtime parity-authorization write/validate`, and `harness runtime parity-execution-preflight` encode fail-closed authorization state before real Claude/Codex/Hermes parity execution (cycle-41; not runtime execution)
- [ ] Stress test: 100 concurrent transitions test (F4)
- [x] `runLocalStressFixture`, `validateLocalStressLedger`, and `harness stress-fixture` run a deterministic 100-entry local transition/ledger stress fixture with tamper drift detection and no external sessions (cycle-42; not final F4 production/concurrent runtime stress)
- [ ] Compliance pack generation + SIEM ingest test (F5)
- [x] `SiemIngestRecordSchema`, `runLocalSiemFixture`, and `harness siem-fixture` normalize local HIMA ledger entries into SIEM-like records with integrity fields and no external transmission (cycle-43; not final external SIEM ingest)
- [x] `CompliancePackSchema` and `harness compliance-pack assemble` require and validate a local `siemFixturePath` reference for assembled evidence packs (cycle-44; not legal certification or external SIEM integration)
- [x] `packages/core/src/schemas/compliance-pack.schema.ts` validates draft/blocked/assembled developer-session compliance pack artifacts with explicit non-certification boundary (cycle-37; not final F5 generation)
- [x] `harness compliance-pack validate/write` validates and persists draft/blocked compliance pack artifacts without external execution (cycle-37; not final F5 generation)
- [x] `harness compliance-pack assemble` generates assembled compliance pack artifacts only after required local evidence files exist (cycle-38; not legal compliance certification or SIEM ingest)
- [x] `harness benchmark authorization write/validate` and `harness benchmark execution-preflight` encode fail-closed benchmark authorization state (cycle-39; not benchmark execution)
- [ ] Saturation critic over the test results (F6)
- [x] `docs/excellence-application/05-architecture/stream-f-runtime-execution-gap-review.md` maps remaining F1-F6 acceptance gaps to blockers and authorization-required evidence without running external sessions (cycle-45; not final Stream F acceptance)
- [x] Stream E/F preflight fixture and local smoke command for future real-runtime sessions (cycle-29; not a substitute for F1-F6)
- [x] Stream E blocked runtime-access preflight recorded for Claude, Codex, and Hermes (cycle-30; not a substitute for executed runtime sessions or F1-F6)
- [x] `docs/goals/runtime-evidence-authorization-prep.md` defines future runtime/model authorization packet fields, Claude/Codex/Hermes runbook prerequisites, transcript retention requirements, and stop conditions (cycle-78; not authorization and not runtime, benchmark, H3, beta, release, payment, legal, market, or SIEM evidence)

### 11.7 Stream G — Excellence books + harvest (PHASE 5)

G-apply per book (7 books × ≥5 skills each = ≥35 skills minimum):
- [x] `fixtures/hima-skills/first-wave/project/.hima/skills/` contains 5 project-local HIMA skill fixtures validated by `skills-install.test.ts` (cycle-46; first wave only, not the 7-book quota)
- [x] `fixtures/hima-skills/books/00-idea-pmf/project/.hima/skills/` contains 5 schema-valid `00-idea-pmf` skill fixtures validated by `skills-install.test.ts` (cycle-48; repo-local fixture, not real `~/.hima` install)
- [x] `fixtures/hima-skills/books/01-strategy-positioning/project/.hima/skills/` contains 5 schema-valid `01-strategy-positioning` skill fixtures validated by `skills-install.test.ts` (cycle-50; repo-local fixture, not real `~/.hima` install)
- [x] `fixtures/hima-skills/books/02-analysis-discovery/project/.hima/skills/` contains 5 schema-valid `02-analysis-discovery` skill fixtures validated by `skills-install.test.ts` (cycle-52; repo-local fixture, not real `~/.hima` install)
- [ ] `00-idea-pmf` skills installed under `~/.hima/skills/00-idea-pmf/`
- [ ] `01-strategy-positioning` skills installed
- [ ] `02-analysis-discovery` skills installed
- [ ] `03-specification` skills installed
- [x] `fixtures/hima-skills/books/03-specification/project/.hima/skills/` contains 5 schema-valid `03-specification` skill fixtures validated by `skills-install.test.ts` (cycle-54; repo-local fixture, not real `~/.hima` install)
- [ ] `04-design-ux-ui` skills installed (lower priority for harness use case)
- [x] `fixtures/hima-skills/books/04-design-ux-ui/project/.hima/skills/` contains 5 schema-valid `04-design-ux-ui` skill fixtures validated by `skills-install.test.ts` (cycle-58; repo-local fixture, not real `~/.hima` install)
- [ ] `05-architecture` skills installed
- [x] `fixtures/hima-skills/books/05-architecture/project/.hima/skills/` contains 5 schema-valid `05-architecture` skill fixtures validated by `skills-install.test.ts` (cycle-55; repo-local fixture, not real `~/.hima` install)
- [ ] `07-build` skills installed
- [x] `fixtures/hima-skills/books/07-build/project/.hima/skills/` contains 5 schema-valid `07-build` skill fixtures validated by `skills-install.test.ts` (cycle-56; repo-local fixture, not real `~/.hima` install)
- [ ] `09-quality-release-run` skills installed
- [x] `fixtures/hima-skills/books/09-quality-release-run/project/.hima/skills/` contains 5 schema-valid `09-quality-release-run` skill fixtures validated by `skills-install.test.ts` (cycle-57; repo-local fixture, not real `~/.hima` install)

G-harvest (16 items from §8 table):
- [ ] HARV-01 ai-slop-cleaner (OMC)
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/ai-slop-cleaner/SKILL.md` provides a schema-valid repo-local HARV-01 skill fixture (cycle-47; hook wiring and real invocation still open)
- [x] `packages/core/src/security/ai-slop-cleaner.ts` provides local HARV-01 cleanup/deslop evidence enforcement for cleanup-plan plus regression-evidence requirements, wired into `post_tool` and traced `subagent_stop` gate evaluation with direct/gate/hook tests (cycle-94; live runtime invocation, adapter hook firing, actual dogfood cleanup execution, and real `~/.hima` install proof remain open)
- [ ] HARV-02 agnix-style linting
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/config-linting/SKILL.md` provides a schema-valid repo-local HARV-02 skill fixture (cycle-53; 30+ lint implementation and CI hook still open)
- [x] `packages/core/src/install/skill-lint.ts` provides a local HARV-02 deterministic 44-rule SKILL.md lint API with valid and malformed fixture tests (cycle-85; CI enforcement, full agnix 423-rule parity, live runtime scans, and real `~/.hima` scans remain open)
- [x] HARV-03 OMX keyword-registry (also D-S4)
- [ ] HARV-04 OMX mode state-machine
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/mode-state-machine/SKILL.md` provides a schema-valid repo-local HARV-04 skill fixture (cycle-59; runtime persistence, hook wiring, and real invocation still open)
- [x] `packages/core/src/state-machine/mode-exclusion.ts` provides a local HARV-04 deterministic mode-exclusion helper with source-verified six-transition catalog tests (cycle-86; live runtime persistence, hook wiring, adapter behavior, real invocation, real `~/.hima` install proof, and historical ten-transition parity review remain open)
- [x] HARV-05 wirken hash-chain (also A4)
- [x] HARV-06 OMX events-log (also A5)
- [ ] HARV-07 auto-harness 3-step evidence gate
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/evidence-gate/SKILL.md` provides a schema-valid repo-local HARV-07 skill fixture (cycle-60; `evaluate-evidence.ts`, held-out execution, suite promotion, and real test session still open)
- [x] `packages/core/src/evidence/evaluate-evidence.ts` provides a local HARV-07 layered evidence-gate evaluator with eval-suite, held-out-split, and suite-promotion metadata tests (cycle-87; held-out execution, suite promotion automation, real runtime/model session evidence, adapter behavior, and real `~/.hima` install proof remain open)
- [ ] HARV-08 typed human-handoff
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/typed-handoff/SKILL.md` provides a schema-valid repo-local HARV-08 skill fixture (cycle-49; live runtime invocation still open)
- [x] `packages/core/src/services/request-human-input.ts` provides the local HARV-08 typed request service, `.planning/09-logs/handoffs.jsonl` capture, replay parser, and `HUMAN_INPUT_REQUESTED` run-set event with tests (cycle-82; live runtime invocation and real `~/.hima` install remain open)
- [ ] HARV-09 prompt-injection scanner
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/prompt-injection-scan/SKILL.md` provides a schema-valid repo-local HARV-09 skill fixture (cycle-51; live runtime blocking still open)
- [x] `packages/core/src/security/prompt-injection-scan.ts` provides the local HARV-09 deterministic scanner and `session_start` warning test surface (cycle-83; live runtime SessionStart blocking, real context-file load prevention, runtime invocation, and real `~/.hima` install remain open)
- [x] HARV-10 durable skill scope (OpenHands five-source correction; HIMA excludes sandbox)
- [ ] HARV-11 opencode default-deny subagent tools
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/default-deny-tools/SKILL.md` provides a schema-valid repo-local HARV-11 skill fixture (cycle-61; live runtime enforcement still open)
- [x] `packages/core/src/gates/evaluate-gate.ts` blocks local HARV-11 SubagentStart requests for default-denied `todowrite`/`task` tools and inherited deny lists, with hook normalization tests (cycle-84; live subagent runtime execution, adapter permission projection, and real `~/.hima` install remain open)
- [DEFERRED to adapter/runtime approval layer] HARV-12 goose permission classifier
- [ ] HARV-13 PreCompact/PostCompact hooks
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/compact-hooks/SKILL.md` provides a schema-valid repo-local HARV-13 skill fixture (cycle-62; real compaction adapter invocation, hook firing proof, and live critical-state preservation still open)
- [x] `packages/core/src/gates/compaction-continuity.ts` provides a local HARV-13 critical-state continuity helper with preserved, missing, mismatched, stale, and catalog tests (cycle-88; real compaction adapter invocation, hook firing proof, live critical-state preservation, and real `~/.hima` install proof remain open)
- [ ] HARV-17 claw-code prompt-cache boundary
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/prompt-cache-boundary/SKILL.md` provides a schema-valid repo-local HARV-17 skill fixture (cycle-64; real prompt-cache integration, cache-hit/freshness proof, and invalidation runtime behavior still open)
- [x] `packages/core/src/runtime/prompt-cache-boundary.ts` provides a local HARV-17 static/dynamic prompt boundary helper with fresh, stale, invalidation-signal, missing/duplicate-boundary, dynamic-leak, and catalog tests (cycle-89; real prompt-cache integration, cache-hit/freshness proof, invalidation runtime behavior, adapter behavior, and real `~/.hima` install proof remain open)
- [ ] HARV-18 opencode anti-bypass clause
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/anti-bypass-clause/SKILL.md` provides a schema-valid repo-local HARV-18 skill fixture (cycle-63; runtime permission enforcement, adapter hook wiring, and live bypass-attempt proof still open)
- [x] `packages/core/src/security/anti-bypass-clause.ts` provides local HARV-18 bypass-attempt detection for prompt, tool, post-tool, and subagent-start gate inputs, including hook-wiring mutation attempts (cycle-91; live runtime permission enforcement, adapter hook firing proof, real bypass transcripts, and real `~/.hima` install proof remain open)
- [ ] HARV-16 nexus-agents PreferenceRouter (evaluate-then-decide)
- [x] `fixtures/hima-skills/harvested/project/.hima/skills/preference-router/SKILL.md` provides a schema-valid repo-local HARV-16 skill fixture (cycle-65; live route evaluation, model/runtime execution, adapter behavior, and real `~/.hima` install proof still open)
- [x] `packages/core/src/routing/preference-router.ts` provides a local HARV-16 deterministic PreferenceRouter helper for required signals, kill signals, score floor, priority ordering, and tie escalation (cycle-92; live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, and real `~/.hima` install proof remain open)
- [x] `docs/goals/real-user-home-install-authorization-prep.md` maps book-skill and harvested-skill real `~/.hima` blockers, authorization packet fields, backup/restore requirements, and stop conditions without writing to real user-home paths (cycle-81; real install rows remain open)
- [DEFERRED to v2] HARV-14 spec-kit CP-SAT
- [DEFERRED to v2] HARV-15 EvoMap GEP

### 11.8 Stream H — Pre-release polish + beta (PHASE 6)

- [x] H1 documentation pass — conception specs `00` through `11` re-read against current package/CLI/MCP/runtime surfaces and amended for concrete drift (cycle-75; no runtime, OS install, beta, npm, release, payment, or legal-compliance evidence claimed)
- [x] H2 API stability check — `packages/core/src/index.ts` review reconciled against Cycle 68 inventory and the current barrel surface (cycle-74; package remains private/unpublished and provisional export groups remain release-boundary work)
- [x] `docs/excellence-application/05-architecture/stream-h-api-stability-review.md` inventories every `packages/core/src/index.ts` export group and marks stable/provisional surfaces without claiming npm/public release readiness (cycle-68)
- [ ] H3 install tested on Linux + macOS + Windows
- [x] `docs/goals/h3-install-matrix-preparation.md` defines the required Linux/macOS/Windows transcript template and records local dry-run install/lifecycle/self-test preflight (cycle-76; H3 remains open until real OS transcripts exist)
- [x] `.github/workflows/h3-install-matrix.yml` and `scripts/h3-install-matrix-transcript.ps1` prepare a manual-only CI transcript workflow for future Linux/macOS/Windows H3 evidence (cycle-79; workflow not run, no accepted transcript files created, H3 remains open)
- [x] `docs/goals/evidence/h3-install-windows.md` records a real Windows install-matrix transcript with all local install, artifact, lifecycle, runtime-probe, and self-test commands exiting 0 for Claude/Codex/Hermes (cycle-90 partial H3 evidence; macOS transcript remains missing, so H3 remains open)
- [x] `docs/goals/evidence/h3-install-linux.md` records a real WSL2 Ubuntu/Linux install-matrix transcript with all local install, artifact, lifecycle, runtime-probe, and self-test commands exiting 0 for Claude/Codex/Hermes (cycle-90 partial H3 evidence; macOS transcript remains missing, so H3 remains open)
- [x] H4 `docs/business-model/claims-register.csv` exists with T1/T2/T3/T4, source, falsifier, owner, and expiry fields for 15 seeded high-risk business/comparative claims (cycle-69; public-copy exhaustiveness refresh and market validation remain open)
- [x] H5 `docs/business-model/icp-worksheet.md` exists with primary, secondary, excluded, anti-ICP sections and falsifiers (cycle-70; no external ICP validation claimed)
- [x] H6 `docs/business-model/message-hierarchy.md` exists with direct arXiv 2604.09409 source check, claim-source mapping, channel variants, excluded claims, and overclaim guardrails (cycle-71; no launch, beta, revenue, legal certification, or market validation claimed)
- [x] H7 `docs/business-model/north-star-metric.md` exists with activation event, numerator/denominator, instrumentation fields, guardrail metrics, review cadence, and falsifiers (cycle-72; no measured activation, retention, revenue, beta, launch, or market validation claimed)
- [ ] H8 closed beta with 10 users + saturation survey

### 11.9 Stream I — v1.0 release (PHASE 7)

- [ ] I1 GitHub repo visibility public
- [ ] I2 v1.0.0 tag + release notes
- [ ] I3 `@hima/cli` published to npm
- [ ] I4 founding-cohort sale page live
- [ ] I5 Show HN + dev.to + r/devops + Claude Code Discord posts
- [ ] I6 `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md` opening snapshot

---

## 12. Cross-references — what this file depends on

| Source file | Purpose | Where referenced |
|-------------|---------|------------------|
| `docs/vision.md` | Vision (forward-looking) | §0.2, session-start protocol |
| `docs/goals/LONG-TERM-GOAL.md` | Acceptance criteria | §0.2, §1, §9.4 |
| `docs/goals/SHORT-TERM-GOAL.md` | Current cycle's deliverable | §0.2, §0.3 |
| `docs/goals/README.md` | Saturation rule + cadence protocol | §3.1, §3.3, §3.5 |
| `docs/business-model/strategy-diagnosis.md` | Rumelt kernel + 7 refusal rules + 7 bets | §1.2, §3.4, §5 stream H |
| `docs/business-model/business-model-proposal.md` | Narrative source | §2.3, §5 stream I |
| `docs/conception/01-state-machine-spec.md` | State machine spec | §3.4, §5 stream C |
| `docs/conception/02-risk-classifier-spec.md` | Risk classifier | §3.4 |
| `docs/conception/03-rms-sets-schema.md` | Schema | §3.4 |
| `docs/conception/04-runtime-bindings-spec.md` | Adapter spec | §5 stream E |
| `docs/conception/05-gates-policy-spec.md` | Gates + §8.4 Falsifies-If rule | §3.2, §9.1 |
| `docs/conception/06-skills-catalog-spec.md` | Skills spec | §3.7, §5 stream D |
| `docs/conception/07-subagents-catalog-spec.md` | Subagents | §5 stream D |
| `docs/conception/08-planning-state-schema.md` | Planning state schema | §5 stream A |
| `docs/conception/09-cli-commands-spec.md` | CLI commands | §5 stream E (install) |
| `docs/conception/10-core-api-spec.md` | Core API | §5 stream C |
| `docs/excellence-application/02-analysis-discovery/swarm/SYNTHESIS.md` | 21 ranked patterns + §13 deep-review verdict | §5 stream D, §5 stream G, §8 |
| `docs/excellence-application/02-analysis-discovery/swarm/packages-layout-snapshot.md` | hima implementation surface | §2.1 |
| `docs/excellence-application/02-analysis-discovery/swarm/prior-research-baseline.md` (S0) | Pre-cycle research distilled | §2.1, §2.2 |
| `docs/excellence-application/02-analysis-discovery/swarm-deep/critic-audit.md` (DS1) | Critic findings | §2.4 |
| `docs/excellence-application/02-analysis-discovery/swarm-deep/deep-code-top8.md` (DS2) | Code-level evidence | §8 |
| `docs/excellence-application/02-analysis-discovery/swarm-deep/adversarial-moat-falsifier.md` (DS3) | Moat falsification attempts | §2.4 |
| `docs/excellence-application/02-analysis-discovery/swarm-deep/niche-source-scan.md` (DS4) | arXiv 2604.09409 + 42 entries | §1.2, §5 stream H |
| `docs/excellence-application/02-analysis-discovery/swarm-deep/saturation-measurement.md` (DS5) | Saturation methodology | §3.1 |
| `docs/excellence-application/02-analysis-discovery/swarm-deep/saturation-closure-S7.md` (S7) | Saturation closure | §3.1 |
| `.planning/business-model/research-harness-extraction.md` | 11 harness audits | §5 stream D, §8 |
| `.planning/business-model/omx-architecture-deep-dive.md` | OMX deep dive | §5 stream D |
| `.planning/business-model/competitive-landscape-2026.md` | Competitive landscape | §2.4 |
| otherskill `02-analysis-discovery/technical-analysis-discovery-excellence-book/` | Cycle 01 source book | §4.1 |
| otherskill `01-strategy-positioning/*/` | Cycle 02 source books | §4.2 |
| otherskill `03-specification/*/` | Cycle 02-03 source books | §4.2, §4.3 |
| otherskill `04-design-ux-ui/*/` | Cycle 03 source books | §4.3 |
| otherskill `05-architecture/*/` (incl. domain-modeling-ddd) | Cycle 03 + DDD refactor | §3.4, §4.3, §5 stream C |
| otherskill `07-build/*/` | Cycle 04 source books | §4.4 |
| otherskill `09-quality-release-run/*/` | Cycle 05-07 source books | §4.5, §4.6, §4.7 |
| otherskill `10-growth/*/` | Cycle 07 source books | §4.7 |
| otherskill `12-measurement/*/` | Cycle 07-08 source books | §4.7, §4.8 |

---

## 13. Open questions — known unknowns

These are gaps in this plan that need to be answered, not assumed.

1. **Test session machine availability**: do Hermes and Codex CLI both have publicly-accessible install paths today, or does one require beta access? If beta, what's the latency to obtain it? **Action**: research before phase 3.
2. **`excellence-to-skills` pipeline state in otherskill**: per earlier reads, `otherskill/dist/excellence-to-skills/plugin/skills/` exists with generated skills. Is the pipeline still running / current as of 2026-05-14? **Action**: verify before phase 5 G-apply.
3. **DDD refactor scope risk**: refactoring `packages/core/` aggressively could break existing tests. Is the test suite robust enough to catch regressions, or does it need hardening first? **Action**: run the test suite + measure mutation testing pass rate before phase 1 C2.
4. **`harness self-test` infrastructure**: running real adapter sessions in CI requires either spawning real model API calls (cost) or mocking (lower fidelity). Which? **Action**: cost estimate + decision before phase 4 F-mock vs F-live.
5. **Founding cohort sale page**: which Stripe Connect mode (standard or express)? Where does the landing page actually live (subdomain on hima domain or third-party hosting)? **Action**: decide in phase 6 H8 before phase 7 I4.
6. **Skill harvest licenses**: each HARV item ports code from open-source repos with various licenses (MIT, Apache 2.0, mostly). Verify license compatibility before port, attribute appropriately. **Action**: ATTRIBUTION.md file maintained in `docs/` per HARV item.
7. **OMX upstream license vs hima MIT**: OMX is MIT per `.planning/business-model/omx-architecture-deep-dive.md` header. Compatible. But OMX's `keyword-registry.ts` may have evolved since DS2's read — re-verify at port time.
8. **wirken upstream activity**: 145⭐ is small. Does the upstream maintain? If it goes dormant in Q3 2026, hima inherits the maintenance burden. **Action**: monitor upstream commits monthly.
9. **MS AGT + Codex enterprise + Augment compliance SKU monitoring**: the 2026-09-01 checkpoint requires real intelligence on these. Who watches what when. **Action**: tracker doc + RSS feeds + named owner (founder for now).
10. **EU AI Act actual enforcement**: spec says 2026-08-02 enforcement. Is the regulatory infrastructure (notified bodies, conformity assessment) actually operational by then? Could delay matters. **Action**: legal news tracker + adjust §1 acceptance fact #2 if enforcement slips.

```yaml
Falsifies-If:
  kill-condition: 2026-06-14 (= today + 30 days) passes without ≥7 of the 10 open questions in §13 answered with documented decisions
  checkpoint-date: 2026-05-28 (= today + 14 days mid-review)
  evidence-anchor: docs/goals/COMPLETE-CONSTRUCTION-GOAL.md § 13. Open questions
  on-fail: trigger a dedicated cycle-X to close open questions before continuing construction
```

---

## 14. Project-level Falsifies-If

```yaml
Falsifies-If:
  kill-condition: 2026-08-01 (target v0.1.0 ship per Bet B1) passes without §1.1 acceptance fact #1 (public release shipped) met. OR: 2027-08-01 passes with ≤3 of the 5 §1.1 acceptance facts met. OR: at any point, any of the 7 refusal rules R1-R7 in strategy-diagnosis.md §2 fires (which would auto-trigger a long-term goal revision per LONG-TERM-GOAL.md §4)
  checkpoint-date: 2026-07-01 (= 4 weeks before target v0.1.0 — at this date, phase 4 should be ≥80% done and phase 5 partially started)
  evidence-anchor: docs/goals/COMPLETE-CONSTRUCTION-GOAL.md § 11. Per-cycle deliverable map
  on-fail: in priority order: (a) cut phase 5 G-apply to v1.1 (keep G-harvest), (b) cut HARV-14 + HARV-15 (already deferred), (c) ship with 2 adapters instead of 3, (d) ship without founding-cohort sale and add it post-launch, (e) acknowledge the plan was wrong and revise this entire file
```

---

## 15. Amendment protocol

This file is the master plan but it is NOT immutable. Open question #13.1-13.10 might surface answers that require amendments. The cycle-02-deep-style critic/adversarial loop might find structural gaps in this file's reasoning.

Amendments work like this:

1. Open a new section §15.N in this file with date + reason + before/after diff
2. Edit the relevant section in place; cross-reference the §15.N record
3. If the amendment changes a DONE criterion or sequencing decision, surface it explicitly to the user

Do NOT silently change this file. Every amendment leaves a trace.

---

## 16. Progress log (append-only)

- **2026-05-14 19:00** — `COMPLETE-CONSTRUCTION-GOAL.md` v1 written. Status: ACTIVE. Phase 0 (cycle-02b stream A + stream B) is the current short-term goal per `docs/goals/SHORT-TERM-GOAL.md`. Next short-term goals will be drawn from §6 phase sequencing.
- **2026-05-14 20:18** — Cycle-19 PostToolUse expansion closed DONE after focused tests (124), full core tests (362), docs index, lint, build, inventory parity (67/67/0), post-tool dry-run `{}`, and saturation critic PASS. Remaining D-hooks short-term work is SubagentStart policy coverage, then hook decomposition / adapter hardening.
- **2026-05-14 20:31** — Cycle-20 SubagentStart policy coverage closed DONE after focused tests (141), full core tests (367), docs index, lint, build, inventory parity (67/67/0), post-tool dry-run `{}`, and saturation critic PASS. Remaining D-hooks short-term work is hook decomposition / adapter hardening.
- **2026-05-14 20:40** — Cycle-21 hook decomposition closed DONE after focused tests (141), full core tests (367), docs index, lint, build, inventory parity (69/69/0), post-tool dry-run `{}`, and saturation critic PASS. Remaining D-hooks short-term work is D-H7 hard-limits / permission-judge sourcing.
- **2026-05-14 21:02** — Cycle-22 hard-limits / permission-judge source review drafted as docs-only: Agent-Village remains falsified, opencode subagent permission inheritance replaces it as deterministic source material, Goose SmartApprove is recorded as non-deterministic M-class permission-judge reference, and `hard-limits.ts` remains intentionally deferred pending one selected missing boundary plus failing negative tests. First saturation critic rejected close on stale index/master truth surfaces.
- **2026-05-14 21:14** — Cycle-22 first critic findings fixed after rerun evidence: `docs/INDEX.md` includes Cycle 20/21/22 architecture docs; D-H7 remains open as a future selected deterministic boundary; HARV-12 is deferred to adapter/runtime approval, not core `permission-judge.ts`; `hard-limits.ts` remains absent; `docs:index`, `lint`, full core tests (367), `build`, inventory parity (69/69/0), and post-tool dry-run `{}` are green.
- **2026-05-14 22:08** — Cycle-24 adapter package hardening closed after Codex official hook cleanup became surgical for mixed user/HIMA command blocks and all three adapter previews gained runtime-profile parity tests. Fresh evidence: Codex adapter 13 tests, Claude adapter 9 tests, Hermes adapter 10 tests, full core tests (367), `lint`, `build`, inventory parity (69/69/0), post-tool dry-run `{}`, and second saturation critic PASS after stale MCP/prompt truth surfaces were fixed.
- **2026-05-14 22:19** — Cycle-25 Stream D remaining cleanup closed after `stream-d-remaining-cleanup.md` mapped D-skills, D-hooks, D-MCP, D-H7, D-M5, and adapter baseline to DONE/open/deferred states. Fresh evidence: `docs:index`, `lint`, `build`, inventory parity (69/69/0), post-tool dry-run `{}`, and saturation critic PASS. D-H7 and D-M5 remained explicitly open at Cycle 25 close; Stream E production readiness remained open.
- **2026-05-14 22:32** — Cycle-26 D-M5 MCP namespace policy closed after `namespace-policy.ts` defined owned `rms`, compatibility `hima_governance`, and compatibility `harness_compatibility` policy units, then wired `tools/call` to fail closed on names outside that policy. Fresh evidence: MCP typecheck PASS, MCP server tests 60/60, full core tests 367/367, `docs:index`, `lint`, `build`, post-tool dry-run allow, and stale-D-M5 saturation sweep fixed older Stream D notes. Final close evidence is recorded in `docs/goals/archive/cycle-26-DONE-2026-05-14.md`.
- **2026-05-14 22:47** — Cycle-27 Stream E adapter production foundation closed after all three adapters gained package-local `system-prompt.md` files and profile-backed `hook-bindings.ts` modules. Fresh evidence: Claude adapter tests 11/11, Codex adapter tests 15/15, Hermes adapter tests 12/12, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Install command wiring and real-runtime E2E remain open for Cycle 28+.
- **2026-05-14 23:05** — Cycle-28 Stream E install command wiring closed after all three adapters gained `src/install.ts` modules exported as `@harness/adapter-*/install`, and CLI install apply/remove dispatch moved through those adapter-owned modules. Fresh evidence: Claude adapter tests 13/13, Codex adapter tests 17/17, Hermes adapter tests 14/14, CLI tests 64/64, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Real-runtime E2E remains open for Cycle 29+.
- **2026-05-14 23:22** — Cycle-29 Stream E real-runtime session planning closed after a reusable small-feature fixture, evidence template, and `smoke:runtime-session` command proved local fixture copy/test/install/hook dry-run shape across Claude, Codex, and Hermes targets. Fresh evidence: `smoke:runtime-session`, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Real Claude/Codex/Hermes external sessions remain open for Cycle 30 and require explicit runtime access/cost authorization.
- **2026-05-14 23:34** — Cycle-30 Stream E real-runtime smoke execution closed as blocked preflight evidence: Claude Code `2.1.141` and Codex CLI `0.130.0` are available, Hermes is missing from PATH, and no explicit external runtime/model spend authorization exists in the active thread. Fresh evidence: `preflight.json`, `smoke:runtime-session`, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Executed real-runtime sessions remain open behind an explicit authorization boundary.
- **2026-05-14 23:45** — Cycle-31 Stream F local self-test harness closed after `harness self-test` gained deterministic install/hook dry-run checks for all runtime targets, explicit unsupported/degraded hook reporting, and `externalRuntimeSessionsLaunched: false`. Fresh evidence: CLI tests 66/66, built `self-test --json`, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Full 5-scenario runtime self-test and benchmarks remain open.
- **2026-05-14 23:54** — Cycle-32 Stream F benchmark harness design closed after `harness benchmark plan` gained a dry-run SWE-bench Verified planning surface with 1-20 instance bounds, required evidence fields, `willLaunchExternalSessions: false`, and `blocked_until_authorized` status. Fresh evidence: CLI tests 69/69, built `benchmark plan --json`, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Actual benchmark execution remains blocked behind explicit runtime/model spend authorization.
- **2026-05-14 23:59** — Cycle-33 Stream F benchmark result schema closed after `BenchmarkResultSchema` began rejecting executed benchmark artifacts that lack baseline/governed transcripts, before/after tests, HIMA evidence, wall-clock overhead, and cost or zero-cost accounting. Fresh evidence: core tests 372/372, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Benchmark persistence and execution remain open.
- **2026-05-14 23:59** — Cycle-34 Stream F benchmark result validation command closed after `harness benchmark validate <file>` began parsing benchmark result JSON through `BenchmarkResultSchema` and rejecting fake executed artifacts. Fresh evidence: CLI tests 72/72, built validator invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Benchmark result persistence and execution remain open.
- **2026-05-14 23:59** — Cycle-35 Stream F benchmark result fixtures closed after planned, blocked, executed-valid, and executed-invalid fixture files were added under `fixtures/benchmark-results/`. Fresh evidence: core tests 375/375, CLI tests 74/74, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Benchmark result persistence and execution remain open.
- **2026-05-14 23:59** — Cycle-36 Stream F benchmark result persistence closed after `harness benchmark write` began writing planned/blocked result artifacts through `BenchmarkResultSchema` under `.planning/benchmarks/`. Fresh evidence: CLI tests 79/79, built write+validate invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Actual benchmark execution remains blocked behind explicit runtime/model spend authorization.
- **2026-05-14 23:59** — Cycle-37 Stream F compliance pack schema closed after `CompliancePackSchema` and `harness compliance-pack validate/write` began validating and persisting draft/blocked developer-session evidence-pack artifacts with an explicit non-certification claim boundary. Fresh evidence: core tests 381/381, CLI tests 86/86, built write+validate invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Final compliance pack generation, SIEM ingest, and real runtime evidence remain open.
- **2026-05-14 23:59** — Cycle-38 Stream F compliance pack generation closed after `harness compliance-pack assemble` began verifying required local evidence references before writing assembled packs. Fresh evidence: CLI tests 90/90, built assemble+validate invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Benchmark execution authorization, real runtime evidence, SIEM ingest, and legal compliance certification remain open.
- **2026-05-14 23:59** — Cycle-39 Stream F benchmark execution authorization closed after `BenchmarkAuthorizationSchema`, `harness benchmark authorization write/validate`, and `harness benchmark execution-preflight` made execution fail-closed when authorization is absent or blocked. Fresh evidence: core tests 387/387, CLI tests 95/95, built authorization+preflight invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Benchmark execution itself remains unauthorized and unrun.
- **2026-05-14 23:59** — Cycle-40 Stream F cross-runtime parity fixture harness closed after `RuntimeParityFixtureSchema`, canonical synthetic Claude/Codex/Hermes fixtures, and `harness runtime parity-fixture-validate` began checking governance-shape parity and drift without external runtime/model execution. Fresh evidence: core tests 392/392, CLI tests 99/99, built parity-fixture validator invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Final real-runtime F3 parity remains open behind explicit runtime/model authorization.
- **2026-05-14 23:59** — Cycle-41 Stream F runtime parity authorization boundary closed after `RuntimeParityAuthorizationSchema`, `harness runtime parity-authorization write/validate`, and `harness runtime parity-execution-preflight` made real parity execution fail-closed when authorization is absent or blocked. Fresh evidence: core tests 396/396, CLI tests 105/105, built authorization+preflight invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Real Claude/Codex/Hermes parity execution remains unauthorized and unrun.
- **2026-05-14 23:59** — Cycle-42 Stream F local stress fixture harness closed after `runLocalStressFixture`, `validateLocalStressLedger`, and `harness stress-fixture` began running deterministic 100-entry local transition/ledger stress with tamper drift detection and `externalSessionsLaunched: false`. Fresh evidence: core tests 399/399, CLI tests 107/107, built stress-fixture invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Final F4 production/concurrent runtime stress remains open.
- **2026-05-14 23:59** — Cycle-43 Stream F SIEM ingest fixture closed after `SiemIngestRecordSchema`, `runLocalSiemFixture`, and `harness siem-fixture` began normalizing local HIMA ledger entries into SIEM-like records with integrity fields, `externalTransmissions: false`, and no external sessions. Fresh evidence: core tests 402/402, CLI tests 109/109, built SIEM fixture invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Final external SIEM integration/F5 acceptance remains open.
- **2026-05-14 23:59** — Cycle-44 Stream F compliance-pack SIEM link closed after `CompliancePackSchema` and `harness compliance-pack assemble` began requiring a local `siemFixturePath` for assembled evidence packs and validating the referenced SIEM fixture through `SiemIngestFixtureSchema`. Fresh evidence: core tests 403/403, CLI tests 110/110, built compliance-pack SIEM-link invocation, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. Legal compliance certification and external SIEM integration remain open.
- **2026-05-14 23:59** — Cycle-45 Stream F runtime execution gap review closed after `docs/excellence-application/05-architecture/stream-f-runtime-execution-gap-review.md` mapped every remaining F1-F6 acceptance item to current local evidence, blocker, and required post-authorization evidence. Fresh evidence: `docs:index`, `lint`, post-tool dry-run allow, targeted F1-F6 link check, and saturation critic PASS. Real runtime/model/SWE-bench/stress/SIEM executions remain unrun pending explicit authorization.
- **2026-05-14 23:59** — Cycle-46 Stream G skill installation wave closed after 5 project-local HIMA skill fixtures were generated under `fixtures/hima-skills/first-wave/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 404/404, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Full 7-book Stream G quota and harvested-skill completion remain open.
- **2026-05-14 23:59** — Cycle-47 Stream G harvested skill wave closed after a repo-local `ai-slop-cleaner` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 405/405, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-01 hook wiring and real invocation remain open.
- **2026-05-14 23:59** — Cycle-48 Stream G book skill quota wave closed after 5 repo-local `00-idea-pmf` SKILL.md fixtures were added under `fixtures/hima-skills/books/00-idea-pmf/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 406/406, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-49 Stream G harvested skill wave 2 closed after a repo-local `typed-handoff` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 407/407, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-08 service implementation, JSONL capture, and real invocation remain open.
- **2026-05-14 23:59** — Cycle-50 Stream G book skill quota wave 2 closed after 5 repo-local `01-strategy-positioning` SKILL.md fixtures were added under `fixtures/hima-skills/books/01-strategy-positioning/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 408/408, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-51 Stream G harvested skill wave 3 closed after a repo-local `prompt-injection-scan` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 409/409, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-09 scanner implementation and SessionStart hook remain open.
- **2026-05-14 23:59** — Cycle-52 Stream G book skill quota wave 3 closed after 5 repo-local `02-analysis-discovery` SKILL.md fixtures were added under `fixtures/hima-skills/books/02-analysis-discovery/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 410/410, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-53 Stream G harvested skill wave 4 closed after a repo-local `config-linting` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 411/411, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-02 lint implementation and CI hook remain open.
- **2026-05-14 23:59** — Cycle-54 Stream G book skill quota wave 4 closed after 5 repo-local `03-specification` SKILL.md fixtures were added under `fixtures/hima-skills/books/03-specification/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 412/412, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-55 Stream G book skill quota wave 5 closed after 5 repo-local `05-architecture` SKILL.md fixtures were added under `fixtures/hima-skills/books/05-architecture/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 413/413, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, `04-design-ux-ui`, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-56 Stream G book skill quota wave 6 closed after 5 repo-local `07-build` SKILL.md fixtures were added under `fixtures/hima-skills/books/07-build/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 414/414, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, `04-design-ux-ui`, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-57 Stream G book skill quota wave 7 closed after 5 repo-local `09-quality-release-run` SKILL.md fixtures were added under `fixtures/hima-skills/books/09-quality-release-run/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 415/415, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, `04-design-ux-ui`, and remaining book quotas remain open.
- **2026-05-14 23:59** — Cycle-58 Stream G book skill quota wave 8 closed after 5 repo-local `04-design-ux-ui` SKILL.md fixtures were added under `fixtures/hima-skills/books/04-design-ux-ui/project/.hima/skills/` and validated through `resolveHimaSkills` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 416/416, fixture count check, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real `~/.hima` installation, runtime invocation, and real book-skill catalog integration remain open.
- **2026-05-14 23:59** — Cycle-59 Stream G harvested skill wave 5 closed after a repo-local `mode-state-machine` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 417/417, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-04 runtime persistence, hook wiring, and real invocation remain open.
- **2026-05-14 23:59** — Cycle-60 Stream G harvested skill wave 6 closed after a repo-local `evidence-gate` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 418/418, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-07 evaluator implementation, held-out execution, suite promotion, and real test-session demonstration remain open.
- **2026-05-14 23:59** — Cycle-61 Stream G harvested skill wave 7 closed after a repo-local `default-deny-tools` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 419/419, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. HARV-11 SubagentStart enforcement, denial tests, and real subagent execution remain open.
- **2026-05-14 23:59** — Cycle-62 Stream G harvested skill wave 8 closed after a repo-local `compact-hooks` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` for HARV-13 and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 420/420, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real compaction adapter invocation, hook firing proof, and live critical-state preservation remain open.
- **2026-05-14 23:59** — Cycle-63 Stream G harvested skill wave 9 closed after a repo-local `anti-bypass-clause` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` for HARV-18 and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 421/421, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Runtime permission enforcement, adapter hook wiring, and live bypass-attempt proof remain open.
- **2026-05-14 23:59** — Cycle-64 Stream G harvested skill wave 10 closed after a repo-local `prompt-cache-boundary` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` for HARV-17 and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 422/422, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Real prompt-cache integration, cache-hit/freshness proof, and invalidation runtime behavior remain open.
- **2026-05-14 23:59** — Cycle-65 Stream G harvested skill wave 11 closed after a repo-local `preference-router` SKILL.md fixture was added under `fixtures/hima-skills/harvested/project/.hima/skills/` for HARV-16 and validated through `resolveHimaSkill` plus locked `parseSkillFrontmatter` checks. Fresh evidence: core tests 423/423, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Live route evaluation, model/runtime execution, adapter behavior, and real `~/.hima` install proof remain open.
- **2026-05-14 23:59** — Cycle-66 completion audit closed after `docs/goals/completion-audit-runtime-boundary.md` mapped every remaining open master-goal row family to concrete evidence or blockers. Fresh evidence: `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction goal remains incomplete at 110/153 (71.9%) because real runtime/model/user-home/beta/publication evidence is still absent.
- **2026-05-14 23:59** — Cycle-67 D-H7 hard-limits boundary closed after one narrow PreToolUse blocked-command-pattern guard was implemented in `packages/core/src/security/hard-limits.ts`. Fresh evidence: RED focused hook test failed before implementation, GREEN focused hook tests passed 425/425 after implementation, touched-file static check PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. Token budgets, subagent tool inheritance, spawn limits, and runtime adapter proof remain open.
- **2026-05-14 23:59** — Cycle-68 H2 API stability review closed after `docs/excellence-application/05-architecture/stream-h-api-stability-review.md` inventoried every current `packages/core/src/index.ts` export group and classified stable/provisional surfaces. Fresh evidence: touched-file static check PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The package remains private/unpublished and this does not claim npm/public release readiness.
- **2026-05-14 23:59** — Cycle-69 H4 claims register closed after `docs/business-model/claims-register.csv` seeded the highest-risk Stream H business/comparative claims with T1/T2/T3/T4 tiers, local sources or explicit external-source-needed markers, falsifiers, owners, and expiry dates. Fresh evidence: CSV required-column/source validation PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. This does not claim market validation, legal certification, beta completion, revenue, npm publication, sale-page launch, or real runtime/model sessions.
- **2026-05-14 23:59** — Cycle-70 H5 ICP worksheet closed after `docs/business-model/icp-worksheet.md` mapped primary, secondary, excluded, and anti-ICP segments with evidence-needed fields and kill conditions. Fresh evidence: worksheet structure check PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. No user contact, market validation, revenue, launch, legal certification, beta completion, or runtime/model session is claimed.
- **2026-05-14 23:59** — Cycle-71 H6 message hierarchy closed after `docs/business-model/message-hierarchy.md` directly sourced arXiv 2604.09409 for the 67 percent constructive logging-instruction noncompliance problem framing, mapped claims to `claims-register.csv`, and listed excluded launch/compliance/beta/revenue claims. Fresh evidence: message structure check PASS, CLM-014 source check PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. No launch, beta, revenue, legal certification, market validation, npm publication, sale-page readiness, or runtime/model session is claimed.
- **2026-05-14 23:59** — Cycle-72 H7 north-star metric closed after `docs/business-model/north-star-metric.md` defined activated governed task rate, `first_governed_task_activated`, numerator/denominator, instrumentation fields, guardrail metrics, review cadence, falsifiers, and public claim rules. Fresh evidence: metric structure check PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. No measured activation, retention, beta completion, revenue, legal certification, market validation, npm publication, sale-page readiness, public release, or runtime/model session is claimed.
- **2026-05-14 23:59** — Cycle-73 runtime/external evidence boundary closed after `docs/goals/runtime-external-evidence-boundary.md` mapped the remaining 39 open checklist rows to real evidence, authorization classes, and stop conditions, and `docs/goals/completion-audit-runtime-boundary.md` was refreshed from 110/153 to 116/155. Fresh evidence: boundary ledger structure PASS, completion-audit refresh PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. This does not close runtime, real `~/.hima`, beta, npm, release, sale-page, payment, revenue, legal-compliance, or market-validation requirements.
- **2026-05-14 23:59** — Cycle-74 H2 API row reconciliation closed after `docs/goals/h2-api-row-reconciliation.md` rechecked the Cycle 68 export inventory against the current `packages/core/src/index.ts` barrel and confirmed `packages/core/package.json` remains private, `0.0.0`, and `UNLICENSED`. Fresh evidence: H2 reconciliation structure PASS, internal-label sweep PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger is now 117/155 (75.5%); this does not claim npm/public release readiness, public v1 API compatibility, H1 documentation drift closure, H3 OS install proof, runtime sessions, beta, payment, revenue, launch, or legal-compliance evidence.
- **2026-05-14 23:59** — Cycle-75 H1 documentation drift review closed after `docs/goals/h1-documentation-drift-review.md` re-read conception specs `00` through `11` against current code anchors and amended drift in `05-gates-policy-spec.md`, `06-skills-catalog-spec.md`, `07-subagents-catalog-spec.md`, and `10-core-api-spec.md`. Fresh evidence: H1 review structure PASS, drift-amendment anchor PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger is now 118/155 (76.1%); this does not claim H3 OS install proof, runtime/model sessions, real `~/.hima` installs, beta, npm publication, public release, sale-page, payment, revenue, launch, benchmark, stress, external SIEM, or legal-compliance evidence.
- **2026-05-14 23:59** — Cycle-76 H3 install-matrix preparation closed after `docs/goals/h3-install-matrix-preparation.md` defined required Linux/macOS/Windows transcript fields, future OS command templates, and local install/lifecycle/self-test/digest preflight evidence. Fresh evidence: H3 preparation structure PASS, command-shape check PASS, H3 master truth PASS, boundary refresh PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 118/155 (76.1%) because H3 is still open until real OS install transcripts exist; this does not claim OS install proof, runtime/model sessions, real `~/.hima` installs, beta, npm publication, public release, sale-page, payment, revenue, launch, benchmark, stress, external SIEM, or legal-compliance evidence.
- **2026-05-14 23:59** — Cycle-77 hard-limits residual reconciliation closed after `packages/core/src/security/hard-limits.ts` and `packages/core/src/gates/evaluate-gate.ts` added a tested 15-active-subagent spawn cap for normalized `subagent_start` payloads and persisted `runSet.subagents[]`. Fresh evidence: RED focused test failed before implementation, GREEN focused core tests passed 426/426, hard-limit ordering check PASS, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger is now 119/155 (76.8%); this does not claim token-budget enforcement, inherited subagent tool-deny projection, runtime adapter proof, H3 OS install proof, runtime/model sessions, real `~/.hima` installs, beta, npm publication, public release, sale-page, payment, revenue, launch, benchmark, stress, external SIEM, or legal-compliance evidence.
- **2026-05-14 23:59** — Cycle-78 runtime evidence authorization preparation closed after `docs/goals/runtime-evidence-authorization-prep.md` mapped required authorization fields, runtime target prerequisites, transcript retention, and stop conditions for future Claude/Codex/Hermes, runtime parity, and benchmark runs. Fresh evidence: absent runtime parity preflight PASS with `executionAllowed: false` and `externalSessionsLaunched: false`, absent benchmark preflight PASS with `executionAllowed: false` and `externalSessionsLaunched: false`, authorization field check PASS, runtime target runbook PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%); this does not authorize or claim runtime/model sessions, benchmark execution, H3 OS install proof, real `~/.hima` installs, beta, npm publication, public release, sale-page, payment, revenue, launch, legal certification, market validation, stress, or external SIEM evidence.
- **2026-05-14 23:59** — Cycle-79 H3 CI install-matrix local workflow preparation closed after `.github/workflows/h3-install-matrix.yml`, `scripts/h3-install-matrix-transcript.ps1`, and `docs/goals/h3-ci-install-matrix-local-workflow-prep.md` defined a manual-only Linux/macOS/Windows transcript workflow for future H3 evidence. Fresh evidence: workflow trigger check PASS, matrix check PASS, PowerShell parse PASS, transcript-linkage check PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because the workflow was not run and no accepted OS transcripts exist; this does not claim H3 OS install proof, runtime/model sessions, benchmark execution, real `~/.hima` installs, beta, npm publication, public release, sale-page, payment, revenue, launch, legal certification, market validation, stress, or external SIEM evidence.
- **2026-05-14 23:59** — Cycle-80 adapter E2E authorization blocker review closed after `docs/goals/adapter-e2e-authorization-blocker-review.md` mapped Claude, Codex, and Hermes E2E blockers to current package tests, prior smoke evidence, Cycle 78 authorization prerequisites, and target-specific stop conditions. Fresh evidence: adapter test inventory PASS, runtime-smoke grounding PASS, master truth refresh PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because no runtime/model session was launched and no adapter `e2e.test.ts` exists; this does not claim adapter runtime proof, H3 OS install proof, benchmark execution, real `~/.hima` installs, beta, npm publication, public release, sale-page, payment, revenue, launch, legal certification, market validation, stress, or external SIEM evidence.
- **2026-05-15 00:00** — Cycle-81 real user-home install authorization preparation closed after `docs/goals/real-user-home-install-authorization-prep.md` mapped the eight book-skill real install rows and eleven harvested-skill rows to current fixture evidence, core scoped install/resolver APIs, missing authorization, backup/restore prerequisites, and stop conditions. Fresh evidence: fixture inventory PASS, core install API review PASS, CLI boundary review PASS, master truth refresh PASS, `docs:index`, `lint`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because no real `~/.hima` write, resolver proof from real user-home, runtime invocation, adapter session, benchmark, H3 OS transcript, beta, publication, payment, legal, market, or SIEM evidence was produced.
- **2026-05-15 00:00** — Cycle-82 HARV-08 typed human-handoff local service closed after `packages/core/src/services/request-human-input.ts` added typed request validation, `.planning/09-logs/handoffs.jsonl` capture, replay parsing, and `HUMAN_INPUT_REQUESTED` run-set event emission, with `packages/core/test/request-human-input.test.ts` covering validation, append order, replay, malformed logs, and event correlation. Fresh evidence: core tests 431/431, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-08 still lacks live runtime skill invocation and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-83 HARV-09 prompt-injection scanner local proof closed after `packages/core/src/security/prompt-injection-scan.ts` added deterministic threat-pattern and invisible-Unicode scanning, and `packages/core/src/gates/evaluate-gate.ts` added local `session_start` warnings for normalized prompt/metadata scanner hits. Fresh evidence: core tests 436/436, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-09 still lacks live runtime SessionStart blocking, real context-file load prevention, runtime invocation, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-84 HARV-11 subagent tool-deny local proof closed after `packages/core/src/hooks/hook-payload.ts` normalized SubagentStart tool policy fields and `packages/core/src/gates/evaluate-gate.ts` blocked local subagent launches that request default-denied `todowrite`/`task` tools or inherited-denied tools. Fresh evidence: core tests 440/440, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-11 still lacks live subagent runtime execution, adapter permission projection, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-85 HARV-02 skill-linting local proof closed after `packages/core/src/install/skill-lint.ts` added a deterministic 44-rule SKILL.md lint catalog and `lintSkillMarkdown` API with valid fixture, malformed fixture, and catalog uniqueness tests. Fresh evidence: core tests 444/444, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-02 still lacks CI enforcement, full agnix 423-rule parity decision, live runtime scans, and real `~/.hima` scan proof.
- **2026-05-15 00:00** — Cycle-86 HARV-04 mode state-machine local proof closed after `packages/core/src/state-machine/mode-exclusion.ts` added deterministic workflow-mode families, overlap rules, source-verified auto-complete transitions, activation decisions, errors, and assertions, with `packages/core/test/mode-exclusion.test.ts` covering valid/invalid relationships, rollback denial, auto-complete behavior, and catalog integrity. Fresh evidence: core tests 449/449 before full-gate rerun, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-04 still lacks live runtime persistence, hook wiring, adapter behavior, real invocation, real `~/.hima` install proof, and historical ten-transition parity review.
- **2026-05-15 00:00** — Cycle-87 HARV-07 layered evidence-gate local proof closed after `packages/core/src/evidence/evaluate-evidence.ts` added deterministic eval-suite, held-out-split, and suite-promotion metadata checks, with `packages/core/test/evidence.test.ts` covering missing layer rejection, ordered local progression, per-layer required keys, untrusted evidence, and catalog integrity. Fresh evidence: core tests 454/454 before full-gate rerun, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-07 still lacks held-out evaluator execution, suite promotion automation, real runtime/model session evidence, adapter behavior, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-88 HARV-13 compaction hook local proof closed after `packages/core/src/gates/compaction-continuity.ts` extracted deterministic critical-state preservation checks and `packages/core/src/gates/evaluate-gate.ts` reused them for existing PostCompact continuity behavior. Fresh evidence: core tests 460/460 before full-gate rerun, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-13 still lacks real compaction adapter invocation, runtime hook firing proof, live critical-state preservation, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-89 HARV-17 prompt-cache boundary local proof closed after `packages/core/src/runtime/prompt-cache-boundary.ts` added deterministic `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` splitting, stale snapshot bypass, explicit invalidation-signal bypass, dynamic-state leak detection, and catalog tests. Fresh evidence: core tests 465/465 before full-gate rerun, `docs:index`, `lint`, `build`, post-tool dry-run allow, and saturation critic PASS. The construction ledger remains 119/155 (76.8%) because HARV-17 still lacks real prompt-cache integration, cache-hit/freshness proof, live invalidation behavior, adapter behavior, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-90 H3 partial execution produced `docs/goals/evidence/h3-install-windows.md` from the real local Windows environment after `scripts/h3-install-matrix-transcript.ps1` was corrected to initialize `.planning` state before runtime probe binding. Fresh evidence: Windows transcript records Windows 10.0.19045/X64, Node 20.19.0, pnpm 10.33.2, all Claude/Codex/Hermes install/artifact/lifecycle/runtime-probe/self-test commands exited 0, and `Failure count | 0`. The construction ledger remains 119/155 (76.8%) because H3 still requires a macOS transcript before the H3 row can close.
- **2026-05-15 00:00** — Cycle-90 H3 partial execution also produced `docs/goals/evidence/h3-install-linux.md` from the real local WSL2 Ubuntu/Linux environment after `scripts/h3-install-matrix-transcript.sh` was added for Unix-like shells and both transcript scripts were updated to run non-interactive frozen dependency installs. Fresh evidence: Linux transcript records WSL2 Ubuntu/Linux `6.6.114.1-microsoft-standard-WSL2` x86_64, Node 22.22.2, pnpm 10.33.2, all Claude/Codex/Hermes install/artifact/lifecycle/runtime-probe/self-test commands exited 0, and `Failure count | 0`. The construction ledger remains 119/155 (76.8%) because H3 still requires a macOS transcript before the H3 row can close.
- **2026-05-15 00:00** — Cycle-90 closed as BLOCKED after Windows and Linux H3 PASS transcripts were preserved and macOS remained unavailable in the local Windows/WSL environment. `docs/goals/archive/cycle-90-BLOCKED-2026-05-15.md` records the blocker. H3 remains unchecked; CI may only substitute for macOS after explicit CI authorization.
- **2026-05-15 00:00** — Cycle-91 HARV-18 anti-bypass local detection closed after `packages/core/src/security/anti-bypass-clause.ts` centralized the anti-bypass finding catalog and `packages/core/src/gates/evaluate-gate.ts` reused it for `user_prompt`, `pre_tool`, `post_tool`, and `subagent_start`. Fresh focused evidence: `anti-bypass-clause.test.ts`, `gates.test.ts`, and `handle-hook.test.ts` passed 471/471 through the package runner before full-gate rerun. The construction ledger remains 119/155 (76.8%) because HARV-18 still lacks live runtime permission enforcement, adapter hook firing proof, real bypass-attempt transcripts, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-92 HARV-16 PreferenceRouter local proof closed after `packages/core/src/routing/preference-router.ts` added deterministic route-candidate evaluation for required signals, kill signals, score floor, priority ordering, and tie escalation. Fresh focused evidence: `preference-router.test.ts` and `router-cascade.test.ts` passed 476/476 through the package runner before full-gate rerun. The construction ledger remains 119/155 (76.8%) because HARV-16 still lacks live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-93 local blocker reconciliation closed after `docs/goals/local-blocker-reconciliation.md` refreshed the remaining open-row map and confirmed the construction ledger remains 119/155 (76.8%). Fresh evidence: open checklist extraction, H3 macOS absence check, HARV-01 fixture inspection, boundary refresh, docs index/lint/post-tool dry-run, and saturation critic PASS. The audit found HARV-01 local ai-slop-cleaner proof as the next local-safe lane; all runtime/model, real `~/.hima`, H3 macOS, beta, publication, payment, SIEM, legal, and market evidence blockers remain open.
- **2026-05-15 00:00** — Cycle-94 HARV-01 local ai-slop-cleaner proof closed after `packages/core/src/security/ai-slop-cleaner.ts` added deterministic cleanup/deslop detection and required cleanup-plan/regression-evidence findings, and `packages/core/src/gates/evaluate-gate.ts` wired it into local `post_tool` and traced `subagent_stop` evaluation. Fresh focused evidence: `ai-slop-cleaner.test.ts`, `gates.test.ts`, and `handle-hook.test.ts` passed 484/484 through the package runner before full-gate rerun. The construction ledger remains 119/155 (76.8%) because HARV-01 still lacks live runtime invocation, adapter hook firing proof, actual dogfood cleanup workflow execution, and real `~/.hima` install proof.
- **2026-05-15 00:00** — Cycle-95 post-HARV-01 residual boundary review closed after `docs/goals/post-harv01-residual-boundary-review.md` rechecked the remaining open master rows and found no additional safe local-only implementation lane. Fresh evidence: open checklist extraction, H3 evidence directory check, residual local-safe review, docs index/lint/post-tool dry-run, and saturation critic PASS. The construction ledger remains 119/155 (76.8%); the next branch is blocked on explicit macOS/CI, runtime/model, real user-home, benchmark/stress/SIEM, beta/user, publication/payment/launch, or legal/market authorization.
- **2026-05-15 00:00** — Cycle-96 remains BLOCKED but now has the smallest H3 authorization packet at `docs/goals/h3-macos-authorization-packet.md`, naming the real macOS host route, manual CI route, acceptance checks, and stop conditions for `docs/goals/evidence/h3-install-macos.md`. This does not change the construction ledger, does not create macOS evidence, and does not close H3; the ledger remains 119/155 (76.8%).
- **2026-05-15 00:00** — Cycle-96 remains BLOCKED and now also has a beta/release/payment/launch authorization packet at `docs/goals/beta-release-authorization-packet.md`, mapping H8 and I1-I6 to user-contact, privacy, publication, npm, hosting, Stripe, public-post, launch-snapshot, acceptance-evidence, and stop-condition fields. This does not contact users, publish, transact, post, create launch evidence, or close H8/I1-I6; the ledger remains 119/155 (76.8%).
- **2026-05-15 00:00** — Cycle-96 remains BLOCKED and now also has a stress/SIEM authorization packet at `docs/goals/stress-siem-authorization-packet.md`, mapping F4/F5/F6 to disposable stress-environment, external SIEM, data-retention, real H-class pack-source, legal-copy, critic, acceptance-evidence, and stop-condition fields. This does not run stress, transmit SIEM data, certify compliance, close Stream F, or change the ledger; the ledger remains 119/155 (76.8%).
- **2026-05-15 00:00** — Cycle-96 remains BLOCKED and now has `docs/goals/external-authorization-packet-coverage-audit.md`, which maps all 36 remaining unchecked master rows to existing authorization packets or prep surfaces. This closes no rows and advances no ledger count; the next real progress requires explicit external/environment authorization or a claim-bearing rescope, so the ledger remains 119/155 (76.8%).
- **2026-05-15 00:00** — Cycle-96 stop point archived as BLOCKED in `docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md`. The archive records packet coverage, verification evidence, and the explicit next allowed branches; it is not a DONE archive and does not change the construction ledger, which remains 119/155 (76.8%).
- **2026-05-15 00:00** — Cycle-96 blocked-state guard added at `scripts/guard-construction-blocked-state.mjs` and wired into `pnpm lint` plus `scripts/run-tests.mjs`, with `scripts/audit-construction-completion.mjs` also wired into `pnpm lint`. While the master ledger still has the Cycle 96 blocked shape, the guard enforces its own lint/test wiring, executable completion-audit script/test wiring, active Cycle 96 id, active BLOCKED status, external-evidence DONE criteria, preserved zero-failure Linux/Windows partial H3 evidence, required authorization packet/prep terms, the exact 36-open-row set, the coverage-audit 36-row packet map, missing macOS, launch, and adapter-E2E evidence paths, required packet/prep surfaces, and absence of stale ledger-advance or completion claims. Focused guard test PASS, including lint/test-wiring-removal, audit-lint/test-wiring-removal, cycle-id-drift, status-drift, weakened-short-term-boundary, stale-claim drift, partial-H3-evidence-drift, packet/prep-term-drift, fake-macOS-evidence, fake-adapter-E2E-placeholder, open-row-drift, packet-map-drift, and missing-prep-surface negative fixtures; root `pnpm test -- --bail` PASS with 53 Vitest files / 702 tests after the guard fixture ran. The construction ledger remains 119/155 (76.8%).
- **2026-05-15 00:00** — Cycle-96 executable completion audit added at `scripts/audit-construction-completion.mjs` with `scripts/audit-construction-completion.test.mjs` wired into `scripts/run-tests.mjs`. The audit reports `status: not_complete`, `119/155`, 36 open rows, exact open-row identity, Cycle 96 BLOCKED, a prompt-to-artifact checklist, a 36-entry per-row blocker checklist with machine-readable external blocker classes, coverage-family row-count checks, coverage-audit claim-boundary, verdict-boundary, and non-row external-mention checks, executable gate-wiring checks, authorization packet/prep surface checks, coverage-audit referenced-surface checks, authorization packet/prep required-term checks, partial H3 Linux/Windows transcript-boundary checks, stale completion-claim checks, next-allowed-branch checks, archived non-goal checks, archived blocker-table checks, archived verification-evidence checks, active DONE-criteria checks, active blocked-rationale checks, claim-bearing Falsifies-If field and anchor-resolution checks, exact machine-readable external-blocker list checks, 36 row-to-external-blocker checks, named completion-artifact absence checks for the macOS transcript, launch snapshot, and three adapter E2E files, aggregate audit issue-list checks, completion-status blocker checks that include audit issues, missing macOS/launch/adapter-E2E artifacts, and fails `--require-complete` until real external evidence or a claim-bearing rescope exists. The focused test also rejects fake open-row substitution with missing-expected, unexpected-row, unmapped-row diagnostics, an unmapped external blocker class, missing or unguarded coverage-map packet paths, coverage-map verdict overclaim drift, and non-row external-mention boundary drift, coverage-family count swaps that still total 36, coverage-audit boundary drift, broken Falsifies-If evidence anchors, removed audit lint/test wiring, packet/prep status or boundary drift, packet/prep required-term drift, partial-H3 zero-failure drift, stale ledger-advance claims, stale progress-percentage claims, stale 9/9 and 10/10 blocked-state guard count drift, stale blockedStateGuardChecks field-count drift, obsolete runtime Falsifies invariant-count drift, all-OS H3 completion drift, next-branch drift, archived non-goal drift, archived blocker drift, archived verification-evidence drift, active DONE-criteria drift, active blocked-rationale drift, synthetic completion-with-issues drift, plus fake macOS evidence, fake launch snapshots, and fake adapter-E2E placeholders while blocked. This is an audit guard only and does not close rows or change the ledger.
- **2026-05-15 00:00** — Claim-bearing Falsifies-If guard added at `scripts/validate-claim-bearing-falsifies.mjs` with `scripts/validate-claim-bearing-falsifies.test.mjs`, wired into `pnpm lint`, `scripts/run-tests.mjs`, and the construction-completion gate-wiring audit. The guard scans the master §3.2 scope, requires `kill-condition`, `checkpoint-date`, `evidence-anchor`, and `on-fail`, resolves local evidence anchors, and currently passes 215 files / 1,405 checks. This is a governance hardening pass only; it closes no rows and the ledger remains 119/155 (76.8%).
- **2026-05-15 00:00** — Runtime `post_tool` Falsifies-If gate parity tightened in `packages/core/src/gates/evaluate-gate.ts` and `packages/core/test/gates.test.ts`: the gate now matches the repo validator for top-of-file claim-bearing frontmatter, `this file` anchors, repo-local anchors with explanatory suffixes, and directory anchors, and the construction audit now checks 13 runtime Falsifies gate invariants. This is local runtime-governance hardening only; it does not create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — `handleHook` stop-lifecycle proof added in `packages/core/test/handle-hook.test.ts`: an invalid claim-bearing write produces an unresolved `MISSING_FALSIFIES_IF` post-tool policy event, persists it into the run set, and the later `stop` gate blocks with `UNRESOLVED_POLICY_VIOLATION`. The construction audit now checks 13 runtime Falsifies gate invariants. This is local lifecycle proof only; it does not create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Master-goal rescope preparation packet added at `docs/goals/master-goal-rescope-decision-packet.md`: the seventh allowed branch now has a guarded local decision template defining required rescope fields, explicit non-goals, replacement claim boundary, evidence downgrade, falsifiers, ledger update, and verification plan. This does not enact a rescope, close rows, authorize external work, create completion evidence, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 archive/audit truth-surface guard hardened so `docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md` must preserve the literal `archiveDeliveredArtifactChecks` audit field name alongside `blockedStateGuardChecks`, plus the aggregate audit issue-list, audit-issue status-blocker, and synthetic completion-with-issues fixture terms, with focused negative fixtures in `scripts/guard-construction-blocked-state.test.mjs`. This does not enact a rescope, close rows, authorize external work, create completion evidence, or change the 119/155 ledger.
- **2026-05-15 00:00** — Completion-audit to blocked-state-guard parity hardened: `scripts/audit-construction-completion.mjs` now exposes 11 `blockedStateGuardChecks` and fails if `scripts/guard-construction-blocked-state.mjs` stops protecting `docs/goals/master-goal-rescope-decision-packet.md`, `BLOCKED_RESCOPE_PACKET`, the non-rescope/non-evidence/no-ledger-change boundary, required rescope terms, stale-claim coverage, archived delivered-artifact field names, archived audit-issues and stale-count blocker terms, stale root-test counts, authorization-packet execution-ready drift, or the claim-bearing scan count. The focused audit test includes fixtures that remove the rescope packet, archive audit-issues/stale-count term, and authorization-packet drift term from the guard and expect failure. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Blocked-state archive drift guard hardened: `scripts/guard-construction-blocked-state.mjs` now fails if `docs/goals/archive/cycle-96-BLOCKED-2026-05-15.md` drops rescope-aware guard terms, drops the literal `archiveDeliveredArtifactChecks` audit field, drops aggregate audit issue-list or synthetic completion-with-issues terms, reverts to the stale 53-file/698-test root-suite count, omits the 215-file/1,405-check claim scan, or loses the rescope packet handoff path. `scripts/audit-construction-completion.mjs` now checks that these archive-drift protections remain in the blocked-state guard. This is local archive truth-surface hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for open-row-count drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-audit claims that the open-row count fell below the blocked 36-row baseline. Focused negative fixtures cover the drift. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for open-row-closure drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale open-row-closure assertions while the exact 36-row identity remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it closes no rows, creates no evidence, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for completion-artifact existence drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale claims that the missing macOS transcript artifact exists or that the missing adapter E2E artifacts exist/pass. Focused negative fixtures cover both drift classes. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for macOS-install-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale generic macOS install completion assertions that bypass the missing transcript artifact. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no macOS evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for manual-ci-h3-workflow-success drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale manual-CI H3 workflow success assertions while `docs/goals/evidence/h3-install-macos.md` remains absent. This is local audit hardening only; it runs no CI workflow, captures no macOS transcript, closes no H3 row, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for partial-h3-promotion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale two-OS transcript promotion while `docs/goals/evidence/h3-install-macos.md` remains absent. This is local audit hardening only; it creates no macOS evidence, closes no H3 row, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for adapter-e2e-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale generic adapter E2E completion assertions that bypass the missing runtime transcripts and E2E test files. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no runtime evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for adapter-production-readiness drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale adapter production-readiness assertions that bypass the missing runtime transcripts and E2E test files. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no runtime evidence, marks no adapter production-ready, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for adapter-hook/behavior-proof drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale adapter hook-firing or adapter-behavior proof assertions that bypass the missing live runtime transcripts. Focused negative fixtures cover the drift. This is local audit hardening only; it captures no adapter hook firing proof, verifies no live adapter behavior, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for unsupported/degraded-hook-upgrade drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale adapter hook semantic-promotion assertions that bypass the missing live runtime transcripts. Focused negative fixtures cover the drift. This is local audit hardening only; it captures no adapter hook firing proof, changes no hook semantics, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for five-client-compatibility drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale compatibility completion assertions while broader compatibility-matrix work remains future scope. Focused negative fixtures cover the drift. This is local audit hardening only; it runs no runtime sessions, creates no compatibility evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for release-tag-notes drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale v1.0.0 tag and release-notes publication assertions while the public-release row remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no public release artifact, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for global-install-success drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status assertions that `npm install -g @hima/cli` works while npm publication and release evidence remain externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it publishes no package, creates no install evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for public-release/payment/beta drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale completion wording across GitHub visibility, npm publication, sale-page/Stripe payment, beta survey, and launch-post lanes. Focused negative fixtures cover each drift class. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for npm-registry/test-transaction drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for npm-registry lookup success and sale-page Stripe test-transaction success while I3/I4 remain externally blocked. Focused negative fixtures cover both drift classes. This is local audit hardening only; it publishes no package, runs no transaction, creates no external evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for visibility-flip/launch-snapshot drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for GitHub visibility-flip success and launch-snapshot capture success while I1/I6 remain externally blocked. Focused negative fixtures cover both drift classes. This is local audit hardening only; it changes no repository visibility, creates no launch artifact, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for beta-participation drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for beta-user recruitment, participation, scenario completion, or survey-response collection while H8 remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it contacts no users, collects no survey data, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for beta-survey-result drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording that beta survey results met scenario-completion or pay-intent criteria while H8 remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it contacts no users, collects no survey data, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for founding-cohort-sales drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for license-sale success or cohort-limit success while release/payment evidence remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it sells no licenses, closes no cohort, creates no external evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for launch-post-link drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for captured or recorded public-post links while I5 remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it posts nothing publicly, records no external post evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for book-skill-real-install drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for real book-skill install success while real `~/.hima` write evidence remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it writes no user-home files, closes no book-skill rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for harvested-skill-real-install/invocation drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for harvested-skill real-install or live invocation success while real `~/.hima` write evidence and runtime/model session evidence remain externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it writes no user-home files, runs no live harvested-skill session, closes no HARV rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for runtime-suite/parity/critic drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale current-status wording for F1 runtime-suite completion, F3 cross-runtime parity completion, or F6 final Stream F critic completion while real runtime/model and benchmark/stress/SIEM evidence remain externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it runs no runtime suite, records no parity transcript, runs no final critic over real results, closes no Stream F rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for runtime-preflight-allowed drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale runtime preflight permission flips while real runtime/model execution remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it changes no authorization state, launches no runtime sessions, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for self-test-external-runtime-launch and benchmark-dry-run-unblocked drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale local self-test launch-flag and benchmark dry-run status promotions while real runtime/model and benchmark execution remain externally blocked. Focused negative fixtures cover both drift classes. This is local audit hardening only; it launches no runtime sessions, runs no benchmark, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for runtime/execution drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale completion wording across runtime/model sessions, real user-home installs, SWE-bench/benchmark execution, stress execution, and external SIEM ingest. Focused negative fixtures cover each drift class. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for siem-external-transmission drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale SIEM fixture external-transmission flips while the SIEM path remains local-fixture-only. Focused negative fixtures cover the drift. This is local audit hardening only; it transmits no SIEM data, creates no external evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for user-home-dry-run-write drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale dry-run write-promotion assertions while real `~/.hima` writes remain externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it performs no real user-home write, creates no install evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for user-home-backup-restore-complete drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale backup/restore proof-completion assertions while real `~/.hima` writes remain externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it performs no real user-home backup or restore, creates no install evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for fresh-machine-init drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale fresh-machine external `harness init` success wording while I3/I6 external install and launch evidence remain blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for rescope-status drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale wording that promotes the blocked master-goal rescope preparation branch into an enacted status. Focused negative fixtures cover the drift. This is local audit hardening only; it does not enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for business/legal/market drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale completion wording across revenue, legal-certification, market-validation, and compliance-certification lanes. Focused negative fixtures cover the drift. This is local audit hardening only; it does not create legal/market/revenue evidence, enact a rescope, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for authorization-granted drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale blocked-lane authorization-granted assertions. Focused negative fixtures cover the drift. This is local audit hardening only; it does not grant authorization, enact a rescope, create external evidence, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for authorization-packet execution-ready drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale wording that treats local authorization packets or coverage audits as permission to execute blocked external work. Focused negative fixtures cover the drift. This is local audit hardening only; it grants no authorization, runs no external command, creates no external evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for blocker-resolved drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale external-evidence-lane blocker-resolution assertions. Focused negative fixtures cover the drift. This is local audit hardening only; it clears no blocker, grants no authorization, enacts no rescope, creates no external evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for cycle-status-promotion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote Cycle 96 out of BLOCKED state or erase the external blocker list. Focused negative fixtures cover the drift. This is local audit hardening only; it changes no cycle status, clears no blocker, creates no external evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for external-evidence-present drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale generic external-evidence-present assertions that bypass the gated artifact checks. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for closure-ready drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale active-cycle closure-readiness assertions while Cycle 96 remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for require-complete-success drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale require-complete-success assertions while Cycle 96 remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for goal-achieved drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale construction-goal-achieved assertions while Cycle 96 remains externally blocked. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for test-green-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote local test, lint, or build status into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for audit-issues-empty-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote an empty local audit issue list into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for row-mapping-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote row-to-blocker mapping completeness into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for coverage-completeness-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote 36/36 packet/prep row coverage into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for blocker-list-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote exact external-blocker lists or classes into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for falsifies-if-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote claim-bearing/Falsifies-If validation into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for artifact-absence-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote required completion-artifact absence into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for status-blocker-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote status-blocker checks into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for done-criteria-proxy-completion drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale assertions that promote active DONE-criteria checks into construction completion. Focused negative fixtures cover the drift. This is local audit hardening only; it creates no external evidence, clears no blocker, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-claim coverage hardened for proxy-evidence drift: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale wording that promotes local packet/prep/audit surfaces into external completion evidence. Focused negative fixtures cover the drift. This is local audit hardening only; it does not create external evidence, enact a rescope, close rows, or change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 archive truth-surface hardened for authorization-packet execution-ready drift: `scripts/guard-construction-blocked-state.mjs` now requires the Cycle 96 archive to preserve that handoff term, and `scripts/audit-construction-completion.mjs` now verifies the guard itself preserves it. Focused negative fixtures cover both the archive-term and guard-term drift. This is archive/audit hardening only; it grants no authorization, creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for the expanded blocked-state guard: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale 10/10 blocked-state guard check claims after the audit surface moved to 11/11. Archive verification evidence now preserves both stale 9/9 and stale 10/10 count-drift terms. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for the runtime Falsifies gate field: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale lower-count `runtimeFalsifiesGateChecks` field claims after the runtime gate surface moved to 13 checks. Focused negative fixtures cover the drift. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for runtime gate-check ratios: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale lower-count runtime gate-check ratio claims after the runtime gate surface moved to 13 checks. Focused negative fixtures cover the drift. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for claim-bearing Falsifies-If field checks: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale lower-count `falsifiesFieldChecks` field claims and falsifies-field ratio claims after the claim-bearing Falsifies-If surface moved to 76 checks. Focused negative fixtures cover both drifts. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for authorization packet/prep/rescope required-term checks: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale lower-count `artifactTermChecks` field claims and required-term ratio claims after the required-term surface moved to 49 checks. Focused negative fixtures cover both drifts. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for authorization packet/prep/rescope surface checks: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale lower-count `artifactSurfaceChecks` field claims and surface-check ratio claims after the surface integrity checks moved to 21 checks. Focused negative fixtures cover both drifts. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.
- **2026-05-15 00:00** — Cycle-96 stale-count coverage hardened for coverage-audit referenced-surface checks: `scripts/guard-construction-blocked-state.mjs` and `scripts/audit-construction-completion.mjs` now reject stale lower-count `coverageSurfacePathChecks` field claims and referenced-surface ratio claims after the referenced-surface check set moved to 12 checks. Focused negative fixtures cover both drifts. This is count-truth hardening only; it creates no evidence, closes no rows, and does not change the 119/155 ledger.

---

## 17. The 3 things you should NOT forget

A future-you reading after weeks may forget the 3 most important nuances. They are:

1. **Saturation > thresholds, always.** §3.1. The user's critique 2026-05-14 PM established this as a permanent project rule. Numeric thresholds are necessary but never sufficient. Every cycle close requires a critic agent that tries to falsify and fails.
2. **Falsifies-If on every claim.** §3.2. Every claim-bearing artifact has a Falsifies-If block. Evidence-anchor must resolve to actual content (post the §8.4 tightening in stream B2). If a future agent fabricates a file:line citation, the gate blocks them. This rule applies to the future-you reading this file too.
3. **The runtime must run.** §5 stream A. The original 16-file DoR/DoD blocker is closed, but this remains the standing rule: later phases must keep proving real transitions, ledger writes, and evidence gates rather than treating documents as substitutes for runtime proof.

If you remember nothing else from this file, remember these three. The rest is implementation detail.

---

*End of COMPLETE-CONSTRUCTION-GOAL.md v1. Approximately 1,400 lines. Self-contained per the user's directive: "long, long, long; rien au hasard, tout est spécifié; prends ton temps." Invoke via `/goal follow the instructions in docs/goals/COMPLETE-CONSTRUCTION-GOAL.md`.*
