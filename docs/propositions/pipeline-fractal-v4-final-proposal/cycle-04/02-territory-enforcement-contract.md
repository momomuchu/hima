# 02 - Territory Enforcement Contract

Status: Cycle 04 executable contract proposal

## Purpose

This document closes PFV4-OD-012 for implementation planning. It defines the
territory overlay registry, path/tool/action request schema, target
classification algorithm, ownership and allowed-scope rules, risk-specific
legality, runtime binding interplay, degraded fallback behavior, guard outputs
and fixture families.

The contract preserves the Cycle 03 authority order:

```text
registry territory rules
> route-declared owned scopes
> runtime binding facts
> guard decision output
> post-action audit evidence
```

Runtime hooks are enforcement mechanisms, not sources of permission. A runtime
may block or observe a requested action, but the registry and route decide
whether the action is legal.

## Sources

- `cycle-04/00-cycle-04-brief.md`
- `cycle-03/06-cycle-03-audit.md`
- `cycle-03/07-cycle-03-integration.md`
- `cycle-03/02-guard-merge-lattice.md`
- `cycle-03/04-risk-runtime-degradation.md`
- `cycle-02/04-registry-storage-layout.md`
- `cycle-02/05-verification-fixtures.md`

## Contract Decision

PFV4 uses layered territory enforcement:

```text
declarative territory registry = source of truth
runtime binding = pre-action enforceability fact
local transaction library = only allowed direct .rms mutation fallback
post-action audit = degraded evidence only when risk policy allows
```

PFV4-OD-012 is closed by this contract when these defaults are adopted:

1. Every governed action is normalized to a `TerritoryRequest`.
2. Every target is classified before guard merge.
3. Unknown target, ambiguous expansion or path outside allowed scope blocks by
   default.
4. `.rms/registry/**` changes are registry or policy edits and require
   registry-lock territory plus M-risk minima.
5. `.rms/runs/**` writes are kernel-owned and may occur only through MCP tools
   or the local transaction library.
6. Generated files are writable only through their declared generator or a
   registry-authorized regeneration flow.
7. Runtime audit-only fallback is never sufficient for M/E/C governed writes.

## Registry Placement

The authored registry file is:

```text
.rms/registry/guards/territory-overlays.yaml
```

The manifest entry remains the Cycle 02 path:

```yaml
files:
  guards:
    - "guards/territory-overlays.yaml"
generated:
  merged_guards: "guards/merged.guards.generated.json"
```

The territory registry is validated by `rms.validate_registry`. The generated
merged guard cache may include compiled territory matchers, but it is never the
authoring source. If the generated cache digest differs from the manifest or
source guard files, territory evaluation returns `block` with
`REGISTRY_VERSION_MISMATCH` or `REGISTRY_INVALID`.

## Territory Overlay Registry Schema

Minimum registry shape:

```yaml
schema_version: "1.0"
registry_id: "territory-overlays"
registry_version: "pfv4-registry-v1"
path_normalization:
  root_ref: "project_root"
  separator: "/"
  case_policy: "platform_normalized"
  reject_absolute_paths_outside_root: true
  reject_parent_escape: true
  reject_symlink_escape: true
target_classes:
  - class_id: "source"
  - class_id: "docs"
  - class_id: "registry"
  - class_id: "rms_runtime_state"
  - class_id: "generated"
  - class_id: "external"
  - class_id: "unknown"
tool_classes:
  - class_id: "filesystem_read"
  - class_id: "filesystem_write"
  - class_id: "apply_patch"
  - class_id: "shell_command"
  - class_id: "mcp_kernel_tool"
  - class_id: "runtime_hook"
  - class_id: "subagent"
  - class_id: "skill"
action_types:
  - "read"
  - "write"
  - "append"
  - "delete"
  - "move"
  - "execute"
  - "generate"
  - "validate"
  - "state_mutation"
  - "registry_mutation"
ownership_rules: []
legality_rules: []
fallback_rules: []
```

