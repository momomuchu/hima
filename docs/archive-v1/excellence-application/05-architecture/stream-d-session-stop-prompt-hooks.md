---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-17-stream-d-session-stop-prompt-hooks
deliverable: C17-1
---

# Stream D Session, Stop, and Prompt Hooks

## Contract

Cycle-17 closes D-H3/D-H5 only: runtime SessionStart, UserPromptSubmit, and Stop payloads entering
`packages/core/src/services/handle-hook.ts` are normalized to the canonical `session_start`,
`user_prompt`, and `stop` gates and evaluated by `packages/core/src/gates/evaluate-gate.ts`.

The hook boundary accepts both canonical camelCase fields and adapter-style snake_case fields:

| Runtime field | Canonical field |
|---|---|
| `hook_event_name` / `hookEventName` | `metadata.hookEventName` |
| `session_id` / `sessionId` | `metadata.sessionId` |
| `cwd` | `metadata.cwd` |
| `permission_mode` / `permissionMode` | `metadata.permissionMode` |
| `transcript_path` / `transcriptPath` | `metadata.transcriptPath` |
| `prompt_content` / `prompt` / `promptContent` | `promptContent` |

The returned verdict is a `GateResult` plus `failOpen: false`. Missing or unreadable planning
state returns `decision: "block"`, `violationType: "RUNTIME_BINDING_UNAVAILABLE"`, and
`finalState: "BLOCKED_RUNTIME_MISSING"`.

## SessionStart

SessionStart validates that `.planning/state.yaml`, `.planning/current-risk.yaml`, and
`.planning/run-set.json` agree on phase, subphase, mode, and risk class. It returns context
injection with route, risk, active gates, and a bounded session-start snapshot:

- git status state plus at most 20 short-status entries;
- the latest three Markdown ADRs under `docs/decisions/`;
- `FEATURES.json` entries whose status is `IN_PROGRESS`.

The snapshot is best-effort. Missing git, missing ADRs, missing `FEATURES.json`, or malformed
features data do not fail the session gate.
All returned context-injection strings, including ADR titles and `FEATURES.json` labels, pass
through the shared redaction layer before the hook caller receives them.

## UserPromptSubmit

UserPromptSubmit scans the normalized prompt for bypass phrases and variants such as `--no-verify`,
skipping gates, bypassing gates, or disabling hooks. Bypass requests warn on T/L routes and block on
M/H/C routes. Non-bypass prompts still check whether the current operating mode is allowed for the
current risk class and whether the runtime binding can block when M+ risk requires blocking.

Prompt previews are redacted before persistence.

## Stop

Stop evaluates the run evidence set against the current risk policy before allowing
`DONE_VERIFIED`. M+ routes block when mandatory evidence is missing. T/L routes may return
`DONE_WITH_GAPS` according to policy. H/C routes return a specific `MISSING_HUMAN_VALIDATION`
verdict when human validation is the remaining missing evidence.

Stop also blocks unresolved policy violations recorded by earlier gates.

## Persistence and Dry-Run

Non-dry-run evaluations append a redacted `GATE_EVALUATED` run event and a domain event log entry.
Gate reasons, prompt previews, tool input previews, tool output previews, and metadata are passed
through the shared redaction layer before persistence. Dry-run evaluation returns the same gate
verdict shape but does not append run-set events, event-log entries, or ledger entries.

## Non-Responsibilities

Cycle-17 does not:

- reopen PreToolUse write-zone behavior;
- expand PostToolUse evidence-anchor governance;
- add SubagentStart policy;
- implement PreCompact/PostCompact hooks;
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
  kill-condition: SessionStart, UserPromptSubmit, or Stop can fail open, lose adapter payload fields, persist unredacted prompt/tool secrets, bypass evidence policy, or mutate planning state during dry-run.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/handle-hook.test.ts
  on-fail: Reopen cycle-17 as BLOCKED_SESSION_STOP_PROMPT_HOOKS and restore fail-closed, redacted, tested hook behavior before other Stream D work.
```
