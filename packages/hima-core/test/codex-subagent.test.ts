/**
 * Tests for codex-subagent.ts — registerSubagent / readSubagentRegistry.
 *
 * Mandated scenarios (R-049):
 *   A. readSubagentRegistry returns [] when the poll file does not exist.
 *   B. registerSubagent creates the poll file and registers the child sessionId.
 *   C. Round-trip: registerSubagent then readSubagentRegistry returns the child.
 *   D. Re-registering the same childSessionId is idempotent (no duplicates).
 *   E. Multiple distinct children accumulate in insertion order.
 *   F. pollFilePath returns the canonical path incorporating parentSessionId.
 *
 * Additional edge-case coverage:
 *   G. readSubagentRegistry returns [] on corrupt JSON (fail-safe).
 *   H. readSubagentRegistry returns [] on non-array JSON (fail-safe).
 *   I. readSubagentRegistry drops non-string entries silently.
 *   J. Distinct parentSessionIds map to distinct poll files.
 *   K. registerSubagent creates intermediate .hima/state/ directories.
 */

import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  registerSubagent,
  readSubagentRegistry,
  pollFilePath,
} from "../src/codex-subagent.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-codex-subagent-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// pollFilePath
// ---------------------------------------------------------------------------

describe("pollFilePath", () => {
  it("F. returns the canonical per-parent-session JSON path", () => {
    const result = pollFilePath("/project", "parent-001");
    expect(result).toBe(
      path.join("/project", ".hima", "state", "subagent-poll-parent-001.json"),
    );
  });

  it("J. distinct parentSessionIds map to distinct poll files", () => {
    const a = pollFilePath("/project", "parent-a");
    const b = pollFilePath("/project", "parent-b");
    expect(a).not.toBe(b);
    expect(a).toContain("parent-a");
    expect(b).toContain("parent-b");
  });
});

// ---------------------------------------------------------------------------
// readSubagentRegistry — before any registration
// ---------------------------------------------------------------------------

describe("readSubagentRegistry — empty / missing file", () => {
  it("A. returns [] when the poll file does not exist", async () => {
    const result = await readSubagentRegistry(root, "sess-missing");
    expect(result).toEqual([]);
  });

  it("G. returns [] when the poll file contains corrupt JSON", async () => {
    const stateDir = path.join(root, ".hima", "state");
    await mkdir(stateDir, { recursive: true });
    const filePath = pollFilePath(root, "sess-corrupt");
    await writeFile(filePath, "THIS IS NOT JSON", "utf8");

    const result = await readSubagentRegistry(root, "sess-corrupt");
    expect(result).toEqual([]);
  });

  it("H. returns [] when the poll file contains valid JSON but not an array", async () => {
    const stateDir = path.join(root, ".hima", "state");
    await mkdir(stateDir, { recursive: true });
    const filePath = pollFilePath(root, "sess-nonarray");
    await writeFile(filePath, JSON.stringify({ child: "sess-child-1" }), "utf8");

    const result = await readSubagentRegistry(root, "sess-nonarray");
    expect(result).toEqual([]);
  });

  it("I. drops non-string entries from a mixed array", async () => {
    const stateDir = path.join(root, ".hima", "state");
    await mkdir(stateDir, { recursive: true });
    const filePath = pollFilePath(root, "sess-mixed");
    await writeFile(filePath, JSON.stringify(["child-a", 42, null, "child-b", true]), "utf8");

    const result = await readSubagentRegistry(root, "sess-mixed");
    expect(result).toEqual(["child-a", "child-b"]);
  });
});

// ---------------------------------------------------------------------------
// registerSubagent — write side
// ---------------------------------------------------------------------------

describe("registerSubagent", () => {
  it("B. creates the poll file with the child sessionId when called on a fresh root", async () => {
    await registerSubagent(root, "parent-fresh", "child-001");
    const result = await readSubagentRegistry(root, "parent-fresh");
    expect(result).toContain("child-001");
    expect(result).toHaveLength(1);
  });

  it("K. creates intermediate .hima/state/ directories automatically", async () => {
    // root has no subdirectories yet — registerSubagent must create them.
    await registerSubagent(root, "parent-mkdirs", "child-001");
    const result = await readSubagentRegistry(root, "parent-mkdirs");
    expect(result).toEqual(["child-001"]);
  });
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe("registerSubagent + readSubagentRegistry round-trip", () => {
  it("C. read after register returns the child sessionId", async () => {
    await registerSubagent(root, "parent-rt", "child-rt-1");
    const result = await readSubagentRegistry(root, "parent-rt");
    expect(result).toEqual(["child-rt-1"]);
  });

  it("D. re-registering the same child is idempotent — no duplicates", async () => {
    await registerSubagent(root, "parent-idem", "child-x");
    await registerSubagent(root, "parent-idem", "child-x");
    await registerSubagent(root, "parent-idem", "child-x");

    const result = await readSubagentRegistry(root, "parent-idem");
    expect(result).toEqual(["child-x"]);
    expect(result).toHaveLength(1);
  });

  it("E. multiple distinct children accumulate in insertion order", async () => {
    await registerSubagent(root, "parent-multi", "child-1");
    await registerSubagent(root, "parent-multi", "child-2");
    await registerSubagent(root, "parent-multi", "child-3");

    const result = await readSubagentRegistry(root, "parent-multi");
    expect(result).toEqual(["child-1", "child-2", "child-3"]);
  });

  it("distinct parents maintain independent registries", async () => {
    await registerSubagent(root, "parent-alpha", "child-a");
    await registerSubagent(root, "parent-beta", "child-b");

    const alphaRegistry = await readSubagentRegistry(root, "parent-alpha");
    const betaRegistry = await readSubagentRegistry(root, "parent-beta");

    expect(alphaRegistry).toEqual(["child-a"]);
    expect(betaRegistry).toEqual(["child-b"]);
  });

  it("mixed re-register and new child preserves order and no duplicates", async () => {
    await registerSubagent(root, "parent-mixed", "child-1");
    await registerSubagent(root, "parent-mixed", "child-2");
    await registerSubagent(root, "parent-mixed", "child-1"); // duplicate
    await registerSubagent(root, "parent-mixed", "child-3");

    const result = await readSubagentRegistry(root, "parent-mixed");
    expect(result).toEqual(["child-1", "child-2", "child-3"]);
  });
});
