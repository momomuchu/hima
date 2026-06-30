/**
 * wave-log.ts — atomic JSONL writer for the founder feedback-wave audit log.
 *
 * Every completed feedback wave (triggered by BEH_FEEDBACK_WAVE / R-016)
 * appends one structured JSON line to `.hima/state/waves.log`. The log is
 * the machine-verifiable acceptance criterion for DONE_VERIFIED claims on
 * feedback waves per founder-feedback-scale.md §4 and §7.
 *
 * Design choices:
 *   - One line per wave (JSONL): human-readable and `jq`-friendly.
 *   - `appendFile` on a single file is atomic enough for our throughput
 *     (one wave completes at a time per session; no concurrent writers).
 *   - All I/O errors are swallowed so a logging failure never disrupts the
 *     pipeline. The worst outcome is a missing log entry — not a crash.
 *   - The directory `.hima/state/` is created lazily (recursive mkdir).
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-037,
 *      BEHAVIOR-CATALOG-v3.md §4.1 A-04,
 *      founder-feedback-scale.md §4 (wave-log-emit spec).
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single wave-log entry. Each field maps directly to the structured JSON
 * line appended to `.hima/state/waves.log`.
 *
 * Fields:
 *   wave_id         — UUID or short unique identifier for this wave.
 *   artifact        — The artifact token that triggered the wave (e.g. "la landing").
 *   trigger_path    — "full" (Path 1, explicit artifact + evaluative tokens) or
 *                     "fallback" (Path 2, implicit session artifact).
 *   lane_count      — Number of specialist lanes launched.
 *   models_used     — List of model identifiers used across lanes (e.g. ["sonnet", "haiku"]).
 *   pipeline_status — "complete", "partial", or "blocked" — the final wave state.
 *   ts              — ISO-8601 timestamp of the wave-log emission.
 */
export type WaveLogEntry = {
  wave_id: string;
  artifact: string;
  trigger_path: "full" | "fallback";
  lane_count: number;
  models_used: string[];
  pipeline_status: "complete" | "partial" | "blocked";
  ts: string;
};

// ---------------------------------------------------------------------------
// Path helper
// ---------------------------------------------------------------------------

/**
 * Canonical absolute path to the shared wave-log file.
 *
 * `<root>/.hima/state/waves.log`
 */
export function waveLogPath(root: string): string {
  return path.join(root, ".hima", "state", "waves.log");
}

// ---------------------------------------------------------------------------
// appendWaveLog
// ---------------------------------------------------------------------------

/**
 * Atomically append a wave-log entry as a JSON line to `.hima/state/waves.log`.
 *
 * - Creates `.hima/state/` if it does not exist (lazy, recursive mkdir).
 * - Appends `JSON.stringify(entry) + "\n"` — a single write is atomic enough
 *   for one-writer-per-session JSONL semantics.
 * - Swallows all I/O errors so that logging never disrupts the hook pipeline.
 *   The worst outcome is a missing log entry, not a process crash.
 *
 * @param root   Project root (e.g. process.cwd() at hook invocation time).
 * @param entry  The structured wave metadata to persist.
 */
export async function appendWaveLog(root: string, entry: WaveLogEntry): Promise<void> {
  try {
    const filePath = waveLogPath(root);
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // swallow — wave-log emission must never break the pipeline
  }
}
