---
name: norm-purge
description: Structural-only cleanup pass — dead code, simplification, AI-slop rejection — with zero behavior change, always its own S-commit.
stage: meta
source: base
mode: advisory
---

## Purpose

Remove dead code, simplify, and reject AI-slop (fake certainty, generic checklists, dead
abstractions, warning suppression) without changing any observable behavior. Tidy First's
structural half — the counterpart to `norm-forge`'s behavioral changes.

## When to use

- On request ("clean this up", "remove dead code", "simplify") at any stage.
- As a scheduled sweep after a feature ships, before `norm-stewardship`'s health scan.
- Never as a per-commit gate — this is invoked, not forced.

## Steps

- Identify the target: a file, module, or diff range — never the whole repo blindly.
- Find dead code, duplicate logic, and slop patterns (fake certainty, unverified claims,
  generic checklists that don't trace to a requirement).
- Simplify without changing inputs/outputs — verify with existing tests, not new behavior.
- Split any accidental behavioral change into its own commit; never mix S and B.
- Commit as `S` (structural) per Tidy First — one intent per commit.

## Done when

- Tests pass unchanged (same green/red status as before the pass).
- Commit is tagged `S`, contains no behavioral diff, and is atomic.
- No new dead code or slop was introduced by the cleanup itself.
