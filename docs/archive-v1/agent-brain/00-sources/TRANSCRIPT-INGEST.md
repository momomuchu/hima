# Transcript Ingest

Status: DRAFT
Created: 2026-05-23

This file defines how transcripts from other PCs become evidence without turning private raw logs into uncontrolled git content.

## Source Policy

Default: do not commit raw transcripts until they are reviewed.

Allowed immediately:

- transcript inventory;
- redacted snippets;
- extracted decisions;
- source metadata;
- trace rows that avoid secrets.

Require explicit review before commit:

- full raw transcripts;
- logs containing credentials, local paths, private customer data, payment data, security material, or third-party private content.

## Recommended Layout

```text
docs/agent-brain/00-sources/
  TRANSCRIPT-INGEST.md
  transcript-index.md              # create after import
  redacted-extracts/                # safe committed excerpts

external/private-transcripts/       # optional local-only, do not commit by default
```

If raw transcripts must stay outside git, record their local path and hash in the index.

## Transcript Index Schema

```yaml
transcript-id:
machine:
runtime:
source-path:
date-range:
topic:
privacy-status: raw-private | redacted-committed | summary-only
hash:
imported-by:
import-date:
notes:
```

## Extraction Passes

### Pass 1 - Inventory

Collect:

- machine;
- runtime;
- date;
- conversation topic;
- source path;
- privacy status.

Output:

- `transcript-index.md`.

### Pass 2 - Behavioral Signals

Extract:

- explicit corrections;
- repeated user preferences;
- frustration signals;
- repeated workflow requests;
- examples of good behavior;
- examples of bad behavior;
- decisions and reversals.

Output:

- candidate rows in `06-trace/TRACEABILITY.md`.

### Pass 3 - Principle Mapping

Map extracted signals to:

- principles;
- anti-patterns;
- protocols;
- goals;
- tests.

Output:

- updated `02-principles/PRINCIPLES.md`;
- updated `03-behaviors/PROTOCOLS.md`;
- updated `05-tests/TEST.md`.

### Pass 4 - Contradiction Review

List:

- conflicting user preferences;
- old rules superseded by newer corrections;
- machine-specific differences;
- runtime-specific limitations.

Output:

- contradiction rows in `06-trace/TRACEABILITY.md`.

## Promotion Gate

A transcript-derived rule can be promoted when:

- it has explicit source metadata;
- it changes agent behavior;
- it has no unresolved contradiction;
- it has a replay test or a clear reason no replay is possible;
- it has a Falsifies-If block.

## Import Checklist For Other PC

1. Pull latest branch.
2. Locate local transcript exports.
3. Copy raw transcripts to a private holding folder or keep them in place.
4. Create transcript index entries.
5. Extract redacted behavioral signals.
6. Update trace rows.
7. Add replay tests.
8. Commit only safe summaries unless raw commit is explicitly approved.

```yaml
Falsifies-If:
  kill-condition: >
    Raw transcripts are committed before privacy review or transcript-derived
    rules are promoted without source metadata.
  checkpoint-date: 2026-06-23
  evidence-anchor: git diff + docs/agent-brain/00-sources/transcript-index.md + docs/agent-brain/06-trace/TRACEABILITY.md
  on-fail: remove raw transcript content from the branch, retain only redacted summaries, and re-run trace mapping.
```
