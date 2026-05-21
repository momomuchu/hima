---
claim-bearing: true
status: COMPLETE
cycle: cycle-78-runtime-evidence-authorization-prep
created: 2026-05-14
---

# Runtime Evidence Authorization Preparation

## Result

Cycle 78 prepared the authorization and evidence runbook for future real Claude, Codex, Hermes,
benchmark, and parity execution.

This artifact does not authorize or execute anything. The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Existing Fail-Closed Controls

The repo already has two local authorization controls that must be used before future runtime or
benchmark execution claims:

| Control | Schema / command | Current local preflight |
|---|---|---|
| Real runtime parity | `RuntimeParityAuthorizationSchema`; `harness runtime parity-authorization write/validate`; `harness runtime parity-execution-preflight` | Absent artifact returns `executionAllowed: false`, reason `real runtime parity authorization artifact is absent`, and `externalSessionsLaunched: false`. |
| SWE-bench Verified | `BenchmarkAuthorizationSchema`; `harness benchmark authorization write/validate`; `harness benchmark execution-preflight` | Absent artifact returns `executionAllowed: false`, reason `benchmark execution authorization artifact is absent`, and `externalSessionsLaunched: false`. |

Authorized artifacts for both controls require:

- `authorizedBy`
- `authorizationId`
- positive `costBudgetUsd`
- `credentialScope`
- `evidenceRetentionPath`
- `transcriptRetentionPath`

Runtime parity authorization also requires all three runtime targets: `claude`, `codex`, and
`hermes`.

## Authorization Packet

Before any real runtime/model session can run, the operator must record an authorization packet with:

| Field | Required content |
|---|---|
| Scope | Exact lane: adapter E2E, 5-scenario runtime suite, runtime parity, SWE-bench, HARV live invocation, or external SIEM. |
| Targets | Runtime targets and versions: Claude Code, Codex CLI, Hermes, or benchmark target. |
| Authorized by | Human/account granting permission, date/time, and authorization id. |
| Budget | Maximum dollars or explicit zero-cost statement; model/session cap; stop-on-cost threshold. |
| Credentials | Credential scope and account/project boundaries; no secrets stored in the artifact. |
| Retention | Evidence retention path and transcript retention path. |
| Data policy | What prompts, logs, diffs, ledgers, and command outputs may be stored or redacted. |
| Workspace | Disposable project path, cleanup policy, and confirmation that the main repo is not the runtime workspace. |
| Stop conditions | Missing binary, missing credentials, unsupported hooks, transcript capture failure, unexpected external write, budget breach, or target unavailability. |
| Verdict format | PASS, FAIL, or BLOCKED with explicit reason and linked transcript bundle. |

## Runtime Session Runbook

