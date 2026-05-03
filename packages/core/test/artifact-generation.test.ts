import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getOperationalCatalog,
  planCatalogArtifacts,
  writeCatalogArtifacts,
} from "../src/index.js";

describe("catalog artifact generation", () => {
  it("keeps artifact install dry-run read-only", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifact-install-dry-"));

    try {
      const result = await writeCatalogArtifacts({
        outputRoot: root,
        kind: "books",
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.writtenPaths).toEqual([]);
      expect(result.unchangedPaths).toEqual([]);
      expect(result.artifacts.every((artifact) => artifact.kind === "book")).toBe(true);
      await expect(
        access(path.join(root, "artifacts", "books", "gate-policy.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies only the selected artifact install kind", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifact-install-kind-"));

    try {
      const result = await writeCatalogArtifacts({
        outputRoot: root,
        kind: "books",
      });

      expect(result.dryRun).toBe(false);
      expect(result.writtenPaths).toHaveLength(getOperationalCatalog().books.length);
      await expect(
        access(path.join(root, "artifacts", "books", "gate-policy.md")),
      ).resolves.toBeUndefined();
      await expect(
        access(path.join(root, "artifacts", "skills", "classify-risk", "SKILL.md")),
      ).rejects.toThrow();
      await expect(access(path.join(root, "artifacts", "subagents"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("treats managed artifact install writes as idempotent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifact-install-idem-"));

    try {
      await writeCatalogArtifacts({
        outputRoot: root,
        kind: "skills",
      });
      const result = await writeCatalogArtifacts({
        outputRoot: root,
        kind: "skills",
      });

      expect(result.writtenPaths).toEqual([]);
      expect(result.unchangedPaths).toHaveLength(getOperationalCatalog().skills.length);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("plans deterministic artifacts from the operational catalog", () => {
    const catalog = getOperationalCatalog();
    const plan = planCatalogArtifacts();

    expect(plan.dryRun).toBe(true);
    expect(plan.artifacts).toHaveLength(
      catalog.skills.length + catalog.books.length + catalog.subagents.length,
    );
    expect(plan).toEqual(planCatalogArtifacts());

    const skill = plan.artifacts.find((artifact) => artifact.id === "classify-risk");
    expect(skill).toMatchObject({
      kind: "skill",
      relativePath: "artifacts/skills/classify-risk/SKILL.md",
    });
    expect(skill?.content).toMatch(
      /^---\nname: "classify-risk"\ndescription: "Assign a canonical T\/L\/M\/H\/C risk class and operating mode to each intent\."\n---\n\n<!-- HIMA:CATALOG-ARTIFACT kind=skill id=classify-risk source=operational-catalog -->/,
    );

    for (const artifact of plan.artifacts) {
      expect([...artifact.content].every((char) => char.charCodeAt(0) <= 127)).toBe(true);
    }
  });

  it("filters artifact kinds and keeps dry-run read-only", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifacts-dry-"));

    try {
      const result = await writeCatalogArtifacts({
        outputRoot: root,
        kind: "skills",
        dryRun: true,
      });

      expect(result.artifacts.every((artifact) => artifact.kind === "skill")).toBe(true);
      expect(result.writtenPaths).toEqual([]);
      await expect(
        access(path.join(root, "artifacts", "skills", "classify-risk", "SKILL.md")),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes selected managed artifacts and is idempotent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifacts-write-"));

    try {
      const first = await writeCatalogArtifacts({
        outputRoot: root,
        kind: "subagents",
      });
      const second = await writeCatalogArtifacts({
        outputRoot: root,
        kind: "subagents",
      });
      const filePath = path.join(root, "artifacts", "subagents", "reviewer.md");

      expect(first.writtenPaths).toHaveLength(getOperationalCatalog().subagents.length);
      expect(first.unchangedPaths).toEqual([]);
      expect(second.writtenPaths).toEqual([]);
      expect(second.unchangedPaths).toHaveLength(getOperationalCatalog().subagents.length);
      expect(await readFile(filePath, "utf8")).toContain(
        "<!-- HIMA:CATALOG-ARTIFACT kind=subagent id=reviewer source=operational-catalog -->",
      );
      await expect(access(path.join(root, "artifacts", "books"))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite unmanaged existing files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifacts-refuse-"));
    const filePath = path.join(root, "artifacts", "books", "gate-policy.md");

    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "manual book content", "utf8");

      await expect(
        writeCatalogArtifacts({
          outputRoot: root,
          kind: "books",
        }),
      ).rejects.toThrow("Refusing to overwrite unmanaged catalog artifact");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses to write through symlinked artifact directories", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-core-artifacts-symlink-"));
    const outside = await mkdtemp(path.join(tmpdir(), "harness-core-artifacts-outside-"));

    try {
      await mkdir(path.join(root, "artifacts"), { recursive: true });
      try {
        await symlink(outside, path.join(root, "artifacts", "books"), "dir");
      } catch (error) {
        if (isNodeErrorWithCode(error, "EPERM")) {
          return;
        }

        throw error;
      }

      await expect(
        writeCatalogArtifacts({
          outputRoot: root,
          kind: "books",
        }),
      ).rejects.toThrow("Refusing to write catalog artifact through symlink");
    } finally {
      await rm(root, { recursive: true, force: true });
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
