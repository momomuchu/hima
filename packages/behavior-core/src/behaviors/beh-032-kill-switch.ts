// Ported from packages/core/src/behaviors/beh-032-kill-switch.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext, GateViolationType } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";

export const VIOLATION_CYCLE_ABORT = "CYCLE_ABORT" satisfies GateViolationType;

export const BEH_032_DEGRADED_MODE = {
  codex: "user_prompt supported and blocking on Codex; in-band abort works normally; CYCLE_ABORT writes FinalState: CANCELLED directly, bypassing stop gate",
  hermes: "user_prompt supported and blocking on Hermes; in-band abort works normally; CYCLE_ABORT bypasses stop gate (advisory on Hermes) and writes CANCELLED directly — no degradation for abort semantics",
} as const;

export function buildProgrammaticAbortMetadata(
  triggeredBy: "human" | "gate" | "policy",
  reason: string,
): Record<string, unknown> {
  return { cycleAbort: true, abortTriggeredBy: triggeredBy, abortReason: reason };
}

export interface AbortReport {
  readonly runId: string;
  readonly ts: string;
  readonly triggeredBy: "human" | "gate" | "policy";
  readonly reason: string;
  readonly lastActionSignals: unknown[];
}

export function buildAbortReport(
  context: GateEvaluationContext,
  triggeredBy: "human" | "gate" | "policy",
  reason: string,
): AbortReport {
  const loopDetector = (context.runSet as unknown as Record<string, unknown>).loopDetector;
  let lastActionSignals: unknown[] = [];
  if (loopDetector && typeof loopDetector === "object" && !Array.isArray(loopDetector)) {
    const entries = (loopDetector as Record<string, unknown>).entries;
    if (Array.isArray(entries)) lastActionSignals = (entries as unknown[]).slice(-10);
  }
  return { runId: context.runSet.runId, ts: new Date().toISOString(), triggeredBy, reason, lastActionSignals };
}

interface AbortDetectionResult {
  detected: boolean;
  severity: "block" | "warn";
  triggeredBy: "human" | "gate" | "policy";
  reason: string;
}

function detectAbortIntent(event: GateEvent): AbortDetectionResult {
  const metadata = event.metadata ?? {};

  if (metadata.cycleAbort === true) {
    const triggeredBy = (metadata.abortTriggeredBy as "human" | "gate" | "policy") ?? "gate";
    const abortOrigin = metadata.abortOrigin;
    const reason =
      typeof metadata.abortReason === "string" && metadata.abortReason.length > 0
        ? metadata.abortReason
        : "programmatic abort invoked via cycleAbort metadata flag";
    const isOperatorAttested = triggeredBy === "gate" || triggeredBy === "policy" || abortOrigin !== undefined;
    if (isOperatorAttested) return { detected: true, severity: "block", triggeredBy, reason };
    return {
      detected: true,
      severity: "warn",
      triggeredBy,
      reason: `cycleAbort flag detected but lacks operator attestation (abortTriggeredBy=${triggeredBy}, no abortOrigin). Surfacing as WARN — a human operator must confirm abort.`,
    };
  }

  const promptContent = event.promptContent;
  if (typeof promptContent !== "string" || promptContent.trim().length === 0) {
    return { detected: false, severity: "warn", triggeredBy: "human", reason: "" };
  }

  const trimmed = promptContent.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 12) return { detected: false, severity: "warn", triggeredBy: "human", reason: "" };

  const ABORT_IMPERATIVE =
    /^(?:stop|abort|cancel|halt|kill|terminate|end)\b(?:\s+(?:(?:this|the)\s+)?(?:run|agent|session|task|cycle|execution|workflow))?[.!]?\s*$/i;

  if (ABORT_IMPERATIVE.test(trimmed)) {
    return {
      detected: true,
      severity: "warn",
      triggeredBy: "human",
      reason: `user issued explicit abort command: "${trimmed}"`,
    };
  }

  return { detected: false, severity: "warn", triggeredBy: "human", reason: "" };
}

export const killSwitch: BehaviorDescriptor = {
  id: "BEH-032",
  name: "In-Band Kill Switch — CYCLE_ABORT Event",
  gates: ["user_prompt", "pre_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const abortIntent = detectAbortIntent(event);
    if (!abortIntent.detected) return null;

    if (abortIntent.severity === "warn") {
      return {
        decision: "warn",
        reason: `BEH-032: potential abort signal detected from prompt text — "${abortIntent.reason}". This is a WARN only: prompt-text patterns cannot directly abort a governed run (prompt-injection DoS protection). To abort programmatically, set metadata.cycleAbort=true with abortTriggeredBy="gate" or include abortOrigin.`,
        violationType: VIOLATION_CYCLE_ABORT,
      };
    }

    const report = buildAbortReport(context, abortIntent.triggeredBy, abortIntent.reason);
    return {
      decision: "block",
      reason: `BEH-032: CYCLE_ABORT — run ${context.runSet.runId} transitioning to CANCELLED. Triggered by: ${abortIntent.triggeredBy}. Reason: ${abortIntent.reason}. Abort report recorded (runId=${report.runId}, ts=${report.ts}, lastSignals=${report.lastActionSignals.length}).`,
      violationType: VIOLATION_CYCLE_ABORT,
      finalState: "CANCELLED",
      abortReport: report,
    };
  },
};
