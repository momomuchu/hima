---
name: "evidence-map"
version: "1.0.0"
type: task
triggers:
  - "evidence-map"
  - "map"
  - "research"
expected_outputs:
  - "evidence_map: claims mapped to artifacts"
  - "gap_list: unsupported claims"
requires_tools: []
fallback_for_toolsets: []
description: "Map claims to concrete evidence artifacts and expose unsupported gaps."
---

<!-- HIMA:SKILL-ARTIFACT name=evidence-map source=book/02-analysis-discovery -->

# Evidence Map

Map each claim to the artifact that proves it.

## Guardrails

- A passed test is evidence only for what it covers.
- Unsupported claims stay in the gap list.
- Proxy evidence cannot close a direct-evidence requirement.
