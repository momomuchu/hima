import path from "node:path";
import type {
  CatalogArtifactDescriptor,
  CatalogArtifactKind,
  CatalogArtifactSelection,
  CatalogArtifactWriteMetadata,
} from "../catalogs/artifact-generation.js";
import {
  CATALOG_ARTIFACT_SELECTIONS,
  planCatalogArtifacts,
  writeCatalogArtifactDescriptors,
} from "../catalogs/artifact-generation.js";
import { safeAtomicWriteFile } from "../storage/safe-write.js";
import { getPlatformArtifactRelativePath, resolvePlatformArtifactPath } from "./artifact-paths.js";
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
  readonly writeManifest?: boolean;
  readonly captureRestoreSnapshots?: boolean;
  readonly now?: Date;
  readonly manifestFile?: string;
}

export interface InstallCatalogArtifactsResult extends ArtifactInstallPlan {
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
  readonly manifest: ArtifactInstallManifest;
  readonly manifestFile?: string;
}

export interface ArtifactInstallManifest {
  readonly schemaVersion: 1;
  readonly target: ArtifactInstallTarget;
  readonly projectRoot: string;
  readonly platformDirectory: string;
  readonly dryRun: boolean;
  readonly createdAt: string;
  readonly selection: ArtifactInstallSelection;
  readonly kind: ArtifactInstallSelection;
  readonly entries: readonly ArtifactInstallManifestEntry[];
  readonly writtenCount: number;
  readonly unchangedCount: number;
}

export interface ArtifactInstallManifestEntry extends CatalogArtifactWriteMetadata {}

export const DEFAULT_ARTIFACT_INSTALL_MANIFEST_FILE = ".planning/artifact-install-manifest.json";

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
  const createdAt = (options.now ?? new Date()).toISOString();

  if (plan.dryRun) {
    if (options.writeManifest === true) {
      throw new Error("Cannot write artifact install manifest during dry-run.");
    }

    const writePlan = await writeCatalogArtifactDescriptors({
      outputRoot: plan.platformDirectory,
      dryRun: true,
      artifacts: plan.artifacts,
      force: options.force,
    });
    const manifest = buildArtifactInstallManifest(plan, writePlan.writeMetadata, createdAt);

    return {
      ...plan,
      writtenPaths: [],
      unchangedPaths: [],
      manifest,
    };
  }

  const writeResult = await writeCatalogArtifactDescriptors({
    outputRoot: plan.platformDirectory,
    dryRun: false,
    artifacts: plan.artifacts,
    force: options.force,
    captureRestoreSnapshots: options.captureRestoreSnapshots,
  });
  const written = new Set(writeResult.writtenPaths);
  const unchanged = new Set(writeResult.unchangedPaths);
  const manifest = buildArtifactInstallManifest(plan, writeResult.writeMetadata, createdAt);
  const manifestFile =
    options.writeManifest === true
      ? await writeArtifactInstallManifest(plan.projectRoot, manifest, options.manifestFile)
      : undefined;

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
    manifest,
    ...(manifestFile ? { manifestFile } : {}),
  };
}

function buildInstallArtifacts(selection: ArtifactInstallSelection): CatalogArtifactDescriptor[] {
  return planCatalogArtifacts({ kind: selection }).artifacts.map((artifact) => ({
    ...artifact,
    relativePath: getPlatformArtifactRelativePath(artifact.kind, artifact.id),
  }));
}

function buildArtifactInstallAction(
  target: ArtifactInstallTarget,
  platformDirectory: string,
  artifact: CatalogArtifactDescriptor,
  dryRun: boolean,
  status: ArtifactInstallAction["status"],
): ArtifactInstallAction {
  const targetPath = resolvePlatformArtifactPath(platformDirectory, artifact.kind, artifact.id);

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

function buildArtifactInstallManifest(
  plan: ArtifactInstallPlan,
  entries: readonly CatalogArtifactWriteMetadata[],
  createdAt: string,
): ArtifactInstallManifest {
  return {
    schemaVersion: 1,
    target: plan.target,
    projectRoot: plan.projectRoot,
    platformDirectory: plan.platformDirectory,
    dryRun: plan.dryRun,
    createdAt,
    selection: plan.selection,
    kind: plan.selection,
    entries,
    writtenCount: entries.filter((entry) => entry.status === "written").length,
    unchangedCount: entries.filter((entry) => entry.status === "unchanged").length,
  };
}

async function writeArtifactInstallManifest(
  projectRoot: string,
  manifest: ArtifactInstallManifest,
  manifestFile: string | undefined,
): Promise<string> {
  const targetPath = resolveManifestFile(projectRoot, manifestFile);
  await safeAtomicWriteFile(projectRoot, targetPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return targetPath;
}

function resolveManifestFile(projectRoot: string, manifestFile: string | undefined): string {
  const selectedFile = manifestFile ?? DEFAULT_ARTIFACT_INSTALL_MANIFEST_FILE;
  return path.isAbsolute(selectedFile)
    ? path.resolve(selectedFile)
    : path.resolve(projectRoot, ...selectedFile.split(/[\\/]/));
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
