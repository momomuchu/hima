/**
 * risk-class.ts — resolveRiskClass() helper.
 *
 * Extracts the effective RiskClass from the active ward's floor, falling back
 * to "T" (Trivial) when no ward exists or the floor is not set.
 *
 * Used by gate handlers (handlePreToolUse, handleStop) to supply the riskClass
 * field of BehaviorContext without repeating the null-coalesce pattern.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-002,
 *      ARCHITECTURE-v3.md §7.1 S-01 criticality routing.
 */

import type { RiskClass, Ward } from "@hima/schemas";

/**
 * Resolve the effective RiskClass for a gate evaluation.
 *
 * Rules:
 *   - If a ward exists and has a floor → use ward.floor.
 *   - Otherwise → "T" (Trivial, the safest / least-enforcing default).
 *
 * The floor can only be RAISED by the risk-classifier (R-018, R-019), never
 * lowered. This function is a pure read; raising logic lives in the classifier.
 *
 * @param ward - The active Ward, or null/undefined when no run is initialised.
 * @returns      The effective RiskClass for behavior evaluation.
 */
export function resolveRiskClass(ward: Ward | null | undefined): RiskClass {
  return ward?.floor ?? "T";
}
