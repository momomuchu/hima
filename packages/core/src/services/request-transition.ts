import { randomUUID } from "node:crypto";
import { redactSecrets } from "../security/redaction.js";
import {
  hasExplicitTransitionTarget,
  type TransitionRequest,
  transitionPlanningState,
} from "../state-machine/transition.js";
import { readPlanningProject, writePlanningProject } from "../storage/planning-store.js";

export async function requestTransition(projectRoot: string, request: TransitionRequest) {
  const project = await readPlanningProject(projectRoot);
  const result = transitionPlanningState(project.state, request);
  const transitionedAt = result.newSnapshot.updated_at;
  const redactedReason = redactSecrets(request.reason);

  await writePlanningProject(projectRoot, {
    ...project,
    state: result.newSnapshot,
    runSet: {
      ...project.runSet,
      events: [
        ...project.runSet.events,
        {
          id: `state-transition-${randomUUID()}`,
          ts: transitionedAt,
          type: "STATE_TRANSITIONED",
          reason: redactedReason,
          payload: {
            fromPhase: result.previousSnapshot.phase,
            fromSubPhase: result.previousSnapshot.sub_phase,
            toPhase: result.newSnapshot.phase,
            toSubPhase: result.newSnapshot.sub_phase,
            explicit: hasExplicitTransitionTarget(request),
          },
        },
      ],
      route: {
        ...project.runSet.route,
        phase: result.newSnapshot.phase,
        subPhase: result.newSnapshot.sub_phase ?? "Observer",
      },
    },
  });

  return result;
}
