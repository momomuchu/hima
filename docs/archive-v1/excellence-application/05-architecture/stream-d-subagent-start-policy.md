---
claim-bearing: true
status: ACCEPTED
cycle-id: cycle-20-stream-d-subagent-start-policy
owner-stream: Stream D
---

# Stream D - SubagentStart Policy Coverage

## 1. Contract landed

Cycle 20 expands `subagent_start` from domain-event emission plus basic scope/depth checks into a
launch authorization gate. A launch is allowed only when the payload provides:

- `agentId` / `agent_id`: the delegated agent identity.
- `task` or `objective`: the bounded assignment, persisted redacted.
- `scope` / `agentScope`: the file or task surface the subagent may operate on.
- `depth`: the delegation depth; the portable maximum remains `1`.
- `expectedEvidenceKeys` / `expected_evidence_keys` or expected deliverables: the evidence contract
  that `subagent_stop` or finalization can later validate.

Allowed launches return a `subagentRecord` and `handleHook` persists that record into
`runSet.subagents[]` with status `requested`. The record is a contract only; it does not add accepted
evidence to `runSet.evidence`.

## 2. Blocking behavior

`subagent_start` now blocks these launch shapes:

- missing agent id;
- missing task;
- missing scope;
- missing evidence contract;
- `depth < 1` or `depth > 1`;
- declared delegated risk below the current route risk;
- scope outside the allowed write zones for the active sub-phase;
- missing enforceable runtime binding when the risk class requires blocking hook support.

Scope validation still reuses the existing write-zone policy. This cycle does not create a separate
read-only delegation scope model; that is future policy work after hook semantics are closed.

## 3. Persistence and redaction

`handleHook` persists SubagentStart data in two places when not in dry-run mode:

- `runSet.events[]`: the gate event payload, including a redacted `subagentRecord` preview.
- `runSet.subagents[]`: the redacted launch contract used later by `subagent_stop`.

Known secret patterns in task text, deliverable paths, metadata, and event previews are redacted
before persistence. Dry-run mode returns the gate decision but appends no events, writes no
subagent record, and creates no event log.

## 4. Non-responsibilities

This cycle does not:

- implement hook decomposition under `packages/core/src/hooks/`;
- change PostToolUse, PreToolUse, SessionStart, UserPromptSubmit, Stop, PreCompact/PostCompact, or
  SubagentStop semantics;
- add MCP tools, adapter package behavior, prompt files, or skill linting;
- create accepted evidence automatically;
- solve unmanaged Codex/Hermes native hook gaps. Runtime binding assessment remains the source of
  truth for those capability gaps.

## 5. Verification evidence

- `packages/core/test/gates.test.ts` covers missing agent/task/scope/evidence contract, depth
  denial, risk downgrade denial, scope escape denial, and allowed contract shape.
- `packages/core/test/handle-hook.test.ts` covers payload normalization, redacted persistence into
  `runSet.events[]` and `runSet.subagents[]`, no accepted-evidence fabrication, domain-event
  emission, and dry-run no-persist behavior.
- `packages/core/test/runtime-bindings.test.ts` keeps the medium-risk missing-binding check on a
  now-valid SubagentStart launch payload.

```yaml
Falsifies-If:
  kill-condition: SubagentStart can allow a launch without agent id, task, scope, depth limit, evidence contract, risk no-downgrade check, redacted persistence, or dry-run no-persist behavior.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/handle-hook.test.ts
  on-fail: Reopen cycle-20 as BLOCKED_SUBAGENT_START_POLICY and restore fail-closed SubagentStart launch authorization before hook decomposition.
```
