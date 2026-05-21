# Stream E - Adapter Production Foundation

Status: ACCEPTED  
Cycle: 27  
Date: 2026-05-14

## 1. Decision

Stream E adapter production readiness now has an explicit foundation layer for all three
first-party adapters:

- package-local system prompts define HIMA anti-bypass, evidence, and runtime-claim boundaries;
- package-local hook-binding modules expose typed runtime event to HIMA gate mappings;
- adapter tests prove prompt presence, runtime-profile alignment, and unsupported/degraded hook
  boundaries.

This is still not real-runtime E2E readiness. It is the contract layer required before install
command wiring and runtime sessions can make credible production-readiness claims.

## 2. Implemented Surfaces

| Runtime | Prompt | Binding module | Boundary |
|---|---|---|---|
| Claude Code | `packages/adapter-claude/src/system-prompt.md` | `packages/adapter-claude/src/hook-bindings.ts` | All HIMA gates expose native events; `session_start`, `post_tool`, and `post_compact` are observable/non-blocking. |
| Codex | `packages/adapter-codex/src/system-prompt.md` | `packages/adapter-codex/src/hook-bindings.ts` | `subagent_start` and `subagent_stop` remain unsupported because the runtime profile exposes no native Codex event. |
| Hermes | `packages/adapter-hermes/src/system-prompt.md` | `packages/adapter-hermes/src/hook-bindings.ts` | `subagent_start` remains unsupported; `session_start`, `post_tool`, `post_compact`, `stop`, and `subagent_stop` are observable/non-blocking. |

The binding modules are intentionally profile-backed instead of hand-maintained tables. Each module
maps `GATE_TYPES` through `getRuntimeProfile(<target>)` and decorates the result with an explicit
status:

- `supported`: native event exists and can block;
- `degraded`: native event exists but cannot block;
- `unsupported`: no native event is exposed for the HIMA gate.

## 3. Runtime Claim Boundary

The prompts and binding modules may support package-level install planning and local preview logic.
They do not prove:

- `harness install <runtime>` command completion;
- real Claude/Codex/Hermes runtime E2E execution;
- Stream F benchmark readiness;
- five-client compatibility;
- launch readiness.

Any future doc or marketing claim that calls the adapters production-ready must cite real runtime
sessions, not only the package tests introduced here.

## 4. Tests

The adapter package tests now fail if:

- a package-local `system-prompt.md` is missing;
- prompt text drops the HIMA anti-bypass or evidence surfaces;
- hook bindings drift from `packages/core/src/runtime/runtime-profiles.ts`;
- unsupported hooks are silently implied as production-blocking controls;
- degraded hooks lose their non-blocking status.

Focused evidence collected during Cycle 27:

- `corepack pnpm --filter @harness/adapter-claude test` PASS: 11 tests.
- `corepack pnpm --filter @harness/adapter-codex test` PASS: 15 tests.
- `corepack pnpm --filter @harness/adapter-hermes test` PASS: 12 tests.

Full close evidence is recorded in `docs/goals/archive/cycle-27-DONE-2026-05-14.md`.

## 5. Next Work

Cycle 28 later closed install command wiring by adding adapter-owned install modules and CLI/package
dispatch through `@harness/adapter-*/install`.

Cycle 29+ owns real-runtime sessions and Stream F benchmark readiness.

```yaml
Falsifies-If:
  kill-condition: This foundation is used to claim production-ready adapters, real-runtime E2E completion, five-client compatibility, or benchmark readiness without actual runtime sessions; bindings drift from runtime profiles; or unsupported hooks are presented as production-blocking.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/adapter-codex/test/index.test.ts
  on-fail: Reopen cycle-27 as BLOCKED_ADAPTER_PRODUCTION_FOUNDATION and restore prompt, binding, and unsupported-hook truth before install or E2E work continues.
```
