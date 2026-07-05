/**
 * session-diff.ts — git-state snapshot helpers for the R-044 review-surface gate.
 *
 * The integrator (CLI session-start / stop) captures the raw output of
 * `git diff --stat` and passes it here as a plain string.  This module
 * stores and retrieves that string from `.hima/state/session-diff-base.json`
 * so subsequent hooks can detect whether working-tree has changed since the
 * snapshot was taken.
 *
 * Design choices:
 *   - The snapshot is stored as a JSON object with a `base` string field and
 *     an optional `ts` timestamp.  Plain-text would work too, but JSON lets
 *     the integrator add metadata without a format change.
 *   - `readGitSnapshot` returns `null` when the file is absent or unparseable
 *     — callers must handle the null case (treated as "no baseline").
 *   - `hasChangesSince` is a pure synchronous predicate; it never touches fs.
 *   - All async helpers use `node:fs/promises` directly (no @norm/storage-core
 *     abstraction needed for a single read/write with mkdir).
 *   - mkdir is recursive so the function is idempotent on repeated calls.
 *
 * Addresses: V3-CERTIFICATION.md R-044 (git-state snapshot for review-surface).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Shape persisted to `.hima/state/session-diff-base.json`. */
type SnapshotFile = {
  base: string;
  ts?: string;
};

// ---------------------------------------------------------------------------
// Path helper (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Canonical path to the session-diff snapshot file.
 *
 * `<root>/.hima/state/session-diff-base.json`
 */
export function sessionDiffPath(root: string): string {
  return path.join(root, ".hima", "state", "session-diff-base.json");
}

// ---------------------------------------------------------------------------
// captureGitSnapshot
// ---------------------------------------------------------------------------

/**
 * Persist a git-diff snapshot to `.hima/state/session-diff-base.json`.
 *
 * The integrator calls this with the raw output of `git diff --stat` (or any
 * equivalent representation) at session-start.  Subsequent hooks call
 * `readGitSnapshot` + `hasChangesSince` to detect drift.
 *
 * - Creates `.hima/state/` lazily if it does not exist.
 * - Overwrites any previous snapshot (one snapshot per session).
 * - Records an ISO-8601 `ts` field alongside `base` for auditability.
 *
 * @param root      Project root (directory containing `.hima/`).
 * @param snapshot  The git diff string to store as the baseline.
 */
export async function captureGitSnapshot(root: string, snapshot: string): Promise<void> {
  const filePath = sessionDiffPath(root);
  await mkdir(path.dirname(filePath), { recursive: true });

  const payload: SnapshotFile = {
    base: snapshot,
    ts: new Date().toISOString(),
  };
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// readGitSnapshot
// ---------------------------------------------------------------------------

/**
 * Read the previously captured git-diff snapshot.
 *
 * Returns the `base` string from `.hima/state/session-diff-base.json`, or
 * `null` when the file does not exist or cannot be parsed.  `null` is the
 * explicit "no baseline" signal — callers must handle it (typically by treating
 * every subsequent diff as a change, i.e. `hasChangesSince(null, current)`
 * returns `true`).
 *
 * @param root  Project root.
 */
export async function readGitSnapshot(root: string): Promise<string | null> {
  try {
    const raw = await readFile(sessionDiffPath(root), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "base" in parsed &&
      typeof (parsed as SnapshotFile).base === "string"
    ) {
      return (parsed as SnapshotFile).base;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// hasChangesSince
// ---------------------------------------------------------------------------

/**
 * Pure predicate: returns `true` when the working-tree has changed since the
 * baseline snapshot was captured.
 *
 * Rules:
 *   - `baseSnapshot === null`  → `true`  (no baseline = assume change)
 *   - `currentSnapshot !== baseSnapshot` → `true`
 *   - otherwise → `false`
 *
 * Comparison is strict string equality so any difference in the `git diff --stat`
 * output (added line, removed line, changed count) is detected.
 *
 * @param baseSnapshot    The previously stored snapshot, or `null` if absent.
 * @param currentSnapshot The freshly captured git diff string.
 */
export function hasChangesSince(
  baseSnapshot: string | null,
  currentSnapshot: string,
): boolean {
  if (baseSnapshot === null) return true;
  return currentSnapshot !== baseSnapshot;
}
