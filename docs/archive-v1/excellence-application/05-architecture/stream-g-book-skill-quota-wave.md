---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-48-stream-g-excellence-book-quota-wave
---

# Stream G - Book Skill Quota Wave

## Result

Cycle 48 added a repo-local `00-idea-pmf` book-scoped skill fixture wave.

The fixture tree lives at:

`fixtures/hima-skills/books/00-idea-pmf/project/.hima/skills/`

## Book Target

| Field | Value |
|---|---|
| Stream G book row | `00-idea-pmf` skills |
| Local artifact root | `fixtures/hima-skills/books/00-idea-pmf/project/.hima/skills/` |
| Skill count | 5 |
| Validation | `packages/core/test/skills-install.test.ts` resolves and parses the book-scoped fixture tree |
| Still open | Real `~/.hima/skills/00-idea-pmf/` install, runtime invocation, and remaining book quotas |

## Installed Fixture Skills

| Skill | Purpose |
|---|---|
| `idea-sourcing` | Source product seeds without treating discovery signals as PMF proof. |
| `pmf-evidence-card` | Separate PMF evidence from inference, assumption, and risk. |
| `icp-access-plan` | Define a reachable ICP access path before build effort. |
| `problem-pain-score` | Score problem pain with explicit evidence and hard kill gates. |
| `validation-ladder` | Sequence PMF validation tests from cheapest signal to strongest proof. |

## Scope Boundary

This is a repo-local book-scoped fixture wave. It does not write to `~/.hima`, complete all seven
book quotas, prove runtime invocation, or claim the full Stream G book application work is done.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- skills-install.test.ts` | PASS: 406 tests through the package runner. |
| `corepack pnpm exec biome check ...book skill touched files...` | PASS. |
| Book fixture contains at least 5 `SKILL.md` files | PASS: 5 `00-idea-pmf` project-local skills. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only active-cycle guardrails, unrelated all-seven discussion, and non-goal text remained. |

## Non-Goals

Cycle 48 does not:

- write to a real user home;
- complete all seven Stream G book quotas;
- complete all harvested skills;
- prove runtime invocation inside Claude, Codex, or Hermes;
- run external model sessions.

```yaml
Falsifies-If:
  kill-condition: Book-skill fixture wave claims full Stream G completion, writes outside repo-local fixtures without authorization, or installs skills that fail the locked schema.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-g-book-skill-quota-wave.md
  on-fail: Reopen cycle-48 as BLOCKED_BOOK_SKILL_WAVE_OVERCLAIM and restore local-only book fixture scope.
```
