---
name: "typed-handoff"
version: "1.0.0"
type: task
triggers:
  - "handoff"
  - "human-input"
  - "clarify"
expected_outputs:
  - "handoff_request: typed human input request"
  - "decision_boundary: why automation cannot continue safely"
requires_tools: []
fallback_for_toolsets: []
description: "Create a typed human-handoff request when missing authority blocks safe progress."
---

<!-- HIMA:SKILL-ARTIFACT name=typed-handoff source=harvest/12-factor-agents-goose -->

# Typed Handoff

Create a structured human-handoff request only when automation is blocked by missing authority,
missing information, or an irreversible decision boundary.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release
- Gate types: user_prompt, pre_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: pairing
- Keywords: handoff, human-input, clarify

## Ownership

- Owns: typed handoff prompt, urgency, expected answer format, decision boundary
- Out of scope: routine reversible commands, broad interview flows, external ticket creation
