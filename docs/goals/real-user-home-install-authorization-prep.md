---
claim-bearing: true
status: COMPLETE
cycle: cycle-81-real-user-home-install-authorization-prep
created: 2026-05-15
---

# Real User-Home Install Authorization Preparation

## Result

Cycle 81 prepared the authorization and runbook boundary for future real `~/.hima` skill installs.

No real user-home write was performed. The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Current Local Evidence

The repo has local skill fixtures and core scope-resolution code, not real user-home installation
proof.

| Surface | Current evidence | Boundary |
|---|---|---|
| Core install API | `packages/core/src/install/skills-install.ts` plans/writes `.hima/skills/{name}/SKILL.md` for `public`, `user`, `org`, and `project` scope roots. | The API can target a supplied `userHome`, but this cycle did not call it against the real home directory. |
| Core resolver | `packages/core/src/install/skill-resolver.ts` resolves candidates with `public < user < org < project` precedence and rejects unsafe names. | Resolver proof over fixtures does not prove real `~/.hima` install or runtime invocation. |
| Book fixtures | Eight in-scope book folders under `fixtures/hima-skills/books/*/project/.hima/skills/`, each with 5 schema-valid skills. | Repo-local `project` fixture paths are not `~/.hima/skills/{book}/...`. |
| Harvested fixtures | Eleven harvested skill fixture folders under `fixtures/hima-skills/harvested/project/.hima/skills/`. | Fixtures do not complete the original implementation, hook wiring, runtime invocation, or real user-home install rows. |
| CLI artifact install | `install-artifacts` and `lifecycle apply` can write platform catalog artifacts under target platform directories. | This is not a direct proof of HIMA user-scope install under real `~/.hima`. |

## Book-Skill Install Blockers

The following master rows remain open because each needs real user-home evidence, not fixture
evidence:

| Book row | Current local proof | Required real evidence |
|---|---|---|
| `00-idea-pmf` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/00-idea-pmf/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `01-strategy-positioning` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/01-strategy-positioning/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `02-analysis-discovery` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/02-analysis-discovery/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `03-specification` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/03-specification/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `04-design-ux-ui` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/04-design-ux-ui/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `05-architecture` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/05-architecture/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `07-build` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/07-build/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |
| `09-quality-release-run` | 5 repo-local project fixture skills validated by `skills-install.test.ts`. | Real `~/.hima/skills/09-quality-release-run/...` install transcript, before/after listing, resolver output, runtime invocation proof, and rollback/restore note. |

## Harvested-Skill Blockers

The harvested rows remain mixed blockers: several need local implementation work before any live
invocation would be meaningful, and any real user-home install or live runtime invocation still
requires explicit authorization.

| Row | Fixture present | Remaining proof before closure |
|---|---|---|
| HARV-01 `ai-slop-cleaner` | `fixtures/hima-skills/harvested/project/.hima/skills/ai-slop-cleaner/SKILL.md`; local helper at `packages/core/src/security/ai-slop-cleaner.ts` | Live runtime invocation, adapter hook firing, actual dogfood cleanup workflow execution, and real user-home install transcript. |
| HARV-02 `config-linting` | `fixtures/hima-skills/harvested/project/.hima/skills/config-linting/SKILL.md` | 30+ lint implementation, CI/hook integration, and invocation evidence. |
| HARV-04 `mode-state-machine` | `fixtures/hima-skills/harvested/project/.hima/skills/mode-state-machine/SKILL.md` | Runtime persistence, hook wiring, and invocation evidence. |
| HARV-07 `evidence-gate` | `fixtures/hima-skills/harvested/project/.hima/skills/evidence-gate/SKILL.md` | Evaluator implementation, held-out execution, suite promotion, and real test-session demonstration. |
| HARV-08 `typed-handoff` | `fixtures/hima-skills/harvested/project/.hima/skills/typed-handoff/SKILL.md` | Service implementation, JSONL capture, replayability, and real invocation evidence. |
| HARV-09 `prompt-injection-scan` | `fixtures/hima-skills/harvested/project/.hima/skills/prompt-injection-scan/SKILL.md` | Scanner implementation and SessionStart hook evidence. |
| HARV-11 `default-deny-tools` | `fixtures/hima-skills/harvested/project/.hima/skills/default-deny-tools/SKILL.md` | SubagentStart inherited-deny enforcement, denial tests, and real subagent execution evidence. |
| HARV-13 `compact-hooks` | `fixtures/hima-skills/harvested/project/.hima/skills/compact-hooks/SKILL.md` | Real compaction adapter invocation, hook firing proof, and critical-state preservation evidence. |
| HARV-17 `prompt-cache-boundary` | `fixtures/hima-skills/harvested/project/.hima/skills/prompt-cache-boundary/SKILL.md` | Prompt-cache integration, cache-hit/freshness proof, and invalidation runtime behavior. |
| HARV-18 `anti-bypass-clause` | `fixtures/hima-skills/harvested/project/.hima/skills/anti-bypass-clause/SKILL.md` | Runtime permission enforcement, adapter hook wiring, and bypass-attempt detection evidence. |
| HARV-16 `preference-router` | `fixtures/hima-skills/harvested/project/.hima/skills/preference-router/SKILL.md`; local helper at `packages/core/src/routing/preference-router.ts` | Live route evaluation, model/runtime execution, adapter behavior, learned preference evidence, and real user-home invocation proof. |

