import type { RunSetFile } from "../schemas/run-set.schema.js";

const CRITICAL_POST_TOOL_VIOLATIONS = new Set([
  "SECRET_IN_PLAINTEXT",
  "BYPASS_ATTEMPTED",
  "MIGRATION_WITHOUT_ADR",
  "DONE_WITHOUT_EVIDENCE",
]);

export function getPolicyEventBlockers(runSet: RunSetFile): string[] {
  return runSet.events.flatMap((event) => {
    if (
      event.type !== "GATE_EVALUATED" ||
      event.gateType !== "post_tool" ||
      event.payload?.finalState !== "BLOCKED_POLICY"
    ) {
      return [];
    }

    const violationType = event.payload.violationType;
    if (typeof violationType !== "string" || !CRITICAL_POST_TOOL_VIOLATIONS.has(violationType)) {
      return [];
    }

    const reason = event.reason ? `: ${event.reason}` : "";
    return [`critical post_tool policy violation (${violationType})${reason}`];
  });
}
