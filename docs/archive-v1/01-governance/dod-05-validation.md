---
kind: dod
cycle: validation
title: Validation Definition of Done
version: 1
criteria:
  - id: DOD-VALIDATION-1
    text: Required evidence keys for the risk class are accepted or explicitly marked as residual risk.
  - id: DOD-VALIDATION-2
    text: Positive and negative checks were run and their outputs are available for inspection.
  - id: DOD-VALIDATION-3
    text: A reviewer or critic pass found no material uncovered requirement.
Falsifies-If:
  kill-condition: Validation closes with missing required evidence or unchecked negative cases.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-05-validation.md
  on-fail: Reopen validation and collect the missing evidence before release.
---

# Validation DoD

Validation is done when the evidence set supports the claim being made about the change.
