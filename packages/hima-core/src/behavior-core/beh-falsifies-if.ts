/**
 * BEH_FALSIFIES_IF — Falsifies-If block gate on claim-bearing files.
 *
 * At every pre_tool gate for Write/Edit/MultiEdit, if the target file path is
 * claim-bearing AND the written content does not contain a "Falsifies-If:"
 * block → hard-block with violationType MISSING_FALSIFIES_IF.
 *
 * Fires at ALL risk floors (criticality-independent). This is an always-on
 * safety invariant per CLAUDE.md and ARCHITECTURE-FLOW-v3.md §4.
 *
 * Claim-bearing files are those whose path matches:
 *   - docs/business-model/** EXCEPT files starting with "research-" or
 *     "verification-" (research and verification artifacts are exempt).
 *   - docs/decisions/**
 * OR whose written content frontmatter declares `claim-bearing: true`.
 *
 * "Falsifies-If:" must appear as a line prefix in the content (any case
 * after "Falsifies-If", any whitespace before the colon is not accepted —
 * the canonical form uses no space before the colon).
 *
 * toolInput shape (defensive narrowing — toolInput is unknown):
 *   Write:     { file_path: string; content: string; ... }
 *   Edit:      { file_path: string; new_string: string; ... }
 *   MultiEdit: { file_path?: string; path?: string; ... }
 *
 * Non-claim-bearing files: always allow.
 * Non-write tools: always allow.
 * Missing path or content in toolInput: allow defensively.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-004,
 *      BEHAVIOR-CATALOG-v3.md §2 P-14,
 *      ARCHITECTURE-v3.md §3 S3 scenario,
 *      ENTRYPOINTS-v3.md PART 3 STAGE 3 gate,
 *      CLAUDE.md claim-bearing rule.
 */

import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-FALSIFIES-IF";

/** Tool names that constitute a write operation. */
const WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

/**
 * Regex patterns that make a normalized file path claim-bearing.
 * Path separators are normalised to "/" before matching.
 *
 * docs/business-model/** EXCEPT research-* and verification-*:
 *   Any path segment rooted at docs/business-model/ that is NOT immediately
 *   followed by "research-" or "verification-".
 *
 * docs/decisions/**:
 *   Any file under the decisions directory.
 */
const CLAIM_BEARING_PATH_PATTERNS: RegExp[] = [
  // docs/business-model/**, excluding research-* and verification-* children
  /(?:^|[/])docs\/business-model\/(?!research-|verification-)[\w\-.]/,
  // docs/decisions/**
  /(?:^|[/])docs\/decisions\/[\w\-.]/,
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a path for pattern matching: replace backslashes, strip leading
 * "./" and any absolute prefix so patterns match regardless of OS or how the
 * agent expresses the path.
 */
function normalisePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Return true when the normalised file path matches a claim-bearing pattern.
 */
export function isClaimBearingPath(filePath: string): boolean {
  const normalised = normalisePath(filePath);
  return CLAIM_BEARING_PATH_PATTERNS.some((re) => re.test(normalised));
}

/**
 * Return true when the content's YAML frontmatter explicitly declares
 * `claim-bearing: true`. Scans only the first 2000 characters to remain cheap.
 */
export function hasClaimBearingFrontmatter(content: string): boolean {
  const head = content.slice(0, 2000);
  // Must appear as a top-level frontmatter key: "claim-bearing: true"
  return /^claim-bearing\s*:\s*true\s*$/m.test(head);
}

/**
 * Return true when the content contains a "Falsifies-If:" block.
 * Matches "Falsifies-If:" anywhere as a line token (case-sensitive to match
 * the canonical convention; leading whitespace is allowed for indented lists).
 */
export function hasFalsifiesIf(content: string): boolean {
  return /^\s*Falsifies-If\s*:/m.test(content);
}

/**
 * Extract the target file path from an unknown toolInput value.
 * Tries "file_path" first (Write/Edit canonical field), then "path".
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
 * Extract the written content from an unknown toolInput value.
 * Tries "content" first (Write canonical), then "new_string" (Edit canonical).
 */
export function extractContent(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) return undefined;
  const ti = toolInput as Record<string, unknown>;
  const candidate = ti["content"] ?? ti["new_string"];
  if (typeof candidate === "string") return candidate;
  return undefined;
}

// ---------------------------------------------------------------------------
// BEH_FALSIFIES_IF descriptor
// ---------------------------------------------------------------------------

export const BEH_FALSIFIES_IF: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the pre_tool gate.
  gates: ["pre_tool"],

  // Synchronous: no filesystem I/O required — all checks are on toolInput content.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event } = ctx;

    // ── Non-write tool: allow ────────────────────────────────────────────────
    const toolName = event.toolName ?? "";
    if (!WRITE_TOOL_NAMES.has(toolName)) {
      return {
        decision: "allow",
        reason: "non-write tool — falsifies-if gate not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Extract target path ──────────────────────────────────────────────────
    const targetPath = extractTargetPath(event.toolInput);
    if (targetPath === undefined) {
      return {
        decision: "allow",
        reason: "could not extract target file path from toolInput — allowing defensively",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Extract written content ──────────────────────────────────────────────
    const content = extractContent(event.toolInput);
    if (content === undefined) {
      return {
        decision: "allow",
        reason: "could not extract written content from toolInput — allowing defensively",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Claim-bearing check ──────────────────────────────────────────────────
    const pathIsClaim = isClaimBearingPath(targetPath);
    const contentIsClaim = hasClaimBearingFrontmatter(content);

    if (!pathIsClaim && !contentIsClaim) {
      return {
        decision: "allow",
        reason: `"${targetPath}" is not a claim-bearing file — falsifies-if gate not applicable`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Falsifies-If presence check ──────────────────────────────────────────
    if (hasFalsifiesIf(content)) {
      const reason = pathIsClaim
        ? `"${targetPath}" is a claim-bearing path and contains a Falsifies-If block`
        : `"${targetPath}" declares claim-bearing:true and contains a Falsifies-If block`;
      return {
        decision: "allow",
        reason,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── Block: claim-bearing + missing Falsifies-If ──────────────────────────
    const claimSource = pathIsClaim
      ? `path matches a claim-bearing pattern (docs/business-model/ or docs/decisions/)`
      : `frontmatter declares claim-bearing: true`;

    return {
      decision: "block",
      reason:
        `[${BEHAVIOR_ID}] "${targetPath}" is a claim-bearing file (${claimSource}) but ` +
        `the written content contains no "Falsifies-If:" block. ` +
        `Add a Falsifies-If section before writing to this file. ` +
        `See docs/conception/05-gates-policy-spec.md §8.4 and CLAUDE.md claim-bearing rule.`,
      behaviorId: BEHAVIOR_ID,
      violationType: "MISSING_FALSIFIES_IF",
    };
  },
};
