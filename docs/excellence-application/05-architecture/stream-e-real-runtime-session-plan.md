# Stream E - Real-Runtime Session Plan

Status: ACCEPTED  
Cycle: 29  
Date: 2026-05-14

## 1. Decision

Real-runtime evidence must be collected from copied fixture workspaces, not from the main HIMA
repository and not from package-level install tests alone.

Cycle 29 adds the reusable session fixture and a local smoke command that proves the fixture can be
copied, tested, installed into, and hook-dry-run checked for all three first-party runtime targets.
It does not execute Claude Code, Codex CLI, or Hermes model sessions.

## 2. Fixture

Reusable fixture root:

- `fixtures/runtime-session/small-feature/`

The fixture is a tiny Node ESM project with:

- `TASK.md` - the prompt for the runtime agent;
- `src/calculator.mjs` - baseline code;
- `test/calculator.test.mjs` - baseline tests using `node:test`;
- `evidence-template.md` - the transcript/evidence capture shape for real sessions.

The common task is to add `clamp(value, min, max)` with tests. It is intentionally small enough for
a `T` or `L` risk classification and safe enough to run in a copied temp workspace.

## 3. Local Smoke Surface

Local reproducible command:

```bash
corepack pnpm smoke:runtime-session
```

The command runs `scripts/runtime-session-smoke.mjs`, which:

1. copies the fixture into a temp workspace per runtime target;
2. runs the baseline fixture tests with `node --test`;
3. runs `harness install <runtime> --json` dry-run;
4. runs `harness install <runtime> --apply --json` against the temp workspace;
5. runs a `post-tool-use` hook dry-run through the built CLI;
6. reports planned, unsupported, and degraded hook counts for Claude, Codex, and Hermes.

This smoke proves fixture portability and install/hook command shape. It does not prove real model
behavior, prompt following, transcript quality, or production readiness.

## 4. Runtime Session Protocol

### 4.1 Shared Prerequisites

Before a real runtime session:

- build the repo with `corepack pnpm build`;
- run `corepack pnpm smoke:runtime-session`;
- copy `fixtures/runtime-session/small-feature/` into a fresh temp directory;
- install the target adapter with `node <repo>/packages/cli/dist/index.js install <runtime>
  --root <fixture-copy> --apply --json`;
- capture the JSON install output and preserve unsupported/degraded hook metadata;
- record the runtime binary version or exact runtime build identifier;
- record whether credentials, subscription, beta access, or API budget were used.

Stop before launching the runtime if any prerequisite is missing or if the user has not explicitly
authorized external runtime/model spend.

### 4.2 Claude Code

Command shape:

```bash
node packages/cli/dist/index.js install claude --root <fixture-copy> --apply --json
claude
```

Expected evidence:

- Claude Code version;
- applied config path under `<fixture-copy>/.claude/`;
- 9 planned HIMA hooks;
- transcript showing the `TASK.md` prompt;
- before/after `npm test` or `node --test test/calculator.test.mjs`;
- HIMA event or ledger output for session start, user prompt, pre-tool, post-tool, stop, and
  subagent events if subagents were used.

Stop conditions:

- Claude Code is unavailable or credentials are missing;
- config write targets a path outside the copied fixture;
- the runtime disables or ignores registered hooks;
- transcript cannot be captured.

### 4.3 Codex CLI

Command shape:

```bash
node packages/cli/dist/index.js install codex --root <fixture-copy> --apply --json
codex
```

Expected evidence:

- Codex CLI version;
- applied config path under `<fixture-copy>/.codex/`;
- 7 planned hooks;
- `subagent_start` and `subagent_stop` recorded as unsupported, not silently treated as blocking;
- transcript showing the `TASK.md` prompt;
- before/after fixture tests;
- HIMA event or ledger output for supported hooks.

Stop conditions:

- Codex CLI is unavailable or credentials are missing;
- subagent hook support is claimed despite the adapter profile marking it unsupported;
- hook output format is not Codex-compatible JSON;
- transcript cannot be captured.

### 4.4 Hermes

Command shape:

```bash
node packages/cli/dist/index.js install hermes --root <fixture-copy> --apply --json
hermes
```

Expected evidence:

- Hermes version or commit;
- applied config path under `<fixture-copy>/.hermes/`;
- 8 planned hooks;
- `subagent_start` recorded as unsupported;
- non-blocking Hermes hooks recorded as degraded where applicable;
- transcript showing the `TASK.md` prompt;
- before/after fixture tests;
- HIMA event or ledger output for supported hooks.

Stop conditions:

- Hermes runtime is unavailable or access is unclear;
- Hermes plugin/hook config format differs from the adapter profile;
- non-blocking hooks are claimed as blocking controls;
- transcript cannot be captured.

## 5. Evidence Format

Each runtime session must leave an evidence bundle with:

- copied fixture path;
- runtime version and access mode;
- install JSON output;
- transcript or command log;
- changed files diff;
- before/after test output;
- HIMA event/ledger excerpts;
- verdict: PASS, FAIL, or BLOCKED with reason.

Use `fixtures/runtime-session/small-feature/evidence-template.md` as the minimum capture shape.

## 6. Non-Goals

This cycle does not:

- run paid or credentialed external model sessions;
- claim adapter production readiness;
- claim Stream F benchmark readiness;
- run SWE-bench Verified;
- generate compliance packs;
- prove five-client compatibility.

## 7. Cycle 29 Evidence

Local evidence collected before close:

- `corepack pnpm smoke:runtime-session` PASS.
- Claude smoke result: 9 hooks planned, no unsupported hooks, degraded observable hooks explicit.
- Codex smoke result: 7 hooks planned, `subagent_start` and `subagent_stop` unsupported.
- Hermes smoke result: 8 hooks planned, `subagent_start` unsupported and non-blocking hooks degraded.

Full close evidence is recorded in `docs/goals/archive/cycle-29-DONE-2026-05-14.md`.

```yaml
Falsifies-If:
  kill-condition: This plan is used as evidence that real Claude/Codex/Hermes sessions already ran; credentials or model spend are assumed instead of explicitly authorized; fixture workspaces can write outside their temp root; unsupported or degraded hooks are presented as production-ready blocking controls; or Stream F benchmark readiness is claimed before benchmark runs.
  checkpoint-date: 2026-05-28
  evidence-anchor: fixtures/runtime-session/small-feature/TASK.md
  on-fail: Reopen cycle-29 as BLOCKED_REAL_RUNTIME_SESSION_PLANNING and restore an honest runtime evidence protocol before external sessions run.
```

