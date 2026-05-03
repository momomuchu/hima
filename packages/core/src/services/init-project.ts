import { initPlanningProject } from "../storage/planning-store.js";

export async function initProject(projectRoot: string) {
  return initPlanningProject(projectRoot);
}
