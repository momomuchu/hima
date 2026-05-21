---
name: "classify-risk"
version: "1.0.0"
type: task
triggers:
  - "classify"
  - "risk"
  - "intent"
expected_outputs:
  - "confidence_level: accepted evidence"
  - "risk_remaining: accepted evidence"
requires_tools: []
fallback_for_toolsets: []
description: "Assign a canonical T/L/M/H/C risk class and operating mode to each intent."
---

<!-- HIMA:SKILL-ARTIFACT name=classify-risk source=operational-catalog -->

# Classify Risk

Assign a canonical T/L/M/H/C risk class and operating mode to each intent.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: classify, risk, intent

## Ownership

- Owns: risk classification, forcing signal scan, operating mode selection
- Out of scope: cycle transition, implementation, evidence sufficiency evaluation

