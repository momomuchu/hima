# 02 - Guard Merge Lattice

Status: Cycle 03 executable contract proposal

## Purpose

Cycle 02 accepted the guard overlay shape but left the merge semantics too
prose-heavy for implementation. This contract defines the executable guard
decision model for PFV4:

```text
base_guard
-> risk_overlay
-> supervision_overlay
-> runtime_overlay
-> territory_overlay
-> evidence_overlay
-> convergence_overlay
-> closing_policy
= merged_guard_decision
```

The goal is not to choose every policy value. The goal is to make any chosen
policy deterministic, schema-valid, fail-closed, fixture-ready, and auditable.

## Contract Sources

- `cycle-02/03-mcp-tool-contracts.md`
- `cycle-02/04-registry-storage-layout.md`
- `cycle-02/05-verification-fixtures.md`
- `cycle-02/06-audit-red-team.md`
- `cycle-02/07-cycle-02-integration.md`
- `cycle-03/00-cycle-03-brief.md`

## Decision Scope

This document closes the Cycle 03 guard merge lane for implementation planning.

It defines:

- verdict/domain model;
- decision lattice and total order;
- overlay merge algorithm;
- weakening rules;
- required side effects;
- input and output object shape;
- deterministic tie-breakers;
- fixture matrix.

It does not define:

- concrete JSON Schema files;
- every individual guard policy rule;
- runtime-specific binding facts;
- evidence freshness graph;
- human checkpoint schema.

Those remain in adjacent Cycle 03 lanes.

## Domain Model

### Guard Evaluation Inputs

A guard evaluation is pure with respect to state mutation. It reads state,
registries, per-run sets, evidence, convergence, runtime binding facts, and the
requested action or transition. It returns one merged decision and, when
persisted, appends a `GUARD_EVALUATED` event or a failure/block event.

Minimum conceptual inputs:

```json
{
  "run_id": "run_2026-05-03_001",
  "guard_request": {
    "guard_type": "transition_guard",
    "from": {
      "pipeline_activation": "active",
      "macro_cycle": "BUILD",
      "cycle_substate": "build.implementation_slice"
    },
    "to": {
      "pipeline_activation": "active",
      "macro_cycle": "BUILD",
      "cycle_substate": "build.local_quality_check"
    },
    "action": {
      "tool": "filesystem_write",
      "action_type": "write",
      "target_path": "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-03/02-guard-merge-lattice.md"
    },
    "final_candidate": "UNSET"
  },
  "context_refs": {
    "state_ref": "state_v42",
    "intent_ref": "intent_2026-05-03_001",
    "route_ref": "route_2026-05-03_001",
    "capability_set_id": "cap_codex_2026-05-03",
    "binding_set_id": "binding_codex_v1",
    "evidence_set_ref": "evidence_v12",
    "convergence_set_ref": "convergence_v6"
  },
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "actor": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex"
  },
  "request_id": "req_0006",
  "idempotency_key": "optional_stable_key",
  "reason": "evaluate transition before applying patch"
}
```

Rules:

- No field may be `null`; use `UNSET`, `UNKNOWN`, or `NOT_APPLICABLE`.
- `guard_type` must be registered.
- `from`, `to`, and `action` fields are required only when applicable to that
  guard type, but missing required dimensions become a blocking overlay result.
- `registry_version` and `registry_digest` pin the executable rules.

### Overlay Output

Every overlay normalizes to a `GuardOverlayResult` before merge.

```json
{
  "overlay_id": "runtime_overlay.pre_tool_write_guard.missing_m_gate",
  "overlay_kind": "runtime_overlay",
  "priority": 400,
  "verdict": "block",
  "hardness": "hard",
  "reason_code": "RUNTIME_BINDING_MISSING",
  "reason": "M risk requires blocking pre-tool write enforcement",
  "required_action": "reroute before write or bind a policy-allowed native-equivalent fallback",
  "evidence_required": ["RUNTIME_BINDING_CHECKED"],
  "side_effects": ["emit_block_event", "preserve_current_state"],
  "weakenable": false,
  "allow_weaken_from": [],
  "refs": {
    "policy_ref": "risk-policy.yaml#m_requires_blocking_write_gate",
    "binding_ref": "binding_codex_v1"
  }
}
```

