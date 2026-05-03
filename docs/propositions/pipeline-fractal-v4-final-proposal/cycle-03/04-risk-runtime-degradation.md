# 04 - Risk Runtime Degradation

Status: Cycle 03 executable contract proposal

## Purpose

This document mechanizes the remaining risk and runtime degradation decisions
from Cycle 02. It defines how T/F/M/E/C risk is classified, how bypass and
supervision modes are selected, how Runtime Binding Set entries authorize or
block fallback behavior, and which fixtures must exist before implementation
handoff.

The contract is intentionally stricter than runtime convenience. A runtime name
never proves enforceability. The kernel must decide from inspected Capability
Sets, frozen Binding Sets, Policy Set rules, and fresh evidence.

## Sources

- `cycle-02/03-mcp-tool-contracts.md`
- `cycle-02/04-registry-storage-layout.md`
- `cycle-02/05-verification-fixtures.md`
- `cycle-02/06-audit-red-team.md`
- `cycle-02/07-cycle-02-integration.md`

## Contract Decision

Cycle 03 closes PFV4 risk/runtime degradation for schema-first planning with
these defaults:

```text
risk classifier = forcing-signal maximum
runtime authority = Binding Set entry, not runtime name
fallback legality = risk policy + supervision policy + binding metadata
M/E/C enforcement = fail closed unless fallback is native-equivalent
final states = blocked when required runtime proof is missing
```

## Canonical Risk Classes

| Class | Name | Summary | Default evidence depth | Default supervision |
|---|---|---|---|---|
| `T` | trivial | Local, reversible, non-authoritative, no external effect. | minimal | `auto_decision` |
| `F` | faible | Low blast radius or docs/config planning work with reviewable output. | light | `auto_decision` |
| `M` | moyen | User-visible behavior, shared code, durable state, or governed writes. | standard | `pairing` or supervised `auto_decision` |
| `E` | eleve | Security, privacy, data loss, production, irreversible, or cross-boundary effects. | strong | `pairing` |
| `C` | critique | Critical safety, compliance, secrets, destructive production, legal, financial, or autonomous high-impact decisions. | maximal | `pairing` plus human checkpoint |

`UNCLASSIFIED` is not a usable risk class for execution. It may exist only
before classification and blocks bypass, route activation, governed writes, and
final verified closure.

## Mechanized Risk Classifier

The classifier computes the maximum minimum class required by all known signals.
It never averages risk down.

Inputs:

```yaml
risk_classifier_input:
  intent_summary: "short text"
  scope_refs: []
  target_paths: []
  operation_types: []
  runtime_facts_ref: "capability_set_id or UNKNOWN"
  binding_set_ref: "binding_set_id or UNKNOWN"
  current_risk_class: "UNCLASSIFIED"
  requested_supervision_mode: "auto_decision"
  forcing_signals: []
  downgrade_request: "UNSET"
```

Algorithm:

1. Start from `UNCLASSIFIED`.
2. Add forcing signals from intent, paths, tools, runtime, policy, evidence,
   human checkpoint, and previous events.
3. Map each signal to a minimum class.
4. Select the highest class in this order:
   `UNCLASSIFIED < T < F < M < E < C`.
5. Apply promotion if the selected class is higher than the current class.
6. Reject downgrade unless a registered downgrade rule, fresh evidence, and
   non-stale route context allow it.
7. Derive legal supervision modes from the selected class.
8. Emit `RISK_CLASSIFIED`, `RISK_CLASS_PROMOTED`, or
   `RISK_CLASSIFICATION_BLOCKED`.

Classifier output:

```yaml
risk_classifier_output:
  risk_class: "M"
  supervision_mode: "pairing"
  forcing_signals_applied: []
  promotion:
    occurred: true
    from: "F"
    to: "M"
  downgrade:
    occurred: false
    reason: "NOT_APPLICABLE"
  bypass_allowed: false
  human_checkpoint_required: false
  evidence_depth: "standard"
  event_type: "RISK_CLASS_PROMOTED"
```

