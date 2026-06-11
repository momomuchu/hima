---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-02-analysis-discovery
driven-by: competitive-harness-scan.md + gaps-technical-analysis-discovery.md
---

# Discovery Deliverables — cycle-02-analysis-discovery

```yaml
Falsifies-If:
  kill-condition: 90 days pass (2026-08-12) without ≥80% of S1 items merged to main
  checkpoint-date: 2026-08-12
  evidence-anchor: docs/excellence-application/02-analysis-discovery/discovery-deliverables.md + git log on the 3 target files below + grep for amended claim text
  on-fail: escalate to founder review; S1 items become sprint-blocking before any new feature work
```

---

## Executive Summary

Total items: **13** across 3 tiers.
S1 (must land this cycle): **3 items** — estimated total effort **3.5 h**.
S2 (next-cycle candidates): **6 items** — estimated total effort **12 h**.
S3 (backlog, no commitment): **4 items**.
All items are documentation/protocol additions — no code changes required.

---

## S1 — Must land this cycle (before status: DONE)

These 3 items directly satisfy cycle DONE criterion #3 ("≥2 concrete hima improvements have landed").
All are ≤ 2 h and target currently incorrect or missing claims in live strategy files.

| # | Path | Action | Description | Effort | Driven by | Source citations |
|---|------|--------|-------------|--------|-----------|-----------------|
| S1-1 | `docs/business-model/research-05-competitive-landscape.md` | **edit** | Add Microsoft AGT entry to the competitor table (§4 or equivalent): GA date 2026-04-02, 3.5/4 moat traits, SDK middleware tier, Falsifies-If checkpoint 2026-09-01 | 1 h | D1 finding | competitive-harness-scan.md:§3.1, lines 46–53; competitive-harness-scan.md:§4 Flag 2, lines 223–225 |
| S1-2 | `docs/business-model/business-model-proposal.md` §3 | **edit** | Replace "multi-runtime portability" as standalone moat claim (line 109 area) with "governance-portable across runtimes" framing; add footnote citing 5 competitors that now have raw portability (Goose, OpenHands, Aider, Mastra, AGT) | 1 h | D1 finding | competitive-harness-scan.md:§5 Trait 3, lines 173–186; competitive-harness-scan.md:§4 Flag 1, lines 220–222 |
| S1-3 | `docs/business-model/strategy-diagnosis.md` §1 second `Falsifies-If` | **edit** | (a) Sharpen compliance artifact claim from "generates compliance artifacts" to "generates developer-session-level EU AI Act evidence packs natively"; (b) update `evidence-anchor` to reference new competitive-harness-scan.md (supersedes verification-02-competitive-matrix.md); (c) add explicit named checkpoint: "monitor Microsoft AGT at 2026-09-01 for SDK→terminal-harness growth" | 1.5 h | D1 finding | competitive-harness-scan.md:§4 Flag 3, lines 226–228; competitive-harness-scan.md:§5 Trait 4, lines 193–201; strategy-diagnosis.md:§1 Falsifies-If block, lines 34–39 |

---

## S2 — Next short-term goal candidates

These 6 items close the highest-RICE gaps from the desk audit. Suggested landing cycle: `cycle-04-build` (GAP-1, GAP-2, GAP-6) or a dedicated `cycle-02b-analysis-discipline`.

