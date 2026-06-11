// Ported from packages/core/src/behaviors/beh-023-completion-status.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast } from "../risk-class.js";
import type { CompletionStatus } from "../types.js";

export const INCOMPLETE_STATUSES: readonly CompletionStatus[] = [
  "DONE_UNTESTED",
  "ATTEMPTED_UNCONFIRMED",
] as const;

export interface IncompleteEvidenceResult {
  readonly incompleteIds: readonly string[];
  readonly worstStatus: CompletionStatus | null;
}

export function findIncompleteEvidenceRecords(context: GateEvaluationContext): IncompleteEvidenceResult {
  const evidence = context.runSet.evidence ?? [];
  const incompleteIds: string[] = [];
  let worstStatus: CompletionStatus | null = null;

  for (const item of evidence) {
    const status = item.completionStatus as CompletionStatus | undefined;
    if (!status) continue;
    if ((INCOMPLETE_STATUSES as readonly string[]).includes(status)) {
      incompleteIds.push(item.id);
      if (worstStatus === null || (status === "ATTEMPTED_UNCONFIRMED" && worstStatus === "DONE_UNTESTED")) {
        worstStatus = status;
      }
    }
  }

  return { incompleteIds, worstStatus };
}

export const beh023CompletionStatus: BehaviorDescriptor = {
  id: "BEH-023",
  name: "Three-State Completion Status",
  gates: ["stop"],

  classify(context: GateEvaluationContext, _event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;
    const { incompleteIds, worstStatus } = findIncompleteEvidenceRecords(context);

    if (incompleteIds.length === 0 || worstStatus === null) return null;

    const idList = incompleteIds.join(", ");
    const statusLabel = worstStatus;

    if (riskAtLeast(riskClass, "H")) {
      return {
        decision: "block",
        reason:
          `BEH-023: ${incompleteIds.length} evidence record(s) carry incompleteness ` +
          `status "${statusLabel}" at risk class ${riskClass}. ` +
          "All mandatory evidence must be upgraded to DONE_VERIFIED before DONE_VERIFIED " +
          `can be reached. Affected record IDs: ${idList}.`,
        violationType: "DONE_WITHOUT_EVIDENCE",
        qualityDimension: "evidence",
        finalState: "BLOCKED_POLICY",
      };
    }

    if (riskAtLeast(riskClass, "M")) {
      return {
        decision: "warn",
        reason:
          `BEH-023: ${incompleteIds.length} evidence record(s) carry incompleteness ` +
          `status "${statusLabel}" at risk class ${riskClass}. ` +
          `Upgrade to DONE_VERIFIED or explicitly acknowledge before promotion. Affected record IDs: ${idList}.`,
        qualityDimension: "evidence",
        finalState: "DONE_WITH_GAPS",
      };
    }

    return {
      decision: "warn",
      reason:
        `BEH-023: ${incompleteIds.length} evidence record(s) carry incompleteness ` +
        `status "${statusLabel}" at risk class ${riskClass}. ` +
        `Outcome will be DONE_WITH_GAPS. Affected record IDs: ${idList}.`,
      qualityDimension: "evidence",
      finalState: "DONE_WITH_GAPS",
    };
  },
};
