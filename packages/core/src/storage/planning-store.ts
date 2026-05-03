import { mkdir } from "node:fs/promises";
import { BASE_GATES, RISK_POLICY } from "../policy/baseline-policy.js";
import { type CurrentRiskFile, CurrentRiskFileSchema } from "../schemas/current-risk.schema.js";
import { type RunEvent, type RunSetFile, RunSetFileSchema } from "../schemas/run-set.schema.js";
import { type PlanningStateFile, PlanningStateFileSchema } from "../schemas/state.schema.js";
import { RISK_CLASS_RANK } from "../types/canonical.js";
import { readJsonFile, writeJsonFile } from "./json.js";
import { getPlanningPaths } from "./planning-paths.js";
import { readYamlFile, writeYamlFile } from "./yaml.js";

export interface PlanningProject {
  state: PlanningStateFile;
  currentRisk: CurrentRiskFile;
  runSet: RunSetFile;
}

export function createRunId(date = new Date()): string {
  const stamp = date
    .toISOString()
    .replaceAll(/[-:.TZ]/g, "")
    .slice(0, 14);
  return `run_${stamp}`;
}

export function createDefaultPlanningProject(runId = createRunId()): PlanningProject {
  const now = new Date().toISOString();
  const initialRiskClass = "T";

  return {
    state: {
      version: 1,
      run_id: runId,
      phase: "discovery",
      sub_phase: "Observer",
      mode: "auto",
      active_gates: [...BASE_GATES],
      last_gate_type: null,
      status: "active",
      updated_at: now,
    },
    currentRisk: {
      version: 1,
      run_id: runId,
      risk_class: initialRiskClass,
      rank: RISK_CLASS_RANK[initialRiskClass],
      bypass_allowed: RISK_POLICY[initialRiskClass].bypassAllowed,
      human_checkpoint_required: RISK_POLICY[initialRiskClass].requiresHumanCheckpoint,
      forcing_signals: [],
      promotion_history: [],
      updated_at: now,
    },
    runSet: {
      version: 1,
      runId,
      project: {},
      intent: {},
      runtimeCapabilities: {},
      runtimeBindings: {},
      policy: {},
      route: {
        phase: "discovery",
        subPhase: "Observer",
        mode: "auto",
        riskClass: initialRiskClass,
      },
      events: [],
      evidence: [],
      subagents: [],
      finalization: {
        state: "ACTIVE",
        gaps: [],
      },
    },
  };
}

export async function initPlanningProject(projectRoot: string): Promise<PlanningProject> {
  const paths = getPlanningPaths(projectRoot);
  const project = createDefaultPlanningProject();

  await mkdir(paths.planningDir, { recursive: true });
  await writePlanningProject(projectRoot, project);

  return project;
}

export async function readPlanningProject(projectRoot: string): Promise<PlanningProject> {
  const paths = getPlanningPaths(projectRoot);

  const [state, currentRisk, runSet] = await Promise.all([
    readYamlFile(paths.stateFile, PlanningStateFileSchema),
    readYamlFile(paths.currentRiskFile, CurrentRiskFileSchema),
    readJsonFile(paths.runSetFile, RunSetFileSchema),
  ]);

  return { state, currentRisk, runSet };
}

export async function writePlanningProject(
  projectRoot: string,
  project: PlanningProject,
): Promise<void> {
  const paths = getPlanningPaths(projectRoot);

  await Promise.all([
    writeYamlFile(paths.stateFile, project.state, PlanningStateFileSchema),
    writeYamlFile(paths.currentRiskFile, project.currentRisk, CurrentRiskFileSchema),
    writeJsonFile(paths.runSetFile, project.runSet, RunSetFileSchema),
  ]);
}

export async function appendRunEvent(projectRoot: string, event: RunEvent): Promise<RunSetFile> {
  const project = await readPlanningProject(projectRoot);
  const paths = getPlanningPaths(projectRoot);
  const runSet = {
    ...project.runSet,
    events: [...project.runSet.events, event],
  };

  await writeJsonFile(paths.runSetFile, runSet, RunSetFileSchema);
  return runSet;
}
