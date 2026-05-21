---
claim-bearing: true
status: COMPLETE
cycle: cycle-89-harv17-prompt-cache-boundary-local
created: 2026-05-15
---

# HARV-17 Prompt-Cache Boundary Local Proof

## Result

Cycle 89 added deterministic repo-local HARV-17 prompt-cache boundary evaluation.

HARV-17 remains open as a full master-goal row because this cycle did not integrate with a real
prompt-cache runtime, prove cache hits, execute live invalidation behavior, invoke an adapter, or
write to real `~/.hima`.

The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/runtime/prompt-cache-boundary.ts` | Adds the `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` marker, deterministic prompt splitting, stale snapshot detection, invalidation-signal normalization, dynamic-state leak detection, and invalidation reason catalog. |
| `packages/core/src/index.ts` | Exports the local prompt-cache boundary helper from the core package. |
| `packages/core/test/prompt-cache-boundary.test.ts` | Covers fresh cache acceptance, stale cache bypass, explicit invalidation signals, missing/duplicate boundary rejection, dynamic-state leak rejection, and catalog integrity. |

## Boundary

This is local helper proof only. It does not prove:

- real Anthropic prompt-cache integration;
- cache-hit or freshness behavior in a live runtime;
- live invalidation behavior;
- live adapter behavior;
- external runtime/model evidence;
- real user-home `~/.hima` installation;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- prompt-cache-boundary.test.ts` ran through the package runner with 465/465 tests passing. |
| Fresh boundary test | PASS: a prompt with exactly one boundary, fresh snapshot, and no leaked dynamic markers allows cache use for the static prefix. |
| Stale snapshot test | PASS: deterministic age comparison returns `bypass_cache` with `staleSnapshot`. |
| Invalidation test | PASS: explicit invalidation signals are normalized and force `bypass_cache`. |
| Boundary/leak tests | PASS: missing boundary, duplicate boundary, and dynamic-state leakage into the cacheable prefix are rejected. |

```yaml
Falsifies-If:
  kill-condition: This local prompt-cache boundary proof is used as proof of real prompt-cache integration, cache-hit/freshness runtime behavior, live invalidation behavior, adapter behavior, or real ~/.hima installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv17-prompt-cache-boundary-local.md
  on-fail: Reopen cycle-89 as BLOCKED_HARV17_PROXY_COMPLETION and restore the live-runtime/user-home blockers.
```