## Forcing Signal Registry

These are minimum required signals for MVP. Implementations may add stricter
signals but may not weaken these minima.

| Signal | Minimum class | Rationale |
|---|---|---|
| `docs_only_local` | `T` | Local explanatory work only. |
| `architecture_contract` | `F` | Durable design contract can affect implementation. |
| `registry_or_policy_edit` | `M` | Changes executable guard or policy semantics. |
| `rms_state_mutation` | `M` | Durable governed state changes require standard proof. |
| `source_code_behavior_change` | `M` | User-visible or testable behavior may regress. |
| `shared_module_or_api_change` | `M` | Wider blast radius than local implementation. |
| `generated_schema_or_type_change` | `M` | Downstream validation and compatibility impact. |
| `runtime_binding_change` | `M` | Can change enforcement behavior. |
| `degraded_runtime_route` | `M` | Runtime limitations alter guard confidence. |
| `missing_blocking_enforcement` | `M` | Cannot claim normal execution until resolved. |
| `production_or_deployment_action` | `E` | External service impact. |
| `secret_or_credential_access` | `E` | Sensitive data boundary. |
| `destructive_filesystem_or_db_action` | `E` | Irreversible or difficult recovery path. |
| `security_privacy_auth_change` | `E` | Safety/security boundary. |
| `external_money_legal_medical_effect` | `C` | High-impact real-world consequence. |
| `critical_infrastructure_or_safety` | `C` | Critical safety boundary. |
| `destructive_production_action` | `C` | Highest-risk irreversible external mutation. |
| `human_checkpoint_rejected` | `C` | Cannot continue autonomously past explicit rejection. |

Signal conflicts are resolved by promotion. For example, `docs_only_local` plus
`runtime_binding_change` is `M`, not `T`.

## Bypass And Supervision Matrix

| Risk | `bypass` | `auto_decision` | `pairing` | Human checkpoint | Notes |
|---|---|---|---|---|---|
| `UNCLASSIFIED` | block | block for execution | allowed for classification only | not required | Must classify before route activation. |
| `T` | allowed | allowed | allowed | not required | Bypass still records route and final evidence. |
| `F` | conditional | allowed | allowed | required only by policy warning | Conditional bypass requires fresh low-risk signals. |
| `M` | block | conditional supervised | allowed | required when degraded enforcement affects hard gates | Audit-only fallback is not enough for hard gates. |
| `E` | forbidden | block for governed mutation | required | required for residual risk, destructive action, or degraded hard gate | Missing blocking enforcement blocks by default. |
| `C` | forbidden | forbidden | required | required before critical action and final decision | Human checkpoint cannot approve missing mandatory proof. |

Bypass means the runtime may skip non-essential staged workflow assistance. It
never means skipping kernel guards, event append, evidence evaluation,
territory checks, or final-state checks.

## Promotion And Downgrade Rules

### Promotion

Promotion is automatic when a forcing signal requires a higher class than the
current class.

Required promotion events:

| Trigger | Event |
|---|---|
| New signal raises class | `RISK_CLASS_PROMOTED` |
| Runtime binding degrades a hard gate | `RISK_CLASS_PROMOTED` or `RUNTIME_BINDING_CHECKED` with promotion ref |
| Evidence conflict exposes E/C signal | `RISK_CLASS_PROMOTED` |
| Human checkpoint rejects action | `RISK_CLASS_PROMOTED` to `C` |

Promotion invalidates dependent evidence that was collected under weaker risk
requirements.

### Downgrade

Downgrade is exceptional and must be explicit.

Required downgrade fields:

```yaml
downgrade_request:
  from: "M"
  to: "F"
  rule_id: "risk.downgrade.scope_reduced"
  reason: "scope reduced to docs-only local file"
  evidence_refs:
    - "ev_scope_diff_001"
  invalidated_requirements:
    - "standard_review"
  accepted_residual_risk: "none"
```

Downgrade is blocked when:

