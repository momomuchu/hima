---
name: "source-triangulation"
version: "1.0.0"
type: task
triggers:
  - "triangulate"
  - "sources"
  - "evidence"
expected_outputs:
  - "source_table: independent sources with confidence"
  - "conflict_note: disagreement and resolution"
requires_tools: []
fallback_for_toolsets: []
description: "Triangulate claims across independent sources before relying on them."
---

<!-- HIMA:SKILL-ARTIFACT name=source-triangulation source=book/02-analysis-discovery -->

# Source Triangulation

Triangulate a claim across independent sources and record disagreement instead of smoothing it away.

## Guardrails

- Do not count mirrors as independent sources.
- Separate direct evidence from commentary.
- Keep unresolved conflicts visible.
