# 04 - Closing Transaction And Reopen Contract

Status: Cycle 04 executable contract proposal

## Purpose

Cycle 03 closed evidence freshness, runtime degradation, human checkpoints,
artifact drift and candidate evidence import, but left PFV4-OD-013 blocked
because final closure was still a protocol sketch. This document turns closing
into an implementation-shaped contract for:

- `policies/closing-policy.yaml`;
- `rms.close_run` transaction order;
- final-state eligibility;
- accepted gaps;
- blocked final states;
- event append failure during close;
- late evidence before and after closure;
- reopen and correction flow;
- immutable closed state;
- fixture families.

This contract does not reopen Candidate C, authority order, evidence freshness,
risk/runtime degradation, human checkpoint semantics, candidate import, storage
layout or MCP tool authority. It composes those Cycle 02 and Cycle 03 contracts
into the final close gate.

## Sources Used

- `cycle-04/00-cycle-04-brief.md`
- `cycle-03/06-cycle-03-audit.md`
- `cycle-03/07-cycle-03-integration.md`
- `cycle-03/03-evidence-requirements-freshness.md`
- `cycle-03/04-risk-runtime-degradation.md`
- `cycle-03/05-artifact-human-candidate-evidence.md`
- `cycle-02/03-mcp-tool-contracts.md`
- `cycle-02/04-registry-storage-layout.md`
- `cycle-02/05-verification-fixtures.md`

## Contract Decision

PFV4-OD-013 is closed for schema-first implementation planning if the
implementation follows these defaults:

```text
close authority = RMS kernel through rms.close_run
close protocol = active/suspended -> closing -> closed
event authority = RUN_CLOSED event, not snapshot field
success final states = DONE_VERIFIED or DONE_WITH_GAPS
blocked final states = explicit stop records, not success
closed state = immutable protected fields
late evidence after closure = append-only audit/correction candidate
reopen = new run or correction overlay, never in-place final-state rewrite
append failure during close = no final mutation
```

`rms.close_run` is the only tool that may commit `final_state`. Skills,
subagents, runtime adapters, evidence evaluators and convergence
evaluators may recommend or block closure, but they do not write protected final
fields.

## Registry Placement

Closing policy is an executable registry file:

```text
.rms/
  registry/
    policies/
      closing-policy.yaml
    schemas/
      close-run-request.schema.json
      close-run-result.schema.json
      closing-policy.schema.json
      final-record.schema.json
      accepted-gap.schema.json
      blocked-final-record.schema.json
      late-evidence-record.schema.json
      reopen-request.schema.json
      correction-record.schema.json
  runs/
    <run_id>/
      snapshots/
        closed-state.json
      decisions/
        close-decisions.jsonl
        reopen-decisions.jsonl
        correction-decisions.jsonl
      artifacts/
        closing/
        late-evidence/
      transactions/
        pending/
        committed/
        failed/
```

`registry/registry-manifest.yaml` must include `policies/closing-policy.yaml`
and its digest. A close request whose registry version or digest differs from
the run manifest is blocked unless a registered migration has made the run
current.

## `policies/closing-policy.yaml` Conceptual Schema

The closing policy is declarative data. Implementations should validate it with
JSON Schema after parsing YAML.

