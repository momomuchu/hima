/**
 * BEH-W4 — Gate-Decision Observability
 *
 * Builds GateDecisionRecord events for every gate evaluation (allow, warn, block)
 * and computes per-behavior SLI snapshots at stop gate.
 *
 * Design: .planning/behavior-system/gate-config-and-observability-design.md §3
 */

import type { GateEvent } from "../schemas/gate-event.schema.js";
import type {
  BehaviorSliSnapshot,
  GateDecisionRecord,
  RunEvent,
} from "../schemas/run-set.schema.js";
import type { OverrideResolution } from "./behavior-override.js";
import type { GateEvaluationContext, GateResult } from "./evaluate-gate.js";

// ── GateDecisionRecord builder ────────────────────────────────────────────────

export interface GateDecisionInput {
  context: GateEvaluationContext;
  event: GateEvent;
  result: GateResult;
  behaviorId: string | null;
  overrideResolution?: OverrideResolution;
}

/**
 * Builds a GateDecisionRecord from a completed gate evaluation.
 * Every gate evaluation — allow, warn, or block — produces exactly one record.
 * For disabled behaviors the verdict is "allow" with overrideMode="disabled".
 */
export function buildGateDecisionRecord(input: GateDecisionInput): GateDecisionRecord {
  const { context, event, result, behaviorId, overrideResolution } = input;

  const overrideActive = overrideResolution?.overrideActive ?? false;
  const overrideMode = overrideResolution?.overrideMode;

  // Build compact signal summary from event fields.
  const signalsRead = buildSignalsRead(event, result);

  const why = buildWhy(result, event, behaviorId);

  const resolution = result.decision === "block" ? buildResolution(result, behaviorId) : undefined;

  const record: GateDecisionRecord = {
    type: "GATE_DECISION",
    ts: new Date().toISOString(),
    runId: context.state.run_id,
    gateType: event.gateType,
    behaviorId,
    classifierMethod: behaviorId ? inferClassifierMethod(event) : null,
    signalsRead,
    verdict: result.decision,
    violationType: result.violationType ?? null,
    evidenceRefs: buildEvidenceRefs(result),
    why,
    ...(resolution ? { resolution } : {}),
    riskClass: context.currentRisk.risk_class,
    phase: context.state.phase,
    subPhase: context.state.sub_phase ?? "Observer",
    overrideActive,
    ...(overrideActive && overrideMode ? { overrideMode } : {}),
  };

  return record;
}

/**
 * Converts a GateDecisionRecord to the standard RunEvent shape used in
 * run-set.json#/events[]. The full record is stored in the payload field.
 */
