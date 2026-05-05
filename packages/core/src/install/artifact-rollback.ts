import { lstat, open, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import type {
  CatalogArtifactKind,
  CatalogArtifactRestoreSnapshot,
  CatalogArtifactRollbackAction,
} from "../catalogs/artifact-generation.js";
import {
  hashCatalogArtifactContent,
  isManagedCatalogArtifact,
} from "../catalogs/artifact-generation.js";
import { assertSafeDeleteTarget, safeAtomicWriteFile } from "../storage/safe-write.js";
import {
  type ArtifactInstallManifest,
  type ArtifactInstallManifestEntry,
  DEFAULT_ARTIFACT_INSTALL_MANIFEST_FILE,
} from "./artifact-install.js";
import { getPlatformArtifactRelativePath, resolvePlatformArtifactPath } from "./artifact-paths.js";
import type { InstallTarget } from "./platform-install.js";
import { getPlatformExpectedPaths, INSTALL_TARGETS, isInstallTarget } from "./platform-install.js";

const ARTIFACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ARTIFACT_KINDS = ["skill", "hook", "subagent"] as const;
const ARTIFACT_STATUSES = ["planned", "written", "unchanged"] as const;
const ROLLBACK_ACTIONS = ["delete", "restore", "none"] as const;

export type ArtifactRollbackStatus =
  | "planned"
  | "deleted"
  | "restored"
  | "skipped"
  | "blocked"
  | "manual_restore_required";

export type ArtifactRollbackBlockerCode =
  | "manifest_invalid"
  | "manual_restore_required"
  | "target_missing"
  | "target_not_safe"
  | "target_unmanaged"
  | "hash_mismatch"
  | "unsupported_action";

export interface ArtifactRollbackBlocker {
  readonly code: ArtifactRollbackBlockerCode;
  readonly message: string;
  readonly path?: string;
  readonly previousHash?: string | null;
  readonly nextHash?: string;
}

export interface ArtifactRollbackAction {
  readonly kind: "rollback_artifact";
  readonly target: InstallTarget;
  readonly artifactKind: CatalogArtifactKind;
  readonly id: string;
  readonly path: string;
  readonly relativePath: string;
  readonly rollbackAction: CatalogArtifactRollbackAction;
  readonly dryRun: boolean;
  readonly status: ArtifactRollbackStatus;
  readonly previousHash: string | null;
  readonly nextHash: string;
  readonly restoreSnapshot?: CatalogArtifactRestoreSnapshot;
  readonly blockers: readonly ArtifactRollbackBlocker[];
}

export interface ArtifactRollbackPlan {
  readonly dryRun: boolean;
  readonly projectRoot: string;
  readonly manifestFile: string;
  readonly target: InstallTarget;
  readonly platformDirectory: string;
  readonly actions: readonly ArtifactRollbackAction[];
  readonly blockers: readonly ArtifactRollbackBlocker[];
}

export interface RollbackCatalogArtifactsOptions {
  readonly projectRoot: string;
  readonly manifestFile?: string;
  readonly dryRun?: boolean;
}

export interface RollbackCatalogArtifactsResult extends ArtifactRollbackPlan {
  readonly deletedPaths: readonly string[];
  readonly restoredPaths: readonly string[];
}

export async function planCatalogArtifactRollback(
  options: RollbackCatalogArtifactsOptions,
): Promise<ArtifactRollbackPlan> {
  const projectRoot = path.resolve(options.projectRoot);
  const manifestFile = await resolveArtifactRollbackManifestFile(projectRoot, options.manifestFile);
  const manifest = await readArtifactInstallManifest(manifestFile);
  const target = parseRollbackTarget(manifest.target);
  const expectedPaths = getPlatformExpectedPaths(projectRoot, target);
  const actions: ArtifactRollbackAction[] = [];

  for (const entry of manifest.entries) {
    actions.push(
      await planRollbackAction({
        dryRun: options.dryRun ?? true,
        entry,
        platformDirectory: expectedPaths.platformDirectory,
        target,
      }),
    );
  }

  return {
    dryRun: options.dryRun ?? true,
    projectRoot,
    manifestFile,
    target,
    platformDirectory: expectedPaths.platformDirectory,
    actions,
    blockers: actions.flatMap((action) => action.blockers),
  };
}

export async function rollbackCatalogArtifacts(
  options: RollbackCatalogArtifactsOptions,
): Promise<RollbackCatalogArtifactsResult> {
  const plan = await planCatalogArtifactRollback(options);

  if (plan.dryRun || plan.blockers.length > 0) {
    return {
      ...plan,
      deletedPaths: [],
      restoredPaths: [],
    };
  }

  const deletedPaths: string[] = [];
  const restoredPaths: string[] = [];
  let actions = [...plan.actions];
  const deleteActions = actions.filter(
    (action) => action.status === "planned" && action.rollbackAction === "delete",
  );
  const restoreActions = actions.filter(
    (action) => action.status === "planned" && action.rollbackAction === "restore",
  );
  const preflightActions = await Promise.all([
    ...deleteActions.map((action) => planDeleteRollbackAction(action, plan.platformDirectory)),
    ...restoreActions.map((action) => planRestoreRollbackAction(action, plan.platformDirectory)),
  ]);
  const preflightBlockers = preflightActions.flatMap((action) => action.blockers);

  if (preflightBlockers.length > 0) {
    const preflightByPath = new Map(preflightActions.map((action) => [action.path, action]));
    return {
      ...plan,
      actions: actions.map((action) => preflightByPath.get(action.path) ?? action),
      blockers: preflightBlockers,
      deletedPaths: [],
      restoredPaths: [],
    };
  }

  const preflightByPath = new Map(preflightActions.map((action) => [action.path, action]));
  actions = actions.map((action) => preflightByPath.get(action.path) ?? action);

  for (const action of actions) {
    if (action.status !== "planned" || action.rollbackAction !== "restore") {
      continue;
    }

    const revalidatedAction = await planRestoreRollbackAction(action, plan.platformDirectory);
    if (revalidatedAction.blockers.length > 0) {
      actions = actions.map((existingAction) =>
        existingAction.path === action.path ? revalidatedAction : existingAction,
      );
      return {
        ...plan,
        actions,
        blockers: revalidatedAction.blockers,
        deletedPaths,
        restoredPaths,
      };
    }

    await safeAtomicWriteFile(
      plan.platformDirectory,
      action.path,
      requireRestoreSnapshot(action).content,
    );
    restoredPaths.push(action.path);
  }

  for (const action of actions) {
    if (action.status !== "planned" || action.rollbackAction !== "delete") {
      continue;
    }

    const revalidatedAction = await planDeleteRollbackAction(action, plan.platformDirectory);
    if (revalidatedAction.blockers.length > 0) {
      actions = actions.map((existingAction) =>
        existingAction.path === action.path ? revalidatedAction : existingAction,
      );
      return {
        ...plan,
        actions,
        blockers: revalidatedAction.blockers,
        deletedPaths,
        restoredPaths,
      };
    }

    if (revalidatedAction.status !== "planned") {
      actions = actions.map((existingAction) =>
        existingAction.path === action.path ? revalidatedAction : existingAction,
      );
      continue;
    }

    const unlinkBlocker = await safeUnlinkManagedArtifact(plan.platformDirectory, action);
    if (unlinkBlocker !== undefined) {
      actions = actions.map((existingAction) =>
        existingAction.path === action.path ? unlinkBlocker : existingAction,
      );

      if (unlinkBlocker.blockers.length > 0) {
        return {
          ...plan,
          actions,
          blockers: unlinkBlocker.blockers,
          deletedPaths,
          restoredPaths,
        };
      }

      continue;
    }

    deletedPaths.push(action.path);
  }

  return {
    ...plan,
    actions: actions.map((action) =>
      deletedPaths.includes(action.path)
        ? { ...action, status: "deleted" }
        : restoredPaths.includes(action.path)
          ? { ...action, status: "restored" }
          : action,
    ),
    deletedPaths,
    restoredPaths,
  };
}

async function planRollbackAction(options: {
  readonly dryRun: boolean;
  readonly entry: ArtifactInstallManifestEntry;
  readonly platformDirectory: string;
  readonly target: InstallTarget;
}): Promise<ArtifactRollbackAction> {
  const canonicalRelativePath = getPlatformArtifactRelativePath(
    options.entry.kind,
    options.entry.id,
  );
  const targetPath = resolvePlatformArtifactPath(
    options.platformDirectory,
    options.entry.kind,
    options.entry.id,
  );
  const baseAction = {
    kind: "rollback_artifact" as const,
    target: options.target,
    artifactKind: options.entry.kind,
    id: options.entry.id,
    path: targetPath,
    relativePath: canonicalRelativePath,
    rollbackAction: options.entry.rollback.action,
    dryRun: options.dryRun,
    previousHash: options.entry.rollback.previousHash,
    nextHash: options.entry.nextHash,
    ...(options.entry.rollback.restoreSnapshot
      ? { restoreSnapshot: options.entry.rollback.restoreSnapshot }
      : {}),
  };

  switch (options.entry.rollback.action) {
    case "none":
      return {
        ...baseAction,
        status: "skipped",
        blockers: [],
      };
    case "restore":
      return planRestoreRollbackAction(baseAction, options.platformDirectory);
    case "delete":
      return planDeleteRollbackAction(baseAction, options.platformDirectory);
    default:
      return {
        ...baseAction,
        status: "blocked",
        blockers: [
          {
            code: "unsupported_action",
            message: `Unsupported rollback action: ${String(options.entry.rollback.action)}`,
            path: targetPath,
          },
        ],
      };
  }
}

async function planDeleteRollbackAction(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
  platformDirectory: string,
): Promise<ArtifactRollbackAction> {
  if (!(await pathExists(action.path))) {
    return {
      ...action,
      status: "skipped",
      blockers: [],
    };
  }

  try {
    await assertSafeDeleteTarget(platformDirectory, action.path);
  } catch (error) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_not_safe",
          message: getErrorMessage(error),
          path: action.path,
        },
      ],
    };
  }

  const currentContent = await readFile(action.path, "utf8");
  if (!isManagedCatalogArtifact(currentContent, action.artifactKind, action.id)) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_unmanaged",
          message: "Refusing to delete a file that is not the expected managed catalog artifact.",
          path: action.path,
        },
      ],
    };
  }

  const currentHash = hashCatalogArtifactContent(currentContent);
  if (currentHash !== action.nextHash) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "hash_mismatch",
          message:
            "Refusing to delete because the current artifact hash differs from the manifest nextHash.",
          path: action.path,
          nextHash: action.nextHash,
        },
      ],
    };
  }

  return {
    ...action,
    status: "planned",
    blockers: [],
  };
}

