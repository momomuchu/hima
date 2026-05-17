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
import { type ClaudeHookBinding, getClaudeHookBindings } from "./hook-bindings.js";

export const CLAUDE_SETTINGS_FILE = "settings.json";

export { type ClaudeHookBinding, getClaudeHookBindings };

export interface ClaudeSettingsPreview {
  target: "claude";
  operations: ClaudePreviewOperation[];
  bindings: Record<GateType, RuntimeBinding>;
  markers: ClaudePreviewMarker[];
}

export interface ClaudePreviewOperation {
  kind: "append";
  path: "settings.json.hooks";
  value: ClaudeHookEntryPreview;
}

export interface ClaudeHookEntryPreview {
  gateType: GateType;
  event: string;
  matcher: string;
  hooks: [
    {
      type: "command";
      command: string;
    },
  ];
}

export interface ClaudePreviewMarker {
  gateType: GateType;
  status: "missing";
  reason: string;
}

export interface ClaudeSettingsFile {
  hooks?: Record<string, ClaudeSettingsHookEntry[]>;
  [key: string]: unknown;
}

export interface ClaudeSettingsHookEntry {
  matcher: string;
  hooks: [
    {
      type: "command";
      command: string;
    },
  ];
}

export interface ApplyClaudeSettingsOptions {
  root: string;
  hookCommands?: Partial<Record<GateType, string>>;
  hookCommandPrefix?: string;
}

export interface ApplyClaudeSettingsResult {
  target: "claude";
  settingsFile: string;
  hooksAdded: number;
}

export interface RemoveClaudeSettingsResult {
  target: "claude";
  settingsFile: string;
  hooksRemoved: number;
}

export function buildClaudeSettingsPreview(
  options: Pick<ApplyClaudeSettingsOptions, "hookCommands" | "hookCommandPrefix"> = {},
): ClaudeSettingsPreview {
  const profile = getRuntimeProfile("claude");
  const digest = computeRuntimeProfileDigest("claude");
  const hookBindings = getClaudeHookBindings();
  const bindings = buildRuntimeBindings(
    "claude",
    buildClaudeRuntimeCapability(profile),
    "preview",
    {
      expectedDigest: digest,
      currentDigest: digest,
    },
  );

  return {
    target: "claude",
    bindings,
    operations: hookBindings.flatMap((hook) => {
      return hook.supported && hook.nativeEvent
        ? [
            {
              kind: "append" as const,
              path: "settings.json.hooks" as const,
              value: {
                gateType: hook.gateType,
                event: hook.nativeEvent,
                matcher: "",
                hooks: [
                  {
                    type: "command" as const,
                    command: resolveHookCommand(hook.command, hook.gateType, options),
                  },
                ],
              },
            },
          ]
        : [];
    }),
    markers: GATE_TYPES.flatMap((gateType) => {
      const binding = bindings[gateType];

      return binding.status === MISSING_RUNTIME_BINDING_STATUS
        ? [{ gateType, status: MISSING_RUNTIME_BINDING_STATUS, reason: binding.reason }]
        : [];
    }),
  };
}

export async function applyClaudeSettings(
  options: ApplyClaudeSettingsOptions,
): Promise<ApplyClaudeSettingsResult> {
  const settingsFile = path.join(options.root, CLAUDE_SETTINGS_FILE);
  const settings = await readJsonFile<ClaudeSettingsFile>(settingsFile, {});
  const hooks = isHookRecord(settings.hooks) ? settings.hooks : {};
  let hooksAdded = 0;

  for (const operation of buildClaudeSettingsPreview(options).operations) {
    const existingEventHooks = hooks[operation.value.event];
    const eventHooks: ClaudeSettingsHookEntry[] = Array.isArray(existingEventHooks)
      ? existingEventHooks
      : [];
    const hookEntry = toClaudeSettingsHookEntry(operation.value);

    if (!eventHooks.some((existingHook) => isSameClaudeHook(existingHook, hookEntry))) {
      eventHooks.push(hookEntry);
      hooksAdded += 1;
    }

    hooks[operation.value.event] = eventHooks;
  }

  settings.hooks = hooks;
  await safeAtomicWriteFile(options.root, settingsFile, `${JSON.stringify(settings, null, 2)}\n`);

  return {
    target: "claude",
    settingsFile,
    hooksAdded,
  };
}

export async function removeClaudeSettings(
  options: ApplyClaudeSettingsOptions,
): Promise<RemoveClaudeSettingsResult> {
  const settingsFile = path.join(options.root, CLAUDE_SETTINGS_FILE);
  const settings = await readJsonFile<ClaudeSettingsFile | undefined>(settingsFile, undefined);

  if (settings === undefined || !isHookRecord(settings.hooks)) {
    return {
      target: "claude",
      settingsFile,
      hooksRemoved: 0,
    };
  }

  const hooks = settings.hooks;
  let hooksRemoved = 0;

  for (const operation of buildClaudeSettingsPreview(options).operations) {
    const existingEventHooks = hooks[operation.value.event];
    if (!Array.isArray(existingEventHooks)) {
      continue;
    }

    const hookEntry = toClaudeSettingsHookEntry(operation.value);
    const nextEventHooks = existingEventHooks.filter(
      (existingHook) => !isSameClaudeHook(existingHook, hookEntry),
    );
    hooksRemoved += existingEventHooks.length - nextEventHooks.length;

    if (nextEventHooks.length > 0) {
      hooks[operation.value.event] = nextEventHooks;
    } else {
      delete hooks[operation.value.event];
    }
  }

  if (hooksRemoved > 0) {
    if (Object.keys(hooks).length > 0) {
      settings.hooks = hooks;
    } else {
      delete settings.hooks;
    }

    await safeAtomicWriteFile(options.root, settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
  }

  return {
    target: "claude",
    settingsFile,
    hooksRemoved,
  };
}

function buildClaudeRuntimeCapability(profile: RuntimeProfile): RuntimeCapability {
  const inspectedAt = "preview";

  return {
    target: "claude",
    runtimeName: "claude",
    status: DEFAULT_RUNTIME_CAPABILITY_STATUS,
    inspectedAt,
    hooks: Object.fromEntries(
      GATE_TYPES.map((gateType) => [
        gateType,
        buildClaudeHookCapability(profile, gateType, inspectedAt),
      ]),
    ) as Record<GateType, RuntimeHookCapability>,
    knownLimitations: [],
  };
}

function buildClaudeHookCapability(
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

function toClaudeSettingsHookEntry(preview: ClaudeHookEntryPreview): ClaudeSettingsHookEntry {
  return {
    matcher: preview.matcher,
    hooks: preview.hooks,
  };
}

function resolveHookCommand(
  command: string,
  gateType: GateType,
  options: Pick<ApplyClaudeSettingsOptions, "hookCommands" | "hookCommandPrefix">,
): string {
  return (
    options.hookCommands?.[gateType] ?? applyHookCommandPrefix(command, options.hookCommandPrefix)
  );
}

function isSameClaudeHook(
  existingHook: ClaudeSettingsHookEntry,
  hookEntry: ClaudeSettingsHookEntry,
): boolean {
  return (
    existingHook.matcher === hookEntry.matcher &&
    existingHook.hooks.some(
      (hook) => hook.type === "command" && hook.command === hookEntry.hooks[0].command,
    )
  );
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

function isHookRecord(value: unknown): value is Record<string, ClaudeSettingsHookEntry[]> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
