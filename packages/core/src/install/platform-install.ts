import { access } from "node:fs/promises";
import path from "node:path";
import {
  getRuntimeHookProfiles,
  getRuntimeProfile,
  isRuntimeTarget,
  RUNTIME_TARGETS,
  type RuntimeTarget,
} from "../runtime/runtime-profiles.js";
import { atomicWriteFile } from "../storage/atomic-write.js";
import type { GateType } from "../types/canonical.js";

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
  now?: Date;
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
    ...buildHookRegistrationActions(target, expectedPaths.hooksDirectory),
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
    command: hook.command,
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
    await atomicWriteFile(
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
  const relativeManifestPath = path.relative(expectedPaths.projectRoot, expectedPaths.manifestFile);
  if (relativeManifestPath.startsWith("..") || path.isAbsolute(relativeManifestPath)) {
    throw new Error("Install manifest path must stay inside the project root.");
  }
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
