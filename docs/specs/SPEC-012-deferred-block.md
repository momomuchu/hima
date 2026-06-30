---
status: draft
date: 2026-06-30
version: 1.0
claim-bearing: true
evidence-anchor: packages/hima-core/src/deferred-verdict.ts
sources: >
  ARCHITECTURE-v3.md §3.2 rung-4; ARCHITECTURE-v3.md §3.6;
  V3-COMPLETENESS-AUDIT.md R-027, R-032;
  packages/hima-core/src/deferred-verdict.ts;
  packages/hima-core/test/deferred-verdict.test.ts
---

# SPEC-012 — Deferred Block Mechanism

Falsifies-If:
  kill-condition: A deferred-block verdict file exists for a session, the first matching gate event fires, and the block is silently dropped (session continues without enforcement) — this means the consume-and-enforce contract is broken.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/deferred-verdict.ts
  on-fail: Escalate to CRITICAL regression; wire PreToolUse hook to assert consume result; block merge until fixed.

Falsifies-If:
  kill-condition: Corrupt or unreadable verdict file leads to session continuation (fail-open behavior) instead of a synthetic block verdict — this means the fail-closed contract is violated.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/deferred-verdict.ts
  on-fail: Any fail-open path in readAndConsumeDeferredVerdict is a security regression; hard-block CI.

Falsifies-If:
  kill-condition: writeDeferredVerdict produces a partial write visible to readers (non-atomic) — this means safeAtomicWriteFile is not being used or is broken.
  checkpoint-date: 2026-09-01
  evidence-anchor: packages/hima-core/src/deferred-verdict.ts
  on-fail: Trace atomic write calls; verify temp-rename path under all OS error conditions.

## Purpose

The deferred-block mechanism enables the hima stop gate to enforce a block verdict on
Hermes, where the stop event (`on_session_end`) is degraded and non-blocking. When a
gate evaluation at stop time produces a block decision, the result is persisted to a
per-session file. On the very next blocking gate event (first `pre_tool_call` or
`pre_llm_call`), the file is read, the block is enforced, and the file is deleted
(single-use). This is rung-4 of the 6-rung forcing ladder.

The mechanism is also available for Claude and Codex at degraded events (post_tool)
where the runtime does not support blocking.

---

## CRITICAL items

- [CRITICAL][BLOCKS:critical] **pending-stop-verdict-`<sessionId>`.json schema** — the
  persisted verdict file MUST be a UTF-8 JSON object with exactly these fields:

  ```typescript
  // packages/hima-core/src/deferred-verdict.ts:30-36
  type DeferredVerdict = {
    decision: "block";   // always "block" — only block verdicts are worth persisting
    reason: string;      // human-readable explanation shown to the agent
    source: string;      // identifier of the gate/behavior that produced the verdict
    resolveOn: string[]; // list of gate event types that consume and enforce this verdict
    ts: string;          // ISO-8601 timestamp of when the verdict was produced
  }
  ```

  The field `decision` MUST always be the literal `"block"`. Non-block verdicts are
  never persisted. Any JSON object with `decision !== "block"` is treated as corrupt.

- [CRITICAL][BLOCKS:critical] **Canonical file path** — the verdict file is written at:

  ```
  <root>/.hima/state/pending-stop-verdict-<sessionId>.json
  ```

  where `<root>` is the project root and `<sessionId>` is the active session identifier.
  Different sessions MUST write to different files (session isolation). The path is
  computed by `verdictFilePath(root, sessionId)` at
  `packages/hima-core/src/deferred-verdict.ts:47-49`.

- [CRITICAL][BLOCKS:critical] **Atomic write contract** — `writeDeferredVerdict` MUST
  use `safeAtomicWriteFile` (temp file + rename) to prevent partial writes. A partial
  write that is visible to a concurrent reader MUST NOT occur. The `.hima/state/`
  directory is created automatically if absent.

  Implementation: `packages/hima-core/src/deferred-verdict.ts:68-76`.

- [CRITICAL][BLOCKS:critical] **Single-use consume** — `readAndConsumeDeferredVerdict`
  MUST:
  1. Read the file.
  2. Validate the content (parse + structural type-guard).
  3. Delete the file (`safeUnlinkFile`).
  4. Return the verdict.

  The delete (step 3) MUST happen even if the verdict will not be used by the caller
  (to prevent stale verdicts). Delete errors are swallowed because the verdict is
  already in hand; a failed delete does not suppress enforcement.

  Implementation: `packages/hima-core/src/deferred-verdict.ts:99-140`.

- [CRITICAL][BLOCKS:critical] **Fail-closed on corrupt file** — when the verdict file
  exists but is unreadable, contains invalid JSON, or has the wrong shape, the function
  MUST return a synthetic block verdict rather than `null` or throwing:

  ```typescript
  // packages/hima-core/src/deferred-verdict.ts:147-155
  {
    decision: "block",
    reason: "corrupt deferred verdict",
    source: "fail-closed",
    resolveOn: [],
    ts: new Date().toISOString(),
  }
  ```

  Corrupt file → enforce block. This is the fail-closed contract. No corrupt state
  may silently allow the session to continue.

---

## HIGH items

