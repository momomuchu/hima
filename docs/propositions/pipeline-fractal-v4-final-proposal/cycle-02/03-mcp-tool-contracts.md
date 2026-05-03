# 03 - MCP Tool Contracts

Status: Cycle 02 contract draft

## Purpose

This document turns the Cycle 01 MCP kernel proposal into implementation-shaped
tool contracts without writing code.

The contracts assume the final proposal architecture:

```text
Hybrid event-sourced RMS kernel
+ one MCP state/control server
+ runtime adapters/hooks
+ portable skills
+ bounded subagents
+ durable books
```

The MCP server is the portable state/control surface. The RMS kernel remains
the authority. Tools do not execute shell commands, spawn subagents, edit files,
or store secrets. They capture state, evaluate guards, append events, record
evidence, expose projections, and close runs.

## Contract Principles

1. Every mutating tool appends an event before returning success.
2. If event append fails, the mutation fails and no state projection advances.
3. Snapshots are projections over append-only events, not independent truth.
4. `primary_lens`, `evidence_status`, and `convergence_status` are derived.
5. No tool accepts `null`; unknown, absent, or inapplicable values use explicit
   sentinels such as `UNKNOWN`, `UNSET`, or `NOT_APPLICABLE`.
6. A tool may return a degraded route only when Binding Set and Policy Set allow
   it, and only with traceable evidence.
7. `DONE_VERIFIED` is unavailable unless evidence and convergence both evaluate
   to `verified`.
8. `M/E/C` work cannot silently downgrade required enforcement primitives.
9. Runtime names never imply enforceability. Binding metadata decides.
10. Tools return structured errors that can be recorded as blocker evidence.

## Shared Types

### Identifiers

Identifiers are stable ASCII strings.

| Field | Shape | Example |
|---|---|---|
| `run_id` | `run_` + date/time or UUID | `run_2026-05-03_001` |
| `intent_id` | `intent_` + suffix | `intent_2026-05-03_001` |
| `route_id` | `route_` + suffix | `route_2026-05-03_001` |
| `capability_set_id` | `cap_` + runtime + version/date | `cap_codex_2026-05-03` |
| `binding_set_id` | `binding_` + runtime + version | `binding_codex_v1` |
| `evidence_id` | `ev_` + suffix | `ev_tests_001` |
| `decision_id` | `gd_` + suffix | `gd_runtime_001` |
| `event_id` | `evt_` + suffix | `evt_000123` |
| `registry_version` | semantic or content hash | `registry_2026-05-03_a1b2` |

### Enumerations

| Domain | Values |
|---|---|
| `run_kind` | `conversation`, `research`, `architecture`, `planning`, `development`, `validation`, `release`, `operations`, `learning` |
| `pipeline_activation` | `inactive`, `candidate`, `armed`, `active`, `suspended`, `closing`, `closed` |
| `harness_machine.status` | `NOT_ACTIVE`, `IDLE`, `ACTIVE` |
| `macro_cycle` | `IDLE`, `DISCOVERY`, `CADRAGE`, `CONCEPTION`, `BUILD`, `VALIDATION`, `RELEASE`, `RUN`, `APPRENTISSAGE` |
| `risk_class` | `UNCLASSIFIED`, `T`, `F`, `M`, `E`, `C` |
| `supervision_mode` | `pairing`, `auto_decision`, `bypass` |
| `primary_lens` | `NONE`, `OBSERVE`, `DEFINE`, `DESIGN`, `EXECUTE`, `VERIFY`, `CAPITALIZE`, `TRANSMIT` |
| `evidence_status` | `missing`, `partial`, `sufficient`, `with_gaps`, `verified`, `stale`, `conflicted`, `NOT_APPLICABLE` |
| `convergence_status` | `not_sampled`, `converging`, `flat`, `oscillating`, `diverging`, `verified`, `NOT_APPLICABLE` |
| `guard_decision` | `allow`, `warn`, `block`, `escalate`, `degrade`, `reroute` |
| `binding_status` | `native`, `fallback`, `noop_traced`, `missing`, `capability_unknown` |
| `final_state` | `DONE_VERIFIED`, `DONE_WITH_GAPS`, `BLOCKED_NEEDS_USER`, `BLOCKED_RUNTIME_MISSING`, `BLOCKED_POLICY`, `MAX_ATTEMPTS_REACHED`, `LOOP_DETECTED`, `CANCELLED`, `ABORTED` |

### Tool Request Envelope

Every tool accepts this conceptual envelope, plus tool-specific fields.

```json
{
  "run_id": "run_2026-05-03_001",
  "actor": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex"
  },
  "request_id": "req_0001",
  "registry_version": "registry_2026-05-03_a1b2",
  "idempotency_key": "optional_stable_key",
  "reason": "short operator- or agent-visible reason"
}
```

