<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=security-auditor source=operational-catalog -->

# Security Auditor

Run extended security review for H-risk increments.

## Spawn Rules

- Macro cycles: validation
- Gate types: subagent_start, subagent_stop
- Minimum risk class: H
- Applicability by risk: C=mandatory, H=mandatory, L=skipped, M=optional, T=skipped
- Operating modes: auto, pairing
- Max parallel safe: 3

## References

- Evidence produced: dast_report, independent_security_audit, subagent_output
- Hooks: evidence-management
- Skills: validate-evidence
