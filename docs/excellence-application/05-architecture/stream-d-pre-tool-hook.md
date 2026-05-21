---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-16-stream-d-pre-tool-hook
deliverable: C16-1
---

# Stream D PreToolUse Hook

## Contract

Cycle-16 closes D-H1 only: runtime PreToolUse payloads entering
`packages/core/src/services/handle-hook.ts` are normalized to the canonical `pre_tool` gate and
evaluated by `packages/core/src/gates/evaluate-gate.ts`.

The hook boundary accepts both canonical camelCase fields and adapter-style snake_case fields:

| Runtime field | Canonical field |
|---|---|
| `hook_event_name` / `hookEventName` | `metadata.hookEventName` |
| `session_id` / `sessionId` | `metadata.sessionId` |
| `tool_use_id` / `toolUseId` | `metadata.toolUseId` |
| `tool_name` / `toolName` | `toolName` |
| `tool_input` / `toolInput` | `toolInput` |
| `tool_output`, `tool_response`, `tool_result` | `toolOutput` |

The returned verdict is a `GateResult` plus `failOpen: false`. Missing or unreadable planning
state returns `decision: "block"`, `violationType: "RUNTIME_BINDING_UNAVAILABLE"`, and
`finalState: "BLOCKED_RUNTIME_MISSING"` instead of allowing the tool call.

## Write-Zone Enforcement

PreToolUse write-zone policy is enforced through the shared gate evaluator. Write-capable tools,
metadata-declared write capabilities, shell redirection, common shell write commands, PowerShell
write forms, patch payloads, and argv-style write targets are reduced to candidate target paths and
checked against the phase/subphase write zones from `packages/core/src/policy/write-zones.ts`.
Candidate paths are canonicalized before policy matching so dot-segment escapes from allowed
prefixes cannot inherit a write zone. When the project root exists, PreToolUse write target
evaluation also resolves the nearest existing parent through realpath before zone matching, so
symlinks or junctions under an allowed prefix cannot redirect writes outside the project.

Adapter-declared write intent is detected from tool names, metadata capabilities, and tool input
signals such as `action`, `operation`, `method`, `capability`, and `capabilities`. HTTP write
methods such as `PUT` and `POST` are treated as write signals when a target path is present.

Outside-zone writes produce a `FORBIDDEN_WRITE_ZONE` verdict. Low-risk routes warn; H-risk and
higher routes block. Read-only PreToolUse events remain allowed.

## Persistence and Redaction

Non-dry-run evaluations append a redacted `GATE_EVALUATED` run event and a domain event log entry.
Gate reasons, tool input previews, tool output previews, and metadata are passed through the shared
redaction layer before persistence. Dry-run evaluation returns the same gate verdict shape but does
not append run-set events, event-log entries, or ledger entries.

## Non-Responsibilities

Cycle-16 does not:

- implement SessionStart, Stop, UserPromptSubmit, or PostToolUse behavior;
- add SubagentStart policy beyond the existing domain event emission;
- implement PreCompact/PostCompact hooks;
- add MCP tools or adapter packages;
- decompose the hook service into concern-scoped modules;
- add skill linting, prompt files, or skill migration.

## Verification Evidence

Required closure commands:

```powershell
corepack pnpm --filter @harness/core exec vitest run --root ../.. ../../packages/core/test/write-zones.test.ts ../../packages/core/test/handle-hook.test.ts ../../packages/core/test/gates.test.ts
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm docs:index
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: PreToolUse writes outside allowed zones can pass silently, missing planning state can fail open, secrets can persist in hook artifacts, or dry-run appends events.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/handle-hook.test.ts
  on-fail: Reopen cycle-16 as BLOCKED_PRE_TOOL_HOOK and restore fail-closed, redacted, non-mutating PreToolUse behavior before other hook work.
```
