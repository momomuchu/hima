# 05 - Cycle 04 Audit

Status: Cycle 04 red-team audit

## Verdict

```text
Cycle 04 contract progress: pass
Schema-first implementation planning: authorized
Readiness rating: 8.6/10
Final verdict: PASS
```

Cycle 04 closes the four remaining Cycle 03 blockers at the level needed to
start schema-first implementation planning. It does not prove implementation
correctness, because no concrete JSON Schemas, YAML registry files or runtime
tools exist yet. It does, however, define enough executable contract shape,
ordering rules, fail-closed defaults and fixture families for implementation
planning to begin without inventing core semantics.

The audit passes because the Cycle 04 files convert the previous blockers into
schema and test obligations:

- convergence now has policy placement, sample windows, score formula, caps,
  status derivation and loop fixtures;
- territory now has registry placement, request dimensions, target
  classification, owned scopes, risk legality and fallback fixtures;
- storage recovery now has integrity states, transaction recovery, stale locks,
  corrupt snapshot replay, append failure and replay fixtures;
- closing now has closing policy placement, `rms.close_run` transaction order,
  final-state eligibility, late evidence, reopen/correction and close fixtures.

## Critical Findings

### 1. No Remaining P0 Blocker Prevents Schema-First Planning

Cycle 03 blocked implementation handoff because PFV4-OD-007, PFV4-OD-012,
PFV4-OD-013 and storage recovery lacked executable contracts. Cycle 04 supplies
those missing contracts and fixture families.

Evidence:

- `01-convergence-policy-thresholds.md` defines
  `policies/convergence-policy.yaml`, route-partitioned sample windows, score
  caps, repeated pattern detection and `CONV-001` through `CONV-014`.
- `02-territory-enforcement-contract.md` defines
  `guards/territory-overlays.yaml`, `TerritoryRequest`, target classification,
  risk legality and `VF-TERR-001` through `VF-TERR-010`.
- `03-storage-recovery-contract.md` defines startup integrity, pending
  transaction recovery, stale lock recovery, corrupt snapshot replay, partial
  append handling and `SR-001` through `SR-015`.
- `04-closing-transaction-reopen.md` defines `policies/closing-policy.yaml`,
  `rms.close_run`, final records, accepted gaps, blocked final records,
  late-evidence handling, reopen/correction and `VF-CLOSE-001` through
  `VF-CLOSE-015`.

Red-team conclusion: the blocker class has changed from "missing architecture
contract" to "must implement schemas and tests exactly." That is sufficient for
schema-first planning.

### 2. Closing Still Contains The Highest Implementation Risk

PFV4-OD-013 is closed for planning, but the close path is the densest contract:
it composes evidence, convergence, runtime, territory, human checkpoints,
registry freshness, storage integrity, idempotency and late evidence under one
transaction.

Risk:

- transaction steps 7 through 14 in `04-closing-transaction-reopen.md` append
  candidate, reevaluate selectors, append closing and then append `RUN_CLOSED`;
- storage recovery says event append must precede projection and pending
  transactions block governed transitions;
- late evidence before closure can invalidate evidence or convergence between
  candidate and `RUN_CLOSED`.

Audit decision: not a P0 blocker because the order is explicit and fixtures
cover append failure, stale evaluation, idempotency and protected mutation. It
is a P1 implementation risk that must drive the first schema/test slice.

### 3. Territory Depends On Precise Target Expansion From Runtime Adapters

PFV4-OD-012 is closed by contract, but implementation can fail open if
multi-target shell commands or generated paths are not expanded before action.

Risk:

- `02-territory-enforcement-contract.md` requires `target_expansion` for
  multi-target tools and blocks unknown expansion for governed writes;
- shell commands can hide write targets behind script behavior or glob
  expansion;
- unknown target is allowed only for read-only classification probes.

Audit decision: not a P0 blocker because the contract fails closed with
`TARGET_UNKNOWN` or `TARGET_EXPANSION_UNKNOWN`. Schema-first planning must
include explicit adapter capability schemas for target expansion.

### 4. Storage Recovery Correctly Refuses Magical Repair

The storage contract closes the recovery blocker by making replay authoritative
and refusing to rewrite committed event lines. This is strict enough for
planning, but it means MVP behavior will intentionally block some cases rather
than repair them.

Risk:

- tail partial append may either block or quarantine under configured repair
  policy;
- invalid JSONL before later lines blocks replay past corruption;
- digest chain breaks block automatic repair;
- blocked corrupt logs may prevent even blocked final-state commits if no safe
  append point exists.

Audit decision: acceptable. A fail-closed MVP is safer than a recovery system
that silently edits history. The schema plan must distinguish automatic
recovery fixtures from operator/admin repair fixtures.

### 5. Convergence Is Now Deterministic, But Component Scoring Needs Exact Test Data

PFV4-OD-007 is closed by contract, but component score derivation still needs
implementation fixtures with concrete numeric inputs, not only expected
statuses.

Risk:

- the policy defines component weights and caps, but some component derivation
  rules are qualitative, such as "improves as P0/P1 counts decrease";
