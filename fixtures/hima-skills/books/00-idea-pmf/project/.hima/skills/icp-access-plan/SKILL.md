---
name: "icp-access-plan"
version: "1.0.0"
type: task
triggers:
  - "icp"
  - "access"
  - "customer"
expected_outputs:
  - "icp_access_plan: reachable segment and channel"
  - "conversation_target: first validation contact plan"
requires_tools: []
fallback_for_toolsets: []
description: "Define a reachable ICP access path before spending build effort."
---

<!-- HIMA:SKILL-ARTIFACT name=icp-access-plan source=book/00-idea-pmf -->

# ICP Access Plan

Define the smallest reachable path to a real customer conversation.

## Guardrails

- Segment must be reachable by the current team.
- Channel must be concrete enough to execute.
- No build commitment without an access path.
