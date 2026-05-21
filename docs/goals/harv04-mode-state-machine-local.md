---
claim-bearing: true
status: COMPLETE
cycle: cycle-86-harv04-mode-state-machine-local
created: 2026-05-15
---

# HARV-04 Mode State-Machine Local Proof

## Result

Cycle 86 implemented a repo-local HARV-04 mode-exclusion helper with deterministic workflow-mode
activation decisions.

HARV-04 remains open as a full master-goal row because this cycle did not wire live runtime
persistence, runtime hooks, real mode invocation, adapter behavior, or real `~/.hima` install proof.
It also found source drift: the installed OMX `workflow-transition.js` currently exposes six
source-verified auto-complete transitions, while the older master row says ten.

The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/state-machine/mode-exclusion.ts` | Adds tracked workflow modes, planning/execution families, allowed overlap rules, six source-verified auto-complete transitions, activation evaluation, transition messages, errors, and assertions. |
| `packages/core/src/index.ts` | Exports the local mode-exclusion surface. |
| `packages/core/test/mode-exclusion.test.ts` | Covers valid mode families, allowed overlap, auto-complete transitions, rollback denial, unsupported overlap denial, and catalog integrity. |

## Boundary

This is local helper proof only. It does not prove:

- live runtime mode persistence;
- hook wiring into actual runtime lifecycle events;
- real mode activation or completion from an OMX/Codex session;
- adapter behavior;
- real user-home `~/.hima` installation;
- full parity with the historical ten-transition count;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- mode-exclusion.test.ts` ran through the package runner with 449/449 tests passing. |
| Catalog integrity test | PASS: tracked modes are unique, planning and execution families are disjoint and exhaustive, auto-complete entries point to known modes, and allowed overlaps are symmetric. |
| Denial behavior | PASS: unsupported execution overlap and execution-to-planning rollback keep current state unchanged and produce actionable errors. |
| Source drift boundary | PASS: source-verified local catalog count is six; the older ten-transition claim remains a full-parity blocker, not a closed row. |

```yaml
Falsifies-If:
  kill-condition: This local mode-exclusion proof is used as proof of live runtime persistence, runtime invocation, adapter behavior, real ~/.hima installation, or full ten-transition parity.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv04-mode-state-machine-local.md
  on-fail: Reopen cycle-86 as BLOCKED_HARV04_PROXY_COMPLETION and restore the runtime/user-home/parity blockers.
```
