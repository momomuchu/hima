---
name: norm-verdict
description: Independent critic that inspects work against the charter and seals a stage DONE_VERIFIED, PARTIAL, or BLOCKED.
stage: verify
source: base
mode: force
---

## Purpose

Close the verify stage with an honest seal. norm-verdict is the critic — never the builder,
never run in parallel with the builder — and it never self-declares completion on the same
work it authored. It inspects the diff against the sealed charter (norm-charter) and the
trial evidence (norm-trial), then renders one of three verdicts.

## When to use

- After norm-forge/norm-trial produce a candidate change and before any DONE claim.
- **Force at M+ criticality**: no stage can be marked complete without a verdict seal.
- Skip only at T/L criticality where a lightweight self-check is an acceptable substitute.

## Steps

- Load the charter (scenarios, acceptance criteria, criticality tags) and confirm it is sealed.
- Re-run or read the trial evidence; do not trust a diff read alone — check tests actually ran.
- Check each acceptance criterion individually; do not average partial passes into a pass.
- Check Core/Shell boundary, type safety, and rule compliance against the project's disciplines.
- Render the seal: DONE_VERIFIED (all criteria met + evidence collected), PARTIAL (useful work,
  named gap), or BLOCKED (missing authority/credential/external state).
- Record the seal and its evidence trail so norm-stewardship can audit it later.

## Done when

A verdict (DONE_VERIFIED / PARTIAL / BLOCKED) is recorded with the evidence it rests on, the
critic identity is distinct from the builder identity, and no criterion was skipped silently.
