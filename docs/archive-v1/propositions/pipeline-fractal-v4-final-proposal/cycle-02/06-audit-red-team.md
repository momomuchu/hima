# 06 - Audit Red Team

Status: Cycle 02 audit output

Verdict: blocked for implementation handoff

## Scope

Audited inputs:

- `../06-integrated-final-proposal.md`
- `../04-single-mcp-state-kernel.md`
- `../03-skills-hooks-subagents-taxonomy.md`
- `../02-edge-case-red-team.md`
- `../05-convergence-validation-cycle.md`
- `../07-decision-matrix.md`
- `../../pipeline-fractal-v4-state-machine/`
- `00-cycle-02-brief.md`

Only `00-cycle-02-brief.md` was present in `cycle-02/` at audit time.

## Executive Verdict

The architecture direction is coherent: a hybrid event-sourced RMS kernel,
exposed by one MCP server, with runtime adapters, procedural skills, bounded
subagents, and non-authoritative reference docs.

The proposal is not implementation-ready. The main risk is premature
convergence language: Cycle 01 says several P0 decisions are closed, while the
V2 state-machine register still marks overlapping decisions as P0/P1, and Cycle
02 explicitly exists to turn those claims into implementation-shaped contracts.

Implementation should not begin until the blockers below are resolved into
schemas, registry splits, transaction rules, fixtures, and supersession
decisions.

## Critical Findings

### 1. P0 Closure Is Premature

`06-integrated-final-proposal.md` says Cycle 01 closed P0 decisions for
non-development representation, MCP role, skill/hook/subagent authority, and
runtime degradation. But V2 still lists blocking or near-blocking decisions for
pipeline activation, non-development representation, risk/mode canonicalization,
evidence semantics, territory enforcement, closing protocol, runtime
degradation, guard registry location, and ASCII canonicalization.

This is a contradiction unless the final proposal formally supersedes the V2
open-decision register.

Required fix:

- Add a decision-delta table mapping every `PFV4-OD-*` to `closed`,
  `clarified`, `still open`, or `superseded`.
- Add an ADR declaring whether the final proposal supersedes
  `docs/conception/01-state-machine-spec.md`, the V2 folder, both, or neither.
- Do not claim implementation readiness while any P0 lacks an implementation
  object and fixture.

### 2. MCP Fallback Is Underspecified And Contradictory

The taxonomy allows a file adapter when MCP is unavailable, while the MCP kernel
doc says no RMS `DONE_VERIFIED` is possible when MCP is unavailable. The final
proposal also lists "MCP outage fallback" as still open.

This leaves implementers unable to decide whether the kernel is:

- inside the MCP server;
- a local library exposed by MCP;
- a CLI/file transaction engine used by MCP;
- or a mix of all three.

Required fix:

- Declare the true authority shape: `kernel library > MCP adapter`, or `MCP
  server is the kernel`.
- If file/CLI fallback exists, specify transaction protocol, lock file, event
  append atomicity, idempotency key, replay rule, and conflict handling.
- If fallback cannot mutate state, say so explicitly and restrict it to
  read-only inspection plus append-only degraded audit.

### 3. Hidden Monolith Risk Remains H-Risk

The MCP/kernel surface owns Project, Intent, Policy, Route, Run, Evidence,
Convergence, Runtime Capability, Runtime Binding, Registry, guard decisions,
final states, and resources/prompts. The proposal says the server is internally
modular, but does not define internal module boundaries.

This can recreate the monolith the proposal is trying to avoid.

Required fix:

- Split implementation contracts into kernel modules before coding:
  `state-store`, `registry-loader`, `guard-engine`, `evidence-engine`,
  `convergence-engine`, `runtime-binding-engine`, `mcp-adapter`,
  `cli/file-adapter`.
- Require MCP tools to call these modules rather than owning business logic
  directly.
- Add a fixture proving an MCP transport outage does not corrupt the local event
  log.

### 4. Guard Merge Is Still Prose, Not An Algorithm

The proposal names overlays: base, risk, supervision, runtime, territory,
evidence, and convergence. It does not define deterministic precedence or merge
semantics for conflicting outputs such as `warn + degrade + block + reroute`.

Required fix:

- Define a total order or decision lattice for `allow`, `warn`, `degrade`,
  `reroute`, `escalate`, and `block`.
- Define required side effects for each verdict.
- Define whether `degrade` is a final verdict or an action attached to
  `warn/block/reroute`.
- Add fixtures for risk blocks but runtime degrades, evidence warns but
  territory blocks, convergence reroutes while stop gate requests close, and
  human checkpoint escalates while all technical gates allow.

### 5. Evidence, Convergence, And Closing Are Not Yet Executable

The docs say `DONE_VERIFIED` requires verified evidence and verified
convergence, but the required evidence schema, freshness rules, stale
invalidation graph, convergence thresholds, and final closing protocol are still
open.

Required fix:

- Define `EvidenceRequirement` by `cycle_substate x risk_class x
  final_state_candidate`.
- Define freshness invalidation triggers for diff changes, scope changes, risk
  promotion, runtime binding changes, route changes, and late subagent results.
- Define convergence sample windows, score caps, repeated-state detection, and
  loop thresholds.
- Define `active -> closing -> closed` as a transaction with final-state
  candidate, evidence evaluation, convergence evaluation, policy/runtime check,
  and final event append.

### 6. Runtime Degradation Can Still Fail Open In Practice

The final proposal says M/H/C cannot silently degrade, but older runtime binding
specs still contain fail-open behavior for disabled hooks, hook crashes, and
timeouts. The final proposal has not yet translated the stricter policy into
binding-set fields and fixtures.

