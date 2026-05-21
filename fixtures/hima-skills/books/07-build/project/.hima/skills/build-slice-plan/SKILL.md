---
name: "build-slice-plan"
version: "1.0.0"
type: task
triggers:
  - "build-slice"
  - "implementation"
  - "small-change"
expected_outputs:
  - "slice_plan: minimal reversible implementation steps"
  - "blast_radius: files and behaviors affected by the change"
requires_tools: []
fallback_for_toolsets: []
description: "Plan a small reversible implementation slice with explicit blast radius."
---

<!-- HIMA:SKILL-ARTIFACT name=build-slice-plan source=book/07-build -->

# Build Slice Plan

Plan a small reversible implementation slice before making code changes.

## Activation

- Macro cycles: build, validation
- Gate types: user_prompt, pre_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: build-slice, implementation, small-change

## Ownership

- Owns: scoped implementation steps, affected files, behavior boundary
- Out of scope: broad rewrites, dependency additions, external runtime execution