Registry validation rules:

- No field may be `null`; use `UNKNOWN`, `UNSET` or `NOT_APPLICABLE`.
- All ids are ASCII and stable.
- Glob-like path patterns must be anchored to `project_root`, `.rms/`, or an
  explicitly registered external root.
- Broader allow rules must not override narrower deny rules.
- Every generated target class must name a generator id and source refs.
- Every `.rms/` write rule must name an owning kernel tool or local transaction
  path.
- Registry and policy mutation rules must require `registry.lock`.

## Territory Request Schema

Every territory evaluation normalizes the attempted operation to:

```json
{
  "schema_version": "territory-request-v1",
  "run_id": "run_2026-05-03_001",
  "request_id": "req_territory_001",
  "actor": {
    "actor_type": "agent",
    "actor_id": "codex-main",
    "runtime": "codex",
    "authority": "executor"
  },
  "state": {
    "pipeline_activation": "active",
    "macro_cycle": "BUILD",
    "cycle_substate": "build.implementation_slice",
    "risk_class": "M",
    "supervision_mode": "pairing"
  },
  "route_ref": "route_2026-05-03_001",
  "route_owned_scope_ref": "owned_scope_build_001",
  "action": {
    "tool": "apply_patch",
    "tool_class": "apply_patch",
    "action_type": "write",
    "target_path": "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/02-territory-enforcement-contract.md",
    "target_expansion": [
      "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/02-territory-enforcement-contract.md"
    ],
    "declared_intent": "create_cycle_04_territory_contract"
  },
  "runtime_binding": {
    "required_gate": "pre_tool_territory_guard",
    "binding_set_id": "binding_codex_v1",
    "binding_status": "native",
    "can_block": true,
    "fallback_class": "NOT_APPLICABLE"
  },
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "persist_decision": true
}
```

Required dimensions:

| Dimension | Required | Block reason when invalid |
|---|---:|---|
| `macro_cycle` | Yes | `TERRITORY_DIMENSION_MISSING` |
| `cycle_substate` | Yes | `TERRITORY_DIMENSION_MISSING` |
| `risk_class` | Yes | `TERRITORY_DIMENSION_MISSING` or `UNCLASSIFIED_RISK` |
| `tool` and `tool_class` | Yes | `TOOL_UNKNOWN` |
| `action_type` | Yes | `ACTION_UNKNOWN` |
| `target_path` | Yes for path actions | `TARGET_UNKNOWN` |
| `target_expansion` | Yes for multi-target tools | `TARGET_EXPANSION_UNKNOWN` |
| `route_owned_scope_ref` | Yes for writes | `OWNED_SCOPE_MISSING` |
| runtime binding facts | Yes for governed writes | `RUNTIME_BINDING_MISSING` or `CAPABILITY_UNKNOWN` |

`target_path=UNKNOWN` is legal only for read-only classification probes. It is
not legal for write, append, delete, move, generate, registry mutation or state
mutation.

## Target Classification

Target classification is deterministic and happens before guard merge.

Algorithm:

1. Normalize `target_path` against `project_root`.
2. Reject path traversal, unresolved absolute paths outside root and symlink
   escape.
3. Expand tool target patterns into concrete paths when the runtime can provide
   them before action.
4. Classify every concrete target by the most specific matching registry rule.
5. If no rule matches, classify as `unknown`.
6. If any target is `unknown`, return `block` unless the action is read-only
   inspection and policy allows unknown read.
7. If a multi-target action has mixed classes, use the strictest class and
   retain all target refs in the guard output.

Minimum target classes:

