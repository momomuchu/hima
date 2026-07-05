---
name: norm-stewardship
description: Ongoing post-ship guardianship — dependency hygiene, regression watch, dead-code sweep, health scorecard against real code.
stage: maintenance
source: base
mode: advisory
---

## Purpose

Keep a shipped system healthy after the cycle closes. norm-stewardship is the maintenance-stage
skill: it scans the *actual* codebase (not aspirational docs) for drift, decay, and risk that
accumulates between cycles — dependency staleness, dead code, regression exposure, and rising
complexity trends.

## When to use

- Scheduled/periodic sweep after a feature ships, or monthly/quarterly per the project's
  discipline cadence — not a per-commit gate.
- Advisory by default: it reports findings, it does not block a commit or a stage transition.

## Steps

- Scan for dead code, unused exports, and duplicate logic (e.g. `knip`-style sweep).
- Check dependency staleness and known vulnerabilities (`npm audit`, `npm outdated`).
- Re-check codebase health metrics against target thresholds (complexity, lint warnings, type
  coverage, build time) and flag rising trends as refactor signals.
- Verify prior verdicts still hold — no silent regression on previously DONE_VERIFIED work.
- Produce a scorecard grounded in real code state, not the last spec's claims.

## Done when

A scorecard is produced comparing real code state to health targets, findings are named
explicitly (not silently absorbed), and any regression against a prior verdict is flagged for
a follow-up norm-triage or norm-forge pass.
