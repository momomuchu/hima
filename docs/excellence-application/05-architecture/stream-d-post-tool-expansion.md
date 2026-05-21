---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-19-stream-d-post-tool-expansion
deliverable: C19-1
---

# Stream D PostToolUse Expansion

## Contract

Cycle-19 expands PostToolUse only. Runtime PostToolUse payloads entering
`packages/core/src/services/handle-hook.ts` are normalized to the canonical `post_tool` gate and
evaluated by `packages/core/src/gates/evaluate-gate.ts`.

The hook boundary accepts both canonical camelCase fields and adapter-style snake_case fields:

| Runtime field | Canonical field |
|---|---|
| `hook_event_name` / `hookEventName` | `metadata.hookEventName` |
| `session_id` / `sessionId` | `metadata.sessionId` |
| `tool_name` / `toolName` | `toolName` |
| `tool_input` / `toolInput` | `toolInput` |
| `tool_output` / `toolOutput` / `tool_response` / `tool_result` | `toolOutput` |

Missing or unreadable planning state returns `decision: "block"`,
`violationType: "RUNTIME_BINDING_UNAVAILABLE"`, `finalState: "BLOCKED_RUNTIME_MISSING"`, and
`failOpen: false` before PostToolUse evaluates.

## Policy Events

PostToolUse cannot undo a completed tool action, so critical findings are persisted as unresolved
policy events on the redacted `GATE_EVALUATED` payload. The persisted `policyEvent` marks
`source: "post_tool"`, `status: "unresolved"`, `severity: "critical"`, the concrete violation
type, and whether later accepted evidence may resolve it.

The current critical policy events are plaintext secrets, governed bypass patterns, premature
`DONE_VERIFIED`, missing or invalid `Falsifies-If` blocks on claim-bearing writes, and migration
writes without structured ADR evidence.

`stop` and convergence read these persisted events through the run-set event log. They block while
the policy event remains unresolved according to the existing blocker rules.

## Evidence Anchors

For claim-bearing Markdown writes with a valid `Falsifies-If` block and resolvable
`evidence-anchor`, PostToolUse persists an `evidenceAnchors` array such as
`docs/claim.md -> docs/evidence.md:1`.

These anchors are references only. Cycle-19 does not fabricate accepted evidence, does not append
to `runSet.evidence`, and does not mark proof as accepted merely because an anchor resolves.

## Persistence and Dry-Run

Non-dry-run evaluations append a redacted `GATE_EVALUATED` run event and a domain event log entry.
Gate reasons, policy events, evidence anchors, metadata, tool input previews, and tool output
previews are passed through the shared redaction layer before persistence. Dry-run evaluation
returns the same gate verdict shape but does not append run-set events, event-log entries, or ledger
entries.

## Non-Responsibilities

Cycle-19 does not:

- reopen PreToolUse, SessionStart, UserPromptSubmit, Stop, PreCompact, or PostCompact behavior;
- add SubagentStart policy;
- add MCP tools or adapter packages;
- decompose the hook service into concern-scoped modules;
- add skill linting, prompt files, or skill migration.

## Verification Evidence

Required closure commands:

```powershell
corepack pnpm --filter @harness/core exec vitest run --root ../.. ../../packages/core/test/handle-hook.test.ts ../../packages/core/test/gates.test.ts ../../packages/core/test/convergence.test.ts
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm docs:index
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: PostToolUse expansion marks done while post-action violations can disappear before stop, persist secrets, fabricate evidence, or mutate state during dry-run.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/handle-hook.test.ts
  on-fail: Reopen cycle-19 as BLOCKED_POST_TOOL_EXPANSION and restore fail-closed, redacted, tested PostToolUse behavior before other Stream D work.
```
