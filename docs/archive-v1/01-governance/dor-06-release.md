---
kind: dor
cycle: release
title: Release Definition of Ready
version: 1
criteria:
  - id: DOR-RELEASE-1
    text: Validation has accepted the required evidence set for the release risk class.
  - id: DOR-RELEASE-2
    text: The release artifact, version, changelog, rollback path, and owner are identified.
  - id: DOR-RELEASE-3
    text: Packaging, install, and platform-specific checks are named before publishing.
Falsifies-If:
  kill-condition: Release starts with no immutable artifact, rollback path, or install validation plan.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-06-release.md
  on-fail: Return to validation or build and complete the missing release inputs.
---

# Release DoR

Release is ready when publishing is a controlled operation rather than a discovery exercise.
