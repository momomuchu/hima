/**
 * Capability map: GateType × runtime × supported/degraded/absent.
 *
 * Sources:
 *  - runtime-profiles.ts (packages/core) — authoritative hook table
 *  - PROPOSITION.md §4 — documented Hermes gaps
 *
 * Three levels:
 *  "supported"  — hook exists and can block (gate is fully enforceable)
 *  "degraded"   — hook exists but cannot block (observable only; gate must compensate)
 *  "absent"     — no native hook at all (gate cannot fire on this runtime)
 */

export const GATE_TYPES = [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
] as const;

export type GateType = (typeof GATE_TYPES)[number];

export type CapabilityLevel = "supported" | "degraded" | "absent";

export interface GateCapability {
  gateType: GateType;
  level: CapabilityLevel;
  /**
   * Human-readable explanation — required for degraded/absent, optional for supported.
   * Documents the compensating strategy where relevant.
   */
  note?: string;
}

export type RuntimeTarget = "claude" | "codex" | "hermes";

export interface RuntimeCapabilityMap {
  runtime: RuntimeTarget;
  gates: Record<GateType, GateCapability>;
  /**
   * Runtime-level gaps that are not tied to a specific GateType.
   * Documented from PROPOSITION.md §4.
   */
  runtimeGaps: RuntimeGap[];
}

export interface RuntimeGap {
  id: string;
  description: string;
  compensatingStrategy?: string;
}

// ---------------------------------------------------------------------------
// Hermes capability map
// Source: packages/core/src/runtime/runtime-profiles.ts + PROPOSITION.md §4
// ---------------------------------------------------------------------------

const HERMES_GAPS: RuntimeGap[] = [
  {
    id: "hermes-no-system-prompt-hook",
    description:
      "Hermes has no system-prompt injection hook. Behaviors must be injected via user-message or tool-result instead.",
    compensatingStrategy: "Inject behavior rules via pre_llm_call user-message or tool-result.",
  },
  {
    id: "hermes-magic-words-gateway-only",
    description:
      "Magic-word keyword detection has no deterministic CLI-side interception. Detection lives only in the gateway (pre_llm_call / pre_gateway_dispatch).",
    compensatingStrategy:
      "Implement KEYWORD_DETECTORS inside the hima plugin on pre_llm_call or pre_gateway_dispatch.",
  },
  {
    id: "hermes-sticky-profiles",
    description:
      "Hermes profiles are sticky globally (issue #18594). Profile switch mid-session requires a full restart.",
    compensatingStrategy: "Always pass HERMES_HOME explicitly per invocation; never switch mid-session.",
  },
  {
    id: "hermes-subagents-skip-context-files",
    description:
      "Hermes sub-agents have skip_context_files=True hardcoded. Rules injected via .hermes.md do NOT propagate to child agents.",
    compensatingStrategy:
      "Propagate hima rules through the pre_tool_call / delegate_task hook of the hima plugin.",
  },
];

export const HERMES_CAPABILITY_MAP: RuntimeCapabilityMap = {
  runtime: "hermes",
  gates: {
    session_start: {
      gateType: "session_start",
      level: "degraded",
      note: "on_session_start exists but cannot block; observable only.",
    },
    user_prompt: {
      gateType: "user_prompt",
      level: "supported",
      note: "pre_llm_call can block via {\"action\":\"block\"}.",
    },
    pre_tool: {
      gateType: "pre_tool",
      level: "supported",
      note: "pre_tool_call can block via {\"action\":\"block\"}.",
    },
    post_tool: {
      gateType: "post_tool",
      level: "degraded",
      note: "post_tool_call is observable but cannot block.",
    },
    pre_compact: {
      gateType: "pre_compact",
      level: "supported",
      note: "pre_compact can block.",
    },
    post_compact: {
      gateType: "post_compact",
      level: "degraded",
      note: "post_compact is observable but cannot block.",
    },
    stop: {
      gateType: "stop",
      level: "degraded",
      note: "on_session_end is non-blocking. Final DONE/PARTIAL/BLOCKED gate must be deferred to the next turn via pre_tool_call or pre_llm_call.",
    },
    subagent_start: {
      gateType: "subagent_start",
      level: "absent",
      note: "No native Hermes hook for subagent_start. sub-agent context propagation must use pre_tool_call/delegate_task instead.",
    },
    subagent_stop: {
      gateType: "subagent_stop",
      level: "degraded",
      note: "subagent_stop hook exists but cannot block.",
    },
  },
  runtimeGaps: HERMES_GAPS,
};

