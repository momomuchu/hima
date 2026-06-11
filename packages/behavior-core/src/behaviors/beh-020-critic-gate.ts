// Ported from packages/core/src/behaviors/beh-020-critic-gate.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast } from "../risk-class.js";

export const REVIEWER_EVIDENCE_PATH = "subagent_output" as const;
export const REVIEWER_ACCEPTED_VERDICTS = ["APPROVED", "CHANGES_REQUIRED"] as const;
export type ReviewerVerdict = (typeof REVIEWER_ACCEPTED_VERDICTS)[number];

export function hasReviewerEvidence(context: GateEvaluationContext): boolean {
  const evidence = context.runSet.evidence ?? [];
  return evidence.some((item) => {
    if (item.key !== REVIEWER_EVIDENCE_PATH) return false;
    const meta = item.metadata as Record<string, unknown> | undefined;
    if (!meta) return false;
    if (meta.role !== "reviewer") return false;
    const verdict = meta.verdict as string | undefined;
    return verdict === "APPROVED" || verdict === "CHANGES_REQUIRED";
  });
}

export const beh020CriticGate: BehaviorDescriptor = {
  id: "BEH-020",
  name: "Critic Gate — Reviewer Required Before Verify-to-Capitalize",
  gates: ["subagent_stop"],

  classify(context: GateEvaluationContext, _event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;
    if (!riskAtLeast(riskClass, "M")) return null;

    const subPhase = context.runSet.route?.subPhase;
    if (subPhase !== "Verify") return null;

    if (hasReviewerEvidence(context)) return null;

    return {
      decision: "block",
      reason:
        "BEH-020: Verify-to-Capitalize transition blocked — no reviewer subagent evidence " +
        `found in run-set.json#/evidence for risk class ${riskClass}. ` +
        "A reviewer subagent must produce an APPROVED or CHANGES_REQUIRED record " +
        "before the build/Capitalize sub-phase may begin.",
      violationType: "DONE_WITHOUT_EVIDENCE",
      qualityDimension: "review",
      finalState: undefined,
    };
  },
};
