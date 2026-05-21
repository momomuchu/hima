---
name: "domain-modeling"
version: "1.0.0"
type: task
triggers:
  - "ddd"
  - "domain-model"
  - "aggregate"
expected_outputs:
  - "model_elements: entities value objects aggregates and domain events"
  - "invariant_map: rules that must hold across lifecycle transitions"
requires_tools: []
fallback_for_toolsets: []
description: "Shape domain models around aggregates, value objects, events, and invariants."
---

<!-- HIMA:SKILL-ARTIFACT name=domain-modeling source=book/05-architecture -->

# Domain Modeling

Shape the domain model around aggregate boundaries, value objects, events, and invariants.

## Activation

- Macro cycles: conception, build, validation
- Gate types: user_prompt, pre_tool, post_tool
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: ddd, domain-model, aggregate

## Ownership

- Owns: model element inventory, aggregate boundary notes, invariant map
- Out of scope: broad rewrites without migration plan, storage tuning, external runtime sessions
