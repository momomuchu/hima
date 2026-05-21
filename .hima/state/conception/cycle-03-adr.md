---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-03-specification-excellence-application
deliverable: C3-4
decision-id: ADR-CYCLE-03-C1
---

# ADR-CYCLE-03-C1 — Target Stream C1 Before Further Runtime Hooks

## Status

Accepted.

## Context

Cycle-02d closed the SubagentStop deliverables gate. The active short-term goal now requires a
spec-driven-development application and a technical spec for a named item from the master plan.

The master plan's next unchecked phase is Stream C, the DDD refactor of `packages/core/`.
The first item is C1: identify six bounded contexts: Run, Cycle, Gate, Skill, Subagent,
Evidence.

## Decision

Cycle-03 targets Stream C1. It will produce the implementation-ready specification for the
bounded-context map before any C2-C7 refactor work starts.

## Rationale

- C1 is the first unchecked item in the next active construction stream.
- Later DDD items depend on C1; starting with C2 would force code movement before ownership
  boundaries are stable.
- The spec-driven-development book applies directly because an AI agent will execute future
  implementation and the change crosses architecture boundaries.
- A documentation-only C1 spec can be verified with acceptance rows, file inventory, and
  critic review before implementation risk is introduced.

## Rejected Alternatives

| Alternative | Rejection reason |
|---|---|
| Continue with D-H3/D-H4/D-H5 hooks first | Hooks remain important, but D-H2 just closed and the master plan's next phase after runtime unblock is Stream C. More hooks before context ownership would deepen service-layer sprawl. |
| Implement C1 immediately without a spec | Rejected by the active cycle-03 goal and by the spec-driven-development book's AI-agent execution rule. |
| Target MCP D-M1 first | MCP tooling depends on stable core boundaries and would likely expose current service-layer coupling as public API. |
| Apply every 03-specification book in full | Too broad for this cycle; the selected book is enough to establish the spec discipline for C1. |

## Consequences

- Future Stream C work must use `docs/excellence-application/03-specification/cycle-03-technical-spec.md` as its acceptance contract.
- C1 is not complete until the bounded-context map exists and each acceptance row has evidence.
- If implementation finds a better first Stream C item, the spec must be revised before tasks change.

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: A later Stream C implementation starts from hook/service code movement instead of the C1 bounded-context map acceptance rows.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/03-specification/cycle-03-technical-spec.md
  on-fail: Revert the Stream C task ordering to C1 or write a superseding ADR with evidence.
```
