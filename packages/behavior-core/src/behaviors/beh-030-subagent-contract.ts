// Ported from packages/core/src/behaviors/beh-030-subagent-contract.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext, GateViolationType } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast } from "../risk-class.js";

export const VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE = "SUBAGENT_CONTRACT_INCOMPLETE" satisfies GateViolationType;

export const BEH_030_DEGRADED_MODE = {
  codex: "subagent_start not supported; parent must validate SubagentInput budget+failurePolicy before delegate_task; record WARN in run-set.json via pre_tool Write check on subagent definition file",
  hermes: "same as codex — subagent_start not supported; same pre_tool Write fallback path applies",
} as const;

const MAX_TURNS_HARD_CAP = 500;
const MAX_TIMEOUT_MS_HARD_CAP = 24 * 60 * 60 * 1000;

function readObjectMetadata(metadata: Record<string, unknown>, key: string, altKey?: string): Record<string, unknown> | null {
  const raw = metadata[key] ?? (altKey ? metadata[altKey] : undefined);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidPolicyAction(value: unknown): boolean {
  return value === "gap" || value === "retry" || value === "block";
}

function validateMaxTurns(budget: Record<string, unknown> | null): string | null {
  const maxTurns = budget?.maxTurns;
  if (!isPositiveNumber(maxTurns)) return "metadata.budget.maxTurns (positive integer required)";
  if ((maxTurns as number) > MAX_TURNS_HARD_CAP) return `metadata.budget.maxTurns=${maxTurns} exceeds hard cap ${MAX_TURNS_HARD_CAP}`;
  return null;
}

function validateTimeoutMs(budget: Record<string, unknown> | null): string | null {
  const timeoutMs = budget?.timeoutMs;
  if (!isPositiveNumber(timeoutMs)) return "metadata.budget.timeoutMs (positive integer required)";
  if ((timeoutMs as number) > MAX_TIMEOUT_MS_HARD_CAP) return `metadata.budget.timeoutMs=${timeoutMs} exceeds hard cap ${MAX_TIMEOUT_MS_HARD_CAP} (24h)`;
  return null;
}

export const subagentContractCompleteness: BehaviorDescriptor = {
  id: "BEH-030",
  name: "Subagent Contract — Budget and Failure Protocol Fields",
  gates: ["subagent_start"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;
    const metadata = event.metadata ?? {};
    const budget = readObjectMetadata(metadata, "budget");
    const failurePolicy = readObjectMetadata(metadata, "failurePolicy", "failure_policy");
    const missing: string[] = [];

    const maxTurnsError = validateMaxTurns(budget);
    if (maxTurnsError) missing.push(maxTurnsError);

    if (riskAtLeast(riskClass, "H")) {
      const timeoutError = validateTimeoutMs(budget);
      if (timeoutError) missing.push(timeoutError);
    }

    if (riskAtLeast(riskClass, "M")) {
      if (!failurePolicy || !isValidPolicyAction(failurePolicy.onTimeout)) missing.push("metadata.failurePolicy.onTimeout");
      if (!failurePolicy || !isValidPolicyAction(failurePolicy.onError)) missing.push("metadata.failurePolicy.onError");
      if (failurePolicy && (failurePolicy.onError === "retry" || failurePolicy.onTimeout === "retry")) {
        if (!isNonNegativeNumber(failurePolicy.maxRetries)) missing.push("metadata.failurePolicy.maxRetries");
      }
    }

    if (missing.length === 0) return null;

    const timeoutNote = riskAtLeast(riskClass, "H") ? ", timeoutMs" : "";
    const policyNote = riskAtLeast(riskClass, "M") ? " and failurePolicy (onTimeout, onError)" : "";
    return {
      decision: "block",
      reason: `BEH-030: subagent spawn blocked at risk class ${riskClass} — SubagentInput missing required contract fields: ${missing.join(", ")}. Add budget (maxTurns${timeoutNote})${policyNote} to the subagent metadata.`,
      violationType: VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE,
      qualityDimension: "evidence",
    };
  },
};
