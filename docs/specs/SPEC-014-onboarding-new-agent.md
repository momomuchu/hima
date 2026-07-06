---
status: draft
date: 2026-06-30
owner: noyau
claim-bearing: true

Falsifies-If:
  kill-condition: >
    An agent onboarded following this checklist produces an adapter that hard-blocks (exit 2)
    on a gate where its capability-map row declares canBlock:false — or fails to block on a
    gate where canBlock:true — in any of the 9 canonical GateTypes. The mismatch between the
    map and the adapter's exit code is the invariant this spec claims the process upholds.
  checkpoint-date: 2026-10-01
  evidence-anchor: packages/hima-cli/src/setup.ts
  on-fail: >
    The pickAttack → adapter chain has a correctness gap that the onboarding process does not
    catch. Open a new gap entry in V3-COMPLETENESS-AUDIT.md under a new iteration slot, and
    add a cross-gate exit-code assertion to packages/hima-cli/test/e2e-adapters.test.ts
    before proceeding.

cross-refs:
  - SPEC-008-forcing-primitive.md (ForceAction union)
  - SPEC-009-capability-map-v3.md (GateCapabilityCell)
  - SPEC-010-adapter-contract.md (5-item adapter contract)
  - docs/decisions/0004-v3-architecture-build.md
  - .planning/architecture/ARCHITECTURE-v3.md §3.5, §3.7
  - .planning/architecture/V3-COMPLETENESS-AUDIT.md R-051
---

# SPEC-014 — Onboarding a New Coding Agent

## Purpose

This spec is the repeatable process contract for adding a new coding agent runtime to the hima
v3 enforcement kernel. It covers the five-step checklist, the canonical capability-map entry
template, the complexity estimate for adapter work, and how `hima setup` wires the new agent
into a project. It is the written operationalization of ARCHITECTURE-v3.md §3.7.

The core constraint that shapes the process: **Core knows nothing about adapter existence**
(ARCHITECTURE-v3.md §3.7 note). A new agent requires zero changes to
`packages/hima-core/src/forcing-primitive.ts`, `packages/schemas/`, or any behavioral
gate logic. The addition is always: map rows + adapter file + CLI route + acceptance test.

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] **Capability-map entry validated at module load.** Every new
  runtime map (`NEWAGENT_MAP`) must pass `decodeGateCapabilityCell()` on each of its 9 rows
  at module import time. A broken cell throws before any gate can fire.
  Code: `packages/hima-core/src/capability-map-v3.ts:33-35` (`cell()` helper wraps
  `decodeGateCapabilityCell(raw)` and is called at definition time for every existing runtime).
  Acceptance: `packages/hima-core/test/capability-map-v3.test.ts` — "every cell has gateType
  matching the key it was looked up by" — passes on module import.

- [CRITICAL][BLOCKS:critical] **Exhaustive ForceAction switch with TypeScript never-check.**
  The adapter `translateNewAgent(action: ForceAction)` must cover all 7 ForceAction variants
  (`hard-block`, `skill-force`, `rich-inject`, `constrained-inject`, `deferred-block`,
  `observe-only`, `noop`). The `default` branch must assign the action to `const _: never`
  so that any future variant addition causes a compile-time error.
  Code pattern: `packages/hima-core/src/adapter-codex.ts:139-143` (default never-check),
  `packages/hima-core/src/adapter-hermes.ts:122-129` (same pattern with throw).
  Schema: `packages/schemas/src/force-action.ts:48-56` (ForceAction union, 7 members).
  Acceptance: `packages/hima-core/test/adapter-codex.test.ts` — all 7 variants tested;
  `packages/hima-core/test/adapter-hermes.test.ts` — all 7 variants tested.

- [CRITICAL][BLOCKS:high] **dispatchTranslate() route added.** The new adapter must be wired
  into `packages/hima-core/src/dispatch.ts:dispatchTranslate()` as a new `case` in the
  runtime switch. Without this, the CLI always falls back to `translateClaude()` regardless of
  the `--format` flag.
  Code: `packages/hima-core/src/dispatch.ts:50-67` (switch over RuntimeTarget; claude/codex/
  hermes/opencode currently wired).
  Acceptance: `packages/hima-cli/test/e2e-adapters.test.ts` — Scenario A (codex) and
  Scenario B (hermes) both verify that the dispatched adapter's native format appears in stdout.

---

## HIGH items

