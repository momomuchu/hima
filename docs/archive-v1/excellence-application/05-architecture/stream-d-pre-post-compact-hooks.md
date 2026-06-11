---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-18-stream-d-pre-post-compact-hooks
deliverable: C18-1
---

# Stream D PreCompact and PostCompact Hooks

## Contract

Cycle-18 closes D-H4/HARV-13 only: runtime PreCompact and PostCompact payloads entering
`packages/core/src/services/handle-hook.ts` are normalized to the canonical `pre_compact` and
`post_compact` gates and evaluated by `packages/core/src/gates/evaluate-gate.ts`.

The hook boundary accepts both canonical camelCase fields and adapter-style snake_case fields:

| Runtime field | Canonical field |
|---|---|
| `hook_event_name` / `hookEventName` | `metadata.hookEventName` |
| `session_id` / `sessionId` | `metadata.sessionId` |
| `run_id` / `runId` | `metadata.runId` |
| `phase` | `metadata.phase` |
| `sub_phase` / `subPhase` | `metadata.subPhase` |
| `mode` | `metadata.mode` |
| `risk_class` / `riskClass` | `metadata.riskClass` |
| `compaction_id` / `compactionId` | `metadata.compactionId` |
| `compaction_reason` / `compactionReason` / `reason` | `metadata.compactionReason` |
| `compaction_summary` / `compactionSummary` / `summary` | `metadata.compactionSummary` |
| `context_hash` / `contextHash` | `metadata.contextHash` |

Missing or unreadable planning state returns `decision: "block"`,
`violationType: "RUNTIME_BINDING_UNAVAILABLE"`, `finalState: "BLOCKED_RUNTIME_MISSING"`, and
`failOpen: false` before either compact gate evaluates.

## PreCompact

PreCompact prepares a bounded context snapshot before context-window compaction. It returns the
same redacted context-injection envelope used by other hook gates: route, current risk, phase,
subphase, mode, active gates, forcing signals, and best-effort session-start facts.

PreCompact does not write a separate snapshot file in this cycle. The authoritative persisted trace
is the redacted `GATE_EVALUATED` run event and event log entry appended by `handleHook`.

## PostCompact

PostCompact checks any runtime-supplied continuity fields against the current route/run context.
If `runId`, `phase`, `subPhase`, `mode`, or `riskClass` is present and differs from the current
planning state, the gate returns `COMPACTION_CONTINUITY_MISMATCH`. M/H/C routes block; T/L routes
warn according to the usual policy shape.

Missing optional continuity fields do not block by themselves. This keeps the hook compatible with
runtime adapters that can fire the hook but cannot yet pass every route field.

## Persistence and Dry-Run

Non-dry-run evaluations append a redacted `GATE_EVALUATED` run event and a domain event log entry.
Compaction summaries, reasons, context hashes, metadata, and gate reasons are passed through the
shared redaction layer before persistence. Dry-run evaluation returns the same gate verdict shape
but does not append run-set events, event-log entries, or ledger entries.

## Non-Responsibilities

Cycle-18 does not:

- reopen PreToolUse, SessionStart, UserPromptSubmit, or Stop behavior;
- expand PostToolUse evidence-anchor governance;
- add SubagentStart policy;
- add MCP tools or adapter packages;
- decompose the hook service into concern-scoped modules;
- add skill linting, prompt files, or skill migration.

## Verification Evidence

Required closure commands:

```powershell
corepack pnpm --filter @harness/core exec vitest run --root ../.. ../../packages/core/test/handle-hook.test.ts ../../packages/core/test/gates.test.ts
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm docs:index
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: PreCompact or PostCompact can fail open, lose route/run state across compaction, persist secrets, or mutate planning state during dry-run.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/handle-hook.test.ts
  on-fail: Reopen cycle-18 as BLOCKED_COMPACT_HOOKS and restore fail-closed, redacted, tested compact-hook behavior before other Stream D work.
```
