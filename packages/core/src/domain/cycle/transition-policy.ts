import { hasReviewerEvidence } from "../../behaviors/beh-020-critic-gate.js";
import {
  evaluateDorDodTransition,
  type GovernanceEvaluation,
} from "../../governance/load-dor-dod.js";
import type { PlanningStateFile } from "../../schemas/state.schema.js";
import {
  isMacroCycle,
  isSubPhase,
  nextPlanningPosition,
  type PlanningPosition,
  validatePlanningTransition,
} from "../../state-machine/subphases.js";
import { readPlanningProject } from "../../storage/planning-store.js";
import type { MacroCycle, SubPhase } from "../../types/canonical.js";
import { riskAtLeast } from "../../types/canonical.js";
import { HarnessError } from "../../types/errors.js";

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

export async function evaluateTransitionGovernance(
  projectRoot: string,
  snapshot: PlanningStateFile,
  request: TransitionRequest,
): Promise<GovernanceEvaluation> {
  const current = currentPlanningPosition(snapshot);
  const target = resolveTransitionTarget(snapshot, request);

  // BEH-020 — Verify-to-Capitalize transition guard (risk M+).
  // A reviewer subagent evidence record is required in the run-set before the
  // build/Capitalize sub-phase may begin. This guard fires before DoR/DoD so
  // the reviewer-evidence violation surfaces with a specific error message.
  if (
    current.phase === "build" &&
    current.subPhase === "Verify" &&
    target.phase === "build" &&
    target.subPhase === "Capitalize"
  ) {
    // Read the full project to access current risk class and evidence.
    const project = await readPlanningProject(projectRoot);
    if (riskAtLeast(project.currentRisk.risk_class, "M")) {
      const context = {
        projectRoot,
        state: project.state,
        currentRisk: project.currentRisk,
        runSet: project.runSet,
      };
      if (!hasReviewerEvidence(context)) {
        throw new HarnessError(
          "TRANSITION_BLOCKED",
          "BEH-020: Verify-to-Capitalize transition blocked — no reviewer subagent evidence " +
            `found in run-set.json#/evidence for risk class ${project.currentRisk.risk_class}. ` +
            "A reviewer subagent must produce an APPROVED or CHANGES_REQUIRED record " +
            "before the build/Capitalize sub-phase may begin.",
          { current, target, behavior: "BEH-020" },
        );
      }
    }
  }

  if (current.phase === target.phase) {
    return {
      allowed: true,
      checked: [],
      blockers: [],
    };
  }

  const evaluation = await evaluateDorDodTransition(projectRoot, current.phase, target.phase);
  if (!evaluation.allowed) {
    throw new HarnessError("TRANSITION_BLOCKED", "DoR/DoD governance blocked transition", {
      current,
      target,
      blockers: evaluation.blockers,
    });
  }

  return evaluation;
}