Required fields:

| Field | Meaning |
|---|---|
| `overlay_id` | Stable ASCII id unique inside the registry. |
| `overlay_kind` | One of `base_guard`, `risk_overlay`, `supervision_overlay`, `runtime_overlay`, `territory_overlay`, `evidence_overlay`, `convergence_overlay`, `closing_policy`. |
| `priority` | Numeric order used only inside the same overlay kind. |
| `verdict` | One of the guard verdicts below. |
| `hardness` | `soft` or `hard`. |
| `reason_code` | Machine-readable error or decision code. |
| `reason` | Short operator-visible explanation. |
| `required_action` | Required for every verdict except plain `allow`. |
| `evidence_required` | Evidence requirements introduced by this overlay. |
| `side_effects` | Required effects if this decision is persisted or acted on. |
| `weakenable` | Whether a later overlay may weaken this result. |
| `allow_weaken_from` | Explicit weakening rules accepted by this overlay. |
| `refs` | Registry, state, evidence, binding or policy refs used by the overlay. |

Overlay results are not allowed to mutate state. They are decision candidates.

### Merged Decision Output

The guard engine returns one `GuardDecision`.

```json
{
  "decision_id": "gd_0001",
  "decision": "block",
  "severity": "block",
  "reason_code": "RUNTIME_BINDING_MISSING",
  "reason": "runtime overlay blocks the requested write because M risk requires a blocking pre-tool gate",
  "dominant_overlay_id": "runtime_overlay.pre_tool_write_guard.missing_m_gate",
  "applied_overlay_ids": [
    "base_guard.transition_registered.allow",
    "risk_overlay.m.enforcement_required.warn",
    "runtime_overlay.pre_tool_write_guard.missing_m_gate",
    "territory_overlay.path_in_scope.allow",
    "evidence_overlay.diff_summary_required.warn"
  ],
  "contributing_warnings": [
    {
      "overlay_id": "risk_overlay.m.enforcement_required.warn",
      "reason_code": "INDEPENDENT_EVIDENCE_REQUIRED"
    },
    {
      "overlay_id": "evidence_overlay.diff_summary_required.warn",
      "reason_code": "EVIDENCE_REQUIRED_BEFORE_VALIDATION"
    }
  ],
  "required_action": "reroute before write or bind a policy-allowed native-equivalent fallback",
  "evidence_required": [
    "RUNTIME_BINDING_CHECKED",
    "STATE_TRANSITION_BLOCKED"
  ],
  "route_effect": {
    "can_commit_transition": false,
    "can_execute_action": false,
    "can_continue_same_route": false,
    "suggested_next_guard_type": "runtime_binding_guard"
  },
  "degradation": {
    "active": false,
    "strategy": "NOT_APPLICABLE",
    "accepted_by_policy": false,
    "required_acceptance_evidence": []
  },
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "input_refs": {
    "state_ref": "state_v42",
    "route_ref": "route_2026-05-03_001",
    "binding_set_id": "binding_codex_v1",
    "evidence_set_ref": "evidence_v12",
    "convergence_set_ref": "convergence_v6"
  }
}
```

Rules:

- The merged output retains all applied overlay ids.
- The dominant overlay is the highest effective verdict after weakening rules
  are applied.
- Warnings below the dominant verdict are retained as required evidence or
  advisory context.
- `required_action` is mandatory for `warn`, `degrade`, `reroute`,
  `escalate`, and `block`.
- `degradation.active=true` is legal only for the `degrade` verdict or for a
  `warn`/`reroute` that explicitly carries a degraded route candidate.

## Verdict Lattice

### Verdicts

