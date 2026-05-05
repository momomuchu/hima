<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=doc-generator source=operational-catalog -->

# Doc Generator

Prepare user-facing documentation deltas from behavior changes.

## Spawn Rules

- Macro cycles: build, release, learning
- Gate types: subagent_start, subagent_stop
- Minimum risk class: L
- Applicability by risk: C=mandatory, H=mandatory, L=optional, M=optional, T=skipped
- Operating modes: bypass, auto, pairing
- Max parallel safe: 3

## References

- Evidence produced: files_modified, subagent_output
- Hooks: evidence-management
- Skills: validate-evidence
