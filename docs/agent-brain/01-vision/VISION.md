# Vision

Status: DRAFT
Created: 2026-05-23

## Purpose

This portable brain exists to preserve the user's preferred agent behavior across machines, sessions, and runtime changes.

It should make another PC able to continue the same behavioral system after pulling the repo and importing transcripts.

## Durable Vision

Build a transcript-backed agent brain where conversations become durable operating rules:

- vision and roadmap guide direction;
- Markdown goals drive execution;
- principles encode taste and refusal rules;
- protocols encode behavior;
- tests replay the user's expected taste;
- traceability prevents invented memory;
- push/pull keeps the system portable.

## What This Is

This is:

- a working brain for agent behavior;
- a mapping layer from transcripts to rules;
- a Markdown goal system;
- a replayable taste test surface;
- a pushable handoff artifact for other computers.

## What This Is Not

This is not:

- a replacement for the full hima runtime;
- a hidden memory system with unverifiable claims;
- a chat summary archive;
- a place for every interesting thought;
- a rule dump with no lifecycle mapping.

## Design Principles

1. Filesystem first. The brain must survive without chat context.
2. Transcript-backed. Strong rules come from repeated conversation evidence or explicit corrections.
3. Goal-driven. Work should collapse into Markdown goals with DONE criteria.
4. Taste-aware. The user's preferred style and judgment must be testable, not just described.
5. Portable. Another PC should be able to pull, ingest, and continue.
6. Falsifiable. Every durable claim needs a failure condition.

## Success Criteria

- A new machine can pull the repo and find the brain in under 60 seconds.
- Imported transcripts can be indexed without changing the core schema.
- A future agent can map a transcript quote to a principle, protocol, goal, and test.
- Rules marked authoritative have evidence or explicit user decision anchors.
- The active short-term goal is always visible in Markdown.

```yaml
Falsifies-If:
  kill-condition: >
    The brain cannot be transferred to another PC using git pull plus transcript import,
    or future rules cannot be traced back to user evidence.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/07-push/PUSH-GUIDE.md + docs/agent-brain/06-trace/TRACEABILITY.md
  on-fail: reduce the system to the smallest transferable core: BRAIN, GOALS, TEST, TRACE.
```
