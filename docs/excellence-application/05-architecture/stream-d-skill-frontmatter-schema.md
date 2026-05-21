---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-12-stream-d-skill-frontmatter-schema
deliverable: C12-5
---

# Stream D Skill Frontmatter Schema

## Decision

Cycle-12 makes the Stream D-S2/D-S3 `SKILL.md` frontmatter contract executable in
`packages/core/src/schemas/skill.schema.ts`.

The schema is strict: unknown fields fail validation, the skill `type` is closed to `task` or
`knowledge`, and the locked frontmatter fields are required before a future installer can accept a
skill.

## Locked Fields

| Field | Runtime contract |
|---|---|
| `name` | Required kebab-case skill name. |
| `version` | Required semantic version string. |
| `type` | Required `task` or `knowledge`. |
| `triggers` | Required non-empty array of non-blank strings. |
| `expected_outputs` | Required non-empty array of non-blank strings. |
| `requires_tools` | Required array of non-blank strings. |
| `fallback_for_toolsets` | Required array of non-blank strings. |
| `description` | Required one-line non-blank string. |

## Parse-Time Surface

The module exports:

- `SkillTypeSchema`
- `SkillFrontmatterSchema`
- `parseSkillFrontmatter(input)`
- `safeParseSkillFrontmatter(input)`

Future installers should call this module directly instead of duplicating frontmatter validation.

## Non-Responsibilities

Cycle-12 does not:

- implement D-S1 `.hima/skills/{name}/SKILL.md` installation;
- implement HARV-10 public/user/project/org scope resolution;
- migrate existing generated skills;
- add skill linting beyond strict schema tests;
- wire hooks or MCP tools.

## Verification Evidence

Required closure commands:

```powershell
corepack pnpm --filter @harness/core test -- skill-schema.test.ts --runInBand
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm docs:index
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: malformed SKILL.md frontmatter can pass validation or Stream D install/scope behavior is claimed without implementation.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/schemas/skill.schema.ts
  on-fail: Reopen Stream D-S2/D-S3 and restore strict schema validation before D-S1 or HARV-10 continues.
```
