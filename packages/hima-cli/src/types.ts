// Minimal gate interface — coded against while @hima/gates-core is implemented by w-gates.
// Once gates-core exports dispatch(), import it directly in commands/hook.ts.

export type GateType =
  | "pre_tool"
  | "post_tool"
  | "session_start"
  | "user_prompt"
  | "stop"
  | "subagent_start"
  | "subagent_stop";

export type Decision = "allow" | "block" | "warn";

export type Verdict = {
  decision: Decision;
  reason?: string;
  contextInjection?: string;
};

export type HookOutputFormat = "claude" | "hermes" | "native";

export const GATE_TYPES: GateType[] = [
  "pre_tool",
  "post_tool",
  "session_start",
  "user_prompt",
  "stop",
  "subagent_start",
  "subagent_stop",
];
