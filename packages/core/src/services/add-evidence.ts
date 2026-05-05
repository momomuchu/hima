import path from "node:path";
import { isHumanOnlyEvidenceKey, isTrustedHumanEvidence } from "../evidence/evaluate-evidence.js";
import { type EvidenceItem, EvidenceItemSchema } from "../schemas/run-set.schema.js";
import { withFileLock } from "../storage/file-lock.js";
import { getPlanningPaths } from "../storage/planning-paths.js";
import { readPlanningProject, writePlanningProject } from "../storage/planning-store.js";

export type AddEvidenceInput = Omit<EvidenceItem, "id" | "createdAt"> &
  Partial<Pick<EvidenceItem, "id" | "createdAt">>;

export async function addEvidence(
  projectRoot: string,
  input: AddEvidenceInput,
): Promise<EvidenceItem> {
  const item = EvidenceItemSchema.parse({
    id: input.id ?? `ev_${Date.now()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
  });

  if (
    item.status === "accepted" &&
    isHumanOnlyEvidenceKey(item.key) &&
    !isTrustedHumanEvidence(item)
  ) {
    throw new Error(
      `${item.key} evidence requires source "human" or metadata.verifiedHuman=true before it can be accepted`,
    );
  }

  const paths = getPlanningPaths(projectRoot);
  const lockDir = path.join(paths.planningDir, ".run-set.lock");

  await withFileLock(lockDir, async () => {
    const project = await readPlanningProject(projectRoot);
    await writePlanningProject(projectRoot, {
      ...project,
      runSet: {
        ...project.runSet,
        evidence: [...project.runSet.evidence, item],
      },
    });
  });

  return item;
}
