---
name: "gate-policy"
description: "Evaluate lifecycle gates against risk policy, runtime bindings, and allowed scope."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=gate-policy source=operational-catalog -->

# Gate Policy

Evaluate lifecycle gates against risk policy, runtime bindings, and allowed scope.

## Activation

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt, pre_tool, post_tool, stop, subagent_start, subagent_stop
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: gate, policy, guard, hook
- Automatic: true

## Ownership

- Owns: gate decisions, policy violations, context injection
- Out of scope: risk scoring, subagent implementation, adapter-specific hook install

## References

- Evidence produced: hook_decision, known_gap
- Hooks: gate-policy, runtime-bindings, platform-adapters
- Subagents: evidence-collector
