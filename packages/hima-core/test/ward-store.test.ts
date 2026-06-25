import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createWard, resumeWard, advanceStage } from "../src/ward-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "ward-store-test-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// createWard
// ---------------------------------------------------------------------------

describe("createWard", () => {
  it("full entry-point → openStage is discovery", async () => {
    const ward = await createWard(tmpRoot, {
      id: "run-full-001",
      entryPoint: "full",
      floor: "H",
    });

    expect(ward.id).toBe("run-full-001");
    expect(ward.entryPoint).toBe("full");
    expect(ward.floor).toBe("H");
    expect(ward.openStage).toBe("discovery");
    expect(ward.skillRegister).toEqual([]);
    expect(ward.verdicts).toEqual([]);
    expect(ward.deferred).toBeUndefined();
  });

  it("run entry-point → openStage is spec", async () => {
    const ward = await createWard(tmpRoot, {
      id: "run-run-001",
      entryPoint: "run",
      floor: "M",
    });

    expect(ward.openStage).toBe("spec");
    expect(ward.entryPoint).toBe("run");
  });

  it("spec entry-point → openStage is spec", async () => {
    const ward = await createWard(tmpRoot, {
      id: "run-spec-001",
      entryPoint: "spec",
      floor: "M",
    });

    expect(ward.openStage).toBe("spec");
    expect(ward.entryPoint).toBe("spec");
  });

  it("persists a valid ward.json that survives re-read", async () => {
    await createWard(tmpRoot, {
      id: "run-persist-001",
      entryPoint: "full",
      floor: "C",
    });

    // Read it back raw to confirm the file is real JSON with the right shape.
    const { readFile } = await import("node:fs/promises");
    const wardPath = path.join(tmpRoot, ".hima/state/ward.json");
    const raw = await readFile(wardPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed["id"]).toBe("run-persist-001");
    expect(parsed["openStage"]).toBe("discovery");
    expect(parsed["floor"]).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// resumeWard
// ---------------------------------------------------------------------------

describe("resumeWard", () => {
  it("returns null when no ward file exists", async () => {
    const result = await resumeWard(tmpRoot);
    expect(result).toBeNull();
  });

  it("returns the same ward that was created (no overwrite)", async () => {
    const created = await createWard(tmpRoot, {
      id: "run-resume-001",
      entryPoint: "full",
      floor: "H",
    });

    const resumed = await resumeWard(tmpRoot);
    expect(resumed).not.toBeNull();
    expect(resumed!.id).toBe(created.id);
    expect(resumed!.entryPoint).toBe(created.entryPoint);
    expect(resumed!.floor).toBe(created.floor);
    expect(resumed!.openStage).toBe(created.openStage);
    expect(resumed!.skillRegister).toEqual(created.skillRegister);
    expect(resumed!.verdicts).toEqual(created.verdicts);
  });

  it("calling resumeWard twice returns the same data without mutation", async () => {
    await createWard(tmpRoot, {
      id: "run-resume-idempotent",
      entryPoint: "run",
      floor: "L",
    });

    const first = await resumeWard(tmpRoot);
    const second = await resumeWard(tmpRoot);

    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// advanceStage
// ---------------------------------------------------------------------------

describe("advanceStage", () => {
  it("records a done verdict for the previous openStage and moves to the new stage", async () => {
    await createWard(tmpRoot, {
      id: "run-advance-001",
      entryPoint: "full",
      floor: "H",
    });

    // Ward starts at "discovery"; advance to "analysis" with status "done".
    const advanced = await advanceStage(tmpRoot, "analysis", "done");

    expect(advanced.openStage).toBe("analysis");
    expect(advanced.verdicts).toHaveLength(1);

    const verdict = advanced.verdicts[0];
    expect(verdict).toBeDefined();
    expect(verdict!.stage).toBe("discovery");
    expect(verdict!.status).toBe("done");
    expect(verdict!.evidence).toEqual([]);
  });

  it("accumulates multiple verdicts across successive advances", async () => {
    await createWard(tmpRoot, {
      id: "run-advance-multi",
      entryPoint: "full",
      floor: "H",
    });

    await advanceStage(tmpRoot, "analysis", "done-verified");
    const final = await advanceStage(tmpRoot, "spec", "done");

    expect(final.openStage).toBe("spec");
    expect(final.verdicts).toHaveLength(2);
    expect(final.verdicts[0]!.stage).toBe("discovery");
    expect(final.verdicts[0]!.status).toBe("done-verified");
    expect(final.verdicts[1]!.stage).toBe("analysis");
    expect(final.verdicts[1]!.status).toBe("done");
  });

  it("persists advances so a subsequent resumeWard sees the new state", async () => {
    await createWard(tmpRoot, {
      id: "run-advance-persist",
      entryPoint: "run",
      floor: "M",
    });

    await advanceStage(tmpRoot, "design", "partial");

    const resumed = await resumeWard(tmpRoot);
    expect(resumed).not.toBeNull();
    expect(resumed!.openStage).toBe("design");
    expect(resumed!.verdicts).toHaveLength(1);
    expect(resumed!.verdicts[0]!.status).toBe("partial");
  });

  it("supports all valid StageVerdict status values", async () => {
    const statuses: Array<
      "blocked" | "partial" | "done" | "done-verified" | "done-validated"
    > = ["blocked", "partial", "done", "done-verified", "done-validated"];

    for (const status of statuses) {
      const localRoot = await mkdtemp(path.join(os.tmpdir(), `ward-status-${status}-`));
      try {
        await createWard(localRoot, {
          id: `run-${status}`,
          entryPoint: "full",
          floor: "H",
        });
        const result = await advanceStage(localRoot, "analysis", status);
        expect(result.verdicts[0]!.status).toBe(status);
      } finally {
        await rm(localRoot, { recursive: true, force: true });
      }
    }
  });
});
