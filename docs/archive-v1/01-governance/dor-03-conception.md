---
kind: dor
cycle: conception
title: Conception Definition of Ready
version: 1
criteria:
  - id: DOR-CONCEPTION-1
    text: Cadrage has produced a bounded objective with explicit acceptance and rejection criteria.
  - id: DOR-CONCEPTION-2
    text: Existing architecture, interfaces, and storage ownership relevant to the change are mapped.
  - id: DOR-CONCEPTION-3
    text: Risk-class evidence requirements and review gates are known before design work starts.
Falsifies-If:
  kill-condition: Conception starts without bounded scope, architecture map, or evidence requirements.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-03-conception.md
  on-fail: Return to cadrage and map the missing architecture or proof obligations.
---

# Conception DoR

Conception is ready when design decisions can be evaluated against a known boundary and existing system facts.
