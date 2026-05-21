/**
 * BEH-032 — In-Band Kill Switch via CYCLE_ABORT
 *
 * Detects an explicit abort instruction (structural prompt features, not
 * keyword presence in output text) or programmatic invocation and emits a
 * CYCLE_ABORT event that transitions the state machine to FinalState: CANCELLED
 * and writes an abort-report entry to run-set.json#/abort_reports[].
 *
 * The abort-report includes: runId, ts, triggeredBy, reason, and the last 10
 * ActionSignal entries from the loop-detector ring buffer (BEH-022) if available.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §7 BEH-032
 * Gates: user_prompt, pre_tool
 * Risk floor: T (applies at all risk classes; kill switch is universal)
 *
 * Signal channels used:
 *   - prompt_pattern: structural features of the user prompt (imperative mood
 *     directed at stopping the current run; NOT keyword scanning of output text)
 *   - tool_args: programmatic abort flag in event.metadata.cycleAbort
 *   - evidence_state: context.runSet.runId + loop-detector ring buffer
 *
 * NEVER reads event.toolOutput as a raw text keyword source.
 *
 * Degraded mode (Codex / Hermes):
 *   user_prompt is supported on both Codex and Hermes with canBlock:true
 *   (runtime-profiles.ts). In-band abort via this behavior works normally on
 *   both runtimes. CYCLE_ABORT bypasses the stop gate and writes directly to
 *   FinalState: CANCELLED — the stop gate advisory limitation on Hermes does
 *   not affect abort semantics. BEH_032_DEGRADED_MODE encodes this for the
 *   integration agent.
 *
 * Integration note:
 *   The abort-report path "run-set.json#/abort_reports[]" requires an
 *   "abortReports" array field to be added to RunSetFileSchema by the
 *   integration agent (no fourth runtime file — same run-set.json).
 *   violationType "CYCLE_ABORT" must be added to GateViolationType in
 *   evaluate-gate.ts by the integration agent.
 *   CLI (harness abort) and MCP tool surface are a documented follow-up;
 *   this module covers the gate-level detection only.
 */

import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext, GateViolationType } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";

// ── New violation type identifier ─────────────────────────────────────────────
// Fix B3: use satisfies instead of "as GateViolationType" cast so the compiler
// validates the string is a member of the union (prevents silent drift).

export const VIOLATION_CYCLE_ABORT = "CYCLE_ABORT" satisfies GateViolationType;

// ── Degraded-mode metadata (read by integration agent) ────────────────────────

export const BEH_032_DEGRADED_MODE = {
  codex:
    "user_prompt supported and blocking on Codex; in-band abort works normally; CYCLE_ABORT writes FinalState: CANCELLED directly, bypassing stop gate",
  hermes:
    "user_prompt supported and blocking on Hermes; in-band abort works normally; CYCLE_ABORT bypasses stop gate (advisory on Hermes) and writes CANCELLED directly — no degradation for abort semantics",
} as const;

// ── Programmatic abort trigger (for CLI / MCP invocation path) ────────────────

/**
 * Exported so the CLI adapter and MCP tool handler can build a synthetic
 * GateEvent that activates this behavior without going through the prompt path.
 *
 * Usage:
 *   const event: GateEvent = {
 *     gateType: "user_prompt",
 *     metadata: { ...buildProgrammaticAbortMetadata("harness-cli", "operator abort") },
 *   };
 */
export function buildProgrammaticAbortMetadata(
  triggeredBy: "human" | "gate" | "policy",
  reason: string,
): Record<string, unknown> {
  return {
    cycleAbort: true,
    abortTriggeredBy: triggeredBy,
    abortReason: reason,
  };
}

// ── Abort-report builder ──────────────────────────────────────────────────────

export interface AbortReport {
  readonly runId: string;
  readonly ts: string;
  readonly triggeredBy: "human" | "gate" | "policy";
  readonly reason: string;
  /**
   * Last up-to-10 ActionSignal entries from the loop-detector ring buffer
   * (BEH-022). Empty array when the ring buffer is unavailable.
   * Mutable array so it is compatible with the AbortReportSchema type in run-set.schema.ts.
   */
  readonly lastActionSignals: unknown[];
}

function buildAbortReport(
  context: GateEvaluationContext,
  triggeredBy: "human" | "gate" | "policy",
  reason: string,
): AbortReport {
  // Signal: evidence_state — read loop-detector ring buffer if available
  const loopDetector = (context.runSet as Record<string, unknown>).loopDetector;
  let lastActionSignals: unknown[] = [];

  if (loopDetector && typeof loopDetector === "object" && !Array.isArray(loopDetector)) {
    const entries = (loopDetector as Record<string, unknown>).entries;
    if (Array.isArray(entries)) {
      // Take last 10 entries — slice returns a mutable unknown[] compatible with schema
      lastActionSignals = (entries as unknown[]).slice(-10);
    }
  }

  return {
    runId: context.runSet.runId,
    ts: new Date().toISOString(),
    triggeredBy,
    reason,
    lastActionSignals,
  };
}

// ── Prompt pattern detection ──────────────────────────────────────────────────

/**
 * Result of abort-intent detection.
 *
 * Fix H2: prompt-text patterns are prompt-injection DoS vectors — raw prompt
 * text can be crafted by an external actor to trigger CANCELLED state. Distinguish
 * two signal paths:
 *   - "block": operator-attested programmatic signal (metadata.cycleAbort with
 *     a valid attestation chain — abortTriggeredBy must be present and non-human,
 *     OR source is explicitly "gate" or "policy"). Only this path blocks.
 *   - "warn": prompt-text structural pattern — still surfaced as a WARN so a
 *     human can confirm, but does NOT directly abort a governed run.
 */
