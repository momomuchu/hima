import { link, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GATE_TYPES, getRuntimeProfile, toHookCommand } from "@harness/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyCodexHookConfig,
  buildCodexHookConfigPreview,
  getCodexHookBindings,
  removeCodexHookConfig,
} from "../src/index.js";
import { applyCodexInstall, planCodexInstall } from "../src/install.js";

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
      value: { features: { hooks: true } },
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
        command: toHookCommand("pre_tool", "codex"),
      },
    });
    expect(preview.markers).toContainEqual({
      gateType: "subagent_stop",
      status: "missing",
      reason: "runtime does not expose a native event for this gate",
    });
  });

  it("keeps every generated hook command aligned with the Codex runtime profile", () => {
    const profile = getRuntimeProfile("codex");
    const preview = buildCodexHookConfigPreview();
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
              },
            ]
          : [];
      }),
    );
    expect(preview.markers).toEqual([
      {
        gateType: "subagent_start",
        status: "missing",
        reason: "runtime does not expose a native event for this gate",
      },
      {
        gateType: "subagent_stop",
        status: "missing",
        reason: "runtime does not expose a native event for this gate",
      },
    ]);
  });

  it("ships a package-local system prompt with anti-bypass and unsupported-hook boundaries", async () => {
    const prompt = await readFile(new URL("../src/system-prompt.md", import.meta.url), "utf8");

    expect(prompt).toContain("Do not bypass HIMA");
    expect(prompt).toContain(".planning/");
    expect(prompt).toContain(".hima/state/");
    expect(prompt).toContain("subagent_start");
    expect(prompt).toContain("subagent_stop");
    expect(prompt).toContain("real-runtime E2E");
    expect(prompt).toContain("five-client compatibility");
  });

  it("exposes hook bindings aligned with the Codex runtime profile", () => {
    const profile = getRuntimeProfile("codex");
    const bindings = getCodexHookBindings();

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
          target: "codex",
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
    ).toEqual(["subagent_start", "subagent_stop"]);
    expect(
      bindings
        .filter((binding) => binding.status === "degraded")
        .map((binding) => binding.gateType),
    ).toEqual(["session_start", "post_tool", "post_compact"]);
    expect(
      bindings
        .filter((binding) => binding.status === "unsupported")
        .every((binding) => binding.nativeEvent === null && !binding.canBlock),
    ).toBe(true);
  });

  it("plans install wiring from prompt and hook-binding surfaces without writing", async () => {
    const plan = planCodexInstall({ root: tempRoot });

    expect(plan.configFile).toBe(path.join(path.resolve(tempRoot), "config.toml"));
    expect(plan.systemPromptFile).toContain(path.join("src", "system-prompt.md"));
    expect(plan.hookBindings).toEqual(getCodexHookBindings());
    expect(plan.unsupportedHooks.map((binding) => binding.gateType)).toEqual([
      "subagent_start",
      "subagent_stop",
    ]);
    expect(plan.degradedHooks.map((binding) => binding.gateType)).toEqual([
      "session_start",
      "post_tool",
      "post_compact",
    ]);
    expect(plan.hooksPlanned).toBe(GATE_TYPES.length - 2);
    await expect(readFile(plan.configFile, "utf8")).rejects.toThrow();
  });

  it("applies config through the install module while preserving unsupported hook metadata", async () => {
    const result = await applyCodexInstall({ root: tempRoot });

    expect(result.hooksAdded).toBe(GATE_TYPES.length - 2);
    expect(result.configFile).toBe(path.join(tempRoot, "config.toml"));
    expect(result.plan.unsupportedHooks.map((binding) => binding.gateType)).toEqual([
      "subagent_start",
      "subagent_stop",
    ]);
    expect(await readFile(result.configFile, "utf8")).toContain("hooks = true");
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
    expect(config).toContain("hooks = true");
    expect(config).toContain("[[hooks.PreToolUse]]");
    expect(config).toContain("[[hooks.PreToolUse.hooks]]");
    expect(config).toContain(`command = "${toHookCommand("pre_tool", "codex")}"`);
  });

  it("repairs an existing disabled hooks feature flag", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(
      configFile,
      'model = "gpt-5.5"\n\n[features]\nhooks = false\nexisting = true\n',
      "utf8",
    );

    const result = await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(result.featureFlagAdded).toBe(true);
    expect(config).toContain("hooks = true");
    expect(config).not.toContain("hooks = false");
    expect(config).toContain("existing = true");
    expect(config).toContain("[[hooks.PreToolUse]]");
  });

  it("removes the deprecated codex_hooks feature flag", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(
      configFile,
      'model = "gpt-5.5"\n\n[features]\ncodex_hooks = true\nexisting = true\n',
      "utf8",
    );

    const result = await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(result.featureFlagAdded).toBe(true);
    expect(config).toContain("hooks = true");
    expect(config).not.toContain("codex_hooks");
    expect(config).toContain("existing = true");
  });

  it("is idempotent and keeps canonical hook command aliases", async () => {
    const configFile = path.join(tempRoot, "config.toml");

    await applyCodexHookConfig({ root: tempRoot });
    const secondResult = await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(secondResult.hooksAdded).toBe(0);
    expect(secondResult.featureFlagAdded).toBe(false);
    expect(config.match(/\[\[hooks\.[^.\]]+\]\]/g)).toHaveLength(GATE_TYPES.length - 2);
    expect(config.match(new RegExp(toHookCommand("pre_tool", "codex"), "g"))).toHaveLength(1);
  });

  it("replaces stale managed HIMA hook blocks without duplicating Codex events", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(
      configFile,
      [
        "[features]",
        "hooks = true",
        "",
        "[[hooks]]",
        'gate_type = "pre_tool"',
        'event = "PreToolUse"',
        'command = "node \\"C:/repo/packages/cli/dist/index.js\\" hook pre-tool-use"',
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(result.hooksAdded).toBe(GATE_TYPES.length - 2);
    expect(config.match(/\[\[hooks\.PreToolUse\]\]/g)).toHaveLength(1);
    expect(config).toContain(`command = "${toHookCommand("pre_tool", "codex")}"`);
    expect(config).not.toMatch(/^command = "harness hook pre-tool-use"$/m);
  });

  it("repairs stale official Codex hook tables", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(
      configFile,
      [
        "[features]",
        "hooks = true",
        "",
        "[[hooks.PreToolUse]]",
        "",
        "[[hooks.PreToolUse.hooks]]",
        'type = "command"',
        `command = "${toHookCommand("pre_tool")}"`,
        "",
      ].join("\n"),
      "utf8",
    );

    await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(config.match(/\[\[hooks\.PreToolUse\]\]/g)).toHaveLength(1);
    expect(config).toContain(`command = "${toHookCommand("pre_tool", "codex")}"`);
    expect(config).not.toMatch(/^command = "harness hook pre-tool-use"$/m);
  });

  it("repairs stale official Codex command entries while preserving mixed user commands", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(
      configFile,
      [
        "[features]",
        "hooks = true",
        "",
        "[[hooks.PreToolUse]]",
        '# hima_gate_type = "pre_tool"',
        "",
        "[[hooks.PreToolUse.hooks]]",
        'type = "command"',
        `command = "${toHookCommand("pre_tool")}"`,
        "",
        "[[hooks.PreToolUse.hooks]]",
        'type = "command"',
        'command = "echo keep-user-hook"',
        "",
      ].join("\n"),
      "utf8",
    );

    await applyCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(config).toContain(`command = "${toHookCommand("pre_tool", "codex")}"`);
    expect(config).toContain('command = "echo keep-user-hook"');
    expect(config).not.toMatch(/^command = "harness hook pre-tool-use"$/m);
  });

  it("removes only managed HIMA hook blocks while preserving user config", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await applyCodexHookConfig({ root: tempRoot });
    await writeFile(
      configFile,
      `${await readFile(configFile, "utf8")}

[[hooks]]
event = "PreToolUse"
command = "echo keep-user-hook"
`,
      "utf8",
    );

    const result = await removeCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(result.hooksRemoved).toBe(GATE_TYPES.length - 2);
    expect(config).toContain("hooks = true");
    expect(config).toContain("echo keep-user-hook");
    expect(config).not.toContain(toHookCommand("pre_tool", "codex"));
  });

  it("removes managed official Codex command entries while preserving mixed user commands", async () => {
    const configFile = path.join(tempRoot, "config.toml");
    await writeFile(
      configFile,
      [
        "[features]",
        "hooks = true",
        "",
        "[[hooks.PreToolUse]]",
        '# hima_gate_type = "pre_tool"',
        "",
        "[[hooks.PreToolUse.hooks]]",
        'type = "command"',
        `command = "${toHookCommand("pre_tool", "codex")}"`,
        "",
        "[[hooks.PreToolUse.hooks]]",
        'type = "command"',
        'command = "echo keep-user-hook"',
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await removeCodexHookConfig({ root: tempRoot });
    const config = await readFile(configFile, "utf8");

    expect(result.hooksRemoved).toBe(1);
    expect(config).toContain("hooks = true");
    expect(config).toContain('command = "echo keep-user-hook"');
    expect(config).not.toContain(toHookCommand("pre_tool", "codex"));
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
