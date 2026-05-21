import type { RunEvent } from "../schemas/run-set.schema.js";
import {
  appendRunEvent,
  type PlanningProject,
  readPlanningProject,
  writePlanningProject,
} from "../storage/planning-store.js";

export class RunRepository {
  constructor(readonly projectRoot: string) {}

  load(): Promise<PlanningProject> {
    return readPlanningProject(this.projectRoot);
  }

  save(project: PlanningProject): Promise<void> {
    return writePlanningProject(this.projectRoot, project);
  }

  appendRunEvent(event: RunEvent) {
    return appendRunEvent(this.projectRoot, event);
  }
}
