---
claim-bearing: true
id: SPEC-008
title: Forcing Primitive — ForceAction, GateVerdict, GateCapabilityCell, pickAttack()
status: active
date: 2026-06-30
owner: hima-core
sources:
  - packages/schemas/src/force-action.ts
  - packages/schemas/src/gate.ts
  - packages/schemas/src/capability.ts
  - packages/hima-core/src/forcing-primitive.ts
tests:
  - packages/schemas/test/force-action.test.ts
  - packages/schemas/test/gate.test.ts
  - packages/hima-core/test/forcing-primitive.test.ts
cross-refs:
  - SPEC-009-capability-map-v3.md
  - .planning/architecture/ARCHITECTURE-v3.md §3.2
  - .planning/architecture/ARCHITECTURE-FLOW-v3.md §3
---

# SPEC-008 — Forcing Primitive

Falsifies-If:
  kill-condition: pickAttack() returns hard-block on a cell where canBlock=false, OR SkillGate on a skill already in the register returns non-noop, OR constrained-inject systemMessage byte-length exceeds maxInjectionBytes on a constrained cell.
  checkpoint-date: 2026-09-30
  evidence-anchor: packages/hima-core/src/forcing-primitive.ts
  on-fail: Open gap R-013-regression in V3-COMPLETENESS-AUDIT.md and block I8 iteration start.

---

## Purpose

The forcing primitive translates a `GateVerdict` + `GateCapabilityCell` into the strongest
`ForceAction` the active runtime gate can execute. It is the single decision point between
the gate engine and the runtime adapters. Every adapter reads a `ForceAction` and never
inspects the verdict directly.

The primitive is **pure and synchronous**. It has no filesystem access and no side effects.
File writes (e.g. `.hima/state/pending-stop-verdict.json`) are the caller's responsibility.

---

## CRITICAL items

### ForceAction — 7-variant discriminated union

[CRITICAL][BLOCKS:critical] `ForceAction` is the typed output of `pickAttack()`.
It is an Effect Schema discriminated union with 7 variants
(`packages/schemas/src/force-action.ts` lines 48–56):

| Variant | kind literal | Required fields | Meaning |
|---------|-------------|-----------------|---------|
| `HardBlock` | `"hard-block"` | `reason: string` | Exit 2 / synchronous block on runtimes where `canBlock=true` |
| `SkillForce` | `"skill-force"` | `skillId: string`, `reason: string` | Block until the named skill is invoked in this session |
| `RichInject` | `"rich-inject"` | `content: string` | Inject full context via system-prompt (rich-mode cells only) |
| `ConstrainedInject` | `"constrained-inject"` | `systemMessage: string` | Inject truncated context via user/system message (constrained-mode cells) |
| `DeferredBlock` | `"deferred-block"` | `verdictFile: string`, `reason: string`, `resolveOn: string[]` | Write verdict to disk; block at next blocking gate |
| `ObserveOnly` | `"observe-only"` | `log: string` | Log only; no runtime effect |
| `Noop` | `"noop"` | — | No action taken |

Decoded with `decodeForceAction` (throwing) or `decodeForceActionEither` (non-throwing).
Test evidence: `packages/schemas/test/force-action.test.ts` — valid decode of each variant,
rejection of unknown kind, rejection of missing `skillId`.

[CRITICAL][BLOCKS:critical] The union is exhaustive. No `ForceAction` value may carry a
`kind` not listed above. `decodeForceActionEither` returns `Either.Left<ParseError>` on any
unknown kind.

---

### GateVerdict and forceIntent — gate engine output contract

[CRITICAL][BLOCKS:critical] `GateVerdict` is the gate engine's output before translation
to a `ForceAction`. Schema: `packages/schemas/src/gate.ts` lines 74–80.

```
GateVerdict = {
  decision:    "allow" | "warn" | "block"
  reason:      string
  forceIntent: ForceIntent?       // absent means no forcing action beyond the decision
}
```

`decision` is mandatory. `forceIntent` is optional; when absent and `decision !== "block"`,
`pickAttack()` returns `{ kind: "noop" }`.

[CRITICAL][BLOCKS:critical] `ForceIntent` is a 3-variant discriminated union
(`packages/schemas/src/gate.ts` lines 45–68):

| Variant | kind literal | Fields |
|---------|-------------|--------|
| `SkillGateIntent` | `"SkillGate"` | `skillId: string`, `blocksUntilInvoked: boolean` |
| `ContextInjectIntent` | `"ContextInject"` | `content: string` |
| `DeferredBlockIntent` | `"DeferredBlock"` | `reason: string`, `resolveOn: string[]` |

