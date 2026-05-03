import { readFile } from "node:fs/promises";
import path from "node:path";
import {
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

export const HERMES_CONFIG_FILE = "hermes.config.json";

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
}

export interface ApplyHermesHookConfigResult {
  target: "hermes";
  configFile: string;
  hooksAdded: number;
  pluginAdded: boolean;
}

export function buildHermesHookPreview(): HermesHookPreview {
  const profile = getRuntimeProfile("hermes");
  const digest = computeRuntimeProfileDigest("hermes");
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
      ...GATE_TYPES.flatMap((gateType) => {
        const binding = bindings[gateType];
        const hook = profile.hooks[gateType];

        return binding.status === "native" && binding.nativeEvent
          ? [
              {
                kind: "append" as const,
                path: "gateway.plugins.harness.hooks" as const,
                value: {
                  gateType,
                  event: binding.nativeEvent,
                  command: hook.command,
                  blocking: binding.canBlock,
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

  for (const operation of buildHermesHookPreview().operations) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
