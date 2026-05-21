# Stream F - Benchmark Result Schema

Status: ACCEPTED  
Cycle: 33  
Date: 2026-05-14

## 1. Decision

Benchmark results must be schema-gated before any future execution output can be treated as
evidence.

Cycle 33 adds `BenchmarkResultSchema` to `@harness/core`. The schema distinguishes planned,
blocked, and executed benchmark artifacts. It rejects executed results unless they carry transcript,
test, HIMA evidence, overhead, and cost-accounting fields.

## 2. Implemented Surface

Core schema:

- `packages/core/src/schemas/benchmark-result.schema.ts`
- exported from `packages/core/src/index.ts`

Public parser:

- `parseBenchmarkResult(input)`

Statuses:

- `planned` - benchmark intent exists, no execution evidence required;
- `blocked` - execution blocked, `blockReason` required;
- `executed` - execution completed, full evidence required.

## 3. Executed Evidence Requirements

An `executed` result requires:

- `baselineTranscriptPath`;
- `governedTranscriptPath`;
- `testsBeforeAfterPath`;
- `himaEvidencePath`;
- `wallClockOverheadMs`;
- `costAccounting`.

`costAccounting` must include at least one of:

- `tokenCount`;
- `costUsd`;
- `zeroCostReason`.

This prevents a dry-run plan or blocked preflight from masquerading as a benchmark result.

## 4. Tests

Focused schema tests prove:

- planned artifacts parse without execution evidence;
- blocked artifacts require `blockReason`;
- executed artifacts without transcripts/evidence/overhead/cost are rejected;
- executed artifacts with complete evidence and zero-cost accounting are accepted;
- empty cost accounting is rejected.

Evidence:

- `corepack pnpm --filter @harness/core test -- benchmark-result-schema.test.ts` PASS: 372 tests
  through the package test runner.

## 5. Non-Goals

This cycle does not:

- persist benchmark result files;
- run SWE-bench Verified;
- launch Claude/Codex/Hermes model sessions;
- collect real transcripts;
- claim benchmark readiness.

## 6. Next Action

The next Stream F step should wire this schema into a persistence or validation command so benchmark
result files can be checked independently before any execution pipeline consumes them.

```yaml
Falsifies-If:
  kill-condition: Executed benchmark artifacts validate without baseline/governed transcripts, test output, HIMA evidence, overhead, and cost or zero-cost accounting.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/test/benchmark-result-schema.test.ts
  on-fail: Reopen cycle-33 as BLOCKED_BENCHMARK_RESULT_SCHEMA and tighten the schema before benchmark execution.
```

