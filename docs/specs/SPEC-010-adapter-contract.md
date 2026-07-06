---
claim-bearing: true
status: draft
date: 2026-06-30
owner: hima-core
r-gap: R-015
source: packages/hima-core/src/dispatch.ts,
        packages/hima-core/src/forcing-primitive.ts,
        packages/hima-core/src/adapter-claude.ts,
        packages/hima-core/src/adapter-codex.ts,
        packages/hima-core/src/adapter-hermes.ts,
        packages/hima-core/src/adapter-opencode.ts,
        packages/schemas/src/force-action.ts,
        packages/schemas/src/gate.ts,
        packages/schemas/src/capability.ts
cross-refs: SPEC-011-skill-force-gate.md, SPEC-007-adapter-hermes.md
---

# SPEC-010 — Adapter Contract: GateEvent → pickAttack → ForceAction → native response

This spec documents the complete multi-runtime adapter pipeline implemented in
`packages/hima-core/src/` as of v3. The canonical pipeline is:

```
GateVerdict + GateCapabilityCell
       ↓  pickAttack()
   ForceAction
       ↓  dispatchTranslate(runtime, action)
  DispatchResponse  (runtime-native hook payload)
```

Every requirement below references the real source file and line range.

---

## CRITICAL items

### ForceAction union — 7 kinds, exhaustive

- [CRITICAL][BLOCKS:critical] `ForceAction` is a discriminated union of exactly 7 kinds.
  The `kind` field is the discriminant. Every adapter switch must handle all 7 or the
  TypeScript `never`-check in the `default` branch must catch the gap at compile time.
  Source: `packages/schemas/src/force-action.ts:48-56`.

  | kind                 | fields (beyond `kind`)                                        |
  |----------------------|---------------------------------------------------------------|
  | `hard-block`         | `reason: string`                                              |
  | `skill-force`        | `skillId: string`, `reason: string`                           |
  | `rich-inject`        | `content: string`                                             |
  | `constrained-inject` | `systemMessage: string`                                       |
  | `deferred-block`     | `verdictFile: string`, `reason: string`, `resolveOn: string[]`|
  | `observe-only`       | `log: string`                                                 |
  | `noop`               | (no additional fields)                                        |

- [CRITICAL][BLOCKS:critical] `decodeForceAction` (Effect `Schema.decodeUnknownSync`) is
  the only schema-valid entry point for parsing external ForceAction payloads. Direct
  construction from an unknown object without decoding is forbidden.
  Source: `packages/schemas/src/force-action.ts:61`.
  Test evidence: `packages/schemas/test/force-action.test.ts`.

### pickAttack — 6-rung ladder producing ForceAction

- [CRITICAL][BLOCKS:critical] `pickAttack(runtime, gateType, verdict, skillRegister, cell)`
  is a **pure synchronous** function. It reads no filesystem state; all file I/O happens
  before (register) or after (deferred verdict file write) the call.
  Signature: `packages/hima-core/src/forcing-primitive.ts:61-67`.

  The 6-rung ladder in priority order (highest to lowest):
  1. `noop` — no forceIntent AND verdict is not block.
  2. `rich-inject` — ContextInject on a `rich`-mode cell.
  3. `constrained-inject` — ContextInject on a `constrained`-mode cell; `maxInjectionBytes`
     applied when set via `truncateToBytes`.
  4. `skill-force` — SkillGate intent AND skill NOT in register AND `cell.canBlock = true`.
  5. `deferred-block` — SkillGate on a `deferred`-enforcement cell OR explicit DeferredBlock
     intent. `verdictFile` is always `.hima/state/pending-stop-verdict.json`.
  6. `hard-block` — block verdict AND `cell.canBlock = true`.

  Fallback when none applies: `observe-only` (logs; exercises no enforcement).
  Source: `packages/hima-core/src/forcing-primitive.ts:61-189`.

- [CRITICAL][BLOCKS:high] When a SkillGate intent references a skill already in the
  `skillRegister`, `pickAttack` returns `{ kind: "noop" }` unconditionally — the gate never
  re-forces a skill the session has already invoked.
  Source: `packages/hima-core/src/forcing-primitive.ts:96-98`.

### dispatchTranslate — exhaustive runtime router

