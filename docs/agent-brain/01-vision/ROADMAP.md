# Roadmap

Status: DRAFT
Created: 2026-05-23

## Roadmap Principle

The roadmap is not a wish list. It is the ordered sequence that makes the brain more portable, more evidenced, and more behaviorally accurate.

## Now

### R1 - Portable Skeleton

Create the file structure, basic contracts, and push guide.

Done when:

- `docs/agent-brain/` exists in git;
- every major layer has a Markdown entry point;
- the pack can be pulled on another PC.

Kill condition:

- the pack exists only as chat output or local uncommitted files.

### R2 - Transcript Import

Bring transcripts from other PCs into `00-sources/transcripts/` or an equivalent ignored/raw source area, then create an index.

Done when:

- each transcript has source machine, date, runtime, topic, and confidence metadata;
- raw transcripts are either safely committed when appropriate or indexed as external private paths;
- no private credential/secret material is copied into public git.

Kill condition:

- transcripts are imported without provenance or privacy review.

## Next

### R3 - Principle Extraction

Extract behavior principles from transcripts.

Done when:

- each candidate principle has at least one source anchor;
- repeated patterns are merged;
- contradictions are listed instead of hidden.

Kill condition:

- principles are promoted because they sound plausible but have no transcript support.

### R4 - Protocol Conversion

Turn principles into executable protocols.

Done when:

- each promoted principle has a matching protocol or an explicit skip reason;
- protocols include input, action, evidence, stop, and escalation.

Kill condition:

- protocols describe intent but do not change agent decisions.

### R5 - Taste Seed

Build `TEST.md` into a real replay harness for taste and behavior.

Done when:

- at least 10 transcript-derived examples exist;
- each example has expected behavior and failure mode;
- future agents can self-check before changing the kernel.

Kill condition:

- test examples are generic and do not encode the user's taste.

## Later

### R6 - Runtime Promotion

Promote stable behavior into the active runtime kernel or install process.

Done when:

- every promoted rule has trace evidence and replay tests;
- the push guide explains how to apply it on another machine;
- stale or contradicted rules are demoted.

Kill condition:

- generated runtime files are edited without updating source templates or install path.

### R7 - Drift Review

Run periodic comparison between actual conversations and the brain.

Done when:

- drift is logged;
- repeated corrections update principles or tests;
- stale rules are removed or superseded.

Kill condition:

- the brain becomes ceremonial and stops influencing behavior.

```yaml
Falsifies-If:
  kill-condition: >
    The roadmap accumulates more than three active bets at once or lacks kill
    conditions for imported transcript work.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/01-vision/ROADMAP.md + docs/agent-brain/04-goals/SHORT-TERM-GOAL.md
  on-fail: collapse roadmap to one active import goal and one active replay-test goal.
```