| Class | Examples | Default owner | Default write legality |
|---|---|---|---|
| `docs` | `docs/**` | Route or human-authored proposal scope | Allowed only inside route-owned docs scope. |
| `source` | `src/**`, `packages/**`, implementation files | Route-owned build scope | M minimum; tests and review evidence required. |
| `registry` | `.rms/registry/**` | Registry admin/kernel | M minimum; requires registry lock and validation. |
| `rms_runtime_state` | `.rms/runs/**`, `.rms/state/**`, `.rms/locks/**` | RMS kernel | Direct actor writes forbidden except local transaction library. |
| `generated` | `*.generated.*`, generated guard cache, generated books/types | Declared generator | Manual writes block unless regeneration flow owns target. |
| `external` | Path outside project root or external service target | External authority | E minimum for mutation; often block without checkpoint. |
| `unknown` | No registry match or ambiguous expansion | No owner | Block for governed action. |

## Ownership And Allowed Scopes

A route declares owned scopes before protected writes:

```yaml
owned_scope:
  scope_id: "owned_scope_build_001"
  route_ref: "route_2026-05-03_001"
  macro_cycle: "BUILD"
  cycle_substate: "build.implementation_slice"
  allowed_targets:
    - path: "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/02-territory-enforcement-contract.md"
      target_class: "docs"
      actions: ["write"]
      owner: "cycle_04_territory_lane"
  forbidden_targets:
    - path: ".rms/runs/**"
      reason_code: "KERNEL_OWNED_RUNTIME_STATE"
  expires_on_transition: true
```

Allowed-scope rules:

- Writes must be inside the active route-owned scope.
- Reads may be broader when the macro-cycle needs context, but read auditing may
  be required for E/C or sensitive targets.
- Delete and move are stronger than write; they require explicit action entries.
- A directory allow does not imply generated, registry or `.rms/` write allow.
- A route may own one file, directory or generated artifact set, but ownership
  does not bypass risk, runtime, evidence or closing guards.
- Scope expansion after route activation is a new route event and invalidates
  territory-check evidence for the old scope.

## Risk-Specific Legality

Territory legality combines target class, action type, risk class, supervision
mode and runtime binding facts.

| Risk | Read in scope | Write in scope | Path outside scope | Registry write | `.rms` runtime write | Generated write |
|---|---|---|---|---|---|---|
| `UNCLASSIFIED` | Block except classification | Block | Block | Block | Block | Block |
| `T` | Allow | Allow if reversible | Block or reroute | Block unless explicit admin route | Kernel only | Generator only or warn/degrade |
| `F` | Allow | Allow with route scope | Block | M promotion required | Kernel only | Generator only or degrade if policy allows |
| `M` | Allow with evidence | Allow with blocking territory gate | Block | Allow only with registry lock, validation and pairing/supervised mode | Kernel/local transaction only | Generator/regeneration only |
| `E` | Conditional audit | Escalate or block unless checkpointed | Block | Escalate plus checkpoint; native blocking required | Kernel/local transaction only with checkpoint | Block unless safety policy allows |
| `C` | Checkpointed audit | Block by default | Block | Block unless critical admin protocol exists | Kernel only; no autonomous write | Block by default |

Risk forcing effects:

- `registry_or_policy_edit` promotes to at least `M`.
- `rms_state_mutation` promotes to at least `M`.
- `generated_schema_or_type_change` promotes to at least `M`.
- `destructive_filesystem_or_db_action` promotes to at least `E`.
- `secret_or_credential_access` promotes to at least `E`.

## Runtime Binding Interplay

Territory legality and runtime enforceability are separate overlays.

Required gate:

```text
pre_tool_territory_guard
```

Rules:

- The territory overlay decides whether the target/tool/action is legal.
- The runtime overlay decides whether the current runtime can enforce the
  territory decision before the action.
- If territory says `block`, runtime fallback cannot weaken it.
- If territory says `allow` but the required runtime binding is missing for an
  M/E/C governed write, the merged guard still blocks through runtime overlay.
- If runtime can only audit after action, the territory overlay may return
  `degrade` for T/F only when policy allows the target class and action.
- `noop_traced` is valid only for optional observation; it never satisfies
  territory enforcement for M/E/C writes.
- MCP outage does not authorize direct `.rms/` writes. Only the same local
  transaction library may mutate `.rms/` when registered and locked.

