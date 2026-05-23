# Behavior Catalog

Status: DRAFT
Created: 2026-05-23

This catalog is a lightweight registry. Detailed procedures live in `PROTOCOLS.md`.

| ID | Behavior | Lifecycle | Risk floor | Principle | Protocol | Test |
|---|---|---|---|---|---|---|
| BEH-BRAIN-001 | Start meaningful work with goal/risk/evidence path | Intake | M | P1/P2/P6 | BRAIN-001 | TASTE-001 |
| BEH-BRAIN-002 | Ingest transcripts with provenance and privacy review | Research | M | P3/P4 | BRAIN-002 | TASTE-002 |
| BEH-BRAIN-003 | Promote principles only with trace evidence | Review | M | P3/P7 | BRAIN-003 | TASTE-003 |
| BEH-BRAIN-004 | Convert durable work into Markdown goals | Goal | M | P2/P7 | BRAIN-004 | TASTE-004 |
| BEH-BRAIN-005 | Use taste replay before behavior promotion | Validation | M | P4/P7 | BRAIN-005 | TASTE-005 |
| BEH-BRAIN-006 | Push only intended portable files | Handoff | L | P5/P8 | BRAIN-006 | TASTE-006 |

## Status Legend

- `CANDIDATE`: described but not transcript-backed yet.
- `PROMOTED`: trace-backed and replay-tested.
- `REJECTED`: contradicted or not useful.
- `SUPERSEDED`: replaced by a newer behavior.

Current status: all rows are `CANDIDATE` until transcript import completes.

## Promotion Packet

```yaml
behavior-id:
status:
source-principles:
transcript-evidence:
protocol:
tests:
conflicts:
decision:
date:
```

```yaml
Falsifies-If:
  kill-condition: >
    A behavior is marked PROMOTED while its trace row or replay test is missing.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/03-behaviors/BEHAVIOR-CATALOG.md + docs/agent-brain/06-trace/TRACEABILITY.md + docs/agent-brain/05-tests/TEST.md
  on-fail: revert promoted status to CANDIDATE and add missing evidence before retry.
```
