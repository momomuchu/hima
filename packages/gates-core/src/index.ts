// gates-core — public API.
//
// Re-exports types and the fixed evaluateGate dispatcher.
// The stop gate is overridden locally to fix the requiresEvidenceBeforeStop bug.

export { evaluateGate } from "./evaluate-gate.js";
export { evaluateStop } from "./evaluate-stop.js";

// Re-export types consumers need so they don't have to depend on @harness/core directly.
export type {
  GateEvaluationContext,
  GateResult,
  GateViolationType,
} from "@harness/core";
export type { GateEvent } from "@harness/core";
