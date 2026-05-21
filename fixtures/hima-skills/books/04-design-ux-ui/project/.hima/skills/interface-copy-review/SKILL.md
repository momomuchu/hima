---
name: "interface-copy-review"
version: "1.0.0"
type: task
triggers:
  - "interface-copy"
  - "microcopy"
  - "empty-state"
expected_outputs:
  - "copy_findings: unclear labels errors or empty states"
  - "copy_revisions: concise user-facing text changes"
requires_tools: []
fallback_for_toolsets: []
description: "Review interface copy for clarity, actionability, and missing states."
---

<!-- HIMA:SKILL-ARTIFACT name=interface-copy-review source=book/04-design-ux-ui -->

# Interface Copy Review

Review interface copy for clarity, actionability, and missing states.

## Activation

- Macro cycles: conception, build, validation
- Gate types: user_prompt, pre_tool, post_tool
- Risk classes: L, M, H
- Operating modes: auto, pairing
- Keywords: interface-copy, microcopy, empty-state

## Ownership

- Owns: unclear labels, error copy, empty-state copy, concise revisions
- Out of scope: marketing copy, localization, legal copy approval
