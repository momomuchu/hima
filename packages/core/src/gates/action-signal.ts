/**
 * BEH-000 — Action-Signal Classification
 *
 * Classifies agent tool calls from tool semantics (tool type, argument shape,
 * file diff content) rather than from keyword scanning of output text.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §4 BEH-000
 * Evidence key: .planning/run-set.json#/events[].action_signal
 */

import { createHash } from "node:crypto";
import { getAllowedWriteZones, isAllowedWriteTarget } from "../policy/write-zones.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import type { SubPhase } from "../types/canonical.js";
import { normalizePath } from "./canonical-path.js";

// ── Semantic class vocabulary ─────────────────────────────────────────────────

export const SEMANTIC_CLASSES = [
  "READ_ONLY",
  "WRITE_MUTATION",
  "EXECUTE_SIDE_EFFECT",
  "META_CONTROL",
] as const;

export type SemanticClass = (typeof SEMANTIC_CLASSES)[number];

// ── Zone compliance vocabulary ────────────────────────────────────────────────

export const ZONE_COMPLIANCE_VALUES = ["allowed", "anomalous", "forbidden"] as const;

export type ZoneCompliance = (typeof ZONE_COMPLIANCE_VALUES)[number];

// ── ActionSignal record (pre_tool fields + post_tool extension fields) ────────

export interface ActionSignalPreTool {
  readonly toolName: string;
  readonly semanticClass: SemanticClass;
  /**
   * Canonical target path extracted from toolInput, if any.
   * Empty string when no target path is present (e.g. Bash without file output).
   */
  readonly targetPath: string;
  readonly subPhase: SubPhase | null;
  readonly phase: string;
  readonly riskClass: string;
  readonly zoneCompliance: ZoneCompliance;
}

export interface ActionSignalPostTool extends ActionSignalPreTool {
  /**
   * SHA-256 hex digest of the written bytes (toolOutput stringified).
   * Empty string when no output bytes are present.
   */
  readonly contentHash: string;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  /**
   * True when the written content contains a suppression directive that lacks
   * an adjacent justification comment (BEH-011 signal). False otherwise.
   * Downstream behaviors consume this field; they do not re-scan output text.
   */
  readonly suppressionPatternFound: boolean;
}

export type ActionSignal = ActionSignalPreTool | ActionSignalPostTool;

// ── Tool-name → SemanticClass mapping ────────────────────────────────────────

/**
 * Exact-allowlist sets for each semantic class.
 * SECURITY: Classification is by exact normalized name only — no substring/prefix
 * heuristics. Unknown tools (including all MCP tools) FAIL CLOSED to WRITE_MUTATION
 * so they are never silently laundered as zone-exempt READ_ONLY.
 */

const READ_ONLY_TOOLS = new Set([
  "read",
  "readfile",
  "glob",
  "grep",
  "ls",
  "cat",
  "listfiles",
  "search",
]);

const META_CONTROL_TOOLS = new Set([
  "task",
  "taskcreate",
  "taskupdate",
  "todowrite",
  "todoread",
  "subagent",
  "agent",
  "delegate",
  "exitplanmode",
]);

const EXECUTE_SIDE_EFFECT_TOOLS = new Set([
  "bash",
  "shell",
  "sh",
  "cmd",
  "powershell",
  "pwsh",
  "python",
  "python3",
  "node",
  "ruby",
  "perl",
]);

const WRITE_MUTATION_TOOLS = new Set([
  "write",
  "edit",
  "multiedit",
  "notebookedit",
  "patch",
  "createfile",
]);

/**
 * Maps a tool name to its semantic class.
 *
 * Mapping rules (from BEH-000 spec):
 *   READ_ONLY          — Read, Glob, Grep, LS, Cat (exact allowlist only)
 *   META_CONTROL       — Task, Agent, TodoWrite, SubAgent (exact allowlist only)
 *   EXECUTE_SIDE_EFFECT — Bash, Shell, PowerShell, Python, Node (exact allowlist only)
 *   WRITE_MUTATION     — Write, Edit, MultiEdit, NotebookEdit, Patch, CreateFile
 *
 * SECURITY (C1): All MCP tools and unknown tools FAIL CLOSED to WRITE_MUTATION.
 * This prevents unknown/MCP write tools from being laundered as zone-exempt.
 */
export function classifyToolName(toolName: string): SemanticClass {
  const normalized = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

  if (READ_ONLY_TOOLS.has(normalized)) {
    return "READ_ONLY";
  }

  if (META_CONTROL_TOOLS.has(normalized)) {
    return "META_CONTROL";
  }

  if (EXECUTE_SIDE_EFFECT_TOOLS.has(normalized)) {
    return "EXECUTE_SIDE_EFFECT";
  }

  if (WRITE_MUTATION_TOOLS.has(normalized)) {
    return "WRITE_MUTATION";
  }

  // FAIL CLOSED: MCP tools (contain "__") and all unknowns -> WRITE_MUTATION.
  // Never default to READ_ONLY — that would launder unknown tools as zone-exempt.
  return "WRITE_MUTATION";
}

