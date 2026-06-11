---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-60-stream-g-harvested-skill-wave-6
---

# Stream G - Harvested Skill Wave 6

## Result

Cycle 60 added a repo-local harvested `evidence-gate` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/evidence-gate/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-07 auto-harness 3-step evidence gate |
| Source family | auto-harness eval-suite, held-out split, and suite-promotion pattern adapted as a local HIMA skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/evidence-gate/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Cycle 87 local code | `packages/core/src/evidence/evaluate-evidence.ts` implements deterministic local layered evidence-gate evaluation with tests in `packages/core/test/evidence.test.ts` |
| Still open | Held-out evaluator execution, suite promotion automation, real test-session demonstration, adapter behavior, and real user-home install proof |

## Scope Boundary

This is one harvested skill artifact only. It does not complete HARV-07 end to end, does not
implement the evidence evaluator, does not run held-out validation, does not promote suites, does
not write to `~/.hima`, and does not demonstrate a real HIMA test session.

Cycle 87 adds local deterministic layered evidence-gate proof in `evaluate-evidence.ts`. It still
does not complete HARV-07 end to end: no held-out evaluator ran, no suite was promoted in a real
runtime, no adapter session was invoked, and no real user-home install proof exists.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 418 tests through the package runner. |
| `corepack pnpm exec biome check ...evidence-gate touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 60 does not:

- complete HARV-07 end to end;
- implement `evaluate-evidence.ts`;
- run held-out validation;
- automate suite promotion;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-6.md
  on-fail: Reopen cycle-60 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
