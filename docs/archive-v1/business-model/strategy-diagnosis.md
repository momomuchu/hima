---
claim-bearing: true
status: accepted
date: 2026-05-14
supersedes: implicit thesis spread across docs/business-model/business-model-proposal.md §1 + §3 + §12
governance: governed by docs/conception/05-gates-policy-spec.md §8.4 — every assertion below carries a Falsifies-If block
---

# Strategy Diagnosis — hima (Pipeline Fractale v4)

This file is the source-of-truth for downstream strategy artifacts. NSM (W1 item 3), ICP worksheet (W2 item 5), claims register (W2 item 6), message hierarchy (W3 item 4) derive from this file and must cite it explicitly.

---

## 1. The Diagnosis (Rumelt step 1)

**Central challenge**: harness engineering became a named discipline in February 2026 (Mitchell Hashimoto post, endorsed by OpenAI / Augment Code / Red Hat — proposal.md:30), but is not yet a commercial product category. The window between "named discipline" and "category captured by incumbent" is historically 12–24 months. Six top frontier models now score within 0.8% on SWE-bench Verified (proposal.md:69); model quality has stopped being a differentiator. SWE-agent NeurIPS 2024 documented a 17-issue gap between three different agent frameworks running the same model (proposal.md:69). The scaffolding *is* the harness.

```yaml
Falsifies-If:
  kill-condition: Top-3 model providers (Anthropic, OpenAI, Google) each ship a native quality-discipline kernel (risk classes + evidence gates + compliance artifact generation) into their default coding agent before 2026-12-31
  checkpoint-date: 2026-09-01
  evidence-anchor: docs/business-model/research-05-competitive-landscape.md + Anthropic/OpenAI public changelogs
  on-fail: pivot harness positioning to "multi-runtime governance layer" — the cross-runtime portability bet still differentiates, but the per-runtime moat collapses; revise §3 of proposal.md within 30 days of trigger
```

**The constraint** that explains why the gap stays unfilled:

1. **Adjacent players have the wrong shape**. Codacy/Sonar = post-commit, not session-scoped. Cursor/Windsurf = IDE-bound, not terminal/CI-portable. OpenHands = replacement agent, not governance layer. AGENTS.md = static spec, not runtime. Each occupies a slot that *touches* harness territory without *being* a harness (proposal.md §2.3, §3.2).
2. **Incumbents have a misaligned buyer**. IBM Bob targets $50K+ ACV enterprises (proposal.md:67). The productive market is the developer using Claude Code daily who hits the quality ceiling. Different buyer, different motion. Incumbents will not pivot down — the unit economics of enterprise sales prevent it.
3. **Regulatory pressure forces *some* discipline**. EU AI Act full enforcement starts 2026-08-02 (proposal.md:65). Articles 9/12/14/15 require risk management, logging, human oversight, accuracy maintenance — exactly what a harness provides. 91% of AI tools in enterprise codebases are unmanaged today (proposal.md:65). The gap between "what enterprise must demonstrate" and "what coding tools provide" widens through 2026.

