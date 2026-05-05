import { access } from "node:fs/promises";
import path from "node:path";
import {
  type ArtifactInstallSelection,
  DEFAULT_ARTIFACT_INSTALL_MANIFEST_FILE,
  type InstallCatalogArtifactsResult,
  installCatalogArtifacts,
  planArtifactInstall,
} from "./artifact-install.js";
import {
  type ArtifactRollbackBlocker,
  type ArtifactRollbackPlan,
  type RollbackCatalogArtifactsResult,
  rollbackCatalogArtifacts,
} from "./artifact-rollback.js";
import {
  type InstallManifest,
  type InstallPlatformResult,
  type InstallTarget,
  installPlatform,
  readInstallManifest,
} from "./platform-install.js";

export interface RuntimePlatformCallbacks {
  readonly apply?: (target: InstallTarget, platformDirectory: string) => Promise<unknown> | unknown;
  readonly remove?: (
    target: InstallTarget,
    platformDirectory: string,
  ) => Promise<unknown> | unknown;
}

export interface ApplyRuntimeLifecycleOptions {
  readonly projectRoot: string;
  readonly target: InstallTarget | string;
  readonly kind?: ArtifactInstallSelection;
  readonly apply?: boolean;
  readonly writeManifests?: boolean;
  readonly hookCommandPrefix?: string;
  readonly platform?: RuntimePlatformCallbacks;
  readonly now?: Date;
}

export interface RepairRuntimeLifecycleOptions {
  readonly projectRoot: string;
  readonly kind?: ArtifactInstallSelection;
  readonly apply?: boolean;
  readonly writeManifests?: boolean;
  readonly manifestFile?: string;
  readonly platform?: RuntimePlatformCallbacks;
  readonly now?: Date;
}

export interface UninstallRuntimeLifecycleOptions {
  readonly projectRoot: string;
  readonly apply?: boolean;
  readonly platformManifestFile?: string;
  readonly artifactManifestFile?: string;
  readonly platform?: RuntimePlatformCallbacks;
}

export interface RuntimeLifecycleApplyResult {
  readonly ok: boolean;
  readonly operation: "apply";
  readonly apply: boolean;
  readonly dryRun: boolean;
  readonly writeManifests: boolean;
  readonly target: InstallTarget;
  readonly kind: ArtifactInstallSelection;
  readonly projectRoot: string;
  readonly platformDirectory: string;
  readonly platformManifestFile: string;
  readonly artifactManifestFile: string;
  readonly platformInstall: InstallPlatformResult;
  readonly platformApplied?: unknown;
  readonly artifactInstall: ReturnType<typeof planArtifactInstall> | InstallCatalogArtifactsResult;
  readonly artifactsWritten: readonly string[];
  readonly artifactsUnchanged: readonly string[];
}

export interface RuntimeLifecycleRepairResult {
  readonly ok: boolean;
  readonly operation: "repair";
  readonly apply: boolean;
  readonly dryRun: boolean;
  readonly writeManifests: boolean;
  readonly target: InstallTarget;
  readonly kind: ArtifactInstallSelection;
  readonly projectRoot: string;
  readonly platformDirectory: string;
  readonly platformManifestFile: string;
  readonly artifactManifestFile: string;
  readonly manifest: InstallManifest;
  readonly platformApplied?: unknown;
  readonly artifactInstall: ReturnType<typeof planArtifactInstall> | InstallCatalogArtifactsResult;
  readonly artifactsWritten: readonly string[];
  readonly artifactsUnchanged: readonly string[];
}

export interface RuntimeLifecycleUninstallResult {
  readonly ok: boolean;
  readonly operation: "uninstall";
  readonly apply: boolean;
  readonly dryRun: boolean;
  readonly target: InstallTarget;
  readonly projectRoot: string;
  readonly platformDirectory: string;
  readonly platformManifestFile: string;
  readonly artifactManifestFile: string;
  readonly platformManifest: InstallManifest;
  readonly artifactRollback:
    | ArtifactRollbackPlan
    | RollbackCatalogArtifactsResult
    | { readonly skipped: true; readonly reason: string; readonly manifestFile: string };
  readonly platformRemoved?: unknown;
  readonly blockers: readonly ArtifactRollbackBlocker[];
  readonly artifactsDeleted: readonly string[];
  readonly artifactsRestored: readonly string[];
  readonly platformHooksRemoved: number | null;
}