Required fix:

- Make `can_block`, `binding_status`, `fallback_strategy`, `fail_open_risk`, and
  `risk_allowed` mandatory in Runtime Binding Set entries.
- Encode M/H/C missing hard-gate behavior as executable policy, not prose.
- Add fixtures for Codex hooks disabled, Hermes stop gate unblockable, MCP
  unavailable, hook timeout, and hook crash.
- Require `BLOCKED_RUNTIME_MISSING` when required M/H/C enforcement is
  unavailable and no declared fallback satisfies policy.

### 7. Skill, Subagent, And Reference doc Drift Are Named But Not Controlled

The authority model is clear: skills are procedures, subagents return evidence
candidates, and reference docs are references. But drift detection is not
implementation-shaped.

Missing controls:

- installed skill version/hash;
- source-of-truth path for bundled skills;
- subagent output schema version;
- reference doc generation provenance;
- registry-to-reference doc consistency check;
- startup/install sync rule;
- behavior when a user edits a reference doc or skill locally.

Required fix:

- Add `artifact_manifest.json` or registry entries for skills, subagents, and
  reference docs.
- Include `name`, `version`, `source_ref`, `hash`, `schema_version`,
  `authority`, and `drift_policy`.
- Add fixtures for drifted core skill, schema-less subagent output, reference doc vs
  registry contradiction, and local reference doc edits.

### 8. Storage Layout And Concurrency Are Decision Blockers

The final proposal still leaves `.rms/` layout, registry versions, snapshots,
locks, and local kernel storage open. That blocks safe implementation because
event sourcing without concurrency rules is only partial event sourcing.

Required fix:

- Define run directory layout.
- Define registry version pinning per run.
- Define snapshot rebuild rules from events.
- Define lock acquisition and stale lock recovery.
- Define concurrent session behavior.
- Define append failure behavior.
- Define whether snapshots are disposable projections or required recovery
  artifacts.

### 9. Non-Development Import Boundary Is Still Too Soft

The proposal says inactive artifacts become `candidate_evidence` until imported
by active transition. That is the right direction, but still incomplete.

Required fix:

- Define `candidate_evidence` schema.
- Define import event type.
- Define who can import inactive artifacts.
- Define freshness and trust level for imported artifacts.
- Define what happens when an inactive architecture proposal conflicts with
  active registry policy.
- Add a fixture where an architecture doc produced outside the pipeline is
  rejected as authoritative evidence until imported through Cadrage or
  Conception.

### 10. Human Checkpoint Semantics Are Not Hard Enough

Critical risk requires human-visible validation, but the proposal does not
define a checkpoint record shape, approval scope, expiry, signer identity,
rejection handling, or ambiguity policy beyond prose.

Required fix:

- Define `HumanCheckpoint` schema.
- Require explicit decision, risk class, residual gaps, allowed next action,
  expiry, actor identity, and evidence refs.
- Add fixtures for vague approval, expired approval, approval for wrong action,
  and rejected checkpoint.

## Representative Implementation Simulations

### Simulation A: `rms.transition` For M-Risk Build Write With Codex Hooks Disabled

Expected by proposal: block or declared fallback.

Problem: the proposal does not yet define the exact binding-set contract,
fallback eligibility, or transaction fallback. Older runtime docs allow
fail-open hook behavior.

Result: implementer must guess. Block implementation.

### Simulation B: `rms.close_run(DONE_VERIFIED)` After A Subagent Result Arrives Late

Expected by proposal: closed runs immutable except append audit; conflicted or
stale evidence blocks verified closure.

Problem: no concrete event type, evidence freshness invalidation rule, or
reopen/correction protocol exists.

Result: implementer must invent late-evidence behavior. Block implementation.

### Simulation C: Installed `pfv4-stop-gate` Differs From Repository Source

Expected by proposal: drifted core skill cannot become authority.

Problem: no manifest, hash check, install sync rule, or drift severity is
defined.

Result: implementer must invent drift detection. Block implementation.

## Decision Blockers Before Implementation

Implementation should wait until these artifacts exist:

1. Supersession ADR for V2 and older implementation-ready specs.
2. `PFV4-OD-*` decision-delta table.
3. `.rms/` storage layout with locks, snapshots, registry versions, and replay.
4. Registry split for transitions, guards, policies, evidence, runtime
   bindings, territory, final states, and lens mapping.
5. Guard merge algorithm with deterministic precedence.
6. Evidence requirement schema and freshness invalidation rules.
7. Convergence thresholds and loop detection fixtures.
8. Runtime Binding Set schema with hard-gate degradation rules.
9. Skill/subagent/reference doc artifact manifest and drift policy.
10. Closing protocol and late-evidence/reopen protocol.
11. Human checkpoint schema.
12. Acceptance fixtures for every edge case in `02-edge-case-red-team.md`.

## Readiness Rating

```text
Architecture direction: accepted
Implementation contract: rejected
Cycle 02 status: continue contract design
Implementation handoff: blocked
```

## Recommended Cycle 02 Integration Position

Cycle 02 should not reopen the architecture choice unless new evidence
invalidates the hybrid kernel. The useful next move is to convert the hybrid
choice into hard contracts.

Recommended integration language:

```text
Cycle 02 confirms Candidate C as the architecture direction, but rejects
implementation handoff until the kernel/MCP fallback boundary, guard merge
algorithm, storage layout, evidence schema, runtime degradation policy, and
artifact drift controls are executable and fixture-backed.
```
