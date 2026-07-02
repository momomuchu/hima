---
cycle-id: cycle-100-close-residuals
claim-bearing: true
status: ACTIVE
opened: 2026-07-02
closed:
supersedes: cycle-99-regrounding-and-onboarding (DONE, archived docs/goals/archive/cycle-99-DONE-2026-07-02.md)
governing-principle: docs/goals/README.md §"Saturation-based DONE — the harder bar"
---

# Short-Term Goal — Cycle 100: close the cycle-99 residuals

## 1. Why this cycle exists

Cycle-99 shipped onboarding + the swappable base/pack but left three honest residuals. This cycle
closes them. All three are covered by existing specs/decisions (SPEC-016/017, ADR-0006,
HIMA-BASE-SKILLS.md) — no new spec-gate required.

## 2. Deliverable

- **R1 — wire `GENERIC_DEV_CYCLE` selectable in `hima init`.** Q-002 currently only writes
  `useDevCyclePack`; extend the flow so a user can choose the corpus-free generic pack as their
  cycle (writes `HimaConfig.cycle = GENERIC_DEV_CYCLE` or an equivalent selector). Test proves a
  fresh `hima init --yes --generic` (or the chosen flag/answer) yields a corpus-free resolved cycle.
- **R2 — author the 15 `hima-*` `SKILL.md` bodies.** Location convention (decided here):
  `skills/<skill-id>/SKILL.md` at repo root, each with frontmatter (name, description, stage,
  source: base, force|advisory) + a lean body (purpose, when-to-use, steps) drawn from
  `.planning/research/HIMA-BASE-SKILLS.md`. A test asserts every id in `dev-cycle-pack.ts`
  (8 meta + 7 pack) has a matching `skills/<id>/SKILL.md`.
- **R3 — live end-to-end demo of a sealed DoD.** A spawned-CLI demo (not a mock): in a temp dir,
  `hima init --yes` then drive a cycle via `hima hook stage-advance` writing `done*` verdicts, and
  assert the trace file shows every stage sealed with evidence and the run reaches DoD with zero
  manual verify-spawn (LONG-TERM criterion 1, scripted form).

## 3. DONE criteria (saturation-based)

1. R1 wired + test proves a generic (corpus-free) cycle is selectable and resolves with zero corpus refs.
2. R2: 15 `skills/<id>/SKILL.md` exist; the id-coverage test is green.
3. R3: a spawned-CLI demo test drives init → staged verdicts → sealed DoD trace, asserting zero manual verify-spawn.
4. `pnpm test` green; claim-bearing guard green; no gate/guard weakened.

Saturation: a final adversarial verify lane confirms each criterion with file:line/test evidence.

## 4. Kill conditions

- Never weaken the claim-bearing guard or a live behavior gate to pass; fix the code/data.
- Tidy First: S and B commits never mixed.
- Non-destructive: do not change the founder's `DEV_CYCLE` corpus default; generic pack stays opt-in.

```yaml
Falsifies-If:
  kill-condition: >
    A residual is marked closed without a passing test at its criterion, OR the founder's DEV_CYCLE
    corpus default is changed, OR pnpm test / the claim-bearing guard is left red.
  checkpoint-date: 2026-07-13
  evidence-anchor: docs/specs/SPEC-PRIMITIVE.md
  on-fail: reopen cycle-100 ACTIVE; restore the failing residual's blocker; do not advance.
```

## 5. Status log

- **2026-07-02** — Cycle 100 opened (supersedes cycle-99 DONE). Executing R1+R2+R3 full-auto via workflow.
