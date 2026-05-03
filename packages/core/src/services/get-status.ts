import { evaluateConvergence } from "../convergence/evaluate-convergence.js";
import { readPlanningProject } from "../storage/planning-store.js";

export async function getStatus(projectRoot: string) {
  const project = await readPlanningProject(projectRoot);
  const convergence = evaluateConvergence(project);

  return {
    phase: project.state.phase,
    subPhase: project.state.sub_phase,
    mode: project.state.mode,
    stateStatus: project.state.status,
    riskClass: project.currentRisk.risk_class,
    runId: project.state.run_id,
    evidenceCount: project.runSet.evidence.length,
    finalizationState: project.runSet.finalization.state,
    convergenceStatus: convergence.status,
    convergenceScore: convergence.score,
    blockers: convergence.blockers,
    gaps: convergence.gaps,
    storedGaps: project.runSet.finalization.gaps,
  };
}
