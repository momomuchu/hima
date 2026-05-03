import { link, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GATE_TYPES, toHookCommand } from "@harness/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyClaudeSettings, buildClaudeSettingsPreview } from "../src/index.js";

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
        hooks: [{ type: "command", command: toHookCommand("user_prompt") }],
      },
    });
  });

  it("uses core gate coverage and reports no missing native markers", () => {
    const preview = buildClaudeSettingsPreview();
    const previewGateTypes = preview.operations.map((operation) => operation.value.gateType);

    expect(previewGateTypes).toEqual([...GATE_TYPES]);
    expect(preview.markers).toEqual([]);
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
      hooks: [{ type: "command", command: toHookCommand("pre_tool") }],
    });
  });

  it("is idempotent and keeps canonical hook command aliases", async () => {
    const settingsFile = path.join(tempRoot, "settings.json");

    await applyClaudeSettings({ root: tempRoot });
    const secondResult = await applyClaudeSettings({ root: tempRoot });
    const settings = JSON.parse(await readFile(settingsFile, "utf8"));

    expect(secondResult.hooksAdded).toBe(0);
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe(toHookCommand("pre_tool"));
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
