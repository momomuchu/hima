import { type TransitionRequest, transitionPlanningState } from "../state-machine/transition.js";
import { readPlanningProject, writePlanningProject } from "../storage/planning-store.js";

export async function requestTransition(projectRoot: string, request: TransitionRequest) {
  const project = await readPlanningProject(projectRoot);
  const result = transitionPlanningState(project.state, request);

  await writePlanningProject(projectRoot, {
    ...project,
    state: result.newSnapshot,
    runSet: {
      ...project.runSet,
      route: {
        ...project.runSet.route,
        phase: result.newSnapshot.phase,
        subPhase: result.newSnapshot.sub_phase ?? "Observer",
      },
    },
  });

  return result;
}
