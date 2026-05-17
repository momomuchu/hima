import { transitionRun } from "../domain/run/index.js";
import type { TransitionRequest } from "../state-machine/transition.js";

export async function requestTransition(projectRoot: string, request: TransitionRequest) {
  return transitionRun(projectRoot, request);
}
