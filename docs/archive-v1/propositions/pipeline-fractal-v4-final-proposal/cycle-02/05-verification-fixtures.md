# 05 - Verification Fixtures

Status: Cycle 02 verification design

## Purpose

These fixtures turn the Cycle 01 final proposal and V2 validation checklist into
implementation-shaped test cases. They do not define production schemas yet.
They define the minimum observable inputs and expected outcomes an implementer
must preserve when building the RMS kernel, MCP tools, guard registry, runtime
bindings, evidence checks, subagent intake, skill/hook drift detection and final
state gates.

## Sources Used

- `cycle-02/00-cycle-02-brief.md`
- `../06-integrated-final-proposal.md`
- `../02-edge-case-red-team.md`
- `../03-skills-hooks-subagents-taxonomy.md`
- `../04-single-mcp-state-kernel.md`
- `../05-convergence-validation-cycle.md`
- `../../pipeline-fractal-v4-state-machine/09-validation-checklist.md`

## Verdict Vocabulary

| Verdict | Meaning |
|---|---|
| `PASS` | The fixture is valid and may continue to the next gate, possibly with `warn` or `degrade` evidence when explicitly stated. |
| `BLOCK` | The fixture must not advance. The kernel must return a blocking guard, schema, evidence, convergence, runtime, or final-state decision. |

Every `BLOCK` fixture must leave evidence of the block: a validation error,
guard decision, runtime degradation record, convergence event, conflict record or
final-state rejection.

## Common Minimal Objects

Fixtures use these object names without implying final file names:

```text
RunEnvelope
HarnessMachineState
DerivedView
RuntimeCapabilitySet
RuntimeBindingSet
PolicySet
RouteSet
EvidenceSet
ConvergenceSet
RegistrySet
EventLog
```

Any fixture that changes `pipeline_activation`, `macro_cycle`,
`cycle_substate`, `risk_class`, `supervision_mode` or `final_state` must also
expect an append-only event. If the event cannot be appended, the mutation is
`BLOCK`.

## Schema Fixtures

### VF-SCHEMA-001 - Active Development State Is Structurally Valid

Input:

```yaml
run_envelope:
  run_id: run_dev_m_001
  run_kind: development
  pipeline_activation: active
  intent_ref: intent_dev_m_001
  route_ref: route_dev_m_001
harness_machine:
  status: RUNNING
  macro_cycle: BUILD
  cycle_substate: build.local_quality_check
  risk_class: M
  supervision_mode: pairing
  runtime_context:
    runtime: codex
    capability_set_id: cap_codex_001
    binding_set_id: bind_codex_001
  meta_regions:
    attention: normal
    policy: enforced
    runtime: native
    delegation: none
    human: available
    safety: normal
  convergence:
    score: 0.62
    last_progress_event: evt_tests_added
    stalled_samples: 0
    divergence_signals: []
derived_view:
  primary_lens: EXECUTE
  secondary_lenses: [VERIFY]
  evidence_status: partial
  convergence_status: improving
events:
  latest_event_id: evt_tests_added
```

Expected outcome: `PASS`

Expected checks:

- State fields are nested under `run_envelope`, `harness_machine` and
  `derived_view`.
- `primary_lens` is derived from `build.local_quality_check`, not accepted as an
  independently mutable state field.
- The state may continue in Build or Validation.
- A later `DONE_VERIFIED` candidate is still `BLOCK` until evidence and
  convergence are verified.

### VF-SCHEMA-002 - Null State Field Is Invalid

Input:

```yaml
harness_machine:
  status: RUNNING
  macro_cycle: BUILD
  cycle_substate: null
```

Expected outcome: `BLOCK`

Expected checks:

- The no-null rule rejects `null`.
- The error names the missing field and the allowed sentinel alternatives.
- No state transition event is committed.

### VF-SCHEMA-003 - Inactive Architecture Run Can Expose A Derived Lens

Input:

```yaml
run_envelope:
  run_id: run_arch_001
  run_kind: architecture
  pipeline_activation: inactive
  intent_ref: intent_arch_001
  route_ref: NOT_APPLICABLE
harness_machine:
  status: NOT_ACTIVE
derived_view:
  primary_lens: DESIGN
  secondary_lenses: [DEFINE]
  evidence_status: candidate
  convergence_status: NOT_APPLICABLE
```