async function safeUnlinkManagedArtifact(
  platformDirectory: string,
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
): Promise<ArtifactRollbackAction | undefined> {
  if (!(await pathExists(action.path))) {
    return {
      ...action,
      status: "skipped",
      blockers: [],
    };
  }

  try {
    await assertSafeDeleteTarget(platformDirectory, action.path);
  } catch (error) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_not_safe",
          message: getErrorMessage(error),
          path: action.path,
        },
      ],
    };
  }

  const handle = await open(action.path, "r");
  try {
    const fileIdentity = await handle.stat();
    const content = await handle.readFile("utf8");

    if (!fileIdentity.isFile()) {
      return {
        ...action,
        status: "blocked",
        blockers: [
          {
            code: "target_not_safe",
            message: "Refusing to delete non-file artifact target.",
            path: action.path,
          },
        ],
      };
    }

    const contentBlocker = validateManagedArtifactContent(action, content, {
      unmanagedMessage:
        "Refusing to delete a file that is not the expected managed catalog artifact.",
      hashMismatchMessage:
        "Refusing to delete because the current artifact hash differs from the manifest nextHash.",
    });
    if (contentBlocker !== undefined) {
      return contentBlocker;
    }

    const pathIdentityBlocker = await assertCurrentPathIdentity(action, fileIdentity);
    if (pathIdentityBlocker !== undefined) {
      return pathIdentityBlocker;
    }

    try {
      await assertSafeDeleteTarget(platformDirectory, action.path);
    } catch (error) {
      return {
        ...action,
        status: "blocked",
        blockers: [
          {
            code: "target_not_safe",
            message: getErrorMessage(error),
            path: action.path,
          },
        ],
      };
    }

    const finalIdentityBlocker = await assertCurrentPathIdentity(action, fileIdentity);
    if (finalIdentityBlocker !== undefined) {
      return finalIdentityBlocker;
    }

    await unlink(action.path);
    return undefined;
  } finally {
    await handle.close();
  }
}

