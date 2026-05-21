---
name: "pmf-evidence-card"
version: "1.0.0"
type: task
triggers:
  - "pmf"
  - "evidence"
  - "validation"
expected_outputs:
  - "evidence_card: Evidence Inference Assumption Risk separated"
  - "next_test: smallest validation step"
requires_tools: []
fallback_for_toolsets: []
description: "Separate PMF evidence from inference, assumption, and risk before validation claims."
---

<!-- HIMA:SKILL-ARTIFACT name=pmf-evidence-card source=book/00-idea-pmf -->

# PMF Evidence Card

Write a PMF evidence card that separates what was observed from what is inferred.

## Guardrails

- Evidence is observed behavior or direct customer signal.
- Inference is marked separately.
- Assumptions and risks stay visible until tested.
