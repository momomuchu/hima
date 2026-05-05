import { type EvidenceSufficiency, isEvidenceSufficient } from "../evidence/evaluate-evidence.js";
import { getPolicyEventBlockers } from "../gates/policy-event-blockers.js";
import { getRequiredGates, mergeRequiredGates } from "../policy/baseline-policy.js";
import {
  assessRuntimeBinding,
  type RuntimeBindingAssessment,
} from "../runtime/runtime-bindings.js";
import type { CurrentRiskFile } from "../schemas/current-risk.schema.js";
import type { RunSetFile } from "../schemas/run-set.schema.js";
import type { PlanningStateFile } from "../schemas/state.schema.js";
import type { FinalState, GateType, RiskClass } from "../types/canonical.js";
import { riskAtLeast } from "../types/canonical.js";

export type ConvergenceStatus = "verified" | "done_with_gaps" | "blocked";

export interface ConvergenceContext {
  readonly state: PlanningStateFile;
  readonly currentRisk: CurrentRiskFile;
  readonly runSet: RunSetFile;
}

export interface RuntimeBindingHealth {
  readonly healthy: boolean;
  readonly requiredGates: GateType[];
  readonly assessments: RuntimeBindingAssessment[];
  readonly gaps: string[];
}

export interface FinalizationRecommendation {
  readonly finalState: FinalState;
  readonly runSetState: RunSetFile["finalization"]["state"];
  readonly reason: string;
}

export interface ConvergenceEvaluation {
  readonly score: number;
  readonly status: ConvergenceStatus;
  readonly blockers: string[];
  readonly gaps: string[];
  readonly evidenceSufficiency: EvidenceSufficiency;
  readonly runtimeBindingHealth: RuntimeBindingHealth;
  readonly finalizationRecommendation: FinalizationRecommendation;
}

const BLOCKING_CAPABILITY_GATES = new Set<GateType>([
  "user_prompt",
  "pre_tool",
  "stop",
  "subagent_start",
  "subagent_stop",
]);

export function evaluateConvergence(context: ConvergenceContext): ConvergenceEvaluation {
  const riskClass = context.currentRisk.risk_class;
  const evidenceSufficiency = isEvidenceSufficient(context.runSet.evidence, riskClass);
  const runtimeBindingHealth = assessRouteRuntimeBindings(context.runSet, riskClass);
  const policyEventBlockers = getPolicyEventBlockers(context.runSet);
  const blockers = getBlockers(
    riskClass,
    evidenceSufficiency,
    runtimeBindingHealth,
    policyEventBlockers,
  );
  const gaps = [
    ...evidenceSufficiency.missingEvidenceKeys.map((key) => `missing evidence: ${key}`),
    ...runtimeBindingHealth.gaps,
    ...policyEventBlockers,
  ];
  const finalizationRecommendation = recommendFinalization(
    riskClass,
    blockers,
    gaps,
    evidenceSufficiency,
    runtimeBindingHealth,
    policyEventBlockers,
  );

  return {
    score: scoreConvergence(blockers, gaps, evidenceSufficiency, runtimeBindingHealth),
    status:
      finalizationRecommendation.finalState === "DONE_VERIFIED"
        ? "verified"
        : finalizationRecommendation.finalState === "DONE_WITH_GAPS"
          ? "done_with_gaps"
          : "blocked",
    blockers,
    gaps,
    evidenceSufficiency,
    runtimeBindingHealth,
    finalizationRecommendation,
  };
}

export function assessRouteRuntimeBindings(
  runSet: Pick<RunSetFile, "runtimeBindings" | "subagents" | "policy">,
  riskClass: RiskClass,
): RuntimeBindingHealth {
  const requiredGates = mergeRequiredGates(
    getRequiredGates(riskClass, {
      delegationPlanned: runSet.subagents.length > 0,
    }),
    runSet.policy.riskPolicies?.[riskClass]?.requiredGates,
  );
  const assessments = requiredGates.map((gateType) =>
    assessRuntimeBinding(runSet.runtimeBindings, gateType, {
      requireBlockingCapability: BLOCKING_CAPABILITY_GATES.has(gateType),
    }),
  );
  const gaps = assessments
    .filter((assessment) => assessment.blockingProblem)
    .map((assessment) =>
      assessment.availabilityProblem
        ? `runtime binding unavailable for ${assessment.binding.gateType}: ${assessment.binding.reason}`
        : `runtime binding for ${assessment.binding.gateType} lacks required blocking capability: ${assessment.binding.reason}`,
    );

  return {
    healthy: gaps.length === 0,
    requiredGates,
    assessments,
    gaps,
  };
}

function getBlockers(
  riskClass: RiskClass,
  evidenceSufficiency: EvidenceSufficiency,
  runtimeBindingHealth: RuntimeBindingHealth,
  policyEventBlockers: readonly string[],
): string[] {
  if (!riskAtLeast(riskClass, "M")) {
    return [...policyEventBlockers];
  }

  return [
    ...evidenceSufficiency.missingEvidenceKeys.map((key) => `missing mandatory evidence: ${key}`),
    ...runtimeBindingHealth.gaps,
    ...policyEventBlockers,
  ];
}

function recommendFinalization(
  riskClass: RiskClass,
  blockers: readonly string[],
  gaps: readonly string[],
  evidenceSufficiency: EvidenceSufficiency,
  runtimeBindingHealth: RuntimeBindingHealth,
  policyEventBlockers: readonly string[],
): FinalizationRecommendation {
  if (blockers.length > 0) {
    const finalState =
      policyEventBlockers.length > 0 || runtimeBindingHealth.healthy
        ? "BLOCKED_POLICY"
        : "BLOCKED_RUNTIME_MISSING";

    return {
      finalState,
      runSetState: finalState,
      reason: blockers.join("; "),
    };
  }

  if (evidenceSufficiency.sufficient && runtimeBindingHealth.healthy) {
    return {
      finalState: "DONE_VERIFIED",
      runSetState: "DONE_VERIFIED",
      reason: `Evidence and runtime bindings are sufficient for risk ${riskClass}`,
    };
  }

  return {
    finalState: "DONE_WITH_GAPS",
    runSetState: "DONE_WITH_GAPS",
    reason:
      gaps.length > 0
        ? `Permissive close with transparent gaps: ${gaps.join("; ")}`
        : "Permissive close with non-blocking gaps",
  };
}

function scoreConvergence(
  blockers: readonly string[],
  gaps: readonly string[],
  evidenceSufficiency: EvidenceSufficiency,
  runtimeBindingHealth: RuntimeBindingHealth,
): number {
  if (blockers.length > 0) {
    return 0;
  }

  const evidenceScore = evidenceSufficiency.sufficient ? 50 : 25;
  const runtimeScore = runtimeBindingHealth.healthy ? 50 : 25;
  const gapPenalty = Math.min(gaps.length * 5, 25);

  return Math.max(0, evidenceScore + runtimeScore - gapPenalty);
}