## Degraded Fallback Rules

Degraded territory operation is visible, policy-bound and capped.

Accepted degraded operation requires:

```text
territory rule allows degraded route
+ runtime binding fallback is declared
+ risk policy allows fallback for risk/mode/action/target
+ route records degraded operation
+ evidence requires TERRITORY_CHECKED and DEGRADED_ROUTE_ACCEPTED
```

Fallback legality:

| Fallback class | T/F | M | E/C |
|---|---|---|---|
| `native_equivalent` | Allow or degrade | Allow or degrade with evidence | Escalate or allow only with required checkpoint |
| `pre_action_check` | Warn or degrade | Conditional; pairing and explicit residual risk required | Block by default |
| `post_action_audit` | Warn or degrade for non-critical targets | Block for governed write | Block |
| `manual_checkpoint` | Allow if scoped | Conditional; does not replace technical enforcement | Required for residual risk but not sufficient alone |
| `read_only` | Allow for reads | Allow for reads with audit if needed | Conditional audit/checkpoint |
| `noop_traced` | Warn for optional observation only | Block for enforcement | Block |

Degraded territory final-state ceiling:

| Condition | Ceiling |
|---|---|
| T/F degraded docs write with accepted audit gap | `DONE_WITH_GAPS` unless later proof resolves the gap. |
| M native-equivalent territory fallback with fresh proof | `DONE_VERIFIED` remains possible. |
| M non-native fallback with residual enforcement gap | `DONE_WITH_GAPS` at most. |
| E/C residual territory enforcement gap | Blocked final state only. |
| Unknown target or outside-scope write | No success final state from that action. |

## Guard Output

The territory overlay returns a normal `GuardOverlayResult` with
`overlay_kind=territory_overlay`.

Example allow:

```json
{
  "overlay_id": "territory_overlay.docs.cycle04_contract.allow",
  "overlay_kind": "territory_overlay",
  "priority": 500,
  "verdict": "allow",
  "hardness": "soft",
  "reason_code": "TERRITORY_ALLOWED",
  "reason": "target is inside the route-owned Cycle 04 territory lane",
  "required_action": "NOT_APPLICABLE",
  "evidence_required": ["TERRITORY_CHECKED"],
  "side_effects": ["emit_territory_checked_when_persisted"],
  "weakenable": false,
  "allow_weaken_from": [],
  "refs": {
    "policy_ref": "guards/territory-overlays.yaml#docs.cycle04",
    "owned_scope_ref": "owned_scope_build_001"
  }
}
```

Example block:

```json
{
  "overlay_id": "territory_overlay.scope.path_outside.block",
  "overlay_kind": "territory_overlay",
  "priority": 900,
  "verdict": "block",
  "hardness": "hard",
  "reason_code": "TERRITORY_DENIED",
  "reason": "target path is outside the active route-owned scope",
  "required_action": "reroute with expanded scope or remove the target",
  "evidence_required": ["TERRITORY_CHECKED", "STATE_TRANSITION_BLOCKED"],
  "side_effects": ["emit_territory_checked", "preserve_current_state"],
  "weakenable": false,
  "allow_weaken_from": [],
  "refs": {
    "policy_ref": "guards/territory-overlays.yaml#scope.required",
    "owned_scope_ref": "owned_scope_build_001"
  }
}
```

Block reason codes:

| Reason code | Meaning |
|---|---|
| `TERRITORY_DIMENSION_MISSING` | Required macro/substate/tool/action/path dimension is missing. |
| `TARGET_UNKNOWN` | Target path or expansion cannot be classified. |
| `TARGET_OUTSIDE_PROJECT` | Target escapes project root or registered external root. |
| `TERRITORY_DENIED` | Classified target is not allowed for the active route. |
| `OWNED_SCOPE_MISSING` | Write lacks route-owned scope. |
| `OWNED_SCOPE_MISMATCH` | Target is outside declared scope. |
| `TOOL_UNKNOWN` | Tool has no registered class. |
| `ACTION_UNKNOWN` | Action type has no registered semantics. |
| `GENERATED_TARGET_DENIED` | Generated file is not owned by the requested generator. |
| `REGISTRY_WRITE_REQUIRES_LOCK` | Registry target lacks registry lock and validation route. |
| `RMS_DIRECT_WRITE_DENIED` | Actor attempted direct `.rms/` mutation. |
| `CROSS_RUNTIME_PATH_DENIED` | Actor targeted another runtime's installed or state path without explicit mapping. |

