import { GATE_TYPES, type GateType, getRuntimeProfile } from "@harness/core";

export type CodexHookBindingStatus = "supported" | "degraded" | "unsupported";

export interface CodexHookBinding {
  target: "codex";
  gateType: GateType;
  nativeEvent: string | null;
  canBlock: boolean;
  supported: boolean;
  command: string;
  status: CodexHookBindingStatus;
  reason: string;
}

export function getCodexHookBindings(): CodexHookBinding[] {
  const profile = getRuntimeProfile("codex");

  return GATE_TYPES.map((gateType) => {
    const hook = profile.hooks[gateType];

    return {
      target: "codex",
      gateType,
      nativeEvent: hook.nativeEvent,
      canBlock: hook.canBlock,
      supported: hook.supported,
      command: hook.command,
      ...describeCodexHookBinding(hook.supported, hook.nativeEvent, hook.canBlock),
    };
  });
}

function describeCodexHookBinding(
  supported: boolean,
  nativeEvent: string | null,
  canBlock: boolean,
): Pick<CodexHookBinding, "status" | "reason"> {
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