// ── Target path extraction ────────────────────────────────────────────────────

export function extractTargetPath(event: GateEvent): string {
  if (!event.toolInput || typeof event.toolInput !== "object") {
    return "";
  }

  const input = event.toolInput as Record<string, unknown>;

  const candidates = [
    input.file_path,
    input.filePath,
    input.path,
    input.targetPath,
    input.target_path,
    input.target,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return normalizePath(candidate);
    }
  }

  // For array-based targets take the first
  const arrays = [input.paths, input.files, input.targets];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
      return normalizePath(arr[0] as string);
    }
  }

  return "";
}

// ── Zone compliance computation ───────────────────────────────────────────────

export function computeZoneCompliance(
  semanticClass: SemanticClass,
  targetPath: string,
  subPhase: SubPhase | null,
): ZoneCompliance {
  // Only WRITE_MUTATION and EXECUTE_SIDE_EFFECT can have zone violations.
  // READ_ONLY and META_CONTROL are always allowed from a zone perspective.
  if (semanticClass === "READ_ONLY" || semanticClass === "META_CONTROL") {
    return "allowed";
  }

  if (targetPath.length === 0) {
    // No extractable target — cannot determine zone compliance; treat as anomalous
    // for mutations (could be an in-memory or indirect write).
    return semanticClass === "WRITE_MUTATION" ? "anomalous" : "allowed";
  }

  const allowedZones = getAllowedWriteZones(subPhase);

  if (isAllowedWriteTarget(targetPath, allowedZones)) {
    return "allowed";
  }

  // For Execute subphase, writing outside allowed zones during src/ work is anomalous
  // but not necessarily forbidden (the caller/evaluator decides policy response).
  // For non-Execute phases, a write outside zones is forbidden.
  if (subPhase === "Execute" || subPhase === "Verify") {
    return "anomalous";
  }

  return "forbidden";
}

// ── Content hash ──────────────────────────────────────────────────────────────

