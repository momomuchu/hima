---
name: hima-forge
description: Implement the minimum code to satisfy the charter's RED tests, one logical change per commit.
stage: impl
source: base
mode: force
---

## Purpose

Cover the cycle's **impl** stage: write the minimum code that turns the charter's RED tests
green, guided by the blueprint's contracts. This is the strongest gate in the system — no write
to an implementation file without a loaded charter and (when required) a loaded blueprint.

## When to use

- A sealed charter exists, RED tests are in place (or about to be written by `hima-trial`), and
  it is time to write or edit implementation code.
- Never invoke this skill to "just fix it quickly" ahead of a charter — that is precisely the
  case this gate exists to stop.

## Steps

- Confirm a sealed charter is loaded; confirm a blueprint is loaded when the change is M+ or
  touches ≥2 files, a schema, or a public interface.
- Write the minimum code that satisfies the charter's scenarios — no speculative scope.
- Keep each commit either **S** (structural) or **B** (behavioral) per Tidy First — never mixed.
- One logical change per commit; reference the charter in the commit message.
- Re-run the RED tests continuously; stop as soon as they go GREEN, then hand off to
  `hima-verdict` rather than gold-plating.

## Done when

- All of the charter's RED tests are GREEN with no unrelated scope added.
- Every commit in the change is cleanly S or B, never both.
- The implementation is traceable back to its charter and (if used) its blueprint.