The shared prerequisite sequence is:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm smoke:runtime-session
```

Then copy `fixtures/runtime-session/small-feature/` to a clean temporary workspace and run the
target install command inside that copy:

```powershell
node packages/cli/dist/index.js install <target> --root <fixture-copy> --apply --json
```

Do not launch the runtime binary until the authorization packet exists and the target-specific stop
conditions below are clear.

### Claude

Required before launch:

- Claude Code binary/version recorded;
- account/credential scope recorded;
- install JSON preserved from `<fixture-copy>/.claude/`;
- 9 planned HIMA hooks recorded;
- transcript capture path verified.

Stop if Claude Code is unavailable, credentials are absent, config writes outside the copied
fixture, hooks are ignored, or transcript capture cannot be guaranteed.

### Codex

Required before launch:

- Codex CLI binary/version recorded;
- account/credential scope recorded;
- install JSON preserved from `<fixture-copy>/.codex/`;
- 7 planned hooks recorded;
- `subagent_start` and `subagent_stop` remain unsupported rather than silently upgraded;
- transcript capture path verified.

Stop if Codex CLI is unavailable, credentials are absent, unsupported subagent hooks are claimed as
blocking controls, hook output is not Codex-compatible JSON, or transcript capture cannot be
guaranteed.

### Hermes

Required before launch:

- Hermes version or commit recorded;
- access mode and availability confirmed;
- install JSON preserved from `<fixture-copy>/.hermes/`;
- 8 planned hooks recorded;
- `subagent_start` remains unsupported and non-blocking hooks remain marked degraded;
- transcript capture path verified.

Stop if Hermes is unavailable, access is unclear, hook config differs from the runtime profile,
non-blocking hooks are claimed as blocking controls, or transcript capture cannot be guaranteed.

## Command Templates

Blocked runtime parity authorization:

```powershell
node packages/cli/dist/index.js runtime parity-authorization write --status blocked --blockReason "<reason>" --json
node packages/cli/dist/index.js runtime parity-execution-preflight --json
```

Authorized runtime parity authorization, only after explicit permission:

```powershell
node packages/cli/dist/index.js runtime parity-authorization write --status authorized --scenarioId small-feature --targets claude,codex,hermes --authorizedBy "<person>" --authorizationId "<id>" --costBudgetUsd <amount> --credentialScope "<scope>" --evidenceRetentionPath ".planning/runtime-parity/evidence/" --transcriptRetentionPath ".planning/runtime-parity/transcripts/" --json
node packages/cli/dist/index.js runtime parity-authorization validate .planning/runtime-parity/authorization.json --json
node packages/cli/dist/index.js runtime parity-execution-preflight --json
```

Blocked SWE-bench authorization:

```powershell
node packages/cli/dist/index.js benchmark authorization write --status blocked --blockReason "<reason>" --json
node packages/cli/dist/index.js benchmark execution-preflight --json
```

Authorized SWE-bench authorization, only after explicit permission:

```powershell
node packages/cli/dist/index.js benchmark authorization write --status authorized --instances 10 --targets codex --authorizedBy "<person>" --authorizationId "<id>" --costBudgetUsd <amount> --credentialScope "<scope>" --evidenceRetentionPath ".planning/benchmarks/evidence/" --transcriptRetentionPath ".planning/benchmarks/transcripts/" --json
node packages/cli/dist/index.js benchmark authorization validate .planning/benchmarks/swe-bench-verified/authorization.json --json
node packages/cli/dist/index.js benchmark execution-preflight --json
```

## Evidence Bundle Requirements

Every future real execution must preserve:

| Evidence | Required for |
|---|---|
| Authorization packet | All real runtime/model/benchmark executions. |
| Runtime version and credential scope | Adapter E2E, runtime suite, runtime parity. |
| Install JSON | Adapter E2E, runtime suite, runtime parity, H3 if run on OS matrix. |
| Transcript or command log | Adapter E2E, runtime suite, runtime parity, benchmark. |
| Before/after tests | Adapter E2E, runtime suite, benchmark tasks. |
| HIMA event/ledger excerpts | Adapter E2E, runtime suite, runtime parity, compliance pack. |
| Cost/accounting record | Any model-backed or benchmark run. |
| Redaction note | Any transcript containing prompts, paths, or credentials. |
| Verdict | PASS, FAIL, or BLOCKED with linked evidence path. |

## Non-Goals Preserved

Cycle 78 did not:

- authorize runtime/model sessions;
- launch Claude, Codex, Hermes, SWE-bench, or any model-backed runtime;
- run H3 Linux/macOS/Windows install tests;
- write to real `~/.hima`;
- contact beta users;
- publish to npm or make a public release;
- wire Stripe, launch a sale page, or claim revenue;
- claim legal certification, market validation, benchmark completion, runtime adapter proof, or external SIEM integration.

## Verification

| Check | Result |
|---|---|
| Runtime parity preflight | PASS: absent authorization returns `executionAllowed: false` and `externalSessionsLaunched: false`. |
| Benchmark preflight | PASS: absent authorization returns `executionAllowed: false` and `externalSessionsLaunched: false`. |
| Required authorization fields | PASS: fields match `RuntimeParityAuthorizationSchema` and `BenchmarkAuthorizationSchema`. |
| Runtime target runbook | PASS: Claude, Codex, and Hermes prerequisites and stop conditions are explicit. |

```yaml
Falsifies-If:
  kill-condition: This artifact is used as proof that runtime/model sessions, benchmarks, H3 OS installs, beta evidence, publication, payment, legal certification, or external SIEM integration actually happened.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/runtime-evidence-authorization-prep.md
  on-fail: Reopen cycle-78 as BLOCKED_RUNTIME_AUTH_OVERCLAIM and restore the external-evidence blockers.
```
