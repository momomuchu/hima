import { evaluateGate, type GateResult } from "../gates/evaluate-gate.js";
import { type GateEvent, GateEventSchema } from "../schemas/gate-event.schema.js";
import { redactSecrets, redactUnknown } from "../security/redaction.js";
import {
  appendRunEvent,
  type PlanningProject,
  readPlanningProject,
} from "../storage/planning-store.js";
import type { GateType } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";

export interface HandleHookOptions {
  dryRun?: boolean;
}

export interface HookResponse extends GateResult {
  failOpen: boolean;
}

export async function handleHook(
  projectRoot: string,
  gateType: GateType,
  payload: unknown,
  options: HandleHookOptions = {},
): Promise<HookResponse> {
  let project: PlanningProject;

  try {
    project = await readPlanningProject(projectRoot);
  } catch (error) {
    const reason = redactSecrets(
      `planning state unavailable: ${
        error instanceof HarnessError ? error.message : "failed to read planning state"
      }`,
    );

    return {
      decision: "block",
      gateType,
      reason: reason ?? "planning state unavailable",
      violationType: "RUNTIME_BINDING_UNAVAILABLE",
      finalState: "BLOCKED_RUNTIME_MISSING",
      failOpen: false,
    };
  }

  const event = normalizeGatePayload(gateType, payload);
  const result = evaluateGate(
    {
      projectRoot,
      state: project.state,
      currentRisk: project.currentRisk,
      runSet: project.runSet,
    },
    event,
  );
  const redactedReason = redactSecrets(result.reason) ?? result.reason;

  if (!options.dryRun) {
    await appendRunEvent(projectRoot, {
      id: `evt_${Date.now()}`,
      ts: new Date().toISOString(),
      type: "GATE_EVALUATED",
      gateType,
      decision: result.decision,
      reason: redactedReason,
      payload: compactPayload({
        violationType: result.violationType,
        finalState: result.finalState,
        missingEvidenceItems: result.missingEvidenceItems,
        toolName: event.toolName,
        metadata: redactUnknown(event.metadata),
        toolInputPreview: preview(redactUnknown(event.toolInput)),
        toolOutputPreview: preview(redactUnknown(event.toolOutput)),
      }),
    });
  }

  return {
    ...result,
    reason: redactedReason,
    failOpen: false,
  };
}

function preview(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const text = typeof value === "string" ? value : safeJson(value);
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function compactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeGatePayload(gateType: GateType, payload: unknown): GateEvent {
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
