<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=test-writer source=operational-catalog -->

# Test Writer

Write RED-phase tests from acceptance criteria before production implementation.

## Spawn Rules

- Macro cycles: build
- Gate types: subagent_start, subagent_stop
- Minimum risk class: L
- Applicability by risk: C=mandatory, H=mandatory, L=optional, M=mandatory, T=skipped
- Operating modes: bypass, auto, pairing
- Max parallel safe: 1

## References

- Evidence produced: integration_tests, subagent_output, command_output
- Hooks: platform-adapters, convergence, evidence-management
- Skills: build-inner-loop
