# 05 - Convergence Validation Cycle

Status: proposal for repeatable autonomous validation cycles

## Intent

This document defines how the final Pipeline Fractale V4 proposal should be
cycled until it becomes decision-grade.

The loop is practical, bounded and repeatable. It does not pretend to run
forever. Each cycle must produce fresh evidence, a convergence score, a merged
recommendation across three proposals, and either a stop decision or a concrete
next-cycle backlog.

The input model is the V2 state-machine folder:

```text
state-machine V2
+ rms runtime sets
+ three architecture proposals
+ red-team evidence
+ validation fixtures
= final proposal candidate
```

## Design Principle

Convergence is not "we ran another iteration".

Convergence means:

```text
the proposal has fewer unresolved P0 decisions,
stronger evidence,
more deterministic guards,
smaller implementation ambiguity,
and a clearer split between MCP, skills, hooks, and subagents.
```

Max cycles are only a fuse. A new cycle is allowed only when it has a distinct
hypothesis of progress and a measurable expected signal.

## Cycle Stages

Each cycle uses the same seven stages from `00-cycle-protocol.md`, with stricter
evidence requirements.

| Stage | Required action | Required evidence |
|---|---|---|
| 1. Load context | Read source docs and previous cycle results. | Source list, stale/missing source notes, active P0/P1 decisions. |
| 2. Generate options | Produce or refresh three viable proposals. | Proposal deltas, decision claims, owned boundaries for MCP/skills/hooks/subagents. |
| 3. Red-team options | Attack each proposal with edge cases. | Failure cases, contradiction list, runtime degradation cases, rejected assumptions. |
| 4. Map runtime surfaces | Assign state, guards, evidence, procedures and knowledge to runtime surfaces. | Surface ownership table, overlap list, Binding Set implications. |
| 5. Score convergence | Score progress using the rubric below. | Score record, caps applied, trend versus previous cycle, evidence gaps. |
| 6. Integrate | Merge the strongest parts into one recommendation. | Integrated proposal, two rejected alternatives, decision rationale. |
| 7. Emit next-cycle backlog | Decide stop or next cycle. | Stop verdict or bounded backlog with hypothesis, expected signal and fixture updates. |

The cycle is invalid if it only restates prior prose. At least one of these
must change: open decisions, evidence quality, surface ownership, edge-case
handling, validation fixtures, or implementation boundary.

## Evidence Required Each Cycle

Each cycle must leave an evidence packet. The packet can be Markdown during
proposal work, but it must be structured enough to become tests or registry
fixtures later.

| Evidence item | Purpose |
|---|---|
| `source_snapshot` | Files, reports and prior cycle artifacts actually used. |
| `decision_delta` | P0/P1 decisions opened, clarified, closed or demoted. |
| `proposal_matrix` | Three proposals compared on the same dimensions. |
| `edge_case_matrix` | Edge cases and expected handling per proposal. |
| `surface_map` | What belongs in MCP, skills, hooks, subagents, logs and Evidence Set. |
| `guard_implications` | Which guards become simpler, stricter, degraded or blocked. |
| `runtime_implications` | Binding Set and capability effects for Codex, Claude, Hermes and no-op/fallback paths. |
| `fixture_delta` | Fixtures added, changed or still missing before implementation. |
| `convergence_score` | Score, trend, caps and stop recommendation. |
| `integration_record` | Winning recommendation, rejected alternatives and remaining risks. |

Evidence must be fresh for the current cycle. A prior-cycle finding may be
reused only if the cycle explicitly says it is still valid and why no later
change invalidated it.

## Convergence Score

The score is a decision aid, not a source of truth. It must be capped by missing
critical evidence, unresolved P0 decisions, runtime contradictions or fixture
gaps.

Use a 0.00 to 1.00 scale:

| Component | Weight | Question |
|---|---:|---|
| Decision closure | 0.20 | Are P0/P1 decisions closing faster than new blockers appear? |
| Evidence quality | 0.20 | Are proofs present, relevant, fresh, independent and decision-capable? |
| Proposal convergence | 0.20 | Do the three proposals increasingly select the same boundary decisions? |
| Runtime determinism | 0.15 | Are MCP, skills, hooks, subagents and bindings assigned without overlap? |
| Fixture readiness | 0.15 | Can the claims be converted into schema, guard and convergence fixtures? |
| Scope stability | 0.10 | Is the MVP surface shrinking or stabilizing instead of expanding? |

### Caps

Apply caps after computing the weighted score:

| Condition | Maximum score |
|---|---:|
| Any P0 decision has no owner or no proposed default. | 0.49 |
| The three proposals disagree on the state authority boundary. | 0.59 |
| `DONE_VERIFIED` semantics remain inconsistent with Evidence Set or Convergence Set. | 0.59 |
| Runtime degradation for M/H/C can still fail open silently. | 0.64 |
| No validation fixtures exist for a claimed implementation boundary. | 0.69 |
| Edge cases are warnings only, with no expected handling. | 0.74 |
| Two proposals tie because the scoring dimensions are vague. | 0.79 |

### Bands

| Score | Meaning | Action |
|---|---|---|
| `0.00 - 0.39` | Non-convergent. | Reframe cycle, reduce scope or split work. |
| `0.40 - 0.59` | Partial convergence. | Run another cycle with a narrow hypothesis. |
| `0.60 - 0.74` | Plausible direction. | Strengthen fixtures and resolve remaining P0/P1 blockers. |
| `0.75 - 0.89` | Decision-grade candidate. | Stop if gaps are owned and non-blocking. |
| `0.90 - 1.00` | Implementation-planning ready. | Stop and hand off to implementation planning. |

## How Three Proposals Converge

Cycle 01 starts with three proposals:

1. MCP-first RMS kernel.
2. Skill-first portable workflow layer.
3. Reference doc-first governance and knowledge layer with MCP enforcement.

The goal is not to average them. The goal is to force each proposal to explain
the same hard boundaries, then integrate the stable answer.

### Shared Evaluation Dimensions

Every proposal must answer:

| Dimension | Required answer |
|---|---|
| State authority | Which object is canonical for current run state and final state? |
| Guard authority | Where are guards evaluated, merged and enforced? |
| Evidence authority | Where do proof requirements, freshness and conflicts live? |
| Convergence authority | Where is score, trend, stagnation and loop detection computed? |
| Runtime portability | How are Codex, Claude, Hermes and fallback/no-op behavior represented? |
| Human checkpoints | Who can accept gaps, overrides and critical decisions? |
| Subagent boundary | What can subagents decide, and what must they return to the leader/RMS? |
| Reference doc boundary | What durable knowledge lives in reference docs without becoming hidden runtime state? |
| MVP cut | What can be implemented first without violating V2 invariants? |

### Convergence Mechanics

The proposals converge when the same answers survive different attacks:

| Step | Mechanic | Output |
|---|---|---|
| Normalize | Rewrite all three proposals against the same dimensions. | Comparable proposal matrix. |
| Stress | Apply edge cases from the red-team lane to all three. | Failure and mitigation matrix. |
| Extract | Pull decisions that all viable proposals share. | Stable decision set. |
| Reject | Name where each losing proposal fails or overreaches. | Rejected alternatives with reasons. |
| Integrate | Compose one hybrid only from decisions with evidence. | Integrated recommendation. |
| Fixture | Convert claims into fixtures before implementation. | Testable pre-implementation contract. |

The expected convergence target is:

```text
MCP owns canonical state, guards, evidence, convergence and runtime bindings.
Skills expose portable workflows and user-facing procedures.
Subagents execute bounded lanes and return evidence, not authority.
Reference docs store durable manuals, policies and operator knowledge.
```

This target can still lose if evidence shows it creates a central bottleneck,
unportable runtime dependency, or hidden policy gap.

## When To Spawn Subagents

Spawn subagents only when the work is independent and the result can be accepted
or rejected as evidence.

| Spawn when | Expected output |
|---|---|
| Three proposals need independent option generation. | One proposal per lane, same evaluation dimensions. |
| Edge cases need adversarial review. | Failure matrix with severity and expected handling. |
| Runtime surfaces need mapping. | MCP/skills/hooks/subagents ownership table. |
| Validation fixtures need extraction. | Fixture list with expected pass/fail verdicts. |
| Convergence score needs independent challenge. | Verifier report with score caps and gaps. |

Do not spawn subagents when:

- the issue is a single integration decision;
- the lane would need to edit the same artifact as another active lane;
- the output cannot become evidence;
- the work is just rereading the same document without a distinct lens;
- unresolved authority would let the subagent choose final state or policy.

Subagents do not own the final recommendation. They return evidence packets.
The leader/RMS accepts, rejects or requests a bounded retry.

## When To Stop

Stop the current cycle with a decision-grade recommendation when all conditions
are true:

- convergence score is at least `0.75` after caps;
- every P0 has a proposed default, owner and implementation object;
- the three proposals agree on state, guard, evidence and convergence
  authority, or the disagreement is explicitly rejected;
