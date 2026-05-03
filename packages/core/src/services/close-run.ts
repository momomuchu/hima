import {
  type ConvergenceEvaluation,
  evaluateConvergence,
} from "../convergence/evaluate-convergence.js";
import { type RunEvent, type RunSetFile, RunSetFileSchema } from "../schemas/run-set.schema.js";
import { PlanningStateFileSchema } from "../schemas/state.schema.js";
import { writeJsonFile } from "../storage/json.js";
import { getPlanningPaths } from "../storage/planning-paths.js";
import { readPlanningProject } from "../storage/planning-store.js";
import { writeYamlFile } from "../storage/yaml.js";

export interface CloseRunOptions {
  readonly closedAt?: string;
  readonly eventId?: string;
}

export interface CloseRunResult {
  readonly evaluation: ConvergenceEvaluation;
  readonly runSet: RunSetFile;
  readonly event: RunEvent;
}

export async function closeRun(
  projectRoot: string,
  options: CloseRunOptions = {},
): Promise<CloseRunResult> {
  const project = await readPlanningProject(projectRoot);
  const paths = getPlanningPaths(projectRoot);
  const closedAt = options.closedAt ?? new Date().toISOString();
  const evaluation = evaluateConvergence(project);
  const existingCloseEvent = [...project.runSet.events]
    .reverse()
    .find((event) => event.type === "RUN_CLOSED");
  const alreadyFinalized = project.runSet.finalization.state !== "ACTIVE";

  if (project.state.status === "closed" && alreadyFinalized) {
    return {
      evaluation,
      runSet: project.runSet,
      event: existingCloseEvent ?? buildCloseEvent(evaluation, closedAt, options.eventId),
    };
  }

  if (alreadyFinalized) {
    await writeYamlFile(
      paths.stateFile,
      {
        ...project.state,
        status: "closed" as const,
        updated_at: closedAt,
      },
      PlanningStateFileSchema,
    );

    return {
      evaluation,
      runSet: project.runSet,
      event: existingCloseEvent ?? buildCloseEvent(evaluation, closedAt, options.eventId),
    };
  }

  const event = buildCloseEvent(evaluation, closedAt, options.eventId);
  const closingState = {
    ...project.state,
    status: "closing" as const,
    updated_at: closedAt,
  };
  const closedState = {
    ...closingState,
    status: "closed" as const,
  };
  const runSet = {
    ...project.runSet,
    events: [...project.runSet.events, event],
    finalization: {
      state: evaluation.finalizationRecommendation.runSetState,
      gaps: evaluation.gaps,
    },
  };

  await writeYamlFile(paths.stateFile, closingState, PlanningStateFileSchema);
  await writeJsonFile(paths.runSetFile, runSet, RunSetFileSchema);
  await writeYamlFile(paths.stateFile, closedState, PlanningStateFileSchema);

  return { evaluation, runSet, event };
}

function buildCloseEvent(
  evaluation: ConvergenceEvaluation,
  closedAt: string,
  eventId: string | undefined,
): RunEvent {
  const event: RunEvent = {
    id: eventId ?? `run-closed-${closedAt}`,
    ts: closedAt,
    type: "RUN_CLOSED",
    decision:
      evaluation.status === "blocked"
        ? "block"
        : evaluation.status === "verified"
          ? "allow"
          : "warn",
    reason: evaluation.finalizationRecommendation.reason,
    payload: {
      score: evaluation.score,
      status: evaluation.status,
      finalState: evaluation.finalizationRecommendation.finalState,
      evidenceSufficient: evaluation.evidenceSufficiency.sufficient,
      runtimeBindingHealthy: evaluation.runtimeBindingHealth.healthy,
      blockers: evaluation.blockers,
      gaps: evaluation.gaps,
    },
  };

  return event;
}
