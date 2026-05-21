---
kind: dod
cycle: run
title: Run Definition of Done
version: 1
criteria:
  - id: DOD-RUN-1
    text: The observation window has produced health, failure, and usage evidence.
  - id: DOD-RUN-2
    text: Incidents, regressions, and user friction are recorded with severity and owner.
  - id: DOD-RUN-3
    text: Learnings are packaged for the learning cycle with evidence anchors.
Falsifies-If:
  kill-condition: Run closes without operational evidence or a learning handoff.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-07-run.md
  on-fail: Extend the observation window or document the missing telemetry as a release gap.
---

# Run DoD

Run is done when operational reality has been observed and converted into learning inputs.
