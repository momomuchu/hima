---
kind: dor
cycle: validation
title: Validation Definition of Ready
version: 1
criteria:
  - id: DOR-VALIDATION-1
    text: Build produced an identifiable artifact or diff with expected behavior and risk class.
  - id: DOR-VALIDATION-2
    text: Required tests, reviews, and evidence keys are known for the current risk class.
  - id: DOR-VALIDATION-3
    text: Negative fixtures, edge cases, or critic checks are listed for claim-bearing behavior.
Falsifies-If:
  kill-condition: Validation starts without knowing what artifact, evidence set, or edge cases to verify.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-05-validation.md
  on-fail: Return to build and attach the missing artifact and validation plan.
---

# Validation DoR

Validation is ready when it can attack the actual change rather than re-running generic checks.
