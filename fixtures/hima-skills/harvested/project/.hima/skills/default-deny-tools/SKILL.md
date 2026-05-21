---
name: "default-deny-tools"
version: "1.0.0"
type: task
triggers:
  - "default-deny"
  - "subagent-tools"
  - "tool-policy"
expected_outputs:
  - "deny_policy: blocked subagent tools and allowed exceptions"
  - "enforcement_gap: missing runtime handler or test coverage"
requires_tools: []
fallback_for_toolsets: []
description: "Apply default-deny reasoning to subagent tool policy before delegated work runs."
---

<!-- HIMA:SKILL-ARTIFACT name=default-deny-tools source=harvest/opencode -->

# Default Deny Tools

Apply default-deny reasoning to subagent tool policy before delegated work runs.

## Activation

- Macro cycles: conception, build, validation, release
- Gate types: subagent_start, pre_tool
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: default-deny, subagent-tools, tool-policy

## Ownership

- Owns: denied tool list, exception rationale, enforcement gap summary
- Out of scope: `handle-hook.ts` implementation, live SubagentStart enforcement, real subagent execution