- [CRITICAL][BLOCKS:critical] `dispatchTranslate(runtime: RuntimeTarget, action: ForceAction): DispatchResponse`
  at `packages/hima-core/src/dispatch.ts:46-68` uses an exhaustive `switch` over
  `RuntimeTarget = "claude" | "codex" | "hermes" | "opencode"`. TypeScript will error at
  compile time if a branch is missing — there is no default branch because the union is
  sealed.

- [CRITICAL][BLOCKS:critical] `DispatchResponse` is the superset type that every adapter
  result satisfies:
  ```ts
  type DispatchResponse = ClaudeResponse & {
    systemMessage?: string;  // Codex stdout injection channel (≤1800 bytes)
    raw?: unknown;           // Hermes ACP object
  }
  ```
  Source: `packages/hima-core/src/dispatch.ts:27-32`.

---

## HIGH items

### ClaudeResponse / translateClaude — the reference adapter

- [HIGH][BLOCKS:high] `ClaudeResponse` shape (the base for all DispatchResponse values):
  ```ts
  type ClaudeResponse = {
    decision: "block" | "continue";
    reason?: string;
    additionalContext?: string;
    exitCode: 0 | 2;
  }
  ```
  Source: `packages/hima-core/src/adapter-claude.ts:16-21`.

- [HIGH][BLOCKS:high] `translateClaude` exhaustive mapping over all 7 ForceAction kinds:

  | ForceAction kind     | decision     | additionalContext        | exitCode |
  |----------------------|--------------|-------------------------|----------|
  | `hard-block`         | `"block"`    | —                       | `2`      |
  | `skill-force`        | `"block"`    | —                       | `2`      |
  | `rich-inject`        | `"continue"` | `action.content`        | `0`      |
  | `constrained-inject` | `"continue"` | `action.systemMessage`  | `0`      |
  | `deferred-block`     | `"continue"` | —                       | `0`      |
  | `observe-only`       | `"continue"` | —                       | `0`      |
  | `noop`               | `"continue"` | —                       | `0`      |

  Source: `packages/hima-core/src/adapter-claude.ts:26-75`.
  Test evidence: `packages/hima-core/test/e2e-skill-force.test.ts`.

### Codex adapter — constrained channel, 1800-byte cap

- [HIGH][BLOCKS:high] `translateCodex` imposes a hard 1800-byte UTF-8 cap on all
  `systemMessage` injections via `truncateToBytes(s, 1800)`. Truncation walks back past
  continuation bytes (0x80–0xBF) to avoid splitting multi-byte characters.
  Constant: `packages/hima-core/src/adapter-codex.ts:19` (`MAX_SYSTEM_MSG_BYTES = 1800`).
  Truncation: `packages/hima-core/src/adapter-codex.ts:47-56`.

- [HIGH][BLOCKS:high] `skill-force` on Codex: the `systemMessage` MUST begin with
  `[skill:<skillId>]` so the Codex host can extract the skill id from the truncated prefix
  without reading the full payload. The skill id MUST appear within the first 100 characters.
  Format function `buildBlockSystemMessage(reason, skillId)`:
  `packages/hima-core/src/adapter-codex.ts:66-74`.

- [HIGH][BLOCKS:high] `rich-inject` is DOWNGRADED to `constrained-inject` on Codex (no rich
  system-reminder channel). `action.content` is emitted as a truncated `systemMessage`.
  Source: `packages/hima-core/src/adapter-codex.ts:104-111`.

- [HIGH][BLOCKS:high] `translateCodex` mapping (with TypeScript `never`-check in default):

  | ForceAction kind     | decision     | systemMessage                              | exitCode |
  |----------------------|--------------|--------------------------------------------|----------|
  | `hard-block`         | `"block"`    | `buildBlockSystemMessage(reason)`          | `2`      |
  | `skill-force`        | `"block"`    | `[skill:<id>] <reason>` (≤100-char prefix) | `2`      |
  | `rich-inject`        | `"continue"` | `truncate(content, 1800)`                  | `0`      |
  | `constrained-inject` | `"continue"` | `truncate(systemMessage, 1800)`            | `0`      |
  | `deferred-block`     | `"continue"` | —                                          | `0`      |
  | `observe-only`       | `"continue"` | —                                          | `0`      |
  | `noop`               | `"continue"` | —                                          | `0`      |

  Source: `packages/hima-core/src/adapter-codex.ts:86-147`.
  Test evidence: `packages/hima-core/test/adapter-codex.test.ts`.

