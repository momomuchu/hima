---
name: "rollback-readiness"
version: "1.0.0"
type: task
triggers:
  - "rollback"
  - "release-plan"
  - "recovery"
expected_outputs:
  - "rollback_plan: revert path and data or config safety notes"
  - "release_hold: blockers that prevent safe rollout"
requires_tools: []
fallback_for_toolsets: []
description: "Check rollback readiness before treating a release or rollout as safe."
---

<!-- HIMA:SKILL-ARTIFACT name=rollback-readiness source=book/09-quality-release-run -->

# Rollback Readiness

Check rollback path, config safety, and release blockers before treating rollout as safe.

## Activation

- Macro cycles: release, run
- Gate types: pre_tool, post_tool
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: rollback, release-plan, recovery

## Ownership

- Owns: rollback plan, hold conditions, recovery notes
- Out of scope: production deployment, credential handling, legal compliance approval