- `UNKNOWN` scores `0.00` for `DONE_VERIFIED`, so incomplete data can block
  final success unexpectedly;
- route resets stale prior convergence evaluations.

Audit decision: not blocking. The cap/status rules are explicit enough for
schema-first planning, and the first test pack should pin numeric component
normalization.

## Blocker Closure Map

| Blocker | Cycle 03 status | Cycle 04 audit status | Closure basis | Fixture basis | Audit note |
|---|---|---|---|---|---|
| PFV4-OD-007 convergence policy | `still_blocking` | `closed_by_contract` and `closed_by_fixture` | Policy schema, sample windows, score formula, caps, repeated patterns and status derivation are defined. | `CONV-001` through `CONV-014`. | No P0 remains; numeric component normalization is P1 implementation detail. |
| PFV4-OD-012 territory enforcement | `still_blocking` | `closed_by_contract` and `closed_by_fixture` | Territory registry, `TerritoryRequest`, target classification, owned scopes, risk legality and fallback rules are defined. | `VF-TERR-001` through `VF-TERR-010`. | No P0 remains; runtime target expansion capability must be schema-tested. |
| PFV4-OD-013 closing transaction | `still_blocking` | `closed_by_contract` and `closed_by_fixture` | Closing policy, `rms.close_run`, final records, accepted gaps, late evidence, reopen/correction and immutability are defined. | `VF-CLOSE-001` through `VF-CLOSE-015`. | No P0 remains; highest P1 integration risk. |
| Storage recovery | `still_blocking` | `closed_by_contract` and `closed_by_fixture` | Startup integrity state machine, pending transaction recovery, stale locks, snapshots, partial append, digest chain and concurrent writer rules are defined. | `SR-001` through `SR-015`. | No P0 remains; operator/admin repair CLI remains outside schema-first blocker scope. |

## Implementation Simulations

### Simulation 1 - Verified Convergence Allows Close Path To Continue

Input: four fresh samples in one route partition, evidence `verified`, capped
score above `0.85`, no caps, no repeated pattern.

Expected result: pass.

Cycle 04 result: `CONV-009` derives `verified` and allows guard overlay. Closing
still has to check evidence, runtime, territory and storage. This closes the
Cycle 03 gap where convergence was not distinguishable from max attempts.

### Simulation 2 - Not Enough Samples Blocks `DONE_VERIFIED`

Input: one high-scoring sample, evidence `verified`, final candidate
`DONE_VERIFIED`.

Expected result: block.

Cycle 04 result: `CONV-001` returns `not_sampled` and blocks final success. High
score cannot bypass sample minimums. This is fail-closed and implementation
ready.

### Simulation 3 - Repeated Validation Failure Becomes Loop/Reroute

Input: same validation failure pattern repeats three times with the same
hypothesis and no fresh expected signal.

Expected result: block current route or reroute.

Cycle 04 result: `CONV-004` classifies oscillation and records
`LOOP_DETECTED`; closing can use `LOOP_DETECTED` as a blocked final state with
block evidence. This closes PFV4-OD-007 for loop semantics.

### Simulation 4 - Path Outside Active Territory Scope

Input: route owns one Cycle 04 file, actor attempts to write another Cycle 04
file with a blocking runtime binding.

Expected result: block.

Cycle 04 result: `VF-TERR-001` classifies the target as docs but outside the
owned scope, returns `OWNED_SCOPE_MISMATCH` or `TERRITORY_DENIED`, and prevents
runtime allow from weakening the territory block. This closes the Cycle 03
territory registry gap.

### Simulation 5 - Unknown Shell Write Target

Input: governed write through shell command with `target_path=UNKNOWN` and
`target_expansion=UNKNOWN`.

Expected result: block.

Cycle 04 result: `VF-TERR-002` blocks with `TARGET_UNKNOWN` or
`TARGET_EXPANSION_UNKNOWN`. The contract does not infer write legality from
intent prose. This is the correct red-team behavior for hidden shell writes.

### Simulation 6 - M-Risk Audit-Only Fallback For Source Write

Input: M-risk source write inside owned scope, runtime binding only supports
post-action audit.

Expected result: block.

Cycle 04 result: `VF-TERR-008` blocks M governed writes without pre-action or
native-equivalent enforcement. This composes correctly with Cycle 03 runtime
degradation and prevents `DONE_VERIFIED`.

### Simulation 7 - Pending Transaction After Append Before Snapshot

Input: pending intent exists, intended event is in the event log, manifest and
snapshot still point to the previous digest.

Expected result: recovery succeeds without duplicate domain event.

Cycle 04 result: `SR-002` replays through the intended event, rebuilds
snapshots, updates manifest and moves the transaction to committed. This closes
the previous recovery ambiguity.

### Simulation 8 - Tail Partial Append During Final Commit

Input: final close append fails with an incomplete tail line and pending close
intent.

Expected result: no final state is authoritative.

