import type { Dirent } from "node:fs";
import { access, readdir } from "node:fs/promises";
import {
  assertSafeSkillName,
  getHimaSkillsDirectory,
  HIMA_SKILL_SCOPES,
  type HimaSkillScope,
  type HimaSkillScopeRoots,
  resolveHimaSkillPath,
} from "./artifact-paths.js";

export interface HimaSkillCandidate {
  readonly name: string;
  readonly scope: HimaSkillScope;
  readonly path: string;
  readonly precedence: number;
}

export interface HimaSkillResolution {
  readonly selected: readonly HimaSkillCandidate[];
  readonly candidates: readonly HimaSkillCandidate[];
}

const SCOPE_PRECEDENCE: Record<HimaSkillScope, number> = {
  public: 0,
  user: 1,
  org: 2,
  project: 3,
};

export async function resolveHimaSkills(
  roots: HimaSkillScopeRoots,
  scopes?: readonly HimaSkillScope[],
): Promise<HimaSkillResolution> {
  const effectiveScopes = scopes ?? getDefaultSkillScopes(roots);
  const candidates = (
    await Promise.all(effectiveScopes.map((scope) => readScopeCandidates(scope, roots)))
  )
    .flat()
    .sort(compareCandidates);
  const selectedByName = new Map<string, HimaSkillCandidate>();

  for (const candidate of candidates) {
    const existing = selectedByName.get(candidate.name);
    if (existing === undefined || candidate.precedence > existing.precedence) {
      selectedByName.set(candidate.name, candidate);
    }
  }

  return {
    candidates,
    selected: [...selectedByName.values()].sort(compareCandidates),
  };
}

export async function resolveHimaSkill(
  roots: HimaSkillScopeRoots,
  name: string,
  scopes?: readonly HimaSkillScope[],
): Promise<HimaSkillCandidate | undefined> {
  assertSafeSkillName(name);
  const resolution = await resolveHimaSkills(roots, scopes);
  return resolution.selected.find((candidate) => candidate.name === name);
}

function getDefaultSkillScopes(roots: HimaSkillScopeRoots): readonly HimaSkillScope[] {
  return roots.orgRoot === undefined
    ? HIMA_SKILL_SCOPES.filter((scope) => scope !== "org")
    : HIMA_SKILL_SCOPES;
}

async function readScopeCandidates(
  scope: HimaSkillScope,
  roots: HimaSkillScopeRoots,
): Promise<HimaSkillCandidate[]> {
  const skillsDirectory = getHimaSkillsDirectory(scope, roots);
  const entries = await safeReadDirectory(skillsDirectory);
  const candidates: HimaSkillCandidate[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      const skillPath = resolveHimaSkillPath(scope, roots, entry.name);
      await access(skillPath);
      candidates.push({
        name: entry.name,
        scope,
        path: skillPath,
        precedence: SCOPE_PRECEDENCE[scope],
      });
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        continue;
      }

      throw error;
    }
  }

  return candidates;
}

async function safeReadDirectory(directory: string): Promise<Dirent[]> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }
}

function compareCandidates(left: HimaSkillCandidate, right: HimaSkillCandidate): number {
  return left.name.localeCompare(right.name) || left.precedence - right.precedence;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
