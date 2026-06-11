# 07 - Cycle 03 Integration

Status: Cycle 03 integrated verdict

## Verdict

Cycle 03 narrows the design substantially, but it does not authorize
schema-first implementation planning.

```text
Architecture direction: accepted
Supersession authority: closed
Guard merge: closed
Evidence freshness: closed
Risk/runtime degradation: closed
Artifact/human/candidate evidence: closed
Convergence policy: still_blocking
Territory enforcement: still_blocking
Storage recovery: still_blocking
Closing transaction: still_blocking
Implementation handoff: blocked
```

Cycle 03 should be considered a successful blocked cycle: it did the work of
removing false gaps, then exposed the remaining real gaps.

## What Changed Since Cycle 02

| Area | Cycle 02 status | Cycle 03 result |
|---|---|---|
| Supersession | Missing hard authority rule. | Closed by `01-supersession-and-decision-delta.md`. |
| Guard merge | Prose-level conflict handling. | Closed by `02-guard-merge-lattice.md`. |
| Evidence freshness | Abstract freshness labels. | Closed by `03-evidence-requirements-freshness.md`. |
| Risk classifier | Unmechanized forcing signals. | Closed by `04-risk-runtime-degradation.md`. |
| Runtime degradation | Fail-open risk remained. | Closed by `04-risk-runtime-degradation.md`. |
| Artifact drift | Named but not controlled. | Closed by `05-artifact-human-candidate-evidence.md`. |
| Human checkpoints | Too vague. | Closed by `05-artifact-human-candidate-evidence.md`. |
| Candidate evidence import | Too soft. | Closed by `05-artifact-human-candidate-evidence.md`. |
| Convergence thresholds | Still not executable. | Still blocking. |
| Territory enforcement | Guard dimensions named but no territory registry. | Still blocking. |
| Storage recovery | Transaction principles present but no recovery matrix. | Still blocking. |
| Closing protocol | Evidence/final pieces present but no close transaction. | Still blocking. |

## Current PFV4-OD Delta

| Status | Decisions |
|---|---|
| `closed_by_contract` | PFV4-OD-001, PFV4-OD-002, PFV4-OD-004, PFV4-OD-005, PFV4-OD-006, PFV4-OD-008, PFV4-OD-009, PFV4-OD-010, PFV4-OD-011 |
| `closed_by_fixture` | PFV4-OD-003 |
| `still_blocking` | PFV4-OD-007, PFV4-OD-012, PFV4-OD-013 |
| `deferred_out_of_mvp` | none |

The apparent mismatch between three still-blocking OD rows and four remaining
Cycle 04 targets is intentional. Storage recovery is not a separate PFV4-OD
row, but it is a P0 implementation blocker because event sourcing without
recovery rules is not safe enough to build.

## Readiness Score

Cycle 03 raises contract readiness but keeps the implementation cap.

| Dimension | Cycle 02 | Cycle 03 |
|---|---:|---:|
| Architecture authority | 0.90 | 0.94 |
| Supersession clarity | 0.45 | 0.86 |
| Guard algorithm | 0.46 | 0.86 |
| Evidence freshness | 0.55 | 0.84 |
| Risk/runtime degradation | 0.62 | 0.84 |
| Artifact/human/candidate control | 0.48 | 0.82 |
| Convergence policy | 0.50 | 0.55 |
| Territory enforcement | 0.46 | 0.54 |
| Storage recovery | 0.48 | 0.52 |
| Closing transaction | 0.52 | 0.58 |
| Implementation readiness | 0.58 | 0.68 |

```text
weighted readiness: 0.76
implementation handoff cap: 0.68
effective readiness: 0.68
```

The cap exists because `still_blocking` items remain. Cycle 04 must either close
them or keep the handoff blocked.

## Cycle 04 Scope

Cycle 04 must not reopen the entire proposal. It should target only:

1. convergence policy and thresholds;
2. territory enforcement contract;
3. storage recovery contract;
4. closing transaction and reopen/correction protocol.

Required files:

```text
cycle-04/00-cycle-04-brief.md
cycle-04/01-convergence-policy-thresholds.md
cycle-04/02-territory-enforcement-contract.md
cycle-04/03-storage-recovery-contract.md
cycle-04/04-closing-transaction-reopen.md
cycle-04/05-cycle-04-audit.md
cycle-04/06-cycle-04-integration.md
```

## Integrated Recommendation

Keep Candidate C and the Cycle 03 authority order.

Do not begin schema-first implementation planning yet. The next cycle should be
smaller, stricter and more test-shaped:

```text
If Cycle 04 closes convergence, territory, recovery and closing,
then schema-first implementation planning can start.
If any of those remain blocked,
Cycle 05 targets only the surviving blocker.
```
