---
name: "compact-hooks"
version: "1.0.0"
type: task
triggers:
  - "pre-compact"
  - "post-compact"
  - "context-compaction"
expected_outputs:
  - "compact_snapshot: critical state preserved before compaction"
  - "continuity_check: post-compaction route and evidence continuity"
requires_tools: []
fallback_for_toolsets: []
description: "Preserve critical state across context compaction with pre and post compact checks."
---

<!-- HIMA:SKILL-ARTIFACT name=compact-hooks source=harvest/pro-workflow -->

# Compact Hooks

Preserve critical state across context-window compaction with pre and post compact checks.

## Activation

- Macro cycles: build, validation, release, run, learning
- Gate types: pre_compact, post_compact
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: pre-compact, post-compact, context-compaction

## Ownership

- Owns: compact snapshot, continuity check, missing state warning
- Out of scope: real adapter compaction invocation, user-home writes, external runtime sessions
