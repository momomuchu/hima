---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-61-stream-g-harvested-skill-wave-7
---

# Stream G - Harvested Skill Wave 7

## Result

Cycle 61 added a repo-local harvested `default-deny-tools` HIMA skill fixture.
Cycle 84 added local SubagentStart default-deny tool enforcement.

The artifacts live at:

`fixtures/hima-skills/harvested/project/.hima/skills/default-deny-tools/SKILL.md`
`packages/core/src/gates/evaluate-gate.ts`
`docs/goals/harv11-subagent-tool-deny-local.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-11 opencode default-deny subagent tools |
| Source family | opencode default-deny subagent tool policy pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/default-deny-tools/SKILL.md` |
| Cycle 84 local tool-deny proof | `packages/core/src/gates/evaluate-gate.ts` blocks local SubagentStart events that request `todowrite` or `task` by default and preserves inherited deny lists over allow metadata |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Still open | Live subagent runtime execution, adapter permission projection, real `~/.hima` install proof, and full HARV-11 completion |

## Scope Boundary

This began as one harvested skill artifact only. Cycle 84 adds local SubagentStart deny behavior and
tests, but it does not complete HARV-11 end to end, does not prove adapter permission projection,
does not write to `~/.hima`, and does not launch real subagents.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 419 tests through the package runner. |
| `corepack pnpm --filter @harness/core test -- gates.test.ts handle-hook.test.ts` | PASS: 440 tests through the package runner after Cycle 84. |
| `corepack pnpm exec biome check ...default-deny-tools touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 61 does not:

- complete HARV-11 end to end;
- prove live subagent runtime enforcement;
- prove adapter-level permission projection;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-7.md
  on-fail: Reopen cycle-61 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
