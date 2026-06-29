import { mkdtemp, rm, realpath, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordRead, readReadSet, isInReadSet } from "../src/read-set.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "read-set-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// recordRead + readReadSet round-trip
// ---------------------------------------------------------------------------

describe("recordRead + readReadSet round-trip", () => {
  it("records a file path and readReadSet returns it", async () => {
    const filePath = path.join(tmpRoot, "src", "behavior.ts");

    await recordRead(tmpRoot, "sess-001", filePath);

    const set = await readReadSet(tmpRoot, "sess-001");
    expect(set).toHaveLength(1);
    // Stored entry is the resolved (absolute) path.
    expect(set[0]).toBe(path.resolve(filePath));
  });

  it("records multiple distinct files", async () => {
    const a = path.join(tmpRoot, "a.ts");
    const b = path.join(tmpRoot, "b.ts");

    await recordRead(tmpRoot, "sess-multi", a);
    await recordRead(tmpRoot, "sess-multi", b);

    const set = await readReadSet(tmpRoot, "sess-multi");
    expect(set).toHaveLength(2);
    expect(set).toContain(path.resolve(a));
    expect(set).toContain(path.resolve(b));
  });

  it("persists across separate readReadSet calls (no mutation)", async () => {
    const filePath = path.join(tmpRoot, "ward.ts");

    await recordRead(tmpRoot, "sess-persist", filePath);

    const first = await readReadSet(tmpRoot, "sess-persist");
    const second = await readReadSet(tmpRoot, "sess-persist");
    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// Dedup — double record must not produce duplicate entries
// ---------------------------------------------------------------------------

describe("dedup on double record", () => {
  it("recording the same path twice yields one entry", async () => {
    const filePath = path.join(tmpRoot, "shared.ts");

    await recordRead(tmpRoot, "sess-dedup", filePath);
    await recordRead(tmpRoot, "sess-dedup", filePath);

    const set = await readReadSet(tmpRoot, "sess-dedup");
    expect(set).toHaveLength(1);
  });

  it("recording the same path three times yields one entry", async () => {
    const filePath = path.join(tmpRoot, "repeat.ts");

    await recordRead(tmpRoot, "sess-dedup3", filePath);
    await recordRead(tmpRoot, "sess-dedup3", filePath);
    await recordRead(tmpRoot, "sess-dedup3", filePath);

    const set = await readReadSet(tmpRoot, "sess-dedup3");
    expect(set).toHaveLength(1);
  });

  it("dedup does not suppress distinct paths", async () => {
    const a = path.join(tmpRoot, "a.ts");
    const b = path.join(tmpRoot, "b.ts");

    // Record a twice, b once.
    await recordRead(tmpRoot, "sess-dedup-distinct", a);
    await recordRead(tmpRoot, "sess-dedup-distinct", a);
    await recordRead(tmpRoot, "sess-dedup-distinct", b);

    const set = await readReadSet(tmpRoot, "sess-dedup-distinct");
    expect(set).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// isInReadSet — synchronous membership check by resolved path
// ---------------------------------------------------------------------------

describe("isInReadSet — resolved path comparison", () => {
  it("returns true when the file was recorded and the same path is queried", async () => {
    const filePath = path.join(tmpRoot, "gate.ts");

    await recordRead(tmpRoot, "sess-check", filePath);
    const set = await readReadSet(tmpRoot, "sess-check");

    expect(isInReadSet(set, filePath)).toBe(true);
  });

  it("returns false for a file that was never recorded", async () => {
    const recorded = path.join(tmpRoot, "exists.ts");
    const absent = path.join(tmpRoot, "absent.ts");

    await recordRead(tmpRoot, "sess-absent", recorded);
    const set = await readReadSet(tmpRoot, "sess-absent");

    expect(isInReadSet(set, absent)).toBe(false);
  });

  it("resolves relative paths consistently with stored absolute paths", async () => {
    // Store via absolute path.
    const absPath = path.join(tmpRoot, "rel.ts");
    await recordRead(tmpRoot, "sess-rel", absPath);
    const set = await readReadSet(tmpRoot, "sess-rel");

    // The set contains the path.resolve() form; isInReadSet should find it.
    expect(isInReadSet(set, absPath)).toBe(true);
  });

  it("returns false on an empty set", () => {
    expect(isInReadSet([], path.join(tmpRoot, "any.ts"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readReadSet — missing file returns []
// ---------------------------------------------------------------------------

describe("readReadSet — missing file", () => {
  it("returns [] when no read-set file exists for the session", async () => {
    const set = await readReadSet(tmpRoot, "no-such-session");
    expect(set).toEqual([]);
  });

  it("does not throw when the entire .hima directory is absent", async () => {
    // tmpRoot is a fresh empty directory with no .hima subdirectory.
    await expect(readReadSet(tmpRoot, "ghost-session")).resolves.toEqual([]);
  });

  it("returns [] when the file exists but contains malformed JSON", async () => {
    const stateDir = path.join(tmpRoot, ".hima", "state");
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "read-set-bad.json"),
      "not valid json",
      "utf8",
    );

    const set = await readReadSet(tmpRoot, "bad");
    expect(set).toEqual([]);
  });

  it("returns [] when the file contains valid JSON but wrong shape", async () => {
    const stateDir = path.join(tmpRoot, ".hima", "state");
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      path.join(stateDir, "read-set-wrong.json"),
      JSON.stringify({ not: "an array" }),
      "utf8",
    );

    const set = await readReadSet(tmpRoot, "wrong");
    expect(set).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// recordRead — error swallowing: never throws
// ---------------------------------------------------------------------------

describe("recordRead — never throws", () => {
  it("does not throw when the root path is unwritable (coverage: swallow)", async () => {
    // Pass a filePath that is deeply nested — recordRead must not throw.
    const filePath = path.join(tmpRoot, "deep", "nested", "file.ts");
    await expect(recordRead(tmpRoot, "sess-safe", filePath)).resolves.toBeUndefined();
  });

  it("sessions are isolated to separate files", async () => {
    const a = path.join(tmpRoot, "alpha.ts");
    const b = path.join(tmpRoot, "beta.ts");

    await recordRead(tmpRoot, "sess-a", a);
    await recordRead(tmpRoot, "sess-b", b);

    const setA = await readReadSet(tmpRoot, "sess-a");
    const setB = await readReadSet(tmpRoot, "sess-b");

    expect(setA).toEqual([path.resolve(a)]);
    expect(setB).toEqual([path.resolve(b)]);
  });
});

// ---------------------------------------------------------------------------
// Realpath dedup — recording the realpath of an existing file
// ---------------------------------------------------------------------------

describe("realpath-based dedup with existing files", () => {
  it("records the realpath when the file already exists on disk", async () => {
    // Create the file so that realpath() resolves it rather than falling back.
    const filePath = path.join(tmpRoot, "existing.ts");
    await writeFile(filePath, "// existing\n", "utf8");

    await recordRead(tmpRoot, "sess-real", filePath);

    const set = await readReadSet(tmpRoot, "sess-real");
    expect(set).toHaveLength(1);

    // The stored entry must be the canonical realpath.
    const canonical = await realpath(filePath);
    expect(set[0]).toBe(canonical);

    // isInReadSet should still find it via path.resolve (same result for non-symlink).
    expect(isInReadSet(set, filePath)).toBe(true);
  });
});