export async function applyRuntimeLifecycle(
  options: ApplyRuntimeLifecycleOptions,
): Promise<RuntimeLifecycleApplyResult> {
  const apply = options.apply === true;
  const dryRun = !apply;
  const kind = options.kind ?? "all";
  const writeManifests = resolveWriteManifests(options.writeManifests, apply);
  const applyPlatform = apply ? requirePlatformApplyCallback(options.platform) : undefined;
  const platformInstall = await installPlatform({
    projectRoot: options.projectRoot,
    target: options.target,
    dryRun,
    writeManifest: writeManifests,
    hookCommandPrefix: options.hookCommandPrefix,
    now: options.now,
  });
  const target = platformInstall.target;
  const platformApplied = apply
    ? await applyPlatform?.(target, platformInstall.expectedPaths.platformDirectory)
    : undefined;
  const artifactInstall = apply
    ? await installCatalogArtifacts({
        projectRoot: platformInstall.expectedPaths.projectRoot,
        target,
        kind,
        dryRun: false,
        writeManifest: writeManifests,
        now: options.now,
      })
    : planArtifactInstall({
        projectRoot: platformInstall.expectedPaths.projectRoot,
        target,
        kind,
        dryRun: true,
      });

  return {
    ok: true,
    operation: "apply",
    apply,
    dryRun,
    writeManifests,
    target,
    kind,
    projectRoot: platformInstall.expectedPaths.projectRoot,
    platformDirectory: platformInstall.expectedPaths.platformDirectory,
    platformManifestFile: platformInstall.expectedPaths.manifestFile,
    artifactManifestFile: resolveArtifactManifestFile(platformInstall.expectedPaths.projectRoot),
    platformInstall,
    ...(platformApplied !== undefined ? { platformApplied } : {}),
    artifactInstall,
    artifactsWritten: getArtifactsWritten(artifactInstall),
    artifactsUnchanged: getArtifactsUnchanged(artifactInstall),
  };
}

export async function repairRuntimeLifecycle(
  options: RepairRuntimeLifecycleOptions,
): Promise<RuntimeLifecycleRepairResult> {
  const apply = options.apply === true;
  const dryRun = !apply;
  const kind = options.kind ?? "all";
  const writeManifests = resolveWriteManifests(options.writeManifests, apply);
  const applyPlatform = apply ? requirePlatformApplyCallback(options.platform) : undefined;
  const manifest = await readInstallManifest({
    projectRoot: options.projectRoot,
    manifestFile: options.manifestFile,
  });
  const platformApplied = apply
    ? await applyPlatform?.(manifest.target, manifest.expectedPaths.platformDirectory)
    : undefined;
  const artifactInstall = apply
    ? await installCatalogArtifacts({
        projectRoot: manifest.expectedPaths.projectRoot,
        target: manifest.target,
        kind,
        dryRun: false,
        writeManifest: writeManifests,
        now: options.now,
      })
    : planArtifactInstall({
        projectRoot: manifest.expectedPaths.projectRoot,
        target: manifest.target,
        kind,
        dryRun: true,
      });

  return {
    ok: true,
    operation: "repair",
    apply,
    dryRun,
    writeManifests,
    target: manifest.target,
    kind,
    projectRoot: manifest.expectedPaths.projectRoot,
    platformDirectory: manifest.expectedPaths.platformDirectory,
    platformManifestFile: manifest.expectedPaths.manifestFile,
    artifactManifestFile: resolveArtifactManifestFile(manifest.expectedPaths.projectRoot),
    manifest,
    ...(platformApplied !== undefined ? { platformApplied } : {}),
    artifactInstall,
    artifactsWritten: getArtifactsWritten(artifactInstall),
    artifactsUnchanged: getArtifactsUnchanged(artifactInstall),
  };
}

