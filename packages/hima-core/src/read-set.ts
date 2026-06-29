/**
 * read-set.ts — per-session read-set tracker (R-003 support).
 *
 * Persists the set of files an agent has read during a session at:
 *   `<root>/.hima/state/read-set-<sessionId>.json`
 *
 * The set is a JSON array of absolute realpaths. It is used by the
 * read-before-write BehaviorDescriptor (P-01) to enforce that an agent
 * must have read a file before it may write it at M+ risk class.
 *
 * Design choices:
 *   - atomicWriteFile + withFileLock for crash-safe, concurrent-safe updates.
 *   - recordRead swallows all errors so a tracking failure never disrupts
 *     the hook pipeline (same policy as trace.ts appendTrace).
 *   - isInReadSet is synchronous (compare by path.resolve) so it can be
 *     called from synchronous BehaviorDescriptor evaluate() functions.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-003,
 *      BEHAVIOR-CATALOG-v3.md §2 P-01.
 */

import { mkdir, readFile, realpath as fsRealpath } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { atomicWriteFile, withFileLock } from "@hima/storage-core";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Canonical absolute path to the per-session read-set file.
 *
 * `<root>/.hima/state/read-set-<sessionId>.json`
 */
function readSetFilePath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", `read-set-${sessionId}.json`);
}

/**
 * Lock directory path for serialising concurrent writes to the read-set.
 */
function readSetLockPath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", `.read-set-${sessionId}.lock`);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve filePath to its realpath, falling back to path.resolve when the
 * file does not yet exist (ENOENT — defensive for pre-write check contexts).
 */
async function safeRealpath(filePath: string): Promise<string> {
  try {
    return await fsRealpath(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

/**
 * Read and parse the on-disk read-set JSON. Returns [] on any error
 * (ENOENT, malformed JSON, wrong shape).
 */
async function readSetFromDisk(filePath: string): Promise<string[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record that `filePath` was read during `sessionId`.
 *
 * - Resolves `filePath` to its realpath (falls back to path.resolve for
 *   non-existent files).
 * - Appends the resolved path to the on-disk set only when it is not already
 *   present (dedup by realpath).
 * - Writes atomically under a file lock so concurrent hook invocations do not
 *   corrupt the set.
 * - Swallows all errors — tracking failures must never break the hook pipeline.
 *
 * @param root       Project root.
 * @param sessionId  The active session identifier.
 * @param filePath   Absolute or relative path of the file that was read.
 */
export async function recordRead(
  root: string,
  sessionId: string,
  filePath: string,
): Promise<void> {
  try {
    const resolved = await safeRealpath(filePath);
    const setPath = readSetFilePath(root, sessionId);
    const lockPath = readSetLockPath(root, sessionId);

    // Ensure the state directory exists before acquiring the lock.
    await mkdir(path.dirname(setPath), { recursive: true });

    await withFileLock(lockPath, async () => {
      // Re-read inside the lock to avoid lost-update races.
      const current = await readSetFromDisk(setPath);

      if (current.includes(resolved)) {
        // Already present — no write needed.
        return;
      }

      const updated = [...current, resolved];
      await atomicWriteFile(setPath, `${JSON.stringify(updated, null, 2)}\n`);
    });
  } catch {
    // Swallow all errors — tracking must never disrupt the hook pipeline.
  }
}

/**
 * Return the full read-set for `sessionId`.
 *
 * Returns `[]` when the read-set file does not exist (no reads recorded yet)
 * or cannot be parsed.
 *
 * @param root       Project root.
 * @param sessionId  The active session identifier.
 */
export async function readReadSet(root: string, sessionId: string): Promise<string[]> {
  const setPath = readSetFilePath(root, sessionId);
  return readSetFromDisk(setPath);
}

/**
 * Check whether `filePath` is present in a previously-loaded read-set.
 *
 * This is a synchronous helper intended for use inside BehaviorDescriptor
 * evaluate() functions that have already awaited readReadSet(). Comparison
 * is performed by resolving `filePath` to its canonical realpath using
 * `fs.realpathSync` (which resolves symlinks, matching the async path used
 * by recordRead). Falls back to `path.resolve` when realpathSync throws
 * (ENOENT — file does not exist yet, or other I/O error).
 *
 * On macOS `/tmp` is a symlink to `/private/tmp`. Using path.resolve alone
 * would return `/tmp/…` while recordRead stores `/private/tmp/…`, causing
 * false mismatches. realpathSync resolves this correctly.
 *
 * @param set       The string[] returned by readReadSet().
 * @param filePath  The path to look up (absolute or relative).
 */
export function isInReadSet(set: string[], filePath: string): boolean {
  let resolved: string;
  try {
    resolved = realpathSync(filePath);
  } catch {
    resolved = path.resolve(filePath);
  }
  return set.includes(resolved);
}