- any current forcing signal still requires the higher class;
- evidence is stale, missing, or conflicted;
- the route is degraded because a required hard gate is unavailable;
- current class is `E` or `C` and the downgrade lacks human checkpoint approval;
- downgrade would make a previously forbidden bypass legal without a fresh
  route plan.

Downgrade emits `RISK_CLASS_DOWNGRADED` only if the event registry adds that
event. Until then, it emits `RISK_CLASSIFIED` with `downgrade.occurred=true`.

## Runtime Binding Set Contract

Every required gate in a Route Set must have one Binding Set entry. Missing
entries are not interpreted as absent optional features; they are
`binding_status=missing` for that required gate.

### Required Fields

```yaml
binding:
  binding_id: "binding.codex.pre_tool_write_guard"
  schema_version: "1.0"
  runtime: "codex"
  required_gate: "pre_tool_write_guard"
  gate_class: "enforcement"
  binding_status: "native"
  capability_status: "available"
  can_block: true
  native_primitive: "PreToolUse"
  fallback_strategy: "NOT_APPLICABLE"
  fallback_class: "NOT_APPLICABLE"
  fallback_can_block: false
  fail_open_risk: false
  risk_allowed:
    T: true
    F: true
    M: true
    E: true
    C: true
  supervision_allowed:
    bypass: false
    auto_decision: true
    pairing: true
  evidence_required:
    - "runtime-binding-check"
  trace_event: "RUNTIME_BINDING_CHECKED"
  last_inspected_event_id: "evt_capability_001"
  freshness_basis:
    invalidated_by:
      - "runtime_config_change"
      - "registry_digest_change"
      - "hook_install_change"
  notes: "UNSET"
```

### Field Semantics

| Field | Semantics |
|---|---|
| `gate_class` | `enforcement`, `observation`, `checkpoint`, `evidence`, `advisory`, or `transport`. |
| `binding_status` | `native`, `fallback`, `noop_traced`, `missing`, or `capability_unknown`. |
| `capability_status` | `available`, `missing`, `UNKNOWN`, `stale`, or `failed_probe`. |
| `can_block` | True only when the native primitive can synchronously prevent the governed action. |
| `fallback_strategy` | Named fallback, or `NOT_APPLICABLE`; never free prose. |
| `fallback_class` | `native_equivalent`, `pre_action_check`, `post_action_audit`, `manual_checkpoint`, `read_only`, or `NOT_APPLICABLE`. |
| `fallback_can_block` | True only when fallback can prevent the governed action before it occurs. |
| `fail_open_risk` | True when failure, timeout, missing hook, or transport outage can allow the action without guard enforcement. |
| `risk_allowed` | Per-risk allow map after considering native or fallback status. |
| `supervision_allowed` | Per-supervision allow map. |
| `evidence_required` | Proof required whenever this binding is used. |
| `last_inspected_event_id` | Capability inspection event proving freshness. |

No field may be `null`. Unknown values use `UNKNOWN`; inapplicable values use
`NOT_APPLICABLE`; not-yet-bound refs use `UNSET`.

## Binding Status Semantics

| Status | Meaning | Can satisfy enforcement? | M/E/C default |
|---|---|---|---|
| `native` | Runtime primitive directly implements the required gate. | Yes if `can_block=true`. | Allowed if fresh. |
| `fallback` | Declared alternate strategy exists. | Only if `fallback_can_block=true` or policy allows the gap. | Block unless `fallback_class=native_equivalent` or explicit policy allows. |
| `noop_traced` | No enforcement; the system records that no action was taken. | No. | Block for enforcement and checkpoint gates. |
| `missing` | Required primitive has no binding. | No. | Block. |
| `capability_unknown` | Capability has not been inspected or is stale. | No. | Block until discovery. |

### `can_block`

`can_block=true` means the binding can synchronously stop the requested action
before side effects occur. Post-run checks, audit logs, final summaries,
lint-only reports, or human review after mutation are not blocking primitives.

Rules:

- `gate_class=enforcement` with `can_block=false` is degraded unless the gate is
  optional for the current risk.
