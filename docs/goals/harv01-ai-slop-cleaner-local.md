---
claim-bearing: true
status: COMPLETE
created: 2026-05-15
cycle: cycle-94-harv01-ai-slop-cleaner-local
---

# HARV-01 AI Slop Cleaner Local Proof

## Result

Cycle 94 added deterministic local HARV-01 cleanup evidence enforcement.

The implementation detects cleanup/deslop work and requires both a cleanup plan and regression
evidence or explicit unchanged-behavior evidence. It is wired into local `post_tool` and
`subagent_stop` gate evaluation.

This is local core evidence only. It does not prove live runtime invocation, adapter hook firing,
real cleanup workflow execution in a dogfood session, or real `~/.hima` installation.

## Delivered Artifacts

| Artifact | Coverage |
|---|---|
| `packages/core/src/security/ai-slop-cleaner.ts` | Defines HARV-01 cleanup trigger detection, required evidence findings, and evidence anchors. |
| `packages/core/src/gates/evaluate-gate.ts` | Applies the helper to cleanup-related `post_tool` and traced `subagent_stop` events. |
| `packages/core/test/ai-slop-cleaner.test.ts` | Covers no-op non-cleanup text, missing plan/evidence, accepted cleanup evidence, and finding catalog stability. |
| `packages/core/test/gates.test.ts` | Covers local gate behavior for missing HARV-01 evidence and accepted cleanup evidence. |
| `packages/core/test/handle-hook.test.ts` | Covers normalized PostToolUse payload persistence for HARV-01 missing-evidence blockers. |
| `packages/core/src/index.ts` | Exports the local helper surface for package consumers. |

## Boundary

| Claim | Status |
|---|---|
| Local cleanup-plan/regression-evidence evaluator exists | COMPLETE. |
| Local `post_tool` cleanup evidence enforcement exists | COMPLETE. |
| Local traced `subagent_stop` cleanup evidence enforcement exists | COMPLETE. |
| Live runtime invocation is proven | OPEN. |
| Adapter hook firing is proven | OPEN. |
| Actual dogfood cleanup workflow execution is proven | OPEN. |
| Real `~/.hima` installation and invocation are proven | OPEN. |

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- ai-slop-cleaner.test.ts gates.test.ts handle-hook.test.ts` | PASS: 48 files / 484 tests. |
| `corepack pnpm exec biome check ...touched code/test files... --write` | PASS: fixed 2 files. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Post-tool dry-run | PASS: hook post-tool-use allowed with no policy violations. |
| Saturation sweep | PASS: full HARV-01 remains open; live runtime, adapter hook, dogfood execution, real user-home, H3 macOS, and external-evidence blockers remain present. |

```yaml
Falsifies-If:
  kill-condition: HARV-01 is marked complete end-to-end from local helper tests without live runtime invocation, adapter hook firing, actual dogfood cleanup execution, or real user-home installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv01-ai-slop-cleaner-local.md
  on-fail: Reopen cycle-94 as BLOCKED_HARV01_OVERCLAIM and restore runtime/user-home blockers.
```
