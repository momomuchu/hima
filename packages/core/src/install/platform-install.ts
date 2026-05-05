import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  getRuntimeHookProfiles,
  getRuntimeProfile,
  isRuntimeTarget,
  RUNTIME_TARGETS,
  type RuntimeTarget,
} from "../runtime/runtime-profiles.js";
import { safeAtomicWriteFile } from "../storage/safe-write.js";
import { GATE_TYPES, type GateType } from "../types/canonical.js";

export const INSTALL_TARGETS = RUNTIME_TARGETS;

export type InstallTarget = RuntimeTarget;

export interface PlatformExpectedPaths {
  projectRoot: string;
  platformDirectory: string;
  hooksDirectory: string;
  manifestFile: string;
}

export interface PlatformCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  path?: string;
}

export interface PlannedInstallAction {
  kind: "ensure_directory" | "write_manifest" | "register_hook" | "set_feature_flag";
  path: string;
  dryRun: boolean;
  description: string;
  gateType?: GateType;
  nativeEvent?: string | null;
  command?: string;
  canBlock?: boolean;
  supported?: boolean;
  status?: "planned" | "missing" | "noop";
  featureFlag?: string;
  value?: boolean;
}

export interface InstallManifest {
  schemaVersion: 1;
  target: InstallTarget;
  dryRun: boolean;
  createdAt: string;
  expectedPaths: PlatformExpectedPaths;
  plannedActions: PlannedInstallAction[];
  checks: PlatformCheck[];
  warnings: string[];
}

export interface PlatformDetection {
  target: InstallTarget;
  detected: boolean;
  expectedPaths: PlatformExpectedPaths;
  checks: PlatformCheck[];
  warnings: string[];
}

export interface PlatformValidation {
  target: InstallTarget;
  expectedPaths: PlatformExpectedPaths;
  plannedActions: PlannedInstallAction[];
  checks: PlatformCheck[];
  warnings: string[];
}

export interface InstallPlatformOptions {
  projectRoot: string;
  target: InstallTarget | string;
  dryRun?: boolean;
  writeManifest?: boolean;
  hookCommandPrefix?: string;
  now?: Date;
}

export interface ReadInstallManifestOptions {
  projectRoot: string;
  manifestFile?: string;
}

export interface InstallPlatformResult extends PlatformValidation {
  dryRun: boolean;
  manifest?: InstallManifest;
  manifestWritten: boolean;
}

const PLATFORM_DIRECTORIES: Record<InstallTarget, string> = {
  claude: ".claude",
  codex: ".codex",
  hermes: ".hermes",
};

export function isInstallTarget(value: string): value is InstallTarget {
  return isRuntimeTarget(value);
}

export function getPlatformExpectedPaths(
  projectRoot: string,
  target: InstallTarget,
): PlatformExpectedPaths {
  const root = path.resolve(projectRoot);
  const platformDirectory = path.join(root, PLATFORM_DIRECTORIES[target]);

  return {
    projectRoot: root,
    platformDirectory,
    hooksDirectory: path.join(platformDirectory, "hooks"),
    manifestFile: path.join(root, ".planning", "install-manifest.json"),
  };
}

export function getDefaultInstallManifestFile(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".planning", "install-manifest.json");
}

export function applyHookCommandPrefix(command: string, hookCommandPrefix?: string): string {
  const prefix = hookCommandPrefix?.trim();

  if (!prefix) {
    return command;
  }

  const commandSuffix = command.startsWith("harness ") ? command.slice("harness ".length) : command;
  return `${prefix} ${commandSuffix}`;
}

export function extractInstallManifestHookCommands(
  manifest: InstallManifest,
): Partial<Record<GateType, string>> {
  return Object.fromEntries(
    manifest.plannedActions.flatMap((action) =>
      action.kind === "register_hook" &&
      action.supported !== false &&
      action.gateType !== undefined &&
      action.command !== undefined
        ? [[action.gateType, action.command]]
        : [],
    ),
  ) as Partial<Record<GateType, string>>;
}

