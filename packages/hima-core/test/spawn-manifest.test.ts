/**
 * Tests for spawn-manifest.ts — R-035 live role-spawn manifest gate.
 *
 * Covered scenarios:
 *  1. spawnManifestPath returns the canonical per-ward-stage JSON path.
 *  2. spawnManifestPath produces distinct paths for distinct wardIds.
 *  3. spawnManifestPath produces distinct paths for distinct stages.
 *  4. hasSpawnManifest returns false before any write.
 *  5. writeSpawnManifest then hasSpawnManifest returns true.
 *  6. Written JSON payload carries wardId, stage, roles, and ts fields.
 *  7. Distinct ward+stage combinations do not cross-contaminate.
 *  8. A second writeSpawnManifest overwrites the previous manifest.
 *  9. writeSpawnManifest accepts an empty role list.
 * 10. buildSpawnAssignmentContext formats the advisory string with all roles.
 * 11. buildSpawnAssignmentContext includes the correct stage in the output.
 * 12. buildSpawnAssignmentContext handles a single role.
 * 13. buildSpawnAssignmentContext ends with the canonical advisory suffix.
 * 14. buildSpawnAssignmentContext handles an empty role list without throwing.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSpawnAssignmentContext,
  hasSpawnManifest,
  spawnManifestPath,
  writeSpawnManifest,
  type SpawnManifest,
} from "../src/spawn-manifest.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-spawn-manifest-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// spawnManifestPath
// ---------------------------------------------------------------------------

describe("spawnManifestPath", () => {
  it("returns the canonical per-ward-stage JSON path", () => {
    const result = spawnManifestPath("/project", "run-001", "design");
    expect(result).toBe(
      path.join("/project", ".hima", "state", "spawn-manifest-run-001-design.json"),
    );
  });

  it("distinct wardId values map to distinct files", () => {
    const a = spawnManifestPath("/project", "ward-a", "spec");
    const b = spawnManifestPath("/project", "ward-b", "spec");
    expect(a).not.toBe(b);
  });

  it("distinct stages map to distinct files", () => {
    const a = spawnManifestPath("/project", "ward-x", "spec");
    const b = spawnManifestPath("/project", "ward-x", "design");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// hasSpawnManifest — before write
// ---------------------------------------------------------------------------

describe("hasSpawnManifest (no manifest)", () => {
  it("returns false when manifest has never been written", async () => {
    const result = await hasSpawnManifest(root, "run-001", "spec");
    expect(result).toBe(false);
  });

  it("returns false for unknown wardId even if another ward exists", async () => {
    await writeSpawnManifest(root, "ward-A", "spec", ["Spec Author"]);
    const result = await hasSpawnManifest(root, "ward-B", "spec");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// writeSpawnManifest → hasSpawnManifest round-trip
// ---------------------------------------------------------------------------

describe("writeSpawnManifest + hasSpawnManifest round-trip", () => {
  it("hasSpawnManifest returns true after writeSpawnManifest", async () => {
    await writeSpawnManifest(root, "run-001", "spec", ["Spec Author", "Contract Guardian"]);
    const result = await hasSpawnManifest(root, "run-001", "spec");
    expect(result).toBe(true);
  });

  it("persists wardId, stage, roles, and ts in the JSON payload", async () => {
    const roleNames = ["Architect", "Antagonist"];
    const before = Date.now();
    await writeSpawnManifest(root, "ward-002", "design", roleNames);

    const filePath = spawnManifestPath(root, "ward-002", "design");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SpawnManifest;

    expect(parsed.wardId).toBe("ward-002");
    expect(parsed.stage).toBe("design");
    expect(parsed.roles).toEqual(roleNames);
    // ts is a valid ISO timestamp
    expect(typeof parsed.ts).toBe("string");
    const tsMs = new Date(parsed.ts).getTime();
    expect(tsMs).toBeGreaterThanOrEqual(before);
  });

  it("does not cross-contaminate ward+stage combinations", async () => {
    await writeSpawnManifest(root, "ward-A", "spec", ["Spec Author"]);

    expect(await hasSpawnManifest(root, "ward-A", "spec")).toBe(true);
    // Different stage for same ward — absent
    expect(await hasSpawnManifest(root, "ward-A", "design")).toBe(false);
    // Different ward for same stage — absent
    expect(await hasSpawnManifest(root, "ward-B", "spec")).toBe(false);
  });

  it("overwrites an existing manifest with a new role list", async () => {
    await writeSpawnManifest(root, "ward-upd", "impl", ["Executor"]);
    await writeSpawnManifest(root, "ward-upd", "impl", ["Executor", "Test Writer"]);

    const filePath = spawnManifestPath(root, "ward-upd", "impl");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SpawnManifest;

    expect(parsed.roles).toEqual(["Executor", "Test Writer"]);
  });

  it("accepts an empty role list and persists an empty array", async () => {
    await writeSpawnManifest(root, "ward-empty", "test", []);
    expect(await hasSpawnManifest(root, "ward-empty", "test")).toBe(true);

    const filePath = spawnManifestPath(root, "ward-empty", "test");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SpawnManifest;
    expect(parsed.roles).toEqual([]);
  });

  it("creates parent directories automatically", async () => {
    // root/.hima/state/ does not exist yet — safeAtomicWriteFile should mkdir it
    await writeSpawnManifest(root, "ward-mkdir", "discovery", ["Surveyor"]);
    expect(await hasSpawnManifest(root, "ward-mkdir", "discovery")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildSpawnAssignmentContext
// ---------------------------------------------------------------------------

describe("buildSpawnAssignmentContext", () => {
  it("formats the advisory context string with all listed roles", () => {
    const result = buildSpawnAssignmentContext("design", [
      { role: "Architect" },
      { role: "Antagonist" },
    ]);
    expect(result).toBe(
      "[HIMA spawn] stage design role-team: Architect, Antagonist — spawn these as Agent (Task) subagents (explicit model each).",
    );
  });

  it("includes the correct stage identifier in the output", () => {
    const result = buildSpawnAssignmentContext("discovery", [
      { role: "Surveyor" },
      { role: "Risk Analyst" },
      { role: "Researcher" },
    ]);
    expect(result).toContain("stage discovery");
    expect(result).toContain("Surveyor");
    expect(result).toContain("Risk Analyst");
    expect(result).toContain("Researcher");
  });

  it("handles a single role", () => {
    const result = buildSpawnAssignmentContext("test", [{ role: "Test Writer" }]);
    expect(result).toBe(
      "[HIMA spawn] stage test role-team: Test Writer — spawn these as Agent (Task) subagents (explicit model each).",
    );
  });

  it("ends with the canonical advisory suffix", () => {
    const result = buildSpawnAssignmentContext("spec", [{ role: "Spec Author" }]);
    const suffix = "— spawn these as Agent (Task) subagents (explicit model each).";
    expect(result.endsWith(suffix)).toBe(true);
  });

  it("starts with the [HIMA spawn] sigil", () => {
    const result = buildSpawnAssignmentContext("verify", [{ role: "Reviewer" }]);
    expect(result.startsWith("[HIMA spawn]")).toBe(true);
  });

  it("handles an empty role list without throwing", () => {
    expect(() => buildSpawnAssignmentContext("verify", [])).not.toThrow();
    const result = buildSpawnAssignmentContext("verify", []);
    expect(result).toContain("stage verify");
    expect(result).toContain("role-team:");
  });
});
