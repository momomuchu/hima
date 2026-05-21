---
claim-bearing: true
status: HYPOTHESIS
cycle-id: cycle-70-icp-worksheet
last-updated: 2026-05-14
---

# ICP Worksheet

## Scope Boundary

This worksheet is a local hypothesis artifact. It does not prove demand, reachable channels, revenue, willingness to pay, beta completion, or launch readiness.

Source surfaces:

- `docs/business-model/strategy-diagnosis.md`
- `docs/business-model/business-model-proposal.md`
- `docs/business-model/research-03-plg-gtm.md`
- `docs/business-model/research-05-competitive-landscape.md`
- `docs/business-model/claims-register.csv`

## ICP Decision Summary

| Rank | Segment | Decision | Why |
|---|---|---|---|
| Primary | Terminal-first AI coding power users in solo or 1-10 developer teams | Target first | Matches local evidence: daily Claude Code/Codex/Aider-style use, quality ceiling pain, low procurement friction, PLG-compatible. |
| Secondary | Startup tech leads/founders managing AI-assisted code quality in small engineering teams | Target after activation proof | Has budget influence and team pain, but needs proof that a single developer can get value first. |
| Secondary | Compliance-aware engineering managers in SMB/mid-market teams | Observe and interview | Regulatory pressure may create urgency, but enterprise-style proof and procurement can arrive too early. |
| Excluded for now | Enterprise procurement-first buyers | Do not target first | Conflicts with R6/B5: no SSO/SOC 2/SCIM/audit API until PLG and inbound proof exist. |
| Anti-ICP | IDE-autocomplete-only users seeking faster suggestions | Do not target | Hima is a terminal governance/quality harness, not an IDE, autocomplete, or model-quality product. |

## Primary ICP

### ICP-1: Terminal-Agent Quality Power User

**Working label:** "The daily Claude Code/Codex user hitting the quality ceiling."

| Field | Hypothesis |
|---|---|
| User | Individual developer or senior IC using terminal-first coding agents multiple times per week. |
| Team size | Solo, indie, OSS maintainer, or startup team of 1-10 developers. |
| Current tools | Claude Code, Codex CLI, Aider, OpenHands terminal workflows, GitHub Actions, local test/lint stack. |
| Pain | AI agents can produce volume, but the user loses time enforcing tests, architecture, scope, evidence, and review discipline. |
| Trigger | A recent AI-assisted change passed superficial checks but introduced architectural drift, weak tests, stale docs, or unreviewable scope. |
| Desired outcome | First quality-gated commit in under 15 minutes, with evidence the user can inspect. |
| Budget hypothesis | 0 USD for public core; later 180 USD/year Pro or 249-299 USD Founding Member only if the tool becomes part of repeated workflow. |
| Channel hypothesis | GitHub README, docs/tutorials, Show HN, r/devops, r/webdev, Claude Code/Codex communities, technical posts about quality gates. |
| Product hook | Install locally, run a governed task, see a blocked overclaim or evidence gap that raw agent use would have missed. |
| Evidence needed | Fresh install timing, first-task completion transcript, before/after review quality, self-reported "would keep using" signal, and willingness-to-pay interview. |
| Kill condition | Fewer than 6 of 10 beta users in this segment complete three scenarios, or median first quality-gated commit exceeds 15 minutes after package publication. |
| Source anchors | `strategy-diagnosis.md` §1, §2, §7; `business-model-proposal.md` §2.1, §7; `research-03-plg-gtm.md` §A-F; `research-05-competitive-landscape.md` §9-10. |

## Secondary ICPs

### ICP-2: Startup Tech Lead / Founder With Team Quality Risk

| Field | Hypothesis |
|---|---|
| User | Technical founder, staff engineer, or tech lead on a 2-20 person engineering team already allowing AI-assisted coding. |
| Pain | AI-assisted velocity increases review load and creates inconsistent team discipline. |
| Trigger | Multiple developers use different agents and conventions; team needs a portable quality protocol before code review. |
| Budget hypothesis | Can approve low hundreds annually without procurement; may buy team seats only after repeated individual usage. |
| Channel hypothesis | Founder/engineering blogs, HN, GitHub, dev.to/Hashnode, r/startups adjacent technical threads, founder network referrals. |
| Product hook | Shared policy, evidence packs, and repeatable quality gates across runtime preferences. |
| Evidence needed | At least one team adopts Hima for a shared repo, records repeated governed sessions, and asks for team state or policy sharing. |
| Kill condition | Team users treat Hima as personal tooling only and never ask for shared state, policy reuse, or review evidence after five team trials. |
| Source anchors | `research-03-plg-gtm.md` §D-F, §J; `business-model-proposal.md` §5, §9, §11; `strategy-diagnosis.md` R1, R6, B5. |

