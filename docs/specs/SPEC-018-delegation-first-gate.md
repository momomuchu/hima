---
spec-id: SPEC-018
title: Delegation-First gate — forced role-based parallel execution at work-bearing stages
claim-bearing: true
status: ACCEPTED
date: 2026-07-05
implemented: 2026-07-05
traces-to: V-002, V-012a (SPEC-VISION); ADR-0008
standard-basis: ISO 9001:2015 §7.5 (control of documented process), make-no-mistakes §2 (author ≠ grader), SWEBOK v4 KA "Software Engineering Operations"
---

# SPEC-018 — Delegation-First gate

> **Status note (2026-07-05):** Implemented + independently verified (adversarial panel,
> author≠grader). This document describes the **shipped** behavior; §6 lists the honest residuals
> (over-specified criteria that shipped reduced/deferred). It is a **forcing-function, not an
> authenticated control** — see §0.

## §0 Intent (plain language, before jargon)

An ISO-grade shop never lets one person write, review, and sign off their own work. Norm makes that
mechanical: when a governed task is doing **real implementation work at H+ criticality**, the coding
agent must have **delegated** (spawned a sub-agent / team lane, or explicitly sealed one) before it
writes implementation code solo in the main thread. If it hasn't, Norm **blocks** — the same way the
planner-write-guard blocks a premature write — and tells it to fan out.

This is a **forcing-function, not an authenticated control**: like the planner-guard (which `hima
advance` walks past), a determined agent can waive it (`HIMA_SOLO_OK`) or self-seal (`hima delegate`).
Its value is interrupting the solo-write reflex and recording an explicit, traced delegation act — not
cryptographically proving a second distinct actor ran.

## §1 Feature POC (per feature-poc rule)

1. **Input** — a PreToolUse Write/Edit event on an *implementation* file, at a work-bearing stage
   (design / impl / test / verify) of a task whose criticality is **H or higher**, with no delegation
   active for the session or the ward+stage.
2. **Output** — ALLOW (delegation active, or task < H, or non-impl target) or BLOCK with a directive
   naming the required roles + the action that satisfies it.
3. **Logic** — `IF stage ∈ work-bearing ∧ crit ≥ H ∧ impl-file ∧ ¬delegationActive THEN block ELSE allow`.
4. **Timing** — PreToolUse Write/Edit. Not prompt-time.
5. **Block vs warn** — `[CRITICAL][BLOCKS:critical]` it **BLOCKS** (hook exit 2) at H+. Below H it is
   **inert** (allow) — see §6 on why M is inert rather than warn. Blocking is scoped to *implementation*
   writes only; never reads, plans, `.md`, `<root>/.hima/**`, or delegated writes.
6. **Example** — main thread on a `full`-sigil (H) task calls `Write src/service.ts` with no delegation
   → blocked. The agent spawns a delegated sub-agent (hima observes `SubagentStart` and stamps the
   stage) → the next `Write src/service.ts` is allowed. Or it runs `hima delegate` inside the lane.
7. **Proof** — e2e (`e2e-delegation-first.test.ts`): live H task solo-write blocked (exit 2); sub-agent
   start auto-unblocks; `hima delegate` unblocks; `.md` and decoy `src/.hima/evil.ts` handled correctly.

## §2 Requirements (criticality-tagged) — as shipped

### CRITICAL
- **D-001** `[CRITICAL][BLOCKS:critical]` At a work-bearing stage (**design/impl/test/verify**) on an
  H+ task, an implementation Write/Edit **SHALL** be blocked unless delegation is active. ✅
- **D-002** `[CRITICAL][BLOCKS:high]` The block reason **SHALL** name the required roles (≥1
  implementer + ≥1 **independent** verifier) and the action that satisfies it. ✅
- **D-003** `[CRITICAL][BLOCKS:critical]` The gate **SHALL NOT** block reads, planning, `.md`, writes
  under `<root>/.hima/**` (anchored to root — a decoy `src/.hima/x.ts` is still an impl write), or
  writes when delegation is active. ✅

### HIGH
- **D-004** `[HIGH][BLOCKS:high]` "Delegation active" **SHALL** be detectable from existing runtime
  signals with **no new operator bookkeeping**, via **two** mechanisms: (a) an explicit `hima delegate`
  seal (per-session lane marker), and (b) **auto**: when hima observes a real `SubagentStart`, it stamps
  a **stage-delegation** marker for the ward+stage — spawning a sub-agent *is* the signal; once the agent
  has delegated at a stage, implementation writes flow (parent integrating lane results included). ✅
