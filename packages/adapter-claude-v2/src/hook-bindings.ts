import {
  type CapabilityLevel,
  type GateCapability,
  type GateType,
  GATE_TYPES,
  getGateCapability,
} from "@hima/storage-core";

export type ClaudeHookBindingStatus = "supported" | "degraded" | "absent";

export interface ClaudeHookBinding {
  target: "claude";
  gateType: GateType;
  /**
   * Native Claude Code event name (settings.json hook key).
   */
  nativeEvent: string;
  canBlock: boolean;
  status: ClaudeHookBindingStatus;
  /**
   * CLI hook command (e.g. "hima hook pre-tool-use --format claude").
   */
  command: string;
  reason: string;
}

/**
 * Native event names and blocking capability for Claude Code.
 * Derived from packages/core/src/runtime/runtime-profiles.ts (claude profile).
 */
const CLAUDE_NATIVE_EVENTS: Record<GateType, { nativeEvent: string; canBlock: boolean }> = {
  session_start:  { nativeEvent: "SessionStart",      canBlock: false },
  user_prompt:    { nativeEvent: "UserPromptSubmit",  canBlock: true  },
  pre_tool:       { nativeEvent: "PreToolUse",        canBlock: true  },
  post_tool:      { nativeEvent: "PostToolUse",       canBlock: false },
  pre_compact:    { nativeEvent: "PreCompact",        canBlock: true  },
  post_compact:   { nativeEvent: "PostCompact",       canBlock: false },
  stop:           { nativeEvent: "Stop",              canBlock: true  },
  subagent_start: { nativeEvent: "SubagentStart",     canBlock: true  },
  subagent_stop:  { nativeEvent: "SubagentStop",      canBlock: true  },
};

const HOOK_COMMAND_EVENTS: Record<GateType, string> = {
  session_start:  "session-start",
  user_prompt:    "user-prompt-submit",
  pre_tool:       "pre-tool-use",
  post_tool:      "post-tool-use",
  pre_compact:    "pre-compact",
  post_compact:   "post-compact",
  stop:           "stop",
  subagent_start: "subagent-start",
  subagent_stop:  "subagent-stop",
};

function capabilityLevelToStatus(level: CapabilityLevel): ClaudeHookBindingStatus {
  if (level === "supported") return "supported";
  if (level === "degraded") return "degraded";
  return "absent";
}

function buildReason(cap: GateCapability): string {
  if (cap.level === "absent") {
    return cap.note ?? "runtime does not expose a native event for this gate";
  }
  if (cap.level === "degraded") {
    return cap.note ?? "runtime hook is observable but cannot block";
  }
  return cap.note ?? "runtime hook can enforce blocking HIMA gate decisions";
}

export function getClaudeHookBindings(): ClaudeHookBinding[] {
  return GATE_TYPES.map((gateType) => {
    const cap = getGateCapability("claude", gateType);
    const native = CLAUDE_NATIVE_EVENTS[gateType];

    return {
      target: "claude",
      gateType,
      nativeEvent: native.nativeEvent,
      canBlock: native.canBlock,
      status: capabilityLevelToStatus(cap.level),
      command: `hima hook ${HOOK_COMMAND_EVENTS[gateType]} --format claude`,
      reason: buildReason(cap),
    };
  });
}
