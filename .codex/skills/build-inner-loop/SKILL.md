---
name: "build-inner-loop"
description: "Run a risk-calibrated RED/GREEN/REFACTOR implementation loop."
---

<!-- HIMA:CATALOG-ARTIFACT kind=skill id=build-inner-loop source=operational-catalog -->

# Build Inner Loop

Run a risk-calibrated RED/GREEN/REFACTOR implementation loop.

## Activation

- Macro cycles: build
- Gate types: pre_tool, post_tool
- Risk classes: L, M, H, C
- Operating modes: bypass, auto, pairing
- Keywords: build, tdd, implement, code
- Automatic: false

## Ownership

- Owns: test-first workflow, minimum implementation, focused verification
- Out of scope: release decision, production monitoring, human approval

## References

- Evidence produced: integration_tests, command_output, files_modified
- Hooks: convergence, evidence-management
- Subagents: test-writer, reviewer