- edge cases have deterministic handling or are declared non-goals;
- validation fixtures cover the proposed MVP boundary;
- implementation would now produce more evidence than another design cycle.

Stop as blocked when:

- a P0 requires human/product preference rather than more analysis;
- source docs contradict each other and no supersession rule can be inferred;
- runtime capability evidence is missing for a required M/H/C gate;
- the same cycle hypothesis failed twice without a new expected signal;
- the score is capped below `0.60` by an unowned blocker.

Stop with gaps only when the gaps are non-critical, owned and do not affect the
MVP implementation boundary.

## Loop Control

Each cycle records:

```json
{
  "cycle_id": "cycle-02",
  "hypothesis": "MCP-owned guard merge removes overlap between skills and reference docs",
  "expected_signal": "guard authority becomes identical in all three proposals",
  "max_cycles_remaining": 2,
  "previous_score": 0.68,
  "current_score": 0.78,
  "trend": "improving",
  "stop_recommendation": "decision_grade"
}
```

Rules:

1. A cycle must declare its hypothesis before starting.
2. A cycle must name the expected measurable signal.
3. A repeated hypothesis without new evidence is a loop.
4. Two flat cycles in a row force stop, split or human decision.
5. A cycle budget can be extended only with a new blocker, new source or new
   fixture class.
6. The final answer must include the next useful activity: another bounded
   design cycle, implementation planning, or blocked decision.

## Validation Fixtures Before Implementation

Before implementation planning, claims from this folder must become fixtures.
They do not need final production code yet, but they must be concrete enough
that an implementer can turn them into schema, guard and convergence tests.

| Fixture | Expected verdict |
|---|---|
| MCP owns current state; skill tries to mutate final state directly. | Blocked; skill must request RMS transition. |
| Subagent returns recommendation without evidence packet. | Rejected by subagent result gate. |
| Reference doc contains policy prose that conflicts with guard registry. | Registry wins; conflict recorded for reference doc update. |
| `DONE_VERIFIED` with evidence partial. | Blocked by stop gate. |
| `DONE_WITH_GAPS` with unresolved H/C gap. | Blocked. |
| Runtime lacks required blocking hook for M/H/C and no fallback is declared. | `BLOCKED_RUNTIME_MISSING`. |
| Runtime lacks optional hook for T/L with post-run audit fallback. | Warn/degrade with explicit evidence gap. |
| Three proposals disagree on state authority. | Score capped; no implementation handoff. |
| Edge case has no expected handling. | Score capped; next-cycle backlog required. |
| Validation loop repeats same proposal with no decision delta. | `LOOP_DETECTED` or forced reframe. |
| Non-dev architecture run uses derived lens while harness is inactive. | Valid only if no macro-cycle/substate is interpreted. |
| Build/validation rework lowers defect count and improves evidence freshness. | Converging; continue if within budget. |
| Build/validation rework increases defects or reopens scope. | Diverging; reroute or block. |
| Critical risk in bypass mode. | Blocked. |
| Critical risk in autonomous auto-decision without explicit checkpoint. | Blocked. |
| Proposal claims implementation-ready while P0 decision lacks default. | Blocked. |

Minimum fixture set for MVP readiness:

- one state authority fixture;
- one guard authority fixture;
- one evidence stop-gate fixture;
- one convergence loop fixture;
- one runtime degradation fixture;
- one subagent evidence fixture;
- one docs/registry conflict fixture;
- one non-development run fixture.

## Autonomous Repeat Loop

Use this loop when launching another cycle:

```text
1. Pick exactly one cycle hypothesis.
2. Load only the source docs needed for that hypothesis.
3. Refresh the three proposals against the shared dimensions.
4. Spawn subagents only for independent evidence lanes.
5. Integrate subagent evidence into the proposal matrix.
6. Apply edge cases and fixture expectations.
7. Compute convergence score and caps.
8. Decide: stop, blocked, or next bounded cycle.
9. Record the next-cycle backlog with expected signal.
```

The loop is autonomous because it does not wait for permission to inspect,
compare, score and validate. It is bounded because each cycle has a hypothesis,
an expected signal, a fixture delta and a stop decision.

## Cycle Output Template

Each completed cycle should produce this record:

```text
Cycle:
Hypothesis:
Sources used:
Subagents spawned:
Decision delta:
Proposal matrix summary:
Edge-case summary:
Fixture delta:
Convergence score:
Caps applied:
Stop verdict:
Next useful activity:
```

This record is the evidence that prevents "continuous cycling" from becoming
unbounded repetition.