| # | Path | Action | Description | Effort | Priority rationale | Driven by | Source citations |
|---|------|--------|-------------|--------|--------------------|-----------|-----------------|
| S2-1 | `docs/cycles/04-build/concepts-criteria.md` | **edit** | Add "Pre-fix RCA" subsection: method selector table (linear→5-Whys, multi-cause→Fishbone, safety-critical→fault-tree, unknown→hypothesis loop), falsifiable-experiment confirmation rule, local/systemic triage rule, `bug-triage.md` artifact template reference | 2 h | RICE rank 1 — affects every M/H/C bug fix; prevents symptom-only patches | desk-audit GAP-1 | gaps-technical-analysis-discovery.md:GAP-1, lines 34–52 |
| S2-2 | `docs/cycles/04-build/bug-triage.md` (new) | **create** | Template artifact: mode, symptom, confirmed cause, local/systemic verdict, fix scope — referenced by the pre-fix RCA subsection above | 0.5 h | Paired with S2-1; zero value without the template | desk-audit GAP-1 | gaps-technical-analysis-discovery.md:GAP-1 lines 42–47 |
| S2-3 | `docs/transversal/codebase-mapping-protocol.md` (new) | **create** | Evidence-first rule (≥1 anchor per code-path claim, else ASSUMPTION label), anchor type catalogue (file path, symbol, route, test, config, migration, runtime log, command output, commit hash), progressive zoom pattern, anti-hallucination guard | 2 h | RICE rank 2 — prevents AI-hallucinated impact analysis in every H/C Discovery | desk-audit GAP-2 | gaps-technical-analysis-discovery.md:GAP-2, lines 56–72 |
| S2-4 | `docs/cycles/01-discovery/concepts-criteria.md` | **edit** | Add reference to `codebase-mapping-protocol.md` in §3 Mode Technique; wire as mandatory for H/C path | 0.25 h | Activation hook for S2-3 — zero value without wiring | desk-audit GAP-2 | gaps-technical-analysis-discovery.md:GAP-2 lines 70–72 |
| S2-5 | `docs/transversal/risk-classification.md` | **edit** | Add blast-radius checklist to §H/C mandatory path: 6 required surface categories (data stores, async jobs, permissions, integrations, observability, rollback) with YES/NO/N/A per surface | 1 h | RICE rank 6 — 0.5-day effort for high signal; directly fills a gap in the T/L/M/H/C classifier pipeline | desk-audit GAP-6 | gaps-technical-analysis-discovery.md:GAP-6, lines 136–141; risk-classification.md:§6.1 H/C mandatory paths |
| S2-6 | `docs/cycles/02-cadrage/concepts-criteria.md` | **edit** | Add "Estimation calibrée" subsection: reference-class rule (5–10 comparable past changes, P10/P50/P90), range communication rule (never state only the floor), timebox-override rule, anti-pattern ("S/M/L/XL are filters, not commitments") | 2.5 h | RICE rank 4 — prevents systematic underestimation on every M/H/C cadrage; bundled with timebox decision rule (GAP-9 is zero extra effort here) | desk-audit GAP-4 + GAP-9 | gaps-technical-analysis-discovery.md:GAP-4, lines 97–113; gaps-technical-analysis-discovery.md:GAP-9, lines 167–172 |

---

## S3 — Later (backlog, no time commitment)

| # | Path | Action | Description | Driven by | Source citations |
|---|------|--------|-------------|-----------|-----------------|
| S3-1 | `docs/transversal/tech-debt-assessment.md` (new) | **create** | Fowler 2×2 quadrant, Tornhill hotspot score (churn × complexity), NOW/NEVER/LATER decision rule, anti-pattern guard | desk-audit GAP-3 | gaps-technical-analysis-discovery.md:GAP-3, lines 76–93 |
| S3-2 | `docs/cycles/03-conception/dependency-evaluation-protocol.md` (new) | **create** | Breaking-change checklist, contract-diff evidence, generated-client compile, sandbox integration, rollback/version-pin plan | desk-audit GAP-5 | gaps-technical-analysis-discovery.md:GAP-5, lines 118–132 |
| S3-3 | `docs/transversal/cross-cutting-activities.md` | **edit** | Add EIAR label convention (Evidence / Inference / Assumption / Risk) as harness-wide documentation standard for all discovery and analysis artifacts | desk-audit GAP-8 | gaps-technical-analysis-discovery.md:GAP-8, lines 157–163 |
| S3-4 | `docs/cycles/01-discovery/discovery-handoff-template.md` (new) | **create** | Single-artifact handoff: decision recommendation, evidence anchors, implementation slices, rollback/monitoring requirements, open risks with owners | desk-audit GAP-10 | gaps-technical-analysis-discovery.md:GAP-10, lines 179–183 |

---

## DONE-criterion satisfaction check

Cycle DONE criterion #3: "≥2 concrete hima improvements have landed."

The S1 set delivers **3 concrete file changes** to currently live strategy documents:

- S1-1 adds a named competitor (Microsoft AGT) that was entirely absent from the competitive landscape file.
- S1-2 corrects a falsely differentiated moat claim that 5 competitors now invalidate.
- S1-3 sharpens a compliance claim to its defensible, specific form and wires the new scan as the evidence anchor.

All 3 changes are independently verifiable via `git diff` on the target files. The criterion is **satisfied** by S1 alone. S2 and S3 are improvements above the threshold, not required for cycle closure.

---

*Produced from: competitive-harness-scan.md (2026-05-14) + gaps-technical-analysis-discovery.md (2026-05-14)*