```yaml
schema_version: "1.0"
policy_id: "pfv4-closing-policy"
policy_version: "pfv4-closing-v1"
registry_version: "pfv4-registry-v1"
canonical_charset: "ascii"

protected_closed_fields:
  - "run_envelope.pipeline_activation"
  - "run_envelope.final_state"
  - "run_envelope.closed"
  - "run_manifest.final_state"
  - "run_manifest.closed"
  - "snapshots.closed-state.json"

final_states:
  DONE_VERIFIED:
    class: "success"
    requires:
      evidence_status: "verified"
      convergence_status: "verified"
      accepted_gaps: "none"
      open_blockers: "none"
      runtime_blockers: "none"
      territory_blockers: "none"
      human_checkpoint: "current_when_required"
      registry_validation: "fresh"
      storage_integrity: "clean"
    emits:
      - "FINAL_STATE_CANDIDATE"
      - "RUN_CLOSING"
      - "RUN_CLOSED"

  DONE_WITH_GAPS:
    class: "success_with_gaps"
    requires:
      evidence_status: ["with_gaps", "sufficient"]
      convergence_status: ["verified", "converging"]
      accepted_gaps: "all_policy_allowed"
      open_blockers: "none"
      runtime_blockers: "none_for_hard_gates"
      territory_blockers: "none_for_governed_targets"
      human_checkpoint: "current_for_final_gap_acceptance_when_required"
      registry_validation: "fresh"
      storage_integrity: "clean"
    forbidden:
      gap_classes:
        - "security"
        - "rollback"
        - "human_checkpoint"
        - "runtime_hard_gate"
        - "territory_violation"
      risk_classes:
        C: "critical_residual_gap"

  BLOCKED_NEEDS_USER:
    class: "blocked"
    requires:
      blocker_evidence: "human_checkpoint_missing_invalid_expired_or_rejected"
      recovery_action: "present"

  BLOCKED_RUNTIME_MISSING:
    class: "blocked"
    requires:
      blocker_evidence: "runtime_binding_missing_unknown_stale_or_forbidden"
      recovery_action: "present"

  BLOCKED_POLICY:
    class: "blocked"
    requires:
      blocker_evidence: "policy_or_registry_denial"
      recovery_action: "present"

  MAX_ATTEMPTS_REACHED:
    class: "blocked"
    requires:
      blocker_evidence: "attempt_fuse_and_distinct_hypotheses"
      recovery_action: "reroute_or_stop"

  LOOP_DETECTED:
    class: "blocked"
    requires:
      blocker_evidence: "convergence_loop_without_new_signal"
      recovery_action: "reroute_checkpoint_or_reframe"

  CANCELLED:
    class: "terminal_non_success"
    requires:
      cancellation_source: "present"
      last_safe_state: "present"

  ABORTED:
    class: "terminal_non_success"
    requires:
      abort_reason: "present"
      integrity_boundary: "present"

late_evidence:
  before_run_closed: "rerun_close_evaluations"
  after_run_closed_success_pass: "record_late_evidence_audit"
  after_run_closed_fail_or_conflict: "record_correction_candidate"
  mutate_closed_state: "forbidden"

reopen:
  allowed_reopen_modes:
    - "new_followup_run"
    - "correction_overlay"
  forbidden_modes:
    - "rewrite_run_closed_event"
    - "rewrite_final_state_in_place"
    - "edit_closed_snapshot_in_place"
  requires:
    original_run_closed: true
    material_reason: true
    evidence_refs: "present"
    actor: "present"
    registry_digest: "current_or_migration_recorded"
```

Policy validation rules:

- No field accepts `null`; use `UNKNOWN`, `UNSET` or `NOT_APPLICABLE`.
- Every final state in `state/final-states.yaml` must appear in
  `closing-policy.yaml`.
- Every required status value must exist in the evidence, convergence, runtime,
  territory, storage or human checkpoint registry.
- `DONE_VERIFIED` cannot allow accepted gaps.
- `DONE_WITH_GAPS` cannot allow H/C hard residual gaps or any forbidden gap
  class.
- Blocked final states require enough blocker evidence to explain the stop, not
  enough evidence to prove success.
- Reopen modes cannot mutate protected closed fields.

## CloseRun Request

`rms.close_run` accepts a schema-valid request:

```json
{
  "schema_version": "close-run-request-v1",
  "run_id": "run_2026-05-03_001",
  "request_id": "req_close_001",
  "idempotency_key": "close_run_2026-05-03_001_DONE_VERIFIED",
  "actor": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex"
  },
  "final_candidate": "DONE_VERIFIED",
  "state_ref": "state_v42",
  "route_ref": "route_2026-05-03_001",
  "evidence_evaluation_ref": "evt_evidence_evaluated_001",
  "convergence_evaluation_ref": "evt_convergence_evaluated_001",
  "runtime_binding_ref": "binding_codex_v1",
  "territory_decision_refs": ["gd_territory_final_001"],
  "storage_integrity_ref": "storage_check_001",
  "human_checkpoint_refs": [],
  "open_blockers": [],
  "accepted_gaps": [],
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "reason": "final evidence and convergence verified"
}
```

Required request rules:

- `final_candidate` must be one of the registered final states.
- `state_ref` must be the latest current-state snapshot ref at lock acquisition
  time.
- `evidence_evaluation_ref` and `convergence_evaluation_ref` are required for
  success final states.
- Blocked final states require blocker evidence refs specific to the blocker.
- `accepted_gaps` may be non-empty only for `DONE_WITH_GAPS` or blocked states
  that preserve known gaps without claiming success.
- The request cannot supply derived final eligibility directly. The kernel
  recomputes eligibility under lock.

## Transaction Order

`rms.close_run` is a single run mutation using the same event-first storage
rules as Cycle 02. The close transaction uses this order:

1. Acquire `.rms/runs/<run_id>/locks/run.lock`.
2. Read `run-manifest.json`, `events.jsonl` tail digest, current snapshot,
   Evidence Set, Convergence Set, Route Set, Binding Set, territory decisions,
   pinned registry digest and pending transactions.
