import type { GateEvent, GateVerdict } from "@hima/schemas";
import { getCell } from "./capability-map-v3.js";
import { pickAttack } from "./forcing-primitive.js";
import { readRegister } from "./skill-state.js";
import { translateClaude } from "./adapter-claude.js";
import type { RuntimeTarget } from "./capability-map-v3.js";
import type { ClaudeResponse } from "./adapter-claude.js";
import type { ForceAction } from "@hima/schemas";

/**
 * run-gate — orchestrate a full gate evaluation cycle.
 *
 * Steps:
 *  1. Read the skill register from disk (.hima/state/skill-sessions.json).
 *  2. Look up the capability cell for the active runtime + gate type.
 *  3. Call pickAttack() with the verdict + register + cell.
 *  4. Translate the ForceAction for the Claude runtime via translateClaude().
 *  5. Build a canary string: "[HIMA] <gateType> — forced:<skillId|none>".
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.2.
 */

export type RunGateInput = {
  /** Absolute path to the project root (used to resolve .hima/ state files). */
  root: string;
  /** Active runtime identifier. */
  runtime: RuntimeTarget;
  /** Gate type being evaluated. */
  gateType: GateEvent["gateType"];
  /** The full gate event payload. */
  event: GateEvent;
  /** The gate verdict produced by upstream policy/behavior evaluation. */
  verdict: GateVerdict;
};

export type RunGateResult = {
  forceAction: ForceAction;
  claude: ClaudeResponse;
  canary: string;
};

/**
 * runGate — evaluate a single gate, returning the ForceAction, Claude response,
 * and a canary string suitable for logging or injection into hook outputs.
 */
export async function runGate(input: RunGateInput): Promise<RunGateResult> {
  const { root, runtime, gateType, verdict } = input;

  // 1. Read the skill register (may be empty if the file does not exist yet).
  const register = await readRegister(root);

  // 2. Look up the capability cell for this runtime + gate type.
  const cell = getCell(runtime, gateType);

  // 3. Determine the strongest available force action.
  const forceAction = pickAttack(runtime, gateType, verdict, register, cell);

  // 4. Translate for the Claude runtime.
  const claude = translateClaude(forceAction);

  // 5. Build the canary string.
  const forcedId =
    forceAction.kind === "skill-force" || forceAction.kind === "hard-block"
      ? forceAction.kind === "skill-force"
        ? forceAction.skillId
        : "hard-block"
      : "none";

  const canary = `[HIMA] ${gateType} — forced:${forcedId}`;

  return { forceAction, claude, canary };
}
