---
name: "status"
description: "Read the current route, risk, state, and next action without mutation."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=status source=operational-catalog -->

# Status

Read the current route, risk, state, and next action without mutation.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: status, where are we, etat
- Automatic: true

## Ownership

- Owns: state snapshot, route summary, next action hint
- Out of scope: state mutation, evidence mutation, cycle transition

## References

- Evidence produced: none
- Hooks: state-machine
- Subagents: none
