---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-05-stream-c2-run-aggregate-transition-facade
deliverable: C5-4
---

# Stream C2 Run Aggregate Transition Facade

## Decision

Cycle-05 introduces `RunAggregate.transition(...)` as the Run-owned orchestration boundary for
transition requests. The public `requestTransition(...)` service remains the external API and now
delegates to the Run facade. This completes the first C2 facade slice, not the whole Stream C2
refactor.

This is the first safe C2 slice only. It does not authorize C3-C7 value-object, repository, event
taxonomy, or invariant refactors.

## Ownership Mapping

| Concern | Owner after C2 slice | Evidence |
|---|---|---|
| Transition orchestration | Run | `packages/core/src/domain/run/run-aggregate.ts` loads the planning project, calls Cycle legality/governance functions, persists state/route, and appends event/ledger records. |
| Transition legality | Cycle | `packages/core/src/state-machine/transition.ts` still owns `evaluateTransitionGovernance`, `transitionPlanningState`, target resolution, and transition validation. |
| Public application API | Run application service | `packages/core/src/services/request-transition.ts` remains the stable exported service and delegates to `transitionRun`. |
| Evidence side effects | Evidence substrate through Run orchestration | Event-log and ledger appenders remain in `packages/core/src/storage/events-log.ts` and `packages/core/src/storage/hash-chained-ledger.ts`; the Run facade calls them without owning evidence semantics. |
| File inventory | C1 context map | `docs/excellence-application/05-architecture/core-file-to-context.csv` now includes the two Run-owned facade files. |

## Characterization First

Before production code moved, `packages/core/test/request-transition.test.ts` gained a focused
characterization case for macro-cycle transition governance. It proves that a cross-cycle
transition propagates the same governance payload through:

- `runSet.events`
- `events.jsonl`
- the hash-chained ledger

The existing request-transition tests also continue to cover state persistence, route updates,
secret redaction, preservation of existing run-set data, no partial writes for failed implicit
terminal transitions, event-log appends, and ledger verification.

## Verification Evidence

Current required gate evidence for C2 closure:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

Cycle-05 saturation review closed the facade slice. Cycle-06 later closed the remaining C2b
transition boundary cleanup, so full Stream C2 is now represented by the C2a and C2b master-plan
checks.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A future refactor moves transition target resolution, transition validation, or DoR/DoD governance out of Cycle-owned code and into Run-owned orchestration.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/state-machine/transition.ts
  on-fail: Reopen cycle-05 and restore Cycle-owned transition legality before further Stream C movement.
```