| Verdict | Meaning | Can commit transition | Can execute action | Required action |
|---|---|---:|---:|---|
| `allow` | All applicable guards pass without added obligation. | Yes | Yes | Optional. |
| `warn` | Guard allows progress but adds evidence, audit, or later-check obligation. | Yes | Yes | Required. |
| `degrade` | Guard allows progress only through a declared fallback with visible residual risk. | Conditional | Conditional | Required. |
| `reroute` | Current route cannot continue as requested, but another registered route may satisfy policy without human approval. | No for current transition | No for current action | Required. |
| `escalate` | Human checkpoint, independent review, or parent arbitration is required before progress. | No | No | Required. |
| `block` | The request must not advance. No route-local progress is allowed until the blocker is resolved or closed as blocked. | No | No | Required. |

### Total Order

For deterministic merge, verdicts are ordered by restrictiveness:

```text
allow < warn < degrade < reroute < escalate < block
```

This total order is used for simple dominance. The lattice also preserves
semantic dimensions:

```text
progress_allowed: allow, warn, degrade
route_change_required: reroute
external_authority_required: escalate
fail_closed: block
```

`degrade` is not a subtype of `warn`. It is stronger because it changes the
route trust level, final-state ceiling, and evidence requirements.

`reroute` is stronger than `degrade` because the requested route cannot proceed.
A reroute may propose a degraded route, but the merged verdict remains
`reroute` until the route planner accepts the new route and its degradation
evidence.

`escalate` is stronger than `reroute` because a route change alone is not
authority enough.

`block` dominates all verdicts unless a valid weakening rule explicitly changes
the dominant result. Most hard blocks are not weakenable.

### Hardness

`hardness` determines whether weakening is even considered.

| Hardness | Meaning |
|---|---|
| `soft` | The overlay may be weakened by a later overlay if an explicit weakening rule matches. |
| `hard` | The overlay cannot be weakened unless the same overlay declares a specific `allow_weaken_from` rule and the policy registry validates it. |

Hard blocks are required for:

- invalid or mismatched registry;
- schema-invalid input;
- `null` values;
- unknown required capability;
- missing required runtime binding with no policy-allowed fallback;
- M/E/C enforcement requested through audit-only or `noop_traced` binding;
- unclassified risk using bypass;
- E/C autonomous final decision without required checkpoint;
- stale or conflicted evidence for `DONE_VERIFIED`;
- convergence not verified for `DONE_VERIFIED`;
- event append unavailable for mutation.

## Overlay Merge Algorithm

### Inputs

```text
state snapshot
+ guard request
+ pinned registry
+ route set
+ policy set
+ capability set
+ binding set
+ evidence set
+ convergence set
= ordered overlay result list
```

### Normalization

Before merge:

1. Validate request schema.
2. Reject `null`.
3. Validate registry version and digest.
4. Expand guard aliases into registered guard ids.
5. Resolve every applicable overlay kind in canonical order.
6. Normalize each overlay to `GuardOverlayResult`.
7. Sort results by `(overlay_kind_order, priority, overlay_id)`.

If steps 1 to 3 fail, the guard engine returns `block` with a schema or
registry reason and does not evaluate policy overlays by inference.

### Canonical Overlay Kind Order

| Order | Overlay kind | Purpose |
|---:|---|---|
| 100 | `base_guard` | Registered transition/action existence and generic invariants. |
| 200 | `risk_overlay` | T/F/M/E/C minima, promotion effects, bypass legality. |
| 300 | `supervision_overlay` | Pairing, auto-decision, bypass and human-mode constraints. |
| 400 | `runtime_overlay` | Capability and Binding Set enforceability. |
| 500 | `territory_overlay` | Tool, path, action, scope and state territory. |
| 600 | `evidence_overlay` | Evidence requirements, freshness, conflicts and gaps. |
| 700 | `convergence_overlay` | Loop, divergence and convergence status. |
| 800 | `closing_policy` | Final-state authorization and closing protocol. |

