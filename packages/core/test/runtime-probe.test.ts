import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  computeRuntimeProfileDigest,
  getPlatformExpectedPaths,
  getRuntimeProfile,
  initPlanningProject,
  installPlatform,
  probeRuntime,
  readPlanningProject,
  toHookCommand,
} from "../src/index.js";
import {
  TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
  TRUSTED_RUNTIME_PROOF_VERIFIER,
} from "../src/runtime/runtime-proofs.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-runtime-probe-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("runtime probe", () => {
  it("keeps blocking hooks stale when only managed Codex hook config is present", async () => {
    const profileDigest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await writeCodexConfig(codexPreToolConfig());

    const result = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
    });
    const project = await readPlanningProject(root);
    const proof = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
      (item) => item.type === "negative_fixture",
    );

    expect(result.configRead).toBe(true);
    expect(result.runtimeVersion).toBe(getRuntimeProfile("codex").runtimeVersion);
    expect(result.profileDigest).toBe(profileDigest);
    expect(result.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.configDigest).not.toBe(profileDigest);
    expect(result.registeredHooks).toContain("pre_tool");
    expect(result.verifiedBlockingFixtures).not.toContain("pre_tool");
    expect(result.bindings?.pre_tool).toMatchObject({
      status: "stale",
      canBlock: false,
      configDigest: result.configDigest,
    });
    expect(proof).toBeUndefined();
  });

  it("mints trusted blocking proof only after managed fixture verification", async () => {
    const profileDigest = computeRuntimeProfileDigest("codex");
    await initPlanningProject(root);
    await writeCodexConfig(codexPreToolConfig());

    const result = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
      verifyBlockingFixtures: true,
    });
    const project = await readPlanningProject(root);
    const proof = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
      (item) => item.type === "negative_fixture",
    );

    expect(result.configRead).toBe(true);
    expect(result.profileDigest).toBe(profileDigest);
    expect(result.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.configDigest).not.toBe(profileDigest);
    expect(result.registeredHooks).toContain("pre_tool");
    expect(result.verifiedBlockingFixtures).toContain("pre_tool");
    expect(result.bindings?.pre_tool).toMatchObject({
      status: "native",
      canBlock: true,
      configDigest: result.configDigest,
    });
    expect(proof).toMatchObject({
      status: "accepted",
      verifier: TRUSTED_RUNTIME_PROOF_VERIFIER,
      target: "codex",
      runtimeVersion: result.runtimeVersion,
      gateType: "pre_tool",
      configDigest: result.configDigest,
      result: TRUSTED_BLOCKING_RUNTIME_PROOF_RESULT,
    });
    expect(proof?.proofDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("recognizes Claude hooks installed with a manifest-managed command prefix", async () => {
    const hookCommandPrefix = 'node "C:/repo/packages/cli/dist/index.js"';
    const expectedPreToolCommand = `${hookCommandPrefix} hook pre-tool-use --format claude`;
    await initPlanningProject(root);
    await installPlatform({
      projectRoot: root,
      target: "claude",
      writeManifest: true,
      hookCommandPrefix,
      now: new Date("2026-05-03T00:00:00.000Z"),
    });
    await writeClaudeSettings({
      hooks: {
        PreToolUse: [
          {
            matcher: "",
            hooks: [{ type: "command", command: expectedPreToolCommand }],
          },
        ],
      },
    });

    const result = await probeRuntime(root, "claude", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
      verifyBlockingFixtures: true,
    });

    expect(result.configRead).toBe(true);
    expect(result.registeredHooks).toContain("pre_tool");
    expect(result.verifiedBlockingFixtures).toContain("pre_tool");
    expect(result.bindings?.pre_tool).toMatchObject({
      status: "native",
      canBlock: true,
      configDigest: result.configDigest,
    });
  });

  it("changes trusted runtime config digest when observed hook config changes", async () => {
    await initPlanningProject(root);
    await writeCodexConfig(codexPreToolConfig());

    const first = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
      verifyBlockingFixtures: true,
    });

    await writeCodexConfig(`
# probe drift marker
${codexPreToolConfig().trimStart()}
`);

    const second = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      bind: true,
      verifyBlockingFixtures: true,
    });

    expect(first.profileDigest).toBe(second.profileDigest);
    expect(first.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(second.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.configDigest).not.toBe(second.configDigest);
    expect(first.bindings?.pre_tool.configDigest).toBe(first.configDigest);
    expect(second.bindings?.pre_tool.configDigest).toBe(second.configDigest);
  });

  it("changes trusted runtime config digest when runtime version changes", async () => {
    await initPlanningProject(root);
    await writeCodexConfig(codexPreToolConfig());

    const first = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      runtimeVersion: "codex-runtime-v1",
      bind: true,
      verifyBlockingFixtures: true,
    });

    const second = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:01.000Z",
      runtimeVersion: "codex-runtime-v2",
      bind: true,
      verifyBlockingFixtures: true,
    });

    expect(first.profileDigest).toBe(second.profileDigest);
    expect(first.runtimeVersion).toBe("codex-runtime-v1");
    expect(second.runtimeVersion).toBe("codex-runtime-v2");
    expect(first.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(second.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.configDigest).not.toBe(second.configDigest);
    expect(first.bindings?.pre_tool.runtimeVersion).toBe("codex-runtime-v1");
    expect(second.bindings?.pre_tool.runtimeVersion).toBe("codex-runtime-v2");
  });

  it("changes trusted runtime config digest when install manifest changes", async () => {
    await initPlanningProject(root);
    await writeCodexConfig(codexPreToolConfig());
    await installPlatform({
      projectRoot: root,
      target: "codex",
      writeManifest: true,
      now: new Date("2026-05-03T00:00:00.000Z"),
    });

    const first = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
      verifyBlockingFixtures: true,
    });

    await installPlatform({
      projectRoot: root,
      target: "codex",
      writeManifest: true,
      now: new Date("2026-05-03T00:01:00.000Z"),
    });

    const second = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:01:00.000Z",
      bind: true,
      verifyBlockingFixtures: true,
    });

    expect(first.profileDigest).toBe(second.profileDigest);
    expect(first.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(second.configDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.configDigest).not.toBe(second.configDigest);
    expect(first.bindings?.pre_tool.configDigest).toBe(first.configDigest);
    expect(second.bindings?.pre_tool.configDigest).toBe(second.configDigest);
  });

  it("does not persist trusted runtime proof when install manifest belongs to another project", async () => {
    await initPlanningProject(root);
    await writeCodexConfig(codexPreToolConfig());
    const install = await installPlatform({
      projectRoot: root,
      target: "codex",
      writeManifest: true,
      now: new Date("2026-05-03T00:00:00.000Z"),
    });
    if (!install.manifest) {
      throw new Error("expected install manifest");
    }
    const foreignManifest = {
      ...install.manifest,
      expectedPaths: {
        ...install.manifest.expectedPaths,
        projectRoot: path.join(root, "foreign"),
      },
    };
    await writeFile(
      install.expectedPaths.manifestFile,
      `${JSON.stringify(foreignManifest, null, 2)}\n`,
      "utf8",
    );

    await expect(
      probeRuntime(root, "codex", {
        inspectedAt: "2026-05-03T00:00:00.000Z",
        bind: true,
        verifyBlockingFixtures: true,
      }),
    ).rejects.toThrow("Install manifest projectRoot does not match");

    const project = await readPlanningProject(root);
    const proof = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
      (item) => item.type === "negative_fixture",
    );

    expect(proof).toBeUndefined();
  });

  it("keeps blocking hooks non-native when managed hook config is missing", async () => {
    await initPlanningProject(root);

    const result = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
    });

    expect(result.configRead).toBe(false);
    expect(result.configDigest).toBeUndefined();
    expect(result.registeredHooks).not.toContain("pre_tool");
    expect(result.bindings?.pre_tool).toMatchObject({
      status: "missing",
      canBlock: false,
    });
  });

  it("keeps Codex hooks non-native when codex_hooks feature flag is missing", async () => {
    await initPlanningProject(root);
    await writeCodexConfig(`
[[hooks.PreToolUse]]

[[hooks.PreToolUse.hooks]]
type = "command"
command = "${toHookCommand("pre_tool", "codex")}"
`);

    const result = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
    });
    const project = await readPlanningProject(root);
    const proof = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
      (item) => item.type === "negative_fixture",
    );

    expect(result.configRead).toBe(true);
    expect(result.registeredHooks).not.toContain("pre_tool");
    expect(result.bindings?.pre_tool).toMatchObject({
      status: "missing",
      canBlock: false,
    });
    expect(proof).toBeUndefined();
  });

  it("keeps Codex hooks non-native when codex_hooks feature flag is false", async () => {
    await initPlanningProject(root);
    await writeCodexConfig(`
[features]
codex_hooks = false

[[hooks.PreToolUse]]

[[hooks.PreToolUse.hooks]]
type = "command"
command = "${toHookCommand("pre_tool", "codex")}"
`);

    const result = await probeRuntime(root, "codex", {
      inspectedAt: "2026-05-03T00:00:00.000Z",
      bind: true,
    });
    const project = await readPlanningProject(root);
    const proof = project.runSet.runtimeCapabilities.codex?.hooks.pre_tool?.proofs?.find(
      (item) => item.type === "negative_fixture",
    );

    expect(result.configRead).toBe(true);
    expect(result.registeredHooks).not.toContain("pre_tool");
    expect(result.bindings?.pre_tool).toMatchObject({
      status: "missing",
      canBlock: false,
    });
    expect(proof).toBeUndefined();
  });
});

async function writeCodexConfig(content: string): Promise<void> {
  const paths = getPlatformExpectedPaths(root, "codex");
  await mkdir(paths.platformDirectory, { recursive: true });
  await writeFile(path.join(paths.platformDirectory, "config.toml"), content.trimStart(), "utf8");
}

function codexPreToolConfig(command = toHookCommand("pre_tool", "codex")): string {
  return `
[features]
codex_hooks = true

[[hooks.PreToolUse]]

[[hooks.PreToolUse.hooks]]
type = "command"
command = "${command}"
`;
}

async function writeClaudeSettings(settings: unknown): Promise<void> {
  const paths = getPlatformExpectedPaths(root, "claude");
  await mkdir(paths.platformDirectory, { recursive: true });
  await writeFile(
    path.join(paths.platformDirectory, "settings.json"),
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );
}