### ICP-3: Compliance-Aware Engineering Manager

| Field | Hypothesis |
|---|---|
| User | Engineering manager or platform lead in an SMB/mid-market company with AI coding adoption and early governance pressure. |
| Pain | Needs evidence of risk management, logging, human oversight, and accuracy maintenance for AI-assisted development workflows. |
| Trigger | Internal AI policy review, customer security questionnaire, EU AI Act awareness, or audit-prep request. |
| Budget hypothesis | May support 600-5000 USD/year if bottom-up developer use creates proof; not a cold enterprise-sales starting point. |
| Channel hypothesis | Inbound from developer champions, security/compliance blog posts, comparison guides, and compliance-aware beta interviews. |
| Product hook | Developer-session evidence packs and local governance logs that do not claim legal certification. |
| Evidence needed | Discovery calls or beta notes where managers ask for evidence packs, audit logs, policy mapping, or shared team state after seeing developer usage. |
| Kill condition | Compliance-aware prospects ask only for SOC 2, SSO, SCIM, DPA, or procurement artifacts and do not care about developer-session evidence. |
| Source anchors | `strategy-diagnosis.md` §1, R6, B5; `business-model-proposal.md` §9; `research-03-plg-gtm.md` §D, §J; `claims-register.csv` CLM-010 and CLM-013. |

## Excluded Segments

| Segment | Exclusion Reason | Revisit Trigger |
|---|---|---|
| Enterprise procurement-first buyers | Requires SOC 2, SSO, SCIM, DPA, sales motion, and long procurement before bottom-up proof. | >=3 inbound deals stall specifically on compliance/security and PLG revenue reaches the R6/B5 threshold. |
| IDE-only autocomplete users | They buy latency, completions, inline edits, and editor UX; Hima is not an IDE. | A material subset starts using terminal agents for governed multi-file work. |
| AI infrastructure/RAG framework teams | Their pain is model/runtime orchestration, observability, or app evals, not developer-terminal quality governance. | They request Hima as a policy layer around coding-agent changes, not app-agent runtime. |
| Low-code/no-code teams | They lack the local CLI, test, code review, and repo workflows required for first value. | They adopt developer-agent workflows and can run local install/test flows. |
| Regulated enterprise teams needing certification now | Hima has no legal certification, SOC 2, external SIEM integration, or real beta evidence. | Release evidence, compliance pack evidence, and external audit posture exist. |

## Anti-ICP

Hima should reject early sales or messaging toward users who primarily want:

- a better model recommendation;
- faster autocomplete;
- an IDE replacement;
- a black-box autonomous developer;
- instant legal compliance proof;
- enterprise procurement artifacts before PLG proof;
- a hosted managed runtime before the local core is proven.

## Validation Plan

| Check | Target Segment | Evidence Required | Pass Threshold | Falsifies If |
|---|---|---|---|---|
| Timed install and first governed task | ICP-1 | External tester transcripts after package publication | Median under 15 minutes | Median over 15 minutes or repeated install failure. |
| Scenario beta | ICP-1 | 10-user closed beta over F1 scenarios | >=6/10 complete all scenarios | Fewer than 6 complete or users cannot explain value. |
| Willingness to pay | ICP-1, ICP-2 | Interview or checkout-intent records | At least 3 credible "would pay 249-299 USD" signals from beta | Signals are curiosity-only or price/value mismatch dominates. |
| Team pull | ICP-2 | Requests for shared policy, team state, review artifacts | At least 2 teams ask unprompted after usage | No team-level pull after five team trials. |
| Compliance pull | ICP-3 | Discovery notes or beta feedback | At least 2 compliance-aware prospects ask for session evidence packs | Prospects only ask for SOC 2/SSO/DPA and reject session evidence. |
| Channel fit | ICP-1, ICP-2 | Signup attribution, GitHub traffic, HN/Reddit/Discord mentions | Dark-social/self-reported community attribution >=30% after 6 months public | Attribution below 30% after public availability. |

## Public Copy Guard

Before homepage, Product Hunt, Show HN, dev.to, or sales-page copy ships:

- `claims-register.csv` must be refreshed against the specific copy;
- this worksheet must be refreshed with current ICP evidence;
- arXiv 2604.09409 must be directly sourced before using the 67 percent NL-ignore claim;
- launch copy must not imply legal certification, beta completion, revenue, or validated demand.

```yaml
Falsifies-If:
  kill-condition: Public copy targets a segment as validated, reachable, paying, or legally/compliance-ready before external evidence exists for that segment.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/business-model/icp-worksheet.md
  on-fail: Reopen cycle-70 as BLOCKED_ICP_WORKSHEET_OVERCLAIM and remove validated-demand wording from public-copy drafts.
```
