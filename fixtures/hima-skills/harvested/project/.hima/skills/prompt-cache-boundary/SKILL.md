---
name: "prompt-cache-boundary"
version: "1.0.0"
type: task
triggers:
  - "prompt-cache"
  - "cache-boundary"
  - "context-reuse"
expected_outputs:
  - "cache_boundary: cacheable prompt context and non-cacheable state"
  - "invalidation_signal: freshness risks requiring cache bypass or invalidation"
requires_tools: []
fallback_for_toolsets: []
description: "Separate cacheable prompt context from fresh state before context reuse."
---

<!-- HIMA:SKILL-ARTIFACT name=prompt-cache-boundary source=harvest/claw-code -->

# Prompt Cache Boundary

Separate cacheable prompt context from fresh state before context reuse.

## Activation

- Macro cycles: specification, build, validation, run
- Gate types: session_start, user_prompt, pre_tool
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: prompt-cache, cache-boundary, context-reuse

## Ownership

- Owns: cache boundary, invalidation reason, freshness warning
- Out of scope: real prompt-cache integration, cache hit metrics, external runtime sessions