`run_id` is omitted only by `rms.start_run`.

### Tool Response Envelope

Every successful tool returns:

```json
{
  "ok": true,
  "run_id": "run_2026-05-03_001",
  "event_ids": ["evt_000123"],
  "state_version": "state_v42",
  "state_ref": "hash_or_snapshot_ref",
  "warnings": [],
  "degraded": false
}
```

Every failed tool returns:

```json
{
  "ok": false,
  "run_id": "run_2026-05-03_001",
  "error": {
    "code": "GUARD_BLOCKED",
    "message": "transition blocked by runtime_guard",
    "retryable": false,
    "required_action": "inspect runtime and bind a policy-allowed fallback",
    "decision_id": "gd_runtime_001",
    "event_ids": ["evt_000123"]
  }
}
```

For mutating tools, an error event is still appended when the kernel is healthy.
If the append itself fails, the tool returns `EVENT_APPEND_FAILED` and must not
claim a state change.

### Common Error Codes

| Code | Meaning |
|---|---|
| `SCHEMA_INVALID` | Input does not match schema or contains `null`. |
| `RUN_NOT_FOUND` | `run_id` is unknown. |
| `RUN_CLOSED` | Run is immutable except append-only audit reads/events. |
| `REGISTRY_VERSION_MISMATCH` | Caller used a stale or unknown registry version. |
| `INVARIANT_VIOLATION` | Requested state would violate V2 invariants. |
| `GUARD_BLOCKED` | Guard returned `block`. |
| `ESCALATION_REQUIRED` | Guard requires human checkpoint or independent review. |
| `CAPABILITY_UNKNOWN` | Required runtime capability has not been inspected. |
| `RUNTIME_BINDING_MISSING` | Required primitive has no native or allowed fallback binding. |
| `DEGRADED_ROUTE_FORBIDDEN` | Fallback exists but risk/mode policy forbids degradation. |
| `EVIDENCE_INSUFFICIENT` | Evidence Set does not satisfy the requested transition or final state. |
| `EVIDENCE_STALE` | Evidence predates the latest relevant state/scope/binding change. |
| `EVIDENCE_CONFLICTED` | Evidence items disagree and require reconciliation. |
| `CONVERGENCE_NOT_VERIFIED` | Final state requires convergence proof that is missing or weak. |
| `TERRITORY_DENIED` | Path/tool/action is not allowed in current state. |
| `EVENT_APPEND_FAILED` | Kernel could not append the required event. |
| `LOCK_CONFLICT` | Another writer holds the run lock. |

## Event Emission Rules

Mutating tools must emit at least one event from the approved event registry.

| Tool | Minimum success events | Minimum failure/block events |
|---|---|---|
| `rms.start_run` | `RUN_STARTED`, `INTENT_CAPTURED` | `RUN_START_REJECTED` |
| `rms.inspect_runtime` | `CAPABILITY_DISCOVERED` | `CAPABILITY_DISCOVERY_FAILED` |
| `rms.bind_runtime` | `BINDING_RESOLVED` | `BINDING_FAILED` |
| `rms.classify_risk` | `RISK_CLASSIFIED` or `RISK_CLASS_PROMOTED` | `RISK_CLASSIFICATION_BLOCKED` |
| `rms.plan_route` | `ROUTE_PLANNED` | `ROUTE_PLAN_BLOCKED` |
| `rms.evaluate_guard` | `GUARD_EVALUATED` | `GUARD_EVALUATION_FAILED` |
| `rms.transition` | `STATE_TRANSITION_REQUESTED`, then `STATE_TRANSITION_COMMITTED` | `STATE_TRANSITION_REQUESTED`, then `STATE_TRANSITION_BLOCKED` |
| `rms.record_event` | caller-supplied allowed event type | `EVENT_RECORD_REJECTED` |
| `rms.record_evidence` | `EVIDENCE_RECORDED` | `EVIDENCE_REJECTED` |
| `rms.evaluate_evidence` | `EVIDENCE_EVALUATED` | `EVIDENCE_EVALUATION_FAILED` |
| `rms.evaluate_convergence` | `CONVERGENCE_EVALUATED` | `CONVERGENCE_EVALUATION_FAILED` |
| `rms.close_run` | `FINAL_STATE_CANDIDATE`, `RUN_CLOSING`, `RUN_CLOSED` | `FINAL_STATE_CANDIDATE`, then final-state block event |
| `rms.check_territory` | `TERRITORY_CHECKED` when persisted | `TERRITORY_CHECKED` with blocked decision |
| `rms.check_runtime_binding` | `RUNTIME_BINDING_CHECKED` when persisted | `RUNTIME_BINDING_CHECKED` with blocked decision |
| `rms.validate_registry` | `REGISTRY_VALIDATED` when persisted | `REGISTRY_INVALID` |

