import {
  GateCapabilityCell,
  decodeGateCapabilityCell,
} from "@norm/schemas";

// Re-export GateType type from schemas for local use
import type { GateType } from "@norm/schemas";
import { OPENCODE_MAP } from "./adapter-opencode.js";

/**
 * capability-map-v3 — the runtime capability matrix for PFV4.
 *
 * Encodes the 8-field GateCapabilityCell for each of the 9 gate types across
 * the three supported runtimes: "claude", "codex", "hermes".
 *
 * Key invariants (from ARCHITECTURE-v3.md + AMENDMENTs):
 *   - user_prompt + pre_tool are universal:true, canBlock:true on ALL runtimes.
 *   - codex: constrained injection, pre_tool+stop block only. NOTE (SOT correction C1,
 *     docs/research/runtime-capabilities.sot.json): there is NO documented 1800-byte
 *     injection cap on Codex — "1800" was a misread of agents.job_max_runtime_seconds
 *     (a 1800-SECOND timeout, not a byte limit). Real Codex doc-size caps are AGENTS.md
 *     32 KiB and skill-listing 8000 chars — neither maps to a per-hook injection byte
 *     cap, so `maxInjectionBytes` is left undefined on CODEX_MAP cells (see below).
 *   - hermes: stop level=degraded, enforcementStrength=deferred.
 *   - hermes: subagent_start EXISTS (SOT correction C3) — observational only, no
 *     canBlock. compensatingMechanism=intercept_delegate_task_pre_tool remains the
 *     actual block point (pre_tool), unchanged.
 *   - hermes: constrained-injection cells carry maxInjectionBytes=20000 (SOT correction
 *     C1: real cap is context_file_max_chars=20000 chars/file, not 1800 — "1800" there
 *     was HERMES_API_TIMEOUT, a 1800-SECOND timeout, not a byte/char limit).
 *   - claude: subagent_start is canBlock=false (SOT correction C2) — SubagentStart is
 *     INJECTION-ONLY on Claude; SubagentStop is the blocking sibling. BEH_WORKER_MODEL
 *     enforcement was re-wired to also fire at pre_tool, scoped to the Agent/Task spawn
 *     tool call itself, which IS a real PreToolUse deny point on Claude.
 *   - block surface note (SOT correction C7): the *documented* blockable-hook set per
 *     runtime is wider than "pre_tool + stop" (e.g. claude also has UserPromptSubmit,
 *     PermissionRequest, PostToolUse, PostToolBatch, SubagentStop, TaskCreated/Completed,
 *     PreCompact; codex adds PermissionRequest, PreCompact, PostCompact, SubagentStop;
 *     opencode's tool.execute.before also blocks). This map only encodes the subset PFV4
 *     currently wires through pickAttack/dispatchTranslate — the wider surface enables
 *     redundant Delegation-First enforcement as a documented follow-on, not a behavior
 *     change here. See docs/research/runtime-capabilities.sot.json.
 *
 * Each cell is validated at module load via decodeGateCapabilityCell (throws on schema
 * violation, so a broken map fails fast rather than silently returning bad data).
 */

