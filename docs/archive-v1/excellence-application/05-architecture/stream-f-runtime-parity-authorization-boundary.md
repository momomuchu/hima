---
claim-bearing: true
status: COMPLETE
created: 2026-05-14
cycle: cycle-41-stream-f-real-runtime-parity-authorization-boundary
---

# Stream F - Runtime Parity Authorization Boundary

## Result

Cycle 41 added a fail-closed authorization boundary for real runtime parity execution:

- `RuntimeParityAuthorizationSchema`
- `harness runtime parity-authorization write`
- `harness runtime parity-authorization validate`
- `harness runtime parity-execution-preflight`

The boundary records whether a real Claude/Codex/Hermes parity run is blocked or explicitly
authorized. It does not run Claude Code, Codex CLI, Hermes, SWE-bench, or model sessions.

## Authorization Contract

Authorization artifacts live at:

```text
<root>/.planning/runtime-parity/authorization.json
```

They include:

- scenario id;
- all three runtime targets: `claude`, `codex`, and `hermes`;
- explicit authorization boundary string;
- blocked reason, when blocked;
- authorized by/id, cost budget, credential scope, evidence retention path, and transcript
  retention path, when authorized.

`harness runtime parity-execution-preflight` returns `executionAllowed: false` when the authorization
file is absent or blocked. Authorized artifacts can allow preflight, but the command still does not
execute the runtime parity run.

## Verification

| Check | Result |
|---|---|
| `corepack pnpm --filter @harness/core test -- runtime-parity-authorization-schema.test.ts` | PASS: 396 tests through the package runner. |
| `corepack pnpm --filter @harness/cli test` | PASS: 105 tests. |
| `corepack pnpm exec biome check ...runtime parity authorization touched files...` | PASS. |
| Built CLI authorization+preflight smoke | PASS: absent and blocked preflight returned `executionAllowed: false` and `externalSessionsLaunched: false`. |
| `corepack pnpm docs:index` | PASS. |
| `corepack pnpm lint` | PASS. |
| `corepack pnpm build` | PASS. |
| Post-tool dry-run | PASS: `post_tool` allowed with no policy violations. |
| Saturation sweep | PASS: only benign prior-cycle open-parity wording and negative-test hits remained. |

## Non-Goals

Cycle 41 did not:

- authorize runtime/model execution in this session;
- run Claude Code, Codex CLI, Hermes, SWE-bench, or model sessions;
- collect real runtime parity transcripts;
- claim real runtime parity.

```yaml
Falsifies-If:
  kill-condition: Real runtime parity execution can start or be claimed without explicit authorization.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/excellence-application/05-architecture/stream-f-runtime-parity-authorization-boundary.md
  on-fail: Reopen cycle-41 as BLOCKED_RUNTIME_PARITY_AUTHORIZATION and restore fail-closed guards.
```
