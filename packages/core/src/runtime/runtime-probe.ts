import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  extractInstallManifestHookCommands,
  getDefaultInstallManifestFile,
  getPlatformExpectedPaths,
  type InstallManifest,
  readInstallManifest,
} from "../install/platform-install.js";
import { RISK_POLICY } from "../policy/baseline-policy.js";
import type {
  RuntimeBinding,
  RuntimeCapability,
  RuntimeHookCapabilityInput,
} from "../schemas/run-set.schema.js";
import { handleHook } from "../services/handle-hook.js";
import {
  createDefaultPlanningProject,
  type PlanningProject,
  writePlanningProject,
} from "../storage/planning-store.js";
import { GATE_TYPES, type GateType, RISK_CLASS_RANK } from "../types/canonical.js";
import {
  bindRuntime,
  computeRuntimeProfileDigest,
  inspectRuntimeWithTrustedProofs,
} from "./runtime-bindings.js";
import { getRuntimeProfile, isRuntimeTarget, type RuntimeTarget } from "./runtime-profiles.js";
import {
  createTrustedRuntimeProbeProof,
  TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
} from "./runtime-proofs.js";

export interface ProbeRuntimeOptions {
  readonly inspectedAt?: string;
  readonly runtimeVersion?: string;
  readonly bind?: boolean;
  readonly verifyBlockingFixtures?: boolean;
}

export interface RuntimeProbeResult {
  readonly target: RuntimeTarget;
  readonly runtimeVersion: string;
  readonly inspectedAt: string;
  readonly configFile: string;
  readonly configRead: boolean;
  readonly manifestFile: string;
  readonly manifestRead: boolean;
  readonly profileDigest: string;
  readonly configDigest?: string;
  readonly registeredHooks: readonly GateType[];
  readonly verifiedBlockingFixtures: readonly GateType[];
  readonly missingHooks: readonly GateType[];
  readonly capability: RuntimeCapability;
  readonly bindings?: Record<GateType, RuntimeBinding>;
}

const RUNTIME_CONFIG_FILES: Record<RuntimeTarget, string> = {
  claude: "settings.json",
  codex: "config.toml",
  hermes: "hermes.config.json",
};

export async function probeRuntime(
  projectRoot: string,
  targetInput: string,
  options: ProbeRuntimeOptions = {},
): Promise<RuntimeProbeResult> {
  const target = readRuntimeTarget(targetInput);
  const inspectedAt = options.inspectedAt ?? new Date().toISOString();
  const expectedPaths = getPlatformExpectedPaths(projectRoot, target);
  const configFile = path.join(expectedPaths.platformDirectory, RUNTIME_CONFIG_FILES[target]);
  const profile = getRuntimeProfile(target);
  const runtimeVersion = options.runtimeVersion ?? profile.runtimeVersion;
  const profileDigest = computeRuntimeProfileDigest(target);
  const configText = await readOptionalTextFile(configFile);
  const manifest = await readOptionalInstallManifest(expectedPaths.projectRoot);
  const manifestText = manifest?.text;
  const manifestHookCommands =
    manifest?.manifest.target === target
      ? extractInstallManifestHookCommands(manifest.manifest)
      : {};
  const observedConfigDigest = computeObservedRuntimeConfigDigest(
    target,
    runtimeVersion,
    profileDigest,
    configText,
    manifestText,
  );
  const capabilityDigest = observedConfigDigest ?? profileDigest;
  const hookEntries = await Promise.all(
    GATE_TYPES.map(async (gateType) => {
      const hook = profile.hooks[gateType];
      const registered =
        configText !== undefined &&
        hasRegisteredHook(target, configText, gateType, manifestHookCommands[gateType]);
      const blockingFixtureVerified =
        registered &&
        hook.canBlock &&
        observedConfigDigest !== undefined &&
        options.verifyBlockingFixtures === true &&
        (await verifyManagedBlockingFixture(gateType));
      const proofs = [
        createTrustedRuntimeProbeProof({
          type: "config_read",
          observedAt: inspectedAt,
          target,
          runtimeVersion,
          gateType,
          configDigest: capabilityDigest,
          result: configText === undefined ? "config_missing" : "config_read",
          detail:
            configText === undefined
              ? `Core probe could not read ${configFile}.`
              : `Core probe read ${configFile}.`,
        }),
        ...(manifestText === undefined
          ? []
          : [
              createTrustedRuntimeProbeProof({
                type: "manifest_digest",
                observedAt: inspectedAt,
                target,
                runtimeVersion,
                gateType,
                configDigest: capabilityDigest,
                result: digestText(manifestText),
                detail: `Core probe read ${expectedPaths.manifestFile}.`,
              }),
            ]),
        ...(blockingFixtureVerified
          ? [
              createTrustedRuntimeProbeProof({
                type: "negative_fixture",
                observedAt: inspectedAt,
                target,
                runtimeVersion,
                gateType,
                configDigest: observedConfigDigest ?? capabilityDigest,
                result: TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
                detail: `Core probe verified managed blocking hook ${hook.nativeEvent} -> ${hook.command}.`,
              }),
            ]
          : []),
      ];
      const input: RuntimeHookCapabilityInput = {
        status: hook.supported && registered ? "available" : "missing",
        configDigest: capabilityDigest,
        proofs,
      };

      return [gateType, input];
    }),
  );
  const hooks = Object.fromEntries(hookEntries) as Record<GateType, RuntimeHookCapabilityInput>;
  const capability = await inspectRuntimeWithTrustedProofs(expectedPaths.projectRoot, target, {
    inspectedAt,
    runtimeVersion,
    configDigest: capabilityDigest,
    hooks,
    knownLimitations: [
      ...(configText === undefined ? [`Runtime config file not found: ${configFile}`] : []),
      ...(manifestText === undefined
        ? [`Install manifest not found or unreadable: ${expectedPaths.manifestFile}`]
        : []),
    ],
  });
  const bindings =
    options.bind === true
      ? await bindRuntime(expectedPaths.projectRoot, target, {
          inspectedAt,
          expectedDigest: capabilityDigest,
          currentDigest: capabilityDigest,
        })
      : undefined;
  const registeredHooks = GATE_TYPES.filter(
    (gateType) => capability.hooks[gateType]?.status === "available",
  );
  const verifiedBlockingFixtures = GATE_TYPES.filter((gateType) =>
    capability.hooks[gateType]?.proofs?.some((proof) => proof.type === "negative_fixture"),
  );

  return {
    target,
    runtimeVersion,
    inspectedAt,
    configFile,
    configRead: configText !== undefined,
    manifestFile: expectedPaths.manifestFile,
    manifestRead: manifestText !== undefined,
    profileDigest,
    ...(observedConfigDigest ? { configDigest: observedConfigDigest } : {}),
    registeredHooks,
    verifiedBlockingFixtures,
    missingHooks: GATE_TYPES.filter((gateType) => !registeredHooks.includes(gateType)),
    capability,
    ...(bindings ? { bindings } : {}),
  };
}

