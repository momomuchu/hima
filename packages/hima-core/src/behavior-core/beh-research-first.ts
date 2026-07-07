/**
 * BEH_RESEARCH_FIRST — Research-first HARD gate (R-007).
 *
 * At every pre_tool gate for Write/Edit/MultiEdit, if the target file path is
 * spec-class AND the active ward carries the "full" entryPoint, the discovery
 * stage verdict must be sealed (done | done-verified | done-validated) before
 * the write is permitted. All other combinations allow immediately.
 *
 * Spec-class path patterns (any one hit triggers the check):
 *   - *.spec.md        — any file whose name ends in ".spec.md"
 *   - docs/specs/**    — any file rooted under docs/specs/
 *   - docs/decisions/** — any file rooted under docs/decisions/
 *
 * Decision tree:
 *   1. Non-write tool (not Write | Edit | MultiEdit) → allow.
 *   2. Cannot extract target path from toolInput → allow (defensive).
 *   3. Target path is not spec-class → allow.
 *   4. No ward in context → allow (no pipeline; other behaviors cover ward-less runs).
 *   5. Ward entryPoint is "run" or "spec" → allow (research-first is a full-entry
 *      requirement only; run/spec entries open at the spec stage directly).
 *   6. Ward entryPoint is "full":
 *      a. Ward verdicts contain a "discovery" entry whose status is
 *         done | done-verified | done-validated → allow.
 *      b. No such sealed verdict → block RESEARCH_FIRST.
 *
 * violationType: RESEARCH_FIRST
 * gates:         ["pre_tool"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-007,
 *      ENTRYPOINTS-v3.md PART 3 STAGE 1 gate,
 *      ENTRYPOINTS-v3.md §Research-first principle (binding, non-negotiable).
 */

import type { StageVerdict } from "@norm/schemas";
import { canonicalWriteTool, extractApplyPatchTargets, isApplyPatchTool } from "./tool-classify.js";
import type { BehaviorContext, BehaviorDescriptor, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-RESEARCH-FIRST";

/**
 * Discovery stage name as defined by DEV_CYCLE / ENTRYPOINTS-v3.
 * This is the stage that must be sealed before any spec-class write.
 */
const DISCOVERY_STAGE = "discovery";

/**
 * Verdict statuses that indicate the discovery stage has been properly sealed.
 * "partial" and "blocked" are not sufficient — the stage must be fully done.
 */
const SEALED_STATUSES: ReadonlySet<StageVerdict["status"]> = new Set([
  "done",
  "done-verified",
  "done-validated",
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the target file path from an unknown toolInput value.
 * Tries "file_path" first (Write/Edit canonical field), then "path".
 * Returns undefined when neither field is a non-empty string.
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
 * Normalise a file path to forward-slash separators for cross-platform pattern
 * matching. Strips a leading "./" so relative paths match the same patterns as
 * root-relative ones.
 */
function normalisePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Spec-class path patterns (order determines short-circuit evaluation).
 *
 *   *.spec.md        — the filename ends with ".spec.md" (anchored at the last
 *                      path component to avoid matching ".spec.md" as a directory
 *                      prefix on a non-spec sibling).
 *   docs/specs/**    — any file rooted at docs/specs/ with at least one character
 *                      after the slash (prevents matching docs/specs/ itself as a
 *                      bare directory).
 *   docs/decisions/** — same rule for docs/decisions/.
 */
const SPEC_CLASS_PATTERNS: RegExp[] = [
  // *.spec.md — file name (last segment) ends with ".spec.md"
  /(?:^|\/)[^/]+\.spec\.md$/,
  // docs/specs/**
  /(?:^|\/)docs\/specs\/.+/,
  // docs/decisions/**
  /(?:^|\/)docs\/decisions\/.+/,
];

/**
 * Return true when the file path is spec-class (triggers the discovery gate).
 */
export function isSpecClassPath(filePath: string): boolean {
  const normalised = normalisePath(filePath);
  return SPEC_CLASS_PATTERNS.some((re) => re.test(normalised));
}

/**
 * Return true when the ward verdicts contain a discovery stage entry whose
 * status indicates the stage has been sealed (done / done-verified /
 * done-validated).
 */
export function isDiscoverySealed(verdicts: ReadonlyArray<StageVerdict>): boolean {
  return verdicts.some((v) => v.stage === DISCOVERY_STAGE && SEALED_STATUSES.has(v.status));
}

// ---------------------------------------------------------------------------
// BEH_RESEARCH_FIRST descriptor
// ---------------------------------------------------------------------------

export const BEH_RESEARCH_FIRST: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the pre_tool gate.
  gates: ["pre_tool"],

  // Synchronous: all checks operate on in-memory ward state and toolInput
  // content — no filesystem I/O required.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event, ward } = ctx;

    // ── 1. Non-write tool → allow ────────────────────────────────────────────
    const toolName = event.toolName ?? "";
    if (!canonicalWriteTool(toolName)) {
      return {
        decision: "allow",
        reason: "non-write tool — research-first gate not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 2. Extract target path → allow defensively on failure ────────────────
    // Codex's apply_patch has no file_path/path field; its target is parsed
    // from the patch command text (first declared file only — documented
    // scope limit for this gate).
    const targetPath = isApplyPatchTool(toolName)
      ? extractApplyPatchTargets(event.toolInput)[0]
      : extractTargetPath(event.toolInput);
    if (targetPath === undefined) {
      return {
        decision: "allow",
        reason: "could not extract target file path from toolInput — allowing defensively",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 3. Non-spec-class path → allow ───────────────────────────────────────
    if (!isSpecClassPath(targetPath)) {
      return {
        decision: "allow",
        reason: `"${targetPath}" is not a spec-class file — research-first gate not applicable`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 4. No ward in context → allow ────────────────────────────────────────
    // Without a ward there is no pipeline execution context to enforce against.
    // Other behaviors (e.g. BEH-023) separately handle ward-less sessions.
    if (ward == null) {
      return {
        decision: "allow",
        reason: "no active ward — research-first gate not applicable outside a pipeline run",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 5. Non-full entryPoint (run / spec) → allow ──────────────────────────
    // The research-first requirement applies exclusively to "full" entry runs.
    // "run" and "spec" entry-points open directly at the spec stage, so the
    // discovery requirement is intentionally absent for them.
    if (ward.entryPoint !== "full") {
      return {
        decision: "allow",
        reason: `entryPoint "${ward.entryPoint}" — research-first gate applies to "full" entry only`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 6. Full entry — check discovery sealed ───────────────────────────────
    if (isDiscoverySealed(ward.verdicts)) {
      return {
        decision: "allow",
        reason: `discovery stage is sealed — write to "${targetPath}" is permitted`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // Discovery not yet sealed → hard-block.
    return {
      decision: "block",
      reason:
        `[${BEHAVIOR_ID}] stage:discovery verdict required before writing spec files ` +
        `(research-first). Target: "${targetPath}". ` +
        `Seal it via: norm hook stage-advance --stage discovery --status done`,
      behaviorId: BEHAVIOR_ID,
      violationType: "RESEARCH_FIRST",
    };
  },
};