- [HIGH][BLOCKS:high] **CLI --format route extended (5 lines).** The runtime resolver at
  `packages/hima-cli/src/index.ts:507-511` must be extended to include the new format name.
  Current code:
  ```typescript
  const runtime: RuntimeTarget =
    parsed.format === "codex" || parsed.format === "hermes"
      ? (parsed.format as RuntimeTarget)
      : "claude";
  ```
  Adding a new agent requires adding `|| parsed.format === "newagent"` to the condition.
  Note: `opencode` is listed in `RUNTIME_MAPS` (`capability-map-v3.ts:430-435`) and has a
  complete adapter (`adapter-opencode.ts:251 lines`) but is NOT yet in this resolver — it
  currently falls through to `"claude"`. This is a live gap (V3-COMPLETENESS-AUDIT.md R-050).

- [HIGH][BLOCKS:high] **RUNTIME_MAPS index updated.** After adding the new capability map,
  it must be included in `RUNTIME_MAPS` at
  `packages/hima-core/src/capability-map-v3.ts:430-435`. The `RuntimeTarget` union type
  (`capability-map-v3.ts:26`) must be extended with the new runtime name. TypeScript
  enforces exhaustiveness of the RUNTIME_MAPS index via `Record<RuntimeTarget, ...>`.

- [HIGH][BLOCKS:low] **`hima setup` runtime detection and wiring.** The `runSetup()` function
  at `packages/hima-cli/src/setup.ts:209-270` dispatches on detected runtime:
  - Claude: merges 7 hook events into `.claude/settings.json` via `wireClaudeHooks()`
    (`setup.ts:300-320`). The 7 events are declared in `CLAUDE_HOOK_EVENTS` (`setup.ts:40-48`).
  - Codex/Hermes: emits a "best-effort/manual; see docs/hima-setup.md" message (no automatic
    file write). Runtime detection: `.claude/` dir → "claude"; `.codex/` dir or `AGENTS.md` →
    "codex"; explicit `--runtime hermes` → "hermes" (`resolveRuntime()`, `setup.ts:280-295`).
  For a new agent with its own hook file format (e.g. `.newagent/settings.json`): add a
  detection clause in `resolveRuntime()` and a `wireNewAgentHooks()` branch in `runSetup()`.
  For agents that require manual wiring (no settings.json equivalent): the existing
  "best-effort/manual" path is the correct default — no new code needed in `setup.ts`.

- [HIGH][BLOCKS:none] **Per-GateType acceptance test for exit-code vs canBlock alignment.**
  Each new adapter must have a unit test asserting that for every GateType where
  `canBlock:true`, a `hard-block` ForceAction produces `exitCode: 2`, and where
  `canBlock:false`, no ForceAction variant produces `exitCode: 2`.
  Reference test shape: `packages/hima-core/test/adapter-codex.test.ts:26-38` (hard-block
  returns exit 2 and reason) and `packages/hima-core/test/adapter-hermes.test.ts:35-59`
  (hard-block ACP format).

---

## MEDIUM items

- [MEDIUM][BLOCKS:none] **Research step: hook API classification.**
  Before writing any code, classify each of the agent's hook events against the 9 canonical
  GateTypes (`packages/schemas/src/capability.ts:13-23`). For each hook:
  1. Can it return a blocking response (exit code, return value, or protocol message that
     prevents the agent action)?  → `canBlock: true/false`
  2. Can it inject rich context (system-reminder or equivalent full markdown)?  → `injectionMode: "rich"`
  3. Can it inject constrained context (short system message, ≤1800 bytes)?  → `injectionMode: "constrained"`
  4. Does the hook fire synchronously before the action, or is it async/deferred?
     → `level: "supported"/"degraded"/"absent"` and `enforcementStrength`
  5. Does the agent have native subagent hook support?  → `subagents` field

  If a gate type does not exist in the agent's hook API, mark it `level: "absent"` and
  identify a `compensatingMechanism` (or `"none"`).

