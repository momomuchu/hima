---
name: "validation-ladder"
version: "1.0.0"
type: task
triggers:
  - "ladder"
  - "validation"
  - "test"
expected_outputs:
  - "validation_ladder: ordered tests from cheapest to strongest"
  - "promotion_rule: evidence threshold for next step"
requires_tools: []
fallback_for_toolsets: []
description: "Sequence PMF validation tests from cheapest signal to strongest proof."
---

<!-- HIMA:SKILL-ARTIFACT name=validation-ladder source=book/00-idea-pmf -->

# Validation Ladder

Order validation tests so each step earns the right to spend more time or money.

## Guardrails

- Start with the cheapest useful test.
- Define the promotion rule before running the test.
- Do not skip to build work when a cheaper test can falsify the idea.
