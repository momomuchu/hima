// Ported from packages/core/src/gates/canonical-path.ts — no changes

import path from "node:path";

export interface CanonicalPathResult {
  readonly path: string;
  readonly insideRoot: boolean;
}

export function canonicalProjectPath(raw: string, projectRoot: string): CanonicalPathResult {
  const slashNormalized = raw.replaceAll("\\", "/");
  const resolved = path.resolve(projectRoot, slashNormalized).toLowerCase();
  const root = path.resolve(projectRoot).toLowerCase();
  const rel = path.relative(root, resolved);
  const insideRoot = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));

  return {
    path: insideRoot ? rel.replaceAll("\\", "/") : resolved.replaceAll("\\", "/"),
    insideRoot,
  };
}

export function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\/([a-z])\//i, "$1:/")
    .replace(/^\.\/+/, "")
    .toLowerCase();
}
