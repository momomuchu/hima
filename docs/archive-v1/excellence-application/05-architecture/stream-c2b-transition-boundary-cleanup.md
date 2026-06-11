---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-06-stream-c2b-transition-boundary-cleanup
deliverable: C6-5
---

# Stream C2b Transition Boundary Cleanup

## Decision

Cycle-06 makes the remaining C2 boundary explicit without changing runtime behavior:

- Run owns transition orchestration through `RunAggregate.transition(...)`.
- Cycle owns transition target resolution, validation, state transition calculation, and DoR/DoD
  governance through `packages/core/src/domain/cycle/transition-policy.ts`.
- `packages/core/src/state-machine/transition.ts` remains only as a compatibility export for the
  existing public API surface.

This closes the ambiguity found after C2a: `transition.ts` no longer reads as the owner of Run
orchestration, and Run does not absorb Cycle legality.

## Code Map

| File | Owner | Role |
|---|---|---|
| `packages/core/src/domain/run/run-aggregate.ts` | Run | Coordinates project loading, Cycle policy calls, state/route persistence, run-set event append, event-log append, and ledger append. |
| `packages/core/src/domain/cycle/transition-policy.ts` | Cycle | Owns transition request types, current/target position resolution, validation, transition state calculation, and DoR/DoD governance evaluation. |
| `packages/core/src/state-machine/transition.ts` | Cycle compatibility | Re-exports the Cycle transition policy to preserve existing imports. |
| `packages/core/src/services/request-transition.ts` | Run application service | Stable public service delegating to `transitionRun`. |

## Behavior Preservation

The C2b move is mechanical boundary cleanup. It keeps the public `requestTransition(...)` result
shape and side effects from C2a:

- state snapshot updates remain identical;
- run-set route and event updates remain identical;
- event-log and ledger append behavior remains identical;
- terminal implicit transition failures still happen before writes;
- DoR/DoD governance errors still come from Cycle-owned policy.

## Verification Evidence

Required closure evidence:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

The file inventory must also prove that the C1 CSV includes the new Cycle boundary files and the
compatibility export.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A future change adds transition legality, target resolution, or DoR/DoD governance to `RunAggregate.transition`.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/domain/cycle/transition-policy.ts
  on-fail: Reopen Stream C2 and move legality back behind the Cycle boundary before C3-C7 continue.
```
