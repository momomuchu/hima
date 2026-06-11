---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
agent: swarm-deep-saturation
verdict: NEAR-SATURATED
new-ratio: 27%
candidates-tested: 26
new-repos: 7
overlap-repos: 19
---

# Saturation Measurement — Cycle-02-Deep

## Executive Summary

Fresh-strategy search (GitHub Advanced Search qualifiers + agentic-coding topic page sorted by `updated`, NOT topic-listing browsing used by S1-S4) surfaced **26 candidate repos** against the 164-entry known cycle-02 corpus. **7 are genuinely new** (not in S1-S4 / D1 / prior-research): `basilisk-labs/agentplane`, `china-qijizhifeng/agentic-harness-engineering`, `JeiKeiLim/tenet`, `shawnpetros/salazar`, `trevor-nichols/agentrules-architect`, `dirac-run/dirac`, and `BulloRosso/etienne`. New-to-overlap ratio = **7/26 = 27%**. Per the task's decision rule (20-40% = NEAR-SATURATED), the verdict is **NEAR-SATURATED**. One more targeted pass on the "DAG-orchestrated / evidence-gated" angle (the specific cluster these 7 new repos share) would close the cycle. The most surprising find: `agentic-harness-engineering` (178 stars) — an observability-driven harness auto-evolution system backed by a Terminal-Bench paper, completely orthogonal to the SKILL.md/hooks layer the S1-S4 scans converged on.

---

## §A — Methodology

### Why this strategy is different from S1-S4

S1-S4 used **GitHub topic-page listings** as primary entry points:
- S1: `github.com/topics/claude-code`, `github.com/topics/claude-skills`, `github.com/topics/claude-code-plugin`
- S2: `github.com/topics/coding-agent`, `github.com/topics/ai-coding-agent`, `github.com/topics/swe-agent`, `github.com/topics/agentic-coding`, `github.com/topics/autonomous-coding`, `github.com/topics/agent-harness`
- S3: `github.com/topics/agent-orchestration`, `github.com/topics/multi-agent`, `github.com/topics/llm-agent`
- S4: `github.com/topics/mcp`, `github.com/topics/model-context-protocol`

This test used **four genuinely different entry points**:

1. **GitHub Advanced Search with date+language qualifiers** — `pushed:>2026-04-01 stars:>5 language:TypeScript` combined with harness/agent keywords. This surfaces repos that GitHub topic-indexing missed because authors didn't tag topics.
2. **`agentic-coding` topic page sorted by `updated` (not `stars`)** — S2 browsed this topic sorted by stars; sorting by recency surfaces new entries that have not yet accumulated star mass.
3. **`awesome-harness-engineering` curated list** — an aggregator that indexes repos outside the topic graph.
4. **Compound keyword search** — `"SKILL.md" "AGENTS.md" hooks coding agent` as a content-search rather than topic-search, finding repos that use the conventions but didn't register the topics.

### Search queries run (8 total)

| # | Query | Entry point type |
|---|-------|-----------------|
| Q1 | `site:github.com "SKILL.md" "CLAUDE.md" language:TypeScript pushed:2026` | Content search |
| Q2 | `github "agent harness" "hooks.json" OR "hooks/" "claude code" 2026 stars autonomous coding` | Keyword compound |
| Q3 | `claude+code+agent+harness+pushed:>2026-04-01+stars:>5` via github.com/search | Advanced Search |
| Q4 | `SKILL.md+AGENTS.md+hooks+coding+agent+pushed:>2026-04-01+stars:>5` via github.com/search | Advanced Search |
| Q5 | `autonomous+coding+agent+harness+pushed:>2026-04-01+stars:>5+language:TypeScript` via github.com/search | Advanced Search + language filter |
| Q6 | `agentic+coding+harness+CLAUDE.md+pushed:>2026-04-01` via github.com/search | Advanced Search |
| Q7 | `github.com/topics/agentic-coding?o=desc&s=updated` | Topic page, recency sort |
| Q8 | `github "coding agent" harness "policy gate" OR "audit trail" OR "compliance" OR "evidence"` | Semantic/governance angle |

---

## §B — 26 Candidate Repos Table