function computeObservedRuntimeConfigDigest(
  target: RuntimeTarget,
  runtimeVersion: string,
  profileDigest: string,
  configText: string | undefined,
  manifestText: string | undefined,
): string | undefined {
  if (configText === undefined) {
    return undefined;
  }

  return digestText(
    JSON.stringify({
      target,
      runtimeVersion,
      profileDigest,
      configDigest: digestText(configText),
      manifestDigest: manifestText === undefined ? null : digestText(manifestText),
    }),
  );
}

async function verifyManagedBlockingFixture(gateType: GateType): Promise<boolean> {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "harness-runtime-fixture-"));

  try {
    await writePlanningProject(fixtureRoot, createBlockingFixtureProject());
    const response = await handleHook(fixtureRoot, gateType, blockingFixturePayload(gateType), {
      dryRun: true,
    });

    return response.decision === "block" && response.failOpen === false;
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

function createBlockingFixtureProject(): PlanningProject {
  const project = createDefaultPlanningProject("runtime_probe_fixture");
  const riskClass = "H";

  return {
    ...project,
    state: {
      ...project.state,
      phase: "build",
      sub_phase: "Execute",
    },
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: RISK_CLASS_RANK[riskClass],
      bypass_allowed: RISK_POLICY[riskClass].bypassAllowed,
      human_checkpoint_required: RISK_POLICY[riskClass].requiresHumanCheckpoint,
    },
    runSet: {
      ...project.runSet,
      route: {
        ...project.runSet.route,
        phase: "build",
        subPhase: "Execute",
        riskClass,
      },
    },
  };
}

function blockingFixturePayload(gateType: GateType): Record<string, unknown> {
  switch (gateType) {
    case "user_prompt":
      return { promptContent: "probe fixture requests bypass of the gate" };
    case "pre_tool":
      return {
        toolName: "write_file",
        toolInput: { path: "outside-runtime-fixture/probe.txt" },
      };
    case "stop":
      return {};
    case "subagent_start":
      return { metadata: { scope: ["outside-runtime-fixture/probe.ts"], depth: 2 } };
    case "subagent_stop":
      return { metadata: { agentId: "missing-runtime-fixture-agent" } };
    default:
      return {};
  }
}

function readRuntimeTarget(value: string): RuntimeTarget {
  if (isRuntimeTarget(value)) {
    return value;
  }

  throw new Error(`Invalid runtime target "${value}".`);
}

async function readOptionalTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return undefined;
    }

    throw error;
  }
}

interface OptionalInstallManifest {
  readonly text: string;
  readonly manifest: InstallManifest;
}