```yaml
Falsifies-If:
  kill-condition: A direct competitor — defined as a developer-terminal coding companion at hima's exact tier, NOT an SDK middleware or infra-layer governance like Microsoft Agent Governance Toolkit (AGT) — ships ≥3 of the 4 sharpened gap traits (session-scoped risk classification mapped to regulatory tiers + evidence-based completion gates + governance-portable across runtimes [the policy/artifact layer, NOT raw multi-runtime execution which is now table-stakes per D1 — 5 competitors have raw portability: Goose, OpenHands, Aider, Mastra, Microsoft AGT] + developer-session-level EU AI Act evidence packs [not infra-tier compliance artifacts]) in GA before 2026-12-31
  checkpoint-date: 2026-09-01 (MANDATORY monitors — sharpened by cycle-02-deep DS3 adversarial verdict 2026-05-14 18:10): (1) **Microsoft AGT** — if MS ships an AGT adapter for Claude Code or Codex CLI by this date, AGT crosses from infra-tier to direct-competitor overnight; (2) **OpenAI Codex enterprise tier upgrade** — already has Compliance Platform logs + partial approval gates; missing only session-tier risk classification + self-contained evidence pack. If both ship in Q3-Q4 2026 → 3-4/4 direct competitor; (3) **Augment Intent compliance SKU** — Augment publishes the most EU AI Act-aware competitor content; EU enforcement deadline 2026-08-02 is a natural launch trigger; current 2.5/4 ceiling would jump if they ship session-tier risk + evidence pack; (4) **MS AGT × GitHub Copilot CLI bundle** — instant 3-4/4 if integrated. **REMOVED 2026-05-14 18:30 by DS2 code-inspection: "LACP at 256⭐" — DS2 verified the repo does NOT exist; only `mellington194/lacp-specification` at 0⭐ exists, a spec stub. S2's swarm summary fabricated the competitor threat. Future swarms must include cross-agent verification on top-claim entities (now encoded in docs/goals/README.md wave protocol).**
  evidence-anchor: docs/business-model/verification-02-competitive-matrix.md:20 + docs/excellence-application/02-analysis-discovery/competitive-harness-scan.md (D1, 2026-05-14 — 18 entries) + docs/excellence-application/02-analysis-discovery/swarm-deep/adversarial-moat-falsifier.md (DS3, 2026-05-14 — 34 falsification attempts, REINFORCED verdict, Augment Intent at 2.5/4 ceiling) + docs/excellence-application/02-analysis-discovery/swarm-deep/deep-code-top8.md (DS2, 2026-05-14 — LACP vapor verification)
  on-fail: drop the "no current product fills this" claim portfolio-wide; amend positioning to "the most integrated developer-terminal implementation"; revise proposal.md §3.1 and any pending public copy within 30 days
```

> **Sharpening note (2026-05-14):** the 4 gap traits above were sharpened by D1 of `cycle-02-analysis-discovery`. The earlier wording ("multi-runtime portability", "compliance artifact generation") was already falsified at face value — 5 competitors have raw multi-runtime; Microsoft AGT has compliance artifacts. The sharpened wording isolates what's actually defensible at hima's tier. See `docs/excellence-application/02-analysis-discovery/discovery-deliverables.md` items S1-1, S1-2, S1-3.

**The hard part**: the harness's value is invisible until used. A homepage cannot demonstrate the quality delta a harness produces. Developer-to-developer dark social (52% of dev discovery per proposal.md:481) is the only distribution that survives — but it requires a discipline-loving subculture that wants to talk about its harness, not just install it. That subculture exists in Claude Code Discord, r/devops, HN, dev.to — but it is a thin slice, and it will not multiply unless the artifact compounds (each successful user becomes a recruiter).

```yaml
Falsifies-If:
  kill-condition: After 6 months of public availability, share of new sign-ups attributable to dark-social referral (self-reported "heard from a colleague" or "saw in Discord/HN/Reddit") falls below 30%
  checkpoint-date: 2027-02-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + signup-attribution survey + monthly Discord/Reddit/HN mention count
  on-fail: pivot acquisition from PLG-dark-social to paid content distribution; revise tier pricing and CAC assumptions in proposal.md §11.3 within 60 days
```

---

## 2. Guiding Policy (Rumelt step 2)

**Be the open-core integrated quality discipline kernel for AI coding agents.** Win developers via MIT generosity (no skill gating, no risk-class paywall, no artificial frustration). Win enterprises via the compliance bridge (T/L/M/H/C maps to EU AI Act tiers, evidence packs ship by default). Stay multi-runtime (Claude / Codex / Hermes) so portability is the survival moat when any single provider native-eats a primitive.

The policy decomposes into 7 **refusal rules**. Each is a non-negotiable boundary with an explicit Falsifies-If naming when (if ever) we would revisit it.

### R1 — Refuse to make the local core feel crippled

The MIT local core ships with full CLI, all skills, all subagents, full T/L/M/H/C, all hooks, full evidence machinery. We do not paywall risk-depth, skill count, or core workflow.