## Authorization Packet

Before any future real `~/.hima` install, record:

| Field | Required content |
|---|---|
| Scope | Exact install lane: book skills, harvested skills, or both; target list and expected count. |
| Authorized by | Human granting permission, date/time, and authorization id. |
| Target home | Absolute user-home path and resolved `~/.hima` directory; no guessed path. |
| Backup path | Pre-install copy or archive location for existing `~/.hima/skills` content. |
| Apply boundary | Dry-run output first; explicit second step for writes; no write on dry-run. |
| Restore plan | Commands or script path to restore pre-existing files if validation fails. |
| Transcript path | Location for command output, before/after listings, diff summary, and resolver output. |
| Data policy | Whether skill contents and paths may be stored in repo evidence; redact secrets if present. |
| Stop conditions | Missing authorization, unexpected target path, unmanaged existing file, backup failure, dry-run mismatch, resolver failure, runtime invocation failure, or any write outside the authorized home. |

## Future Runbook

The future real install should be staged as:

1. Record the authorization packet.
2. Capture `Get-ChildItem ~/.hima/skills -Recurse` or equivalent before-state, if the path exists.
3. Create the backup/restore bundle before writes.
4. Run a dry-run or direct core planning call against the resolved `userHome` and preserve planned paths.
5. Apply only after planned paths match the authorized target list.
6. Capture after-state listing and resolver output.
7. Invoke at least one installed skill from a HIMA cycle or runtime-safe harness path.
8. Record PASS, FAIL, or BLOCKED with restore status.

If no direct CLI exists for the real HIMA user-scope install at execution time, the operator must
either add and test that CLI surface first or record the missing CLI as BLOCKED. A platform
`install-artifacts` run alone is not enough to close the real `~/.hima` rows.

## Non-Goals Preserved

Cycle 81 did not:

- write to real `~/.hima`;
- install book or harvested skills in the real user home;
- invoke skills from a live runtime;
- launch Claude Code, Codex CLI, Hermes, or any model-backed session;
- run H3 CI, SWE-bench, runtime parity, beta, publication, payment, legal, market, or SIEM lanes;
- close any book-skill real install row or harvested implementation row.

## Verification

| Check | Result |
|---|---|
| Fixture inventory | PASS: eight book fixture trees and eleven harvested fixture trees are present. |
| Install API review | PASS: core supports scoped `.hima/skills/{name}/SKILL.md` planning/writes and resolver precedence; no real user-home call was made. |
| CLI boundary review | PASS: platform artifact commands exist, but they are not accepted as direct real `~/.hima` install proof. |
| No execution overclaim | PASS: this artifact keeps real install and live invocation rows open. |

```yaml
Falsifies-If:
  kill-condition: This preparation artifact is used as proof that book or harvested skills were installed under real ~/.hima.
  checkpoint-date: 2026-05-29
  evidence-anchor: docs/goals/real-user-home-install-authorization-prep.md
  on-fail: Reopen cycle-81 as BLOCKED_USER_HOME_INSTALL_PROXY_COMPLETION and restore the real-install blockers.
```