export type RuntimeTarget = "claude" | "codex" | "hermes" | "opencode";

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
    // SOT correction C2 (docs/research/runtime-capabilities.sot.json): Claude's
    // SubagentStart hook is INJECTION-ONLY — it fires on spawn and can inject
    // additionalContext into the child, but it CANNOT block (canBlock:false in
    // the official hooks doc). SubagentStop is the blocking sibling event.
    // A gate that "hard-blocked" here (the previous canBlock:true) was dark:
    // it could never actually deny the spawn. BEH_WORKER_MODEL enforcement was
    // re-wired to ALSO fire at pre_tool, scoped to the Agent/Task spawn tool
    // call itself, which IS a real PreToolUse deny point on Claude.
    canBlock: false,
    injectionMode: "rich",
    enforcementStrength: "advisory",
    skillForcing: true,
    compensatingMechanism: "injected_role_context",
    universal: false,
    subagents: "native",
    profiles: "runtime-profiles",
    note: "Injection-only (SubagentStart cannot block); hard enforcement of worker-model moved to pre_tool on the Agent/Task spawn call.",
  }),

  subagent_stop: cell({
    gateType: "subagent_stop",
    level: "supported",
    // NOTE (SOT, not part of this correction pass): the official docs describe
    // SubagentStop as canBlock:true ("blocks the child from finishing"). No
    // BehaviorDescriptor currently targets subagent_stop, so this cell is left
    // at its existing conservative canBlock:false/advisory value — flipping it
    // would be an unrelated behavior change (would need new wiring + tests,
    // e.g. R-048 dedup in handleSubagentStop assumes observe-only today).
    // Tracked as a documented follow-on, not part of C1-C7.
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
    // SOT correction C1 (docs/research/runtime-capabilities.sot.json): NO documented
    // injection-byte cap exists on Codex — "1800" was a misread of the 1800-SECOND
    // agents.job_max_runtime_seconds timeout, not a byte limit. Real Codex doc-size
    // caps (AGENTS.md 32 KiB, skill-listing 8000 chars) are unrelated mechanisms, so
    // maxInjectionBytes is left undefined rather than encoding an invented number.
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "systemMessage injection only; no native block at session start. No documented injection-byte cap (SOT C1).",
  }),

  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "keyword_detection_user_prompt",
    // SOT correction C1: no documented injection-byte cap on Codex — see session_start.
    universal: true,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "No documented injection-byte cap (SOT C1); prior 1800 value was the 1800-SECOND job timeout, not a byte limit.",
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    // SOT correction C1: no documented injection-byte cap on Codex — see session_start.
    universal: true,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "No documented injection-byte cap (SOT C1); prior 1800 value was the 1800-SECOND job timeout, not a byte limit.",
  }),

  post_tool: cell({
    gateType: "post_tool",
    level: "supported",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    // SOT correction C1: no documented injection-byte cap on Codex — see session_start.
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "No documented injection-byte cap (SOT C1); prior 1800 value was the 1800-SECOND job timeout, not a byte limit.",
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
    // SOT correction C1: no documented injection-byte cap on Codex — see session_start.
    universal: false,
    subagents: "poll-file",
    profiles: "injected-role-context",
    note: "Codex stop block is supported; pre_tool+stop are the primary enforcement gates. No documented injection-byte cap (SOT C1).",
  }),

  subagent_start: cell({
    gateType: "subagent_start",
    level: "degraded",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "poll_subagent_file",
    // SOT correction C1: no documented injection-byte cap on Codex — see session_start.
    // Also: per SOT, Codex's SubagentStart IS a native push event (see C5,
    // codex-subagent.ts) — the poll-file here remains a defensive fallback, not
    // a necessity.
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
    // SOT correction C1: real Hermes injection cap is context_file_max_chars =
    // 20000 chars/file. The prior "1800" myth was HERMES_API_TIMEOUT, a
    // 1800-SECOND timeout, not a byte/char cap.
    maxInjectionBytes: 20000,
    universal: false,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Hermes uses user-message injection; no system-level hook. Cap is 20000 chars/file (SOT C1), not 1800.",
  }),

  user_prompt: cell({
    gateType: "user_prompt",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "keyword_detection_user_prompt",
    // SOT correction C1: see session_start — real cap is 20000 chars/file.
    maxInjectionBytes: 20000,
    universal: true,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Universal blocking via user-message injection and keyword detection. Cap is 20000 chars/file (SOT C1), not 1800.",
  }),

  pre_tool: cell({
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "constrained",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    // SOT correction C1: see session_start — real cap is 20000 chars/file.
    maxInjectionBytes: 20000,
    universal: true,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Cap is 20000 chars/file (SOT C1), not 1800.",
  }),

  post_tool: cell({
    gateType: "post_tool",
    level: "supported",
    canBlock: false,
    injectionMode: "constrained",
    enforcementStrength: "advisory",
    skillForcing: false,
    compensatingMechanism: "none",
    // SOT correction C1: see session_start — real cap is 20000 chars/file.
    maxInjectionBytes: 20000,
    universal: false,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Cap is 20000 chars/file (SOT C1), not 1800.",
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
    // SOT correction C1: see session_start — real cap is 20000 chars/file.
    maxInjectionBytes: 20000,
    universal: false,
    subagents: "absent",
    profiles: "injected-role-context",
    note: "Stop is degraded on Hermes: enforcement is deferred, not hard-blocking. Cap is 20000 chars/file (SOT C1), not 1800.",
  }),

  subagent_start: cell({
    gateType: "subagent_start",
    // SOT correction C3 (docs/research/runtime-capabilities.sot.json): Hermes
    // subagent_start EXISTS (Norm previously wrongly assumed it was absent) —
    // it is an observational hook only (canBlock:false, no compensating
    // injection currently wired). The real block point stays the pre_tool
    // intercept of delegate_task calls (compensatingMechanism unchanged).
    level: "degraded",
    canBlock: false,
    injectionMode: "none",
    enforcementStrength: "observe_only",
    skillForcing: false,
    compensatingMechanism: "intercept_delegate_task_pre_tool",
    universal: false,
    subagents: "absent",
    profiles: "none",
    note: "subagent_start EXISTS on Hermes (observational only, SOT C3) — not absent as previously documented; pre_tool intercept of delegate_task remains the actual block point.",
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
  opencode: OPENCODE_MAP,
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
export { CLAUDE_MAP, CODEX_MAP, HERMES_MAP, OPENCODE_MAP };
