/**
 * router — event handlers for each norm hook event.
 *
 * Each handler receives the resolved project root, the parsed stdin payload,
 * and the active runtime target (default "claude").
 * Handlers are pure in intent: they call @norm/core logic and emit a Claude
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
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

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
  resolveStageForceSkillsForFloor,
  filterByEnabledSources,
  classifyRisk,
  recordRead,
  writeDeferredVerdict,
  readAndConsumeDeferredVerdict,
  writeStageVerdict,
  closeWard,
  buildSessionResumeContext,
  buildPreCompactContext,
  buildArtifactAutoOpenContext,
  buildFounderDigestContext,
  buildReviewSurfaceContext,
  buildNextAttackContext,
  roleForStage,
  roleContext,
  resolveRulesForPath,
  injectRulesIntoDelegateTask,
  markSubagentSeen,
  isSubagentSeen,
  hermesHomeWarning,
  // I14b additions (R-041, R-035, R-037)
  runResearchSubpassContext,
  researchSubpassForcedSkill,
  spawnPlan,
  ROLE_CATALOG,
  writeSpawnManifest,
  hasSpawnManifest,
  buildSpawnAssignmentContext,
  appendWaveLog,
  buildResearchConvertContext,
  // I18 wiring additions (R-044, R-049, R-020, R-041)
  captureGitSnapshot,
  readGitSnapshot,
  hasChangesSince,
  registerSubagent,
  readSubagentRegistry,
  markLane,
  clearLane,
  markStageDelegation,
  addWardSkillRequirement,
  PLANNER_PROMPTS,
  EXECUTOR_PROMPTS,
  CRITIC_PROMPTS,
  resolveVariant,
  loadPrompt,
} from "@norm/core";
import type {
  RuntimeTarget,
  DispatchResponse,
  DeferredVerdict,
  HimaRole,
  VariantTable,
} from "@norm/core";

import { DEV_CYCLE, RISK_ORDER } from "@norm/schemas";
import type { GateVerdict, TraceEvent, ForceAction, StageVerdict, SkillRef } from "@norm/schemas";

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

/**
 * Tool-name substrings that indicate a subagent-spawning call on the Codex
 * runtime (R-049). Matched case-insensitively against the raw toolName.
 */
const CODEX_SUBAGENT_SPAWN_PATTERN = /task|delegate|spawn|subagent/i;

// ---------------------------------------------------------------------------
// runGitDiffStat — best-effort `git diff --stat` snapshot (R-044)
// ---------------------------------------------------------------------------

/**
 * Run `git -C <root> diff --stat` and return its stdout, or "" on any failure
 * (git not installed, root is not a repo, timeout, etc.). Never throws — the
 * review-surface "changed" signal degrades gracefully to "no baseline" rather
 * than blocking or crashing the hook.
 */
