import {
  type CapabilityLevel,
  type GateCapability,
  type GateType,
  GATE_TYPES,
  getGateCapability,
} from "@hima/storage-core";

export type HermesHookBindingStatus = "supported" | "degraded" | "absent";

export interface HermesHookBinding {
  target: "hermes";
  gateType: GateType;
  /**
   * Native Hermes event name, or null when absent.
   */
  nativeEvent: string | null;
  canBlock: boolean;
  status: HermesHookBindingStatus;
  /**
   * CLI hook command (e.g. "hima hook pre-tool-use").
   */
  command: string;
  reason: string;
}

/**
 * Native event names and blocking capability for Hermes.
 * Derived from packages/core/src/runtime/runtime-profiles.ts (hermes profile).
 */
const HERMES_NATIVE_EVENTS: Record<
  GateType,
  { nativeEvent: string | null; canBlock: boolean }
> = {
  session_start:  { nativeEvent: "on_session_start",  canBlock: false },
  user_prompt:    { nativeEvent: "pre_llm_call",       canBlock: true  },
  pre_tool:       { nativeEvent: "pre_tool_call",      canBlock: true  },
  post_tool:      { nativeEvent: "post_tool_call",     canBlock: false },
  pre_compact:    { nativeEvent: "pre_compact",        canBlock: true  },
  post_compact:   { nativeEvent: "post_compact",       canBlock: false },
  stop:           { nativeEvent: "on_session_end",     canBlock: false },
  subagent_start: { nativeEvent: null,                 canBlock: false },
  subagent_stop:  { nativeEvent: "subagent_stop",      canBlock: false },
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

function capabilityLevelToStatus(level: CapabilityLevel): HermesHookBindingStatus {
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

export function getHermesHookBindings(): HermesHookBinding[] {
  return GATE_TYPES.map((gateType) => {
    const cap = getGateCapability("hermes", gateType);
    const native = HERMES_NATIVE_EVENTS[gateType];

    return {
      target: "hermes",
      gateType,
      nativeEvent: native.nativeEvent,
      canBlock: native.canBlock,
      status: capabilityLevelToStatus(cap.level),
      command: `hima hook ${HOOK_COMMAND_EVENTS[gateType]}`,
      reason: buildReason(cap),
    };
  });
}
