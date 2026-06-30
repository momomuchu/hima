/**
 * Tests for wave-log.ts — appendWaveLog + waveLogPath.
 *
 * Mandated scenarios (per R-037):
 *  A. appendWaveLog writes a parseable JSON line to .hima/state/waves.log
 *  B. Two successive calls append two distinct JSON lines (JSONL semantics)
 *  C. appendWaveLog creates the directory tree if it does not exist
 *  D. appendWaveLog never throws on a bad root path (swallow-errors contract)
 *  E. The persisted line round-trips through JSON.parse to the original entry
 *
 * waveLogPath unit tests:
 *  F. returns canonical path "<root>/.hima/state/waves.log"
 *  G. different roots yield different paths
 *
 * Entry field contract (all mandatory fields are persisted):
 *  H. wave_id is preserved
 *  I. artifact is preserved
 *  J. trigger_path is preserved
 *  K. lane_count is preserved
 *  L. models_used is preserved (array)
 *  M. pipeline_status is preserved
 *  N. ts is preserved
 */

import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendWaveLog, waveLogPath } from "../src/wave-log.js";
import type { WaveLogEntry } from "../src/wave-log.js";

// ---------------------------------------------------------------------------
// Tmp dir lifecycle
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hima-wave-log-test-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<WaveLogEntry> = {}): WaveLogEntry {
  return {
    wave_id: "wave-001",
    artifact: "la landing",
    trigger_path: "full",
    lane_count: 5,
    models_used: ["sonnet", "haiku"],
    pipeline_status: "complete",
    ts: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

/** Read the waves.log file and split into non-empty lines. */
async function readLines(r: string): Promise<string[]> {
  const content = await readFile(path.join(r, ".hima", "state", "waves.log"), "utf8");
  return content.split("\n").filter((l) => l.trim() !== "");
}

// ---------------------------------------------------------------------------
// waveLogPath
// ---------------------------------------------------------------------------

describe("waveLogPath", () => {
  it("F. returns canonical path <root>/.hima/state/waves.log", () => {
    const result = waveLogPath("/project");
    expect(result).toBe(path.join("/project", ".hima", "state", "waves.log"));
  });

  it("G. different roots yield different paths", () => {
    const a = waveLogPath("/project-a");
    const b = waveLogPath("/project-b");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// appendWaveLog — core semantics
// ---------------------------------------------------------------------------

describe("appendWaveLog — core semantics", () => {
  it("A. writes a parseable JSON line to .hima/state/waves.log", async () => {
    const entry = makeEntry();
    await appendWaveLog(root, entry);

    const lines = await readLines(root);
    expect(lines).toHaveLength(1);

    // Each line must be valid JSON
    const parsed: unknown = JSON.parse(lines[0]!);
    expect(typeof parsed).toBe("object");
  });

  it("B. two successive calls append two distinct JSON lines (JSONL)", async () => {
    await appendWaveLog(root, makeEntry({ wave_id: "wave-001" }));
    await appendWaveLog(root, makeEntry({ wave_id: "wave-002" }));

    const lines = await readLines(root);
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]!) as WaveLogEntry;
    const second = JSON.parse(lines[1]!) as WaveLogEntry;
    expect(first.wave_id).toBe("wave-001");
    expect(second.wave_id).toBe("wave-002");
  });

  it("C. creates the .hima/state/ directory tree if it does not exist", async () => {
    // The dir does not pre-exist in a fresh tmpdir; appendWaveLog must create it.
    const entry = makeEntry();
    await appendWaveLog(root, entry);

    const lines = await readLines(root);
    expect(lines).toHaveLength(1);
  });

  it("D. never throws on a bad root path (swallow-errors contract)", async () => {
    // A root inside a non-writable/non-existent path — should not throw.
    const badRoot = path.join(root, "does", "not", "exist-at-all-XXXXXXXXX");
    // We expect NO throw even though the path is deeply nested under a non-existent parent.
    // (Note: recursive mkdir will create it — but passing /dev/null/bad should fail silently.)
    const impossibleRoot = "/dev/null/impossible-path";
    await expect(appendWaveLog(impossibleRoot, makeEntry())).resolves.toBeUndefined();
  });

  it("E. persisted line round-trips through JSON.parse to the original entry", async () => {
    const entry = makeEntry({ wave_id: "rt-001", lane_count: 7 });
    await appendWaveLog(root, entry);

    const lines = await readLines(root);
    const parsed = JSON.parse(lines[0]!) as WaveLogEntry;
    expect(parsed).toEqual(entry);
  });
});

// ---------------------------------------------------------------------------
// Entry field contract
// ---------------------------------------------------------------------------

describe("appendWaveLog — entry field contract", () => {
  it("H. wave_id is preserved", async () => {
    await appendWaveLog(root, makeEntry({ wave_id: "abc-123" }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).wave_id).toBe("abc-123");
  });

  it("I. artifact is preserved", async () => {
    await appendWaveLog(root, makeEntry({ artifact: "le dashboard" }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).artifact).toBe("le dashboard");
  });

  it("J. trigger_path 'fallback' is preserved", async () => {
    await appendWaveLog(root, makeEntry({ trigger_path: "fallback" }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).trigger_path).toBe("fallback");
  });

  it("K. lane_count is preserved", async () => {
    await appendWaveLog(root, makeEntry({ lane_count: 10 }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).lane_count).toBe(10);
  });

  it("L. models_used array is preserved", async () => {
    await appendWaveLog(root, makeEntry({ models_used: ["sonnet"] }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).models_used).toEqual(["sonnet"]);
  });

  it("M. pipeline_status 'partial' is preserved", async () => {
    await appendWaveLog(root, makeEntry({ pipeline_status: "partial" }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).pipeline_status).toBe("partial");
  });

  it("N. ts is preserved", async () => {
    const ts = "2026-06-30T12:34:56.789Z";
    await appendWaveLog(root, makeEntry({ ts }));
    const [line] = await readLines(root);
    expect((JSON.parse(line!) as WaveLogEntry).ts).toBe(ts);
  });
});
