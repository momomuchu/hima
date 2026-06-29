import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkStageGate, closeWard, writeStageVerdict } from "../src/ward-transitions.js";
import { createWard } from "../src/ward-store.js";
import type { Ward } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "ward-transitions-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

/**
 * Build a minimal in-memory Ward for pure-function tests (checkStageGate).
 * No I/O involved — constructed directly to avoid file-system round-trips.
 */
function makeWard(overrides: Partial<Ward> = {}): Ward {
  return {
    id: "test-ward",
    entryPoint: "full",
    floor: "H",
    openStage: "discovery",
    skillRegister: [],
    verdicts: [],
    ...overrides,
  };
}

/**
 * Seal every DEV_CYCLE stage from "discovery" through `throughStage` using
 * writeStageVerdict with status "done". Used to set up a ward state for
 * closeWard tests without triggering the done-verified predecessor guard.
 */
async function sealThrough(root: string, throughStage: string): Promise<void> {
  const order = ["discovery", "analysis", "spec", "design", "impl", "test", "verify", "maintenance"];
  const limit = order.indexOf(throughStage);
  if (limit < 0) throw new Error(`unknown stage: ${throughStage}`);
  for (const stage of order.slice(0, limit + 1)) {
    await writeStageVerdict(root, stage, "done");
  }
}

// ---------------------------------------------------------------------------
// checkStageGate — pure function, no I/O
// ---------------------------------------------------------------------------

describe("checkStageGate", () => {
  it("discovery has no predecessors — always ok regardless of verdicts", () => {
    expect(checkStageGate(makeWard(), "discovery")).toEqual({ ok: true });
    // Even with unrelated verdicts present, discovery is always allowed.
    expect(
      checkStageGate(
        makeWard({ verdicts: [{ stage: "analysis", status: "blocked", evidence: [] }] }),
        "discovery",
      ),
    ).toEqual({ ok: true });
  });

  it("unknown stage (not in DEV_CYCLE) is always ok", () => {
    expect(checkStageGate(makeWard(), "some-custom-stage")).toEqual({ ok: true });
  });

  it("blocks spec when discovery has no verdict", () => {
    const result = checkStageGate(makeWard(), "spec");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("discovery");
    expect(result.reason).toContain("no verdict");
  });

  it("blocks spec when discovery verdict is partial (not sealed)", () => {
    const ward = makeWard({
      verdicts: [{ stage: "discovery", status: "partial", evidence: [] }],
    });
    const result = checkStageGate(ward, "spec");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("discovery");
    expect(result.reason).toContain("partial");
  });

  it("blocks spec when discovery verdict is blocked", () => {
    const ward = makeWard({
      verdicts: [{ stage: "discovery", status: "blocked", evidence: [] }],
    });
    const result = checkStageGate(ward, "spec");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("discovery");
  });

  it("blocks analysis when discovery is not sealed", () => {
    const result = checkStageGate(makeWard(), "analysis");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("discovery");
  });

  it("allows analysis when discovery is done", () => {
    const ward = makeWard({
      verdicts: [{ stage: "discovery", status: "done", evidence: [] }],
    });
    expect(checkStageGate(ward, "analysis")).toEqual({ ok: true });
  });

  it("allows analysis when discovery is done-verified", () => {
    const ward = makeWard({
      verdicts: [{ stage: "discovery", status: "done-verified", evidence: [] }],
    });
    expect(checkStageGate(ward, "analysis")).toEqual({ ok: true });
  });

  it("allows analysis when discovery is done-validated", () => {
    const ward = makeWard({
      verdicts: [{ stage: "discovery", status: "done-validated", evidence: [] }],
    });
    expect(checkStageGate(ward, "analysis")).toEqual({ ok: true });
  });

  it("blocks spec when discovery is sealed but analysis is missing", () => {
    const ward = makeWard({
      verdicts: [{ stage: "discovery", status: "done", evidence: [] }],
    });
    const result = checkStageGate(ward, "spec");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("analysis");
  });

  it("allows spec when both discovery and analysis are sealed", () => {
    const ward = makeWard({
      verdicts: [
        { stage: "discovery", status: "done", evidence: [] },
        { stage: "analysis", status: "done-verified", evidence: [] },
      ],
    });
    expect(checkStageGate(ward, "spec")).toEqual({ ok: true });
  });

  it("blocks impl when an intermediate stage (spec) is partial", () => {
    const ward = makeWard({
      verdicts: [
        { stage: "discovery", status: "done", evidence: [] },
        { stage: "analysis", status: "done", evidence: [] },
        { stage: "spec", status: "partial", evidence: [] },
        { stage: "design", status: "done", evidence: [] },
      ],
    });
    const result = checkStageGate(ward, "impl");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("spec");
  });
});

