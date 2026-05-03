# 04 - Registry And Storage Layout

Status: Cycle 02 registry/storage contract proposal

## Purpose

This lane closes the Cycle 01 storage and registry blockers enough for
implementation planning. It defines the local `.rms/` layout, run event and
snapshot files, static registries, schema boundaries, transaction rules,
migration notes, and fail-closed behavior for the Pipeline Fractale V4 RMS
kernel.

Sources used:

- `../06-integrated-final-proposal.md`
- `../04-single-mcp-state-kernel.md`
- `../05-convergence-validation-cycle.md`
- `../../pipeline-fractal-v4-state-machine/README.md`
- `../../pipeline-fractal-v4-state-machine/01-state-model.md`
- `../../pipeline-fractal-v4-state-machine/04-guard-matrix.md`
- `../../pipeline-fractal-v4-state-machine/06-open-decisions.md`
- `../../pipeline-fractal-v4-state-machine/08-transition-catalog.md`
- `../../../conception/03-rms-sets-schema.md`

## Design Decision

Use a local event-sourced `.rms/` store:

```text
event log = authoritative history
registry  = authoritative executable contract
snapshots = validated projections
books     = explanatory, never authoritative
skills    = procedures, never direct writers
subagents = evidence producers, never direct writers
```

The MCP server is the normal mutation surface, but the filesystem layout must be
valid even when the server is started from local files or recovered after a
crash. Every mutating operation must append an event first, then atomically
publish derived files. If the event cannot be durably appended, state does not
advance.

## `.rms/` Layout

```text
.rms/
  VERSION
  registry/
    registry-manifest.yaml
    state/
      cycles.yaml
      substates.yaml
      transitions.yaml
      final-states.yaml
      lens-map.yaml
      meta-regions.yaml
    guards/
      base-guards.yaml
      risk-overlays.yaml
      supervision-overlays.yaml
      runtime-overlays.yaml
      territory-overlays.yaml
      evidence-overlays.yaml
      convergence-overlays.yaml
      merged.guards.generated.json
    policies/
      risk-policy.yaml
      evidence-policy.yaml
      convergence-policy.yaml
      closing-policy.yaml
      human-checkpoint-policy.yaml
    runtimes/
      codex.yaml
      claude.yaml
      hermes.yaml
      fallback-profiles.yaml
    schemas/
      event.schema.json
      run-set.schema.json
      intent-set.schema.json
      route-set.schema.json
      evidence-set.schema.json
      convergence-set.schema.json
      capability-set.schema.json
      binding-set.schema.json
      registry-manifest.schema.json
      guard-decision.schema.json
      transaction.schema.json
  state/
    project-set.json
    last-runtime-probe.json
    registry-cache.json
  runs/
    <run_id>/
      run-manifest.json
      events.jsonl
      snapshots/
        current-state.json
        run-set.json
        evidence-set.json
        convergence-set.json
        latest-guard-decision.json
        closed-state.json
      sets/
        intent-set.v1.json
        capability-set.v1.json
        binding-set.v1.json
        route-set.v1.json
      decisions/
        guard-decisions.jsonl
        route-decisions.jsonl
        risk-decisions.jsonl
        human-checkpoints.jsonl
      artifacts/
        evidence/
        runtime/
        subagents/
        commands/
      transactions/
        pending/
        committed/
        failed/
      locks/
        run.lock
  locks/
    registry.lock
    project.lock
  migrations/
    applied.jsonl
    supersession.md
```

### Layout Rules

