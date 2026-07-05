---
spec-id: SPEC-018
title: Delegation-First gate — forced role-based parallel execution at work-bearing stages
claim-bearing: true
status: DRAFT
date: 2026-07-05
traces-to: V-002, V-012a (SPEC-VISION); ADR-0008
standard-basis: ISO 9001:2015 §7.5 (control of documented process), make-no-mistakes §2 (author ≠ grader), SWEBOK v4 KA "Software Engineering Operations"
---

# SPEC-018 — Delegation-First gate

## §0 Intent (plain language, before jargon)

An ISO-grade shop never lets one person write, review, and sign off their own work. Norm makes that
mechanical: when a governed task is doing **real implementation work at H+ criticality**, the coding
agent must **delegate to parallel role-based lanes** (an implementer lane + at least one *independent*
reviewer/verifier lane) instead of doing it all solo in the main thread. If it tries to go solo,
Norm **blocks** — the same way the planner-write-guard blocks a premature write — and tells it to
fan out.

This is Delegation-First: Team-First + Sub-Agent-First made a forced default, not a suggestion.

## §1 Feature POC (per feature-poc rule)

1. **Input** — a PreToolUse Write/Edit event on an *implementation* file, at a work-bearing stage
   (build / review / qa) of a task whose criticality is **H or higher**, in the **main session
   thread** (no active delegated lane / sub-agent context).
2. **Output** — either ALLOW (a delegated lane is active, or task < H) or BLOCK with a directive
   naming the required lanes + roles.
3. **Logic** — `IF stage ∈ work-bearing ∧ criticality ≥ H ∧ actor = main-thread ∧ ¬delegationActive
   THEN block(reason = "Delegation-First: fan out to <roles>") ELSE allow`.
4. **Timing** — PreToolUse Write/Edit (just before the solo write lands). Not prompt-time.
5. **Block vs warn** — `[CRITICAL][BLOCKS:critical]` it **BLOCKS** (hook exit 2) at H+; at M it
   **warns** (advisory, exit 0); at T/L it is inert. Blocking is scoped to *implementation* writes,
   never to reads, plans, specs, or delegated-lane writes.
6. **Example** — main thread on a `full`-sigil (H) task calls `Write src/service.ts` with no lane
   active → blocked: *"Delegation-First: this build stage SHALL run as ≥1 implementer lane + 1
   independent verifier lane. Run `hima delegate --roles implementer,verifier` (or your host's
   team/sub-agent fan-out), then implement inside a lane."* Same call from within a delegated
   implementer lane → allowed.
7. **Proof** — an e2e test: a live H task solo-writing an impl file is blocked; the same write from a
   sub-agent/lane context passes; an M task warns not blocks; a T/L task is inert.

## §2 Requirements (criticality-tagged, both axes)

### CRITICAL
- **D-001** `[CRITICAL][BLOCKS:critical]` At a work-bearing stage on an H+ task, a main-thread
  implementation write **SHALL** be blocked unless a delegation context is active.
- **D-002** `[CRITICAL][BLOCKS:high]` The block reason **SHALL** name the required roles (≥1
  implementer + ≥1 **independent** verifier) and the one command / host action that satisfies it.
- **D-003** `[CRITICAL][BLOCKS:critical]` The gate **SHALL NOT** block reads, planning, spec writes,
  or writes originating from a delegated lane / sub-agent — only main-thread *implementation* writes.

### HIGH
- **D-004** `[HIGH][BLOCKS:high]` "Delegation active" **SHALL** be detectable from runtime signals
  Norm already sees (sub-agent/lane context in the hook payload, spawn-manifest, or an explicit
  `hima delegate` seal) — no new manual bookkeeping by the operator.
- **D-005** `[HIGH][BLOCKS:low]` The directive **SHALL** be runtime-agnostic: it states roles + intent;
  the host fulfills it (OMC Team/Task on Claude, codex fan-out on Codex). Norm never hard-depends on OMC.
- **D-006** `[HIGH][BLOCKS:none]` The independent-verifier requirement **SHALL** compose with the
  existing BEH-023 Stop gate (author ≠ grader end-to-end), not duplicate it.

### MEDIUM (convergence detail)
- **D-007** `[MEDIUM][BLOCKS:low]` At M criticality the gate warns (advisory) instead of blocking.
- **D-008** `[MEDIUM][BLOCKS:none]` `N` (minimum lane count) is configurable per stage; default = 2
  (implementer + verifier). Higher fan-out is a host/operator choice, not forced by Norm.

### LOW (convergence tail)
- **D-009** `[LOW][BLOCKS:none]` A single escape hatch (`HIMA_SOLO_OK=1` or a config flag) allows an
  operator to opt a session out, logged in the trace as an explicit norm waiver.

## §3 Acceptance criteria (binary, mechanically verifiable)

- [CRITICAL] A live H task solo-writing an impl file from the main thread is blocked (exit 2), trace
  shows `pre_tool Write -> block [delegation-first]`.
- [CRITICAL] The identical write from a delegated lane/sub-agent context is allowed.
- [HIGH] An M task warns (exit 0 + advisory line), a T/L task shows no gate activity.
- [HIGH] The block reason string names both roles + the satisfying command.
- [MEDIUM] `N` default 2 is read from config; overriding it changes the required lane count.

## §4 Test plan (spec-first — these are RED before code)

- Unit: the decision function `evaluateDelegationFirst(stage, criticality, actor, delegationActive)`
  over the truth table (equivalence + boundary at the H threshold and the main-thread/lane boundary).
- e2e: PreToolUse Write on impl file — main-thread H (block), lane H (allow), main-thread M (warn),
  main-thread T (inert), read/plan/spec never blocked.
- Composition: with BEH-023, an H task that delegates + seals a verifier lane reaches DONE; one that
  solo-implements never does.

## §5 Residual risk

- Detecting "delegation active" reliably across runtimes is the hard part (D-004); a false-negative
  over-blocks a legitimately-delegated write. Mitigation: prefer the explicit `hima delegate` seal +
  the spawn-manifest signal; fail toward *warn* if the actor context is ambiguous, not toward block.
- Whether the *model* actually fans out after the block is not deterministic (same limit as the
  planner-write-guard) — Norm forces the *gate*, not the agent's compliance.

Falsifies-If:
  kill-condition: >
    The gate blocks non-implementation writes (reads/plans/specs) or delegated-lane writes
    (violating D-003), OR it blocks at T/L/M instead of only warning below H (violating D-007), OR
    "delegation active" cannot be detected from existing runtime signals and requires new manual
    operator bookkeeping (violating D-004), OR the directive hard-depends on OMC being installed
    (violating D-005).
  checkpoint-date: 2026-08-15
  evidence-anchor: docs/specs/SPEC-VISION.md
  on-fail: hold SPEC-018 at DRAFT; re-derive D-003/D-004 from live trace evidence before any
    behavior-core implementation of the gate begins.
