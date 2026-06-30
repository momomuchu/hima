---
claim-bearing: true
id: SPEC-009
title: Capability Map v3 — Runtime × Gate Matrix (claude / codex / hermes / opencode)
status: active
date: 2026-06-30
owner: hima-core
sources:
  - packages/hima-core/src/capability-map-v3.ts
  - packages/hima-core/src/adapter-opencode.ts
  - packages/schemas/src/capability.ts
tests:
  - packages/hima-core/test/capability-map-v3.test.ts
cross-refs:
  - SPEC-008-forcing-primitive.md
  - .planning/architecture/ARCHITECTURE-v3.md §3.2
  - .planning/architecture/AMENDMENT-001.md
  - .planning/architecture/AMENDMENT-002.md
  - .planning/architecture/AMENDMENT-003.md
---

# SPEC-009 — Capability Map v3

Falsifies-If:
  kill-condition: user_prompt or pre_tool has universal:false or canBlock:false on any runtime, OR any cell fails decodeGateCapabilityCell at module load, OR hermes/stop returns enforcementStrength !== "deferred" or canBlock !== false, OR getCell() returns undefined for any valid (runtime, gateType) pair.
  checkpoint-date: 2026-09-30
  evidence-anchor: packages/hima-core/src/capability-map-v3.ts
  on-fail: Restore failing cell to the values specified in this document and re-run pnpm test; if the architecture has changed, update this spec first via accepted decision record.

---

## Purpose

The capability map is the **source of truth** for what each runtime can do at each gate.
`pickAttack()` (SPEC-008) consults a `GateCapabilityCell` — it never hardcodes per-runtime
logic. The map enforces the PFV4 principle that runtime differences are data, not branches.

The map is loaded at module import time. Every cell is validated by `decodeGateCapabilityCell`
(Effect Schema, throws on violation) so a misconfigured cell fails fast rather than silently
producing wrong ForceActions at runtime.

**drift_policy: strict** — the map is the binding contract between the architecture docs and
the running code. Changes to cell values must be preceded by an accepted decision record or an
architecture amendment. Silent drift is a correctness failure.

---

## CRITICAL items

### Public API

[CRITICAL][BLOCKS:critical] `getCell(runtime, gateType)` is the sole public accessor.
Signature (`packages/hima-core/src/capability-map-v3.ts` lines 447–459):

```typescript
export function getCell(
  runtime: RuntimeTarget,   // "claude" | "codex" | "hermes" | "opencode"
  gateType: GateType,       // one of 9 literals
): GateCapabilityCell
```

Throws `Error` if the (runtime, gateType) pair is absent. Type-safe callers cannot reach
this throw because both parameters are fully typed literals. Named map exports
`CLAUDE_MAP`, `CODEX_MAP`, `HERMES_MAP`, `OPENCODE_MAP` are also exported for callers
that need direct access without going through `getCell`.

[CRITICAL][BLOCKS:critical] **Schema validation at load time**: all cells in all four maps
are created via the internal `cell()` helper which calls `decodeGateCapabilityCell(raw)` and
returns the validated, frozen value. A cell with any invalid field causes the module to throw
at import time.
Test: `packages/hima-core/test/capability-map-v3.test.ts` — "all 27 cells pass
decodeGateCapabilityCell (validated at import via cell())" — count asserts 27 (3 runtimes × 9
gate types; opencode is not in the 27 count, it lives in `adapter-opencode.ts`).

---

### Universal invariants (all runtimes)

[CRITICAL][BLOCKS:critical] `user_prompt` is `universal: true` and `canBlock: true` on
**all** runtimes (claude, codex, hermes, opencode). This is the cross-runtime guarantee
that enables the PFV4 universal base.
Test: `capability-map-v3.test.ts` — "user_prompt is universal:true and canBlock:true on all runtimes".

[CRITICAL][BLOCKS:critical] `pre_tool` is `universal: true` and `canBlock: true` on
**all** runtimes. Together with `user_prompt`, these two gate types form the universal
enforcement base that every adapter must honour.
Test: `capability-map-v3.test.ts` — "pre_tool is universal:true and canBlock:true on all runtimes".