| Area | Format | Authority | Commit policy |
|---|---|---|---|
| `.rms/registry/**` | YAML for authored registries, JSON for schemas/generated merged views | Executable static contract | Committed with source. Agents cannot edit during a governed run. |
| `.rms/state/project-set.json` | JSON | Stable project truth | Committed with source; mutable only by init/admin flows outside active runs. |
| `.rms/runs/<run_id>/events.jsonl` | JSONL | Authoritative run history | Runtime state, usually ignored by source control. Append-only. |
| `.rms/runs/<run_id>/snapshots/**` | JSON | Projection cache | Runtime state, rebuildable from events and registries. |
| `.rms/runs/<run_id>/sets/**` | JSON | Per-run frozen inputs | Runtime state; each version immutable after route starts. |
| `.rms/runs/<run_id>/decisions/**` | JSONL | Auditable decision streams | Append-only companions to events. |
| `.rms/runs/<run_id>/artifacts/**` | Text/binary | Evidence payload storage | Referenced by Evidence Set; not interpreted as state. |
| `.rms/locks/**`, `runs/*/locks/**` | Lock files | Concurrency control only | Ephemeral; never authoritative. |
| `.rms/migrations/**` | JSONL/Markdown | Schema evolution record | Committed when registry/storage contracts change. |

## Run Files

### `run-manifest.json`

The manifest is the run index. It is created before the first event and then
updated only by transaction rules.

Required fields:

```json
{
  "schema_version": "1.0",
  "run_id": "run_2026-05-03_001",
  "created_at": "2026-05-03T00:00:00Z",
  "updated_at": "2026-05-03T00:00:00Z",
  "runtime": "codex",
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "event_log_digest": "sha256:...",
  "pipeline_activation": "candidate",
  "final_state": "UNSET",
  "current_snapshot_ref": "snap_current_000001",
  "closed": false
}
```

Rules:

- `registry_version` and `registry_digest` pin the executable contract used by
  the run.
- `event_log_digest` is the digest after the latest committed event.
- `closed=true` freezes all run files except recovery/audit append logs.
- `final_state` uses explicit `UNSET` until closure; no `null` values.

### `events.jsonl`

The event log is the source of truth. Every line is one complete JSON object and
must validate against `registry/schemas/event.schema.json`.

Minimum event fields:

```json
{
  "schema_version": "1.0",
  "event_id": "evt_000001",
  "run_id": "run_2026-05-03_001",
  "sequence": 1,
  "timestamp": "2026-05-03T00:00:00Z",
  "actor": "mcp",
  "event_type": "RUN_STARTED",
  "severity": "info",
  "state_before_ref": "UNSET",
  "state_after_ref": "snap_current_000001",
  "decision_ref": "UNSET",
  "evidence_refs": [],
  "runtime": "codex",
  "binding_status": "native",
  "registry_version": "pfv4-registry-v1",
  "registry_digest": "sha256:...",
  "prev_event_digest": "UNSET",
  "event_digest": "sha256:...",
  "payload": {}
}
```

Required event invariants:

1. `sequence` is strictly increasing by one inside a run.
2. `event_id` is unique in the run.
3. `prev_event_digest` equals the previous event line digest, or `UNSET` for the
   first event.
4. Any change to `pipeline_activation`, `macro_cycle`, `cycle_substate`,
   `risk_class`, `supervision_mode`, `meta_regions`, `final_state`, route,
   evidence verdict, or convergence verdict requires an event.
5. Blocked guard decisions are events, not silent denials.
6. Late evidence after closure may be recorded only as `LATE_EVIDENCE_REJECTED`
   in an audit stream; it cannot mutate final state.

Required event types for MVP:

```text
RUN_STARTED
INTENT_CAPTURED
CAPABILITY_DISCOVERED
BINDING_RESOLVED
RISK_CLASSIFIED
RISK_CLASS_PROMOTED
ROUTE_PLANNED
GUARD_EVALUATED
STATE_TRANSITION_REQUESTED
STATE_TRANSITION_COMMITTED
STATE_TRANSITION_BLOCKED
TERRITORY_CHECKED
RUNTIME_BINDING_CHECKED
EVIDENCE_RECORDED
EVIDENCE_EVALUATED
CONVERGENCE_EVALUATED
DEGRADED_ROUTE_ACCEPTED
DEGRADED_ROUTE_REJECTED
FINAL_STATE_CANDIDATE
RUN_CLOSING
RUN_CLOSED
TRANSACTION_FAILED
INVARIANT_VIOLATION
REGISTRY_INVALID
```