```yaml
Falsifies-If:
  kill-condition: After 12 months of v0.1.0 availability, paid conversion from free < 1% AND >50% of free users self-report "didn't realize there was a paid tier" in the onboarding survey — i.e. the generous core is hiding the paid layer
  checkpoint-date: 2027-08-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + Stripe conversion analytics + onboarding survey results
  on-fail: add explicit upgrade prompts at PQL trigger points (cloud feature requested, team feature requested, premium pack browsed) — but DO NOT move existing capabilities from free to paid (that is R2, separate refusal that holds)
```

### R2 — Refuse to relicense the MIT core (no bait-and-switch)

What ships under MIT in v1 stays MIT forever. Future premium / enterprise code is scoped separately at design time, never migrated from free. This is the AppSumo / Elastic / MongoDB anti-pattern we explicitly refuse.

```yaml
Falsifies-If:
  kill-condition: This rule has no kill condition. It is structural to brand trust. Violating it once destroys the trust on which every other tier depends.
  checkpoint-date: N/A (permanent)
  evidence-anchor: docs/business-model/decision-2026-05-03-mit-core-cloud-enterprise.md
  on-fail: N/A — non-negotiable
```

### R3 — Refuse to compete on model quality

The harness does not ship a model. The harness does not opine on which model is best. The harness disciplines whichever model the user brings. When asked "which model should I use?" we route to public benchmarks, not to our recommendation.

```yaml
Falsifies-If:
  kill-condition: A customer segment emerges paying specifically for harness-vetted model recommendations (e.g. compliance-driven "only T-class-certified models permitted in PHI workflows")
  checkpoint-date: 2026-12-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + enterprise discovery call notes + RFP language analysis
  on-fail: add a paid "vetted model catalog" service in Enterprise tier ONLY — does NOT change the public position that the harness is model-agnostic; revise proposal.md §9 enterprise feature list
```

### R4 — Refuse to be an IDE or to compete on IDE UX

The harness is terminal-first and runtime-portable. We do not ship a UI editor. We do not compete with Cursor / Windsurf / Zed on cursor placement, file-tree UX, or autocomplete latency. We integrate with whatever editor the developer uses.

```yaml
Falsifies-If:
  kill-condition: >40% of free users report lack of an IDE plugin as their #1 friction in the onboarding survey
  checkpoint-date: 2026-12-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + onboarding survey + Discord top-10 friction list
  on-fail: ship a thin VS Code companion extension that surfaces harness state read-only — does NOT change the position that the harness is the kernel, not the IDE
```

### R5 — Refuse monthly billing for static local content

Local premium packs are annual ($180/yr Pro) or perpetual (Founding Member $249–299, capped 1000). Cloud is the only surface that may price monthly because it has ongoing infrastructure cost. This refusal differentiates us from the 31/88 dev tools that priced at $20/month and now compete on a flat price floor (proposal.md:391).

```yaml
Falsifies-If:
  kill-condition: After founding cohort closes (or 12 months from v0.1.0, whichever first), annual-only conversion < 30% of those who said in user interviews they would buy — i.e. the annual frame is itself the friction, not the price
  checkpoint-date: 2027-08-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + post-founding cohort conversion rate + cancelled-cart exit-survey
  on-fail: add a quarterly plan ($60/quarter) — still NOT monthly; preserves the annual-commitment frame
```

### R6 — Refuse enterprise sales motion before product-led $100K ARR

No enterprise sales reps, no SOC 2 audit, no SSO build until BOTH: ≥3 inbound deals stall on compliance/security requirements AND PLG revenue hits $100K ARR (proposal.md:448). Enterprise features are reactive, not speculative.

```yaml
Falsifies-If:
  kill-condition: A single inbound enterprise lead arrives with >$50K committed budget AND a 30-day decision window AND closing requires SSO + SOC 2 + DPA we do not yet have
  checkpoint-date: rolling — evaluated per inbound event
  evidence-anchor: docs/business-model/strategy-diagnosis.md + inbound enterprise pipeline log + lost-deal reasons
  on-fail: accelerate enterprise floor build for THAT deal specifically; do NOT generalize the timeline until 3 such events accumulate
```

