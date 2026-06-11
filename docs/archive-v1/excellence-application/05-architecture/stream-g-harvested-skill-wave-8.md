---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-62-stream-g-harvested-skill-wave-8
---

# Stream G - Harvested Skill Wave 8

## Result

Cycle 62 added a repo-local harvested `compact-hooks` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/compact-hooks/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-13 PreCompact/PostCompact hooks |
| Source family | pro-workflow pre/post compaction hook pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/compact-hooks/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Cycle 88 local code | `packages/core/src/gates/compaction-continuity.ts` implements deterministic local critical-state preservation checks with tests in `packages/core/test/compaction-continuity.test.ts` |
| Still open | Real compaction adapter invocation, runtime hook firing proof, preservation of critical state in a live compaction event, and user-home installation |

## Scope Boundary

This is one harvested skill artifact only. It does not complete HARV-13 end to end, does not
prove real PreCompact/PostCompact hook firing during a compaction event, does not write to
`~/.hima`, and does not launch external runtime or model sessions.

Cycle 88 adds local deterministic critical-state preservation proof. It still does not complete
HARV-13 end to end: no adapter fired a real PreCompact/PostCompact event, no live context-window
compaction ran, and no real user-home install proof exists.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 420 tests through the package runner. |
| `corepack pnpm exec biome check ...compact-hooks touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, master-goal target text, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 62 does not:

- complete HARV-13 end to end;
- prove real PreCompact/PostCompact hook firing;
- run a live context-window compaction event;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-8.md
  on-fail: Reopen cycle-62 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
