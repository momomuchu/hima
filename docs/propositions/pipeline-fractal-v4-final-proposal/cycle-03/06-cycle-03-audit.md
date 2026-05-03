# 06 - Cycle 03 Audit

Status: Cycle 03 red-team audit

## Verdict

```text
Architecture direction: accepted
Cycle 03 contract progress: partial
Schema-first implementation planning: blocked
Readiness: 6/10
```

Cycle 03 closes several contracts that were real blockers after Cycle 02:
supersession, guard merge, evidence freshness, risk/runtime degradation,
artifact drift, subagent intake, human checkpoints and candidate evidence import.

It still does not pass the Cycle 03 stop rule. The brief says any remaining
`still_blocking` P0 keeps implementation handoff blocked. The package still
lacks complete executable contracts for convergence thresholds, territory
enforcement, storage recovery and final closing transactions.

## Critical Findings

### 1. PFV4-OD-007 Convergence Thresholds Remain Blocked

Cycle 03 proves that convergence is not max attempts, but it does not define the
actual convergence policy contract.

Evidence:

- `01-supersession-and-decision-delta.md` still marks PFV4-OD-007
  `still_blocking`.
- `02-guard-merge-lattice.md` can return `reroute` for repeated loops, but it
  depends on convergence overlay facts from another engine.
- `03-evidence-requirements-freshness.md` explicitly says it does not close
  convergence thresholds.

Required remaining artifact:

- `policies/convergence-policy.yaml` contract;
- convergence schema for sample windows, score caps and repeated-pattern
  detection;
- fixture pack for converging, flat, oscillating, diverging, loop and reroute
  outcomes.

### 2. PFV4-OD-012 Territory Enforcement Remains Blocked

Guard merge names `territory_guard` dimensions and fixtures, but no Cycle 03
artifact defines the full territory registry, path/tool/action schema or risk
legality matrix.

Evidence:

- `01-supersession-and-decision-delta.md` still marks PFV4-OD-012
  `still_blocking`.
- `02-guard-merge-lattice.md` requires `macro_cycle`, `cycle_substate`, `tool`,
  `action_type` and `target_path`, but does not define the territory overlay
  registry itself.
- `04-risk-runtime-degradation.md` covers runtime degradation but not territory
  ownership, path classification or target expansion.

Required remaining artifact:

- territory overlay registry contract;
- path/tool/action schema;
- ownership/territory classification rules;
- degraded territory fallback legality fixtures by risk.

### 3. PFV4-OD-013 Closing Protocol Remains Blocked

Cycle 03 now has evidence, human checkpoint and runtime pieces, but `rms.close_run`
is not yet a full transaction contract.

Evidence:

- `01-supersession-and-decision-delta.md` still marks PFV4-OD-013
  `still_blocking`.
- `03-evidence-requirements-freshness.md` says reopen/correction is not part of
  the evidence evaluator.
- `04-risk-runtime-degradation.md` defines blocked final state payloads but does
  not define the closing transaction order.
- `05-artifact-human-candidate-evidence.md` defines checkpoint/import events,
  but they only feed closing; they do not close the run by themselves.

Required remaining artifact:

- `policies/closing-policy.yaml` contract;
- `rms.close_run` transaction protocol;
- final-state eligibility matrix;
- late evidence reopen/correction protocol.

### 4. Storage Recovery Remains Blocked

Cycle 02 defined transaction order and fail-closed storage principles, but Cycle
03 did not add the recovery fixture pack that Cycle 02 integration required.

Evidence:

- `cycle-02/07-cycle-02-integration.md` lists storage recovery as a P0 blocker:
  pending transaction, stale lock, corrupt snapshot and append failure.
- `cycle-03/01-supersession-and-decision-delta.md` imports storage layout but
  does not close recovery fixtures.

Required remaining artifact:

- pending transaction recovery matrix;
- stale lock recovery rules;
- corrupt snapshot replay rules;
- partial append and append failure fixtures;
- startup integrity state machine.

### 5. Cycle 03 Integration Is Still Missing

The brief names `07-cycle-03-integration.md` as the decision point. It does not
exist yet, so the cycle cannot claim a final integrated verdict.

Required remaining artifact:

- `07-cycle-03-integration.md` that either authorizes schema-first planning or
  opens Cycle 04 on only the remaining blocker set.

## Cycle 02 Blocker Status

| Cycle 02 blocker | Cycle 03 status | Audit note |
|---|---|---|
| Supersession hard ADR | `closed_by_contract` | `01-supersession-and-decision-delta.md` defines authority order and source status. |
| MCP fallback boundary | `closed_by_contract` | Kernel/local transaction/MCP authority is clarified, but storage recovery remains separate. |
| Guard merge prose | `closed_by_contract` / `closed_by_fixture` | `02-guard-merge-lattice.md` defines total order, weakening and GM fixtures. |
| Evidence freshness abstract | `closed_by_contract` / `closed_by_fixture` | `03-evidence-requirements-freshness.md` defines schemas, invalidation graph and EVREQ fixtures. |
| Risk classifier not mechanized | `closed_by_contract` | `04-risk-runtime-degradation.md` defines forcing signals and downgrade/promotion rules. |
| Runtime degradation fail-open risk | `closed_by_contract` / `closed_by_fixture` | `04-risk-runtime-degradation.md` defines Binding Set fields and fail-closed fixtures. |
| Artifact drift control | `closed_by_contract` / `closed_by_fixture` | `05-artifact-human-candidate-evidence.md` defines manifest, drift policy and fixtures. |
| Human checkpoint hardness | `closed_by_contract` / `closed_by_fixture` | `05-artifact-human-candidate-evidence.md` defines HumanCheckpoint schema and legality. |
| Non-development import | `closed_by_contract` / `closed_by_fixture` | `05-artifact-human-candidate-evidence.md` defines CandidateEvidence import. |
| Storage recovery fixture pack | `still_blocking` | Cycle 03 does not define recovery fixtures. |

