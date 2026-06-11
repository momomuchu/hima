# Stream F - Benchmark Result Validation Command

Status: ACCEPTED  
Cycle: 34  
Date: 2026-05-14

## 1. Decision

Benchmark result validation is now available through the CLI without executing benchmarks.

`harness benchmark validate <file>` reads a benchmark result JSON file, validates it against
`BenchmarkResultSchema`, and reports the parsed suite/status/instance/runtime metadata. The command
does not launch runtimes, models, SWE-bench workers, or benchmark execution.

## 2. Implemented Surface

CLI command:

```bash
harness benchmark validate result.json --json
```

Implementation:

- `packages/cli/src/index.ts` defines `validateBenchmarkResultFile()`;
- validation uses `parseBenchmarkResult()` from `@harness/core`;
- output includes `externalSessionsLaunched: false`;
- invalid executed artifacts fail through schema errors.

## 3. Tests

Focused CLI tests prove:

- planned result JSON files validate;
- validator output does not claim external sessions launched;
- fake executed result JSON files without transcripts/evidence/cost are rejected;
- blocked result formatting remains local validation only;
- command surface docs include `harness benchmark validate`.

Evidence:

- `corepack pnpm --filter @harness/cli test` PASS: 72 tests.

## 4. Non-Goals

This cycle does not:

- write or persist benchmark results;
- run SWE-bench Verified;
- launch Claude/Codex/Hermes model sessions;
- collect transcripts;
- claim benchmark readiness.

## 5. Next Action

The next Stream F step should add benchmark result fixture files or persistence helpers so future
authorized execution can store result JSON in a predictable location and validate it before use.

```yaml
Falsifies-If:
  kill-condition: `harness benchmark validate` accepts fake executed benchmark results, launches external sessions, or is reported as benchmark execution evidence.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/cli/test/index.test.ts
  on-fail: Reopen cycle-34 as BLOCKED_BENCHMARK_VALIDATOR and restore schema-backed validation.
```