[CRITICAL][BLOCKS:high] Every cell's `gateType` field must equal the key used to look it up.
No cell may claim a different gate type than the map key it occupies.
Test: `capability-map-v3.test.ts` — "every cell has gateType matching the key it was looked up by".

[CRITICAL][BLOCKS:high] Non-universal gate types (`session_start`, `post_tool`, `pre_compact`,
`post_compact`, `stop`, `subagent_start`, `subagent_stop`) must have `universal: false` on
all runtimes. Only `user_prompt` and `pre_tool` carry `universal: true`.
Test: `capability-map-v3.test.ts` — "non-universal gate types are universal:false on all runtimes".

---

### CLAUDE_MAP (9 cells)

[CRITICAL][BLOCKS:high] Source: `packages/hima-core/src/capability-map-v3.ts` lines 41–159.
All 9 claude cells have `subagents: "native"` and `injectionMode: "rich"`.

| gateType | level | canBlock | enforcementStrength | skillForcing | universal | compensatingMechanism |
|----------|-------|----------|--------------------|--------------|-----------|-----------------------|
| session_start | supported | false | advisory | true | false | none |
| user_prompt | supported | true | hard | true | **true** | keyword_detection_user_prompt |
| pre_tool | supported | true | hard | true | **true** | none |
| post_tool | supported | false | advisory | false | false | none |
| pre_compact | supported | false | advisory | false | false | none |
| post_compact | supported | false | advisory | false | false | none |
| stop | supported | true | hard | false | false | none |
| subagent_start | supported | true | hard | true | false | injected_role_context |
| subagent_stop | supported | false | advisory | false | false | none |

Claude has no absent cells. All cells use `profiles: "runtime-profiles"`.
`session_start` note: "Context injection only; blocking not available at session start."

---

### CODEX_MAP (9 cells)

[CRITICAL][BLOCKS:high] Source: `packages/hima-core/src/capability-map-v3.ts` lines 165–294.
All 9 codex cells have `subagents: "poll-file"` and `injectionMode: "constrained"` (except
`pre_compact`, `post_compact`, `subagent_stop` which have `injectionMode: "none"`).
All constrained cells have `maxInjectionBytes: 1800`.

| gateType | level | canBlock | enforcementStrength | skillForcing | universal | compensatingMechanism | injectionMode |
|----------|-------|----------|--------------------|--------------|-----------|-----------------------|---------------|
| session_start | supported | false | advisory | false | false | none | constrained |
| user_prompt | supported | true | hard | true | **true** | keyword_detection_user_prompt | constrained |
| pre_tool | supported | true | hard | true | **true** | none | constrained |
| post_tool | supported | false | advisory | false | false | none | constrained |
| pre_compact | **absent** | false | observe_only | false | false | none | none |
| post_compact | **absent** | false | observe_only | false | false | none | none |
| stop | supported | true | hard | false | false | none | constrained |
| subagent_start | **degraded** | false | advisory | false | false | poll_subagent_file | constrained |
| subagent_stop | **degraded** | false | observe_only | false | false | poll_subagent_file | none |

Notes:
- `pre_compact`/`post_compact`: "Compact hooks not available in Codex runtime."
- `stop`: "Codex stop block is supported; pre_tool+stop are the primary enforcement gates."
- `subagent_start`: "No native subagent hook; compensated by poll-file pattern."
- All cells use `profiles: "injected-role-context"` except `pre_compact`/`post_compact`/`subagent_stop` which use `profiles: "none"`.

---

### HERMES_MAP (9 cells)

[CRITICAL][BLOCKS:high] Source: `packages/hima-core/src/capability-map-v3.ts` lines 300–424.
All 9 hermes cells have `subagents: "absent"`. Hermes uses user-message injection; there is
no system-level hook.

