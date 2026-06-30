/**
 * BEH_WORKER_MODEL — Worker-model explicit-model gate (R-028).
 *
 * At every subagent_start gate, this behavior enforces that the spawning
 * agent has explicitly named a model for the child. Spawning a subagent
 * without an explicit model violates the CLAUDE.md cost-guard rule
 * ([ALWAYS][WORKER-MODEL]: every spawned teammate gets an explicit model —
 * never `inherit`/session default).
 *
 * Decision tree:
 *   1. toolInput is absent or not an object → block (cannot verify; fail-closed).
 *   2. toolInput contains a non-empty `model` OR `subagent_type` field → allow.
 *   3. Neither field present (or both empty) → block (WORKER_MODEL_UNSPECIFIED).
 *
 * The two accepted field names reflect the divergent schemas observed across
 * runtimes:
 *   `model`         — Claude subagent spawn payload (Task tool, PostToolUse).
 *   `subagent_type` — Alternative schema used by some Claude Code extensions.
 *
 * Enforcement: hard-block (canBlock=true on Claude for subagent_start).
 * Codex/Hermes have subagent_start absent; this behavior fires only when
 * evaluateGate() is called with a "subagent_start" event, which can only
 * happen on runtimes where the gate is reachable.
 *
 * violationType: "WORKER_MODEL_UNSPECIFIED"
 * gates:         ["subagent_start"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-028,
 *      BEHAVIOR-CATALOG-v3.md P-05 worker-model-explicit,
 *      CLAUDE.md [ALWAYS][WORKER-MODEL]
 */

import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-WORKER-MODEL";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the explicit model identifier from a subagent spawn toolInput.
 *
 * Returns the first non-empty string found in `model` or `subagent_type`.
 * Returns null when neither field is present or both are empty.
 *
 * Defensive: toolInput is typed as `unknown` in GateEvent.
 */
function extractModel(toolInput: unknown): string | null {
  if (typeof toolInput !== "object" || toolInput === null) return null;

  const input = toolInput as Record<string, unknown>;

  const modelField = input["model"];
  if (typeof modelField === "string" && modelField.trim().length > 0) {
    return modelField.trim();
  }

  const subagentType = input["subagent_type"];
  if (typeof subagentType === "string" && subagentType.trim().length > 0) {
    return subagentType.trim();
  }

  return null;
}

// ---------------------------------------------------------------------------
// BEH_WORKER_MODEL descriptor
// ---------------------------------------------------------------------------

export const BEH_WORKER_MODEL: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Fires only at the subagent_start gate position.
  gates: ["subagent_start"],

  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event } = ctx;
    const model = extractModel(event.toolInput);

    if (model === null) {
      return {
        decision: "block",
        reason:
          "[BEH-WORKER-MODEL] subagent spawned without an explicit model — " +
          "set model (haiku|sonnet) explicitly",
        behaviorId: BEHAVIOR_ID,
        violationType: "WORKER_MODEL_UNSPECIFIED",
      };
    }

    return {
      decision: "allow",
      reason: `model explicitly set to "${model}"`,
      behaviorId: BEHAVIOR_ID,
    };
  },
};
