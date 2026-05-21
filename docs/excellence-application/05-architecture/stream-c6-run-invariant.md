---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-10-stream-c6-run-invariant
deliverable: C10-4
---

# Stream C6 Run Always-Valid Invariant

## Decision

Cycle-10 introduces a Run-owned invariant guard at aggregate/finalization persistence boundaries.
`RunAggregate.transition(...)` validates the project it is about to save before any repository
write occurs, and close finalization validates the Run-owned `DONE_VERIFIED` evidence invariant
before persisted finalization writes occur.

The invariant is intentionally local to Run state consistency. It does not move Cycle transition
legality, Gate policy, Evidence event taxonomy, repository storage mechanics, or convergence
evaluation into the aggregate.

## Invariant

Before a Run aggregate save:

- `state.run_id`, `currentRisk.run_id`, and `runSet.runId` must identify the same run;
- `runSet.route.phase` must match `state.phase`;
- `runSet.route.subPhase` must match `state.sub_phase`, using `Observer` for nullable state;
- `currentRisk.rank` must match the canonical rank for `currentRisk.risk_class`;
- active state must not be paired with a non-`ACTIVE` finalization state.
- `DONE_VERIFIED` finalization requires an evidence set sufficient for `currentRisk.risk_class`.

`runSet.route.mode` and `runSet.route.riskClass` remain compatibility projections and may differ
from `state.mode` or `currentRisk` in existing transition fixtures; C6 does not tighten that
behavior.

## Non-Responsibilities

The Run invariant does not:

- decide whether a transition is legal;
- evaluate DoR/DoD;
- evaluate hook or gate policy;
- decide evidence sufficiency;
- rewrite service-layer APIs;
- migrate all tests to aggregate-style assertions.

## Verification Evidence

Focused tests cover:

- invalid current-risk rank mismatch is rejected before aggregate persistence;
- `DONE_VERIFIED` without sufficient evidence is rejected by the Run invariant guard;
- the invalid fixture remains unchanged after rejection;
- existing transition tests remain green for valid aggregate persistence.

Required closure commands:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: RunAggregate can persist a project whose state, route, and current risk disagree.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/domain/run/run-invariant.ts
  on-fail: Reopen Stream C6 and restore aggregate invariant tests before C7 continues.
```
