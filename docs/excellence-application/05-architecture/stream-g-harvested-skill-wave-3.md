---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-51-stream-g-harvested-skill-wave-3
---

# Stream G - Harvested Skill Wave 3

## Result

Cycle 51 added a repo-local harvested `prompt-injection-scan` HIMA skill fixture.
Cycle 83 added the local deterministic scanner and a local `session_start` warning surface.

The artifacts live at:

`fixtures/hima-skills/harvested/project/.hima/skills/prompt-injection-scan/SKILL.md`
`packages/core/src/security/prompt-injection-scan.ts`
`docs/goals/harv09-prompt-injection-scanner-local.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-09 prompt-injection scanner |
| Source family | hermes-agent prompt-builder threat pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/prompt-injection-scan/SKILL.md` |
| Cycle 83 local scanner proof | `packages/core/src/security/prompt-injection-scan.ts` detects deterministic prompt-injection phrases and invisible Unicode controls; `evaluateGate` returns local `session_start` warnings for normalized prompt/metadata hits |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Still open | Live runtime SessionStart blocking, real context-file load prevention, runtime invocation, real `~/.hima` install proof, and full HARV-09 completion |

## Scope Boundary

This began as one harvested skill artifact only. Cycle 83 adds local scanner code and a local
`session_start` warning path, but it does not complete HARV-09, does not prove live runtime blocking,
does not prove real context-file load prevention, does not write to `~/.hima`, and does not scan real
runtime context.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 409 tests through the package runner. |
| `corepack pnpm --filter @harness/core test -- prompt-injection-scan.test.ts gates.test.ts` | PASS: 436 tests through the package runner after Cycle 83. |
| `corepack pnpm exec biome check ...prompt-injection-scan touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 51 does not:

- complete HARV-09 end to end;
- prove live runtime SessionStart blocking;
- prove real context-file load prevention;
- scan real runtime context;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-3.md
  on-fail: Reopen cycle-51 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
