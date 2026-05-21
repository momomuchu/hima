---
name: "mode-state-machine"
version: "1.0.0"
type: task
triggers:
  - "mode"
  - "state-machine"
  - "workflow-state"
expected_outputs:
  - "state_snapshot: current mode state and legal transitions"
  - "transition_guard: allowed blocked or deferred movement with reason"
requires_tools: []
fallback_for_toolsets: []
description: "Track workflow mode state and guard transitions before execution proceeds."
---

<!-- HIMA:SKILL-ARTIFACT name=mode-state-machine source=harvest/omx -->

# Mode State Machine

Track workflow mode state and guard legal transitions before execution proceeds.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt, pre_tool, post_tool
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: mode, state-machine, workflow-state

## Ownership

- Owns: mode state snapshot, legal transition summary, transition guard decision
- Out of scope: full runtime orchestration, hook persistence implementation, real user-home state writes