export function gateDecisionRecordToRunEvent(record: GateDecisionRecord): RunEvent {
  return {
    id: `gate_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: record.ts,
    type: "GATE_DECISION",
    gateType: record.gateType,
    decision: record.verdict,
    reason: record.why,
    payload: record as unknown as Record<string, unknown>,
  };
}

// ── SLI computation ───────────────────────────────────────────────────────────

/**
 * Computes per-behavior SLI snapshots from the events in run-set.json.
 * Called at the stop gate and written to run-set.json#/policy/sliSnapshot.
 *
 * GateDecisionRecords are embedded in GATE_EVALUATED event payloads under
 * `payload.gateDecisions[]`. This function extracts them for SLI computation.
 *
 * Window = all GATE_EVALUATED events in the current run (windowRuns = 1).
 */
export function computeSliSnapshots(events: readonly RunEvent[]): BehaviorSliSnapshot[] {
  // Collect all GateDecisionRecord objects from two sources:
  // 1. Standalone GATE_DECISION events (used in tests and legacy paths).
  // 2. GateDecisionRecords embedded in GATE_EVALUATED event payloads under
  //    payload.gateDecisions[] (the runtime production path).
  const allDecisions: Record<string, unknown>[] = [];

  function collectDecision(d: unknown): void {
    if (
      typeof d === "object" &&
      d !== null &&
      typeof (d as Record<string, unknown>).behaviorId === "string" &&
      (d as Record<string, unknown>).behaviorId !== null
    ) {
      allDecisions.push(d as Record<string, unknown>);
    }
  }

  for (const ev of events) {
    if (ev.type === "GATE_DECISION") {
      // Source 1: standalone GATE_DECISION event — the GateDecisionRecord fields
      // are stored in the event payload (produced by gateDecisionRecordToRunEvent).
      const payload = ev.payload as Record<string, unknown> | undefined;
      if (payload) {
        collectDecision(payload);
      }
    } else if (ev.type === "GATE_EVALUATED") {
      // Source 2: GateDecisionRecords embedded in GATE_EVALUATED payload.gateDecisions[].
      const payload = ev.payload as Record<string, unknown> | undefined;
      if (!payload) continue;
      const gateDecisions = payload.gateDecisions;
      if (!Array.isArray(gateDecisions)) continue;
      for (const d of gateDecisions) {
        collectDecision(d);
      }
    }
  }

  // Group by behaviorId.
  const byBehavior = new Map<string, Array<Record<string, unknown>>>();
  for (const d of allDecisions) {
    const bid = d.behaviorId as string;
    if (!byBehavior.has(bid)) {
      byBehavior.set(bid, []);
    }
    byBehavior.get(bid)?.push(d);
  }

  const snapshots: BehaviorSliSnapshot[] = [];
  const snapshotAt = new Date().toISOString();

  for (const [behaviorId, records] of byBehavior) {
    const total = records.length;
    let blockCount = 0;
    let warnCount = 0;
    let allowCount = 0;
    let overrideDisabledCount = 0;
    let overrideWarnOnlyCount = 0;

    for (const rec of records) {
      const verdict = rec.verdict as string;
      const overrideActive = rec.overrideActive as boolean | undefined;
      const overrideMode = rec.overrideMode as string | undefined;

      if (verdict === "block") blockCount++;
      else if (verdict === "warn") warnCount++;
      else allowCount++;

      if (overrideActive) {
        if (overrideMode === "disabled") overrideDisabledCount++;
        else if (overrideMode === "warn-only") overrideWarnOnlyCount++;
      }
    }

    const blockRate = total > 0 ? blockCount / total : 0;
    const falsePositiveRate = total > 0 ? overrideDisabledCount / total : 0;

    snapshots.push({
      behaviorId,
      windowRuns: 1,
      totalDecisions: total,
      blockCount,
      warnCount,
      allowCount,
      overrideDisabledCount,
      overrideWarnOnlyCount,
      blockRate,
      falsePositiveRate,
      snapshotAt,
    });
  }

  return snapshots;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function buildSignalsRead(event: GateEvent, result: GateResult): GateDecisionRecord["signalsRead"] {
  const signals: GateDecisionRecord["signalsRead"] = [];
  const isBlock = result.decision === "block";

  // tool_type signal: always present when toolName is available.
  if (event.toolName) {
    signals.push({
      channel: "tool_type",
      summary: `tool=${event.toolName}`,
      deciding: false,
    });
  }

  // tool_args signal: when toolInput is present.
  if (event.toolInput !== undefined && event.toolInput !== null) {
    const preview = previewValue(event.toolInput);
    if (preview) {
      signals.push({
        channel: "tool_args",
        summary: preview,
        deciding: isBlock && signals.length <= 1,
      });
    }
  }

  // evidence_state signal: phase/subPhase/risk.
  signals.push({
    channel: "evidence_state",
    summary: `phase=${event.gateType}, riskClass=${result.decision === "block" ? "block-relevant" : "ok"}`,
    deciding: false,
  });

  // Mark the first signal as deciding on block when no tool_args signal decided.
  if (isBlock && signals.length > 0 && !signals.some((s) => s.deciding)) {
    // biome-ignore lint/style/noNonNullAssertion: signals[0] is defined — guarded by signals.length > 0
    signals[0] = { ...signals[0]!, deciding: true };
  }

  return signals;
}

function buildWhy(result: GateResult, event: GateEvent, behaviorId: string | null): string {
  // Use the gate result reason directly if it's long enough.
  if (result.reason && result.reason.length >= 10) {
    return result.reason;
  }
  // Fallback: synthesize from available fields.
  const beh = behaviorId ? ` [${behaviorId}]` : "";
  return `Gate ${event.gateType}${beh} evaluated with decision=${result.decision}.`;
}

function buildResolution(result: GateResult, behaviorId: string | null): string[] {
  const steps: string[] = [];

  if (result.missingEvidenceItems && result.missingEvidenceItems.length > 0) {
    steps.push(
      `Add evidence for: ${result.missingEvidenceItems.join(", ")} to run-set.json#/evidence`,
    );
  }

  if (result.violationType === "FORBIDDEN_WRITE_ZONE") {
    steps.push("Transition to the correct sub-phase before writing to the target path.");
    steps.push("Or move the target to an allowed write zone for the current sub-phase.");
  }

  if (result.violationType === "BYPASS_ATTEMPTED") {
    steps.push("Remove bypass instructions from the tool call or prompt.");
  }

  if (behaviorId) {
    steps.push(
      `Or add a behaviorOverride in run-set.json#/policy/behaviorOverrides for ${behaviorId} with mode "warn-only" and a justification (if this is a deliberate deviation).`,
    );
  }

  if (steps.length === 0) {
    steps.push(`Review the gate reason and resolve the underlying issue before proceeding.`);
  }

  return steps;
}

function buildEvidenceRefs(result: GateResult): string[] {
  const refs: string[] = [];

  if (result.evidenceAnchors) {
    for (const anchor of result.evidenceAnchors) {
      refs.push(anchor);
    }
  }

  if (result.missingEvidenceItems) {
    for (const item of result.missingEvidenceItems) {
      refs.push(`run-set.json#/evidence/${item}`);
    }
  }

  return refs;
}

function inferClassifierMethod(event: GateEvent): GateDecisionRecord["classifierMethod"] {
  // Infer from which signals are present on the event.
  const hasToolArgs = event.toolInput !== undefined && event.toolInput !== null;
  const hasToolType = Boolean(event.toolName);
  const hasPrompt = Boolean(event.promptContent);

  if (hasToolArgs && hasToolType) return "composite";
  if (hasToolArgs) return "tool_args";
  if (hasToolType) return "tool_type";
  if (hasPrompt) return "prompt_pattern";
  return "evidence_state";
}

function previewValue(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 120);
  }
  try {
    const s = JSON.stringify(value);
    return s ? s.slice(0, 120) : "";
  } catch {
    return String(value).slice(0, 120);
  }
}
