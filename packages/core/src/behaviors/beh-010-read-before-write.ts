/**
 * BEH-010 — Read-Before-Write
 *
 * An agent must not write to a file path it has not read in the current session.
 * Writing to an unread file creates silent state corruption.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-010
 * Gate: pre_tool
 * Risk floor: M (warn below, block at/above)
 *
 * Signal channels used:
 *   - tool_type  : toolName is "Write" or "Edit"
 *   - tool_args  : toolInput.file_path / toolInput.filePath (target path)
 *   - evidence_state : context.sessionReadSet (paths read this session)
 *
 * NEVER reads event.toolOutput or event.promptContent as raw text.
 */

import { existsSync, readFileSync } from "node:fs";
import { hashContent } from "../gates/action-signal.js";
import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import { normalizePath } from "../gates/canonical-path.js";
import type { GateEvaluationContext } from "../gates/evaluate-gate.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the target file path from a Write or Edit toolInput.
 * Returns empty string when no path is found.
 */
function extractWriteTargetPath(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") {
    return "";
  }
  const input = toolInput as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path", "targetPath", "target_path"]) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0) {
      return normalizePath(val);
    }
  }
  return "";
}

/** Returns true when toolName signals a file-mutation operation. */
function isWriteMutationTool(toolName: string): boolean {
  const n = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return n === "write" || n === "edit" || n === "multiedit" || n === "createfile";
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const readBeforeWrite: BehaviorDescriptor = {
  id: "BEH-010",
  name: "Read-Before-Write",
  gates: ["pre_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    // Signal: tool_type — only fires on Write/Edit
    const toolName = event.toolName ?? "";
    if (!isWriteMutationTool(toolName)) {
      return null;
    }

    // Signal: tool_args — extract target path
    const targetPath = extractWriteTargetPath(event.toolInput);
    if (targetPath.length === 0) {
      // No extractable path — cannot enforce; abstain
      return null;
    }

    // Exception: new-file creation (path does not exist on disk) is allowed without a prior read.
    // We check existsSync here; this is a file-system probe on the argument, not output text.
    try {
      if (!existsSync(targetPath)) {
        return null;
      }
    } catch {
      // If we cannot stat the path (e.g. path too long, permission error), conservatively
      // treat it as existing so the read-set check still applies.
    }

    // Signal: evidence_state — sessionReadSet populated by post_tool on each Read call
    const readSet = context.sessionReadSet;
    if (!readSet) {
      // sessionReadSet not yet wired by the integration layer — abstain rather than
      // false-block. Integration agent must populate this field (documented in trace).
      return null;
    }

    if (readSet.has(targetPath)) {
      // Path was read this session. H1 fix: also verify content hash to detect
      // cases where the file changed on disk after the session read (forgeable
      // read-set: an agent could fake a readPath without the content changing).
      const storedHash = context.sessionReadHashMap?.get(targetPath);
      if (storedHash) {
        // Read the current on-disk content and hash it for comparison.
        // This is a synchronous fs read in the gate path — acceptable given gate frequency.
        try {
          const currentContent = readFileSync(targetPath, "utf8");
          const currentHash = hashContent(currentContent);
          if (currentHash !== storedHash) {
            const riskClassH1 = context.currentRisk?.risk_class ?? "T";
            const isBlockH1 = riskAtLeast(
              riskClassH1 as import("../types/canonical.js").RiskClass,
              "M",
            );
            return {
              decision: isBlockH1 ? "block" : "warn",
              reason: `BEH-010: Write to '${targetPath}' rejected — file content changed on disk since the session read (content hash mismatch). Re-read the file to confirm the current state before writing.`,
              violationType: "FORBIDDEN_WRITE_ZONE",
              qualityDimension: "evidence",
            };
          }
        } catch {
          // Cannot read file for hash comparison — conservatively allow to avoid
          // false-blocking (e.g. permission error, race condition). The path IS
          // in the read set so the basic read-before-write check passed.
        }
      }
      // Path was read this session and content hash is consistent (or unavailable) — no violation
      return null;
    }

    // Risk floor: M → warn below M, block at M and above
    const riskClass = context.currentRisk?.risk_class ?? "T";
    const isBlock = riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "M");

    return {
      decision: isBlock ? "block" : "warn",
      reason: `BEH-010: Write to '${targetPath}' rejected — path was not read in this session. Read the file first to verify write compatibility.`,
      violationType: "FORBIDDEN_WRITE_ZONE",
      qualityDimension: "evidence",
    };
  },
};
