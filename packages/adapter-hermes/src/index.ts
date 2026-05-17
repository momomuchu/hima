import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  applyHookCommandPrefix,
  buildRuntimeBindings,
  computeRuntimeProfileDigest,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  GATE_TYPES,
  type GateType,
  getRuntimeProfile,
  MISSING_RUNTIME_BINDING_STATUS,
  type RuntimeBinding,
  type RuntimeCapability,
  type RuntimeHookCapability,
  type RuntimeProfile,
  safeAtomicWriteFile,
} from "@harness/core";
import { getHermesHookBindings, type HermesHookBinding } from "./hook-bindings.js";

export const HERMES_CONFIG_FILE = "hermes.config.json";

export { getHermesHookBindings, type HermesHookBinding };

export interface HermesHookPreview {
  target: "hermes";
  operations: HermesPreviewOperation[];
  bindings: Record<GateType, RuntimeBinding>;
  markers: HermesPreviewMarker[];
}

export type HermesPreviewOperation =
  | {
      kind: "merge";
      path: "gateway.plugins";
      value: {
        plugin: "harness";
        mode: "preview";
      };
    }
  | {
      kind: "append";
      path: "gateway.plugins.harness.hooks";
      value: HermesHookEntryPreview;
    };

export interface HermesHookEntryPreview {
  gateType: GateType;
  event: string;
  command: string;
  blocking: boolean;
}

export interface HermesPreviewMarker {
  gateType: GateType;
  status: "missing" | "degraded";
  reason: string;
}

