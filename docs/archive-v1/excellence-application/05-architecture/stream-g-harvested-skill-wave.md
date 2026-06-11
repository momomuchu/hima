---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-47-stream-g-harvested-skill-wave
---

# Stream G - Harvested Skill Wave

## Result

Cycle 47 added a repo-local harvested `ai-slop-cleaner` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/ai-slop-cleaner/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-01 ai-slop-cleaner |
| Source family | OMC anti-slop cleanup workflow, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/ai-slop-cleaner/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Cycle 93 follow-up | `docs/goals/local-blocker-reconciliation.md` confirmed HARV-01 was the next local-safe implementation lane after Cycle 92. |
| Cycle 94 follow-up | `docs/goals/harv01-ai-slop-cleaner-local.md` records local cleanup-plan/regression-evidence gate proof. |
| Still open | Runtime hook firing in a real adapter, invocation in an actual HIMA dogfood session, real user-home install, and full HARV-01 completion |

## Scope Boundary

This is one harvested skill artifact only. It does not complete the whole Stream G harvest list, does
not write to `~/.hima`, and does not run an actual cleanup workflow. Cycle 94 later added local
cleanup-plan/regression-evidence gate proof for `post_tool` and traced `subagent_stop`, but full
HARV-01 still requires live runtime invocation and real install evidence.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 405 tests through the package runner. |
| `corepack pnpm exec biome check ...harvested skill touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, older non-execution notes, and non-goal text remained. |

## Non-Goals

Cycle 47 does not:

- complete HARV-01 end to end;
- complete all harvested skills;
- write to a real user home;
- wire SubagentStop enforcement;
- run an anti-slop cleanup workflow;
- run external model sessions.

## Cycle 94 Follow-Up

`docs/goals/harv01-ai-slop-cleaner-local.md` records the later local gate proof. It covers core
gate evaluation only and does not change the runtime/user-home blockers above.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave.md
  on-fail: Reopen cycle-47 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
