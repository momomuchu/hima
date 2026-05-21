---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-09-stream-c5-run-repository
deliverable: C9-5
---

# Stream C5 Run Repository

## Decision

Cycle-09 introduces `RunRepository` as the Run-owned persistence adapter over the existing
planning-store functions. It is intentionally thin: it names the
Run persistence boundary without duplicating serialization, locking, validation, domain-event
mapping, or hash-chain behavior.

`RunAggregate.transition(...)` now loads and saves planning project state through the repository.
Transition legality remains Cycle-owned, and domain-event mapping remains in `domain/events.ts`.

## Boundary Mapping

| Concern | Owner after C5 | Evidence |
|---|---|---|
| Run project load/save | Run repository | `packages/core/src/repositories/run-repository.ts` delegates to `readPlanningProject` and `writePlanningProject`. |
| Run event append | Run repository | `RunRepository.appendRunEvent` delegates to the existing `planning-store.ts` append path, preserving run-set, event-log, and ledger writes. |
| Transition orchestration | Run aggregate | `packages/core/src/domain/run/run-aggregate.ts` uses `RunRepository` for persistence while still coordinating transition execution. |
| Transition legality | Cycle | `packages/core/src/domain/cycle/transition-policy.ts` still owns target resolution, validation, and governance checks. |
| Event taxonomy | Evidence event vocabulary | `packages/core/src/domain/events.ts` still maps legacy run-set projections to context-named domain events. |

## Non-Responsibilities

`RunRepository` must not:

- decide transition legality;
- evaluate gate policy;
- compute convergence or evidence sufficiency;
- define event names or owner metadata;
- enforce aggregate invariants beyond schema validation already performed by storage functions.

## Verification Evidence

Focused tests cover:

- repository load/save compatibility with existing planning-store files;
- repository event append compatibility across run-set, event-log, and ledger;
- existing transition tests remain green through the aggregate path that now uses the repository.

Required closure commands:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: RunRepository duplicates planning-store serialization/locking semantics or absorbs transition/gate business policy.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/repositories/run-repository.ts
  on-fail: Reopen Stream C5 and restore the repository to a thin adapter before C6-C7 continue.
```
