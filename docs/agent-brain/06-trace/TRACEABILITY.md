# Traceability

Status: DRAFT
Created: 2026-05-23

This file links transcript evidence to principles, protocols, goals, and tests.

## Trace Row Schema

```yaml
trace-id:
source:
source-type: transcript | local-file | explicit-user-decision | inference
date:
summary:
evidence:
confidence: high | medium | low
principles:
protocols:
goals:
tests:
status: candidate | promoted | contradicted | superseded
notes:
```

## Seed Rows

### TRACE-001 - Goals In Markdown

Source: local repo precedent
Source type: local-file
Date: 2026-05-23
Summary: The repo already uses durable Markdown goals and a goal cadence.
Evidence:

- `docs/goals/README.md`
- `docs/goals/LONG-TERM-GOAL.md`
- `docs/goals/SHORT-TERM-GOAL.md`

Confidence: high
Principles: P2, P7
Protocols: BRAIN-004
Goals: `04-goals/LONG-TERM-GOAL.md`, `04-goals/SHORT-TERM-GOAL.md`
Tests: TASTE-004
Status: candidate

### TRACE-002 - Portable Brain Request

Source: current session
Source type: explicit-user-decision
Date: 2026-05-23
Summary: User explicitly requested writing files and pushing so another PC can pull and continue.
Evidence: user instruction in current session.
Confidence: high
Principles: P5, P8
Protocols: BRAIN-006
Goals: `04-goals/SHORT-TERM-GOAL.md`
Tests: TASTE-002, TASTE-006
Status: candidate

### TRACE-003 - Vision/Roadmap/Brain/Test Objects

Source: current session
Source type: explicit-user-decision
Date: 2026-05-23
Summary: User named vision/roadmap, Markdown goals, brain, and `test.md` taste seed as first-class objects.
Evidence: user instruction in current session.
Confidence: high
Principles: P1, P2, P4
Protocols: BRAIN-001, BRAIN-004, BRAIN-005
Goals: `01-vision/ROADMAP.md`, `05-tests/TEST.md`, `08-brain/BRAIN.md`
Tests: TASTE-001
Status: candidate

## Contradictions

No transcript contradictions imported yet.

Use this format:

```yaml
contradiction-id:
sources:
conflict:
newer-source:
decision:
affected-principles:
affected-tests:
```

## Promotion Ledger

No principles promoted yet. Promotion waits for transcript import or explicit confirmation.

```yaml
promotion-id:
date:
principle:
from-status:
to-status:
evidence:
reviewer:
notes:
```

```yaml
Falsifies-If:
  kill-condition: >
    Principle or behavior files mark rules as promoted while this trace file has
    no matching evidence rows.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/02-principles/PRINCIPLES.md + docs/agent-brain/03-behaviors/BEHAVIOR-CATALOG.md + docs/agent-brain/06-trace/TRACEABILITY.md
  on-fail: revert statuses to candidate and rebuild trace rows from transcripts.
```
