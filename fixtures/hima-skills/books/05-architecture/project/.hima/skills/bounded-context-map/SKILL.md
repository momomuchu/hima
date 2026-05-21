---
name: "bounded-context-map"
version: "1.0.0"
type: task
triggers:
  - "bounded-context"
  - "context-map"
  - "ownership"
expected_outputs:
  - "context_map: domain boundaries and owned responsibilities"
  - "boundary_violations: files or behaviors crossing ownership lines"
requires_tools: []
fallback_for_toolsets: []
description: "Map bounded contexts and expose ownership boundary violations before design changes."
---

<!-- HIMA:SKILL-ARTIFACT name=bounded-context-map source=book/05-architecture -->

# Bounded Context Map

Map domain contexts, owned responsibilities, and boundary violations before architecture changes.

## Activation

- Macro cycles: discovery, conception, build
- Gate types: user_prompt, pre_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: bounded-context, context-map, ownership

## Ownership

- Owns: bounded context inventory, responsibility boundaries, violation list
- Out of scope: wholesale package moves, implementation without tests, runtime authorization