| gateType | level | canBlock | enforcementStrength | skillForcing | universal | compensatingMechanism | injectionMode |
|----------|-------|----------|--------------------|--------------|-----------|-----------------------|---------------|
| session_start | supported | false | advisory | false | false | injected_role_context | constrained |
| user_prompt | supported | true | hard | true | **true** | keyword_detection_user_prompt | constrained |
| pre_tool | supported | true | hard | true | **true** | none | constrained |
| post_tool | supported | false | advisory | false | false | none | constrained |
| pre_compact | **absent** | false | observe_only | false | false | none | none |
| post_compact | **absent** | false | observe_only | false | false | none | none |
| stop | **degraded** | **false** | **deferred** | false | false | **deferred_stop_verdict** | constrained |
| subagent_start | **absent** | false | observe_only | false | false | **intercept_delegate_task_pre_tool** | none |
| subagent_stop | **absent** | false | observe_only | false | false | none | none |

Key hermes-specific invariants (bolded in table):
- `stop` is the only gate across all runtimes with `enforcementStrength: "deferred"`. It cannot hard-block; enforcement is deferred to the next blocking gate via `pending-stop-verdict.json`.
- `subagent_start` is absent; the compensating mechanism (`intercept_delegate_task_pre_tool`) intercepts delegate/task tool calls at `pre_tool` instead.
- All hermes cells use `profiles: "injected-role-context"` except absent gates which use `profiles: "none"`.

Test: `capability-map-v3.test.ts` — "stop: level=degraded, enforcementStrength=deferred"; "stop: canBlock=false on hermes"; "subagent_start: level=absent, compensatingMechanism=intercept_delegate_task_pre_tool"; "all hermes gates have subagents=absent".

---

### OPENCODE_MAP (9 cells)

[HIGH][BLOCKS:high] Source: `packages/hima-core/src/adapter-opencode.ts` lines 125–251.
OPENCODE_MAP mirrors CLAUDE_MAP in shape (all cells `subagents: "native"`,
`injectionMode: "rich"`, `profiles: "runtime-profiles"`). All cells carry
`note: "semantics pending web verification"` until R-050 (V3-COMPLETENESS-AUDIT.md) is closed.

| gateType | level | canBlock | enforcementStrength | skillForcing | universal |
|----------|-------|----------|--------------------|--------------|-----------| 
| session_start | supported | false | advisory | true | false |
| user_prompt | supported | true | hard | true | **true** |
| pre_tool | supported | true | hard | true | **true** |
| post_tool | supported | false | advisory | false | false |
| pre_compact | supported | false | advisory | false | false |
| post_compact | supported | false | advisory | false | false |
| stop | supported | true | hard | false | false |
| subagent_start | supported | true | hard | true | false |
| subagent_stop | supported | false | advisory | false | false |

OPENCODE_MAP is re-exported from `capability-map-v3.ts` (line 463) and included in the
`RUNTIME_MAPS` index at line 430–435. All values are best-effort until R-050 is closed by
official OpenCode hook spec verification.

---

## HIGH items

[HIGH][BLOCKS:high] **EnforcementStrength semantics**: the four values map to adapter behavior
as follows:
- `"hard"` — adapter returns exit 2 or `{ decision: "block" }` synchronously.
- `"advisory"` — adapter injects context or logs; never returns a blocking response.
- `"deferred"` — adapter writes verdict to `.hima/state/pending-stop-verdict.json`; the next
  blocking gate reads and applies it.
- `"observe_only"` — adapter logs only; gate is treated as if absent for enforcement purposes.

[HIGH][BLOCKS:high] **CompensatingMechanism semantics**:

| Value | When used | Effect |
|-------|-----------|--------|
| `intercept_delegate_task_pre_tool` | hermes/subagent_start (absent) | Intercept delegate/Task tool calls at pre_tool gate instead |
| `deferred_stop_verdict` | hermes/stop (degraded) | Write verdict to pending-stop-verdict.json; resolve at next blocking gate |
| `poll_subagent_file` | codex/subagent_start, codex/subagent_stop (degraded) | Poll a shared file for subagent completion state |
| `injected_role_context` | claude/subagent_start, hermes/session_start | Inject role context via system-prompt or user-message |
| `keyword_detection_user_prompt` | user_prompt cells across all runtimes | Detect sigil/keyword in user prompt text as trigger |
| `none` | All other cells | No compensating mechanism needed or available |

