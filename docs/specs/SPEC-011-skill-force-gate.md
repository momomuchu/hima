---
claim-bearing: true
status: draft
date: 2026-06-30
owner: hima-core
r-gap: R-031
source: packages/hima-core/src/skill-state.ts,
        packages/hima-core/src/forcing-primitive.ts,
        packages/hima-core/src/adapter-codex.ts,
        packages/hima-core/src/hermes-subagent.ts,
        packages/hima-core/src/codex-subagent.ts,
        packages/hima-core/src/capability-map-v3.ts,
        packages/schemas/src/skill-ref.ts
cross-refs: SPEC-010-adapter-contract.md, SPEC-007-adapter-hermes.md
---

# SPEC-011 — Skill-Force Gate: session register, SkillRef, mark/check lifecycle

This spec documents the skill-session register and the full skill-force lifecycle:
how a required skill is detected as missing, how enforcement fires per runtime, and
how invocation clears the block for the rest of the session.

---

## CRITICAL items

### SkillRef schema — the typed identity of a skill

- [CRITICAL][BLOCKS:critical] `SkillRef` is a two-field Effect Schema struct:
  ```ts
  type SkillRef = {
    source: "base" | "corpus" | "user" | "project";
    id: string;
  }
  ```
  `source` is a sealed literal union of four registries:
  - `"base"` — built-in hima skills shipped with the kernel
  - `"corpus"` — excellence-book corpus skills
  - `"user"` — user-scoped skills at `~/.claude/skills`
  - `"project"` — repo-local skills at `.claude/skills`

  Source: `packages/schemas/src/skill-ref.ts:11-16`.
  Test evidence: `packages/schemas/test/skill-ref.test.ts`.

- [CRITICAL][BLOCKS:critical] `decodeSkillRef` (Effect `Schema.decodeUnknownSync`) throws
  on any input whose `source` field is not one of the four literal values, or whose `id`
  is not a string. `decodeSkillRefEither` provides the non-throwing variant.
  Source: `packages/schemas/src/skill-ref.ts:18-22`.

### skill-sessions.json — the session register

- [CRITICAL][BLOCKS:critical] The skill register is persisted at
  `.hima/state/skill-sessions.json` relative to the project root. It is a JSON array of
  `SkillRef` objects. This path is the single source of truth for which skills have been
  invoked in the current session.
  Constant: `packages/hima-core/src/skill-state.ts:16`
  (`REGISTER_RELATIVE_PATH = ".hima/state/skill-sessions.json"`).

- [CRITICAL][BLOCKS:critical] `readRegister(root: string): Promise<SkillRef[]>` returns the
  current register content as a typed array. It applies fail-safe error handling:
  - `ENOENT` (file does not exist) → returns `[]` (no skills loaded yet; normal state).
  - `SyntaxError` (corrupt JSON) → returns `[]` (non-fatal; session rebuilds the register).
  - Effect `ParseError` (schema decode failure) → returns `[]` (non-fatal).
  - Any other error (permission, I/O) → rethrows.
  Source: `packages/hima-core/src/skill-state.ts:30-47`.
  Test evidence: `packages/hima-core/test/skill-state.test.ts`
  (`describe("readRegister") → "returns an empty array when the register file does not exist"`).

### isLoaded — exact source+id matching invariant

- [CRITICAL][BLOCKS:critical] `isLoaded(register: SkillRef[], ref: SkillRef): boolean`
  returns `true` if and only if BOTH `entry.source === ref.source` AND `entry.id === ref.id`
  for at least one entry. A match on `id` alone (different source) is NOT a hit.
  Source: `packages/hima-core/src/skill-state.ts:53-55`.
  Test evidence: `packages/hima-core/test/skill-state.test.ts`
  (`describe("isLoaded") → "returns false when only source matches but id differs"`
   and `"returns false when only id matches but source differs"`).

### markLoaded — dedup + atomic write

- [CRITICAL][BLOCKS:critical] `markLoaded(root: string, ref: SkillRef): Promise<void>`
  persists a skill as loaded. Contract:
  1. Validates `ref` via `decodeSkillRef` (throws on invalid input before any I/O).
  2. Reads the current register with `readRegister(root)`.
  3. If `isLoaded(current, ref)` is true → no-op (file is NOT rewritten).
  4. Otherwise: appends the validated ref, creates the parent directory with
     `mkdir({ recursive: true })`, and writes atomically via `safeAtomicWriteFile`.
  Source: `packages/hima-core/src/skill-state.ts:62-81`.
  Test evidence: `packages/hima-core/test/skill-state.test.ts`
  (`describe("deduplication") → "marking the same ref twice results in exactly one entry"`).

