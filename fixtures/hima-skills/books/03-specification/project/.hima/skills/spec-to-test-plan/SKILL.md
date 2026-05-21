---
name: "spec-to-test-plan"
version: "1.0.0"
type: task
triggers:
  - "test-plan"
  - "spec-to-test"
  - "verification"
expected_outputs:
  - "test_plan: requirement mapped verification cases"
  - "untested_claims: claims lacking a practical test"
requires_tools: []
fallback_for_toolsets: []
description: "Map specification claims to a focused verification plan and identify untested claims."
---

<!-- HIMA:SKILL-ARTIFACT name=spec-to-test-plan source=book/03-specification -->

# Spec To Test Plan

Map specification claims to focused verification cases and expose claims that still lack a test.

## Activation

- Macro cycles: conception, build, validation, release
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: test-plan, spec-to-test, verification

## Ownership

- Owns: test plan, requirement-to-test map, untested claim list
- Out of scope: broad QA automation, external runtime execution, benchmark authorization