- [MEDIUM][BLOCKS:none] **Complexity estimate: simple vs Hermes-class.**
  An adapter falls into one of two complexity classes based on how many of the 9 gate types
  require non-trivial compensating logic:

  **Simple (target ~75–150 lines):** The agent has a straightforward request/response hook
  interface. All gate types either block synchronously (`canBlock:true`) or observe-only
  (`canBlock:false`). No deferred stop verdict, no subagent intercept, no I/O inside the
  adapter function. Example: `adapter-claude.ts` (75 lines) — pure translation, no side
  effects. `adapter-codex.ts` (147 lines) — adds truncation logic for the 1800-byte cap, but
  no external I/O.

  **Hermes-class (target ~130–250 lines, plus companion modules):** The agent has:
  - A non-blocking stop hook that requires verdict deferral (file I/O: `deferred-verdict.ts`),
  - Absent subagent hooks requiring a pre_tool intercept pattern (`hermes-subagent.ts`),
  - An idiosyncratic wire format (ACP `{action:"block"|"continue"}` instead of exit code alone),
  - Replay dedup logic for repeated event delivery bugs.
  Example: `adapter-hermes.ts` (130 lines) + `hermes-subagent.ts` + `deferred-verdict.ts`.
  The adapter file itself stays ~130 lines; complexity lives in the companion modules.

  The classifier heuristic: if `stop.canBlock:false` (stop is degraded) AND `subagent_start.level:"absent"`,
  this is Hermes-class. Otherwise, simple.

- [MEDIUM][BLOCKS:none] **CompensatingMechanism must be non-"none" when level is "absent".**
  For any gate type where `level: "absent"`, the cell must declare a
  `compensatingMechanism` that is not `"none"` — or explicitly document in the cell's `note`
  field why no compensation is possible or needed. The schema allows `"none"` on absent cells
  but the spec mandates intentional documentation. See: `HERMES_MAP.subagent_start` at
  `packages/hima-core/src/capability-map-v3.ts:397-408` (level absent, compensating:
  `intercept_delegate_task_pre_tool`).

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] **`hima setup --runtime <newagent>` emits a guidance message.**
  Even if automated wiring is not implemented, `runSetup()` should at minimum emit a
  `messages.push(...)` entry (`setup.ts:230-234` pattern) listing the manual steps
  the user must take for the new runtime.

- [LOW][BLOCKS:none] **`note` field for cells with non-obvious semantics.**
  Any cell where `level: "degraded"` or where `compensatingMechanism` is non-trivial should
  carry a `note` field explaining the degradation. This field is `Schema.optional(Schema.String)`
  (`packages/schemas/src/capability.ts:65`). Example notes in existing maps:
  `capability-map-v3.ts:179` (Codex session_start), `capability-map-v3.ts:263-264` (Codex stop).

---

## §1 — The Five-Step Onboarding Checklist

These steps are the operationalization of ARCHITECTURE-v3.md §3.7. Execute in order;
no step may be skipped. The checklist applies to all runtimes.

### Step 1 — Research the hook API

Read the agent's hook API documentation and produce a classification table:

| Gate Type | Agent Hook Name | canBlock | injectionMode | Notes |
|-----------|----------------|----------|---------------|-------|
| user_prompt | `<agent event name>` | true/false | rich/constrained/none | |
| pre_tool | `<agent event name>` | true/false | rich/constrained/none | |
| post_tool | `<agent event name>` | false | rich/constrained/none | |
| stop | `<agent event name>` | true/false | ... | |
| session_start | `<agent event name>` | false | ... | |
| subagent_start | `<agent event name or absent>` | ... | ... | |
| subagent_stop | `<agent event name or absent>` | ... | ... | |
| pre_compact | `<agent event name or absent>` | false | ... | |
| post_compact | `<agent event name or absent>` | false | ... | |

Verify that `user_prompt` and `pre_tool` are both `canBlock:true`. These are the universal
blocking base (ARCHITECTURE-v3.md §7.3). If either is `canBlock:false`, the agent cannot
participate in the universal enforcement core — escalate before proceeding.

### Step 2 — Add capability-map rows

Create `NEWAGENT_MAP: Record<GateType, GateCapabilityCell>` in
`packages/hima-core/src/capability-map-v3.ts` (or in a dedicated file imported there).

Each cell follows the 8-field `GateCapabilityCell` schema
(`packages/schemas/src/capability.ts:53-66`):