---

## HIGH items

### pickAttack SkillGate branch — register-gated enforcement

- [HIGH][BLOCKS:high] `pickAttack` at `packages/hima-core/src/forcing-primitive.ts:92-123`
  processes a `SkillGate` forceIntent as follows:

  ```
  isSkillAlreadyRegistered(skillId, skillRegister)?
    yes → { kind: "noop" }        ← skill already invoked; gate clears
    no + cell.canBlock?
      → { kind: "skill-force", skillId, reason: "skill <id> is required and not yet invoked" }
    no + cell.enforcementStrength === "deferred"?
      → { kind: "deferred-block", verdictFile: ".hima/state/pending-stop-verdict.json",
          reason: "skill <id> required but gate cannot block synchronously",
          resolveOn: ["pre_tool","user_prompt"] }
    else (canBlock=false, not deferred)
      → { kind: "rich-inject" | "constrained-inject" | "observe-only" }
          (resolved by resolveContextInject for the reason string)
  ```

  `isSkillAlreadyRegistered` matches by `id` only (not `source`) in
  `forcing-primitive.ts:32-34`. This is intentionally looser than `isLoaded`'s source+id
  match — the gate cares whether ANY source provided the skill, not which registry.
  Source: `packages/hima-core/src/forcing-primitive.ts:32-34` and `96-123`.

- [HIGH][BLOCKS:high] The E2E skill-force chain (all three layers end-to-end):
  1. `runGate` calls `readRegister(root)` to get the current register.
  2. `pickAttack` uses the register to decide whether to produce `skill-force` or `noop`.
  3. `dispatchTranslate` converts the `skill-force` ForceAction into the runtime response.
  4. After the user invokes the required skill, the caller calls `markLoaded(root, ref)`.
  5. The next `runGate` call finds the skill in the register → `noop` → `exitCode:0`.

  Test evidence: `packages/hima-core/test/e2e-skill-force.test.ts`
  (both scenarios: block before markLoaded, clear after markLoaded).

### Codex systemMessage format for skill-force

- [HIGH][BLOCKS:high] On Codex, a `skill-force` ForceAction produces a `systemMessage`
  formatted as `[skill:<skillId>] <reason>`. The skill id MUST appear within the first 100
  characters so the Codex host can extract it from the truncated prefix without reading the
  full payload. This constraint is met as long as `skillId` is ≤ 90 characters (the prefix
  overhead `"[skill:]"` is 8 characters plus the id length).
  Source: `packages/hima-core/src/adapter-codex.ts:66-74`
  (`buildBlockSystemMessage(reason, skillId)`).
  Test evidence: `packages/hima-core/test/adapter-codex.test.ts`
  (`describe("translateCodex — skill-force") → "returns block exit 2 and skillId within first 100 chars"`).

### Hermes subagent boundary — subagent_start absent

- [HIGH][BLOCKS:high] `HERMES_MAP["subagent_start"]` has `level: "absent"`, `canBlock: false`,
  `enforcementStrength: "observe_only"`, and
  `compensatingMechanism: "intercept_delegate_task_pre_tool"`.
  There is no native `subagent_start` hook on Hermes. The only enforcement point for
  subagent governance is intercepting the `delegate_task` call at `pre_tool`.
  Source: `packages/hima-core/src/capability-map-v3.ts:397-410` (HERMES_MAP subagent_start cell).

- [HIGH][BLOCKS:high] When a Hermes agent spawns a subagent via `delegate_task`, hima injects
  governance rules into the payload via `injectRulesIntoDelegateTask(taskText, rulesSerialized)`.
  The function is **idempotent**: if `taskText` already contains the injection marker
  `"[HIMA RULES INJECTED]"`, it returns the original text unchanged.
  Size guard: `rulesSerialized` is truncated to 3000 characters if exceeded.
  Source: `packages/hima-core/src/hermes-subagent.ts:71-87`.

- [HIGH][BLOCKS:high] Hermes subagent dedup: `markSubagentSeen(root, sessionId, agentId, event)`
  and `isSubagentSeen(root, sessionId, agentId, event)` address the Hermes replay bug where
  `subagent_stop` fires 6+ times for the same agent. The seen-set is stored at
  `.hima/state/subagent-seen-<sessionId>.json` and uses a file lock for concurrent safety.
  Compound key format: `"<agentId>:<event>"`.
  Source: `packages/hima-core/src/hermes-subagent.ts:150-197`.
  Test evidence: `packages/hima-core/test/hermes-subagent.test.ts`.

