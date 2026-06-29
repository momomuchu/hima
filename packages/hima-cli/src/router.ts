/**
 * router — event handlers for each hima hook event.
 *
 * Each handler receives the resolved project root and the parsed stdin payload.
 * Handlers are pure in intent: they call @hima/core logic and emit a Claude
 * response via claude-format helpers, then return.
 *
 * SAFETY CONTRACT: every handler MUST be wrapped in a try/catch by the caller
 * (index.ts). Any unhandled error inside a handler should result in exit 0
 * (allow), never a crash that blocks the session.
 *
 * Event routing:
 *   user-prompt-submit  → sigil detection → ward create/resume → emit context
 *   pre-tool-use        → skill-gate enforcement for write tools
 *   all others          → no-op, exit 0
 */

import { randomUUID } from "node:crypto";

import {
  pickSigil,
  createWard,
  resumeWard,
  readRegister,
  getCell,
  pickAttack,
  translateClaude,
} from "@hima/core";

import { DEV_CYCLE } from "@hima/schemas";
import type { GateVerdict } from "@hima/schemas";

import { emitBlock, emitContext, emitAllow } from "./claude-format.js";
import type { StdinPayload } from "./stdin.js";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Tool names Claude uses for file-write operations.
 * Pre-tool-use skill-gate enforcement applies only to these.
 */
const WRITE_TOOL_NAMES = new Set([
  "Write",
  "Edit",
  "MultiEdit",
]);

// ---------------------------------------------------------------------------
// Exported event handlers
// ---------------------------------------------------------------------------

/**
 * handleUserPromptSubmit — detect a terminal sigil, create/resume the ward,
 * emit a canary additionalContext so the agent knows the ward is active.
 */
export async function handleUserPromptSubmit(
  root: string,
  payload: StdinPayload,
): Promise<void> {
  const text = payload.promptContent ?? "";

  // 1. Sigil detection
  const sigil = pickSigil(text);
  if (sigil === null) {
    // No sigil → silent allow
    emitAllow();
    return;
  }

  // 2. Create or resume the ward
  const existing = await resumeWard(root);
  const ward = existing ?? await createWard(root, {
    id: randomUUID(),
    entryPoint: sigil.entryPoint,
    floor: sigil.floor,
  });

  // 3. Build a canary and emit it as additionalContext
  const canary = `[HIMA] ward:${ward.id} stage:${ward.openStage} sigil:${sigil.sigil} floor:${ward.floor}`;
  emitContext("UserPromptSubmit", canary);
}

/**
 * handlePreToolUse — enforce skill-gate for write tools.
 *
 * For each forceSkill in the current ward's openStage that is NOT yet in the
 * register: if this is a write tool, block. Otherwise allow.
 */
export async function handlePreToolUse(
  root: string,
  payload: StdinPayload,
): Promise<void> {
  const toolName = payload.toolName ?? "";

  // 1. Load the ward. No ward → allow (the pipeline hasn't started yet).
  const ward = await resumeWard(root);
  if (ward === null) {
    emitAllow();
    return;
  }

  // 2. Find the current stage definition in DEV_CYCLE.
  const stageDef = DEV_CYCLE.stages.find((s) => s.id === ward.openStage);
  if (stageDef === undefined || stageDef.forceSkills.length === 0) {
    // No forced skills for this stage → allow
    emitAllow();
    return;
  }

  // 3. Read the skill register.
  const register = await readRegister(root);

  // 4. Find the first forceSkill not yet in the register.
  const missing = stageDef.forceSkills.find(
    (ref) => !register.some((r) => r.id === ref.id && r.source === ref.source),
  );

  if (missing === undefined) {
    // All required skills are loaded → allow
    emitAllow();
    return;
  }

  // 5. Only block if this is a write tool.
  if (!WRITE_TOOL_NAMES.has(toolName)) {
    // Non-write tool → allow (skill gate only fires on write tools)
    emitAllow();
    return;
  }

  // 6. Build a GateVerdict and run through pickAttack → translateClaude.
  const verdict: GateVerdict = {
    decision: "block",
    reason: `skill ${missing.id} is required for stage "${ward.openStage}" and has not been invoked`,
    forceIntent: {
      kind: "SkillGate",
      skillId: missing.id,
      blocksUntilInvoked: true,
    },
  };

  const cell = getCell("claude", "pre_tool");
  const action = pickAttack("claude", "pre_tool", verdict, register, cell);
  const claudeResponse = translateClaude(action);

  if (claudeResponse.decision === "block") {
    emitBlock(claudeResponse.reason ?? verdict.reason);
  } else {
    // pickAttack downgraded to inject/noop (shouldn't happen with claude pre_tool,
    // but honour it gracefully)
    if (claudeResponse.additionalContext !== undefined) {
      emitContext("PreToolUse", claudeResponse.additionalContext);
    } else {
      emitAllow();
    }
  }
}

/**
 * handleNoOp — for all other events: exit 0, optionally emit a canary to stderr.
 */
export function handleNoOp(eventName: string): void {
  // Emit a quiet canary to stderr so the hook wire can be tested end-to-end.
  process.stderr.write(`[hima] ${eventName}: no-op\n`);
  emitAllow();
}
