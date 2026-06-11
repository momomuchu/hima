---
kind: dor
cycle: build
title: Build Definition of Ready
version: 1
criteria:
  - id: DOR-BUILD-1
    text: The work has a scoped objective, known files or modules, and no unresolved destructive branch.
  - id: DOR-BUILD-2
    text: Regression coverage is identified or a test-first addition is planned before editing behavior.
  - id: DOR-BUILD-3
    text: The risk class, allowed write zones, and validation commands are known.
Falsifies-If:
  kill-condition: Build begins without scoped files, regression plan, or validation command.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-04-build.md
  on-fail: Return to conception or cadrage and write the missing build handoff.
---

# Build DoR

Build is ready when implementation can proceed through a controlled test and verification loop.
