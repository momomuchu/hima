---
claim-bearing: true
status: PENDING_VERIFICATION
cycle-id: cycle-72-north-star-metric
artifact: docs/business-model/north-star-metric.md
---

# Stream H North-Star Metric

## Result

Cycle 72 created `docs/business-model/north-star-metric.md` as a local metric definition and instrumentation plan for H7.

The artifact defines:

- primary north-star metric: activated governed task rate;
- activation event: `first_governed_task_activated`;
- numerator, denominator, and exclusions;
- instrumentation fields;
- evidence sources;
- guardrail metrics;
- review cadence;
- falsifiers and public claim rules.

## Boundary

The metric is not measured activation, retention proof, beta completion, revenue proof, market validation, public release evidence, npm evidence, sale-page readiness, legal certification, or real runtime/model-session evidence.

## Verification

| Check | Result |
|---|---|
| North-star metric structure check | PASS: metric decision, activation event, numerator/denominator, instrumentation plan, evidence sources, guardrails, review cadence, falsifiers, public claim rules, and Falsifies-If are present. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only explicit blocked/non-goal wording and the still-open sale-page target remained; no measured activation, retention, beta, revenue, launch, compliance, or runtime completion claim remained. |

## Remaining Boundaries

The metric is not external evidence. Real activation, retention, beta, revenue, launch, npm, sale-page, user-contact, and runtime/model-session evidence remain future gates.

Falsifies-If:
  kill-condition: The north-star metric is presented as measured activation or retention before real instrumentation and external usage evidence exist.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/09-quality-release-run/stream-h-north-star-metric.md
  on-fail: Remove the measured-traction claim and reopen Stream H metric instrumentation proof.
