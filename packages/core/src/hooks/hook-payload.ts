import { type GateEvent, GateEventSchema } from "../schemas/gate-event.schema.js";
import type { GateType } from "../types/canonical.js";

export function normalizeGatePayload(gateType: GateType, payload: unknown): GateEvent {
  const base = typeof payload === "object" && payload !== null ? payload : {};
  const record = base as Record<string, unknown>;
  const metadata = mergeMetadata(
    record.metadata,
    compactPayload({
      hookEventName: record.hookEventName ?? record.hook_event_name,
      sessionId: record.sessionId ?? record.session_id,
      cwd: record.cwd,
      permissionMode: record.permissionMode ?? record.permission_mode,
      transcriptPath: record.transcriptPath ?? record.transcript_path,
      toolUseId: record.toolUseId ?? record.tool_use_id,
      eventName: record.eventName ?? record.event_name,
      matcher: record.matcher,
      runId: record.runId ?? record.run_id,
      phase: record.phase,
      subPhase: record.subPhase ?? record.sub_phase,
      mode: record.mode,
      riskClass: record.riskClass ?? record.risk_class,
      compactionId: record.compactionId ?? record.compaction_id,
      compactionReason: record.compactionReason ?? record.compaction_reason ?? record.reason,
      compactionSummary: record.compactionSummary ?? record.compaction_summary ?? record.summary,
      contextHash: record.contextHash ?? record.context_hash,
      agentId: record.agentId ?? record.agent_id,
      role: record.role ?? record.agentRole ?? record.agent_role,
      runtime: record.runtime ?? record.targetRuntime ?? record.target_runtime,
      task: record.task ?? record.objective,
      scope: record.scope ?? record.agentScope ?? record.agent_scope,
      depth: record.depth ?? record.agentDepth ?? record.agent_depth,
      deliverables:
        record.deliverables ?? record.expectedDeliverables ?? record.expected_deliverables,
      expectedEvidenceKeys:
        record.expectedEvidenceKeys ??
        record.expected_evidence_keys ??
        record.requiredEvidenceKeys ??
        record.required_evidence_keys,
      requestedTools: record.requestedTools ?? record.requested_tools ?? record.tools,
      allowedTools: record.allowedTools ?? record.allowed_tools,
      explicitAllowedTools: record.explicitAllowedTools ?? record.explicit_allowed_tools,
      disallowedTools: record.disallowedTools ?? record.disallowed_tools,
      deniedTools: record.deniedTools ?? record.denied_tools,
      parentDeniedTools: record.parentDeniedTools ?? record.parent_denied_tools,
      sessionDeniedTools: record.sessionDeniedTools ?? record.session_denied_tools,
      budget: record.budget,
      failurePolicy: record.failurePolicy ?? record.failure_policy,
    }),
  );

  return GateEventSchema.parse({
    ...record,
    gateType,
    toolName: record.toolName ?? record.tool_name,
    toolInput: record.toolInput ?? record.tool_input,
    toolOutput:
      record.toolOutput ?? record.tool_output ?? record.tool_response ?? record.tool_result,
    promptContent: record.promptContent ?? record.prompt_content ?? record.prompt,
    ...(metadata === undefined ? {} : { metadata }),
  });
}

export function preview(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const text = typeof value === "string" ? value : safeJson(value);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

export function compactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mergeMetadata(
  existingMetadata: unknown,
  addedMetadata: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const existing =
    typeof existingMetadata === "object" &&
    existingMetadata !== null &&
    !Array.isArray(existingMetadata)
      ? (existingMetadata as Record<string, unknown>)
      : {};
  const merged = compactPayload({ ...existing, ...addedMetadata });

  return Object.keys(merged).length === 0 ? undefined : merged;
}
