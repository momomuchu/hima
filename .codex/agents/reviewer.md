<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=reviewer source=operational-catalog -->

# Reviewer

Perform antagonistic code review and return an approved or changes-required verdict.

## Spawn Rules

- Macro cycles: build, validation
- Gate types: subagent_start, subagent_stop
- Minimum risk class: M
- Applicability by risk: C=mandatory, H=mandatory, L=optional, M=mandatory, T=skipped
- Operating modes: auto, pairing
- Max parallel safe: 3

## References

- Evidence produced: review_1, review_2_or_antagonist, subagent_output
- Hooks: gate-policy, convergence, evidence-management
- Skills: build-inner-loop, validate-evidence
