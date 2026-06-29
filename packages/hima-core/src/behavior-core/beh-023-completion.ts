/**
 * BEH-023 — Completion gate: reject fake-done verdicts.
 *
 * At every "stop" gate, scan the agent's output for completion lexemes
 * (DONE, DONE_VERIFIED, MASTERED, complete, finished, shipped). When a
 * claim is found:
 *
 *   - At M/H/C risk: verify that ward.verdicts contains at least one entry
 *     with status "done-verified" or "done-validated". If not → block with
 *     violationType DONE_WITHOUT_EVIDENCE.
 *   - At T/L risk: demote to warn (block is disproportionate for low-stakes work).
 *   - No claim in output → allow.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-005,
 *      BEHAVIOR-CATALOG-v3.md T-01/T-02/T-07,
 *      ARCHITECTURE-v3.md §3.2 (claude/stop canBlock=true).
 */

import type { BehaviorDescriptor, BehaviorVerdict, BehaviorContext } from "./types.js";
import { RISK_ORDER } from "@hima/schemas";
import type { RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-023";

/**
 * Lexemes that signal the agent is asserting task completion. Case-insensitive,
 * whole-word match to avoid false positives on partial tokens (e.g. "completed"
 * should match, but so should bare "complete").
 */
const COMPLETION_PATTERN = /\b(DONE|DONE_VERIFIED|MASTERED|complete|finished|shipped)\b/i;

/**
 * Safe RISK_ORDER lookup — RISK_ORDER is exhaustive over RiskClass so the
 * value is always present, but noUncheckedIndexedAccess makes the type
 * `number | undefined`. The non-null assertion is safe here by construction.
 */
function riskOrder(rc: RiskClass): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return RISK_ORDER[rc]!;
}

/** The minimum numeric risk order at which we hard-block (M and above). */
const BLOCK_FLOOR = riskOrder("M");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true when the ward has at least one stage verdict with a status that
 * counts as independently verified (done-verified or done-validated).
 */
function hasVerifiedEvidence(
  ward: NonNullable<BehaviorContext["ward"]>,
): boolean {
  return ward.verdicts.some(
    (v) => v.status === "done-verified" || v.status === "done-validated",
  );
}

// ---------------------------------------------------------------------------
// BEH_023 descriptor
// ---------------------------------------------------------------------------

export const BEH_023: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the stop gate (agent turn complete, output emitted).
  gates: ["stop"],

  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { agentOutput, riskClass, ward } = ctx;

    // No agent output → nothing to scan → allow.
    if (!agentOutput || agentOutput.trim() === "") {
      return { decision: "allow", reason: "no agent output to scan", behaviorId: BEHAVIOR_ID };
    }

    // No completion claim in output → allow.
    if (!COMPLETION_PATTERN.test(agentOutput)) {
      return { decision: "allow", reason: "no completion claim detected", behaviorId: BEHAVIOR_ID };
    }

    // Completion claim found. Decide based on risk level.
    const numericRisk = riskOrder(riskClass);

    if (numericRisk < BLOCK_FLOOR) {
      // T or L: warn only — block is disproportionate for low-stakes work.
      return {
        decision: "warn",
        reason:
          `[${BEHAVIOR_ID}] Completion claim detected ("DONE/MASTERED/...") at risk class ` +
          `${riskClass}. No verified evidence required at this floor, but consider ` +
          `capturing a stage verdict before asserting completion.`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // M/H/C: require at least one done-verified verdict in the ward.
    if (!ward) {
      // No ward at all → no evidence possible → block.
      return {
        decision: "block",
        reason:
          `[${BEHAVIOR_ID}] Completion claim detected at risk class ${riskClass} but no ` +
          `active ward exists. Cannot verify evidence. Use \`hima hook stage-advance\` to ` +
          `record a verified stage verdict before asserting DONE.`,
        behaviorId: BEHAVIOR_ID,
        violationType: "DONE_WITHOUT_EVIDENCE",
      };
    }

    if (hasVerifiedEvidence(ward)) {
      // Evidence present → allow.
      return {
        decision: "allow",
        reason:
          `[${BEHAVIOR_ID}] Completion claim verified: ward contains at least one ` +
          `done-verified stage verdict.`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // Ward exists but has no verified verdict → block.
    return {
      decision: "block",
      reason:
        `[${BEHAVIOR_ID}] Completion claim detected at risk class ${riskClass} but ` +
        `ward "${ward.id}" has no done-verified stage verdict. Record evidence via ` +
        `\`hima hook stage-advance --status=done-verified\` before asserting DONE.`,
      behaviorId: BEHAVIOR_ID,
      violationType: "DONE_WITHOUT_EVIDENCE",
    };
  },
};
