import type { ForceAction } from "@norm/schemas";
import {
  GateCapabilityCell,
  decodeGateCapabilityCell,
} from "@norm/schemas";
import type { GateType } from "@norm/schemas";

/**
 * adapter-opencode — translate a ForceAction into the OpenCode runtime response shape.
 *
 * OpenCode is programmatic and rich-capable (semantics parallel to Claude Code).
 * Mapping (from ARCHITECTURE-v3 §3.2/§3.5, gap register R-050):
 *
 *   hard-block / skill-force → { decision: "block", reason, exitCode: 2 }
 *   rich-inject              → { decision: "continue", additionalContext: content, exitCode: 0 }
 *   constrained-inject       → { decision: "continue", additionalContext: systemMessage, exitCode: 0 }
 *   deferred-block           → { decision: "continue", exitCode: 0 }
 *   observe-only / noop      → { decision: "continue", exitCode: 0 }
 *
 * NOTE: OpenCode semantics have not yet been verified against the official
 * OpenCode hook specification. Every cell in OPENCODE_MAP carries
 * note:"semantics pending web verification" until R-050 is closed.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.2/§3.5,
 *      V3-COMPLETENESS-AUDIT.md R-050.
 */

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export type OpenCodeResponse = {
  decision: "block" | "continue";
  reason?: string;
  additionalContext?: string;
  exitCode: 0 | 2;
  raw?: unknown;
};

// ---------------------------------------------------------------------------
// translateOpenCode
// ---------------------------------------------------------------------------

/**
 * Convert a ForceAction into an OpenCode hook-response payload.
 *
 * OpenCode is rich-capable: additionalContext carries injected content without
 * truncation. The response shape is compatible with DispatchResponse.
 */
export function translateOpenCode(action: ForceAction): OpenCodeResponse {
  switch (action.kind) {
    case "hard-block":
      return {
        decision: "block",
        reason: action.reason,
        exitCode: 2,
      };

    case "skill-force":
      return {
        decision: "block",
        reason: action.reason,
        exitCode: 2,
      };

    case "rich-inject":
      return {
        decision: "continue",
        additionalContext: action.content,
        exitCode: 0,
      };

    case "constrained-inject":
      // OpenCode is rich-capable; no downgrade needed — carry via additionalContext.
      return {
        decision: "continue",
        additionalContext: action.systemMessage,
        exitCode: 0,
      };

    case "deferred-block":
      // Verdict written to disk by caller; OpenCode gate continues.
      return {
        decision: "continue",
        exitCode: 0,
      };

    case "observe-only":
      return {
        decision: "continue",
        exitCode: 0,
      };

    case "noop":
      return {
        decision: "continue",
        exitCode: 0,
      };

    default: {
      // TypeScript never-check — exhaustive over all ForceAction kinds.
      const _exhaustive: never = action;
      throw new Error(
        `adapter-opencode: unhandled ForceAction kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// OPENCODE_MAP — capability matrix for the OpenCode runtime
//
// NOTE: All cells carry note:"semantics pending web verification".
//       Shape mirrors CLAUDE_MAP; values are best-effort until the OpenCode
//       hook spec is officially confirmed (R-050).
// ---------------------------------------------------------------------------

/** Validate and freeze a cell at definition time. */
function cell(raw: GateCapabilityCell): GateCapabilityCell {
  return decodeGateCapabilityCell(raw);
}

const PENDING = "semantics pending web verification";

export const OPENCODE_MAP: Record<GateType, GateCapabilityCell> = {
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
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
    note: PENDING,
  }),
};
