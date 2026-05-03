import path from "node:path";
import type {
  CatalogArtifactDescriptor,
  CatalogArtifactKind,
  CatalogArtifactSelection,
} from "../catalogs/artifact-generation.js";
import {
  CATALOG_ARTIFACT_SELECTIONS,
  planCatalogArtifacts,
  writeCatalogArtifactDescriptors,
} from "../catalogs/artifact-generation.js";
import type { InstallTarget } from "./platform-install.js";
import { getPlatformExpectedPaths, INSTALL_TARGETS, isInstallTarget } from "./platform-install.js";

export const ARTIFACT_INSTALL_TARGETS = INSTALL_TARGETS;
export const ARTIFACT_INSTALL_SELECTIONS = CATALOG_ARTIFACT_SELECTIONS;

export type ArtifactInstallTarget = InstallTarget;
export type ArtifactInstallSelection = CatalogArtifactSelection;

export interface ArtifactInstallAction {
  readonly kind: "write_artifact";
  readonly target: ArtifactInstallTarget;
  readonly artifactKind: CatalogArtifactKind;
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly relativePath: string;
  readonly dryRun: boolean;
  readonly description: string;
  readonly status: "planned" | "written" | "unchanged";
}

export interface ArtifactInstallPlan {
  readonly dryRun: boolean;
  readonly projectRoot: string;
  readonly target: ArtifactInstallTarget;
  readonly platformDirectory: string;
  readonly selection: ArtifactInstallSelection;
  readonly artifacts: readonly CatalogArtifactDescriptor[];
  readonly actions: readonly ArtifactInstallAction[];
}

export interface InstallCatalogArtifactsOptions {
  readonly projectRoot: string;
  readonly target: ArtifactInstallTarget | string;
  readonly kind?: ArtifactInstallSelection;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

export interface InstallCatalogArtifactsResult extends ArtifactInstallPlan {
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
}

export function planArtifactInstall(options: InstallCatalogArtifactsOptions): ArtifactInstallPlan {
  const target = parseArtifactInstallTarget(options.target);
  const selection = options.kind ?? "all";
  assertArtifactInstallSelection(selection);

  const expectedPaths = getPlatformExpectedPaths(options.projectRoot, target);
  const artifacts = buildInstallArtifacts(selection);
  const dryRun = options.dryRun ?? true;

  return {
    dryRun,
    projectRoot: expectedPaths.projectRoot,
    target,
    platformDirectory: expectedPaths.platformDirectory,
    selection,
    artifacts,
    actions: artifacts.map((artifact) =>
      buildArtifactInstallAction(
        target,
        expectedPaths.platformDirectory,
        artifact,
        dryRun,
        "planned",
      ),
    ),
  };
}

export async function installCatalogArtifacts(
  options: InstallCatalogArtifactsOptions,
): Promise<InstallCatalogArtifactsResult> {
  const plan = planArtifactInstall(options);

  if (plan.dryRun) {
    return {
      ...plan,
      writtenPaths: [],
      unchangedPaths: [],
    };
  }

  const writeResult = await writeCatalogArtifactDescriptors({
    outputRoot: plan.platformDirectory,
    dryRun: false,
    artifacts: plan.artifacts,
    force: options.force,
  });
  const written = new Set(writeResult.writtenPaths);
  const unchanged = new Set(writeResult.unchangedPaths);

  return {
    ...plan,
    actions: plan.artifacts.map((artifact) => {
      const action = buildArtifactInstallAction(
        plan.target,
        plan.platformDirectory,
        artifact,
        false,
        "planned",
      );

      if (written.has(action.path)) {
        return { ...action, status: "written" };
      }

      if (unchanged.has(action.path)) {
        return { ...action, status: "unchanged" };
      }

      return action;
    }),
    writtenPaths: writeResult.writtenPaths,
    unchangedPaths: writeResult.unchangedPaths,
  };
}

function buildInstallArtifacts(selection: ArtifactInstallSelection): CatalogArtifactDescriptor[] {
  return planCatalogArtifacts({ kind: selection }).artifacts.map((artifact) => ({
    ...artifact,
    relativePath: toPlatformArtifactPath(artifact),
  }));
}

function toPlatformArtifactPath(artifact: CatalogArtifactDescriptor): string {
  switch (artifact.kind) {
    case "skill":
      return `skills/${artifact.id}/SKILL.md`;
    case "book":
      return `books/${artifact.id}.md`;
    case "subagent":
      return `agents/${artifact.id}.md`;
  }
}

function buildArtifactInstallAction(
  target: ArtifactInstallTarget,
  platformDirectory: string,
  artifact: CatalogArtifactDescriptor,
  dryRun: boolean,
  status: ArtifactInstallAction["status"],
): ArtifactInstallAction {
  const targetPath = path.resolve(platformDirectory, ...artifact.relativePath.split("/"));

  return {
    kind: "write_artifact",
    target,
    artifactKind: artifact.kind,
    id: artifact.id,
    title: artifact.title,
    path: targetPath,
    relativePath: artifact.relativePath,
    dryRun,
    description: `Install ${target} ${artifact.kind} catalog artifact ${artifact.id}.`,
    status,
  };
}

function parseArtifactInstallTarget(target: ArtifactInstallTarget | string): ArtifactInstallTarget {
  if (isInstallTarget(target)) {
    return target;
  }

  throw new Error(
    `Invalid artifact install target "${target}". Expected one of: ${ARTIFACT_INSTALL_TARGETS.join(", ")}.`,
  );
}

function assertArtifactInstallSelection(
  selection: string,
): asserts selection is ArtifactInstallSelection {
  if (!ARTIFACT_INSTALL_SELECTIONS.includes(selection as ArtifactInstallSelection)) {
    throw new Error(`Unknown artifact install selection: ${selection}`);
  }
}
