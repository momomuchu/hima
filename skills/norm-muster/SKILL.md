---
name: norm-muster
description: Bridge blueprint to forge — break an approved charter+blueprint into atomic, sequenced or explicitly-parallel steps, cross-critiqued once before trust.
stage: meta
source: base
mode: force
---

## Purpose

Turn an approved charter (norm-charter) and blueprint (norm-blueprint) into an executable plan:
atomic steps with exact file paths, marked sequential where dependent and explicitly parallel
where independent. A single adversarial cross-critique pass runs on the plan before it is
trusted — norm-muster does not hand a plan straight to norm-forge unchallenged.

## When to use

- **Force at H+** (multi-file or multi-lane work) — no forge entry without a musterred plan.
- **Advisory at M and below** — a lighter plan or direct-to-forge is acceptable.
- Any time work spans more than one file, more than one lane, or has a non-obvious dependency
  order.

## Steps

- Decompose the charter+blueprint into atomic steps, each traceable to a goal/constraint/risk.
- Mark each step sequential (blocks the next) or explicitly parallel (independent, safe to
  fan out); do not parallelize steps with dependencies.
- Assign exact file paths per step so ownership and write boundaries are unambiguous.
- Run one adversarial cross-critique pass: a second perspective checks the plan for missing
  steps, wrong ordering, or unsafe parallelization before it is trusted.
- Remove any step that doesn't trace to the charter — no generic checklist filler.

## Done when

The plan has atomic steps with file paths, correct sequential/parallel marking, has survived
one cross-critique pass, and norm-forge can execute it without re-deriving scope.