- `M/E/C` hard enforcement requires `can_block=true` or a
  `native_equivalent` fallback with `fallback_can_block=true`.
- A runtime hook that can warn but cannot prevent execution is
  `can_block=false`.

### `fallback`

Fallback is valid only when all are true:

1. Binding Set names the fallback strategy.
2. Policy Set allows the fallback for the current risk and supervision mode.
3. Evidence Set records `RUNTIME_BINDING_CHECKED`.
4. Route Set records degraded operation requirements.
5. Guard decision returns `warn`, `degrade`, `reroute`, or `block`; never silent
   `allow`.

Fallback classes:

| Fallback class | Meaning | T/F | M | E/C |
|---|---|---|---|---|
| `native_equivalent` | Prevents action before side effect with equivalent authority. | allow | allow | allow with checkpoint if policy requires |
| `pre_action_check` | Manual or scripted check before action but not runtime-enforced. | warn/degrade | conditional with pairing | block by default |
| `post_action_audit` | Detects after action. | warn/degrade | block for hard gates by default | block |
| `manual_checkpoint` | Human decision gates action outside runtime. | allow if scoped | conditional | required but not sufficient for missing mandatory technical proof |
| `read_only` | Explains or inspects only. | allow for read-only route | block for mutation | block |

### `noop_traced`

`noop_traced` means the runtime cannot perform the required primitive but can
record that fact. It is valid only for observability or advisory gates where
the Policy Set says the gate is optional at the current risk.

`noop_traced` is invalid for:

- `pre_tool_write_guard`;
- `stop_gate` for `DONE_VERIFIED`;
- `human_checkpoint` when required;
- evidence collection required for `M/E/C`;
- territory guard for governed write in `M/E/C`.

### `missing`

`missing` means no native primitive and no declared fallback exist. It blocks
route activation for required gates. If discovered mid-run, the run must
reroute, suspend, or close as a blocked final state.

### `capability_unknown`

`capability_unknown` means the runtime has not been probed or the probe is
stale. It is stricter than `missing` because the system does not yet know what
is safe. Required `UNKNOWN` capability blocks until `rms.inspect_runtime`
refreshes the Capability Set.

## Fail-Closed Rules For M/E/C

The following are hard fail-closed rules:

| Condition | Required result |
|---|---|
| `risk_class=M/E/C` and required enforcement binding is `missing` | `BLOCKED_RUNTIME_MISSING`. |
| `risk_class=M/E/C` and required enforcement binding is `capability_unknown` | `CAPABILITY_UNKNOWN`; inspect runtime before route. |
| `risk_class=M/E/C` and hard gate is `noop_traced` | Block; no degraded route. |
| `risk_class=M/E/C` and fallback is `post_action_audit` | Block for enforcement gates unless explicit policy says exhaustive audit compensates for M only. |
| `risk_class=E/C` and fallback is not `native_equivalent` | Block by default. |
| `risk_class=C` and supervision is `auto_decision` or `bypass` | Block; require pairing plus human checkpoint. |
| Required runtime binding evidence is stale after registry/runtime change | Block until refreshed. |
| MCP unavailable and no declared local transaction fallback | Block governed mutation and `DONE_VERIFIED`. |
| Event append fails while recording degradation or block | No mutation; final state cannot advance. |

For `M`, a non-native fallback can be policy-allowed only when the fallback is
declared, pre-action, evidence-rich, supervised, and has explicit residual-risk
acceptance. For `E/C`, non-native fallback does not satisfy mandatory
enforcement by default.

## Guard Overlay Effects

Runtime degradation participates in guard merge as a runtime overlay. It may
strengthen decisions but cannot weaken risk, evidence, territory, convergence,
or closing blocks.

Decision mapping:

