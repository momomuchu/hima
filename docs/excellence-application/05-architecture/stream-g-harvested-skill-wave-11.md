---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-65-stream-g-harvested-skill-wave-11
---

# Stream G - Harvested Skill Wave 11

## Result

Cycle 65 added a repo-local harvested `preference-router` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/preference-router/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-16 nexus-agents PreferenceRouter |
| Source family | nexus-agents evaluate-then-decide routing pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/preference-router/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Later local helper | Cycle 92 added `packages/core/src/routing/preference-router.ts` and tests for deterministic route-candidate evaluation. |
| Still open | Live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, and user-home installation |

## Scope Boundary

This is one harvested skill artifact only. It does not complete HARV-16 end to end, does not write
to `~/.hima`, and does not launch external runtime or model sessions. Cycle 92 later added a local
deterministic helper, but HARV-16 remains open until live route evaluation and real install evidence
exist.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 423 tests through the package runner. |
| `corepack pnpm exec biome check ...preference-router touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, master-goal target text, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 65 does not:

- complete HARV-16 end to end;
- prove live route evaluation;
- execute live model/runtime routing;
- write to a real user home;
- run external model sessions.

## Cycle 92 Follow-Up

`docs/goals/harv16-preference-router-local.md` records the later local deterministic helper proof.
It covers local route-candidate evaluation only and does not change the runtime/user-home blockers
above.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-11.md
  on-fail: Reopen cycle-65 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
