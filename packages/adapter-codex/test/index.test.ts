import { link, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GATE_TYPES, toHookCommand } from "@harness/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyCodexHookConfig, buildCodexHookConfigPreview } from "../src/index.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-codex-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("buildCodexHookConfigPreview", () => {
  it("returns merge and append operations without overwrites", () => {
    const preview = buildCodexHookConfigPreview();

    expect(preview.operations.every((operation) => operation.kind !== "overwrite")).toBe(true);
    expect(preview.operations).toContainEqual({
      kind: "merge",
      path: "config.toml",
      value: { features: { codex_hooks: true } },
    });
    expect(preview.operations.filter((operation) => operation.kind === "append")).toHaveLength(
      GATE_TYPES.length - 2,
    );
  });

  it("includes commands for supported gates and a missing subagent_stop marker", () => {
    const preview = buildCodexHookConfigPreview();
    const appendOperations = preview.operations.filter((operation) => operation.kind === "append");

    expect(appendOperations).toContainEqual({
      kind: "append",
      path: "config.toml.hooks",
      value: {
        gateType: "pre_tool",
        event: "PreToolUse",
        command: toHookCommand("pre_tool"),
      },
    });
    expect(preview.markers).toContainEqual({
      gateType: "subagent_stop",
      status: "missing",
      reason: "runtime does not expose a native event for this gate",
    });
  });

  it("applies config.toml hooks while preserving unrelated config", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(configFile, 'model = "gpt-5.5"\n\n[features]\nexisting = true\n', "utf8");

    const result = await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(result.hooksAdded).toBe(GATE_TYPES.length - 2);
    expect(result.featureFlagAdded).toBe(true);
    expect(config).toContain('model = "gpt-5.5"');
    expect(config).toContain("existing = true");
    expect(config).toContain("codex_hooks = true");
    expect(config).toContain(`event = "PreToolUse"`);
    expect(config).toContain(`command = "${toHookCommand("pre_tool")}"`);
  });

  it("is idempotent and keeps canonical hook command aliases", async () => {
    const configFile = path.join(tempRoot, "config.toml");

    await applyCodexHookConfig({ root: tempRoot });
    const secondResult = await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(secondResult.hooksAdded).toBe(0);
    expect(secondResult.featureFlagAdded).toBe(false);
    expect(config.match(/\[\[hooks\]\]/g)).toHaveLength(GATE_TYPES.length - 2);
    expect(config.match(new RegExp(toHookCommand("pre_tool"), "g"))).toHaveLength(1);
  });

  it("rejects hardlinked config targets without mutating the external file", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-codex-global-"));
    const externalFile = path.join(externalRoot, "config.toml");
    const externalContent = 'model = "global"\n';

    try {
      await writeFile(externalFile, externalContent, "utf8");
      await link(externalFile, configFile);

      await expect(applyCodexHookConfig({ root: tempRoot })).rejects.toThrow(
        "Refusing to write through hardlinked target",
      );
      await expect(readFile(externalFile, "utf8")).resolves.toBe(externalContent);
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  it("rejects symlinked config targets without mutating the external file", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-codex-global-"));
    const externalFile = path.join(externalRoot, "config.toml");
    const externalContent = 'model = "global"\n';

    try {
      await writeFile(externalFile, externalContent, "utf8");

      try {
        await symlink(externalFile, configFile, "file");
      } catch (error) {
        if (isNodeErrorWithCode(error, "EPERM")) {
          return;
        }

        throw error;
      }

      await expect(applyCodexHookConfig({ root: tempRoot })).rejects.toThrow(
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
