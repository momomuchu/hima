---
name: "contract-schema"
version: "1.0.0"
type: task
triggers:
  - "schema"
  - "contract"
  - "interface"
expected_outputs:
  - "contract_fields: required inputs outputs and invariants"
  - "compatibility_risks: breaking or ambiguous contract changes"
requires_tools: []
fallback_for_toolsets: []
description: "Shape schema and interface requirements into explicit contract fields and compatibility risks."
---

<!-- HIMA:SKILL-ARTIFACT name=contract-schema source=book/03-specification -->

# Contract Schema

Define the required fields, invariants, and compatibility risks for schema or interface work.

## Activation

- Macro cycles: conception, build, validation
- Gate types: user_prompt, pre_tool, post_tool
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: schema, contract, interface

## Ownership

- Owns: contract field inventory, invariant list, compatibility risk notes
- Out of scope: generated schema migrations, external API publication, dependency selection
