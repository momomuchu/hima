import type { RunSetFile } from "../schemas/run-set.schema.js";

const ALWAYS_BLOCKING_VIOLATIONS = new Set(["SECRET_IN_PLAINTEXT", "BYPASS_ATTEMPTED"]);

const RESOLVABLE_BY_EVIDENCE = new Set(["DONE_WITHOUT_EVIDENCE", "MIGRATION_WITHOUT_ADR"]);

function hasAcceptedEvidenceSince(runSet: RunSetFile, sinceTimestamp: string): boolean {
  return runSet.evidence.some(
    (item) => item.status === "accepted" && item.createdAt > sinceTimestamp,
  );
}

export function getPolicyEventBlockers(runSet: RunSetFile): string[] {
  const currentCycleStartedAt = getLatestDevelopmentEntryTimestamp(runSet);

  return runSet.events.flatMap((event) => {
    if (
      event.type !== "GATE_EVALUATED" ||
      event.gateType !== "post_tool" ||
      event.payload?.finalState !== "BLOCKED_POLICY" ||
      (currentCycleStartedAt !== undefined && event.ts < currentCycleStartedAt)
    ) {
      return [];
    }

    const violationType = event.payload.violationType;
    if (typeof violationType !== "string") {
      return [];
    }

    if (RESOLVABLE_BY_EVIDENCE.has(violationType)) {
      if (hasAcceptedEvidenceSince(runSet, event.ts)) {
        return [];
      }
    } else if (!ALWAYS_BLOCKING_VIOLATIONS.has(violationType)) {
      return [];
    }

    const reason = event.reason ? `: ${event.reason}` : "";
    return [`critical post_tool policy violation (${violationType})${reason}`];
  });
}

function getLatestDevelopmentEntryTimestamp(runSet: RunSetFile): string | undefined {
  return [...runSet.events].reverse().find((event) => event.type === "DEVELOPMENT_MODE_ENTERED")
    ?.ts;
}
