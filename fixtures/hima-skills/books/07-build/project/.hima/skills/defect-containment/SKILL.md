---
name: "defect-containment"
version: "1.0.0"
type: task
triggers:
  - "bug"
  - "defect"
  - "root-cause"
expected_outputs:
  - "cause_summary: confirmed or suspected defect cause"
  - "containment_plan: smallest fix and regression guard"
requires_tools: []
fallback_for_toolsets: []
description: "Contain defects by separating symptom evidence, root cause, and the smallest guarded fix."
---

<!-- HIMA:SKILL-ARTIFACT name=defect-containment source=book/07-build -->

# Defect Containment

Separate symptoms, cause evidence, and the smallest guarded fix before changing code.

## Activation

- Macro cycles: build, validation, release, run
- Gate types: user_prompt, pre_tool, post_tool
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: bug, defect, root-cause

## Ownership

- Owns: cause summary, containment plan, regression guard
- Out of scope: unrelated cleanup, speculative rewrites, incident communications