async function planRestoreRollbackAction(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
  platformDirectory: string,
): Promise<ArtifactRollbackAction> {
  const restoreSnapshot = getValidRestoreSnapshot(action);
  if (restoreSnapshot === undefined) {
    return {
      ...action,
      status: "manual_restore_required",
      blockers: [
        {
          code: "manual_restore_required",
          message:
            "Previous artifact content is not stored in the install manifest; restore must be performed manually.",
          path: action.path,
          previousHash: action.previousHash,
          nextHash: action.nextHash,
        },
      ],
    };
  }

  const precondition = await verifyCurrentArtifact(action, platformDirectory, {
    missingMessage: "Cannot verify restore precondition because the target artifact is missing.",
    hashMismatchMessage:
      "Cannot verify restore precondition because the current artifact hash differs from the manifest nextHash.",
  });

  if (precondition !== undefined) {
    return precondition;
  }

  return {
    ...action,
    restoreSnapshot,
    status: "planned",
    blockers: [],
  };
}

function getValidRestoreSnapshot(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
): CatalogArtifactRestoreSnapshot | undefined {
  const restoreSnapshot = action.restoreSnapshot;
  if (restoreSnapshot === undefined || action.previousHash === null) {
    return undefined;
  }

  if (
    restoreSnapshot.encoding !== "utf8" ||
    restoreSnapshot.hash !== action.previousHash ||
    hashCatalogArtifactContent(restoreSnapshot.content) !== restoreSnapshot.hash ||
    !isManagedCatalogArtifact(restoreSnapshot.content, action.artifactKind, action.id)
  ) {
    return undefined;
  }

  return restoreSnapshot;
}

