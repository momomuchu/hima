---
name: "discovery-synthesis"
version: "1.0.0"
type: task
triggers:
  - "synthesis"
  - "discovery"
  - "findings"
expected_outputs:
  - "synthesis: ranked findings with confidence"
  - "next_action: decision or further check"
requires_tools: []
fallback_for_toolsets: []
description: "Synthesize discovery findings with confidence and next actions."
---

<!-- HIMA:SKILL-ARTIFACT name=discovery-synthesis source=book/02-analysis-discovery -->

# Discovery Synthesis

Synthesize findings into ranked conclusions and next actions.

## Guardrails

- Rank findings by decision impact.
- Attach confidence to each finding.
- Keep evidence, inference, assumption, and risk distinct.
