---
name: "regression-lock"
version: "1.0.0"
type: task
triggers:
  - "regression"
  - "test-first"
  - "red-green"
expected_outputs:
  - "red_case: failing or missing regression proof"
  - "green_evidence: passing evidence after implementation"
requires_tools: []
fallback_for_toolsets: []
description: "Lock behavior with regression evidence before accepting a build change."
---

<!-- HIMA:SKILL-ARTIFACT name=regression-lock source=book/07-build -->

# Regression Lock

Lock existing or expected behavior with regression evidence before accepting the build change.

## Activation

- Macro cycles: build, validation, release
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: regression, test-first, red-green

## Ownership

- Owns: red case, green evidence, behavior claim coverage
- Out of scope: exhaustive QA strategy, benchmark execution, production monitoring
