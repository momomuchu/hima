import { link, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GATE_TYPES, getRuntimeProfile, toHookCommand } from "@harness/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyHermesHookConfig,
  buildHermesHookPreview,
  getHermesHookBindings,
  HERMES_CONFIG_FILE,
  removeHermesHookConfig,
} from "../src/index.js";
import { applyHermesInstall, planHermesInstall } from "../src/install.js";

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

  it("keeps every generated hook command aligned with the Hermes runtime profile", () => {
    const profile = getRuntimeProfile("hermes");
    const preview = buildHermesHookPreview();
    const appendValues = preview.operations.flatMap((operation) =>
      operation.kind === "append" ? [operation.value] : [],
    );

    expect(appendValues).toEqual(
      GATE_TYPES.flatMap((gateType) => {
        const hook = profile.hooks[gateType];

        return hook.supported && hook.nativeEvent
          ? [
              {
                gateType,
                event: hook.nativeEvent,
                command: hook.command,
                blocking: hook.canBlock,
              },
            ]
          : [];
      }),
    );
    expect(preview.markers).toEqual([
      {
        gateType: "session_start",
        status: "degraded",
        reason: "runtime hook is observable but cannot block",
      },
      {
        gateType: "post_tool",
        status: "degraded",
        reason: "runtime hook is observable but cannot block",
      },
      {
        gateType: "post_compact",
        status: "degraded",
        reason: "runtime hook is observable but cannot block",
      },
      {
        gateType: "stop",
        status: "degraded",
        reason: "runtime hook is observable but cannot block",
      },
      {
        gateType: "subagent_start",
        status: "missing",
        reason: "runtime does not expose a native event for this gate",
      },
      {
        gateType: "subagent_stop",
        status: "degraded",
        reason: "runtime hook is observable but cannot block",
      },
    ]);
  });

  it("ships a package-local system prompt with anti-bypass and degraded-hook boundaries", async () => {
    const prompt = await readFile(new URL("../src/system-prompt.md", import.meta.url), "utf8");

    expect(prompt).toContain("Do not bypass HIMA");
    expect(prompt).toContain(".planning/");
    expect(prompt).toContain(".hima/state/");
    expect(prompt).toContain("subagent_start");
    expect(prompt).toContain("observable but non-blocking");
    expect(prompt).toContain("real-runtime E2E");
    expect(prompt).toContain("five-client compatibility");
  });

  it("exposes hook bindings aligned with the Hermes runtime profile", () => {
    const profile = getRuntimeProfile("hermes");
    const bindings = getHermesHookBindings();

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
          target: "hermes",
          gateType,
          nativeEvent: hook.nativeEvent,
          canBlock: hook.canBlock,
          supported: hook.supported,
          command: hook.command,
        };
      }),
    );
    expect(
      bindings
        .filter((binding) => binding.status === "unsupported")
        .map((binding) => binding.gateType),
    ).toEqual(["subagent_start"]);
    expect(
      bindings
        .filter((binding) => binding.status === "degraded")
        .map((binding) => binding.gateType),
    ).toEqual(["session_start", "post_tool", "post_compact", "stop", "subagent_stop"]);
    expect(bindings.find((binding) => binding.gateType === "subagent_stop")).toMatchObject({
      status: "degraded",
      canBlock: false,
      reason: "runtime hook is observable but cannot block",
    });
  });

  it("plans install wiring from prompt and hook-binding surfaces without writing", async () => {
    const plan = planHermesInstall({ root: tempRoot });

    expect(plan.configFile).toBe(path.join(path.resolve(tempRoot), HERMES_CONFIG_FILE));
    expect(plan.systemPromptFile).toContain(path.join("src", "system-prompt.md"));
    expect(plan.hookBindings).toEqual(getHermesHookBindings());
    expect(plan.unsupportedHooks.map((binding) => binding.gateType)).toEqual(["subagent_start"]);
    expect(plan.degradedHooks.map((binding) => binding.gateType)).toEqual([
      "session_start",
      "post_tool",
      "post_compact",
      "stop",
      "subagent_stop",
    ]);
    expect(plan.hooksPlanned).toBe(GATE_TYPES.length - 1);
    await expect(readFile(plan.configFile, "utf8")).rejects.toThrow();
  });

  it("applies config through the install module while preserving degraded hook metadata", async () => {
    const result = await applyHermesInstall({ root: tempRoot });

    expect(result.hooksAdded).toBe(GATE_TYPES.length - 1);
    expect(result.configFile).toBe(path.join(tempRoot, HERMES_CONFIG_FILE));
    expect(result.plan.degradedHooks.map((binding) => binding.gateType)).toContain("subagent_stop");
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

  it("removes managed HIMA hooks and preserves unrelated plugins", async () => {
    const configFile = path.join(tempRoot, HERMES_CONFIG_FILE);
    await writeFile(
      configFile,
      `${JSON.stringify(
        {
          gateway: {
            plugins: [{ plugin: "audit", enabled: true }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await applyHermesHookConfig({ root: tempRoot });

    const result = await removeHermesHookConfig({ root: tempRoot });
    const config = JSON.parse(await readFile(configFile, "utf8"));

    expect(result.hooksRemoved).toBe(GATE_TYPES.length - 1);
    expect(result.pluginRemoved).toBe(true);
    expect(config.gateway.plugins).toEqual([{ plugin: "audit", enabled: true }]);
    expect(JSON.stringify(config)).not.toContain(toHookCommand("pre_tool"));
  });

  it("keeps custom harness plugin fields while removing managed hooks", async () => {
    const configFile = path.join(tempRoot, HERMES_CONFIG_FILE);
    await writeFile(
      configFile,
      `${JSON.stringify(
        {
          gateway: {
            plugins: [{ plugin: "harness", mode: "custom", enabled: true, hooks: [] }],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await applyHermesHookConfig({ root: tempRoot });

    const result = await removeHermesHookConfig({ root: tempRoot });
    const config = JSON.parse(await readFile(configFile, "utf8"));
    const harnessPlugin = config.gateway.plugins.find(
      (plugin: { plugin: string }) => plugin.plugin === "harness",
    );

    expect(result.pluginRemoved).toBe(false);
    expect(harnessPlugin).toMatchObject({ plugin: "harness", mode: "custom", enabled: true });
    expect(harnessPlugin.hooks).toEqual([]);
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