### Merge Procedure

Executable pseudocode:

```text
function merge_guard_results(results):
  merged = empty_decision(verdict="allow")
  applied = []
  warnings = []

  for result in sort(results):
    applied.append(result.overlay_id)

    if result.verdict == "warn":
      warnings.append(result)

    candidate = result
    current = merged.dominant_result

    if current is UNSET:
      merged.dominant_result = candidate
      continue

    if rank(candidate.verdict) > rank(current.verdict):
      merged.dominant_result = candidate
      continue

    if rank(candidate.verdict) == rank(current.verdict):
      merged.dominant_result = tie_break(current, candidate)
      continue

    if rank(candidate.verdict) < rank(current.verdict):
      weakened = try_weaken(current, candidate, merged, results)
      if weakened.allowed:
        merged.dominant_result = weakened.result
        merged.weakenings.append(weakened.record)
      else:
        merged.rejected_weakenings.append({
          "from": current.overlay_id,
          "to": candidate.overlay_id,
          "reason": weakened.reason
        })

  return build_guard_decision(
    dominant=merged.dominant_result,
    applied=applied,
    warnings=warnings,
    evidence_required=union_evidence(results, merged.dominant_result),
    side_effects=union_side_effects(results, merged.dominant_result)
  )
```

### Union Rules

The final decision carries:

- all evidence requirements from the dominant verdict;
- all evidence requirements from retained warnings;
- degradation acceptance evidence when `degrade` is active;
- block evidence when the dominant verdict is `block`;
- escalation checkpoint evidence when the dominant verdict is `escalate`;
- reroute evidence when the dominant verdict is `reroute`;
- registry and input refs for reproducibility.

Duplicate evidence requirements are deduplicated by ASCII lexical id.

Side effects are not executed by merge itself. They are obligations for the
caller or persistence layer if the decision is persisted or acted on.

## Weakening Rules

### Default Rule

Later overlays may strengthen a decision. They may not weaken it by default.

```text
allow may become warn/degrade/reroute/escalate/block
warn may become degrade/reroute/escalate/block
degrade may become reroute/escalate/block
reroute may become escalate/block
escalate may become block
block remains block
```

### Explicit Weakening

A weaker later overlay can weaken a stronger current result only when all
conditions are true:

1. The stronger result has `weakenable=true`.
2. The stronger result has an `allow_weaken_from` entry matching:
   - current `overlay_id` or `overlay_kind`;
   - later `overlay_id` or `overlay_kind`;
   - requested target verdict.
3. The policy registry contains the weakening rule.
4. The rule is allowed for the current `risk_class`, `supervision_mode`,
   `guard_type`, `macro_cycle`, and `final_candidate`.
5. The weakening adds required evidence for the residual risk.
6. The weakening does not violate a hard invariant.

Example shape:

```json
{
  "rule_id": "weaken.runtime_f_hook_missing_to_degrade_with_audit",
  "from_verdict": "block",
  "to_verdict": "degrade",
  "from_overlay_kind": "runtime_overlay",
  "allowed_later_overlay_kind": "risk_overlay",
  "risk_classes": ["T", "F"],
  "supervision_modes": ["auto_decision", "pairing"],
  "required_conditions": [
    "binding_status=fallback",
    "fallback_strategy=post_run_audit",
    "can_block=false",
    "fail_open_risk=true"
  ],
  "required_evidence": ["DEGRADED_ROUTE_ACCEPTED", "RUNTIME_BINDING_CHECKED"],
  "forbidden_when": ["final_candidate=DONE_VERIFIED"]
}
```

### Non-Weakenable Conditions

These conditions cannot be weakened to `allow`, `warn`, or `degrade`:

- invalid registry or registry digest mismatch;
- schema-invalid guard request;
- `null` input;
- event append unavailable for a requested mutation;
- unknown capability required for enforcement;
- missing required binding for M/E/C enforcement without native-equivalent
  fallback;
