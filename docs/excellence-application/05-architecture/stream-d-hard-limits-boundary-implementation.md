---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-67-hard-limits-boundary-selection
---

# Stream D - Hard-Limits Boundary Implementation

## Result

Cycle 67 selected and implemented one deterministic D-H7 hard-limit boundary. Cycle 77 later
reconciled the remaining local D-H7 residual by adding an active subagent spawn cap.

| Field | Value |
|---|---|
| Selected boundary | Blocked command patterns for PreToolUse shell payloads |
| Source note | `docs/excellence-application/05-architecture/stream-d-hard-limits-policy-sketch.md` §2 and §5 |
| Runtime payload shape | `tool_name: "Bash"` with `tool_input.command` from existing PreToolUse tests |
| Implementation | `packages/core/src/security/hard-limits.ts` |
| Integration | `packages/core/src/gates/evaluate-gate.ts` calls `evaluateHardLimits()` at the start of `pre_tool` evaluation |
| Tests | `packages/core/test/handle-hook.test.ts` blocks remote-script pipe execution and allows benign read-only shell commands |

Cycle 77 addendum:

| Field | Value |
|---|---|
| Selected boundary | Active subagent spawn cap |
| Runtime payload shape | `subagent_start` with normalized `agentId` plus persisted `runSet.subagents[]` |
| Implementation | `packages/core/src/security/hard-limits.ts` blocks the 16th active subagent |
| Integration | `packages/core/src/gates/evaluate-gate.ts` evaluates this hard limit before subagent scope/write-zone checks |
| Tests | `packages/core/test/handle-hook.test.ts` verifies `SUBAGENT_SPAWN_LIMIT` at 15 active subagents |

## Boundary

The selected boundary is intentionally narrow: remote script pipe execution is blocked before
runtime binding checks can mask the deterministic hard-limit result.

Examples blocked by the policy:

- `curl ... | bash`
- `wget ... | sh`
- `Invoke-WebRequest ... | Invoke-Expression`

## Non-Goals

Cycle 67 does not:

- implement token-budget ceilings;
- implement subagent disallowed-tool inheritance;
- implement spawn-count limits;
- add a broad hard-limits policy engine;
- call an LLM or permission judge;
- claim runtime adapter enforcement beyond the normalized PreToolUse payload.

Cycle 77 removes the spawn-count non-goal for local persisted subagent records only. Token-budget
ceilings, inherited subagent disallowed-tool projection, and runtime adapter enforcement remain
non-goals.

## Verification

| Check | Result |
|---|---|
| RED test | PASS: `corepack pnpm --filter @harness/core test -- handle-hook.test.ts` failed before implementation on the remote-script pipe expectation. |
| GREEN test | PASS: focused hook tests passed after implementation, 425 tests through the package runner. |
| `corepack pnpm exec biome check ...hard-limits touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle text, source-review warnings, and explicit non-goals remained. |
| Cycle 77 spawn cap | PASS: RED expected `SUBAGENT_SPAWN_LIMIT` failed before implementation; GREEN focused core tests passed with 426/426 after implementation. |

```yaml
Falsifies-If:
  kill-condition: Hard-limits documentation claims broad D-H7 completion, token-budget enforcement, subagent tool inheritance, or runtime adapter enforcement beyond the tested PreToolUse command pattern.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-d-hard-limits-boundary-implementation.md
  on-fail: Reopen cycle-67 as BLOCKED_HARD_LIMITS_OVERCLAIM and restore one-boundary scope.
```