| # | Repo | URL | Stars | Last Commit | In Cycle-02 Corpus? | If New — Why Was It Missed? |
|---|------|-----|-------|-------------|--------------------|-----------------------------|
| 1 | everything-claude-code | github.com/affaan-m/everything-claude-code | 182k | Apr 2026 | YES (S1, S2, S3) | — |
| 2 | Chachamaru127/claude-code-harness | github.com/Chachamaru127/claude-code-harness | 858 | May 2026 | YES (S2) | — |
| 3 | HKUDS/OpenHarness | github.com/HKUDS/OpenHarness | 12.5k | May 2026 | YES (S2, S3) | — |
| 4 | gotalab/cc-sdd | github.com/gotalab/cc-sdd | 3.3k | Apr 2026 | YES (S2) | — |
| 5 | mindfold-ai/Trellis | github.com/mindfold-ai/Trellis | 7.9k | May 2026 | YES (S2) | — |
| 6 | agent-sh/agnix | github.com/agent-sh/agnix | 241 | May 2026 | YES (S1) | — |
| 7 | rohitg00/agentmemory | github.com/rohitg00/agentmemory | 8.5k | May 2026 | YES (S1 — rohitg00/pro-workflow and rohitg00/awesome-claude-code-toolkit indexed; agentmemory is a different repo from the same author) | Partial overlap — same author as S1 entries but this specific repo not indexed |
| 8 | stevesolun/ctx | github.com/stevesolun/ctx | 317 | May 2026 | YES (S1) | — |
| 9 | OpenSource03/harnss | github.com/OpenSource03/harnss | 220 | Mar 2026 | NO — borderline: S2 Q8 search returned it but it was not written into the inventory | **Borderline miss** — desktop UI client for ACP, not a harness runtime; plausibly de-prioritized as out-of-scope |
| 10 | BulloRosso/etienne | github.com/BulloRosso/etienne | 27 | Feb 2026 | **NEW** | Low star count (27); no GitHub topic tags matching S1-S4 vectors; "Coding Agent Harness for custom AI agents" description uses "custom AI agents" not "claude code" — missed topic-keyword surface |
| 11 | JeiKeiLim/tenet | github.com/JeiKeiLim/tenet | 37 | May 2026 | **NEW** | Tagged `agentic-coding` but sorted below star-threshold in S2's topic-page browsing; emerged only via recency sort (Q7) |
| 12 | shawnpetros/salazar | github.com/shawnpetros/salazar | 23 | Apr 2026 | **NEW** | Not tagged with any of S1-S4 topic vectors; found only via Advanced Search language:TypeScript qualifier (Q5); 23 stars below typical discovery threshold |
| 13 | trevor-nichols/agentrules-architect | github.com/trevor-nichols/agentrules-architect | 118 | May 2026 | **NEW** | Python repo (S2-S4 scans skewed TypeScript/Markdown); AGENTS.md-generator angle not covered by S1-S4 topic queries; emerged via Q6 `agentic coding harness CLAUDE.md` |
| 14 | dirac-run/dirac | github.com/dirac-run/dirac | 1.2k | May 2026 | **NEW** | Tagged in `awesome-harness-engineering` list (Q3 via awesome list); not on any topic-page scanned by S1-S4; emphasis on token efficiency / AST manipulation rather than skills/hooks — different vocabulary |
| 15 | basilisk-labs/agentplane | github.com/basilisk-labs/agentplane | 48 | May 2026 | **NEW** | Found only via `agentic-coding` topic page recency sort (Q7); not on topic pages browsed by S1-S4; policy gate + audit trail angle is exactly hima's moat — most significant miss |
| 16 | china-qijizhifeng/agentic-harness-engineering | github.com/china-qijizhifeng/agentic-harness-engineering | 178 | May 2026 | **NEW** | Research/benchmark angle (Terminal-Bench paper) — S1-S4 scans excluded academic implementations; observability-driven harness evolution is architecturally distinct from skills/hooks paradigm |
| 17 | huisezhiyin/sdd-riper | github.com/huisezhiyin/sdd-riper | 197 | May 2026 | YES (S1 — sdd pattern referenced; S2 has cc-sdd) | Borderline — different repo from cc-sdd; spec-driven development angle already covered |
| 18 | MRCalderon3D/everything-game-dev-code | github.com/MRCalderon3D/everything-game-dev-code | 28 | May 2026 | NO | Domain-specific fork of everything-claude-code pattern; out of scope (game-dev domain) |
| 19 | sehoon787/my-claude | github.com/sehoon787/my-claude | 8 | May 2026 | NO | Personal config repo; 200+ agents but no novel orchestration; out of scope as personal dotfiles |
| 20 | crisandrews/ClawCode | github.com/crisandrews/ClawCode | 54 | May 2026 | YES (S5/S6 reference claw-code) | — |
| 21 | muqiao215/ControlMesh | github.com/muqiao215/ControlMesh | 13 | May 2026 | NO | Too new / minimal data; mesh control-plane angle but insufficient corpus for hima relevance |
| 22 | Synaptic-Labs-AI/PACT-Plugin | github.com/Synaptic-Labs-AI/PACT-Plugin | 65 | May 2026 | NO | Plugin framework for Claude Code; no novel orchestration pattern beyond S1 coverage; out of scope |
| 23 | Ivy-Interactive/Ivy-Tendril | github.com/Ivy-Interactive/Ivy-Tendril | 19 | May 2026 | NO | Agent-agnostic orchestration (≤19 stars, May 2026); too early to assess; similar to Trellis pattern already covered |
| 24 | avelikiy/great_cto | github.com/avelikiy/great_cto | 14 | May 2026 | NO | Engineering process framework for solo founders; not a coding agent harness runtime |
| 25 | looptroop-ai/LoopTroop | github.com/looptroop-ai/LoopTroop | 3 | May 2026 | NO | LLM councils + loop recovery; 3 stars, no stable pattern yet |
| 26 | disler/claude-code-hooks-multi-agent-observability | github.com/disler/claude-code-hooks-multi-agent-observability | unknown | May 2026 | NO | Hook-based observability pattern; likely complementary to S2 tdd-guard / S1 pro-workflow patterns |

