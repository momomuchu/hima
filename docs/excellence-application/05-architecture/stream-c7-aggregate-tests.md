---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-11-stream-c7-aggregate-tests
deliverable: C11-4
---

# Stream C7 Aggregate-Style Tests

## Decision

Cycle-11 makes Run-owned transition and invariant behavior explicit in the test suite by exercising
`RunAggregate.load(...).transition(...)` directly for aggregate behavior. The public
`requestTransition(...)` service remains covered by a narrow delegation smoke test.

No production behavior changed in this cycle. Repository tests remain adapter-focused, and storage
compatibility assertions remain where they prove event-log and ledger projections.

## Test Ownership

| Test surface | Owner | C7 shape |
|---|---|---|
| `packages/core/test/request-transition.test.ts` | Run aggregate | Transition persistence, governance payloads, redaction, invariant rejection, and no-partial-write behavior use `RunAggregate.transition`. |
| `packages/core/test/request-transition.test.ts` | Application service | One public API smoke test keeps `requestTransition` delegation covered. |
| `packages/core/test/run-repository.test.ts` | Repository | Adapter read/write/append behavior remains storage-boundary coverage, not aggregate behavior. |
| Event-log and ledger assertions | Evidence/storage compatibility | Kept in aggregate transition tests only where they prove existing projections are preserved. |

## Coverage Preserved

C7 preserves coverage for:

- state and route persistence;
- transition event payloads and redaction;
- failed implicit terminal transitions without partial writes;
- Run invariant rejection before persistence;
- macro-cycle governance payloads;
- event-log projection entries;
- hash-chained ledger entries.

## Non-Responsibilities

C7 does not:

- move Cycle transition legality into Run;
- move Gate or Evidence policy into Run tests;
- remove storage compatibility coverage;
- start Stream D implementation;
- introduce production behavior changes.

## Verification Evidence

The suite gains one test: a narrow public-service delegation smoke test separated from the
aggregate-owned behavior assertions. Aggregate behavior coverage remains in the existing transition
and invariant tests.

Required closure commands:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: Run-owned transition behavior is primarily asserted through requestTransition service mechanics instead of RunAggregate behavior.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/request-transition.test.ts
  on-fail: Reopen Stream C7 and restore aggregate-owned behavior tests before Stream D continues.
```
