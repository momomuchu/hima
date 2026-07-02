---
cycle-id: long-term
claim-bearing: true
status: ACTIVE
opened: 2026-07-02
closed:
supersedes: the prior COMMERCIAL long-term goal (ARR / founding cohort / EU-AI-Act), archived to private/LONG-TERM-GOAL-commercial-v1.md per founder direction 2026-07-02
derived-from: docs/specs/SPEC-VISION.md §1 + §6
---

# Long-Term Goal — hima (re-centered, non-commercial)

## 1. End state

hima is a **governance layer that sits above any AI coding agent** and drives development as
**governed cycles**, so that a launched task completes **end-to-end — validated *and* verified,
deterministically, with a real Definition of Done — without the operator hand-driving verification.**
Discipline and loop-engineering, not revenue, are the point (SPEC-VISION V-005/V-007).

This is a **discipline runtime, private-first.** There is no commercial acceptance criterion
(no ARR, no cohort, no compliance-sales motion) — that thesis is parked in `private/` (SPEC-VISION §9 OD-1).

## 2. Acceptance criteria

Reached when ALL hold:

1. **End-to-end deterministic DoD** `[CRITICAL][BLOCKS:critical]` — a real task runs through a
   governed cycle and reaches DoD with **every stage `StageVerdict` sealed `done*` + full trace**,
   and **zero operator-initiated verify sub-agents**. (⇽ V-006, SPEC-PRIMITIVE P-007/P-008)
2. **Pluggable cycle** `[CRITICAL][BLOCKS:high]` — a second `CycleDef` instance (not `DEV_CYCLE`)
   runs on the same kernel with no kernel change. (⇽ V-010, P-002)
3. **Forcing portable across runtimes** `[HIGH][BLOCKS:high]` — the same discipline is enforced
   (with graceful degradation) on ≥3 runtimes among Claude / Codex / Hermes / OpenCode. (⇽ V-013, P-005)
4. **Full traceability** `[HIGH][BLOCKS:low]` — every run is a Ward; what/how/why is reconstructable
   from `.hima/state/trace/<session>.jsonl` alone. (⇽ V-019/V-021, P-009)
5. **Pluggable skill registry with an agnostic base** `[MEDIUM][BLOCKS:low]` — the four-tier
   `base < corpus < user < project` resolution (matching `SkillRef.source`) works, with `base`
   shipping agnostic primitives (not a hardcoded methodology). (⇽ OD-2 / ADR-0006)
6. **Identity boundary held** `[CRITICAL][BLOCKS:none]` — hima remains the layer above the agent and
   never becomes a coding agent. (⇽ V-016)

## 3. Out-of-scope (explicit)

- Commercial motion (revenue, licensing, cohort, EU-AI-Act compliance-sales) — parked in `private/`.
- Books `06-ai-ml`, `08-security` — deferred to v2 (SPEC-VISION §4.3).
- hima acting as a coding agent — refused (V-016).

## 4. Status

The v3 architecture is built and CERTIFIED (54/54 gaps, 1591 tests). Criteria 1–4 and 6 are
**substantially realized in code** and now need a live end-to-end demonstration to be *evidenced*
(not just unit-tested). Criterion 5 depends on ADR-0006 (base-tier scope) + the pluggable registry.

Falsifies-If:
  kill-condition: >
    2027-08-01 passes with hima unable to demonstrate a single real task reaching an end-to-end
    sealed DoD with zero manual verify-spawn (criterion 1 unmet), OR the cycle proves non-pluggable
    in practice (criterion 2 unmet), OR the identity boundary breaks and hima becomes a coding agent
    (criterion 6 unmet).
  checkpoint-date: 2027-08-01
  evidence-anchor: docs/specs/SPEC-VISION.md
  on-fail: pause the short-term cadence; revise §1/§2 within 14 days against what the kernel actually
    proved; resume with the next short-term goal aligned to the revised end state.

## 5. Cross-references

- Vision: `docs/specs/SPEC-VISION.md`
- Primitive: `docs/specs/SPEC-PRIMITIVE.md`
- Base-tier decision: `docs/decisions/0006-base-tier-agnostic-primitives.md`
- Cadence protocol: `docs/goals/README.md`
