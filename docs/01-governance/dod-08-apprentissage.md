---
kind: dod
cycle: learning
title: Learning Definition of Done
version: 1
criteria:
  - id: DOD-LEARNING-1
    text: Lessons are tied to evidence and separated from assumptions.
  - id: DOD-LEARNING-2
    text: Accepted lessons have been applied to goals, gates, docs, tests, or backlog items.
  - id: DOD-LEARNING-3
    text: The next discovery or cadrage cycle receives updated constraints and open questions.
Falsifies-If:
  kill-condition: Learning closes with a narrative summary but no applied system change or next-cycle handoff.
  checkpoint-date: 2026-06-04
  evidence-anchor: docs/01-governance/dod-08-apprentissage.md
  on-fail: Reopen learning and apply at least one evidence-backed update.
---

# Learning DoD

Learning is done when the system changes because of what was observed. Captured but unapplied lessons remain unfinished work.
