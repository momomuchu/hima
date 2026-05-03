import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeWriteTarget, safeAtomicWriteFile } from "../storage/safe-write.js";
import type {
  BookCatalogEntry,
  SkillCatalogEntry,
  SubagentCatalogEntry,
} from "./operational-catalog.js";
import { getOperationalCatalog } from "./operational-catalog.js";

export type CatalogArtifactKind = "skill" | "book" | "subagent";
export const CATALOG_ARTIFACT_SELECTIONS = ["all", "skills", "books", "subagents"] as const;
export type CatalogArtifactSelection = (typeof CATALOG_ARTIFACT_SELECTIONS)[number];

export interface CatalogArtifactDescriptor {
  readonly kind: CatalogArtifactKind;
  readonly id: string;
  readonly title: string;
  readonly relativePath: string;
  readonly content: string;
}

export interface CatalogArtifactPlan {
  readonly dryRun: boolean;
  readonly outputRoot: string;
  readonly artifacts: readonly CatalogArtifactDescriptor[];
}

export interface CatalogArtifactPlanOptions {
  readonly outputRoot?: string;
  readonly dryRun?: boolean;
  readonly kind?: CatalogArtifactSelection;
}

export interface WriteCatalogArtifactsOptions extends CatalogArtifactPlanOptions {
  readonly outputRoot: string;
  readonly force?: boolean;
}

export interface WriteCatalogArtifactsResult extends CatalogArtifactPlan {
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
}

export interface WriteCatalogArtifactDescriptorsOptions {
  readonly outputRoot: string;
  readonly dryRun?: boolean;
  readonly artifacts: readonly CatalogArtifactDescriptor[];
  readonly force?: boolean;
}

export interface WriteCatalogArtifactDescriptorsResult {
  readonly dryRun: boolean;
  readonly outputRoot: string;
  readonly artifacts: readonly CatalogArtifactDescriptor[];
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
}

const ARTIFACT_ROOT = "artifacts";
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MANAGED_HEADER_PREFIX = "<!-- HIMA:CATALOG-ARTIFACT";

export function planCatalogArtifacts(
  options: CatalogArtifactPlanOptions = {},
): CatalogArtifactPlan {
  const selection = options.kind ?? "all";
  assertArtifactSelection(selection);

  const catalog = getOperationalCatalog();
  const allArtifacts = [
    ...sortById(catalog.skills).map(buildSkillArtifact),
    ...sortById(catalog.books).map(buildBookArtifact),
    ...sortById(catalog.subagents).map(buildSubagentArtifact),
  ];
  const artifacts = filterArtifactsBySelection(allArtifacts, selection);

  return {
    dryRun: options.dryRun ?? true,
    outputRoot: path.resolve(options.outputRoot ?? "."),
    artifacts,
  };
}

export async function writeCatalogArtifacts(
  options: WriteCatalogArtifactsOptions,
): Promise<WriteCatalogArtifactsResult> {
  const plan = planCatalogArtifacts({
    ...options,
    dryRun: options.dryRun ?? false,
  });
  const writeResult = await writeCatalogArtifactDescriptors({
    outputRoot: plan.outputRoot,
    dryRun: plan.dryRun,
    artifacts: plan.artifacts,
    force: options.force,
  });

  return {
    ...plan,
    writtenPaths: writeResult.writtenPaths,
    unchangedPaths: writeResult.unchangedPaths,
  };
}

export async function writeCatalogArtifactDescriptors(
  options: WriteCatalogArtifactDescriptorsOptions,
): Promise<WriteCatalogArtifactDescriptorsResult> {
  const outputRoot = path.resolve(options.outputRoot);
  const dryRun = options.dryRun ?? false;

  if (dryRun) {
    return {
      dryRun,
      outputRoot,
      artifacts: options.artifacts,
      writtenPaths: [],
      unchangedPaths: [],
    };
  }

  const writtenPaths: string[] = [];
  const unchangedPaths: string[] = [];
  for (const artifact of options.artifacts) {
    const targetPath = resolveArtifactPath(outputRoot, artifact.relativePath);
    await assertSafeWriteTarget(outputRoot, targetPath);
    const existingContent = await readExistingFile(targetPath);

    if (existingContent !== undefined) {
      if (
        !isManagedCatalogArtifact(existingContent, artifact.kind, artifact.id) &&
        options.force !== true
      ) {
        throw new Error(`Refusing to overwrite unmanaged catalog artifact: ${targetPath}`);
      }

      if (existingContent === artifact.content) {
        unchangedPaths.push(targetPath);
        continue;
      }
    }

    await safeAtomicWriteFile(outputRoot, targetPath, artifact.content);
    writtenPaths.push(targetPath);
  }

  return {
    dryRun,
    outputRoot,
    artifacts: options.artifacts,
    writtenPaths,
    unchangedPaths,
  };
}

