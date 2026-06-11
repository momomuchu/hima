---
claim-bearing: true
status: HYPOTHESIS
cycle-id: cycle-72-north-star-metric
last-updated: 2026-05-14
---

# North-Star Metric

## Scope Boundary

This is a local metric definition and instrumentation plan. It does not prove measured activation, retention, revenue, beta completion, market demand, npm publication, public release, sale-page readiness, legal compliance, or real runtime/model-session success.

## Source Surfaces

- `docs/business-model/business-model-proposal.md` - activation benchmark and time-to-first-value notes.
- `docs/business-model/icp-worksheet.md` - ICP-1 desired outcome and validation thresholds.
- `docs/business-model/message-hierarchy.md` - public-copy claim boundaries and proof framing.
- `docs/business-model/claims-register.csv` - release, runtime, market, compliance, and beta/revenue claim blockers.

## Metric Decision

### Primary North-Star Metric

**Activated governed task rate**:

Percentage of eligible first-time local users who complete one governed Hima task with accepted evidence within 15 minutes of starting the first run.

### Plain-Language Version

How many first-time terminal-agent users reach a reviewable, evidence-backed DONE state fast enough that Hima feels like a workflow upgrade rather than overhead?

### Why This Metric

The ICP is a terminal-agent quality power user. That user will not wait for a dashboard, sales call, or abstract governance promise. The first value moment is a local coding task that reaches a quality-gated completion state with inspectable proof.

This metric intentionally combines:

- **activation** - the user actually reaches first value;
- **speed** - the workflow stays inside the 15-minute tolerance from the ICP worksheet;
- **governance quality** - activation does not count unless accepted evidence exists;
- **local-first fit** - the event can be measured before hosted infrastructure exists.

## Activation Event

Event name: `first_governed_task_activated`

An activation event is valid only when all conditions are true:

1. The user starts a first local Hima run in a real project or approved release fixture.
2. Hima classifies the task risk.
3. Required gates are bound for that risk class.
4. The task reaches a completion state with accepted evidence.
5. The completion record includes a reviewable artifact path.
6. Elapsed time from first command to accepted completion is less than or equal to 15 minutes.
7. The run did not use a bypass, forced DONE state, fabricated evidence, or dry-run-only proof.

## Numerator And Denominator

| Field | Definition |
|---|---|
| Denominator | First-time eligible local users who start a Hima task after installation in a real project or approved release fixture. |
| Numerator | Denominator users who emit one valid `first_governed_task_activated` event within 15 minutes. |
| Exclusions | Existing maintainers, internal construction cycles, dry-run-only hook calls, fake benchmark artifacts, fixture-only runs outside release validation, and users blocked by known install outage. |
| Minimum sample for external claim | 10 external beta users for directional beta wording; 30 eligible external users before homepage-level activation claims. |
| Primary segment | ICP-1 terminal-agent quality power users from `docs/business-model/icp-worksheet.md`. |

## Instrumentation Plan

| Event Field | Type | Required | Purpose |
|---|---|---|---|
| `event_name` | string | yes | Must equal `first_governed_task_activated`. |
| `event_version` | string | yes | Allows schema evolution. |
| `anonymous_user_id` | string | yes | Links first run and completion without storing private code. |
| `project_hash` | string | yes | Differentiates projects without retaining paths publicly. |
| `runtime_target` | string | yes | Tracks Claude, Codex, Hermes, or local fixture target. |
| `risk_class` | string | yes | Confirms the task went through classification. |
| `started_at` | ISO timestamp | yes | Start of first run. |
| `completed_at` | ISO timestamp | yes | Accepted completion time. |
| `elapsed_seconds` | integer | yes | Enforces the 15-minute threshold. |
| `accepted_evidence_count` | integer | yes | Blocks empty activation. |
| `evidence_artifact_paths` | string array | yes | Points to reviewable local artifacts. |
| `tests_or_checks_run` | string array | yes | Records what proved the task. |
| `bypass_detected` | boolean | yes | Must be false for valid activation. |
| `dry_run_only` | boolean | yes | Must be false for external activation claims. |
| `failure_reason` | string | no | Records install, runtime, evidence, policy, or timeout failure. |

