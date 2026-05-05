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
  toHookCommand,
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
  hookCommands?: Partial<Record<GateType, string>>;
  hookCommandPrefix?: string;
}

export interface ApplyCodexHookConfigResult {
  target: "codex";
  configFile: string;
  hooksAdded: number;
  featureFlagAdded: boolean;
}

export interface RemoveCodexHookConfigResult {
  target: "codex";
  configFile: string;
  hooksRemoved: number;
}

export function buildCodexHookConfigPreview(
  options: Pick<ApplyCodexHookConfigOptions, "hookCommands" | "hookCommandPrefix"> = {},
): CodexHookConfigPreview {
  const profile = getRuntimeProfile("codex");
  const digest = computeRuntimeProfileDigest("codex");
  const bindings = buildRuntimeBindings("codex", buildCodexRuntimeCapability(profile), "preview", {
    expectedDigest: digest,
    currentDigest: digest,
  });
  const hookCommands = GATE_TYPES.flatMap((gateType) => {
    const hook = profile.hooks[gateType];

    return hook.supported && hook.nativeEvent
      ? [
          {
            kind: "append" as const,
            path: "config.toml.hooks" as const,
            value: {
              gateType,
              event: hook.nativeEvent,
              command: resolveHookCommand(hook.command, gateType, options),
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
  const preview = buildCodexHookConfigPreview(options);
  const existingConfig = await readTextFile(configFile);
  const appendOperations = preview.operations.filter(
    (operation): operation is Extract<CodexPreviewOperation, { kind: "append" }> =>
      operation.kind === "append",
  );

  let nextConfig = ensureCodexHooksFeature(existingConfig);
  const featureFlagAdded = nextConfig !== existingConfig;
  let hooksAdded = 0;

  for (const operation of appendOperations) {
    nextConfig = removeStaleCodexHookBlocks(nextConfig, operation.value).config;

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

export async function removeCodexHookConfig(
  options: ApplyCodexHookConfigOptions,
): Promise<RemoveCodexHookConfigResult> {
  const configFile = path.join(options.root, CODEX_CONFIG_FILE);
  const existingConfig = await readTextFile(configFile);

  if (existingConfig.length === 0) {
    return {
      target: "codex",
      configFile,
      hooksRemoved: 0,
    };
  }

  const expectedHooks = buildCodexHookConfigPreview(options).operations.flatMap((operation) =>
    operation.kind === "append" ? [operation.value] : [],
  );
  const removal = removeCodexHookBlocks(existingConfig, expectedHooks);

  if (removal.hooksRemoved > 0) {
    await safeAtomicWriteFile(options.root, configFile, ensureTrailingNewline(removal.config));
  }

  return {
    target: "codex",
    configFile,
    hooksRemoved: removal.hooksRemoved,
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
      if (/^\s*codex_hooks\s*=\s*true\s*(?:#.*)?$/.test(lines[index] ?? "")) {
        return config;
      }

      lines[index] = "codex_hooks = true";
      return lines.join("\n");
    }
  }

  lines.splice(insertIndex, 0, "codex_hooks = true");
  return lines.join("\n");
}

function hasCodexHook(config: string, hook: CodexHookCommandPreview): boolean {
  const legacyHookBlocks = legacyCodexHookBlocks(config);
  const officialHookBlocks = officialCodexHookBlocks(config, hook.event);

  return (
    legacyHookBlocks.some((block) => {
      const event = matchTomlStringValue(block, "event");
      const command = matchTomlStringValue(block, "command");

      return event === hook.event && command === hook.command;
    }) ||
    officialHookBlocks.some((block) => officialCodexHookCommands(block).includes(hook.command))
  );
}

function appendCodexHook(config: string, hook: CodexHookCommandPreview): string {
  return appendBlock(config, [
    `[[hooks.${hook.event}]]`,
    `# hima_gate_type = ${toTomlString(hook.gateType)}`,
    "",
    `[[hooks.${hook.event}.hooks]]`,
    'type = "command"',
    `command = ${toTomlString(hook.command)}`,
  ]);
}

function removeCodexHookBlocks(
  config: string,
  expectedHooks: CodexHookCommandPreview[],
): { config: string; hooksRemoved: number } {
  const hookBlocks = [
    ...legacyCodexHookBlocks(config),
    ...expectedHooks.flatMap((hook) => officialCodexHookBlocks(config, hook.event)),
  ];
  let nextConfig = config;
  let hooksRemoved = 0;

  for (const block of hookBlocks) {
    if (!isManagedCodexHookBlock(block, expectedHooks)) {
      continue;
    }

    nextConfig = nextConfig.replace(block, "").replace(/\n{3,}/g, "\n\n");
    hooksRemoved += 1;
  }

  return {
    config: nextConfig.trim().length === 0 ? "" : nextConfig.trimEnd(),
    hooksRemoved,
  };
}

function isManagedCodexHookBlock(block: string, expectedHooks: CodexHookCommandPreview[]): boolean {
  const gateType = matchTomlStringValue(block, "gate_type");
  const event = matchTomlStringValue(block, "event");
  const command = matchTomlStringValue(block, "command");

  return expectedHooks.some(
    (hook) =>
      (hook.gateType === gateType && hook.event === event && hook.command === command) ||
      (officialCodexHookEvent(block) === hook.event &&
        officialCodexHookCommands(block).includes(hook.command)),
  );
}

function removeStaleCodexHookBlocks(
  config: string,
  hook: CodexHookCommandPreview,
): { config: string; hooksRemoved: number } {
  const hookBlocks = [
    ...legacyCodexHookBlocks(config),
    ...officialCodexHookBlocks(config, hook.event),
  ];
  let nextConfig = config;
  let hooksRemoved = 0;

  for (const block of hookBlocks) {
    if (!isStaleManagedCodexHookBlock(block, hook)) {
      continue;
    }

    nextConfig = nextConfig.replace(block, "").replace(/\n{3,}/g, "\n\n");
    hooksRemoved += 1;
  }

  return {
    config: nextConfig.trim().length === 0 ? "" : nextConfig.trimEnd(),
    hooksRemoved,
  };
}

function isStaleManagedCodexHookBlock(block: string, hook: CodexHookCommandPreview): boolean {
  const gateType = matchTomlStringValue(block, "gate_type");
  const event = matchTomlStringValue(block, "event");
  const command = matchTomlStringValue(block, "command");

  const legacyStale =
    gateType === hook.gateType &&
    event === hook.event &&
    command !== undefined &&
    isHookCommandForGate(command, hook.gateType) &&
    command !== hook.command;
  const officialStale =
    officialCodexHookEvent(block) === hook.event &&
    officialCodexHookCommands(block).some(
      (blockCommand) =>
        isHookCommandForGate(blockCommand, hook.gateType) && blockCommand !== hook.command,
    );

  return legacyStale || officialStale;
}

function appendBlock(config: string, lines: string[]): string {
  const prefix = config.trim().length > 0 ? `${config.replace(/\s+$/u, "")}\n\n` : "";

  return `${prefix}${lines.join("\n")}`;
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

function officialCodexHookEvent(block: string): string | undefined {
  return /^\s*\[\[hooks\.([^\].\r\n]+)\]\]/m.exec(block)?.[1];
}

function officialCodexHookCommands(block: string): string[] {
  return [...block.matchAll(/^\s*command\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/gm)].map((match) =>
    (match[1] ?? "").replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
  );
}

function isHookCommandForGate(command: string, gateType: GateType): boolean {
  const commandAlias = toHookCommand(gateType).replace("harness ", "");

  return command.includes(toHookCommand(gateType)) || command.includes(commandAlias);
}

function legacyCodexHookBlocks(config: string): string[] {
  return config.match(/\[\[hooks\]\][\s\S]*?(?=\n\s*\[\[?|\s*$)/g) ?? [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function resolveHookCommand(
  command: string,
  gateType: GateType,
  options: Pick<ApplyCodexHookConfigOptions, "hookCommands" | "hookCommandPrefix">,
): string {
  return (
    options.hookCommands?.[gateType] ?? applyHookCommandPrefix(command, options.hookCommandPrefix)
  );
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
