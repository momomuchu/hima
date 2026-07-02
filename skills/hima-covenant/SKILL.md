---
name: hima-covenant
description: Declare and audit the per-project disciplines (cadence, branching, testing, architecture, methodology) that the pluggable StageSkillMap resolves against.
stage: meta
source: base
mode: force
---

## Purpose

Set the per-project floor every stage's skill map resolves against — cadence, branching,
testing, architecture, and methodology choices declared once and audited thereafter. Forced
once per project (init/update); advisory to read on every subsequent stage.

## When to use

- Project init, or first time a cycle needs to resolve a stage skill and no disciplines file
  exists yet — this is a hard gate at that moment.
- Any time cadence, branching, testing, architecture, or methodology policy changes.
- Read-only consultation at the start of any stage thereafter (advisory, not re-forced).

## Steps

- Check for an existing per-project disciplines declaration; if absent, this is a forced gate —
  do not proceed with stage work until it exists.
- Declare practice axes explicitly: cadence, branching model, testing policy, architecture
  boundary, methodology — sourced from founder statement or existing project convention, not
  invented defaults.
- Validate the declaration against the current schema version; keep frontmatter and code in
  sync (a disciplines file that contradicts the codebase is worse than none).
- On subsequent stages, read the declared disciplines and apply them as the floor — do not
  silently default to a different convention.
- Update the declaration (not append a parallel one) when a discipline changes.

## Done when

- A disciplines file exists, schema-valid, matching what the codebase actually does.
- Every stage's skill resolution can point to this file as the floor it inherited.
