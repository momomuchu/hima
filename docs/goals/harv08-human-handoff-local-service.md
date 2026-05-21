---
claim-bearing: true
status: COMPLETE
cycle: cycle-82-harv08-human-handoff-local-service
created: 2026-05-15
---

# HARV-08 Human-Handoff Local Service

## Result

Cycle 82 implemented the repo-local HARV-08 typed human-handoff service and JSONL capture path.

HARV-08 remains open as a full master-goal row because no live runtime invocation or real
`~/.hima` skill install occurred. The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/services/request-human-input.ts` | Adds typed `requestHumanInput`, `readHumanInputRequests`, schemas, and path helper. |
| `packages/core/test/request-human-input.test.ts` | Covers validation, JSONL replay, run-set event correlation, append order, and malformed log rejection. |
| `packages/core/src/index.ts` | Exports the local service surface. |

## Behavior

The service validates and records:

| Field | Behavior |
|---|---|
| `urgency` | Must be `low`, `normal`, `high`, or `critical`. |
| `format` | Must be `free_text`, `single_choice`, `multi_choice`, or `approval`. |
| `choices` | Required with at least two entries for `single_choice` and `multi_choice`; rejected for `free_text`. |
| `threadId` | Required non-empty correlation id. |
| `handoffs.jsonl` | Appended under `.planning/09-logs/handoffs.jsonl` using a project-local lock and safe root-checked write. |
| Run-set event | Emits `HUMAN_INPUT_REQUESTED` into `.planning/run-set.json` with request id, urgency, format, thread id, choice count, and log path. |
| Replay | `readHumanInputRequests` parses every JSONL line and rejects malformed records with line-specific errors. |

## Boundary

This is local service proof only. It does not prove:

- real user contact;
- live runtime invocation;
- a runtime skill calling `requestHumanInput`;
- real `~/.hima/skills/handoff/SKILL.md` installation;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- request-human-input.test.ts` ran through the package runner with 431/431 tests passing. |
| Service import | PASS: the full core package test import surface loads after exporting `request-human-input.ts`. |
| JSONL replay | PASS: test covers append order and malformed-line rejection. |
| Run-set event | PASS: test confirms `HUMAN_INPUT_REQUESTED` is recorded in planning state. |

```yaml
Falsifies-If:
  kill-condition: This local service proof is used as proof that a live runtime invoked the skill, a human answered, or a real ~/.hima skill install occurred.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv08-human-handoff-local-service.md
  on-fail: Reopen cycle-82 as BLOCKED_HARV08_PROXY_COMPLETION and restore the live-invocation/user-home blockers.
```
