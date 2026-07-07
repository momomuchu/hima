/**
 * behavior-core/tool-classify.ts — shared cross-runtime write-tool classification.
 *
 * BUG (live-proven, 2026-07): Codex's real file-write tool is `apply_patch`, with
 * `tool_input = { command: "<patch script>" }` — there is no `file_path`/`path`
 * field. Every pre_tool write-gate behavior in this package independently
 * hardcoded `WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"])` and
 * extracted the target path from `file_path`/`path`. On a real Codex session,
 * `apply_patch` therefore matched none of those sets: every gate treated the
 * write as a "non-write tool" and allowed it unconditionally. Delegation-First,
 * planner-write-guard, ADR-before-impl, read-before-write, research-first,
 * falsifies-if, and secret-guard were ALL silently inert for Codex writes.
 *
 * This module is the single shared classifier every write-gate behavior now
 * imports, so tool-name recognition and path extraction are defined once and
 * cannot drift out of sync per-file again.
 *
 * canonicalWriteTool(toolName) — true for any known cross-runtime write tool:
 *   - Claude:          Write, Edit, MultiEdit
 *   - Codex:           apply_patch (also the "applypatch" spelling)
 *   - Anthropic API:   str_replace_editor, str_replace_based_edit_tool
 *   Matching is case-insensitive and ignores separators (_, -, whitespace), so
 *   "APPLY_PATCH", "apply-patch", and "applypatch" are all recognized.
 *
 * extractWriteTargets(toolName, toolInput) — returns the touched path(s):
 *   - apply_patch: parses `*** (Add|Update|Delete) File: <path>` headers out of
 *     the `command` string. A patch with no parseable header (missing/blank
 *     `command`, or a body with no recognizable file header) returns
 *     `[UNKNOWN_WRITE_TARGET]` — a sentinel meaning "this IS a write, but the
 *     target path could not be determined." Callers MUST treat that sentinel
 *     as an implementation write of unknown path (fail-closed) rather than
 *     silently allowing it — see isImplementationTarget in beh-delegation-first.ts.
 *   - All other write tools: returns `[path]` from `file_path`/`path` when
 *     present, or `[]` when absent — IDENTICAL to every behavior's pre-existing
 *     per-file `extractTargetPath` semantics (an empty result means "allow
 *     defensively," matching the ~15 existing tests across 5 behavior files
 *     that exercise a Write/Edit/MultiEdit call with no extractable path).
 *
 * pickRepresentativeTarget(targets, isNotable) — reduces a multi-target array
 * (an apply_patch patch can touch several files in one call) to the single
 * path a gate should evaluate: the first target for which `isNotable` returns
 * true (e.g. "is an implementation file"), or the first target when none are
 * notable (e.g. a patch that only touches .md files). `isNotable` predicates
 * MUST treat UNKNOWN_WRITE_TARGET as notable so an unparseable patch is never
 * silently resolved away.
 *
 * See: docs/decisions/ (Codex write-gate normalization), SPEC-018
 *      (Delegation-First), .planning/architecture/V3-COMPLETENESS-AUDIT.md
 *      R-020/R-023/R-003/R-007/R-004/R-009.
 */

// ---------------------------------------------------------------------------
// UNKNOWN_WRITE_TARGET sentinel
// ---------------------------------------------------------------------------

/**
 * Sentinel value returned by extractWriteTargets/extractApplyPatchTargets when
 * the caller IS a recognized write tool but the target path could not be
 * parsed out of its toolInput. Deliberately built from non-ASCII bracket
 * characters (U+27EA/U+27EB) rather than a NUL byte: it must round-trip
 * safely through `path.resolve`/`fs.access` (a NUL byte throws synchronously
 * in some Node fs paths) while remaining impossible to collide with a real
 * file path.
 */
export const UNKNOWN_WRITE_TARGET = "⟪HIMA:UNKNOWN_WRITE_TARGET⟫";

/** True when `target` is the UNKNOWN_WRITE_TARGET sentinel. */
export function isUnknownWriteTarget(target: string): boolean {
  return target === UNKNOWN_WRITE_TARGET;
}

// ---------------------------------------------------------------------------
// Tool-name normalization + recognition
// ---------------------------------------------------------------------------

/**
 * Canonical write-tool names across every runtime hima adapts to. Normalized
 * once at module load via normalizeToolName so there is a single source of
 * truth for the exact alias spelling (avoids hand-computed normalized string
 * typos).
 */
const RAW_WRITE_TOOL_NAMES: readonly string[] = [
  "Write",
  "Edit",
  "MultiEdit",
  "apply_patch",
  "applypatch",
  "str_replace_editor",
  "str_replace_based_edit_tool",
];

/**
 * Normalize a tool name for liberal, case-insensitive comparison: lower-case,
 * then strip whitespace/underscore/hyphen separators so "apply_patch",
 * "apply-patch", "APPLY_PATCH", and "applypatch" all collapse to the same key.
 */
function normalizeToolName(toolName: unknown): string {
  if (typeof toolName !== "string") return "";
  return toolName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
}

