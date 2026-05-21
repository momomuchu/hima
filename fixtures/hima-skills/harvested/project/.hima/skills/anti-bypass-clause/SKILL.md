---
name: "anti-bypass-clause"
version: "1.0.0"
type: task
triggers:
  - "anti-bypass"
  - "permission-bypass"
  - "tool-policy"
expected_outputs:
  - "bypass_clause: prohibited bypass paths and allowed escalation route"
  - "violation_signal: detected bypass attempt or missing enforcement"
requires_tools: []
fallback_for_toolsets: []
description: "State anti-bypass constraints before permission-sensitive tool or agent work."
---

<!-- HIMA:SKILL-ARTIFACT name=anti-bypass-clause source=harvest/opencode -->

# Anti-Bypass Clause

State anti-bypass constraints before permission-sensitive tool or agent work.

## Activation

- Macro cycles: conception, build, validation, release, run
- Gate types: user_prompt, pre_tool, subagent_start
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: anti-bypass, permission-bypass, tool-policy

## Ownership

- Owns: bypass clause, escalation route, missing enforcement warning
- Out of scope: runtime permission enforcement, adapter hook wiring, external runtime sessions
