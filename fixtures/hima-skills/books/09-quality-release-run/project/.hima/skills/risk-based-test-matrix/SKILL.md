---
name: "risk-based-test-matrix"
version: "1.0.0"
type: task
triggers:
  - "risk-test"
  - "test-matrix"
  - "quality-gate"
expected_outputs:
  - "test_matrix: risk mapped test coverage"
  - "residual_risk: uncovered or intentionally deferred risks"
requires_tools: []
fallback_for_toolsets: []
description: "Map release risks to test coverage and residual risk before signoff."
---

<!-- HIMA:SKILL-ARTIFACT name=risk-based-test-matrix source=book/09-quality-release-run -->

# Risk Based Test Matrix

Map release risks to the test coverage and residual risks needed before signoff.

## Activation

- Macro cycles: validation, release
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: risk-test, test-matrix, quality-gate

## Ownership

- Owns: risk-to-test matrix, residual risk list, quality gate recommendation
- Out of scope: replacing acceptance criteria, benchmark execution, runtime cost approval