### `snapshots/current-state.json`

The current-state snapshot materializes the V2 state object:

```text
RunEnvelope
+ HarnessMachineState or NOT_ACTIVE
+ Convergence projection
+ DerivedView
```

Rules:

- It is rebuildable from `events.jsonl`, per-run sets, and the pinned registry.
- It must contain explicit sentinel values such as `UNSET`, `UNKNOWN`,
  `NOT_APPLICABLE`, or `NOT_ACTIVE`; `null` is invalid.
- `primary_lens` is generated from `state/lens-map.yaml`, never written
  independently.
- `evidence_status` is generated from `snapshots/evidence-set.json` and
  evidence policy, never written independently.
- `convergence_status` is generated from `snapshots/convergence-set.json` and
  convergence policy, never written independently.

### `snapshots/run-set.json`

The Run Set is the operational projection: active macro-cycle, substate,
meta-regions, route execution status, active blockers, active child lanes, and
latest transition refs. It must never contradict `events.jsonl`; if replay and
snapshot differ, replay wins and the snapshot is discarded.

### `snapshots/evidence-set.json`

The Evidence Set is append-only in meaning even if stored as a compact JSON
projection. Evidence items are never edited or removed. Superseded evidence is
represented by a new item with `supersedes_evidence_id`, not by mutation.

`DONE_VERIFIED` is authorized only when the Evidence Set verdict is `verified`
and required proof types for the run risk, cycle, final candidate, and runtime
degradation state are present, fresh, non-conflicted, and passing.

### `snapshots/convergence-set.json`

The Convergence Set stores sample windows, progress events, repeated-state
patterns, divergence signals, score caps, and verdict. Max attempts are a fuse,
not the convergence model.

## Registry Files

### Registry Manifest

`registry/registry-manifest.yaml` is the entrypoint for validation and version
pinning.

Required fields:

```yaml
schema_version: "1.0"
registry_id: "pfv4-registry"
registry_version: "pfv4-registry-v1"
canonical_language: "en"
canonical_charset: "ascii"
supersedes:
  - "pipeline-fractal-v4-state-machine-v1-draft"
sources:
  - path: "docs/propositions/pipeline-fractal-v4-state-machine"
    role: "v2_state_machine_source"
files:
  cycles: "state/cycles.yaml"
  substates: "state/substates.yaml"
  transitions: "state/transitions.yaml"
  lens_map: "state/lens-map.yaml"
  guards:
    - "guards/base-guards.yaml"
    - "guards/risk-overlays.yaml"
    - "guards/supervision-overlays.yaml"
    - "guards/runtime-overlays.yaml"
    - "guards/territory-overlays.yaml"
    - "guards/evidence-overlays.yaml"
    - "guards/convergence-overlays.yaml"
  policies:
    - "policies/risk-policy.yaml"
    - "policies/evidence-policy.yaml"
    - "policies/convergence-policy.yaml"
    - "policies/closing-policy.yaml"
runtime_bindings:
  - "runtimes/codex.yaml"
  - "runtimes/claude.yaml"
  - "runtimes/hermes.yaml"
generated:
  merged_guards: "guards/merged.guards.generated.json"
```

Validation fails if any manifest file is missing, unparseable, schema-invalid,
or references unknown identifiers.

### State Registries

| File | Contents | Key validations |
|---|---|---|
| `state/cycles.yaml` | `IDLE`, `DISCOVERY`, `CADRAGE`, `CONCEPTION`, `BUILD`, `VALIDATION`, `RELEASE`, `RUN`, `APPRENTISSAGE` | ASCII identifiers; every real cycle has at least one substate. |
| `state/substates.yaml` | Cycle-owned semantic substates | Each substate belongs to exactly one macro-cycle and maps to one primary lens. |
| `state/transitions.yaml` | Activation, internal, macro, rework, risk, meta-region, final transitions | Directed graph only; free transitions forbidden. |
| `state/final-states.yaml` | `DONE_VERIFIED`, `DONE_WITH_GAPS`, blockers, abort states | Each final state has closing guard and required evidence policy refs. |
| `state/lens-map.yaml` | Substate to `OBSERVE/DEFINE/DESIGN/EXECUTE/VERIFY/CAPITALIZE/TRANSMIT` | No stored lens may conflict with this map. |
| `state/meta-regions.yaml` | Attention, policy, runtime, delegation, human, safety region values | Region transitions cannot change macro/substate directly unless transition registry names the effect. |

