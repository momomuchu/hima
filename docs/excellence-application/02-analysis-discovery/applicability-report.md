---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-02-analysis-discovery
deliverable: D3
---

# Applicability Report — Technical Analysis & Discovery Excellence Book vs hima cycle-02

> Does the book actually help when applied to hima with real research?

## Executive Summary

13 chapters audited. YES: 5 | PARTIAL: 6 | NO: 2.
The book delivered strong scaffolding for intake gating, codebase mapping principles, impact/risk analysis, spike design, and handoff structure — all of which translated directly when applied to hima. The primary failure surface is **domain blindness**: the book is written for app-code discovery (API upgrades, schema migrations, RAG pipelines) and has no chapter covering competitive harness landscape scanning, per-coding-agent adapter coverage gaps, or go/no-go gate research against state-of-the-art tooling — precisely the discovery work D1 demanded. 4 book-improvement items are filed back to otherskill.

---

## Per-Chapter Table

| Chapter | Verdict | Most useful section | Where it fell short | Book-improvement item |
|---|---|---|---|---|
| 00 — Current-State Comparative Analysis | YES | Three-state comparison gate (current / target / alternative) | No guidance on scanning a *competitive landscape* as current-state evidence | — |
| 01 — Intake and Scope Gates | YES | Decision rule: < 3 evidence anchors → hold; analyze-vs-build gate | No trigger for "competitive harness scan" as a required evidence type before harness-governance discovery | BI-01 |
| 02 — Codebase Mapping Without Hallucination | YES | Decision rule: every material claim needs ≥1 concrete anchor; ASSUMPTION label | Evidence anchor catalogue is app-code centric (file, route, symbol, migration). No anchor type for "competitor adapter hook API" or "per-runtime hook entry point" | BI-02 |
| 03 — Impact and Risk Analysis | YES | Change-surface inventory + "local diff optimism" anti-pattern | Surfaces listed (data stores, async jobs, permissions, integrations, observability, rollback) do not include "coding-agent runtimes without adapters" as a blast-radius surface | BI-02 |
| 04 — Dependency and API Evaluation | PARTIAL | Contract diff + generated-client compile evidence requirement | Entirely vendor/package/API-upgrade framing. No guidance when the "dependency" is a competing platform whose hook API must be reverse-mapped before writing an adapter | BI-02 |
| 05 — Spikes and Feasibility | YES | Single question + timebox + kill rule; spike-becomes-production anti-pattern | No spike template variant for "competitive parity spike" (does competitor X ship trait Y in GA?) | — |
| 06 — Architecture, Data, Performance Discovery | PARTIAL | Quality-attribute scenario structure; schema migration gate | Performance/data focus. No coverage of harness-governance discovery (multi-runtime portability, compliance-artifact generation) as a quality-attribute scenario type | BI-03 |
| 07 — Security, Privacy, and AI Discovery | PARTIAL | OWASP LLM Top 10 overlay; PII data-flow mapping | AI discovery section covers RAG/LLM feature risk. No coverage of competitive AI-governance tooling as a risk surface (e.g., Microsoft AGT closing compliance-artifact moat) | BI-03 |
| 08 — Handoff to Plan and Delivery | PARTIAL | Five handoff readiness criteria; evidence-to-slice mapping | Handoff template has no field for "competitive position delta" — a finding from D1 that hima's multi-runtime moat needs reframing does not map to any handoff artifact field | BI-04 |
| 09 — Root-Cause Analysis for Fixes | NO | Pre-fix RCA discipline concept is well-structured | Entire chapter is app-code bug-fixing. Inapplicable when the discovery object is a harness-governance product's competitive positioning gap. No mapping to "why is this moat gap present?" discovery | — |
| 10 — Tech-Debt Assessment for Refactors | NO | Fowler 2×2 / churn × complexity concept | Inapplicable to harness-governance domain: there is no "codebase churn" to score on a markdown harness. The debt analogy does not transfer | — |
| 11 — Estimation Under Uncertainty | PARTIAL | Reference-class forecasting concept; estimate-vs-timebox rule | Reference class requires "past comparable changes in this system's git history." hima has no comparable past competitive-scan deliverables to form a reference class for D1 estimation | — |
| 12 — Continuous Discovery: Product-Side | PARTIAL | OST per-change validation gate (3 conditions); discovery-engineering sync protocol | OST framing requires a named "opportunity" on a product's user-facing OST. hima cycle-02 is a harness-validation cycle, not a user-feature cycle — the OST gate does not cleanly apply | BI-01 |

