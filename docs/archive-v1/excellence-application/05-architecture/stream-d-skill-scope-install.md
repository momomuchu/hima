---
claim-bearing: true
status: ACCEPTED
date: 2026-05-14
cycle: cycle-13-stream-d-skill-scope-install
deliverable: C13-1
---

# Stream D Skill Scope Install

## Source Check

OpenHands current docs describe skills loaded from sandbox, public, user, organization, and project
sources, merged in that precedence order with project highest:
<https://docs.openhands.dev/sdk/guides/agent-server/api-reference/skills/get-skills>.

The durable HIMA implementation in this cycle adopts the four persistent scopes from HARV-10:
public, user, org, and project. OpenHands' user/org skill docs also confirm persistent user and
organization skill locations while keeping repo-level skills as the project override:
<https://docs.openhands.dev/overview/skills/org>.

Sandbox skills are intentionally out of scope because they are session/runtime-exposed context, not
durable installed `.hima/skills/{name}/SKILL.md` artifacts.

## Decision

Cycle-13 introduces a HIMA-local skill scope model:

| Scope | Directory |
|---|---|
| `public` | `<publicRoot>/.hima/skills/{name}/SKILL.md` |
| `user` | `<userHome>/.hima/skills/{name}/SKILL.md` |
| `org` | `<orgRoot>/.hima/skills/{name}/SKILL.md` |
| `project` | `<projectRoot>/.hima/skills/{name}/SKILL.md` |

Resolver precedence is `public < user < org < project`. If the same skill name appears in multiple
scopes, the highest-precedence scope is selected while all candidates remain inspectable.

## Installer Contract

`installHimaSkills()` writes HIMA skill artifacts only after validating frontmatter with
`SkillFrontmatterSchema`. Dry-run plans actions without writing. Apply writes with the existing
safe atomic write path and refuses unmanaged overwrites unless `force` is explicit.

Catalog-generated descriptors use:

- `version: "1.0.0"`
- `type: "task"`
- catalog activation keywords as `triggers`
- catalog evidence keys as `expected_outputs`
- empty `requires_tools` and `fallback_for_toolsets` until toolset-specific skill metadata exists

## Non-Responsibilities

Cycle-13 does not:

- expose skills through runtime adapter directories;
- implement MCP skill APIs;
- implement hook activation;
- import external skill packs;
- add skill lint rules beyond schema validation and path safety;
- model ephemeral sandbox skills.

## Verification Evidence

Required closure commands:

```powershell
corepack pnpm --filter @harness/core test -- skills-install.test.ts --runInBand
corepack pnpm --filter @harness/core test -- --runInBand
corepack pnpm lint
corepack pnpm docs:index
corepack pnpm build
```

## Falsifies-If

```yaml
Falsifies-If:
  kill-condition: skill resolution lacks a tested public/user/org/project precedence model, writes unvalidated SKILL.md content, mutates during dry-run, or allows path escape.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/install/skill-resolver.ts
  on-fail: Reopen Stream D-S1/HARV-10 and restore schema-gated, path-safe scope resolution before continuing Stream D.
```
