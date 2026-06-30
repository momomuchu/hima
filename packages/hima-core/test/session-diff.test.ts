/**
 * Tests for session-diff.ts — captureGitSnapshot, readGitSnapshot, hasChangesSince.
 *
 * Mandated scenarios (R-044):
 *
 * captureGitSnapshot / readGitSnapshot roundtrip:
 *   A. capture then read returns the exact same snapshot string
 *   B. capture overwrites a previous snapshot (one baseline per session)
 *   C. capture creates .hima/state/ when it does not exist
 *   D. the persisted file contains a "base" field and an optional "ts" field
 *
 * readGitSnapshot — absent / corrupt cases:
 *   E. returns null when no snapshot file exists
 *   F. returns null when the file is invalid JSON
 *   G. returns null when the JSON lacks a "base" field
 *
 * hasChangesSince — pure predicate:
 *   H. returns true when base is null (no baseline)
 *   I. returns false when current equals base
 *   J. returns true when current differs from base
 *   K. returns true when base is empty string and current is non-empty
 *   L. returns false when both are empty strings
 *
 * sessionDiffPath:
 *   M. canonical path is <root>/.hima/state/session-diff-base.json
 */

import { readFile, mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureGitSnapshot,
  hasChangesSince,
  readGitSnapshot,
  sessionDiffPath,
} from "../src/session-diff.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-session-diff-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// sessionDiffPath
// ---------------------------------------------------------------------------

describe("sessionDiffPath", () => {
  it("M. canonical path is <root>/.hima/state/session-diff-base.json", () => {
    const result = sessionDiffPath("/my-project");
    expect(result).toBe(
      path.join("/my-project", ".hima", "state", "session-diff-base.json"),
    );
  });
});

// ---------------------------------------------------------------------------
// captureGitSnapshot / readGitSnapshot — roundtrip
// ---------------------------------------------------------------------------

describe("captureGitSnapshot + readGitSnapshot — roundtrip", () => {
  it("A. capture then read returns the exact same snapshot string", async () => {
    const snapshot = " 3 files changed, 42 insertions(+), 7 deletions(-)";
    await captureGitSnapshot(root, snapshot);
    const result = await readGitSnapshot(root);
    expect(result).toBe(snapshot);
  });

  it("B. capture overwrites a previous snapshot", async () => {
    await captureGitSnapshot(root, "old snapshot");
    await captureGitSnapshot(root, "new snapshot");
    const result = await readGitSnapshot(root);
    expect(result).toBe("new snapshot");
  });

  it("C. capture creates .hima/state/ when the directory does not exist", async () => {
    // Fresh tmpdir has no .hima directory — captureGitSnapshot must create it.
    const snapshot = "packages/foo/bar.ts | 2 +-";
    await captureGitSnapshot(root, snapshot);
    const result = await readGitSnapshot(root);
    expect(result).toBe(snapshot);
  });

  it("D. persisted file contains 'base' and 'ts' fields", async () => {
    const snapshot = "some diff output";
    await captureGitSnapshot(root, snapshot);

    const raw = await readFile(sessionDiffPath(root), "utf8");
    const parsed: unknown = JSON.parse(raw);

    expect(parsed).toMatchObject({ base: snapshot });
    expect(typeof (parsed as { ts?: unknown }).ts).toBe("string");
  });

  it("roundtrip preserves an empty string snapshot", async () => {
    await captureGitSnapshot(root, "");
    const result = await readGitSnapshot(root);
    expect(result).toBe("");
  });

  it("roundtrip preserves a multi-line snapshot", async () => {
    const snapshot =
      " packages/hima-core/src/session-diff.ts | 80 +++\n" +
      " packages/hima-core/src/wave-log.ts     | 12 +-\n" +
      " 2 files changed, 86 insertions(+), 6 deletions(-)";
    await captureGitSnapshot(root, snapshot);
    const result = await readGitSnapshot(root);
    expect(result).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// readGitSnapshot — absent / corrupt cases
// ---------------------------------------------------------------------------

describe("readGitSnapshot — absent / corrupt cases", () => {
  it("E. returns null when no snapshot file exists", async () => {
    const result = await readGitSnapshot(root);
    expect(result).toBeNull();
  });

  it("F. returns null when the file contains invalid JSON", async () => {
    const dir = path.join(root, ".hima", "state");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "session-diff-base.json"), "not json {{", "utf8");

    const result = await readGitSnapshot(root);
    expect(result).toBeNull();
  });

  it("G. returns null when the JSON lacks a 'base' field", async () => {
    const dir = path.join(root, ".hima", "state");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "session-diff-base.json"),
      JSON.stringify({ snapshot: "wrong key" }),
      "utf8",
    );

    const result = await readGitSnapshot(root);
    expect(result).toBeNull();
  });

  it("returns null when 'base' field exists but is not a string", async () => {
    const dir = path.join(root, ".hima", "state");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "session-diff-base.json"),
      JSON.stringify({ base: 42 }),
      "utf8",
    );

    const result = await readGitSnapshot(root);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasChangesSince — pure predicate
// ---------------------------------------------------------------------------

describe("hasChangesSince — pure predicate", () => {
  it("H. returns true when base is null (no baseline)", () => {
    expect(hasChangesSince(null, "any current diff")).toBe(true);
  });

  it("H. returns true when base is null and current is empty string", () => {
    expect(hasChangesSince(null, "")).toBe(true);
  });

  it("I. returns false when current equals base", () => {
    const snap = " 1 file changed, 2 insertions(+)";
    expect(hasChangesSince(snap, snap)).toBe(false);
  });

  it("J. returns true when current differs from base", () => {
    const base = " 1 file changed, 2 insertions(+)";
    const current = " 2 files changed, 5 insertions(+), 1 deletion(-)";
    expect(hasChangesSince(base, current)).toBe(true);
  });

  it("K. returns true when base is empty string and current is non-empty", () => {
    expect(hasChangesSince("", "some diff")).toBe(true);
  });

  it("L. returns false when both are empty strings", () => {
    expect(hasChangesSince("", "")).toBe(false);
  });

  it("returns false for identical multi-line snapshots", () => {
    const snap =
      " src/a.ts | 10 ++++\n src/b.ts | 2 +-\n 2 files changed, 11 insertions(+), 1 deletion(-)";
    expect(hasChangesSince(snap, snap)).toBe(false);
  });

  it("returns true when snapshots differ by a single trailing newline", () => {
    const base = "packages/foo | 1 +";
    const current = "packages/foo | 1 +\n";
    expect(hasChangesSince(base, current)).toBe(true);
  });
});