### R7 — Refuse the "lifetime" naming pattern

The founding tier is called "Founding Member" or "Perpetual v1.x License" — never "lifetime." The "lifetime" frame collapsed AppSumo (50% revenue crash 2024-2025, proposal.md:347). Numbered scarcity ("License #347 of 1000") is the wedge. Support is community-only at this tier.

```yaml
Falsifies-If:
  kill-condition: This rule has no kill condition. Naming discipline is permanent — the word "lifetime" carries debt the cohort would inherit.
  checkpoint-date: N/A
  evidence-anchor: docs/business-model/verification-01-lifetime-pricing.md
  on-fail: N/A — non-negotiable
```

---

## 3. Coherent Actions (Rumelt step 3)

The 7 bets that operationalize the policy. Each is dated, evidence-anchored, and falsifiable. None contradicts a refusal rule.

### B1 — Ship MIT public core by 2026-08-01 (v0.1.0, no skill gating, no risk paywall)

Full CLI, all 12 skills, all 9 subagents, full T/L/M/H/C, full hook system, GitHub Discussions + Discord community. Release tagged `v0.1.0`, installable via `npm install -g @hima/cli`.

```yaml
Falsifies-If:
  kill-condition: 2026-08-01 passes without v0.1.0 tagged and installable
  checkpoint-date: 2026-08-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + GitHub release page + npm registry
  on-fail: identify the specific block (engineering capacity vs scope creep vs license review) within 7 days; either descope to MVP-3-skills OR delay the founding-member sale window by exactly the slip amount
```

### B2 — Land Falsifies-If gate rule in conception spec this session (W0)

`docs/conception/05-gates-policy-spec.md` gains §2.2 detection row + §5.2 hard-block row + §8.4 specification + §10.1 violation type, in the same commit as this diagnosis. This document is its first user.

```yaml
Falsifies-If:
  kill-condition: Within 30 days, ≥2 new claim-bearing artifacts land in docs/business-model/ or docs/decisions/ WITHOUT Falsifies-If blocks AND the gate implementation in packages/ has not been updated to enforce
  checkpoint-date: 2026-06-13
  evidence-anchor: git log on docs/business-model/ + docs/decisions/ + grep for `Falsifies-If:` in new files post-2026-05-14
  on-fail: either accelerate runtime enforcement (W0.5 in the synthesis backlog) within 14 days OR retract the gate rule as aspirational and stop claiming runtime governance in public copy
```

### B3 — Founding Member sale: 1000 perpetual v1.x licenses at $249–299

Numbered, scarcity-driven, community-only support. Opens at v0.1.0 release, closes when 1000 sold OR 12 months elapse (whichever first). Funds 18+ months of operations at projected $3K/mo burn.

```yaml
Falsifies-If:
  kill-condition: 90 days after open, <100 licenses sold AND signup-to-purchase conversion <0.5% — willingness-to-pay assumption is wrong
  checkpoint-date: 2026-11-01 (= v0.1.0 + 90 days)
  evidence-anchor: docs/business-model/strategy-diagnosis.md + Stripe sales dashboard + landing-page conversion analytics
  on-fail: close perpetual entirely within 30 days, pivot to annual-only ($180/yr Pro), revise revenue projections in proposal.md §11.2
```

### B4 — Claims register + ICP worksheet ship before any public marketing copy

Items 5 and 6 in the synthesis backlog block any homepage / Product Hunt / Show HN copy. The first 1000 free users must not be acquired via uncalibrated claims.

```yaml
Falsifies-If:
  kill-condition: Public marketing copy ships (homepage, PH page, Show HN post) before claims-register.csv AND icp-worksheet.md both exist in docs/business-model/ with non-placeholder content
  checkpoint-date: rolling — per any public copy commit
  evidence-anchor: docs/business-model/strategy-diagnosis.md + git log on landing-page repo + existence + content check of the two files
  on-fail: retract the public copy within 24h, author the missing artifacts, re-ship; record the slip in `.planning/run-set.json`
```

### B5 — Defer enterprise features until ≥3 stalled deals AND $100K PLG ARR