export interface HermesConfigFile {
  gateway?: {
    plugins?: HermesGatewayPlugin[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface HermesGatewayPlugin {
  plugin: string;
  mode?: string;
  hooks?: HermesHookEntryPreview[];
  [key: string]: unknown;
}

export interface ApplyHermesHookConfigOptions {
  root: string;
  hookCommands?: Partial<Record<GateType, string>>;
  hookCommandPrefix?: string;
}

export interface ApplyHermesHookConfigResult {
  target: "hermes";
  configFile: string;
  hooksAdded: number;
  pluginAdded: boolean;
}

export interface RemoveHermesHookConfigResult {
  target: "hermes";
  configFile: string;
  hooksRemoved: number;
  pluginRemoved: boolean;
}

export function buildHermesHookPreview(
  options: Pick<ApplyHermesHookConfigOptions, "hookCommands" | "hookCommandPrefix"> = {},
): HermesHookPreview {
  const profile = getRuntimeProfile("hermes");
  const digest = computeRuntimeProfileDigest("hermes");
  const hookBindings = getHermesHookBindings();
  const bindings = buildRuntimeBindings(
    "hermes",
    buildHermesRuntimeCapability(profile),
    "preview",
    {
      expectedDigest: digest,
      currentDigest: digest,
    },
  );

  return {
    target: "hermes",
    bindings,
    operations: [
      {
        kind: "merge",
        path: "gateway.plugins",
        value: {
          plugin: "harness",
          mode: "preview",
        },
      },
      ...hookBindings.flatMap((hook) => {
        return hook.supported && hook.nativeEvent
          ? [
              {
                kind: "append" as const,
                path: "gateway.plugins.harness.hooks" as const,
                value: {
                  gateType: hook.gateType,
                  event: hook.nativeEvent,
                  command: resolveHookCommand(hook.command, hook.gateType, options),
                  blocking: hook.canBlock,
                },
              },
            ]
          : [];
      }),
    ],
    markers: GATE_TYPES.flatMap((gateType): HermesPreviewMarker[] => {
      const binding = bindings[gateType];

      if (binding.status === MISSING_RUNTIME_BINDING_STATUS) {
        return [{ gateType, status: MISSING_RUNTIME_BINDING_STATUS, reason: binding.reason }];
      }

      if (binding.status === "native" && !binding.canBlock) {
        return [
          {
            gateType,
            status: "degraded" as const,
            reason: "runtime hook is observable but cannot block",
          },
        ];
      }

      return [];
    }),
  };
}

export async function applyHermesHookConfig(
  options: ApplyHermesHookConfigOptions,
): Promise<ApplyHermesHookConfigResult> {
  const configFile = path.join(options.root, HERMES_CONFIG_FILE);
  const config = await readJsonFile<HermesConfigFile>(configFile, {});
  const gateway = isRecord(config.gateway) ? config.gateway : {};
  const plugins = Array.isArray(gateway.plugins) ? gateway.plugins : [];
  let harnessPlugin = plugins.find((plugin) => plugin.plugin === "harness");
  let pluginAdded = false;

  if (!harnessPlugin) {
    harnessPlugin = { plugin: "harness", mode: "preview", hooks: [] };
    plugins.push(harnessPlugin);
    pluginAdded = true;
  }

  const hooks = Array.isArray(harnessPlugin.hooks) ? harnessPlugin.hooks : [];
  let hooksAdded = 0;

  for (const operation of buildHermesHookPreview(options).operations) {
    if (operation.kind !== "append") {
      continue;
    }

    if (!hooks.some((hook) => isSameHermesHook(hook, operation.value))) {
      hooks.push(operation.value);
      hooksAdded += 1;
    }
  }

  harnessPlugin.hooks = hooks;
  gateway.plugins = plugins;
  config.gateway = gateway;

  await safeAtomicWriteFile(options.root, configFile, `${JSON.stringify(config, null, 2)}\n`);

  return {
    target: "hermes",
    configFile,
    hooksAdded,
    pluginAdded,
  };
}

export async function removeHermesHookConfig(
  options: ApplyHermesHookConfigOptions,
): Promise<RemoveHermesHookConfigResult> {
  const configFile = path.join(options.root, HERMES_CONFIG_FILE);
  const config = await readJsonFile<HermesConfigFile | undefined>(configFile, undefined);

  if (config === undefined || !isRecord(config.gateway) || !Array.isArray(config.gateway.plugins)) {
    return {
      target: "hermes",
      configFile,
      hooksRemoved: 0,
      pluginRemoved: false,
    };
  }

  const plugins = config.gateway.plugins;
  const harnessPluginIndex = plugins.findIndex((plugin) => plugin.plugin === "harness");
  const harnessPlugin = plugins[harnessPluginIndex];

  if (harnessPlugin === undefined || !Array.isArray(harnessPlugin.hooks)) {
    return {
      target: "hermes",
      configFile,
      hooksRemoved: 0,
      pluginRemoved: false,
    };
  }

  const expectedHooks = buildHermesHookPreview(options).operations.flatMap((operation) =>
    operation.kind === "append" ? [operation.value] : [],
  );
  const nextHooks = harnessPlugin.hooks.filter(
    (hook) => !expectedHooks.some((expectedHook) => isSameHermesHook(hook, expectedHook)),
  );
  const hooksRemoved = harnessPlugin.hooks.length - nextHooks.length;
  let pluginRemoved = false;

  if (hooksRemoved > 0) {
    if (nextHooks.length > 0 || hasCustomHarnessPluginFields(harnessPlugin)) {
      harnessPlugin.hooks = nextHooks;
    } else {
      plugins.splice(harnessPluginIndex, 1);
      pluginRemoved = true;
    }

    await safeAtomicWriteFile(options.root, configFile, `${JSON.stringify(config, null, 2)}\n`);
  }

  return {
    target: "hermes",
    configFile,
    hooksRemoved,
    pluginRemoved,
  };
}

function buildHermesRuntimeCapability(profile: RuntimeProfile): RuntimeCapability {
  const inspectedAt = "preview";

  return {
    target: "hermes",
    runtimeName: "hermes",
    status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
    inspectedAt,
    hooks: Object.fromEntries(
      GATE_TYPES.map((gateType) => [
        gateType,
        buildHermesHookCapability(profile, gateType, inspectedAt),
      ]),
    ) as Record<GateType, RuntimeHookCapability>,
    knownLimitations: [
      "session_start, post_tool, stop, and subagent_stop are observable but non-blocking",
      "subagent_start does not expose a native Hermes hook event",
    ],
  };
}

function buildHermesHookCapability(
  profile: RuntimeProfile,
  gateType: GateType,
  inspectedAt: string,
): RuntimeHookCapability {
  const hook = profile.hooks[gateType];

  return {
    gateType,
    nativeEvent: hook.nativeEvent,
    canBlock: hook.canBlock,
    status: hook.supported ? DEFAULT_RUNTIME_CAPABILITY_STATUS : MISSING_RUNTIME_BINDING_STATUS,
    inspectedAt,
  };
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function isSameHermesHook(
  existingHook: HermesHookEntryPreview,
  hook: HermesHookEntryPreview,
): boolean {
  return existingHook.event === hook.event && existingHook.command === hook.command;
}

function hasCustomHarnessPluginFields(plugin: HermesGatewayPlugin): boolean {
  const managedFields = new Set(["plugin", "mode", "hooks"]);

  return (
    (plugin.mode !== undefined && plugin.mode !== "preview") ||
    Object.keys(plugin).some((field) => !managedFields.has(field))
  );
}

function resolveHookCommand(
  command: string,
  gateType: GateType,
  options: Pick<ApplyHermesHookConfigOptions, "hookCommands" | "hookCommandPrefix">,
): string {
  return (
    options.hookCommands?.[gateType] ?? applyHookCommandPrefix(command, options.hookCommandPrefix)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
