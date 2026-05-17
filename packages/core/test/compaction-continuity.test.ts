import { describe, expect, it } from "vitest";
import {
  COMPACTION_CRITICAL_STATE_KEYS,
  type CompactionCriticalState,
  evaluateCompactionContinuity,
  normalizeCompactionCriticalStateMetadata,
} from "../src/index.js";

const expected = {
  runId: "run-1",
  phase: "build",
  subPhase: "Execute",
  mode: "auto",
  riskClass: "M",
} satisfies CompactionCriticalState;

describe("compaction continuity", () => {
  it("accepts preserved critical state from camelCase or snake_case metadata", () => {
    expect(
      evaluateCompactionContinuity(expected, {
        run_id: "run-1",
        phase: "build",
        sub_phase: "Execute",
        mode: "auto",
        risk_class: "M",
      }),
    ).toMatchObject({
      preserved: true,
      mismatchedKeys: [],
      missingKeys: [],
      stale: false,
    });

    expect(
      normalizeCompactionCriticalStateMetadata({
        runId: "run-1",
        subPhase: "Execute",
        riskClass: "M",
      }),
    ).toMatchObject({
      runId: "run-1",
      subPhase: "Execute",
      riskClass: "M",
    });
  });

  it("reports missing critical state when strict preservation is requested", () => {
    const result = evaluateCompactionContinuity(
      expected,
      {
        run_id: "run-1",
        phase: "build",
      },
      { requireAllKeys: true },
    );

    expect(result.preserved).toBe(false);
    expect(result.missingKeys).toEqual(["subPhase", "mode", "riskClass"]);
    expect(result.reason).toContain("missing critical state");
  });

  it("preserves existing PostCompact compatibility when optional fields are absent", () => {
    const result = evaluateCompactionContinuity(expected, {
      run_id: "run-1",
      phase: "build",
    });

    expect(result.preserved).toBe(true);
    expect(result.missingKeys).toEqual([]);
    expect(result.mismatchedKeys).toEqual([]);
  });

  it("detects route continuity mismatches", () => {
    const result = evaluateCompactionContinuity(expected, {
      run_id: "run-1",
      phase: "validation",
      sub_phase: "Verify",
      mode: "pairing",
      risk_class: "H",
    });

    expect(result.preserved).toBe(false);
    expect(result.mismatchedKeys).toEqual(["phase", "subPhase", "mode", "riskClass"]);
    expect(result.reason).toContain("continuity mismatch");
  });

  it("detects stale compaction snapshots deterministically", () => {
    const result = evaluateCompactionContinuity(
      expected,
      {
        run_id: "run-1",
        phase: "build",
        sub_phase: "Execute",
        mode: "auto",
        risk_class: "M",
        compaction_snapshot_at: "2026-05-15T00:00:00.000Z",
      },
      {
        maxSnapshotAgeMs: 1_000,
        now: "2026-05-15T00:00:02.500Z",
      },
    );

    expect(result.preserved).toBe(false);
    expect(result.stale).toBe(true);
    expect(result.snapshotAgeMs).toBe(2_500);
    expect(result.reason).toContain("stale");
  });

  it("keeps the critical-state catalog unique and ordered", () => {
    expect(COMPACTION_CRITICAL_STATE_KEYS).toEqual([
      "runId",
      "phase",
      "subPhase",
      "mode",
      "riskClass",
    ]);
    expect(new Set(COMPACTION_CRITICAL_STATE_KEYS).size).toBe(
      COMPACTION_CRITICAL_STATE_KEYS.length,
    );
  });
});
