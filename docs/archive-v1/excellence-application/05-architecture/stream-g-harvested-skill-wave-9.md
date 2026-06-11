---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-63-stream-g-harvested-skill-wave-9
---

# Stream G - Harvested Skill Wave 9

## Result

Cycle 63 added a repo-local harvested `anti-bypass-clause` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/anti-bypass-clause/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-18 opencode anti-bypass clause |
| Source family | opencode anti-bypass permission policy pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/anti-bypass-clause/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Later local detection | Cycle 91 added `packages/core/src/security/anti-bypass-clause.ts` and gate/hook tests for prompt, tool, post-tool, and subagent-start bypass-attempt detection. |
| Still open | Runtime permission enforcement, live adapter hook firing, real bypass-attempt transcripts, and user-home installation |

## Scope Boundary

This is one harvested skill artifact only. It does not complete HARV-18 end to end, does not
enforce runtime permission policy, does not write to `~/.hima`, and does not launch external
runtime or model sessions. Cycle 91 later added local core detection, but HARV-18 remains open until
real runtime enforcement and real install evidence exist.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 421 tests through the package runner. |
| `corepack pnpm exec biome check ...anti-bypass-clause touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, master-goal target text, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 63 does not:

- complete HARV-18 end to end;
- enforce runtime permission policy;
- detect real bypass attempts in adapter hooks;
- write to a real user home;
- run external model sessions.

## Cycle 91 Follow-Up

`docs/goals/harv18-anti-bypass-local.md` records the later local detection proof. It covers core
gate evaluation only and does not change the runtime/user-home blockers above.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-9.md
  on-fail: Reopen cycle-63 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
