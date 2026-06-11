---
cycle-id: agent-brain-long-term
claim-bearing: true
status: ACTIVE
opened: 2026-05-23
closed:
supersedes: (none)
---

# Long-Term Goal - Portable Agent Brain

## Objective

Create a transcript-backed, pushable, Markdown-native agent brain that preserves the user's preferred behavior across PCs, sessions, and runtimes.

## Desired End State

Another PC can pull this repo, import its local transcripts, and continue refining the same behavior system without relying on hidden memory from any single session.

## Success Criteria

1. `docs/agent-brain/` contains stable entry points for vision, roadmap, principles, behaviors, goals, tests, traceability, and push.
2. Imported transcripts can be indexed with machine/date/runtime/topic/provenance metadata.
3. Every promoted principle maps to at least one transcript anchor, one protocol, and one replay test.
4. Active work is expressed as Markdown goals with Falsifies-If and evidence path.
5. The push guide lets another machine reproduce the state using git.
6. The taste seed contains enough examples to detect obvious drift in agent behavior.

## Non-Goals

- Do not commit raw private transcripts unless explicitly reviewed and approved.
- Do not replace the main hima runtime contract in this cycle.
- Do not promote candidate rules without trace evidence.
- Do not treat this pack as a production runtime installer.

## Evidence Path

- `docs/agent-brain/README.md`
- `docs/agent-brain/00-sources/TRANSCRIPT-INGEST.md`
- `docs/agent-brain/02-principles/PRINCIPLES.md`
- `docs/agent-brain/03-behaviors/PROTOCOLS.md`
- `docs/agent-brain/04-goals/SHORT-TERM-GOAL.md`
- `docs/agent-brain/05-tests/TEST.md`
- `docs/agent-brain/06-trace/TRACEABILITY.md`
- git commit and push metadata

## Stop Conditions

Stop and ask before:

- committing raw transcripts that may contain secrets, private data, or third-party content;
- changing active runtime install behavior;
- staging unrelated local config;
- force-pushing or rewriting shared history.

```yaml
Falsifies-If:
  kill-condition: >
    By the first transcript-import checkpoint, promoted rules cannot be traced to
    transcripts or explicit user decisions, or another PC cannot discover the
    brain after git pull.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/06-trace/TRACEABILITY.md + docs/agent-brain/07-push/PUSH-GUIDE.md
  on-fail: reduce the brain to four mandatory files: BRAIN.md, SHORT-TERM-GOAL.md, TEST.md, TRACEABILITY.md.
```
