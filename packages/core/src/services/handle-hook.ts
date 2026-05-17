import { evaluateGate, type GateResult } from "../gates/evaluate-gate.js";
import { compactPayload, normalizeGatePayload, preview } from "../hooks/hook-payload.js";
import { redactSubagentRecord, upsertSubagentRecord } from "../hooks/subagent-launch-record.js";
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
    const subagentRecord =
      result.decision === "allow" && result.subagentRecord
        ? redactSubagentRecord(result.subagentRecord)
        : undefined;
    await appendRunEvent(
      projectRoot,
      {
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
          evidenceAnchors: redactUnknown(result.evidenceAnchors),
          policyEvent: redactUnknown(result.policyEvent),
          subagentRecord: redactUnknown(result.subagentRecord),
          toolName: event.toolName,
          metadata: redactUnknown(event.metadata),
          promptContentPreview: preview(redactSecrets(event.promptContent) ?? event.promptContent),
          toolInputPreview: preview(redactUnknown(event.toolInput)),
          toolOutputPreview: preview(redactUnknown(event.toolOutput)),
        }),
      },
      subagentRecord ? (runSet) => upsertSubagentRecord(runSet, subagentRecord) : undefined,
    );
  }

  return {
    ...result,
    reason: redactedReason,
    failOpen: false,
  };
}
