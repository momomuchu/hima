---
name: "api-boundary-review"
version: "1.0.0"
type: task
triggers:
  - "api-boundary"
  - "public-api"
  - "compatibility"
expected_outputs:
  - "boundary_findings: public API ownership and compatibility risks"
  - "change_constraints: safe modification rules for callers"
requires_tools: []
fallback_for_toolsets: []
description: "Review API boundaries for ownership, caller impact, and compatibility risks."
---

<!-- HIMA:SKILL-ARTIFACT name=api-boundary-review source=book/05-architecture -->

# API Boundary Review

Review public or cross-package API boundaries before changing contracts consumed by other modules.

## Activation

- Macro cycles: conception, build, validation, release
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: api-boundary, public-api, compatibility

## Ownership

- Owns: API ownership findings, caller impact map, compatibility constraints
- Out of scope: dependency selection, external production deployment, broad unrelated refactors
