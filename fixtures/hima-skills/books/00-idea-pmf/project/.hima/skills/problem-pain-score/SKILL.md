---
name: "problem-pain-score"
version: "1.0.0"
type: task
triggers:
  - "pain"
  - "problem"
  - "score"
expected_outputs:
  - "pain_score: ranked pain with evidence"
  - "decision: kill continue or test-next"
requires_tools: []
fallback_for_toolsets: []
description: "Score problem pain with explicit evidence and hard kill gates."
---

<!-- HIMA:SKILL-ARTIFACT name=problem-pain-score source=book/00-idea-pmf -->

# Problem Pain Score

Score the problem before evaluating the solution.

## Guardrails

- Do not let founder enthusiasm replace evidence.
- Low pain kills the seed.
- The next action must reduce uncertainty, not add features.
