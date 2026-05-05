# 01 - Convergence Policy Thresholds

Status: Cycle 04 executable contract proposal

## Purpose

This document closes PFV4-OD-007 for schema-first implementation planning.

Cycle 02 established that convergence is not max attempts. Cycle 03 made guard
merge depend on a `convergence_overlay`, but left the overlay facts undefined.
This contract defines the missing policy object:

```text
policies/convergence-policy.yaml
```

The policy makes convergence deterministic from sampled run facts, progress
signals, divergence signals, repeated-pattern detection, score formula, caps and
status thresholds.

## Sources Used

- `cycle-04/00-cycle-04-brief.md`
- `cycle-03/06-cycle-03-audit.md`
- `cycle-03/07-cycle-03-integration.md`
- `cycle-03/02-guard-merge-lattice.md`
- `cycle-03/03-evidence-requirements-freshness.md`
- `../05-convergence-validation-cycle.md`
- `cycle-02/05-verification-fixtures.md`
- `cycle-02/07-cycle-02-integration.md`

## Decision Scope

This contract defines:

- conceptual `policies/convergence-policy.yaml` schema;
- convergence sample windows;
- progress and divergence signals;
- score formula and score caps;
- repeated pattern detection;
- loop, reroute and block thresholds;
- status derivation for `not_sampled`, `converging`, `flat`,
  `oscillating`, `diverging` and `verified`;
- guard and final-state effects;
- fixture families for implementation tests.

It does not define:

- storage recovery behavior;
- territory registry behavior;
- closing transaction order;
- evidence freshness internals beyond consuming `evidence_status`.

Those remain separate Cycle 04 lanes.

## Registry Placement

Convergence policy is executable registry data.

```text
.rms/registry/
  policies/
    convergence-policy.yaml
  schemas/
    convergence-policy.schema.json
    convergence-sample.schema.json
    convergence-evaluation.schema.json
```

The registry manifest must include `policies/convergence-policy.yaml` and its
digest. Every convergence evaluation pins:

```text
registry_version
registry_digest
policy_id
policy_version
run_id
route_version
sample_window_id
latest_event_id
```

If policy digest or registry digest changes after a convergence evaluation, that
evaluation is stale for final-state authorization until recomputed under the
current registry.

## Convergence Policy Schema

Conceptual YAML shape:

```yaml
schema_version: "1.0"
policy_id: pfv4_default_convergence_policy
policy_version: "1.0"

sample_windows:
  default:
    min_samples_for_status: 3
    min_samples_for_verified: 4
    max_samples: 8
    max_event_age: run_current
    include_event_types:
      - STATE_TRANSITION_COMMITTED
      - TOOL_SUCCEEDED
      - TOOL_FAILED
      - EVIDENCE_RECORDED
      - EVIDENCE_EVALUATED
      - GUARD_EVALUATED
      - ROUTE_PLANNED
      - ROUTE_REPLACED
      - CONVERGENCE_EVALUATED
    reset_on_event_types:
      - SCOPE_CHANGED
      - ROUTE_REPLACED
      - RISK_CLASS_PROMOTED
      - REGISTRY_VALIDATED
      - MIGRATION_APPLIED
      - RUNTIME_CONTEXT_CHANGED
    partition_by:
      - run_id
      - route_version
      - macro_cycle
      - cycle_substate

weights:
  blocker_closure: 0.20
  evidence_movement: 0.20
  defect_movement: 0.15
  route_stability: 0.15
  scope_stability: 0.10
  guard_determinism: 0.10
  fixture_readiness: 0.10

score_thresholds:
  verified_min_score: 0.85
  converging_min_delta: 0.06
  flat_abs_delta_max: 0.03
  diverging_delta_max: -0.05
  oscillation_min_pattern_repeats: 2
  loop_min_pattern_repeats: 3
  loop_stalled_samples: 3
  reroute_stalled_samples: 2
  block_stalled_samples: 4

caps:
  unresolved_p0: 0.69
  missing_block_evidence: 0.69
  stale_block_evidence: 0.74
  conflicted_evidence: 0.59
  repeated_pattern_without_new_signal: 0.49
  scope_growth_without_owner: 0.64
  defects_increasing: 0.59
  runtime_hard_gate_missing: 0.59
  fixture_gap_for_claimed_boundary: 0.69
  registry_or_policy_stale: 0.59

final_state_requirements:
  DONE_VERIFIED:
    required_status: verified
    minimum_score: 0.85
    require_evidence_status: verified
    forbidden_statuses:
      - not_sampled
      - flat
      - oscillating
      - diverging
    forbidden_caps:
      - unresolved_p0
      - missing_block_evidence
      - stale_block_evidence
      - conflicted_evidence
      - repeated_pattern_without_new_signal
      - runtime_hard_gate_missing
      - registry_or_policy_stale
  DONE_WITH_GAPS:
    allowed_statuses:
      - converging
      - flat
    forbidden_statuses:
      - oscillating
      - diverging
      - not_sampled
    require_owned_gaps: true
  blocked_final_states:
    allowed_statuses:
      - not_sampled
      - flat
      - oscillating
      - diverging
      - converging
    require_block_evidence: true
```