// ---------------------------------------------------------------------------
// Claude capability map
// Source: packages/core/src/runtime/runtime-profiles.ts (claude profile)
// ---------------------------------------------------------------------------

export const CLAUDE_CAPABILITY_MAP: RuntimeCapabilityMap = {
  runtime: "claude",
  gates: {
    session_start: {
      gateType: "session_start",
      level: "degraded",
      note: "SessionStart hook exists but cannot block.",
    },
    user_prompt: {
      gateType: "user_prompt",
      level: "supported",
    },
    pre_tool: {
      gateType: "pre_tool",
      level: "supported",
    },
    post_tool: {
      gateType: "post_tool",
      level: "degraded",
      note: "PostToolUse hook exists but cannot block.",
    },
    pre_compact: {
      gateType: "pre_compact",
      level: "supported",
    },
    post_compact: {
      gateType: "post_compact",
      level: "degraded",
      note: "PostCompact hook exists but cannot block.",
    },
    stop: {
      gateType: "stop",
      level: "supported",
    },
    subagent_start: {
      gateType: "subagent_start",
      level: "supported",
    },
    subagent_stop: {
      gateType: "subagent_stop",
      level: "supported",
    },
  },
  runtimeGaps: [],
};

// ---------------------------------------------------------------------------
// Codex capability map
// Source: packages/core/src/runtime/runtime-profiles.ts (codex profile)
// ---------------------------------------------------------------------------

export const CODEX_CAPABILITY_MAP: RuntimeCapabilityMap = {
  runtime: "codex",
  gates: {
    session_start: {
      gateType: "session_start",
      level: "degraded",
      note: "SessionStart hook exists but cannot block.",
    },
    user_prompt: {
      gateType: "user_prompt",
      level: "supported",
    },
    pre_tool: {
      gateType: "pre_tool",
      level: "supported",
    },
    post_tool: {
      gateType: "post_tool",
      level: "degraded",
      note: "PostToolUse hook exists but cannot block.",
    },
    pre_compact: {
      gateType: "pre_compact",
      level: "supported",
    },
    post_compact: {
      gateType: "post_compact",
      level: "degraded",
      note: "PostCompact hook exists but cannot block.",
    },
    stop: {
      gateType: "stop",
      level: "supported",
    },
    subagent_start: {
      gateType: "subagent_start",
      level: "absent",
      note: "Codex does not expose a native subagent_start hook.",
    },
    subagent_stop: {
      gateType: "subagent_stop",
      level: "absent",
      note: "Codex does not expose a native subagent_stop hook.",
    },
  },
  runtimeGaps: [],
};

// ---------------------------------------------------------------------------
// Unified lookup
// ---------------------------------------------------------------------------

export const CAPABILITY_MAPS: Record<RuntimeTarget, RuntimeCapabilityMap> = {
  hermes: HERMES_CAPABILITY_MAP,
  claude: CLAUDE_CAPABILITY_MAP,
  codex: CODEX_CAPABILITY_MAP,
};

export function getCapabilityMap(runtime: RuntimeTarget): RuntimeCapabilityMap {
  return CAPABILITY_MAPS[runtime];
}

export function getGateCapability(runtime: RuntimeTarget, gateType: GateType): GateCapability {
  return CAPABILITY_MAPS[runtime].gates[gateType];
}

/**
 * Returns all degraded or absent gates for the given runtime.
 * Useful for generating warnings or documentation.
 */
export function getLimitedGates(
  runtime: RuntimeTarget,
): { gateType: GateType; level: "degraded" | "absent"; note?: string }[] {
  const map = CAPABILITY_MAPS[runtime];
  return GATE_TYPES.flatMap((gateType) => {
    const cap = map.gates[gateType];
    if (cap.level === "degraded" || cap.level === "absent") {
      return [{ gateType, level: cap.level, note: cap.note }];
    }
    return [];
  });
}