3. Reject if another pending transaction exists unless recovery has resolved it.
4. Reject if `pipeline_activation=closed`, except for idempotent replay of the
   same committed close result.
5. Validate request schemas and registry digest.
6. Write `transactions/pending/<tx_id>.json` with the close request, previous
   event digest, previous manifest digest and idempotency key.
7. Append `FINAL_STATE_CANDIDATE` with the requested candidate and request refs.
8. Re-read latest event selectors under lock and detect material events after
   the supplied evidence or convergence evaluations.
9. If material late evidence or state changes exist, append
   `CLOSE_REEVALUATION_REQUIRED` or a registered blocker event, mark the
   transaction failed, rebuild projections and return `EVIDENCE_STALE` or
   `CONVERGENCE_NOT_VERIFIED`.
10. Append `RUN_CLOSING` and set the in-memory projection to
    `pipeline_activation=closing`.
11. Recompute final eligibility from policy, evidence, convergence, risk,
    runtime, territory, human checkpoint, registry and storage integrity facts.
12. If eligibility fails for the requested candidate, append the required
    blocked event or `FINAL_STATE_REJECTED`, publish only the non-final
    projection, move the transaction to `failed/`, and return a structured
    block.
13. If eligibility passes, prepare a `FinalRecord` and closed-state projection
    in temporary files.
14. Append `RUN_CLOSED` with `final_state`, `final_record`, policy refs,
    evidence refs, convergence refs, event-log digest before close, and
    protected-field hash.
15. Force durability of `events.jsonl`.
16. Atomically publish `snapshots/closed-state.json` and final current-state
    projection.
17. Update `run-manifest.json` with `pipeline_activation=closed`,
    `final_state`, `closed=true`, latest event digest and closed snapshot ref.
18. Append a close decision entry to `decisions/close-decisions.jsonl` or store
    it as an artifact referenced by `RUN_CLOSED`; if this append fails after
    `RUN_CLOSED`, recovery rebuilds it from the event.
19. Move the transaction file to `transactions/committed/<tx_id>.json`.
20. Release the lock and return success.

Ordering constraints:

- `RUN_CLOSED` is the first event that makes the final state authoritative.
- No snapshot or manifest may show `closed=true` before `RUN_CLOSED` is durably
  appended.
- If event append fails before `RUN_CLOSED`, the run remains not closed.
- If projection publish fails after `RUN_CLOSED`, recovery must rebuild
  snapshots from the event log and mark the transaction recovered.
- If a failure event cannot be appended, the pending transaction file is the
  recovery signal and governed mutation remains blocked.

## FinalRecord Schema

The `RUN_CLOSED` event payload contains a final record:

```json
{
  "schema_version": "final-record-v1",
  "run_id": "run_2026-05-03_001",
  "final_state": "DONE_VERIFIED",
  "closed_at": "2026-05-03T00:00:00Z",
  "closed_by": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex"
  },
  "risk_class": "M",
  "supervision_mode": "pairing",
  "route_ref": "route_2026-05-03_001",
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "evidence": {
    "evaluation_ref": "evt_evidence_evaluated_001",
    "status": "verified",
    "evidence_refs": ["ev_tests_001", "ev_review_001"]
  },
  "convergence": {
    "evaluation_ref": "evt_convergence_evaluated_001",
    "status": "verified",
    "convergence_set_ref": "conv_set_v4"
  },
  "runtime": {
    "binding_set_id": "binding_codex_v1",
    "status": "native_or_policy_allowed",
    "blocked_gates": []
  },
  "territory": {
    "decision_refs": ["gd_territory_final_001"],
    "violations": []
  },
  "human": {
    "checkpoint_refs": [],
    "required_checkpoint_status": "NOT_APPLICABLE"
  },
  "accepted_gaps": [],
  "open_blockers": [],
  "storage": {
    "event_log_digest_before_run_closed": "sha256:...",
    "run_closed_event_id": "evt_run_closed_001",
    "closed_state_digest": "sha256:..."
  },
  "immutability": {
    "protected_field_hash": "sha256:...",
    "reopen_mode": "new_followup_run_or_correction_overlay_only"
  }
}
```

Final record rules:

- It is stored in the `RUN_CLOSED` event payload and materialized in
  `snapshots/closed-state.json`.
- The event payload is authoritative; the snapshot is rebuildable.
- Protected fields cannot be edited after closure.
- `accepted_gaps` must use the accepted gap schema below.
- Blocked final records use the same envelope plus a `blocked_final_record`.