const WRITE_TOOL_ALIASES: ReadonlySet<string> = new Set(
  RAW_WRITE_TOOL_NAMES.map(normalizeToolName),
);

/**
 * True when `toolName` is any recognized cross-runtime write tool (Claude
 * Write/Edit/MultiEdit, Codex apply_patch, or the Anthropic API
 * str_replace_editor/str_replace_based_edit_tool variants).
 */
export function canonicalWriteTool(toolName: unknown): boolean {
  const normalized = normalizeToolName(toolName);
  return normalized !== "" && WRITE_TOOL_ALIASES.has(normalized);
}

/** True when `toolName` normalizes to the Codex apply_patch tool. */
export function isApplyPatchTool(toolName: unknown): boolean {
  return normalizeToolName(toolName) === "applypatch";
}

// ---------------------------------------------------------------------------
// Path extraction
// ---------------------------------------------------------------------------

/**
 * Extract a single target path from the generic `file_path`/`path` toolInput
 * shape shared by Write/Edit/MultiEdit/str_replace_editor/
 * str_replace_based_edit_tool. Identical semantics to every behavior file's
 * pre-existing local `extractTargetPath`: prefers `file_path`, falls back to
 * `path`, trims whitespace, and returns undefined for anything else
 * (non-object toolInput, missing/non-string/blank field).
 */
function extractFilePathField(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) return undefined;
  const ti = toolInput as Record<string, unknown>;
  const candidate = ti["file_path"] ?? ti["path"];
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }
  return undefined;
}

/**
 * Matches an apply_patch file-header line: `*** Add File: <path>`,
 * `*** Update File: <path>`, or `*** Delete File: <path>` — the format Codex's
 * apply_patch tool contract uses inside the `command` patch script. Anchored
 * per-line (multiline flag) so multi-file patches yield every touched path.
 */
const APPLY_PATCH_FILE_HEADER = /^\*\*\*\s+(?:Update|Add|Delete)\s+File:\s*(.+?)\s*$/gm;

/**
 * Parse the touched file path(s) out of an apply_patch toolInput's `command`
 * field. Returns `[UNKNOWN_WRITE_TARGET]` (never an empty array) when the
 * toolInput isn't an object, `command` is missing/blank/non-string, or the
 * command text contains no recognizable `*** File:` header — apply_patch IS a
 * write, so an extraction failure must never be indistinguishable from "no
 * write happened."
 */
export function extractApplyPatchTargets(toolInput: unknown): string[] {
  if (typeof toolInput !== "object" || toolInput === null) {
    return [UNKNOWN_WRITE_TARGET];
  }
  const ti = toolInput as Record<string, unknown>;
  const command = ti["command"];
  if (typeof command !== "string" || command.trim() === "") {
    return [UNKNOWN_WRITE_TARGET];
  }

  const paths: string[] = [];
  // Fresh RegExp instance per call: the module-level pattern carries the
  // global flag, whose internal lastIndex would otherwise leak across calls.
  // matchAll (rather than a manual exec()-loop) sidesteps that mutable-state
  // footgun entirely and avoids an assignment-in-expression while() clause.
  const re = new RegExp(APPLY_PATCH_FILE_HEADER.source, "gm");
  for (const match of command.matchAll(re)) {
    const p = match[1]?.trim();
    if (p !== undefined && p !== "") paths.push(p);
  }
  return paths.length > 0 ? paths : [UNKNOWN_WRITE_TARGET];
}

/**
 * Extract the write target(s) for any recognized write tool. Routes to
 * apply_patch's patch-header parser when `toolName` is apply_patch; otherwise
 * falls back to the generic `file_path`/`path` extraction, wrapped in a
 * single-element array (or `[]` when no path is extractable — preserving the
 * exact "allow defensively" signal every existing behavior test relies on).
 *
 * Does NOT itself check canonicalWriteTool — callers should gate on that
 * first so a non-write tool never reaches this function.
 */
export function extractWriteTargets(toolName: unknown, toolInput: unknown): string[] {
  if (isApplyPatchTool(toolName)) {
    return extractApplyPatchTargets(toolInput);
  }
  const single = extractFilePathField(toolInput);
  return single !== undefined ? [single] : [];
}

// ---------------------------------------------------------------------------
// Representative-target selection
// ---------------------------------------------------------------------------

/**
 * Reduce a multi-target array to the single path a gate should evaluate:
 * the first target for which `isNotable` returns true, or the first target
 * when none are notable (e.g. a patch touching only exempt paths). Returns
 * undefined when `targets` is empty — matching the pre-existing "no path
 * extracted → allow defensively" behavior across all write-gate behaviors.
 *
 * `isNotable` predicates must return true for UNKNOWN_WRITE_TARGET so an
 * unparseable apply_patch is never resolved away as if it touched nothing
 * relevant.
 */
export function pickRepresentativeTarget(
  targets: readonly string[],
  isNotable: (target: string) => boolean,
): string | undefined {
  if (targets.length === 0) return undefined;
  return targets.find(isNotable) ?? targets[0];
}
