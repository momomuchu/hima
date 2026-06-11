# Stream E - Install Command Wiring

Status: ACCEPTED  
Cycle: 28  
Date: 2026-05-14

## 1. Decision

Stream E install wiring now has an adapter-owned package boundary.

Each first-party adapter exposes a subpath install module:

- `@harness/adapter-claude/install`
- `@harness/adapter-codex/install`
- `@harness/adapter-hermes/install`

The CLI no longer dispatches directly to low-level preview/apply/remove helpers. It calls these
install modules, and those modules compose package-local prompts, profile-backed hook bindings,
existing lifecycle functions, and unsupported/degraded hook metadata.

## 2. Implemented Surfaces

| Runtime | Module | Package export | Preserved boundary |
|---|---|---|---|
| Claude Code | `packages/adapter-claude/src/install.ts` | `@harness/adapter-claude/install` | All hooks planned; non-blocking observable hooks remain degraded metadata. |
| Codex | `packages/adapter-codex/src/install.ts` | `@harness/adapter-codex/install` | `subagent_start` and `subagent_stop` remain unsupported metadata, not blocking claims. |
| Hermes | `packages/adapter-hermes/src/install.ts` | `@harness/adapter-hermes/install` | `subagent_start` unsupported and non-blocking hooks degraded. |

Package build scripts now emit both `dist/index.js` and `dist/install.js`, and package files include
`src/system-prompt.md` so built install modules can still point to prompt material.

## 3. CLI Dispatch

`packages/cli/src/index.ts` now imports adapter install subpaths for apply/remove behavior:

- `applyPlatformConfig()` calls `apply*Install()`;
- `removePlatformConfig()` calls `remove*Install()`;
- install manifests still provide hook command overrides through
  `extractInstallManifestHookCommands()`.

The CLI remains a dispatcher. It does not duplicate runtime-specific hook tables or silently invent
blocking semantics for unsupported hooks.

## 4. Runtime Claim Boundary

This cycle proves package/CLI install dispatch shape. It does not prove:

- a real Claude Code, Codex, or Hermes session executed end-to-end;
- Stream F benchmark readiness;
- five-client compatibility;
- launch readiness.

Real-runtime sessions remain the next Stream E/F work.

## 5. Tests

The adapter package tests now fail if install planning:

- drops the prompt path;
- drops hook-binding metadata;
- implies unsupported hooks are blocking;
- writes platform config during planning;
- applies without carrying plan metadata.

The CLI test suite now fails if `harness install <target> --apply --json` does not expose the
adapter-owned install plan metadata.

Focused evidence collected during Cycle 28:

- `corepack pnpm --filter @harness/adapter-claude test` PASS: 13 tests.
- `corepack pnpm --filter @harness/adapter-codex test` PASS: 17 tests.
- `corepack pnpm --filter @harness/adapter-hermes test` PASS: 14 tests.
- `corepack pnpm --filter @harness/cli test` PASS: 64 tests.

Full close evidence is recorded in `docs/goals/archive/cycle-28-DONE-2026-05-14.md`.

```yaml
Falsifies-If:
  kill-condition: Install command wiring bypasses adapter-owned install modules, duplicates runtime hook tables in the CLI, drops prompt or binding metadata, implies unsupported hooks are production-blocking, or claims real-runtime E2E/benchmark/five-client readiness without actual sessions.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/cli/test/index.test.ts
  on-fail: Reopen cycle-28 as BLOCKED_ADAPTER_INSTALL_WIRING and restore adapter-owned install dispatch before real-runtime sessions begin.
```
