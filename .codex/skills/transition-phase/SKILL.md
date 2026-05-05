---
name: "transition-phase"
description: "Guard cycle movement with state-machine and evidence checks."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=transition-phase source=operational-catalog -->

# Transition Phase

Guard cycle movement with state-machine and evidence checks.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: post_tool, stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: advance, next cycle, promote, transition
- Automatic: true

## Ownership

- Owns: state transition, exit condition check, missing evidence report
- Out of scope: artifact creation, risk demotion, runtime installation

## References

- Evidence produced: hook_decision, known_gap
- Hooks: state-machine, convergence, close-finalization
- Subagents: evidence-collector