- `noop_traced` used as blocking enforcement for M/E/C;
- E/C bypass without human checkpoint;
- C autonomous final decision;
- `DONE_VERIFIED` with evidence status below `verified`;
- `DONE_VERIFIED` with convergence status below `verified`;
- conflicting evidence for the requested final state.

These may resolve only by changing facts, refreshing evidence, changing route,
adding a valid human checkpoint, or closing as an explicit blocked final state.

### Weakened Result Audit

Every accepted weakening adds:

- `weakened_from_overlay_id`;
- `weakened_to_overlay_id`;
- original verdict;
- new verdict;
- rule id;
- policy ref;
- residual risk;
- required evidence;
- final-state ceiling.

If weakening produces `degrade`, final closure is capped at
`DONE_WITH_GAPS` unless later evidence and binding facts remove the degradation.

## Deterministic Tie-Breakers

Tie-breakers apply only when two overlay results have the same verdict rank
after weakening evaluation.

Tie-break order:

1. `hard` beats `soft`.
2. Higher `overlay_kind_order` beats lower overlay kind order.
3. Higher `priority` beats lower priority.
4. More specific guard scope beats broader scope:
   `final_candidate + action + path` >
   `transition + action` >
   `transition` >
   `cycle` >
   `global`.
5. More recent referenced state-changing event beats older event when both
   results are evidence/convergence scoped.
6. Lexically smaller `overlay_id` wins for stable final tie.

Tie-breakers must not drop losing results. Losing same-rank results remain in
`applied_overlay_ids` and may contribute evidence requirements, warnings, and
audit notes.

## Side Effects By Verdict

Guard merge itself is pure. Side effects occur when the caller persists the
decision or attempts to act on it.

| Verdict | Required event/evidence behavior | State/action behavior | Final-state effect |
|---|---|---|---|
| `allow` | Persist `GUARD_EVALUATED` when requested. | Transition/action may proceed through the owning tool. | No cap. |
| `warn` | Persist `GUARD_EVALUATED`; record warning evidence requirement. | Transition/action may proceed. | `DONE_VERIFIED` allowed only if warning evidence is satisfied before close. |
| `degrade` | Persist `GUARD_EVALUATED`; require `DEGRADED_ROUTE_ACCEPTED` before progress. | Transition/action may proceed only through declared fallback. | Cap at `DONE_WITH_GAPS` until degradation is resolved. |
| `reroute` | Persist `GUARD_EVALUATED` plus route blocker evidence. | Current transition/action does not proceed; route planner may select registered alternative. | No final verified claim until new route evidence is fresh. |
| `escalate` | Persist `GUARD_EVALUATED`; require HumanCheckpoint or accepted independent arbitration evidence. | No progress until checkpoint/arbitration is valid. | E/C final states require checkpoint evidence. |
| `block` | Persist `GUARD_EVALUATED` and `STATE_TRANSITION_BLOCKED` or domain-specific block event when applicable. | No protected mutation or governed action. | May close only as explicit blocked final state when closing policy allows. |

If event append fails, no mutation may claim success regardless of guard verdict.

## Error Mapping

| Dominant verdict | Common error code when tool fails | Notes |
|---|---|---|
| `allow` | `NOT_APPLICABLE` | Successful tools usually return `ok=true`. |
| `warn` | `NOT_APPLICABLE` | Successful tools return warnings and evidence obligations. |
| `degrade` | `DEGRADED_ROUTE_FORBIDDEN` or `NOT_APPLICABLE` | Forbidden degradation fails; accepted degradation returns `ok=true` with `degraded=true`. |
| `reroute` | `GUARD_BLOCKED` | Current transition/action fails, route planning may continue. |
| `escalate` | `ESCALATION_REQUIRED` | Human/independent checkpoint is required. |
| `block` | Domain-specific block code | Use precise codes such as `CAPABILITY_UNKNOWN`, `RUNTIME_BINDING_MISSING`, `EVIDENCE_STALE`, or `CONVERGENCE_NOT_VERIFIED`. |

