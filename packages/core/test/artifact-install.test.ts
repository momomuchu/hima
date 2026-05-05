import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getOperationalCatalog,
  installCatalogArtifacts,
  planArtifactInstall,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-artifact-install-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("artifact install", () => {
  it("keeps dry-run artifact installation read-only", async () => {
    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "skills",
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.writtenPaths).toEqual([]);
    expect(result.unchangedPaths).toEqual([]);
    expect(result.actions.every((action) => action.status === "planned")).toBe(true);
    expect(result.manifest.dryRun).toBe(true);
    expect(result.manifest.entries.every((entry) => entry.status === "planned")).toBe(true);
    await expect(
      access(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md")),
    ).rejects.toThrow();
    await expect(
      access(path.join(root, ".planning", "artifact-install-manifest.json")),
    ).rejects.toThrow();
  });

  it("refuses manifest persistence during dry-run", async () => {
    await expect(
      installCatalogArtifacts({
        projectRoot: root,
        target: "codex",
        kind: "skills",
        dryRun: true,
        writeManifest: true,
      }),
    ).rejects.toThrow("Cannot write artifact install manifest during dry-run");

    await expect(
      access(path.join(root, ".planning", "artifact-install-manifest.json")),
    ).rejects.toThrow();
  });

  it("plans target-specific platform directories and artifact paths", () => {
    const matrix = [
      ["codex", ".codex"],
      ["claude", ".claude"],
      ["hermes", ".hermes"],
    ] as const;

    for (const [target, platformDirectory] of matrix) {
      const plan = planArtifactInstall({
        projectRoot: root,
        target,
        kind: "all",
      });

      expect(plan.target).toBe(target);
      expect(plan.platformDirectory).toBe(path.join(root, platformDirectory));
      expect(plan.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifactKind: "skill",
            id: "classify-risk",
            path: path.join(root, platformDirectory, "skills", "classify-risk", "SKILL.md"),
            relativePath: "skills/classify-risk/SKILL.md",
          }),
          expect.objectContaining({
            artifactKind: "hook",
            id: "gate-policy",
            path: path.join(root, platformDirectory, "hooks", "gate-policy.md"),
            relativePath: "hooks/gate-policy.md",
          }),
          expect.objectContaining({
            artifactKind: "subagent",
            id: "reviewer",
            path: path.join(root, platformDirectory, "agents", "reviewer.md"),
            relativePath: "agents/reviewer.md",
          }),
        ]),
      );
    }
  });

  it("writes only the selected artifact kind when applied", async () => {
    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "claude",
      kind: "hooks",
      dryRun: false,
    });

    expect(result.writtenPaths).toHaveLength(getOperationalCatalog().hooks.length);
    expect(result.unchangedPaths).toEqual([]);
    expect(result.actions.every((action) => action.artifactKind === "hook")).toBe(true);
    expect(result.actions.every((action) => action.status === "written")).toBe(true);
    expect(result.manifest.writtenCount).toBe(getOperationalCatalog().hooks.length);
    expect(result.manifest.unchangedCount).toBe(0);
    await expect(
      access(path.join(root, ".claude", "hooks", "gate-policy.md")),
    ).resolves.toBeUndefined();
    await expect(access(path.join(root, ".claude", "skills"))).rejects.toThrow();
    await expect(access(path.join(root, ".claude", "agents"))).rejects.toThrow();
  });

  it("writes an explicit install manifest with hashes and rollback metadata", async () => {
    const now = new Date("2026-05-03T12:34:56.000Z");
    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      now,
    });
    const manifestFile = path.join(root, ".planning", "artifact-install-manifest.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as typeof result.manifest;
    const entry = manifest.entries.find((item) => item.id === "gate-policy");
    const artifactContent = await readFile(
      path.join(root, ".codex", "hooks", "gate-policy.md"),
      "utf8",
    );

    expect(result.manifestFile).toBe(manifestFile);
    expect(manifest).toEqual(result.manifest);
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      target: "codex",
      projectRoot: root,
      platformDirectory: path.join(root, ".codex"),
      dryRun: false,
      createdAt: now.toISOString(),
      selection: "hooks",
      kind: "hooks",
      writtenCount: getOperationalCatalog().hooks.length,
      unchangedCount: 0,
    });
    expect(entry).toMatchObject({
      path: path.join(root, ".codex", "hooks", "gate-policy.md"),
      relativePath: "hooks/gate-policy.md",
      kind: "hook",
      id: "gate-policy",
      status: "written",
      previousHash: null,
      nextHash: hashContent(artifactContent),
      rollback: {
        action: "delete",
        previousHash: null,
      },
    });
    expect(entry?.nextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records restore rollback metadata when replacing a managed artifact", async () => {
    const filePath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, previousContent, "utf8");

    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
    });
    const entry = result.manifest.entries.find((item) => item.id === "gate-policy");

    expect(entry).toMatchObject({
      status: "written",
      previousHash: hashContent(previousContent),
      rollback: {
        action: "restore",
        previousHash: hashContent(previousContent),
      },
    });
    expect(entry?.rollback).not.toHaveProperty("restoreSnapshot");
  });

  it("stores restore snapshots only when replacing a managed artifact with explicit capture", async () => {
    const filePath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
    ].join("\n");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, previousContent, "utf8");

    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });
    const entry = result.manifest.entries.find((item) => item.id === "gate-policy");

    expect(entry?.rollback).toMatchObject({
      action: "restore",
      previousHash: hashContent(previousContent),
      restoreSnapshot: {
        encoding: "utf8",
        content: previousContent,
        hash: hashContent(previousContent),
      },
    });
  });

  it("does not snapshot unmanaged overwritten content", async () => {
    const filePath = path.join(root, ".codex", "hooks", "gate-policy.md");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "manual local content", "utf8");

    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      force: true,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });
    const entry = result.manifest.entries.find((item) => item.id === "gate-policy");

    expect(entry).toMatchObject({
      rollback: {
        action: "restore",
        previousHash: hashContent("manual local content"),
      },
    });
    expect(entry?.rollback).not.toHaveProperty("restoreSnapshot");
  });

  it("does not snapshot managed overwritten content that appears to contain a secret", async () => {
    const filePath = path.join(root, ".codex", "hooks", "gate-policy.md");
    const previousContent = [
      "<!-- HIMA:CATALOG-ARTIFACT kind=hook id=gate-policy source=operational-catalog -->",
      "",
      "# Previous managed content",
      "",
      'api_key = "1234567890abcdef"',
      "",
    ].join("\n");

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, previousContent, "utf8");

    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "codex",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });
    const entry = result.manifest.entries.find((item) => item.id === "gate-policy");

    expect(entry).toMatchObject({
      rollback: {
        action: "restore",
        previousHash: hashContent(previousContent),
      },
    });
    expect(entry?.rollback).not.toHaveProperty("restoreSnapshot");
  });

  it("reports unchanged artifacts on an idempotent second apply", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "hermes",
      kind: "subagents",
      dryRun: false,
    });

    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "hermes",
      kind: "subagents",
      dryRun: false,
      writeManifest: true,
    });

    expect(result.writtenPaths).toEqual([]);
    expect(result.unchangedPaths).toHaveLength(getOperationalCatalog().subagents.length);
    expect(result.actions.every((action) => action.status === "unchanged")).toBe(true);
    expect(result.manifest.writtenCount).toBe(0);
    expect(result.manifest.unchangedCount).toBe(getOperationalCatalog().subagents.length);
    expect(result.manifest.entries.every((entry) => entry.status === "unchanged")).toBe(true);
    expect(result.manifest.entries.every((entry) => entry.rollback.action === "none")).toBe(true);
  });

  it("does not store restore snapshots for unchanged artifacts", async () => {
    await installCatalogArtifacts({
      projectRoot: root,
      target: "hermes",
      kind: "hooks",
      dryRun: false,
    });

    const result = await installCatalogArtifacts({
      projectRoot: root,
      target: "hermes",
      kind: "hooks",
      dryRun: false,
      writeManifest: true,
      captureRestoreSnapshots: true,
    });

    expect(result.writtenPaths).toEqual([]);
    expect(result.manifest.entries.every((entry) => entry.status === "unchanged")).toBe(true);
    expect(result.manifest.entries.every((entry) => entry.rollback.action === "none")).toBe(true);
    expect(result.manifest.entries.every((entry) => !("restoreSnapshot" in entry.rollback))).toBe(
      true,
    );
  });

  it("rejects an invalid artifact install target", async () => {
    await expect(
      installCatalogArtifacts({
        projectRoot: root,
        target: "unknown",
        kind: "skills",
        dryRun: false,
      }),
    ).rejects.toThrow('Invalid artifact install target "unknown"');
  });

  it("refuses to install artifacts through a symlinked platform root", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "harness-artifact-install-outside-"));

    try {
      try {
        await symlink(outside, path.join(root, ".codex"), "dir");
      } catch (error) {
        if (isNodeErrorWithCode(error, "EPERM")) {
          return;
        }

        throw error;
      }

      await expect(
        installCatalogArtifacts({
          projectRoot: root,
          target: "codex",
          kind: "hooks",
          dryRun: false,
        }),
      ).rejects.toThrow("Refusing to write through symlinked root");
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
