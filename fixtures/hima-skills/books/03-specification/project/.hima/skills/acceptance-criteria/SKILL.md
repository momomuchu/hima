---
name: "acceptance-criteria"
version: "1.0.0"
type: task
triggers:
  - "acceptance"
  - "done-criteria"
  - "requirements"
expected_outputs:
  - "acceptance_set: observable pass fail criteria"
  - "coverage_gaps: requirements without acceptance evidence"
requires_tools: []
fallback_for_toolsets: []
description: "Translate requirements into observable acceptance criteria and coverage gaps."
---

<!-- HIMA:SKILL-ARTIFACT name=acceptance-criteria source=book/03-specification -->

# Acceptance Criteria

Turn a requirement into observable pass/fail criteria before implementation or closeout.

## Activation

- Macro cycles: cadrage, conception, validation, release
- Gate types: user_prompt, pre_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: acceptance, done-criteria, requirements

## Ownership

- Owns: acceptance criteria, missing evidence map, explicit non-goals
- Out of scope: implementation, broad test-suite rewrites, runtime authorization decisions