export async function readInstallManifest(
  options: ReadInstallManifestOptions,
): Promise<InstallManifest> {
  const projectRoot = path.resolve(options.projectRoot);
  const manifestFile = path.resolve(
    options.manifestFile ?? getDefaultInstallManifestFile(projectRoot),
  );

  assertPathInsideRoot(projectRoot, manifestFile, "Install manifest path");
  await assertSafeManifestReadTarget(projectRoot, manifestFile);

  const parsed = JSON.parse(await readFile(manifestFile, "utf8")) as unknown;
  const manifest = parseInstallManifest(parsed);
  const expectedPaths = getPlatformExpectedPaths(projectRoot, manifest.target);

  if (path.resolve(manifest.expectedPaths.projectRoot) !== expectedPaths.projectRoot) {
    throw new Error("Install manifest projectRoot does not match the selected project root.");
  }

  if (path.resolve(manifest.expectedPaths.manifestFile) !== manifestFile) {
    throw new Error("Install manifest path does not match the selected manifest file.");
  }

  if (path.resolve(manifest.expectedPaths.platformDirectory) !== expectedPaths.platformDirectory) {
    throw new Error("Install manifest platform directory does not match its target.");
  }

  if (path.resolve(manifest.expectedPaths.hooksDirectory) !== expectedPaths.hooksDirectory) {
    throw new Error("Install manifest hooks directory does not match its target.");
  }

  return manifest;
}

export async function detectPlatform(
  projectRoot: string,
  target: InstallTarget | string,
): Promise<PlatformDetection> {
  const installTarget = parseInstallTarget(target);
  const expectedPaths = getPlatformExpectedPaths(projectRoot, installTarget);
  const checks: PlatformCheck[] = [
    await pathExistsCheck("platform_directory", expectedPaths.platformDirectory),
    await pathExistsCheck("hooks_directory", expectedPaths.hooksDirectory),
  ];
  const detected = checks.some((check) => check.status === "pass");
  const warnings = detected ? [] : [`No existing ${installTarget} platform files detected.`];

  return {
    target: installTarget,
    detected,
    expectedPaths,
    checks,
    warnings,
  };
}

export async function validatePlatformInstall(
  options: InstallPlatformOptions,
): Promise<PlatformValidation> {
  const target = parseInstallTarget(options.target);
  const expectedPaths = getPlatformExpectedPaths(options.projectRoot, target);
  assertManifestPathInsideRoot(expectedPaths);

  const detection = await detectPlatform(expectedPaths.projectRoot, target);
  const dryRun = options.dryRun ?? true;
  const plannedActions: PlannedInstallAction[] = [
    {
      kind: "ensure_directory",
      path: expectedPaths.platformDirectory,
      dryRun: true,
      description: `Plan ${target} platform directory creation.`,
    },
    {
      kind: "ensure_directory",
      path: expectedPaths.hooksDirectory,
      dryRun: true,
      description: `Plan ${target} hooks directory creation.`,
    },
    ...buildHookRegistrationActions(
      target,
      expectedPaths.hooksDirectory,
      options.hookCommandPrefix,
    ),
    ...buildFeatureFlagActions(target, expectedPaths.platformDirectory),
  ];

  if (options.writeManifest === true) {
    plannedActions.push({
      kind: "write_manifest",
      path: expectedPaths.manifestFile,
      dryRun: false,
      description: "Write install manifest for the planned platform install.",
    });
  }

  const warnings = [...detection.warnings];
  if (dryRun) {
    warnings.push("Dry-run mode: platform files will not be created.");
  }

  return {
    target,
    expectedPaths,
    plannedActions,
    checks: detection.checks,
    warnings,
  };
}

function buildHookRegistrationActions(
  target: InstallTarget,
  hooksDirectory: string,
  hookCommandPrefix?: string,
): PlannedInstallAction[] {
  return getRuntimeHookProfiles(target).map((hook) => ({
    kind: "register_hook",
    path: hooksDirectory,
    dryRun: true,
    description: hook.supported
      ? `Plan ${target} ${hook.gateType} hook registration.`
      : `Record ${target} ${hook.gateType} hook as missing/noop.`,
    gateType: hook.gateType,
    nativeEvent: hook.nativeEvent,
    command: applyHookCommandPrefix(hook.command, hookCommandPrefix),
    canBlock: hook.canBlock,
    supported: hook.supported,
    status: hook.supported ? "planned" : "missing",
  }));
}

