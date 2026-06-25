import { Schema } from "effect";

/**
 * RiskClass — the five criticality tiers used throughout hima's gate and
 * force-action system. T (trivial) through C (critical).
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §2.1, AMENDMENT-003.
 */

export const RiskClass = Schema.Literal("T", "L", "M", "H", "C");

export type RiskClass = typeof RiskClass.Type;

/**
 * Numeric ordering for floor comparisons (higher = more critical).
 * Usage: RISK_ORDER[riskClass] >= RISK_ORDER["H"]
 */
export const RISK_ORDER: Record<RiskClass, number> = {
  T: 0,
  L: 1,
  M: 2,
  H: 3,
  C: 4,
};

/** Decode an unknown value into a RiskClass, throwing on invalid input. */
export const decodeRiskClass = Schema.decodeUnknownSync(RiskClass);

/** Decode an unknown value into Either<RiskClass, ParseError> (non-throwing). */
export const decodeRiskClassEither = Schema.decodeUnknownEither(RiskClass);