No SSO, no SOC 2, no SCIM, no audit API until BOTH conditions met. Until then, redirect inbound enterprise queries to "we'll have this in 6 months — here's the PLG product."

```yaml
Falsifies-If:
  kill-condition: ≥3 inbound enterprise leads in any rolling 90-day window each with >$30K committed budget that explicitly stall on SSO or SOC 2
  checkpoint-date: rolling 90-day evaluation
  evidence-anchor: docs/business-model/strategy-diagnosis.md + CRM inbound log + lost-deal-reason field
  on-fail: start the 6-month enterprise floor build (SSO + SCIM + audit log + DPA template + SIG Lite) per proposal.md §9.1
```

### B6 — Open-source analytics commands; opt-in telemetry only; redaction spec is public

`harness analytics summary` ships in MIT core, code fully auditable. Telemetry is opt-in, redacted (no PII, no code content). Redaction spec is also open-source. This is the trust moat against Cursor / Windsurf proprietary telemetry.

```yaml
Falsifies-If:
  kill-condition: ≥3 user reports surface that telemetry leaked content (code or identifiers) — redaction is broken in practice
  checkpoint-date: rolling — per incident
  evidence-anchor: docs/business-model/strategy-diagnosis.md + GitHub Issues label `telemetry-leak` + security@ inbox
  on-fail: ship a kill-switch update within 24h; commission an independent telemetry audit within 14 days; publish a post-mortem within 72h of confirmation
```

### B7 — Marketplace Phase 1 = free registry; no monetization until 50+ community skills

`marketplace.json` catalog with CI validation. No Stripe Connect, no 20% take, no hosted runtime until 50+ community-contributed skills exist (proposal.md:641). Phase 2 monetization is reactive to ecosystem signal, not speculative build.

```yaml
Falsifies-If:
  kill-condition: 12 months post-v0.1.0, fewer than 20 community-contributed skills in the registry
  checkpoint-date: 2027-08-01
  evidence-anchor: docs/business-model/strategy-diagnosis.md + marketplace.json contributor count + non-first-party skill count
  on-fail: either accept the marketplace is not viable and remove the bet (deprecate documentation, update proposal.md §8) OR diagnose why contribution failed (pricing? distribution? schema friction?) and re-bet with a specific intervention
```

---

## 4. North Star Metric — placeholder

Not yet defined. Source-of-truth file: `docs/business-model/north-star-metric.md` (to be authored as W1 item 3).

The diagnosis suggests the NSM should measure either: (a) **the rate at which a developer reaches their first quality-gated commit** (TTFV proxy, target <15 min per proposal.md:464), or (b) **the share of free users who land at least one Falsifies-If'd assertion in their own project** (the discipline-adoption proxy). The 7-gate test (engagement breadth / leading / revenue-linked / ungameable / single-number / actionable / observable) will be applied there.

```yaml
Falsifies-If:
  kill-condition: north-star-metric.md not authored before any public marketing copy ships
  checkpoint-date: rolling — per any public copy event
  evidence-anchor: file existence + non-placeholder content in docs/business-model/north-star-metric.md
  on-fail: block launch; author north-star-metric.md within 7 days
```

---

## 5. Cross-References

- `docs/business-model/business-model-proposal.md` — narrative source for diagnosis material; remains valid as a *plan* artifact, superseded as a *strategy* artifact by this file
- `docs/business-model/verification-02-competitive-matrix.md` — moat-is-narrower-than-claimed verification; conditions §1 Falsifies-If and Refusal R3
- `docs/business-model/decision-2026-05-03-mit-core-cloud-enterprise.md` — anchors R2
- `docs/business-model/verification-01-lifetime-pricing.md` — anchors R7
- `docs/conception/05-gates-policy-spec.md` §8.4 — defines the `Falsifies-If:` block format used throughout
- `.planning/excellence-audit/EXCELLENCE-AUDIT-REMEDIATION.md` — places this file at W1 item 1, the first user of the W0 gate rule

---

*Author: founder. Reviewers: none — this file is the foundation, not the derivation. Next derivation = north-star-metric.md (W1 item 3).*