Schema rules:

- No field accepts `null`; use `UNKNOWN`, `UNSET` or `NOT_APPLICABLE`.
- Every weight key must be registered and total exactly `1.00`.
- Every cap must name a machine-readable reason code.
- Every status threshold must be numeric and registry-pinned.
- Sample windows must be partitioned by route. A route change starts a new
  window and invalidates prior route-local convergence for final success.
- `DONE_VERIFIED` requires both convergence status `verified` and evidence
  status `verified`.

## Convergence Sample

A convergence sample is an append-only observation derived from event log,
state, evidence, route, guard and fixture facts.

Conceptual JSON shape:

```json
{
  "schema_version": "1.0",
  "sample_id": "conv_sample_004",
  "run_id": "run_2026-05-03_001",
  "route_version": "route_v2",
  "macro_cycle": "VALIDATION",
  "cycle_substate": "validation.regression_gate",
  "sample_index": 4,
  "event_ref": "evt_validation_failed_004",
  "observed_at_event_id": "evt_validation_failed_004",
  "policy_ref": "policies/convergence-policy.yaml#pfv4_default_convergence_policy",
  "registry_digest": "sha256:...",
  "measures": {
    "open_p0_count": 1,
    "open_p1_count": 2,
    "blocker_count": 1,
    "defect_count": 3,
    "owned_gap_count": 1,
    "unowned_gap_count": 0,
    "fresh_block_evidence_count": 5,
    "stale_block_evidence_count": 0,
    "conflicted_evidence_count": 0,
    "guard_block_count": 1,
    "guard_reroute_count": 0,
    "fixture_missing_count": 1,
    "scope_item_count": 12,
    "route_change_count": 0
  },
  "progress_signals": [
    "blocker_closed",
    "evidence_refreshed",
    "defect_count_reduced"
  ],
  "divergence_signals": [],
  "pattern_token": "VALIDATION_FAIL:same_requirement:req_evid_build_m_tests",
  "hypothesis_id": "hyp_refresh_tests_route_v2",
  "expected_signal": "tests become fresh against route_v2"
}
```

Rules:

- Samples are derived, not hand-authored.
- A sample must name the event that made it observable.
- `pattern_token` must be deterministic from event class, affected requirement,
  route, target and failure reason.
- `hypothesis_id` and `expected_signal` are required for repeated validation or
  repair loops.
- A sample with invalid schema is ignored for scoring and creates a blocking
  convergence evaluation when scoring is required.

## Sample Windows

The evaluator builds one active window per:

```text
run_id + route_version + macro_cycle + cycle_substate
```

Default window behavior:

| Rule | Value |
|---|---|
| Minimum samples for any trend status | `3` |
| Minimum samples for `verified` | `4` |
| Maximum samples retained for scoring | `8` |
| Window reset on route replacement | Yes |
| Window reset on scope change | Yes |
| Window reset on risk promotion | Yes |
| Window reset on registry or migration change | Yes |
| Window reset on runtime context change | Yes |

Reset does not delete historical samples. It starts a new scoring partition and
makes older partition evaluations stale for final-state authorization.

