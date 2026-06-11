---
kind: dor
cycle: learning
title: Learning Definition of Ready
version: 1
criteria:
  - id: DOR-LEARNING-1
    text: Run produced operational evidence, incidents, user friction, or success signals.
  - id: DOR-LEARNING-2
    text: The learning question separates what happened from why it happened.
  - id: DOR-LEARNING-3
    text: Candidate updates to goals, gates, docs, or code are listed.
Falsifies-If:
  kill-condition: Learning starts from anecdotes with no operational evidence or update candidates.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dor-08-apprentissage.md
  on-fail: Return to run and gather the missing evidence.
---

# Learning DoR

Learning is ready when there is actual run evidence to interpret and feed back into the system.