Read-only tools such as `rms.get_state` and `rms.get_events` do not append
events by default. They may append audit events only when policy requires read
auditing for sensitive runs.

## Core Tool Contracts

### `rms.start_run`

Purpose: create a run id, RunEnvelope, Intent Set, initial projection, and first
events.

Input:

```json
{
  "actor": {},
  "request_id": "req_0001",
  "intent": {
    "summary": "design Cycle 02 MCP tool contracts",
    "scope": ["create 03-mcp-tool-contracts.md"],
    "non_scope": ["implementation code", "other files"],
    "deliverables": ["docs contract"],
    "done_criteria": ["file exists", "contracts cover inputs outputs errors invariants events degradation"],
    "risk_signals": ["docs-only"],
    "autonomy": "auto_decision"
  },
  "run_kind": "development",
  "pipeline_activation_hint": "candidate",
  "initial_derived_lens_hint": "DESIGN",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "run_id": "run_2026-05-03_001",
  "intent_id": "intent_2026-05-03_001",
  "run_envelope": {
    "run_kind": "development",
    "pipeline_activation": "candidate",
    "intent_ref": "intent_2026-05-03_001",
    "route_ref": "UNSET"
  },
  "harness_machine": { "status": "NOT_ACTIVE" },
  "derived_view": {
    "primary_lens": "DESIGN",
    "evidence_status": "missing",
    "convergence_status": "not_sampled"
  },
  "event_ids": ["evt_000001", "evt_000002"]
}
```

Invariants:

- `pipeline_activation=inactive|candidate` implies
  `harness_machine.status=NOT_ACTIVE`.
- No `macro_cycle` or `cycle_substate` is interpreted while status is
  `NOT_ACTIVE`.
- `initial_derived_lens_hint` is a hint only and is not authoritative pipeline
  state.

Degraded behavior:

- If registry data is unavailable, start may create an `inactive` run only if
  policy allows unguided capture. It must not arm or activate the pipeline.
- If event append fails, no run is created.

### `rms.inspect_runtime`

Purpose: produce or refresh Runtime Capability Set from current runtime facts.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "runtime": "codex",
  "probe_scope": ["hooks", "mcp", "filesystem", "subagents", "shell", "sandbox"],
  "observed_facts": {
    "surface": "native-hook / Codex App outside tmux",
    "network_access": "enabled",
    "sandbox_mode": "danger-full-access",
    "approval_policy": "never",
    "omx_question": "not_available"
  },
  "actor": {},
  "request_id": "req_0002",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "capability_set_id": "cap_codex_2026-05-03",
  "capabilities": {
    "pre_tool_blocking_hooks": "UNKNOWN",
    "post_tool_audit_hooks": "available",
    "mcp_client": "available",
    "mcp_server_local": "UNKNOWN",
    "subagents": "available",
    "human_question_bridge": "missing",
    "shell": "available",
    "filesystem_write": "available"
  },
  "runtime_meta_region": "capability_degraded",
  "event_ids": ["evt_000003"]
}
```

Invariants:

- Unknown capability is represented as `UNKNOWN`, not assumed false or true.
- Capability inspection records redacted facts only; secrets are never stored.
- Capability data older than route-changing or runtime-changing events may be
  marked stale by guard evaluation.

Degraded behavior:

- If a probe cannot be executed, the capability becomes `UNKNOWN`.
- Required `UNKNOWN` capabilities block later enforcement-sensitive actions
  until discovery or reroute.

### `rms.bind_runtime`

Purpose: resolve Runtime Binding Set from abstract RMS gates to runtime
primitives and fallback enforceability.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "runtime": "codex",
  "capability_set_id": "cap_codex_2026-05-03",
  "required_bindings": [
    "pre_tool_territory_guard",
    "post_tool_audit",
    "stop_gate",
    "question_checkpoint"
  ],
  "risk_class": "M",
  "supervision_mode": "auto_decision",
  "actor": {},
  "request_id": "req_0003",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "binding_set_id": "binding_codex_v1",
  "bindings": [
    {
      "required_gate": "pre_tool_territory_guard",
      "binding_status": "fallback",
      "can_block": false,
      "fallback_strategy": "post_tool_audit",
      "fail_open_risk": true,
      "trace_event": "RUNTIME_BINDING_CHECKED"
    }
  ],
  "allowed_degradations": [],
  "blocked_bindings": ["pre_tool_territory_guard"],
  "event_ids": ["evt_000004"]
}
```

Invariants:

- `binding_status=fallback` must name a fallback strategy.
- `binding_status=noop_traced` is acceptable only for non-enforcement concerns
  or low-risk warnings.
- Missing or audit-only enforcement blocks `M/E/C` when policy requires
  synchronous blocking.

Degraded behavior:

