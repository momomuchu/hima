---
kind: dod
cycle: conception
title: Conception Definition of Done
version: 1
criteria:
  - id: DOD-CONCEPTION-1
    text: The selected design names changed modules, interfaces, invariants, and migration rules.
  - id: DOD-CONCEPTION-2
    text: At least one rejected design is documented with the reason it should not be retried.
  - id: DOD-CONCEPTION-3
    text: The build handoff includes test strategy, rollback expectations, and known residual risks.
Falsifies-If:
  kill-condition: Conception closes with a design that cannot be implemented or tested without re-planning.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-03-conception.md
  on-fail: Reopen conception and produce an implementable design handoff.
---

# Conception DoD

Conception is done when the build cycle can implement from the artifact without re-discovering core boundaries.