## AcceptedGap Schema And Handling

Accepted gaps are explicit final-state facts, not missing evidence hidden by
language.

```json
{
  "schema_version": "accepted-gap-v1",
  "gap_id": "gap_ci_unavailable_001",
  "requirement_id": "req_evid_optional_ci",
  "gap_class": "optional_verification",
  "risk_class": "L",
  "owner": {
    "actor_type": "agent",
    "actor_id": "codex-main"
  },
  "reason": "CI unavailable for docs-only change; local markdown checks passed",
  "evidence_refs": ["ev_local_check_001"],
  "policy_refs": ["closing.DONE_WITH_GAPS.L.optional_verification"],
  "follow_up": {
    "action": "run_ci_when_available",
    "due": "NEXT_TOUCH",
    "tracking_ref": "UNSET"
  },
  "expiry": "END_OF_RUN",
  "human_checkpoint_ref": "NOT_APPLICABLE"
}
```

Handling rules:

- `DONE_VERIFIED` requires `accepted_gaps=[]`.
- `DONE_WITH_GAPS` requires every gap to have owner, reason, affected
  requirement, risk class, evidence refs, policy refs, follow-up and expiry.
- A gap cannot satisfy a block requirement unless evidence policy explicitly
  marks that requirement waivable for the current risk and final state.
- Gaps with class `security`, `rollback`, `human_checkpoint`,
  `runtime_hard_gate` or `territory_violation` block success final states.
- H/C gaps require a current, scoped human checkpoint when policy allows them at
  all. C critical residual gaps block `DONE_WITH_GAPS`.
- Accepted gaps remain visible in the final record and learning outputs; they
  are not erased by closure.

## Final-State Eligibility Matrix

| Final candidate | Required evidence | Required convergence | Allowed gaps | Blockers allowed | Close result |
|---|---|---|---|---|---|
| `DONE_VERIFIED` | `verified` | `verified` | none | none | success close |
| `DONE_WITH_GAPS` | `with_gaps` or `sufficient` with all non-waivable block requirements satisfied | `verified` or policy-allowed `converging` | only policy-allowed, owned, non-hard gaps | none | success-with-gaps close |
| `BLOCKED_NEEDS_USER` | blocker evidence naming missing/invalid/rejected/expired checkpoint | any non-success status allowed | preserved, not success-accepted | human blocker required | blocked close |
| `BLOCKED_RUNTIME_MISSING` | runtime binding evidence naming missing, unknown, stale or forbidden gate | any non-success status allowed | preserved, not success-accepted | runtime blocker required | blocked close |
| `BLOCKED_POLICY` | policy or registry block evidence | any non-success status allowed | preserved, not success-accepted | policy blocker required | blocked close |
| `MAX_ATTEMPTS_REACHED` | attempt fuse evidence plus last distinct hypotheses | not `verified` for success | preserved | convergence/attempt blocker required | blocked close |
| `LOOP_DETECTED` | convergence loop evidence with repeated pattern and missing new signal | `flat`, `oscillating` or `diverging` | preserved | loop blocker required | blocked close |
| `CANCELLED` | cancellation source and last safe state | not required | preserved | cancellation request required | terminal non-success close |
| `ABORTED` | abort reason and integrity boundary | not required | preserved | abort reason required | terminal non-success close |

General eligibility rules:

- `stale` or `conflicted` evidence blocks both `DONE_VERIFIED` and direct
  `DONE_WITH_GAPS`.
- Missing or partial success evidence may close only as an appropriate blocked
  final state.
- Fresh runtime hard-gate failure blocks success final states even when
  evidence and convergence are otherwise strong.
- Territory denial on governed target blocks success final states.
- Storage integrity failure blocks all final commits except an abort only when
  the abort event can be durably appended.
- Registry invalidity blocks all final commits until recovery, because the
  final-state policy itself cannot be trusted.

## Blocked Final State Payloads

Blocked final states are valid stops, not success claims. They must include a
blocked final record:

```json
{
  "schema_version": "blocked-final-record-v1",
  "final_state": "BLOCKED_RUNTIME_MISSING",
  "blocker_code": "RUNTIME_BINDING_MISSING",
  "risk_class": "M",
  "supervision_mode": "auto_decision",
  "affected_gate": "pre_tool_write_guard",
  "affected_action": "write_file",
  "affected_paths": ["docs/propositions/example.md"],
  "binding_status": "missing",
  "rejected_fallback": "NOT_APPLICABLE",
  "policy_refs": ["risk.runtime.M.enforcement.missing"],
  "evidence_refs": ["evt_runtime_binding_checked_001"],
  "latest_safe_state_ref": "state_v42",
  "recovery_action": "install native binding, choose native-equivalent fallback, reroute, or reduce scope with approved downgrade"
}
```

