---
name: "assumption-audit"
version: "1.0.0"
type: task
triggers:
  - "assumption"
  - "audit"
  - "unknown"
expected_outputs:
  - "assumption_register: explicit assumptions and risk"
  - "verification_plan: cheapest check for each critical assumption"
requires_tools: []
fallback_for_toolsets: []
description: "Audit hidden assumptions and attach verification plans before decisions harden."
---

<!-- HIMA:SKILL-ARTIFACT name=assumption-audit source=book/02-analysis-discovery -->

# Assumption Audit

Turn implicit assumptions into visible checks.

## Guardrails

- Critical assumptions need a verification path.
- Do not present assumptions as evidence.
- Mark assumptions that would change the decision if false.
