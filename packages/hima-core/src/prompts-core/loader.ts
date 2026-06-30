/**
 * prompts-core/loader.ts — loadPrompt(): materialises a PromptSource into a string.
 *
 * Design sources:
 *   SPEC-004-profiles.md [CRITICAL][BLOCKS:high] (loader contract)
 *   R-020 gap register
 *
 * Dispatch rules:
 *   "bundled"    → return source.content directly (no I/O, offline-safe).
 *   "filesystem" → read <baseDir>/<variantName>.md via node:fs/promises;
 *                  variantName is required for filesystem sources.
 *
 * Path-traversal guard (filesystem only):
 *   The resolved absolute path must start with the resolved baseDir + path.sep.
 *   Any attempt to escape (e.g. "../../../etc/passwd") throws before I/O.
 *
 * Anti-patterns (do NOT add here):
 *   - No YAML frontmatter parsing in this layer (SPEC-004 reserves that for the
 *     full loadPrompt() + RuntimeInjection chain, future wave).
 *   - No template interpolation — content is returned verbatim.
 *   - No global caching — callers own memoisation if needed.
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import type { PromptSource } from "./types.js";

// ---------------------------------------------------------------------------
// loadPrompt — sole materialisation entry point
// ---------------------------------------------------------------------------

/**
 * Materialise a PromptSource into prompt text.
 *
 * @param source      The prompt source descriptor (bundled or filesystem).
 * @param variantName Required when source.kind === "filesystem"; used to
 *                    construct the path `<baseDir>/<variantName>.md`.
 *                    Ignored for bundled sources.
 *
 * @returns The raw prompt string (no frontmatter parsing, no interpolation).
 *
 * @throws {Error} If source.kind === "filesystem" and variantName is missing.
 * @throws {Error} If the resolved path escapes baseDir (path-traversal guard).
 * @throws {Error} On I/O failure (file not found, permission denied, …).
 *
 * Pure for "bundled" (no I/O, no side effects).
 * Async I/O for "filesystem" via node:fs/promises — callers must await.
 */
export async function loadPrompt(
  source: PromptSource,
  variantName?: string,
): Promise<string> {
  if (source.kind === "bundled") {
    return source.content;
  }

  // filesystem: variantName is required.
  if (variantName === undefined || variantName === "") {
    throw new Error(
      `loadPrompt: variantName is required for filesystem sources (baseDir="${source.baseDir}")`,
    );
  }

  // Prevent path components that could escape baseDir.
  // Reject immediately on any path separator or dot-dot pattern in the name.
  if (
    variantName.includes("/") ||
    variantName.includes("\\") ||
    variantName.includes("..")
  ) {
    throw new Error(
      `loadPrompt: invalid variantName "${variantName}" — path separators and ".." are not allowed`,
    );
  }

  const resolvedBase = path.resolve(source.baseDir);
  const resolvedTarget = path.resolve(source.baseDir, `${variantName}.md`);

  // Guard: resolved target must be a direct child of baseDir (no traversal).
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error(
      `loadPrompt: path traversal detected — "${resolvedTarget}" escapes baseDir "${resolvedBase}"`,
    );
  }

  return readFile(resolvedTarget, "utf-8");
}