export async function uninstallRuntimeLifecycle(
  options: UninstallRuntimeLifecycleOptions,
): Promise<RuntimeLifecycleUninstallResult> {
  const apply = options.apply === true;
  const dryRun = !apply;
  const removePlatform = apply ? requirePlatformRemoveCallback(options.platform) : undefined;
  const platformManifest = await readInstallManifest({
    projectRoot: options.projectRoot,
    manifestFile: options.platformManifestFile,
  });
  const artifactManifestFile = resolveArtifactManifestFile(
    platformManifest.expectedPaths.projectRoot,
    options.artifactManifestFile,
  );
  const artifactRollback = await readArtifactRollbackState({
    projectRoot: platformManifest.expectedPaths.projectRoot,
    manifestFile: artifactManifestFile,
    dryRun,
  });
  const blockers = "blockers" in artifactRollback ? artifactRollback.blockers : [];
  const artifactsDeleted = "deletedPaths" in artifactRollback ? artifactRollback.deletedPaths : [];
  const artifactsRestored =
    "restoredPaths" in artifactRollback ? artifactRollback.restoredPaths : [];
  const platformRemoved =
    blockers.length === 0 && apply
      ? await removePlatform?.(
          platformManifest.target,
          platformManifest.expectedPaths.platformDirectory,
        )
      : undefined;

  return {
    ok: blockers.length === 0,
    operation: "uninstall",
    apply,
    dryRun,
    target: platformManifest.target,
    projectRoot: platformManifest.expectedPaths.projectRoot,
    platformDirectory: platformManifest.expectedPaths.platformDirectory,
    platformManifestFile: platformManifest.expectedPaths.manifestFile,
    artifactManifestFile,
    platformManifest,
    artifactRollback,
    ...(platformRemoved !== undefined ? { platformRemoved } : {}),
    blockers,
    artifactsDeleted,
    artifactsRestored,
    platformHooksRemoved: countHooksRemoved(platformRemoved),
  };
}

function requirePlatformApplyCallback(
  callbacks: RuntimePlatformCallbacks | undefined,
): NonNullable<RuntimePlatformCallbacks["apply"]> {
  if (callbacks?.apply === undefined) {
    throw new Error("Runtime lifecycle apply requires a platform apply callback.");
  }

  return callbacks.apply;
}

function requirePlatformRemoveCallback(
  callbacks: RuntimePlatformCallbacks | undefined,
): NonNullable<RuntimePlatformCallbacks["remove"]> {
  if (callbacks?.remove === undefined) {
    throw new Error("Runtime lifecycle uninstall requires a platform remove callback.");
  }

  return callbacks.remove;
}

function getArtifactsWritten(
  result: ReturnType<typeof planArtifactInstall> | InstallCatalogArtifactsResult,
): readonly string[] {
  return "writtenPaths" in result ? result.writtenPaths : [];
}

function getArtifactsUnchanged(
  result: ReturnType<typeof planArtifactInstall> | InstallCatalogArtifactsResult,
): readonly string[] {
  return "unchangedPaths" in result ? result.unchangedPaths : [];
}

function resolveWriteManifests(value: boolean | undefined, apply: boolean): boolean {
  const writeManifests = value ?? apply;

  if (writeManifests && !apply) {
    throw new Error("writeManifests requires apply:true for runtime lifecycle operations.");
  }

  return writeManifests;
}

async function readArtifactRollbackState(options: {
  readonly projectRoot: string;
  readonly manifestFile: string;
  readonly dryRun: boolean;
}): Promise<
  | ArtifactRollbackPlan
  | RollbackCatalogArtifactsResult
  | { readonly skipped: true; readonly reason: string; readonly manifestFile: string }
> {
  if (!(await pathExists(options.manifestFile))) {
    return {
      skipped: true,
      reason: "Artifact install manifest not found; artifact rollback skipped.",
      manifestFile: options.manifestFile,
    };
  }

  return rollbackCatalogArtifacts({
    projectRoot: options.projectRoot,
    manifestFile: options.manifestFile,
    dryRun: options.dryRun,
  });
}

function resolveArtifactManifestFile(projectRoot: string, manifestFile?: string): string {
  const root = path.resolve(projectRoot);
  const selectedFile = manifestFile ?? DEFAULT_ARTIFACT_INSTALL_MANIFEST_FILE;
  const targetPath = path.isAbsolute(selectedFile)
    ? path.resolve(selectedFile)
    : path.resolve(root, ...selectedFile.split(/[\\/]/));
  assertPathInsideRoot(root, targetPath, "Artifact install manifest file");

  return targetPath;
}

function assertPathInsideRoot(root: string, targetPath: string, label: string): void {
  const relativePath = path.relative(root, targetPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside the project root.`);
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function countHooksRemoved(value: unknown): number | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "hooksRemoved" in value &&
    typeof value.hooksRemoved === "number"
  ) {
    return value.hooksRemoved;
  }

  return value === undefined ? 0 : null;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