function requireRestoreSnapshot(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
): CatalogArtifactRestoreSnapshot {
  const restoreSnapshot = getValidRestoreSnapshot(action);
  if (restoreSnapshot === undefined) {
    throw new Error("Planned restore action is missing a valid restore snapshot.");
  }

  return restoreSnapshot;
}

function validateManagedArtifactContent(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
  content: string,
  messages: {
    readonly unmanagedMessage: string;
    readonly hashMismatchMessage: string;
  },
): ArtifactRollbackAction | undefined {
  if (!isManagedCatalogArtifact(content, action.artifactKind, action.id)) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_unmanaged",
          message: messages.unmanagedMessage,
          path: action.path,
        },
      ],
    };
  }

  const currentHash = hashCatalogArtifactContent(content);
  if (currentHash !== action.nextHash) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "hash_mismatch",
          message: messages.hashMismatchMessage,
          path: action.path,
          nextHash: action.nextHash,
        },
      ],
    };
  }

  return undefined;
}

async function assertCurrentPathIdentity(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
  expectedIdentity: Awaited<ReturnType<Awaited<ReturnType<typeof open>>["stat"]>>,
): Promise<ArtifactRollbackAction | undefined> {
  let currentIdentity: Awaited<ReturnType<typeof lstat>>;
  try {
    currentIdentity = await lstat(action.path);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return {
        ...action,
        status: "blocked",
        blockers: [
          {
            code: "target_missing",
            message: "Refusing to delete because the artifact target disappeared before unlink.",
            path: action.path,
          },
        ],
      };
    }

    throw error;
  }

  if (
    currentIdentity.dev !== expectedIdentity.dev ||
    currentIdentity.ino !== expectedIdentity.ino
  ) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_not_safe",
          message: "Refusing to delete because the artifact target identity changed before unlink.",
          path: action.path,
        },
      ],
    };
  }

  return undefined;
}

