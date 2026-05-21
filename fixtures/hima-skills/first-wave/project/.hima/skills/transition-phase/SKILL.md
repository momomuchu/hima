---
name: "transition-phase"
version: "1.0.0"
type: task
triggers:
  - "advance"
  - "next cycle"
  - "promote"
  - "transition"
expected_outputs:
  - "hook_decision: accepted evidence"
  - "known_gap: accepted evidence"
requires_tools: []
fallback_for_toolsets: []
description: "Guard cycle movement with state-machine and evidence checks."
---

<!-- HIMA:SKILL-ARTIFACT name=transition-phase source=operational-catalog -->

# Transition Phase

Guard cycle movement with state-machine and evidence checks.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: post_tool, stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: advance, next cycle, promote, transition

## Ownership

- Owns: state transition, exit condition check, missing evidence report
- Out of scope: artifact creation, risk demotion, runtime installation