Cycle 04 result: `SR-008`, `SR-014` and `VF-CLOSE-006` agree that partial tail
is not committed, `RUN_CLOSED` absence means no final mutation, and recovery
uses pending transaction evidence. This closes storage plus closing append
failure behavior.

### Simulation 9 - Corrupt Snapshot Claims Closure Without `RUN_CLOSED`

Input: snapshot says `DONE_VERIFIED` and closed, but replay has no
`RUN_CLOSED`.

Expected result: replay wins; final claim rejected.

Cycle 04 result: `SR-007` discards the snapshot claim and rebuilds from replay.
Closing contract also says `RUN_CLOSED` is the first authoritative final event.
This blocks snapshot-only closure.

### Simulation 10 - `RUN_CLOSED` Appended But Snapshot Publish Fails

Input: `RUN_CLOSED` is durably appended, closed snapshot publish fails.

Expected result: close remains authoritative and recovery rebuilds projection.

Cycle 04 result: `VF-CLOSE-007` and storage recovery final-state implications
agree that event log authority survives projection failure. This is a correct
event-sourced close.

### Simulation 11 - Late Evidence Before Closure Invalidates Success

Input: evidence evaluation says verified, then late failing evidence is recorded
before `RUN_CLOSED`, while close is in progress.

Expected result: block and require re-evaluation.

Cycle 04 result: `VF-CLOSE-008` detects material evidence after the supplied
evaluation, prevents `RUN_CLOSED`, and returns a re-evaluation action. This
composes with Cycle 03 evidence freshness.

### Simulation 12 - Late Evidence After Closure Requests Final-State Rewrite

Input: run is closed as `DONE_VERIFIED`; later failing evidence asks to mutate
final state to `DONE_WITH_GAPS`.

Expected result: protected mutation blocks; append-only audit or correction
candidate may be recorded.

Cycle 04 result: `VF-CLOSE-009` and `VF-CLOSE-010` reject protected mutation,
preserve the historical final state and allow correction overlay/follow-up run.
This closes reopen/correction semantics without in-place rewrite.

### Simulation 13 - Cross-Boundary Final Close With Territory Violation

Input: evidence and convergence are verified, storage is healthy, but the final
territory decision records a governed write outside owned scope.

Expected result: success final states block.

Cycle 04 result: territory produces a hard block, and closing policy requires
`territory_blockers: none` for `DONE_VERIFIED` plus no governed target blockers
for `DONE_WITH_GAPS`. Correct final state is blocked or reroute, not success.

### Simulation 14 - Storage Integrity Failure With Otherwise Verified Work

Input: evidence `verified`, convergence `verified`, runtime and territory clean,
but unresolved pending transaction exists.

Expected result: block success close.

Cycle 04 result: `SR-003`/storage final-state rules and `VF-CLOSE-014` block
success final states until storage recovery resolves the pending transaction.
This prevents final snapshots from advancing ahead of event replay.

## Remaining Blockers

No remaining P0 blockers prevent schema-first implementation planning.

Remaining non-blocking implementation obligations:

1. Create concrete JSON Schemas for every conceptual schema named in Cycle 04.
2. Convert fixture families into executable schema tests before runtime code.
3. Pin numeric normalization for convergence component scores.
4. Define runtime adapter capability schemas for target expansion and
   pre-action territory enforcement.
5. Separate automatic storage recovery tests from operator/admin repair tests.
6. Implement `rms.close_run` before any alternative component can write
   protected final fields.

These obligations are implementation-planning inputs, not reasons to run Cycle
05.

## Stop Rule Evaluation

| Cycle 04 stop condition | Audit result |
|---|---|
| PFV4-OD-007 is no longer `still_blocking`. | Pass: `closed_by_contract` and `closed_by_fixture`. |
| PFV4-OD-012 is no longer `still_blocking`. | Pass: `closed_by_contract` and `closed_by_fixture`. |
| PFV4-OD-013 is no longer `still_blocking`. | Pass: `closed_by_contract` and `closed_by_fixture`. |
| Storage recovery is no longer a P0 blocker. | Pass: `closed_by_contract` and `closed_by_fixture`. |
| Every closed claim has at least one fixture family. | Pass: convergence, territory, storage and closing all have fixture packs. |
| Audit explicitly passes. | Pass. |

## Readiness Rating

```text
Architecture authority: 0.94
Convergence policy: 0.84
Territory enforcement: 0.84
Storage recovery: 0.86
Closing transaction: 0.82
Fixture coverage: 0.88
Cross-contract composition: 0.84

effective readiness: 0.86
implementation handoff cap: removed
```

The rating is not higher because the contracts remain proposal documents rather
than concrete schema files and executable tests. The handoff cap is removed
because the remaining work is exactly schema-first implementation planning.

## Final Decision

```text
Final verdict: PASS
Schema-first implementation planning: START
Cycle 05 required: no
```

Cycle 04 closes the remaining blockers from Cycle 03. The next artifact should
be `06-cycle-04-integration.md`, authorizing schema-first implementation
planning with the non-blocking obligations above carried into the first schema
and fixture milestones.
