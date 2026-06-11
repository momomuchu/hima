// Ported from packages/core/src/gates/behavior-override.ts — no logic changes
// Simplification: inlined maxRiskClass, no dependency on risk-rank.ts

import { maxRiskClass, RISK_CLASS_RANK, riskAtLeast, type RiskClass } from "./risk-class.js";
import type { BehaviorOverride } from "./run-set-types.js";

export interface OverrideResolution {
  skip: boolean;
  capAtWarn: boolean;
  effectiveFloor: RiskClass;
  overrideActive: boolean;
  overrideMode?: "warn-only" | "disabled";
  forbiddenReason?: "OVERRIDE_FORBIDDEN_FOR_RISK_CLASS" | "OVERRIDE_FORBIDDEN_FLOOR_REDUCTION";
}

const CATALOG_RISK_FLOORS: Readonly<Record<string, RiskClass>> = {
  "BEH-010": "T",
  "BEH-011": "T",
  "BEH-012": "M",
  "BEH-013": "T",
  "BEH-014": "T",
  "BEH-020": "M",
  "BEH-021": "M",
  "BEH-022": "M",
  "BEH-023": "H",
  "BEH-030": "M",
  "BEH-031": "H",
  "BEH-032": "T",
};

export function getCatalogRiskFloor(behaviorId: string): RiskClass {
  return CATALOG_RISK_FLOORS[behaviorId] ?? "T";
}

export function resolveOverride(
  behaviorId: string,
  overrides: readonly BehaviorOverride[],
  effectiveRiskClass: RiskClass,
): OverrideResolution {
  const catalogFloor = getCatalogRiskFloor(behaviorId);
  const override = overrides.find((o) => o.behaviorId === behaviorId);

  if (!override) {
    return { skip: false, capAtWarn: false, effectiveFloor: catalogFloor, overrideActive: false };
  }

  if (override.mode === "enabled") {
    return { skip: false, capAtWarn: false, effectiveFloor: catalogFloor, overrideActive: true, overrideMode: undefined };
  }

  if (override.riskFloorOverride !== undefined) {
    const catalogRank = RISK_CLASS_RANK[catalogFloor];
    const overrideRank = RISK_CLASS_RANK[override.riskFloorOverride];
    if (overrideRank < catalogRank) {
      return {
        skip: false, capAtWarn: false, effectiveFloor: catalogFloor,
        overrideActive: true, overrideMode: override.mode,
        forbiddenReason: "OVERRIDE_FORBIDDEN_FLOOR_REDUCTION",
      };
    }
  }

  const effectiveFloor: RiskClass = override.riskFloorOverride
    ? maxRiskClass([catalogFloor, override.riskFloorOverride])
    : catalogFloor;

  if (riskAtLeast(effectiveRiskClass, effectiveFloor)) {
    return {
      skip: false, capAtWarn: false, effectiveFloor,
      overrideActive: true, overrideMode: override.mode,
      forbiddenReason: "OVERRIDE_FORBIDDEN_FOR_RISK_CLASS",
    };
  }

  return {
    skip: override.mode === "disabled",
    capAtWarn: override.mode === "warn-only",
    effectiveFloor,
    overrideActive: true,
    overrideMode: override.mode,
  };
}