| Binding result | Low-risk decision | M decision | E/C decision |
|---|---|---|---|
| Fresh `native`, `can_block=true` | `allow` | `allow` | `allow` unless checkpoint missing |
| Fresh declared `native_equivalent` fallback | `degrade` with evidence | `degrade` or `allow` by policy | `escalate` or `block` unless checkpoint allows |
| Declared `pre_action_check` fallback | `warn` or `degrade` | `escalate` or `block` | `block` |
| `post_action_audit` fallback | `warn` or `degrade` | `block` for hard gate | `block` |
| `noop_traced` | `warn` only if optional | `block` for hard gate | `block` |
| `missing` | `reroute` or `block` | `block` | `block` |
| `capability_unknown` | `block` if required | `block` | `block` |

Every `warn` or `degrade` decision must include residual risk, required
evidence, and final-state ceiling.

## Final State Effects

Runtime degradation may cap final states.

| Runtime condition | Allowed final state ceiling |
|---|---|
| Required bindings native and fresh; evidence/convergence verified | `DONE_VERIFIED` |
| T/F degraded route with accepted gap and verified final checks | `DONE_WITH_GAPS` unless policy says the fallback evidence fully satisfies the requirement |
| M native-equivalent fallback with fresh proof and no residual gaps | `DONE_VERIFIED` if policy allows |
| M non-native fallback accepted with residual gap | `DONE_WITH_GAPS` at most |
| E/C residual runtime gap | blocked final state only |
| Required binding missing or unknown | `BLOCKED_RUNTIME_MISSING` or `BLOCKED_POLICY` |
| MCP unavailable during required final evaluation | `BLOCKED_RUNTIME_MISSING` or remain open/suspended |
| Event append unavailable | no final mutation; report blocked outside RMS if necessary |

`DONE_VERIFIED` is forbidden when required runtime binding proof is missing,
stale, conflicted, `noop_traced`, or audit-only for an M/E/C hard gate.

## Blocked Final States

Blocked final states are valid stops, not success states. They must preserve
the reason and next recovery action.

| Final state | Use when | Required fields |
|---|---|---|
| `BLOCKED_RUNTIME_MISSING` | Required runtime primitive is missing, unknown, stale, or non-blocking with no allowed fallback. | missing gate, risk class, binding status, rejected fallback, recovery action. |
| `BLOCKED_POLICY` | Policy forbids bypass, fallback, supervision mode, downgrade, or final candidate. | policy id, attempted action, risk class, required mode. |
| `BLOCKED_NEEDS_USER` | Human checkpoint is required but absent, expired, vague, rejected, or scoped to another action. | checkpoint requirement, action scope, expiry rule. |
| `MAX_ATTEMPTS_REACHED` | Attempt fuse trips after evidence shows no safe progress. | attempt window, last distinct hypothesis, required reroute. |
| `LOOP_DETECTED` | Convergence detects repeated state pattern without new information. | repeated pattern, divergence signal, reroute requirement. |
| `ABORTED` | Runtime or policy failure makes continuation unsafe and explicit abort is chosen. | abort reason, actor, audit refs. |
| `CANCELLED` | User/operator cancels. | cancellation actor and timestamp. |

Blocked final records must include:

```yaml
blocked_final_record:
  final_state: "BLOCKED_RUNTIME_MISSING"
  risk_class: "M"
  supervision_mode: "auto_decision"
  affected_gate: "pre_tool_write_guard"
  binding_status: "fallback"
  can_block: false
  fallback_strategy: "post_action_audit"
  rejected_reason: "M hard enforcement cannot use audit-only fallback"
  evidence_refs:
    - "evt_runtime_binding_checked"
  recovery_action: "install blocking hook, choose native-equivalent fallback, reroute, or reduce scope with approved downgrade"
```

## Policy Registry Shape

`policies/risk-policy.yaml` must contain at least:

```yaml
schema_version: "1.0"
risk_order:
  - "UNCLASSIFIED"
  - "T"
  - "F"
  - "M"
  - "E"
  - "C"
forcing_signals:
  architecture_contract:
    minimum_class: "F"
  runtime_binding_change:
    minimum_class: "M"
  destructive_production_action:
    minimum_class: "C"
supervision_matrix:
  M:
    bypass: "block"
    auto_decision: "conditional"
    pairing: "allow"
runtime_degradation:
  M:
    enforcement:
      native: "allow"
      fallback_native_equivalent: "allow"
      fallback_pre_action_check: "conditional"
      fallback_post_action_audit: "block"
      noop_traced: "block"
      missing: "block"
      capability_unknown: "block"
final_state_ceiling:
  residual_runtime_gap:
    T: "DONE_WITH_GAPS"
    F: "DONE_WITH_GAPS"
    M: "DONE_WITH_GAPS"
    E: "BLOCKED_POLICY"
    C: "BLOCKED_POLICY"
```

`registry/schemas/binding-set.schema.json` must require every Binding Set field
listed in this document and set `additionalProperties=false`.

## Fixtures

These fixtures extend Cycle 02 runtime and guard fixtures. They are intended to
become schema/guard tests.

### VF-RISKRT-001 - Forcing Signal Promotes Docs Work To M

Input:

```yaml
current_risk_class: "F"
signals:
  - signal: "architecture_contract"
    minimum_class: "F"
  - signal: "runtime_binding_change"
    minimum_class: "M"
requested_supervision_mode: "auto_decision"
```

Expected outcome: `PASS`

Expected checks:

- Risk becomes `M`.
- `RISK_CLASS_PROMOTED` is emitted.
- Previously collected F-only evidence is stale for M final closure.
- Bypass is blocked.

### VF-RISKRT-002 - UNCLASSIFIED Bypass Blocks

Input:

```yaml
risk_class: "UNCLASSIFIED"
supervision_mode: "bypass"
request: "candidate_to_armed"
```

Expected outcome: `BLOCK`

Expected checks:

- Classifier must run before route activation.
- Guard returns `BLOCKED_POLICY` or risk guard block.
- No transition is committed.

### VF-RISKRT-003 - M Audit-Only Fallback Blocks Hard Gate

Input:

```yaml
risk_class: "M"
required_gate: "pre_tool_write_guard"
binding_status: "fallback"
can_block: false
fallback_strategy: "post_action_audit"
fallback_class: "post_action_audit"
fallback_can_block: false
```

Expected outcome: `BLOCK`

Expected checks:

- Runtime overlay returns `DEGRADED_ROUTE_FORBIDDEN`.
- Route cannot execute the write.
- Valid final stop is `BLOCKED_RUNTIME_MISSING`, not `DONE_WITH_GAPS`, unless
  the write is never attempted and route is changed.

### VF-RISKRT-004 - M Native-Equivalent Fallback Can Continue

Input:

```yaml
risk_class: "M"
required_gate: "pre_tool_write_guard"
binding_status: "fallback"
can_block: false
fallback_strategy: "local_transaction_preflight"
fallback_class: "native_equivalent"
fallback_can_block: true
evidence_refs:
  - "evt_runtime_binding_checked"
  - "evt_degraded_route_accepted"
```

Expected outcome: `PASS`

Expected checks:

- Guard decision is `degrade` or policy `allow`, never silent untraced allow.
- Evidence requirements include runtime binding proof.
- `DONE_VERIFIED` remains possible only if evidence and convergence become
  verified and no residual runtime gap remains.

### VF-RISKRT-005 - E Non-Native Fallback Blocks

Input:

```yaml
risk_class: "E"
required_gate: "pre_tool_write_guard"
binding_status: "fallback"
fallback_class: "pre_action_check"
fallback_can_block: false
human_checkpoint: "approved"
```

Expected outcome: `BLOCK`

Expected checks:

- Human approval cannot convert a non-blocking fallback into mandatory
  technical enforcement.
- Final state cannot be `DONE_VERIFIED`.
- Required recovery names a native or native-equivalent enforcement path.

### VF-RISKRT-006 - C Auto Decision Blocks Even With Native Binding

Input:

```yaml
risk_class: "C"
supervision_mode: "auto_decision"
required_gate: "pre_tool_write_guard"
binding_status: "native"
can_block: true
human_checkpoint: "MISSING"
```

Expected outcome: `BLOCK`

Expected checks:

- C forbids autonomous final or governed critical action.
- Required action is pairing plus scoped human checkpoint.
- No bypass downgrade is suggested.

### VF-RISKRT-007 - Capability Unknown Blocks Required Gate

Input:

```yaml
risk_class: "M"
required_gate: "stop_gate"
binding_status: "capability_unknown"
capability_status: "UNKNOWN"
last_inspected_event_id: "UNSET"
```

Expected outcome: `BLOCK`

Expected checks:

- Runtime name is not used as proof.
- Required action is `rms.inspect_runtime`.
- `DONE_VERIFIED` is unavailable.

### VF-RISKRT-008 - T Declared Post-Action Audit Degrades

Input:

```yaml
risk_class: "T"
required_gate: "subagent_stop_capture"
gate_class: "observation"
binding_status: "fallback"
fallback_strategy: "post_run_audit"
fallback_class: "post_action_audit"
fallback_can_block: false
```

Expected outcome: `PASS`

Expected checks:

- Guard decision is `warn` or `degrade`.
- `DEGRADED_ROUTE_ACCEPTED` evidence is required.
- Final state ceiling is `DONE_WITH_GAPS` unless policy says the gate is
  optional and all required final evidence is otherwise verified.

### VF-RISKRT-009 - Downgrade Blocked By Active Signal

Input:

```yaml
current_risk_class: "E"
downgrade_request:
  to: "M"
  reason: "operator says scope is smaller"
signals:
  - signal: "secret_or_credential_access"
    minimum_class: "E"
evidence_status: "partial"
```

Expected outcome: `BLOCK`

Expected checks:

- Active E forcing signal prevents downgrade.
- Partial evidence cannot justify downgrade.
- Existing E supervision and evidence requirements remain active.

### VF-RISKRT-010 - Missing Binding Entry Is Missing, Not Optional

Input:

```yaml
route_required_gates:
  - "pre_tool_write_guard"
binding_set:
  bindings: []
risk_class: "M"
```

Expected outcome: `BLOCK`

Expected checks:

- Kernel synthesizes or reports `binding_status=missing` for the required gate.
- Route activation blocks.
- Final blocked report names the missing Binding Set entry.

### VF-RISKRT-011 - Stale Runtime Probe Blocks Final Verification

Input:

```yaml
risk_class: "M"
final_candidate: "DONE_VERIFIED"
binding_status: "native"
can_block: true
last_inspected_event_id: "evt_probe_old"
events:
  - event_id: "evt_registry_changed"
    event_type: "REGISTRY_VALIDATED"
    invalidates: ["runtime_binding"]
```

Expected outcome: `BLOCK`

Expected checks:

- Runtime binding evidence is stale.
- Required action is re-probe or re-bind runtime.
- `DONE_VERIFIED` is blocked until fresh binding evidence exists.

### VF-RISKRT-012 - Blocked Runtime Missing Is Valid Stop

Input:

```yaml
final_candidate: "BLOCKED_RUNTIME_MISSING"
risk_class: "M"
affected_gate: "pre_tool_write_guard"
binding_status: "missing"
fallback_strategy: "NOT_APPLICABLE"
evidence_refs:
  - "evt_runtime_binding_checked"
```

Expected outcome: `PASS`

Expected checks:

- Run may close as blocked.
- Final report includes missing gate, rejected fallback, risk class, and
  recovery action.
- The stop is not reported as success.

## Readiness Gate

This lane is `closed_by_contract` for Cycle 03 when:

1. Risk policy schema includes risk order, forcing signals, supervision matrix,
   downgrade rules, runtime degradation matrix, and final-state ceilings.
2. Binding Set schema requires every field listed above.
3. Guard fixtures cover bypass, promotion, downgrade, missing, unknown,
   fallback, `noop_traced`, and stale binding evidence.
4. M/E/C hard enforcement uses fail-closed defaults.
5. Blocked final states preserve runtime degradation cause and recovery action.

If any of these objects remain prose-only, implementation handoff remains
blocked for this lane.
