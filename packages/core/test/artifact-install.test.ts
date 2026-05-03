import { access, mkdtemp, rm, symlink } from "node:fs/promises";
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
    await expect(
      access(path.join(root, ".codex", "skills", "classify-risk", "SKILL.md")),
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
            artifactKind: "book",
            id: "gate-policy",
            path: path.join(root, platformDirectory, "books", "gate-policy.md"),
            relativePath: "books/gate-policy.md",
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
      kind: "books",
      dryRun: false,
    });

    expect(result.writtenPaths).toHaveLength(getOperationalCatalog().books.length);
    expect(result.unchangedPaths).toEqual([]);
    expect(result.actions.every((action) => action.artifactKind === "book")).toBe(true);
    expect(result.actions.every((action) => action.status === "written")).toBe(true);
    await expect(
      access(path.join(root, ".claude", "books", "gate-policy.md")),
    ).resolves.toBeUndefined();
    await expect(access(path.join(root, ".claude", "skills"))).rejects.toThrow();
    await expect(access(path.join(root, ".claude", "agents"))).rejects.toThrow();
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
    });

    expect(result.writtenPaths).toEqual([]);
    expect(result.unchangedPaths).toHaveLength(getOperationalCatalog().subagents.length);
    expect(result.actions.every((action) => action.status === "unchanged")).toBe(true);
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
          kind: "books",
          dryRun: false,
        }),
      ).rejects.toThrow("Refusing to write through symlinked root");
    } finally {
      await rm(outside, { recursive: true, force: true });
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
