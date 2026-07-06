/**
 * BEH_WORKER_MODEL — Worker-model explicit-model gate (R-028).
 *
 * This behavior enforces that the spawning agent has explicitly named a model
 * for the child. Spawning a subagent without an explicit model violates the
 * CLAUDE.md cost-guard rule ([ALWAYS][WORKER-MODEL]: every spawned teammate
 * gets an explicit model — never `inherit`/session default).
 *
 * Decision tree:
 *   1. toolInput is absent or not an object → block (cannot verify; fail-closed).
 *   2. toolInput contains a non-empty `model` OR `subagent_type` field → allow.
 *   3. Neither field present (or both empty) → block (WORKER_MODEL_UNSPECIFIED).
 *
 * The two accepted field names reflect the divergent schemas observed across
 * runtimes:
 *   `model`         — Claude subagent spawn payload (Agent/Task tool).
 *   `subagent_type` — Alternative schema used by some Claude Code extensions.
 *
 * CORRECTION (SOT C2, docs/research/runtime-capabilities.sot.json): Claude's
 * SubagentStart hook is INJECTION-ONLY (canBlock:false in the official docs) —
 * it cannot actually deny a spawn. A gate that tried to hard-block there was
 * dark (unenforceable). This behavior therefore fires at TWO gate positions:
 *
 *   - "subagent_start" — kept for the injected reminder / Hermes+Codex
 *     compensation paths (handleHermesDelegateTask, handleSubagentStart);
 *     evaluated unconditionally, same as before.
 *   - "pre_tool" — NEW: the actual hard-block point on Claude. pre_tool fires
 *     for every tool call, so this behavior only evaluates the model check
 *     when the tool being called IS the Agent/Task spawn tool itself
 *     (`AGENT_SPAWN_TOOL_NAMES`); every other pre_tool call (Write, Edit,
 *     Bash, ...) passes through untouched. Claude's pre_tool cell has
 *     canBlock:true universally, so a block verdict here really does deny the
 *     spawn via a real PreToolUse deny (see handlePreToolUse in
 *     packages/hima-cli/src/router.ts).
 *
 * violationType: "WORKER_MODEL_UNSPECIFIED"
 * gates:         ["subagent_start", "pre_tool"]
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

/**
 * Tool name that spawns a Claude sub-agent, scoped for the NEW pre_tool
 * enforcement point. Scoping to this exact name prevents this behavior from
 * misfiring on ordinary tool calls (Write, Edit, Bash, ...) that legitimately
 * have no "model" field.
 *
 * Deliberately "Agent" ONLY, not also the legacy "Task" alias: BehaviorContext
 * carries no runtime field (GateEvent has gateType/toolName/toolInput only),
 * so this behavior cannot tell Claude apart from Codex/Hermes calls that
 * happen to reuse the string "Task" as a generic non-Claude placeholder
 * toolName elsewhere in this codebase's own harness (e.g. the Codex
 * poll-file/spawn-detection path in codex-subagent.ts + its tests, which
 * intentionally has no "model" field and must keep exiting 0). "Agent" is
 * unambiguous — it is the CURRENT real Claude primitive name (SOT) and is not
 * reused as a placeholder anywhere else. The "Task" alias remains covered at
 * the (unconditional, no toolName filtering) subagent_start gate below.
 */
const AGENT_SPAWN_TOOL_NAMES = new Set(["Agent"]);

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

  // SOT correction C2: subagent_start is injection-only on Claude (cannot
  // block); pre_tool is the real enforcement point, scoped below to the
  // Agent/Task spawn tool call.
  gates: ["subagent_start", "pre_tool"],

  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event } = ctx;

    // At pre_tool, this behavior fires for EVERY tool call. Scope it to the
    // Agent/Task spawn tool itself — any other tool (Write, Edit, Bash, ...)
    // legitimately has no "model" field and must pass through untouched.
    // At subagent_start the event IS already a subagent spawn by construction
    // (the hook only fires on spawn), so no toolName filtering is applied there.
    if (event.gateType === "pre_tool" && !AGENT_SPAWN_TOOL_NAMES.has(event.toolName ?? "")) {
      return {
        decision: "allow",
        reason: "not an Agent/Task subagent-spawn tool call",
        behaviorId: BEHAVIOR_ID,
      };
    }

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