// ---------------------------------------------------------------------------
// writeStageVerdict — reads/writes disk
// ---------------------------------------------------------------------------

describe("writeStageVerdict", () => {
  it("seals discovery and advances openStage to analysis", async () => {
    await createWard(tmpRoot, { id: "run-wv-001", entryPoint: "full", floor: "H" });

    const updated = await writeStageVerdict(tmpRoot, "discovery", "done");

    expect(updated.openStage).toBe("analysis");
    const verdict = updated.verdicts.find((v) => v.stage === "discovery");
    expect(verdict).toBeDefined();
    expect(verdict!.status).toBe("done");
    expect(verdict!.evidence).toEqual([]);
  });

  it("persists evidence strings for the stage verdict", async () => {
    await createWard(tmpRoot, { id: "run-wv-002", entryPoint: "full", floor: "H" });

    const updated = await writeStageVerdict(
      tmpRoot,
      "discovery",
      "done",
      ["docs/analysis.md", "src/gap-register.ts"],
    );

    expect(updated.verdicts.find((v) => v.stage === "discovery")?.evidence).toEqual([
      "docs/analysis.md",
      "src/gap-register.ts",
    ]);
  });

  it("replaces an existing verdict for the same stage (last-write wins)", async () => {
    await createWard(tmpRoot, { id: "run-wv-003", entryPoint: "full", floor: "H" });

    await writeStageVerdict(tmpRoot, "discovery", "partial");
    const updated = await writeStageVerdict(tmpRoot, "discovery", "done");

    // Only one verdict for discovery, with the latest status.
    const discoveryVerdicts = updated.verdicts.filter((v) => v.stage === "discovery");
    expect(discoveryVerdicts).toHaveLength(1);
    expect(discoveryVerdicts[0]!.status).toBe("done");
  });

  it("persists the updated ward to disk so a subsequent resumeWard sees the new state", async () => {
    await createWard(tmpRoot, { id: "run-wv-persist", entryPoint: "full", floor: "H" });
    await writeStageVerdict(tmpRoot, "discovery", "done");

    // Read raw JSON to confirm persistence.
    const wardPath = path.join(tmpRoot, ".hima/state/ward.json");
    const raw = JSON.parse(await readFile(wardPath, "utf8")) as Record<string, unknown>;
    expect(raw["openStage"]).toBe("analysis");
    const verdicts = raw["verdicts"] as Array<Record<string, unknown>>;
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]!["stage"]).toBe("discovery");
    expect(verdicts[0]!["status"]).toBe("done");
  });

  it("throws when marking analysis done-verified with no discovery verdict", async () => {
    await createWard(tmpRoot, { id: "run-wv-guard-001", entryPoint: "full", floor: "H" });

    await expect(
      writeStageVerdict(tmpRoot, "analysis", "done-verified"),
    ).rejects.toThrow(/discovery/);
  });

  it("throws when marking analysis done-validated with discovery only partial", async () => {
    await createWard(tmpRoot, { id: "run-wv-guard-002", entryPoint: "full", floor: "H" });
    await writeStageVerdict(tmpRoot, "discovery", "partial");

    await expect(
      writeStageVerdict(tmpRoot, "analysis", "done-validated"),
    ).rejects.toThrow(/discovery/);
  });

  it("allows done-verified when the predecessor is sealed", async () => {
    await createWard(tmpRoot, { id: "run-wv-guard-ok", entryPoint: "full", floor: "H" });
    await writeStageVerdict(tmpRoot, "discovery", "done");

    const updated = await writeStageVerdict(tmpRoot, "analysis", "done-verified");

    expect(updated.verdicts.find((v) => v.stage === "analysis")?.status).toBe("done-verified");
    expect(updated.openStage).toBe("spec");
  });

  it("does not apply the predecessor guard for status done (weaker)", async () => {
    await createWard(tmpRoot, { id: "run-wv-done-no-guard", entryPoint: "full", floor: "H" });

    // Sealing analysis as "done" does NOT require discovery to be sealed.
    const updated = await writeStageVerdict(tmpRoot, "analysis", "done");
    expect(updated.verdicts.find((v) => v.stage === "analysis")?.status).toBe("done");
  });

  it("openStage stays at maintenance when sealing the last stage", async () => {
    await createWard(tmpRoot, { id: "run-wv-last", entryPoint: "full", floor: "H" });

    const updated = await writeStageVerdict(tmpRoot, "maintenance", "done");
    expect(updated.openStage).toBe("maintenance");
  });

  it("openStage is unchanged for a stage not in DEV_CYCLE", async () => {
    await createWard(tmpRoot, { id: "run-wv-unknown", entryPoint: "full", floor: "H" });
    // Initial openStage is "discovery".
    const updated = await writeStageVerdict(tmpRoot, "custom-stage", "done");
    expect(updated.openStage).toBe("discovery");
  });

  it("accumulates verdicts for distinct stages without overwriting others", async () => {
    await createWard(tmpRoot, { id: "run-wv-accum", entryPoint: "full", floor: "H" });

    await writeStageVerdict(tmpRoot, "discovery", "done");
    const updated = await writeStageVerdict(tmpRoot, "analysis", "done");

    expect(updated.verdicts).toHaveLength(2);
    expect(updated.verdicts.map((v) => v.stage).sort()).toEqual(["analysis", "discovery"].sort());
  });
});

