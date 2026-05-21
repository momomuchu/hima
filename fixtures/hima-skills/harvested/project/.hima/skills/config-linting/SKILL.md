---
name: "config-linting"
version: "1.0.0"
type: task
triggers:
  - "config-lint"
  - "skill-lint"
  - "misconfiguration"
expected_outputs:
  - "lint_report: detected skill or runtime configuration risks"
  - "remediation_plan: smallest safe fixes before execution"
requires_tools: []
fallback_for_toolsets: []
description: "Detect silent-failure risks in HIMA skill and runtime configuration before execution."
---

<!-- HIMA:SKILL-ARTIFACT name=config-linting source=harvest/agnix -->

# Config Linting

Detect silent-failure risks in local HIMA skill and runtime configuration before trusting a run.

## Activation

- Macro cycles: session_start, conception, build, validation, release
- Gate types: session_start, pre_tool, post_tool
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: config-lint, skill-lint, misconfiguration

## Ownership

- Owns: local configuration risk report, missing frontmatter checks, unsafe fallback detection, remediation plan
- Out of scope: full 423-rule implementation, CI enforcement, real user-home scans, external runtime mutation
