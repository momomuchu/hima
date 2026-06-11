// Ported from packages/core/src/behaviors/beh-021-dimension-retry.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast } from "../risk-class.js";
import type { QualityDimension } from "../types.js";

export interface DimensionRetryPolicy {
  readonly maxAttempts: number;
  readonly escalateImmediately: boolean;
}

export const DIMENSION_RETRY_POLICY: Readonly<Record<QualityDimension, DimensionRetryPolicy>> = {
  security: { maxAttempts: 1, escalateImmediately: true },
  tests: { maxAttempts: 3, escalateImmediately: false },
  review: { maxAttempts: 2, escalateImmediately: false },
  evidence: { maxAttempts: 2, escalateImmediately: true },
  suppression: { maxAttempts: 3, escalateImmediately: false },
} as const;

export function countPriorViolationAttempts(context: GateEvaluationContext, dimension: QualityDimension): number {
  const events = context.runSet.events ?? [];
  return events.filter((e) => {
    if (e.type !== "GATE_EVALUATED") return false;
    if (e.decision !== "block" && e.decision !== "warn") return false;
    const payload = e.payload as Record<string, unknown> | undefined;
    return payload?.qualityDimension === dimension;
  }).length;
}

export const beh021DimensionRetry: BehaviorDescriptor = {
  id: "BEH-021",
  name: "Dimension-Specific Retry and Escalation Policy",
  gates: ["stop", "subagent_stop"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;
    if (!riskAtLeast(riskClass, "M")) return null;

    const meta = event.metadata as Record<string, unknown> | undefined;
    const dimension = meta?.qualityDimension as QualityDimension | undefined;
    if (!dimension || !(dimension in DIMENSION_RETRY_POLICY)) return null;

    const policy = DIMENSION_RETRY_POLICY[dimension];
    const priorAttempts = countPriorViolationAttempts(context, dimension);

    if (policy.escalateImmediately && riskAtLeast(riskClass, "H")) {
      return {
        decision: "block",
        reason:
          `BEH-021: ${dimension} dimension violation at risk class ${riskClass} ` +
          "requires immediate escalation — maxAttempts=1, escalateImmediately=true. " +
          "This run must be reviewed by a human before retrying.",
        violationType: "UNRESOLVED_POLICY_VIOLATION",
        qualityDimension: dimension,
        finalState: "BLOCKED_NEEDS_USER",
      };
    }

    if (priorAttempts >= policy.maxAttempts) {
      return {
        decision: "block",
        reason:
          `BEH-021: ${dimension} dimension violation has reached maxAttempts ` +
          `(${policy.maxAttempts}). Prior recorded attempts: ${priorAttempts}. ` +
          "Escalating to BLOCKED_NEEDS_USER — autonomous retry cap exhausted.",
        violationType: "UNRESOLVED_POLICY_VIOLATION",
        qualityDimension: dimension,
        finalState: "BLOCKED_NEEDS_USER",
      };
    }

    return {
      decision: "warn",
      reason:
        `BEH-021: ${dimension} dimension violation — attempt ${priorAttempts + 1} of ` +
        `${policy.maxAttempts} allowed. Policy: escalateImmediately=${policy.escalateImmediately}.`,
      qualityDimension: dimension,
    };
  },
};