### Codex subagent boundary — poll-file compensation

- [HIGH][BLOCKS:low] `CODEX_MAP["subagent_start"]` has `level: "degraded"`, `canBlock: false`,
  `compensatingMechanism: "poll_subagent_file"`. Codex has no native subagent_start hook.
  Compensation uses a poll file: the child registers itself by appending its `childSessionId`
  to `.hima/state/subagent-poll-<parentSessionId>.json`. The parent reads this file in its
  `pre_tool` handler to discover spawned children.
  Source: `packages/hima-core/src/codex-subagent.ts:43-101`.
  Test evidence: `packages/hima-core/test/codex-subagent.test.ts`.

---

## MEDIUM items

### Register directory creation

- [MEDIUM][BLOCKS:none] `markLoaded` creates the parent directory of
  `.hima/state/skill-sessions.json` with `mkdir({ recursive: true })` before the atomic
  write. A fresh project root with no `.hima/state/` directory is handled correctly.
  Source: `packages/hima-core/src/skill-state.ts:76-78`.
  Test evidence: `packages/hima-core/test/skill-state.test.ts`
  (`describe("register file location") → "creates parent directories automatically"`).

### Effect ParseError detection

- [MEDIUM][BLOCKS:none] `isEffectParseError(error)` at
  `packages/hima-core/src/skill-state.ts:96-104` detects Effect parse errors by checking
  `_tag === "ParseError"` or `name` containing `"ParseError"`. This allows `readRegister`
  to treat schema decode failures as non-fatal and return `[]` rather than propagating.

### Register insertion order

- [MEDIUM][BLOCKS:none] The register array preserves insertion order. `markLoaded` appends
  the new ref at the end of the existing array. No sorting is applied. Tests verify order
  for sequential marks.
  Test evidence: `packages/hima-core/test/skill-state.test.ts`
  (`"persists multiple distinct refs in insertion order"`).

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] The `SkillRef` `id` field has no maximum length constraint in the schema.
  In practice, Codex's 1800-byte systemMessage cap means a `skillId` exceeding ~90 characters
  risks pushing the `[skill:<id>]` prefix beyond 100 characters, which would break the Codex
  host's id extraction. Skill ids should be kept under 90 characters.

- [LOW][BLOCKS:none] `readRegister` returns a fresh array copy (`[...decodeSkillRefArray(...)]`)
  to prevent callers from accidentally mutating the decoded data.
  Source: `packages/hima-core/src/skill-state.ts:34`.

- [LOW][BLOCKS:none] `safeAtomicWriteFile` (from `@hima/storage-core`) is the only sanctioned
  write path. Direct `writeFile` calls that bypass atomicity are not permitted on the register
  file. This ensures no partial write is ever visible to a concurrent `readRegister` call.

---

Falsifies-If:
  kill-condition: readRegister throws (instead of returning []) when the register file does
    not exist (ENOENT) or contains corrupt JSON.
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/skill-state.ts
  on-fail: The non-fatal error contract is broken. Inspect readRegister error branches at
    skill-state.ts:36-46; run packages/hima-core/test/skill-state.test.ts.

Falsifies-If:
  kill-condition: isLoaded returns true when only the id matches but source differs (e.g.
    source:"base" vs source:"corpus" with same id).
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/skill-state.ts
  on-fail: The exact-match invariant at skill-state.ts:53-55 is violated. Both source AND id
    must match. Fix the isLoaded predicate and re-run skill-state.test.ts.

Falsifies-If:
  kill-condition: markLoaded writes the same SkillRef twice to the register (register has
    length > 1 after two identical markLoaded calls).
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/skill-state.ts
  on-fail: Deduplication at skill-state.ts:69-72 is not firing. Check isLoaded call in
    markLoaded; run the deduplication test suite in skill-state.test.ts.

Falsifies-If:
  kill-condition: runGate still returns skill-force (exitCode:2) after markLoaded was called
    for the required skill, i.e. the E2E skill-force block does not clear.
  checkpoint-date: 2026-07-31
  evidence-anchor: packages/hima-core/src/skill-state.ts
  on-fail: The register read→pickAttack clear path is broken. Verify e2e-skill-force.test.ts
    scenario 2 ("GIVEN skill already markLoaded → SAME runGate returns noop AND claude.exitCode=0");
    check that runGate calls readRegister before pickAttack and that pickAttack sees the entry.