async function verifyCurrentArtifact(
  action: Omit<ArtifactRollbackAction, "status" | "blockers">,
  platformDirectory: string,
  messages: {
    readonly missingMessage?: string;
    readonly hashMismatchMessage: string;
  },
): Promise<ArtifactRollbackAction | undefined> {
  if (!(await pathExists(action.path))) {
    if (messages.missingMessage === undefined) {
      return {
        ...action,
        status: "skipped",
        blockers: [],
      };
    }

    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_missing",
          message: messages.missingMessage,
          path: action.path,
        },
      ],
    };
  }

  try {
    await assertSafeDeleteTarget(platformDirectory, action.path);
  } catch (error) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_not_safe",
          message: getErrorMessage(error),
          path: action.path,
        },
      ],
    };
  }

  const currentContent = await readFile(action.path, "utf8");
  if (!isManagedCatalogArtifact(currentContent, action.artifactKind, action.id)) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "target_unmanaged",
          message:
            "Refusing to operate on a file that is not the expected managed catalog artifact.",
          path: action.path,
        },
      ],
    };
  }

  const currentHash = hashCatalogArtifactContent(currentContent);
  if (currentHash !== action.nextHash) {
    return {
      ...action,
      status: "blocked",
      blockers: [
        {
          code: "hash_mismatch",
          message: messages.hashMismatchMessage,
          path: action.path,
          nextHash: action.nextHash,
        },
      ],
    };
  }

  return undefined;
}

async function resolveArtifactRollbackManifestFile(
  projectRoot: string,
  manifestFile: string | undefined,
): Promise<string> {
  const selectedFile = manifestFile ?? DEFAULT_ARTIFACT_INSTALL_MANIFEST_FILE;
  const targetPath = path.isAbsolute(selectedFile)
    ? path.resolve(selectedFile)
    : path.resolve(projectRoot, ...selectedFile.split(/[\\/]/));
  assertPathInsideRoot(projectRoot, targetPath, "Artifact rollback manifest file");

  const rootStat = await lstat(projectRoot);
  if (rootStat.isSymbolicLink()) {
    throw new Error(
      `Refusing to read artifact rollback manifest through symlinked root: ${projectRoot}`,
    );
  }

  const targetStat = await lstat(targetPath);
  if (targetStat.isSymbolicLink()) {
    throw new Error(`Refusing to read symlinked artifact rollback manifest: ${targetPath}`);
  }

  if (!targetStat.isFile()) {
    throw new Error(`Artifact rollback manifest must be a file: ${targetPath}`);
  }

  if (targetStat.nlink > 1) {
    throw new Error(`Refusing to read hardlinked artifact rollback manifest: ${targetPath}`);
  }

  const realRoot = await realpath(projectRoot);
  const realTargetPath = await realpath(targetPath);
  assertPathInsideRoot(realRoot, realTargetPath, "Artifact rollback manifest file");

  return targetPath;
}

async function readArtifactInstallManifest(manifestFile: string): Promise<ArtifactInstallManifest> {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as unknown;

  assertArtifactInstallManifest(manifest, manifestFile);

  return manifest;
}

function parseRollbackTarget(target: string): InstallTarget {
  if (isInstallTarget(target)) {
    return target;
  }

  throw new Error(
    `Invalid artifact rollback target "${target}". Expected one of: ${INSTALL_TARGETS.join(", ")}.`,
  );
}

function assertArtifactInstallManifest(
  manifest: unknown,
  manifestFile: string,
): asserts manifest is ArtifactInstallManifest {
  if (!isRecord(manifest)) {
    throw new Error(
      `Invalid artifact install manifest ${manifestFile}: manifest must be an object.`,
    );
  }

  if (manifest.schemaVersion !== 1) {
    throw new Error(`Invalid artifact install manifest ${manifestFile}: schemaVersion must be 1.`);
  }

  if (typeof manifest.target !== "string" || !isInstallTarget(manifest.target)) {
    throw new Error(
      `Invalid artifact install manifest ${manifestFile}: target must be one of ${INSTALL_TARGETS.join(", ")}.`,
    );
  }

  if (!Array.isArray(manifest.entries)) {
    throw new Error(`Invalid artifact install manifest ${manifestFile}: entries must be an array.`);
  }

  for (const [index, entry] of manifest.entries.entries()) {
    assertArtifactInstallManifestEntry(entry, manifestFile, index);
  }
}