---

## Per-Chapter Detail Blocks (PARTIAL and NO)

### Chapter 04 — Dependency and API Evaluation (PARTIAL)

The chapter's decision rule requires: changelog diff, breaking-change checklist, generated-client compile evidence, sandbox integration, rollback/version-pin before build handoff (`04-dependency-api-evaluation/README.md:22-24`). This translated well for provider-upgrade scenarios but **did not apply** when D1's task was evaluating *competing harness platforms* (Codex CLI, Goose, Microsoft AGT) as potential adapter targets. The chapter has no concept of "competitor hook API reverse-mapping" as a discovery type. D1 had to invent its own evidence structure (D1: `competitive-harness-scan.md:128-138`, adapter coverage gap table) with no book guidance.

### Chapter 06 — Architecture, Data, Performance Discovery (PARTIAL)

The chapter's decision rule gates on quality-attribute scenarios with measurable stimuli and responses (`06-architecture-data-performance-discovery/README.md:19-26`). When D1 assessed hima's multi-runtime portability claim, the relevant quality attribute was "governance-portable across runtimes" — a harness-governance attribute with no app-code analogue. The chapter's scenario templates are written for latency/throughput/schema-safety attributes. D1 confirmed the moat analysis required a different scenario vocabulary (`competitive-harness-scan.md:185-214`). The chapter gave no guidance for that.

### Chapter 07 — Security, Privacy, and AI Discovery (PARTIAL)

The AI/ML risk overlay (`07-security-privacy-ai-discovery/README.md:12-16`) covers OWASP LLM Top 10 mapped to discovery questions for features being built. D1 required discovery in the opposite direction: assessing whether a competitor's AI-governance infrastructure (Microsoft AGT's Agent Compliance package, `competitive-harness-scan.md:46-52`) narrows hima's compliance-artifact moat. The book's AI discovery framing is build-side only; it gives no guidance for competitive-governance threat scanning.

### Chapter 08 — Handoff to Plan and Delivery (PARTIAL)

The five handoff readiness criteria (`08-handoff-to-plan-and-delivery/README.md:23-24`) and `analysis-to-plan-handoff-template.md` translate well when the discovery output is an implementation plan. D1's primary output was a competitive position delta with moat-reframing flags (`competitive-harness-scan.md:218-228`). None of the handoff template fields — decision recommendation, evidence anchors, implementation slices, rollback/monitoring requirements, open risks — map to "moat-reframing flag" or "positioning-claim revision flag." The handoff artifact has no vocabulary for strategy-impacting discovery that does not produce implementation slices.

### Chapter 11 — Estimation Under Uncertainty (PARTIAL)

The reference-class method (`11-estimation-under-uncertainty/README.md:39`) requires picking comparable past changes from the system's own git/ticket history. D1 was a first-ever competitive harness scan for hima — no reference class exists in the system history. The chapter's own escalation boundary directs to `05-spikes-and-feasibility/` when no comparable past changes exist (`11-estimation-under-uncertainty/README.md:31`), which is a valid fallback, but the book does not acknowledge that entire discovery domains (competitive scanning, moat validation) structurally lack reference classes.

### Chapter 12 — Continuous Discovery: Product-Side (PARTIAL)

The OST per-change validation gate (`12-continuous-discovery-product-side/README.md:40-41`) requires: (a) change maps to named OST opportunity, (b) direct customer evidence links opportunity to real friction, (c) core assumption tested. For hima cycle-02, the "change" is a validation cycle on the book itself — there is no user-facing OST to map to, and "customer evidence" does not translate. The chapter explicitly states it is for "a specific change request that has already been received but not yet specced" on "a working SaaS" (`12-continuous-discovery-product-side/README.md:7`). The harness-validation use case falls outside the chapter's stated scope.

### Chapter 09 — Root-Cause Analysis for Fixes (NO)

