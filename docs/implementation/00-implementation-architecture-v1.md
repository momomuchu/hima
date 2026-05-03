# HIMA Implementation Architecture v1

Status: implementation proposal
Date: 2026-05-03

This document turns the PFV4 conception specs into a clean TypeScript implementation plan. It does not replace the canonical runtime contract; it defines how the first codebase should be structured.

Authoritative inputs:

- `docs/conception/00-canonical-runtime-contract.md`
- `docs/conception/01-state-machine-spec.md`
- `docs/conception/02-risk-classifier-spec.md`
- `docs/conception/03-rms-sets-schema.md`
- `docs/conception/04-runtime-bindings-spec.md`
- `docs/conception/05-gates-policy-spec.md`
- `docs/conception/09-cli-commands-spec.md`
- `docs/conception/10-core-api-spec.md`
- `docs/conception/open-questions/*.md`

## 1. Technical Decision

Use TypeScript, not Python, for the harness implementation.

Reasons:

- The specs already define TypeScript APIs and types.
- The state machine decision is XState v5.
- The CLI and MCP server must ship as an npm package.
- Cross-platform support is first-class: Node.js >= 20, Windows native, macOS, Linux.

Python remains useful only for incidental repo scripts if needed later, not for the runtime core.

## 2. Dependency Baseline

The MVP stack follows the closed open questions:

| Concern | Choice |
| --- | --- |
| Runtime | Node.js >= 20 |
| Package manager | pnpm workspaces |
| Build | tsup |
| State machine | XState v5 |
| CLI | citty |
| Validation | zod |
| Tests | Vitest |
| Property tests | fast-check |
| Lint/format | Biome |
| Runtime logs | pino |
| YAML | yaml |
| MCP server | stdio transport, one local server |

XState usage should follow v5 patterns: `setup(...)` for typed machine sources and `createActor(...)` for execution. Actor persistence can be used as an optimization, but the authoritative PFV4 state remains the three canonical `.planning/` files.

## 3. Monorepo Shape

```text
hima/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  biome.json
  vitest.config.ts
  packages/
    core/
      src/
      test/
    cli/
      src/
      test/
    mcp-server/
      src/
      test/
    adapter-claude/
      src/
      test/
    adapter-codex/
      src/
      test/
    adapter-hermes/
      src/
      test/
    artifacts/
      skills/
      subagents/
      books/
```

MVP implementation order should create only the packages needed for the first vertical slice:

1. `@harness/core`
2. `@harness/cli`
3. `@harness/mcp-server`

Runtime adapters can start as interfaces and fixtures inside `core`, then split into packages once `harness hook` and `harness install` need real platform config writes.

## 4. Clean Architecture Boundary

```text
CLI / MCP / Runtime Adapters
        |
        v
Application Services
        |
        v
Domain Core
        |
        v
Ports
        |
        v
Filesystem / Platform / stdio
```

Rules:

- `@harness/core` never imports `cli`, MCP, or platform adapters.
- `state-machine`, `risk-classifier`, and `gates` are pure where possible.
- Filesystem access is behind storage ports.
- CLI commands are thin: parse input, call core service, print result, map error to exit code.
- MCP tools are thin: parse request, call the same core services as CLI, return structured JSON.
- Runtime adapters normalize native events into `GateEvent`; they do not own policy.

## 4.1 Source of Truth and DRY Rules

Every executable vocabulary must have one source of truth:

| Vocabulary/policy | Source file | Consumers |
| --- | --- | --- |
| Macro cycles, subphases, risk classes, modes, gate types | `packages/core/src/types/canonical.ts` | zod schemas, CLI validation, tests, state machine |
| Baseline risk policy and required gates | `packages/core/src/policy/baseline-policy.ts` | defaults, gate evaluation, status/doctor, tests |
| Physical `.planning/` file paths | `packages/core/src/storage/planning-paths.ts` | storage, CLI, future MCP server |
| Runtime file schemas | `packages/core/src/schemas/*.schema.ts` | storage validation, tests, fixtures |

Rules:

- Do not duplicate enum arrays in schemas, CLI code, or tests.
- Do not hard-code risk ordering outside `RISK_CLASS_RANK`.
- Do not hard-code required gate lists outside the baseline policy.
- Do not create another physical storage map outside `planning-paths.ts`.
- Tests may assert the canonical values, but production code must import them.

This is not just cleanliness. It is what lets the harness evolve without drifting into multiple competing contracts.

## 5. Core Package Layout

```text
packages/core/src/
  index.ts
  types/
    canonical.ts
    events.ts
    errors.ts
  schemas/
    state.schema.ts
    current-risk.schema.ts
    run-set.schema.ts
    gate-event.schema.ts
  storage/
    planning-paths.ts
    planning-store.ts
    atomic-write.ts
    json.ts
    yaml.ts
  state-machine/
    machine.ts
    transition.ts
    guards.ts
    subphases.ts
  risk-classifier/
    classify-risk.ts
    forcing-signals.ts
    risk-rank.ts
  gates/
    evaluate-gate.ts
    pre-tool.ts
    post-tool.ts
    stop.ts
    user-prompt.ts
    subagent.ts
  runtime/
    adapter.ts
    normalize-event.ts
    capabilities.ts
  evidence/
    evidence-policy.ts
    evidence-store.ts
  services/
    init-project.ts
    get-status.ts
    request-transition.ts
    handle-hook.ts
  testing/
    fixtures.ts
```

The public API should export stable contracts from `types/` and services from `services/`. Internal modules can change without being part of the public contract.

## 6. XState Boundary

XState should be an implementation detail of `state-machine/`, not a dependency leaked everywhere.

Public API:

```ts
transition(snapshot, event, policyContext): TransitionResult
createInitialSnapshot(input): MachineSnapshot
canTransition(snapshot, target): boolean
```

Internal API:

```ts
const harnessMachine = setup({
  types: { context, events },
  guards,
  actions,
}).createMachine(...)
```

Persistence rule:

- Authoritative state is `.planning/state.yaml`, `.planning/current-risk.yaml`, `.planning/run-set.json`.
- XState persisted snapshots may be stored in `run-set.json#/internal/xstateSnapshot` later if needed.
- If a stored XState snapshot conflicts with canonical files, canonical files win.

This keeps the runtime recoverable even if the XState representation changes in a future major version.

## 7. Canonical Storage Implementation

Only three physical files are runtime-authoritative:

```text
.planning/state.yaml
.planning/current-risk.yaml
.planning/run-set.json
```

Storage services:

```ts
readPlanningState(root): Promise<PlanningState>
writePlanningState(root, state): Promise<void>
readCurrentRisk(root): Promise<CurrentRisk>
writeCurrentRisk(root, risk): Promise<void>
readRunSet(root): Promise<RunSet>
writeRunSet(root, runSet): Promise<void>
appendRunEvent(root, event): Promise<void>
```

`appendRunEvent` mutates `run-set.json#/events` in MVP. It is logically append-only even though the physical JSON file is rewritten atomically.

Filesystem rules:

- Write to temp file in the same directory.
- Flush and rename.
- Validate with zod after read and before write.
- Normalize stored paths to forward slashes.
- Hooks fail open on unreadable or missing `.planning/` only when no trustworthy risk/mode can be loaded.
- If state loads and policy says a gate is mandatory for `M/H/C`, missing runtime capability fails closed.

## 8. Gate Evaluation Flow

```text
native runtime payload
  -> adapter normalize
  -> GateEvent
  -> read three canonical files
  -> evaluateGate()
  -> GateResult
  -> persist event/evidence/state mutation
  -> adapter output
```

`evaluateGate()` is pure:

```ts
evaluateGate(context: RunContext, event: GateEvent): GateResult
```

`handleHook()` owns I/O:

```ts
handleHook(root, gateType, stdinPayload): Promise<HookResponse>
```

Blocking semantics:

- `pre_tool` can block the current tool call.
- `post_tool` cannot undo the completed tool call, but can block future continuation or finalization.
- `stop` blocks completion claims when evidence, convergence, risk, or checkpoint policy is not satisfied.
- `subagent_start` blocks unsafe delegation.
- `subagent_stop` blocks parent acceptance/finalization if subagent evidence is invalid.

