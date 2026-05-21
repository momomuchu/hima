---
claim-bearing: true
status: BLOCKED_RESCOPE_PACKET
cycle-id: cycle-96-external-authorization-required
created: 2026-05-15
scope: master-goal-rescope-preparation
---

# Master Goal Rescope Decision Packet

## Purpose

This packet defines the minimum decision record required before the construction goal can be
intentionally rescoped instead of waiting for the remaining external evidence. It is not a rescope
decision, not authorization, not external evidence, and not a substitute for the open master rows in
`docs/goals/COMPLETE-CONSTRUCTION-GOAL.md`.

The current construction ledger remains 119/155. Cycle 96 remains BLOCKED until either the real
external/environment evidence exists, or a later claim-bearing decision explicitly changes the
master goal and updates the ledger, open rows, and falsifier set.

## Current Blocked Shape

| Field | Current value |
|---|---|
| Cycle | `cycle-96-external-authorization-required` |
| Status | BLOCKED |
| Ledger | 119/155, 76.8% |
| Open rows | 36 |
| Existing route | Explicit external/environment authorization or claim-bearing master-goal rescope |
| This packet | Preparation only; no rescope enacted |

## Required Rescope Decision Fields

A future rescope is valid only if a new claim-bearing decision records all fields below.

| Field | Required content |
|---|---|
| Decision owner | Who is allowed to redefine v1.0 completion. |
| Motivation | Why waiting for the remaining external evidence is no longer the correct v1.0 boundary. |
| Removed rows | Exact rows removed from the master checklist, with reason per row. |
| Retained blockers | Rows that remain required before v1.0 can be called complete. |
| Replacement claims | The new public/private claim boundary after rescope. |
| Evidence downgrade | Every external-evidence claim downgraded to local proof, blocked preflight, or future work. |
| User-facing impact | What the product can and cannot honestly claim after rescope. |
| Risk acceptance | Residual risks accepted by shipping without the removed evidence. |
| Falsifiers | Conditions that invalidate the rescope and force reopening the removed rows. |
| Ledger update | Exact new total, done count, open count, and archive target. |
| Verification plan | Commands and artifact checks required after the decision is applied. |

## Explicit Non-Goals

This packet does not:

- remove any row from `docs/goals/COMPLETE-CONSTRUCTION-GOAL.md`;
- mark Cycle 96 DONE;
- create `docs/goals/evidence/h3-install-macos.md`;
- create `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md`;
- create adapter `e2e.test.ts` placeholders;
- authorize real runtime/model sessions;
- authorize real `~/.hima` writes;
- authorize benchmark, stress, SIEM, beta, public release, payment, or launch actions;
- claim market validation, revenue, legal certification, public release, or final completion.

## Required Decision Artifact Shape

If rescope is chosen later, create a separate claim-bearing decision artifact instead of editing this
packet into a decision. The decision artifact must include:

```yaml
decision-type: master-goal-rescope
status: APPROVED_RESCOPED_GOAL
supersedes: docs/goals/COMPLETE-CONSTRUCTION-GOAL.md
removed-open-rows: []
retained-open-rows: []
new-ledger:
  done: null
  total: null
  open: null
claim-boundary: null
approved-by: null
verification-required: []
```

The decision must also update or replace:

- `docs/goals/COMPLETE-CONSTRUCTION-GOAL.md`;
- `docs/goals/SHORT-TERM-GOAL.md`;
- `docs/goals/external-authorization-packet-coverage-audit.md`;
- `scripts/audit-construction-completion.mjs`;
- `scripts/guard-construction-blocked-state.mjs`;
- any archive that describes the current blocked state.

## Verification For This Packet

This packet is locally complete when it names the required rescope decision fields, preserves the
external-evidence boundary, and states that no row, ledger count, or completion status changes from
this packet alone.

```yaml
Falsifies-If:
  kill-condition: This packet is used as proof that the master goal was rescoped, that Cycle 96 is DONE, or that the construction ledger advanced beyond 119/155.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/master-goal-rescope-decision-packet.md
  on-fail: Reopen Cycle 96 as BLOCKED_RESCOPE_OVERCLAIM and restore the 36 external-evidence blockers.
```
