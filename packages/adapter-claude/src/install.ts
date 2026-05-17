import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ClaudeHookBinding, getClaudeHookBindings } from "./hook-bindings.js";
import {
  type ApplyClaudeSettingsOptions,
  applyClaudeSettings,
  buildClaudeSettingsPreview,
  CLAUDE_SETTINGS_FILE,
  type ClaudeSettingsPreview,
  type RemoveClaudeSettingsResult,
  removeClaudeSettings,
} from "./index.js";

export const CLAUDE_SYSTEM_PROMPT_FILE = fileURLToPath(
  new URL("../src/system-prompt.md", import.meta.url),
);

export interface ClaudeInstallPlan {
  target: "claude";
  root: string;
  settingsFile: string;
  systemPromptFile: string;
  hookBindings: ClaudeHookBinding[];
  unsupportedHooks: ClaudeHookBinding[];
  degradedHooks: ClaudeHookBinding[];
  hooksPlanned: number;
  preview: ClaudeSettingsPreview;
}

export interface ClaudeInstallResult {
  target: "claude";
  settingsFile: string;
  hooksAdded: number;
  plan: ClaudeInstallPlan;
}

export interface ClaudeRemoveInstallResult extends RemoveClaudeSettingsResult {
  plan: ClaudeInstallPlan;
}

export function planClaudeInstall(options: ApplyClaudeSettingsOptions): ClaudeInstallPlan {
  const root = path.resolve(options.root);
  const hookBindings = getClaudeHookBindings();
  const preview = buildClaudeSettingsPreview(options);

  return {
    target: "claude",
    root,
    settingsFile: path.join(root, CLAUDE_SETTINGS_FILE),
    systemPromptFile: CLAUDE_SYSTEM_PROMPT_FILE,
    hookBindings,
    unsupportedHooks: hookBindings.filter((binding) => binding.status === "unsupported"),
    degradedHooks: hookBindings.filter((binding) => binding.status === "degraded"),
    hooksPlanned: preview.operations.length,
    preview,
  };
}

export async function applyClaudeInstall(
  options: ApplyClaudeSettingsOptions,
): Promise<ClaudeInstallResult> {
  const plan = planClaudeInstall(options);
  const result = await applyClaudeSettings({ ...options, root: plan.root });

  return {
    ...result,
    plan,
  };
}

export async function removeClaudeInstall(
  options: ApplyClaudeSettingsOptions,
): Promise<ClaudeRemoveInstallResult> {
  const plan = planClaudeInstall(options);
  const result = await removeClaudeSettings({ ...options, root: plan.root });

  return {
    ...result,
    plan,
  };
}
