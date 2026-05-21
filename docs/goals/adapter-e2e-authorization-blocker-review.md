---
claim-bearing: true
status: COMPLETE
cycle: cycle-80-adapter-e2e-authorization-blocker-review
created: 2026-05-14
---

# Adapter E2E Authorization Blocker Review

## Result

Cycle 80 reviewed the Claude, Codex, and Hermes adapter E2E blockers without launching any runtime
or model-backed session.

The adapter E2E rows remain OPEN. The construction ledger remains:

| Done | Total | Percent |
|---:|---:|---:|
| 119 | 155 | 76.8% |

## Current Adapter Test Surface

The current adapter packages have package-local unit/integration tests only:

| Target | Current test files | Missing row |
|---|---|---|
| Claude Code | `packages/adapter-claude/test/index.test.ts` | `packages/adapter-claude/test/e2e.test.ts` |
| Codex CLI | `packages/adapter-codex/test/index.test.ts` | `packages/adapter-codex/test/e2e.test.ts` |
| Hermes | `packages/adapter-hermes/test/index.test.ts` | `packages/adapter-hermes/test/e2e.test.ts` |

Those existing `index.test.ts` files cover package-local install planning/apply/remove behavior,
hook binding alignment, prompt boundaries, idempotency, preservation of user config, and
hardlink/symlink refusal. They do not prove a live runtime session accepted the installed hooks or
produced HIMA ledger/evidence outputs.

## Target Blockers

| Target | Existing local evidence | Runtime blocker | Required closing evidence |
|---|---|---|---|
| Claude Code | Adapter system prompt, hook bindings, install module, package tests, local smoke fixture, blocked preflight, and Cycle 78 authorization runbook. Prior smoke evidence recorded Claude Code `2.1.141` present. | Explicit runtime/model authorization is absent. Launching a Claude Code session may consume credentials/cost and is outside this cycle. | Passing `packages/adapter-claude/test/e2e.test.ts`; authorization packet; Claude Code version/account scope; copied small-feature fixture; install JSON; transcript; before/after tests; HIMA events/ledger excerpts; verdict. |
| Codex CLI | Adapter system prompt, hook bindings, install module, package tests, local smoke fixture, blocked preflight, and Cycle 78 authorization runbook. Prior smoke evidence recorded Codex CLI `0.130.0` present. | Explicit runtime/model authorization is absent. `subagent_start` and `subagent_stop` must remain unsupported rather than being claimed as blocking controls. | Passing `packages/adapter-codex/test/e2e.test.ts`; authorization packet; Codex version/account scope; copied small-feature fixture; install JSON; transcript; before/after tests; HIMA events/ledger excerpts; verdict that unsupported subagent hooks stayed unsupported. |
| Hermes | Adapter system prompt, hook bindings, install module, package tests, local smoke fixture, blocked preflight, and Cycle 78 authorization runbook. Prior smoke evidence recorded Hermes absent from PATH. | Hermes runtime availability is absent and explicit runtime/model authorization is absent. Degraded/nonblocking hooks must not be claimed as blocking controls. | Passing `packages/adapter-hermes/test/e2e.test.ts`; authorization packet; Hermes version/access mode; copied small-feature fixture; install JSON; transcript; before/after tests; HIMA events/ledger excerpts; verdict that unsupported/degraded hooks stayed truthfully represented. |

## Execution Prerequisites

Before any future adapter E2E run, the operator must have:

| Prerequisite | Required content |
|---|---|
| Authorization packet | Scope names adapter E2E, target runtimes, authorized person/account, authorization id, cost budget or zero-cost statement, credential scope, evidence retention path, transcript retention path, data policy, disposable workspace, and stop conditions. |
| Runtime availability | Target binary/version is recorded before launch; Hermes must be installed or explicitly blocked. |
| Disposable workspace | `fixtures/runtime-session/small-feature/` copied to a clean path; the main repo is not the runtime workspace. |
| Build and smoke preflight | `corepack pnpm install --frozen-lockfile`, `corepack pnpm build`, and `corepack pnpm smoke:runtime-session` pass before launch. |
| Install evidence | `node packages/cli/dist/index.js install <target> --root <fixture-copy> --apply --json` output retained. |
| Transcript capture | Prompt, command log, runtime transcript, before/after tests, and redaction note retained under the authorized transcript path. |
| HIMA evidence | Hook payload excerpts, accepted evidence, gate verdicts, and hash-chained ledger excerpts retained. |
| Stop conditions | Stop on missing authorization, missing credentials, target unavailable, unexpected write outside fixture copy, transcript failure, budget breach, hook mismatch, or unsupported/degraded hooks being upgraded in claims. |

## Non-Goals Preserved

Cycle 80 did not:

- create adapter `e2e.test.ts` files;
- launch Claude Code, Codex CLI, Hermes, or any model-backed session;
- authorize runtime/model spend or credentials;
- write to real `~/.hima`;
- run H3 CI or create OS install transcripts;
- run SWE-bench, runtime parity, beta, publication, payment, legal, market, or SIEM lanes;
- close any adapter E2E row.

## Verification

| Check | Result |
|---|---|
| Adapter test inventory | PASS: each adapter package currently has `test/index.test.ts`; no `test/e2e.test.ts` exists. |
| Prior runtime smoke review | PASS: Claude and Codex binaries were previously recorded present, Hermes absent, and all real sessions blocked by authorization. |
| Authorization prerequisite review | PASS: Cycle 78 fields and target stop conditions cover future adapter E2E execution. |
| No execution overclaim | PASS: this artifact keeps the adapter E2E rows open and does not claim runtime proof. |

```yaml
Falsifies-If:
  kill-condition: This blocker review is used as proof that Claude, Codex, or Hermes adapter E2E sessions actually ran.
  checkpoint-date: 2026-05-28
  evidence-anchor: docs/goals/adapter-e2e-authorization-blocker-review.md
  on-fail: Reopen cycle-80 as BLOCKED_ADAPTER_E2E_PROXY_COMPLETION and restore the adapter E2E blockers.
```
