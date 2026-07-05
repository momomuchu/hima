/**
 * hermes-subagent.ts — Hermes subagent propagation helpers.
 *
 * R-047: injectRulesIntoDelegateTask — idempotent rule injection into
 *   delegate_task payload text. Called from the delegate_task intercept
 *   (R-038) to propagate hima governance rules to subagents spawned via
 *   Hermes.
 *
 * R-048: markSubagentSeen / isSubagentSeen — session-scoped dedup registry
 *   stored at `.hima/state/subagent-seen-<sessionId>.json`. Addresses the
 *   Hermes replay bug where the same subagent_stop event fires 6+ times;
 *   callers check isSubagentSeen before re-evaluating the gate and call
 *   markSubagentSeen on first observation.
 *
 * See: ARCHITECTURE-v3.md §3.6; SPEC-007-adapter-hermes.md §HIGH dedup;
 *      V3-COMPLETENESS-AUDIT.md R-047, R-048.
 */

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile, withFileLock } from "@norm/storage-core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum character length for the rules payload before truncation. */
const MAX_RULES_CHARS = 3000;

/** Sentinel token used both to detect already-injected payloads (idempotency)
 *  and as the heading line of the injected block. */
const INJECTION_MARKER = "[HIMA RULES INJECTED]";

// ---------------------------------------------------------------------------
// R-047 — injectRulesIntoDelegateTask
// ---------------------------------------------------------------------------

/**
 * Inject hima governance rules into a delegate_task payload text.
 *
 * Idempotent: if `taskText` already contains the injection marker the original
 * text is returned unchanged — double-calls are safe.
 *
 * Size guard: when `rulesSerialized` exceeds MAX_RULES_CHARS (3 000) characters
 * only the first 3 000 characters are appended followed by `"...[truncated]"`.
 *
 * Format (normal):
 * ```
 * <taskText>
 *
 * ---
 * [HIMA RULES INJECTED]
 * <rulesSerialized>
 * ---
 * ```
 *
 * Format (truncated):
 * ```
 * <taskText>
 *
 * ---
 * [HIMA RULES INJECTED]
 * <rulesSerialized[:3000]>...[truncated]
 * ---
 * ```
 *
 * @param taskText        Original delegate_task payload text.
 * @param rulesSerialized Serialised hima rules to append.
 * @returns               Modified payload text, or the original when already injected.
 */
export function injectRulesIntoDelegateTask(
  taskText: string,
  rulesSerialized: string,
): string {
  // Idempotency guard — never inject twice.
  if (taskText.includes(INJECTION_MARKER)) {
    return taskText;
  }

  // Size guard — truncate oversize payloads.
  const rulesContent =
    rulesSerialized.length > MAX_RULES_CHARS
      ? `${rulesSerialized.slice(0, MAX_RULES_CHARS)}...[truncated]`
      : rulesSerialized;

  return `${taskText}\n\n---\n${INJECTION_MARKER}\n${rulesContent}\n---`;
}

// ---------------------------------------------------------------------------
// R-048 — subagent-seen dedup registry
// ---------------------------------------------------------------------------

/**
 * Resolve the path to the per-session seen-set file.
 *
 * `<root>/.hima/state/subagent-seen-<sessionId>.json`
 */
function seenFilePath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", `subagent-seen-${sessionId}.json`);
}

/**
 * Lock directory path used to serialise concurrent writes to the seen-set.
 */
function seenLockPath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", `.subagent-seen-${sessionId}.lock`);
}

/**
 * Compound key for a (agentId, event) pair stored in the seen set.
 *
 * Using a `":"` separator follows the same convention as the capability-map
 * compound keys throughout the codebase (`"agentId:event"`).
 */
function seenKey(agentId: string, event: string): string {
  return `${agentId}:${event}`;
}

/**
 * Read and parse the on-disk seen set as a string array.
 *
 * Returns `[]` on ENOENT, malformed JSON, or wrong shape — matching the
 * defensive read pattern used by read-set.ts and skill-state.ts.
 */
async function readSeenSetFromDisk(filePath: string): Promise<string[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * markSubagentSeen — persist that a (agentId, event) pair was observed for
 * this session.
 *
 * Writes atomically under a file lock. Deduplicates: if the compound key is
 * already present the file is not rewritten (no-op).
 *
 * @param root       Project root (directory containing `.hima/`).
 * @param sessionId  Active session identifier.
 * @param agentId    Hermes agent identifier from the hook payload.
 * @param event      Hook event name (e.g. `"subagent_stop"`).
 */
export async function markSubagentSeen(
  root: string,
  sessionId: string,
  agentId: string,
  event: string,
): Promise<void> {
  const key = seenKey(agentId, event);
  const filePath = seenFilePath(root, sessionId);
  const lockPath = seenLockPath(root, sessionId);

  // Ensure the state directory exists before acquiring the lock.
  await mkdir(path.dirname(filePath), { recursive: true });

  await withFileLock(lockPath, async () => {
    // Re-read inside the lock to avoid lost-update races.
    const current = await readSeenSetFromDisk(filePath);
    if (current.includes(key)) {
      return; // Already recorded — nothing to write.
    }
    const updated = [...current, key];
    await atomicWriteFile(filePath, `${JSON.stringify(updated, null, 2)}\n`);
  });
}

/**
 * isSubagentSeen — check whether a (agentId, event) pair was already observed
 * in this session.
 *
 * Reads the on-disk seen set on every call (no in-memory cache) to stay
 * accurate across concurrent hook invocations from distinct processes.
 *
 * @param root       Project root.
 * @param sessionId  Active session identifier.
 * @param agentId    Hermes agent identifier.
 * @param event      Hook event name.
 * @returns          `true` when the pair was previously recorded via markSubagentSeen.
 */
export async function isSubagentSeen(
  root: string,
  sessionId: string,
  agentId: string,
  event: string,
): Promise<boolean> {
  const key = seenKey(agentId, event);
  const filePath = seenFilePath(root, sessionId);
  const current = await readSeenSetFromDisk(filePath);
  return current.includes(key);
}
