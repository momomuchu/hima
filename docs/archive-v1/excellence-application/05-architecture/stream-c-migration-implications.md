---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-04-stream-c1-bounded-context-map
deliverable: C4-3
---

# Stream C Migration Implications

## C1 Output Summary

C1 defines six domain contexts for `packages/core/`: Run, Cycle, Gate, Skill, Subagent, and
Evidence. Current code is still service/module oriented; this document specifies how C2-C7
should use the C1 map without moving code prematurely.

## C2-C7 Implication Table

| Stream item | Implication from C1 | Required first proof |
|---|---|---|
| C2 — `Run` aggregate owns transitions | Move transition orchestration behind a Run aggregate method only after Cycle remains the owner of transition validity. `Run.transition(...)` should delegate lifecycle legality to Cycle and persistence to Run. | A characterization test showing `requestTransition` behavior is unchanged before extraction. |
| C3 — immutable value objects | Extract `RiskClass`, `SubPhase`, `OperatingMode`, and `GateType` from Shared Kernel only after their owning context is clear: `RiskClass` supports Gate, `SubPhase` supports Cycle, `OperatingMode` supports Run/Gate coordination, `GateType` supports Gate. | Type-level tests or unit tests proving invalid values are rejected at boundaries. |
| C4 — domain events emitted into events log | Events must be named by context: Cycle emits `TransitionRequested/Executed`, Gate emits `GateEvaluated`, Evidence emits `EvidenceAdded`, Run emits `RunClosed`, Subagent emits `SubagentLaunched/Returned`. | Event log test showing context-named events append without breaking ledger verification. |
| C5 — repositories over `planning-store.ts` | `planning-store.ts` is Run-owned today; repositories should be thin ports over Run persistence, not new owners. Evidence ledger/event appenders remain Evidence-owned. | Repository tests prove no domain decision moved into storage primitives. |
| C6 — always-valid invariant | `DONE_VERIFIED` invariant belongs to Run finalization but depends on Gate verdict and Evidence sufficiency. Do not bury it in `close-run.ts` alone. | Close-run tests assert insufficient Evidence blocks final verified state for M/H/C. |
| C7 — aggregate-style tests | Tests should assert behavior through aggregate/application boundaries rather than free-service internals, while preserving current gate/evidence characterization tests. | At least one transition test rewritten or wrapped at aggregate level without losing current request-transition assertions. |

## First Safe Refactor Step

The first safe C2 step is **characterization before extraction**:

1. Add a `Run` aggregate facade in a new module without moving existing logic.
2. Route one existing behavior, `requestTransition`, through that facade behind the same public API.
3. Keep `transition.ts` as Cycle-owned lifecycle validation during the first step.
4. Prove no behavior changed with `packages/core/test/request-transition.test.ts`,
   `packages/core/test/dor-dod-evaluation.test.ts`, and ledger/event tests.

This avoids the two main failure modes: moving transition legality into persistence code, or
moving run persistence into the state-machine module.

## Spec Drift Rules

- If C2 finds that `requestTransition` cannot be routed through Run without changing the public
  result shape, update `core-bounded-context-map.md` before editing implementation.
- If C3 discovers a value object belongs to a different context than listed here, update this
  document and the file-to-context CSV before extraction.
- If C4 introduces new event names, add the context owner to the event name table before writing
  tests.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: C2-C7 implementation proceeds without preserving the owner split between Run persistence, Cycle transition legality, Gate verdicts, and Evidence proof records.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/core-bounded-context-map.md
  on-fail: Stop Stream C implementation and revise the bounded-context map before further refactor work.
```
