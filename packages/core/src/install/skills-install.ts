import { readFile } from "node:fs/promises";
import { getOperationalCatalog } from "../catalogs/operational-catalog.js";
import { parseSkillFrontmatter, type SkillFrontmatter } from "../schemas/skill.schema.js";
import { safeAtomicWriteFile } from "../storage/safe-write.js";
import {
  getHimaSkillRelativePath,
  getHimaSkillScopeRoot,
  type HimaSkillScope,
  type HimaSkillScopeRoots,
  isHimaSkillScope,
  resolveHimaSkillPath,
} from "./artifact-paths.js";

export interface HimaSkillInstallDescriptor {
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
  readonly source: string;
}

export interface HimaSkillInstallAction {
  readonly kind: "write_hima_skill";
  readonly scope: HimaSkillScope;
  readonly name: string;
  readonly path: string;
  readonly relativePath: string;
  readonly dryRun: boolean;
  readonly status: "planned" | "written" | "unchanged";
}

export interface HimaSkillInstallPlan {
  readonly dryRun: boolean;
  readonly scope: HimaSkillScope;
  readonly scopeRoot: string;
  readonly skills: readonly HimaSkillInstallDescriptor[];
  readonly actions: readonly HimaSkillInstallAction[];
}

export interface InstallHimaSkillsOptions {
  readonly roots: HimaSkillScopeRoots;
  readonly scope: HimaSkillScope | string;
  readonly skills?: readonly HimaSkillInstallDescriptor[];
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

export interface InstallHimaSkillsResult extends HimaSkillInstallPlan {
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
}

const MANAGED_HEADER_PREFIX = "<!-- HIMA:SKILL-ARTIFACT";

export function buildCatalogHimaSkillDescriptors(): HimaSkillInstallDescriptor[] {
  return [...getOperationalCatalog().skills]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => {
      const expectedOutputs =
        entry.evidenceProduced.length > 0
          ? entry.evidenceProduced.map((key) => `${key}: accepted evidence`)
          : [`${entry.id}: completed skill output`];
      const frontmatter = parseSkillFrontmatter({
        name: entry.id,
        version: "1.0.0",
        type: "task",
        triggers: entry.activation.keywords,
        expected_outputs: expectedOutputs,
        requires_tools: [],
        fallback_for_toolsets: [],
        description: entry.purpose,
      });

      return {
        frontmatter,
        source: "operational-catalog",
        body: renderMarkdown([
          `# ${entry.title}`,
          "",
          entry.purpose,
          "",
          "## Activation",
          "",
          bullet("Macro cycles", entry.activation.macroCycles),
          bullet("Gate types", entry.activation.gateTypes ?? []),
          bullet("Risk classes", entry.activation.riskClasses),
          bullet("Operating modes", entry.activation.operatingModes ?? []),
          bullet("Keywords", entry.activation.keywords),
          "",
          "## Ownership",
          "",
          bullet("Owns", entry.owns),
          bullet("Out of scope", entry.outOfScope),
        ]),
      };
    });
}

export function planHimaSkillInstall(options: InstallHimaSkillsOptions): HimaSkillInstallPlan {
  const scope = parseHimaSkillScope(options.scope);
  const scopeRoot = getHimaSkillScopeRoot(scope, options.roots);
  const dryRun = options.dryRun ?? true;
  const skills = [...(options.skills ?? buildCatalogHimaSkillDescriptors())].map(validateSkill);

  return {
    dryRun,
    scope,
    scopeRoot,
    skills,
    actions: skills.map((skill) => buildSkillInstallAction(options.roots, scope, skill, dryRun)),
  };
}

