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

export const CODEX_CONFIG_FILE = "config.toml";

export interface CodexHookConfigPreview {
  target: "codex";
  operations: CodexPreviewOperation[];
  bindings: Record<GateType, RuntimeBinding>;
  markers: CodexPreviewMarker[];
}

export type CodexPreviewOperation =
  | {
      kind: "merge";
      path: "config.toml";
      value: {
        features: {
          codex_hooks: true;
        };
      };
    }
  | {
      kind: "append";
      path: "config.toml.hooks";
      value: CodexHookCommandPreview;
    };

export interface CodexHookCommandPreview {
  gateType: GateType;
  event: string;
  command: string;
}

export interface CodexPreviewMarker {
  gateType: GateType;
  status: "missing";
  reason: string;
}

export interface ApplyCodexHookConfigOptions {
  root: string;
}

export interface ApplyCodexHookConfigResult {
  target: "codex";
  configFile: string;
  hooksAdded: number;
  featureFlagAdded: boolean;
}

export function buildCodexHookConfigPreview(): CodexHookConfigPreview {
  const profile = getRuntimeProfile("codex");
  const digest = computeRuntimeProfileDigest("codex");
  const bindings = buildRuntimeBindings("codex", buildCodexRuntimeCapability(profile), "preview", {
    expectedDigest: digest,
    currentDigest: digest,
  });
  const hookCommands = GATE_TYPES.flatMap((gateType) => {
    const binding = bindings[gateType];
    const hook = profile.hooks[gateType];

    return binding.status === "native" && binding.nativeEvent
      ? [
          {
            kind: "append" as const,
            path: "config.toml.hooks" as const,
            value: {
              gateType,
              event: binding.nativeEvent,
              command: hook.command,
            },
          },
        ]
      : [];
  });

  return {
    target: "codex",
    bindings,
    operations: [
      {
        kind: "merge",
        path: "config.toml",
        value: {
          features: {
            codex_hooks: true,
          },
        },
      },
      ...hookCommands,
    ],
    markers: GATE_TYPES.flatMap((gateType) => {
      const binding = bindings[gateType];

      return binding.status === MISSING_RUNTIME_BINDING_STATUS
        ? [{ gateType, status: MISSING_RUNTIME_BINDING_STATUS, reason: binding.reason }]
        : [];
    }),
  };
}

export async function applyCodexHookConfig(
  options: ApplyCodexHookConfigOptions,
): Promise<ApplyCodexHookConfigResult> {
  const configFile = path.join(options.root, CODEX_CONFIG_FILE);
  const preview = buildCodexHookConfigPreview();
  const existingConfig = await readTextFile(configFile);
  const appendOperations = preview.operations.filter(
    (operation): operation is Extract<CodexPreviewOperation, { kind: "append" }> =>
      operation.kind === "append",
  );

  let nextConfig = ensureCodexHooksFeature(existingConfig);
  const featureFlagAdded = nextConfig !== existingConfig;
  let hooksAdded = 0;

  for (const operation of appendOperations) {
    if (!hasCodexHook(nextConfig, operation.value)) {
      nextConfig = appendCodexHook(nextConfig, operation.value);
      hooksAdded += 1;
    }
  }

  await safeAtomicWriteFile(options.root, configFile, ensureTrailingNewline(nextConfig));

  return {
    target: "codex",
    configFile,
    hooksAdded,
    featureFlagAdded,
  };
}

function buildCodexRuntimeCapability(profile: RuntimeProfile): RuntimeCapability {
  const inspectedAt = "preview";

  return {
    target: "codex",
    runtimeName: "codex",
    status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
    inspectedAt,
    hooks: Object.fromEntries(
      GATE_TYPES.map((gateType) => [
        gateType,
        buildCodexHookCapability(profile, gateType, inspectedAt),
      ]),
    ) as Record<GateType, RuntimeHookCapability>,
    knownLimitations: ["subagent_start and subagent_stop do not expose native Codex hook events"],
  };
}

function buildCodexHookCapability(
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

async function readTextFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function ensureCodexHooksFeature(config: string): string {
  const lines = config.split(/\r?\n/);
  const featuresHeaderIndex = lines.findIndex((line) => line.trim() === "[features]");

  if (featuresHeaderIndex === -1) {
    return appendBlock(config, ["[features]", "codex_hooks = true"]);
  }

  let insertIndex = lines.length;
  for (let index = featuresHeaderIndex + 1; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index] ?? "")) {
      insertIndex = index;
      break;
    }

    if (/^\s*codex_hooks\s*=/.test(lines[index] ?? "")) {
      return config;
    }
  }

  lines.splice(insertIndex, 0, "codex_hooks = true");
  return lines.join("\n");
}

function hasCodexHook(config: string, hook: CodexHookCommandPreview): boolean {
  const hookBlocks = config.match(/\[\[hooks\]\][\s\S]*?(?=\n\s*\[\[?|\s*$)/g) ?? [];

  return hookBlocks.some((block) => {
    const event = matchTomlStringValue(block, "event");
    const command = matchTomlStringValue(block, "command");

    return event === hook.event && command === hook.command;
  });
}

function appendCodexHook(config: string, hook: CodexHookCommandPreview): string {
  return appendBlock(config, [
    "[[hooks]]",
    `gate_type = ${toTomlString(hook.gateType)}`,
    `event = ${toTomlString(hook.event)}`,
    `command = ${toTomlString(hook.command)}`,
  ]);
}

function appendBlock(config: string, lines: string[]): string {
  const prefix = config.trim().length > 0 ? `${config.replace(/\s+$/u, "")}\n\n` : "";

  return `${prefix}${lines.join("\n")}`;
}

function matchTomlStringValue(block: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*$`, "m").exec(block);

  return match ? match[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\") : undefined;
}

function toTomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