If fewer than `min_samples_for_status` samples exist, derived status is
`not_sampled` unless a hard divergence signal immediately blocks progress.

## Progress Signals

Progress signals are positive, event-backed facts. They increase component
scores only when fresh for the active sample window.

| Signal | Input fact | Component effect |
|---|---|---|
| `p0_closed` | Open P0 count decreases without opening a new P0. | Improves blocker closure. |
| `p1_closed` | Open P1 count decreases without reopening P0. | Improves blocker closure. |
| `evidence_refreshed` | Stale block evidence becomes fresh. | Improves evidence movement. |
| `evidence_verified` | Folded evidence status reaches `verified`. | Improves evidence movement and final eligibility. |
| `defect_count_reduced` | Defect count decreases in comparable route scope. | Improves defect movement. |
| `guard_block_resolved` | Blocking guard reason disappears through valid fact change. | Improves guard determinism. |
| `fixture_added` | Missing fixture class becomes present. | Improves fixture readiness. |
| `scope_stabilized` | Scope item count unchanged or lower for two samples. | Improves scope stability. |
| `route_stabilized` | No route replacement in the active window. | Improves route stability. |
| `new_hypothesis_tested` | Loop repair uses a distinct hypothesis and expected signal. | Prevents loop classification for one window. |

Progress cannot be inferred from elapsed time, repeated attempts or prose
confidence.

## Divergence Signals

Divergence signals are negative, event-backed facts. They can cap score,
produce `oscillating` or `diverging`, or trigger `reroute`/`block`.

| Signal | Input fact | Effect |
|---|---|---|
| `p0_reopened` | Closed P0 reopens in same route. | Cap `unresolved_p0`; may diverge. |
| `new_p0_opened` | New P0 appears without explicit scope decision. | Cap `unresolved_p0`; may diverge. |
| `evidence_stale` | Block evidence predates required selector. | Cap `stale_block_evidence`. |
| `evidence_conflicted` | Material evidence conflict exists. | Cap `conflicted_evidence`; block final success. |
| `defects_increasing` | Defect count increases across comparable samples. | Cap `defects_increasing`; may diverge. |
| `scope_drift` | Scope grows without owner or explicit acceptance. | Cap `scope_growth_without_owner`. |
| `route_oscillation` | Route alternates between same states or strategies. | Status may become `oscillating`. |
| `same_failure_repeated` | Same pattern token repeats without new signal. | Cap `repeated_pattern_without_new_signal`. |
| `fixture_gap_persists` | Claimed implementation boundary lacks fixture. | Cap `fixture_gap_for_claimed_boundary`. |
| `runtime_hard_gate_missing` | M/H/C required binding is missing or audit-only. | Cap `runtime_hard_gate_missing`; may block. |
| `registry_policy_stale` | Evaluation predates registry or policy digest change. | Cap `registry_or_policy_stale`; block final success. |

Divergence signals are never hidden by a high weighted score. Caps apply after
the weighted score is computed.

## Score Formula

The evaluator computes a weighted score from normalized component scores.

```text
raw_score =
  blocker_closure     * 0.20 +
  evidence_movement   * 0.20 +
  defect_movement     * 0.15 +
  route_stability     * 0.15 +
  scope_stability     * 0.10 +
  guard_determinism   * 0.10 +
  fixture_readiness   * 0.10

convergence_score = min(raw_score, applicable_caps...)
```

All component scores are clamped to `0.00..1.00`.

### Component Derivation

| Component | Score rule |
|---|---|
| `blocker_closure` | `1.00` when P0 is zero and P1 is not increasing; otherwise improves as P0/P1 counts decrease. |
| `evidence_movement` | `1.00` only when folded evidence is `verified`; stale, missing or conflicted block evidence scores at most `0.40`. |
| `defect_movement` | `1.00` when comparable defect count reaches zero; increases when defects decrease and caps when defects increase. |
| `route_stability` | `1.00` when no route replacement or route oscillation exists in the window. |
| `scope_stability` | `1.00` when scope is stable or explicitly narrowed; unowned growth scores at most `0.40`. |
| `guard_determinism` | `1.00` when guard blocks/reroutes are resolved or explained by blocked final state evidence. |
| `fixture_readiness` | `1.00` when every claimed implementation boundary has at least one fixture family. |