export async function installHimaSkills(
  options: InstallHimaSkillsOptions,
): Promise<InstallHimaSkillsResult> {
  const plan = planHimaSkillInstall(options);

  if (plan.dryRun) {
    return {
      ...plan,
      writtenPaths: [],
      unchangedPaths: [],
    };
  }

  const writtenPaths: string[] = [];
  const unchangedPaths: string[] = [];

  for (const skill of plan.skills) {
    const action = buildSkillInstallAction(options.roots, plan.scope, skill, false);
    const content = renderSkillFile(skill);
    const existingContent = await readExistingFile(action.path);

    if (existingContent !== undefined) {
      if (!isManagedHimaSkill(existingContent, skill.frontmatter.name) && options.force !== true) {
        throw new Error(`Refusing to overwrite unmanaged HIMA skill: ${action.path}`);
      }

      if (existingContent === content) {
        unchangedPaths.push(action.path);
        continue;
      }
    }

    await safeAtomicWriteFile(plan.scopeRoot, action.path, content);
    writtenPaths.push(action.path);
  }

  const written = new Set(writtenPaths);
  const unchanged = new Set(unchangedPaths);

  return {
    ...plan,
    actions: plan.actions.map((action) => ({
      ...action,
      dryRun: false,
      status: written.has(action.path)
        ? "written"
        : unchanged.has(action.path)
          ? "unchanged"
          : action.status,
    })),
    writtenPaths,
    unchangedPaths,
  };
}

function validateSkill(skill: HimaSkillInstallDescriptor): HimaSkillInstallDescriptor {
  return {
    ...skill,
    frontmatter: parseSkillFrontmatter(skill.frontmatter),
    source: parseHimaSkillSource(skill.source),
  };
}

function buildSkillInstallAction(
  roots: HimaSkillScopeRoots,
  scope: HimaSkillScope,
  skill: HimaSkillInstallDescriptor,
  dryRun: boolean,
): HimaSkillInstallAction {
  return {
    kind: "write_hima_skill",
    scope,
    name: skill.frontmatter.name,
    path: resolveHimaSkillPath(scope, roots, skill.frontmatter.name),
    relativePath: getHimaSkillRelativePath(skill.frontmatter.name),
    dryRun,
    status: "planned",
  };
}

function renderSkillFile(skill: HimaSkillInstallDescriptor): string {
  const frontmatter = parseSkillFrontmatter(skill.frontmatter);
  return renderMarkdown([
    "---",
    `name: ${yamlString(frontmatter.name)}`,
    `version: ${yamlString(frontmatter.version)}`,
    `type: ${frontmatter.type}`,
    ...yamlArrayField("triggers", frontmatter.triggers),
    ...yamlArrayField("expected_outputs", frontmatter.expected_outputs),
    ...yamlArrayField("requires_tools", frontmatter.requires_tools),
    ...yamlArrayField("fallback_for_toolsets", frontmatter.fallback_for_toolsets),
    `description: ${yamlString(frontmatter.description)}`,
    "---",
    "",
    managedHeader(frontmatter.name, skill.source),
    "",
    skill.body.trimEnd(),
    "",
  ]);
}

function isManagedHimaSkill(content: string, name: string): boolean {
  return content.includes(`${MANAGED_HEADER_PREFIX} name=${name} source=`);
}

function managedHeader(name: string, source: string): string {
  return `${MANAGED_HEADER_PREFIX} name=${name} source=${source} -->`;
}

function renderMarkdown(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}

function bullet(label: string, values: readonly string[]): string {
  return `- ${label}: ${values.length > 0 ? values.join(", ") : "none"}`;
}

function yamlArrayField(name: string, values: readonly string[]): string[] {
  return values.length === 0
    ? [`${name}: []`]
    : [`${name}:`, ...values.map((value) => `  - ${yamlString(value)}`)];
}

function yamlString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function parseHimaSkillSource(source: string): string {
  if (/^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/u.test(source)) {
    return source;
  }

  throw new Error(`Invalid HIMA skill source "${source}".`);
}

function parseHimaSkillScope(scope: HimaSkillScope | string): HimaSkillScope {
  if (isHimaSkillScope(scope)) {
    return scope;
  }

  throw new Error(`Invalid HIMA skill scope "${scope}".`);
}

async function readExistingFile(targetPath: string): Promise<string | undefined> {
  try {
    return await readFile(targetPath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
