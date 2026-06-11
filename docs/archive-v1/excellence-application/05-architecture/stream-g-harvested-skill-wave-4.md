---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-53-stream-g-harvested-skill-wave-4
---

# Stream G - Harvested Skill Wave 4

## Result

Cycle 53 added a repo-local harvested `config-linting` HIMA skill fixture.
Cycle 85 added the local deterministic SKILL.md linter.

The artifacts live at:

`fixtures/hima-skills/harvested/project/.hima/skills/config-linting/SKILL.md`
`packages/core/src/install/skill-lint.ts`
`docs/goals/harv02-skill-linting-local.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-02 agnix-style linting |
| Source family | agnix silent-failure linting pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/config-linting/SKILL.md` |
| Cycle 85 local lint proof | `packages/core/src/install/skill-lint.ts` exports a 44-rule deterministic SKILL.md lint catalog and `lintSkillMarkdown` report API |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Still open | CI enforcement, full agnix 423-rule parity decision, real user-home/runtime configuration scans, and full HARV-02 completion |

## Scope Boundary

This began as one harvested skill artifact only. Cycle 85 adds local lint code and tests, but it
does not complete HARV-02, does not wire CI enforcement, does not claim full agnix parity, does not
write to `~/.hima`, and does not scan real runtime configuration.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 411 tests through the package runner. |
| `corepack pnpm --filter @harness/core test -- skill-lint.test.ts` | PASS: 444 tests through the package runner after Cycle 85. |
| `corepack pnpm exec biome check ...config-linting touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 53 does not:

- complete HARV-02 end to end;
- wire CI enforcement;
- claim full agnix 423-rule parity;
- scan real runtime or user-home configuration;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-4.md
  on-fail: Reopen cycle-53 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
