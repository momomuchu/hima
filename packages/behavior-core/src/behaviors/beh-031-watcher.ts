// Ported from packages/core/src/behaviors/beh-031-watcher.ts — no logic changes

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext, GateViolationType } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast } from "../risk-class.js";
import type { SubagentRunRecord } from "../run-set-types.js";

export const VIOLATION_WATCHER_NOT_REGISTERED = "WATCHER_NOT_REGISTERED" satisfies GateViolationType;

export const BEH_031_DEGRADED_MODE = {
  codex: "subagent_start not supported; parent must manually register watcher record in run-set.json before H/C work; absent watcher emits WATCHER_NOT_REGISTERED at stop gate via policy-event-blockers",
  hermes: "subagent_start not supported; same manual registration path as Codex; stop gate advisory on Hermes means warn does not block — accepted capability gap at H/C",
} as const;

const ACTIVE_WATCHER_STATUSES = new Set(["requested", "running", "completed"]);

function isRegisteredWatcher(record: SubagentRunRecord): boolean {
  return record.role === "watcher" && ACTIVE_WATCHER_STATUSES.has(record.status ?? "");
}

export const watcherSubagentRole: BehaviorDescriptor = {
  id: "BEH-031",
  name: "Watcher Subagent — Required for H/C Risk Class",
  gates: ["subagent_start"],

  classify(context: GateEvaluationContext, _event: GateEvent): BehaviorVerdict {
    const riskClass = context.currentRisk.risk_class;
    if (!riskAtLeast(riskClass, "H")) return null;

    const hasWatcher = context.runSet.subagents.some(isRegisteredWatcher);
    if (hasWatcher) return null;

    return {
      decision: "warn",
      reason: `BEH-031: no registered watcher subagent found in run-set.json for risk class ${riskClass}. Register a subagent with role "watcher", allowedTools: [Read, Grep], scope: [".planning/"] before beginning high-risk work.`,
      violationType: VIOLATION_WATCHER_NOT_REGISTERED,
      qualityDimension: "evidence",
    };
  },
};
