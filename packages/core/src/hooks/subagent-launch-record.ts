import type { RunSetFile, SubagentRunRecord } from "../schemas/run-set.schema.js";
import { redactSecrets, redactUnknown } from "../security/redaction.js";
import { compactPayload } from "./hook-payload.js";

export function upsertSubagentRecord(runSet: RunSetFile, record: SubagentRunRecord): RunSetFile {
  const existing = runSet.subagents.find((subagent) => subagent.agentId === record.agentId);
  const rest = runSet.subagents.filter((subagent) => subagent.agentId !== record.agentId);
  const merged: SubagentRunRecord = {
    ...existing,
    ...record,
    metadata: compactPayload({
      ...(existing?.metadata ?? {}),
      ...(record.metadata ?? {}),
    }),
  };

  return {
    ...runSet,
    subagents: [...rest, merged],
  };
}

export function redactSubagentRecord(record: SubagentRunRecord): SubagentRunRecord {
  const metadata = redactUnknown(record.metadata);
  return {
    ...record,
    agentId: redactString(record.agentId),
    role: redactOptionalString(record.role),
    runtime: redactOptionalString(record.runtime),
    scope: redactStringArray(record.scope),
    deliverables: redactStringArray(record.deliverables),
    evidenceRefs: redactStringArray(record.evidenceRefs),
    summary: redactOptionalString(record.summary),
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined,
  };
}

function redactString(value: string): string {
  return redactSecrets(value) ?? value;
}

function redactOptionalString(value: string | null | undefined): string | null | undefined {
  return typeof value === "string" ? redactString(value) : value;
}

function redactStringArray(values: readonly string[] | undefined): string[] | undefined {
  return values?.map(redactString);
}