## PFV4-OD Status

| Decision | Current status | Reason |
|---|---|---|
| PFV4-OD-001 | `closed_by_contract` | Semantic substates plus derived lens are fixed. |
| PFV4-OD-002 | `closed_by_contract` | Directed transition graph is fixed. |
| PFV4-OD-003 | `closed_by_fixture` | CandidateEvidence import lane closes non-development import behavior. |
| PFV4-OD-004 | `closed_by_contract` | Activation readiness shape is fixed enough for schema planning. |
| PFV4-OD-005 | `closed_by_contract` | T/F/M/E/C supervision defaults and checkpoint boundary are fixed. |
| PFV4-OD-006 | `closed_by_contract` | Forcing-signal classifier and downgrade/promotion rules are defined. |
| PFV4-OD-007 | `still_blocking` | Convergence thresholds and policy contract are absent. |
| PFV4-OD-008 | `closed_by_contract` | EvidenceRequirement, freshness graph and status derivation are defined. |
| PFV4-OD-009 | `closed_by_contract` | Binding Set degradation rules are defined. |
| PFV4-OD-010 | `closed_by_contract` | Guard registry split and merge lattice are defined. |
| PFV4-OD-011 | `closed_by_contract` | English ASCII executable identifiers are fixed. |
| PFV4-OD-012 | `still_blocking` | Territory overlay registry and path/tool/action schema are absent. |
| PFV4-OD-013 | `still_blocking` | Closing transaction, closing policy and reopen/correction are absent. |

## Implementation Simulations

### Simulation A - Stale Evidence After Route Change

Expected result: closed.

Cycle 03 evidence requirements handle this through freshness selectors,
route invalidation and EVREQ fixtures. The evaluator can block `DONE_VERIFIED`
when proof predates the latest route event.

### Simulation B - M-Risk Audit-Only Runtime Fallback

Expected result: closed.

Cycle 03 risk/runtime rules block audit-only fallback for M hard gates and
allow `BLOCKED_RUNTIME_MISSING` as a valid stop.

### Simulation C - Core Skill Hash Drift

Expected result: closed.

Cycle 03 artifact manifest and drift policy block core skill auto-invocation
when installed hash or schema differs from registry.

### Simulation D - Vague E-Risk Human Approval

Expected result: closed.

Cycle 03 HumanCheckpoint schema rejects vague approval and requires decider,
scope, allowed action, target refs, evidence refs and expiry.

### Simulation E - Repeated Validation Loop Without New Evidence

Expected result: still blocked.

Guard merge can produce `reroute`, but there is no convergence policy that
defines the repeated-pattern thresholds, sampling windows, score caps or loop
criteria that trigger the overlay.

### Simulation F - Path Outside Declared Scope

Expected result: still blocked.

Guard merge includes a territory fixture for path outside scope, but there is no
territory registry contract defining path classification, tool/action classes,
ownership expansion or risk-specific degraded legality.

### Simulation G - Event Append Failure During Final Commit

Expected result: still blocked.

Guard merge says append failure blocks, evidence says late evidence cannot
mutate closure, and storage layout says append must precede projections. The
missing piece is a concrete `rms.close_run` transaction contract and recovery
matrix when close partially fails.

## Remaining Artifacts

Cycle 04 should target only these artifacts:

1. `01-convergence-policy-thresholds.md`
   - `policies/convergence-policy.yaml`;
   - sample windows, progress signals, divergence signals, score caps;
   - fixtures for flat, oscillating, diverging, converging and verified.
2. `02-territory-enforcement-contract.md`
   - territory overlay registry;
   - path/tool/action schema;
   - ownership and target expansion rules;
   - degraded territory fallback legality fixtures by risk.
3. `03-storage-recovery-contract.md`
   - pending transaction recovery;
   - stale locks;
   - corrupt snapshots;
   - replay vs snapshot winner;
   - partial append and append failure handling.
4. `04-closing-transaction-reopen.md`
   - `policies/closing-policy.yaml`;
   - `rms.close_run` transaction order;
   - final-state eligibility matrix;
   - late evidence audit, reopen and correction flow.
5. `05-cycle-04-audit.md`
   - strict red-team pass against this audit.
6. `06-cycle-04-integration.md`
   - schema-first implementation planning verdict.

## Audit Conclusion

Cycle 03 is valuable but not complete. It reduced the blocker set from broad
architecture uncertainty to four concrete executable-contract gaps.

The correct next move is Cycle 04, scoped only to:

```text
convergence policy
territory enforcement
storage recovery
closing transaction and reopen/correction
```

Implementation handoff remains blocked.