```typescript
// Capability-map entry template — fill all 8 required fields + optional fields
const NEWAGENT_MAP: Record<GateType, GateCapabilityCell> = {
  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",           // "supported" | "degraded" | "absent"
    canBlock: true,               // true only if the hook can return a blocking response
    injectionMode: "rich",        // "rich" | "constrained" | "none"
    enforcementStrength: "hard",  // "hard" | "advisory" | "deferred" | "observe_only"
    skillForcing: true,           // true if skill-force blocks are meaningful here
    compensatingMechanism: "keyword_detection_user_prompt", // enum from CompensatingMechanism
    maxInjectionBytes: undefined, // omit for rich; set integer (e.g. 1800) for constrained
    universal: true,              // true only for user_prompt and pre_tool
    subagents: "native",          // "native" | "poll-file" | "absent"
    profiles: "runtime-profiles", // "runtime-profiles" | "injected-role-context" | "none"
    note: "optional — explain degraded/absent/non-obvious semantics",
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: true,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  // ... repeat for the remaining 7 GateTypes:
  // post_tool, stop, session_start, subagent_start, subagent_stop, pre_compact, post_compact
};
```

Add the new map to `RUNTIME_MAPS` and extend the `RuntimeTarget` union:

```typescript
// packages/hima-core/src/capability-map-v3.ts:26
export type RuntimeTarget = "claude" | "codex" | "hermes" | "opencode" | "newagent";

// packages/hima-core/src/capability-map-v3.ts:430-435
const RUNTIME_MAPS: Record<RuntimeTarget, Record<GateType, GateCapabilityCell>> = {
  claude: CLAUDE_MAP,
  codex: CODEX_MAP,
  hermes: HERMES_MAP,
  opencode: OPENCODE_MAP,
  newagent: NEWAGENT_MAP,  // add this line
};
```

Validation fires automatically via the `cell()` helper (`capability-map-v3.ts:33-35`).
Run `pnpm --filter @hima/core test -- capability-map-v3` to confirm the parse passes.

### Step 3 — Write the adapter (~150 lines for simple, ~200 for Hermes-class)

Create `packages/hima-core/src/adapter-newagent.ts`. The file must:

1. Import `ForceAction` from `@hima/schemas` (`packages/schemas/src/force-action.ts:48-58`).
2. Declare a `NewAgentResponse` type compatible with `DispatchResponse`
   (`packages/hima-core/src/dispatch.ts:27-32`): `{ decision, reason?, additionalContext?,
   exitCode, raw? }`.
3. Export `translateNewAgent(action: ForceAction): NewAgentResponse` with an exhaustive switch
   over all 7 `action.kind` values.
4. Include the TypeScript never-check in the `default` branch:
   ```typescript
   default: {
     const _exhaustive: never = action;
     throw new Error(`translateNewAgent: unhandled kind: ${String((_exhaustive as {kind:string}).kind)}`);
   }
   ```
5. Map `ForceAction` → native response using these rules derived from the capability-map:
   - `hard-block` / `skill-force`: if any gate in the map has `canBlock:true` → `exitCode: 2`.
     For `skill-force`, skill id must appear within the first 100 chars of any message field
     (Codex pattern: `adapter-codex.ts:67-74`; enforced by test).
   - `rich-inject`: use `additionalContext` for rich-capable agents; downgrade to the
     constrained channel (systemMessage / content) for agents that lack a system-reminder
     channel (`adapter-codex.ts:104-111`; `adapter-hermes.ts:71-81`).
   - `constrained-inject`: truncate to `maxInjectionBytes` if the agent has a cap. Use the
     same UTF-8-safe truncation pattern as `adapter-codex.ts:47-56`.
   - `deferred-block`: `exitCode: 0` (verdict written to disk by caller). The adapter itself
     does not write to disk; deferred I/O is the caller's responsibility
     (`packages/hima-core/src/deferred-verdict.ts`).
   - `observe-only` / `noop`: `exitCode: 0`, no message.

Export `translateNewAgent` from `packages/hima-core/src/index.ts`.

### Step 4 — Wire the CLI --format route (5 lines)

Edit `packages/hima-cli/src/index.ts:507-511`:

```typescript
// Before (current code):
const runtime: RuntimeTarget =
  parsed.format === "codex" || parsed.format === "hermes"
    ? (parsed.format as RuntimeTarget)
    : "claude";

// After (add newagent):
const runtime: RuntimeTarget =
  parsed.format === "codex" || parsed.format === "hermes" || parsed.format === "newagent"
    ? (parsed.format as RuntimeTarget)
    : "claude";
```

Add `translateNewAgent` to the `dispatchTranslate()` switch in
`packages/hima-core/src/dispatch.ts:50-67`:

```typescript
case "newagent":
  return translateNewAgent(action);
```

### Step 5 — Write acceptance tests per GateType

Create `packages/hima-core/test/adapter-newagent.test.ts`. The test file must cover:

**Required coverage per gate type:**

| Test | ForceAction input | Expected output | Acceptance criterion |
|------|------------------|----------------|---------------------|
| user_prompt (canBlock:true) | `hard-block` | `exitCode: 2` | Map declares canBlock; adapter must agree |
| user_prompt (canBlock:true) | `noop` | `exitCode: 0` | noop never blocks |
| pre_tool (canBlock:true) | `skill-force` | `exitCode: 2`, skillId in first 100 chars of message | Per-adapter message format |
| pre_tool (canBlock:true) | `rich-inject` | `exitCode: 0` (inject, not block) | inject never blocks |
| post_tool (canBlock:false) | `hard-block` | `exitCode: 0` (observe-only or degrade) | canBlock:false gates cannot exit 2 |
| stop (canBlock varies) | `deferred-block` | `exitCode: 0` | deferred-block is always exit 0 at adapter level |
| session_start (canBlock:false) | `constrained-inject` | `exitCode: 0` | injection returns 0 |

**Invariant test (required for all adapters):**

```typescript
describe("translateNewAgent — canBlock:false gates never produce exitCode 2", () => {
  // For each gate where the NEWAGENT_MAP declares canBlock:false,
  // verify that hard-block and skill-force both produce exitCode 0.
  // The adapter must degrade to observe-only or deferred when canBlock is false.
});
```

Reference: `packages/hima-core/test/adapter-codex.test.ts` (complete per-variant coverage),
`packages/hima-core/test/adapter-hermes.test.ts` (ACP format assertions),
`packages/hima-core/test/adapter-opencode.test.ts` (rich-capable pattern without truncation).

Add an E2E integration scenario to `packages/hima-cli/test/e2e-adapters.test.ts` that spawns
`dist/index.js hook pre-tool-use --format newagent` and verifies exit code + native format.

---

## §2 — Capability-Map Entry Template (all 9 GateTypes)

The complete template with guidance per field, sourced from
`packages/schemas/src/capability.ts:53-66` and the existing runtime maps.

```typescript
// packages/schemas/src/capability.ts:53-66 — GateCapabilityCell schema
// All fields required except maxInjectionBytes, note (Schema.optional).

const NEWAGENT_MAP: Record<GateType, GateCapabilityCell> = {
  // ── UNIVERSAL BASE (must be supported + canBlock on all runtimes) ──────────
  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",           // or "constrained" if no system-reminder
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "keyword_detection_user_prompt",
    universal: true,
    subagents: "native",             // or "poll-file" / "absent"
    profiles: "runtime-profiles",   // or "injected-role-context" / "none"
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: true,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  // ── NON-UNIVERSAL (per-agent capability varies) ───────────────────────────
  post_tool: cell({
    gateType: "post_tool",
    level: "supported",            // or "absent" if not available
    canBlock: false,               // always false — post_tool is advisory on all runtimes
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  stop: cell({
    gateType: "stop",
    level: "supported",            // "degraded" if stop cannot block (like Hermes)
    canBlock: true,                // false on Hermes (deferred enforcement)
    injectionMode: "rich",
    enforcementStrength: "hard",   // "deferred" when canBlock:false at stop
    skillForcing: false,
    compensatingMechanism: "none", // "deferred_stop_verdict" when stop is degraded
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  session_start: cell({
    gateType: "session_start",
    level: "supported",
    canBlock: false,               // session_start never blocks on any runtime
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  subagent_start: cell({
    gateType: "subagent_start",
    level: "supported",            // "absent" if agent has no subagent hook (Hermes)
    canBlock: true,                // false when absent
    injectionMode: "rich",
    enforcementStrength: "hard",   // "observe_only" when absent
    skillForcing: true,
    compensatingMechanism: "injected_role_context",
    // When absent: compensatingMechanism: "intercept_delegate_task_pre_tool"
    universal: false,
    subagents: "native",           // "absent" when no subagent hooks
    profiles: "runtime-profiles",
  }),

  subagent_stop: cell({
    gateType: "subagent_stop",
    level: "supported",            // "absent" if no subagent stop hook
    canBlock: false,               // subagent_stop is always advisory
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  pre_compact: cell({
    gateType: "pre_compact",
    level: "supported",            // "absent" if agent has no compaction hooks
    canBlock: false,               // pre_compact cannot block
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  post_compact: cell({
    gateType: "post_compact",
    level: "supported",            // "absent" if agent has no compaction hooks
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),
};
```

