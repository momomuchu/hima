import type { RunSetFile } from "../schemas/run-set.schema.js";

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

    const policyEvent =
      event.payload.policyEvent &&
      typeof event.payload.policyEvent === "object" &&
      !Array.isArray(event.payload.policyEvent)
        ? (event.payload.policyEvent as Record<string, unknown>)
        : undefined;
    const violationType = policyEvent?.violationType ?? event.payload.violationType;
    if (typeof violationType !== "string") {
      return [];
    }

    if (policyEvent) {
      if (policyEvent.status !== "unresolved" || policyEvent.severity !== "critical") {
        return [];
      }
      if (hasAcceptedEvidenceSince(runSet, event.ts)) {
        return policyEvent.resolvableByEvidence === true ? [] : blocker(event, violationType);
      }

      return blocker(event, violationType);
    }

    if (["DONE_WITHOUT_EVIDENCE", "MIGRATION_WITHOUT_ADR"].includes(violationType)) {
      if (hasAcceptedEvidenceSince(runSet, event.ts)) {
        return [];
      }
    } else if (!["SECRET_IN_PLAINTEXT", "BYPASS_ATTEMPTED"].includes(violationType)) {
      return [];
    }

    return blocker(event, violationType);
  });
}

function blocker(event: RunSetFile["events"][number], violationType: string): string[] {
  const reason = event.reason ? `: ${event.reason}` : "";
  return [`critical post_tool policy violation (${violationType})${reason}`];
}

function getLatestDevelopmentEntryTimestamp(runSet: RunSetFile): string | undefined {
  return [...runSet.events].reverse().find((event) => event.type === "DEVELOPMENT_MODE_ENTERED")
    ?.ts;
}
