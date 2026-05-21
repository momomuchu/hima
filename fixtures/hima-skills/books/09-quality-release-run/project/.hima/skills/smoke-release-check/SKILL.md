---
name: "smoke-release-check"
version: "1.0.0"
type: task
triggers:
  - "smoke"
  - "release-check"
  - "preflight"
expected_outputs:
  - "smoke_result: release-critical checks and outcomes"
  - "blocked_until: missing prerequisites for real release execution"
requires_tools: []
fallback_for_toolsets: []
description: "Run or plan release smoke checks while separating local preflight from real execution."
---

<!-- HIMA:SKILL-ARTIFACT name=smoke-release-check source=book/09-quality-release-run -->

# Smoke Release Check

Run or plan release smoke checks while separating local preflight from real execution.

## Activation

- Macro cycles: validation, release
- Gate types: pre_tool, post_tool
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: smoke, release-check, preflight

## Ownership

- Owns: smoke check result, missing prerequisite list, local-vs-real execution boundary
- Out of scope: external model sessions, public package publication, production rollout
