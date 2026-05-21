---
kind: dor
cycle: run
title: Run Definition of Ready
version: 1
criteria:
  - id: DOR-RUN-1
    text: Release produced an artifact with operator-facing notes and rollback instructions.
  - id: DOR-RUN-2
    text: Monitoring, support channel, and incident escalation owner are identified.
  - id: DOR-RUN-3
    text: Success signals, failure signals, and observation window are stated.
Falsifies-If:
  kill-condition: Run begins without release artifact proof, monitoring, or escalation path.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-07-run.md
  on-fail: Return to release and complete operational readiness.
---

# Run DoR

Run is ready when the released artifact can be observed and supported in its target environment.