Required blocked payload fields by final state:

| Final state | Required fields |
|---|---|
| `BLOCKED_NEEDS_USER` | checkpoint requirement, requested action, target refs, risk class, missing/invalid/rejected/expired status, recovery action. |
| `BLOCKED_RUNTIME_MISSING` | required gate, binding status, can-block status, rejected fallback, risk class, affected action, recovery action. |
| `BLOCKED_POLICY` | policy id, violated requirement, attempted action, current state, required recovery. |
| `MAX_ATTEMPTS_REACHED` | attempt window, attempts used, last distinct hypotheses, missing progress signal, reroute requirement. |
| `LOOP_DETECTED` | repeated pattern, sample window, missing new information, divergence signals, reroute/checkpoint requirement. |
| `CANCELLED` | cancellation actor, cancellation event, last safe state, uncommitted work summary. |
| `ABORTED` | abort actor, abort reason, integrity state, recovery boundary, whether storage append succeeded. |

## Event Append Failure During Close

Event append failure is fail-closed:

| Failure point | Required result |
|---|---|
| Cannot append `FINAL_STATE_CANDIDATE` | Return `EVENT_APPEND_FAILED`; no close state, no snapshot advance. |
| Candidate appended, later evaluation stale | Append blocker event if possible; no `RUN_CLOSED`; transaction moves to `failed/`. |
| Cannot append `RUN_CLOSING` | Return `EVENT_APPEND_FAILED`; pending transaction remains; no final mutation. |
| `RUN_CLOSING` appended, cannot append `RUN_CLOSED` | Run remains `closing` or recovers to last event-derived state; no final state is authoritative. |
| `RUN_CLOSED` appended, snapshot publish fails | Close is authoritative; recovery rebuilds `closed-state.json` from events. |
| `RUN_CLOSED` appended, manifest update fails | Close is authoritative; recovery repairs manifest from event log and marks transaction recovered. |
| Log is unavailable for failure record | Leave pending transaction and block governed transitions on next load. |

The kernel must never report `ok=true` for close unless `RUN_CLOSED` has been
durably appended and the returned state can be derived from the event log.

## Late Evidence Before Closure

Late evidence before `RUN_CLOSED` is material when it can affect evidence,
convergence, runtime, territory, risk, registry or final candidate eligibility.

Rules:

1. During close, after `FINAL_STATE_CANDIDATE` and before `RUN_CLOSED`, the
   kernel re-reads latest selectors under the run lock.
2. Any material event after the supplied evidence or convergence evaluation
   makes those evaluation refs stale for success final states.
3. Passing late evidence may satisfy missing proof only after
   `rms.evaluate_evidence` reruns and emits a fresh evaluation event.
4. Failing or conflicting late evidence blocks success final states until
   conflict resolution or an appropriate blocked final state is requested.
5. Late runtime, territory, risk or registry events require their respective
   evaluators to rerun before close.
6. The close request may be retried with the same idempotency key only if the
   candidate and request body are identical and no `RUN_CLOSED` exists.

## Late Evidence After Closure

After `RUN_CLOSED`, the closed protected fields are immutable.

Allowed after closure:

- append `LATE_EVIDENCE_RECORDED` when evidence is audit-only and does not seek
  final-state mutation;
- append `LATE_EVIDENCE_REJECTED_FOR_MUTATION` when a caller tries to rewrite
  protected state;
- append `CORRECTION_CANDIDATE_RECORDED` when late evidence materially
  contradicts the final record;
- append `REOPEN_REQUESTED` only as part of the reopen protocol below;
- read and rebuild snapshots from the event log.

Forbidden after closure:

- rewriting `RUN_CLOSED`;
- editing `final_state`;
- replacing `closed-state.json` except by deterministic replay of events;
- deleting or mutating prior evidence items;
- converting `DONE_VERIFIED` to `DONE_WITH_GAPS` in place;
- using late evidence to satisfy a final state retroactively.

If the append-only audit path is unavailable, the runtime must report
`EVENT_APPEND_FAILED` or `AUDIT_APPEND_UNAVAILABLE` and must not claim the
closed run was updated.

## Reopen And Correction Protocol

Reopen is not in-place mutation. It is one of two registered modes.

### Mode 1 - New Follow-Up Run

Use when new work is needed, the original final state remains historically
true, or correction requires additional implementation.

Required events:

```text
REOPEN_REQUESTED
FOLLOWUP_RUN_STARTED
REOPEN_LINK_RECORDED
```

The original run remains closed. The new run references the original run,
late evidence refs, reason, inherited scope if any, and rejected alternatives.

### Mode 2 - Correction Overlay

Use when the original final record contains a material error in reporting,
classification, evidence interpretation or artifact reference, but protected
closed state must remain unchanged.

Required events:

```text
CORRECTION_CANDIDATE_RECORDED
CORRECTION_REVIEWED
CORRECTION_APPLIED
```

The correction overlay is an append-only record:

```json
{
  "schema_version": "correction-record-v1",
  "correction_id": "corr_0001",
  "original_run_id": "run_2026-05-03_001",
  "original_final_state": "DONE_VERIFIED",
  "correction_type": "final_report_erratum",
  "materiality": "material",
  "late_evidence_refs": ["ev_late_ci_fail_001"],
  "affected_claims": ["tests passed on current route"],
  "corrected_statement": "Late CI failure was recorded after closure and requires follow-up run; original final state is not rewritten.",
  "review_refs": ["ev_correction_review_001"],
  "followup_run_id": "run_2026-05-03_002",
  "protected_fields_changed": false
}
```

Correction rules:

- A correction can supersede report claims, not event history.
- A correction cannot change `final_state`, `closed=true`, registry digest,
  event sequence or protected closed snapshot hash.
- Material corrections require review evidence. H/C corrections require a
  scoped human checkpoint when policy requires it.
- If the correction means the work is no longer acceptable, the recovery action
  is a new follow-up run, not in-place downgrade.
- Reopen requests against runs with corrupt event chains block until storage
  recovery establishes an authoritative history.

## Idempotency And Duplicate Close Requests

Close idempotency is strict:

- Same `idempotency_key`, same request digest and existing `RUN_CLOSED` returns
  the committed close result.
- Same `idempotency_key`, different request digest returns
  `IDEMPOTENCY_CONFLICT`.
- Different key after closure returns `RUN_CLOSED` and the existing final
  record unless the request is a late-evidence, reopen or correction operation.
- A retry after append failure may continue only from event-log replay and the
  pending transaction record.

## Immutable Closed State

Closed state immutability is field-level and event-backed.

Protected fields:

```text
run_envelope.pipeline_activation
run_envelope.final_state
run_envelope.closed
run_manifest.final_state
run_manifest.closed
run_manifest.closed_snapshot_ref
snapshots/closed-state.json content for the RUN_CLOSED event
RUN_CLOSED event payload
event sequence and digests before and including RUN_CLOSED
```

Mutable after closure only through append-only records:

```text
late evidence audit events
reopen decisions
correction decisions
learning artifacts
rebuilt projections that exactly match event replay
```

Any tool request attempting protected mutation after closure returns
`RUN_CLOSED` or `PROTECTED_CLOSED_STATE` and, if the log is writable, appends an
audit rejection event.

## CloseRun Response

Success response:

```json
{
  "ok": true,
  "run_id": "run_2026-05-03_001",
  "final_state": "DONE_VERIFIED",
  "pipeline_activation": "closed",
  "final_record_ref": "evt_run_closed_001",
  "closed_state_ref": "snap_closed_001",
  "event_ids": [
    "evt_final_candidate_001",
    "evt_run_closing_001",
    "evt_run_closed_001"
  ],
  "warnings": [],
  "degraded": false
}
```

Blocked response:

```json
{
  "ok": false,
  "run_id": "run_2026-05-03_001",
  "error": {
    "code": "EVIDENCE_STALE",
    "message": "final evidence evaluation predates late material evidence",
    "retryable": true,
    "required_action": "rerun rms.evaluate_evidence and retry close",
    "decision_id": "close_decision_001",
    "event_ids": ["evt_final_candidate_001", "evt_close_reevaluation_required_001"]
  }
}
```

## Event Types Added Or Required

Cycle 02 already required `FINAL_STATE_CANDIDATE`, `RUN_CLOSING`,
`RUN_CLOSED`, `TRANSACTION_FAILED` and `INVARIANT_VIOLATION`. This contract
requires the registry to include or map these close-specific events:

```text
FINAL_STATE_REJECTED
CLOSE_REEVALUATION_REQUIRED
LATE_EVIDENCE_RECORDED
LATE_EVIDENCE_REJECTED_FOR_MUTATION
CORRECTION_CANDIDATE_RECORDED
CORRECTION_REVIEWED
CORRECTION_APPLIED
REOPEN_REQUESTED
FOLLOWUP_RUN_STARTED
REOPEN_LINK_RECORDED
PROTECTED_CLOSED_STATE_REJECTED
```

