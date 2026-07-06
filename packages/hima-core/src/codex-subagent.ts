import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { safeAtomicWriteFile } from "@norm/storage-core";

/**
 * codex-subagent — poll-file compensation for Codex subagent spawn detection.
 *
 * CORRECTION (SOT C5, docs/research/runtime-capabilities.sot.json): Codex DOES
 * have a native SubagentStart hook event (a push event, not poll-based) — the
 * SOT explicitly notes "native event -> NO poll-file compensation needed".
 * capability-map-v3's CODEX_MAP.subagent_start is "degraded" (canBlock=false),
 * not fully absent. The poll-file mechanism below is kept as a defensive
 * fallback (it is harmless, idempotent, and covers any transport where the
 * native push event is not wired end-to-end yet) — it is NOT a necessity for
 * detecting the spawn. This module provides the two bookends of that
 * fallback:
 *
 *   registerSubagent   — called by a child Codex agent on startup; appends
 *                        its childSessionId to the parent's poll file so the
 *                        parent's handlePreToolUse can detect the spawn.
 *
 *   readSubagentRegistry — called by the parent's pre_tool handler to read
 *                          the accumulated set of known child sessionIds.
 *
 * Poll file path:
 *   <root>/.hima/state/subagent-poll-<parentSessionId>.json
 *   Content: JSON array of childSessionId strings.
 *
 * Idempotent registration: re-registering an already-known childSessionId is
 * a no-op (the list does not grow duplicates).
 *
 * Fail-safe reads: a missing file or corrupt JSON returns [] rather than
 * throwing — the caller receives an empty registry and routes accordingly.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-049,
 *      ARCHITECTURE-v3.md §3.3 CODEX_MAP subagent_start,
 *      capability-map-v3.ts CODEX_MAP subagent_start cell.
 */

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

/**
 * Canonical absolute path for the per-parent-session poll file.
 *
 * Exported so tests can assert on the path without hard-coding string logic.
 */
export function pollFilePath(root: string, parentSessionId: string): string {
  return path.join(root, ".hima", "state", `subagent-poll-${parentSessionId}.json`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Ensure `.hima/state/` exists; idempotent. */
async function ensureStateDir(root: string): Promise<void> {
  await mkdir(path.join(root, ".hima", "state"), { recursive: true });
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

// ---------------------------------------------------------------------------
// registerSubagent
// ---------------------------------------------------------------------------

/**
 * registerSubagent — record a child Codex sessionId in the parent's poll file.
 *
 * The function reads the existing registry (or starts with []), appends
 * childSessionId if not already present, and atomically writes the updated
 * array back to disk.
 *
 * Called by the child agent's session-start hook handler so the parent's
 * pre_tool handler can discover the spawn on its next invocation.
 *
 * @param root            Project root; all writes are restricted inside it.
 * @param parentSessionId Session id of the spawning (parent) Codex agent.
 * @param childSessionId  Session id of the newly-started child agent.
 */
export async function registerSubagent(
  root: string,
  parentSessionId: string,
  childSessionId: string,
): Promise<void> {
  await ensureStateDir(root);
  const filePath = pollFilePath(root, parentSessionId);

  // Read the existing list so registration is idempotent.
  const existing = await readSubagentRegistry(root, parentSessionId);

  if (!existing.includes(childSessionId)) {
    existing.push(childSessionId);
  }

  const content = `${JSON.stringify(existing, null, 2)}\n`;
  await safeAtomicWriteFile(root, filePath, content);
}

// ---------------------------------------------------------------------------
// readSubagentRegistry
// ---------------------------------------------------------------------------

/**
 * readSubagentRegistry — return all known child sessionIds for a parent session.
 *
 * Reads `.hima/state/subagent-poll-<parentSessionId>.json` and returns the
 * parsed array of child sessionId strings.
 *
 * Fail-safe contract:
 *   - Missing file              → [] (no children registered yet; normal at first call)
 *   - Corrupt/unparseable JSON  → [] (treat as empty; log point for operators)
 *   - Array contains non-strings → those entries are silently dropped
 *
 * @param root            Project root.
 * @param parentSessionId Session id whose registry to read.
 * @returns               Array of registered child sessionIds, possibly empty.
 */
export async function readSubagentRegistry(
  root: string,
  parentSessionId: string,
): Promise<string[]> {
  const filePath = pollFilePath(root, parentSessionId);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    // Missing file is the expected state before any child registers.
    if (isEnoent(error)) return [];
    // I/O or permission error — fail-safe, return empty.
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop any non-string entries to guard against corrupt state.
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Corrupt JSON — fail-safe.
    return [];
  }
}
