import { evaluateGate, type GateResult } from "../gates/evaluate-gate.js";
import { type GateEvent, GateEventSchema } from "../schemas/gate-event.schema.js";
import {
  appendRunEvent,
  type PlanningProject,
  readPlanningProject,
} from "../storage/planning-store.js";
import type { GateType } from "../types/canonical.js";
import { HarnessError } from "../types/errors.js";

const SECRET_KEY_PATTERN = /api[_-]?key|apikey|token|password|secret/i;

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
        toolInputPreview: redactSecrets(preview(event.toolInput)),
        toolOutputPreview: redactSecrets(preview(event.toolOutput)),
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

function redactSecrets(value: string | undefined): string | undefined {
  return value
    ?.replace(
      /((?:api[_-]?key|token|password|secret)\s*[:=]\s*["']?)[a-z0-9_-]{8,}/gi,
      "$1[REDACTED]",
    )
    .replace(/sk-[a-z0-9]{8,}/gi, "sk-[REDACTED]")
    .replace(/ghp_[a-z0-9]{8,}/gi, "ghp_[REDACTED]");
}

function redactUnknown(value: unknown, key?: string): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key ?? "")) {
      return "[REDACTED]";
    }

    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, key));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, item]) => [childKey, redactUnknown(item, childKey)]),
    );
  }

  return value;
}

function normalizeGatePayload(gateType: GateType, payload: unknown): GateEvent {
  const base = typeof payload === "object" && payload !== null ? payload : {};
  return GateEventSchema.parse({
    ...(base as Record<string, unknown>),
    gateType,
  });
}
