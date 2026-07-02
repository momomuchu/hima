---
claim-bearing: true
---

# 0005 — R-035: StageParallelizationGate ships advisory-strong, not hard-block

- Status: accepted
- Date: 2026-07-02
- Criticality: [HIGH][BLOCKS:high]
- Source: `.planning/architecture/V3-CERTIFICATION.md` §R-035 (pass-4 gap registry); original
  whatToBuild in `.planning/architecture/V3-COMPLETENESS-AUDIT.md` §R-035; implementation at
  `packages/hima-cli/src/router.ts:482-494` (spawn manifest write) and
  `packages/hima-cli/src/router.ts:755-786` (gate check).

## Decision

- [CRITICAL][BLOCKS:critical] The `StageParallelizationGate` (R-035) ships **advisory-strong**:
  on `PreToolUse`, when a required role's spawn-manifest entry is absent for the ward's current
  stage, the gate emits a `[HIMA advisory-strong R-035]` context block listing the required
  role-team and **exits 0** (allow). It does **not** hard-block (exit 2) the write, contrary to
  the original audit's literal `whatToBuild` for R-035.
- [HIGH][BLOCKS:none] This decision ratifies the *existing shipped behavior* as the accepted
  design — it is a documentation-of-record action, not a code change. No behavior in
  `router.ts` changes as a result of this ADR.
- [MEDIUM][BLOCKS:low] The escape hatch discussed as remediation option 1 in
  V3-CERTIFICATION.md (`--solo` flag / exit-2 hard-block) is explicitly **deferred**, pending
  founder direction, and is not part of this decision.

## Rationale

- [CRITICAL][BLOCKS:critical] **The spawn manifest is auto-written on ward creation**
  (`packages/hima-cli/src/router.ts:482`, "R-035: live role-spawn manifest for new wards"), fired
  from `handleUserPromptSubmit`. In the common path the manifest already exists by the time the
  orchestrator makes its first `Write`/`Edit` call, so the gate's absent-manifest branch is
  reached only in edge cases: a ward resumed after a stage advance where the new stage's manifest
  was not yet (re)written, or an orchestrator legitimately doing solo, non-parallelizable work
  (e.g. a one-file trivial fix at T/L criticality, where forcing a role-team spawn would be
  ceremony without value per `[ALWAYS][NO-OVERHEAD]`).
- [HIGH][BLOCKS:high] **A hard-block on those edge cases risks bricking the pipeline.** If the
  gate exits 2 whenever the manifest lookup misses — including transient states like a
  stage-advance race or a manifest read failure — every subsequent `Write`/`Edit` attempt by the
  orchestrator is refused with no built-in recovery path, since nothing in the current design
  re-derives or repairs the manifest from inside the blocked call. That converts a coverage gap
  in an advisory signal into a full pipeline stall for legitimate work.
- [HIGH][BLOCKS:none] **The emitted role-team assignment context is itself the forcing
  signal.** The `[HIMA advisory-strong R-035]` block names the exact roles the calling agent is
  expected to spawn (per `spawnPlan(stage, ROLE_CATALOG)`), landing in the orchestrator's own
  context on the very tool call it is about to make. Empirically (per
  `packages/hima-cli/test/e2e-remediation.test.ts`, all 15 assertions green including the R-035
  case) this reaches the agent at the moment of decision, which is the mechanism the kernel rule
  `[ALWAYS][WORKER-MODEL]` / `[DEFAULT L+][DELEGATE]` already relies on for compliance elsewhere
  in this runtime — advisory-strong signals injected at tool-call time, not hard denial.

## Alternatives considered

1. **Hard-block (exit 2) with a `--solo` / escape-hatch flag.** Matches the letter of the
   original audit spec. Rejected for now: it requires a new, separately-designed escape-hatch
   surface (who sets `--solo`, on what basis, is it a manifest field or a CLI flag threaded
   through every runtime adapter) that has not been scoped or reviewed. Deferred pending founder
   direction rather than rejected outright — see `Falsifies-If` below for the reopening
   condition.
2. **Silent allow with no emitted context (pure no-op).** Rejected: this would remove the only
   forcing signal the gate currently provides and regress R-035 from "partial" to "not
   implemented" in spirit — the advisory context block is the load-bearing part of the current
   design, not incidental.

## Consequences

- R-035 in `.planning/architecture/V3-CERTIFICATION.md` moves from `partial` to `closed` via
  remediation path 2 (decision record ratifying advisory-only), not remediation path 1
  (implementing the hard-block).
- Future work that wants a hard-block variant must supersede this ADR with a new decision record
  that also specifies the escape-hatch mechanism — it cannot be added as a silent behavior change
  to `router.ts` alone, per `decision-record-discipline.md`.
- No code in `packages/hima-cli/src/router.ts` changes as part of this ADR.

Falsifies-If:
  kill-condition: The StageParallelizationGate at `packages/hima-cli/src/router.ts` starts hard-blocking (exit 2) on a missing spawn manifest, or the advisory-strong context block stops being emitted, without a superseding decision record.
  checkpoint-date: 2026-09-02
  evidence-anchor: packages/hima-cli/src/router.ts:755-786
  on-fail: Create a superseding ADR documenting the new gate behavior (hard-block + escape-hatch design, or removal) and update `.planning/architecture/V3-CERTIFICATION.md` R-035 status accordingly.
