---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-36-stream-f-benchmark-result-persistence
---

# Stream F - Benchmark Result Persistence

## Result

Cycle 36 added a local benchmark result persistence surface:

- `harness benchmark write --status planned --instanceId <id> --target <runtime> --root <root>`
- `harness benchmark write --status blocked --instanceId <id> --target <runtime> --blockReason <reason> --root <root>`

The command writes schema-backed JSON artifacts under:

```text
<root>/.planning/benchmarks/swe-bench-verified/<runtime>/<instance-id>.<status>.json
```

It does not run SWE-bench, launch Claude/Codex/Hermes, invoke model sessions, or claim benchmark
execution.

## Implementation

The CLI now exposes `writeBenchmarkResultArtifact()` in `packages/cli/src/index.ts`. The helper:

- accepts only `planned` and `blocked` result statuses;
- validates runtime targets through the existing install-target parser;
- rejects instance ids with path separators;
- parses the artifact through `BenchmarkResultSchema` before writing;
- writes with `safeAtomicWriteFile()` under the selected project root;
- returns `externalSessionsLaunched: false`.

Executed benchmark artifacts remain validator-only inputs until a future authorized execution path
can provide transcripts, before/after tests, HIMA evidence, overhead, and token/cost accounting.

## Verification

Cycle 36 focused verification:

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/cli test` | PASS: 79 tests. |
| `corepack pnpm exec biome check --write packages/cli/src/index.ts packages/cli/test/index.test.ts docs/conception/09-cli-commands-spec.md` | PASS after formatting one file. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Built CLI write+validate smoke | PASS: planned artifact validated with `externalSessionsLaunched: false`. |
| Post-tool dry-run | PASS against repo root. |

## Non-Goals

Cycle 36 did not:

- run SWE-bench Verified;
- execute real runtime/model sessions;
- generate executed benchmark evidence;
- compare governed vs baseline runs;
- satisfy Stream F runtime parity, stress, or compliance-pack gates.

```yaml
Falsifies-If:
  kill-condition: Benchmark persistence writes artifacts that bypass BenchmarkResultSchema, allows executed status writes, or launches external runtime/model sessions.
  checkpoint-date: 2026-05-28
  evidence-anchor: packages/cli/src/index.ts
  on-fail: Reopen cycle-36 as BLOCKED_BENCHMARK_PERSISTENCE and restore local-only planned/blocked writes.
```
