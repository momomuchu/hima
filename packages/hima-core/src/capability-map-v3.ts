import {
  GateCapabilityCell,
  decodeGateCapabilityCell,
} from "@hima/schemas";

// Re-export GateType type from schemas for local use
import type { GateType } from "@hima/schemas";

/**
 * capability-map-v3 — the runtime capability matrix for PFV4.
 *
 * Encodes the 8-field GateCapabilityCell for each of the 9 gate types across
 * the three supported runtimes: "claude", "codex", "hermes".
 *
 * Key invariants (from ARCHITECTURE-v3.md + AMENDMENTs):
 *   - user_prompt + pre_tool are universal:true, canBlock:true on ALL runtimes.
 *   - codex: constrained injection, maxInjectionBytes 1800, pre_tool+stop block only.
 *   - hermes: stop level=degraded, enforcementStrength=deferred.
 *   - hermes: subagent_start absent → compensatingMechanism=intercept_delegate_task_pre_tool.
 *
 * Each cell is validated at module load via decodeGateCapabilityCell (throws on schema
 * violation, so a broken map fails fast rather than silently returning bad data).
 */

export type RuntimeTarget = "claude" | "codex" | "hermes";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Validate and freeze a cell at definition time. */
function cell(raw: GateCapabilityCell): GateCapabilityCell {
  return decodeGateCapabilityCell(raw);
}

// ---------------------------------------------------------------------------
// CLAUDE_MAP
// ---------------------------------------------------------------------------

const CLAUDE_MAP: Record<GateType, GateCapabilityCell> = {
  session_start: cell({
    gateType: "session_start",
    level: "supported",
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
    note: "Context injection only; blocking not available at session start.",
  }),

  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "keyword_detection_user_prompt",
    universal: true,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: true,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  post_tool: cell({
    gateType: "post_tool",
    level: "supported",
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  pre_compact: cell({
    gateType: "pre_compact",
    level: "supported",
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  post_compact: cell({
    gateType: "post_compact",
    level: "supported",
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  stop: cell({
    gateType: "stop",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  subagent_start: cell({
    gateType: "subagent_start",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "injected_role_context",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),

  subagent_stop: cell({
    gateType: "subagent_stop",
    level: "supported",
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
  }),
};

// ---------------------------------------------------------------------------
// CODEX_MAP
// ---------------------------------------------------------------------------

const CODEX_MAP: Record<GateType, GateCapabilityCell> = {
  session_start: cell({
    gateType: "session_start",
    level: "supported",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    maxInjectionBytes: 1800,
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "systemMessage injection only; no native block at session start.",
  }),

  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "keyword_detection_user_prompt",
    maxInjectionBytes: 1800,
    universal: true,
    subagents: "poll-file",
    profiles: "injected-role-context",
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    maxInjectionBytes: 1800,
    universal: true,
    subagents: "poll-file",
    profiles: "injected-role-context",
  }),

  post_tool: cell({
    gateType: "post_tool",
    level: "supported",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    maxInjectionBytes: 1800,
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
  }),

  pre_compact: cell({
    gateType: "pre_compact",
    level: "absent",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "poll-file",
    profiles: "none",
    note: "Compact hooks not available in Codex runtime.",
  }),

  post_compact: cell({
    gateType: "post_compact",
    level: "absent",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "poll-file",
    profiles: "none",
    note: "Compact hooks not available in Codex runtime.",
  }),

  stop: cell({
    gateType: "stop",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: false,
    compensatingMechanism: "none",
    maxInjectionBytes: 1800,
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "Codex stop block is supported; pre_tool+stop are the primary enforcement gates.",
  }),

  subagent_start: cell({
    gateType: "subagent_start",
    level: "degraded",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "poll_subagent_file",
    maxInjectionBytes: 1800,
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "No native subagent hook; compensated by poll-file pattern.",
  }),

  subagent_stop: cell({
    gateType: "subagent_stop",
    level: "degraded",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "poll_subagent_file",
    universal: false,
    subagents: "poll-file",
    profiles: "none",
    note: "No native subagent stop; compensated by poll-file pattern.",
  }),
};

// ---------------------------------------------------------------------------
// HERMES_MAP
// ---------------------------------------------------------------------------

const HERMES_MAP: Record<GateType, GateCapabilityCell> = {
  session_start: cell({
    gateType: "session_start",
    level: "supported",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "injected_role_context",
    universal: false,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Hermes uses user-message injection; no system-level hook.",
  }),

  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "keyword_detection_user_prompt",
    universal: true,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Universal blocking via user-message injection and keyword detection.",
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: true,
    subagents: "absent",
    profiles: "injected-role-context",
  }),

  post_tool: cell({
    gateType: "post_tool",
    level: "supported",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "absent",
    profiles: "injected-role-context",
  }),

  pre_compact: cell({
    gateType: "pre_compact",
    level: "absent",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "absent",
    profiles: "none",
    note: "Compact hooks not available in Hermes runtime.",
  }),

  post_compact: cell({
    gateType: "post_compact",
    level: "absent",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "absent",
    profiles: "none",
    note: "Compact hooks not available in Hermes runtime.",
  }),

  stop: cell({
    gateType: "stop",
    level: "degraded",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "deferred",
    skillForcing: false,
    compensatingMechanism: "deferred_stop_verdict",
    universal: false,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Stop is degraded on Hermes: enforcement is deferred, not hard-blocking.",
  }),

  subagent_start: cell({
    gateType: "subagent_start",
    level: "absent",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "intercept_delegate_task_pre_tool",
    universal: false,
    subagents: "absent",
    profiles: "none",
    note: "No native subagent hook on Hermes; compensated via pre_tool intercept of delegate/task calls.",
  }),

  subagent_stop: cell({
    gateType: "subagent_stop",
    level: "absent",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "none",
    universal: false,
    subagents: "absent",
    profiles: "none",
    note: "No subagent stop on Hermes.",
  }),
};

// ---------------------------------------------------------------------------
// Runtime map index
// ---------------------------------------------------------------------------

const RUNTIME_MAPS: Record<RuntimeTarget, Record<GateType, GateCapabilityCell>> = {
  claude: CLAUDE_MAP,
  codex: CODEX_MAP,
  hermes: HERMES_MAP,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the capability cell for a given runtime and gate type.
 *
 * @throws {Error} if runtime is unknown (type-safe callers won't hit this).
 */
export function getCell(
  runtime: RuntimeTarget,
  gateType: GateType,
): GateCapabilityCell {
  const map = RUNTIME_MAPS[runtime];
  // noUncheckedIndexedAccess: map is Record<GateType,…> so indexing is safe,
  // but TS sees it as potentially undefined — assert non-null.
  const c = map[gateType];
  if (c === undefined) {
    throw new Error(
      `capability-map-v3: no cell for runtime="${runtime}" gateType="${gateType}"`,
    );
  }
  return c;
}

// Named map exports for callers that want direct access.
export { CLAUDE_MAP, CODEX_MAP, HERMES_MAP };
