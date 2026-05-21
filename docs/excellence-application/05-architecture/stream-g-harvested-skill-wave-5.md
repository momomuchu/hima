---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-59-stream-g-harvested-skill-wave-5
---

# Stream G - Harvested Skill Wave 5

## Result

Cycle 59 added a repo-local harvested `mode-state-machine` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/mode-state-machine/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-04 OMX mode state-machine |
| Source family | OMX mode state tracking pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/mode-state-machine/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Cycle 86 local code | `packages/core/src/state-machine/mode-exclusion.ts` implements deterministic repo-local mode-exclusion decisions with tests in `packages/core/test/mode-exclusion.test.ts` |
| Still open | Full runtime mode-state persistence, hook wiring, real invocation, adapter behavior, real user-home install proof, and full parity review for the historical ten-transition wording |

## Scope Boundary

This is one harvested skill artifact only. It does not complete HARV-04 end to end, does not
implement runtime state persistence, does not wire hooks, does not write to `~/.hima`, and does not
invoke a real mode transition.

Cycle 86 adds local deterministic mode-exclusion proof. It still does not complete HARV-04 end to
end: the installed OMX source inspected during Cycle 86 has six source-verified auto-complete
transitions, while older master-goal wording says ten. That drift remains a parity boundary, not a
completion claim.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 417 tests through the package runner. |
| `corepack pnpm exec biome check ...mode-state-machine touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 59 does not:

- complete HARV-04 end to end;
- implement mode-state persistence;
- wire runtime hooks;
- invoke real transitions;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-5.md
  on-fail: Reopen cycle-59 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
