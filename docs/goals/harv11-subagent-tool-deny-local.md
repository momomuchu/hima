---
claim-bearing: true
status: COMPLETE
cycle: cycle-84-harv11-subagent-tool-deny-local
created: 2026-05-15
---

# HARV-11 Subagent Tool-Deny Local Proof

## Result

Cycle 84 implemented the repo-local HARV-11 default-deny subagent tool policy in the local
SubagentStart gate path.

HARV-11 remains open as a full master-goal row because no live subagent runtime execution, adapter
permission projection, or real `~/.hima` install occurred. The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/hooks/hook-payload.ts` | Normalizes SubagentStart tool policy fields such as `requested_tools`, `allowed_tools`, and inherited deny lists into metadata. |
| `packages/core/src/gates/evaluate-gate.ts` | Blocks local SubagentStart events that request default-denied `todowrite` or `task`, while preserving inherited deny lists over explicit allow lists. |
| `packages/core/test/gates.test.ts` | Covers default-denied tool requests, explicit allow for default-denied tools, inherited deny precedence, and clean allowed starts. |
| `packages/core/test/handle-hook.test.ts` | Covers normalized hook payload blocking and proves blocked launches are not persisted as subagent records. |

## Behavior

The local policy derives:

| Field | Behavior |
|---|---|
| `requestedTools` / `requested_tools` / `tools` | Tools requested for the subagent launch. |
| `allowedTools` / `allowed_tools` | Explicit exceptions for default-denied tools. |
| `disallowedTools`, `deniedTools`, `parentDeniedTools`, `sessionDeniedTools` | Inherited deny lists that cannot be weakened by explicit allow metadata. |
| Default denied tools | `todowrite` and `task` are blocked by default when requested. |
| Block result | Returns `SUBAGENT_TOOL_DENIED` before launch record persistence. |

## Boundary

This is local hook/gate proof only. It does not prove:

- live subagent runtime execution;
- adapter-level permission projection;
- a runtime child session actually inherited the deny rules;
- real `~/.hima` skill installation;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- gates.test.ts handle-hook.test.ts` ran through the package runner with 440/440 tests passing. |
| Default-deny test | PASS: SubagentStart blocks `todowrite` and `task` requests with `SUBAGENT_TOOL_DENIED`. |
| Explicit default allow test | PASS: explicitly allowed default-denied tool can pass local policy. |
| Inherited deny test | PASS: inherited deny rules remain blocking even when the same tool appears in an allow list. |
| Hook normalization test | PASS: top-level `requested_tools` normalizes into metadata and a blocked launch is not persisted as a subagent record. |

```yaml
Falsifies-If:
  kill-condition: This local tool-deny proof is used as proof of live subagent runtime enforcement, adapter-level permission projection, or real ~/.hima installation.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv11-subagent-tool-deny-local.md
  on-fail: Reopen cycle-84 as BLOCKED_HARV11_PROXY_COMPLETION and restore the live-runtime/user-home blockers.
```
