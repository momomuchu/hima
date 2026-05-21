---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-40-stream-f-cross-runtime-parity-fixture-harness
---

# Stream F - Cross-Runtime Parity Fixture Harness

## Result

Cycle 40 added a synthetic cross-runtime governance parity fixture harness:

- `RuntimeParityFixtureSchema`
- `fixtures/runtime-parity/synthetic/{claude,codex,hermes}.json`
- `harness runtime parity-fixture-validate`

The harness checks that Claude, Codex, and Hermes fixtures expose equivalent governance fields:
risk class, operating mode, macro cycle, subphase, active gate, required evidence keys, ledger
hash algorithm, ledger event kind, evidence-anchor kind, and fixture-only policy boundary.

## Scope Boundary

This is fixture parity only. It does not prove real Claude/Codex/Hermes runtime parity, adapter
production readiness, SWE-bench execution, or model-session behavior.

The fixture contract requires:

- `fixtureScope: "synthetic_not_real_runtime"`;
- `externalSessionsLaunched: false`;
- `policyBoundary: "fixture_only_no_runtime_execution"`;
- one fixture for each canonical runtime target: `claude`, `codex`, and `hermes`.

## Drift Detection

The validator fails when:

- a target fixture is missing;
- a fixture omits a schema-required governance field;
- a runtime target's governance object differs from the reference governance object;
- a fixture claims external runtime execution or real-runtime parity scope.

The invalid fixture under `fixtures/runtime-parity/invalid/` documents the missing-governance-field
case for regression coverage.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- runtime-parity-fixture-schema.test.ts` | PASS: 392 tests through the package runner. |
| `corepack pnpm --filter @harness/cli test` | PASS: 99 tests. |
| `corepack pnpm exec biome check ...runtime parity touched files...` | PASS. |
| Built CLI fixture validation smoke | PASS: canonical synthetic fixtures returned `parity: "pass"` and `externalSessionsLaunched: false`. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only expected active-cycle and negative-test hits remained before closeout. |

## Non-Goals

Cycle 40 did not:

- run Claude Code, Codex CLI, Hermes, SWE-bench, or model sessions;
- claim real runtime parity;
- produce real runtime transcripts;
- satisfy final F3 runtime parity acceptance.

```yaml
Falsifies-If:
  kill-condition: Synthetic parity fixtures are presented as real Claude/Codex/Hermes runtime parity or launch external runtime/model sessions.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-f-cross-runtime-parity-fixture-harness.md
  on-fail: Reopen cycle-40 as BLOCKED_PARITY_FIXTURE_OVERCLAIM and restore synthetic-only scope.
```