[HIGH][BLOCKS:low] **Cell validation at definition time**: the internal `cell()` helper
(`capability-map-v3.ts` lines 33–35) calls `decodeGateCapabilityCell(raw)` and returns the
validated result. There is no deferred validation. A bad value in any map constant causes the
entire module to fail on import.

[HIGH][BLOCKS:low] **RUNTIME_MAPS index** (`capability-map-v3.ts` lines 430–435): all four
runtime maps are registered under their `RuntimeTarget` literal key. `getCell()` looks up
`RUNTIME_MAPS[runtime][gateType]` and throws a named error if the cell is undefined (defensive
guard for callers that bypass TypeScript).

---

## MEDIUM items

[MEDIUM][BLOCKS:none] **Codex injection budget**: all codex cells with
`injectionMode: "constrained"` have `maxInjectionBytes: 1800`. This is enforced by
`pickAttack()` via `truncateToBytes()`. No codex cell uses `injectionMode: "rich"`.
Test: `capability-map-v3.test.ts` — "constrained gates have maxInjectionBytes=1800".

[MEDIUM][BLOCKS:none] **Absent gates never block**: every cell with `level: "absent"` has
`canBlock: false`, `injectionMode: "none"`, `skillForcing: false`. The combination ensures
`pickAttack()` never returns `hard-block` or `skill-force` for an absent gate. Absent cells
produce `observe-only` or `deferred-block` at most.

[MEDIUM][BLOCKS:none] **Compact hooks availability**: `pre_compact` and `post_compact` are
`level: "absent"` on codex and hermes; they are `level: "supported"` (but `canBlock: false`,
`advisory`) on claude and opencode. These gates are informational-only even on claude.
Test: `capability-map-v3.test.ts` — "pre_compact and post_compact are absent on codex" and
"pre_compact and post_compact are absent on hermes".

[MEDIUM][BLOCKS:none] **SubagentSupport field values by runtime**:
- `claude`: all gates `subagents: "native"`
- `codex`: all gates `subagents: "poll-file"`
- `hermes`: all gates `subagents: "absent"`
- `opencode`: all gates `subagents: "native"` (pending verification)

Test: `capability-map-v3.test.ts` — "all claude cells have subagents=native"; "subagents are poll-file on all codex gates"; "all hermes gates have subagents=absent".

---

## LOW items (convergence tail)

[LOW][BLOCKS:none] Named exports `CLAUDE_MAP`, `CODEX_MAP`, `HERMES_MAP`, `OPENCODE_MAP` are
re-exported from `capability-map-v3.ts` (lines 463). Tests may import maps directly to
write exhaustive per-gate assertions without going through `getCell`.

[LOW][BLOCKS:none] `GateType` in `capability.ts` (lines 13–23) is defined independently of
`gate.ts` (lines 14–25) to avoid cross-package coupling. Both definitions must remain in sync.
Any new gate type must be added to both schemas simultaneously.

[LOW][BLOCKS:none] OPENCODE_MAP cells are tagged with `note: "semantics pending web verification"`.
Until R-050 in `V3-COMPLETENESS-AUDIT.md` is closed, opencode values are best-effort mirrors of
claude. The Falsifies-If checkpoint above applies equally to opencode once R-050 is resolved.

---

## Acceptance Evidence

Tests passing via `pnpm test` from the repo root:

| Test file | Coverage |
|-----------|----------|
| `packages/hima-core/test/capability-map-v3.test.ts` | Universal invariants (user_prompt, pre_tool); claude-specific (rich injection, native subagents, stop blocking); codex-specific (constrained/1800 bytes, poll-file, absent compact gates, stop blocking); hermes-specific (deferred stop, absent subagents, absent compact, intercept_delegate_task); schema validation at load (27 cells); non-universal gate types |
