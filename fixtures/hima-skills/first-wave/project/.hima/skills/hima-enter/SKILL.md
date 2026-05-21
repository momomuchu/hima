---
name: "hima-enter"
version: "1.0.0"
type: task
triggers:
  - "hima"
  - "enter"
  - "start development"
  - "development mode"
  - "mode developpement"
  - "governed development"
expected_outputs:
  - "hook_decision: accepted evidence"
  - "confidence_level: accepted evidence"
  - "risk_remaining: accepted evidence"
requires_tools: []
fallback_for_toolsets: []
description: "Start a governed HIMA development session from an idea, select the operating mode, and bind the route before implementation."
---

<!-- HIMA:SKILL-ARTIFACT name=hima-enter source=operational-catalog -->

# HIMA Enter

Start a governed HIMA development session from an idea, select the operating mode, and bind the route before implementation.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: hima, enter, start development, development mode, mode developpement, governed development

## Ownership

- Owns: development session entry, operating mode selection, risk-to-route binding, initial verification commands
- Out of scope: manual .planning edits, OMX workflow dependency, implementation before route activation, silent risk downgrades

