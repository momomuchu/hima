---
name: "refactor-safety"
version: "1.0.0"
type: task
triggers:
  - "refactor"
  - "cleanup"
  - "behavior-preserving"
expected_outputs:
  - "safety_checks: behavior-preserving proof before and after refactor"
  - "simplification_scope: exact duplication or boundary issue addressed"
requires_tools: []
fallback_for_toolsets: []
description: "Constrain refactors to behavior-preserving changes with explicit safety evidence."
---

<!-- HIMA:SKILL-ARTIFACT name=refactor-safety source=book/07-build -->

# Refactor Safety

Constrain refactors to behavior-preserving changes with explicit safety checks.

## Activation

- Macro cycles: build, validation, release
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: refactor, cleanup, behavior-preserving

## Ownership

- Owns: refactor scope, before/after evidence, simplification boundary
- Out of scope: feature changes, dependency additions, architecture rewrites
