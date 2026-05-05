<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->

# Gate Policy

Lifecycle gate enforcement, violation classes, and stop conditions.

## Applicability

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: session_start, user_prompt, pre_tool, post_tool, stop, subagent_start, subagent_stop
- Risk classes: T, L, M, H, C
- Operating modes: bypass, auto, pairing

## References

- Evidence keys: hook_decision, human_validation, explicit_human_signature
- Skills: hima-enter, propose-change, gate-policy, close-run
- Subagents: evidence-collector, reviewer