interface AbortDetectionResult {
  detected: boolean;
  /** "block" = operator-attested programmatic signal; "warn" = prompt-text pattern only */
  severity: "block" | "warn";
  triggeredBy: "human" | "gate" | "policy";
  reason: string;
}

/**
 * Detects structural abort intent in a gate event.
 *
 * Classification method: prompt_pattern + tool_args
 *
 * Signal 1 — operator-attested programmatic abort (blocks):
 *   metadata.cycleAbort === true AND:
 *     - metadata.abortTriggeredBy is "gate" or "policy" (machine-originated), OR
 *     - metadata.abortOrigin is present (operator set this in their harness config)
 *   A cycleAbort with abortTriggeredBy="human" and no abortOrigin attestation
 *   may still be prompt-injected (the agent sets metadata based on prompt text),
 *   so we require the non-human triggered-by or an explicit origin attestation.
 *
 * Signal 2 — prompt-text imperative (warns only, does not block):
 *   Short (≤12 words) imperative starting with a stop-action verb.
 *   This produces a WARN so a human operator can confirm — it does NOT directly
 *   abort a governed run, preventing prompt-injection DoS (H2 fix).
 *
 * NOT triggered by prose, questions, or conditional statements.
 */
function detectAbortIntent(event: GateEvent): AbortDetectionResult {
  const metadata = event.metadata ?? {};

  // Signal 1: programmatic invocation via metadata flag (CLI / MCP path).
  // Fix H2: require operator attestation — abortTriggeredBy must be "gate" or "policy",
  // OR abortOrigin must be present (set by the harness operator, not by prompt content).
  if (metadata.cycleAbort === true) {
    const triggeredBy = (metadata.abortTriggeredBy as "human" | "gate" | "policy") ?? "gate";
    const abortOrigin = metadata.abortOrigin;
    const reason =
      typeof metadata.abortReason === "string" && metadata.abortReason.length > 0
        ? metadata.abortReason
        : "programmatic abort invoked via cycleAbort metadata flag";

    // Operator-attested: gate/policy origin, or explicit abortOrigin set by operator.
    const isOperatorAttested =
      triggeredBy === "gate" || triggeredBy === "policy" || abortOrigin !== undefined;

    if (isOperatorAttested) {
      return { detected: true, severity: "block", triggeredBy, reason };
    }

    // cycleAbort=true but only human-asserted (could be prompt-injected) — warn only.
    return {
      detected: true,
      severity: "warn",
      triggeredBy,
      reason: `cycleAbort flag detected but lacks operator attestation (abortTriggeredBy=${triggeredBy}, no abortOrigin). Surfacing as WARN — a human operator must confirm abort.`,
    };
  }

  // Signal 2: prompt structural pattern — imperative directed at run termination.
  // Fix H2: this path produces WARN only (not block) — prompt text is user-controlled
  // and can be crafted to trigger abort (prompt-injection DoS).
  const promptContent = event.promptContent;
  if (typeof promptContent !== "string" || promptContent.trim().length === 0) {
    return { detected: false, severity: "warn", triggeredBy: "human", reason: "" };
  }

  const trimmed = promptContent.trim();

  // Require short imperative (≤ 12 words) to avoid matching prose discussions.
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 12) {
    return { detected: false, severity: "warn", triggeredBy: "human", reason: "" };
  }

  // Structural: starts with a stop-action verb (word boundary, case-insensitive)
  // followed optionally by run/agent/session/task qualifiers, end of line or punctuation.
  const ABORT_IMPERATIVE =
    /^(?:stop|abort|cancel|halt|kill|terminate|end)\b(?:\s+(?:(?:this|the)\s+)?(?:run|agent|session|task|cycle|execution|workflow))?[.!]?\s*$/i;

  if (ABORT_IMPERATIVE.test(trimmed)) {
    return {
      detected: true,
      severity: "warn", // Fix H2: prompt text → warn only, not block
      triggeredBy: "human",
      reason: `user issued explicit abort command: "${trimmed}"`,
    };
  }

  return { detected: false, severity: "warn", triggeredBy: "human", reason: "" };
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const killSwitch: BehaviorDescriptor = {
  id: "BEH-032",
  name: "In-Band Kill Switch — CYCLE_ABORT Event",
  gates: ["user_prompt", "pre_tool"],

  /**
   * Degraded note: Both user_prompt and pre_tool are supported and blocking on
   * Codex and Hermes. CYCLE_ABORT bypasses the stop gate and writes CANCELLED
   * directly — no degradation. See BEH_032_DEGRADED_MODE for integration details.
   */
  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const abortIntent = detectAbortIntent(event);
    if (!abortIntent.detected) {
      return null;
    }

    // Fix H2: prompt-text pattern → warn only; only operator-attested cycleAbort → block+CANCELLED.
    if (abortIntent.severity === "warn") {
      return {
        decision: "warn",
        reason: `BEH-032: potential abort signal detected from prompt text — "${abortIntent.reason}". This is a WARN only: prompt-text patterns cannot directly abort a governed run (prompt-injection DoS protection). To abort programmatically, set metadata.cycleAbort=true with abortTriggeredBy="gate" or include abortOrigin.`,
        violationType: VIOLATION_CYCLE_ABORT,
      };
    }

    // Fix m4: build the abort report and carry it on the verdict so handle-hook
    // can persist it to run-set.json#/abortReports[] via the updateRunSet callback.
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

// ── Re-export abort report builder for integration agent ─────────────────────
export { buildAbortReport };
