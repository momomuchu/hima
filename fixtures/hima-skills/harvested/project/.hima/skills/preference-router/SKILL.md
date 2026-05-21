---
name: "preference-router"
version: "1.0.0"
type: task
triggers:
  - "preference-router"
  - "evaluate-then-decide"
  - "model-routing"
expected_outputs:
  - "route_decision: candidate preferences and selected route"
  - "evaluation_gap: missing evidence before routing decision"
requires_tools: []
fallback_for_toolsets: []
description: "Evaluate route preferences before selecting an agent or runtime path."
---

<!-- HIMA:SKILL-ARTIFACT name=preference-router source=harvest/nexus-agents -->

# Preference Router

Evaluate route preferences before selecting an agent or runtime path.

## Activation

- Macro cycles: triage, planning, build, validation
- Gate types: session_start, user_prompt, subagent_start
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: preference-router, evaluate-then-decide, model-routing

## Ownership

- Owns: preference criteria, route decision, missing-evidence warning
- Out of scope: real router implementation, model execution, external runtime sessions
