---
name: "verification-loop"
version: "1.0.0"
type: task
triggers:
  - "verify"
  - "test-fix"
  - "green"
expected_outputs:
  - "verification_result: checks run and their pass fail result"
  - "next_fix: smallest follow-up when verification fails"
requires_tools: []
fallback_for_toolsets: []
description: "Run a test-fix-verify loop until the scoped build claim is evidenced or blocked."
---

<!-- HIMA:SKILL-ARTIFACT name=verification-loop source=book/07-build -->

# Verification Loop

Run a test-fix-verify loop until the scoped build claim is evidenced or explicitly blocked.

## Activation

- Macro cycles: build, validation, release
- Gate types: post_tool, subagent_stop
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: verify, test-fix, green

## Ownership

- Owns: verification result, failure triage, smallest next fix
- Out of scope: broad benchmark campaigns, external runtime/model sessions, release signoff