Event naming may be normalized during schema implementation, but every semantic
case above must have a distinct testable event or error code.

## Fixtures

These fixtures extend Cycle 02 `VF-FINAL-*`, Cycle 03 `EVREQ-*`,
`VF-RISKRT-*` and Cycle 04 storage recovery fixtures.

### VF-CLOSE-001 - DONE_VERIFIED Commits Through RUN_CLOSED

Input:

```yaml
final_candidate: DONE_VERIFIED
evidence_status: verified
convergence_status: verified
open_blockers: []
accepted_gaps: []
runtime:
  required_bindings: native_or_policy_allowed
territory:
  violations: []
storage:
  append_available: true
  integrity: clean
```

Expected outcome: `PASS`

Expected checks:

- Events are appended in order: `FINAL_STATE_CANDIDATE`, `RUN_CLOSING`,
  `RUN_CLOSED`.
- `RUN_CLOSED` carries a final record.
- Manifest and closed snapshot derive from the event log.
- `DONE_VERIFIED` has no accepted gaps.

### VF-CLOSE-002 - DONE_VERIFIED With Accepted Gap Blocks

Input:

```yaml
final_candidate: DONE_VERIFIED
evidence_status: with_gaps
convergence_status: verified
accepted_gaps:
  - gap_id: gap_optional_ci
    gap_class: optional_verification
```

Expected outcome: `BLOCK`

Expected checks:

- Closing policy rejects `DONE_VERIFIED`.
- Required action is either satisfy the gap or request `DONE_WITH_GAPS`.
- No `RUN_CLOSED` success event is appended.

### VF-CLOSE-003 - DONE_WITH_GAPS Allows Owned L Gap

Input:

```yaml
final_candidate: DONE_WITH_GAPS
risk_class: L
evidence_status: with_gaps
convergence_status: verified
accepted_gaps:
  - requirement_id: req_optional_ci
    gap_class: optional_verification
    owner: codex-main
    policy_refs: [closing.DONE_WITH_GAPS.L.optional_verification]
    follow_up: run_ci_when_available
```

Expected outcome: `PASS`

Expected checks:

- Gap schema validates.
- Gap is present in the final record.
- Final state is `DONE_WITH_GAPS`, not `DONE_VERIFIED`.

### VF-CLOSE-004 - H Rollback Gap Cannot Close With Gaps

Input:

```yaml
final_candidate: DONE_WITH_GAPS
risk_class: H
accepted_gaps:
  - gap_class: rollback
    requirement_id: req_e_rollback
```

Expected outcome: `BLOCK`

Expected checks:

- Closing policy rejects forbidden gap class.
- Human checkpoint cannot erase mandatory rollback proof.
- Valid outcomes are refresh proof, reroute, or blocked final state.

### VF-CLOSE-005 - Blocked Runtime Missing Closes As Blocked

Input:

```yaml
final_candidate: BLOCKED_RUNTIME_MISSING
risk_class: M
runtime:
  required_gate: pre_tool_write_guard
  binding_status: missing
  fallback_strategy: NOT_APPLICABLE
evidence_refs:
  - evt_runtime_binding_checked
```

Expected outcome: `PASS`

Expected checks:

- `RUN_CLOSED` final state is `BLOCKED_RUNTIME_MISSING`.
- Blocked final record names gate, binding status, rejected fallback, risk and
  recovery action.
- The stop is not reported as success.

### VF-CLOSE-006 - Event Append Failure Before RUN_CLOSED Blocks Mutation

Input:

```yaml
final_candidate: DONE_VERIFIED
evidence_status: verified
convergence_status: verified
event_log:
  append_failure_at: RUN_CLOSED
```

Expected outcome: `BLOCK`

Expected checks:

- No final state is authoritative.
- Manifest does not show `closed=true`.
- Pending or failed transaction records drive recovery.

### VF-CLOSE-007 - RUN_CLOSED Appended But Snapshot Fails

Input:

```yaml
final_candidate: DONE_VERIFIED
events:
  run_closed_appended: true
snapshot_publish:
  failed: true
```

Expected outcome: `PASS`

Expected checks:

- Event log is authoritative.
- Startup recovery rebuilds `closed-state.json`.
- Transaction is marked recovered or committed after replay.

### VF-CLOSE-008 - Late Evidence Before Closure Forces Re-Evaluation

Input:

