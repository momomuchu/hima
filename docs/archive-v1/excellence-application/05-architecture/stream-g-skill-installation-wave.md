---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-46-stream-g-skill-installation-wave
---

# Stream G - Skill Installation Wave

## Result

Cycle 46 created a repo-local first-wave HIMA skill tree and validated it through the existing skill
schema and resolver.

The fixture tree lives at:

`fixtures/hima-skills/first-wave/project/.hima/skills/`

## Skill Source Inventory

| Skill | Source surface | Installed fixture |
|---|---|---|
| `hima-enter` | `packages/core/src/catalogs/operational-catalog.ts` + `.codex/skills/hima-enter/SKILL.md` as local prompt surface | `fixtures/hima-skills/first-wave/project/.hima/skills/hima-enter/SKILL.md` |
| `classify-risk` | `packages/core/src/catalogs/operational-catalog.ts` + `.codex/skills/classify-risk/SKILL.md` as local prompt surface | `fixtures/hima-skills/first-wave/project/.hima/skills/classify-risk/SKILL.md` |
| `propose-change` | `packages/core/src/catalogs/operational-catalog.ts` + `.codex/skills/propose-change/SKILL.md` as local prompt surface | `fixtures/hima-skills/first-wave/project/.hima/skills/propose-change/SKILL.md` |
| `transition-phase` | `packages/core/src/catalogs/operational-catalog.ts` + `.codex/skills/transition-phase/SKILL.md` as local prompt surface | `fixtures/hima-skills/first-wave/project/.hima/skills/transition-phase/SKILL.md` |
| `status` | `packages/core/src/catalogs/operational-catalog.ts` + `.codex/skills/status/SKILL.md` as local prompt surface | `fixtures/hima-skills/first-wave/project/.hima/skills/status/SKILL.md` |

## Scope Boundary

This is first-wave local install evidence only. It does not write to `~/.hima`, complete all 7
excellence-book quotas, complete the 10/10 harvested-skill list, or prove runtime invocation inside
Claude, Codex, or Hermes.

The generated files preserve the locked HIMA frontmatter fields:

- `name`;
- `version`;
- `type`;
- `triggers`;
- `expected_outputs`;
- `requires_tools`;
- `fallback_for_toolsets`;
- `description`.

## Validation

`packages/core/test/skills-install.test.ts` now validates the fixture tree by:

- resolving the project-local skill scope;
- selecting the five expected skills;
- parsing every fixture frontmatter block through `parseSkillFrontmatter`;
- checking the managed HIMA skill artifact header.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 404 tests through the package runner. |
| Repo-local fixture contains at least 5 `SKILL.md` files | PASS: 5 first-wave project-local skills. |
| `corepack pnpm exec biome check ...skill wave touched files...` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only expected future `~/.hima` target references, guardrail wording, and unrelated research hits remained. |

## Non-Goals

Cycle 46 does not:

- write to a real user home;
- complete all Stream G book quotas;
- complete all harvested skills;
- prove runtime invocation inside Claude, Codex, or Hermes;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Skill wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-skill-installation-wave.md
  on-fail: Reopen cycle-46 as BLOCKED_SKILL_WAVE_OVERCLAIM and restore local-only install scope.
```