- For `T/F`, fallback may be allowed if declared and traced.
- For `M+`, degraded enforcement returns `RUNTIME_BINDING_MISSING` or
  `DEGRADED_ROUTE_FORBIDDEN` unless policy explicitly allows the fallback.

### `rms.classify_risk`

Purpose: assign or promote `risk_class` using policy rules and forcing signals.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "current_risk_class": "UNCLASSIFIED",
  "proposed_risk_class": "F",
  "signals": [
    { "signal": "docs_only", "minimum_class": "T" },
    { "signal": "architecture_contract", "minimum_class": "F" }
  ],
  "requested_supervision_mode": "auto_decision",
  "actor": {},
  "request_id": "req_0004",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "risk_class": "F",
  "supervision_mode": "auto_decision",
  "promotion": false,
  "forcing_signals_applied": ["architecture_contract"],
  "policy_effects": {
    "bypass_allowed": "conditional",
    "human_checkpoint": "none_unless_warning",
    "evidence_depth": "light"
  },
  "event_ids": ["evt_000005"]
}
```

Invariants:

- Risk may be promoted automatically by forcing signals.
- Downgrade requires explicit rationale and cannot discard higher-risk evidence
  without an event.
- `risk_class=UNCLASSIFIED` forbids `bypass`.
- `M/E/C` forbids `bypass` by default; `E/C` forbids it structurally.
- `C` forbids autonomous `auto_decision` without a human checkpoint.

Degraded behavior:

- If signals are incomplete, return `UNCLASSIFIED` with
  `RISK_CLASSIFICATION_BLOCKED`; do not arm or macro-handoff past Cadrage.

### `rms.plan_route`

Purpose: create Route Set from Intent, Policy, Capability, Binding, Risk, and
Registry state.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "intent_id": "intent_2026-05-03_001",
  "risk_class": "F",
  "supervision_mode": "auto_decision",
  "capability_set_id": "cap_codex_2026-05-03",
  "binding_set_id": "binding_codex_v1",
  "target": {
    "start_macro_cycle": "BUILD",
    "start_substate": "build.work_scope_loaded",
    "expected_final_state": "DONE_VERIFIED"
  },
  "rejected_alternatives": [
    { "route": "full Discovery start", "reason": "scope already supplied" }
  ],
  "actor": {},
  "request_id": "req_0005",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "route_id": "route_2026-05-03_001",
  "route": {
    "mode": "solo_execute",
    "runtime": "codex",
    "pipeline": ["BUILD", "VALIDATION", "APPRENTISSAGE"],
    "required_gates": ["territory_guard", "runtime_guard", "evidence_guard", "convergence_guard"],
    "required_evidence": ["change_summary", "verification_result", "final_report"],
    "degraded": false
  },
  "event_ids": ["evt_000006"]
}
```

Invariants:

- A route cannot claim enforceability not present in Binding Set.
- A route cannot select `bypass` when current risk/mode policy forbids it.
- Route planning may set a degraded route only with declared fallback, policy
  allowance, and evidence requirements for the degradation.

Degraded behavior:

- If only low-risk audit fallback is available, the route may be degraded for
  `T/F` and must include `DEGRADED_ROUTE_ACCEPTED` evidence requirements.
- For `M/E/C`, missing enforcement returns `ROUTE_PLAN_BLOCKED` unless a
  policy-approved fallback exists.

### `rms.evaluate_guard`

Purpose: return deterministic guard decision without committing state.

Input:

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
      "target_path": "harness-architecture/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/03-mcp-tool-contracts.md"
    }
  },
  "actor": {},
  "request_id": "req_0006",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "decision_id": "gd_0001",
  "decision": {
    "decision": "allow",
    "gate": "transition_guard",
    "reason": "docs write is inside declared scope for build.implementation_slice",
    "severity": "info",
    "risk_class": "F",
    "required_action": "record diff evidence before validation handoff",
    "evidence_required": ["state_transition_event", "change_summary"]
  },
  "event_ids": ["evt_000007"]
}
```

Invariants:

- Decision is deterministic for the same state, evidence, registry version,
  capability set, and binding set.
- Guard merge order is:
  `base_guard + risk_overlay + supervision_overlay + runtime_overlay +
  territory_overlay + evidence_overlay + convergence_overlay`.
- Any `block` from a hard overlay dominates `allow`.
- `escalate`, `degrade`, and `reroute` must include required action.

Degraded behavior:

- If capability data is `UNKNOWN` and required for the guard, return
  `block` with `CAPABILITY_UNKNOWN`.
- If registry is invalid, return `REGISTRY_VERSION_MISMATCH` or
  `INVARIANT_VIOLATION`; do not infer from prose docs.

### `rms.transition`

Purpose: request a state transition and commit it only if guards pass.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "transition_id": "BLD-06",
  "event": "SUBSTATE_COMPLETE",
  "from_state_ref": "state_v41",
  "to_state_patch": {
    "harness_machine": {
      "macro_cycle": "BUILD",
      "cycle_substate": "build.local_quality_check"
    }
  },
  "evidence_refs": ["ev_diff_001"],
  "actor": {},
  "request_id": "req_0007",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "decision_id": "gd_0002",
  "state_before_ref": "state_v41",
  "state_after_ref": "state_v42",
  "event_ids": ["evt_000008", "evt_000009"],
  "derived_view": {
    "primary_lens": "VERIFY",
    "evidence_status": "partial",
    "convergence_status": "converging"
  }
}
```

