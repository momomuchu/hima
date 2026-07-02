---
name: hima-triage
description: For bug reports and runtime failures, enforce root-cause-before-fix — reproduce, isolate cause, fix minimally, add a regression test.
stage: meta
source: base
mode: force
---

## Purpose

Stop the jump-straight-to-patch reflex on bug reports. Forces reproduction and root-cause
isolation before any fix is written, so the fix addresses the actual defect, not its symptom.

## When to use

- Any triggering input that is a bug report, crash, or regression — forced regardless of
  criticality (T through C).
- Runtime failures surfaced by tests, logs, or user report.
- Not for net-new feature work — that routes through `hima-charter`/`hima-forge` instead.

## Steps

- Reproduce the failure first — a fix without a reproduction is a guess.
- Isolate the root cause: trace back from the failure to the actual defect, not the nearest
  plausible symptom.
- Write the minimal fix that addresses the isolated cause — resist scope creep into unrelated
  cleanup (that's `hima-purge`'s job, in its own commit).
- Add a regression test that fails before the fix and passes after — this is the proof, not
  an assertion.
- Re-run the full relevant test suite to confirm no new breakage.

## Done when

- The failure is reproduced, root cause is named (not assumed), and a regression test exists
  that would have caught it.
- The fix is committed as `B` (behavioral), separate from any structural cleanup.
