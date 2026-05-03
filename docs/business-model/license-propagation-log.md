# License Propagation Log — AGPL to MIT

**Date**: 2026-05-03
**Decision**: MIT core + commercial enterprise layer (see `decision-2026-05-03-mit-core-cloud-enterprise.md`)
**Scope**: Update all references to AGPL across harness-architecture docs to reflect the MIT decision

---

## Files Modified

### 1. `business-model-proposal.md`

**Section 4.2 — Comparison table (line ~151)**
- Changed column header from `AGPL Core` to `AGPL Core (rejected)` and `MIT Core` to `MIT Core (chosen)`
- Added a decision summary paragraph below the table explaining why MIT was chosen over AGPL, referencing the internal-use exemption weakness and the value-pull revenue model

**Appendix A — Research Report Index (line ~778)**
- Updated R07 description from "MIT/Apache vs AGPL trade-offs" to "MIT/Apache trade-offs (AGPL evaluated and rejected -- see section 4)"

### 2. `decision-2026-05-03-mit-core-cloud-enterprise.md`

**Rejected section (line ~53)**
- Expanded the AGPL rejection entry with explicit reasoning: enterprise legal friction, internal-use exemption weakening revenue enforcement, and MIT being a better fit for a developer tool prioritizing adoption and career/brand impact

### 3. `verification-03-risk-depth-gating.md`

**Verdict table (after line ~24)**
- Added a post-verification decision note stating that AGPL findings contributed to the MIT decision, with cross-reference to the decision document

**AGPL Revenue Model Verification section (line ~155)**
- Added "(Historical -- AGPL rejected in favor of MIT)" to section heading
- Added a note block explaining this section documents the pre-decision AGPL analysis and its findings contributed to rejecting AGPL

**Recommendation R3 (line ~261)**
- Marked as RESOLVED with strikethrough on original text
- Added resolution note: MIT decision eliminates AGPL revenue assumptions entirely

**Recommendation R6 (line ~283)**
- Marked as RESOLVED with strikethrough on original text
- Added resolution note: founder chose MIT core + commercial enterprise layer, following the OpenHands/Supabase model

**Disputed Claim D2 (line ~300)**
- Added status note: dispute is moot under MIT decision, no AGPL-based revenue assumption exists

### 4. `oq-13-14-16-lifecycle-perf.md` (conception/open-questions)

**Q14.7 justification (line ~160)**
- Updated justification to state AGPL was explicitly evaluated and rejected
- Added cross-references to the decision document and verification-03

---

## Files NOT Modified (per rules)

### Research reports (historical)
- `research-01-open-core-models.md` — contains AGPL references in company profiles and license landscape analysis
- `research-07-licensing.md` — contains AGPL deep-dive as part of license comparison research
- `research-08-pricing-psychology.md` — contains AGPL reference in dual-licensing section

These are historical research documents. Their AGPL content is factual analysis of the license landscape, not recommendations for Pipeline Fractale's license choice.

### Source/implementation documents
- `checkpoint-implementation.md` — source document, not modified per rules
- RMS draft — source document, not modified per rules

---

## Remaining AGPL References (all properly contextualized)

| File | Count | Context |
|------|-------|---------|
| business-model-proposal.md | 3 | Comparison table (marked "rejected"), R07 index entry (marked "rejected") |
| decision doc | 1 | "Rejected" section with explicit reasoning |
| verification-03 | 31 | Historical analysis sections, all marked RESOLVED/Historical/moot |
| oq-13-14-16 | 1 | Q14.7 justification (marked "evaluated and rejected") |
| research-01 | N/A | Historical research — not modified |
| research-07 | N/A | Historical research — not modified |
| research-08 | N/A | Historical research — not modified |

All remaining AGPL references are either (a) in comparison tables showing AGPL as a rejected alternative, (b) in "Rejected" sections, (c) in historical analysis annotated as resolved/moot, or (d) in unmodified research reports.

No reference suggests AGPL is the current or planned license for Pipeline Fractale.
