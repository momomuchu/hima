---
name: "release-evidence-pack"
version: "1.0.0"
type: task
triggers:
  - "release-evidence"
  - "evidence-pack"
  - "signoff"
expected_outputs:
  - "evidence_pack: required release evidence and missing artifacts"
  - "signoff_boundary: what this evidence does and does not approve"
requires_tools: []
fallback_for_toolsets: []
description: "Assemble release evidence with explicit signoff boundaries and missing artifacts."
---

<!-- HIMA:SKILL-ARTIFACT name=release-evidence-pack source=book/09-quality-release-run -->

# Release Evidence Pack

Assemble release evidence while keeping signoff boundaries and missing artifacts explicit.

## Activation

- Macro cycles: validation, release, run
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: release-evidence, evidence-pack, signoff

## Ownership

- Owns: evidence inventory, missing artifact list, signoff boundary
- Out of scope: public release approval, legal certification, external runtime execution