If exact counts are unavailable, the component is `UNKNOWN` and scores `0.00`
for `DONE_VERIFIED` eligibility. For progress-only evaluation, `UNKNOWN` may be
reported as a warning but still prevents `verified`.

## Score Caps

Caps are applied after `raw_score`. Multiple caps use the lowest cap.

| Cap id | Condition | Maximum score | Final-state effect |
|---|---|---:|---|
| `unresolved_p0` | Any applicable P0 lacks default, owner or implementation object. | `0.69` | Blocks `DONE_VERIFIED`. |
| `missing_block_evidence` | Any block evidence requirement is missing. | `0.69` | Blocks `DONE_VERIFIED`. |
| `stale_block_evidence` | Any block evidence is stale. | `0.74` | Blocks `DONE_VERIFIED`. |
| `conflicted_evidence` | Any material evidence conflict is unresolved. | `0.59` | Blocks all success final states. |
| `repeated_pattern_without_new_signal` | Same pattern repeats without distinct hypothesis or expected signal. | `0.49` | Forces loop/reroute evaluation. |
| `scope_growth_without_owner` | Scope grows without owner, route or checkpoint. | `0.64` | Blocks `DONE_VERIFIED`; may require split. |
| `defects_increasing` | Comparable defect count increases for two samples. | `0.59` | Forces reroute or blocked stop. |
| `runtime_hard_gate_missing` | M/H/C required runtime gate missing without legal fallback. | `0.59` | Blocks governed progress and `DONE_VERIFIED`. |
| `fixture_gap_for_claimed_boundary` | Claimed boundary lacks fixture family. | `0.69` | Blocks implementation handoff. |
| `registry_or_policy_stale` | Evaluation predates registry/policy digest change. | `0.59` | Blocks final success until recomputed. |

Caps do not erase the raw score. The evaluation records both:

```text
raw_score
capped_score
applied_caps
```

## Repeated Pattern Detection

A repeated pattern is a deterministic recurrence in the active sample window.

Pattern key:

```text
pattern_token =
  event_class
  + ":" + route_version
  + ":" + macro_cycle
  + ":" + cycle_substate
  + ":" + affected_requirement_or_guard
  + ":" + normalized_failure_reason
```

Examples:

```text
VALIDATION_FAIL:route_v2:VALIDATION:validation.regression_gate:req_evid_build_m_tests:evidence_stale
GUARD_REROUTE:route_v2:BUILD:build.implementation_patch:territory_guard:path_out_of_scope
TOOL_FAILED:route_v2:BUILD:build.local_quality_check:tests:same_assertion_failed
```

Detection rules:

| Condition | Classification |
|---|---|
| Same pattern repeats twice and at least one fresh expected signal exists. | Not a loop yet; keep evaluating trend. |
| Same pattern repeats twice with no fresh expected signal. | `oscillating`; current route should reroute before more attempts. |
| Same pattern repeats three times with no distinct hypothesis. | `LOOP_DETECTED`; convergence overlay returns `reroute` or stronger. |
| Same pattern repeats four times and reroute is unavailable or rejected. | `block`; close as blocked or require checkpoint. |
| Alternating route pattern repeats twice, for example A-B-A-B. | `oscillating`; route planner must pick a new registered route or checkpoint. |

A distinct hypothesis must change at least one of:

- target requirement;
- route strategy;
- implementation approach;
- evidence collection method;
- runtime binding or fallback;
- scope split;
- human checkpoint or arbitration path.

Renaming the same attempt is not a distinct hypothesis.

## Status Derivation

The evaluator returns exactly one convergence status.

### Per-Window Prechecks

Prechecks run before trend scoring:

```text
if policy schema invalid -> block evaluation with status not_sampled
else if registry or policy digest stale -> status not_sampled + cap registry_or_policy_stale
else if sample count < min_samples_for_status -> not_sampled
else derive trend
```

### Status Rules