- **D-005** `[HIGH][BLOCKS:low]` Runtime-agnostic; no hard dependency on OMC. ✅
- **D-006** `[HIGH][BLOCKS:none]` Composes with BEH-023 (disjoint gate: pre_tool vs stop). ✅
- **D-007** `[HIGH][BLOCKS:low]` **Below H the gate is inert (allow).** *(Shipped reduced: the original
  intent was an advisory warn at M. The pre_tool router surfaces only block verdicts today, so a warn
  would be silently dropped; rather than emit an invisible verdict, M is inert. Advisory-at-M is
  deferred until pre_tool warn-surfacing lands — see §6.)*

### MEDIUM (convergence detail)
- **D-008** `[MEDIUM][BLOCKS:none]` **Deferred.** A configurable minimum-lane-count `N` was specced;
  not shipped as a config field — the gate's decision is binary (delegation active or not), and the
  N=2 baseline (implementer + verifier) lives in the block message only. Higher fan-out is a host choice.
- **D-009** `[MEDIUM][BLOCKS:low]` `HIMA_SOLO_OK=1` waives the block. ✅ *(Router-side trace-logging of
  the waiver as a distinct "norm waiver" line is deferred — same router limitation as D-007.)*

### LOW (convergence tail)
- **D-010** `[LOW][BLOCKS:none]` Lane / stage markers accumulate under `.hima/state/`; automatic
  cleanup (on stage-advance / session end) is **deferred** — low risk (ephemeral state dir).

## §3 Acceptance criteria — as shipped

- [CRITICAL] H solo impl write from main thread, no delegation → block (exit 2, `DELEGATION_FIRST`). ✅ e2e 1
- [CRITICAL] Same write after `hima delegate` → allow. ✅ e2e 2
- [CRITICAL] A sub-agent start at the stage → subsequent write allowed (auto, no manual seal). ✅ e2e 4
- [CRITICAL] `.md` and `<root>/.hima` writes never blocked; decoy `src/.hima/x.ts` IS blocked. ✅ e2e 3/5, unit
- [HIGH] verify+H blocks; maintenance/planner stages allow. ✅ unit `j`/`j2`/property
- [HIGH] M / T / L are inert (exit 0). ✅ unit (advisory-at-M deferred, §6)
- [HIGH] Worker model, full suite (1771/1771) + claim-bearing guard green. ✅
- ~~A7 (config-N)~~ → **deferred** (D-008).

## §4 Tests

`beh-delegation-first.test.ts` (truth table + reason pinning + fs-marker resolution),
`delegation-lane.test.ts` (both marker mechanisms), `e2e-delegation-first.test.ts` (5 live CLI cases).

## §6 Residual risk (honest, post-verification)

- **Forcing-function, not authenticated control.** Self-marking (`hima delegate --session <own>`) or a
  single trivial sub-agent flips the stage marker; the block-message's "≥1 implementer + ≥1 independent
  verifier" is aspirational, not mechanically enforced. Accepted per §0 (this is a discipline nudge).
- **Advisory-at-M deferred (D-007):** the pre_tool router has no warn-surfacing branch; adding one is a
  separate cross-cutting change (also un-darkens BEH_ADR_BEFORE_IMPL). Until then M is inert.
- **Config-N deferred (D-008 / old A7):** binary decision; N=2 baseline is message-only.
- **Marker cleanup deferred (D-010):** unbounded `.hima/state/lane-*` / `delegation-*` files.
- **`hima delegate` without `--session`** falls back to the latest trace session — under parallel lanes
  this can race; pass `--session` explicitly. (Documented; explicit `--session` avoids it.)
- **Model auto-detect of Claude *child sessions*** for the per-session lane marker is not done; the
  ward+stage stage-delegation signal (D-004b) is the auto path that makes this unnecessary in practice.

Falsifies-If:
  kill-condition: >
    The gate blocks non-implementation writes (reads/plans/.md/<root>/.hima) or writes when delegation
    is active (violating D-003), OR it blocks below High (violating D-007's inert contract), OR
    delegation cannot be detected from the SubagentStart signal and again requires per-write manual
    bookkeeping (violating D-004b), OR the block decision depends on OMC being installed (violating D-005).
  checkpoint-date: 2026-08-15
  evidence-anchor: docs/specs/SPEC-VISION.md
  on-fail: revert BEH_DELEGATION_FIRST registration in registry.ts (fail-open to no-gate), set status
    back to DRAFT, and re-derive D-003/D-004 from live trace evidence before re-enabling.
