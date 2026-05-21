---
name: "status"
version: "1.0.0"
type: task
triggers:
  - "status"
  - "where are we"
  - "etat"
expected_outputs:
  - "status: completed skill output"
requires_tools: []
fallback_for_toolsets: []
description: "Read the current route, risk, state, and next action without mutation."
---

<!-- HIMA:SKILL-ARTIFACT name=status source=operational-catalog -->

# Status

Read the current route, risk, state, and next action without mutation.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: status, where are we, etat

## Ownership

- Owns: state snapshot, route summary, next action hint
- Out of scope: state mutation, evidence mutation, cycle transition

