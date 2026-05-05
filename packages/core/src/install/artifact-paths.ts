import path from "node:path";
import type { CatalogArtifactKind } from "../catalogs/artifact-generation.js";

export function getPlatformArtifactRelativePath(kind: CatalogArtifactKind, id: string): string {
  switch (kind) {
    case "skill":
      return `skills/${id}/SKILL.md`;
    case "hook":
      return `hooks/${id}.md`;
    case "subagent":
      return `agents/${id}.md`;
  }
}

export function resolvePlatformArtifactPath(
  platformDirectory: string,
  kind: CatalogArtifactKind,
  id: string,
): string {
  const targetPath = path.resolve(
    platformDirectory,
    ...getPlatformArtifactRelativePath(kind, id).split("/"),
  );
  const relativeTarget = path.relative(platformDirectory, targetPath);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error("Platform artifact path must stay inside the platform directory.");
  }

  return targetPath;
}