## Guard Type Requirements

| Guard type | Required dimensions | Missing dimension result |
|---|---|---|
| `activation_guard` | `pipeline_activation`, `intent_ref`, `risk_class`, `route_ref`, capability/binding refs. | `block` with `INVARIANT_VIOLATION` or `CAPABILITY_UNKNOWN`. |
| `transition_guard` | `from`, `to`, transition id or event, state ref, registry ref. | `block` with missing transition dimension. |
| `territory_guard` | `macro_cycle`, `cycle_substate`, `tool`, `action_type`, `target_path`. | `block` with `TERRITORY_DENIED`. |
| `runtime_binding_guard` | `required_gate`, runtime, capability set, binding set, risk, supervision mode. | `block` with `CAPABILITY_UNKNOWN` or `RUNTIME_BINDING_MISSING`. |
| `evidence_guard` | target requirement, evidence set ref, freshness basis, latest relevant state event. | `block` or `warn` according to target and risk. |
| `convergence_guard` | convergence set ref, sample window, latest progress event, divergence signals. | `reroute`, `block`, or `warn` according to policy. |
| `closing_guard` | final candidate, evidence verdict, convergence verdict, blockers, runtime binding status. | `block` or `escalate` unless all closing requirements pass. |

## Fixture Matrix

These fixture rows are implementation readiness tests for the guard merge
engine. They extend the Cycle 02 fixtures without replacing them.

| Fixture id | Input overlay verdicts | Context | Expected merged verdict | Required checks |
|---|---|---|---|---|
| GM-001 | base `allow`, risk `warn`, runtime `block`, territory `allow`, evidence `warn`, convergence `allow` | M risk, missing pre-tool write gate | `block` | Runtime block dominates; warnings retained; required evidence includes `RUNTIME_BINDING_CHECKED`; no mutation. |
| GM-002 | base `allow`, risk `allow`, runtime `degrade`, territory `block`, evidence `warn` | F risk, path outside declared scope | `block` | Territory block dominates runtime degradation; degradation is not accepted; evidence warning retained. |
| GM-003 | base `allow`, risk `block`, runtime `degrade`, evidence `warn` | E risk with post-run audit fallback only | `block` | E risk block cannot weaken to degrade; `DEGRADED_ROUTE_FORBIDDEN` or risk block reason returned. |
| GM-004 | base `allow`, risk `warn`, runtime `degrade`, territory `allow` | T risk with declared audit fallback | `degrade` | Degraded route requires `DEGRADED_ROUTE_ACCEPTED`; final-state ceiling is `DONE_WITH_GAPS` until resolved. |
| GM-005 | base `allow`, risk `allow`, supervision `escalate`, runtime `allow`, territory `allow` | C final decision without valid human checkpoint | `escalate` | Escalation blocks progress; required action names HumanCheckpoint; no route-local weakening. |
| GM-006 | base `allow`, convergence `reroute`, closing `block` | Stop gate requests `DONE_VERIFIED`, convergence flat | `block` | Closing block for unverified convergence dominates reroute; no final commit. |
| GM-007 | base `allow`, evidence `block`, convergence `allow`, closing `allow` | `DONE_VERIFIED` with stale evidence | `block` | Evidence stale blocks closing even if closing policy overlay would otherwise allow. |
| GM-008 | base `allow`, risk `block`, supervision `allow` | `UNCLASSIFIED` risk with bypass | `block` | Later supervision allow cannot weaken unclassified bypass block. |
| GM-009 | base `allow`, runtime `block`, risk weakening rule to `degrade` | F risk, declared fallback, policy allows audit-only fallback | `degrade` | Accepted weakening is recorded with rule id and degradation evidence. |
| GM-010 | base `allow`, runtime `block`, risk weakening rule to `degrade` | M risk, declared audit-only fallback | `block` | Weakening rejected because M enforcement cannot use audit-only fallback. |
| GM-011 | base `allow`, evidence `warn`, convergence `warn` | Build local quality transition, evidence required before validation | `warn` | Same-rank tie keeps deterministic dominant overlay and unions evidence requirements. |
| GM-012 | base `block`, risk `allow`, runtime `allow` | Transition id not registered | `block` | Base hard block cannot be weakened by later allows. |
| GM-013 | schema precheck `block` | Guard request contains `null` target path | `block` | Overlay policies are not inferred; schema block names allowed sentinels. |
| GM-014 | registry precheck `block` | Registry digest mismatch | `block` | Executable guard use fails closed; no merged cache inference. |
| GM-015 | base `allow`, convergence `reroute`, evidence `warn` | Validation loop repeats without new evidence | `reroute` | Current route blocked; route planner may choose alternative; warning evidence retained. |
| GM-016 | base `allow`, evidence `block`, evidence `warn` | Conflicting review evidence plus missing optional artifact | `block` | Same overlay kind conflict uses rank first; block dominates warn; both refs retained. |
| GM-017 | base `allow`, risk `warn`, runtime `warn`, territory `allow` | Low-risk optional hook missing with noop traced | `warn` | No silent allow; required evidence records missing primitive and residual gap. |
| GM-018 | base `allow`, risk `escalate`, runtime `block` | Human checkpoint required and required gate missing | `block` | Runtime hard block dominates escalation; final report may mention both obligations. |
| GM-019 | base `allow`, closing `block` | Event append unavailable for final commit | `block` | Guard/tool cannot claim closure; snapshot cannot advance. |
| GM-020 | base `allow`, risk `allow`, runtime `allow`, territory `allow`, evidence `allow`, convergence `allow`, closing `allow` | `DONE_VERIFIED` with verified evidence and convergence | `allow` | Final state may commit if event append succeeds. |