Events and evidence:

- Persisted territory decisions emit `TERRITORY_CHECKED`.
- Blocked protected mutations also emit `STATE_TRANSITION_BLOCKED` when part of
  a transition request.
- Degraded accepted territory routes require `DEGRADED_ROUTE_ACCEPTED`.
- Territory evidence becomes stale when route scope, registry digest, target
  expansion, runtime binding or risk class changes.

## Registry Rule Examples

```yaml
ownership_rules:
  - rule_id: "docs.cycle04.territory_lane"
    target_class: "docs"
    path_patterns:
      - "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/02-territory-enforcement-contract.md"
    allowed_macro_cycles: ["BUILD", "CONCEPTION"]
    allowed_actions: ["read", "write"]
    owner: "cycle_04_territory_lane"
    generated: false

  - rule_id: "rms.runtime_state.kernel_only"
    target_class: "rms_runtime_state"
    path_patterns:
      - ".rms/runs/**"
      - ".rms/state/**"
      - ".rms/locks/**"
    allowed_actions: ["read"]
    owner: "rms_kernel"
    forbidden_actions: ["write", "append", "delete", "move"]

  - rule_id: "registry.guards.admin"
    target_class: "registry"
    path_patterns:
      - ".rms/registry/guards/**"
      - ".rms/registry/policies/**"
      - ".rms/registry/schemas/**"
    minimum_risk: "M"
    required_lock: "registry.lock"
    required_tools: ["rms.validate_registry"]

  - rule_id: "generated.merged_guards"
    target_class: "generated"
    path_patterns:
      - ".rms/registry/guards/merged.guards.generated.json"
    generator_id: "rms.generate_merged_guards"
    manual_write: "block"
```

## Fixtures

These fixtures are the minimum implementation tests for PFV4-OD-012.

### VF-TERR-001 - Path Outside Scope Blocks

Input:

```yaml
risk_class: "F"
macro_cycle: "BUILD"
cycle_substate: "build.implementation_slice"
owned_scope:
  allowed_targets:
    - "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/02-territory-enforcement-contract.md"
request:
  tool_class: "apply_patch"
  action_type: "write"
  target_path: "docs/propositions/pipeline-fractal-v4-final-proposal/cycle-04/03-storage-recovery-contract.md"
runtime_binding:
  binding_status: "native"
  can_block: true
```

Expected outcome: `BLOCK`

Expected checks:

- Target is classified as `docs`.
- Target is outside the active owned scope.
- Territory overlay returns `block` with `OWNED_SCOPE_MISMATCH` or
  `TERRITORY_DENIED`.
- Runtime `allow` cannot weaken the territory block.
- No file write or state transition is authorized.

### VF-TERR-002 - Unknown Target Blocks Write

Input:

```yaml
risk_class: "F"
request:
  tool_class: "shell_command"
  action_type: "write"
  target_path: "UNKNOWN"
  target_expansion: "UNKNOWN"
runtime_binding:
  binding_status: "native"
  can_block: true
```

Expected outcome: `BLOCK`

Expected checks:

- Territory evaluation returns `TARGET_UNKNOWN` or
  `TARGET_EXPANSION_UNKNOWN`.
- No write is allowed by inference from intent text.
- Required action asks for concrete target expansion or a safer tool.

### VF-TERR-003 - Generated File Manual Write Blocks

Input:

```yaml
risk_class: "M"
request:
  tool_class: "apply_patch"
  action_type: "write"
  target_path: ".rms/registry/guards/merged.guards.generated.json"
target_class: "generated"
generator_id: "rms.generate_merged_guards"
actor_tool: "apply_patch"
```

Expected outcome: `BLOCK`

Expected checks:

- Target is classified as `generated`.
- Manual write is rejected with `GENERATED_TARGET_DENIED`.
- Required action is to update source registry files and run the generator.
- The generated cache cannot become authoritative.

### VF-TERR-004 - Registry File Requires Lock And Validation

Input:

```yaml
risk_class: "M"
supervision_mode: "auto_decision"
request:
  tool_class: "apply_patch"
  action_type: "write"
  target_path: ".rms/registry/guards/territory-overlays.yaml"
locks:
  registry_lock: "MISSING"
runtime_binding:
  binding_status: "native"
  can_block: true
```

Expected outcome: `BLOCK`

Expected checks:

- Target is classified as `registry`.
- Risk is at least M because this is `registry_or_policy_edit`.
- Missing registry lock blocks with `REGISTRY_WRITE_REQUIRES_LOCK`.
- Valid continuation requires registry-lock transaction and
  `rms.validate_registry`.

### VF-TERR-005 - Direct `.rms` Runtime Write Blocks

Input:

```yaml
risk_class: "M"
actor:
  actor_type: "subagent"
request:
  tool_class: "filesystem_write"
  action_type: "append"
  target_path: ".rms/runs/run_001/events.jsonl"
runtime_binding:
  binding_status: "native"
  can_block: true
```

Expected outcome: `BLOCK`

Expected checks:

- Target is classified as `rms_runtime_state`.
- Direct write by subagent, skill or generic filesystem tool is rejected with
  `RMS_DIRECT_WRITE_DENIED`.
- Only MCP kernel tool or registered local transaction library may append.
- The attempted write is evidence of authority violation if observable.

### VF-TERR-006 - Cross-Runtime Installed Path Blocks

Input:

```yaml
risk_class: "M"
actor:
  runtime: "codex"
request:
  tool_class: "filesystem_write"
  action_type: "write"
  target_path: "C:/Users/example/.claude/agents/pfv4-stop-gate.md"
target_class: "external"
runtime_mapping:
  declared_cross_runtime_target: false
```

Expected outcome: `BLOCK`

Expected checks:

- Absolute path outside project root is classified as `external` or denied
  before classification.
- Cross-runtime installed path requires explicit runtime mapping and route
  scope.
- M risk cannot use audit-only fallback for this mutation.
- Guard returns `CROSS_RUNTIME_PATH_DENIED` or `TARGET_OUTSIDE_PROJECT`.

### VF-TERR-007 - T Docs Write With Audit Fallback Degrades

Input:

```yaml
risk_class: "T"
request:
  tool_class: "filesystem_write"
  action_type: "write"
  target_path: "docs/local-note.md"
owned_scope:
  allowed_targets:
    - "docs/local-note.md"
runtime_binding:
  binding_status: "fallback"
  fallback_class: "post_action_audit"
  fallback_can_block: false
policy:
  territory_audit_fallback_allowed: true
```

Expected outcome: `PASS`

Expected checks:

- Territory decision is `warn` or `degrade`, not silent `allow`.
- Evidence requirements include `TERRITORY_CHECKED` and
  `DEGRADED_ROUTE_ACCEPTED`.
- Final-state ceiling is `DONE_WITH_GAPS` unless later proof resolves the gap.

### VF-TERR-008 - M Audit-Only Territory Enforcement Blocks

Input:

```yaml
risk_class: "M"
request:
  tool_class: "filesystem_write"
  action_type: "write"
  target_path: "src/kernel/guard-engine.ts"
owned_scope:
  allowed_targets:
    - "src/kernel/**"
runtime_binding:
  binding_status: "fallback"
  fallback_class: "post_action_audit"
  fallback_can_block: false
```