```yaml
run:
  pipeline_activation: closing
events:
  - event_type: EVIDENCE_EVALUATED
    event_id: evt_eval_verified
  - event_type: EVIDENCE_RECORDED
    event_id: evt_late_ci_fail
    result: fail
close_request:
  evidence_evaluation_ref: evt_eval_verified
  final_candidate: DONE_VERIFIED
```

Expected outcome: `BLOCK`

Expected checks:

- Close detects material event after evaluation.
- `RUN_CLOSED` is not appended.
- Required action is rerun evidence evaluation or choose a blocked final state.

### VF-CLOSE-009 - Late Evidence After Closure Cannot Rewrite Final State

Input:

```yaml
run:
  pipeline_activation: closed
  final_state: DONE_VERIFIED
late_evidence:
  proof_type: ci-result
  result: fail
request:
  operation: mutate_final_state
  value: DONE_WITH_GAPS
```

Expected outcome: `BLOCK`

Expected checks:

- Protected final state is immutable.
- Mutation request is rejected with `RUN_CLOSED` or
  `PROTECTED_CLOSED_STATE`.
- Late evidence is recorded only as audit or correction candidate when append is
  available.

### VF-CLOSE-010 - Correction Overlay Does Not Change Protected Fields

Input:

```yaml
run:
  pipeline_activation: closed
  final_state: DONE_VERIFIED
late_evidence:
  result: fail
correction_request:
  correction_type: final_report_erratum
  protected_fields_changed: false
```

Expected outcome: `PASS`

Expected checks:

- `CORRECTION_CANDIDATE_RECORDED`, `CORRECTION_REVIEWED` and
  `CORRECTION_APPLIED` are append-only.
- `final_state` remains `DONE_VERIFIED`.
- Follow-up run is linked when new work is required.

### VF-CLOSE-011 - Reopen Starts Follow-Up Run

Input:

```yaml
original_run:
  closed: true
  final_state: DONE_WITH_GAPS
reopen_request:
  mode: new_followup_run
  reason: gap follow-up now available
  evidence_refs: [ev_late_ci_available]
```

Expected outcome: `PASS`

Expected checks:

- Original run remains closed.
- New run references original run and late evidence.
- Reopen link is append-only.

### VF-CLOSE-012 - Duplicate Close Request Is Idempotent

Input:

```yaml
first_close:
  idempotency_key: close_001
  request_digest: hash_a
  final_state: DONE_VERIFIED
second_close:
  idempotency_key: close_001
  request_digest: hash_a
```

Expected outcome: `PASS`

Expected checks:

- Second call returns existing final record.
- No duplicate `RUN_CLOSED` is appended.
- Event sequence remains valid.

### VF-CLOSE-013 - Idempotency Key Conflict Blocks

Input:

```yaml
first_close:
  idempotency_key: close_001
  request_digest: hash_a
second_close:
  idempotency_key: close_001
  request_digest: hash_b
```

Expected outcome: `BLOCK`

Expected checks:

- Kernel returns `IDEMPOTENCY_CONFLICT`.
- No final-state mutation occurs.
- Conflict is auditable if event append is available.

### VF-CLOSE-014 - Storage Integrity Failure Blocks Success Close

Input:

```yaml
final_candidate: DONE_VERIFIED
evidence_status: verified
convergence_status: verified
storage:
  pending_transactions: [tx_old]
  recovery_status: unresolved
```

Expected outcome: `BLOCK`

Expected checks:

- Success final states are unavailable.
- Required action is storage recovery before close.
- No snapshot advances ahead of event replay.

### VF-CLOSE-015 - Closed Run Rejects Protected Mutation

Input:

```yaml
run:
  pipeline_activation: closed
  final_state: DONE_VERIFIED
request:
  tool: rms.transition
  patch:
    run_envelope:
      final_state: DONE_WITH_GAPS
```

Expected outcome: `BLOCK`

Expected checks:

- Request is rejected as protected closed-state mutation.
- If writable, an audit rejection event is appended.
- Current closed snapshot remains replay-equivalent to `RUN_CLOSED`.

## Implementation Readiness Result

This lane closes PFV4-OD-013 for schema-first implementation planning if the
implementation creates:

1. `policies/closing-policy.yaml` with final-state requirements, protected
   fields, late-evidence rules and reopen modes.
2. `rms.close_run` as an event-first transaction with the order defined above.
3. Schemas for close request, close response, final record, accepted gaps,
   blocked final records, late evidence, reopen request and correction record.
4. Eligibility tests for every final state.
5. Fixture coverage for success close, gaps, blocked stops, event append
   failure, late evidence before closure, late evidence after closure,
   idempotency, reopen, correction and immutable closed state.

If any of those objects remain prose-only, PFV4-OD-013 remains
`still_blocking`.
