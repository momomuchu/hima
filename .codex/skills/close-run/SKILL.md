---
name: "close-run"
description: "Finalize a run only after evidence, policy, and runtime gates agree."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=close-run source=operational-catalog -->

# Close Run

Finalize a run only after evidence, policy, and runtime gates agree.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: stop
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: close, final, done, finish
- Automatic: true

## Ownership

- Owns: final state selection, residual risk summary, known gap disclosure
- Out of scope: additional implementation, silent evidence fabrication, risk downgrade

## References

- Evidence produced: confidence_level, known_gap, risk_remaining
- Hooks: close-finalization, evidence-management, gate-policy
- Subagents: evidence-collector