Expected outcome: `BLOCK`

Expected checks:

- Territory class and route scope may allow the target.
- Runtime/territory enforcement cannot block pre-action.
- M governed write blocks with `DEGRADED_ROUTE_FORBIDDEN` or
  `RUNTIME_BINDING_MISSING`.
- `DONE_VERIFIED` is unavailable from this route.

### VF-TERR-009 - Native-Equivalent Fallback Can Continue For M

Input:

```yaml
risk_class: "M"
request:
  tool_class: "apply_patch"
  action_type: "write"
  target_path: "src/kernel/guard-engine.ts"
owned_scope:
  allowed_targets:
    - "src/kernel/**"
runtime_binding:
  binding_status: "fallback"
  fallback_class: "native_equivalent"
  fallback_can_block: true
evidence_refs:
  - "evt_runtime_binding_checked"
  - "evt_degraded_route_accepted"
```

Expected outcome: `PASS`

Expected checks:

- Territory allows target by owned scope.
- Runtime fallback is visible and policy-allowed.
- Guard decision is `degrade` or policy `allow`, never untraced allow.
- `DONE_VERIFIED` remains possible only if all residual gaps are resolved.

### VF-TERR-010 - Scope Expansion Invalidates Territory Evidence

Input:

```yaml
previous_territory_check:
  evidence_id: "ev_territory_001"
  scope_ref: "owned_scope_build_001"
  target_path: "docs/a.md"
events:
  - event_type: "ROUTE_PLANNED"
    route_ref: "route_2026-05-03_002"
    changes:
      owned_scope_ref: "owned_scope_build_002"
request:
  final_candidate: "DONE_VERIFIED"
```

Expected outcome: `BLOCK`

Expected checks:

- Old territory evidence is stale after route scope change.
- Evidence or closing guard blocks final verification until a fresh
  `TERRITORY_CHECKED` exists for the new scope.

## Readiness Gate

PFV4-OD-012 is no longer `still_blocking` when implementation planning carries
forward these requirements:

1. `guards/territory-overlays.yaml` has schemas for target classes, tool
   classes, actions, ownership rules, legality rules and fallback rules.
2. `TerritoryRequest` rejects missing dimensions, `null`, unknown targets,
   ambiguous expansions and path escape.
3. Route-owned scopes are explicit and evidence-invalidating when changed.
4. Registry files, generated files and `.rms/` runtime files have special
   ownership rules.
5. M/E/C governed writes require native or native-equivalent pre-action
   enforcement.
6. T/F audit-only fallback is visible, evidence-bound and final-state-capped.
7. Fixture families `VF-TERR-001` through `VF-TERR-010` are included in the
   schema-first test plan.

## Decision Delta

| Open point | Cycle 04 result |
|---|---|
| Territory overlay registry absent. | `closed_by_contract`: registry file, schema fields and rule ownership are defined. |
| Path/tool/action schema absent. | `closed_by_contract`: `TerritoryRequest` and required dimensions are defined. |
| Ownership and scope rules absent. | `closed_by_contract`: route-owned scopes, special target classes and invalidation rules are defined. |
| Risk legality absent. | `closed_by_contract`: risk-specific matrix and fail-closed M/E/C defaults are defined. |
| Degraded fallback fixtures absent. | `closed_by_fixture`: VF-TERR fixtures cover outside scope, unknown target, generated files, registry files, `.rms` writes and cross-runtime paths. |

## Summary

Territory enforcement is registry-owned, route-scoped, risk-aware and
runtime-bound. The executable rule is:

```text
normalize target
classify every target
verify route-owned scope
apply risk-specific legality
check runtime pre-action enforceability
return territory overlay result
fail closed for unknown, outside-scope, generated, registry, .rms and
cross-runtime violations unless a registry-backed rule explicitly allows the
route
```

This closes PFV4-OD-012 for schema-first implementation planning, subject to
the Cycle 04 audit and integration verdict.