export function hashContent(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  let bytes: string;
  try {
    bytes = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    bytes = String(value);
  }

  if (bytes.length === 0) {
    return "";
  }

  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

// ── Line diff counters ────────────────────────────────────────────────────────

export function countLines(value: unknown): number {
  if (typeof value !== "string" || value.length === 0) {
    return 0;
  }
  return value.split(/\r?\n/).length;
}

/**
 * Estimates linesAdded/linesRemoved from a post_tool event.
 *
 * For Write/Edit tool calls, toolInput may contain old_string/new_string
 * (Edit) or content (Write). toolOutput confirms completion.
 * This is a best-effort estimate from available signal.
 */
export function estimateLineDelta(event: GateEvent): { linesAdded: number; linesRemoved: number } {
  if (!event.toolInput || typeof event.toolInput !== "object") {
    return { linesAdded: 0, linesRemoved: 0 };
  }

  const input = event.toolInput as Record<string, unknown>;

  // Edit tool: has old_string and new_string
  if (typeof input.old_string === "string" || typeof input.new_string === "string") {
    const removed = countLines(input.old_string ?? "");
    const added = countLines(input.new_string ?? "");
    return { linesAdded: added, linesRemoved: removed };
  }

  // Write tool: has content field — all lines are additions
  if (typeof input.content === "string") {
    return { linesAdded: countLines(input.content), linesRemoved: 0 };
  }

  return { linesAdded: 0, linesRemoved: 0 };
}

// ── Suppression pattern scanner ───────────────────────────────────────────────

/**
 * Returns true if the written content contains a suppression directive
 * (eslint-disable, @ts-expect-error, @ts-nocheck, #noqa, @SuppressWarnings)
 * that lacks an adjacent SUBSTANTIVE justification comment.
 *
 * "Adjacent" means: the same line OR the immediately preceding line contains
 * a comment token followed by substantive (>=2 real words) text.
 *
 * SECURITY (H4): Content is NFKC-normalized and zero-width/bidi characters
 * are stripped before scanning to prevent Unicode evasion attacks.
 *
 * A justification is rejected when:
 *   - It consists of only a single token/word (throwaway token).
 *   - The token IS the lint rule name (e.g. "no-eval" after eslint-disable).
 *   - The token IS another suppression directive.
 *
 * Operates on file bytes (toolInput.content or toolInput.new_string), not output text.
 */
export function detectSuppressionWithoutJustification(event: GateEvent): boolean {
  if (!event.toolInput || typeof event.toolInput !== "object") {
    return false;
  }

  const input = event.toolInput as Record<string, unknown>;
  const rawContent =
    typeof input.content === "string"
      ? input.content
      : typeof input.new_string === "string"
        ? input.new_string
        : null;

  if (!rawContent) {
    return false;
  }

  // H4: NFKC-normalize to collapse fullwidth/compatibility characters,
  // then strip zero-width and bidi control characters used for evasion.
  // U+200B–U+200F zero-width space/ZWNJ/ZWJ/LRM/RLM
  // U+202A–U+202E bidi embedding/override chars
  // U+FEFF BOM/zero-width no-break space
  const content = rawContent.normalize("NFKC").replace(/[​-‏‪-‮﻿]/g, "");

  // Pattern that matches suppression directives.
  const SUPPRESSION_PATTERN =
    /(?:eslint-disable(?:-next-line|-line)?|@ts-ignore|@ts-nocheck|#\s*noqa|@SuppressWarnings)\b/i;

  // Lint rule name pattern: tokens like "no-eval", "no-console", "@typescript-eslint/...".
  // These are NOT substantive justifications.
  const LINT_RULE_PATTERN = /^[@a-z0-9/-]+(?:\/[@a-z0-9/-]+)*$/i;

  /**
   * Returns true only when the text contains a SUBSTANTIVE justification:
   * >= 2 real word tokens that are NOT lint rule names and NOT suppression directives.
   */
  function isSubstantiveJustification(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;

    // Split into word-like tokens (letters/digits/hyphens).
    const tokens = trimmed.match(/[a-z0-9](?:[a-z0-9'-]*[a-z0-9])?/gi) ?? [];

    // Filter out suppression directive tokens and lint rule name tokens.
    const realWords = tokens.filter((tok) => {
      if (SUPPRESSION_PATTERN.test(tok)) return false;
      if (LINT_RULE_PATTERN.test(tok) && tok.includes("-")) return false;
      return true;
    });

    // Require at least 2 real words to be considered substantive.
    return realWords.length >= 2;
  }

  /**
   * Returns true when a comment on this line contains a substantive justification.
   * Checks the text appearing after the first comment-start token found.
   */
  function hasSubstantiveCommentJustification(line: string): boolean {
    const commentStarts = [...line.matchAll(/\/\/|\/\*|#(?!\s*noqa)|<!--/g)];
    for (const m of commentStarts) {
      // biome-ignore lint/style/noNonNullAssertion: m.index is always defined for a matchAll RegExpExecArray
      const afterComment = line.slice(m.index! + m[0].length).trim();
      if (isSubstantiveJustification(afterComment)) {
        return true;
      }
    }
    return false;
  }

  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!SUPPRESSION_PATTERN.test(line)) {
      continue;
    }

    const suppressionMatch = SUPPRESSION_PATTERN.exec(line);

    // Check for inline justification after a separator ("-- reason" / ": reason").
    if (suppressionMatch) {
      const afterSuppression = line.slice(suppressionMatch.index + suppressionMatch[0].length);
      // Match separator followed by the justification text.
      const separatorMatch = /(?:--|:)\s*(.+)$/.exec(afterSuppression);
      if (separatorMatch && isSubstantiveJustification(separatorMatch[1] ?? "")) {
        continue;
      }
    }

    // Check for a separate justification comment before the suppression token on the same line.
    const beforeSuppression = suppressionMatch ? line.slice(0, suppressionMatch.index) : line;
    if (hasSubstantiveCommentJustification(beforeSuppression)) {
      continue;
    }

    // Check preceding line for a standalone substantive justification comment.
    if (i > 0) {
      const prevLine = lines[i - 1] ?? "";
      if (hasSubstantiveCommentJustification(prevLine)) {
        continue;
      }
    }

    // Suppression directive found without adjacent substantive justification.
    return true;
  }

  return false;
}

// ── Main classifiers ──────────────────────────────────────────────────────────

/**
 * Builds a pre_tool ActionSignal from a GateEvent.
 * Called at pre_tool gate to classify the pending tool call.
 */
export function classifyPreTool(
  event: GateEvent,
  subPhase: SubPhase | null,
  phase: string,
  riskClass: string,
): ActionSignalPreTool {
  const toolName = event.toolName ?? "";
  const semanticClass = classifyToolName(toolName);
  const targetPath = extractTargetPath(event);
  const zoneCompliance = computeZoneCompliance(semanticClass, targetPath, subPhase);

  return {
    toolName,
    semanticClass,
    targetPath,
    subPhase,
    phase,
    riskClass,
    zoneCompliance,
  };
}

/**
 * Extends a pre_tool ActionSignal with post_tool evidence fields.
 * Called at post_tool gate after the tool call completes.
 */
export function extendWithPostTool(
  preTool: ActionSignalPreTool,
  event: GateEvent,
): ActionSignalPostTool {
  const contentHash = hashContent(event.toolOutput);
  const { linesAdded, linesRemoved } = estimateLineDelta(event);
  const suppressionPatternFound =
    preTool.semanticClass === "WRITE_MUTATION"
      ? detectSuppressionWithoutJustification(event)
      : false;

  return {
    ...preTool,
    contentHash,
    linesAdded,
    linesRemoved,
    suppressionPatternFound,
  };
}

// ── Type guard ────────────────────────────────────────────────────────────────

export function isPostToolSignal(signal: ActionSignal): signal is ActionSignalPostTool {
  return "contentHash" in signal;
}
