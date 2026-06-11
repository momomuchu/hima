// Ported from packages/core/src/behaviors/beh-011-suppression-guard.ts — no logic changes

import { detectSuppressionWithoutJustification } from "../action-signal.js";
import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast, type RiskClass } from "../risk-class.js";

function isWriteMutationTool(toolName: string): boolean {
  const n = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return n === "write" || n === "edit" || n === "multiedit" || n === "createfile";
}

export const suppressionGuard: BehaviorDescriptor = {
  id: "BEH-011",
  name: "Unjustified Suppression Guard",
  gates: ["post_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const toolName = event.toolName ?? "";
    if (!isWriteMutationTool(toolName)) return null;

    if (!detectSuppressionWithoutJustification(event)) return null;

    const riskClass = (context.currentRisk?.risk_class ?? "T") as RiskClass;
    const isBlock = riskAtLeast(riskClass, "M");
    return {
      decision: isBlock ? "block" : "warn",
      reason:
        "BEH-011: File write contains a suppression directive (eslint-disable / @ts-ignore / @ts-nocheck / #noqa / @SuppressWarnings) without an adjacent justification comment. Add a comment explaining WHY the suppression is necessary.",
      violationType: "BYPASS_ATTEMPTED",
      qualityDimension: "suppression",
    };
  },
};