**Field guidance table:**

| Field | Type | Constraint | Default when absent |
|-------|------|-----------|-------------------|
| `gateType` | GateType literal | Must match the key | — (required) |
| `level` | "supported"\|"degraded"\|"absent" | Research step determines this | — |
| `canBlock` | boolean | Must match agent's actual blocking capability | false |
| `injectionMode` | "rich"\|"constrained"\|"none" | Rich = full system-reminder; constrained = short systemMessage | "none" |
| `enforcementStrength` | "hard"\|"advisory"\|"deferred"\|"observe_only" | "hard" requires canBlock:true | "observe_only" |
| `skillForcing` | boolean | false when canBlock:false | false |
| `compensatingMechanism` | CompensatingMechanism enum | Required; use "none" only with explicit justification on absent gates | "none" |
| `maxInjectionBytes` | number (optional) | Set when injectionMode="constrained" (e.g. 1800) | omit for rich |
| `universal` | boolean | Only user_prompt and pre_tool may be true | false |
| `subagents` | "native"\|"poll-file"\|"absent" | Determined by agent's subagent hook support | "absent" |
| `profiles` | "runtime-profiles"\|"injected-role-context"\|"none" | Determined by profile injection capability | "none" |
| `note` | string (optional) | Required when level="degraded" or compensatingMechanism is non-trivial | omit |

Schema source: `packages/schemas/src/capability.ts:13-72`.
Enum values: `CompensatingMechanism` at `capability.ts:36-43`.

---

## §3 — Complexity Estimate

### Simple adapter (~75–150 lines)

**Criteria:** Agent has a synchronous request/response hook interface. All blocking gates
respond with a simple exit code or return value. No deferred verdict I/O. No subagent
intercept compensation. No idiosyncratic wire format beyond the return value.

**Worked example: adapter-claude.ts (75 lines)**
`packages/hima-core/src/adapter-claude.ts` — Claude Code's hook response is a simple JSON
object on stdout (`{decision, reason?, additionalContext?}`) + process exit code. All 7
ForceAction variants translate in ≤2 lines each. No truncation logic, no external I/O, no
companion modules.

**Worked example: adapter-codex.ts (147 lines)**
`packages/hima-core/src/adapter-codex.ts` — Codex adds one complexity: `maxInjectionBytes:1800`
for the `systemMessage` channel, requiring UTF-8-safe truncation (`truncateToBytes()`,
`adapter-codex.ts:47-56`). The `skill-force` variant must place the skill id within the first
100 chars of the systemMessage (for Codex host extraction). Still a simple adapter — all logic
is inside the translate function, no external state.

**Hermes-class adapter (~130–250 lines + companion modules)**

**Criteria:** Any one of: (a) stop hook is non-blocking (degraded) requiring verdict deferral;
(b) subagent hook is absent requiring pre_tool intercept; (c) wire format requires a distinct
response envelope (e.g. ACP `{action:"block"|"continue"}`); (d) event replay dedup needed.

**Worked example: adapter-hermes.ts + companions**
`packages/hima-core/src/adapter-hermes.ts` (130 lines) introduces:
- `HermesRawPayload` type: the Hermes-native `{action:"block"|"continue", message?|content?}` format
- `truncateUtf8()` helper using `TextEncoder`/`TextDecoder` (adapter-hermes.ts:33-41)
- `raw: HermesRawPayload` field on `HermesResponse` so callers and tests can inspect the native payload
- Rich-inject downgrade (Hermes has no system-reminder): content is truncated to 1800 bytes
  and emitted as `raw.content` (adapter-hermes.ts:71-81)

Companion modules required by Hermes (none required for simple adapters):
- `packages/hima-core/src/deferred-verdict.ts` — `writeDeferredVerdict()` /
  `readAndConsumeDeferredVerdict()` for the degraded stop gate
- `packages/hima-core/src/hermes-subagent.ts` — `injectRulesIntoDelegateTask()` and dedup
  registry for the absent subagent_start gate

**Classification heuristic (from V3-COMPLETENESS-AUDIT.md R-011):**

```
stop.canBlock === false
  AND subagent_start.level === "absent"
  → Hermes-class

stop.canBlock === true
  OR subagent_start.level === "supported"
  → Simple (with possible constrained-injection complexity)
```

---

## §4 — How `hima setup` Wires the New Agent