function buildSkillArtifact(entry: SkillCatalogEntry): CatalogArtifactDescriptor {
  assertSafeId(entry.id);
  const content = renderMarkdown([
    "---",
    `name: ${yamlString(entry.id)}`,
    `description: ${yamlString(entry.purpose)}`,
    "---",
    "",
    managedHeader("skill", entry.id),
    "",
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
    bullet("Automatic", [String(entry.activation.auto)]),
    "",
    "## Ownership",
    "",
    bullet("Owns", entry.owns),
    bullet("Out of scope", entry.outOfScope),
    "",
    "## References",
    "",
    bullet("Evidence produced", entry.evidenceProduced),
    bullet("Books", entry.bookRefs),
    bullet("Subagents", entry.subagentRefs),
  ]);

  return artifact(
    "skill",
    entry.id,
    entry.title,
    `${ARTIFACT_ROOT}/skills/${entry.id}/SKILL.md`,
    content,
  );
}

function buildBookArtifact(entry: BookCatalogEntry): CatalogArtifactDescriptor {
  assertSafeId(entry.id);
  const content = renderMarkdown([
    managedHeader("book", entry.id),
    "",
    `# ${entry.title}`,
    "",
    entry.purpose,
    "",
    "## Applicability",
    "",
    bullet("Macro cycles", entry.macroCycles),
    bullet("Gate types", entry.gateTypes),
    bullet("Risk classes", entry.riskClasses),
    bullet("Operating modes", entry.operatingModes),
    "",
    "## References",
    "",
    bullet("Evidence keys", entry.evidenceKeys),
    bullet("Skills", entry.skillRefs),
    bullet("Subagents", entry.subagentRefs),
  ]);

  return artifact("book", entry.id, entry.title, `${ARTIFACT_ROOT}/books/${entry.id}.md`, content);
}

function buildSubagentArtifact(entry: SubagentCatalogEntry): CatalogArtifactDescriptor {
  assertSafeId(entry.id);
  const applicability = Object.entries(entry.spawn.applicabilityByRisk)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([riskClass, value]) => `${riskClass}=${value}`);
  const content = renderMarkdown([
    managedHeader("subagent", entry.id),
    "",
    `# ${entry.title}`,
    "",
    entry.purpose,
    "",
    "## Spawn Rules",
    "",
    bullet("Macro cycles", entry.spawn.macroCycles),
    bullet("Gate types", entry.spawn.gateTypes),
    bullet("Minimum risk class", [entry.spawn.minimumRiskClass]),
    bullet("Applicability by risk", applicability),
    bullet("Operating modes", entry.spawn.operatingModes ?? []),
    bullet("Max parallel safe", [String(entry.maxParallelSafe)]),
    "",
    "## References",
    "",
    bullet("Evidence produced", entry.evidenceProduced),
    bullet("Books", entry.bookRefs),
    bullet("Skills", entry.skillRefs),
  ]);

  return artifact(
    "subagent",
    entry.id,
    entry.title,
    `${ARTIFACT_ROOT}/subagents/${entry.id}.md`,
    content,
  );
}

function artifact(
  kind: CatalogArtifactKind,
  id: string,
  title: string,
  relativePath: string,
  content: string,
): CatalogArtifactDescriptor {
  assertAscii(content, relativePath);

  return {
    kind,
    id,
    title,
    relativePath,
    content,
  };
}

function renderMarkdown(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}

function bullet(label: string, values: readonly string[]): string {
  const renderedValues = values.length > 0 ? values.join(", ") : "none";
  return `- ${label}: ${renderedValues}`;
}

function yamlString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function managedHeader(kind: CatalogArtifactKind, id: string): string {
  return `${MANAGED_HEADER_PREFIX} kind=${kind} id=${id} source=operational-catalog -->`;
}

function isManagedCatalogArtifact(content: string, kind: CatalogArtifactKind, id: string): boolean {
  const lines = content.split(/\r?\n/);
  const expectedHeader = managedHeader(kind, id);

  if (kind === "skill") {
    return lines[5] === expectedHeader;
  }

  return lines[0] === expectedHeader;
}

function filterArtifactsBySelection(
  artifacts: readonly CatalogArtifactDescriptor[],
  selection: CatalogArtifactSelection,
): CatalogArtifactDescriptor[] {
  if (selection === "all") {
    return [...artifacts];
  }

  const kind = selection.slice(0, -1) as CatalogArtifactKind;

  return artifacts.filter((artifact) => artifact.kind === kind);
}

function sortById<T extends { readonly id: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((left, right) => left.id.localeCompare(right.id));
}

function assertSafeId(id: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`Catalog entry id "${id}" is not a safe artifact id.`);
  }
}

function assertArtifactSelection(selection: string): asserts selection is CatalogArtifactSelection {
  if (!CATALOG_ARTIFACT_SELECTIONS.includes(selection as CatalogArtifactSelection)) {
    throw new Error(`Unknown catalog artifact selection: ${selection}`);
  }
}

function assertAscii(content: string, relativePath: string): void {
  for (const char of content) {
    if (char.charCodeAt(0) > 127) {
      throw new Error(`Catalog artifact content must be ASCII: ${relativePath}`);
    }
  }
}

function resolveArtifactPath(outputRoot: string, relativePath: string): string {
  const targetPath = path.resolve(outputRoot, ...relativePath.split("/"));
  const relativeTarget = path.relative(outputRoot, targetPath);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error("Catalog artifact path must stay inside the output root.");
  }

  return targetPath;
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
