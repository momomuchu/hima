---
claim-bearing: true
status: COMPLETE
created: 2026-05-15
cycle: cycle-92-harv16-preference-router-local
---

# HARV-16 PreferenceRouter Local Proof

## Result

Cycle 92 added a deterministic local PreferenceRouter helper for evaluate-then-decide route
selection.

This is local core evidence only. It does not prove live route evaluation in Claude/Codex/Hermes,
model/runtime execution, adapter behavior, learned preference updates, or real `~/.hima`
installation.

## Delivered Artifacts

| Artifact | Coverage |
|---|---|
| `packages/core/src/routing/preference-router.ts` | Evaluates route candidates against required signals, kill signals, score floor, priority, and tie conditions. |
| `packages/core/test/preference-router.test.ts` | Covers candidate ordering, top-route tie escalation, kill/floor rejection, missing-signal reporting, and rejection-catalog integrity. |
| `packages/core/src/index.ts` | Exports the local PreferenceRouter surface for package consumers. |

## Boundary

| Claim | Status |
|---|---|
| Local deterministic preference-route evaluation exists | COMPLETE. |
| Live route evaluation is proven in runtime sessions | OPEN. |
| Model/runtime execution is proven | OPEN. |
| Adapter behavior is proven | OPEN. |
| Real `~/.hima` installation and invocation are proven | OPEN. |

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- preference-router.test.ts router-cascade.test.ts` | PASS: 47 files / 476 tests. |
| Full verification gates | Recorded in the Cycle 92 archive after docs refresh. |

```yaml
Falsifies-If:
  kill-condition: HARV-16 is marked complete end-to-end from local deterministic tests without live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, or real user-home installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv16-preference-router-local.md
  on-fail: Reopen cycle-92 as BLOCKED_HARV16_OVERCLAIM and restore runtime/user-home blockers.
```
