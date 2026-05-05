---
name: "classify-risk"
description: "Assign a canonical T/L/M/H/C risk class and operating mode to each intent."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=classify-risk source=operational-catalog -->

# Classify Risk

Assign a canonical T/L/M/H/C risk class and operating mode to each intent.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: classify, risk, intent
- Automatic: true

## Ownership

- Owns: risk classification, forcing signal scan, operating mode selection
- Out of scope: cycle transition, implementation, evidence sufficiency evaluation

## References

- Evidence produced: confidence_level, risk_remaining
- Hooks: risk-classification
- Subagents: none
