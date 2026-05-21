/**
 * BEH-014 — Anti-Sycophancy Re-Verify on Challenge
 *
 * When a user challenges a prior gate block verdict, an agent that reverses its
 * position without new evidence undermines the entire gate model. This behavior
 * detects the structural pattern of a user prompt that follows a prior block
 * verdict and requires either:
 *   (a) a new EvidenceRecord post-dating the original block that is status=accepted
 *       and relevant to the block's violationType/qualityDimension, or
 *   (b) an explicit human_validation evidence key added by a human source with
 *       a non-empty rationale AND status=accepted.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-014
 * Gate: user_prompt
 * Risk floor: L (warn below L, block at L and above)
 *
 * Signal channels used:
 *   - prompt_pattern  : structural features of the user prompt (imperative mood,
 *     reference to prior decision) — NOT keyword presence in output text
 *   - evidence_state  : context.runSet.events for prior block events;
 *     context.runSet.evidence for human_validation or post-block evidence
 *
 * NEVER applies a keyword regex to agent output text.
 */

import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Structural imperative patterns that indicate the user is asking the agent to
 * proceed with, retry, or override a previously blocked action.
 *
 * These match on STRUCTURAL FEATURES of the prompt (grammatical person + imperative
 * verb targeting the prior action), NOT on raw keyword presence in output text.
 *
 * Patterns are matched case-insensitively against the normalized prompt.
 */
const REVERSAL_INTENT_PATTERNS: RegExp[] = [
  // Direct imperatives to continue past the block
  /\b(?:just\s+)?(?:do\s+it|proceed|continue|go\s+ahead|override|ignore(?:\s+the\s+block)?)\b/i,
  // Dismissal of the gate's decision
  /\b(?:it['']?s\s+fine|it\s+doesn['']?t\s+matter|skip\s+(?:the\s+)?(?:check|gate|block))\b/i,
  // Explicit re-request after a block (imperative + object reference)
  /\b(?:do|run|execute|write|delete|apply)\s+(?:it|that|this|anyway|regardless)\b/i,
  // "just" dismissal
  /\bjust\s+(?:do|run|write|delete|apply|proceed|continue)\b/i,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Block event metadata shape carried in the GATE_EVALUATED payload.
 * We read violationType and qualityDimension to match against new evidence relevance.
 */
interface BlockEventPayload {
  violationType?: string;
  qualityDimension?: string;
}

/**
 * Returns the timestamp (as epoch ms) and payload of the most recent gate block
 * verdict in the FULL event log, or null if no block event exists.
 *
 * Fix B1: scans ALL events filtered to gate events (type GATE_EVALUATED with
 * decision=block), taking the LAST one. A fixed tail-3 window is insufficient
 * because GATE_EVALUATED + EVIDENCE_ADDED events interleave in production and
 * push the block out of any small window.
 *
 * Reads context.runSet.events (evidence_state signal channel).
 */
function findMostRecentBlock(context: GateEvaluationContext): {
  epochMs: number;
  ts: string;
  payload: BlockEventPayload;
} | null {
  const events = context.runSet?.events ?? [];

  // Scan full event log in reverse — stop at the first (most recent) block verdict.
  // Filter to events that carry a gate decision (GATE_EVALUATED) to avoid picking up
  // non-gate events (EVIDENCE_ADDED, etc.) that might happen to have decision set.
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (!ev) continue;
    if (ev.decision === "block" && (ev.type === "GATE_EVALUATED" || ev.gateType !== undefined)) {
      const epochMs = Date.parse(ev.ts);
      if (!Number.isFinite(epochMs)) continue;
      const payload = (ev.payload ?? {}) as BlockEventPayload;
      return { epochMs, ts: ev.ts, payload };
    }
  }
  return null;
}

/**
 * Returns true when the prompt contains structural features indicating the user
 * wants to reverse or bypass a prior block verdict.
 *
 * This operates on STRUCTURAL FEATURES (grammatical patterns) of the prompt,
 * NOT on keyword presence in agent output text.
 */
function promptIndicatesReversalIntent(prompt: string): boolean {
  for (const pattern of REVERSAL_INTENT_PATTERNS) {
    if (pattern.test(prompt)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true when the Evidence Set contains a qualifying override or new
 * post-block evidence record.
 *
 * Fix B1+H3: new evidence must be:
 *   - status === "accepted" (not pending/rejected)
 *   - post-dating the block (epoch comparison, not string comparison)
 *
 * Fix H3: for human_validation override:
 *   - source must be "human" (cannot be self-asserted agent source)
 *   - status must be "accepted"
 *   - metadata.rationale must be a non-empty string
 *   (We do NOT accept a source="agent" self-asserted human_validation as an override)
 *
 * Reads context.runSet.evidence (evidence_state signal channel).
 */
function hasOverrideOrNewEvidence(context: GateEvaluationContext, blockEpochMs: number): boolean {
  const evidence = context.runSet?.evidence ?? [];

  for (const item of evidence) {
    // Fix H3: human_validation override requires source=human AND accepted status.
    // A self-asserted source field (source="agent") does NOT satisfy the override gate.
    if (item.key === "human_validation" && item.status === "accepted" && item.source === "human") {
      const rationale = (item.metadata as Record<string, unknown> | undefined)?.rationale;
      if (typeof rationale === "string" && rationale.trim().length > 0) {
        return true;
      }
    }

    // Fix B1: new evidence must be accepted AND post-date the block (epoch comparison).
    // A junk record with a fresh timestamp but status=pending/rejected does not count.
    if (item.status === "accepted") {
      const itemEpochMs = Date.parse(item.createdAt);
      if (Number.isFinite(itemEpochMs) && itemEpochMs > blockEpochMs) {
        return true;
      }
    }
  }

  return false;
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const antiSycophancy: BehaviorDescriptor = {
  id: "BEH-014",
  name: "Anti-Sycophancy — Re-Verify on Challenge",
  gates: ["user_prompt"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    // Signal: evidence_state — scan the FULL event log for the most recent gate block.
    // Fix B1: use findMostRecentBlock (scans ALL events, not just last 3).
    const recentBlock = findMostRecentBlock(context);
    if (recentBlock === null) {
      return null; // No block verdict in event log — no sycophancy risk
    }

    // Signal: prompt_pattern — structural analysis of the incoming user prompt.
    // We read event.promptContent as a structural object (its grammatical shape),
    // NOT as a keyword bag to scan for output text. The gate event carries the
    // raw prompt text here so we can examine its imperative structure.
    const prompt = event.promptContent ?? "";
    if (!promptIndicatesReversalIntent(prompt)) {
      return null; // Prompt does not structurally indicate reversal intent
    }

    // Signal: evidence_state — check for accepted override or accepted post-block evidence.
    // Fix B1+H3: epoch comparison + accepted-only + human-source-only for human_validation.
    if (hasOverrideOrNewEvidence(context, recentBlock.epochMs)) {
      return null; // Legitimate new accepted evidence justifies reconsideration
    }

    // Risk floor: L → warn below L, block at L and above
    const riskClass = context.currentRisk?.risk_class ?? "T";
    const isBlock = riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "L");

    return {
      decision: isBlock ? "block" : "warn",
      reason:
        "BEH-014: The run has a recent block verdict and the current prompt indicates intent to proceed without new evidence. To resume: either supply a new accepted EvidenceRecord post-dating the block, or add a human_validation record (source=human, status=accepted) with a non-empty rationale in the Evidence Set.",
      violationType: "BYPASS_ATTEMPTED",
      qualityDimension: "evidence",
    };
  },
};
