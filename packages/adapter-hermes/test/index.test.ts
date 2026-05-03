import { link, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GATE_TYPES, toHookCommand } from "@harness/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyHermesHookConfig, buildHermesHookPreview, HERMES_CONFIG_FILE } from "../src/index.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-hermes-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("buildHermesHookPreview", () => {
  it("returns plugin/gateway merge and hook append operations", () => {
    const preview = buildHermesHookPreview();

    expect(preview.operations).toContainEqual({
      kind: "merge",
      path: "gateway.plugins",
      value: {
        plugin: "harness",
        mode: "preview",
      },
    });
    expect(preview.operations.filter((operation) => operation.kind === "append")).toHaveLength(
      GATE_TYPES.length - 1,
    );
  });

  it("marks unsupported blocking behavior as missing or degraded", () => {
    const preview = buildHermesHookPreview();

    expect(preview.operations).toContainEqual({
      kind: "append",
      path: "gateway.plugins.harness.hooks",
      value: {
        gateType: "pre_tool",
        event: "pre_tool_call",
        command: toHookCommand("pre_tool"),
        blocking: true,
      },
    });
    expect(preview.markers).toContainEqual({
      gateType: "subagent_start",
      status: "missing",
      reason: "runtime does not expose a native event for this gate",
    });
    expect(preview.markers).toContainEqual({
      gateType: "subagent_stop",
      status: "degraded",
      reason: "runtime hook is observable but cannot block",
    });
  });

  it("documents and applies the deterministic MVP config file", async () => {
    const result = await applyHermesHookConfig({ root: tempRoot });

    expect(path.basename(result.configFile)).toBe(HERMES_CONFIG_FILE);
  });

  it("applies Hermes hooks while preserving unrelated gateway config and plugins", async () => {
    const configFile = path.join(tempRoot, HERMES_CONFIG_FILE);
    await writeFile(
      configFile,
      `${JSON.stringify(
        {
          gateway: {
            timeoutMs: 1000,
            plugins: [{ plugin: "audit", enabled: true }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await applyHermesHookConfig({ root: tempRoot });
    const config = JSON.parse(await readFile(configFile, "utf8"));
    const harnessPlugin = config.gateway.plugins.find(
      (plugin: { plugin: string }) => plugin.plugin === "harness",
    );

    expect(result.hooksAdded).toBe(GATE_TYPES.length - 1);
    expect(result.pluginAdded).toBe(true);
    expect(config.gateway.timeoutMs).toBe(1000);
    expect(config.gateway.plugins).toContainEqual({ plugin: "audit", enabled: true });
    expect(harnessPlugin.hooks).toContainEqual({
      gateType: "pre_tool",
      event: "pre_tool_call",
      command: toHookCommand("pre_tool"),
      blocking: true,
    });
  });

  it("is idempotent and keeps canonical hook command aliases", async () => {
    const configFile = path.join(tempRoot, HERMES_CONFIG_FILE);

    await applyHermesHookConfig({ root: tempRoot });
    const secondResult = await applyHermesHookConfig({ root: tempRoot });
    const config = JSON.parse(await readFile(configFile, "utf8"));
    const harnessPlugin = config.gateway.plugins.find(
      (plugin: { plugin: string }) => plugin.plugin === "harness",
    );

    expect(secondResult.hooksAdded).toBe(0);
    expect(harnessPlugin.hooks).toHaveLength(GATE_TYPES.length - 1);
    expect(
      harnessPlugin.hooks.filter(
        (hook: { command: string }) => hook.command === toHookCommand("pre_tool"),
      ),
    ).toHaveLength(1);
  });

  it("rejects hardlinked config targets without mutating the external file", async () => {
    const configFile = path.join(tempRoot, HERMES_CONFIG_FILE);
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-hermes-global-"));
    const externalFile = path.join(externalRoot, HERMES_CONFIG_FILE);
    const externalContent = `${JSON.stringify({ gateway: { plugins: [] } }, null, 2)}\n`;

    try {
      await writeFile(externalFile, externalContent, "utf8");
      await link(externalFile, configFile);

      await expect(applyHermesHookConfig({ root: tempRoot })).rejects.toThrow(
        "Refusing to write through hardlinked target",
      );
      await expect(readFile(externalFile, "utf8")).resolves.toBe(externalContent);
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  it("rejects symlinked config targets without mutating the external file", async () => {
    const configFile = path.join(tempRoot, HERMES_CONFIG_FILE);
    const externalRoot = await mkdtemp(path.join(os.tmpdir(), "adapter-hermes-global-"));
    const externalFile = path.join(externalRoot, HERMES_CONFIG_FILE);
    const externalContent = `${JSON.stringify({ gateway: { plugins: [] } }, null, 2)}\n`;

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

      await expect(applyHermesHookConfig({ root: tempRoot })).rejects.toThrow(
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
