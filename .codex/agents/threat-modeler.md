<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=threat-modeler source=operational-catalog -->

# Threat Modeler

Analyze new data flows with STRIDE and return residual risks and controls.

## Spawn Rules

- Macro cycles: conception
- Gate types: subagent_start, subagent_stop
- Minimum risk class: H
- Applicability by risk: C=mandatory, H=mandatory, L=skipped, M=skipped, T=skipped
- Operating modes: auto, pairing
- Max parallel safe: 3

## References

- Evidence produced: threat_model_stride, subagent_output, risk_remaining
- Hooks: evidence-management
- Skills: validate-evidence