function assertArtifactInstallManifestEntry(
  entry: unknown,
  manifestFile: string,
  index: number,
): asserts entry is ArtifactInstallManifestEntry {
  const label = `Invalid artifact install manifest ${manifestFile}: entries[${index}]`;
  if (!isRecord(entry)) {
    throw new Error(`${label} must be an object.`);
  }

  if (!ARTIFACT_KINDS.includes(entry.kind as CatalogArtifactKind)) {
    throw new Error(`${label}.kind must be one of skill, hook, subagent.`);
  }

  if (typeof entry.id !== "string" || !ARTIFACT_ID_PATTERN.test(entry.id)) {
    throw new Error(`${label}.id must match ${ARTIFACT_ID_PATTERN}.`);
  }

  if (typeof entry.path !== "string") {
    throw new Error(`${label}.path must be a string.`);
  }

  if (typeof entry.relativePath !== "string") {
    throw new Error(`${label}.relativePath must be a string.`);
  }

  if (!ARTIFACT_STATUSES.includes(entry.status as ArtifactInstallManifestEntry["status"])) {
    throw new Error(`${label}.status must be one of planned, written, unchanged.`);
  }

  assertHashOrNull(entry.previousHash, `${label}.previousHash`);
  assertHash(entry.nextHash, `${label}.nextHash`);

  if (!isRecord(entry.rollback)) {
    throw new Error(`${label}.rollback must be an object.`);
  }

  if (!ROLLBACK_ACTIONS.includes(entry.rollback.action as CatalogArtifactRollbackAction)) {
    throw new Error(`${label}.rollback.action must be one of delete, restore, none.`);
  }

  assertHashOrNull(entry.rollback.previousHash, `${label}.rollback.previousHash`);
  if (entry.rollback.previousHash !== entry.previousHash) {
    throw new Error(`${label}.rollback.previousHash must match previousHash.`);
  }

  const rollback = entry.rollback as ArtifactInstallManifestEntry["rollback"];
  if ("restoreSnapshot" in rollback) {
    assertArtifactRestoreSnapshot(
      rollback.restoreSnapshot,
      entry as unknown as ArtifactInstallManifestEntry,
      `${label}.rollback.restoreSnapshot`,
    );
  }
}

function assertArtifactRestoreSnapshot(
  snapshot: unknown,
  entry: ArtifactInstallManifestEntry,
  label: string,
): asserts snapshot is CatalogArtifactRestoreSnapshot {
  if (!isRecord(snapshot)) {
    throw new Error(`${label} must be an object.`);
  }

  if (entry.rollback.action !== "restore") {
    throw new Error(`${label} is only allowed when rollback.action is restore.`);
  }

  if (snapshot.encoding !== "utf8") {
    throw new Error(`${label}.encoding must be utf8.`);
  }

  if (typeof snapshot.content !== "string") {
    throw new Error(`${label}.content must be a string.`);
  }

  assertHash(snapshot.hash, `${label}.hash`);
  if (snapshot.hash !== entry.previousHash || snapshot.hash !== entry.rollback.previousHash) {
    throw new Error(`${label}.hash must match previousHash.`);
  }

  if (hashCatalogArtifactContent(snapshot.content) !== snapshot.hash) {
    throw new Error(`${label}.content must match hash.`);
  }

  if (!isManagedCatalogArtifact(snapshot.content, entry.kind, entry.id)) {
    throw new Error(`${label}.content must be the expected managed catalog artifact.`);
  }
}

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${label} must be a sha256 hex string.`);
  }
}

function assertHashOrNull(value: unknown, label: string): asserts value is string | null {
  if (value !== null) {
    assertHash(value, label);
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertPathInsideRoot(root: string, targetPath: string, label: string): void {
  const relativeTarget = path.relative(root, targetPath);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    throw new Error(`${label} must stay inside the project root.`);
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