```text
if sample_count < min_samples_for_status:
  status = not_sampled
else if evidence_status == verified
     and capped_score >= verified_min_score
     and no forbidden cap applies
     and sample_count >= min_samples_for_verified
     and no repeated pattern is active:
  status = verified
else if hard divergence signal exists:
  status = diverging
else if repeated pattern threshold or route alternation threshold is met:
  status = oscillating
else if score_delta <= diverging_delta_max
     or defects_increasing
     or p0_reopened
     or scope_drift:
  status = diverging
else if abs(score_delta) <= flat_abs_delta_max
     and no meaningful progress signal is fresh:
  status = flat
else if score_delta >= converging_min_delta
     and at least one progress signal is fresh:
  status = converging
else:
  status = flat
```

Definitions:

| Status | Meaning |
|---|---|
| `not_sampled` | There is not enough fresh policy-valid sample data to decide trend. |
| `converging` | The active route is measurably improving but final success is not yet verified. |
| `flat` | Score is stable and no meaningful fresh progress signal is present. |
| `oscillating` | The run repeats the same failure/route pattern without a new expected signal. |
| `diverging` | The route is worsening: more blockers, defects, stale/conflicted evidence or scope drift. |
| `verified` | Score, evidence, samples, caps and pattern checks all satisfy final success requirements. |

Status values are derived only. Implementations must not accept user-authored
`convergence_status` as authoritative state.

## Evaluation Output

`rms.evaluate_convergence` returns a structured evaluation record.

```json
{
  "schema_version": "1.0",
  "evaluation_id": "eval_conv_001",
  "run_id": "run_2026-05-03_001",
  "target": {
    "target_type": "final_state",
    "candidate": "DONE_VERIFIED",
    "state_ref": "state_v42",
    "route_version": "route_v2",
    "registry_digest": "sha256:..."
  },
  "policy_ref": "policies/convergence-policy.yaml#pfv4_default_convergence_policy",
  "window": {
    "window_id": "conv_window_route_v2_validation",
    "sample_count": 5,
    "sample_ids": [
      "conv_sample_001",
      "conv_sample_002",
      "conv_sample_003",
      "conv_sample_004",
      "conv_sample_005"
    ]
  },
  "raw_score": 0.88,
  "capped_score": 0.88,
  "applied_caps": [],
  "score_delta": 0.11,
  "progress_signals": [
    "evidence_verified",
    "defect_count_reduced",
    "fixture_added"
  ],
  "divergence_signals": [],
  "pattern_analysis": {
    "active_pattern": "UNSET",
    "repeat_count": 0,
    "route_alternation": false,
    "loop_detected": false
  },
  "convergence_status": "verified",
  "allowed_final_states": ["DONE_VERIFIED", "DONE_WITH_GAPS"],
  "guard_effect": "allow",
  "required_action": "NOT_APPLICABLE",
  "event_ids": ["evt_convergence_evaluated"]
}
```

Rules:

- Evaluation output must include raw and capped score.
- Applied caps must include reason code, cap value and source sample ids.
- Pattern analysis must be present even when no pattern is active.
- The evaluation event is itself stale if any window reset event occurs after
  `evt_convergence_evaluated`.

## Loop And Reroute Thresholds

Convergence status feeds the guard merge `convergence_overlay`.

| Condition | Overlay verdict | Required action |
|---|---|---|
| `not_sampled` for ordinary progress transition | `warn` | Gather enough fresh samples before final close. |
| `not_sampled` for `DONE_VERIFIED` | `block` | Evaluate convergence after required samples exist. |
| `converging` for ordinary progress transition | `allow` | Continue route and keep sampling. |
| `converging` for `DONE_VERIFIED` | `block` | Continue until verified or choose another final state. |
| `flat` for one window | `warn` | Name missing expected signal or next hypothesis. |
| `flat` for two consecutive windows | `reroute` | Change route, split scope or checkpoint. |
| `oscillating` at repeat threshold | `reroute` | Select a new registered route or human checkpoint. |
| `oscillating` with no legal route | `block` | Close blocked or escalate according to risk. |
| `diverging` | `reroute` | Stop current route; replan, split or checkpoint. |
| `diverging` with M/H/C hard gate missing | `block` | Resolve gate or close as blocked. |
| `verified` | `allow` | Continue to closing policy and append transaction. |

Default counters:

| Counter | Threshold | Effect |
|---|---:|---|
| `reroute_stalled_samples` | `2` | `flat` becomes `reroute`. |
| `loop_stalled_samples` | `3` | Same pattern becomes `LOOP_DETECTED`. |
| `block_stalled_samples` | `4` | Same pattern with no legal reroute becomes `block`. |

Risk overlays may strengthen these results. They may not weaken an M/H/C hard
gate block into continued autonomous progress.

## Final-State Effects

Convergence is a required input to closing, not a final commit by itself.

| Final candidate | Required convergence | Effect |
|---|---|---|
| `DONE_VERIFIED` | `verified` with no forbidden caps. | Closing may continue if evidence, runtime, territory and append checks pass. |
| `DONE_WITH_GAPS` | `converging` or `flat`, owned gaps, no critical divergence. | Closing may continue only if evidence gap policy allows it. |
| `BLOCKED_NEEDS_USER` | Any non-verified status with checkpoint evidence. | May close blocked if missing human decision is evidenced. |
| `BLOCKED_RUNTIME_MISSING` | Any status with runtime block evidence. | May close blocked; cannot claim success. |
| `BLOCKED_POLICY` | Any status with policy block evidence. | May close blocked; required policy reason is recorded. |
| `MAX_ATTEMPTS_REACHED` | `flat`, `oscillating` or `diverging` with attempt evidence. | May close blocked only when max attempts is a fuse plus trend evidence. |
| `LOOP_DETECTED` | `oscillating` with repeated pattern evidence. | May close blocked or reroute according to guard result. |
| `CANCELLED` | `NOT_APPLICABLE`. | Convergence does not block user cancellation. |
| `ABORTED` | `NOT_APPLICABLE`. | Convergence does not block integrity abort. |

`DONE_VERIFIED` is forbidden when:

- convergence status is not `verified`;
- evidence status is not `verified`;
- active cap is forbidden for `DONE_VERIFIED`;
- sample window is stale;
- repeated pattern analysis reports an active loop;
- registry or policy digest changed after evaluation.

## Fixture Pack

These fixtures extend Cycle 02 `VF-CONV-*` and provide implementation-ready
coverage for PFV4-OD-007.

### CONV-001 - Not Sampled Blocks Done Verified

Input:

```yaml
target:
  final_candidate: DONE_VERIFIED
policy:
  min_samples_for_status: 3
samples:
  - sample_id: conv_sample_001
    capped_score: 0.90
evidence_status: verified
```

Expected outcome: `BLOCK`

Expected checks:

- `convergence_status` is `not_sampled`.
- Convergence overlay blocks `DONE_VERIFIED`.
- Required action says collect at least two more fresh samples.

### CONV-002 - Converging Route May Continue

Input:

```yaml
samples:
  - sample_id: s1
    capped_score: 0.52
    defect_count: 5
  - sample_id: s2
    capped_score: 0.61
    defect_count: 3
  - sample_id: s3
    capped_score: 0.70
    defect_count: 2
progress_signals:
  - defect_count_reduced
  - evidence_refreshed
request:
  guard_type: transition_guard
  final_candidate: UNSET
```

Expected outcome: `PASS`

Expected checks:

- `convergence_status` is `converging`.
- Guard overlay returns `allow` for ordinary progress.
- `DONE_VERIFIED` remains unavailable until status becomes `verified`.

### CONV-003 - Flat Window Warns Then Reroutes

Input:

```yaml
samples:
  - sample_id: s1
    capped_score: 0.61
  - sample_id: s2
    capped_score: 0.62
  - sample_id: s3
    capped_score: 0.61
progress_signals: []
stalled_windows: 2
```

Expected outcome: `BLOCK`

Expected checks:

- First flat window would produce `warn`.
- Second consecutive flat window produces convergence overlay `reroute`.
- Required action names new hypothesis, scope split or checkpoint.

### CONV-004 - Repeated Validation Pattern Detects Loop

Input:

