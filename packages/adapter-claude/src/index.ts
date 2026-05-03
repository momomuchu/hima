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

export const CLAUDE_SETTINGS_FILE = "settings.json";

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
}

export interface ApplyClaudeSettingsResult {
  target: "claude";
  settingsFile: string;
  hooksAdded: number;
}

export function buildClaudeSettingsPreview(): ClaudeSettingsPreview {
  const profile = getRuntimeProfile("claude");
  const digest = computeRuntimeProfileDigest("claude");
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
    operations: GATE_TYPES.flatMap((gateType) => {
      const binding = bindings[gateType];
      const hook = profile.hooks[gateType];

      return binding.status === "native" && binding.nativeEvent
        ? [
            {
              kind: "append" as const,
              path: "settings.json.hooks" as const,
              value: {
                gateType,
                event: binding.nativeEvent,
                matcher: "",
                hooks: [
                  {
                    type: "command" as const,
                    command: hook.command,
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

  for (const operation of buildClaudeSettingsPreview().operations) {
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
