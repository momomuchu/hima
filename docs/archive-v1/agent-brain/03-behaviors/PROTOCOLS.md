# Protocols

Status: DRAFT
Created: 2026-05-23

Protocols convert principles into repeatable behavior.

## Protocol Template

```yaml
id:
name:
owned-principles:
lifecycle:
trigger:
inputs:
actions:
evidence:
stop-condition:
escalation:
test:
```

## BRAIN-001 - Start Meaningful Work

Owned principles: P1, P2, P6
Lifecycle: intake

Trigger:

- user asks for broad setup, behavior design, roadmap, runtime change, push, or multi-file work.

Actions:

1. Name the goal and desired end state.
2. Classify risk.
3. Identify facts, assumptions, constraints, touched surfaces, and evidence path.
4. Use reversible assumptions unless a real human decision is needed.
5. If execution is explicit, write files instead of stopping at a proposal.

Evidence:

- updated Markdown artifact;
- command output or diff;
- status summary.

Stop condition:

- missing credential, unsafe external effect, unclear product decision, or impossible write target.

Test:

- `05-tests/TEST.md` case TASTE-001.

## BRAIN-002 - Ingest Transcripts

Owned principles: P3, P4
Lifecycle: research, extraction

Trigger:

- user imports transcripts from another PC or points to conversation logs.

Actions:

1. Inventory files by machine, date, runtime, and source path.
2. Separate raw private content from committed summaries.
3. Extract corrections, repeated preferences, decisions, anti-patterns, and examples.
4. Add trace rows for every promoted principle candidate.
5. Mark unsupported insights as `CANDIDATE`.

Evidence:

- `00-sources/transcript-index.md` or equivalent;
- updated `06-trace/TRACEABILITY.md`;
- updated `05-tests/TEST.md`.

Stop condition:

- transcripts contain credentials, secrets, private third-party data, or unclear commit permission.

## BRAIN-003 - Promote A Principle

Owned principles: P3, P7
Lifecycle: review, promotion

Trigger:

- a candidate principle is used repeatedly or requested for kernel inclusion.

Actions:

1. Find supporting transcript evidence.
2. Check for contradictions.
3. Map to lifecycle and protocol.
4. Add at least one replay test.
5. Add or confirm Falsifies-If.
6. Change status from `CANDIDATE` to `PROMOTED` only after evidence review.

Evidence:

- trace row;
- principle status update;
- replay test.

Stop condition:

- no evidence, unresolved contradiction, or conflict with higher-level vision.

## BRAIN-004 - Convert Work Into Goals

Owned principles: P2, P7
Lifecycle: goal, execution

Trigger:

- user asks for durable work, multi-step execution, roadmap step, or sprint-like effort.

Actions:

1. Write or update a Markdown goal.
2. Include objective, success criteria, non-goals, constraints, Falsifies-If, evidence path, next checkpoint, and stop condition.
3. Keep active and archived goals separate.
4. Do not close goals on numeric thresholds alone.

Evidence:

- `04-goals/SHORT-TERM-GOAL.md`;
- archive entry when closed.

Stop condition:

- goal conflicts with vision/roadmap or lacks a meaningful evidence path.

## BRAIN-005 - Run Taste Replay

Owned principles: P4, P7
Lifecycle: validation

Trigger:

- behavior rule, prompt, protocol, or runtime instruction changes.

Actions:

1. Select relevant examples from `TEST.md`.
2. Compare actual/expected behavior.
3. Record pass, fail, or needs-transcript.
4. If failure is material, update protocol or principle before promotion.

Evidence:

- replay notes in `TEST.md` or a dated result file.

Stop condition:

- no relevant example exists; add one before claiming behavior coverage.

## BRAIN-006 - Push Portable Brain

Owned principles: P5, P8
Lifecycle: handoff, push

Trigger:

- user asks to push/pouche/publish for another PC.

Actions:

1. Check git status and remote.
2. Inspect unrelated changes.
3. Stage only intended files.
4. Commit with a terse message.
5. Push the branch.
6. Provide branch, commit, and pull instructions.

Evidence:

- git status before and after;
- commit hash;
- push output.

Stop condition:

- missing git auth, inaccessible remote, dirty unrelated changes that cannot be separated, or failed checks.

```yaml
Falsifies-If:
  kill-condition: >
    A future agent cannot decide which protocol owns transcript import, principle
    promotion, goal creation, taste replay, or push.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/03-behaviors/PROTOCOLS.md
  on-fail: split protocols into one file per lifecycle and add ownership tables.
```
