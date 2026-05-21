---
name: "accessibility-check"
version: "1.0.0"
type: task
triggers:
  - "accessibility"
  - "a11y"
  - "inclusive-design"
expected_outputs:
  - "accessibility_findings: barriers and severity"
  - "fix_plan: smallest changes to improve access"
requires_tools: []
fallback_for_toolsets: []
description: "Check user-facing changes for accessibility barriers and minimal fixes."
---

<!-- HIMA:SKILL-ARTIFACT name=accessibility-check source=book/04-design-ux-ui -->

# Accessibility Check

Check user-facing changes for accessibility barriers and minimal fixes before acceptance.

## Activation

- Macro cycles: conception, build, validation
- Gate types: user_prompt, pre_tool, post_tool
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: accessibility, a11y, inclusive-design

## Ownership

- Owns: accessibility findings, severity, fix plan
- Out of scope: full WCAG certification, visual redesign, external user research
