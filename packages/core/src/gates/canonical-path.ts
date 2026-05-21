/**
 * Canonical project path normalizer — single source of truth.
 *
 * Used by action-signal.ts, write-zones.ts, beh-010-read-before-write.ts,
 * and handle-hook.ts so that path comparison invariants cannot drift silently
 * across duplicated implementations.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §4 BEH-000 (C2/M2 fix)
 */

import path from "node:path";

export interface CanonicalPathResult {
  /** Normalized path string. Relative (lowercase) if inside root, absolute otherwise. */
  readonly path: string;
  /** True when the resolved path is strictly inside (or equal to) projectRoot. */
  readonly insideRoot: boolean;
}

/**
 * Resolves `raw` against `projectRoot` and returns a canonical form.
 *
 * - Backslashes are converted to forward slashes before resolution.
 * - The result is lowercased for case-insensitive comparison.
 * - If the path resolves inside `projectRoot`, a relative path is returned.
 * - If the path resolves outside `projectRoot` (e.g. `../../etc/passwd`),
 *   `insideRoot` is false and the absolute path is returned.
 *   Callers MUST treat outside-root paths as `zoneCompliance: "forbidden"`.
 */
export function canonicalProjectPath(raw: string, projectRoot: string): CanonicalPathResult {
  // Normalize separators before resolution so path.resolve works uniformly.
  const slashNormalized = raw.replaceAll("\\", "/");
  const resolved = path.resolve(projectRoot, slashNormalized).toLowerCase();
  const root = path.resolve(projectRoot).toLowerCase();

  const rel = path.relative(root, resolved);

  // insideRoot: rel is empty (same dir), or does not start with ".." and is not absolute.
  const insideRoot = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));

  return {
    path: insideRoot ? rel.replaceAll("\\", "/") : resolved.replaceAll("\\", "/"),
    insideRoot,
  };
}

/**
 * Lightweight path normalizer for cases where projectRoot is not available
 * (legacy call sites during migration). Performs only the mechanical transforms
 * without resolving against a root.
 *
 * Prefer `canonicalProjectPath` when projectRoot is available.
 */
export function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/([a-z])\//i, "$1:/")
    .replace(/^\.\/+/, "")
    .toLowerCase();
}
