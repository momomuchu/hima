# Stream F - Benchmark Harness Design

Status: ACCEPTED  
Cycle: 32  
Date: 2026-05-14

## 1. Decision

Benchmark planning is a dry-run surface separate from benchmark execution.

`harness benchmark plan` creates a SWE-bench Verified benchmark plan without launching external
runtimes, model sessions, or benchmark workers. It returns the required evidence and an explicit
`blocked_until_authorized` status.

## 2. Implemented Surface

CLI command:

```bash
harness benchmark plan --instances 10 --json
```

Implementation:

- `packages/cli/src/index.ts` defines `planBenchmarkRun()`;
- accepted instance count is 1 through 20;
- suite is fixed to `swe-bench-verified` for the v1 Stream F target;
- output always reports `executionMode: dry_run_plan`;
- output always reports `willLaunchExternalSessions: false`;
- output always reports `requiresExplicitAuthorization: true`;
- output status is `blocked_until_authorized`.

## 3. Evidence Contract

Future authorized benchmark execution must capture:

- runtime version;
- fixture or benchmark instance id;
- baseline transcript without HIMA governance;
- governed transcript with HIMA hooks and evidence;
- before/after test output;
- HIMA events or ledger excerpts;
- wall-clock overhead;
- token or cost accounting.

The dry-run plan is not a benchmark result and cannot satisfy Stream F execution criteria by itself.

## 4. Tests

Focused CLI tests prove:

- `harness benchmark plan --json` does not launch external sessions;
- the plan is blocked until explicit authorization;
- required cost/accounting evidence is present;
- human formatting states external sessions are not launched;
- invalid instance counts below 1 or above 20 are rejected.

Evidence:

- `corepack pnpm --filter @harness/cli test` PASS: 69 tests.

## 5. Non-Goals

This cycle does not:

- run SWE-bench Verified;
- execute Claude/Codex/Hermes model sessions;
- collect benchmark transcripts;
- compare baseline vs governed success rate;
- claim benchmark readiness;
- replace real runtime smoke evidence.

## 6. Next Action

The next Stream F step is either:

- a benchmark dry-run result schema/fixture file that can be persisted, or
- authorized benchmark execution if the user explicitly approves runtime/model spend.

```yaml
Falsifies-If:
  kill-condition: `harness benchmark plan` launches external sessions, emits benchmark results without execution evidence, accepts an out-of-range instance count, or is presented as SWE-bench readiness.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/cli/test/index.test.ts
  on-fail: Reopen cycle-32 as BLOCKED_BENCHMARK_HARNESS_OVERCLAIM and restore dry-run-only benchmark planning.
```