async function readOptionalInstallManifest(
  projectRoot: string,
): Promise<OptionalInstallManifest | undefined> {
  const manifestFile = getDefaultInstallManifestFile(projectRoot);
  const manifestText = await readOptionalTextFile(manifestFile);

  if (manifestText === undefined) {
    return undefined;
  }

  return {
    text: manifestText,
    manifest: await readInstallManifest({ projectRoot }),
  };
}

function hasRegisteredHook(
  target: RuntimeTarget,
  configText: string,
  gateType: GateType,
  managedCommand?: string,
): boolean {
  if (target === "codex") {
    return hasCodexHook(configText, gateType, managedCommand);
  }

  if (target === "claude") {
    return hasClaudeHook(configText, gateType, managedCommand);
  }

  return hasHermesHook(configText, gateType, managedCommand);
}

function hasCodexHook(configText: string, gateType: GateType, managedCommand?: string): boolean {
  if (!hasCodexHooksFeature(configText)) {
    return false;
  }

  const hook = getRuntimeProfile("codex").hooks[gateType];
  const expectedCommand = managedCommand ?? hook.command;
  const legacyHookBlocks = configText.match(/\[\[hooks\]\][\s\S]*?(?=\n\s*\[\[?|\s*$)/g) ?? [];
  const officialHookBlocks =
    hook.nativeEvent === null ? [] : officialCodexHookBlocks(configText, hook.nativeEvent);

  return (
    legacyHookBlocks.some(
      (block) =>
        matchTomlStringValue(block, "event") === hook.nativeEvent &&
        matchTomlStringValue(block, "command") === expectedCommand,
    ) ||
    officialHookBlocks.some((block) => officialCodexHookCommands(block).includes(expectedCommand))
  );
}

function hasCodexHooksFeature(configText: string): boolean {
  const featuresBlock = matchTomlTableBlock(configText, "features");
  return featuresBlock ? matchTomlBooleanValue(featuresBlock, "codex_hooks") === true : false;
}

function hasClaudeHook(configText: string, gateType: GateType, managedCommand?: string): boolean {
  const hook = getRuntimeProfile("claude").hooks[gateType];
  const expectedCommand = managedCommand ?? hook.command;
  const config = parseJsonObject(configText);
  const hooks = isRecord(config.hooks) ? config.hooks : {};
  const entries = hook.nativeEvent ? hooks[hook.nativeEvent] : undefined;

  return Array.isArray(entries)
    ? entries.some(
        (entry) =>
          isRecord(entry) &&
          Array.isArray(entry.hooks) &&
          entry.hooks.some(
            (command) =>
              isRecord(command) &&
              command.type === "command" &&
              command.command === expectedCommand,
          ),
      )
    : false;
}

function hasHermesHook(configText: string, gateType: GateType, managedCommand?: string): boolean {
  const hook = getRuntimeProfile("hermes").hooks[gateType];
  const expectedCommand = managedCommand ?? hook.command;
  const config = parseJsonObject(configText);
  const gateway = isRecord(config.gateway) ? config.gateway : {};
  const plugins = Array.isArray(gateway.plugins) ? gateway.plugins : [];
  const harnessPlugin = plugins.find((plugin) => isRecord(plugin) && plugin.plugin === "harness");
  const hooks =
    isRecord(harnessPlugin) && Array.isArray(harnessPlugin.hooks) ? harnessPlugin.hooks : [];

  return hooks.some(
    (entry) =>
      isRecord(entry) && entry.event === hook.nativeEvent && entry.command === expectedCommand,
  );
}

function matchTomlStringValue(block: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*$`, "m").exec(block);

  return match ? match[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") : undefined;
}

function officialCodexHookBlocks(config: string, event: string): string[] {
  const escapedEvent = escapeRegExp(event);
  const blockPattern = new RegExp(
    `(?:^|\\n)\\s*\\[\\[hooks\\.${escapedEvent}\\]\\][\\s\\S]*?(?=\\n\\s*\\[\\[hooks\\.[^.\\]\\r\\n]+\\]\\]|\\n\\s*\\[[^\\[]|(?![\\s\\S]))`,
    "g",
  );

  return config.match(blockPattern) ?? [];
}

function officialCodexHookCommands(block: string): string[] {
  return [...block.matchAll(/^\s*command\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/gm)].map((match) =>
    (match[1] ?? "").replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchTomlBooleanValue(block: string, key: string): boolean | undefined {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*$`, "m").exec(block);

  return match ? match[1] === "true" : undefined;
}

function matchTomlTableBlock(configText: string, tableName: string): string | undefined {
  const lines = configText.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === `[${tableName}]`);

  if (startIndex === -1) {
    return undefined;
  }

  const endIndex = lines.findIndex((line, index) => index > startIndex && /^\s*\[/.test(line));

  return lines.slice(startIndex, endIndex === -1 ? undefined : endIndex).join("\n");
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
