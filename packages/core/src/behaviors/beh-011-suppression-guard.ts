/**
 * BEH-011 — Unjustified Suppression Guard
 *
 * Warning and lint suppressions inserted without an inline justification comment
 * are silent quality holes. This behavior scans the content of every file write
 * for suppression directives and requires an adjacent justification comment.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-011
 * Gate: post_tool
 * Risk floor: M (warn below, block at/above)
 *
 * Signal channels used:
 *   - tool_type       : toolName is "Write" or "Edit"
 *   - file_diff       : toolInput.content or toolInput.new_string (written bytes)
 *   - evidence_state  : action_signal.suppressionPatternFound pre-computed by BEH-000
 *
 * NEVER reads event.toolOutput or event.promptContent as raw text.
 */

import { detectSuppressionWithoutJustification } from "../gates/action-signal.js";
import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when toolName signals a file-mutation operation. */
function isWriteMutationTool(toolName: string): boolean {
  const n = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return n === "write" || n === "edit" || n === "multiedit" || n === "createfile";
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const suppressionGuard: BehaviorDescriptor = {
  id: "BEH-011",
  name: "Unjustified Suppression Guard",
  gates: ["post_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    // Signal: tool_type — only fires on Write/Edit mutations
    const toolName = event.toolName ?? "";
    if (!isWriteMutationTool(toolName)) {
      return null;
    }

    // Signal: file_diff — scan written bytes for unjustified suppression directives.
    // We delegate to the shared scanner from action-signal.ts so the detection logic
    // is not duplicated. The scanner reads toolInput.content / toolInput.new_string —
    // these are file bytes in the tool argument, not output text.
    const found = detectSuppressionWithoutJustification(event);
    if (!found) {
      return null;
    }

    // Risk floor: M → warn below M, block at M and above.
    const riskClass = context.currentRisk?.risk_class ?? "T";
    const isBlock = riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "M");

    return {
      decision: isBlock ? "block" : "warn",
      reason:
        "BEH-011: File write contains a suppression directive (eslint-disable / @ts-ignore / @ts-nocheck / #noqa / @SuppressWarnings) without an adjacent justification comment. Add a comment explaining WHY the suppression is necessary.",
      violationType: "BYPASS_ATTEMPTED",
      qualityDimension: "suppression",
    };
  },
};
