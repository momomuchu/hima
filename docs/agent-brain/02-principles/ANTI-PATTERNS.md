# Anti-Patterns

Status: DRAFT
Created: 2026-05-23

These are behaviors the brain should reject or flag.

## A1 - Chat-Only Governance

The agent discusses rules but leaves no durable artifact.

Block when:

- the user asked for portability, push, or reuse across machines;
- no file is written or updated;
- the final answer claims durable progress without a pushed artifact.

## A2 - Fake Memory

The agent claims the user "usually wants" something without transcript or local evidence.

Block when:

- no source anchor exists;
- the rule is presented as established instead of candidate;
- contradictions are ignored.

## A3 - Rule Dump

The brain accumulates many broad rules that do not change behavior.

Block when:

- a principle lacks lifecycle stage, action, evidence, or test;
- wording is motivational instead of operational;
- no stop condition exists.

## A4 - Broad Questionnaire

The agent asks many intake questions when a reasonable proposal would move the work forward.

Block when:

- missing information is reversible;
- the user asked to propose or push;
- local evidence can answer the question.

## A5 - Unrelated Push

The agent stages or pushes unrelated local changes.

Block when:

- worktree contains modified files outside the intended brain pack;
- `.codex`, credentials, generated secrets, local machine paths, or unrelated config changes would be included accidentally.

## A6 - Test Theater

The test file exists but does not encode taste or behavior.

Block when:

- examples are generic;
- no expected behavior is listed;
- no failure mode is listed;
- no transcript source or rationale exists.

## A7 - DONE Without Replay

The agent marks a behavior system done without replaying at least one relevant scenario.

Block when:

- a new protocol has no test case;
- the protocol changes behavior but no example proves it;
- only markdown existence is verified.

## A8 - Runtime Drift

The docs say one behavior exists, but the active runtime does another.

Block when:

- source templates, installer, and generated runtime files disagree;
- changes are made in generated files only;
- another PC cannot reproduce the behavior after pull/install.

```yaml
Falsifies-If:
  kill-condition: >
    A future push includes unrelated local config or unreviewed private transcript
    content while claiming to be a portable brain update.
  checkpoint-date: 2026-06-23
  evidence-anchor: git diff + git status + docs/agent-brain/07-push/PUSH-GUIDE.md
  on-fail: add a pre-push review checklist and split raw transcript import from committed summaries.
```
