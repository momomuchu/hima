---
claim-bearing: true
status: COMPLETE
cycle: cycle-88-harv13-compaction-hook-local
created: 2026-05-15
---

# HARV-13 Compaction Hook Local Proof

## Result

Cycle 88 extracted and tested a repo-local HARV-13 compaction critical-state continuity helper.

HARV-13 remains open as a full master-goal row because this cycle did not fire a real compaction
event, invoke a live adapter, prove real PreCompact/PostCompact hook delivery, or write to real
`~/.hima`.

The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/gates/compaction-continuity.ts` | Adds critical-state key catalog, metadata normalization, continuity mismatch detection, strict missing-key mode, and deterministic stale-snapshot detection. |
| `packages/core/src/gates/evaluate-gate.ts` | Reuses the helper for existing PostCompact route-continuity checks while preserving optional-field compatibility. |
| `packages/core/test/compaction-continuity.test.ts` | Covers preserved state, missing critical state, optional-field compatibility, route mismatch, stale snapshot, and catalog integrity. |

## Boundary

This is local helper proof only. It does not prove:

- real PreCompact/PostCompact hook firing;
- live context-window compaction;
- live adapter behavior;
- external runtime/model evidence;
- real user-home `~/.hima` installation;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- compaction-continuity.test.ts handle-hook.test.ts` ran through the package runner with 460/460 tests passing. |
| Compatibility test | PASS: absent optional PostCompact fields remain compatible and do not block by default. |
| Strict preservation test | PASS: `requireAllKeys` reports missing critical state when a local proof needs a complete snapshot. |
| Stale snapshot test | PASS: snapshot age is deterministic when `now` is provided. |

```yaml
Falsifies-If:
  kill-condition: This local compaction-continuity proof is used as proof of real compaction firing, live adapter behavior, runtime/model evidence, or real ~/.hima installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv13-compaction-hook-local.md
  on-fail: Reopen cycle-88 as BLOCKED_HARV13_PROXY_COMPLETION and restore the live-runtime/user-home blockers.
```
