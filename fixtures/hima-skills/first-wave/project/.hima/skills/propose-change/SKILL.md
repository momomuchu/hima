---
name: "propose-change"
version: "1.0.0"
type: task
triggers:
  - "propose"
  - "change"
  - "feature"
  - "fix"
expected_outputs:
  - "files_modified: accepted evidence"
  - "known_gap: accepted evidence"
requires_tools: []
fallback_for_toolsets: []
description: "Convert a classified request into scoped objective, exclusions, and done criteria."
---

<!-- HIMA:SKILL-ARTIFACT name=propose-change source=operational-catalog -->

# Propose Change

Convert a classified request into scoped objective, exclusions, and done criteria.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: propose, change, feature, fix

## Ownership

- Owns: intent set, scope in/out, definition of done, cycle routing
- Out of scope: code changes, deployment, subagent execution

