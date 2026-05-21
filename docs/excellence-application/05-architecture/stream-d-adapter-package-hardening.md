---
claim-bearing: true
status: ACCEPTED
cycle-id: cycle-24-stream-d-adapter-package-hardening
owner-stream: Stream D
---

# Stream D - Adapter Package Hardening

## 1. Contract Status

Cycle 24 hardens the first-party adapter package contracts after D-hooks and D-MCP stabilized. The
scope is adapter registration and lifecycle behavior only; gate policy, hard-limits, MCP tools,
prompt content, and skill catalog behavior remain outside this cycle.

| Adapter | Runtime config surface | Canonical profile alignment | Known runtime limitation |
|---|---|---|---|
| Codex | `packages/adapter-codex/src/index.ts` writes `config.toml`, enables `[features].hooks`, and appends official `[[hooks.<Event>]]` command entries. | Preview operations are now tested against `getRuntimeProfile("codex")` for every supported gate command and native event. | Codex has no native `subagent_start` or `subagent_stop` hook event, so the adapter emits missing markers for both gates. |
| Claude | `packages/adapter-claude/src/index.ts` writes `settings.json` hook arrays under each Claude native event. | Preview operations are now tested against `getRuntimeProfile("claude")` for every gate command and native event. | No missing native marker in the current executable profile. |
| Hermes | `packages/adapter-hermes/src/index.ts` writes `hermes.config.json` gateway plugin hooks. | Preview operations are now tested against `getRuntimeProfile("hermes")`, including per-hook `blocking` values. | `subagent_start` is missing; `session_start`, `post_tool`, `post_compact`, `stop`, and `subagent_stop` are observable but non-blocking. |

## 2. Lifecycle Fix

Codex uninstall and repair now remove managed HIMA command entries from official Codex hook tables
surgically instead of deleting an entire official event block. This matters when a user has a mixed
`[[hooks.PreToolUse]]` block containing both a HIMA command and a custom command. The managed command
is removed or repaired; the custom command remains.

The same Codex scanner now stops official event-block matching before legacy `[[hooks]]` tables. That
prevents a later legacy user hook from being treated as part of the preceding official Codex event
block.

## 3. Cycle 24 Ownership Boundary

The working tree still contains prior archived Stream D construction from cycles 16-23. Those changes
are not Cycle 24 scope. The Cycle 24 adapter-hardening ownership set is limited to:

- `packages/adapter-codex/src/index.ts`;
- `packages/adapter-codex/test/index.test.ts`;
- `packages/adapter-claude/test/index.test.ts`;
- `packages/adapter-hermes/test/index.test.ts`;
- `docs/excellence-application/05-architecture/stream-d-adapter-package-hardening.md`;
- `docs/goals/SHORT-TERM-GOAL.md`;
- `docs/goals/COMPLETE-CONSTRUCTION-GOAL.md`;
- `docs/INDEX.md`.

Any non-adapter core, MCP, runtime-profile, hook, gate, catalog, or governance change visible in the
dirty worktree belongs to the earlier archived cycles and is not a new semantic change in this cycle.

## 4. Safety Properties

- All three adapters still write through `safeAtomicWriteFile()`, preserving root confinement and
  rejecting symlinked or hardlinked runtime config targets.
- Dry-run previews remain pure data builders; they do not read or mutate runtime config files.
- Install paths preserve unrelated runtime config, user hooks, and custom plugin fields.
- Uninstall paths remove only managed HIMA commands/hooks and preserve unrelated runtime settings.
- Runtime profile parity tests now make generated commands, native events, and Hermes blocking flags
  fail fast when `packages/core/src/runtime/runtime-profiles.ts` changes.

## 5. Non-goals

This cycle does not:

- add adapter system prompts or anti-bypass prompt clauses;
- create real-runtime end-to-end adapter sessions;
- add D-M5 namespace-as-policy-unit enforcement during Cycle 24 (closed later by Cycle 26);
- add hard-limits, permission-judge behavior, or new gate semantics;
- change `harness install <runtime>` CLI behavior beyond the package-level adapter functions.

## 6. Verification Evidence

- `corepack pnpm --filter @harness/adapter-codex test` passed with 13 tests, including runtime
  profile parity and mixed official Codex command preservation.
- `corepack pnpm --filter @harness/adapter-claude test` passed with 9 tests, including runtime
  profile parity.
- `corepack pnpm --filter @harness/adapter-hermes test` passed with 10 tests, including runtime
  profile parity and non-blocking marker coverage.
- `corepack pnpm --filter @harness/core test` passed with 367 tests across 32 files.
- `corepack pnpm lint` passed, including docs-index freshness and vocabulary guards.
- `corepack pnpm build` passed across core, Codex adapter, Claude adapter, Hermes adapter, CLI, and
  MCP server.
- Core inventory parity remained clean: `SRC_COUNT=69`, `CSV_COUNT=69`, `DIFF_COUNT=0`.
- PostToolUse dry-run returned `{}` through `node packages/cli/dist/index.js hook post-tool-use`.
- First saturation critic REJECTED stale truth surfaces and scope ambiguity; fixes landed. Second
  saturation critic PASSED with no material blocker.

## 7. Remaining Adapter Work

This hardening cycle made the adapter package contracts safer, but did not close Stream E. Cycle 27
later closed the prompt and binding foundation; the remaining adapter production work is now:

- install command wiring remains open;
- real-runtime end-to-end adapter sessions remain open;
- founding v1.0 adapter production readiness still depends on Stream F test sessions.

```yaml
Falsifies-If:
  kill-condition: Adapter package hardening claims closure while generated hook commands diverge from runtime profiles, Codex uninstall/repair removes user-owned hook commands, adapter writes can escape the requested root through symlinks or hardlinks, or this note is used to mark real-runtime adapter E2E readiness complete.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/adapter-codex/test/index.test.ts
  on-fail: Reopen cycle-24 as BLOCKED_ADAPTER_PACKAGE_HARDENING, restore package-level lifecycle parity, and keep Stream E production-readiness items open until real-runtime sessions pass.
```
