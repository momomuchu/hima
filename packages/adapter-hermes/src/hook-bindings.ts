import { GATE_TYPES, type GateType, getRuntimeProfile } from "@harness/core";

export type HermesHookBindingStatus = "supported" | "degraded" | "unsupported";

export interface HermesHookBinding {
  target: "hermes";
  gateType: GateType;
  nativeEvent: string | null;
  canBlock: boolean;
  supported: boolean;
  command: string;
  status: HermesHookBindingStatus;
  reason: string;
}

export function getHermesHookBindings(): HermesHookBinding[] {
  const profile = getRuntimeProfile("hermes");

  return GATE_TYPES.map((gateType) => {
    const hook = profile.hooks[gateType];

    return {
      target: "hermes",
      gateType,
      nativeEvent: hook.nativeEvent,
      canBlock: hook.canBlock,
      supported: hook.supported,
      command: hook.command,
      ...describeHermesHookBinding(hook.supported, hook.nativeEvent, hook.canBlock),
    };
  });
}

function describeHermesHookBinding(
  supported: boolean,
  nativeEvent: string | null,
  canBlock: boolean,
): Pick<HermesHookBinding, "status" | "reason"> {
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
