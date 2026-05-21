---
name: "message-hierarchy"
version: "1.0.0"
type: task
triggers:
  - "message"
  - "copy"
  - "hierarchy"
expected_outputs:
  - "message_hierarchy: primary claim and supporting proof"
  - "claim_boundary: what the message must not imply"
requires_tools: []
fallback_for_toolsets: []
description: "Build a message hierarchy with claims bounded by available proof."
---

<!-- HIMA:SKILL-ARTIFACT name=message-hierarchy source=book/01-strategy-positioning -->

# Message Hierarchy

Build a hierarchy from primary claim to proof points.

## Guardrails

- One primary claim per audience.
- Support each claim with concrete proof.
- Add a claim boundary where evidence is still local or partial.
