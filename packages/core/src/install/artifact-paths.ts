import path from "node:path";
import type { CatalogArtifactKind } from "../catalogs/artifact-generation.js";

export const HIMA_SKILL_SCOPES = ["public", "user", "org", "project"] as const;
export type HimaSkillScope = (typeof HIMA_SKILL_SCOPES)[number];

export interface HimaSkillScopeRoots {
  readonly publicRoot: string;
  readonly userHome: string;
  readonly orgRoot?: string;
  readonly projectRoot: string;
}

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

export function isHimaSkillScope(value: string): value is HimaSkillScope {
  return HIMA_SKILL_SCOPES.includes(value as HimaSkillScope);
}

export function getHimaSkillScopeRoot(scope: HimaSkillScope, roots: HimaSkillScopeRoots): string {
  switch (scope) {
    case "public":
      return path.resolve(roots.publicRoot);
    case "user":
      return path.resolve(roots.userHome);
    case "org":
      if (roots.orgRoot === undefined) {
        throw new Error("org skill scope requires orgRoot.");
      }
      return path.resolve(roots.orgRoot);
    case "project":
      return path.resolve(roots.projectRoot);
  }
}

export function getHimaSkillsDirectory(scope: HimaSkillScope, roots: HimaSkillScopeRoots): string {
  return path.join(getHimaSkillScopeRoot(scope, roots), ".hima", "skills");
}

export function getHimaSkillRelativePath(name: string): string {
  assertSafeSkillName(name);
  return `skills/${name}/SKILL.md`;
}

export function resolveHimaSkillPath(
  scope: HimaSkillScope,
  roots: HimaSkillScopeRoots,
  name: string,
): string {
  const scopeRoot = getHimaSkillScopeRoot(scope, roots);
  const targetPath = path.resolve(scopeRoot, ".hima", ...getHimaSkillRelativePath(name).split("/"));
  const relativeTarget = path.relative(scopeRoot, targetPath);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error("HIMA skill path must stay inside its scope root.");
  }

  return targetPath;
}

function assertSafeSkillName(name: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) {
    throw new Error(`Skill name "${name}" is not a safe HIMA skill name.`);
  }
}

export { assertSafeSkillName };
