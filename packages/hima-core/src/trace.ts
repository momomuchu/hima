import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { TraceEvent } from "@norm/schemas";
import { decodeTraceEventEither } from "@norm/schemas";

/**
 * trace — per-session JSONL trace emitter.
 *
 * Restores the persistent, queryable observability that the old @harness CLI
 * provided via events.jsonl. Each gate invocation in the v3 pipeline appends
 * one structured JSON line to `.hima/state/trace/<sessionId>.jsonl`.
 *
 * Design choices:
 *   - Appending a single line is atomic enough for our throughput (one gate
 *     per hook invocation, no concurrent writers per session).
 *   - All I/O errors are swallowed so a tracing failure never disrupts the hook.
 *   - readTrace validates each line through decodeTraceEventEither and silently
 *     drops malformed records — the remaining well-formed events are still useful.
 *
 * See: SPEC-007-adapter-hermes.md §observability, ARCHITECTURE-v3.md §3.2.
 */

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

/**
 * Canonical absolute path to the per-session JSONL trace file.
 *
 * `<root>/.hima/state/trace/<sessionId>.jsonl`
 */
export function traceFilePath(root: string, sessionId: string): string {
  return path.join(root, ".hima", "state", "trace", `${sessionId}.jsonl`);
}

// ---------------------------------------------------------------------------
// appendTrace
// ---------------------------------------------------------------------------

/**
 * Append one TraceEvent as a JSON line to the session trace file.
 *
 * - Creates `.hima/state/trace/` if it does not exist.
 * - Appends `JSON.stringify(event) + "\n"` — a single write is atomic enough
 *   for one-writer-per-session JSONL semantics.
 * - Swallows all errors so that tracing never breaks the hook pipeline.
 *
 * @param root       Project root (e.g. process.cwd() at hook invocation time).
 * @param event      The gate evaluation record to persist.
 * @param sessionId  Identifies which trace file to write to.
 *                   When omitted, falls back to `event.sessionId` (which is
 *                   always present in the v3 TraceEvent schema).
 */
export async function appendTrace(
  root: string,
  event: TraceEvent,
  sessionId?: string,
): Promise<void> {
  try {
    const sid = sessionId ?? event.sessionId;
    const filePath = traceFilePath(root, sid);
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // swallow — tracing must never break the hook
  }
}

// ---------------------------------------------------------------------------
// readTrace
// ---------------------------------------------------------------------------

/**
 * Read and parse the JSONL trace file for a given session.
 *
 * - Returns `[]` if the file does not exist (ENOENT) or is unreadable.
 * - Skips empty lines silently.
 * - Skips non-JSON lines and lines that fail schema validation silently;
 *   the remaining well-formed events are still returned.
 *
 * @param root       Project root.
 * @param sessionId  Identifies which trace file to read.
 * @returns          Ordered array of validated TraceEvent records.
 */
export async function readTrace(root: string, sessionId: string): Promise<TraceEvent[]> {
  const filePath = traceFilePath(root, sessionId);

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    // ENOENT or any other read error → no events
    return [];
  }

  const events: TraceEvent[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed: unknown = JSON.parse(trimmed);
      const result = decodeTraceEventEither(parsed);
      if (result._tag === "Right") {
        events.push(result.right);
      }
      // _tag === "Left" → schema validation failed → skip silently
    } catch {
      // JSON.parse failure → skip silently
    }
  }

  return events;
}
