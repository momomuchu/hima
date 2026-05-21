---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-39-stream-f-benchmark-execution-authorization
---

# Stream F - Benchmark Authorization Boundary

## Result

Cycle 39 added a fail-closed benchmark execution authorization boundary:

- `BenchmarkAuthorizationSchema`
- `harness benchmark authorization write`
- `harness benchmark authorization validate`
- `harness benchmark execution-preflight`

The boundary is local-only. It records whether SWE-bench/runtime/model execution is blocked or
explicitly authorized, but it does not run SWE-bench or start any runtime/model session.

## Authorization Contract

Authorization artifacts live at:

```text
<root>/.planning/benchmarks/swe-bench-verified/authorization.json
```

They include:

- requested SWE-bench Verified instance count, bounded to 1-20;
- runtime targets;
- explicit authorization boundary string;
- blocked reason, when blocked;
- authorized by/id, cost budget, credential scope, evidence retention path, and transcript
  retention path, when authorized.

`harness benchmark execution-preflight` returns `executionAllowed: false` when the authorization file
is absent or blocked. Authorized artifacts can allow preflight, but the command still does not execute
the benchmark.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- benchmark-authorization-schema.test.ts` | PASS: 387 tests through the package runner. |
| `corepack pnpm --filter @harness/cli test` | PASS: 95 tests. |
| `corepack pnpm exec biome check packages/core/src/schemas/benchmark-authorization.schema.ts packages/core/test/benchmark-authorization-schema.test.ts packages/cli/src/index.ts packages/cli/test/index.test.ts docs/conception/09-cli-commands-spec.md` | PASS. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Built CLI authorization+preflight smoke | PASS: absent and blocked preflight returned `executionAllowed: false` and `externalSessionsLaunched: false`. |
| Post-tool dry-run | PASS. |
| Saturation sweep | PASS: no hidden execution, benchmark-readiness overclaim, or absent/blocked authorization bypass remained. |

## Non-Goals

Cycle 39 did not:

- authorize benchmark execution in this session;
- run SWE-bench Verified;
- launch real runtime/model sessions;
- collect real benchmark transcripts;
- claim benchmark readiness.

```yaml
Falsifies-If:
  kill-condition: Benchmark execution can start or be claimed without an explicit authorization artifact.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/core/src/schemas/benchmark-authorization.schema.ts
  on-fail: Reopen cycle-39 as BLOCKED_BENCHMARK_AUTHORIZATION and restore fail-closed execution guards.
```