### Guard Registries

Guard evaluation uses deterministic merge order:

```text
base_guard
-> risk_overlay
-> supervision_overlay
-> runtime_overlay
-> territory_overlay
-> evidence_overlay
-> convergence_overlay
-> closing_policy
```

Merge rules:

1. Stronger decisions dominate weaker decisions:
   `block > escalate > reroute > degrade > warn > allow`.
2. Later overlays may strengthen a result but cannot weaken it unless they name
   an explicit `allow_weaken_from` rule and that rule is allowed by policy.
3. `C` risk cannot be weakened from `block` to `warn`, `degrade`, or `allow` for
   autonomous final decisions.
4. Missing capability, missing schema, unknown risk, invalid registry, or
   unclassified M/E/C action becomes `block`.
5. The merged decision must include `registry_version`, input refs, applied
   overlay ids, resulting decision, required action, and evidence requirements.

`merged.guards.generated.json` is a cache for runtime speed. It is never
hand-edited and is invalid if its digest does not match the manifest and source
guard files.

### Policy Registries

| File | Purpose |
|---|---|
| `policies/risk-policy.yaml` | T/F/M/E/C risk minima, forcing signals, promotion rules, bypass legality. |
| `policies/evidence-policy.yaml` | Required proof types by risk, cycle, transition, final state, degraded route, and accepted gap. |
| `policies/convergence-policy.yaml` | Sample windows, repeated-state thresholds, score caps, divergence signals, max-attempt fuse. |
| `policies/closing-policy.yaml` | `active -> closing -> closed` protocol and final-state authorization. |
| `policies/human-checkpoint-policy.yaml` | Required checkpoint shapes, signatures, rejection handling, E/C acceptance limits. |

### Runtime Registries

Each `runtimes/<runtime>.yaml` maps RMS primitives to concrete runtime
capabilities:

```yaml
runtime: "codex"
schema_version: "1.0"
bindings:
  gate.user_prompt:
    binding_status: "native"
    can_block: true
    native_event: "UserPromptSubmit"
    fallback_strategy: "NOT_APPLICABLE"
    fail_open_risk: false
  gate.pre_tool:
    binding_status: "native"
    can_block: true
    native_event: "PreToolUse"
    fallback_strategy: "NOT_APPLICABLE"
    fail_open_risk: false
  gate.post_tool:
    binding_status: "native"
    can_block: false
    native_event: "PostToolUse"
    fallback_strategy: "audit_only"
    fail_open_risk: true
```

Rules:

- Runtime name alone never proves enforceability.
- `capability_unknown` blocks until discovery.
- `missing` blocks unless the route can change before the governed action.
- `fallback` is allowed only when declared and risk/mode policy permits it.
- `noop_traced` is not valid for blocking enforcement in M/E/C work.

## Schema Boundaries

Use JSON Schema draft 2020-12 for machine validation. YAML registries are parsed
to JSON and validated against the schema files under `registry/schemas/`.

Minimum schema requirements:

- `additionalProperties: false` for executable objects.
- `schema_version` required on every file.
- No `null`; use explicit sentinels.
- Identifiers are ASCII and match `^[A-Z0-9_]+$` for enum-like values or
  `^[a-z0-9][a-z0-9_.-]*$` for ids and substates.
- Every cross-reference is validated during `rms.validate_registry`.
- Registry validation emits a digest used by run manifests and events.
- Generated TypeScript types should come from schemas, not Markdown examples.