function buildFeatureFlagActions(
  target: InstallTarget,
  platformDirectory: string,
): PlannedInstallAction[] {
  const profile = getRuntimeProfile(target);

  return Object.entries(profile.featureFlags).map(([featureFlag, value]) => ({
    kind: "set_feature_flag",
    path: platformDirectory,
    dryRun: true,
    description: `Plan ${target} feature flag ${featureFlag}=${value}.`,
    featureFlag,
    value,
    status: "planned",
  }));
}

export async function installPlatform(
  options: InstallPlatformOptions,
): Promise<InstallPlatformResult> {
  const dryRun = options.dryRun ?? true;
  const validation = await validatePlatformInstall(options);
  const manifest = buildInstallManifest(validation, dryRun, options.now ?? new Date());

  if (options.writeManifest === true) {
    await safeAtomicWriteFile(
      validation.expectedPaths.projectRoot,
      validation.expectedPaths.manifestFile,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  return {
    ...validation,
    dryRun,
    manifest,
    manifestWritten: options.writeManifest === true,
  };
}

function parseInstallTarget(target: InstallTarget | string): InstallTarget {
  if (isInstallTarget(target)) {
    return target;
  }

  throw new Error(
    `Invalid install target "${target}". Expected one of: ${INSTALL_TARGETS.join(", ")}.`,
  );
}

async function pathExistsCheck(name: string, checkPath: string): Promise<PlatformCheck> {
  try {
    await access(checkPath);
    return {
      name,
      status: "pass",
      message: "Path exists.",
      path: checkPath,
    };
  } catch {
    return {
      name,
      status: "warn",
      message: "Path does not exist.",
      path: checkPath,
    };
  }
}

function assertManifestPathInsideRoot(expectedPaths: PlatformExpectedPaths): void {
  assertPathInsideRoot(
    expectedPaths.projectRoot,
    expectedPaths.manifestFile,
    "Install manifest path",
  );
}

function buildInstallManifest(
  validation: PlatformValidation,
  dryRun: boolean,
  now: Date,
): InstallManifest {
  return {
    schemaVersion: 1,
    target: validation.target,
    dryRun,
    createdAt: now.toISOString(),
    expectedPaths: validation.expectedPaths,
    plannedActions: validation.plannedActions,
    checks: validation.checks,
    warnings: validation.warnings,
  };
}

async function assertSafeManifestReadTarget(root: string, manifestFile: string): Promise<void> {
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Refusing to read install manifest through symlinked root: ${root}`);
  }

  const realRoot = await realpath(root);
  await assertNoSymlinkParents(root, path.dirname(manifestFile), realRoot);

  const targetStat = await lstat(manifestFile);
  if (targetStat.isSymbolicLink()) {
    throw new Error(`Refusing to read symlinked install manifest: ${manifestFile}`);
  }

  if (!targetStat.isFile()) {
    throw new Error(`Install manifest must be a file: ${manifestFile}`);
  }

  if (targetStat.nlink > 1) {
    throw new Error(`Refusing to trust hardlinked install manifest: ${manifestFile}`);
  }

  assertPathInsideRoot(realRoot, await realpath(manifestFile), "Install manifest real path");
}

async function assertNoSymlinkParents(
  root: string,
  targetDirectory: string,
  realRoot: string,
): Promise<void> {
  let currentPath = path.resolve(root);
  const relativeDirectory = path.relative(currentPath, targetDirectory);
  const segments = relativeDirectory
    .split(path.sep)
    .filter((segment) => segment.length > 0 && segment !== ".");

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    const stat = await safeLstat(currentPath);

    if (stat === undefined) {
      throw new Error(`Install manifest parent directory does not exist: ${currentPath}`);
    }

    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to read install manifest through symlinked parent: ${currentPath}`);
    }

    if (stat.isDirectory()) {
      assertPathInsideRoot(realRoot, await realpath(currentPath), "Install manifest parent");
    }
  }
}

