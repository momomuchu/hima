---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-64-stream-g-harvested-skill-wave-10
---

# Stream G - Harvested Skill Wave 10

## Result

Cycle 64 added a repo-local harvested `prompt-cache-boundary` HIMA skill fixture.

The artifact lives at:

`fixtures/hima-skills/harvested/project/.hima/skills/prompt-cache-boundary/SKILL.md`

## Harvest Target

| Field | Value |
|---|---|
| Stream G item | HARV-17 claw-code prompt-cache boundary |
| Source family | claw-code prompt-cache boundary pattern, adapted as a HIMA-compatible local skill fixture |
| Local artifact | `fixtures/hima-skills/harvested/project/.hima/skills/prompt-cache-boundary/SKILL.md` |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the fixture through locked frontmatter schema |
| Still open | Real prompt-cache integration, cache-hit/freshness proof, invalidation runtime behavior, and user-home installation |

## Cycle 89 Local Code Addendum

Cycle 89 added a local core helper for the same HARV-17 boundary without changing the full-row
status.

| Artifact | Evidence |
|---|---|
| `packages/core/src/runtime/prompt-cache-boundary.ts` | Implements deterministic splitting at `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`, stale snapshot bypass, explicit invalidation-signal bypass, and dynamic-state leak detection. |
| `packages/core/test/prompt-cache-boundary.test.ts` | Covers fresh acceptance, stale rejection, invalidation signals, missing/duplicate boundaries, dynamic-state leakage, and catalog integrity. |

The remaining open evidence is unchanged: real prompt-cache integration, cache-hit/freshness proof,
live invalidation behavior, adapter behavior, and real `~/.hima` installation.

## Scope Boundary

This is one harvested skill artifact only. It does not complete HARV-17 end to end, does not
integrate with a real prompt-cache runtime, does not write to `~/.hima`, and does not launch
external runtime or model sessions.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 422 tests through the package runner. |
| `corepack pnpm exec biome check ...prompt-cache-boundary touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, master-goal target text, explicit non-goals, and prior non-goal text remained. |

## Non-Goals

Cycle 64 does not:

- complete HARV-17 end to end;
- integrate with a real prompt-cache runtime;
- prove cache-hit or freshness behavior;
- write to a real user home;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Harvested skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-harvested-skill-wave-10.md
  on-fail: Reopen cycle-64 as BLOCKED_HARVESTED_SKILL_WAVE_OVERCLAIM and restore local-only harvest scope.
```