- [HIGH][BLOCKS:high] **Missing file returns null** — when no verdict file exists for
  the session (`ENOENT`), `readAndConsumeDeferredVerdict` returns `null`. Null means
  "no pending verdict" and the caller proceeds normally. This is the common case for
  sessions where no deferred block was issued.

  Implementation: `packages/hima-core/src/deferred-verdict.ts:108-115`.

- [HIGH][BLOCKS:high] **`resolveOn[]` semantics** — the `resolveOn` array specifies
  which gate event types will trigger enforcement when the verdict is consumed. On each
  gate event, the caller MUST:
  1. Call `readAndConsumeDeferredVerdict(root, sessionId)`.
  2. If result is non-null AND the current event type is in `resolveOn` → enforce
     block immediately before any other gate logic.
  3. If the current event type is NOT in `resolveOn` → the verdict was consumed
     but the block is deferred again (caller must re-write for the next event).

  The most common `resolveOn` value for the Hermes stop-deferred pattern is
  `["pre_tool", "user_prompt"]` — the first of these events that fires enforces.

  Note: the verdict is always consumed (file deleted) on the first read, regardless
  of whether the event matches `resolveOn`. If the event does not match, the caller
  is responsible for re-persisting if needed. This prevents stale verdict accumulation.

- [HIGH][BLOCKS:high] **Hermes stop-deferred pattern** — Hermes `on_session_end` has
  `canBlock: false` (degraded). When the stop gate evaluates to block on Hermes:
  1. The stop handler calls `writeDeferredVerdict(root, sessionId, verdict)` with
     `resolveOn: ["pre_tool", "user_prompt"]`.
  2. The verdict persists between session events.
  3. On the next `pre_tool_call` or `pre_llm_call`, `readAndConsumeDeferredVerdict`
     is called at the top of the handler.
  4. If a verdict is returned and the current event matches `resolveOn`, the block is
     enforced immediately (emit `{action:"block"}` for ACP).

  Source: `ARCHITECTURE-v3.md §3.2 rung-4` and capability-map entry
  `hermes / stop (on_session_end): deferred, deferred_stop_verdict`.

- [HIGH][BLOCKS:high] **Session isolation** — each `sessionId` maps to a distinct
  file. Consuming a verdict for session A MUST NOT affect session B. Concurrent
  agents in different sessions MUST write to non-overlapping paths.

- [HIGH][BLOCKS:low] **Structural type-guard** — `isValidVerdict(parsed)` validates
  the shape of a parsed JSON value before accepting it as a DeferredVerdict:

  ```typescript
  // packages/hima-core/src/deferred-verdict.ts:158-167
  function isValidVerdict(value: unknown): value is DeferredVerdict {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      v["decision"] === "block" &&
      typeof v["reason"] === "string" &&
      typeof v["source"] === "string" &&
      Array.isArray(v["resolveOn"]) &&
      typeof v["ts"] === "string"
    );
  }
  ```

  A verdict where `decision` is anything other than `"block"` (e.g. `"continue"`)
  fails this guard and returns a synthetic fail-closed block.

---

## MEDIUM items

- [MEDIUM][BLOCKS:none] **Verdict file content format** — the file is written as
  `JSON.stringify(verdict, null, 2)` followed by a trailing newline. The pretty-print
  format is intentional for human readability during debugging.

- [MEDIUM][BLOCKS:none] **Delete error handling** — delete errors in step 3 of
  `readAndConsumeDeferredVerdict` are intentionally swallowed. The verdict is already
  in hand; a delete failure does not suppress the block. On the next call the file
  will be found again and the same fail-closed block returned (idempotent enforcement).

- [MEDIUM][BLOCKS:none] **`ts` field format** — the timestamp field uses ISO-8601
  format (`new Date().toISOString()`). The synthetic fail-closed verdict also populates
  `ts` with the current time. Consumers must not rely on `ts` for enforcement logic;
  it is metadata only.

---

## LOW items (convergence detail)

- [LOW][BLOCKS:none] `verdictFilePath` is exported so callers can compute the path
  independently for testing or auditing without invoking the I/O functions.

- [LOW][BLOCKS:none] The `.hima/state/` directory creation is embedded in
  `writeDeferredVerdict` (via `safeAtomicWriteFile` which calls `mkdir -p` internally).
  No separate directory-creation step is required by the caller.

---

## Acceptance Evidence

The following tests in `packages/hima-core/test/deferred-verdict.test.ts` serve as
the acceptance test suite for this spec. All tests MUST pass on `pnpm test` with no
skip or xfail:

| Test description | Requirement validated |
|---|---|
| `verdictFilePath` returns canonical per-session JSON path | Path contract |
| Distinct sessionIds map to distinct files | Session isolation |
| Round-trip: consume returns verdict with all fields intact | Write + read contract |
| File deleted after consume (single-use) | Single-use invariant |
| Second consume returns null | Single-use invariant |
| Distinct sessionIds isolated from each other | Session isolation |
| Returns null when no verdict file exists | Missing file → null |
| Returns null when .hima directory does not exist | Missing file → null |
| Fail-closed for non-JSON content | Corrupt → block |
| Fail-closed for valid JSON with wrong shape | Corrupt → block |
| Fail-closed for empty file | Corrupt → block |
| Fail-closed for truncated JSON | Corrupt → block |
| Fail-closed when `decision` field is missing | Corrupt → block |
| Fail-closed when `decision` is "continue" (not block) | isValidVerdict guard |

Run: `pnpm test --filter=hima-core -- deferred-verdict`
