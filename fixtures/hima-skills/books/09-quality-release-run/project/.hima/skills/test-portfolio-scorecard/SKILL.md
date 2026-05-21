---
name: "test-portfolio-scorecard"
version: "1.0.0"
type: task
triggers:
  - "test-portfolio"
  - "coverage"
  - "release-quality"
expected_outputs:
  - "scorecard: test portfolio strengths and gaps"
  - "quality_actions: prioritized fixes before release confidence"
requires_tools: []
fallback_for_toolsets: []
description: "Score the test portfolio for release confidence and prioritize quality actions."
---

<!-- HIMA:SKILL-ARTIFACT name=test-portfolio-scorecard source=book/09-quality-release-run -->

# Test Portfolio Scorecard

Score the test portfolio for release confidence and prioritize quality actions.

## Activation

- Macro cycles: validation, release, run
- Gate types: post_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: test-portfolio, coverage, release-quality

## Ownership

- Owns: test portfolio scorecard, coverage gaps, prioritized quality actions
- Out of scope: full QA campaign ownership, production monitoring, legal certification
