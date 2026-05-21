---
name: "ai-slop-cleaner"
version: "1.0.0"
type: task
triggers:
  - "slop"
  - "cleanup"
  - "deslop"
expected_outputs:
  - "cleanup_plan: smell-focused cleanup plan"
  - "regression_evidence: tests or explicit unchanged-behavior evidence"
requires_tools: []
fallback_for_toolsets: []
description: "Run a bounded anti-slop cleanup pass after behavior is locked by evidence."
---

<!-- HIMA:SKILL-ARTIFACT name=ai-slop-cleaner source=harvest/omc -->

# AI Slop Cleaner

Run a bounded cleanup pass only after existing behavior is protected by tests or explicit
unchanged-behavior evidence.

## Activation

- Macro cycles: build, validation, release
- Gate types: subagent_stop, post_tool
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: slop, cleanup, deslop

## Ownership

- Owns: cleanup plan, duplication reduction, unnecessary abstraction removal, post-cleanup evidence
- Out of scope: broad rewrites, dependency additions, behavior changes, unverified style-only churn
