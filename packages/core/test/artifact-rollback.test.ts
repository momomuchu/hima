import { createHash } from "node:crypto";
import { access, link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOperationalCatalog,
  installCatalogArtifacts,
  planCatalogArtifactRollback,
  rollbackCatalogArtifacts,
} from "../src/index.js";
import type { ArtifactInstallManifest } from "../src/install/artifact-install.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-artifact-rollback-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("artifact rollback", () => {
  it("plans delete rollback from the install manifest without deleting during dry-run", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");

    const plan = await planCatalogArtifactRollback({
      projectRoot: root,
    });
    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
    });

    expect(plan).toMatchObject({
      dryRun: true,
      manifestFile: install.manifestFile,
      target: "codex",
      platformDirectory: path.join(root, ".codex"),
      blockers: [],
    });
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rollbackAction: "delete",
          status: "planned",
          path: artifactPath,
          relativePath: "hooks/gate-policy.md",
        }),
      ]),
    );
    expect(result.deletedPaths).toEqual([]);
    await expect(access(artifactPath)).resolves.toBeUndefined();
  });

  it("deletes only matching managed artifacts when apply is requested", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.blockers).toEqual([]);
    expect(result.deletedPaths).toContain(artifactPath);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: artifactPath,
          status: "deleted",
        }),
      ]),
    );
    await expect(access(artifactPath)).rejects.toThrow();
  });

  it("does not restore previous content automatically and blocks apply", async () => {
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, previousContent, "utf8");
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const restoreEntry = install.manifest.entries.find((entry) => entry.id === "gate-policy");

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).toEqual([]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "manual_restore_required",
          path: artifactPath,
          previousHash: restoreEntry?.previousHash,
        }),
      ]),
    );
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: artifactPath,
          rollbackAction: "restore",
          status: "manual_restore_required",
        }),
      ]),
    );
    expect(await readFile(artifactPath, "utf8")).not.toBe(previousContent);
  });

  it("accepts idempotent capture manifests without unchanged restore snapshots", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
    });
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
    });

    expect(install.manifest.entries.every((entry) => !("restoreSnapshot" in entry.rollback))).toBe(
      true,
    );
    expect(result.blockers).toEqual([]);
    expect(result.actions.every((action) => action.rollbackAction === "none")).toBe(true);
  });

  it("restores previous managed content when the manifest carries an explicit snapshot", async () => {
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, previousContent, "utf8");
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });

    const plan = await planCatalogArtifactRollback({
      projectRoot: root,
    });
    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(plan.blockers).toEqual([]);
    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: artifactPath,
          rollbackAction: "restore",
          status: "planned",
        }),
      ]),
    );
    expect(result.blockers).toEqual([]);
    expect(result.deletedPaths).not.toContain(artifactPath);
    expect(result.deletedPaths).toHaveLength(operationalHookCount() - 1);
    expect(result.restoredPaths).toContain(artifactPath);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: artifactPath,
          rollbackAction: "restore",
          status: "restored",
        }),
      ]),
    );
    expect(await readFile(artifactPath, "utf8")).toBe(previousContent);
  });

  it("rejects tampered restore snapshots before planning rollback", async () => {
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");
    const tamperedPreviousContent = previousContent.replace("Previous", "Tampered");

    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, previousContent, "utf8");
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });
    const manifest: ArtifactInstallManifest = {
      ...install.manifest,
      entries: install.manifest.entries.map((entry) =>
        entry.id === "gate-policy"
          ? {
              ...entry,
              rollback: {
                ...entry.rollback,
                restoreSnapshot: {
                  encoding: "utf8",
                  content: tamperedPreviousContent,
                  hash: hashContent(previousContent),
                },
              },
            }
          : entry,
      ),
    };
    await writeFile(
      requireDefined(install.manifestFile),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    await expect(
      planCatalogArtifactRollback({
        projectRoot: root,
      }),
    ).rejects.toThrow(/rollback\.restoreSnapshot\.content must match hash/);
  });

  it("blocks restore when the replaced artifact changed after install", async () => {
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, previousContent, "utf8");
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });
    const changedContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Changed after install",
      "",
    ].join("\n");
    await writeFile(artifactPath, changedContent, "utf8");

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).toEqual([]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "hash_mismatch",
          path: artifactPath,
        }),
      ]),
    );
    expect(await readFile(artifactPath, "utf8")).toBe(changedContent);
  });

  it("blocks all apply deletes when any manifest entry requires manual restore", async () => {
    const previousPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(previousPath), { recursive: true });
    await writeFile(previousPath, previousContent, "utf8");
    const restoreInstall = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      manifestFile: ".planning/restore-manifest.json",
    });
    const deleteInstall = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "skills",
      dryRun: false,
      writeManifest: true,
      manifestFile: ".planning/delete-manifest.json",
    });
    const restoreEntry = restoreInstall.manifest.entries.find(
      (entry) => entry.rollback.action === "restore",
    );
    const deleteEntry = deleteInstall.manifest.entries.find(
      (entry) => entry.rollback.action === "delete",
    );
    expect(restoreEntry).toBeDefined();
    expect(deleteEntry).toBeDefined();
    const mixedManifest: ArtifactInstallManifest = {
      ...deleteInstall.manifest,
      entries: [restoreEntry, deleteEntry].filter(isDefined),
    };
    const mixedManifestFile = path.join(root, ".planning", "mixed-manifest.json");
    await writeFile(mixedManifestFile, `${JSON.stringify(mixedManifest, null, 2)}\n`, "utf8");

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      manifestFile: mixedManifestFile,
      dryRun: false,
    });

    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "manual_restore_required" })]),
    );
    expect(result.deletedPaths).toEqual([]);
    await expect(
      access(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md")),
    ).resolves.toBeUndefined();
  });

  it("blocks delete when the managed artifact hash changed after install", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    await writeFile(
      artifactPath,
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->\n\n# Changed\n",
      "utf8",
    );

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).toEqual([]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "hash_mismatch",
          path: artifactPath,
        }),
      ]),
    );
    await expect(access(artifactPath)).resolves.toBeUndefined();
  });

  it("blocks delete when the target is no longer the expected managed artifact", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    await writeFile(artifactPath, "manual replacement", "utf8");

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).toEqual([]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "target_unmanaged",
          path: artifactPath,
        }),
      ]),
    );
    await expect(access(artifactPath)).resolves.toBeUndefined();
  });

  it("blocks delete when the target is symlinked", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const outside = path.join(root, "outside.md");
    await writeFile(outside, "outside", "utf8");
    await rm(artifactPath);
    try {
      await symlink(outside, artifactPath, "file");
    } catch (error) {
      if (isNodeErrorWithCode(error, "EPERM")) {
        return;
      }

      throw error;
    }

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).toEqual([]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "target_not_safe",
          path: artifactPath,
        }),
      ]),
    );
    await expect(access(outside)).resolves.toBeUndefined();
  });

  it("blocks delete when the target is hardlinked", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const artifactPath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const linkedPath = path.join(root, "linked-gate-policy.md");
    try {
      await link(artifactPath, linkedPath);
    } catch (error) {
      if (isNodeErrorWithCode(error, "EPERM")) {
        return;
      }

      throw error;
    }

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).toEqual([]);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "target_not_safe",
          path: artifactPath,
        }),
      ]),
    );
    await expect(access(artifactPath)).resolves.toBeUndefined();
    await expect(access(linkedPath)).resolves.toBeUndefined();
  });

  it("ignores absolute target paths stored in the manifest", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const outside = path.join(root, "..", "outside-rollback-target.md");
    const manifest: ArtifactInstallManifest = {
      ...install.manifest,
      entries: install.manifest.entries.map((entry) => ({
        ...entry,
        path: outside,
      })),
    };
    await writeFile(
      requireDefined(install.manifestFile),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).not.toContain(path.resolve(outside));
    expect(result.deletedPaths).toContain(path.join(root, ".codex", "hooks", "gate-policy.md"));
  });

  it("ignores malicious relativePath values stored in the manifest", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const outside = path.resolve(root, "..", "outside-rollback-relative-path.md");
    const manifest: ArtifactInstallManifest = {
      ...install.manifest,
      entries: install.manifest.entries.map((entry) => ({
        ...entry,
        relativePath: "../outside-rollback-relative-path.md",
      })),
    };
    await writeFile(outside, "outside", "utf8");
    await writeFile(
      requireDefined(install.manifestFile),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    const result = await rollbackCatalogArtifacts({
      projectRoot: root,
      dryRun: false,
    });

    expect(result.deletedPaths).not.toContain(outside);
    expect(result.deletedPaths).toContain(path.join(root, ".codex", "hooks", "gate-policy.md"));
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gate-policy",
          relativePath: "hooks/gate-policy.md",
        }),
      ]),
    );
    await expect(access(outside)).resolves.toBeUndefined();
  });

  it("rejects invalid manifest entries before planning rollback", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const manifest = {
      ...install.manifest,
      entries: install.manifest.entries.map((entry) => ({
        ...entry,
        id: "../gate-policy",
      })),
    };
    await writeFile(
      requireDefined(install.manifestFile),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    await expect(
      planCatalogArtifactRollback({
        projectRoot: root,
      }),
    ).rejects.toThrow(/entries\[0\]\.id must match/);
  });

  it("rejects book as a runtime artifact manifest kind", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const manifest = {
      ...install.manifest,
      entries: install.manifest.entries.map((entry) => ({
        ...entry,
        kind: ["bo", "ok"].join(""),
      })),
    };
    await writeFile(
      requireDefined(install.manifestFile),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );

    await expect(
      planCatalogArtifactRollback({
        projectRoot: root,
      }),
    ).rejects.toThrow(/entries\[0\]\.kind must be one of skill, hook, subagent/);
  });

  it("rejects manifest files outside the project root", async () => {
    const outsideRoot = await mkdtemp(path.join(tmpdir(), "harness-artifact-rollback-outside-"));
    const outsideManifest = path.join(outsideRoot, "artifact-install-manifest.json");

    try {
      await writeFile(
        outsideManifest,
        JSON.stringify({
          schemaVersion: 1,
          target: "codex",
          entries: [],
        }),
        "utf8",
      );

      await expect(
        planCatalogArtifactRollback({
          projectRoot: root,
          manifestFile: outsideManifest,
        }),
      ).rejects.toThrow("Artifact rollback manifest file must stay inside the project root");
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("revalidates delete candidates immediately before unlink", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    let mutatedPath = "";
    let changedContent = "";

    vi.resetModules();
    vi.doMock("../src/storage/safe-write.js", async () => {
      const actual = await vi.importActual<typeof import("../src/storage/safe-write.js")>(
        "../src/storage/safe-write.js",
      );
      let deleteCheckCount = 0;

      return {
        ...actual,
        assertSafeDeleteTarget: async (writeRoot: string, targetPath: string): Promise<void> => {
          deleteCheckCount += 1;
          if (deleteCheckCount === 2) {
            mutatedPath = targetPath;
            changedContent = `${await readFile(targetPath, "utf8")}\n# Changed before unlink\n`;
            await writeFile(targetPath, changedContent, "utf8");
          }

          await actual.assertSafeDeleteTarget(writeRoot, targetPath);
        },
      };
    });

    try {
      const { rollbackCatalogArtifacts: mockedRollbackCatalogArtifacts } = await import(
        "../src/install/artifact-rollback.js"
      );

      const result = await mockedRollbackCatalogArtifacts({
        projectRoot: root,
        manifestFile: requireDefined(install.manifestFile),
        dryRun: false,
      });

      expect(result.deletedPaths).toEqual([]);
      expect(result.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "hash_mismatch",
            path: mutatedPath,
          }),
        ]),
      );
      await expect(access(mutatedPath)).resolves.toBeUndefined();
      expect(await readFile(mutatedPath, "utf8")).toBe(changedContent);
    } finally {
      vi.doUnmock("../src/storage/safe-write.js");
      vi.resetModules();
    }
  });

  it("blocks unlink when the target identity changes after handle validation", async () => {
    const install = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    let replacedPath = "";

    vi.resetModules();
    vi.doMock("../src/storage/safe-write.js", async () => {
      const actual = await vi.importActual<typeof import("../src/storage/safe-write.js")>(
        "../src/storage/safe-write.js",
      );
      let deleteCheckCount = 0;
      const replaceOnCheck = install.manifest.entries.length * 2 + 3;

      return {
        ...actual,
        assertSafeDeleteTarget: async (writeRoot: string, targetPath: string): Promise<void> => {
          deleteCheckCount += 1;
          await actual.assertSafeDeleteTarget(writeRoot, targetPath);

          if (deleteCheckCount === replaceOnCheck) {
            replacedPath = targetPath;
            const content = await readFile(targetPath, "utf8");
            await rm(targetPath);
            await writeFile(targetPath, content, "utf8");
          }
        },
      };
    });

    try {
      const { rollbackCatalogArtifacts: mockedRollbackCatalogArtifacts } = await import(
        "../src/install/artifact-rollback.js"
      );

      const result = await mockedRollbackCatalogArtifacts({
        projectRoot: root,
        manifestFile: requireDefined(install.manifestFile),
        dryRun: false,
      });

      expect(result.deletedPaths).toEqual([]);
      expect(result.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "target_not_safe",
            path: replacedPath,
          }),
        ]),
      );
    } finally {
      vi.doUnmock("../src/storage/safe-write.js");
      vi.resetModules();
    }
  });
});

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function requireDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  return value as T;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function operationalHookCount(): number {
  return getOperationalCatalog().hooks.length;
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