Invariants:

- Internal transitions target substates belonging to the active macro-cycle.
- Macro transitions start and end at registered handoff substates.
- `pipeline_activation=active` requires real `macro_cycle`, real
  `cycle_substate`, and a registry-derived lens.
- Transitions changing activation, macro cycle, substate, risk, supervision, or
  final state must emit append-only events.
- Blocked transitions emit blocker evidence and do not disappear silently.

Degraded behavior:

- If guard returns `warn`, transition may commit with warning evidence.
- If guard returns `degrade`, transition commits only if caller accepts the
  degraded route and required degradation evidence is recorded.
- If guard returns `block` or `escalate`, transition does not commit.

### `rms.record_event`

Purpose: append a typed event for runtime callbacks that cannot call richer
tools.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "event": {
    "event_type": "TOOL_FAILED",
    "actor": "runtime",
    "severity": "warn",
    "runtime": "codex",
    "binding_status": "native",
    "payload": {
      "tool": "shell",
      "exit_code": 1,
      "summary": "command failed"
    }
  },
  "actor": {},
  "request_id": "req_0008",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "event_ids": ["evt_000010"],
  "state_version": "state_v42",
  "projection_updated": true
}
```

Invariants:

- `record_event` cannot directly mutate protected state fields unless the event
  type is explicitly registered as projection-affecting.
- Caller-supplied event types must be in the registry.
- Payloads must be redacted and schema-valid.

Degraded behavior:

- If event type is unknown, reject with `SCHEMA_INVALID`.
- If projection update fails after append, keep the event and mark snapshot as
  stale for rebuild; do not delete the event.

### `rms.record_evidence`

Purpose: add command, test, review, subagent, runtime, or decision proof into
Evidence Set.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "evidence": {
    "evidence_type": "verification_result",
    "producer": "agent",
    "scope_refs": ["route_2026-05-03_001"],
    "state_refs": ["state_v42"],
    "artifact_refs": ["harness-architecture/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/03-mcp-tool-contracts.md"],
    "summary": "file created and headings verified",
    "result": "pass",
    "freshness_basis": {
      "valid_after_event_id": "evt_000009",
      "invalidated_by": []
    },
    "conflicts": [],
    "gaps": []
  },
  "actor": {},
  "request_id": "req_0009",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "evidence_id": "ev_verify_001",
  "evidence_status_after": "sufficient",
  "event_ids": ["evt_000011"]
}
```

Invariants:

- Evidence must reference the state, route, artifact, or event it proves.
- Subagent output is not authoritative until recorded as accepted evidence.
- Evidence with conflicts can be stored, but derived status becomes
  `conflicted` until reconciled.
- Evidence predating relevant scope, route, runtime binding, or file changes is
  stale for affected requirements.

Degraded behavior:

- If artifact references are unavailable but the proof is otherwise useful,
  record with explicit gap and prevent `verified` status.
- If evidence is malformed, reject it; do not store unverifiable proof.

### `rms.evaluate_evidence`

Purpose: derive evidence status and gaps for a phase, transition, or final
candidate.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "evaluation_target": {
    "target_type": "final_state",
    "candidate": "DONE_VERIFIED"
  },
  "risk_class": "F",
  "route_id": "route_2026-05-03_001",
  "actor": {},
  "request_id": "req_0010",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "evidence_status": "with_gaps",
  "satisfied_requirements": ["change_summary", "verification_result"],
  "missing_requirements": [],
  "stale_requirements": [],
  "conflicts": [],
  "accepted_gaps": [
    {
      "gap": "no automated tests for docs-only contract",
      "owner": "agent",
      "risk_allowed": true
    }
  ],
  "done_verified_allowed": false,
  "done_with_gaps_allowed": true,
  "event_ids": ["evt_000012"]
}
```

Invariants:

- `DONE_VERIFIED` requires `evidence_status=verified`.
- `DONE_WITH_GAPS` requires explicit, owned, risk-allowed gaps.
- `stale` and `conflicted` block `DONE_VERIFIED`.
- Evidence status is derived, not caller-supplied.

Degraded behavior:

- If evidence requirements registry is unavailable, final-state evaluation
  blocks with `REGISTRY_VERSION_MISMATCH`.
- If evidence is sufficient for stopping but not verification, suggest
  `DONE_WITH_GAPS` only when risk policy permits.

### `rms.evaluate_convergence`

Purpose: update convergence status from event and evidence history.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "sample": {
    "progress_event": "VERIFICATION_PASSED",
    "state_pattern": ["BUILD", "VALIDATION"],
    "new_information": true,
    "defect_count_delta": 0,
    "scope_change_delta": 0
  },
  "actor": {},
  "request_id": "req_0011",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "convergence": {
    "score": 0.91,
    "last_progress_event": "VERIFICATION_PASSED",
    "stalled_samples": 0,
    "divergence_signals": []
  },
  "convergence_status": "verified",
  "loop_candidate": false,
  "event_ids": ["evt_000013"]
}
```

