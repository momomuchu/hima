# Goal Cadence

Status: DRAFT
Created: 2026-05-23

This folder carries the portable brain's goals. It mirrors the repo-level goal pattern but keeps the brain import/push work separate from active hima implementation cycles.

## Files

| File | Role |
|---|---|
| `LONG-TERM-GOAL.md` | Durable end state for the portable brain. |
| `SHORT-TERM-GOAL.md` | Current active cycle. |
| `archive/` | Closed or cancelled brain goals. |

## Rules

1. Goals are Markdown files.
2. Active work lives in `SHORT-TERM-GOAL.md`.
3. Long-term direction changes only on explicit user direction or falsifier fire.
4. DONE requires evidence, not just file creation.
5. Closed goals are archived, not deleted.
6. Imported transcript work must preserve privacy boundaries.

## Required Goal Sections

Each goal needs:

- objective;
- desired end state;
- success criteria;
- non-goals;
- constraints;
- evidence path;
- stop condition;
- Falsifies-If;
- next checkpoint.

```yaml
Falsifies-If:
  kill-condition: >
    Brain work happens across multiple sessions without an active Markdown goal
    or closed goals lose their evidence anchors.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/04-goals/SHORT-TERM-GOAL.md + docs/agent-brain/04-goals/archive/
  on-fail: pause new brain edits until active and archived goals are reconciled.
```
