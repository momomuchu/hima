import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHermesHookBindings, type HermesHookBinding } from "./hook-bindings.js";
import {
  type ApplyHermesHookConfigOptions,
  applyHermesHookConfig,
  buildHermesHookPreview,
  HERMES_CONFIG_FILE,
  type HermesHookPreview,
  type RemoveHermesHookConfigResult,
  removeHermesHookConfig,
} from "./index.js";

export const HERMES_SYSTEM_PROMPT_FILE = fileURLToPath(
  new URL("../src/system-prompt.md", import.meta.url),
);

export interface HermesInstallPlan {
  target: "hermes";
  root: string;
  configFile: string;
  systemPromptFile: string;
  hookBindings: HermesHookBinding[];
  unsupportedHooks: HermesHookBinding[];
  degradedHooks: HermesHookBinding[];
  hooksPlanned: number;
  preview: HermesHookPreview;
}

export interface HermesInstallResult {
  target: "hermes";
  configFile: string;
  hooksAdded: number;
  pluginAdded: boolean;
  plan: HermesInstallPlan;
}

export interface HermesRemoveInstallResult extends RemoveHermesHookConfigResult {
  plan: HermesInstallPlan;
}

export function planHermesInstall(options: ApplyHermesHookConfigOptions): HermesInstallPlan {
  const root = path.resolve(options.root);
  const hookBindings = getHermesHookBindings();
  const preview = buildHermesHookPreview(options);

  return {
    target: "hermes",
    root,
    configFile: path.join(root, HERMES_CONFIG_FILE),
    systemPromptFile: HERMES_SYSTEM_PROMPT_FILE,
    hookBindings,
    unsupportedHooks: hookBindings.filter((binding) => binding.status === "unsupported"),
    degradedHooks: hookBindings.filter((binding) => binding.status === "degraded"),
    hooksPlanned: preview.operations.filter((operation) => operation.kind === "append").length,
    preview,
  };
}

export async function applyHermesInstall(
  options: ApplyHermesHookConfigOptions,
): Promise<HermesInstallResult> {
  const plan = planHermesInstall(options);
  const result = await applyHermesHookConfig({ ...options, root: plan.root });

  return {
    ...result,
    plan,
  };
}

export async function removeHermesInstall(
  options: ApplyHermesHookConfigOptions,
): Promise<HermesRemoveInstallResult> {
  const plan = planHermesInstall(options);
  const result = await removeHermesHookConfig({ ...options, root: plan.root });

  return {
    ...result,
    plan,
  };
}