## Locking And Transactions

### Lock Scopes

| Lock | Scope | When required |
|---|---|---|
| `.rms/locks/registry.lock` | Static registries and generated merged views | Registry validation, migration, generated cache update. |
| `.rms/locks/project.lock` | `state/project-set.json` | Project init/admin update. |
| `.rms/runs/<run_id>/locks/run.lock` | Single run event log and snapshots | Any run mutation. |

Locks are advisory plus verified by optimistic checks. A writer must hold the
lock and must verify that the previous event digest and manifest version still
match before commit.

### Transaction Protocol

Every mutating operation uses this order:

1. Acquire the narrowest lock.
2. Read run manifest, latest event digest, current snapshot, and pinned registry
   digest.
3. Validate input against schemas and evaluate guards.
4. Write a transaction intent file to `transactions/pending/<tx_id>.json`.
5. Append the event line to `events.jsonl` and force durability.
6. Recompute projections in temporary files.
7. Atomically rename temporary projection files into `snapshots/`.
8. Update `run-manifest.json` with the new event digest and snapshot refs.
9. Move transaction intent to `transactions/committed/<tx_id>.json`.
10. Release the lock.

If any step after guard evaluation fails, append `TRANSACTION_FAILED` only if
the log remains writable. If the log is not writable, leave the pending
transaction file and block the run on next load.

### Atomic Write Rules

- Never rewrite `events.jsonl`.
- Never truncate `events.jsonl`.
- Projection files are written as `*.tmp` and atomically renamed.
- A snapshot without a matching event digest is invalid.
- A committed transaction without the corresponding event is invalid.
- On startup, if `transactions/pending/` is non-empty, the kernel enters
  recovery mode and blocks governed transitions until replay resolves or marks
  the transaction failed.

### MCP Outage Fallback

If the MCP server is unavailable:

- runtime adapters may read snapshots and events for explanation;
- runtime adapters may not commit governed state transitions directly unless
  they use the same local transaction library and registry validation;
- skills may not write `.rms/` manually;
- subagent outputs remain artifacts until `rms.record_evidence` or the local
  transaction fallback imports them;
- no run may close as `DONE_VERIFIED` while required MCP/kernel validation is
  unavailable.

For T/F work, an explicitly declared file/CLI fallback may continue in degraded
mode only if it records `DEGRADED_ROUTE_ACCEPTED` and the route policy allows
audit-only enforcement. For M/E/C work, missing governed transition capability
blocks unless a policy-approved native-equivalent fallback exists.

## Migration And Supersession Notes

### Supersession

Cycle 02 should treat the V2 state-machine folder and final proposal as the
current design authority for new registry work.

Supersession rule:

```text
pipeline-fractal-v4-state-machine-v1-draft.md
and docs/conception/01-state-machine-spec.md
remain historical references.

For executable PFV4 registry/storage design, this Cycle 02 layout supersedes
their older .planning/current-state.yaml and monolithic FSM storage assumptions.
```

The older RMS set schema remains useful for set naming and initial field
coverage, but is superseded where it conflicts with:

- V2 no-null rule;
- semantic substates plus derived lens;
- event log over snapshots;
- split guard registries and deterministic overlay merge;
- `active -> closing -> closed` final-state protocol;
- fail-closed runtime degradation for M/E/C.

### Migration Files

`migrations/applied.jsonl` records storage/registry migrations:

```json
{
  "migration_id": "mig_0001",
  "timestamp": "2026-05-03T00:00:00Z",
  "from_version": "UNSET",
  "to_version": "pfv4-registry-v1",
  "actor": "harness-cli",
  "registry_digest_before": "UNSET",
  "registry_digest_after": "sha256:...",
  "summary": "Initialize PFV4 V2 registry layout"
}
```

`migrations/supersession.md` must list which older docs are historical, which
sections are still imported, and which executable assumptions are rejected.

Migration constraints:

- Never mutate old run event logs in place.
- Re-project snapshots from old events when possible.
- If an old event lacks required V2 fields, create a new migration event with
  explicit `UNKNOWN` or `NOT_APPLICABLE`, not `null`.
- If a legacy run cannot be made valid without inventing evidence, keep it
  closed as historical and mark it `NOT_MIGRATED_UNVERIFIABLE`.

## Fail-Closed Rules

The kernel blocks governed transitions when any of these conditions is true:

| Condition | Required result |
|---|---|
| Registry manifest missing or invalid | `REGISTRY_INVALID`; no executable state-machine use. |
| Registry digest differs from run manifest without migration | Block; require migration or run restart. |
| Event append fails | Block mutation; state cannot advance. |
| Event digest chain invalid | Enter recovery; block final states and writes. |
| Snapshot contradicts event replay | Discard snapshot; rebuild from events; block if rebuild fails. |
| Pending transaction exists after restart | Recovery mode; block new governed transitions. |
| Capability unknown for required primitive | Block until runtime discovery. |
| Required primitive missing with no policy-allowed fallback | `BLOCKED_RUNTIME_MISSING`. |
| Audit-only fallback requested for M/E/C enforcement | Block unless policy declares native-equivalent fallback. |
| Evidence stale, missing, or conflicted | Block `DONE_VERIFIED`; reroute or close with gaps only if policy permits. |
| `DONE_WITH_GAPS` has E/C residual gap | Block. |
| Bypass requested for M/E/C | Block; promote supervision mode or suspend for checkpoint. |
| Critical risk in autonomous final decision | Block; require human checkpoint/pairing. |
| Book prose conflicts with registry | Registry wins; record drift evidence and block if conflict affects active guard. |
| Skill or subagent tries direct `.rms/` mutation | Block; require MCP/local transaction tool. |
| Late evidence arrives after closure | Reject for final-state mutation; record audit-only event if allowed. |

## Acceptance Fixtures

These fixtures should be converted into tests before implementation:

1. Registry has a substate with no lens map entry -> `REGISTRY_INVALID`.
2. Transition jumps from `discovery.problem_frame` to
   `build.implementation_slice` without a registered edge -> block.
3. Skill writes `snapshots/current-state.json` directly -> block and require
   `rms.transition`.
4. Event append succeeds but snapshot update fails -> event remains, snapshot is
   rebuilt on next load, transaction marked failed or recovered.
5. Snapshot says `DONE_VERIFIED` but event log never committed `RUN_CLOSED` ->
   replay wins; snapshot invalid.
6. Runtime binding for M work has `gate.pre_tool` as `noop_traced` -> block.
7. T work has post-run audit fallback declared -> degrade only with
   `DEGRADED_ROUTE_ACCEPTED` evidence.
8. Evidence item is superseded -> old item remains, new item references
   `supersedes_evidence_id`.
9. Legacy `.planning/agent/current-state.yaml` exists -> ignored for PFV4 V2
   authority unless imported by an explicit migration.
10. Book claims bypass is allowed for M -> registry wins, drift recorded, bypass
    blocked.

## Decision Delta

Closed defaults for this lane:

- Registry split: split static registries by state, guard overlays, policies,
  runtimes, and schemas; use a manifest and generated merged guard cache.
- Local storage: one `.rms/runs/<run_id>/events.jsonl` plus rebuildable
  snapshots and immutable per-run set versions.
- Locking: per-run lock for mutations, registry lock for validation/migration,
  optimistic digest checks for stale writers.
- Transaction order: append event before publishing projections; mutation fails
  if append fails.
- MCP outage fallback: no manual `.rms/` writes; only the same local transaction
  library may mutate when server transport is down.
- Supersession: V2/final proposal supersedes older monolithic FSM storage for
  executable PFV4 work.

Still-open implementation details:

- Exact JSON Schema contents for every file.
- Concrete guard overlay conflict fixtures.
- Initial convergence thresholds.
- Runtime binding facts for current Codex, Claude and Hermes versions.
- Source-control ignore policy for runtime `.rms/runs/**` artifacts.