The `runSetup()` function (`packages/hima-cli/src/setup.ts:209-270`) is the project
onboarding entry point. Its behavior per runtime:

**Claude (fully automated):**
`wireClaudeHooks()` (`setup.ts:300-320`) reads `.claude/settings.json`, calls
`mergeClaudeHooks()` (`setup.ts:85-125`) to idempotently inject 7 hook commands, and writes
back with `safeAtomicWriteFile`. The 7 events are declared in `CLAUDE_HOOK_EVENTS`
(`setup.ts:40-48`): `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PreCompact`, `PostCompact`, `SubagentStart`. Each event produces a hook command of the form:
`hima hook <kebab-event> --format claude`.

**Codex and Hermes (manual wiring, guidance only):**
`runSetup()` emits a message string:
`"runtime ${runtime}: hook wiring is best-effort/manual; see docs/hima-setup.md"`.
No settings file is written. The user must manually configure their runtime's hook bindings
to invoke `hima hook <event> --format <runtime>` for each supported event.

**New agents without a settings.json format:**
Use the existing "best-effort/manual" path — no changes to `setup.ts` are required. Add a
section to `docs/hima-setup.md` explaining the manual hook configuration steps for the agent.

**New agents with a settings.json-equivalent:**
1. Add a detection clause in `resolveRuntime()` (`setup.ts:280-295`) to recognize the agent's
   directory marker (e.g. `.newagent/` dir present → "newagent").
2. Add a `wireNewAgentHooks()` function mirroring `wireClaudeHooks()` (`setup.ts:300-320`).
3. Add a branch in `runSetup()` to call it.
4. Add corresponding entries to `CLAUDE_HOOK_EVENTS` equivalent (or a separate event map for
   the new agent's PascalCase vs kebab-case event naming).

`hima setup` also creates the scaffold regardless of runtime
(`scaffold()`, `setup.ts:326-355`): `.hima/state/` directory, `.hima/config.json` (`{}`),
`.hima/current-risk.json` (`{"risk_class":"T"}`). This scaffold is runtime-agnostic.

Acceptance: `packages/hima-cli/test/setup.test.ts` — §2 (runtime detection), §3 (hook wiring),
§4 (scaffold), §6 (idempotency) all pass for the claude runtime. Tests for new runtimes
follow the same structure.

---

## §5 — Acceptance Evidence (existing tests)

These tests constitute the binding acceptance evidence for the onboarding process. They are not
new tests — they are the tests already present in the codebase that a new adapter must also
satisfy:

| Claim | Test file | Test description |
|-------|-----------|-----------------|
| Capability-map cells parse at import | `packages/hima-core/test/capability-map-v3.test.ts` | "every cell has gateType matching the key it was looked up by" |
| user_prompt + pre_tool universal on all runtimes | `capability-map-v3.test.ts` | "user_prompt is universal:true and canBlock:true on all runtimes" |
| All 7 ForceAction variants covered (codex) | `packages/hima-core/test/adapter-codex.test.ts` | 9 describe blocks covering hard-block, skill-force, rich-inject, constrained-inject, deferred-block, observe-only, noop, truncation boundary |
| Skill-id in first 100 chars of Codex systemMessage | `adapter-codex.test.ts:45-78` | "skillId within first 100 chars" |
| All 7 ForceAction variants covered (hermes) | `packages/hima-core/test/adapter-hermes.test.ts` | 13 scenarios covering ACP format + truncation |
| Hermes raw.action="block" on hard-block | `adapter-hermes.test.ts:44-48` | "emits raw ACP block with message=reason" |
| All 7 ForceAction variants covered (opencode) | `packages/hima-core/test/adapter-opencode.test.ts` | all variants + OPENCODE_MAP cells carry pending-verification note |
| E2E codex skill-force exit 2 | `packages/hima-cli/test/e2e-adapters.test.ts:87-120` | Scenario A |
| E2E hermes skill-force ACP block | `packages/hima-cli/test/e2e-adapters.test.ts:127-175` | Scenario B |
| Deferred-block roundtrip (hermes) | `e2e-adapters.test.ts` | Scenario C |
| Setup: runtime detection | `packages/hima-cli/test/setup.test.ts` §2 | .claude dir → claude, AGENTS.md → codex |
| Setup: hook wiring idempotent | `setup.test.ts` §6 | re-run produces same output |
| Setup: scaffold creates .hima/state | `setup.test.ts` §4 | config.json + current-risk.json created |
