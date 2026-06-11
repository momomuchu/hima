// Ported from packages/core/src/gates/action-signal.ts — no logic changes

import { createHash } from "node:crypto";
import type { GateEvent } from "./gate-event.js";
import { normalizePath } from "./canonical-path.js";

export const SEMANTIC_CLASSES = [
  "READ_ONLY",
  "WRITE_MUTATION",
  "EXECUTE_SIDE_EFFECT",
  "META_CONTROL",
] as const;

export type SemanticClass = (typeof SEMANTIC_CLASSES)[number];

export const ZONE_COMPLIANCE_VALUES = ["allowed", "anomalous", "forbidden"] as const;
export type ZoneCompliance = (typeof ZONE_COMPLIANCE_VALUES)[number];

export interface ActionSignalPreTool {
  readonly toolName: string;
  readonly semanticClass: SemanticClass;
  readonly targetPath: string;
  readonly subPhase: string | null;
  readonly phase: string;
  readonly riskClass: string;
  readonly zoneCompliance: ZoneCompliance;
}

export interface ActionSignalPostTool extends ActionSignalPreTool {
  readonly contentHash: string;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly suppressionPatternFound: boolean;
}

export type ActionSignal = ActionSignalPreTool | ActionSignalPostTool;

const READ_ONLY_TOOLS = new Set(["read", "readfile", "glob", "grep", "ls", "cat", "listfiles", "search"]);
const META_CONTROL_TOOLS = new Set(["task", "taskcreate", "taskupdate", "todowrite", "todoread", "subagent", "agent", "delegate", "exitplanmode"]);
const EXECUTE_SIDE_EFFECT_TOOLS = new Set(["bash", "shell", "sh", "cmd", "powershell", "pwsh", "python", "python3", "node", "ruby", "perl"]);
const WRITE_MUTATION_TOOLS = new Set(["write", "edit", "multiedit", "notebookedit", "patch", "createfile"]);

export function classifyToolName(toolName: string): SemanticClass {
  const normalized = toolName.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  if (READ_ONLY_TOOLS.has(normalized)) return "READ_ONLY";
  if (META_CONTROL_TOOLS.has(normalized)) return "META_CONTROL";
  if (EXECUTE_SIDE_EFFECT_TOOLS.has(normalized)) return "EXECUTE_SIDE_EFFECT";
  if (WRITE_MUTATION_TOOLS.has(normalized)) return "WRITE_MUTATION";
  // FAIL CLOSED: unknown/MCP tools → WRITE_MUTATION
  return "WRITE_MUTATION";
}

export function extractTargetPath(event: GateEvent): string {
  if (!event.toolInput || typeof event.toolInput !== "object") return "";
  const input = event.toolInput as Record<string, unknown>;
  for (const key of ["file_path", "filePath", "path", "targetPath", "target_path", "target"]) {
    const val = input[key];
    if (typeof val === "string" && val.length > 0) return normalizePath(val);
  }
  for (const key of ["paths", "files", "targets"]) {
    const arr = input[key];
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
      return normalizePath(arr[0] as string);
    }
  }
  return "";
}

export function hashContent(value: unknown): string {
  if (value === undefined || value === null) return "";
  let bytes: string;
  try {
    bytes = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    bytes = String(value);
  }
  if (bytes.length === 0) return "";
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}

export function countLines(value: unknown): number {
  if (typeof value !== "string" || value.length === 0) return 0;
  return value.split(/\r?\n/).length;
}

export function estimateLineDelta(event: GateEvent): { linesAdded: number; linesRemoved: number } {
  if (!event.toolInput || typeof event.toolInput !== "object") return { linesAdded: 0, linesRemoved: 0 };
  const input = event.toolInput as Record<string, unknown>;
  if (typeof input.old_string === "string" || typeof input.new_string === "string") {
    return { linesAdded: countLines(input.new_string ?? ""), linesRemoved: countLines(input.old_string ?? "") };
  }
  if (typeof input.content === "string") return { linesAdded: countLines(input.content), linesRemoved: 0 };
  return { linesAdded: 0, linesRemoved: 0 };
}

export function detectSuppressionWithoutJustification(event: GateEvent): boolean {
  if (!event.toolInput || typeof event.toolInput !== "object") return false;
  const input = event.toolInput as Record<string, unknown>;
  const rawContent =
    typeof input.content === "string" ? input.content
    : typeof input.new_string === "string" ? input.new_string
    : null;
  if (!rawContent) return false;

  // H4: NFKC-normalize + strip zero-width/bidi chars
  const content = rawContent.normalize("NFKC").replace(/[​-‏‪-‮﻿]/g, "");

  const SUPPRESSION_PATTERN =
    /(?:eslint-disable(?:-next-line|-line)?|@ts-ignore|@ts-nocheck|#\s*noqa|@SuppressWarnings)\b/i;
  const LINT_RULE_PATTERN = /^[@a-z0-9/-]+(?:\/[@a-z0-9/-]+)*$/i;

  function isSubstantiveJustification(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;
    const tokens = trimmed.match(/[a-z0-9](?:[a-z0-9'-]*[a-z0-9])?/gi) ?? [];
    const realWords = tokens.filter((tok) => {
      if (SUPPRESSION_PATTERN.test(tok)) return false;
      if (LINT_RULE_PATTERN.test(tok) && tok.includes("-")) return false;
      return true;
    });
    return realWords.length >= 2;
  }

  function hasSubstantiveCommentJustification(line: string): boolean {
    const commentStarts = [...line.matchAll(/\/\/|\/\*|#(?!\s*noqa)|<!--/g)];
    for (const m of commentStarts) {
      const afterComment = line.slice(m.index! + m[0].length).trim();
      if (isSubstantiveJustification(afterComment)) return true;
    }
    return false;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!SUPPRESSION_PATTERN.test(line)) continue;

    const suppressionMatch = SUPPRESSION_PATTERN.exec(line);
    if (suppressionMatch) {
      const afterSuppression = line.slice(suppressionMatch.index + suppressionMatch[0].length);
      const separatorMatch = /(?:--|:)\s*(.+)$/.exec(afterSuppression);
      if (separatorMatch && isSubstantiveJustification(separatorMatch[1] ?? "")) continue;
    }

    const beforeSuppression = suppressionMatch ? line.slice(0, suppressionMatch.index) : line;
    if (hasSubstantiveCommentJustification(beforeSuppression)) continue;

    if (i > 0 && hasSubstantiveCommentJustification(lines[i - 1] ?? "")) continue;

    return true;
  }
  return false;
}

export function isPostToolSignal(signal: ActionSignal): signal is ActionSignalPostTool {
  return "contentHash" in signal;
}
