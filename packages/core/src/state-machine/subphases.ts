import { MACRO_CYCLES, type MacroCycle, SUB_PHASES, type SubPhase } from "../types/canonical.js";

export interface PlanningPosition {
  phase: MacroCycle;
  subPhase: SubPhase;
}

export type TransitionValidation =
  | {
      valid: true;
      kind: "explicit" | "sequential";
    }
  | {
      valid: false;
      kind: "regressive" | "stationary" | "non_sequential";
      reason: string;
    };

export function nextMacroCycle(current: MacroCycle): MacroCycle | null {
  const index = MACRO_CYCLES.indexOf(current);
  return MACRO_CYCLES[index + 1] ?? null;
}

export function nextSubPhase(current: SubPhase): SubPhase | null {
  const index = SUB_PHASES.indexOf(current);
  return SUB_PHASES[index + 1] ?? null;
}

export function isMacroCycle(value: unknown): value is MacroCycle {
  return typeof value === "string" && MACRO_CYCLES.includes(value as MacroCycle);
}

export function isSubPhase(value: unknown): value is SubPhase {
  return typeof value === "string" && SUB_PHASES.includes(value as SubPhase);
}

export function macroCycleIndex(phase: MacroCycle): number {
  return MACRO_CYCLES.indexOf(phase);
}

export function subPhaseIndex(subPhase: SubPhase): number {
  return SUB_PHASES.indexOf(subPhase);
}

export function sequenceIndex(position: PlanningPosition): number {
  return macroCycleIndex(position.phase) * SUB_PHASES.length + subPhaseIndex(position.subPhase);
}

export function comparePlanningPosition(a: PlanningPosition, b: PlanningPosition): number {
  return sequenceIndex(a) - sequenceIndex(b);
}

export function nextPlanningPosition(position: PlanningPosition): PlanningPosition | null {
  const nextPhase = nextSubPhase(position.subPhase);
  if (nextPhase) {
    return {
      phase: position.phase,
      subPhase: nextPhase,
    };
  }

  const nextCycle = nextMacroCycle(position.phase);
  if (!nextCycle) {
    return null;
  }

  return {
    phase: nextCycle,
    subPhase: SUB_PHASES[0],
  };
}

export function isSequentialTransition(from: PlanningPosition, to: PlanningPosition): boolean {
  return sequenceIndex(to) === sequenceIndex(from) + 1;
}

export function isRegressiveTransition(from: PlanningPosition, to: PlanningPosition): boolean {
  return comparePlanningPosition(to, from) < 0;
}

export function validatePlanningTransition(
  from: PlanningPosition,
  to: PlanningPosition,
  options: { explicit?: boolean } = {},
): TransitionValidation {
  if (options.explicit) {
    return {
      valid: true,
      kind: "explicit",
    };
  }

  if (isSequentialTransition(from, to)) {
    return {
      valid: true,
      kind: "sequential",
    };
  }

  const comparison = comparePlanningPosition(to, from);
  if (comparison < 0) {
    return {
      valid: false,
      kind: "regressive",
      reason: `Implicit transition cannot move backward from ${from.phase}/${from.subPhase} to ${to.phase}/${to.subPhase}.`,
    };
  }

  if (comparison === 0) {
    return {
      valid: false,
      kind: "stationary",
      reason: `Implicit transition must leave ${from.phase}/${from.subPhase}.`,
    };
  }

  return {
    valid: false,
    kind: "non_sequential",
    reason: `Implicit transition cannot skip from ${from.phase}/${from.subPhase} to ${to.phase}/${to.subPhase}.`,
  };
}

export function isValidPlanningTransition(
  from: PlanningPosition,
  to: PlanningPosition,
  options: { explicit?: boolean } = {},
): boolean {
  return validatePlanningTransition(from, to, options).valid;
}
