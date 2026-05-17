import { GATE_TYPES, type GateType, getRuntimeProfile } from "@harness/core";

export type ClaudeHookBindingStatus = "supported" | "degraded" | "unsupported";

export interface ClaudeHookBinding {
  target: "claude";
  gateType: GateType;
  nativeEvent: string | null;
  canBlock: boolean;
  supported: boolean;
  command: string;
  status: ClaudeHookBindingStatus;
  reason: string;
}

export function getClaudeHookBindings(): ClaudeHookBinding[] {
  const profile = getRuntimeProfile("claude");

  return GATE_TYPES.map((gateType) => {
    const hook = profile.hooks[gateType];

    return {
      target: "claude",
      gateType,
      nativeEvent: hook.nativeEvent,
      canBlock: hook.canBlock,
      supported: hook.supported,
      command: hook.command,
      ...describeClaudeHookBinding(hook.supported, hook.nativeEvent, hook.canBlock),
    };
  });
}

function describeClaudeHookBinding(
  supported: boolean,
  nativeEvent: string | null,
  canBlock: boolean,
): Pick<ClaudeHookBinding, "status" | "reason"> {
  if (!supported || nativeEvent === null) {
    return {
      status: "unsupported",
      reason: "runtime does not expose a native event for this gate",
    };
  }

  if (!canBlock) {
    return {
      status: "degraded",
      reason: "runtime hook is observable but cannot block",
    };
  }

  return {
    status: "supported",
    reason: "runtime hook can enforce blocking HIMA gate decisions",
  };
}
