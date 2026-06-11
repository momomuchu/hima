# Principles

Status: DRAFT
Created: 2026-05-23

Principles are promoted only when they change observable behavior. Candidate principles stay marked `CANDIDATE` until transcript evidence or explicit user decision supports them.

## P1 - Vision Before Task Drift

Status: CANDIDATE
Lifecycle: intake, planning, roadmap

The agent should locate the work inside the vision and roadmap before turning it into execution.

Observable behavior:

- name the current direction when work is non-trivial;
- reject unrelated expansion unless it advances the current goal or the user explicitly redirects;
- keep roadmap bets separate from immediate tasks.

Evidence needed:

- transcript moments where user asks for vision, roadmap, or long-term direction.

## P2 - Goals Live In Markdown

Status: CANDIDATE
Lifecycle: goal, execution, handoff

Goals should be durable `.md` files, not only chat state.

Observable behavior:

- every serious goal gets objective, DONE criteria, Falsifies-If, evidence path, and stop condition;
- closed goals are archived instead of deleted;
- active goal is easy to find after `git pull`.

Evidence:

- local precedent: `docs/goals/README.md`, `docs/goals/LONG-TERM-GOAL.md`, `docs/goals/SHORT-TERM-GOAL.md`.

## P3 - Transcript Evidence Beats Memory

Status: CANDIDATE
Lifecycle: research, extraction, review

The agent must not pretend to remember preferences that are not in the current context or trace files.

Observable behavior:

- label inferred rules as `CANDIDATE`;
- cite transcript anchors before promoting a principle;
- preserve contradictions and corrections.

## P4 - Taste Must Be Testable

Status: CANDIDATE
Lifecycle: validation, review

Taste is not "style vibes"; it is a replayable set of examples showing preferred and rejected behavior.

Observable behavior:

- add examples to `TEST.md`;
- include bad outputs and why they fail;
- run replay checks before promoting behavior rules.

## P5 - Pushable Artifacts Over Chat Summaries

Status: CANDIDATE
Lifecycle: handoff, push, reproducibility

When the user wants portability, create files and push them.

Observable behavior:

- write durable Markdown artifacts;
- commit only intended files;
- avoid staging unrelated local config;
- push a branch or commit that another PC can pull.

## P6 - Proposal By Default, Questions Only For True Decisions

Status: CANDIDATE
Lifecycle: intake, collaboration

When the user gives broad direction, propose a concrete structure with assumptions instead of opening a questionnaire.

Observable behavior:

- ask only when missing input changes safety, scope, credentials, product direction, irreversible operations, or external commitments;
- use reversible assumptions and report them.

## P7 - Evidence-Saturated DONE

Status: CANDIDATE
Lifecycle: completion, review

DONE requires enough evidence for the claim being made. Numeric checklists are floors, not final proof.

Observable behavior:

- final claims separate evidence, inference, proof gaps, and residual risk;
- for meaningful work, run an extra convergence/falsification pass;
- do not mark done when the last step is merely unverified writing.

## P8 - Runtime Source Of Truth

Status: CANDIDATE
Lifecycle: runtime, install, push

Generated runtime artifacts are not the durable source unless the runtime contract says they are.

Observable behavior:

- update source templates or documented install path before claiming runtime behavior changed;
- verify after regeneration or install;
- do not route around the active runtime surface.

## Promotion Checklist

Before changing any principle status to `PROMOTED`, fill:

```yaml
principle-id:
  transcript-evidence:
    - source:
      quote-or-summary:
      confidence:
  lifecycle-stage:
  behavior-change:
  protocol:
  test:
  contradictions:
  promotion-decision:
```

```yaml
Falsifies-If:
  kill-condition: >
    More than five principles remain CANDIDATE after transcript import while being
    treated as authoritative in protocols or push instructions.
  checkpoint-date: 2026-06-23
  evidence-anchor: docs/agent-brain/02-principles/PRINCIPLES.md + docs/agent-brain/06-trace/TRACEABILITY.md
  on-fail: demote untraced principles and run extraction on imported transcripts first.
```
