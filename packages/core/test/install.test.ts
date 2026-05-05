import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyRuntimeLifecycle,
  detectPlatform,
  extractInstallManifestHookCommands,
  GATE_TYPES,
  getOperationalCatalog,
  type InstallManifest,
  installCatalogArtifacts,
  installPlatform,
  readInstallManifest,
  repairRuntimeLifecycle,
  toHookCommand,
  uninstallRuntimeLifecycle,
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

  it("reads and validates a platform install manifest as lifecycle authority", async () => {
    const result = await installPlatform({
      projectRoot: root,
      target: "codex",
      writeManifest: true,
      now: new Date("2026-05-03T00:00:00.000Z"),
    });

    await expect(readInstallManifest({ projectRoot: root })).resolves.toEqual(result.manifest);
  });

  it("refuses to trust a manifest for a different project root", async () => {
    const result = await installPlatform({
      projectRoot: root,
      target: "codex",
      writeManifest: true,
    });
    const installManifest = result.manifest as InstallManifest;
    const manifest = {
      ...installManifest,
      expectedPaths: {
        ...installManifest.expectedPaths,
        projectRoot: path.join(root, "other"),
      },
    };

    await writeFile(result.expectedPaths.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

    await expect(readInstallManifest({ projectRoot: root })).rejects.toThrow(
      "Install manifest projectRoot does not match",
    );
  });

  it("refuses to write an install manifest through a symlinked .planning parent", async () => {
    const outsidePlanning = await mkdtemp(path.join(tmpdir(), "harness-planning-target-"));

    try {
      await symlink(outsidePlanning, path.join(root, ".planning"), "dir");
    } catch (error) {
      await rm(outsidePlanning, { recursive: true, force: true });

      if (isNodeErrorWithCode(error, "EPERM") || isNodeErrorWithCode(error, "EACCES")) {
        return;
      }

      throw error;
    }

    try {
      await expect(
        installPlatform({ projectRoot: root, target: "codex", writeManifest: true }),
      ).rejects.toThrow("Refusing to write through symlinked parent");
      await expect(stat(path.join(outsidePlanning, "install-manifest.json"))).rejects.toThrow();
    } finally {
      await rm(outsidePlanning, { recursive: true, force: true });
    }
  });

  it("refuses to write an install manifest over a hardlinked manifest target", async () => {
    const manifestFile = path.join(root, ".planning", "install-manifest.json");
    const linkedFile = path.join(root, ".planning", "linked-manifest.json");

    await mkdir(path.dirname(manifestFile), { recursive: true });
    await writeFile(manifestFile, "{}\n", "utf8");
    await link(manifestFile, linkedFile);

    await expect(
      installPlatform({ projectRoot: root, target: "codex", writeManifest: true }),
    ).rejects.toThrow("Refusing to write through hardlinked target");
    await expect(readFile(linkedFile, "utf8")).resolves.toBe("{}\n");
  });

  it("refuses lifecycle uninstall through a symlinked install manifest", async () => {
    const install = await installPlatform({
      projectRoot: root,
      target: "codex",
      apply: true,
      writeManifest: true,
    });
    const manifestFile = install.expectedPaths.manifestFile;
    const backingManifest = path.join(path.dirname(manifestFile), "backing-install-manifest.json");
    const configFile = path.join(install.expectedPaths.platformDirectory, "config.toml");

    await mkdir(install.expectedPaths.platformDirectory, { recursive: true });
    await writeFile(configFile, `${toHookCommand("pre_tool", "codex")}\n`, "utf8");
    await rename(manifestFile, backingManifest);
    try {
      await symlink(backingManifest, manifestFile, "file");
    } catch (error) {
      await rename(backingManifest, manifestFile);

      if (isNodeErrorWithCode(error, "EPERM") || isNodeErrorWithCode(error, "EACCES")) {
        return;
      }

      throw error;
    }

    const remove = vi.fn();

    await expect(
      uninstallRuntimeLifecycle({ projectRoot: root, apply: true, platform: { remove } }),
    ).rejects.toThrow("Refusing to read symlinked install manifest");
    expect(remove).not.toHaveBeenCalled();
    await expect(readFile(configFile, "utf8")).resolves.toContain(
      toHookCommand("pre_tool", "codex"),
    );
  });

  it("refuses lifecycle uninstall through a hardlinked install manifest", async () => {
    const install = await installPlatform({
      projectRoot: root,
      target: "codex",
      apply: true,
      writeManifest: true,
    });
    const linkedFile = path.join(path.dirname(install.expectedPaths.manifestFile), "linked.json");
    const configFile = path.join(install.expectedPaths.platformDirectory, "config.toml");

    await mkdir(install.expectedPaths.platformDirectory, { recursive: true });
    await writeFile(configFile, `${toHookCommand("pre_tool", "codex")}\n`, "utf8");
    await link(install.expectedPaths.manifestFile, linkedFile);

    const remove = vi.fn();

    await expect(
      uninstallRuntimeLifecycle({ projectRoot: root, apply: true, platform: { remove } }),
    ).rejects.toThrow("Refusing to trust hardlinked install manifest");
    expect(remove).not.toHaveBeenCalled();
    await expect(readFile(configFile, "utf8")).resolves.toContain(
      toHookCommand("pre_tool", "codex"),
    );
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
      GATE_TYPES.map((gateType) => toHookCommand(gateType, "codex")).sort(),
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

  it("records explicit hook command prefixes in install manifests", async () => {
    const result = await installPlatform({
      projectRoot: root,
      target: "claude",
      hookCommandPrefix: 'node "C:/repo/packages/cli/dist/index.js"',
      writeManifest: true,
    });
    const commands = extractInstallManifestHookCommands(result.manifest as InstallManifest);

    expect(commands.pre_tool).toBe(
      'node "C:/repo/packages/cli/dist/index.js" hook pre-tool-use --format claude',
    );
    expect(result.manifest?.plannedActions).toContainEqual(
      expect.objectContaining({
        gateType: "pre_tool",
        command: commands.pre_tool,
      }),
    );
  });
});

describe("runtime lifecycle orchestration", () => {
  it("keeps unified lifecycle apply dry-run read-only by default", async () => {
    let adapterCalled = false;
    const result = await applyRuntimeLifecycle({
      projectRoot: root,
      target: "codex",
      kind: "skills",
      platform: {
        apply: () => {
          adapterCalled = true;
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "apply",
      apply: false,
      dryRun: true,
      writeManifests: false,
      target: "codex",
      kind: "skills",
    });
    expect(adapterCalled).toBe(false);
    expect(result.platformInstall.dryRun).toBe(true);
    expect(result.artifactsWritten).toEqual([]);
    await expect(stat(path.join(root, ".planning", "install-manifest.json"))).rejects.toThrow();
    await expect(
      stat(path.join(root, ".planning", "artifact-install-manifest.json")),
    ).rejects.toThrow();
    await expect(
      stat(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md")),
    ).rejects.toThrow();
  });

  it("writes platform and artifact manifests by default when lifecycle apply is requested", async () => {
    const result = await applyRuntimeLifecycle({
      projectRoot: root,
      target: "codex",
      kind: "skills",
      apply: true,
      now: new Date("2026-05-03T00:00:00.000Z"),
      platform: {
        apply: async (target, platformDirectory) => {
          await mkdir(platformDirectory, { recursive: true });
          await writeFile(path.join(platformDirectory, "hooks-applied.txt"), target, "utf8");

          return { target, hooksAdded: 5 };
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "apply",
      apply: true,
      dryRun: false,
      writeManifests: true,
      target: "codex",
      kind: "skills",
      platformApplied: {
        target: "codex",
        hooksAdded: 5,
      },
    });
    expect(result.platformInstall.dryRun).toBe(false);
    expect(result.platformInstall.manifestWritten).toBe(true);
    expect(result.artifactsWritten).toHaveLength(getOperationalCatalog().skills.length);
    await expect(stat(path.join(root, ".planning", "install-manifest.json"))).resolves.toBeTruthy();
    await expect(
      stat(path.join(root, ".planning", "artifact-install-manifest.json")),
    ).resolves.toBeTruthy();
    await expect(stat(path.join(root, ".codex", "hooks-applied.txt"))).resolves.toBeTruthy();
    await expect(
      stat(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md")),
    ).resolves.toBeTruthy();
  });

  it("repairs hooks and artifacts from the platform install manifest", async () => {
    await applyRuntimeLifecycle({
      projectRoot: root,
      target: "claude",
      kind: "hooks",
      apply: true,
      platform: {
        apply: async (_target, platformDirectory) => {
          await mkdir(platformDirectory, { recursive: true });
        },
      },
    });

    const result = await repairRuntimeLifecycle({
      projectRoot: root,
      kind: "hooks",
      apply: true,
      platform: {
        apply: async (target, platformDirectory) => ({ target, platformDirectory, hooksAdded: 0 }),
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "repair",
      apply: true,
      dryRun: false,
      writeManifests: true,
      target: "claude",
      kind: "hooks",
      platformApplied: {
        target: "claude",
        hooksAdded: 0,
      },
    });
    expect(result.artifactsUnchanged).toHaveLength(getOperationalCatalog().hooks.length);
  });

  it("removes platform hooks during lifecycle uninstall when artifact manifest is missing", async () => {
    await applyRuntimeLifecycle({
      projectRoot: root,
      target: "codex",
      apply: true,
      kind: "skills",
      platform: {
        apply: async (_target, platformDirectory) => {
          await mkdir(platformDirectory, { recursive: true });
        },
      },
    });
    await rm(path.join(root, ".planning", "artifact-install-manifest.json"));

    const result = await uninstallRuntimeLifecycle({
      projectRoot: root,
      apply: true,
      platform: {
        remove: async (target, platformDirectory) => ({
          target,
          platformDirectory,
          hooksRemoved: 5,
        }),
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "uninstall",
      apply: true,
      dryRun: false,
      target: "codex",
      platformHooksRemoved: 5,
      artifactRollback: {
        skipped: true,
      },
      platformRemoved: {
        target: "codex",
        hooksRemoved: 5,
      },
    });
  });

  it("reports restored artifacts during lifecycle uninstall when rollback restores snapshots", async () => {
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, previousContent, "utf8");
    await installPlatform({
      projectRoot: root,
      target: "codex",
      dryRun: false,
      writeManifest: true,
    });
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });

    const result = await uninstallRuntimeLifecycle({
      projectRoot: root,
      apply: true,
      platform: {
        remove: async (target, platformDirectory) => ({
          target,
          platformDirectory,
          hooksRemoved: 5,
        }),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.artifactsRestored).toContain(artifactPath);
    expect(result.artifactsDeleted).not.toContain(artifactPath);
    expect(result.artifactsDeleted).toHaveLength(getOperationalCatalog().hooks.length - 1);
    expect(result.platformHooksRemoved).toBe(5);
    expect(await readFile(artifactPath, "utf8")).toBe(previousContent);
  });

  it("rejects lifecycle uninstall artifact manifests outside the project before existence probing", async () => {
    await applyRuntimeLifecycle({
      projectRoot: root,
      target: "codex",
      apply: true,
      kind: "skills",
      platform: {
        apply: async (_target, platformDirectory) => {
          await mkdir(platformDirectory, { recursive: true });
        },
      },
    });
    let removeCalled = false;

    await expect(
      uninstallRuntimeLifecycle({
        projectRoot: root,
        apply: true,
        artifactManifestFile: path.resolve(root, "..", "missing-artifact-install-manifest.json"),
        platform: {
          remove: () => {
            removeCalled = true;
            return { hooksRemoved: 5 };
          },
        },
      }),
    ).rejects.toThrow("Artifact install manifest file must stay inside the project root");
    expect(removeCalled).toBe(false);
  });

  it("surfaces artifact rollback blockers and keeps platform hooks when uninstall is blocked", async () => {
    await applyRuntimeLifecycle({
      projectRoot: root,
      target: "codex",
      apply: true,
      kind: "hooks",
      platform: {
        apply: async (_target, platformDirectory) => {
          await mkdir(platformDirectory, { recursive: true });
        },
      },
    });
    await writeFile(path.join(root, ".codex", "hooks", "gate-policy.md"), "tampered\n", "utf8");

    let removeCalled = false;
    const result = await uninstallRuntimeLifecycle({
      projectRoot: root,
      apply: true,
      platform: {
        remove: () => {
          removeCalled = true;
          return { hooksRemoved: 5 };
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.platformRemoved).toBeUndefined();
    expect(result.platformHooksRemoved).toBe(0);
    expect(removeCalled).toBe(false);
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
