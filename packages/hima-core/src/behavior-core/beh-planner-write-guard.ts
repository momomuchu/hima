/**
 * BEH_PLANNER_WRITE_GUARD — Planner-role implementation write guard (R-020 part 2).
 *
 * At every pre_tool gate, when the active ward is open in a planner stage
 * (discovery / analysis / spec) and the tool is a write operation
 * (Write | Edit | MultiEdit), this behavior blocks writes to implementation
 * files. Only .md files and paths inside .hima/plans/ or .hima/drafts/ are
 * permitted.
 *
 * Decision tree:
 *   1. No ward in context (ward is null / undefined) → allow.
 *   2. ward.openStage is NOT in PLANNER_STAGES → allow (executor or reviewer
 *      stage; constraint does not apply).
 *   3. toolName is not a write tool (Write | Edit | MultiEdit) → allow.
 *   4. Cannot extract target path from event.toolInput → allow (defensive;
 *      the gate never silently breaks writes with unexpected toolInput shape).
 *   5. Target path has a .md extension → allow.
 *   6. Target path is under <root>/.hima/plans/** → allow.
 *   7. Target path is under <root>/.hima/drafts/** → allow.
 *   8. None of the above → block PLANNER_WRITE_GUARD.
 *
 * toolInput shape (defensive narrowing — toolInput is unknown):
 *   Write:     { file_path: string; content?: string; ... }
 *   Edit:      { file_path: string; old_string?: string; new_string?: string; ... }
 *   MultiEdit: { file_path?: string; path?: string; ... }
 *
 * Remediation message instructs the agent to advance the stage via:
 *   hima hook stage-advance --stage spec --status done
 *
 * violationType: PLANNER_WRITE_GUARD
 * gates:         ["pre_tool"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-020,
 *      SPEC-004-profiles.md [CRITICAL][BLOCKS:critical] planner profile,
 *      ENTRYPOINTS-v3.md PART 6 role write-guards table.
 */

import path from "node:path";
import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";
import { PLANNER_STAGES, roleForStage } from "../prompts-core/role-for-stage.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-PLANNER-WRITE-GUARD";

/** Tool names that constitute a write operation on disk. */
const WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the target file path from an unknown toolInput value.
 *
 * Tries "file_path" first (Write/Edit canonical field), then "path"
 * (MultiEdit fallback). Returns undefined when neither is a non-empty string.
 *
 * Deliberately not imported from beh-read-before-write to avoid coupling
 * sibling behavior modules.
 */
function extractTargetPath(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) return undefined;
  const ti = toolInput as Record<string, unknown>;
  const candidate = ti["file_path"] ?? ti["path"];
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }
  return undefined;
}

/**
 * Return true when the resolved absolute path is inside a given directory
 * (i.e. it equals the directory or starts with "directory + path separator").
 *
 * Using startsWith on an OS-normalised absolute path is safe here because
 * path.resolve always produces a canonical absolute path without trailing
 * separators, and we append path.sep as a guard against partial-name matches
 * (e.g. ".hima/plans-extra" must NOT match ".hima/plans").
 */
function isUnderDir(absPath: string, absDir: string): boolean {
  return absPath === absDir || absPath.startsWith(absDir + path.sep);
}

// ---------------------------------------------------------------------------
// BEH_PLANNER_WRITE_GUARD descriptor
// ---------------------------------------------------------------------------

export const BEH_PLANNER_WRITE_GUARD: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the pre_tool gate.
  gates: ["pre_tool"],

  // Synchronous: all checks operate on in-memory ward state and path strings;
  // no filesystem I/O required.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event, root, ward } = ctx;

    // ── 1. No ward → allow ───────────────────────────────────────────────────
    // Without a ward there is no stage context; the guard cannot apply.
    if (ward === undefined || ward === null) {
      return {
        decision: "allow",
        reason: "no ward in context — planner write-guard not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 2. Not a planner stage → allow ───────────────────────────────────────
    // The constraint applies only when the planner role is active.
    const { openStage } = ward;
    if (!PLANNER_STAGES.has(openStage)) {
      return {
        decision: "allow",
        reason: `stage "${openStage}" is not a planner stage — planner write-guard not applicable`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 3. Non-write tool → allow ─────────────────────────────────────────────
    const toolName = event.toolName ?? "";
    if (!WRITE_TOOL_NAMES.has(toolName)) {
      return {
        decision: "allow",
        reason: "non-write tool — planner write-guard not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 4. Extract target path ────────────────────────────────────────────────
    const rawPath = extractTargetPath(event.toolInput);
    if (rawPath === undefined) {
      // Cannot determine target — allow defensively to avoid silently breaking
      // writes whose toolInput shape is unexpected.
      return {
        decision: "allow",
        reason: "could not extract target file path from toolInput — allowing defensively",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // Resolve to an absolute path so directory prefix checks are unambiguous.
    const absPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(root, rawPath);

    // ── 5. .md extension → allow ──────────────────────────────────────────────
    if (path.extname(absPath) === ".md") {
      return {
        decision: "allow",
        reason: `"${rawPath}" is a .md file — planner may write markdown`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 6. Under .hima/plans/ → allow ────────────────────────────────────────
    const plansDir = path.resolve(root, ".hima", "plans");
    if (isUnderDir(absPath, plansDir)) {
      return {
        decision: "allow",
        reason: `"${rawPath}" is inside .hima/plans/ — planner may write there`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 7. Under .hima/drafts/ → allow ───────────────────────────────────────
    const draftsDir = path.resolve(root, ".hima", "drafts");
    if (isUnderDir(absPath, draftsDir)) {
      return {
        decision: "allow",
        reason: `"${rawPath}" is inside .hima/drafts/ — planner may write there`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 8. Planner stage + write to implementation file → block ───────────────
    // Use roleForStage() to produce a human-readable role label in the message.
    const role = roleForStage(openStage) ?? "planner";
    return {
      decision: "block",
      reason:
        `[${BEHAVIOR_ID}] BLOCKED — the ${role} role (stage "${openStage}") may write ONLY .md plans ` +
        `(.hima/plans/**), not implementation files. To unblock: (1) write the plan to ` +
        `.hima/plans/<name>.md, then (2) run \`hima advance\` after each step to walk the cycle ` +
        `discovery → analysis → spec → design → impl (each 'hima advance' seals the current stage ` +
        `and moves to the next; add --evidence "<what you did>" to record proof). Code writes are ` +
        `allowed once the open stage reaches "impl"; you stay blocked at "${openStage}" until you advance.`,
      behaviorId: BEHAVIOR_ID,
      violationType: "PLANNER_WRITE_GUARD",
    };
  },
};
