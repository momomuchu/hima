# Portable Agent Brain

Status: DRAFT
Owner: Maache
Created: 2026-05-23
Risk route: M

This directory is the portable behavior brain for the agent runtime. It is meant to move across machines by git, absorb transcripts from other PCs, and turn repeated conversation patterns into vision, principles, protocols, goals, tests, and push instructions.

It is not the full source of truth for the existing hima runtime. It is a portable working pack that can later be merged into the active runtime kernel after evidence review.

## Read Order

1. `08-brain/BRAIN.md` - the compact mental model.
2. `01-vision/VISION.md` - durable vision and what this brain is for.
3. `01-vision/ROADMAP.md` - now/next/later sequencing.
4. `02-principles/PRINCIPLES.md` - principles to preserve.
5. `03-behaviors/PROTOCOLS.md` - executable behaviors.
6. `04-goals/README.md` - goal cadence.
7. `05-tests/TEST.md` - taste seed and replay tests.
8. `06-trace/TRACEABILITY.md` - transcript-to-rule mapping.
9. `00-sources/TRANSCRIPT-INGEST.md` - how to import transcripts from other PCs.
10. `07-push/PUSH-GUIDE.md` - how to pull and continue on another PC.

## Directory Map

| Path | Role |
|---|---|
| `00-sources/` | Transcript import, source inventory, evidence handling. |
| `01-vision/` | Product/behavior vision and roadmap principles. |
| `02-principles/` | Stable rules, anti-patterns, refusal rules. |
| `03-behaviors/` | Operational protocols and behavior catalog. |
| `04-goals/` | Long-term and short-term Markdown goals. |
| `05-tests/` | Taste seed, replay examples, behavioral checks. |
| `06-trace/` | Mapping from transcript evidence to principles, protocols, and tests. |
| `07-push/` | Reproduction and push/pull workflow for other machines. |
| `08-brain/` | Compact brain summary injectable into future sessions. |

## Core Contract

Every durable rule must have:

- a short label;
- a lifecycle stage;
- an observable behavior;
- at least one evidence anchor or an explicit `UNPROVEN` marker;
- a Falsifies-If block;
- a test or replay case when practical.

Rules without evidence can exist only as candidates. They cannot be promoted to kernel behavior until they survive transcript mapping and replay.

## Lifecycle

1. Ingest transcripts.
2. Extract decisions, corrections, preferences, and repeated patterns.
3. Normalize into principles.
4. Convert principles into protocols.
5. Convert protocols into Markdown goals.
6. Add taste/replay tests.
7. Push the pack.
8. Pull on another PC and repeat.

## Promotion Rule

A candidate behavior is promoted only when:

- at least two independent transcript moments support it, or one explicit user correction is strong enough;
- it changes an observable agent decision;
- it has a stop condition or evidence path;
- it does not conflict with a higher-level vision, roadmap, or safety boundary.

```yaml
Falsifies-If:
  kill-condition: >
    The pack accumulates principles that cannot be traced to transcripts, replay tests,
    or explicit user decisions, and those principles start being treated as authoritative.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/06-trace/TRACEABILITY.md + docs/agent-brain/05-tests/TEST.md
  on-fail: demote untraced principles to CANDIDATE and run transcript replay before promotion.
```
