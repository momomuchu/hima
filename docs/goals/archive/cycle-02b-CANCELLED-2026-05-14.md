---
cycle-id: cycle-02b-dor-dod-governance-scaffold
claim-bearing: true
status: ACTIVE
opened: 2026-05-14
closed:
supersedes: cycle-02-analysis-discovery (DONE 2026-05-14, archived at docs/goals/archive/cycle-02-DONE-2026-05-14.md)
priority: CRITICAL (RUNTIME-BLOCKER)
---

# Short-Term Goal — Cycle 02b: DoR/DoD governance-scaffold (runtime-blocker fix)

## 1. Why this cycle, why now

S0 (prior-research-baseline) surfaced the most critical finding of the cycle-02 swarm: **the state machine in `packages/core/src/state-machine/machine.ts` uses `dor_satisfied` and `dod_satisfied` as binary blocking guards on every inter-cycle transition, but the 16 files those guards read DO NOT EXIST.** The harness cannot evaluate a single inter-cycle gate at runtime.

This is not a "nice to have." This is the gap between hima being a documented architecture and a functioning runtime. Without these files, the entire quality-governance moat (the differentiator §3 pattern #1 in `docs/excellence-application/02-analysis-discovery/swarm/SYNTHESIS.md`) is unverifiable at runtime — the harness ships a state machine that hard-blocks itself.

This cycle is also the first user of three convergent patterns from the cycle-02 synthesis that have to be applied AT THE SAME TIME as the scaffold, because doing them separately means rewriting the scaffold twice:

- Pattern #16 (SKILL.md locked frontmatter schema) — apply to the DoR/DoD frontmatter
- Pattern #6 (Layered defense Rules → Semantic → Behavioral) — apply to DoR check levels per risk class
- Pattern #4 (hash-chained ledger) — DoR/DoD checks log to it

## 2. Deliverables

All under `C:\Users\momomuchu\dev\Pipeline\hima\docs\01-governance\` (create directory if missing):

| # | File | Content |
|---|------|---------|
| D1 | `_template-dor-dod.md` | The locked-schema template both DoR and DoD files must follow. Frontmatter: `cycle-id`, `gate-type: dor\|dod`, `risk-class-overrides` table, `entry-criteria[]` / `exit-criteria[]`, `evidence-required[]`, `Falsifies-If:` block. Body: filled examples + checklist syntax. |
| D2 | `dor-01-discovery.md` | Discovery cycle's entry criteria. T/L/M/H/C overrides where applicable. |
| D3 | `dor-02-cadrage.md` | Cadrage entry. |
| D4 | `dor-03-conception.md` | Conception entry. |
| D5 | `dor-04-build.md` | Build entry. |
| D6 | `dor-05-validation.md` | Validation entry. |
| D7 | `dor-06-release.md` | Release entry. |
| D8 | `dor-07-run.md` | Run entry. |
| D9 | `dor-08-apprentissage.md` | Apprentissage entry. |
| D10 | `dod-01-discovery.md` | Discovery cycle's exit criteria. |
| D11 | `dod-02-cadrage.md` | Cadrage exit. |
| D12 | `dod-03-conception.md` | Conception exit. |
| D13 | `dod-04-build.md` | Build exit. |
| D14 | `dod-05-validation.md` | Validation exit. |
| D15 | `dod-06-release.md` | Release exit. |
| D16 | `dod-07-run.md` | Run exit. |
| D17 | `dod-08-apprentissage.md` | Apprentissage exit. |
| D18 | wiring in `packages/core/src/state-machine/machine.ts` + a new `src/governance/load-dor-dod.ts` | Parse the 16 markdown files, expose `loadDor(cycle)` / `loadDod(cycle)` that return structured criteria, wire into the transition guards in `transition.ts`. |
| D19 | new tests `packages/core/test/dor-dod-loading.test.ts` + `dor-dod-evaluation.test.ts` | Verify all 16 files parse, frontmatter validates, at least one DoR + one DoD evaluates a real `state.yaml` to allow/block. |

## 3. DONE criteria

This cycle reaches `status: DONE` when ALL of:

1. **D1–D17 written** with non-placeholder content. Each DoR/DoD file has ≥3 entry/exit criteria and a `Falsifies-If:` block.
2. **D18 wired** — `packages/core/src/governance/load-dor-dod.ts` exists, the 16 files load without error, and `transition.ts` calls into the loader.
3. **D19 tests pass** — `pnpm test` in `packages/core/` shows the two new test files green.
4. **State machine no longer blocks itself** — a manual `harness transition` from `discovery` to `cadrage` succeeds (or fails for legitimate criterion reasons, not for "DoR file not found").
5. **3 patterns applied** from cycle-02 synthesis: #6 (Layered defense in DoR risk-class overrides), #16 (frontmatter schema locked on template), #4 (hash-chained ledger logs each DoR/DoD evaluation event).

```yaml
Falsifies-If:
  kill-condition: 2026-05-28 (= today + 14 days) passes without D18 wired and D19 tests green
  checkpoint-date: 2026-05-21 (= today + 7 days, mid-cycle review — at this date, D1 template + D2-D9 DoR files should all exist; D10-D17 may still be partial)
  evidence-anchor: git log on docs/01-governance/ + packages/core/src/governance/ + pnpm test output for the two new test files
  on-fail: shrink scope to D1 + D2 (template + just discovery DoR) as proof-of-concept; defer remaining 15 files to cycle-02b' (a follow-up); document why the full 16 wasn't tractable in this cycle
```

## 4. Why this is cycle-02b and not cycle-03

The cycle-02 synthesis §10 explicitly sequences this as the immediate next cycle BEFORE applying any further excellence books (cycle-03+). Reason: applying a specification or architecture book to a state machine that cannot evaluate any gate is wasted effort. The DoR/DoD scaffold is the unblocker that makes every downstream cycle's improvements actually executable.

## 5. Books queued after this one (the cadence backlog)

(Unchanged from cycle-02's queue — applying further excellence books from otherskill, one cycle each.)

| Order | Cycle | Notes |
|-------|-------|-------|
| 02c | `cycle-02c-tiered-cascade-routing` | Pattern #2 + #13 combined: implement `keyword-registry.ts` + 4-tier cascade. 4-6h. |
| 02d | `cycle-02d-events-jsonl-ledger` | Pattern #4 + #14 combined: append-only `events.jsonl` + SHA-256 hash-chained ledger. 10-14h. |
| 03 | `cycle-03-spec-driven-development` | First excellence book post-runtime-unblock — apply otherskill `03-specification/spec-driven-development-excellence-book` to hima's 10 conception specs. 5-8h. |
| 04 | `cycle-04-design-ux-ui` | Less hima-relevant (no UI today). |
| 05 | `cycle-05-architecture` | Heavy book set — likely 2-3 sub-cycles. |
| 07 | `cycle-07-build` | Heaviest — 3-4 sub-cycles. |
| 09 | `cycle-09-quality-release-run` | Maps directly to hima's cycles 05/06/07. |
| — | SKIPPED | `06-ai-ml` + `08-security` deferred to v2. |

## 6. Status log

- **2026-05-14 17:40** — Cycle 02 archived to `docs/goals/archive/cycle-02-DONE-2026-05-14.md`. Cycle 02b opened with CRITICAL priority (runtime-blocker). 19 deliverables defined.

---

*This file is `claim-bearing: true` and governed by `docs/conception/05-gates-policy-spec.md` §8.4. The §3 DONE criteria + file-level `Falsifies-If` are the gate-relevant assertions.*
n---n## CANCELLED 2026-05-14 (same-day, never started)nReason: user critique 2026-05-14 PM � cycle-02 was prematurely declared DONE. Threshold-based DONE (>=50 NEW repos, >=25 low-star, 4 deliverables, synthesis filled) is the wrong bar. The right bar is **evidence saturation**: stop only when a fresh agent wave adds nothing material. cycle-02b instantiation was premature. Re-opening cycle-02 as cycle-02-deep with saturation criteria + critic + adversarial + deep-code agents. cycle-02b will instantiate ONLY when cycle-02-deep reaches genuine saturation.
