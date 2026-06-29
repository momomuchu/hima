/**
 * team-merge — mergeTeamOutputs()
 *
 * Merges an array of per-agent StageVerdict records produced by a parallel
 * role-team (fan-out lanes + adversarial validator) into a single StageVerdict
 * for the stage.
 *
 * Merge rules (M1–M6) per PARALLELIZATION-v3.md §4:
 *
 *   M1 — Any "blocked" verdict propagates to the stage result. No exceptions.
 *   M2 — When adversaryBlock=true the result is capped below "done-verified"
 *         (adversarial BLOCK findings prevent the highest status).
 *   M3 — Majority "partial" (no "blocked") → stage = "partial".
 *   M4 — All "done", no adversary block → stage = "done".
 *   M5 — "done-verified" requires ALL agents done + no adversary block +
 *         full expected-agent count present.
 *   M6 — Missing agents (verdicts.length < expectedAgents) → "partial".
 *
 * Status precedence (highest wins): blocked > partial > done > done-verified.
 * Note: "done-verified" is a promotion from "done" that requires M5 conditions.
 *
 * See: .planning/architecture/PARALLELIZATION-v3.md §4 — MERGE MODEL.
 */

import type { StageVerdict } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MergeOptions {
  /**
   * When true, adversarial-validator BLOCK findings are present — the result is
   * capped at "done" at most (M2). Prevents "done-verified" from being emitted.
   */
  adversaryBlock?: boolean;

  /**
   * Total expected number of agent verdicts for this stage. If verdicts.length
   * is less than this value, a stalled/missing lane is assumed → "partial" (M6).
   */
  expectedAgents?: number;
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type VerdictStatus = StageVerdict["status"];

/** Statuses that represent completed (non-blocked, non-partial) lanes. */
const DONE_STATUSES: ReadonlySet<VerdictStatus> = new Set([
  "done",
  "done-verified",
  "done-validated",
]);

// ---------------------------------------------------------------------------
// mergeTeamOutputs
// ---------------------------------------------------------------------------

/**
 * Merge an array of per-agent StageVerdict records into one StageVerdict for
 * the stage. Applies merge rules M1–M6.
 *
 * The returned StageVerdict carries:
 *   - stage: taken from the first verdict (all lanes share the same stage name)
 *   - status: the merged status per M1–M6
 *   - evidence: deduplicated union of all agent evidence arrays
 *
 * If `verdicts` is empty and no `expectedAgents` is set, returns "partial"
 * (no evidence available — treat as stalled stage).
 */
export function mergeTeamOutputs(
  verdicts: StageVerdict[],
  opts: MergeOptions = {},
): StageVerdict {
  const { adversaryBlock = false, expectedAgents } = opts;

  // Derive stage name from the first verdict, or fall back to "unknown".
  const stage = verdicts[0]?.stage ?? "unknown";

  // Deduplicated evidence union across all agents.
  const evidenceSet = new Set<string>();
  for (const v of verdicts) {
    for (const e of v.evidence) {
      evidenceSet.add(e);
    }
  }
  const evidence = Array.from(evidenceSet);

  const status = computeStatus(verdicts, adversaryBlock, expectedAgents);

  return { stage, status, evidence };
}

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

function computeStatus(
  verdicts: StageVerdict[],
  adversaryBlock: boolean,
  expectedAgents: number | undefined,
): VerdictStatus {
  // M6 — Missing agents (stalled/absent lane) → partial.
  // Checked first: a missing agent means we cannot reach "done" regardless.
  if (
    expectedAgents !== undefined &&
    verdicts.length < expectedAgents
  ) {
    return "partial";
  }

  // Edge: no verdicts submitted at all → partial (no evidence; cannot claim done).
  if (verdicts.length === 0) {
    return "partial";
  }

  // M1 — Any "blocked" propagates unconditionally.
  if (verdicts.some((v) => v.status === "blocked")) {
    return "blocked";
  }

  // M3 — Majority "partial" (none blocked at this point) → partial.
  const partialCount = verdicts.filter((v) => v.status === "partial").length;
  const majority = verdicts.length > 0 && partialCount > verdicts.length / 2;
  if (majority) {
    return "partial";
  }

  // At this point: no blocked, no majority partial.
  // Check whether ALL lanes are in a done-class status.
  const allDone = verdicts.every((v) => DONE_STATUSES.has(v.status));

  if (!allDone) {
    // At least one lane is "partial" (but not a majority) — still partial overall.
    return "partial";
  }

  // All lanes done (or done-verified / done-validated).

  // M2 / M5 — adversaryBlock caps the result below "done-verified".
  if (adversaryBlock) {
    // M2: adversarial BLOCK finding present → at most "done".
    return "done";
  }

  // M5 — done-verified requires: all agents done + full count + no adversary block.
  // If expectedAgents was supplied and we passed M6, the count is satisfied.
  // If expectedAgents was not supplied, we cannot confirm full count — emit "done".
  if (expectedAgents !== undefined) {
    // All conditions for done-verified are met.
    return "done-verified";
  }

  // M4 — All done, no adversary block, but count unverified → "done".
  return "done";
}
