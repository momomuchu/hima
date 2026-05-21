---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-49-stream-g-harvested-skill-wave-2
---

# Stream G - Harvested Skill Wave 2

## Result

Cycle 49 added a repo-local harvested `typed-handoff` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/typed-handoff/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-08 typed human-handoff |
| Source family | 12-factor-agents typed handoff concept plus Goose code pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/typed-handoff/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Cycle 82 local service proof | `packages/core/src/services/request-human-input.ts` implements typed request validation, `.planning/09-logs/handoffs.jsonl` capture, replay parsing, and run-set event emission |
| Still open | live runtime invocation, real `~/.hima` install, human response workflow, and full HARV-08 completion |

## Scope Boundary

This began as one harvested skill artifact only. Cycle 82 adds the local typed handoff service and
JSONL capture path, but still does not complete the whole Stream G harvest list, does not write to
real `~/.hima`, and does not run an actual live runtime handoff workflow.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 407 tests through the package runner. |
| `corepack pnpm --filter @harness/core test -- request-human-input.test.ts` | PASS: 431 tests through the package runner after Cycle 82. |
| `corepack pnpm exec biome check ...typed-handoff touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, the original HARV-08 target row, and prior non-goal text remained. |

## Non-Goals

Cycle 49 does not:

- complete HARV-08 end to end;
- invoke `request_human_input` from a live runtime skill;
- complete all harvested skills;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-2.md
  on-fail: Reopen cycle-49 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
