---
name: "spec-review"
version: "1.0.0"
type: task
triggers:
  - "spec-review"
  - "review-spec"
  - "readiness"
expected_outputs:
  - "readiness_verdict: ready blocked or needs revision"
  - "missing_sections: absent or weak spec obligations"
requires_tools: []
fallback_for_toolsets: []
description: "Review a specification for readiness, missing obligations, and testability before build."
---

<!-- HIMA:SKILL-ARTIFACT name=spec-review source=book/03-specification -->

# Spec Review

Review a specification for readiness, missing obligations, and testability before build work starts.

## Activation

- Macro cycles: conception, build, validation
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: spec-review, review-spec, readiness

## Ownership

- Owns: readiness verdict, missing sections, testability concerns
- Out of scope: implementing the spec, approving external production actions, rewriting unrelated docs