Expected outcome: `PASS`

Expected checks:

- `macro_cycle` and `cycle_substate` are not interpreted while
  `status=NOT_ACTIVE`.
- Architecture artifacts may be `candidate_evidence`.
- Any attempt to use the artifacts as authoritative pipeline evidence without an
  import transition is `BLOCK`.

### VF-SCHEMA-004 - Generic Lens-Like Substate Is Invalid

Input:

```yaml
harness_machine:
  status: RUNNING
  macro_cycle: BUILD
  cycle_substate: BUILD.Executer
```

Expected outcome: `BLOCK`

Expected checks:

- Stored substates must be semantic and cycle-prefixed, for example
  `build.local_quality_check`.
- Lens names such as `EXECUTE` are derived registry metadata, not substates.

### VF-SCHEMA-005 - Final State Outside Macro Cycle

Input:

```yaml
harness_machine:
  status: CLOSING
  macro_cycle: DONE_VERIFIED
  cycle_substate: validation.stop_gate
```

Expected outcome: `BLOCK`

Expected checks:

- `DONE_VERIFIED` is rejected as a `macro_cycle`.
- Final states are modeled in the closing/final-state region only.
- The validator recommends retaining the last stable macro-cycle and committing
  final state through the final-state gate.

## Guard Fixtures

### VF-GUARD-001 - Bypass With H risk Is Illegal

Input:

```yaml
request:
  transition_id: build_to_validation
  risk_class: H
  supervision_mode: bypass
  macro_cycle: BUILD
  cycle_substate: build.implementation_patch
```

Expected outcome: `BLOCK`

Expected checks:

- Risk overlay forbids bypass for H.
- The decision is a `human_guard` or `risk_guard` block.
- Required action is to switch to pairing or record an explicit approved human
  checkpoint if policy allows the next step.

### VF-GUARD-002 - UNCLASSIFIED Risk Cannot Use Bypass

Input:

```yaml
request:
  transition_id: candidate_to_armed
  risk_class: UNCLASSIFIED
  supervision_mode: bypass
```

Expected outcome: `BLOCK`

Expected checks:

- Risk classification must happen before bypass can be evaluated.
- The guard result is deterministic: `block`, not `warn`.

### VF-GUARD-003 - Territory Guard Requires Path, Tool And Action

Input:

```yaml
request:
  transition_id: build_edit_apply
  macro_cycle: BUILD
  cycle_substate: build.implementation_patch
  tool: apply_patch
  target_path: UNKNOWN
  action_type: write
```

Expected outcome: `BLOCK`

Expected checks:

- Territory overlay cannot evaluate without `target_path`.
- No write or state transition is committed.
- The guard decision names the missing territory dimension.

### VF-GUARD-004 - Guard Merge Produces Strongest Blocking Decision

Input:

```yaml
overlays:
  base_guard: allow
  risk_overlay: warn
  supervision_overlay: allow
  runtime_overlay: block
  territory_overlay: allow
  evidence_overlay: warn
  convergence_overlay: allow
```

Expected outcome: `BLOCK`

Expected checks:

- Merged guard decision is `block`.
- The returned decision retains contributing warnings for evidence.
- Runtime block cannot be weakened by base or supervision allow.

### VF-GUARD-005 - M Risk Missing Required Pre-Tool Gate

Input:

```yaml
request:
  risk_class: M
  required_gate: pre_tool_write_guard
  binding_status: missing
  fallback_strategy: NOT_APPLICABLE
  can_block: false
```

Expected outcome: `BLOCK`

Expected checks:

- Runtime overlay returns `BLOCKED_RUNTIME_MISSING`.
- The route may be rerouted before action, but cannot silently degrade.
- Required evidence includes a runtime binding check event.

## Convergence Fixtures

### VF-CONV-001 - Repeated Validation Loop Without New Evidence

Input:

```yaml
convergence:
  score: 0.48
  last_progress_event: evt_validation_failed_03
  stalled_samples: 3
  divergence_signals:
    - oscillation_of_route
events:
  recent_pattern:
    - BUILD_PATCH
    - VALIDATION_FAIL
    - BUILD_PATCH
    - VALIDATION_FAIL
iteration:
  hypothesis: same_patch_strategy
  new_expected_signal: NOT_APPLICABLE
```

Expected outcome: `BLOCK`

Expected checks:

- The convergence guard emits `LOOP_DETECTED` or `reroute`.
- Max attempts is not the only reason.
- A new iteration requires a distinct hypothesis and measurable signal.

### VF-CONV-002 - Rework Improves Evidence And Reduces Defects

Input:

```yaml
before:
  defect_count: 5
  evidence_status: stale
  convergence_score: 0.52
after:
  defect_count: 2
  evidence_status: fresh_partial
  convergence_score: 0.67
events:
  progress_event: evt_regression_tests_passed
```

Expected outcome: `PASS`

Expected checks:

- `stalled_samples` resets or remains unchanged.
- `last_progress_event` references `evt_regression_tests_passed`.
- The run may continue while final-state evidence remains incomplete.

### VF-CONV-003 - Rework Increases Defects And Reopens Scope

Input:

```yaml
before:
  defect_count: 3
  open_scope_items: 1
after:
  defect_count: 6
  open_scope_items: 4
divergence_signals:
  - defects_increasing
  - scope_drift
```

Expected outcome: `BLOCK`

Expected checks:

- Convergence status becomes `diverging`.
- Final state cannot be chosen except an explicit blocked final state.
- The next action is reroute, split, checkpoint or stop blocked.

### VF-CONV-004 - Cycle 02 Fixture Gap Caps Readiness

Input:

```yaml
cycle_score:
  weighted_score: 0.82
fixture_delta:
  runtime_degradation_fixture: missing
  evidence_stop_gate_fixture: present
```

Expected outcome: `BLOCK`

Expected checks:

- Readiness is capped below implementation handoff because a claimed
  implementation boundary lacks fixtures.
- The cycle emits a next-cycle backlog or adds the missing fixture before
  claiming implementation readiness.

## Runtime Degradation Fixtures

### VF-RUNTIME-001 - L-Risk Optional Hook Missing With Post-Run Audit

Input:

```yaml
runtime: codex
risk_class: L
required_gate: subagent_stop_capture
binding_status: noop_traced
can_block: false
fallback_strategy: post_run_audit
```

Expected outcome: `PASS`

Expected checks:

- Guard decision is `warn` or `degrade`, not silent allow.
- Evidence records the missing primitive, fallback and residual gap.
- Final state may be at most `DONE_WITH_GAPS` unless required evidence is later
  collected by an acceptable path.

### VF-RUNTIME-002 - H risk Missing Blocking Hook

Input:

```yaml
runtime: codex
risk_class: H
required_gate: pre_tool_write_guard
binding_status: missing
fallback_strategy: post_run_audit
can_block: false
```

Expected outcome: `BLOCK`

Expected checks:

- Post-run audit is insufficient for H enforcement.
- Runtime overlay emits `BLOCKED_RUNTIME_MISSING`.
- No governed write transition is committed.

### VF-RUNTIME-003 - Capability Unknown Blocks Discovery-Dependent Route

Input:

```yaml
runtime_context:
  runtime: UNKNOWN
  capability_set_id: UNKNOWN
  binding_set_id: UNKNOWN
request:
  transition_id: candidate_to_armed
  risk_class: M
```

Expected outcome: `BLOCK`

Expected checks:

- Runtime discovery is required before route activation.
- The guard does not infer capability from runtime name or platform memory.

### VF-RUNTIME-004 - Declared Fallback For T Work Is Traceable

Input:

```yaml
risk_class: T
required_gate: stop_gate_hook
binding_status: fallback
fallback_strategy: explicit_final_check_command
can_block: false
evidence_refs:
  - evt_runtime_binding_checked
  - evt_degraded_route_accepted
```

Expected outcome: `PASS`

Expected checks:

- Degraded operation is allowed only because risk is T and fallback is declared.
- The degraded route emits `DEGRADED_ROUTE_ACCEPTED`.
- The closing gate still evaluates evidence and convergence before final state.