## Evidence Sources

| Evidence Source | Use | Claim Boundary |
|---|---|---|
| Local event ledger | Primary measurement source after instrumentation exists. | Internal/local until external users produce records. |
| Runtime-session transcripts | Confirms whether the event works under real Claude/Codex/Hermes sessions. | Blocked until runtime/model sessions are authorized. |
| Beta survey responses | Adds qualitative value signal after closed beta. | Not available yet; do not claim. |
| Install transcripts | Distinguish install failure from activation failure. | Required before public launch claims. |
| Payment or checkout records | Links activation to willingness to pay. | Not available yet; revenue claims blocked. |

## Guardrail Metrics

The north-star metric is invalid if optimized alone. Track these guardrails with it:

| Guardrail | Why |
|---|---|
| Evidence sufficiency failure rate | Prevents counting shallow or fabricated proof as activation. |
| Time-to-first-error | Separates fast value from fast failure. |
| Runtime adapter failure rate | Prevents blaming the metric when adapter setup is broken. |
| Second governed task within 7 days | Checks whether activation led to repeated workflow use. |
| Manual bypass attempts | Detects users fighting the governance layer. |
| User-reported value clarity | Confirms the user understands what changed versus raw agent use. |

## Review Cadence

| Stage | Review Cadence | Decision |
|---|---|---|
| Local pre-release | Every construction cycle that changes install, hook, evidence, or runtime behavior. | Keep metric definition aligned with actual product surface. |
| Closed beta | Weekly while beta is active. | Decide whether users reach value or hit setup/evidence friction. |
| Public release first month | Twice weekly. | Separate install defects, activation defects, and messaging mismatch. |
| Post-launch steady state | Monthly. | Reassess metric threshold and segment fit. |

## Falsifiers

| Falsifier | Action |
|---|---|
| Fewer than 6 of 10 beta users emit a valid activation event across the three beta scenarios. | Reopen ICP and onboarding; do not claim product-market signal. |
| Median valid activation time exceeds 15 minutes after install defects are removed. | Revise onboarding, default task flow, or metric threshold. |
| Users emit activation but cannot explain the value in interviews. | Treat metric as shallow; add qualitative gate before public claims. |
| More than 20 percent of attempted first runs fail before risk classification. | Prioritize install/runtime reliability over marketing. |
| More than 10 percent of valid-looking activations include bypass or evidence insufficiency. | Tighten gate enforcement before measuring growth. |
| Second governed task within 7 days stays below 25 percent after a 30-user external sample. | Treat activation as curiosity, not habit formation. |

## Public Claim Rules

Allowed before external evidence:

- "North-star metric definition: activated governed task rate."
- "Target activation event: first governed task with accepted evidence within 15 minutes."
- "Instrumentation planned."

Blocked before external evidence:

- "Users activate in 15 minutes."
- "Activation rate is X percent."
- "Retention is proven."
- "Beta users validated the workflow."
- "Market demand is validated."
- "Revenue correlates with activation."

## Claim-Source Map

| Metric Claim | Source | Status |
|---|---|---|
| First value should happen quickly for developer tools. | `business-model-proposal.md` activation and TTFV sections. | Local strategy hypothesis. |
| ICP-1 wants first quality-gated commit under 15 minutes. | `icp-worksheet.md` ICP-1 desired outcome and validation plan. | Local ICP hypothesis. |
| Activation must include accepted evidence. | `message-hierarchy.md` and governance docs referenced by the master construction goal. | Product contract, not market proof. |
| External activation is not measured yet. | CLM-005, CLM-007, CLM-015. | Repo-state/blocker boundary. |

```yaml
Falsifies-If:
  kill-condition: North-star metric claims measured activation, retention, market demand, legal compliance, beta completion, revenue, npm publication, sale-page launch, or public release without external evidence.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/business-model/north-star-metric.md
  on-fail: Reopen cycle-72 as BLOCKED_NORTH_STAR_OVERCLAIM and remove unsupported metric claims.
```
