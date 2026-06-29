---
cycle-id: cycle-98-v3-build-loop
claim-bearing: true
status: ACTIVE
opened: 2026-06-29
closed:
supersedes: cycle-97-behavior-system (the v2 behavior system is removed; hima is rebuilt v3-only per ADR-0003/0004)
governing-principle: docs/goals/README.md §"Saturation-based DONE — the harder bar"
---

# Short-Term Goal — Cycle 98: hima v3 build loop (self-refining)

## 1. Why this cycle exists

hima is being rebuilt as **v3** per ADR-0004: a forcing-function kernel over a pluggable cycle,
with the legacy v2/v1 packages removed. The walking skeleton (`@hima/schemas` + `@hima/core`,
forcing primitive proven by an E2E) has landed. This cycle drives the v3 build forward as a
**self-refining loop** until the runtime is functional on a live runtime and the suite is green.

## 2. Deliverable — run the loop until acceptance

The loop iterates: **slice → build (TDD/DDD) → verify → self-critique → next slice**, using
workflows for heavy parallel work, verifying between iterations, surfacing only at milestones or
true blockers.

| Iteration | Scope |
|---|---|
| **I1 — clean baseline** | Remove dead v2 packages (behavior-core, gates-core, hima-cli, adapter-*-v2); fix the claim-bearing guard (archives exempt; live anchors resolve); `pnpm test` green. |
| **I2 — real CLI/adapter (option 1a)** | A live `hima` v3 CLI hook path on Claude (stdin GateEvent → sigil/ward/skill-force → exit 2), TDD; repoint `.claude/settings.json` hooks to the v3 CLI; prove enforcement in a real process. |
| **I3 — purge legacy** | Once v3 enforces the hooks, remove the `@harness/*` legacy chain; rewire root build/test/tsconfig to v3-only. |
| **I4 — forced parallelization + roles (option 1b)** | Role-team spawn + merge model + enriched roles, TDD (PARALLELIZATION-v3 design). |

## 3. DONE criteria (saturation-based)

1. `pnpm test` is green (curated suite), no regressions.
2. A live v3 CLI enforces the universal-base gates (`user_prompt` + `pre_tool`) on Claude in a real
   process; `.claude/settings.json` points to it; an integration test spawns it and asserts exit 2
   on a skill-force.
3. The `@harness/*` legacy packages are removed; the repo is v3-only and builds green.
4. Forced-parallelization model implemented with passing tests (role-team spawn + merge).
5. Every new claim-bearing artifact carries a resolving Falsifies-If (guard green).

Saturation: a final critic + verification wave confirms each criterion with file:line/test evidence;
any finding re-opens the cycle.

## 4. Kill conditions

- If the v3 forcing premise fails on the live universal base (the spawned CLI cannot hard-block),
  stop and re-examine ARCHITECTURE-v3 §C2 before building further (per ADR-0004 Falsifies-If).
- Never weaken a guard to pass; fix the code/data. Tidy First: S and B commits never mixed.

```yaml
Falsifies-If:
  kill-condition: >
    A v3 iteration is marked done without a passing test at its acceptance criterion, OR the legacy
    @harness chain is removed before the v3 CLI is wired into the live hooks (leaving the session
    without enforcement), OR pnpm test is left red.
  checkpoint-date: 2026-07-06
  evidence-anchor: docs/decisions/0004-v3-architecture-build.md + packages/hima-core/ + packages/schemas/
  on-fail: reopen cycle-98 ACTIVE; restore the failing iteration's blocker; do not advance the loop.
```

## 5. Status log

- **2026-06-29** — Cycle 98 opened. Walking skeleton landed (commits 4d50579 + d735e3b: @hima/schemas 87 tests, @hima/core 93 tests incl. E2E). I1 in progress: 5 dead v2 packages removed; claim-bearing guard scoped to exempt archives. Supersedes cycle-97 (v2 behavior system removed).
