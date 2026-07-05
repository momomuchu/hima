/**
 * BEH_ANTI_SYCOPHANCY — Anti-sycophancy advisory at PostToolUse (R-022).
 *
 * At every post_tool gate, scan ctx.agentOutput for compliance-without-evaluation
 * signals — phrases like "great idea", "absolutely", "you are right", "exactly right"
 * that indicate the agent agreed with the user's framing without naming a competing
 * hypothesis. Absent an explicit counter-hypothesis, the user cannot calibrate trust.
 *
 * At M+ risk class, such output triggers an advisory warn pointing back to the
 * INPUT-HYPOTHESIS kernel rule ("[ALWAYS][INPUT-HYPOTHESIS]: treat the user's stated
 * diagnosis as a hypothesis to verify — not as ground truth"). At T/L risk or when
 * no such signals are found the gate allows immediately.
 *
 * This behavior is ADVISORY (warn), never block.
 *
 * Decision tree:
 *   1. agentOutput is absent or empty → allow.
 *   2. riskClass < M (T or L) → allow (advisory not warranted at low stakes).
 *   3. No sycophancy signal in output → allow.
 *   4. Signal detected at M+ → warn.
 *
 * Sycophancy signals (case-insensitive, word-boundary anchored):
 *   "great idea", "absolutely", "you are right", "exactly right"
 *
 * violationType: n/a (advisory only — warn never carries violationType)
 * gates:         ["post_tool"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-022,
 *      BEHAVIOR-CATALOG-v3.md §4.2 A-17,
 *      CLAUDE.md [ALWAYS][INPUT-HYPOTHESIS].
 */

import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";
import { RISK_ORDER } from "@norm/schemas";
import type { RiskClass } from "@norm/schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-ANTI-SYCOPHANCY";

/**
 * Compliance-without-evaluation signals.
 *
 * Matched case-insensitively with word-boundary anchors. The alternation covers
 * the four canonical signals from the spec; additional phrases can be added here
 * without changing the behavior contract.
 *
 * "absolutely" is a single word and can appear standalone ("Absolutely!") or as
 * the start of a phrase ("Absolutely, I agree"), so the word-boundary anchor is
 * intentionally placed around the whole word — not just at the end of the phrase.
 */
const SYCOPHANCY_PATTERN =
  /\b(great\s+idea|absolutely|you\s+are\s+right|exactly\s+right)\b/i;

/**
 * Safe RISK_ORDER lookup.
 * noUncheckedIndexedAccess makes the return type `number | undefined`; the
 * value is always present by construction (RISK_ORDER covers all RiskClass literals).
 */
function riskOrder(rc: RiskClass): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return RISK_ORDER[rc]!;
}

/** Minimum numeric risk order at which the advisory is active (M = 2). */
const WARN_FLOOR = riskOrder("M");

// ---------------------------------------------------------------------------
// BEH_ANTI_SYCOPHANCY descriptor
// ---------------------------------------------------------------------------

export const BEH_ANTI_SYCOPHANCY: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the post_tool gate (agent output is available after tool call).
  gates: ["post_tool"],

  // Synchronous: all checks operate on in-memory agentOutput and riskClass —
  // no filesystem I/O required.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { agentOutput, riskClass } = ctx;

    // ── 1. No agent output → allow ───────────────────────────────────────────
    if (!agentOutput || agentOutput.trim() === "") {
      return {
        decision: "allow",
        reason: "no agent output to scan — anti-sycophancy gate not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 2. Risk class below M (T or L) → allow ───────────────────────────────
    // The advisory is not warranted for trivial or low-stakes work where
    // conversational agreement is expected and harmless.
    if (riskOrder(riskClass) < WARN_FLOOR) {
      return {
        decision: "allow",
        reason: `risk class ${riskClass} is below M — anti-sycophancy advisory not active`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 3. No sycophancy signal → allow ──────────────────────────────────────
    if (!SYCOPHANCY_PATTERN.test(agentOutput)) {
      return {
        decision: "allow",
        reason: "no compliance-without-evaluation signal detected",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 4. Signal detected at M+ → warn ──────────────────────────────────────
    // Advisory: the gate proceeds but injects a counter-hypothesis nudge.
    return {
      decision: "warn",
      reason:
        `[${BEHAVIOR_ID}] agreement without naming a competing hypothesis — verify independently`,
      behaviorId: BEHAVIOR_ID,
    };
  },
};
