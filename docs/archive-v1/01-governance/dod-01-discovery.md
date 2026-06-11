---
kind: dod
cycle: discovery
title: Discovery Definition of Done
version: 1
criteria:
  - id: DOD-DISCOVERY-1
    text: Findings separate evidence, inference, assumption, and unresolved risk.
  - id: DOD-DISCOVERY-2
    text: Top claims cite inspected artifacts or sources that can be re-opened by a reviewer.
  - id: DOD-DISCOVERY-3
    text: The next cycle receives a short list of decisions, gaps, and recommended scope.
Falsifies-If:
  kill-condition: Discovery closes with unsourced conclusions or no decision-ready handoff.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-01-discovery.md
  on-fail: Reopen discovery for source inspection and produce a decision handoff.
---

# Discovery DoD

Discovery is done only when it changes what the project can decide. A broad inventory without inspected evidence is not sufficient.
