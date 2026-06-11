# 00 - Cycle 04 Brief

Status: active autonomous design cycle

## Purpose

Cycle 04 is a narrow blocker cycle. Cycle 03 closed most P0 contract gaps but
kept implementation handoff blocked on four executable-contract areas:

```text
convergence policy
territory enforcement
storage recovery
closing transaction and reopen/correction
```

This cycle must not reopen Candidate C, the authority order, the guard merge
lattice, evidence freshness, risk/runtime degradation, artifact drift, human
checkpoint semantics, or candidate evidence import unless one of the four
remaining blocker lanes proves a contradiction.

## Cycle Question

```text
Are the remaining blockers precise enough after Cycle 04 for schema-first
implementation planning to start?
```

## Inputs

- `../cycle-03/06-cycle-03-audit.md`
- `../cycle-03/07-cycle-03-integration.md`
- `../cycle-03/01-supersession-and-decision-delta.md`
- `../cycle-03/02-guard-merge-lattice.md`
- `../cycle-03/03-evidence-requirements-freshness.md`
- `../cycle-03/04-risk-runtime-degradation.md`
- `../cycle-03/05-artifact-human-candidate-evidence.md`
- `../cycle-02/04-registry-storage-layout.md`
- `../cycle-02/05-verification-fixtures.md`

## Required Lanes

| Lane | Output | Gate |
|---|---|---|
| Convergence policy | `01-convergence-policy-thresholds.md` | PFV4-OD-007 has thresholds, sample windows, score caps and fixtures. |
| Territory enforcement | `02-territory-enforcement-contract.md` | PFV4-OD-012 has territory registry, path/tool/action schema and risk legality fixtures. |
| Storage recovery | `03-storage-recovery-contract.md` | Event sourcing has pending transaction, stale lock, corrupt snapshot, replay and append-failure recovery rules. |
| Closing transaction | `04-closing-transaction-reopen.md` | PFV4-OD-013 has closing policy, `rms.close_run` transaction and late-evidence reopen/correction rules. |
| Audit | `05-cycle-04-audit.md` | Strict red-team verdict against Cycle 03 remaining blockers. |
| Integration | `06-cycle-04-integration.md` | Decide schema-first implementation planning or Cycle 05. |

## Stop Rule

Cycle 04 can authorize schema-first implementation planning only if:

- PFV4-OD-007 is no longer `still_blocking`;
- PFV4-OD-012 is no longer `still_blocking`;
- PFV4-OD-013 is no longer `still_blocking`;
- storage recovery is no longer a P0 blocker;
- every closed claim has at least one fixture family;
- the audit explicitly passes.

If any condition fails, Cycle 05 targets only the surviving blockers.