Invariants:

- Max attempts is a fuse, not the convergence model.
- Repeated state patterns without new information create a loop candidate.
- `DONE_VERIFIED` requires `convergence_status=verified`.
- Convergence status is derived from Convergence Set, not manually set.

Degraded behavior:

- If thresholds are not registered, return `not_sampled` or `flat` with a gap;
  do not mark `verified`.
- If samples conflict, mark `diverging` or `oscillating` and require reroute or
  human checkpoint according to risk.

### `rms.close_run`

Purpose: move active or suspended run to closing, evaluate stop gates, and
commit one final state.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "final_candidate": "DONE_VERIFIED",
  "evidence_evaluation_ref": "evt_000012",
  "convergence_evaluation_ref": "evt_000013",
  "open_blockers": [],
  "accepted_gaps": [],
  "actor": {},
  "request_id": "req_0012",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "final_state": "DONE_VERIFIED",
  "pipeline_activation": "closed",
  "final_record": {
    "evidence_status": "verified",
    "convergence_status": "verified",
    "risk_class": "F",
    "blockers": [],
    "gaps": []
  },
  "event_ids": ["evt_000014", "evt_000015", "evt_000016"]
}
```

Invariants:

- Final states are not macro-cycles.
- Closing is a protocol: candidate, evidence evaluation, convergence
  evaluation, policy/runtime blocker check, final commit.
- `DONE_VERIFIED` requires verified evidence and verified convergence.
- `DONE_WITH_GAPS` is forbidden for unresolved `E/C` residual gaps.
- Closed runs are immutable except append-only audit events.

Degraded behavior:

- If MCP/kernel cannot evaluate final state, RMS cannot issue
  `DONE_VERIFIED`.
- If evidence is `with_gaps` and risk allows, close as `DONE_WITH_GAPS`.
- If runtime primitive is missing and no fallback is allowed, close as
  `BLOCKED_RUNTIME_MISSING`.
- If human checkpoint is required and absent, close as `BLOCKED_NEEDS_USER` or
  remain blocked according to policy.

### `rms.get_state`

Purpose: return canonical state snapshot plus derived view.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "include": ["run_envelope", "harness_machine", "derived_view", "refs"],
  "at_state_version": "latest",
  "actor": {},
  "request_id": "req_0013"
}
```

Output:

```json
{
  "ok": true,
  "run_id": "run_2026-05-03_001",
  "state_version": "state_v42",
  "run_envelope": {},
  "harness_machine": {},
  "derived_view": {},
  "refs": {
    "intent_ref": "intent_2026-05-03_001",
    "route_ref": "route_2026-05-03_001",
    "capability_set_id": "cap_codex_2026-05-03",
    "binding_set_id": "binding_codex_v1"
  }
}
```

Invariants:

- Returned derived fields must validate against registries and source sets.
- A stale snapshot must be labeled stale or rebuilt from events before return.

Degraded behavior:

- If snapshot is corrupt but event log is valid, rebuild projection and return
  warning.
- If event log is unavailable, return `RUN_NOT_FOUND` or `INVARIANT_VIOLATION`;
  do not return guessed state.

### `rms.get_events`

Purpose: return append-only event slices by cursor, type, time, or run id.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "cursor": "evt_000010",
  "limit": 100,
  "filter": {
    "event_types": ["EVIDENCE_RECORDED", "CONVERGENCE_EVALUATED"],
    "severity": ["info", "warn", "block", "error"]
  },
  "actor": {},
  "request_id": "req_0014"
}
```

Output:

```json
{
  "ok": true,
  "events": [],
  "next_cursor": "evt_000110",
  "complete": true
}
```

Invariants:

- Event order is stable and append-only.
- Events include enough refs to reconstruct projection and decision history.

Degraded behavior:

- If an event is malformed, return valid prefix plus integrity warning only if
  policy allows read; state mutation remains blocked until repaired.

### `rms.check_territory`

Purpose: evaluate path/tool/action permission against current state and policy.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "action": {
    "tool": "filesystem_write",
    "action_type": "write",
    "target_path": "harness-architecture/docs/propositions/pipeline-fractal-v4-final-proposal/cycle-02/03-mcp-tool-contracts.md"
  },
  "state_ref": "state_v42",
  "persist_decision": true,
  "actor": {},
  "request_id": "req_0015",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "decision_id": "gd_territory_001",
  "decision": "allow",
  "reason": "target path is the declared Cycle 02 MCP contracts document",
  "required_evidence": ["TERRITORY_CHECKED"],
  "event_ids": ["evt_000017"]
}
```

