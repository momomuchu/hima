# Stream F - Benchmark Result Fixtures

Status: ACCEPTED  
Cycle: 35  
Date: 2026-05-14

## 1. Decision

Benchmark result validation now has canonical fixture files.

The fixture set makes planned, blocked, valid executed, and invalid fake executed benchmark artifacts
reviewable and regression-testable without running SWE-bench, Claude Code, Codex CLI, Hermes, or any
external model session.

## 2. Fixture Set

Fixture root:

- `fixtures/benchmark-results/`

Files:

- `planned.json` - valid planned benchmark artifact;
- `blocked.json` - valid blocked artifact with `blockReason`;
- `executed-valid.json` - schema-valid executed artifact with synthetic evidence paths and explicit
  zero-cost accounting;
- `executed-invalid-fake.json` - intentionally invalid executed artifact with no transcripts,
  tests, HIMA evidence, overhead, or cost accounting.

The `executed-valid.json` evidence files under
`fixtures/benchmark-results/evidence/executed-valid/` are synthetic validator fixtures. They
explicitly state that no SWE-bench instance, runtime, model, API call, or external session occurred.

## 3. Tests

Focused tests prove:

- core schema accepts planned, blocked, and valid executed fixtures;
- core schema rejects the fake executed fixture;
- valid executed fixture evidence paths resolve;
- CLI `benchmark validate` accepts the valid fixture set;
- CLI validator rejects the fake executed fixture.

Evidence:

- `corepack pnpm --filter @harness/core test -- benchmark-result-schema.test.ts` PASS: 375 tests.
- `corepack pnpm --filter @harness/cli test` PASS: 74 tests.

## 4. Non-Goals

This cycle does not:

- persist new benchmark results;
- run SWE-bench Verified;
- launch runtime/model sessions;
- claim benchmark execution;
- claim benchmark readiness.

## 5. Next Action

The next Stream F step should add persistence helpers or a command that writes planned/blocked
benchmark result artifacts into a predictable location using this fixture contract as the target
shape.

```yaml
Falsifies-If:
  kill-condition: The invalid fake executed fixture passes validation, or the synthetic valid executed fixture is reported as real SWE-bench/runtime evidence.
  checkpoint-date: 2026-05-28
  evidence-anchor: fixtures/benchmark-results/executed-invalid-fake.json
  on-fail: Reopen cycle-35 as BLOCKED_BENCHMARK_FIXTURES and restore explicit valid/invalid fixture coverage.
```

