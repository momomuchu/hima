---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-07-stream-c3-value-objects
deliverable: C7-7
---

# Stream C3 Value Objects

## Decision

Cycle-07 extracts named value-object boundaries for the four Stream C3 vocabulary types while
preserving the existing public constants and string-union compatibility:

- `RiskClass`
- `SubPhase`
- `OperatingMode`
- `GateType`

Each boundary exports a frozen canonical tuple, a type alias, a type guard, a parser, and an
assertion function. Invalid values fail at the named boundary before downstream code can treat
them as canonical vocabulary.

## Ownership Mapping

| Value object | Owner | File | Rationale |
|---|---|---|---|
| `RiskClass` | Gate | `packages/core/src/types/risk-class.ts` | Risk class drives gate policy, escalation, bypass eligibility, and evidence obligations. |
| `SubPhase` | Cycle | `packages/core/src/types/subphase.ts` | Subphase is lifecycle vocabulary used by Cycle transition policy. |
| `OperatingMode` | Run / Gate coordination | `packages/core/src/types/operating-mode.ts` | Mode is stored on Run route/state and interpreted by Gate policy. |
| `GateType` | Gate | `packages/core/src/types/gate-type.ts` | Gate type is the runtime policy boundary vocabulary. |

`packages/core/src/types/canonical.ts` remains a compatibility surface. It continues to export the
same arrays, types, and risk ranking helpers so schemas, catalogs, runtime bindings, adapters, and
tests keep their existing import shape.

## Validation APIs

| File | Type guard | Parser | Assertion |
|---|---|---|---|
| `risk-class.ts` | `isRiskClass` | `parseRiskClass` | `assertRiskClass` |
| `subphase.ts` | `isSubPhaseValue` | `parseSubPhase` | `assertSubPhase` |
| `operating-mode.ts` | `isOperatingMode` | `parseOperatingMode` | `assertOperatingMode` |
| `gate-type.ts` | `isGateType` | `parseGateType` | `assertGateType` |

The names are intentionally explicit. `isSubPhaseValue` avoids colliding with the existing
state-machine helper `isSubPhase`, which still validates transition positions at the Cycle policy
layer.

## Behavior Preservation

This cycle does not start C4-C7. It does not rename event types, create repositories, change Run
invariants, or rewrite aggregate-style tests beyond the focused C3 vocabulary tests.

Existing constants remain stable:

- `RISK_CLASSES`
- `SUB_PHASES`
- `OPERATING_MODES`
- `GATE_TYPES`

The existing Zod schemas in `schemas/common.ts` still derive from those constants.

## Verification Evidence

Required closure evidence:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

The file inventory must also prove that the C1 CSV includes all new value-object files.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A future vocabulary value is accepted as RiskClass, SubPhase, OperatingMode, or GateType without passing through a named C3 guard, parser, assertion, or schema derived from the same canonical tuple.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/canonical.test.ts
  on-fail: Reopen Stream C3 and restore focused invalid-value coverage before C4-C7 continue.
```