```yaml
samples:
  - pattern_token: VALIDATION_FAIL:route_v2:req_tests:evidence_stale
    hypothesis_id: hyp_same_patch
    expected_signal: NOT_APPLICABLE
  - pattern_token: VALIDATION_FAIL:route_v2:req_tests:evidence_stale
    hypothesis_id: hyp_same_patch
    expected_signal: NOT_APPLICABLE
  - pattern_token: VALIDATION_FAIL:route_v2:req_tests:evidence_stale
    hypothesis_id: hyp_same_patch
    expected_signal: NOT_APPLICABLE
```

Expected outcome: `BLOCK`

Expected checks:

- `convergence_status` is `oscillating`.
- Pattern repeat count is `3`.
- Evaluation records `LOOP_DETECTED`.
- Guard overlay returns `reroute` unless no legal route exists, then `block`.

### CONV-005 - Route Alternation Is Oscillation

Input:

```yaml
events:
  - route: route_a
    result: validation_failed
  - route: route_b
    result: build_patch
  - route: route_a
    result: validation_failed
  - route: route_b
    result: build_patch
samples:
  count: 4
```

Expected outcome: `BLOCK`

Expected checks:

- Pattern analysis reports route alternation.
- `convergence_status` is `oscillating`.
- Required action forbids another A/B retry without a distinct hypothesis.

### CONV-006 - Diverging Defects And Scope Drift Reroute

Input:

```yaml
samples:
  - sample_id: s1
    defect_count: 2
    scope_item_count: 10
    open_p0_count: 0
  - sample_id: s2
    defect_count: 4
    scope_item_count: 13
    open_p0_count: 1
divergence_signals:
  - defects_increasing
  - scope_drift
  - new_p0_opened
```

Expected outcome: `BLOCK`

Expected checks:

- `convergence_status` is `diverging`.
- Caps include `unresolved_p0`, `defects_increasing` and
  `scope_growth_without_owner`.
- Current route cannot continue without replanning, splitting or checkpoint.

### CONV-007 - High Raw Score Is Capped By Missing Fixture

Input:

```yaml
raw_score: 0.91
fixture_delta:
  convergence_loop_fixture: present
  runtime_degradation_fixture: missing
claimed_boundaries:
  - runtime_degradation
```

Expected outcome: `BLOCK`

Expected checks:

- Capped score is at most `0.69`.
- Applied cap is `fixture_gap_for_claimed_boundary`.
- Implementation handoff is blocked until fixture family exists.

### CONV-008 - Stale Evidence Caps Convergence

Input:

```yaml
raw_score: 0.87
evidence_status: stale
divergence_signals:
  - evidence_stale
target:
  final_candidate: DONE_VERIFIED
```

Expected outcome: `BLOCK`

Expected checks:

- Applied cap is `stale_block_evidence`.
- `convergence_status` cannot be `verified`.
- Required action names evidence refresh before final close.

### CONV-009 - Verified Requires Score Evidence And No Caps

Input:

```yaml
samples:
  - sample_id: s1
    capped_score: 0.72
  - sample_id: s2
    capped_score: 0.80
  - sample_id: s3
    capped_score: 0.86
  - sample_id: s4
    capped_score: 0.91
evidence_status: verified
progress_signals:
  - evidence_verified
  - defect_count_reduced
  - fixture_added
divergence_signals: []
applied_caps: []
target:
  final_candidate: DONE_VERIFIED
```

Expected outcome: `PASS`

Expected checks:

- `convergence_status` is `verified`.
- Guard overlay returns `allow`.
- Closing may continue to evidence, runtime, territory and append checks.

### CONV-010 - Done With Gaps Allows Flat Only With Owned Gaps

Input:

```yaml
target:
  final_candidate: DONE_WITH_GAPS
convergence_status: flat
evidence_status: with_gaps
accepted_gaps:
  - gap_id: gap_optional_ci
    owner: agent
    risk_class: L
    follow_up: NOT_APPLICABLE
divergence_signals: []
```

Expected outcome: `PASS`

Expected checks:

- Convergence does not block `DONE_WITH_GAPS`.
- Closing still requires evidence gap policy to allow the gap.
- `DONE_VERIFIED` remains blocked.

### CONV-011 - Done With Gaps Rejects Oscillation

Input:

```yaml
target:
  final_candidate: DONE_WITH_GAPS
convergence_status: oscillating
accepted_gaps:
  - gap_id: gap_validation_loop
    owner: agent
```

