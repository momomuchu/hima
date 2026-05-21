import path from "node:path";
import { fileURLToPath } from "node:url";
import { type CodexHookBinding, getCodexHookBindings } from "./hook-bindings.js";
import {
  type ApplyCodexHookConfigOptions,
  applyCodexHookConfig,
  buildCodexHookConfigPreview,
  CODEX_CONFIG_FILE,
  type CodexHookConfigPreview,
  type RemoveCodexHookConfigResult,
  removeCodexHookConfig,
} from "./index.js";

export const CODEX_SYSTEM_PROMPT_FILE = fileURLToPath(
  new URL("../src/system-prompt.md", import.meta.url),
);

export interface CodexInstallPlan {
  target: "codex";
  root: string;
  configFile: string;
  systemPromptFile: string;
  hookBindings: CodexHookBinding[];
  unsupportedHooks: CodexHookBinding[];
  degradedHooks: CodexHookBinding[];
  hooksPlanned: number;
  preview: CodexHookConfigPreview;
}

export interface CodexInstallResult {
  target: "codex";
  configFile: string;
  hooksAdded: number;
  featureFlagAdded: boolean;
  plan: CodexInstallPlan;
}

export interface CodexRemoveInstallResult extends RemoveCodexHookConfigResult {
  plan: CodexInstallPlan;
}

export function planCodexInstall(options: ApplyCodexHookConfigOptions): CodexInstallPlan {
  const root = path.resolve(options.root);
  const hookBindings = getCodexHookBindings();
  const preview = buildCodexHookConfigPreview(options);

  return {
    target: "codex",
    root,
    configFile: path.join(root, CODEX_CONFIG_FILE),
    systemPromptFile: CODEX_SYSTEM_PROMPT_FILE,
    hookBindings,
    unsupportedHooks: hookBindings.filter((binding) => binding.status === "unsupported"),
    degradedHooks: hookBindings.filter((binding) => binding.status === "degraded"),
    hooksPlanned: preview.operations.filter((operation) => operation.kind === "append").length,
    preview,
  };
}

export async function applyCodexInstall(
  options: ApplyCodexHookConfigOptions,
): Promise<CodexInstallResult> {
  const plan = planCodexInstall(options);
  const result = await applyCodexHookConfig({ ...options, root: plan.root });

  return {
    ...result,
    plan,
  };
}

export async function removeCodexInstall(
  options: ApplyCodexHookConfigOptions,
): Promise<CodexRemoveInstallResult> {
  const plan = planCodexInstall(options);
  const result = await removeCodexHookConfig({ ...options, root: plan.root });

  return {
    ...result,
    plan,
  };
}
