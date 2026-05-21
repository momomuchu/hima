---
name: "requirements-clarity"
version: "1.0.0"
type: task
triggers:
  - "requirements"
  - "ambiguity"
  - "scope"
expected_outputs:
  - "clarified_requirements: testable requirement statements"
  - "ambiguity_log: unresolved branches and assumptions"
requires_tools: []
fallback_for_toolsets: []
description: "Convert ambiguous intent into testable requirement statements with explicit assumptions."
---

<!-- HIMA:SKILL-ARTIFACT name=requirements-clarity source=book/03-specification -->

# Requirements Clarity

Convert ambiguous intent into testable requirements before the plan or implementation phase.

## Activation

- Macro cycles: discovery, cadrage, conception
- Gate types: user_prompt, session_start
- Risk classes: L, M, H, C
- Operating modes: auto, pairing
- Keywords: requirements, ambiguity, scope

## Ownership

- Owns: requirement statements, ambiguity log, assumption boundary
- Out of scope: implementation, external stakeholder interviews, irreversible scope expansion
