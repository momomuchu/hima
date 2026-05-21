---
name: "runtime-architecture-decision"
version: "1.0.0"
type: task
triggers:
  - "adr"
  - "runtime-architecture"
  - "design-decision"
expected_outputs:
  - "decision_record: chosen architecture with constraints and rejected options"
  - "verification_plan: evidence needed before the decision is accepted"
requires_tools: []
fallback_for_toolsets: []
description: "Record runtime architecture decisions with constraints, rejected options, and verification needs."
---

<!-- HIMA:SKILL-ARTIFACT name=runtime-architecture-decision source=book/05-architecture -->

# Runtime Architecture Decision

Record architecture decisions with constraints, rejected options, scope risk, and verification needs.

## Activation

- Macro cycles: conception, build, validation, release
- Gate types: user_prompt, pre_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: adr, runtime-architecture, design-decision

## Ownership

- Owns: decision record, rejected alternatives, verification plan
- Out of scope: implementing unapproved designs, external runtime execution, release certification
