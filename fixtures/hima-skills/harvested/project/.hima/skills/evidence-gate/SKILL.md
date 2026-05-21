---
name: "evidence-gate"
version: "1.0.0"
type: task
triggers:
  - "evidence-gate"
  - "eval-suite"
  - "suite-promotion"
expected_outputs:
  - "gate_result: eval suite held-out split and promotion readiness"
  - "missing_evidence: gaps blocking evidence acceptance"
requires_tools: []
fallback_for_toolsets: []
description: "Apply a three-step evidence gate before accepting completion claims."
---

<!-- HIMA:SKILL-ARTIFACT name=evidence-gate source=harvest/auto-harness -->

# Evidence Gate

Apply a three-step evidence gate before accepting completion claims: evaluation suite, held-out
split, and suite promotion readiness.

## Activation

- Macro cycles: validation, release, run, learning
- Gate types: post_tool, subagent_stop, session_start
- Risk classes: M, H, C
- Operating modes: auto, pairing
- Keywords: evidence-gate, eval-suite, suite-promotion

## Ownership

- Owns: evidence gate result, missing proof list, promotion readiness summary
- Out of scope: `evaluate-evidence.ts` implementation, held-out evaluator execution, suite promotion automation, external runtime sessions
