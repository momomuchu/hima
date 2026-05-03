import { GATE_TYPES, type GateType } from "../types/canonical.js";

export const RUNTIME_TARGETS = ["claude", "codex", "hermes"] as const;

export type RuntimeTarget = (typeof RUNTIME_TARGETS)[number];

export interface RuntimeHookProfile {
  gateType: GateType;
  nativeEvent: string | null;
  canBlock: boolean;
  supported: boolean;
  command: `harness hook ${string}`;
}

export interface RuntimeProfile {
  target: RuntimeTarget;
  hooks: Record<GateType, RuntimeHookProfile>;
  featureFlags: Record<string, boolean>;
}

const RUNTIME_NATIVE_EVENTS: Record<
  RuntimeTarget,
  Record<GateType, Pick<RuntimeHookProfile, "nativeEvent" | "canBlock" | "supported">>
> = {
  claude: {
    session_start: { nativeEvent: "SessionStart", canBlock: false, supported: true },
    user_prompt: { nativeEvent: "UserPromptSubmit", canBlock: true, supported: true },
    pre_tool: { nativeEvent: "PreToolUse", canBlock: true, supported: true },
    post_tool: { nativeEvent: "PostToolUse", canBlock: false, supported: true },
    stop: { nativeEvent: "Stop", canBlock: true, supported: true },
    subagent_start: { nativeEvent: "SubagentStart", canBlock: true, supported: true },
    subagent_stop: { nativeEvent: "SubagentStop", canBlock: true, supported: true },
  },
  codex: {
    session_start: { nativeEvent: "SessionStart", canBlock: false, supported: true },
    user_prompt: { nativeEvent: "UserPromptSubmit", canBlock: true, supported: true },
    pre_tool: { nativeEvent: "PreToolUse", canBlock: true, supported: true },
    post_tool: { nativeEvent: "PostToolUse", canBlock: false, supported: true },
    stop: { nativeEvent: "Stop", canBlock: true, supported: true },
    subagent_start: { nativeEvent: null, canBlock: false, supported: false },
    subagent_stop: { nativeEvent: null, canBlock: false, supported: false },
  },
  hermes: {
    session_start: { nativeEvent: "on_session_start", canBlock: false, supported: true },
    user_prompt: { nativeEvent: "pre_llm_call", canBlock: true, supported: true },
    pre_tool: { nativeEvent: "pre_tool_call", canBlock: true, supported: true },
    post_tool: { nativeEvent: "post_tool_call", canBlock: false, supported: true },
    stop: { nativeEvent: "on_session_end", canBlock: false, supported: true },
    subagent_start: { nativeEvent: null, canBlock: false, supported: false },
    subagent_stop: { nativeEvent: "subagent_stop", canBlock: false, supported: true },
  },
};

const HOOK_COMMAND_EVENTS = {
  session_start: "session-start",
  user_prompt: "user-prompt-submit",
  pre_tool: "pre-tool-use",
  post_tool: "post-tool-use",
  stop: "stop",
  subagent_start: "subagent-start",
  subagent_stop: "subagent-stop",
} as const satisfies Record<GateType, string>;

export function isRuntimeTarget(value: string): value is RuntimeTarget {
  return RUNTIME_TARGETS.includes(value as RuntimeTarget);
}

export function getRuntimeProfile(target: RuntimeTarget): RuntimeProfile {
  return {
    target,
    hooks: buildRuntimeHooks(target),
    featureFlags: target === "codex" ? { codex_hooks: true } : {},
  };
}

export function getRuntimeHookProfiles(target: RuntimeTarget): RuntimeHookProfile[] {
  const profile = getRuntimeProfile(target);
  return GATE_TYPES.map((gateType) => profile.hooks[gateType]);
}

export function toHookCommand(gateType: GateType): RuntimeHookProfile["command"] {
  return `harness hook ${HOOK_COMMAND_EVENTS[gateType]}`;
}

function buildRuntimeHooks(target: RuntimeTarget): Record<GateType, RuntimeHookProfile> {
  return Object.fromEntries(
    GATE_TYPES.map((gateType) => [
      gateType,
      {
        gateType,
        ...RUNTIME_NATIVE_EVENTS[target][gateType],
        command: toHookCommand(gateType),
      },
    ]),
  ) as Record<GateType, RuntimeHookProfile>;
}
