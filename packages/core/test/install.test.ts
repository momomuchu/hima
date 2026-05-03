import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectPlatform,
  GATE_TYPES,
  type InstallManifest,
  installPlatform,
  toHookCommand,
  validatePlatformInstall,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-install-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("platform install", () => {
  it("defaults to a dry-run and returns planned actions without creating platform files", async () => {
    const result = await installPlatform({ projectRoot: root, target: "codex" });

    expect(result.dryRun).toBe(true);
    expect(result.manifestWritten).toBe(false);
    expect(result.expectedPaths.platformDirectory).toBe(path.join(root, ".codex"));
    expect(result.expectedPaths.hooksDirectory).toBe(path.join(root, ".codex", "hooks"));
    expect(result.expectedPaths.manifestFile).toBe(
      path.join(root, ".planning", "install-manifest.json"),
    );
    expect(
      result.plannedActions.filter((action) => action.kind === "ensure_directory"),
    ).toHaveLength(2);
    expect(result.plannedActions.filter((action) => action.kind === "register_hook")).toHaveLength(
      GATE_TYPES.length,
    );
    await expect(stat(result.expectedPaths.platformDirectory)).rejects.toThrow();
    await expect(stat(result.expectedPaths.manifestFile)).rejects.toThrow();
  });

  it("rejects an invalid install target", async () => {
    await expect(validatePlatformInstall({ projectRoot: root, target: "unknown" })).rejects.toThrow(
      'Invalid install target "unknown"',
    );
  });

  it("writes only the optional install manifest when requested", async () => {
    const now = new Date("2026-05-03T00:00:00.000Z");
    const result = await installPlatform({
      projectRoot: root,
      target: "claude",
      writeManifest: true,
      now,
    });
    const rawManifest = await readFile(result.expectedPaths.manifestFile, "utf8");
    const manifest = JSON.parse(rawManifest) as InstallManifest;

    expect(result.manifestWritten).toBe(true);
    expect(manifest).toEqual(result.manifest);
    expect(manifest.target).toBe("claude");
    expect(manifest.dryRun).toBe(true);
    expect(manifest.createdAt).toBe("2026-05-03T00:00:00.000Z");
    expect(
      manifest.plannedActions.filter((action) => action.kind === "ensure_directory"),
    ).toHaveLength(2);
    expect(
      manifest.plannedActions.filter((action) => action.kind === "register_hook"),
    ).toHaveLength(GATE_TYPES.length);
    expect(manifest.plannedActions.at(-1)?.kind).toBe("write_manifest");
    await expect(stat(result.expectedPaths.platformDirectory)).rejects.toThrow();
  });

  it("detects existing platform paths independently of install writes", async () => {
    const dryRun = await installPlatform({ projectRoot: root, target: "hermes" });
    const detection = await detectPlatform(root, "hermes");

    expect(dryRun.manifestWritten).toBe(false);
    expect(detection.detected).toBe(false);
    expect(detection.checks.every((check) => check.status === "warn")).toBe(true);
  });

  it("plans Codex hook registrations, missing markers, and codex_hooks feature flag", async () => {
    const result = await installPlatform({ projectRoot: root, target: "codex" });
    const hookActions = result.plannedActions.filter((action) => action.kind === "register_hook");
    const featureFlagActions = result.plannedActions.filter(
      (action) => action.kind === "set_feature_flag",
    );

    expect(hookActions.map((action) => action.gateType).sort()).toEqual([...GATE_TYPES].sort());
    expect(hookActions.map((action) => action.command).sort()).toEqual(
      GATE_TYPES.map((gateType) => toHookCommand(gateType)).sort(),
    );
    expect(hookActions.find((action) => action.gateType === "subagent_stop")).toMatchObject({
      nativeEvent: null,
      supported: false,
      status: "missing",
    });
    expect(featureFlagActions).toEqual([
      expect.objectContaining({
        featureFlag: "codex_hooks",
        value: true,
        dryRun: true,
      }),
    ]);
    await expect(stat(path.join(root, ".planning", "state.yaml"))).rejects.toThrow();
    await expect(stat(path.join(root, ".planning", "run-set.json"))).rejects.toThrow();
    await expect(stat(path.join(root, ".planning", "current-risk.yaml"))).rejects.toThrow();
  });
});
