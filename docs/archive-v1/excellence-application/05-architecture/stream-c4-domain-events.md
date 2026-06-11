---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-08-stream-c4-domain-events
deliverable: C8-4
---

# Stream C4 Domain Events

## Decision

Cycle-08 adds explicit domain-event vocabulary for the append-only event log while preserving
legacy run-set projections needed by current convergence and policy code.

`packages/core/src/domain/events.ts` defines the C4 event names:

- `TransitionRequested`
- `TransitionExecuted`
- `GateEvaluated`
- `EvidenceAdded`
- `RunClosed`
- `RiskClassPromoted`
- `SubagentLaunched`
- `SubagentReturned`

`.hima/state/events.jsonl` entries now validate against that domain-event vocabulary. Run-set
events may still carry legacy projection types such as `STATE_TRANSITIONED`, `GATE_EVALUATED`,
`EVIDENCE_ADDED`, and `RUN_CLOSED`; event-log entries wrap those projections with owner metadata
and the context-named domain event type.

## Owner Mapping

| Event | Owner | Emission status |
|---|---|---|
| `TransitionRequested` | Cycle | Emitted by `RunAggregate.transition` before the executed transition event is logged, after transition calculation succeeds. |
| `TransitionExecuted` | Cycle | Emitted by `RunAggregate.transition` through the event-log projection of the run-set transition event. |
| `GateEvaluated` | Gate | Emitted by `handleHook` through `appendRunEvent` for non-subagent gate evaluations. |
| `EvidenceAdded` | Evidence | Emitted by `addEvidence` through `appendRunEvent` after evidence is accepted into the run set. |
| `RunClosed` | Run | Emitted by `closeRun` through `appendRunEvent`. |
| `RiskClassPromoted` | Gate | Emitted by `enterDevelopment` when its persisted project-root state update promotes risk class. Demotions and no-change updates do not emit this event. |
| `SubagentLaunched` | Subagent | Emitted by `handleHook` for `subagent_start` gate evaluations. |
| `SubagentReturned` | Subagent | Emitted by `handleHook` for `subagent_stop` gate evaluations. |

## Compatibility Rule

The Evidence-owned event log is the canonical domain-event stream. The run-set `events` array
remains a compatibility projection used by current convergence and policy blockers.

This keeps C4 from accidentally starting C5 repositories or C6 invariants. Storage shape changes
are limited to event-log validation and event-log payload wrapping.

## Verification Evidence

Focused tests cover:

- event-log schema accepts domain-event names and rejects legacy names;
- transitions emit `TransitionRequested` and `TransitionExecuted`;
- gate hooks emit `GateEvaluated`;
- subagent hooks emit `SubagentLaunched` and `SubagentReturned`;
- evidence additions emit `EvidenceAdded`;
- development entry emits `RiskClassPromoted` when it promotes risk class;
- close-run continues to append `RunClosed` through the event-log projection;
- ledger verification remains green for run-set event payloads.

Required closure commands:

```powershell
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A runtime path appends a legacy event type directly into `.hima/state/events.jsonl` without wrapping it in a context-named domain event.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/storage/events-log.ts
  on-fail: Reopen Stream C4 and restore domain-event-log validation before C5-C7 continue.
```