## Evidence Fixtures

### VF-EVID-001 - DONE_VERIFIED With Partial Evidence

Input:

```yaml
final_candidate: DONE_VERIFIED
derived_view:
  evidence_status: partial
  convergence_status: verified
evidence_set:
  missing:
    - regression_tests
```

Expected outcome: `BLOCK`

Expected checks:

- Stop gate rejects `DONE_VERIFIED`.
- Required action names the missing evidence.
- The run may continue or propose `DONE_WITH_GAPS` only if risk policy allows.

### VF-EVID-002 - Stale Evidence After Route Change

Input:

```yaml
events:
  - event_id: evt_tests_passed
    event_type: EVIDENCE_RECORDED
    touched_route_version: route_v1
  - event_id: evt_route_changed
    event_type: ROUTE_PLANNED
    route_version: route_v2
evidence_set:
  regression_tests:
    freshness_against: route_v1
```

Expected outcome: `BLOCK`

Expected checks:

- Evidence evaluator marks regression tests stale.
- `DONE_VERIFIED` is blocked until evidence is refreshed against `route_v2`.

### VF-EVID-003 - Conflicting Review Evidence

Input:

```yaml
evidence_set:
  items:
    - id: ev_risk_policy_approved
      type: review-verdict
      verdict: approve
      source: risk-policy-reviewer
    - id: ev_security_blocked
      type: review-verdict
      verdict: block
      source: security-safety-reviewer
      reason: unresolved_secret_exposure
```

Expected outcome: `BLOCK`

Expected checks:

- Evidence status becomes `conflicted`.
- Parent/kernel arbitration is required.
- H/C requires human or independent review resolution before final state.

### VF-EVID-004 - Fresh Independent Evidence Satisfies M Stop Gate

Input:

```yaml
risk_class: M
final_candidate: DONE_VERIFIED
derived_view:
  evidence_status: verified
  convergence_status: verified
evidence_set:
  latest_scope_event: evt_patch_complete
  items:
    - type: tests
      freshness_against: evt_patch_complete
      result: pass
    - type: review-verdict
      freshness_against: evt_patch_complete
      result: approve
      source: evidence-auditor
    - type: runtime-binding-check
      result: native_or_allowed_fallback
```

Expected outcome: `PASS`

Expected checks:

- Evidence is fresh against the latest state-changing event.
- Evidence is independent enough for M policy.
- Final-state gate may proceed to runtime and convergence checks.

## Subagent Fixtures

### VF-SUBAGENT-001 - Subagent Recommendation Without Evidence Packet

Input:

```yaml
subagent_result:
  subagent: evidence-auditor
  verdict: approve
  evidence_packet: MISSING
  checked_refs: []
```

Expected outcome: `BLOCK`

Expected checks:

- Result intake rejects the output as evidence.
- The parent may request retry, but cannot count the verdict toward completion.

### VF-SUBAGENT-002 - Subagent Attempts Direct RMS Write

Input:

```yaml
actor: subagent
operation: write_file
target_path: .rms/runs/run_001/events.jsonl
payload:
  event_type: STATE_TRANSITION_COMMITTED
```

Expected outcome: `BLOCK`

Expected checks:

- Subagents are read-only against `.rms/`.
- Only parent/kernel intake may append accepted evidence or transition events.
- The attempted write is recorded as a policy violation if observable.

### VF-SUBAGENT-003 - Bounded Subagent Evidence Is Accepted

Input:

```yaml
subagent_result:
  subagent: state-invariant-reviewer
  scope:
    state_ref: state_v12
    registry_ref: registry_v4
  verdict: block
  evidence_packet:
    findings:
      - id: inv_no_null
        severity: block
        path: harness_machine.cycle_substate
        reason: null_not_allowed
    checked_refs:
      - state_v12
      - registry_v4
```

Expected outcome: `PASS`

Expected checks:

- The subagent output can be normalized into an Evidence Set item.
- The blocking verdict blocks the related transition or final state.
- Acceptance of the evidence packet does not mean accepting a final state.

## Skill And Reference doc Drift Fixtures

### VF-DRIFT-001 - Core Skill Hash Drift Blocks Auto Invocation

Input:

```yaml
skill:
  name: pfv4-stop-gate
  installed_hash: hash_installed_old
  registry_hash: hash_registry_current
  core: true
request:
  operation: auto_invoke
```

Expected outcome: `BLOCK`

Expected checks:

- Auto invocation of drifted core skill is blocked.
- Required action is sync, reconcile or explicit degraded-route decision if
  policy allows.
- The drift event is recorded.

### VF-DRIFT-002 - Skill Tries To Commit Final State Directly

Input:

```yaml
actor: skill
skill: pfv4-stop-gate
operation: direct_state_write
target_field: final_state
value: DONE_VERIFIED
```

Expected outcome: `BLOCK`

Expected checks:

- Skills may request `propose_final_state`; they may not write final state.
- Kernel rejects direct mutation and requires guard/evidence/convergence checks.

### VF-DRIFT-003 - Reference doc Conflicts With Policy Registry

Input:

```yaml
reference_doc_claim:
  doc_ref: docs/risk-and-policy.md
  claim: H risk may use bypass after agent self-review
registry_rule:
  policy: risk_overlay
  rule: H risk forbids bypass without explicit human checkpoint
```

Expected outcome: `BLOCK`

Expected checks:

- Registry wins over reference doc prose.
- Implementation planning is blocked until the conflict is recorded for reference doc
  update or policy decision.
- Runtime execution does not weaken the guard while the reference doc is stale.

### VF-DRIFT-004 - Non-Authoritative Reference doc Typo Does Not Block L-Risk Run

Input:

```yaml
reference_doc_claim:
  doc_ref: docs/cycle-playbooks.md
  issue: display_alias_typo
registry_rule:
  affected_guard: none
run:
  risk_class: L
```

Expected outcome: `PASS`

Expected checks:

- The typo is recorded as learning or documentation debt.
- No executable guard, state field or evidence requirement changes.
- The L-risk run continues if all runtime guards pass.

## MCP Outage Fixtures

### VF-MCP-001 - MCP Outage During Governed Mutation

Input:

```yaml
mcp_health: unavailable
request:
  tool: rms.transition
  transition_id: build_to_validation
  risk_class: M
local_transaction_fallback: NOT_DECLARED
```

Expected outcome: `BLOCK`

Expected checks:

- Governed state mutation is blocked.
- `MCP_UNAVAILABLE` or equivalent runtime event is recorded if file append is
  still available.
- The runtime cannot claim `DONE_VERIFIED`.

### VF-MCP-002 - MCP Outage Allows Read-Only Inspection

Input:

```yaml
mcp_health: unavailable
operation:
  class: read_only_inspection
  source: .rms/runs/run_001/snapshot
  risk_class: L
```

Expected outcome: `PASS`

Expected checks:

- File-only degraded read is allowed.
- The result is marked degraded and non-authoritative for mutation.
- Any subsequent transition still requires MCP recovery or declared local
  transaction fallback.

### VF-MCP-003 - Declared Local Transaction Fallback For T Transition

Input:

```yaml
mcp_health: unavailable
risk_class: T
request:
  transition_id: validation_to_closing
local_transaction_fallback:
  declared: true
  append_only_lock: acquired
  registry_version: registry_v4
```

Expected outcome: `PASS`

Expected checks:

- The fallback may append a guarded transition event only because it is declared,
  locked and L-risk.
- The degradation remains visible in EventLog and EvidenceSet.
- Sync back to MCP is required before stronger claims or M+ work.

### VF-MCP-004 - Partial MCP State Blocks Guard Evaluation

Input:

```yaml
mcp_response:
  state: present
  evidence_set: MISSING
  convergence_set: present
request:
  tool: rms.close_run
  final_candidate: DONE_VERIFIED
```

Expected outcome: `BLOCK`

Expected checks:

- Closing cannot proceed without a consistent read of evidence.
- The block reason names partial MCP state, not evidence failure by inference.

## Final State Fixtures

### VF-FINAL-001 - DONE_VERIFIED Requires Verified Evidence And Convergence

Input:

