---
name: "interaction-flow-review"
version: "1.0.0"
type: task
triggers:
  - "interaction"
  - "flow"
  - "workflow"
expected_outputs:
  - "flow_map: user steps and decision points"
  - "friction_points: confusing or inefficient interactions"
requires_tools: []
fallback_for_toolsets: []
description: "Review interaction flows for friction, missing states, and inefficient steps."
---

<!-- HIMA:SKILL-ARTIFACT name=interaction-flow-review source=book/04-design-ux-ui -->

# Interaction Flow Review

Review interaction flows for friction, missing states, and inefficient steps.

## Activation

- Macro cycles: cadrage, conception, build, validation
- Gate types: user_prompt, pre_tool, subagent_stop
- Risk classes: L, M, H
- Operating modes: auto, pairing
- Keywords: interaction, flow, workflow

## Ownership

- Owns: flow map, friction points, missing interaction states
- Out of scope: implementation, brand strategy, broad product roadmap changes
