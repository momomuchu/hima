---
name: "validate-evidence"
description: "Check whether the accepted Evidence Set is sufficient for the current risk class."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=validate-evidence source=operational-catalog -->

# Validate Evidence

Check whether the accepted Evidence Set is sufficient for the current risk class.

## Activation

- Macro cycles: validation, release, run, learning
- Gate types: stop, subagent_stop
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: evidence, verify, validation, done
- Automatic: true

## Ownership

- Owns: evidence sufficiency, gap list, final-state recommendation
- Out of scope: running tests, writing artifacts, approving human checkpoints

## References

- Evidence produced: confidence_level, known_gap, risk_remaining
- Hooks: evidence-management, close-finalization
- Subagents: evidence-collector, reviewer, security-auditor
