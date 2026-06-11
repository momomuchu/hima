// `hima hook <event> [--format claude|hermes|native]`
// Reads JSON from stdin, calls gates dispatch, writes formatted verdict to stdout.
//
// gates-core dependency: when @hima/gates-core is ready (task #3), replace the
// stub import below with: import { dispatch } from "@hima/gates-core";

import { readJsonStdin } from "../stdin.js";
import { formatVerdict } from "../format.js";
import type { GateType, HookOutputFormat, Verdict } from "../types.js";
import { GATE_TYPES } from "../types.js";

// Stub until @hima/gates-core implements dispatch — always allows, no side effects.
async function dispatch(_gateType: GateType, _payload: unknown): Promise<Verdict> {
  return { decision: "allow" };
}

const NATIVE_EVENT_MAP: Record<string, GateType> = {
  pretooluse: "pre_tool",
  pre_tool: "pre_tool",
  posttooluse: "post_tool",
  post_tool: "post_tool",
  sessionstart: "session_start",
  session_start: "session_start",
  userpromptsubmit: "user_prompt",
  user_prompt: "user_prompt",
  stop: "stop",
  subagentstart: "subagent_start",
  subagent_start: "subagent_start",
  subagentstopped: "subagent_stop",
  subagent_stop: "subagent_stop",
};

function parseGateType(event: string): GateType {
  const key = event.toLowerCase().replaceAll("-", "_").replaceAll("_", "");
  const byKey = NATIVE_EVENT_MAP[key];
  if (byKey !== undefined) return byKey;
  const byRaw = NATIVE_EVENT_MAP[event.toLowerCase()];
  if (byRaw !== undefined) return byRaw;
  if (GATE_TYPES.includes(event as GateType)) return event as GateType;
  throw new Error(`Unknown hook event: ${event}. Valid events: ${GATE_TYPES.join(", ")}`);
}

function parseFormat(args: string[]): HookOutputFormat {
  const idx = args.indexOf("--format");
  if (idx === -1) return "native";
  const val = args[idx + 1];
  if (val === "claude" || val === "hermes" || val === "native") return val;
  return "native";
}

export async function runHookCommand(args: string[]): Promise<void> {
  const event = args[0];
  if (event === undefined || event === "--help" || event === "-h") {
    process.stdout.write(
      "Usage: hima hook <event> [--format claude|hermes|native]\n" +
        `Events: ${GATE_TYPES.join(", ")}\n`,
    );
    return;
  }

  const gateType = parseGateType(event);
  const format = parseFormat(args.slice(1));
  const payload = await readJsonStdin();
  const verdict = await dispatch(gateType, payload);
  const output = formatVerdict(gateType, verdict, format);
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
