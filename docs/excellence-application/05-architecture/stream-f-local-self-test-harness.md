# Stream F - Local Self-Test Harness

Status: ACCEPTED  
Cycle: 31  
Date: 2026-05-14

## 1. Decision

`harness self-test` is a local deterministic preflight command. It validates install planning and
hook dry-run behavior without launching Claude Code, Codex CLI, Hermes, or any paid model session.

This command exists to keep construction moving while executed external runtime smokes remain behind
an explicit authorization boundary.

## 2. Implemented Surface

CLI command:

```bash
harness self-test --root <workspace> --json
```

Optional target filter:

```bash
harness self-test --root <workspace> --target codex --json
```

Implementation:

- `packages/cli/src/index.ts` defines `runLocalSelfTest()`;
- the command runs `installPlatform()` in dry-run mode for each selected target;
- the command runs `handleHook(..., "post_tool", ..., { dryRun: true })`;
- the command reports unsupported and degraded hook boundaries from runtime profiles;
- the command always reports `externalRuntimeSessionsLaunched: false`;
- each target reports `runtimeExecution.status: blocked_by_design`.

## 3. Output Boundary

The output separates:

- local install/hook dry-run status;
- unsupported hook metadata;
- degraded non-blocking hook metadata;
- real runtime execution status.

Real runtime execution is always blocked by design in this command. Any future command that launches
Claude/Codex/Hermes model sessions must be a separate, explicitly authorized surface.

## 4. Tests

Focused CLI tests prove:

- `harness self-test --json` reports all three targets;
- no external runtime sessions are launched;
- Codex unsupported subagent hooks remain explicit;
- dry-run self-test does not write `.codex/config.toml`;
- dry-run self-test does not write `.planning/install-manifest.json`;
- human formatting says external runtime sessions were not launched.

Evidence:

- `corepack pnpm --filter @harness/cli test` PASS: 66 tests.

## 5. Non-Goals

This cycle does not:

- execute Claude Code, Codex CLI, or Hermes model sessions;
- replace Cycle 30 blocked runtime preflight;
- claim adapter production readiness;
- claim SWE-bench or Stream F benchmark readiness;
- generate compliance packs;
- prove five-client compatibility.

## 6. Next Action

The next Stream F step is a benchmark harness design/implementation surface that keeps benchmark
execution separate from local self-test. Benchmark execution still requires cost/runtime
authorization.

```yaml
Falsifies-If:
  kill-condition: `harness self-test` launches external model sessions by default, writes install manifests during local preflight, hides unsupported/degraded hook metadata, or is reported as executed runtime/benchmark evidence.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/cli/test/index.test.ts
  on-fail: Reopen cycle-31 as BLOCKED_SELF_TEST_OVERCLAIM and restore the local-only evidence boundary.
```