**Note on corpus-boundary calls:**
- Repos #18, #19, #22, #23, #24, #25, #26 are NOT in the cycle-02 corpus but are also NOT material new harness patterns (personal configs, domain forks, too-early repos, out-of-scope). They are excluded from the NEW count.
- Repos #7, #9, #17 are borderline — same-author or same-pattern as existing corpus entries. Treated as corpus overlaps (conservative call per task instructions).
- **7 repos** (#10, #11, #12, #13, #14, #15, #16) are genuinely new: different authors, different patterns, not surfaced by S1-S4 topic-page strategy.

---

## §C — Saturation Calculation

| Metric | Value |
|--------|-------|
| Total candidates surfaced | 26 |
| In corpus (confirmed overlap) | 10 (repos #1–6, #8, #17, #20 + #7 borderline treated as overlap) |
| Borderline / out-of-scope (not material) | 9 (repos #18, #19, #21, #22, #23, #24, #25, #26 + #9 borderline) |
| **Genuinely NEW material repos** | **7** (#10 etienne, #11 tenet, #12 salazar, #13 agentrules-architect, #14 dirac, #15 agentplane, #16 agentic-harness-engineering) |
| New-to-total ratio | **7/26 = 26.9%** |
| **Verdict** | **NEAR-SATURATED** (20-40% band) |

The 26.9% new-information yield is above the SATURATED threshold (≤20%) and inside the NEAR-SATURATED band (20-40%). Per the conservative scoring rule ("if borderline, call NEAR-SATURATED, not SATURATED"), the verdict is **NEAR-SATURATED**.

### What the 7 new repos cluster around

All 7 new repos share a pattern the S1-S4 scans under-sampled: **structured execution loops with hard validator gates and/or evidence/audit trails**:

- `agentplane` — Git-native ACR audit trail, Ed25519-signed recipes, SLSA provenance
- `agentic-harness-engineering` — observability-driven harness evolution; Terminal-Bench benchmark grounding
- `tenet` — DAG-orchestrated 7-phase loop, 3-critic blocking evaluation, crash recovery
- `salazar` — Planner→Generator→Evaluator loop, Zod contract gates, hard validator (tsc/eslint/build/test)
- `agentrules-architect` — AGENTS.md/CLAUDE.md generator with ExecPlan harness; Python angle S1-S4 missed
- `dirac` — Hash-anchored AST-native edits, 50-80% token reduction vs other agents; efficiency angle
- `etienne` — Dreaming process (offline reflection), artifact-first UI, skills store with human review gate

The unsampled angle: **DAG-phase + evidence-gated execution** rather than the **skills-pack + hooks** paradigm S1-S4 converged on. This is a coherent cluster, not random noise.

---

## §D — Recommendation for Cycle-02-Deep Close

**Verdict: NEAR-SATURATED. Cycle-02-deep is NOT yet at DONE-criterion.**

One focused pass is sufficient to close it. The specific angle: **"DAG-orchestrated / evidence-gated coding agent harnesses"** — the cluster the 7 new repos belong to. S1-S4 over-indexed on the SKILL.md+hooks paradigm and under-sampled the structured-loop / validator-gate paradigm.

### Specific next steps (S7 dispatch)

Dispatch one agent — **S7-evidence-gate-scan** — with these 4 targeted queries:

1. `github.com/topics/agentic-coding` sorted by stars (not updated) — catch the high-star repos in this cluster that recency sort surfaces first
2. GitHub Advanced Search: `"validator gate" OR "evidence gate" OR "hard gate" coding agent pushed:>2026-03-01 stars:>10`
3. GitHub Advanced Search: `"DAG" "spec-driven" "autonomous" "claude code" OR "codex" pushed:>2026-04-01`
4. `site:github.com "Agent Change Record" OR "ACR" OR "SLSA" coding agent harness 2026`

**Expected yield from S7:** 8-15 new repos in the evidence-gate cluster. If S7 returns ≤20% new (relative to the expanded corpus after adding the 7 above), cycle-02-deep reaches SATURATED.

### What cycle-02-deep SHOULD NOT do

Do not dispatch another full-breadth swarm (S8-S12 on new topics). The remaining unsaturated surface is narrow and specific. One focused agent on one coherent cluster is the right intervention.

### Implication for hima

The 7 new repos strengthen, not contradict, hima's architecture:
- `agentplane`'s ACR + SLSA provenance is the closest open-source implementation of hima's hash-chained ledger (SYNTHESIS.md §3 pattern #4) — hima should study it before implementing independently
- `agentic-harness-engineering`'s observability-driven evolution loop is a v2 research direction for hima's self-improver agent
- `tenet`'s 3-critic blocking pipeline is the strongest reference for hima's evidence-based completion gate (D1 Trait 2) found to date — cleaner than LACP and more focused than sd0x-dev-flow

None of the 7 new repos invalidates hima's moat claim (EU AI Act mapping + T/L/M/H/C risk classification + multi-runtime adapter SDK). They fill gaps in the implementation reference set.

---

## Sources

| # | URL | Date |
|---|-----|------|
| 1 | github.com/basilisk-labs/agentplane | 2026-05-12 |
| 2 | github.com/china-qijizhifeng/agentic-harness-engineering | 2026-05-14 |
| 3 | github.com/JeiKeiLim/tenet | 2026-05-07 |
| 4 | github.com/shawnpetros/salazar | 2026-04-07 |
| 5 | github.com/trevor-nichols/agentrules-architect | 2026-05-08 |
| 6 | github.com/dirac-run/dirac | 2026-05-14 |
| 7 | github.com/BulloRosso/etienne | 2026-02-27 |
| 8 | github.com/ai-boost/awesome-harness-engineering | 2026-05-14 |
| 9 | github.com/topics/agentic-coding?o=desc&s=updated | 2026-05-14 |
| 10 | github.com/search?q=autonomous+coding+agent+harness+pushed:>2026-04-01 | 2026-05-14 |
| 11 | swarm/coding-agent-scan.md (S2 — 28 repos, cycle-02 corpus) | 2026-05-14 |
| 12 | swarm/claude-ecosystem-scan.md (S1 — 35 repos, cycle-02 corpus) | 2026-05-14 |
| 13 | swarm/orchestration-scan.md (S3 — 29 repos, cycle-02 corpus) | 2026-05-14 |
| 14 | swarm/SYNTHESIS.md (cycle-02 corpus total: ~164 repos) | 2026-05-14 |

Falsifies-If:
  kill-condition: A later saturation measurement finds that the cycle-02 corpus count or no-new-material conclusion was incomplete.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/swarm-deep/saturation-measurement.md
  on-fail: Reopen the saturation measurement and correct the synthesis before closing the discovery claim.
