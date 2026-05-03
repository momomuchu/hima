import path from "node:path";

export interface PlanningPaths {
  root: string;
  planningDir: string;
  stateFile: string;
  currentRiskFile: string;
  runSetFile: string;
}

export function getPlanningPaths(projectRoot: string): PlanningPaths {
  const root = path.resolve(projectRoot);
  const planningDir = path.join(root, ".planning");

  return {
    root,
    planningDir,
    stateFile: path.join(planningDir, "state.yaml"),
    currentRiskFile: path.join(planningDir, "current-risk.yaml"),
    runSetFile: path.join(planningDir, "run-set.json"),
  };
}

export function toPortablePath(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}
