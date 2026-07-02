---
cycle-id: cycle-99-regrounding-and-onboarding
claim-bearing: true
status: ACTIVE
opened: 2026-07-02
closed:
supersedes: cycle-98-v3-build-loop (DONE, archived docs/goals/archive/cycle-98-DONE-2026-07-02.md)
governing-principle: docs/goals/README.md §"Saturation-based DONE — the harder bar"
---

# Short-Term Goal — Cycle 99: re-grounding + onboarding foundation

## 1. Why this cycle exists

After cycle-98 certified the v3 architecture, the founder re-grounded hima's vision (2026-07-02):
**not commercial; primitive = the cycle; hima is a plugin ABOVE the coding agent.** This cycle
(a) captures that re-grounding as formal specs, and (b) builds the onboarding + pluggable base/pack
registry that the re-centered vision now points to.

## 2. Deliverable

### Part A — re-grounding (DONE this session)
- `docs/specs/SPEC-VISION.md` (ISO/IEC/IEEE 29148 vision, claim-bearing) — rigor-reviewed.
- `docs/specs/SPEC-PRIMITIVE.md` (the cycle, traced to code SSOT) — code-alignment verified.
- `docs/goals/LONG-TERM-GOAL.md` rewritten non-commercial (derived from SPEC-VISION §1).
- `docs/decisions/0006-base-tier-agnostic-primitives.md` (OD-2 resolved: base = agnostic, dev-cycle = swappable pack).
- Private docs moved to the `private/` submodule (`momomuchu/hima-private`).

### Part B — onboarding + pluggable base/pack (ACTIVE, next build)
- **SPEC-016** — onboarding question set (`hima init`): what to ask, in what order, why.
- **SPEC-017** — how answers apply (write `HimaConfig`; surface as per-stage suggestions).
- `hima init` interactive question-flow → writes config; TDD/DDD.
- Ship the `base` tier (8 meta skills) + the **default dev-cycle pack** (7 stage skills) per ADR-0006.
- Prove 4-tier resolution `base < corpus < user < project` (matches `SkillRef.source`).

## 3. DONE criteria (saturation-based)

1. Part A specs exist, are claim-bearing with resolving Falsifies-If, and pass the guard.
2. SPEC-016/017 authored + accepted before any `hima init` implementation (spec-gate).
3. `hima init` runs a real question-flow and writes a valid `HimaConfig`; integration test proves it.
4. `base` (8 meta) + default dev-cycle pack (7 stage) are shipped as distinct, swappable sets; a test
   proves the pack can be swapped without a kernel change (SPEC-PRIMITIVE INV-2).
5. 4-tier resolution proven by test; `pnpm test` green, guard green.

Saturation: a final critic + verification wave confirms each criterion with file:line/test evidence.

## 4. Kill conditions

- Never weaken the claim-bearing guard or a live behavior gate to pass; fix the code/data.
- Tidy First: S and B commits never mixed.
- If shipping the base tier forces the dev-cycle pack to be non-swappable, STOP — re-open ADR-0006.

```yaml
Falsifies-If:
  kill-condition: >
    hima init is implemented before SPEC-016/017 are accepted (spec-gate bypass), OR the base tier
    ships with the dev-cycle pack fused in (non-swappable, violating ADR-0006 / SPEC-PRIMITIVE INV-2),
    OR pnpm test / the claim-bearing guard is left red.
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/specs/SPEC-PRIMITIVE.md
  on-fail: reopen cycle-99 ACTIVE; restore the failing part's blocker; do not advance the loop.
```

## 5. Status log

- **2026-07-02** — Cycle 99 opened (supersedes cycle-98 DONE). **Part A ✅ done + adversarially
  verified** (3 independent review lanes: code-alignment clean, 29148 rigor applied, cross-artifact
  consistency reconciled). Private submodule created + pushed. **Part B not started** — SPEC-016/017
  are the next spec-gate.
