import { readFile } from "node:fs/promises";
import path from "node:path";
import { safeAtomicWriteFile, safeUnlinkFile } from "@hima/storage-core";

/**
 * deferred-verdict — single-use block verdict persisted across hook invocations.
 *
 * The `deferred-block` ForceAction kind lets a pre-tool gate record a block
 * decision that is enforced at the stop gate (R-027). The verdict is written
 * to disk when the deferred-block action is resolved and consumed (read +
 * deleted) exactly once by the stop gate.
 *
 * File path: `<root>/.hima/state/pending-stop-verdict-<sessionId>.json`
 *
 * Fail-closed contract: a corrupt or unreadable verdict file returns a
 * synthetic block verdict rather than silently allowing the session to
 * continue. Missing file (no pending verdict) returns `null`.
 *
 * See: ARCHITECTURE-v3.md §3.2/§3.5, gap register R-027.
 */

// ---------------------------------------------------------------------------
// DeferredVerdict type
// ---------------------------------------------------------------------------

/**
 * The payload persisted for a deferred-block action.
 * `decision` is always "block" — only blocking verdicts are worth persisting.
 */
export type DeferredVerdict = {
  decision: "block";
  reason: string;
  source: string;
  resolveOn: string[];
  ts: string;
};

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

/**
 * Canonical absolute path for the per-session pending stop-verdict file.
 *
 * `<root>/.hima/state/pending-stop-verdict-<sessionId>.json`
 */
export function verdictFilePath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", `pending-stop-verdict-${sessionId}.json`);
}

// ---------------------------------------------------------------------------
// writeDeferredVerdict
// ---------------------------------------------------------------------------

/**
 * writeDeferredVerdict — atomically persist a block verdict for later consumption.
 *
 * Called by the gate pipeline when a `deferred-block` ForceAction is resolved.
 * The stop gate reads and consumes this file via `readAndConsumeDeferredVerdict`.
 *
 * - Uses `safeAtomicWriteFile` (temp-rename) to prevent partial writes.
 * - Creates `.hima/state/` automatically if it does not exist.
 *
 * @param root       Project root; all writes are restricted inside it.
 * @param sessionId  Identifies which session this verdict belongs to.
 * @param verdict    The block verdict to persist.
 */
export async function writeDeferredVerdict(
  root: string,
  sessionId: string,
  verdict: DeferredVerdict,
): Promise<void> {
  const filePath = verdictFilePath(root, sessionId);
  const content = `${JSON.stringify(verdict, null, 2)}\n`;
  await safeAtomicWriteFile(root, filePath, content);
}

// ---------------------------------------------------------------------------
// readAndConsumeDeferredVerdict
// ---------------------------------------------------------------------------

/**
 * readAndConsumeDeferredVerdict — single-use read of a pending stop verdict.
 *
 * Reads `<root>/.hima/state/pending-stop-verdict-<sessionId>.json`, deletes
 * the file (single-use), and returns the verdict.
 *
 * Fail-closed semantics:
 *   - Missing file     → `null` (no pending verdict; normal case)
 *   - Unreadable file  → synthetic `{decision:"block", reason:"corrupt deferred verdict"}`
 *   - Corrupt JSON     → synthetic fail-closed block (same)
 *   - Wrong shape      → synthetic fail-closed block (same)
 *
 * @param root       Project root.
 * @param sessionId  Session whose pending verdict to consume.
 * @returns          The pending DeferredVerdict, a synthetic fail-closed block
 *                   on corrupt/unreadable state, or `null` if no verdict exists.
 */
export async function readAndConsumeDeferredVerdict(
  root: string,
  sessionId: string,
): Promise<DeferredVerdict | null> {
  const filePath = verdictFilePath(root, sessionId);

  // ── 1. Read ────────────────────────────────────────────────────────────────
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return null; // No pending verdict — normal case.
    }
    // Unreadable (permissions, I/O error, etc.) — fail-closed.
    return syntheticFailClosed();
  }

  // ── 2. Parse + validate ────────────────────────────────────────────────────
  let verdict: DeferredVerdict;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidVerdict(parsed)) {
      return syntheticFailClosed();
    }
    verdict = parsed;
  } catch {
    // JSON.parse threw — corrupt file — fail-closed.
    return syntheticFailClosed();
  }

  // ── 3. Delete (single-use) ─────────────────────────────────────────────────
  // Best-effort: the verdict has already been read. Swallow delete errors so a
  // race condition or permission issue does not suppress the block decision.
  try {
    await safeUnlinkFile(root, filePath);
  } catch {
    // intentionally swallowed — verdict already in hand
  }

  return verdict;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Synthetic fail-closed verdict returned when the persisted file is corrupt. */
function syntheticFailClosed(): DeferredVerdict {
  return {
    decision: "block",
    reason: "corrupt deferred verdict",
    source: "fail-closed",
    resolveOn: [],
    ts: new Date().toISOString(),
  };
}

/** Structural type-guard for DeferredVerdict parsed from untrusted JSON. */
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

/** Node.js ENOENT code guard. */
function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}
