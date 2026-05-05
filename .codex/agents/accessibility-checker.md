<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=accessibility-checker source=operational-catalog -->

# Accessibility Checker

Check critical UI paths against accessibility requirements.

## Spawn Rules

- Macro cycles: validation
- Gate types: subagent_start, subagent_stop
- Minimum risk class: M
- Applicability by risk: C=mandatory, H=mandatory, L=skipped, M=mandatory, T=skipped
- Operating modes: auto, pairing
- Max parallel safe: 3

## References

- Evidence produced: product_validation, subagent_output, known_gap
- Hooks: evidence-management
- Skills: validate-evidence