## Implementation Readiness Criteria

The guard merge contract is implementation-ready when tests prove:

1. The verdict order is total and stable.
2. Same inputs and registry digest produce byte-equivalent decision output
   except for generated ids/timestamps.
3. Missing schema, `null`, or invalid registry returns fail-closed `block`.
4. Stronger overlays dominate weaker overlays.
5. Same-rank tie-breakers are deterministic.
6. Weakening is rejected unless an explicit policy rule matches.
7. M/E/C audit-only enforcement cannot weaken hard runtime blocks.
8. `degrade` records residual risk and final-state ceiling.
9. Warnings below a dominant block remain visible as evidence obligations.
10. `DONE_VERIFIED` cannot pass with stale, partial, conflicted or missing
    evidence, or with non-verified convergence.
11. Persisted block decisions emit blocker evidence and do not mutate protected
    state.
12. Event append failure prevents mutation success even when guard verdict is
    `allow`.

## Decision Delta

| Cycle 02 blocker | Cycle 03 result |
|---|---|
| Guard merge is prose, not an algorithm. | `closed_by_contract`: total order, merge algorithm, tie-breakers and fixture matrix are defined here. |
| `degrade` finality unclear. | `closed_by_contract`: `degrade` is a verdict that permits only declared fallback progress and caps final-state claims until resolved. |
| Weakening semantics missing. | `closed_by_contract`: weakening is denied by default and allowed only by explicit registry-backed rule. |
| Side effects undefined. | `closed_by_contract`: verdict side effects and event/evidence obligations are defined. |
| Conflict fixtures missing. | `closed_by_fixture`: GM-001 through GM-020 define implementation fixture expectations. |

## Summary

PFV4 guard merge is a deterministic lattice over normalized overlay outputs.
The executable rule is:

```text
sort overlays by canonical order
choose the strongest verdict
retain lower warnings as evidence obligations
allow weakening only by explicit registry-backed rule
fail closed for schema, registry, runtime, evidence, convergence and final-state hard invariants
```

This closes the guard merge lane for schema-first implementation planning,
subject to concrete JSON Schema and policy registry files in the implementation
phase.
