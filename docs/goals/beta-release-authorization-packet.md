---
claim-bearing: true
status: BLOCKED_AUTHORIZATION_PACKET
cycle-id: cycle-96-external-authorization-required
created: 2026-05-15
scope: H8-beta-and-I1-I6-release
---

# Beta, Release, Payment, and Launch Authorization Packet

## Purpose

This packet defines the authorization boundary for the remaining H8 and I1-I6 external-evidence
rows. It is not authorization, not beta evidence, not publication evidence, not payment evidence,
and not launch evidence.

The rows remain open until external actions are explicitly authorized, executed, captured, and
verified with real artifacts.

## Covered Open Rows

| Row | Requirement | Current status |
|---|---|---|
| H8 | Closed beta with 10 users + saturation survey | Open; no user contact or survey evidence in repo. |
| I1 | GitHub repo visibility public | Open; no public visibility flip authorized here. |
| I2 | v1.0.0 tag + release notes | Open; no release tag authorized here. |
| I3 | `@hima/cli` published to npm | Open; no registry publication authorized here. |
| I4 | Founding-cohort sale page live | Open; no hosting or Stripe action authorized here. |
| I5 | Show HN + dev.to + r/devops + Claude Code Discord posts | Open; no public posts authorized here. |
| I6 | `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md` opening snapshot | Open; cannot be produced until launch artifacts exist. |

## Current Local Source Surfaces

| Surface | Use |
|---|---|
| `docs/business-model/claims-register.csv` | Blocks launch, beta, revenue, Stripe, and legal-compliance claims until external artifacts exist. |
| `docs/business-model/icp-worksheet.md` | Defines the primary beta segment, desired outcome, and kill thresholds. |
| `docs/business-model/message-hierarchy.md` | Defines public-copy claim boundaries and excluded claims. |
| `docs/business-model/north-star-metric.md` | Defines activation event and external-claim sample thresholds. |
| `docs/goals/completion-audit-runtime-boundary.md` | Records H8 and I1-I6 as missing real-world evidence. |
| `docs/goals/runtime-external-evidence-boundary.md` | Records user-contact, publication, payment, and public-post authorization classes. |

These surfaces can guide execution after authorization. They do not prove beta, launch, payment,
market validation, revenue, or public release.

## Authorization Route A: Closed Beta H8

This route requires explicit permission before contacting users or collecting/storing their data.

Required authorization fields:

| Field | Required decision |
|---|---|
| Contact scope | Who may be contacted, on which channels, and maximum count. |
| User segment | Which ICP segment is in scope, defaulting to ICP-1 unless changed. |
| Data boundary | What user feedback, telemetry, transcripts, and survey data may be stored. |
| Privacy boundary | What must be redacted, anonymized, or excluded from repo artifacts. |
| Scenario set | The three scenarios users must attempt. |
| Survey template | Questions, scoring, and saturation summary format. |
| Activation metric | Whether `first_governed_task_activated` is required for beta success. |
| Stop condition | When to stop contacting users or collecting data. |

H8 acceptance evidence must include:

- 10 external users or a clearly documented failure to reach 10 after the authorized contact window.
- Three scenario attempts per included user, or per-user blocker evidence.
- Survey records or redacted summaries.
- Saturation summary that separates Evidence, Inference, Assumption, and Risk.
- Activation/feedback evidence mapped to the north-star metric.
- Kill-gate evaluation against `docs/business-model/icp-worksheet.md`.

## Authorization Route B: Public Release I1-I3

This route requires explicit publication authorization before changing public repo visibility,
creating a public release tag, or publishing to npm.

Required authorization fields:

| Field | Required decision |
|---|---|
| GitHub repo | Repository owner/name and whether visibility may be changed to public. |
| Release version | Expected tag, default `v1.0.0` only if explicitly approved. |
| Release notes | Approved source file or generated notes boundary. |
| npm package | Package name, registry, dist tag, credentials, and dry-run requirement. |
| Rollback/incident plan | Who may unpublish, yank, revert visibility, or amend notes if a release defect appears. |
| Final gate | Required command/test/review evidence immediately before publication. |

I1-I3 acceptance evidence must include:

- Public GitHub repository URL or proof that visibility remains intentionally blocked.
- Release tag URL and release notes URL.
- npm registry URL for `@hima/cli` or explicit blocked-publication evidence.
- Pre-publication verification commands and outputs.
- Post-publication install/probe evidence from a clean external project.

## Authorization Route C: Sale Page, Payment, and Launch Posts I4-I5

This route requires explicit external account and public-post authorization before hosting a sale
page, wiring Stripe, or posting launch copy.

Required authorization fields:

| Field | Required decision |
|---|---|
| Hosting target | Domain, subdomain, or third-party hosting destination. |
| Payment mode | Stripe mode, account, price, tax/legal boundary, and test transaction requirement. |
| Copy approval | Which claims-register entries must be refreshed before publishing copy. |
| Public channels | Which of Show HN, dev.to, r/devops, and Claude Code Discord are authorized. |
| Account/operator | Which account may post or transact. |
| Rollback/incident plan | How to remove, update, refund, or correct public artifacts. |

I4-I5 acceptance evidence must include:

- Live sale-page URL and archived snapshot.
- Stripe test transaction or explicitly authorized live transaction evidence.
- Copy review against `docs/business-model/claims-register.csv`.
- Public post URLs for each authorized channel, or blocked/skipped evidence per channel.
- Launch response capture boundaries, including privacy and moderation constraints.

## Authorization Route D: Opening Snapshot I6

I6 can be produced only after the relevant H8 and I1-I5 artifacts exist or are explicitly scoped out
by a claim-bearing decision.

Required final artifact:

- `docs/goals/archive/v1.0-LAUNCH-2026-08-01.md`

The snapshot must link the actual beta, public repo, release, npm, sale-page, payment, public-post,
and launch evidence available at opening time. It must also list any intentionally missing item as
a blocker or scoped-out decision, not as completed evidence.

## Stop Conditions

Stop without closing H8 or I1-I6 if any condition occurs:

- User contact is not explicitly authorized.
- Privacy/storage boundaries for beta evidence are undefined.
- Fewer than 10 users participate and the authorized window has not produced a saturation summary.
- Public GitHub visibility is not explicitly authorized.
- npm credentials, registry, package name, or dist tag are undefined.
- Release tag or release notes are requested before final verification evidence is available.
- Hosting, Stripe, or public-post accounts are not explicitly authorized.
- Public copy would imply legal certification, revenue, market validation, or compliance proof beyond the claims register.
- Any payment or public action would be irreversible without an approved rollback/incident plan.
- The launch snapshot is created before the external artifacts it claims to summarize exist.

## Verification For This Packet

This packet is locally complete when it maps H8 and I1-I6 to required authorization fields,
acceptance evidence, and stop conditions. Local completion of this packet does not change the
construction ledger and does not close Cycle 96.

```yaml
Falsifies-If:
  kill-condition: This packet is used as proof of beta completion, public release, npm publication, sale-page launch, payment processing, public launch posts, revenue, market validation, or legal compliance.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/beta-release-authorization-packet.md
  on-fail: Reopen H8/I1-I6 as BLOCKED_EXTERNAL_EVIDENCE_MISSING and remove any proxy completion claim.
```
