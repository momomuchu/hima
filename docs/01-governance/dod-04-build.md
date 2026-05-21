---
kind: dod
cycle: build
title: Build Definition of Done
version: 1
criteria:
  - id: DOD-BUILD-1
    text: The implementation is in place with no unrelated refactor or uncontrolled file churn.
  - id: DOD-BUILD-2
    text: Relevant tests, type checks, and static checks pass or have explicit known-gap evidence.
  - id: DOD-BUILD-3
    text: Changed behavior is mapped back to the objective and risk-class evidence set.
Falsifies-If:
  kill-condition: Build closes with code changes that are untested, unrelated, or unmapped to the objective.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-04-build.md
  on-fail: Reopen build, narrow the diff, and run the missing checks.
---

# Build DoD

Build is done when the code and proof surface agree. Passing a broad test command is not enough if it does not cover the objective.
