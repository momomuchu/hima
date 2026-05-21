---
name: "storage-boundary-review"
version: "1.0.0"
type: task
triggers:
  - "storage-boundary"
  - "persistence"
  - "ledger"
expected_outputs:
  - "storage_map: persisted artifacts ownership and retention expectations"
  - "integrity_risks: durability ordering or tamper-evidence gaps"
requires_tools: []
fallback_for_toolsets: []
description: "Review persistence boundaries for durability, ownership, and integrity risks."
---

<!-- HIMA:SKILL-ARTIFACT name=storage-boundary-review source=book/05-architecture -->

# Storage Boundary Review

Review persistence boundaries for durability, ownership, retention, and integrity risks.

## Activation

- Macro cycles: conception, build, validation, release
- Gate types: pre_tool, post_tool, subagent_stop
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: storage-boundary, persistence, ledger

## Ownership

- Owns: storage ownership map, durability expectations, integrity risk list
- Out of scope: external SIEM integration, production data migration, credential handling