Invariants:

- Territory evaluation uses at least
  `macro_cycle + cycle_substate + tool + target_path + action_type`.
- Suspended state permits only audit/state append actions unless policy says
  otherwise.
- Discovery/conception states may read broadly but cannot write Build outputs
  unless route and guard allow it.

Degraded behavior:

- If runtime cannot block the write but policy allows audit fallback, return
  `degrade` and require post-action audit evidence.
- If risk is `M+` and blocking enforcement is required but missing, return
  `block`.

### `rms.check_runtime_binding`

Purpose: decide whether a required runtime primitive is native, fallback,
`noop_traced`, missing, or unknown.

Input:

```json
{
  "run_id": "run_2026-05-03_001",
  "required_gate": "pre_tool_territory_guard",
  "runtime": "codex",
  "risk_class": "M",
  "supervision_mode": "auto_decision",
  "capability_set_id": "cap_codex_2026-05-03",
  "binding_set_id": "binding_codex_v1",
  "persist_decision": true,
  "actor": {},
  "request_id": "req_0016",
  "registry_version": "registry_2026-05-03_a1b2"
}
```

Output:

```json
{
  "ok": true,
  "decision_id": "gd_binding_001",
  "binding": {
    "required_gate": "pre_tool_territory_guard",
    "binding_status": "fallback",
    "can_block": false,
    "fallback_strategy": "post_tool_audit",
    "fail_open_risk": true,
    "trace_event": "RUNTIME_BINDING_CHECKED"
  },
  "decision": "block",
  "reason": "M risk requires blocking enforcement; fallback is audit-only",
  "event_ids": ["evt_000018"]
}
```

Invariants:

- The decision is based on binding metadata, not runtime name.
- `capability_unknown` blocks until runtime discovery.
- `missing` blocks unless the route can be changed before action.

Degraded behavior:

- `noop_traced` may satisfy observability-only requirements.
- `fallback` may satisfy low-risk enforcement only when declared and
  risk/mode policy allows it.

### `rms.validate_registry`

Purpose: validate state, guard, transition, policy, evidence, binding, and lens
registries before executable use.

Input:

```json
{
  "registry_version": "registry_2026-05-03_a1b2",
  "registry_refs": [
    "transitions",
    "guards",
    "risk_overlays",
    "runtime_bindings",
    "evidence_requirements",
    "lens_mappings"
  ],
  "persist_result": true,
  "actor": {},
  "request_id": "req_0017"
}
```

Output:

```json
{
  "ok": true,
  "registry_version": "registry_2026-05-03_a1b2",
  "valid": true,
  "checks": {
    "no_null_values": "pass",
    "substates_map_to_lenses": "pass",
    "transitions_target_known_substates": "pass",
    "guard_overlays_merge_deterministically": "pass",
    "final_state_requirements_exist": "pass"
  },
  "event_ids": ["evt_000019"]
}
```

Invariants:

- Every active substate maps to exactly one primary lens.
- Every transition target is known and belongs to the correct macro-cycle.
- Every final state has evidence and convergence requirements.
- Overlay conflicts have deterministic precedence.

Degraded behavior:

- Invalid registry blocks executable state-machine use.
- Read-only inactive runs may continue as conversation/architecture work, but
  cannot arm, transition, or close as `DONE_VERIFIED`.

## Minimal State Mutation Authority

Only these tools may mutate protected state fields:

| Field | Allowed tools |
|---|---|
| `run_envelope.pipeline_activation` | `rms.start_run`, `rms.transition`, `rms.close_run` |
| `run_envelope.intent_ref` | `rms.start_run` |
| `run_envelope.route_ref` | `rms.plan_route`, `rms.transition` for route replacement |
| `harness_machine.macro_cycle` | `rms.transition` |
| `harness_machine.cycle_substate` | `rms.transition` |
| `harness_machine.risk_class` | `rms.classify_risk`, `rms.transition` for registered risk transitions |
| `harness_machine.supervision_mode` | `rms.classify_risk`, `rms.transition` for registered mode transitions |
| `harness_machine.runtime_context` | `rms.inspect_runtime`, `rms.bind_runtime`, `rms.transition` for reroute |
| `harness_machine.meta_regions` | `rms.transition`, `rms.inspect_runtime`, `rms.bind_runtime`, evidence/convergence evaluators |
| `convergence` | `rms.evaluate_convergence` |
| `final_state` | `rms.close_run` |