function runGitDiffStat(root: string): string {
  try {
    return execFileSync("git", ["-C", root, "diff", "--stat"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

/**
 * Merge extra SkillRefs (e.g. ward-scoped R-041 extras) into a base forceSkills
 * list, deduplicating by source+id. Base entries keep their order; extras are
 * appended in declaration order, skipping any already present.
 */
function mergeSkillRefs(base: SkillRef[], extra: readonly SkillRef[]): SkillRef[] {
  const seen = new Set(base.map((s) => `${s.source}:${s.id}`));
  const merged = [...base];
  for (const ref of extra) {
    const key = `${ref.source}:${ref.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(ref);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Internal trace helper
// ---------------------------------------------------------------------------

/**
 * ROLE_PROMPT_TABLES — maps each HimaRole to its bundled VariantTable (R-020).
 * "reviewer" maps to CRITIC_PROMPTS (the critic profile owns the reviewer role
 * marker — see prompts-core/critic-prompts.ts).
 */
const ROLE_PROMPT_TABLES: Record<HimaRole, VariantTable> = {
  planner: PLANNER_PROMPTS,
  executor: EXECUTOR_PROMPTS,
  reviewer: CRITIC_PROMPTS,
};

/**
 * resolveRichRolePrompt — R-020: materialise the richer role-variant prompt
 * for the active role via resolveVariant + loadPrompt, instead of leaving that
 * machinery unwired. Returns null when there is no active role (unrecognised
 * stage) or on any resolution failure — this is advisory enrichment, never a
 * hard requirement.
 *
 * modelID is derived from the runtime target: "claude-*" for the claude
 * runtime (matches the "claude" variant matcher), a non-claude-prefixed
 * placeholder otherwise (falls back to the "default" variant).
 */
async function resolveRichRolePrompt(
  activeRole: HimaRole | null,
  runtime: RuntimeTarget,
): Promise<string | null> {
  if (activeRole === null) return null;
  try {
    const table = ROLE_PROMPT_TABLES[activeRole];
    const modelID = runtime === "claude" ? "claude-unknown" : "unknown-model";
    const variantName = resolveVariant({
      modelID,
      agentName: activeRole,
      variants: table,
    });
    const source = table[variantName];
    if (source === undefined) return null;
    return await loadPrompt(source);
  } catch {
    return null;
  }
}

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
// emitBlockDispatch — runtime-aware block emission (R-010/R-011/R-050)
// ---------------------------------------------------------------------------

/**
 * Emit a full runtime-specific block response to stdout and set exitCode=2.
 *
 * Includes optional runtime-native fields from the dispatch response:
 *   - systemMessage: Codex injection channel (≤1800 bytes)
 *   - raw:           Hermes ACP object {action:"block", message}
 *
 * This replaces bare emitBlock() for paths where the adapter response carries
 * additional runtime-specific fields beyond {decision, reason}.
 */
function emitBlockDispatch(
  response: DispatchResponse,
  fallbackReason: string,
): void {
  const payload: Record<string, unknown> = {
    decision: "block",
    reason: response.reason ?? fallbackReason,
  };
  if (response.systemMessage !== undefined) {
    payload["systemMessage"] = response.systemMessage;
  }
  if (response.raw !== undefined) {
    payload["raw"] = response.raw;
  }
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exitCode = 2;
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
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";
  const text = payload.promptContent ?? "";

  // R-027: replay any deferred stop verdict from a previous hermes stop hook.
  // The deferred verdict is single-use: readAndConsumeDeferredVerdict deletes it.
  const deferredVerdict = await readAndConsumeDeferredVerdict(root, sessionId);
  if (deferredVerdict !== null) {
    const replayAction: ForceAction = {
      kind: "hard-block",
      reason: deferredVerdict.reason,
    };
    const replayResponse = dispatchTranslate(runtime, replayAction);
    emitBlockDispatch(replayResponse, deferredVerdict.reason);
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "UserPromptSubmit",
      gateType: "user_prompt",
      decision: "block",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 2,
      reason: `[deferred-replay] ${deferredVerdict.reason}`,
    });
    return;
  }

  // 1. Sigil detection
  const sigil = pickSigil(text);
  if (sigil === null) {
    // R-018: no sigil — classify prompt risk and emit advisory canary for H+/M.
    // A no-sigil prompt does NOT create a ward; advisory only.
    const classResult = classifyRisk(text);
    const classFloor = classResult.floor;

    if (RISK_ORDER[classFloor] >= RISK_ORDER["H"]) {
      emitContext(
        "UserPromptSubmit",
        `[HIMA] no sigil — classified ${classFloor} — expected entry: full`,
      );
    } else if (classFloor === "M") {
      emitContext(
        "UserPromptSubmit",
        "[HIMA] no sigil — classified M — expected entry: run",
      );
    } else {
      // T / L floor → light path, no advisory needed
      emitAllow();
    }

    safeAppendTrace(root, {
      sessionId,
      hookEvent: "UserPromptSubmit",
      gateType: "noop",
      decision: "noop",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: `no terminal sigil detected — classified ${classFloor}`,
    });
    return;
  }

  // R-019: when a sigil is present, also classify the prompt. Take the max of
  // the sigil's default floor and the classifier's floor — the classifier can
  // only RAISE the floor, never lower it.
  const classResultForSigil = classifyRisk(text);
  const sigilFloor = sigil.floor;
  const finalFloor: typeof sigil.floor =
    RISK_ORDER[classResultForSigil.floor] > RISK_ORDER[sigilFloor]
      ? classResultForSigil.floor
      : sigilFloor;

  // If the classifier raised the floor, build a raise-canary for emission.
  const raiseCanary =
    finalFloor !== sigilFloor
      ? `[HIMA] floor raised ${sigilFloor}->${finalFloor} by risk-classifier (${classResultForSigil.reasons.join(", ")})`
      : undefined;

  // 2. Create or resume the ward (R-040: differentiate for canary)
  const existing = await resumeWard(root);
  // R-019: pass the raised floor to createWard so the ward starts at the correct floor.
  const ward = existing ?? await createWard(root, {
    id: randomUUID(),
    entryPoint: sigil.entryPoint,
    floor: finalFloor,
  });

  // 3. R-001 — evaluateGate for user_prompt behaviors (I14b: now live).
  //    getBehaviorsForGate("user_prompt") returns BEH_FEEDBACK_WAVE (R-016) and
  //    BEH_SPEC_GATE (R-024). The result is used for advisory context injection
  //    (warn path) and wave-log emission (R-037). Advisory — never blocks.
  const riskClass = resolveRiskClass(ward);
  const userPromptCtx = {
    event: { gateType: "user_prompt" as const, promptContent: text },
    riskClass,
    root,
    ward,
    agentOutput: text,
    sessionId, // R-003: key must match what PostToolUse recordRead uses
  };
  const userPromptVerdict = await evaluateGate(getBehaviorsForGate("user_prompt"), userPromptCtx);

  // R-037: when BEH_FEEDBACK_WAVE warns, append a minimal wave-log entry.
  // The wave is not yet launched — pipeline_status is "partial" (advised but
  // not acted upon). This log entry is the machine-verifiable seed for the
  // DONE_VERIFIED acceptance check per founder-feedback-scale.md §4 and §7.
  // Awaited (fast local I/O) so the write completes before the hook exits;
  // errors are swallowed — a log failure must never break the pipeline.
  if (
    userPromptVerdict.decision === "warn" &&
    userPromptVerdict.reason.includes("BEH-FEEDBACK-WAVE")
  ) {
    try {
      await appendWaveLog(root, {
        wave_id: `${sessionId.slice(0, 8)}-${Date.now().toString(36)}`,
        artifact: "detected",
        trigger_path: "full",
        lane_count: 0,
        models_used: [],
        pipeline_status: "partial",
        ts: new Date().toISOString(),
      });
    } catch {
      // swallow — wave-log emission must never break the hook pipeline
    }
  }

  // 4. R-040: emit a canary — distinct for resume vs create
  let canary: string;
  if (existing !== null) {
    // Resume path: emit the last-sealed stage + current position
    const SEALED_STATUSES = new Set(["done", "done-verified", "done-validated"]);
    const lastSealed =
      [...ward.verdicts]
        .reverse()
        .find((v) => SEALED_STATUSES.has(v.status))?.stage ?? "none";
    canary =
      `[HIMA] ${ward.entryPoint}:resuming — ` +
      `ward:${ward.id} — ` +
      `last-sealed:${lastSealed} — ` +
      `floor:${ward.floor}`;
  } else {
    // Create path: emit the standard ward-activation canary.
    // If the floor was raised by the classifier (R-019), include the raise canary first.
    canary = `[HIMA] ward:${ward.id} stage:${ward.openStage} sigil:${sigil.sigil} floor:${ward.floor}`;
  }
  const canaryWithRaise =
    raiseCanary !== undefined ? `${raiseCanary}\n${canary}` : canary;

  // R-020 — role injection (advisory): resolve role from openStage and emit
  // the role-context string as additional advisory context so the agent knows
  // its active role constraints (e.g. planner must not write code).
  const activeRole = roleForStage(ward.openStage);
  const roleCtx = activeRole !== null ? roleContext(activeRole) : null;

  // R-020: richer role-variant prompt — resolveVariant + loadPrompt from the
  // matching bundled table (PLANNER_PROMPTS/EXECUTOR_PROMPTS/CRITIC_PROMPTS),
  // injected IN ADDITION to the one-line roleCtx fallback above. Previously
  // this machinery was built + exported but had zero call sites in the live
  // hook path (V3-CERTIFICATION.md R-020).
  const richRolePrompt = await resolveRichRolePrompt(activeRole, runtime);

  // Build the full context as an ordered list of parts.
  // Parts are joined with newlines — the agent sees each part as a distinct
  // advisory line. The canary is always first; role context and behavior
  // advisories follow in priority order.
  const contextParts: string[] = [canaryWithRaise];
  if (roleCtx !== null) contextParts.push(roleCtx);
  if (richRolePrompt !== null) contextParts.push(richRolePrompt);

  // R-016: append behavior advisory or NOT-triggered evaluation to context.
  //   warn path: inject the wave-launch recommendation.
  //   allow path with NOT-triggered reason: surface the evaluation line so the
  //     agent sees that founder-feedback-scale was checked and did not fire.
  if (userPromptVerdict.decision === "warn") {
    contextParts.push(`[HIMA advisory] ${userPromptVerdict.reason}`);
  } else if (
    userPromptVerdict.decision === "allow" &&
    userPromptVerdict.reason.includes("[founder-feedback-scale] evaluated — NOT triggered")
  ) {
    contextParts.push(userPromptVerdict.reason);
  }

  // R-041: research sub-pass injection for "run" entryPoint (new ward only).
  // Advisory: inject corpus-technical-analysis-discovery for run entries.
  if (existing === null) {
    const researchCtx = runResearchSubpassContext(ward.entryPoint, ward.floor);
    if (researchCtx !== null) contextParts.push(researchCtx);

    // R-041: at floor H+, the research sub-pass is FORCED, not merely advisory —
    // but ONLY for "run" entry-point wards (mirrors runResearchSubpassContext's
    // own entryPoint==="run" gate via researchCtx !== null). "full"/"spec" wards
    // must NOT get this extra requirement. Persist corpus-technical-analysis-
    // discovery into the ward's skillRegister so handlePreToolUse's skill-force
    // gate (merged via mergeSkillRefs) blocks writes until invoked, regardless
    // of the current DEV_CYCLE stage.
    const forcedResearchSkill =
      researchCtx !== null ? researchSubpassForcedSkill(ward.floor) : null;
    if (forcedResearchSkill !== null) {
      try {
        await addWardSkillRequirement(root, forcedResearchSkill);
      } catch {
        // swallow — enforcement persistence must never break the hook pipeline
      }
    }

    // R-035: live role-spawn manifest for new wards.
    // Compute the role-team for the initial stage, write the manifest file,
    // and append the spawn-assignment advisory context so the agent spawns
    // the correct Task subagents immediately.
    const roles = spawnPlan(ward.openStage, ROLE_CATALOG);
    if (roles.length > 0) {
      const roleNames = roles.map((r) => r.roleId);
      // Awaited (fast local I/O) so the manifest file is complete before the
      // hook exits; errors are swallowed — a write failure must never block.
      try {
        await writeSpawnManifest(root, ward.id, ward.openStage, roleNames);
      } catch {
        // swallow — manifest write failure must never break the hook pipeline
      }
      contextParts.push(buildSpawnAssignmentContext(ward.openStage, roles.map((r) => ({ role: r.roleId }))));
    }
  }

  emitContext("UserPromptSubmit", contextParts.join("\n"));

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

// ---------------------------------------------------------------------------
// emitAllowWithRules — advisory rules injection on allow paths (R-029)
// ---------------------------------------------------------------------------

/**
 * Emit an allow response (exit 0) optionally decorated with injected rule bodies.
 *
 * If resolveRulesForPath finds matching rules for `targetPath`, they are emitted
 * as additionalContext before exit. If no rules match (or targetPath is undefined),
 * falls back to a silent allow (emitAllow). Never throws — rules injection is
 * best-effort and must never block the hook.
 *
 * R-029: rules injection is advisory only — always exits 0 regardless of result.
 */
async function emitAllowWithRules(
  root: string,
  sessionId: string,
  targetPath: string | undefined,
): Promise<void> {
  if (targetPath !== undefined) {
    try {
      const absTarget = targetPath.startsWith("/")
        ? targetPath
        : `${root}/${targetPath}`;
      const { injected } = await resolveRulesForPath(root, absTarget, { sessionId });
      if (injected.length > 0) {
        emitContext("PreToolUse", `[HIMA rules]\n${injected.join("\n---\n")}`);
        return;
      }
    } catch {
      // Best-effort: swallow errors so rules injection never breaks the hook.
    }
  }
  emitAllow();
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

  // R-029: extract target file path from toolInput early for rules injection.
  // Used by emitAllowWithRules at each allow exit (advisory, never blocks).
  const toolInputObj =
    typeof payload.toolInput === "object" && payload.toolInput !== null
      ? (payload.toolInput as Record<string, unknown>)
      : undefined;
  const targetFilePath: string | undefined =
    toolInputObj !== undefined
      ? typeof toolInputObj["file_path"] === "string"
        ? (toolInputObj["file_path"] as string)
        : typeof toolInputObj["path"] === "string"
          ? (toolInputObj["path"] as string)
          : undefined
      : undefined;

  // R-027: replay any deferred stop verdict from a previous hermes stop hook.
  // The deferred verdict is single-use: readAndConsumeDeferredVerdict deletes it.
  const deferredVerdict = await readAndConsumeDeferredVerdict(root, sessionId);
  if (deferredVerdict !== null) {
    const replayAction: ForceAction = {
      kind: "hard-block",
      reason: deferredVerdict.reason,
    };
    const replayResponse = dispatchTranslate(runtime, replayAction);
    emitBlockDispatch(replayResponse, deferredVerdict.reason);
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "pre_tool",
      decision: "block",
      toolName: toolName || undefined,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 2,
      reason: `[deferred-replay] ${deferredVerdict.reason}`,
    });
    return;
  }

  // R-049: Codex subagent-spawn compensation — poll-file registration.
  // Codex has no native subagent_start hook; when a subagent-spawning tool is
  // invoked on the codex runtime, register the child session in the parent's
  // poll file so a later pre_tool call (from the parent) can discover the
  // spawn via readSubagentRegistry. Observational — never blocks the spawn.
  if (runtime === "codex" && CODEX_SUBAGENT_SPAWN_PATTERN.test(toolName)) {
    await recordCodexSubagentSpawn(root, payload, sessionId, toolName);
  }

  // R-038: Hermes delegate_task intercept — compensation for absent subagent_start.
  // When runtime is "hermes" and the tool being invoked is "delegate_task", treat this
  // pre_tool event as a subagent_start gate: evaluate BEH_WORKER_MODEL (and any other
  // subagent_start behaviors), and on allow inject hima governance rules into the task
  // payload. This prevents subagents from inheriting the session default model.
  if (runtime === "hermes" && toolName === "delegate_task") {
    await handleHermesDelegateTask(root, payload, sessionId);
    return;
  }

  // 1. Load the ward (may be null when no sigil was detected yet).
  const ward = await resumeWard(root);

  // 2. R-002 — resolve riskClass from ward.floor (falls back to "T" when no ward).
  const riskClass = resolveRiskClass(ward);

  // 3. R-053 — evaluateGate for pre_tool behaviors REGARDLESS of whether a ward
  //    exists. Safety invariants (BEH_FALSIFIES_IF, BEH_SECURITY_SCOPE,
  //    BEH_SECRET_GUARD) are always-on and must fire even on no-sigil/T prompts.
  //    BEH_READ_BEFORE_WRITE is floor-gated (M+) so it naturally skips at T.
  //    If any behavior blocks here, we respect it BEFORE checking the ward.
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
    sessionId, // R-003: align key with PostToolUse recordRead
  };
  const behaviorVerdict = await evaluateGate(getBehaviorsForGate("pre_tool"), preToolCtx);

  if (behaviorVerdict.decision === "block") {
    // A pre_tool behavior blocked — use this verdict directly.
    const register = await readRegister(root);
    const cell = getCell(runtime, "pre_tool");
    const action = pickAttack(runtime, "pre_tool", behaviorVerdict, register, cell);
    const response = dispatchTranslate(runtime, action);

    if (response.decision === "block") {
      // Use behaviorVerdict.reason directly — pickAttack replaces it with a
      // generic "gate verdict: block with no forceIntent" message when there is
      // no forceIntent, discarding the specific violation type and behavior
      // reason. The behavior's reason is the informative one.
      // Use emitBlockDispatch to include runtime-specific fields (systemMessage, raw).
      emitBlockDispatch({ ...response, reason: behaviorVerdict.reason }, behaviorVerdict.reason);
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PreToolUse",
        gateType: "pre_tool",
        decision: "block",
        toolName: toolName || undefined,
        wardStage: ward?.openStage,
        skillsForced: [],
        skillsLoaded: register.map((r) => r.id),
        exitCode: 2,
        reason: behaviorVerdict.reason,
      });
    } else {
      await emitAllowWithRules(root, sessionId, targetFilePath);
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PreToolUse",
        gateType: "pre_tool",
        decision: "allow",
        toolName: toolName || undefined,
        wardStage: ward?.openStage,
        skillsForced: [],
        skillsLoaded: register.map((r) => r.id),
        exitCode: 0,
        reason: "behavior verdict downgraded to allow by dispatchTranslate",
      });
    }
    return;
  }

  // 4. R-053: safety behaviors evaluated above. Now check if a ward exists.
  //    No ward → skip skill-force (the pipeline hasn't started yet) and allow.
  if (ward === null) {
    await emitAllowWithRules(root, sessionId, targetFilePath);
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "noop",
      decision: "noop",
      toolName: toolName || undefined,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: "no active ward — safety behaviors passed, skill-force skipped",
    });
    return;
  }

  // 6. Resolve forceSkills for the current stage, honoring any project/user config.
  //    R-017: apply floor-scaling so H/C wards enforce the extra skills from ENTRYPOINTS-v3.
  const config = await loadConfig(root);
  const baseForceSkills = resolveStageForceSkills(config, ward.openStage, DEV_CYCLE);
  // Floor-scaling (resolveStageForceSkillsForFloor) adds STAGE_FLOOR_EXTRAS which are
  // corpus-* skills — re-apply the enabledSources filter so a project with corpus
  // disabled is NOT forced onto a skill it does not have (the F1 stranger trap: the
  // floor path previously bypassed the filter that resolveStageForceSkills applies).
  const floorForceSkills = filterByEnabledSources(
    config,
    resolveStageForceSkillsForFloor(baseForceSkills, ward.openStage, ward.floor),
  );
  // R-041: merge in any extra forced skills persisted on the ward itself
  // (e.g. corpus-technical-analysis-discovery, forced at floor H+ run-entry
  // regardless of the current DEV_CYCLE stage — see addWardSkillRequirement).
  const forceSkills = mergeSkillRefs(floorForceSkills, ward.skillRegister);
  if (forceSkills.length === 0) {
    // No forced skills for this stage → allow (with R-029 rules injection).
    await emitAllowWithRules(root, sessionId, targetFilePath);
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

  // 7. Read the skill register.
  const register = await readRegister(root);
  const skillsLoaded = register.map((r) => r.id);

  // 8. Find the first forceSkill not yet in the register.
  const missing = forceSkills.find(
    (ref) => !register.some((r) => r.id === ref.id && r.source === ref.source),
  );

  if (missing === undefined) {
    // R-035: StageParallelizationGate — advisory-strong check.
    // When a write is about to happen in a non-discovery stage and no spawn
    // manifest exists for that ward+stage, emit a role-team advisory so the
    // agent knows to spawn the correct Task subagents.
    // Advisory-strong: does NOT hard-block to avoid bricking the pipeline.
    if (WRITE_TOOL_NAMES.has(toolName) && ward.openStage !== "discovery") {
      try {
        const manifestExists = await hasSpawnManifest(root, ward.id, ward.openStage);
        if (!manifestExists) {
          const roles = spawnPlan(ward.openStage, ROLE_CATALOG);
          if (roles.length > 0) {
            const assignCtx = buildSpawnAssignmentContext(
              ward.openStage,
              roles.map((r) => ({ role: r.roleId })),
            );
            emitContext(
              "PreToolUse",
              `[HIMA advisory-strong R-035] spawn manifest absent for stage "${ward.openStage}" — ${assignCtx}`,
            );
            safeAppendTrace(root, {
              sessionId,
              hookEvent: "PreToolUse",
              gateType: "pre_tool",
              decision: "allow",
              toolName: toolName || undefined,
              wardStage: ward.openStage,
              skillsForced: [],
              skillsLoaded,
              exitCode: 0,
              reason: `R-035: spawn manifest absent for stage "${ward.openStage}" — advisory emitted`,
            });
            return;
          }
        }
      } catch {
        // Advisory: swallow errors — the gate must never break the hook pipeline.
      }
    }

    // All required skills are loaded → allow (with R-029 rules injection).
    await emitAllowWithRules(root, sessionId, targetFilePath);
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

  // 9. Only block if this is a write tool.
  if (!WRITE_TOOL_NAMES.has(toolName)) {
    // Non-write tool → allow (skill gate only fires on write tools).
    // R-029: inject rules even on non-write tool paths.
    await emitAllowWithRules(root, sessionId, targetFilePath);
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

  // 10. Build a GateVerdict and run through pickAttack → dispatchTranslate.
  //    R-012: getCell and dispatchTranslate are parameterised on runtime.
  //    R-017: when floor-scaling adds multiple skills, list them all in the reason
  //           so the agent and the trace show the complete floor-scaled requirement set.
  const allSkillIds = forceSkills.map((s) => s.id).join(", ");
  const blockReason =
    forceSkills.length > 1
      ? `skills required for stage "${ward.openStage}" (floor ${ward.floor}): [${allSkillIds}] — ${missing.id} not yet invoked`
      : `skill ${missing.id} is required for stage "${ward.openStage}" and has not been invoked`;

  const verdict: GateVerdict = {
    decision: "block",
    reason: blockReason,
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
    // Use emitBlockDispatch to include runtime-specific fields (Codex systemMessage,
    // Hermes raw ACP object) in the stdout response alongside decision+reason.
    // R-017: always use verdict.reason so the floor-scaled skill list is shown,
    // not the adapter's single-skill reason from dispatchTranslate.
    emitBlockDispatch({ ...response, reason: verdict.reason }, verdict.reason);

    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "skill-force",
      decision: "block",
      forceActionKind: action.kind,
      toolName: toolName || undefined,
      wardStage: ward.openStage,
      skillsForced: forceSkills.map((s) => s.id), // R-017: all floor-scaled skills
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
 * handlePostToolUse — R-003 read-set capture + R-025/R-044/R-046 auto-actions.
 *
 * R-003: When the agent uses a read tool (Read, ReadFile), records the file
 *   path in the per-session read-set so BEH_READ_BEFORE_WRITE can later
 *   verify that a file was read before being written at M+ risk class.
 *
 * R-025/R-044/R-046: When the agent writes a .md file under a plan/spec/docs
 *   directory (Write/Edit/MultiEdit), emits buildArtifactAutoOpenContext and
 *   buildReviewSurfaceContext as advisory additionalContext so the runtime
 *   opens the artifact automatically and shows the review surface command.
 *
 * Always exits 0 (allow): PostToolUse is observe-only — recording failures
 * must never block the session.
 *
 * toolInput shape for Read/ReadFile (defensive narrowing — toolInput is unknown):
 *   Read:     { file_path: string; ... }
 *   ReadFile: { path: string; ... }
 * toolInput shape for Write/Edit/MultiEdit:
 *   Write:     { file_path: string; content: string }
 *   Edit:      { file_path: string; ... }
 *   MultiEdit: { file_path: string; ... }
 */
export async function handlePostToolUse(
  root: string,
  payload: StdinPayload,
  _runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";
  const toolName = payload.toolName ?? "";

  // R-003: record reads into the per-session read-set.
  const READ_TOOL_NAMES = new Set(["Read", "ReadFile"]);
  if (READ_TOOL_NAMES.has(toolName)) {
    const filePath = extractReadPath(payload.toolInput);
    if (filePath !== undefined) {
      // recordRead swallows all errors internally — safe to fire-and-forget.
      await recordRead(root, sessionId, filePath);
    }
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PostToolUse",
      gateType: "noop",
      decision: "noop",
      toolName: toolName || undefined,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: `read-set: recorded read for "${toolName}"`,
    });
    return;
  }

  // R-025/R-044/R-046: auto-open for write tools targeting .md plan/spec/docs files.
  // R-026: document-heavy check — append founder-digest at M+ for .md plan writes
  //        or large (>300 char) writes.
  const WRITE_TOOL_NAMES_SET = new Set(["Write", "Edit", "MultiEdit"]);
  if (WRITE_TOOL_NAMES_SET.has(toolName)) {
    const filePath = extractWritePath(payload.toolInput);
    if (filePath !== undefined && isMdPlanPath(filePath)) {
      const autoOpen = buildArtifactAutoOpenContext(filePath);

      // R-044: compute the REAL changed flag from the session-start git
      // baseline instead of a hardcoded `true`. Falls back to "changed=true"
      // (fail-safe: assume a diff exists) only when reading the baseline or
      // running git itself throws — the review-surface line is advisory, so a
      // false positive here is safer than silently claiming "no diff".
      let changed = true;
      try {
        const baseSnapshot = await readGitSnapshot(root);
        const currentSnapshot = runGitDiffStat(root);
        changed = hasChangesSince(baseSnapshot, currentSnapshot);
      } catch {
        changed = true;
      }
      const reviewSurface = buildReviewSurfaceContext(changed);
      const docParts: string[] = [autoOpen, reviewSurface];

      // R-026: emit founder-digest advisory at M+ (md plan path always doc-heavy).
      const docWard = await resumeWard(root);
      const docRiskClass = resolveRiskClass(docWard);
      const mFloor: number = RISK_ORDER["M"] ?? 2;
      if ((RISK_ORDER[docRiskClass] ?? 0) >= mFloor && docWard !== null) {
        docParts.push(
          buildFounderDigestContext({
            state: "PARTIAL — document written, pipeline ongoing",
            whatChanged: `document written to ${filePath}`,
            reviewCmd: "git diff --stat HEAD",
          }),
        );
      }

      emitContext("PostToolUse", docParts.join("\n"));
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PostToolUse",
        gateType: "noop",
        decision: "noop",
        toolName: toolName || undefined,
        skillsForced: [],
        skillsLoaded: [],
        exitCode: 0,
        reason: `post_tool: artifact written — auto-open + R-026 emitted for "${filePath}"`,
      });
      return;
    }

    // R-026: document-heavy large-output write at M+ also surfaces the digest.
    if (isDocumentHeavy(payload.toolInput)) {
      const heavyWard = await resumeWard(root);
      const heavyRiskClass = resolveRiskClass(heavyWard);
      const mFloor: number = RISK_ORDER["M"] ?? 2;
      if ((RISK_ORDER[heavyRiskClass] ?? 0) >= mFloor && heavyWard !== null) {
        const heavyPath = filePath ?? "(unknown path)";
        emitContext(
          "PostToolUse",
          buildFounderDigestContext({
            state: "PARTIAL — large document written",
            whatChanged: `content written: ${heavyPath}`,
            reviewCmd: "git diff --stat HEAD",
          }),
        );
        safeAppendTrace(root, {
          sessionId,
          hookEvent: "PostToolUse",
          gateType: "noop",
          decision: "noop",
          toolName: toolName || undefined,
          skillsForced: [],
          skillsLoaded: [],
          exitCode: 0,
          reason: `post_tool: document-heavy (>300 chars) write at M+ — R-026 digest emitted`,
        });
        return;
      }
    }
  }

  // R-045: research-convert advisory for WebSearch/WebFetch at M+.
  // After a research tool call, emit a cite marker + conversion prompt so the
  // agent converts findings into requirements/decisions/risks before deciding.
  const RESEARCH_TOOL_NAMES = new Set(["WebSearch", "WebFetch"]);
  if (RESEARCH_TOOL_NAMES.has(toolName)) {
    const researchWard = await resumeWard(root);
    const researchRiskClass = resolveRiskClass(researchWard);
    const mFloor: number = RISK_ORDER["M"] ?? 2;
    if ((RISK_ORDER[researchRiskClass] ?? 0) >= mFloor) {
      const source = `${toolName} ${new Date().toISOString().slice(0, 10)}`;
      emitContext("PostToolUse", buildResearchConvertContext(source));
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PostToolUse",
        gateType: "noop",
        decision: "noop",
        toolName: toolName || undefined,
        skillsForced: [],
        skillsLoaded: [],
        exitCode: 0,
        reason: `post_tool: research-convert advisory emitted for "${toolName}" at M+`,
      });
      return;
    }
  }

  // R-022: BEH_ANTI_SYCOPHANCY post_tool advisory gate.
  // Derive agentOutput from promptContent (carries tool result or agent response
  // text injected by the caller). Falls back to toolInput serialisation.
  // Always exits 0 — the gate is advisory only (never block at PostToolUse).
  const postToolAgentOutput =
    typeof payload.promptContent === "string" && payload.promptContent.trim() !== ""
      ? payload.promptContent
      : typeof payload.toolInput === "string"
        ? payload.toolInput
        : payload.toolInput != null
          ? JSON.stringify(payload.toolInput)
          : undefined;

  const postWard = await resumeWard(root);
  const postRiskClass = resolveRiskClass(postWard);

  const postToolCtx = {
    event: {
      gateType: "post_tool" as const,
      toolName: toolName || undefined,
      toolInput: payload.toolInput,
    },
    riskClass: postRiskClass,
    root,
    ward: postWard,
    agentOutput: postToolAgentOutput,
    sessionId, // R-003: key must match what PostToolUse recordRead uses
  };

  const postToolVerdict = await evaluateGate(getBehaviorsForGate("post_tool"), postToolCtx);

  if (postToolVerdict.decision === "warn") {
    emitContext("PostToolUse", `[HIMA advisory] ${postToolVerdict.reason}`);
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PostToolUse",
      gateType: "post_tool",
      decision: "warn",
      toolName: toolName || undefined,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: postToolVerdict.reason,
    });
    return;
  }

  // Default: allow — PostToolUse is observe-only.
  emitAllow();
  safeAppendTrace(root, {
    sessionId,
    hookEvent: "PostToolUse",
    gateType: "noop",
    decision: "noop",
    toolName: toolName || undefined,
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    reason: "non-read/non-write-md tool — no capture",
  });
}

/**
 * Extract the target file path from a Read/ReadFile toolInput.
 * Tries "file_path" first (Read canonical field), then "path" (ReadFile variant).
 * Returns undefined when neither is a non-empty string.
 */
function extractReadPath(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) return undefined;
  const ti = toolInput as Record<string, unknown>;
  const candidate = ti["file_path"] ?? ti["path"];
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }
  return undefined;
}

/**
 * Extract the target file path from a Write/Edit/MultiEdit toolInput.
 * Tries "file_path" first, then "path".
 */
function extractWritePath(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) return undefined;
  const ti = toolInput as Record<string, unknown>;
  const candidate = ti["file_path"] ?? ti["path"];
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }
  return undefined;
}

/**
 * Return true when the file path is a Markdown file under a plan/spec/docs
 * directory that should trigger an artifact-auto-open context (R-025).
 *
 * Recognised directories: docs/, plans/, specs/, .planning/
 */
function isMdPlanPath(filePath: string): boolean {
  if (!filePath.endsWith(".md")) return false;
  const n = filePath.replace(/\\/g, "/");
  return (
    n.includes("/docs/") || n.startsWith("docs/") ||
    n.includes("/plans/") || n.startsWith("plans/") ||
    n.includes("/specs/") || n.startsWith("specs/") ||
    n.includes("/.planning/") || n.startsWith(".planning/")
  );
}

/**
 * Return true when the toolInput carries a large content block (>300 chars).
 *
 * Used as the document-heavy heuristic for R-026 founder-digest at PostToolUse:
 * a Write with >300 chars of content qualifies even when the target path is not
 * under a plan/spec/docs directory.
 */
function isDocumentHeavy(toolInput: unknown): boolean {
  if (typeof toolInput !== "object" || toolInput === null) return false;
  const ti = toolInput as Record<string, unknown>;
  const content = ti["content"];
  return typeof content === "string" && content.length > 300;
}

/**
 * readTranscriptFinalAssistantText — extract the agent's final message text from
 * a Claude transcript .jsonl. Each line is a message object; assistant messages
 * carry text either as a plain string or as message.content[] blocks of type
 * "text". Returns the LAST assistant text found (or "" on any problem). Tolerant
 * of a missing file, malformed lines, and format variations.
 */
function readTranscriptFinalAssistantText(transcriptPath: string): string {
  try {
    if (!existsSync(transcriptPath)) return "";
    let lastText = "";
    for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(t);
      } catch {
        continue;
      }
      if (typeof obj !== "object" || obj === null) continue;
      const rec = obj as Record<string, unknown>;
      const msg =
        (rec["message"] as Record<string, unknown> | undefined) ?? rec;
      const role = (rec["type"] ?? msg["role"]) as string | undefined;
      if (role !== "assistant") continue;
      const content = msg["content"];
      let text = "";
      if (typeof content === "string") {
        text = content;
      } else if (Array.isArray(content)) {
        text = content
          .map((b) =>
            b &&
            typeof b === "object" &&
            (b as Record<string, unknown>)["type"] === "text"
              ? String((b as Record<string, unknown>)["text"] ?? "")
              : "",
          )
          .join("");
      }
      if (text) lastText = text;
    }
    return lastText;
  } catch {
    return "";
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
  // IMPORTANT: on the real Claude Stop hook the agent's final message is NOT in
  // the payload — the payload carries `transcript_path`, and the final text lives
  // as the last assistant message in that transcript. If we only read
  // promptContent/toolInput (empty at Stop), BEH-023 never sees a completion
  // claim and the fake-DONE gate silently fails open. So: fall back to the
  // transcript. (Ultra-QA dogfound 2026-07-04.)
  // stop_hook_active: the runtime already forced one continuation after a prior
  // Stop block; re-blocking would loop forever. Treat the output as empty on this
  // second pass so BEH-023 finds no claim and allows — the standard hook-loop guard.
  let agentOutput = payload.stopHookActive
    ? ""
    : (payload.promptContent ??
      payload.lastAssistantMessage ?? // Codex delivers the final message here
      (typeof payload.toolInput === "string"
        ? payload.toolInput
        : payload.toolInput != null
          ? JSON.stringify(payload.toolInput)
          : ""));
  if (!agentOutput && !payload.stopHookActive && payload.transcriptPath) {
    // Claude: the final message is not in the payload — read it from the transcript.
    agentOutput = readTranscriptFinalAssistantText(payload.transcriptPath);
  }

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
    sessionId, // R-003: key must match what PostToolUse recordRead uses
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

    // hermes: deferred enforcement (R-027).
    // Persist the block verdict for replay at the next pre_tool or user_prompt hook.
    // writeDeferredVerdict writes atomically; errors are swallowed so a write
    // failure never blocks the session (fail-open at stop, fail-closed at replay).
    const dv: DeferredVerdict = {
      decision: "block",
      reason: verdict.reason,
      source: "hermes-stop-gate",
      resolveOn: ["pre_tool", "user_prompt"],
      ts: new Date().toISOString(),
    };
    writeDeferredVerdict(root, sessionId, dv).catch(() => {
      // intentionally swallowed — verdict write failure must not block the session
    });
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
      reason: `[deferred-R-027] verdict persisted for hermes: ${verdict.reason}`,
    });
    return;
  }

  // 8. allow / warn — exit 0.
  //    R-026/R-039: at M+, when verdict is a clean allow (DONE legitimately),
  //    append buildFounderDigestContext and buildNextAttackContext so the agent
  //    prepends the digest and proposes ranked next attacks.
  {
    const contextParts: string[] = [];

    if (response.additionalContext !== undefined) {
      contextParts.push(response.additionalContext);
    }

    // Emit founder digest + next-attack only on a clean allow at M+ with an
    // active ward (so we have a meaningful stage to name).
    const mFloor: number = RISK_ORDER["M"] ?? 2;
    if (
      verdict.decision === "allow" &&
      (RISK_ORDER[riskClass] ?? 0) >= mFloor &&
      ward !== null
    ) {
      contextParts.push(
        buildFounderDigestContext({
          state: "DONE_VERIFIED — advisory",
          whatChanged: "session completed — stop gate passed",
          reviewCmd: "git diff --stat HEAD",
        }),
      );
      // R-039: pass ward.verdicts so the ranked next-attack proposal is
      // stage-specific (furthest-along sealed stage) instead of the generic
      // "propose ranked next attacks" fallback.
      contextParts.push(buildNextAttackContext(ward.openStage, ward.verdicts));
    }

    if (contextParts.length > 0) {
      emitContext("Stop", contextParts.join("\n"));
    } else {
      emitAllow();
    }
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
 * handleStageAdvance — R-006 + R-043: seal a stage verdict, advance openStage,
 * emit per-stage canaries, and (for verify) archive the ward to the ledger.
 *
 * R-043: writes a StageVerdict for `stage` with `status`, then advances
 *   ward.openStage to the next DEV_CYCLE stage.
 * R-021: after openStage advances, emits a stage-entry canary so the agent
 *   knows what forceSkills are required for the new stage.
 * closeWard: when stage==="verify" and status is done or done-verified,
 *   archives the ward snapshot to .hima/state/ledger/.
 *
 * @param root      Project root.
 * @param stage     The stage to seal (e.g. "discovery", "verify").
 * @param status    The verdict status to record.
 * @param sessionId Trace session id.
 * @param runtime   Runtime target (for trace).
 */
export async function handleStageAdvance(
  root: string,
  stage: string,
  status: StageVerdict["status"],
  sessionId: string,
  _runtime: RuntimeTarget = "claude",
  evidence: string[] = [],
): Promise<void> {
  // 1. Write the stage verdict and advance openStage atomically.
  const ward = await writeStageVerdict(root, stage, status, evidence);

  // 2. POST-ACT verdict canary: confirm what was sealed and the new open stage.
  const postActCanary =
    `[HIMA] stage-advance — ${ward.entryPoint}:${stage} sealed:${status} → ` +
    `open:${ward.openStage} — floor:${ward.floor}`;

  // 3. R-021 stage-entry canary: inject forceSkills + active role for the newly open stage.
  const config = await loadConfig(root);
  const forceSkills = resolveStageForceSkills(config, ward.openStage, DEV_CYCLE);
  const enshrining =
    forceSkills.length > 0
      ? forceSkills.map((s) => s.id).join(",")
      : "none";
  // R-021: roleForStage must be emitted at stage-advance (not only at user-prompt).
  const stageRole = roleForStage(ward.openStage) ?? "none";
  const stageEntryCanary =
    `[HIMA] ${ward.entryPoint}:${ward.openStage} — ` +
    `floor:${ward.floor} — ` +
    `enshrining:${enshrining} — ` +
    `role:${stageRole}`;

  // Emit both canaries in a single additionalContext so the agent sees them.
  emitContext("StageAdvance", `${postActCanary}\n${stageEntryCanary}`);

  // 4. closeWard when verify is sealed: archive the run to the ledger.
  const CLOSE_ON_STATUSES: ReadonlySet<StageVerdict["status"]> = new Set([
    "done",
    "done-verified",
  ]);
  if (stage === "verify" && CLOSE_ON_STATUSES.has(status)) {
    await closeWard(root, new Date().toISOString());
  }

  // 5. Emit trace event.
  safeAppendTrace(root, {
    sessionId,
    hookEvent: "StageAdvance",
    gateType: "noop",
    decision: "allow",
    wardStage: ward.openStage,
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    reason: `stage-advance: "${stage}" → ${status}; openStage now "${ward.openStage}"`,
  });
}

/**
 * handleAdvance — friendly `norm advance` command (the one-command unblock).
 * Seals the CURRENT open stage (or an explicit --stage) with a status
 * (default "done") and optional --evidence, then advances. A thin convenience
 * wrapper over handleStageAdvance so a stuck agent/user can run `norm advance`
 * instead of the long `norm hook stage-advance --stage X --status done` form.
 * Sets process.exitCode=1 on error (no active ward / invalid status).
 */
export async function handleAdvance(
  root: string,
  stage: string | null,
  status: string | null,
  evidence: string[],
  sessionId: string,
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const VALID: ReadonlySet<string> = new Set([
    "done",
    "done-verified",
    "done-validated",
    "partial",
    "blocked",
  ]);
  const resolvedStatus = status ?? "done";
  if (!VALID.has(resolvedStatus)) {
    process.stderr.write(
      `[norm advance] invalid --status "${resolvedStatus}"; must be one of ` +
        `done|done-verified|done-validated|partial|blocked\n`,
    );
    process.exitCode = 1;
    return;
  }
  let resolvedStage = stage;
  if (resolvedStage === null || resolvedStage.trim() === "") {
    const ward = await resumeWard(root);
    if (ward === null) {
      process.stderr.write(
        "[norm advance] no active ward — submit a prompt first, or pass --stage\n",
      );
      process.exitCode = 1;
      return;
    }
    resolvedStage = ward.openStage;
  }
  await handleStageAdvance(
    root,
    resolvedStage,
    resolvedStatus as StageVerdict["status"],
    sessionId,
    runtime,
    evidence,
  );
}

/**
 * handleDelegate — SPEC-018 D-004: the explicit Delegation-First seal.
 *
 * `norm delegate` marks the given session as an active delegated lane by
 * writing a lane marker (.hima/state/lane-<sessionId>.json). A session so
 * marked may perform implementation writes at work-bearing stages without
 * being blocked by BEH_DELEGATION_FIRST — the runtime-agnostic way a spawned
 * lane declares "I am a delegated worker, not the solo main thread".
 *
 * `--clear` removes the marker. A missing session id is a user error (exit 1)
 * — unlike hook events, this is a direct command and must not lie about success.
 */
export async function handleDelegate(
  root: string,
  sessionId: string | null,
  opts: { clear?: boolean; roles?: string[] } = {},
): Promise<void> {
  if (sessionId === null || sessionId.trim() === "") {
    process.stderr.write(
      "[norm delegate] no session id — pass --session <id> (or set HIMA_SESSION_ID)\n",
    );
    process.exitCode = 1;
    return;
  }
  if (opts.clear === true) {
    clearLane(root, sessionId);
    process.stdout.write(`[norm delegate] lane marker cleared for session ${sessionId}\n`);
    return;
  }
  const roles = opts.roles ?? [];
  markLane(root, sessionId, { roles });
  process.stdout.write(
    `[norm delegate] session ${sessionId} marked as a delegated lane` +
      (roles.length > 0 ? ` (roles: ${roles.join(", ")})` : "") +
      ` — implementation writes at work-bearing stages are now permitted for this session.\n`,
  );
}

/**
 * handleSessionStart — R-030: session-start ward-resume context injection.
 *
 * Calls buildSessionResumeContext(root). When a ward is found, emits its
 * resume canary as additionalContext so the agent knows it is resuming a
 * prior run and which stage was last sealed. Always exits 0 (advisory only).
 *
 * When no ward exists, emits allow silently — there is nothing to resume.
 */
export async function handleSessionStart(
  root: string,
  payload: StdinPayload,
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";

  // R-044: capture the git-diff baseline for this session so PostToolUse can
  // compute a real "changed" flag (hasChangesSince) instead of a hardcoded
  // literal. Tolerant of failure (git absent, root not a repo, timeout) —
  // captureGitSnapshot then persists "" as the baseline in that case, which
  // hasChangesSince treats like any other snapshot (compared by string equality).
  try {
    const gitSnapshot = runGitDiffStat(root);
    await captureGitSnapshot(root, gitSnapshot);
  } catch {
    // swallow — snapshot capture must never break session-start
  }

  const context = await buildSessionResumeContext(root);

  // R-055: when runtime is hermes, append HERMES_HOME warning when the env var
  // is absent — profile switching mid-session is disabled without it.
  const homeWarning =
    runtime === "hermes" ? hermesHomeWarning(process.env) : null;

  // Build the final context string: combine ward-resume context + hermes warning.
  const finalContext = [context, homeWarning].filter(Boolean).join("\n") || null;

  if (finalContext !== null) {
    emitContext("SessionStart", finalContext);
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "SessionStart",
      gateType: "noop",
      decision: "allow",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason:
        context !== null
          ? "session-start: ward found — resume context emitted"
          : "session-start: hermes home warning emitted",
    });
  } else {
    emitAllow();
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "SessionStart",
      gateType: "noop",
      decision: "noop",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason: "session-start: no active ward",
    });
  }
}

/**
 * handlePreCompact — R-036: pre_compact ward-state preservation block.
 *
 * On claude runtime, calls buildPreCompactContext(root) and emits a compact
 * block carrying the ward state + skill register so the agent retains
 * governance context across compaction (prevents context drift).
 *
 * For codex and hermes runtimes: no-op (pre_compact is a claude-only hook).
 * Always exits 0 — this is advisory enrichment, never blocking.
 */
export async function handlePreCompact(
  root: string,
  payload: StdinPayload,
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";

  if (runtime === "claude") {
    const context = await buildPreCompactContext(root);
    if (context !== null) {
      emitContext("PreCompact", context);
      safeAppendTrace(root, {
        sessionId,
        hookEvent: "PreCompact",
        gateType: "noop",
        decision: "allow",
        skillsForced: [],
        skillsLoaded: [],
        exitCode: 0,
        reason: "pre-compact: ward state preservation block emitted",
      });
      return;
    }
  }

  // Non-claude runtime or no active ward → silent allow.
  emitAllow();
  safeAppendTrace(root, {
    sessionId,
    hookEvent: "PreCompact",
    gateType: "noop",
    decision: "noop",
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    reason:
      runtime !== "claude"
        ? `pre-compact: no-op for ${runtime} runtime`
        : "pre-compact: no active ward",
  });
}

// ---------------------------------------------------------------------------
// Minimal hima governance rules serialized for subagent injection (R-047).
//
// Injected into delegate_task payloads so Hermes subagents inherit key
// governance constraints even without a native subagent_start hook.
// Kept short (≤ MAX_RULES_CHARS) to stay within the size guard in
// injectRulesIntoDelegateTask.
// ---------------------------------------------------------------------------

const HIMA_GOVERNANCE_RULES_SERIALIZED = [
  "hima governance (injected from parent session):",
  "1. Worker model: always specify model explicitly (haiku|sonnet). Never inherit session default.",
  "2. Observe all gates: pre_tool, stop, session_start remain active in child sessions.",
  "3. No unsafe operations (destructive git, secret exposure) without explicit authority.",
  "4. Skill-force: call required corpus-* skills before writing implementation files.",
  "5. Falsifies-If blocks on claim-bearing artifacts must be present.",
].join("\n");

/**
 * handleHermesDelegateTask — internal R-038 compensation handler.
 *
 * Called from handlePreToolUse when runtime==="hermes" and toolName==="delegate_task".
 * Evaluates the subagent_start gate (BEH_WORKER_MODEL) and either blocks or
 * injects hima rules into the task payload.
 *
 * Emit shape on allow (hermes ACP with modifications):
 *   {"decision":"allow","raw":{"action":"continue","modifications":{"task":"<injected>"}}}
 *
 * Emit shape on block:
 *   {"decision":"block","reason":"...","raw":{"action":"block","message":"..."}}
 */
/**
 * recordCodexSubagentSpawn — internal R-049 compensation handler.
 *
 * Called from handlePreToolUse when runtime==="codex" and toolName matches a
 * subagent-spawning tool (task|delegate|spawn|subagent, case-insensitive).
 * Registers a child sessionId in the parent's poll file (registerSubagent),
 * re-reads the registry (readSubagentRegistry) so the count is available for
 * the trace, and appends a trace event recording the registration.
 *
 * Never blocks, never throws — this is observational compensation for the
 * absent native Codex subagent_start hook (capability-map-v3 CODEX_MAP:
 * compensatingMechanism="poll_subagent_file").
 */
async function recordCodexSubagentSpawn(
  root: string,
  payload: StdinPayload,
  sessionId: string,
  toolName: string,
): Promise<void> {
  try {
    const toolInputObj =
      typeof payload.toolInput === "object" && payload.toolInput !== null
        ? (payload.toolInput as Record<string, unknown>)
        : undefined;

    const childId =
      toolInputObj !== undefined &&
      typeof toolInputObj["childSessionId"] === "string" &&
      toolInputObj["childSessionId"] !== ""
        ? (toolInputObj["childSessionId"] as string)
        : toolInputObj !== undefined &&
            typeof toolInputObj["child_session_id"] === "string" &&
            toolInputObj["child_session_id"] !== ""
          ? (toolInputObj["child_session_id"] as string)
          : randomUUID();

    await registerSubagent(root, sessionId, childId);
    const registry = await readSubagentRegistry(root, sessionId);

    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "subagent_start",
      decision: "allow",
      toolName,
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 0,
      reason:
        `[R-049 codex-subagent] registered child "${childId}" — ` +
        `registry now has ${registry.length} entr${registry.length === 1 ? "y" : "ies"}`,
    });
  } catch {
    // swallow — compensation must never break the pre_tool hook pipeline
  }
}

async function handleHermesDelegateTask(
  root: string,
  payload: StdinPayload,
  sessionId: string,
): Promise<void> {
  const ward = await resumeWard(root);
  const riskClass = resolveRiskClass(ward);

  // Build subagent_start BehaviorContext from the delegate_task toolInput.
  const subagentCtx = {
    event: {
      gateType: "subagent_start" as const,
      toolName: "delegate_task",
      toolInput: payload.toolInput,
    },
    riskClass,
    root,
    ward,
    agentOutput: undefined,
    sessionId, // R-003: key must match what PostToolUse recordRead uses
  };

  const verdict = await evaluateGate(
    getBehaviorsForGate("subagent_start"),
    subagentCtx,
  );

  if (verdict.decision === "block") {
    // Hermes pre_tool canBlock=true — emit hard block.
    const blockPayload = {
      decision: "block",
      reason: verdict.reason,
      raw: { action: "block", message: verdict.reason },
    };
    process.stdout.write(JSON.stringify(blockPayload) + "\n");
    process.exitCode = 2;

    safeAppendTrace(root, {
      sessionId,
      hookEvent: "PreToolUse",
      gateType: "subagent_start",
      decision: "block",
      toolName: "delegate_task",
      skillsForced: [],
      skillsLoaded: [],
      exitCode: 2,
      reason: `[R-038 delegate_task] ${verdict.reason}`,
    });
    return;
  }

  // Allow path: inject hima governance rules into the task payload.
  // Extract the task text from toolInput (tries "task" and "description" fields).
  const toolInputObj =
    typeof payload.toolInput === "object" && payload.toolInput !== null
      ? (payload.toolInput as Record<string, unknown>)
      : undefined;
  const taskText =
    toolInputObj !== undefined
      ? typeof toolInputObj["task"] === "string"
        ? toolInputObj["task"]
        : typeof toolInputObj["description"] === "string"
          ? toolInputObj["description"]
          : "[no task text]"
      : "[no task text]";

  const modifiedTask = injectRulesIntoDelegateTask(
    taskText,
    HIMA_GOVERNANCE_RULES_SERIALIZED,
  );

  const allowPayload = {
    decision: "allow",
    raw: {
      action: "continue",
      modifications: { task: modifiedTask },
    },
  };
  process.stdout.write(JSON.stringify(allowPayload) + "\n");

  safeAppendTrace(root, {
    sessionId,
    hookEvent: "PreToolUse",
    gateType: "subagent_start",
    decision: "allow",
    toolName: "delegate_task",
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    reason: "[R-038 delegate_task] subagent_start allowed — hima rules injected",
  });
}

/**
 * handleSubagentStart — R-028: enforce BEH_WORKER_MODEL at the subagent_start gate.
 *
 * On Claude (canBlock=true for subagent_start): if BEH_WORKER_MODEL blocks (no model
 * specified in the spawn payload), emits a hard block + exit 2. Otherwise allows.
 *
 * On Hermes: subagent_start is absent; compensation is via handlePreToolUse's
 * delegate_task intercept (R-038). This function is only reached on Claude.
 *
 * On Codex: subagent_start is degraded (canBlock=false); the poll-file mechanism
 * (R-049) provides compensation. Here we still evaluate the gate but cannot block.
 */
export async function handleSubagentStart(
  root: string,
  payload: StdinPayload,
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";
  const ward = await resumeWard(root);
  const riskClass = resolveRiskClass(ward);

  // SPEC-018 D-004: a sub-agent starting IS the delegation signal. Stamp the
  // ward+stage so BEH_DELEGATION_FIRST lets implementation writes flow at this
  // stage — the auto, no-operator-bookkeeping path. Never throws (guarded).
  if (ward !== null && ward !== undefined) {
    try {
      markStageDelegation(root, ward.id, ward.openStage);
    } catch {
      /* marker is advisory — never break subagent-start on a write error */
    }
  }

  // Build BehaviorContext for the subagent_start gate.
  const ctx = {
    event: {
      gateType: "subagent_start" as const,
      toolName: payload.toolName ?? undefined,
      toolInput: payload.toolInput,
    },
    riskClass,
    root,
    ward,
    agentOutput: undefined,
    sessionId, // R-003: key must match what PostToolUse recordRead uses
  };

  const verdict = await evaluateGate(getBehaviorsForGate("subagent_start"), ctx);
  const register = await readRegister(root);
  const cell = getCell(runtime, "subagent_start");
  const action = pickAttack(runtime, "subagent_start", verdict, register, cell);
  const response = dispatchTranslate(runtime, action);

  if (verdict.decision === "block" && cell.canBlock) {
    // Claude: hard-block. Use verdict.reason for the specific violation message.
    emitBlockDispatch({ ...response, reason: verdict.reason }, verdict.reason);
    safeAppendTrace(root, {
      sessionId,
      hookEvent: "SubagentStart",
      gateType: "subagent_start",
      decision: "block",
      toolName: payload.toolName ?? undefined,
      skillsForced: [],
      skillsLoaded: register.map((r) => r.id),
      exitCode: 2,
      reason: verdict.reason,
    });
    return;
  }

  // Allow path (or non-blocking runtime like Codex).
  if (response.additionalContext !== undefined) {
    emitContext("SubagentStart", response.additionalContext);
  } else {
    emitAllow();
  }

  safeAppendTrace(root, {
    sessionId,
    hookEvent: "SubagentStart",
    gateType: "subagent_start",
    decision: verdict.decision === "block" ? "allow" : verdict.decision,
    toolName: payload.toolName ?? undefined,
    skillsForced: [],
    skillsLoaded: register.map((r) => r.id),
    exitCode: 0,
    reason: verdict.reason,
  });
}

/**
 * handleSubagentStop — R-048: observe-only subagent stop with Hermes dedup guard.
 *
 * For Hermes runtime: the subagent_stop event can replay 6+ times due to a known
 * Hermes bug. isSubagentSeen/markSubagentSeen prevent duplicate processing: on
 * first observation the event is recorded; subsequent duplicates are silently dropped.
 *
 * For all runtimes: exits 0 (observe-only, never blocks).
 *
 * agentId extraction: tries `toolInput.agentId`, `toolInput.agent_id`, then falls
 * back to `toolName` or "unknown-agent" so the dedup key is always non-empty.
 */
export async function handleSubagentStop(
  root: string,
  payload: StdinPayload,
  runtime: RuntimeTarget = "claude",
): Promise<void> {
  const sessionId = payload.sessionId ?? "unknown-session";

  // Extract agentId from payload for dedup (R-048, Hermes-specific).
  const toolInputObj =
    typeof payload.toolInput === "object" && payload.toolInput !== null
      ? (payload.toolInput as Record<string, unknown>)
      : undefined;
  const agentId =
    toolInputObj !== undefined
      ? typeof toolInputObj["agentId"] === "string" && toolInputObj["agentId"] !== ""
        ? toolInputObj["agentId"]
        : typeof toolInputObj["agent_id"] === "string" && toolInputObj["agent_id"] !== ""
          ? toolInputObj["agent_id"]
          : (payload.toolName ?? "unknown-agent")
      : (payload.toolName ?? "unknown-agent");

  // R-048: Hermes dedup — skip re-processing duplicate subagent_stop events.
  if (runtime === "hermes") {
    const alreadySeen = await isSubagentSeen(root, sessionId, agentId, "subagent_stop");
    if (alreadySeen) {
      // Duplicate: silently allow, no trace spam.
      emitAllow();
      return;
    }
    // First occurrence: record and proceed.
    await markSubagentSeen(root, sessionId, agentId, "subagent_stop").catch(() => {
      // swallow — dedup persistence failure must never block the hook
    });
  }

  // Observe-only: emit a canary and allow.
  process.stderr.write(`[hima] subagent-stop: no-op\n`);
  emitAllow();

  safeAppendTrace(root, {
    sessionId,
    hookEvent: "subagent-stop",
    gateType: "subagent_stop",
    decision: "noop",
    toolName: payload.toolName ?? undefined,
    skillsForced: [],
    skillsLoaded: [],
    exitCode: 0,
    reason: `subagent-stop: observe-only${runtime === "hermes" ? " (dedup: first occurrence)" : ""}`,
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
