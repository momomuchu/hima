---
status: draft
date: 2026-06-30
version: 1.0
claim-bearing: true
evidence-anchor: packages/hima-core/src/prompts-core/role-for-stage.ts
sources: >
  ARCHITECTURE-v3.md §3.6 OMO Mechanisms; ARCHITECTURE-v3.md §7.1/§7.4;
  V3-COMPLETENESS-AUDIT.md R-020, R-028, R-029, R-033;
  packages/hima-core/src/prompts-core/role-for-stage.ts;
  packages/hima-core/src/prompts-core/variant-resolver.ts;
  packages/hima-core/src/prompts-core/types.ts;
  packages/hima-core/src/keyword.ts;
  packages/hima-core/src/behavior-core/beh-planner-write-guard.ts;
  packages/hima-core/src/rules-engine/index.ts;
  packages/hima-core/src/rules-engine/matcher.ts;
  packages/hima-core/src/rules-engine/frontmatter.ts;
  packages/hima-core/src/hermes-subagent.ts
---

# SPEC-013 — OMO Mechanisms v3

Falsifies-If:
  kill-condition: A planner-stage ward is active and a Write to a non-.md non-.hima/plans non-.hima/drafts file succeeds without a block from BEH_PLANNER_WRITE_GUARD — this means the planner write-guard is not wired or is bypassed.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/behavior-core/beh-planner-write-guard.ts
  on-fail: Hard regression; trace the BEH_PLANNER_WRITE_GUARD evaluate path; block merge.

Falsifies-If:
  kill-condition: pickSigil returns a non-null match on a sigil token embedded inside a fenced code block or inline code span — this means the anti-false-positive stripping step is broken.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/keyword.ts
  on-fail: Fix FENCED_BLOCK_RE + INLINE_CODE_RE stripping; add regression test for mid-sentence false positive.

Falsifies-If:
  kill-condition: resolveRulesForPath injects a rule that was already injected in the same session (same sessionId, same realpath) — this means session dedup is not functioning.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/rules-engine/index.ts
  on-fail: Trace loadSessionRecord / saveSessionRecord; verify realpath dedup Set; add regression test.

Falsifies-If:
  kill-condition: injectRulesIntoDelegateTask appends a second injection block when the payload already contains [HIMA RULES INJECTED] — this means the idempotency guard is broken.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/hermes-subagent.ts
  on-fail: Fix idempotency check; add regression test; double-injection corrupts subagent payloads.

## Purpose

This spec documents the five OMO-inspired mechanisms reimplemented for hima v3 with
hima-native names and per-runtime adapted attacks. The mechanisms are:

1. **Profiles** — stage-coupled role injection (planner / executor / reviewer)
2. **Sigil detection** — magic-word terminal-token detection with anti-false-positive stripping
3. **Ward / work-state** — cross-session execution context (ward.json)
4. **Rules engine** — path-scoped picomatch rule injection with session dedup
5. **Hermes subagent propagation** — delegate_task intercept with idempotent rule injection

All mechanisms are reimplemented in TypeScript from the OMO pattern. No OMO source
code is copied (licence SUL-1.0).

---

## CRITICAL items

### Profiles — stage-coupled roles

- [CRITICAL][BLOCKS:critical] **Three roles, three stage sets** — the profiles layer
  maps each DEV_CYCLE stage to exactly one of three functional roles. The mapping is
  the single source of truth for role assignment:

  ```typescript
  // packages/hima-core/src/prompts-core/role-for-stage.ts:37-59
  PLANNER_STAGES  = new Set(["discovery", "analysis", "spec"])
  EXECUTOR_STAGES = new Set(["design", "impl", "test"])
  REVIEWER_STAGES = new Set(["verify"])
  ```

  The three sets are mutually exclusive (no stage appears in more than one set). Any
  stage not in any set produces `roleForStage(stage) === null`.

- [CRITICAL][BLOCKS:critical] **`roleForStage(stage): HimaRole | null`** — pure
  function, no I/O, no side effects. Lookup order: PLANNER_STAGES → EXECUTOR_STAGES →
  REVIEWER_STAGES → null.

  ```typescript
  // packages/hima-core/src/prompts-core/role-for-stage.ts:78-83
  export function roleForStage(stage: string): HimaRole | null
  ```

  Examples: `roleForStage("discovery") === "planner"`, `roleForStage("impl") === "executor"`,
  `roleForStage("verify") === "reviewer"`, `roleForStage("unknown") === null`.

