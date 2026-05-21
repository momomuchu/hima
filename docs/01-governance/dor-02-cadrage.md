---
kind: dor
cycle: cadrage
title: Cadrage Definition of Ready
version: 1
criteria:
  - id: DOR-CADRAGE-1
    text: Discovery produced a decision handoff with explicit evidence and open risks.
  - id: DOR-CADRAGE-2
    text: The problem boundary, in-scope work, and out-of-scope work can be stated without contradiction.
  - id: DOR-CADRAGE-3
    text: Stakeholders, affected runtime surfaces, and likely risk class are identified.
Falsifies-If:
  kill-condition: Cadrage begins while scope, stakeholder, or risk-class questions remain undefined.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-02-cadrage.md
  on-fail: Send the work back to discovery or open a focused clarification artifact.
---

# Cadrage DoR

Cadrage is ready when discovery can be turned into boundaries. It should not be used as a second discovery pass.
