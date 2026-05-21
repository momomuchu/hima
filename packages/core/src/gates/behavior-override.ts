/**
 * BEH-W4 — Behavior Override Resolution
 *
 * Resolves per-run behavior overrides from the Policy Set before each behavior
 * evaluation. Enforces the invariant that H/C runs cannot weaken enforcement
 * for behaviors whose risk_floor is at or below the effective risk class.
 *
 * Design: .planning/behavior-system/gate-config-and-observability-design.md §2.4
 */

import { maxRiskClass } from "../risk-classifier/risk-rank.js";
import type { BehaviorOverride } from "../schemas/run-set.schema.js";
import { RISK_CLASS_RANK, type RiskClass, riskAtLeast } from "../types/canonical.js";

export interface OverrideResolution {
  /** True when the behavior should be skipped for enforcement (mode="disabled"). */
  skip: boolean;
  /** True when block verdicts should be capped at "warn" (mode="warn-only"). */
  capAtWarn: boolean;
  /** Effective risk floor after optional riskFloorOverride (only ever raises). */
  effectiveFloor: RiskClass;
  /** Whether an override is active for this behavior (for audit trail). */
  overrideActive: boolean;
  /** The mode of the active override, if any. */
  overrideMode?: "warn-only" | "disabled";
  /**
   * If set, the override was rejected because the run's risk class is at or
   * above the behavior's effective floor. The gate must emit a
   * OVERRIDE_FORBIDDEN_FOR_RISK_CLASS event and apply full enforcement.
   */
  forbiddenReason?: "OVERRIDE_FORBIDDEN_FOR_RISK_CLASS" | "OVERRIDE_FORBIDDEN_FLOOR_REDUCTION";
}

/**
 * Catalog-level risk floors per behavior ID.
 *
 * These are the static floors defined in 12-behaviors-catalog-spec.md.
 * A behavior absent from this map defaults to "T" (no floor — always enforceable).
 * The gate uses these to determine whether a developer-requested override is
 * permitted at the current run's risk class.
 */
const CATALOG_RISK_FLOORS: Readonly<Record<string, RiskClass>> = {
  "BEH-010": "T", // read-before-write
  "BEH-011": "T", // suppression guard
  "BEH-012": "M", // Chesterton fence
  "BEH-013": "T", // claim source
  "BEH-014": "T", // anti-sycophancy
  "BEH-020": "M", // critic gate
  "BEH-021": "M", // dimension retry
  "BEH-022": "M", // loop detector
  "BEH-023": "H", // completion status
  "BEH-030": "M", // subagent contract
  "BEH-031": "H", // watcher
  "BEH-032": "T", // kill switch
};

/**
 * Returns the catalog risk floor for a behavior.
 * Behaviors not in the catalog default to "T".
 */
export function getCatalogRiskFloor(behaviorId: string): RiskClass {
  return CATALOG_RISK_FLOORS[behaviorId] ?? "T";
}

/**
 * Resolves the override state for a single behavior before gate evaluation.
 *
 * Rules (from design §2.4):
 * 1. No override entry → full enforcement at catalog floor.
 * 2. riskFloorOverride present → effective floor = max(catalog, override).
 *    If override < catalog floor → OVERRIDE_FORBIDDEN_FLOOR_REDUCTION.
 * 3. If run's effectiveRiskClass >= effective floor AND mode weakens enforcement
 *    (disabled|warn-only) → OVERRIDE_FORBIDDEN_FOR_RISK_CLASS; full enforcement.
 * 4. Otherwise → apply the requested mode.
 */
export function resolveOverride(
  behaviorId: string,
  overrides: readonly BehaviorOverride[],
  effectiveRiskClass: RiskClass,
): OverrideResolution {
  const catalogFloor = getCatalogRiskFloor(behaviorId);
  const override = overrides.find((o) => o.behaviorId === behaviorId);

  // No override: full enforcement at catalog defaults.
  if (!override) {
    return {
      skip: false,
      capAtWarn: false,
      effectiveFloor: catalogFloor,
      overrideActive: false,
    };
  }

  // Enabled override is a no-op operationally but is still "active".
  if (override.mode === "enabled") {
    return {
      skip: false,
      capAtWarn: false,
      effectiveFloor: catalogFloor,
      overrideActive: true,
      overrideMode: undefined,
    };
  }

  // Validate riskFloorOverride: it may only raise, never lower.
  if (override.riskFloorOverride !== undefined) {
    const catalogRank = RISK_CLASS_RANK[catalogFloor];
    const overrideRank = RISK_CLASS_RANK[override.riskFloorOverride];
    if (overrideRank < catalogRank) {
      // Attempted to lower the floor — reject the override.
      return {
        skip: false,
        capAtWarn: false,
        effectiveFloor: catalogFloor,
        overrideActive: true,
        overrideMode: override.mode,
        forbiddenReason: "OVERRIDE_FORBIDDEN_FLOOR_REDUCTION",
      };
    }
  }

  // Compute effective floor (only raises, never lowers).
  const effectiveFloor: RiskClass = override.riskFloorOverride
    ? maxRiskClass([catalogFloor, override.riskFloorOverride])
    : catalogFloor;

  // If the run's risk class is at or above the effective floor, the override
  // cannot weaken enforcement — re-enable full enforcement.
  if (riskAtLeast(effectiveRiskClass, effectiveFloor)) {
    return {
      skip: false,
      capAtWarn: false,
      effectiveFloor,
      overrideActive: true,
      overrideMode: override.mode,
      forbiddenReason: "OVERRIDE_FORBIDDEN_FOR_RISK_CLASS",
    };
  }

  // Override is valid and permitted — apply it.
  return {
    skip: override.mode === "disabled",
    capAtWarn: override.mode === "warn-only",
    effectiveFloor,
    overrideActive: true,
    overrideMode: override.mode,
  };
}
