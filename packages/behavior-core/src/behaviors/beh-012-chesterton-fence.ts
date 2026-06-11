// Ported from packages/core/src/behaviors/beh-012-chesterton-fence.ts — no logic changes

import { existsSync, readFileSync } from "node:fs";
import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast, type RiskClass } from "../risk-class.js";

const RATIONALE_SCAN_LINES = 50;
const DELETION_COMMAND_PATTERN = /\b(?:rm|unlink|rimraf|del|rmdir|remove-item)\b/i;
const RATIONALE_MARKER_PATTERN = /\b(?:why|rationale|purpose|NOTE|FIXME|TODO)\b/i;
const COMMENT_START_PATTERN = /\/\/|\/\*|#|<!--/;

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/([a-z])\//i, "$1:/").replace(/^\.\/+/, "").toLowerCase();
}

function extractBashDeletionTarget(command: string): string {
  const withoutCommand = command.replace(DELETION_COMMAND_PATTERN, "").replace(/-[a-z]+/gi, "").trim();
  const quoted = withoutCommand.match(/["']([^"']+)["']/);
  if (quoted) return normalizePath(quoted[1]!);
  const tokens = withoutCommand.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.includes("/") || token.includes("\\") || token.includes(".")) return normalizePath(token);
  }
  return "";
}

function isTruncationWrite(toolInput: unknown): boolean {
  if (!toolInput || typeof toolInput !== "object") return false;
  const input = toolInput as Record<string, unknown>;
  if (typeof input.content !== "string") return false;
  return input.content.trim().length === 0;
}

function extractWritePath(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const input = toolInput as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path"]) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0) return normalizePath(val);
  }
  return "";
}

function fileHasRationaleComment(filePath: string): boolean {
  try {
    const raw = readFileSync(filePath, { encoding: "utf8" });
    const lines = raw.split(/\r?\n/).slice(0, RATIONALE_SCAN_LINES);
    for (const line of lines) {
      if (COMMENT_START_PATTERN.test(line) && RATIONALE_MARKER_PATTERN.test(line)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const chestertonFence: BehaviorDescriptor = {
  id: "BEH-012",
  name: "Chesterton's Fence Delete Guard",
  gates: ["pre_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const toolName = event.toolName ?? "";
    const toolNameLower = toolName.toLowerCase();
    let targetPath = "";

    if (toolNameLower === "bash" || toolNameLower === "shell" || toolNameLower === "pwsh") {
      const input = event.toolInput as Record<string, unknown> | null | undefined;
      const command = typeof input?.command === "string" ? input.command : "";
      if (!DELETION_COMMAND_PATTERN.test(command)) return null;
      targetPath = extractBashDeletionTarget(command);
    } else if (toolNameLower === "write" || toolNameLower === "createfile") {
      if (!isTruncationWrite(event.toolInput)) return null;
      targetPath = extractWritePath(event.toolInput);
    } else {
      return null;
    }

    if (targetPath.length === 0) return null;
    if (!existsSync(targetPath)) return null;
    if (fileHasRationaleComment(targetPath)) return null;

    const riskClass = (context.currentRisk?.risk_class ?? "T") as RiskClass;
    const isBlock = riskAtLeast(riskClass, "M");
    return {
      decision: isBlock ? "block" : "warn",
      reason: `BEH-012: Deletion of '${targetPath}' blocked — no rationale comment (why/rationale/purpose/NOTE/FIXME/TODO) found in the first ${RATIONALE_SCAN_LINES} lines. Add a comment explaining why this file can safely be removed before deleting it.`,
      violationType: "PRE_BUILD_DISCIPLINE",
      qualityDimension: "evidence",
    };
  },
};
