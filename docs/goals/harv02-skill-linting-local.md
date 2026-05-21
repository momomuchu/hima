---
claim-bearing: true
status: COMPLETE
cycle: cycle-85-harv02-skill-linting-local
created: 2026-05-15
---

# HARV-02 Skill Linting Local Proof

## Result

Cycle 85 implemented a repo-local HARV-02 SKILL.md linter with a focused 44-rule deterministic
catalog.

HARV-02 remains open as a full master-goal row because no CI enforcement was published, no full
agnix 423-rule parity was claimed, and no real `~/.hima` scan occurred. The construction ledger
remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Implemented Surface

| Artifact | Result |
|---|---|
| `packages/core/src/install/skill-lint.ts` | Adds `lintSkillMarkdown`, `SKILL_LINT_RULES`, reports, findings, and a 44-rule local lint catalog. |
| `packages/core/src/index.ts` | Exports the local linter surface. |
| `packages/core/test/skill-lint.test.ts` | Covers valid harvested fixture, missing/unclosed frontmatter, malformed frontmatter/body findings, and rule catalog uniqueness/count. |

## Rule Families

The local linter checks:

| Family | Examples |
|---|---|
| Frontmatter envelope | Missing frontmatter, unclosed delimiter, invalid YAML, non-mapping YAML. |
| Locked schema | Required fields, unknown fields, schema mismatch. |
| Field shape | Kebab-case name, semver version, task/knowledge type, one-line description. |
| Arrays | Missing/non-array/empty/blank/duplicate trigger, output, tool, and fallback lists. |
| Body conventions | Managed HIMA artifact header, title, Activation, Ownership, Owns, Out of scope, minimum body detail. |

## Boundary

This is local linter proof only. It does not prove:

- full agnix 423-rule parity;
- CI publication or repository branch protection;
- real user-home `~/.hima` scanning;
- live runtime configuration scanning;
- beta evidence, publication, payment, legal, market, H3 OS, benchmark, or SIEM evidence.

## Verification

| Check | Result |
|---|---|
| Focused core tests | PASS: `corepack pnpm --filter @harness/core test -- skill-lint.test.ts` ran through the package runner with 444/444 tests passing. |
| Valid fixture test | PASS: `config-linting/SKILL.md` returns `pass` with no findings. |
| Invalid fixture test | PASS: malformed frontmatter/body produces deterministic rule ids. |
| Rule catalog test | PASS: 44 unique rules are exported for local proof. |

```yaml
Falsifies-If:
  kill-condition: This local linter proof is used as proof of full agnix parity, CI enforcement, live runtime scanning, or real ~/.hima scanning.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/harv02-skill-linting-local.md
  on-fail: Reopen cycle-85 as BLOCKED_HARV02_PROXY_COMPLETION and restore the full-lint/CI/user-home blockers.
```
