---
cycle-id: cycle-97-behavior-system
claim-bearing: true
status: ACTIVE
opened: 2026-05-20
closed:
supersedes: cycle-96-external-authorization-required (BLOCKED — its premise "no safe local-only lane remains" is obsoleted by this cycle)
priority: ACTIVE-LOCAL (no external authorization required)
governing-principle: docs/goals/README.md §"Saturation-based DONE — the harder bar"
---


# Short-Term Goal — Cycle 97: Behavior System (governed, enforced, portable)

## 1. Why this cycle exists

Cycle 96 parked the construction goal as BLOCKED because cycle 95 found "no remaining safe
local-only implementation lane" — all open ledger rows need external authorization (real install
hosts, runtime/model sessions, public release, payments).

That premise is now false. The behavior system is a complete, safe, local-only build lane:
it adds a first-class **behaviors catalog** to the hima kernel — invariants that govern *how* the
runtime agent reasons and acts, enforced at canonical gates, classified by **action signal** rather
than by scanning output text for keywords.

This cycle directly advances Long-Term Goal §1.3 (*"the most disciplined evidence kernel"*) and
contributes file:line evidence toward excellence-book coverage for `05-architecture` and `07-build`.

The motivating defect, observed live this session **five times**: the existing enforcement
classifies intent by regex over output text, so merely *discussing* a governed concept triggers
enforcement of it (false positive), while genuine shortcut work with no trigger word escapes
(false negative). Behavior #0 fixes exactly this.

## 2. Deliverable — the COMPLETE behavior system

Source spec: `docs/conception/12-behaviors-catalog-spec.md` (PLANNED).
13 seed behaviors, each enforced at a canonical GateType, each carrying a Falsifies-If block.

| Wave | Scope |
|---|---|
| **W0 — Foundation** | ADR adopting 9 GateTypes (resolve the 7-vs-9 contract/spec contradiction); the single structural schema commit; **BEH-000 Action-Signal Classification** (keystone — replaces every keyword/regex output scanner and the dev-entry auto-promotion proxy). |
| **W1 — Epistemic** | BEH-010 Read-Before-Write · BEH-011 Unjustified-Suppression Guard · BEH-012 Chesterton's-Fence Delete Guard · BEH-013 Claim-Source / Calibrated Uncertainty · BEH-014 Anti-Sycophancy Re-Verify. |
| **W2 — Enforcement teeth** | BEH-020 Critic gate before Verify→Capitalize · BEH-021 Dimension-specific retry/escalation · BEH-022 Loop detection that actually emits LOOP_DETECTED · BEH-023 Three-state completion status. |
| **W3 — Delegation & watcher** | BEH-030 Subagent budget+failure contract fields · BEH-031 Watcher role (H/C) · BEH-032 In-band kill switch (CYCLE_ABORT) · cross-runtime degraded modes for Codex/Hermes (which lack subagent gates; Hermes stop is advisory). |

## 3. Scope

**IN SCOPE**
- Spec 12 PLANNED → ACCEPTED.
- The 9-GateType ADR + canonical-contract alignment.
- One structural (S) schema commit: `claimSource`, `completionStatus`, `budget`/`failurePolicy`,
  `role:"watcher"`, `qualityDimension`, `sessionReadSet`, `loopDetector` ring buffer.
- All 13 behaviors implemented behind their gates, with tests, on the Claude adapter (richest gate surface).
- Per-runtime degraded-mode equivalents for Codex and Hermes.

**DEFERRED (next cycles)**
- Hardening the `prompt_pattern` classifiers (BEH-014, BEH-032) — the one fuzzy classifier family;
  isolate and tighten after the action-signal core is proven.
- Returning to cycle-96 external-authorization rows once behaviors land.

## 4. DONE criteria (saturation-based — README §"the harder bar")

Numeric floors (necessary, not sufficient):

1. **ADR recorded** adopting 9 GateTypes; `00-canonical-runtime-contract.md §6` updated to list nine.
2. **Structural schema commit landed** (single S commit, zero behavior change), green typecheck + lint.
3. **13/13 behaviors implemented + verified**: each behavior has (a) an action-signal classifier wired
   to its GateType(s), (b) a passing test proving block/warn at its declared risk floor, (c) a passing
   test of its Falsifies-If counter-example, (d) its Codex/Hermes degraded mode implemented.
