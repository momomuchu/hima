// `hima hook <event> [--format claude|hermes|native] [--root <dir>]`
// Reads JSON from stdin, loads .hima/ state via @harness/core, evaluates via
// @hima/gates-core's fixed evaluateGate, then writes the formatted verdict to stdout.

import { readPlanningProject } from "@harness/core";
import { evaluateGate, type GateEvaluationContext } from "@hima/gates-core";
import { readJsonStdin } from "../stdin.js";
import { formatVerdict } from "../format.js";
import type { GateEvent } from "@hima/gates-core";
import type { GateType, HookOutputFormat, Verdict } from "../types.js";
import { GATE_TYPES } from "../types.js";

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

function parseRoot(args: string[], fallback: string): string {
  const idx = args.indexOf("--root");
  if (idx !== -1 && args[idx + 1] !== undefined) return args[idx + 1]!;
  return fallback;
}

function buildGateEvent(gateType: GateType, payload: unknown): GateEvent {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return {
    gateType,
    toolName: typeof p["toolName"] === "string" ? p["toolName"] : undefined,
    toolInput: p["toolInput"],
    toolOutput: p["toolOutput"],
    promptContent: typeof p["promptContent"] === "string" ? p["promptContent"] : undefined,
    metadata:
      p["metadata"] && typeof p["metadata"] === "object" && !Array.isArray(p["metadata"])
        ? (p["metadata"] as Record<string, unknown>)
        : undefined,
  };
}

export async function runHookCommand(args: string[]): Promise<void> {
  const event = args[0];
  if (event === undefined || event === "--help" || event === "-h") {
    process.stdout.write(
      "Usage: hima hook <event> [--format claude|hermes|native] [--root <dir>]\n" +
        `Events: ${GATE_TYPES.join(", ")}\n`,
    );
    return;
  }

  const gateType = parseGateType(event);
  const format = parseFormat(args.slice(1));
  const root = parseRoot(args.slice(1), process.cwd());
  const payload = await readJsonStdin();

  const project = await readPlanningProject(root);

  const context: GateEvaluationContext = {
    projectRoot: root,
    state: project.state,
    currentRisk: project.currentRisk,
    runSet: project.runSet,
  };

  const gateEvent = buildGateEvent(gateType, payload);
  const result = evaluateGate(context, gateEvent);

  const verdict: Verdict = {
    decision: result.decision as Verdict["decision"],
    reason: result.reason,
    contextInjection: result.contextInjection,
  };

  const output = formatVerdict(gateType, verdict, format);
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
