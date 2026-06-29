/**
 * router — event handlers for each hima hook event.
 *
 * Each handler receives the resolved project root, the parsed stdin payload,
 * and the active runtime target (default "claude").
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
 *   stop                → BEH-023 completion gate → block on missing evidence
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
  dispatchTranslate,
  evaluateGate,
  getBehaviorsForGate,
  resolveRiskClass,
  appendTrace,
  loadConfig,
  resolveStageForceSkills,
} from "@hima/core";
import type { RuntimeTarget } from "@hima/core";

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
 *
 * R-001: evaluateGate is called for user_prompt behaviors (near-noop at I8,
 * since no behaviors are registered for user_prompt yet — future iterations add
 * S-15, S-17, etc.).
 */
export async function handleUserPromptSubmit(
  root: string,
  payload: StdinPayload,
  _runtime: RuntimeTarget = "claude",
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

  // 3. R-001 — evaluateGate for user_prompt behaviors (near-noop at I8).
  //    getBehaviorsForGate("user_prompt") returns [] until later iterations.
  //    Calling it here wires the call-site so future behaviors are live without
  //    further router changes.
  const riskClass = resolveRiskClass(ward);
  const userPromptCtx = {
    event: { gateType: "user_prompt" as const, promptContent: text },
    riskClass,
    root,
    ward,
    agentOutput: text,
  };
  // Near-noop: evaluateGate returns "allow" when no behaviors are registered.
  // The result is not used to block here — future behaviors will gate this path.
  await evaluateGate(getBehaviorsForGate("user_prompt"), userPromptCtx);

  // 4. Build a canary and emit it as additionalContext
  const canary = `[HIMA] ward:${ward.id} stage:${ward.openStage} sigil:${sigil.sigil} floor:${ward.floor}`;
  emitContext("UserPromptSubmit", canary);

  // 5. Emit trace event for the ward activation
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
 * R-001: evaluateGate is called for pre_tool behaviors before the skill-gate
 *        check (near-noop at I8, since no behaviors registered for pre_tool).
 * R-002: ward.floor is read as riskClass via resolveRiskClass(ward).
 * R-012: runtime is threaded through; getCell and dispatchTranslate are
 *        parameterised on runtime instead of hardcoded to "claude".
 *
 * For each forceSkill in the current ward's openStage that is NOT yet in the
 * register: if this is a write tool, block. Otherwise allow.
 */
export async function handlePreToolUse(
  root: string,
  payload: StdinPayload,
  runtime: RuntimeTarget = "claude",
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

  // 2. R-002 — resolve riskClass from ward.floor.
  const riskClass = resolveRiskClass(ward);

  // 3. R-001 — evaluateGate for pre_tool behaviors (near-noop at I8).
  //    getBehaviorsForGate("pre_tool") returns [] until I9 adds safety guards.
  //    If a future behavior blocks here, we respect it and skip skill-force.
  const preToolCtx = {
    event: {
      gateType: "pre_tool" as const,
      toolName: toolName || undefined,
      toolInput: payload.toolInput,
    },
    riskClass,
    root,
    ward,
    agentOutput: undefined,
  };
  const behaviorVerdict = await evaluateGate(getBehaviorsForGate("pre_tool"), preToolCtx);

  if (behaviorVerdict.decision === "block") {
    // A pre_tool behavior blocked — use this verdict directly.
    const register = await readRegister(root);
    const cell = getCell(runtime, "pre_tool");
    const action = pickAttack(runtime, "pre_tool", behaviorVerdict, register, cell);
    const response = dispatchTranslate(runtime, action);

    if (response.decision === "block") {
      emitBlock(response.reason ?? behaviorVerdict.reason);
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PreToolUse",
        gateType: "pre_tool",
        decision: "block",
        toolName: toolName || undefined,
        wardStage: ward.openStage,
        skillsForced: [],
        skillsLoaded: register.map((r) => r.id),
        exitCode: 2,
        reason: response.reason ?? behaviorVerdict.reason,
      });
    } else {
      emitAllow();
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PreToolUse",
        gateType: "pre_tool",
        decision: "allow",
        toolName: toolName || undefined,
        wardStage: ward.openStage,
        skillsForced: [],
        skillsLoaded: register.map((r) => r.id),
        exitCode: 0,
        reason: "behavior verdict downgraded to allow by dispatchTranslate",
      });
    }
    return;
  }

  // 4. Resolve forceSkills for the current stage, honoring any project/user config.
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

  // 5. Read the skill register.
  const register = await readRegister(root);
  const skillsLoaded = register.map((r) => r.id);

  // 6. Find the first forceSkill not yet in the register.
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

  // 7. Only block if this is a write tool.
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

  // 8. Build a GateVerdict and run through pickAttack → dispatchTranslate.
  //    R-012: getCell and dispatchTranslate are parameterised on runtime.
  const verdict: GateVerdict = {
    decision: "block",
    reason: `skill ${missing.id} is required for stage "${ward.openStage}" and has not been invoked`,
    forceIntent: {
      kind: "SkillGate",
      skillId: missing.id,
      blocksUntilInvoked: true,
    },
  };

  const cell = getCell(runtime, "pre_tool");
  const action = pickAttack(runtime, "pre_tool", verdict, register, cell);
  const response = dispatchTranslate(runtime, action);

  if (response.decision === "block") {
    emitBlock(response.reason ?? verdict.reason);

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
      reason: response.reason ?? verdict.reason,
    });
  } else {
    // pickAttack downgraded to inject/noop (shouldn't happen with pre_tool canBlock,
    // but honour it gracefully)
    if (response.additionalContext !== undefined) {
      emitContext("PreToolUse", response.additionalContext);
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
 * handleStop — R-005 stop gate: reject fake-done verdicts via BEH-023.
 *
 * Scans the agent's final output for completion lexemes (DONE, DONE_VERIFIED,
 * MASTERED, complete, finished, shipped). At M/H/C risk, verifies that the
 * ward contains at least one done-verified stage verdict. Blocks if evidence
 * is absent.
 *
 * Runtime dispatch:
 *   claude/codex (canBlock=true at stop) → emitBlock + exit 2 on block.
 *   hermes (canBlock=false, deferred)    → exit 0 + TODO(I10-R-027) writeDeferredVerdict.
 */
export async function handleStop(
  root: string,
  payload: StdinPayload,
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";

  // Derive agentOutput from the stop payload.
  // Claude sends the agent's final response as promptContent (or via toolInput
  // in some runtime configurations).
  const agentOutput =
    payload.promptContent ??
    (typeof payload.toolInput === "string"
      ? payload.toolInput
      : payload.toolInput != null
        ? JSON.stringify(payload.toolInput)
        : "");

  // 1. Resume the active ward (provides riskClass + evidence check).
  const ward = await resumeWard(root);
  const riskClass = resolveRiskClass(ward);

  // 2. Build BehaviorContext for the stop gate.
  const ctx = {
    event: {
      gateType: "stop" as const,
      promptContent: agentOutput || undefined,
    },
    riskClass,
    root,
    ward,
    agentOutput,
  };

  // 3. R-001 — evaluateGate: run BEH-023 (and any future stop behaviors).
  const verdict = await evaluateGate(getBehaviorsForGate("stop"), ctx);

  // 4. Read skill register + get capability cell for this runtime.
  const register = await readRegister(root);
  const cell = getCell(runtime, "stop");

  // 5. pickAttack — derive the ForceAction from the verdict.
  const action = pickAttack(runtime, "stop", verdict, register, cell);

  // 6. dispatchTranslate — get the runtime-native response.
  const response = dispatchTranslate(runtime, action);

  // 7. R-012 runtime-specific dispatch.
  //    For claude/codex (canBlock=true at stop): hard-block on "block" verdict.
  //    For hermes (canBlock=false, deferred): exit 0 + TODO writeDeferredVerdict.
  if (verdict.decision === "block") {
    if (cell.canBlock) {
      // claude or codex: synchronous hard-block.
      emitBlock(verdict.reason);
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "Stop",
        gateType: "stop",
        decision: "block",
        forceActionKind: action.kind,
        skillsForced: [],
        skillsLoaded: register.map((r) => r.id),
        exitCode: 2,
        reason: verdict.reason,
      });
      return;
    }

    // hermes: deferred enforcement (R-027 writes the verdict file in I10).
    // TODO(I10-R-027): writeDeferredVerdict(root, sessionId, verdict)
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "Stop",
      gateType: "stop",
      decision: "allow",
      forceActionKind: action.kind,
      skillsForced: [],
      skillsLoaded: register.map((r) => r.id),
      exitCode: 0,
      reason: `[TODO-R-027] deferred block on hermes: ${verdict.reason}`,
    });
    return;
  }

  // 8. allow / warn — exit 0.
  //    For warn: additionalContext injection if the response carries one.
  if (response.additionalContext !== undefined) {
    emitContext("Stop", response.additionalContext);
  } else {
    emitAllow();
  }

  safeAppendTrace(root, {
    sessionId,
    hookEvent: "Stop",
    gateType: "stop",
    decision: verdict.decision === "warn" ? "warn" : "allow",
    forceActionKind: action.kind,
    skillsForced: [],
    skillsLoaded: register.map((r) => r.id),
    exitCode: 0,
    reason: verdict.reason,
  });
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
