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
 * TRACING CONTRACT: after each event is handled, appendTrace is called to
 * persist a structured TraceEvent. Tracing is wrapped in try/catch so a trace
 * failure never changes the hook's exit behaviour.
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
  appendTrace,
  loadConfig,
  resolveStageForceSkills,
} from "@hima/core";

import { DEV_CYCLE } from "@hima/schemas";
import type { GateVerdict, TraceEvent } from "@hima/schemas";

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
// Internal trace helper
// ---------------------------------------------------------------------------

/**
 * safeAppendTrace — build a TraceEvent and fire-and-forget to persist it.
 *
 * Deliberately NOT awaited: handlers return immediately without blocking on I/O.
 * Node.js event loop drains the pending appendFile before the process exits,
 * so the trace line is written even without an explicit await in the handler.
 * All errors are swallowed; tracing must NEVER alter the hook's exit behaviour.
 */
function safeAppendTrace(
  root: string,
  partial: Omit<TraceEvent, "ts">,
): void {
  try {
    const event: TraceEvent = { ...partial, ts: new Date().toISOString() };
    appendTrace(root, event, event.sessionId).catch(() => {
      // swallow — tracing must never break the hook
    });
  } catch {
    // swallow synchronous errors (e.g. schema construction)
  }
}

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
  const sessionId = payload.sessionId ?? "unknown-session";
  const text = payload.promptContent ?? "";

  // 1. Sigil detection
  const sigil = pickSigil(text);
  if (sigil === null) {
    // No sigil → silent allow
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "UserPromptSubmit",
      gateType: "noop",
      decision: "noop",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: "no terminal sigil detected",
    });
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

  // 4. Emit trace event for the ward activation
  safeAppendTrace(root, {
    sessionId,
    hookEvent: "UserPromptSubmit",
    gateType: "ward",
    decision: "allow",
    sigil: sigil.sigil,
    wardStage: ward.openStage,
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    canary,
  });
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
  const sessionId = payload.sessionId ?? "unknown-session";
  const toolName = payload.toolName ?? "";

  // 1. Load the ward. No ward → allow (the pipeline hasn't started yet).
  const ward = await resumeWard(root);
  if (ward === null) {
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "noop",
      decision: "noop",
      toolName: toolName || undefined,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: "no active ward",
    });
    return;
  }

  // 2. Resolve forceSkills for the current stage, honoring any project/user config.
  const config = await loadConfig(root);
  const forceSkills = resolveStageForceSkills(config, ward.openStage, DEV_CYCLE);
  if (forceSkills.length === 0) {
    // No forced skills for this stage → allow
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "noop",
      decision: "noop",
      toolName: toolName || undefined,
      wardStage: ward.openStage,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: "no forced skills for this stage",
    });
    return;
  }

  // 3. Read the skill register.
  const register = await readRegister(root);
  const skillsLoaded = register.map((r) => r.id);

  // 4. Find the first forceSkill not yet in the register.
  const missing = forceSkills.find(
    (ref) => !register.some((r) => r.id === ref.id && r.source === ref.source),
  );

  if (missing === undefined) {
    // All required skills are loaded → allow
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      decision: "allow",
      toolName: toolName || undefined,
      wardStage: ward.openStage,
      skillsForced: [],
      skillsLoaded,
      exitCode: 0,
      reason: "all required skills loaded",
    });
    return;
  }

  // 5. Only block if this is a write tool.
  if (!WRITE_TOOL_NAMES.has(toolName)) {
    // Non-write tool → allow (skill gate only fires on write tools)
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      decision: "allow",
      toolName: toolName || undefined,
      wardStage: ward.openStage,
      skillsForced: [],
      skillsLoaded,
      exitCode: 0,
      reason: "non-write tool — skill gate not enforced",
    });
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

    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      decision: "block",
      forceActionKind: action.kind,
      toolName: toolName || undefined,
      wardStage: ward.openStage,
      skillsForced: [missing.id],
      skillsLoaded,
      exitCode: 2,
      reason: claudeResponse.reason ?? verdict.reason,
    });
  } else {
    // pickAttack downgraded to inject/noop (shouldn't happen with claude pre_tool,
    // but honour it gracefully)
    if (claudeResponse.additionalContext !== undefined) {
      emitContext("PreToolUse", claudeResponse.additionalContext);
    } else {
      emitAllow();
    }

    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      decision: "allow",
      forceActionKind: action.kind,
      toolName: toolName || undefined,
      wardStage: ward.openStage,
      skillsForced: [],
      skillsLoaded,
      exitCode: 0,
      reason: "pickAttack downgraded block to allow",
    });
  }
}

/**
 * handleNoOp — for all other events: exit 0, optionally emit a canary to stderr.
 * Also persists a "noop" trace event so the session timeline is complete.
 */
export async function handleNoOp(
  eventName: string,
  root: string,
  sessionId: string,
): Promise<void> {
  // Emit a quiet canary to stderr so the hook wire can be tested end-to-end.
  process.stderr.write(`[hima] ${eventName}: no-op\n`);
  emitAllow();

  safeAppendTrace(root, {
    sessionId,
    hookEvent: eventName,
    gateType: "noop",
    decision: "noop",
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
  });
}