function assertPathInsideRoot(root: string, targetPath: string, label: string): void {
  const relativePath = path.relative(root, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside the project root.`);
  }
}

async function safeLstat(
  targetPath: string,
): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }
}

function parseInstallManifest(value: unknown): InstallManifest {
  const manifest = readRecord(value, "install manifest");
  const schemaVersion = readNumber(manifest, "schemaVersion");
  if (schemaVersion !== 1) {
    throw new Error("Install manifest schemaVersion must be 1.");
  }

  const target = parseInstallTarget(readString(manifest, "target"));

  return {
    schemaVersion: 1,
    target,
    dryRun: readBoolean(manifest, "dryRun"),
    createdAt: readString(manifest, "createdAt"),
    expectedPaths: parseExpectedPaths(manifest.expectedPaths),
    plannedActions: parseArray(manifest.plannedActions, "plannedActions").map((action, index) =>
      parsePlannedAction(action, index),
    ),
    checks: parseArray(manifest.checks, "checks").map((check, index) =>
      parsePlatformCheck(check, index),
    ),
    warnings: parseArray(manifest.warnings, "warnings").map((warning, index) =>
      readArrayString(warning, `warnings[${index}]`),
    ),
  };
}

function parseExpectedPaths(value: unknown): PlatformExpectedPaths {
  const expectedPaths = readRecord(value, "expectedPaths");

  return {
    projectRoot: readString(expectedPaths, "projectRoot"),
    platformDirectory: readString(expectedPaths, "platformDirectory"),
    hooksDirectory: readString(expectedPaths, "hooksDirectory"),
    manifestFile: readString(expectedPaths, "manifestFile"),
  };
}

function parsePlatformCheck(value: unknown, index: number): PlatformCheck {
  const check = readRecord(value, `checks[${index}]`);
  const status = readString(check, "status");

  if (!["pass", "warn", "fail"].includes(status)) {
    throw new Error(`checks[${index}].status is invalid.`);
  }

  return {
    name: readString(check, "name"),
    status: status as PlatformCheck["status"],
    message: readString(check, "message"),
    ...(typeof check.path === "string" ? { path: check.path } : {}),
  };
}

function parsePlannedAction(value: unknown, index: number): PlannedInstallAction {
  const action = readRecord(value, `plannedActions[${index}]`);
  const kind = readString(action, "kind");
  if (!["ensure_directory", "write_manifest", "register_hook", "set_feature_flag"].includes(kind)) {
    throw new Error(`plannedActions[${index}].kind is invalid.`);
  }

  const parsedAction: PlannedInstallAction = {
    kind: kind as PlannedInstallAction["kind"],
    path: readString(action, "path"),
    dryRun: readBoolean(action, "dryRun"),
    description: readString(action, "description"),
  };

  if (typeof action.gateType === "string") {
    if (!GATE_TYPES.includes(action.gateType as GateType)) {
      throw new Error(`plannedActions[${index}].gateType is invalid.`);
    }
    parsedAction.gateType = action.gateType as GateType;
  }

  if (typeof action.nativeEvent === "string" || action.nativeEvent === null) {
    parsedAction.nativeEvent = action.nativeEvent;
  }

  if (typeof action.command === "string") {
    parsedAction.command = action.command;
  }

  if (typeof action.canBlock === "boolean") {
    parsedAction.canBlock = action.canBlock;
  }

  if (typeof action.supported === "boolean") {
    parsedAction.supported = action.supported;
  }

  if (typeof action.status === "string") {
    if (!["planned", "missing", "noop"].includes(action.status)) {
      throw new Error(`plannedActions[${index}].status is invalid.`);
    }
    parsedAction.status = action.status as PlannedInstallAction["status"];
  }

  if (typeof action.featureFlag === "string") {
    parsedAction.featureFlag = action.featureFlag;
  }

  if (typeof action.value === "boolean") {
    parsedAction.value = action.value;
  }

  return parsedAction;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }

  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`${key} must be a number.`);
  }

  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean.`);
  }

  return value;
}

function parseArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function readArrayString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
