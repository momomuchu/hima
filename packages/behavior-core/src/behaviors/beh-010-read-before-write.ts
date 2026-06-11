// Ported from packages/core/src/behaviors/beh-010-read-before-write.ts — no logic changes

import { existsSync, readFileSync } from "node:fs";
import { hashContent } from "../action-signal.js";
import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import { normalizePath } from "../canonical-path.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast, type RiskClass } from "../risk-class.js";

function extractWriteTargetPath(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const input = toolInput as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path", "targetPath", "target_path"]) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0) return normalizePath(val);
  }
  return "";
}

function isWriteMutationTool(toolName: string): boolean {
  const n = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return n === "write" || n === "edit" || n === "multiedit" || n === "createfile";
}

export const readBeforeWrite: BehaviorDescriptor = {
  id: "BEH-010",
  name: "Read-Before-Write",
  gates: ["pre_tool"],

  classify(context: GateEvaluationContext, event: GateEvent): BehaviorVerdict {
    const toolName = event.toolName ?? "";
    if (!isWriteMutationTool(toolName)) return null;

    const targetPath = extractWriteTargetPath(event.toolInput);
    if (targetPath.length === 0) return null;

    try {
      if (!existsSync(targetPath)) return null;
    } catch {
      // conservatively treat as existing
    }

    const readSet = context.sessionReadSet;
    if (!readSet) return null;

    if (readSet.has(targetPath)) {
      const storedHash = context.sessionReadHashMap?.get(targetPath);
      if (storedHash) {
        try {
          const currentContent = readFileSync(targetPath, "utf8");
          const currentHash = hashContent(currentContent);
          if (currentHash !== storedHash) {
            const isBlock = riskAtLeast((context.currentRisk?.risk_class ?? "T") as RiskClass, "M");
            return {
              decision: isBlock ? "block" : "warn",
              reason: `BEH-010: Write to '${targetPath}' rejected — file content changed on disk since the session read (content hash mismatch). Re-read the file to confirm the current state before writing.`,
              violationType: "FORBIDDEN_WRITE_ZONE",
              qualityDimension: "evidence",
            };
          }
        } catch {
          // cannot read for hash comparison — allow
        }
      }
      return null;
    }

    const riskClass = (context.currentRisk?.risk_class ?? "T") as RiskClass;
    const isBlock = riskAtLeast(riskClass, "M");
    return {
      decision: isBlock ? "block" : "warn",
      reason: `BEH-010: Write to '${targetPath}' rejected — path was not read in this session. Read the file first to verify write compatibility.`,
      violationType: "FORBIDDEN_WRITE_ZONE",
      qualityDimension: "evidence",
    };
  },
};
