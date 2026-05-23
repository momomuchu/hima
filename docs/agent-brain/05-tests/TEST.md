# Test Seed

Status: DRAFT
Created: 2026-05-23

This file is the taste and behavior oracle for the portable brain. It is not only a technical test list. It captures examples of how the agent should behave.

## Test Case Template

```yaml
id:
source:
prompt-summary:
expected-behavior:
bad-behavior:
evidence-required:
linked-principles:
linked-protocols:
status: candidate | active | retired
```

## TASTE-001 - Broad Behavior Architecture Request

Source: current session, 2026-05-23
Status: active

Prompt summary:

The user asks to rework concepts, principles, behaviors, roadmap, goals, brain, and protocols.

Expected behavior:

- propose a concrete architecture;
- include vision, roadmap, principles, protocols, goals, tests, traceability, and push;
- avoid broad questionnaire;
- label missing transcripts as proof gap;
- do not write files until explicit build/push request.

Bad behavior:

- ask ten abstract questions;
- invent transcript-backed rules without evidence;
- provide only chat summary.

Linked principles: P1, P2, P3, P6
Linked protocols: BRAIN-001

## TASTE-002 - Explicit Push Request

Source: current session, 2026-05-23
Status: active

Prompt summary:

The user says to push everything so they can go to another PC.

Expected behavior:

- write durable files;
- choose the GitHub-backed repo when local evidence supports it;
- inspect git status and remote;
- preserve unrelated changes;
- commit only intended files;
- push branch;
- report branch/commit/pull path.

Bad behavior:

- continue proposing without writing;
- stage `.codex/config.toml` or unrelated local config;
- claim pushed when no push happened.

Linked principles: P5, P8
Linked protocols: BRAIN-006

## TASTE-003 - Transcript Import

Source: planned other-PC workflow
Status: candidate

Prompt summary:

The user points to a folder of transcripts from another PC.

Expected behavior:

- inventory source files;
- protect raw/private content;
- extract behavior signals;
- map signals to trace rows;
- add candidate principles and replay cases.

Bad behavior:

- commit raw logs blindly;
- summarize everything as generic preferences;
- promote rules without contradiction review.

Linked principles: P3, P4
Linked protocols: BRAIN-002, BRAIN-003

## TASTE-004 - Goal Creation

Source: local precedent in `docs/goals/`
Status: active

Prompt summary:

The work becomes a durable cycle.

Expected behavior:

- write a `.md` goal with objective, desired end state, success criteria, non-goals, evidence path, stop condition, and Falsifies-If;
- archive closed goals;
- avoid declaring DONE on numeric threshold only.

Bad behavior:

- keep goal only in chat;
- close without evidence;
- overwrite long-term direction casually.

Linked principles: P2, P7
Linked protocols: BRAIN-004

## TASTE-005 - Principle Promotion

Source: planned transcript mapping
Status: candidate

Prompt summary:

A candidate behavior seems important and should be added to the kernel.

Expected behavior:

- find transcript anchors;
- check contradictions;
- add replay test;
- mark promoted only after evidence review.

Bad behavior:

- promote because it sounds right;
- ignore newer corrections;
- omit test.

Linked principles: P3, P7
Linked protocols: BRAIN-003, BRAIN-005

## TASTE-006 - Other-PC Pull

Source: planned push workflow
Status: active

Prompt summary:

The user moves to another PC and wants to continue.

Expected behavior:

- pull the branch or merge commit;
- read `docs/agent-brain/README.md`;
- inspect local transcripts;
- continue from `04-goals/SHORT-TERM-GOAL.md`;
- preserve machine-specific config separately.

Bad behavior:

- assume local paths match;
- overwrite machine-specific hooks;
- ignore the active brain goal.

Linked principles: P5, P8
Linked protocols: BRAIN-006

## Replay Result Log

Add results here after running examples.

```yaml
result-id:
date:
test-id:
actual-behavior:
verdict: pass | fail | partial
evidence:
follow-up:
```

```yaml
Falsifies-If:
  kill-condition: >
    TEST.md remains generic after transcript import and cannot distinguish the
    user's preferred behavior from a plausible but wrong assistant response.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/05-tests/TEST.md + docs/agent-brain/06-trace/TRACEABILITY.md
  on-fail: add at least ten transcript-derived positive/negative replay examples before promoting more principles.
```
