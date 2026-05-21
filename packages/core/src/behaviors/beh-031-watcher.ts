/**
 * BEH-031 — Watcher Subagent Role for High-Risk Runs
 *
 * At subagent_start for risk class H or C, checks whether a watcher subagent
 * is already registered in the active SubagentRunRecord list. Emits a warn if
 * none is present. The watcher is a read-only, evidence-collecting role whose
 * allowedTools must be restricted to [Read, Grep] and whose scope must be
 * limited to [".planning/"].
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §7 BEH-031
 * Gate: subagent_start
 * Risk floor: H (warn only — does not block; presence check advisory at H/C)
 *
 * Signal channels used:
 *   - evidence_state: context.runSet.subagents (SubagentRunRecord list)
 *   - evidence_state: context.currentRisk.risk_class
 *
 * NEVER reads event.toolOutput or event.promptContent as raw text.
 *
 * Degraded mode (Codex / Hermes):
 *   subagent_start is not supported on Codex or Hermes (runtime-profiles.ts:
 *   supported:false). The watcher cannot be spawned via the gate lifecycle.
 *   On Codex the parent thread must manually register a watcher record in
 *   run-set.json before beginning H/C work; if absent, WATCHER_NOT_REGISTERED
 *   is emitted at the next stop gate check via policy-event-blockers.
 *   On Hermes the stop gate is also advisory (canBlock:false), so the warn
 *   does not block — an accepted capability gap for Hermes at H/C risk.
 *   The BEH_031_DEGRADED_MODE export encodes this for the integration agent.
 *
 * Integration note:
 *   violationType "WATCHER_NOT_REGISTERED" must be added to the
 *   GateViolationType union in evaluate-gate.ts by the integration agent.
 */

import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext, GateViolationType } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import type { SubagentRunRecord } from "../schemas/run-set.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── New violation type identifier ─────────────────────────────────────────────
// Added to GateViolationType union by the integration agent in evaluate-gate.ts.

// Fix B3: use satisfies instead of "as GateViolationType" cast.
export const VIOLATION_WATCHER_NOT_REGISTERED =
  "WATCHER_NOT_REGISTERED" satisfies GateViolationType;

// ── Degraded-mode metadata (read by integration agent) ────────────────────────

export const BEH_031_DEGRADED_MODE = {
  codex:
    "subagent_start not supported; parent must manually register watcher record in run-set.json before H/C work; absent watcher emits WATCHER_NOT_REGISTERED at stop gate via policy-event-blockers",
  hermes:
    "subagent_start not supported; same manual registration path as Codex; stop gate advisory on Hermes means warn does not block — accepted capability gap at H/C",
} as const;

// ── Watcher registration statuses that count as "present" ────────────────────

const ACTIVE_WATCHER_STATUSES = new Set(["requested", "running", "completed"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the record represents a registered watcher with an
 * active-or-completed status.
 *
 * Checks:
 *   role === "watcher"
 *   status in { "requested" | "running" | "completed" }
 *
 * Signal: evidence_state (SubagentRunRecord fields, not output text).
 */
function isRegisteredWatcher(record: SubagentRunRecord): boolean {
  return record.role === "watcher" && ACTIVE_WATCHER_STATUSES.has(record.status ?? "");
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const watcherSubagentRole: BehaviorDescriptor = {
  id: "BEH-031",
  name: "Watcher Subagent — Required for H/C Risk Class",
  gates: ["subagent_start"],

  /**
   * Degraded note: This classify function only fires when the subagent_start gate
   * is supported by the runtime. On Codex and Hermes, the integration agent must
   * check for watcher presence via a stop-gate policy-event-blocker path and
   * consult BEH_031_DEGRADED_MODE for the manual registration fallback.
   */
  classify(context: GateEvaluationContext, _event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;

    // Risk floor: H — abstain for T, L, M
    if (!riskAtLeast(riskClass, "H")) {
      return null;
    }

    // Signal: evidence_state — scan SubagentRunRecord list for a registered watcher
    const hasWatcher = context.runSet.subagents.some(isRegisteredWatcher);
    if (hasWatcher) {
      return null;
    }

    return {
      decision: "warn",
      reason: `BEH-031: no registered watcher subagent found in run-set.json for risk class ${riskClass}. Register a subagent with role "watcher", allowedTools: [Read, Grep], scope: [".planning/"] before beginning high-risk work.`,
      violationType: VIOLATION_WATCHER_NOT_REGISTERED,
      qualityDimension: "evidence",
    };
  },
};
