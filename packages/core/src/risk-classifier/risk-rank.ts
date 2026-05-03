import {
  compareRiskClass,
  RISK_CLASS_RANK,
  type RiskClass,
  riskAtLeast,
} from "../types/canonical.js";

export { compareRiskClass, RISK_CLASS_RANK, type RiskClass, riskAtLeast };

export function maxRiskClass(classes: RiskClass[]): RiskClass {
  return classes.reduce<RiskClass>(
    (highest, candidate) => (riskAtLeast(candidate, highest) ? candidate : highest),
    "T",
  );
}
