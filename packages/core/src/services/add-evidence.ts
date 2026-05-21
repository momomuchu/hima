import path from "node:path";
import { isHumanOnlyEvidenceKey, isTrustedHumanEvidence } from "../evidence/evaluate-evidence.js";
import {
  type ClaimSource,
  type EvidenceItem,
  EvidenceItemSchema,
} from "../schemas/run-set.schema.js";
import { withFileLock } from "../storage/file-lock.js";
import { getPlanningPaths } from "../storage/planning-paths.js";
import {
  appendRunEvent,
  readPlanningProject,
  writePlanningProject,
} from "../storage/planning-store.js";

export type AddEvidenceInput = Omit<EvidenceItem, "id" | "createdAt"> &
  Partial<Pick<EvidenceItem, "id" | "createdAt">>;

/**
 * BEH-013 — Infers a default claimSource when the caller has not explicitly
 * provided one. Sources that observe real artifacts (hook, ci, human) are
 * treated as "verified"; agent-synthesised claims default to "inferred".
 */
function inferClaimSource(source: EvidenceItem["source"]): ClaimSource {
  switch (source) {
    case "hook":
    case "ci":
    case "human":
      return "verified";
    default:
      return "inferred";
  }
}

export async function addEvidence(
  projectRoot: string,
  input: AddEvidenceInput,
): Promise<EvidenceItem> {
  // BEH-013 — Ensure every EvidenceItem has a claimSource so the stop gate
  // can enforce calibrated-uncertainty at risk class M and above.
  const claimSource: ClaimSource = input.claimSource ?? inferClaimSource(input.source);

  const item = EvidenceItemSchema.parse({
    id: input.id ?? `ev_${Date.now()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input,
    claimSource,
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
  await appendRunEvent(projectRoot, {
    id: `evidence-added-${item.id}`,
    ts: item.createdAt,
    type: "EVIDENCE_ADDED",
    payload: {
      evidenceId: item.id,
      key: item.key,
      kind: item.kind,
      status: item.status,
      source: item.source,
    },
  });

  return item;
}
