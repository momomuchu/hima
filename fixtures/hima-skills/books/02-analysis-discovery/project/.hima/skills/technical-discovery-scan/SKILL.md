---
name: "technical-discovery-scan"
version: "1.0.0"
type: task
triggers:
  - "technical-discovery"
  - "scan"
  - "architecture"
expected_outputs:
  - "system_map: relevant files modules and boundaries"
  - "risk_notes: implementation risks and unknowns"
requires_tools: []
fallback_for_toolsets: []
description: "Scan a technical surface and map relevant files, boundaries, and risks."
---

<!-- HIMA:SKILL-ARTIFACT name=technical-discovery-scan source=book/02-analysis-discovery -->

# Technical Discovery Scan

Map the implementation surface before planning changes.

## Guardrails

- Prefer repo facts over architectural guesses.
- Name files and boundaries concretely.
- Record unknowns that affect implementation risk.