## 9. CLI Surface for First Slice

MVP commands:

```text
harness init
harness status [--json]
harness hook <GateType> [--dry-run]
harness transition <MacroCycle> [--sub-phase <SubPhase>]
harness doctor [--json]
```

Defer:

- `install`
- `mcp add/test`
- `audit`
- `metrics`
- `template`
- `migrate`

Reason: the first useful implementation is a local executable kernel with deterministic gates, not a full platform installer.

## 10. MCP Server Boundary

One MCP server:

```text
harness mcp-server
```

MVP tools:

```text
harness:get_state
harness:get_risk_class
harness:evaluate_gate
harness:record_evidence
harness:log_event
```

The MCP server calls the same `@harness/core` services as the CLI. It must not contain a parallel policy engine.

## 11. First Vertical Slice

The first implementation should prove the harness end to end with no platform adapter complexity.

Scenario:

1. `harness init` creates the three canonical files.
2. `harness status --json` reads and validates them.
3. `harness hook pre_tool --dry-run < fixtures/pre-tool-write-src.json` returns `warn` for `T/L` risk and `block` for `M/H/C` risk in `discovery/Observer`.
4. `harness transition build --sub-phase Execute` moves state after guards pass.
5. The same pre-tool fixture now returns `allow`.
6. `harness hook stop --dry-run` blocks when required `M/H/C` evidence is missing.

This slice validates the architecture before installing any real hooks.

## 12. Test Strategy

Unit tests:

- canonical enum guards and risk ranking;
- zod schema round trips for the three files;
- deterministic `classifyRisk()`;
- pure `evaluateGate()` decisions;
- pure state transitions.

Property tests:

- risk monotonicity: adding forcing signals never lowers class;
- gate idempotence: same state + same event returns same decision;
- finalization safety: no `DONE_VERIFIED` without required evidence.

Integration tests:

- temp project root;
- `init -> status -> hook -> transition -> hook -> stop`;
- corrupt YAML/JSON behavior;
- Windows-style path normalization.

Snapshot tests:

- `harness status --json`;
- `harness hook <GateType> --dry-run` JSON outputs.

## 13. Non-Negotiable Clean Code Rules

- No circular imports.
- No platform-specific code in `@harness/core`.
- No direct filesystem calls outside `storage/` and package-specific adapter/install modules.
- No untyped `any` in public APIs.
- No string comparisons for risk ordering; use `RISK_CLASS_RANK`.
- No ad hoc parsing of YAML/JSON; all reads go through schema validation.
- No runtime policy hidden in CLI or MCP layers.
- No extra physical `.planning/` runtime files in MVP.
- No new operating modes.
- No gate aliases in internal policy.

## 14. Implementation Waves

### Wave 0 — Scaffold

Create pnpm workspace, base configs, package boundaries, build/test/lint scripts.

### Wave 1 — Canonical Types and Schemas

Implement shared types, zod schemas, fixtures, storage path helpers, and atomic write helpers.

### Wave 2 — State Machine Core

Implement XState v5 machine behind a pure transition facade. Cover all eight macro cycles and seven subphases.

### Wave 3 — Risk Classifier

Implement deterministic risk ranking, forcing signals, promotions/demotions, and risk policy helpers.

### Wave 4 — Gate Engine

Implement pure gate evaluation for `user_prompt`, `pre_tool`, `post_tool`, `stop`, `subagent_start`, and `subagent_stop`.

### Wave 5 — CLI First Slice

Implement `init`, `status`, `hook`, `transition`, `doctor`.

### Wave 6 — MCP First Slice

Implement stdio MCP server with minimal state/gate/evidence tools.

### Wave 7 — Runtime Adapters

Implement platform adapters in priority order. Start with fixtures and one real adapter, then add the others after the first adapter proves the boundary.

## 15. Recommended Immediate Next Step

Start with Wave 0 and Wave 1 only.

The first PR should not implement all gates or all adapters. It should establish the workspace and make this command sequence pass:

```text
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then Wave 1 should make schema round-trip tests pass for the three canonical files.