### Hermes adapter — ACP format, mandatory `raw` field

- [HIGH][BLOCKS:high] `HermesRawPayload` is the Hermes wire format emitted in `raw`:
  ```ts
  type HermesRawPayload =
    | { action: "block"; message: string }
    | { action: "continue"; content?: string }
  ```
  Source: `packages/hima-core/src/adapter-hermes.ts:25-27`.

- [HIGH][BLOCKS:high] `HermesResponse` extends `ClaudeResponse` with a mandatory `raw: HermesRawPayload`.
  Every branch of `translateHermes` populates `raw` — it is never absent.
  Source: `packages/hima-core/src/adapter-hermes.ts:31`.

- [HIGH][BLOCKS:high] Hermes injection cap is also 1800 bytes (UTF-8), applied via
  `truncateUtf8(text, 1800)` using `TextEncoder`/`TextDecoder`. Unlike the Codex
  implementation (Buffer-based), Hermes uses `TextDecoder` with `fatal=false` to drop
  incomplete trailing multi-byte sequences.
  Source: `packages/hima-core/src/adapter-hermes.ts:33-41`.

- [HIGH][BLOCKS:high] `translateHermes` mapping (with TypeScript `never`-check in default):

  | ForceAction kind     | decision     | raw.action    | raw field detail                         | additionalContext                 | exitCode |
  |----------------------|--------------|---------------|------------------------------------------|----------------------------------|----------|
  | `hard-block`         | `"block"`    | `"block"`     | `message: action.reason`                 | —                                | `2`      |
  | `skill-force`        | `"block"`    | `"block"`     | `message: action.reason`                 | —                                | `2`      |
  | `rich-inject`        | `"continue"` | `"continue"`  | `content: truncate(content, 1800)` (DOWNGRADED) | `action.content` (full)   | `0`      |
  | `constrained-inject` | `"continue"` | `"continue"`  | `content: truncate(systemMessage, 1800)` | `action.systemMessage` (full)    | `0`      |
  | `deferred-block`     | `"continue"` | `"continue"`  | no content field                         | —                                | `0`      |
  | `observe-only`       | `"continue"` | `"continue"`  | no content field                         | —                                | `0`      |
  | `noop`               | `"continue"` | `"continue"`  | no content field                         | —                                | `0`      |

  Note: `rich-inject` is DOWNGRADED — no rich system-reminder on Hermes. `additionalContext`
  carries the full untruncated content for diagnostics; the ACP wire payload is capped.
  Source: `packages/hima-core/src/adapter-hermes.ts:48-130`.
  Test evidence: `packages/hima-core/test/adapter-hermes.test.ts`.

### OpenCode adapter — rich-capable, semantics pending

- [HIGH][BLOCKS:low] `translateOpenCode` is functionally identical to `translateClaude`:
  both runtimes are rich-capable; `rich-inject` and `constrained-inject` map to
  `additionalContext` without truncation or downgrade.
  Source: `packages/hima-core/src/adapter-opencode.ts:50-108`.

- [HIGH][BLOCKS:low] All cells in `OPENCODE_MAP` carry
  `note: "semantics pending web verification"`. The adapter is built on extrapolation from
  the Claude Code hook spec; it MUST be verified against the official OpenCode hook spec
  before R-050 closes.
  Source: `packages/hima-core/src/adapter-opencode.ts:123` (`const PENDING = ...`).
  Test evidence: `packages/hima-core/test/adapter-opencode.test.ts`.

---

## MEDIUM items

### runGate — full gate cycle orchestrator

- [MEDIUM][BLOCKS:high] `runGate(input: RunGateInput): Promise<RunGateResult>` wires the
  full cycle in 5 sequential steps:
  1. Read skill register from disk (`readRegister(root)`).
  2. Look up capability cell (`getCell(runtime, gateType)`).
  3. Compute force action (`pickAttack(runtime, gateType, verdict, register, cell)`).
  4. Translate for active runtime (`dispatchTranslate(runtime, forceAction)`).
  5. Build canary: `"[HIMA] <gateType> — forced:<skillId|hard-block|none>"`.

  Result type: `{ forceAction: ForceAction; claude: DispatchResponse; canary: string }`.
  Source: `packages/hima-core/src/run-gate.ts:23-72`.
  Test evidence: `packages/hima-core/test/e2e-skill-force.test.ts`.

