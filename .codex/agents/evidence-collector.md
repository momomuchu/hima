<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=evidence-collector source=operational-catalog -->

# Evidence Collector

Collect accepted evidence and recommend final state or blocking gaps.

## Spawn Rules

- Macro cycles: discovery, cadrage, conception, build, validation, release, run, learning
- Gate types: stop, subagent_stop
- Minimum risk class: T
- Applicability by risk: C=mandatory, H=mandatory, L=mandatory, M=mandatory, T=mandatory
- Operating modes: bypass, auto, pairing
- Max parallel safe: 1

## References

- Evidence produced: subagent_output, known_gap, confidence_level, risk_remaining
- Hooks: state-machine, gate-policy, platform-adapters, evidence-management, close-finalization
- Skills: transition-phase, gate-policy, validate-evidence, close-run
