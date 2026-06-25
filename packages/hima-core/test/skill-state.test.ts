import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLoaded, markLoaded, readRegister } from "../src/skill-state.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const REF_A = { source: "base" as const, id: "corpus-ui-knowledge" };
const REF_B = { source: "corpus" as const, id: "code-quality-maintainability" };
const REF_C = { source: "user" as const, id: "my-custom-skill" };

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-skill-state-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// readRegister
// ---------------------------------------------------------------------------

describe("readRegister", () => {
  it("returns an empty array when the register file does not exist", async () => {
    const result = await readRegister(root);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// markLoaded → readRegister round-trip
// ---------------------------------------------------------------------------

describe("markLoaded → readRegister", () => {
  it("persists a single ref and readRegister returns it", async () => {
    await markLoaded(root, REF_A);
    const register = await readRegister(root);
    expect(register).toHaveLength(1);
    expect(register[0]).toEqual(REF_A);
  });

  it("persists multiple distinct refs in insertion order", async () => {
    await markLoaded(root, REF_A);
    await markLoaded(root, REF_B);
    const register = await readRegister(root);
    expect(register).toHaveLength(2);
    expect(register[0]).toEqual(REF_A);
    expect(register[1]).toEqual(REF_B);
  });

  it("readRegister returns all marked refs after sequential marks", async () => {
    await markLoaded(root, REF_A);
    await markLoaded(root, REF_B);
    await markLoaded(root, REF_C);
    const register = await readRegister(root);
    expect(register).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// isLoaded
// ---------------------------------------------------------------------------

describe("isLoaded", () => {
  it("returns false on an empty register", () => {
    expect(isLoaded([], REF_A)).toBe(false);
  });

  it("returns true when the ref is present (exact source+id match)", async () => {
    await markLoaded(root, REF_A);
    const register = await readRegister(root);
    expect(isLoaded(register, REF_A)).toBe(true);
  });

  it("returns false when only source matches but id differs", async () => {
    await markLoaded(root, REF_A);
    const register = await readRegister(root);
    expect(isLoaded(register, { source: "base", id: "other-skill" })).toBe(false);
  });

  it("returns false when only id matches but source differs", async () => {
    await markLoaded(root, REF_A);
    const register = await readRegister(root);
    // REF_A.source is "base"; try "corpus" with same id
    expect(isLoaded(register, { source: "corpus", id: REF_A.id })).toBe(false);
  });

  it("returns true after markLoaded for the queried ref", async () => {
    await markLoaded(root, REF_B);
    const register = await readRegister(root);
    expect(isLoaded(register, REF_B)).toBe(true);
    // unrelated ref must be absent
    expect(isLoaded(register, REF_A)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("deduplication", () => {
  it("marking the same ref twice results in exactly one entry", async () => {
    await markLoaded(root, REF_A);
    await markLoaded(root, REF_A);
    const register = await readRegister(root);
    expect(register).toHaveLength(1);
    expect(register[0]).toEqual(REF_A);
  });

  it("marking three refs where first and last are the same keeps two unique entries", async () => {
    await markLoaded(root, REF_A);
    await markLoaded(root, REF_B);
    await markLoaded(root, REF_A); // duplicate
    const register = await readRegister(root);
    expect(register).toHaveLength(2);
    const ids = register.map((r) => r.id);
    expect(ids).toContain(REF_A.id);
    expect(ids).toContain(REF_B.id);
  });

  it("isLoaded returns true for deduplicated ref", async () => {
    await markLoaded(root, REF_C);
    await markLoaded(root, REF_C);
    const register = await readRegister(root);
    expect(isLoaded(register, REF_C)).toBe(true);
    expect(register).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Register file location
// ---------------------------------------------------------------------------

describe("register file location", () => {
  it("creates parent directories automatically (no pre-existing .hima/state)", async () => {
    // root is a fresh tmpdir; .hima/state does not exist
    await markLoaded(root, REF_A);
    // No ENOENT thrown — directory was created implicitly
    const register = await readRegister(root);
    expect(register).toHaveLength(1);
  });
});
