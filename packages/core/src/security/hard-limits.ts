import type { GateEvent } from "../schemas/gate-event.schema.js";
import type { RunSetFile, SubagentRunRecord } from "../schemas/run-set.schema.js";

export type HardLimitStatus = "allow" | "requires_approval" | "block";

export interface HardLimitVerdict {
  status: HardLimitStatus;
  reason: string;
  violationType?: "BLOCKED_COMMAND_PATTERN" | "SUBAGENT_SPAWN_LIMIT";
  evidenceAnchors: string[];
}

const HARD_LIMIT_EVIDENCE_ANCHOR =
  "docs/excellence-application/05-architecture/stream-d-hard-limits-policy-sketch.md#2-candidate-boundary";

const MAX_ACTIVE_SUBAGENTS = 15;

const REMOTE_SCRIPT_PIPE_PATTERNS = [
  /\b(?:curl|wget)\b[\s\S]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)\b/i,
  /\b(?:iwr|irm|invoke-webrequest|invoke-restmethod)\b[\s\S]*\|\s*(?:iex|invoke-expression)\b/i,
];

export function evaluateHardLimits(event: GateEvent, runSet?: RunSetFile): HardLimitVerdict {
  if (event.gateType === "subagent_start") {
    return evaluateSubagentSpawnLimit(event, runSet);
  }

  if (event.gateType !== "pre_tool") {
    return allow("hard limits only evaluate selected pre_tool boundaries");
  }

  const command = readCommandText(event);

  if (command.length === 0) {
    return allow("pre_tool hard limits found no shell command payload");
  }

  if (REMOTE_SCRIPT_PIPE_PATTERNS.some((pattern) => pattern.test(command))) {
    return {
      status: "block",
      reason: "blocked command pattern: remote script pipe execution is a D-H7 hard limit",
      violationType: "BLOCKED_COMMAND_PATTERN",
      evidenceAnchors: [HARD_LIMIT_EVIDENCE_ANCHOR],
    };
  }

  return allow("pre_tool hard limits found no blocked command pattern");
}

function evaluateSubagentSpawnLimit(event: GateEvent, runSet?: RunSetFile): HardLimitVerdict {
  const agentId = readStringMetadata(event, "agentId");

  if (agentId.length === 0 || !runSet) {
    return allow("subagent spawn hard limit found no launch record context");
  }

  const activeSubagents = runSet.subagents.filter(isActiveSubagent);
  const existingActiveAgent = activeSubagents.some((subagent) => subagent.agentId === agentId);

  if (!existingActiveAgent && activeSubagents.length >= MAX_ACTIVE_SUBAGENTS) {
    return {
      status: "block",
      reason: `subagent_start would exceed ${MAX_ACTIVE_SUBAGENTS} active subagents`,
      violationType: "SUBAGENT_SPAWN_LIMIT",
      evidenceAnchors: [HARD_LIMIT_EVIDENCE_ANCHOR],
    };
  }

  return allow("subagent spawn hard limit found available capacity");
}

function isActiveSubagent(subagent: SubagentRunRecord): boolean {
  return !["completed", "failed", "blocked", "cancelled"].includes(subagent.status ?? "requested");
}

function allow(reason: string): HardLimitVerdict {
  return {
    status: "allow",
    reason,
    evidenceAnchors: [HARD_LIMIT_EVIDENCE_ANCHOR],
  };
}

function readCommandText(event: GateEvent): string {
  const input = event.toolInput;

  if (typeof input === "string") {
    return input;
  }

  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    const scalar = [record.command, record.cmd, record.script].find(
      (value): value is string => typeof value === "string",
    );

    if (scalar !== undefined) {
      return scalar;
    }

    if (Array.isArray(record.args)) {
      return record.args.filter((value): value is string => typeof value === "string").join(" ");
    }
  }

  const metadataCommand = event.metadata?.command;
  return typeof metadataCommand === "string" ? metadataCommand : "";
}

function readStringMetadata(event: GateEvent, key: string): string {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : "";
}