- [CRITICAL][BLOCKS:critical] **`roleContext(role): string`** — returns the bundled
  role-context injection string for injection as `additionalContext` before the agent's
  first write. The canonical marker format `[HIMA role:<name>]` is required as a prefix
  in each string and is used by downstream tooling (including the planner-write-guard
  log message).

  ```typescript
  // packages/hima-core/src/prompts-core/role-for-stage.ts:101-118
  roleContext("planner")  → "[HIMA role:planner] Plan only; do not write implementation code (only .md / .hima/plans)."
  roleContext("executor") → "[HIMA role:executor] Implement the active plan tasks; read spec before writing; ..."
  roleContext("reviewer") → "[HIMA role:reviewer] Verify only; do not modify implementation; produce PASS/PARTIAL/FAIL verdicts ..."
  ```

  Each role-context string is distinct and non-empty. Strings are intentionally terse
  to minimize context-window overhead per injection.

- [CRITICAL][BLOCKS:critical] **Planner write-guard — hard-block at pre_tool** — when
  the active ward is in a planner stage (PLANNER_STAGES) and the tool is a write
  operation (Write | Edit | MultiEdit), writes to implementation files are blocked at
  rung 1 (hard-block exit 2). Allowed targets for planner:
  - Files with `.md` extension (any path).
  - Files under `<root>/.hima/plans/**`.
  - Files under `<root>/.hima/drafts/**`.

  Decision tree (8 steps, in order):

  ```
  1. ward is null/undefined   → allow (no stage context)
  2. openStage ∉ PLANNER_STAGES → allow (executor or reviewer stage)
  3. toolName ∉ {Write,Edit,MultiEdit} → allow (non-write tool)
  4. cannot extract target path from toolInput → allow (defensive)
  5. path.extname(absPath) === ".md" → allow
  6. absPath is under <root>/.hima/plans/ → allow
  7. absPath is under <root>/.hima/drafts/ → allow
  8. none of the above → BLOCK (violationType: PLANNER_WRITE_GUARD)
  ```

  The partial-name guard (step 6/7): uses `absPath === absDir || absPath.startsWith(absDir + path.sep)`
  to prevent `.hima/plans-extra/` from matching `.hima/plans/`.

  Implementation: `packages/hima-core/src/behavior-core/beh-planner-write-guard.ts`.
  Block message cites `openStage` and remediation: `hima hook stage-advance --stage spec --status done`.

---

### Profiles — VariantTable and variant resolution

- [CRITICAL][BLOCKS:high] **PromptSource discriminated union** — every prompt variant
  is described by one of two sources:

  ```typescript
  // packages/hima-core/src/prompts-core/types.ts:31-33
  type PromptSource =
    | { readonly kind: "bundled";    readonly content: string  }
    | { readonly kind: "filesystem"; readonly baseDir: string  }
  ```

  `bundled` means content is inlined in the JS bundle (no filesystem I/O at runtime).
  `filesystem` means content is loaded from `<baseDir>/<variantName>.md` at runtime.
  The loader must validate the resolved path stays under `baseDir` (anti path-traversal).

- [CRITICAL][BLOCKS:high] **VariantTable** — a profile's full variant map:

  ```typescript
  // packages/hima-core/src/prompts-core/types.ts:50
  type VariantTable = Record<string, PromptSource>
  ```

  Keys are variant names (e.g. `"default"`, `"claude"`, `"planner"`). Every table
  MUST include at minimum a `"default"` or a first fallback entry so `resolveVariant()`
  always returns a valid key. No variant name is reserved except by convention.

- [CRITICAL][BLOCKS:high] **`resolveVariant()` — four-step resolution** — the sole
  variant-selection entry point. Pure: no I/O, no side effects.

  ```typescript
  // packages/hima-core/src/prompts-core/variant-resolver.ts:87-117
  export function resolveVariant({ modelID, agentName, variants }): string
  ```

  Resolution order (verbatim, no other mechanism permitted in v0.1):
  1. If `agentName ∈ PLANNER_AGENT_NAMES` AND `"planner" ∈ variants` → `"planner"`.
  2. Else first `MODEL_MATCHERS` entry whose `variantName ∈ variants` and `matches(modelID)` → that variant.
  3. Else `"default"` if `"default" ∈ variants` → `"default"`.
  4. Else first key of `variants` (last-resort; empty table returns string `"default"`).

  v0.1 constants:
  - `PLANNER_AGENT_NAMES = new Set(["planner"])` — extensible, not hardcoded in resolution.
  - One `MODEL_MATCHER`: `{ variantName: "claude", matches: (id) => id.startsWith("claude-") }`.

