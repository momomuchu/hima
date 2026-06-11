---
kind: dod
cycle: release
title: Release Definition of Done
version: 1
criteria:
  - id: DOD-RELEASE-1
    text: The intended artifact has been published, tagged, or staged with immutable identity.
  - id: DOD-RELEASE-2
    text: Install or smoke checks passed on the declared target platforms or gaps are recorded.
  - id: DOD-RELEASE-3
    text: Release notes, known risks, and rollback instructions are available to operators.
Falsifies-If:
  kill-condition: Release closes without artifact identity, install proof, or rollback instructions.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-06-release.md
  on-fail: Reopen release and block run handoff until the artifact and rollback proof exist.
---

# Release DoD

Release is done when the shipped artifact is identifiable, installable, and reversible within the stated limits.