Derived view fields are never mutated directly.

## Degraded Operation Matrix

| Condition | Tool response | Allowed continuation |
|---|---|---|
| Capability unknown | `CAPABILITY_UNKNOWN` block | Run `rms.inspect_runtime`; no enforcement-sensitive transition. |
| Required primitive missing | `RUNTIME_BINDING_MISSING` block | Reroute or close `BLOCKED_RUNTIME_MISSING`. |
| Fallback declared for T/F | `degrade` or `warn` | Continue only with `DEGRADED_ROUTE_ACCEPTED` evidence. |
| Fallback declared for M/E/C enforcement | `DEGRADED_ROUTE_FORBIDDEN` by default | Continue only if explicit policy allows and evidence records risk acceptance. |
| Hook unavailable but audit possible | `warn` for T/F, `block` for M+ when blocking required | Audit fallback only for low-risk policy-allowed actions. |
| Event append fails | `EVENT_APPEND_FAILED` | No mutation; caller may retry after lock/storage repair. |
| Evidence stale | `EVIDENCE_STALE` | Re-run proof or close with gaps only when risk allows. |
| Evidence conflicted | `EVIDENCE_CONFLICTED` | Reconcile or reroute; no `DONE_VERIFIED`. |
| Convergence flat/oscillating | `CONVERGENCE_NOT_VERIFIED` | Re-route, reframe, or human checkpoint; no `DONE_VERIFIED`. |
| Registry invalid | `REGISTRY_VERSION_MISMATCH` or `INVARIANT_VIOLATION` | Block executable use until registry validation passes. |
| MCP unavailable | No tool decision possible | Runtime may continue outside governed pipeline; RMS cannot issue `DONE_VERIFIED`. |

## Open Decisions Carried Into These Contracts

These contracts choose implementation defaults where Cycle 01 and V2 already
recommend one, but they do not close the decisions by themselves.

| Decision | Contract default |
|---|---|
| PFV4-OD-001 cycle substate cardinality | Variable semantic substates, each mapped to one primary lens. |
| PFV4-OD-002 transition topology | Explicit directed transition graph. |
| PFV4-OD-003 non-development representation | Inactive runs may expose derived lens while `harness_machine.status=NOT_ACTIVE`. |
| PFV4-OD-004 activation gate | `candidate -> armed` requires Intent, Policy, Capability, Route, and Risk known or explicitly `UNKNOWN`; `armed -> active` requires registered cycle start. |
| PFV4-OD-005 risk/supervision matrix | ASCII `T/F/M/E/C`; bypass allowed for `T`, conditional for `F`, blocked for `M`, forbidden for `E/C`; `C` needs human checkpoint. |
| PFV4-OD-006 risk classifier | Agent proposes, forcing signals set minima, human validates when policy requires. |
| PFV4-OD-007 convergence thresholds | Score/samples/signals model, not max attempts alone. |
| PFV4-OD-008 evidence semantics | Derived from Evidence Set requirements, freshness, conflicts, and accepted gaps. |
| PFV4-OD-009 runtime degradation | Fallback only when declared in Capability/Binding sets and risk policy permits it. |
| PFV4-OD-010 guard registry | Split declarative registries with validated merged view. |
| PFV4-OD-011 ASCII canonicalization | English ASCII executable identifiers. |
| PFV4-OD-012 territory enforcement | Layered registry + runtime hook + audit fallback, with risk-based blocking. |
| PFV4-OD-013 closing protocol | Final candidate enters `closing`; stop gate validates evidence, convergence, blockers, and policy before `closed`. |

## Implementation Readiness Tests Implied

The eventual implementation should have fixtures proving:

1. `null` input is rejected.
2. `DONE_VERIFIED` with `evidence_status=partial` blocks.
3. `DONE_VERIFIED` with `convergence_status=flat` blocks.
4. `pipeline_activation=inactive` cannot carry interpreted macro/substate.
5. `risk_class=C` with `auto_decision` escalates or blocks without human
   checkpoint.
6. `M` risk with audit-only territory enforcement blocks.
7. `T/F` degraded fallback records degradation evidence.
8. Stale runtime capability blocks route planning for enforcement-sensitive
   actions.
9. A blocked transition emits blocker evidence and does not mutate state.
10. Closed runs reject further protected mutations.
11. Invalid registry blocks executable state-machine use.
12. Event append failure prevents mutation success.

## Contract Boundary

These tool contracts intentionally do not define:

- concrete JSON Schema files;
- storage paths under `.rms/`;
- registry file split details;
- guard merge conflict precedence beyond the required merge order;
- convergence numeric thresholds;
- runtime adapter implementation;
- MCP transport configuration.

Those belong to the Cycle 02 registry/storage, guard algorithm, and fixture
lanes. This document defines what the tools must accept, return, reject, emit,
and preserve.
