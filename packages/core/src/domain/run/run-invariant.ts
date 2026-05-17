import { isEvidenceSufficient } from "../../evidence/evaluate-evidence.js";
import type { PlanningProject } from "../../storage/planning-store.js";
import { RISK_CLASS_RANK } from "../../types/canonical.js";
import { HarnessError } from "../../types/errors.js";

export function assertRunAlwaysValid(project: PlanningProject): void {
  const expectedSubPhase = project.state.sub_phase ?? "Observer";
  const evidenceSufficiency = isEvidenceSufficient(
    project.runSet.evidence,
    project.currentRisk.risk_class,
  );
  const violations = [
    project.state.run_id === project.currentRisk.run_id
      ? null
      : "state.run_id must match currentRisk.run_id",
    project.state.run_id === project.runSet.runId ? null : "state.run_id must match runSet.runId",
    project.runSet.route.phase === project.state.phase
      ? null
      : "runSet.route.phase must match state.phase",
    project.runSet.route.subPhase === expectedSubPhase
      ? null
      : "runSet.route.subPhase must match state.sub_phase",
    project.currentRisk.rank === RISK_CLASS_RANK[project.currentRisk.risk_class]
      ? null
      : "currentRisk.rank must match currentRisk.risk_class",
    project.state.status === "active" && project.runSet.finalization.state !== "ACTIVE"
      ? "active runs must keep finalization.state ACTIVE"
      : null,
    project.runSet.finalization.state === "DONE_VERIFIED" && !evidenceSufficiency.sufficient
      ? `DONE_VERIFIED requires sufficient evidence: ${evidenceSufficiency.missingEvidenceKeys.join(", ")}`
      : null,
  ].filter((violation): violation is string => violation !== null);

  if (violations.length > 0) {
    throw new HarnessError("PLANNING_SCHEMA_INVALID", "Run invariant violated", {
      violations,
    });
  }
}