// ---------------------------------------------------------------------------
// closeWard — reads/writes disk
// ---------------------------------------------------------------------------

describe("closeWard", () => {
  it("writes a ledger JSONL file at the expected path", async () => {
    await createWard(tmpRoot, { id: "run-close-001", entryPoint: "full", floor: "H" });
    await sealThrough(tmpRoot, "verify");

    const isoTs = "2026-06-29T12-00-00.000Z";
    await closeWard(tmpRoot, isoTs);

    const ledgerPath = path.join(
      tmpRoot,
      ".hima/state/ledger",
      `run-close-001-${isoTs}.jsonl`,
    );
    const content = await readFile(ledgerPath, "utf8");
    const ward = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(ward["id"]).toBe("run-close-001");
  });

  it("ledger file contains exactly one valid JSON line with ward state", async () => {
    await createWard(tmpRoot, { id: "run-close-002", entryPoint: "full", floor: "H" });
    await sealThrough(tmpRoot, "verify");

    const isoTs = "2026-06-29T13-00-00.000Z";
    await closeWard(tmpRoot, isoTs);

    const ledgerPath = path.join(
      tmpRoot,
      ".hima/state/ledger",
      `run-close-002-${isoTs}.jsonl`,
    );
    const raw = await readFile(ledgerPath, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);

    const ward = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(ward["id"]).toBe("run-close-002");
    expect(Array.isArray(ward["verdicts"])).toBe(true);
  });

  it("uses the passed isoTs (colons replaced) in the ledger filename", async () => {
    await createWard(tmpRoot, { id: "run-close-ts", entryPoint: "full", floor: "H" });
    await sealThrough(tmpRoot, "verify");

    // Pass a raw ISO timestamp with colons — closeWard must sanitise it.
    const rawTs = "2026-06-29T14:30:00.000Z";
    const safeTs = rawTs.replace(/:/g, "-");
    await closeWard(tmpRoot, rawTs);

    const ledgerPath = path.join(
      tmpRoot,
      ".hima/state/ledger",
      `run-close-ts-${safeTs}.jsonl`,
    );
    const content = await readFile(ledgerPath, "utf8");
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("throws when no ward exists at root", async () => {
    await expect(closeWard(tmpRoot, "2026-06-29T15-00-00.000Z")).rejects.toThrow(
      /no ward/,
    );
  });

  it("throws when verify stage is missing a verdict", async () => {
    await createWard(tmpRoot, { id: "run-close-no-verify", entryPoint: "full", floor: "H" });
    // Do not seal verify.
    await expect(
      closeWard(tmpRoot, "2026-06-29T16-00-00.000Z"),
    ).rejects.toThrow(/verify/);
  });

  it("throws when verify verdict is only partial (not sealed)", async () => {
    await createWard(tmpRoot, { id: "run-close-partial", entryPoint: "full", floor: "H" });
    await writeStageVerdict(tmpRoot, "verify", "partial");

    await expect(
      closeWard(tmpRoot, "2026-06-29T17-00-00.000Z"),
    ).rejects.toThrow(/verify/);
  });

  it("accepts done-verified on verify as a valid sealing status", async () => {
    await createWard(tmpRoot, { id: "run-close-dv", entryPoint: "full", floor: "H" });
    // Seal all prerequisites for done-verified on verify.
    await sealThrough(tmpRoot, "test");
    await writeStageVerdict(tmpRoot, "verify", "done-verified");

    const isoTs = "2026-06-29T18-00-00.000Z";
    await closeWard(tmpRoot, isoTs);

    const ledgerPath = path.join(
      tmpRoot,
      ".hima/state/ledger",
      `run-close-dv-${isoTs}.jsonl`,
    );
    const content = await readFile(ledgerPath, "utf8");
    const ward = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(ward["id"]).toBe("run-close-dv");
  });
});