### Worked examples per runtime

**Example A — Claude, SkillGate verdict, empty register:**

```
runtime="claude", gateType="pre_tool"
verdict = { decision:"block", forceIntent:{ kind:"SkillGate", skillId:"corpus-spec-driven-development", blocksUntilInvoked:true } }
skillRegister = []
cell = CLAUDE_MAP["pre_tool"] (canBlock:true, injectionMode:"rich")

pickAttack → { kind:"skill-force", skillId:"corpus-spec-driven-development", reason:"skill corpus-spec-driven-development is required and not yet invoked" }
translateClaude → { decision:"block", reason:"...", exitCode:2 }
```

**Example B — Codex, rich-inject downgraded:**

```
runtime="codex"
action = { kind:"rich-inject", content:"Inject this guidance (3000 chars)..." }

translateCodex → { decision:"continue", systemMessage:"Inject this guid..."[truncated to ≤1800 bytes], exitCode:0 }
```

**Example C — Hermes, hard-block at pre_tool:**

```
runtime="hermes"
action = { kind:"hard-block", reason:"forbidden tool detected" }

translateHermes → { decision:"block", reason:"forbidden tool detected", raw:{ action:"block", message:"forbidden tool detected" }, exitCode:2 }
```

**Example D — Hermes, stop gate (deferred enforcement):**

```
HERMES_MAP["stop"]: canBlock=false, enforcementStrength="deferred"

pickAttack: plainBlock(cell, "gate verdict: block with no forceIntent")
  → canBlock=false, enforcementStrength="deferred"
  → { kind:"deferred-block", verdictFile:".hima/state/pending-stop-verdict.json", reason:"...", resolveOn:["pre_tool","user_prompt"] }

translateHermes → { decision:"continue", raw:{ action:"continue" }, exitCode:0 }
```

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] `GateCapabilityCell.maxInjectionBytes` is optional (`number | undefined`).
  When set, `resolveContextInject` in `forcing-primitive.ts` applies `truncateToBytes` before
  building a `constrained-inject` action.
  Source: `packages/hima-core/src/forcing-primitive.ts:178-183`.

- [LOW][BLOCKS:none] `observe-only` is the safest fallback — it fires when
  `cell.injectionMode === "none"` on a ContextInject intent, and when block + canBlock=false +
  not deferred on a plain block.

- [LOW][BLOCKS:none] All adapter `default` branches carry a TypeScript `never`-check that
  throws at runtime with a descriptive message including the unhandled `kind`. This prevents
  silent misconfiguration when a new ForceAction kind is added.
  Sources: `packages/hima-core/src/adapter-codex.ts:139-144`,
           `packages/hima-core/src/adapter-hermes.ts:122-128`,
           `packages/hima-core/src/adapter-opencode.ts:100-106`.

---

Falsifies-If:
  kill-condition: translateClaude returns decision:"continue" (exitCode:0) for a hard-block
    or skill-force action (should be decision:"block", exitCode:2).
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/dispatch.ts
  on-fail: Regression in the Claude enforcement chain. Inspect adapter-claude.ts hard-block
    and skill-force branches; run packages/hima-core/test/e2e-skill-force.test.ts.

Falsifies-If:
  kill-condition: translateCodex emits a skill-force systemMessage where the skill id does not
    appear within the first 100 characters of the string.
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/dispatch.ts
  on-fail: Fix buildBlockSystemMessage in adapter-codex.ts to prepend [skill:<id>] before reason;
    verify adapter-codex.test.ts scenario for skill-force systemMessage prefix.

Falsifies-If:
  kill-condition: translateHermes returns raw.action != "block" for a hard-block or skill-force
    action, or raw.action != "continue" for noop/observe-only.
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/dispatch.ts
  on-fail: Hermes ACP wire format broken. Inspect adapter-hermes.ts translateHermes(); run
    packages/hima-core/test/adapter-hermes.test.ts.

Falsifies-If:
  kill-condition: A new ForceAction kind is added to packages/schemas/src/force-action.ts but
    one or more adapter switches does not handle it and the TypeScript never-check is bypassed
    (e.g. build skipped before merge).
  checkpoint-date: ongoing
  evidence-anchor: packages/hima-core/src/dispatch.ts
  on-fail: Run tsc --noEmit; the default branch must produce a TS2345 error. Add the missing
    branch to all four adapters before merging.