Test evidence: `packages/schemas/test/gate.test.ts` — all 3 variants decoded, rejection of
`HardBlock` kind (not a valid ForceIntent kind), rejection of `SkillGate` missing
`blocksUntilInvoked`, rejection of `ContextInject` missing `content`.

---

### GateCapabilityCell — 8-field runtime capability descriptor

[CRITICAL][BLOCKS:critical] `GateCapabilityCell` describes one gate × runtime slot.
Schema: `packages/schemas/src/capability.ts` lines 53–66. The 8 primary semantic fields:

| Field | Type | Meaning |
|-------|------|---------|
| `gateType` | `GateType` | One of 9 gate positions (session_start … subagent_stop) |
| `level` | `"supported" \| "degraded" \| "absent"` | Native hook availability on this runtime |
| `canBlock` | `boolean` | Whether this gate can return exit 2 / hard-block synchronously |
| `injectionMode` | `"rich" \| "constrained" \| "none"` | Context injection capacity |
| `enforcementStrength` | `"hard" \| "advisory" \| "deferred" \| "observe_only"` | How strongly verdicts are enforced |
| `skillForcing` | `boolean` | Whether skill-force actions are supported at this gate |
| `compensatingMechanism` | `CompensatingMechanism` | Fallback mechanism when native support is absent |
| `universal` | `boolean` | Whether this gate fires on every agent turn (cross-runtime guarantee) |

Additional schema fields (not part of the 8-field core):
- `maxInjectionBytes?: number` — byte cap for constrained cells
- `subagents: SubagentSupport` — `"native" | "poll-file" | "absent"`
- `profiles: ProfileSupport` — `"runtime-profiles" | "injected-role-context" | "none"`
- `note?: string` — human-readable annotation

`CompensatingMechanism` enum values (`packages/schemas/src/capability.ts` lines 36–43):
`"intercept_delegate_task_pre_tool"`, `"deferred_stop_verdict"`, `"poll_subagent_file"`,
`"injected_role_context"`, `"keyword_detection_user_prompt"`, `"none"`.

Cells are validated at definition time via `decodeGateCapabilityCell` (throws on schema
violation). A malformed cell fails at module load, not at first use.

---

### pickAttack() — the 6-rung ladder

[CRITICAL][BLOCKS:critical] Signature (`packages/hima-core/src/forcing-primitive.ts`
lines 61–67):

```typescript
export function pickAttack(
  _runtime: RuntimeTarget,                // "claude" | "codex" | "hermes" | "opencode"
  _gateType: GateType,                    // informational; routing uses cell fields
  verdict: GateVerdict,
  skillRegister: SkillRef[],              // already-invoked skills in this session
  cell: GateCapabilityCell,
): ForceAction
```

The function is pure and synchronous. `_runtime` and `_gateType` are informational;
all routing decisions use `verdict` and `cell`.

**6-rung ladder** (evaluated in order; first matching rung wins):

| Rung | Condition | Output |
|------|-----------|--------|
| 1. noop | No `forceIntent` AND `decision !== "block"` | `{ kind: "noop" }` |
| 2. rich-inject | `forceIntent.kind === "ContextInject"` AND `cell.injectionMode === "rich"` | `{ kind: "rich-inject", content }` |
| 3. constrained-inject | `forceIntent.kind === "ContextInject"` AND `cell.injectionMode === "constrained"` | `{ kind: "constrained-inject", systemMessage }` (truncated to `maxInjectionBytes` if set) |
| 4. skill-force | `forceIntent.kind === "SkillGate"` AND skill NOT in register AND `cell.canBlock === true` | `{ kind: "skill-force", skillId, reason }` |
| 5. deferred-block | `cell.canBlock === false` AND `cell.enforcementStrength === "deferred"` | `{ kind: "deferred-block", verdictFile: ".hima/state/pending-stop-verdict.json", resolveOn }` |
| 6. hard-block | `decision === "block"` AND `cell.canBlock === true` AND no `forceIntent` | `{ kind: "hard-block", reason }` |

When `cell.injectionMode === "none"`, all inject attempts fall to `{ kind: "observe-only", log: "…" }`.

Source: `packages/hima-core/src/forcing-primitive.ts` lines 70–145 (Branches A–E),
`plainBlock()` lines 152–168, `resolveContextInject()` lines 170–189.

---

## HIGH items

[HIGH][BLOCKS:high] **Skill idempotency invariant**: if `forceIntent.kind === "SkillGate"`
and `skillId` is already in `skillRegister` (matched via `ref.id === skillId`), `pickAttack()`
returns `{ kind: "noop" }` regardless of `canBlock` or `decision`.
Source: `forcing-primitive.ts` lines 96–98.
Test: `packages/hima-core/test/forcing-primitive.test.ts` Scenario 2 — noop when skill in
register even when cell canBlock is true; non-noop when a different skill is registered.

