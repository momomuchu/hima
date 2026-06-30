/**
 * BEH_READ_BEFORE_WRITE — read-before-write session gate.
 *
 * At every pre_tool gate for Write/Edit/MultiEdit at M+ risk class:
 *   1. Extract the target file path from event.toolInput.
 *   2. If the file does not yet exist on disk → allow (new-file allowance).
 *   3. Look up the per-session read-set via readReadSet() (from read-set.ts),
 *      keyed by the ward id (or "unknown" when no ward is active).
 *   4. If the target is NOT in the read-set → block with READ_BEFORE_WRITE.
 *
 * Enforcement floor: M and above (T/L are allowed unconditionally).
 * Non-write tools: always allow.
 *
 * The read-set is maintained by the companion recordRead() helper in
 * read-set.ts, typically called from a PostToolUse Read/ReadFile handler (R-003).
 * This behavior only reads the set; it never writes to it.
 *
 * toolInput shape (defensive narrowing — toolInput is unknown):
 *   Write/Edit:    { file_path: string; content?: string; new_string?: string; ... }
 *   MultiEdit:     { file_path?: string; path?: string; ... }
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-003,
 *      BEHAVIOR-CATALOG-v3.md §2 P-01,
 *      ARCHITECTURE-v3.md §3.4.
 */

import { access } from "node:fs/promises";
import path from "node:path";
import { RISK_ORDER } from "@hima/schemas";
import type { RiskClass } from "@hima/schemas";
import { readReadSet, isInReadSet } from "../read-set.js";
import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-READ-BEFORE-WRITE";

/** Tool names that constitute a write operation. */
const WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

/**
 * Minimum numeric risk level at which enforcement is active (M and above).
 * noUncheckedIndexedAccess makes the lookup `number | undefined`; the value is
 * always present by construction (RISK_ORDER covers all RiskClass literals).
 */
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const BLOCK_FLOOR: number = RISK_ORDER["M"]!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safe RISK_ORDER lookup. */
function riskOrder(rc: RiskClass): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return RISK_ORDER[rc]!;
}

/**
 * Extract the target file path from an unknown toolInput value.
 * Tries "file_path" first (Write/Edit canonical field), then "path".
 * Returns undefined when neither is a non-empty string.
 */
export function extractTargetPath(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) return undefined;
  const ti = toolInput as Record<string, unknown>;
  const candidate = ti["file_path"] ?? ti["path"];
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }
  return undefined;
}

/**
 * Return true if the given file path exists on disk.
 * Uses access() — cheaper than stat() for a mere existence check.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// BEH_READ_BEFORE_WRITE descriptor
// ---------------------------------------------------------------------------

export const BEH_READ_BEFORE_WRITE: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the pre_tool gate.
  gates: ["pre_tool"],

  async evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
    const { event, riskClass, root, ward } = ctx;

    // ── Non-write tool: allow ────────────────────────────────────────────────
    const toolName = event.toolName ?? "";
    if (!WRITE_TOOL_NAMES.has(toolName)) {
      return {
        decision: "allow",
        reason: "non-write tool — read-before-write not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Below enforcement floor (T or L): allow ──────────────────────────────
    if (riskOrder(riskClass) < BLOCK_FLOOR) {
      return {
        decision: "allow",
        reason: `risk class ${riskClass} is below M — read-before-write not enforced`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Extract target path ──────────────────────────────────────────────────
    const rawPath = extractTargetPath(event.toolInput);
    if (rawPath === undefined) {
      // Cannot determine target path from toolInput — allow defensively so the
      // gate never silently breaks writes whose toolInput shape is unexpected.
      return {
        decision: "allow",
        reason: "could not extract target file path from toolInput — allowing defensively",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // Resolve to an absolute path (toolInput may be relative to the project root).
    const absPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(root, rawPath);

    // ── New-file allowance ────────────────────────────────────────────────────
    // A file that does not yet exist cannot have been read; blocking would be a
    // false positive. Allow unconditionally.
    const exists = await fileExists(absPath);
    if (!exists) {
      return {
        decision: "allow",
        reason: `"${rawPath}" does not exist yet — new-file write is permitted without a prior read`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Read-set check ───────────────────────────────────────────────────────
    // Prefer ctx.sessionId (set by the adapter/router) for the read-set key;
    // fall back to ward?.id, then "unknown" (R-003: key must match what the
    // PostToolUse Read handler recorded via recordRead(root, sessionId, file)).
    const sessionKey = ctx.sessionId ?? ward?.id ?? "unknown";
    const readSet = await readReadSet(root, sessionKey);

    // isInReadSet resolves filePath via path.resolve for comparison.
    if (isInReadSet(readSet, absPath)) {
      return {
        decision: "allow",
        reason: `"${rawPath}" is in the session read-set — write permitted`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // File exists on disk but was not read in this session → block.
    return {
      decision: "block",
      reason:
        `[${BEHAVIOR_ID}] Read "${rawPath}" before writing — M+ risk requires read-first. ` +
        `Use the Read tool on this file before attempting a write operation.`,
      behaviorId: BEHAVIOR_ID,
      violationType: "READ_BEFORE_WRITE",
    };
  },
};
