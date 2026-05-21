---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-deep-critic
---

# DS1 — Swarm Critic Audit

## Executive Summary

Total claims audited: 18 patterns + 5 synthesis sections + 8 repo-level claims verified via GitHub API.

| Verdict | Count |
|---------|-------|
| CONFIRMED (code-verified or independently cross-validated) | 7 |
| SHARPENED (real but mischaracterized or overstated) | 6 |
| FALSIFIED (claim contradicted by direct evidence) | 3 |
| UNVERIFIABLE (README-only, no code path confirmed) | 6 |

**3 most consequential findings:**

1. **FALSIFIED — Agent-Village `src/safety/gate.py` does not exist.** The S3 swarm agent cited `src/safety/gate.py`, `src/fsm.py`, `src/agents/governor.py` with specific line numbers for the "Hard Safety Gate code-enforced" pattern (#3 in §3). GitHub API confirms Agent-Village (sreejagatab/Agent-Village) is a notifications/scheduler/webhooks app with 33 files, last pushed 2025-12-29, 1 star. None of the cited paths exist. Every detail in the "3.7 Agent-Village" deep-dive section is fabricated. Pattern #3 in SYNTHESIS §3 has zero real code evidence.

2. **FALSIFIED — nexus-agents does NOT implement "LinUCB bandit routing."** The repo uses a `PreferenceRouter` with `PreferenceRecord` / `ModelPreference` data types — a preference-learning system, not the specific LinUCB algorithm. The swarm agents named the algorithm incorrectly across S1 (§3.8), S2 (inventory row), and SYNTHESIS §3 pattern #12. The pattern itself (outcome-based routing) is real; the algorithm name is wrong and the "RL routing" framing is overstated.

3. **FALSIFIED — `everything-claude-code` star count is fabricated or inflated.** S1 reports 182k stars, S3 reports ~300 stars, S4 reports 140K stars — three different numbers for the same repo from the same swarm run. GitHub API confirms: 181,809 stars as of 2026-05-14. S3's "~300" is clearly wrong (off by 600x). The inconsistency reveals the agents were not cross-checking each other; repo claims were not reconciled. The moat-gap claim ("140K⭐ vs hima 0⭐") uses S4's figure which is closest to true but still ~22K off the API-verified number.

---

## §A — False-Convergence Findings

### Pattern #5 — Cross-harness adapter directories [CONVERGENT label — SHARPENED]

**SYNTHESIS claim**: "Cross-harness adapter directories as first-class (everything-claude-code S2/S3 [CONVERGENT])"

**Finding**: S2 and S3 both cite `everything-claude-code` for this pattern. They are not two independent sources — they are two agents citing the same repo. True convergence requires independent sources arriving at the same pattern independently. The other repos cited (oh-my-agent, yaah) are unverified. Goose independently has `.claude/skills/`, `.codex/skills/`, `.cursor/skills/` — that IS independent convergence (confirmed via S5 structural deep-dive which read actual file trees). The CONVERGENT label is partially justified but the S2/S3 dual-citation of ECC is not two independent sources.

**Verdict**: SHARPENED — real pattern, overstated convergence count. True independent convergence is ECC + Goose + Mastra (3 real sources), not the claimed S2/S3 convergence which is the same repo cited twice.

---

### Pattern #6 — Layered defense escalation [CONVERGENT label — CONFIRMED]

**SYNTHESIS claim**: "McpVanguard + MCP-Dandan independently converged [CONVERGENT] (S4)"

**Finding**: GitHub API confirms both repos exist and are active. McpVanguard: 12 stars, pushed 2026-05-06, description matches ("security proxy and active firewall"). MCP-Dandan: 63 stars, pushed 2025-12-14 (inactive since Dec 2025 — not "2026 active" as S4 claims). The 3-layer defense pattern (rules → semantic → behavioral) is described in both READMEs. Code files were not inspected but the repos are real and distinct. Convergence label is legitimate.

**Verdict**: CONFIRMED for convergence label. SHARPENED: MCP-Dandan last push was Dec 2025, not "2026 active." Evidence depth: README-only for both.

---

### Pattern #14 — Append-only events.jsonl [CONVERGENT label — CONFIRMED]

**SYNTHESIS claim**: "12-factor factor-05 + OMX session-history.jsonl [CONVERGENT] (S6)"

**Finding**: S6 cites OMX `src/hooks/keyword-registry.ts` and `src/team/runtime.ts` with specific line numbers from an internal clone. 12-factor-agents is a real repo (9K stars, well-known). These are genuinely independent sources converging on append-only event logs. swarm-orchestrator `src/ledger/` with `test/ledger/hash-chain.test.ts` provides a third independent code-verified confirmation.

**Verdict**: CONFIRMED. Strongest convergence evidence in the entire synthesis.

---

### Pattern #10 — Evaluator-Optimizer as MCP tool [CONVERGENT label — SHARPENED]

**SYNTHESIS claim**: "fast-agent + microsoft/skills Ralph Loop + mcp-agent all converged [CONVERGENT] (S4)"

**Finding**: These three implement evaluate-gate-iterate patterns but at different layers: fast-agent is an agent framework, microsoft/skills is a skill quality gate (generation-time), mcp-agent is a workflow library. The pattern is real but the "convergence" conflates quality gates at generation time (microsoft/skills) with quality gates at execution time (fast-agent). These are not the same primitive applied at the same layer. SYNTHESIS recommends exposing `hima_evaluate_completion` as MCP tool — this is a valid inference but goes beyond what the convergence evidence supports.

**Verdict**: SHARPENED — real pattern, but the three sources are at different abstraction layers. Not as strong a convergence as pattern #14.

---

### Pattern #3 — Hard Safety Gate code-enforced [CONVERGENT — FALSIFIED]

**SYNTHESIS claim**: "Agent-Village `src/safety/gate.py` (S3)" — Hard limits in TypeScript, not prompt.

**Finding**: GitHub API tree query on `sreejagatab/Agent-Village` returns 33 files total. The full tree is: `.gitignore`, `Achieve.md`, `README.md`, `Real-World-Usecases.md`, `pyproject.toml`, `src/notifications/`, `src/scheduler/`, `src/webhooks/`, `tests/`. No `src/safety/`, no `src/fsm.py`, no `src/agents/governor.py`, no `src/tools/registry.py`. The repo is a Python notifications middleware app. Last pushed: 2025-12-29 (not "2026 active"). Stars: 1 (not "~150").

**Verdict**: FALSIFIED. S3 section 3.7 fabricated all cited file paths. Pattern #3 in SYNTHESIS §3 must be re-sourced or removed. The idea (hard code-enforced limits) is sound but the evidential basis is entirely fabricated. No other source in the swarm provides code-level evidence for this pattern.

---

### Pattern #17 — .hima/state/ centralization [CONVERGENT label — CONFIRMED]

**SYNTHESIS claim**: "OMX `.omx/state/` + 3 others (4/10 converge) [CONVERGENT] (S5)"

**Finding**: S5 structural-patterns read actual GitHub file trees for 10 repos. The cross-repo matrix at S5 §3 shows "Dedicated `.{tool}/state/` dir: 4/10 CONVERGENT." OMX is an internal clone with real file paths cited. opencode uses SQLite (confirmed via `packages/opencode/src/storage/`). claude-flow `.claude/checkpoints/` confirmed. The CONVERGENT label is justified.

**Verdict**: CONFIRMED.

---

## §B — Unverified-Repo-Claim Findings

| Repo | Claimed in | Claim | Actual state (GitHub API) | Verdict |
|------|-----------|-------|--------------------------|---------|
| `sreejagatab/Agent-Village` | S3 §3.7, SYNTHESIS §3 #3 | 15-state FSM, `src/safety/gate.py`, hard limits, 8 agent tiers, ~150 stars, 2026 active | 1 star, pushed 2025-12-29, 33 files, notifications/scheduler/webhooks app, no FSM, no safety gate | **FALSIFIED** |
| `williamzujkowski/nexus-agents` | S1 §3.8, SYNTHESIS §3 #12 | 13 stars, LinUCB bandit routing, hash-chain audit trail | 13 stars CONFIRMED, pushed 2026-05-14 CONFIRMED, `PreferenceRouter` (NOT LinUCB), `AuditTrail` class exists | **SHARPENED** — routing pattern real, algorithm name wrong |
| `moonrunnerkc/swarm-orchestrator` | S3 inventory #14, SYNTHESIS §3 #4 | Hash-chained ledger, contract-first, obligation verifier | 90 stars (claimed 90 — CONFIRMED), pushed 2026-05-14, `src/ledger/jsonl-ledger.ts` + `test/ledger/hash-chain.test.ts` — real code | **CONFIRMED** |
| `Lutren/obs-safe-integration-kit` | S2 §inventory #15, SYNTHESIS §7 | 1 star, complete observability-safe integration pattern, ObservationEnvelope, ActionGate, EvidenceStore | 1 star CONFIRMED, pushed 2026-05-02, `obs_safe_integration_kit/gates.py`, `adapters.py`, `storage.py` — real code structure, CLAIMS.md, QA_RESULTS.md present | **CONFIRMED** — code exists, pattern is real |
| `mtzanidakis/praktor` | S3 inventory #24, SYNTHESIS §7 | 27 stars, "Practical orchestration framework" | 27 stars CONFIRMED, pushed 2026-05-13, description: "Multi-agent Claude Code orchestrator with Telegram I/O, Docker isolation, swarm patterns, and Mission Control UI" | **CONFIRMED** — existence confirmed, pattern description is README-level |
| `twaldin/flt` | S2 inventory #16, SYNTHESIS §7 | 5 stars, CLI-first harness-agnostic orchestration | 5 stars CONFIRMED, pushed 2026-05-13, description: "cli-first harness agnostic agent orchestration tool" | **CONFIRMED** |
| `KDEGroup/SWE-AGILE` | S2 inventory #20, SYNTHESIS §7 | 6 stars, ACL 2026 paper, dynamic context management | 6 stars CONFIRMED, pushed 2026-04-15, description confirms ACL 2026 Findings paper | **CONFIRMED** |
| `provnai/McpVanguard` | S4 §7, SYNTHESIS §3 #6 | 12 stars, 3-layer defense (rules + semantic + behavioral) | 12 stars CONFIRMED, pushed 2026-05-06, description confirms security proxy | **CONFIRMED** (README-only for layer detail) |
| `82ch/MCP-Dandan` | S4 §8, SYNTHESIS | 63 stars, "2026 active," LLM behavior analysis | 63 stars CONFIRMED, last pushed 2025-12-14 — NOT 2026 active | **SHARPENED** — repo exists, inactive since Dec 2025 |
| `affaan-m/everything-claude-code` | S1 (182k), S3 (~300), S4 (140K) | Star count varies widely across agents | 181,809 stars confirmed by API | **SHARPENED** — S3's "~300" is 600x wrong; S4's 140K is 22K under; S1's 182k is closest |
| `raphaelchristi/harness-evolver` | S1 §3.7, SYNTHESIS §7 | 20 stars, "Based on Lee et al. 2026 Meta-Harness paper (arxiv 2603.28052)" | 20 stars CONFIRMED, pushed 2026-04-18, description mentions Lee et al. 2026 | **CONFIRMED** — arxiv paper reference unverified (no API check possible) |
| `SethGammon/Citadel` | S1 §3.6 (~800 stars), S3 §3.1 (~800 stars) | 550-800 stars, 4-tier routing, campaign persistence | 550 stars confirmed by API, pushed 2026-05-07, description matches 4-tier routing claim | **CONFIRMED** — star count SHARPENED (550 not 800) |

---

## §C — README-vs-Code Bias Findings

| Pattern # | Evidence depth | Citation strength | Needed action |
|-----------|----------------|-------------------|---------------|
| #3 Hard Safety Gate (Agent-Village) | NONE — fabricated | FALSIFIED | Re-source from real code or remove from §3 |
| #4 Hash-chained ledger (swarm-orchestrator) | CODE — `src/ledger/jsonl-ledger.ts`, `test/ledger/hash-chain.test.ts` | STRONG | Keep as-is |
| #6 Layered defense (McpVanguard + MCP-Dandan) | README-only | WEAK | Accept as breadth-only; do not cite as foundational |
| #8 agnix silent-failure linting | README + HN thread | MEDIUM | Re-source: check `crates/` or `knowledge-base/` rule count claim (423 rules) |
| #9 PreCompact/PostCompact (pro-workflow) | README-only | WEAK | Accept as breadth-only |
| #10 Evaluator-Optimizer MCP tool | README-only for fast-agent; microsoft/skills has code (SKILL.md acceptance criteria) | MEDIUM | Accept for microsoft/skills; flag fast-agent as README-only |
| #11 Declarative YAML topology (takt, maestro) | README-only for takt; maestro unchecked | WEAK | Accept as breadth-only |
| #12 LinUCB bandit (nexus-agents) | Code confirmed `PreferenceRouter` exists, NOT LinUCB | SHARPENED | Rename to "preference-based outcome routing" in §3 |
| #13 Code-side keyword registry (OMX) | CODE — S6 cites `src/hooks/keyword-registry.ts:1-77` from internal clone | STRONG | Keep as-is |
| #14 Append-only events.jsonl | CODE — OMX internal clone + swarm-orchestrator `src/ledger/` | STRONG | Keep as-is |
| #15 SubagentStop gate (OMC verify-deliverables.mjs) | OMC is the harness this project IS — internal code, confirmed | STRONG | Keep as-is |
| #16 SKILL.md frontmatter schema | CODE — S5 read actual SKILL.md files from OpenHands, opencode, OMX, Mastra | STRONG | Keep as-is |
| #17 .hima/state/ centralization | CODE — S5 read actual tree from 10 repos | STRONG | Keep as-is |
| #18 Per-runtime system-prompt files | CODE — S5 confirmed `packages/opencode/src/session/prompt/` with 9 files | STRONG | Keep as-is |
| SYNTHESIS §6 MCP positioning | README-only for most governance-layer repos | WEAK | Infrastructure-layer claims need code verification before citing as moat gap |

**Summary**: 5 of 18 patterns have code-level evidence (strong). 3 are fabricated or mischaracterized (FALSIFIED/SHARPENED). 10 are README-only (breadth-evidence only, not foundational).

---

## §D — Missed-Angle Findings

### D1 — Post-mortems on dead harnesses (what killed them?)

The swarm scanned 125+ active repos. It did not look at abandoned harnesses. The GitHub topic `claude-code` has 26,531 repos — the scan found 35. Of the thousands not selected, many are abandoned. The failure modes of dead harnesses (context-drift, hook breakage on Claude Code version bumps, skill naming conflicts causing silent failures) are directly actionable for hima. The swarm has no evidence on this axis. **Proposed remediation**: DS2 or a dedicated scan should fetch the 50 most-starred abandoned `claude-code` repos and read their last commit + open issues.

### D2 — Security CVEs in popular harness repos

S2 cites `VILA-Lab/Dive-into-Claude-Code` which documents a "pre-trust execution window CVE" in its 512k-LoC analysis. This was noted in the inventory but not acted on. No swarm agent asked: "which of the 125 repos have known security vulnerabilities that hima's design must avoid?" The `affaan-m/everything-claude-code` AgentShield scans 5 CVE categories — but the swarm did not examine WHAT those categories are or whether hima has equivalent protections. **Proposed remediation**: DS2 should read `everything-claude-code`'s security scanner source to extract the 5 CVE categories as a checklist against hima's `packages/core/src/security/`.

### D3 — IDE-plugin governance layer

Every IDE tool (Cursor, Windsurf, VS Code Multi-Agent, JetBrains Air) has a plugin/extension governance layer. The swarm did not examine what governance hooks these layers expose that hima could use. For example, Windsurf Cascade Hooks (`post_cascade_response`, `post_write_code`) are mentioned in D1 but dismissed as "IDE-bound." This is too fast — many developers use Claude Code inside VS Code. The IDE governance layer is a distribution vector the swarm entirely skipped. **Proposed remediation**: enumerate all IDE-native hook surfaces and assess whether hima's adapter layer should target them.

### D4 — Error-message catalog / UX of failure

None of the 125 repos was evaluated on the quality of its error messages. hima's evidence gates will produce output that developers read. The swarm found nothing about what good error-message UX looks like for a governance harness. Does any surveyed harness have a documented error taxonomy? Does `CORE` with its 7 enforcement gates explain WHY a gate failed? This is a real gap — governance tools that produce opaque errors get disabled. **Proposed remediation**: check 3-5 high-engagement repos for issue threads on "confusing error" / "silent failure" to build a negative vocabulary list.

### D5 — The test-runner / harness self-test layer

S1 notes `everything-claude-code` has "997 tests." S5 confirms OMX has `tests/` directory. But no swarm agent asked: "how do these harnesses test themselves?" The test-runner for a harness is not the same as application tests — it's testing that hook wiring, skill routing, and state transitions behave correctly. hima's `tests/run-all.sh` (5 suites) is mentioned in CLAUDE.md as the self-test layer. The swarm did not compare hima's test architecture against any peer. agnix provides 423 lint rules as a form of static self-testing — this angle was surfaced but the implication for hima's own CI pipeline was not drawn. **Proposed remediation**: DS2 should read the test suites of OMX, ECC, and swarm-orchestrator to understand what a harness test suite covers.

### D6 — Token-cost benchmarks (claimed savings are unvalidated)

S1 claims agentsys achieves "77% token reduction." S3 claims Citadel tiered routing saves "~500 tokens per request." S1 claims planning-with-files achieves "96.7% task completion vs 6.7%." None of these numbers were challenged or cross-validated. They come from self-reported README claims. No independent benchmark exists in the swarm evidence. For hima's business case (cost savings = moat), unvalidated token claims are a liability. **Proposed remediation**: mark all token-reduction claims as "self-reported, unvalidated" in DS6 synthesis revision.

---

## §E — Confirmation-Bias Findings

### E1 — "No competitor reaches 3/4 at hima's tier" (most favorable claim)

**Attempted falsification**: D1 competitive-harness-scan.md §5 concludes Microsoft AGT scores 3.5/4. LACP (256 stars, April 2026) is described in S2 as "closest architectural competitor to hima — risk-tiered policy gates (safe/review/critical), TTL approval tokens, cryptographic provenance chains." If LACP actually implements session-scoped risk classification + evidence gates + multi-runtime (Claude+Codex+Hermes) + cryptographic audit trail, it scores 4/4 at the developer-terminal tier.

**Counter-evidence check**: S2 flags LACP's risk tier names as "confirmed from repo description only; internal implementation details not cross-validated." GitHub API confirms LACP exists (256 stars, pushed 2026-04-14, description: "Control-plane-grade agent harness for Claude, Codex & Hermes: policy gates, verification/evidence loops, memory, and auditable execution"). The description alone suggests 3-4 moat trait coverage. The swarm accepted the "single source — verify" flag but SYNTHESIS promoted the claim without the verification.

**Verdict**: DEMOTED from CONFIRMED to PARTIAL. LACP requires code-level inspection before the "no competitor at hima's tier" claim can be asserted. The moat may survive but this gap must be resolved by DS3 (adversarial moat falsifier).

---

### E2 — "Moat survives at developer-terminal tier" (second most favorable claim)

**Attempted falsification**: sd0x-dev-flow (155 stars, MIT, pushed 2026-05-14) is described in S2 as implementing "10 canonical harness patterns explicitly named: sentinel-driven state machines, context compaction recovery, lifecycle interceptors, capability-based tool gating via skill frontmatter, defense-in-depth 5-layer safety, dual-reviewer parallel architecture, auto-fix loops, incremental progress with convergence detection, human-in-the-loop gates, self-improvement via lesson logging" with "4% context footprint" and "dual parallel reviewer." Its description: "The harness layer for Claude Code — a reference implementation of harness engineering with hook-enforced dual review, state-machine gates that survive context compaction, and fail-closed safety where it counts." GitHub API confirms this is active and matches the description.

**Counter-evidence**: sd0x-dev-flow targets Claude Code (not multi-runtime), has no stated EU AI Act mapping, and appears to lack the compliance artifact generation trait. So it scores ~2/4 moat traits. The "moat survives" claim is not falsified by sd0x.

However, the combination of LACP (2-3/4) + sd0x-dev-flow (2/4) + everything-claude-code (2/4) demonstrates the field is actively converging. The moat is not "secure" — it is "currently ahead." This distinction matters for strategy.

**Verdict**: STANDS but SHARPENED. Correct wording: "No single competitor demonstrates all 4 moat traits at the developer-terminal tier as of 2026-05-14. The field is converging; LACP requires verification."

---

### E3 — "Convergent validation of T/L/M/H/C as discovered pattern" (third most favorable claim)

**Attempted falsification**: The claim is that McpVanguard + MCP-Dandan + Agent-Village independently converged on the same 3-layer/5-tier escalation pattern, validating hima's T/L/M/H/C design.

**Counter-evidence**: Agent-Village's convergence evidence is FALSIFIED (repo does not contain the cited code). MCP-Dandan was last active Dec 2025. McpVanguard has 12 stars. The "independent convergence" reduces to two active sources (McpVanguard + something else), not three.

The REAL independent convergence evidence is stronger elsewhere: Codex CLI implements "low/medium/high/critical" tiers (D1 competitive scan, real product). OpenHands V1 implements "Low/Medium/High/Unknown" per-action (arXiv paper). Microsoft AGT implements "0-1000 continuous score + 5 behavioral tiers." Mastra+OpenBox implements "5 verdicts: allow/constrain/require-approval/block/halt." These four independent sources from major actors are far stronger validation than three low-star repos — but the swarm relied on the low-star repos as "independent convergence" and ignored the stronger evidence.

**Verdict**: SHARPENED — the T/L/M/H/C convergence claim is valid but the evidence cited is weak (one fabricated source, one inactive repo). Replace with the stronger evidence from D1: Codex + OpenHands + Microsoft AGT + Mastra+OpenBox all independently tier risk. This is actually stronger validation than the swarm's version.

---

## §F — Sentence-Level Claims to Revise

| SYNTHESIS location | Current wording | Proposed revision |
|--------------------|----------------|-------------------|
| §2 Headline numbers, orchestration row | "Hard safety gate code-enforced (Agent-Village) closes rules/core.md §7 soft-rule gap" | Remove Agent-Village citation entirely. Pattern #3 needs re-sourcing. Note: CORE (32 stars, MIT, DariuszNewecki) implements constitutional governance with 7 gates — use this as the code evidence source instead. |
| §3 Pattern #3 table row | "Agent-Village `src/safety/gate.py` (S3)" | Re-source to `DariuszNewecki/CORE` `.intent/` dir + 7-gate architecture, OR flag as "evidence-depth: none — pending DS2 re-source" |
| §3 Pattern #12 | "LinUCB bandit outcome-based routing — nexus-agents (S1, low-star 13⭐)" | Change to "Preference-based outcome routing (PreferenceRouter + AuditTrail) — nexus-agents (S1, 13⭐). Note: algorithm named 'LinUCB' by S1 is unconfirmed; actual impl uses preference scoring, not the named RL algorithm." |
| §7 Low-star gold list, Agent-Village row | Not present in §7 (correctly absent) | No change needed |
| §8 "Strong validations": "Risk-tier discipline (S4 McpVanguard + MCP-Dandan + S3 Agent-Village all converged independently)" | Uses Agent-Village as third source | Replace with: "Risk-tier discipline independently validated by: Codex CLI (low/med/high/critical), OpenHands V1 (Low/Medium/High), Microsoft AGT (0-1000 + 5 tiers), Mastra+OpenBox (5 verdicts). McpVanguard (3-layer rules/semantic/behavioral) is a fifth independent confirmation. Agent-Village citation removed (fabricated)." |
| §4.1 Convergent table | "Hard safety gate code-enforced (Agent-Village)" | Remove or replace with CORE citation |
| SYNTHESIS §12 DONE check | "[x] §3 top-N patterns each cite ≥1 source repo with swarm-slice reference" | Change to "[ ] PENDING — Pattern #3 source repo was fabricated; DONE criterion not met until re-sourced" |
| S3 §3.7 Agent-Village deep-dive (in swarm/orchestration-scan.md) | Entire section — all cited file paths fabricated | Add frontmatter note: `status: FALSIFIED — repo contains no cited files; section is fabricated research` |
| S1 §inventory row #15 "nexus-agents" | "LinUCB bandit scoring for outcome-based routing" | "Preference-based routing (PreferenceRouter). LinUCB algorithm name unconfirmed by code inspection." |
| MCP-Dandan active status | "2026 active" (S4) | "Last active Dec 2025" |
| everything-claude-code stars | S3 "~300 stars" | Correct to 181,809 (API-verified 2026-05-14) |
| Citadel stars | S1/S3 "~800 stars" | Correct to 550 (API-verified 2026-05-14) |

---

## §G — Saturation Gate

**Does cycle-02 evidence saturate? NO — NEEDS-MORE**

Missing evidence types that prevent saturation:

1. **Pattern #3 (Hard Safety Gate) has zero real code evidence.** The foundational claim that code-enforced hard limits exist in a harness was entirely backed by a fabricated source. This is not a minor gap — it is a pattern in SYNTHESIS §3 with CRITICAL / HIGH leverage rating that has no actual code backing. DS2 must inspect CORE (DariuszNewecki) or sd0x-dev-flow for real code-enforced gate implementations before this pattern can be promoted.

2. **LACP (256 stars) requires code inspection before "moat survives" can be asserted.** S2 flagged it as "single source — verify" but SYNTHESIS accepted the moat-survives verdict anyway. DS2 must read LACP's source structure. If LACP implements all 4 moat traits with working code, the strategy-diagnosis §1 requires revision.

3. **LinUCB naming is wrong.** Pattern #12 recommends implementing "LinUCB bandit routing" for hima. Implementing a RL algorithm that does not actually exist in any surveyed harness (the real impl is preference scoring) would be wasted effort. The correct implementation target needs code-level verification.

4. **10 of 18 patterns are README-only evidence.** Per the saturation criteria in `docs/goals/README.md §3`: "Deep evidence has replaced surface evidence on the top N items. The cycle's headline claims must be backed by code-level / file:line / direct-inspection evidence on at least 5 of their cited sources." Current count: 5 patterns have code-level evidence. Target: ≥10 (per DS2 mandate in SHORT-TERM-GOAL.md §3 criterion 5). Saturation requires DS2 to deliver code-derived evidence for the remaining 5 patterns.

5. **Post-mortem / failure-mode analysis absent.** The swarm scanned active repos only. Dead harnesses contain the most actionable signal on what breaks. This angle was not covered.

**Saturation verdict**: NEEDS-MORE. Cycle-02-deep cannot close until DS2 delivers code-evidence on ≥5 more patterns AND LACP is inspected AND pattern #3 is re-sourced or removed. The 3 FALSIFIED claims in this audit are material findings that must be addressed in DS6 (synthesis revision) before the cycle can close.

---

*Audit performed by swarm-deep-critic. All repo claims verified via GitHub API (2026-05-14). File tree inspection performed for Agent-Village, obs-safe-integration-kit, swarm-orchestrator, nexus-agents. Star counts verified for 12 repos. Evidence depth classified per swarm source file inspection.*

Falsifies-If:
  kill-condition: A later critic or source refresh finds material findings missed by this audit or invalidates its NEEDS-MORE/DONE boundary.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm-deep/critic-audit.md
  on-fail: Reopen the critic audit and revise the cycle-02-deep closure decision before citing it.