[HIGH][BLOCKS:high] **Byte truncation contract**: when `cell.injectionMode === "constrained"`
and `cell.maxInjectionBytes` is set, the `systemMessage` in `constrained-inject` is
guaranteed to encode to `≤ maxInjectionBytes` UTF-8 bytes. Truncation uses `TextEncoder` /
`TextDecoder` with `fatal: false` to avoid splitting multi-byte characters.
Source: `forcing-primitive.ts` lines 39–46 (`truncateToBytes`), lines 178–184.
Test: Scenario 4 — short content unchanged; content of 3000 bytes truncated to ≤1800;
exactly 1800 bytes unchanged; unicode `€` × 700 (2100 UTF-8 bytes) truncated to ≤1800.

[HIGH][BLOCKS:high] **canBlock=false invariant**: `pickAttack()` never returns `hard-block`
when `cell.canBlock === false`. When `canBlock` is false and a block is needed:
- `enforcementStrength === "deferred"` → `{ kind: "deferred-block", … }`
- otherwise → `{ kind: "observe-only", log: "[observe] …" }`
Source: `forcing-primitive.ts` `plainBlock()` lines 152–168.
Test: Scenario 3 — hermes stop cell (canBlock=false, deferred) returns deferred-block, not hard-block.

[HIGH][BLOCKS:low] **DeferredBlock verdict file**: all `deferred-block` actions produced by
`pickAttack()` use `verdictFile: ".hima/state/pending-stop-verdict.json"`. When the
`forceIntent` is `DeferredBlock`, its `resolveOn` list is copied verbatim. When
`plainBlock()` generates the deferred path, it uses `resolveOn: ["pre_tool", "user_prompt"]`.
Source: `forcing-primitive.ts` lines 114–118 (SkillGate deferred path), 129–134 (DeferredBlock intent), 162–167 (plainBlock deferred path).
Test: Scenario 10 — DeferredBlock intent carries through `reason` and `resolveOn`; Scenario 3 — verdictFile and resolveOn present.

---

## MEDIUM items

[MEDIUM][BLOCKS:none] **SkillGate on non-blocking, non-deferred cell**: when `canBlock=false`
and `enforcementStrength !== "deferred"`, a SkillGate intent falls through to a context inject
via `resolveContextInject`. The skill requirement is communicated as advisory context rather
than a hard block.
Source: `forcing-primitive.ts` lines 119–123.
Test: Scenario 9 — advisory cell (canBlock=false, advisory, constrained) returns constrained-inject.

[MEDIUM][BLOCKS:none] **Exhaustiveness safety net** (Branch E, `forcing-primitive.ts` lines
141–145): if `decision === "block"` is reached after all intent branches, `plainBlock(cell, …)`
is called. This guards against future `ForceIntent` variants being added without updating
`pickAttack()`. TypeScript never-checking is separate and enforced at compile time by the
adapter layer.

[MEDIUM][BLOCKS:none] Schema decoders exported from `@hima/schemas`: `decodeForceAction`,
`decodeForceActionEither`, `decodeForceIntent`, `decodeForceIntentEither`, `decodeGateVerdict`,
`decodeGateVerdictEither`, `decodeGateCapabilityCell`, `decodeGateCapabilityCellEither`.
These are the only sanctioned entry points for runtime deserialization of forcing-primitive
types.

---

## LOW items (convergence tail)

[LOW][BLOCKS:none] `RuntimeTarget` in `forcing-primitive.ts` (line 26) is a local inline
literal `"claude" | "codex" | "hermes" | "opencode"` to avoid sibling circular imports.
The canonical `RuntimeTarget` in `capability-map-v3.ts` must remain identical.

[LOW][BLOCKS:none] `GateType` is defined in both `packages/schemas/src/gate.ts` (lines 14–25)
and `packages/schemas/src/capability.ts` (lines 13–23) with identical members. This
intentional isolation decouples the gate-event contract from the capability-cell contract.

---

## Acceptance Evidence

Tests passing via `pnpm test` from the repo root:

| Test file | Scenarios covered |
|-----------|-------------------|
| `packages/schemas/test/force-action.test.ts` | Valid decode for each variant; rejection of unknown kind and missing fields |
| `packages/schemas/test/gate.test.ts` | All 3 ForceIntent variants; all GateVerdict shapes; rejection of invalid nested intents and missing fields |
| `packages/hima-core/test/forcing-primitive.test.ts` | 10 scenarios covering all 6 rungs, skill idempotency, byte truncation (ASCII + unicode), deferred path, observe-only fallback, DeferredBlock intent pass-through |
