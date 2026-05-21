import { link, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GATE_TYPES, getRuntimeProfile, toHookCommand } from "@harness/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyClaudeSettings,
  buildClaudeSettingsPreview,
  getClaudeHookBindings,
  removeClaudeSettings,
} from "../src/index.js";
import { applyClaudeInstall, planClaudeInstall } from "../src/install.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-claude-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("buildClaudeSettingsPreview", () => {
  it("returns settings.json-style append operations for every supported gate", () => {
    const preview = buildClaudeSettingsPreview();

    expect(preview.operations).toHaveLength(GATE_TYPES.length);
    expect(preview.operations.every((operation) => operation.kind === "append")).toBe(true);
    expect(preview.operations).toContainEqual({
      kind: "append",
      path: "settings.json.hooks",
      value: {
        gateType: "user_prompt",
        event: "UserPromptSubmit",
        matcher: "",
        hooks: [{ type: "command", command: toHookCommand("user_prompt", "claude") }],
      },
    });
  });

  it("uses core gate coverage and reports no missing native markers", () => {
    const preview = buildClaudeSettingsPreview();
    const previewGateTypes = preview.operations.map((operation) => operation.value.gateType);

    expect(previewGateTypes).toEqual([...GATE_TYPES]);
    expect(preview.markers).toEqual([]);
  });

  it("keeps every generated hook command aligned with the Claude runtime profile", () => {
    const profile = getRuntimeProfile("claude");
    const preview = buildClaudeSettingsPreview();

    expect(preview.operations.map((operation) => operation.value)).toEqual(
      GATE_TYPES.flatMap((gateType) => {
        const hook = profile.hooks[gateType];

        return hook.supported && hook.nativeEvent
          ? [
              {
                gateType,
                event: hook.nativeEvent,
                matcher: "",
                hooks: [{ type: "command", command: hook.command }],
              },
            ]
          : [];
      }),
    );
  });

  it("ships a package-local system prompt with anti-bypass and evidence boundaries", async () => {
    const prompt = await readFile(new URL("../src/system-prompt.md", import.meta.url), "utf8");

    expect(prompt).toContain("Do not bypass HIMA");
    expect(prompt).toContain(".planning/");
    expect(prompt).toContain(".hima/state/");
    expect(prompt).toContain("Claude Code");
    expect(prompt).toContain("real-runtime E2E");
  });

  it("exposes hook bindings aligned with the Claude runtime profile", () => {
    const profile = getRuntimeProfile("claude");
    const bindings = getClaudeHookBindings();

    expect(
      bindings.map(({ target, gateType, nativeEvent, canBlock, supported, command }) => ({
        target,
        gateType,
        nativeEvent,
        canBlock,
        supported,
        command,
      })),
    ).toEqual(
      GATE_TYPES.map((gateType) => {
        const hook = profile.hooks[gateType];

        return {
          target: "claude",
          gateType,
          nativeEvent: hook.nativeEvent,
          canBlock: hook.canBlock,
          supported: hook.supported,
          command: hook.command,
        };
      }),
    );
    expect(bindings.filter((binding) => binding.status === "unsupported")).toEqual([]);
    expect(
      bindings
        .filter((binding) => binding.status === "degraded")
        .map((binding) => binding.gateType),
    ).toEqual(["session_start", "post_tool", "post_compact"]);
  });

  it("plans install wiring from prompt and hook-binding surfaces without writing", async () => {
    const plan = planClaudeInstall({ root: tempRoot });

    expect(plan.settingsFile).toBe(path.join(path.resolve(tempRoot), "settings.json"));
    expect(plan.systemPromptFile).toContain(path.join("src", "system-prompt.md"));
    expect(plan.hookBindings).toEqual(getClaudeHookBindings());
    expect(plan.unsupportedHooks).toEqual([]);
    expect(plan.degradedHooks.map((binding) => binding.gateType)).toEqual([
      "session_start",
      "post_tool",
      "post_compact",
    ]);
    expect(plan.hooksPlanned).toBe(GATE_TYPES.length);
    await expect(readFile(plan.settingsFile, "utf8")).rejects.toThrow();
  });

  it("applies settings through the install module while preserving plan metadata", async () => {
    const result = await applyClaudeInstall({ root: tempRoot });

    expect(result.hooksAdded).toBe(GATE_TYPES.length);
    expect(result.settingsFile).toBe(path.join(tempRoot, "settings.json"));
    expect(result.plan.systemPromptFile).toContain(path.join("src", "system-prompt.md"));
    expect(result.plan.hookBindings).toHaveLength(GATE_TYPES.length);
  });

  it("applies settings.json hooks while preserving unrelated settings and hooks", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");
    await writeFile(
      settingsFile,
      `${JSON.stringify(
        {
          theme: "dark",
          hooks: {
            PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo keep" }] }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await applyClaudeSettings({ root: tempRoot });
    const settings = JSON.parse(await readFile(settingsFile, "utf8"));

    expect(result.hooksAdded).toBe(GATE_TYPES.length);
    expect(settings.theme).toBe("dark");
    expect(settings.hooks.PreToolUse).toContainEqual({
      matcher: "Write",
      hooks: [{ type: "command", command: "echo keep" }],
    });
    expect(settings.hooks.PreToolUse).toContainEqual({
      matcher: "",
      hooks: [{ type: "command", command: toHookCommand("pre_tool", "claude") }],
    });
  });

  it("is idempotent and keeps Claude hook output format aliases", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");

    await applyClaudeSettings({ root: tempRoot });
    const secondResult = await applyClaudeSettings({ root: tempRoot });
    const settings = JSON.parse(await readFile(settingsFile, "utf8"));

    expect(secondResult.hooksAdded).toBe(0);
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(toHookCommand("pre_tool", "claude"));
  });

  it("can install and remove hooks with an explicit harness command prefix", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");
    const hookCommandPrefix = 'node "C:/repo/packages/cli/dist/index.js"';
    const expectedPreToolCommand = `${hookCommandPrefix} hook pre-tool-use --format claude`;

    await applyClaudeSettings({ root: tempRoot, hookCommandPrefix });
    const settings = JSON.parse(await readFile(settingsFile, "utf8"));

    expect(settings.hooks.PreToolUse).toContainEqual({
      matcher: "",
      hooks: [{ type: "command", command: expectedPreToolCommand }],
    });
    expect(JSON.stringify(settings)).not.toContain(toHookCommand("pre_tool", "claude"));

    const result = await removeClaudeSettings({ root: tempRoot, hookCommandPrefix });
    const removedSettings = JSON.parse(await readFile(settingsFile, "utf8"));

    expect(result.hooksRemoved).toBe(GATE_TYPES.length);
    expect(JSON.stringify(removedSettings)).not.toContain(expectedPreToolCommand);
  });

  it("removes only managed HIMA hooks while preserving user settings and hooks", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");

    await writeFile(
      settingsFile,
      `${JSON.stringify(
        {
          theme: "dark",
          hooks: {
            PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo keep" }] }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await applyClaudeSettings({ root: tempRoot });

    const result = await removeClaudeSettings({ root: tempRoot });
    const settings = JSON.parse(await readFile(settingsFile, "utf8"));

    expect(result.hooksRemoved).toBe(GATE_TYPES.length);
    expect(settings.theme).toBe("dark");
    expect(settings.hooks.PreToolUse).toEqual([
      { matcher: "Write", hooks: [{ type: "command", command: "echo keep" }] },
    ]);
    expect(JSON.stringify(settings)).not.toContain(toHookCommand("pre_tool", "claude"));
  });

  it("rejects hardlinked settings targets without mutating the external file", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-claude-global-"));
    const externalFile = path.join(externalRoot, "settings.json");
    const externalContent = `${JSON.stringify({ theme: "global" }, null, 2)}\n`;

    try {
      await writeFile(externalFile, externalContent, "utf8");
      await link(externalFile, settingsFile);

      await expect(applyClaudeSettings({ root: tempRoot })).rejects.toThrow(
        "Refusing to write through hardlinked target",
      );
      await expect(readFile(externalFile, "utf8")).resolves.toBe(externalContent);
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  it("rejects symlinked settings targets without mutating the external file", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-claude-global-"));
    const externalFile = path.join(externalRoot, "settings.json");
    const externalContent = `${JSON.stringify({ theme: "global" }, null, 2)}\n`;

    try {
      await writeFile(externalFile, externalContent, "utf8");

      try {
        await symlink(externalFile, settingsFile, "file");
      } catch (error) {
        if (isNodeErrorWithCode(error, "EPERM")) {
          return;
        }

        throw error;
      }

      await expect(applyClaudeSettings({ root: tempRoot })).rejects.toThrow(
        "Refusing to write through symlinked target",
      );
      await expect(readFile(externalFile, "utf8")).resolves.toBe(externalContent);
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });
});

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
