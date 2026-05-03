import type { PlanningStateFile } from "../schemas/state.schema.js";
import type { MacroCycle, SubPhase } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";
import {
  isMacroCycle,
  isSubPhase,
  nextPlanningPosition,
  type PlanningPosition,
  validatePlanningTransition,
} from "./subphases.js";

export interface TransitionRequest {
  targetPhase?: MacroCycle;
  targetSubPhase?: SubPhase;
  reason?: string;
}

export interface TransitionResult {
  success: true;
  previousSnapshot: PlanningStateFile;
  newSnapshot: PlanningStateFile;
}

function assertKnownPosition(position: {
  phase: unknown;
  subPhase: unknown;
}): asserts position is PlanningPosition {
  if (!isMacroCycle(position.phase)) {
    throw new HarnessError("TRANSITION_BLOCKED", `Unknown macro cycle: ${String(position.phase)}`, {
      phase: position.phase,
    });
  }

  if (!isSubPhase(position.subPhase)) {
    throw new HarnessError("TRANSITION_BLOCKED", `Unknown subphase: ${String(position.subPhase)}`, {
      subPhase: position.subPhase,
    });
  }
}

export function currentPlanningPosition(snapshot: PlanningStateFile): PlanningPosition {
  const position = {
    phase: snapshot.phase,
    subPhase: snapshot.sub_phase,
  };

  assertKnownPosition(position);
  return position;
}

export function hasExplicitTransitionTarget(request: TransitionRequest): boolean {
  return request.targetPhase !== undefined || request.targetSubPhase !== undefined;
}

export function resolveTransitionTarget(
  snapshot: PlanningStateFile,
  request: TransitionRequest,
): PlanningPosition {
  const current = currentPlanningPosition(snapshot);

  if (hasExplicitTransitionTarget(request)) {
    const explicitTarget = {
      phase: request.targetPhase ?? current.phase,
      subPhase: request.targetSubPhase ?? "Observer",
    };

    assertKnownPosition(explicitTarget);
    return explicitTarget;
  }

  const next = nextPlanningPosition(current);
  if (!next) {
    throw new HarnessError(
      "TRANSITION_BLOCKED",
      "Cannot implicitly advance from learning/Transmit; the planning state is already terminal.",
      { phase: current.phase, subPhase: current.subPhase },
    );
  }

  return next;
}

export function isValidTransition(
  snapshot: PlanningStateFile,
  request: TransitionRequest,
): boolean {
  const current = currentPlanningPosition(snapshot);
  const target = resolveTransitionTarget(snapshot, request);

  return validatePlanningTransition(current, target, {
    explicit: hasExplicitTransitionTarget(request),
  }).valid;
}

export function transitionPlanningState(
  snapshot: PlanningStateFile,
  request: TransitionRequest,
): TransitionResult {
  const target = resolveTransitionTarget(snapshot, request);
  const validation = validatePlanningTransition(currentPlanningPosition(snapshot), target, {
    explicit: hasExplicitTransitionTarget(request),
  });

  if (!validation.valid) {
    throw new HarnessError("TRANSITION_BLOCKED", validation.reason, {
      phase: snapshot.phase,
      subPhase: snapshot.sub_phase,
      target,
      transitionKind: validation.kind,
    });
  }

  const newSnapshot: PlanningStateFile = {
    ...snapshot,
    phase: target.phase,
    sub_phase: target.subPhase,
    updated_at: new Date().toISOString(),
  };

  return {
    success: true,
    previousSnapshot: snapshot,
    newSnapshot,
  };
}
