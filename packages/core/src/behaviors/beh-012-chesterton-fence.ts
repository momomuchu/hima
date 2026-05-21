/**
 * BEH-012 — Chesterton's Fence Delete Guard
 *
 * No file or code block should be deleted unless the deleting agent can articulate
 * why it exists. Irreversible deletions of code whose purpose is unknown are a
 * recurring source of regressions.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-012
 * Gate: pre_tool
 * Risk floor: M (warn below, block at/above)
 *
 * Signal channels used:
 *   - tool_type  : toolName is "Bash" (rm/unlink/rimraf/del) or "Write" (truncation)
 *   - tool_args  : toolInput.command text for Bash; toolInput.content for Write
 *   - file_diff  : first 50 lines of the deletion target read from disk
 *
 * NEVER reads event.toolOutput or event.promptContent as raw text.
 */

import { existsSync, readFileSync } from "node:fs";
import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Lines to read from the deletion target for rationale detection. */
const RATIONALE_SCAN_LINES = 50;

/**
 * Patterns that indicate a deletion command in a Bash tool call.
 * Matched against the command string (tool argument, not output text).
 */
const DELETION_COMMAND_PATTERN = /\b(?:rm|unlink|rimraf|del|rmdir|remove-item)\b/i;

/**
 * Rationale markers: a comment line containing one of these tokens signals
 * that the author is aware of the file's purpose.
 */
const RATIONALE_MARKER_PATTERN = /\b(?:why|rationale|purpose|NOTE|FIXME|TODO)\b/i;

/** Comment-start tokens: //, /*, #, <!-- */
const COMMENT_START_PATTERN = /\/\/|\/\*|#|<!--/;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes a file path to a consistent form.
 */
function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/([a-z])\//i, "$1:/")
    .replace(/^\.\/+/, "")
    .toLowerCase();
}

/**
 * Extracts the target file path from a Bash command string.
 * We look for the first quoted or unquoted path-like argument after the command.
 * This is a best-effort extraction from the tool argument; it does not parse shell syntax.
 */
function extractBashDeletionTarget(command: string): string {
  // Strip the command word (rm, unlink, etc.) and options, then take the first path token.
  const withoutCommand = command
    .replace(DELETION_COMMAND_PATTERN, "")
    .replace(/-[a-z]+/gi, "") // strip flags like -rf
    .trim();

  // Check for a quoted path first
  const quoted = withoutCommand.match(/["']([^"']+)["']/);
  if (quoted) {
    // biome-ignore lint/style/noNonNullAssertion: quoted[1] is defined — capture group 1 matched
    return normalizePath(quoted[1]!);
  }

  // Take the first whitespace-separated token that looks like a path
  const tokens = withoutCommand.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token.includes("/") || token.includes("\\") || token.includes(".")) {
      return normalizePath(token);
    }
  }
  return "";
}

/**
 * Returns true when the Write toolInput represents a truncation-as-deletion:
 * the content field is empty or absent (or an all-whitespace string).
 */
function isTruncationWrite(toolInput: unknown): boolean {
  if (!toolInput || typeof toolInput !== "object") {
    return false;
  }
  const input = toolInput as Record<string, unknown>;
  if (typeof input.content !== "string") {
    return false; // no content field — not a truncation Write
  }
  return input.content.trim().length === 0;
}

/**
 * Extracts the target path from a Write toolInput.
 */
function extractWritePath(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const input = toolInput as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path"]) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0) {
      return normalizePath(val);
    }
  }
  return "";
}

/**
 * Reads the first N lines of a file and checks whether any line is a comment
 * containing a recognized rationale marker.
 *
 * Operates on file bytes read from disk — not on output text.
 */
function fileHasRationaleComment(filePath: string): boolean {
  try {
    const raw = readFileSync(filePath, { encoding: "utf8" });
    const lines = raw.split(/\r?\n/).slice(0, RATIONALE_SCAN_LINES);
    for (const line of lines) {
      if (COMMENT_START_PATTERN.test(line) && RATIONALE_MARKER_PATTERN.test(line)) {
        return true;
      }
    }
    return false;
  } catch {
    // If the file cannot be read, we cannot determine rationale — treat as absent.
    return false;
  }
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const chestertonFence: BehaviorDescriptor = {
  id: "BEH-012",
  name: "Chesterton's Fence Delete Guard",
  gates: ["pre_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const toolName = event.toolName ?? "";
    const toolNameLower = toolName.toLowerCase();
    let targetPath = "";

    // Signal: tool_type + tool_args — detect deletion intent
    if (toolNameLower === "bash" || toolNameLower === "shell" || toolNameLower === "pwsh") {
      // Signal: tool_args — read command text from toolInput (not output)
      const input = event.toolInput as Record<string, unknown> | null | undefined;
      const command = typeof input?.command === "string" ? input.command : "";
      if (!DELETION_COMMAND_PATTERN.test(command)) {
        return null; // Not a deletion command
      }
      targetPath = extractBashDeletionTarget(command);
    } else if (toolNameLower === "write" || toolNameLower === "createfile") {
      // Signal: tool_args — Write with empty content = truncation-as-deletion
      if (!isTruncationWrite(event.toolInput)) {
        return null;
      }
      targetPath = extractWritePath(event.toolInput);
    } else {
      return null;
    }

    if (targetPath.length === 0) {
      // No extractable target — abstain
      return null;
    }

    // Only relevant for files that actually exist on disk
    if (!existsSync(targetPath)) {
      return null;
    }

    // Signal: file_diff — read first 50 lines of the target to check for rationale
    const hasRationale = fileHasRationaleComment(targetPath);
    if (hasRationale) {
      return null; // Rationale comment found — the purpose is understood
    }

    // Risk floor: M → warn below M, block at M and above
    const riskClass = context.currentRisk?.risk_class ?? "T";
    const isBlock = riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "M");

    return {
      decision: isBlock ? "block" : "warn",
      reason: `BEH-012: Deletion of '${targetPath}' blocked — no rationale comment (why/rationale/purpose/NOTE/FIXME/TODO) found in the first ${RATIONALE_SCAN_LINES} lines. Add a comment explaining why this file can safely be removed before deleting it.`,
      violationType: "PRE_BUILD_DISCIPLINE",
      qualityDimension: "evidence",
    };
  },
};