```yaml
final_candidate: DONE_VERIFIED
harness_machine:
  status: CLOSING
  risk_class: M
derived_view:
  evidence_status: verified
  convergence_status: verified
runtime_context:
  runtime: codex
  required_bindings: native_or_policy_allowed
events:
  append_available: true
```

Expected outcome: `PASS`

Expected checks:

- Final-state guard can commit `DONE_VERIFIED`.
- `FINAL_STATE_CANDIDATE`, `RUN_CLOSING` and `RUN_CLOSED` or equivalent events
  are appended.
- Final state is committed outside `macro_cycle`.

### VF-FINAL-002 - DONE_WITH_GAPS With H/C Gap

Input:

```yaml
final_candidate: DONE_WITH_GAPS
risk_class: H
evidence_set:
  unresolved_gaps:
    - missing_rollback_proof
```

Expected outcome: `BLOCK`

Expected checks:

- H/C gaps cannot be hidden by `DONE_WITH_GAPS`.
- Human checkpoint may accept residual non-critical gaps only if policy permits;
  it cannot erase required safety evidence.

### VF-FINAL-003 - Late Evidence After Closure Cannot Rewrite Final State

Input:

```yaml
run:
  pipeline_activation: closed
  final_state: DONE_VERIFIED
late_evidence:
  type: ci-result
  result: fail
  arrived_after_event: evt_run_closed
request:
  operation: mutate_final_state
  value: DONE_WITH_GAPS
```

Expected outcome: `BLOCK`

Expected checks:

- Closed runs are immutable except append-only audit/correction records.
- Late evidence opens an audit/reopen/correction path, not silent final-state
  mutation.

### VF-FINAL-004 - Event Append Failure Blocks Final Commit

Input:

```yaml
final_candidate: DONE_VERIFIED
derived_view:
  evidence_status: verified
  convergence_status: verified
event_log:
  append_available: false
```

Expected outcome: `BLOCK`

Expected checks:

- Mutation fails because event append is required for final state.
- Snapshot cannot advance ahead of EventLog.

### VF-FINAL-005 - Blocked Runtime Missing Is A Valid Final Stop

Input:

```yaml
final_candidate: BLOCKED_RUNTIME_MISSING
risk_class: M
runtime_context:
  required_gate: pre_tool_write_guard
  binding_status: missing
  fallback_strategy: NOT_APPLICABLE
derived_view:
  evidence_status: partial
  convergence_status: blocked
```

Expected outcome: `PASS`

Expected checks:

- The run may stop as explicitly blocked.
- The final report must name missing runtime primitive, affected risk class,
  rejected fallback and next required recovery.
- It must not be reported as `DONE_VERIFIED` or `DONE_WITH_GAPS`.

## Minimum Implementation Readiness Gate

Implementation planning for the RMS/MCP kernel is `BLOCK` until tests or
registry fixtures exist for at least these cases:

| Required class | Fixture IDs |
|---|---|
| Schema and no-null | `VF-SCHEMA-001`, `VF-SCHEMA-002`, `VF-SCHEMA-003`, `VF-SCHEMA-004` |
| Guard merge and bypass legality | `VF-GUARD-001`, `VF-GUARD-002`, `VF-GUARD-004` |
| Convergence and loop control | `VF-CONV-001`, `VF-CONV-002`, `VF-CONV-003` |
| Runtime degradation | `VF-RUNTIME-001`, `VF-RUNTIME-002`, `VF-RUNTIME-003` |
| Evidence stop gates | `VF-EVID-001`, `VF-EVID-002`, `VF-EVID-003`, `VF-EVID-004` |
| Subagent boundaries | `VF-SUBAGENT-001`, `VF-SUBAGENT-002`, `VF-SUBAGENT-003` |
| Skill/hook drift | `VF-DRIFT-001`, `VF-DRIFT-002`, `VF-DRIFT-003` |
| MCP outage | `VF-MCP-001`, `VF-MCP-002`, `VF-MCP-004` |
| Final state | `VF-FINAL-001`, `VF-FINAL-002`, `VF-FINAL-003`, `VF-FINAL-004` |

The design is `PASS` for Cycle 02 verification only when these fixture classes
are present, each `BLOCK` expectation is fail-closed, and each `PASS`
expectation still preserves append-only events, derived views and RMS kernel
authority.
