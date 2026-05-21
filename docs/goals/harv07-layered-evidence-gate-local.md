---
claim-bearing: true
status: COMPLETE
cycle: cycle-87-harv07-layered-evidence-gate-local
created: 2026-05-15
---

# HARV-07 Layered Evidence Gate Local Proof

## Result

Cycle 87 implemented a repo-local HARV-07 layered evidence-gate evaluator.

HARV-07 remains open as a full master-goal row because this cycle did not run held-out validation,
automate suite promotion, execute an external runtime/model session, demonstrate a real HIMA test
session, or write to real `~/.hima`.

The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/evidence/evaluate-evidence.ts` | Adds `LAYERED_EVIDENCE_GATE_STAGES`, `getEvidenceGateStage`, and `evaluateLayeredEvidenceGate` for local eval-suite, held-out-split, and suite-promotion metadata checks. |
| `packages/core/test/evidence.test.ts` | Covers missing layer rejection, ordered local layer progression, per-layer required keys, ignored unaccepted/untrusted/unmarked evidence, and catalog integrity. |

## Boundary

This is local evaluator proof only. It does not prove:

- held-out evaluator execution;
- automated suite promotion;
- real runtime/model session evidence;
- benchmark execution;
- adapter behavior;
- real user-home `~/.hima` installation;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- evidence.test.ts` ran through the package runner with 454/454 tests passing. |
| Missing layer test | PASS: a promotion-stage evidence item cannot make progression sufficient when `held_out_split` is missing. |
| Metadata test | PASS: suite names and promotion targets are surfaced from local evidence metadata without claiming real promotion. |
| Required-key test | PASS: per-stage required evidence keys can block a stage even when an accepted item exists. |

```yaml
Falsifies-If:
  kill-condition: This local layered evidence-gate proof is used as proof of held-out execution, suite promotion automation, benchmark results, adapter behavior, real runtime/model evidence, or real ~/.hima installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv07-layered-evidence-gate-local.md
  on-fail: Reopen cycle-87 as BLOCKED_HARV07_PROXY_COMPLETION and restore the held-out/runtime/user-home blockers.
```