4. **BEH-000 regression proof**: a test demonstrates that discussing or reading a governed concept
   no longer produces a gate verdict in the absence of a corresponding tool action (the trap closed).
5. **Zero classifier scans output text by keyword** anywhere in `packages/core/src/`.
6. **Spec 12 ACCEPTED** with no open RED CARD.

Saturation criterion (the actual bar):

```yaml
saturation-criterion:
  enforced-by: a final critic + fresh coverage-auditor wave run AFTER all four waves land
  passes-when: >
    the coverage re-audit reports 13/13 IMPLEMENTED with file:line evidence AND finds zero behaviors
    still keyword-classified AND zero behaviors missing a Falsifies-If block; AND a critic attempting
    to reach a completion-verified state while skipping any behavior's gate FAILS to do so.
  ratchet: if any post-wave finding lands, the cycle re-opens; status reverts ACTIVE; new criteria added.
```

Findings-applied clause (README §4): the behaviors must be wired into the live gate evaluation,
not merely specified. A spec without enforcement does not close this cycle.

```yaml
Falsifies-If:
  kill-condition: >
    Any behavior is marked IMPLEMENTED without a passing block/warn test at its risk floor, OR any
    classifier in packages/core/src still decides a gate verdict by matching keywords in output text,
    OR cycle-97 is marked DONE while spec 12 still carries an open RED CARD.
  checkpoint-date: 2026-06-10
  evidence-anchor: docs/conception/12-behaviors-catalog-spec.md + packages/core/src/gates/ + packages/core/test/ + .planning/behavior-system/
  on-fail: reopen cycle-97 as ACTIVE; restore the per-behavior verification-missing blockers.
```

## 5. Kill conditions (approach-level)

- If BEH-000's action-signal approach proves infeasible on a target runtime (a runtime exposes no
  usable tool-argument or diff signal), fall back to that runtime's **degraded mode** — never back to
  keyword scanning. Document the gap; do not silently weaken the classifier.
- If the structural schema commit cannot stay behavior-neutral (Tidy First S/B), split it further;
  never mix the schema change with behavior wiring in one commit.

## 6. Books queued after this one

1. `prompt_pattern` classifier hardening (BEH-014 + BEH-032 fuzzy-edge reduction).
2. Resume cycle-96 external-authorization packets (now unblocked-by-priority, still need user auth).

## 7. Status log

- **2026-05-20** — Cycle 97 drafted (staging). Supersedes cycle-96 BLOCKED: the behavior system is the
  safe local-only lane cycle-95 declared absent. Coverage evidence: 44 behaviors audited
  (32% implemented / 39% partial / 29% missing) across `.planning/behavior-system/coverage-{A,B,C}-*.md`;
  vocabulary + 8 contradictions reconciled in `.planning/behavior-system/reconciliation-and-contradictions.md`;
  spec drafted at `docs/conception/12-behaviors-catalog-spec.md` (PLANNED). No code written yet.

- **2026-05-21** — 13/13 behaviors built + deployed (W0–W3 + FIX-1/2/3). ADR 0002 landed (9 GateTypes).
  BEH-000 action-signal classifier live; keyword false-positive trap closed. 1215/1224 tests pass (9
  pre-existing Windows flakies). Saturation gate: NOT MET — 4 behaviors (BEH-012/021/023/031) are
  unit-test-only, missing handleHook end-to-end integration tests. BEH-012 also carries a 5th
  local normalizePath copy (FIX-1 missed it). Cycle remains ACTIVE; FIX-4 is the closure blocker.
  Handoff: `.planning/behavior-system/HANDOFF.md`.

---

*This file is `claim-bearing: true` and governed by `docs/conception/05-gates-policy-spec.md` §8.4.
The §4 DONE criteria + both Falsifies-If blocks are gate-relevant assertions. Numeric floors are
necessary but not sufficient; close requires real enforcement evidence (tests + file:line), not a spec alone.*
