/**
 * BEH_ADR_BEFORE_IMPL — ADR-before-implementation-write advisory gate (R-023).
 *
 * At every pre_tool gate for Write/Edit/MultiEdit on an implementation file
 * (non-.md, non-.hima/**) at M+ risk class, this behavior checks whether at
 * least one ADR (Architecture Decision Record) file was read during the current
 * session. The read-set is the source of truth for "what was read this session"
 * (R-003 read-before-write infrastructure).
 *
 * If no ADR file is in the session read-set, the behavior emits an advisory
 * warn pointing to the decision-record-discipline rule. This is intentionally
 * ADVISORY (warn, not block) — the gate is a nudge, not a hard stop.
 *
 * Decision tree:
 *   1. Non-write tool (not Write | Edit | MultiEdit) → allow.
 *   2. Cannot extract target path from toolInput → allow defensively.
 *   3. Target path is a .md file → allow (documentation writes are exempt).
 *   4. Target path is under .hima/** → allow (internal state writes are exempt).
 *   5. riskClass < M (T or L) → allow (advisory not warranted at low stakes).
 *   6. Load session read-set (keyed by ward.id or "unknown").
 *   7. At least one ADR path (containing "docs/adr/" or "docs/decisions/") is
 *      in the read-set → allow.
 *   8. No ADR in read-set → warn ADR_MISSING_IN_READ_SET.
 *
 * Implementation files: any file whose path does NOT end in ".md" AND is NOT
 * rooted under ".hima/" (local state directory).
 *
 * ADR paths: any read-set entry whose path contains "/docs/adr/" or
 * "/docs/decisions/" as a path segment.
 *
 * violationType: n/a (advisory only — warn never carries violationType)
 * gates:         ["pre_tool"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-023,
 *      BEHAVIOR-CATALOG-v3.md §2 P-15,
 *      decision-record-discipline.md §PRE-BUILD gate,
 *      ADR-0020 (decision_authority block).
 */

import type { RiskClass } from "@norm/schemas";
import { RISK_ORDER } from "@norm/schemas";
import { readReadSet } from "../read-set.js";
import { canonicalWriteTool, extractApplyPatchTargets, isApplyPatchTool } from "./tool-classify.js";
import type { BehaviorContext, BehaviorDescriptor, BehaviorVerdict } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-ADR-BEFORE-IMPL";

/**
 * Safe RISK_ORDER lookup.
 * noUncheckedIndexedAccess makes the return type `number | undefined`; the
 * value is always present by construction (RISK_ORDER covers all RiskClass literals).
 */
function riskOrder(rc: RiskClass): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return RISK_ORDER[rc]!;
}

/** Minimum numeric risk order at which the advisory is active (M = 2). */
const WARN_FLOOR = riskOrder("M");

// ---------------------------------------------------------------------------
// Internal helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Extract the target file path from an unknown toolInput value.
 * Tries "file_path" first (Write/Edit canonical field), then "path".
 * Returns undefined when neither field is a non-empty string.
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
 * Normalise a file path to forward-slash separators for cross-platform
 * pattern matching. Strips a leading "./" so relative paths match the same
 * patterns as root-relative ones.
 */
function normalisePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Return true when the target path is an implementation file — i.e. it is
 * NOT a Markdown file and NOT under the .hima/** internal state directory.
 *
 * Exempt paths:
 *   *.md          — documentation writes (specs, ADRs, plans, etc.)
 *   .hima/**      — internal hima state directory
 */
export function isImplFile(filePath: string): boolean {
  const normalised = normalisePath(filePath);
  // Exempt .md files.
  if (normalised.endsWith(".md")) return false;
  // Exempt .hima/** (rooted or relative).
  if (
    normalised === ".hima" ||
    normalised.startsWith(".hima/") ||
    // Absolute path variant — contains /.hima/ as a path segment.
    /(?:^|\/)\.hima(?:\/|$)/.test(normalised)
  ) {
    return false;
  }
  return true;
}

/**
 * Return true when the read-set contains at least one ADR file path.
 *
 * ADR paths are identified by the presence of "/docs/adr/" or
 * "/docs/decisions/" as a segment anywhere in the path (absolute or relative).
 * The check is case-sensitive to match the canonical directory names.
 */
export function hasAdrInReadSet(readSet: string[]): boolean {
  return readSet.some(
    (entry) => entry.includes("/docs/adr/") || entry.includes("/docs/decisions/"),
  );
}

// ---------------------------------------------------------------------------
// BEH_ADR_BEFORE_IMPL descriptor
// ---------------------------------------------------------------------------

export const BEH_ADR_BEFORE_IMPL: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the pre_tool gate (fires before the write is executed).
  gates: ["pre_tool"],

  async evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
    const { event, riskClass, root, ward } = ctx;

    // ── 1. Non-write tool → allow ─────────────────────────────────────────────
    const toolName = event.toolName ?? "";
    if (!canonicalWriteTool(toolName)) {
      return {
        decision: "allow",
        reason: "non-write tool — ADR-before-impl gate not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 2. Extract target path → allow defensively on failure ─────────────────
    // Codex's apply_patch has no file_path/path field; its target is parsed
    // from the patch command text. A multi-file patch is evaluated against
    // its FIRST declared file only (documented scope limit — this gate is
    // advisory, not the hard-fail-closed Delegation-First/planner-write-guard
    // path). An unparseable command still yields a (sentinel) target path, so
    // the advisory still fires rather than silently allowing.
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

    // ── 3 & 4. Non-implementation file (.md or .hima/**) → allow ──────────────
    if (!isImplFile(targetPath)) {
      return {
        decision: "allow",
        reason: `"${targetPath}" is not an implementation file — ADR gate not applicable`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 5. Below enforcement floor (T or L) → allow ───────────────────────────
    if (riskOrder(riskClass) < WARN_FLOOR) {
      return {
        decision: "allow",
        reason: `risk class ${riskClass} is below M — ADR-before-impl advisory not active`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 6. Load session read-set ──────────────────────────────────────────────
    const sessionId = ward?.id ?? "unknown";
    const readSet = await readReadSet(root, sessionId);

    // ── 7. ADR present in read-set → allow ────────────────────────────────────
    if (hasAdrInReadSet(readSet)) {
      return {
        decision: "allow",
        reason: `an ADR file is in the session read-set — implementation write to "${targetPath}" is permitted`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 8. No ADR in read-set → warn ──────────────────────────────────────────
    // Advisory: surfaces the decision-record-discipline requirement without blocking.
    return {
      decision: "warn",
      reason:
        `[${BEHAVIOR_ID}] M+ implementation write without an ADR in the session read-set` +
        ` — record/read a decision record first (docs/adr/ or docs/decisions/).` +
        ` Target: "${targetPath}". See: decision-record-discipline.md §PRE-BUILD gate.`,
      behaviorId: BEHAVIOR_ID,
    };
  },
};
