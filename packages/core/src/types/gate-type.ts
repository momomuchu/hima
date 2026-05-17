export const GATE_TYPES = Object.freeze([
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
]) as readonly [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
];

export type GateType = (typeof GATE_TYPES)[number];

export function isGateType(value: unknown): value is GateType {
  return typeof value === "string" && GATE_TYPES.includes(value as GateType);
}

export function parseGateType(value: unknown): GateType {
  if (!isGateType(value)) {
    throw new TypeError(`Invalid GateType: ${String(value)}`);
  }

  return value;
}

export function assertGateType(value: unknown): asserts value is GateType {
  parseGateType(value);
}