Chapter 09 is a pre-fix and mid-fix discipline for bug-fixing in app code (`09-root-cause-analysis-for-fixes/README.md:5-12`). Its decisions — which RCA method fits this failure shape, is the fix local or systemic — do not translate to competitive discovery. D1 found no scenario where chapter 09 guidance was consulted or would have helped.

### Chapter 10 — Technical Debt Assessment for Refactors (NO)

Chapter 10's method is Tornhill churn × complexity on a git-tracked codebase (`10-tech-debt-assessment-for-refactors/README.md:3-6`). A markdown harness has no compilable codebase and no meaningful churn × complexity signal. The Fowler 2×2 debt quadrant does not map to harness-governance concerns. Chapter 10 gave no guidance when applied to hima.

---

## Book-Improvement Items Filed Back to otherskill

**BI-01 — Add a "competitive/harness-governance discovery" intake trigger to chapters 01 and 12**

- Target path: `02-analysis-discovery/technical-analysis-discovery-excellence-book/01-intake-and-scope/decision-rules/analyze-vs-build-gate.md` + `12-continuous-discovery-product-side/README.md`

Falsifies-If:
  kill-condition: A later audit finds that the reported YES/PARTIAL/NO chapter verdicts or book-improvement items are not supported by the cited applicability evidence.
  checkpoint-date: 2026-06-14
  evidence-anchor: docs/excellence-application/02-analysis-discovery/applicability-report.md
  on-fail: Reopen cycle-02 applicability review and amend the affected verdicts before using them as evidence.
- Description: Add an intake trigger for discovery objects that are harness products, governance frameworks, or competitive landscapes — where the "codebase" is a competitor's public API surface and the "change" is a moat validation cycle. Chapter 01's gate currently assumes the discovery object is app code; chapter 12's OST gate assumes a user-facing SaaS. Both need a "harness-governance / meta-product" branch.
- Priority: S2

**BI-02 — Add a "competitive adapter coverage" chapter or extension to chapter 02/03/04**

- Target path: `02-analysis-discovery/technical-analysis-discovery-excellence-book/04-dependency-api-evaluation/methods/competitive-adapter-coverage-scan.md`
- Description: Add a method for scanning competitor hook APIs as evidence anchors (chapter 02 anchor type extension) and a surface type "coding-agent runtimes without adapters" to the chapter 03 change-surface inventory. Chapter 04's dependency evaluation template needs a variant for "competitor platform as adapter target" — covering hook entry point, adapter status, gap severity, and adoption signal rather than changelog diff and generated-client compile.
- Priority: S1 (highest — this is the gap D1 had to invent from scratch with no book guidance)

**BI-03 — Add a "harness-governance quality attribute" scenario vocabulary to chapters 06 and 07**

- Target path: `02-analysis-discovery/technical-analysis-discovery-excellence-book/06-architecture-data-performance-discovery/methods/harness-governance-quality-attributes.md`
- Description: Add scenario templates for harness-specific quality attributes: multi-runtime portability, session-scoped risk classification, evidence-based completion gate, compliance artifact generation. Chapter 07's AI discovery section needs a "competitive governance threat scan" use case — assessing whether a competitor's AI-governance infrastructure narrows a claimed moat — alongside the existing build-side OWASP LLM overlay.
- Priority: S2

**BI-04 — Add a "strategy-impacting discovery" handoff artifact variant to chapter 08**

- Target path: `02-analysis-discovery/technical-analysis-discovery-excellence-book/08-handoff-to-plan-and-delivery/templates/strategy-impact-handoff-template.md`
- Description: Add a handoff template variant for discovery that produces competitive position deltas and positioning-claim revision flags rather than implementation slices. Required fields: moat trait re-assessment, competitive position delta, positioning-claim revision flags, Falsifies-If kill conditions updated, next validation checkpoint. The current `analysis-to-plan-handoff-template.md` has no vocabulary for this output type.
- Priority: S2

---

## Falsifies-If

This report is falsified if: 6 months from 2026-05-14 (by 2026-11-14), the four book-improvement items above have not been incorporated into the otherskill excellence book AND a future hima cycle re-applies the unchanged book to a harness-governance discovery task and documents the same gaps (no competitive adapter coverage method, no harness-governance quality-attribute scenarios, no strategy-impact handoff template, no harness-governance intake trigger).
