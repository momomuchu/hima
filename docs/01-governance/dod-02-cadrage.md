---
kind: dod
cycle: cadrage
title: Cadrage Definition of Done
version: 1
criteria:
  - id: DOD-CADRAGE-1
    text: The change objective, exclusions, and done criteria are written in testable language.
  - id: DOD-CADRAGE-2
    text: The risk class and required evidence set are recorded with rationale.
  - id: DOD-CADRAGE-3
    text: Material tradeoffs and rejected alternatives are captured before conception starts.
Falsifies-If:
  kill-condition: Cadrage closes with ambiguous scope or no evidence obligations for the selected risk class.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-02-cadrage.md
  on-fail: Reopen cadrage and rewrite the objective, exclusions, risk class, and evidence set.
---

# Cadrage DoD

Cadrage is done when a later design or build agent can tell what is authorized, what is excluded, and what proof will be required.
