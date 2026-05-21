/**
 * BEH-030 — Subagent Contract Schema Completeness
 *
 * Validates that a SubagentInput carries budget + failurePolicy fields for
 * risk class M and above. Without these fields the parent thread has no
 * machine-readable instruction for subagent failure recovery.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §7 BEH-030
 * Gate: subagent_start
 * Risk floor: M (block at M+; abstain below)
 *
 * Signal channels used:
 *   - tool_args: event.metadata.budget / event.metadata.failurePolicy
 *   - evidence_state: context.currentRisk.risk_class
 *
 * NEVER reads event.toolOutput or event.promptContent as raw text.
 *
 * Degraded mode (Codex / Hermes):
 *   subagent_start is not supported on Codex or Hermes (runtime-profiles.ts:
 *   supported:false). Contract validation cannot occur at spawn time. The
 *   integration agent must validate the SubagentInput schema before issuing the
 *   delegate_task call and record a WARN in run-set.json if validation fails via
 *   a pre_tool Write check on the subagent definition file. This descriptor
 *   encodes that fallback via the BEH_030_DEGRADED_MODE export so the
 *   integration agent can read it programmatically.
 *
 * Integration note:
 *   violationType "SUBAGENT_CONTRACT_INCOMPLETE" must be added to the
 *   GateViolationType union in evaluate-gate.ts by the integration agent.
 */

import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext, GateViolationType } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── New violation type identifier ─────────────────────────────────────────────
// Fix B3: use satisfies instead of "as GateViolationType" cast so the compiler
// validates the string is a member of the union (prevents silent drift).

export const VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE =
  "SUBAGENT_CONTRACT_INCOMPLETE" satisfies GateViolationType;

// ── Degraded-mode metadata (read by integration agent) ────────────────────────

export const BEH_030_DEGRADED_MODE = {
  codex:
    "subagent_start not supported; parent must validate SubagentInput budget+failurePolicy before delegate_task; record WARN in run-set.json via pre_tool Write check on subagent definition file",
  hermes: "same as codex — subagent_start not supported; same pre_tool Write fallback path applies",
} as const;

// ── Budget sanity bounds (sec-M1) ─────────────────────────────────────────────

/**
 * Baseline budget floor: every subagent at ANY risk class must declare a
 * maxTurns of at least 1 and no more than MAX_TURNS_HARD_CAP.
 * Fix sec-M1: previously only enforced at M+; now enforced at ALL risk classes
 * to prevent unbounded subagents at T/L that could exhaust compute resources.
 */
const MAX_TURNS_HARD_CAP = 500;

/**
 * Absurd timeoutMs upper bound: 24 hours in milliseconds.
 * Values above this are almost certainly programming errors and are rejected.
 */
const MAX_TIMEOUT_MS_HARD_CAP = 24 * 60 * 60 * 1000; // 24 h

// ── Helpers ───────────────────────────────────────────────────────────────────

function readObjectMetadata(
  metadata: Record<string, unknown>,
  key: string,
  altKey?: string,
): Record<string, unknown> | null {
  const raw = metadata[key] ?? (altKey ? metadata[altKey] : undefined);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidPolicyAction(value: unknown): boolean {
  return value === "gap" || value === "retry" || value === "block";
}

/**
 * Validates that budget.maxTurns is within the sane range [1, MAX_TURNS_HARD_CAP].
 * Returns null on success, or an error string describing the violation.
 */
function validateMaxTurns(budget: Record<string, unknown> | null): string | null {
  const maxTurns = budget?.maxTurns;
  if (!isPositiveNumber(maxTurns)) {
    return "metadata.budget.maxTurns (positive integer required)";
  }
  if ((maxTurns as number) > MAX_TURNS_HARD_CAP) {
    return `metadata.budget.maxTurns=${maxTurns} exceeds hard cap ${MAX_TURNS_HARD_CAP}`;
  }
  return null;
}

/**
 * Validates that budget.timeoutMs is within sane range [1, MAX_TIMEOUT_MS_HARD_CAP].
 * Returns null on success, or an error string describing the violation.
 */
function validateTimeoutMs(budget: Record<string, unknown> | null): string | null {
  const timeoutMs = budget?.timeoutMs;
  if (!isPositiveNumber(timeoutMs)) {
    return "metadata.budget.timeoutMs (positive integer required)";
  }
  if ((timeoutMs as number) > MAX_TIMEOUT_MS_HARD_CAP) {
    return `metadata.budget.timeoutMs=${timeoutMs} exceeds hard cap ${MAX_TIMEOUT_MS_HARD_CAP} (24h)`;
  }
  return null;
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const subagentContractCompleteness: BehaviorDescriptor = {
  id: "BEH-030",
  name: "Subagent Contract — Budget and Failure Protocol Fields",
  gates: ["subagent_start"],

  /**
   * Degraded note: This classify function only fires when the subagent_start gate
   * is supported by the runtime (Claude Code). On Codex and Hermes, subagent_start
   * is not wired; the integration agent must run the equivalent schema check via a
   * pre_tool Write gate and consult BEH_030_DEGRADED_MODE for the fallback path.
   */
  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;

    const metadata = event.metadata ?? {};
    const budget = readObjectMetadata(metadata, "budget");
    const failurePolicy = readObjectMetadata(metadata, "failurePolicy", "failure_policy");

    const missing: string[] = [];

    // sec-M1 fix: budget.maxTurns enforced at ALL risk classes (not just M+).
    // Every subagent must declare a bounded turn limit regardless of risk class.
    // Also validates the value is within the sane range [1, MAX_TURNS_HARD_CAP].
    const maxTurnsError = validateMaxTurns(budget);
    if (maxTurnsError) {
      missing.push(maxTurnsError);
    }

    // budget.timeoutMs required at H/C (with hard-cap validation)
    if (riskAtLeast(riskClass, "H")) {
      const timeoutError = validateTimeoutMs(budget);
      if (timeoutError) {
        missing.push(timeoutError);
      }
    }

    // failurePolicy required at M+ only (T/L subagents don't need recovery policy)
    if (riskAtLeast(riskClass, "M")) {
      // failurePolicy.onTimeout required at M+
      if (!failurePolicy || !isValidPolicyAction(failurePolicy.onTimeout)) {
        missing.push("metadata.failurePolicy.onTimeout");
      }

      // failurePolicy.onError required at M+
      if (!failurePolicy || !isValidPolicyAction(failurePolicy.onError)) {
        missing.push("metadata.failurePolicy.onError");
      }

      // failurePolicy.maxRetries required when onError or onTimeout is "retry"
      if (
        failurePolicy &&
        (failurePolicy.onError === "retry" || failurePolicy.onTimeout === "retry")
      ) {
        if (!isNonNegativeNumber(failurePolicy.maxRetries)) {
          missing.push("metadata.failurePolicy.maxRetries");
        }
      }
    }

    if (missing.length === 0) {
      return null;
    }

    const timeoutNote = riskAtLeast(riskClass, "H") ? ", timeoutMs" : "";
    const policyNote = riskAtLeast(riskClass, "M") ? " and failurePolicy (onTimeout, onError)" : "";
    return {
      decision: "block",
      reason: `BEH-030: subagent spawn blocked at risk class ${riskClass} — SubagentInput missing required contract fields: ${missing.join(", ")}. Add budget (maxTurns${timeoutNote})${policyNote} to the subagent metadata.`,
      violationType: VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE,
      qualityDimension: "evidence",
    };
  },
};