Expected outcome: `BLOCK`

Expected checks:

- Oscillation is not an acceptable success-with-gaps status.
- Required action is reroute, checkpoint or close as blocked loop.

### CONV-012 - Registry Change Stales Evaluation

Input:

```yaml
events:
  - event_id: evt_convergence_evaluated
    registry_digest: sha256:old
    convergence_status: verified
  - event_id: evt_registry_validated
    registry_digest: sha256:new
target:
  final_candidate: DONE_VERIFIED
```

Expected outcome: `BLOCK`

Expected checks:

- Prior convergence evaluation is stale.
- Applied cap is `registry_or_policy_stale`.
- Evaluation must be recomputed under the new digest.

### CONV-013 - Runtime Hard Gate Missing Blocks Despite Convergence Trend

Input:

```yaml
raw_score: 0.89
progress_signals:
  - defect_count_reduced
  - evidence_refreshed
risk_class: M
runtime_binding:
  required_gate: pre_tool_write_guard
  binding_status: missing
  fallback_strategy: post_run_audit
divergence_signals:
  - runtime_hard_gate_missing
```

Expected outcome: `BLOCK`

Expected checks:

- Applied cap is `runtime_hard_gate_missing`.
- Convergence cannot verify a route that cannot be enforced.
- Guard merge may return runtime `block` as dominant over convergence trend.

### CONV-014 - Max Attempts Is Only A Fuse

Input:

```yaml
attempts:
  current: 5
  max: 5
samples:
  - pattern_token: TEST_FAIL:route_v2:req_tests:same_assertion
  - pattern_token: TEST_FAIL:route_v2:req_tests:same_assertion
  - pattern_token: TEST_FAIL:route_v2:req_tests:same_assertion
progress_signals: []
target:
  final_candidate: MAX_ATTEMPTS_REACHED
```

Expected outcome: `PASS`

Expected checks:

- Final state may be `MAX_ATTEMPTS_REACHED` only because attempts plus loop
  evidence explain non-convergence.
- The evaluator does not use max attempts as proof of success.
- `DONE_VERIFIED` remains blocked.

## Implementation Readiness Criteria

PFV4-OD-007 is closed for schema-first planning when implementation tests prove:

1. `policies/convergence-policy.yaml` validates with no `null` values.
2. Sample windows partition by route, cycle and substate.
3. Window reset events stale prior evaluations for final-state authorization.
4. Weighted score and caps are both recorded.
5. Caps dominate high raw scores.
6. Progress signals require fresh event-backed facts.
7. Divergence signals cannot be hidden by prose confidence or high raw score.
8. Repeated pattern detection distinguishes a new hypothesis from the same
   retry.
9. `not_sampled`, `converging`, `flat`, `oscillating`, `diverging` and
   `verified` are derived deterministically.
10. `DONE_VERIFIED` requires convergence `verified` and evidence `verified`.
11. `DONE_WITH_GAPS` rejects oscillating or diverging routes.
12. Blocked final states can close with explanatory block evidence, not success
    evidence.

## Decision Delta

| Cycle 03 blocker | Cycle 04 result |
|---|---|
| `policies/convergence-policy.yaml` absent. | `closed_by_contract`: conceptual schema, registry placement and evaluation output are defined. |
| Sample windows absent. | `closed_by_contract`: route-partitioned windows, reset rules and sample minimums are defined. |
| Score formula and caps absent. | `closed_by_contract`: weighted formula, component derivation and cap table are defined. |
| Repeated pattern detection absent. | `closed_by_contract`: deterministic pattern tokens, loop thresholds and route oscillation rules are defined. |
| Fixture pack absent. | `closed_by_fixture`: `CONV-001` through `CONV-014` cover not sampled, converging, flat, oscillating, diverging, caps and verified. |

## Summary

Convergence is a derived, registry-pinned evaluation over fresh samples. The
implementation rule is:

```text
build route-local sample window
compute raw weighted score
apply fail-closed caps
detect repeated patterns
derive one convergence status
feed that status into guard merge and closing policy
```

This closes PFV4-OD-007 subject to concrete JSON Schema and YAML policy files in
the schema-first implementation phase.
