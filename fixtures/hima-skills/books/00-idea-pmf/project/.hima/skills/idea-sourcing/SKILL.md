---
name: "idea-sourcing"
version: "1.0.0"
type: task
triggers:
  - "seed"
  - "sourcing"
  - "idea"
expected_outputs:
  - "seed_card: sourced idea with evidence"
  - "kill_gate: explicit continue or kill decision"
requires_tools: []
fallback_for_toolsets: []
description: "Source product seeds without treating discovery signals as PMF proof."
---

<!-- HIMA:SKILL-ARTIFACT name=idea-sourcing source=book/00-idea-pmf -->

# Idea Sourcing

Source candidate product seeds while keeping discovery evidence separate from PMF validation.

## Guardrails

- Public signal strength is sourcing evidence, not PMF proof.
- Score 1 or lower is a kill, not a maybe.
- Every seed needs an ICP access path before promotion.
