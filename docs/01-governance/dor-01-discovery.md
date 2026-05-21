---
kind: dor
cycle: discovery
title: Discovery Definition of Ready
version: 1
criteria:
  - id: DOR-DISCOVERY-1
    text: The initiating problem, user segment, or operational question is stated in one sentence.
  - id: DOR-DISCOVERY-2
    text: Known constraints, forbidden directions, and evidence sources are listed before research starts.
  - id: DOR-DISCOVERY-3
    text: The expected output shape is named, including whether the cycle should produce research, a decision, or an implementation brief.
Falsifies-If:
  kill-condition: Discovery starts from a vague prompt with no bounded question, constraints, or output shape.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-01-discovery.md
  on-fail: Return to cadrage and write the missing problem, constraints, and output definition.
---

# Discovery DoR

Discovery is ready when it has enough shape to search without inventing the target. The gate protects the cycle from collecting generic material that cannot drive a later decision.
