---
claim-bearing: true
status: COMPLETE
cycle: cycle-77-hard-limits-residual-reconciliation
created: 2026-05-14
---

# Hard-Limits Residual Reconciliation

## Result

Cycle 77 closed the remaining local D-H7 hard-limits boundary/code-module row.

The closure is narrow:

| Boundary | Status | Evidence |
|---|---|---|
| Remote script pipe command block | Already implemented in Cycle 67 | `packages/core/src/security/hard-limits.ts`; `packages/core/test/handle-hook.test.ts` |
| Active subagent spawn cap | Implemented in Cycle 77 | `packages/core/src/security/hard-limits.ts`; `packages/core/src/gates/evaluate-gate.ts`; `packages/core/test/handle-hook.test.ts` |

The construction ledger moves to:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

This does not claim token-budget enforcement, inherited subagent tool-deny projection, or real
runtime adapter enforcement. Those remain separate future concerns if later runtime payloads and
adapter contracts make them concrete.

## Residual Decision

The remaining historical row said the hard-limits module should stay open until one missing
deterministic boundary was selected and covered by failing negative tests. Cycle 67 selected one
boundary, but the runtime-boundary audit still carried the row because spawn limits were listed as
a residual candidate.

Cycle 77 selected the smallest deterministic residual that is already represented in local state:
`runSet.subagents[]` active spawn count. The hard limit blocks a new `subagent_start` when 15
existing subagents are active and the incoming agent id is not already one of them.

Terminal subagent statuses are not counted as active:

- `completed`
- `failed`
- `blocked`
- `cancelled`

`planned`, `requested`, `running`, and missing status values are counted as active.

## Implementation

| File | Change |
|---|---|
| `packages/core/src/security/hard-limits.ts` | `evaluateHardLimits()` now accepts optional run-set context, evaluates `subagent_start`, and blocks the 16th active subagent with `SUBAGENT_SPAWN_LIMIT`. |
| `packages/core/src/gates/evaluate-gate.ts` | `evaluateSubagentStart()` evaluates hard limits before scope/write-zone checks, so spawn-limit violations are not masked by unrelated gates. |
| `packages/core/test/handle-hook.test.ts` | Added RED/GREEN coverage for the 16th active subagent. |

## RED / GREEN Evidence

| Step | Result |
|---|---|
| RED | PASS: `corepack pnpm --filter @harness/core test -- handle-hook.test.ts` failed before implementation because the new expectation received `FORBIDDEN_WRITE_ZONE` instead of `SUBAGENT_SPAWN_LIMIT`. |
| GREEN | PASS: the same command passed after implementation with 426/426 core tests passing. |

## Non-Goals Preserved

Cycle 77 did not:

- implement token-budget ceilings;
- implement inherited subagent disallowed-tool projection;
- prove adapter/runtime enforcement in Claude, Codex, or Hermes;
- launch external runtime/model sessions;
- write to real `~/.hima`;
- close H3 OS install proof;
- publish, tag, contact users, wire payments, or claim beta/revenue/launch/legal/market proof.

## Verification

| Check | Result |
|---|---|
| Focused RED/GREEN | PASS: failed before implementation, passed after implementation. |
| Hard-limit ordering | PASS: spawn-limit check runs before subagent scope/write-zone gating. |
| Truth-surface scope | PASS: master goal can close the local D-H7 row while preserving token-budget, inherited tool-deny, and runtime-adapter non-goals. |

```yaml
Falsifies-If:
  kill-condition: This artifact is used to claim token-budget enforcement, inherited subagent tool-deny projection, real runtime adapter enforcement, or broad hard-limits completion beyond the two tested local boundaries.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/hard-limits-residual-reconciliation.md
  on-fail: Reopen cycle-77 as BLOCKED_HARD_LIMITS_OVERCLAIM and restore the local residual blocker.
```