- [CRITICAL][BLOCKS:none] **Hermes profile strategy** — Hermes uses runtime-profiles
  (sticky, set via `HERMES_HOME`). The profile is set at invocation only; no mid-session
  switch is possible (upstream issue #18594). The adapter logs a warning if `HERMES_HOME`
  is not set at session start. For Claude/Codex/OpenCode: injected-role-context is used
  via `pickAttack` (rung 2 for Claude, rung 3 for Codex/Hermes non-profile injection).

---

## HIGH items

### Sigil detection (magic-word)

- [HIGH][BLOCKS:high] **Anti-false-positive stripping** — before testing for a sigil,
  fenced code blocks and inline code spans MUST be stripped from the message text. This
  prevents a sigil word mentioned inside a code example from triggering the gate:

  ```typescript
  // packages/hima-core/src/keyword.ts:22-28
  const FENCED_BLOCK_RE = /```[\s\S]*?```/g;   // strips ``` ... ```
  const INLINE_CODE_RE  = /`[^`]*`/g;          // strips ` ... `
  ```

  The cleaned text is produced by applying both regexes in order (fenced first).
  This specific order matches the OMO false-positive documented on 2026-06-11.

- [HIGH][BLOCKS:high] **Terminal-sigil regex** — after stripping, the sigil is detected
  only at the very end of the cleaned text:

  ```typescript
  // packages/hima-core/src/keyword.ts:28
  const TERMINAL_SIGIL_RE = /\b(full|run|spec|ulw)\s*$/i;
  ```

  A sigil word that appears mid-sentence (not at end-of-message) does NOT trigger the
  gate. The `\b` word-boundary and `\s*$` end-anchor are both required.

- [HIGH][BLOCKS:high] **`pickSigil(text): SigilMatch | null`** — the sole detection
  entry point. Pure function.

  ```typescript
  // packages/hima-core/src/keyword.ts:36-62
  export function pickSigil(text: string): SigilMatch | null
  ```

  Sigil map (token → SigilMatch):
  | token | sigil | entryPoint | floor |
  |---|---|---|---|
  | `full` | `"full"` | `"full"` | `"H"` |
  | `ulw`  | `"ulw"`  | `"full"` | `"H"` (alias for full) |
  | `run`  | `"run"`  | `"run"`  | `"M"` |
  | `spec` | `"spec"` | `"spec"` | `"M"` |

  `ulw` is an alias for `full` with the same entryPoint and floor. Both `full` and `ulw`
  set `floor: "H"` which is the criticality floor for architectural work.

- [HIGH][BLOCKS:high] **Sigil carries criticality floor** — the `floor` field in
  `SigilMatch` sets the minimum criticality floor for the ward. Per `ARCHITECTURE-v3.md §7.1`:
  the risk-classifier MAY raise this floor but MUST NOT lower it. The sigil is a
  first-class criticality input, not just a mode switch.

### Ward / work-state

- [HIGH][BLOCKS:medium] **Ward is the cross-session execution context** — persisted at
  `<root>/.hima/state/ward.json`, validated on every read/write via the `Ward` Effect
  Schema decoder (`decodeWard`). The ward is agent-agnostic: multiple runtimes share
  the same file.

  Ward fields (from `@hima/schemas`):
  - `id`: unique ward identifier
  - `entryPoint`: `"full" | "run" | "spec"` (the sigil that started this run)
  - `floor`: criticality floor `"T" | "L" | "M" | "H" | "C"`
  - `openStage`: currently active DEV_CYCLE stage name
  - `skillRegister`: `SkillRef[]` — skills already marked active this session
  - `verdicts`: `StageVerdict[]` — sealed stage verdicts

  `full` → initial `openStage = "discovery"`;
  `run` / `spec` → initial `openStage = "spec"`.

- [HIGH][BLOCKS:medium] **Atomic write + file-lock** — all ward writes use
  `safeAtomicWriteFile` (temp-rename) guarded by `withFileLock`. The lock path is
  `.hima/state/.ward-store.lock`. Both `ward-store.ts` and `ward-transitions.ts` use
  the same lock path to prevent cross-module corruption.

- [HIGH][BLOCKS:low] **Stage-predecessor guard** — `checkStageGate(ward, targetStage)`
  returns `{ok:true}` only when all predecessor stages in DEV_CYCLE order have a sealed
  verdict (`done | done-verified | done-validated`). Statuses `blocked` and `partial`
  do NOT seal a stage. Implementation: `packages/hima-core/src/ward-transitions.ts:98-125`.

### Rules engine — path-scoped injection

- [HIGH][BLOCKS:medium] **`resolveRulesForPath(root, targetPath, opts?)`** — main API.

  ```typescript
  // packages/hima-core/src/rules-engine/index.ts:87-160
  export async function resolveRulesForPath(
    root: string,
    targetPath: string,
    opts?: ResolveRulesOpts,
  ): Promise<ResolveRulesResult>
  ```

  Returns `{ injected: string[], matchedFiles: string[] }`.
  `injected` contains the body text of each matched rule.
  `matchedFiles` contains the absolute path of each matched rule file.
  Never throws on a missing rules directory (graceful skip).

- [HIGH][BLOCKS:medium] **Source precedence** — rule files are discovered from these
  directories in descending priority order (first = highest priority):

  ```
  .hima/rules/   (0 — highest)
  .claude/rules/ (1)
  .cursor/rules/ (2)
  ```

  Only `.md` and `.mdc` files are collected. Source directories that do not exist are
  silently skipped.

- [HIGH][BLOCKS:medium] **Frontmatter schema** — each rule file MAY begin with a
  YAML-ish frontmatter block between `---` delimiters. Parsed fields:

  ```
  globs:       string[]   picomatch patterns (aliases: paths, applyTo)
  alwaysApply: boolean    inject regardless of target file path (default: false)
  description: string     human label; not used for matching
  ```

  A file without frontmatter or with an unclosed `---` block is treated as body-only
  (empty globs, `alwaysApply: false`).

  Frontmatter parser: `packages/hima-core/src/rules-engine/frontmatter.ts`.
  No external YAML library; pure in-house line-by-line parser.

- [HIGH][BLOCKS:medium] **Matching algorithm** — a rule is included when:
  - `alwaysApply === true`, OR
  - `ruleMatches(globs, relPath, basename) === true`

  where `relPath` is the target file path relative to `root` (forward-slash normalized)
  and `basename` is the filename without directory components.

  `ruleMatches` (picomatch, LRU cache 256 entries):
  1. Split globs into positive and negative (`!`-prefixed) patterns.
  2. If no positive patterns → false.
  3. Test each positive pattern against `relPath` OR `basename` (any match = hit).
  4. If any negative pattern matches `relPath` OR `basename` → cancel the hit.
  5. Return true iff positive hit and no negative cancellation.

  picomatch options: `{ dot: true, bash: true }`.
  Implementation: `packages/hima-core/src/rules-engine/matcher.ts`.

- [HIGH][BLOCKS:medium] **Realpath dedup** — within a single `resolveRulesForPath`
  call, a rule file reachable via two different source directories is injected only
  once (dedup by `realpath`).

- [HIGH][BLOCKS:medium] **Session dedup** — when `opts.sessionId` is provided, rules
  whose canonical `realpath` was already injected in a previous call for this session
  are skipped. The session record is persisted to:

  ```
  <root>/.hima/state/injected-rules-<sessionId>.json
  ```

  as a JSON array of realpath strings. Newly injected rules are appended atomically
  via `safeAtomicWriteFile`. A missing or corrupt session record is treated as an
  empty set (no rules previously injected).

---

## MEDIUM items

### Hermes subagent rule propagation

- [MEDIUM][BLOCKS:high] **`injectRulesIntoDelegateTask(taskText, rulesSerialized): string`** —
  inject hima governance rules into a Hermes `delegate_task` payload. This is the only
  channel available because Hermes subagents hardcode `skip_context_files=True`.

  ```typescript
  // packages/hima-core/src/hermes-subagent.ts:71-87
  export function injectRulesIntoDelegateTask(
    taskText: string,
    rulesSerialized: string,
  ): string
  ```

  Pure function; no I/O.

- [MEDIUM][BLOCKS:high] **Idempotency** — if `taskText` already contains the sentinel
  `"[HIMA RULES INJECTED]"`, the original text is returned unchanged. Double injection
  is silently prevented.

- [MEDIUM][BLOCKS:high] **Size guard** — `rulesSerialized` exceeding 3 000 characters
  is truncated to the first 3 000 characters followed by `"...[truncated]"`. The
  boundary is `> 3000` (not `>= 3000`): exactly 3 000 characters is NOT truncated.

- [MEDIUM][BLOCKS:medium] **Injection format** — when injection proceeds:

  ```
  <taskText>

  ---
  [HIMA RULES INJECTED]
  <rulesSerialized (possibly truncated)>
  ---
  ```

  The sentinel `[HIMA RULES INJECTED]` is both the idempotency check token and the
  opening line of the injected block.

- [MEDIUM][BLOCKS:medium] **Subagent replay dedup** — Hermes has a known bug where the
  same `subagent_stop` event fires 6+ times for one subagent. `markSubagentSeen` /
  `isSubagentSeen` provide a session-scoped registry to prevent re-evaluation:

  ```typescript
  // packages/hima-core/src/hermes-subagent.ts:150-197
  markSubagentSeen(root, sessionId, agentId, event): Promise<void>
  isSubagentSeen(root, sessionId, agentId, event):  Promise<boolean>
  ```

  Registry path: `<root>/.hima/state/subagent-seen-<sessionId>.json`.
  Compound key: `"<agentId>:<event>"`.
  Write is atomic under a file lock; reads are always live (no in-memory cache) to
  stay accurate across concurrent hook invocations from distinct processes.

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] **`resolveVariant` graceful empty table** — when `variants` is
  empty, the function returns the string `"default"` as a last-resort fallback without
  throwing. Callers that receive a key not present in `variants` must handle the miss.

- [LOW][BLOCKS:none] **Matcher cache management** — `clearMatcherCache()` is exported
  from `packages/hima-core/src/rules-engine/matcher.ts` for use in tests. The cache is
  process-global; tests that mutate picomatch options or need isolation must call this.

- [LOW][BLOCKS:none] **AGENTS.md walk-up** — the rules engine also supports
  root-to-leaf `AGENTS.md` file injection, but this is distinct from the glob-matched
  rule injection described here and is resolved separately by the caller.

---

## Acceptance Evidence

### Profiles

Tests in `packages/hima-core/test/role-for-stage.test.ts`:
- PLANNER/EXECUTOR/REVIEWER_STAGES set membership and mutual exclusion
- `roleForStage()` for all defined stages and unknown stages
- `roleContext()` marker strings and distinctness per role

Tests in `packages/hima-core/test/variant-resolver.test.ts`:
- Steps 1–4 of `resolveVariant()` resolution order
- Planner alias takes priority over model matcher
- Graceful empty table fallback

### Planner write-guard

Tests in `packages/hima-core/test/beh-planner-write-guard.test.ts`:
- Discovery + Write to implementation file → block (scenario A)
- Discovery + Write to .hima/plans/ → allow (scenario B)
- Executor stage + Write to implementation file → allow (scenario C)
- No ward → allow (scenario D)
- Analysis + Edit, spec + MultiEdit → block (scenarios E/F)
- .md extension, .hima/drafts/, non-write tool → allow (scenarios G/H/I)
- Defensive: toolInput undefined/null → allow (scenarios J/K)
- Partial-name guard: .hima/plans-extra/ does not match .hima/plans/ (scenario U)

### Sigil detection

Tests in `packages/hima-core/test/keyword.test.ts` (verify via `pnpm test --filter=hima-core -- keyword`).

### Rules engine

Tests in `packages/hima-core/test/rules-engine.test.ts`:
- resolveRulesForPath with alwaysApply rules
- Glob matching: positive, negative, basename vs relPath
- Source precedence (higher-priority source wins)
- Session dedup (realpath already in record → skipped)
- Realpath dedup (same file via two sources → injected once)
- Missing directory → graceful skip

### Hermes subagent propagation

Tests in `packages/hima-core/test/hermes-subagent.test.ts`:
- Injection appends sentinel and rules
- Idempotency: already-injected payload returned unchanged
- Truncation at > 3000 chars; exactly 3000 NOT truncated
- Empty rules: sentinel still present
- markSubagentSeen + isSubagentSeen round-trip
- Replay dedup: same (agentId, event) pair → seen after first mark
- Session isolation: distinct sessionId files do not share state

Run all: `pnpm test --filter=hima-core`
