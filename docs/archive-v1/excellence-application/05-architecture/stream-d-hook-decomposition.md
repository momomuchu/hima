---
claim-bearing: true
status: ACCEPTED
cycle-id: cycle-21-stream-d-hook-decomposition-adapter-hardening
owner-stream: Stream D
---

# Stream D - Hook Decomposition

## 1. Boundary change

Cycle 21 starts D-H6 by extracting hook-specific helper responsibilities out of
`packages/core/src/services/handle-hook.ts`:

- `packages/core/src/hooks/hook-payload.ts` owns runtime hook payload alias normalization,
  metadata merging, compact payload shaping, and bounded event-preview stringification.
- `packages/core/src/hooks/subagent-launch-record.ts` owns redacted SubagentStart launch-contract
  upsert behavior for `runSet.subagents[]`.
- `packages/core/src/services/handle-hook.ts` remains the application service: read planning state,
  call `evaluateGate`, redact the reason, persist the gate event, and return the hook response.

The extraction is behavior-preserving. It does not change gate decisions, violation types,
runtime-binding assessment, redaction semantics, dry-run behavior, event-log emission, or accepted
evidence rules.

## 2. Why this boundary

Hook payload normalization is adapter-facing glue. Keeping it beside persistence logic made
`handle-hook.ts` harder to review after the D-hook semantic cycles. Subagent launch-record upsert is
also not the same concern as service orchestration: it is the Subagent projection update that follows
an already-allowed `subagent_start` decision.

This boundary leaves policy decisions inside `evaluate-gate.ts` for now. A later decomposition can
split per-gate evaluators after this first extraction proves that hook service behavior stays stable.

## 3. Non-goals

This cycle does not:

- add new hook semantics;
- change PostToolUse, PreToolUse, SessionStart, UserPromptSubmit, Stop, PreCompact/PostCompact,
  SubagentStart, or SubagentStop behavior;
- add hard-limits, permission-judge, MCP tools, adapter package features, prompt files, or skill
  linting;
- create accepted evidence automatically;
- change public exports from `packages/core/src/index.ts`.

## 4. Verification evidence

- Focused hook/gate/runtime-binding tests passed after extraction:
  `handle-hook.test.ts`, `gates.test.ts`, and `runtime-bindings.test.ts`.
- The core inventory now includes both extracted hook modules so architecture ownership remains
  truthful.

```yaml
Falsifies-If:
  kill-condition: Hook decomposition changes a prior gate decision, event payload contract, redaction behavior, dry-run no-persist guarantee, runtime-binding check, or accepted-evidence rule.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/handle-hook.test.ts
  on-fail: Reopen cycle-21 as BLOCKED_HOOK_DECOMPOSITION and restore behavior-equivalent hook service boundaries before hard-limits or MCP work.
```
