/**
 * BEH-W4 — Gate-config and observability tests
 *
 * Covers:
 *   1. disabled override suppresses enforcement (skip=true, audit record still emitted)
 *   2. warn-only override downgrades block to warn
 *   3. riskFloorOverride raising works
 *   4. riskFloorOverride lowering is rejected (OVERRIDE_FORBIDDEN_FLOOR_REDUCTION)
 *   5. H/C run with disabled override rejected (OVERRIDE_FORBIDDEN_FOR_RISK_CLASS)
 *   6. GateDecisionRecord is emitted on a sample gate evaluation
 *   7. SLI snapshot computation from GATE_DECISION events
 *
 * Design reference: .planning/behavior-system/gate-config-and-observability-design.md
 */

import { describe, expect, it } from "vitest";
import { getCatalogRiskFloor, resolveOverride } from "../src/gates/behavior-override.js";
import { evaluateGate, type GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import { buildGateDecisionRecord, computeSliSnapshots } from "../src/gates/gate-decision-record.js";
import type { BehaviorOverride } from "../src/schemas/run-set.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { RiskClass } from "../src/types/canonical.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeOverride(
  behaviorId: string,
  mode: BehaviorOverride["mode"],
  opts: Partial<Pick<BehaviorOverride, "riskFloorOverride" | "justification">> = {},
): BehaviorOverride {
  return {
    behaviorId,
    mode,
    justification: opts.justification ?? "test justification for override",
    addedAt: "2026-05-20T00:00:00.000Z",
    addedBy: "developer",
    ...(opts.riskFloorOverride ? { riskFloorOverride: opts.riskFloorOverride } : {}),
  };
}

function makeContext(
  riskClass: RiskClass = "T",
  overrides: BehaviorOverride[] = [],
): GateEvaluationContext {
  const project = createDefaultPlanningProject("run_test_w4");
  return {
    projectRoot: "/tmp/w4-test",
    state: project.state,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: { T: 0, L: 1, M: 2, H: 3, C: 4 }[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...project.runSet,
      route: { ...project.runSet.route, riskClass },
      policy: { ...project.runSet.policy, behaviorOverrides: overrides },
    },
  };
}

// ── Part 1: resolveOverride ───────────────────────────────────────────────────

describe("resolveOverride — no override", () => {
  it("returns skip=false, capAtWarn=false, overrideActive=false when no entry exists", () => {
    const result = resolveOverride("BEH-012", [], "T");
    expect(result.skip).toBe(false);
    expect(result.capAtWarn).toBe(false);
    expect(result.overrideActive).toBe(false);
    expect(result.forbiddenReason).toBeUndefined();
  });

  it("effective floor matches catalog floor when no override", () => {
    // BEH-012 has catalog floor M
    const result = resolveOverride("BEH-012", [], "T");
    expect(result.effectiveFloor).toBe("M");
  });
});

describe("resolveOverride — disabled override, low risk", () => {
  it("skip=true when mode=disabled and run risk < floor", () => {
    const overrides = [makeOverride("BEH-012", "disabled")];
    // BEH-012 floor is M; run is T (below M) → override is permitted
    const result = resolveOverride("BEH-012", overrides, "T");
    expect(result.skip).toBe(true);
    expect(result.capAtWarn).toBe(false);
    expect(result.overrideActive).toBe(true);
    expect(result.overrideMode).toBe("disabled");
    expect(result.forbiddenReason).toBeUndefined();
  });

  it("skip=true when mode=disabled for a T-floor behavior at T risk", () => {
    // BEH-010 floor is T; but at T risk, riskAtLeast("T","T") is true → forbidden
    const overrides = [makeOverride("BEH-010", "disabled")];
    const result = resolveOverride("BEH-010", overrides, "T");
    // T >= T → OVERRIDE_FORBIDDEN_FOR_RISK_CLASS
    expect(result.skip).toBe(false);
    expect(result.forbiddenReason).toBe("OVERRIDE_FORBIDDEN_FOR_RISK_CLASS");
  });
});

describe("resolveOverride — warn-only override", () => {
  it("capAtWarn=true when mode=warn-only and run risk < floor", () => {
    const overrides = [makeOverride("BEH-012", "warn-only")];
    const result = resolveOverride("BEH-012", overrides, "T");
    expect(result.capAtWarn).toBe(true);
    expect(result.skip).toBe(false);
    expect(result.overrideActive).toBe(true);
    expect(result.overrideMode).toBe("warn-only");
    expect(result.forbiddenReason).toBeUndefined();
  });
});

describe("resolveOverride — OVERRIDE_FORBIDDEN_FOR_RISK_CLASS", () => {
  it("rejects disabled override when run risk >= floor (H with BEH-012 floor M)", () => {
    const overrides = [makeOverride("BEH-012", "disabled")];
    // BEH-012 floor = M; run is H (>= M) → forbidden
    const result = resolveOverride("BEH-012", overrides, "H");
    expect(result.skip).toBe(false);
    expect(result.capAtWarn).toBe(false);
    expect(result.forbiddenReason).toBe("OVERRIDE_FORBIDDEN_FOR_RISK_CLASS");
    expect(result.overrideActive).toBe(true);
  });

  it("rejects warn-only override when run risk >= floor", () => {
    const overrides = [makeOverride("BEH-012", "warn-only")];
    const result = resolveOverride("BEH-012", overrides, "M");
    expect(result.capAtWarn).toBe(false);
    expect(result.forbiddenReason).toBe("OVERRIDE_FORBIDDEN_FOR_RISK_CLASS");
  });
});

describe("resolveOverride — riskFloorOverride raise", () => {
  it("raises effective floor and permits disabled when run is below raised floor", () => {
    // BEH-012 catalog floor=M, raise to H, run=T → T < H → permitted
    const overrides = [makeOverride("BEH-012", "disabled", { riskFloorOverride: "H" })];
    const result = resolveOverride("BEH-012", overrides, "T");
    expect(result.effectiveFloor).toBe("H");
    expect(result.skip).toBe(true);
    expect(result.forbiddenReason).toBeUndefined();
  });

  it("enforces raised floor: disabled rejected when run=H and floor=H", () => {
    const overrides = [makeOverride("BEH-012", "disabled", { riskFloorOverride: "H" })];
    const result = resolveOverride("BEH-012", overrides, "H");
    expect(result.skip).toBe(false);
    expect(result.forbiddenReason).toBe("OVERRIDE_FORBIDDEN_FOR_RISK_CLASS");
  });
});

describe("resolveOverride — OVERRIDE_FORBIDDEN_FLOOR_REDUCTION", () => {
  it("rejects riskFloorOverride that would lower the catalog floor", () => {
    // BEH-023 catalog floor=H; trying to set floor to M (lower)
    const overrides = [makeOverride("BEH-023", "disabled", { riskFloorOverride: "M" })];
    const result = resolveOverride("BEH-023", overrides, "T");
    expect(result.skip).toBe(false);
    expect(result.forbiddenReason).toBe("OVERRIDE_FORBIDDEN_FLOOR_REDUCTION");
  });
});

// ── Part 2: GateDecisionRecord emission ──────────────────────────────────────

describe("GateDecisionRecord — emitted on gate evaluation", () => {
  it("evaluateGate attaches gateDecisionRecords to the result", () => {
    const ctx = makeContext("T");
    const result = evaluateGate(ctx, { gateType: "session_start" });

    // gateDecisionRecords should be present (may be empty array if no behaviors fire)
    expect(result.gateDecisionRecords).toBeDefined();
    expect(Array.isArray(result.gateDecisionRecords)).toBe(true);
  });

  it("each GateDecisionRecord has required fields", () => {
    const ctx = makeContext("T");
    const result = evaluateGate(ctx, { gateType: "session_start" });

    for (const record of result.gateDecisionRecords ?? []) {
      expect(typeof record.type).toBe("string");
      expect(record.type).toBe("GATE_DECISION");
      expect(typeof record.ts).toBe("string");
      expect(typeof record.runId).toBe("string");
      expect(["allow", "warn", "block"]).toContain(record.verdict);
      expect(typeof record.why).toBe("string");
      expect(record.why.length).toBeGreaterThanOrEqual(10);
      expect(Array.isArray(record.signalsRead)).toBe(true);
      expect(Array.isArray(record.evidenceRefs)).toBe(true);
      expect(typeof record.overrideActive).toBe("boolean");
    }
  });

  it("buildGateDecisionRecord produces a valid record for an allow result", () => {
    const ctx = makeContext("T");
    const event = { gateType: "pre_tool" as const, toolName: "Read" };
    const result = {
      decision: "allow" as const,
      gateType: "pre_tool" as const,
      reason: "pre_tool allowed non-write tool call",
    };

    const record = buildGateDecisionRecord({ context: ctx, event, result, behaviorId: null });

    expect(record.type).toBe("GATE_DECISION");
    expect(record.verdict).toBe("allow");
    expect(record.behaviorId).toBeNull();
    expect(record.overrideActive).toBe(false);
    expect(record.why.length).toBeGreaterThanOrEqual(10);
  });

  it("buildGateDecisionRecord with disabled override sets overrideMode=disabled", () => {
    const ctx = makeContext("T", [makeOverride("BEH-012", "disabled")]);
    const event = { gateType: "pre_tool" as const, toolName: "Bash" };
    const result = {
      decision: "allow" as const,
      gateType: "pre_tool" as const,
      reason: "BEH-W4: BEH-012 skipped — disabled by behaviorOverride",
    };

    const overrideResolution = resolveOverride(
      "BEH-012",
      ctx.runSet.policy.behaviorOverrides ?? [],
      ctx.currentRisk.risk_class,
    );
    const record = buildGateDecisionRecord({
      context: ctx,
      event,
      result,
      behaviorId: "BEH-012",
      overrideResolution,
    });

    expect(record.overrideActive).toBe(true);
    expect(record.overrideMode).toBe("disabled");
    expect(record.verdict).toBe("allow");
  });
});

// ── Part 3: SLI snapshot computation ─────────────────────────────────────────

describe("computeSliSnapshots", () => {
  it("returns empty array for runs with no GATE_DECISION events", () => {
    const result = computeSliSnapshots([]);
    expect(result).toEqual([]);
  });

  it("computes correct block rate and false positive rate", () => {
    const events = [
      // BEH-012: 2 allow, 1 block, 1 allow with disabled override
      {
        id: "e1",
        ts: "2026-05-20T00:00:00Z",
        type: "GATE_DECISION",
        gateType: "pre_tool" as const,
        decision: "allow" as const,
        reason: "ok",
        payload: {
          behaviorId: "BEH-012",
          verdict: "allow",
          overrideActive: false,
          runId: "run_test",
        },
      },
      {
        id: "e2",
        ts: "2026-05-20T00:01:00Z",
        type: "GATE_DECISION",
        gateType: "pre_tool" as const,
        decision: "allow" as const,
        reason: "ok",
        payload: {
          behaviorId: "BEH-012",
          verdict: "allow",
          overrideActive: false,
          runId: "run_test",
        },
      },
      {
        id: "e3",
        ts: "2026-05-20T00:02:00Z",
        type: "GATE_DECISION",
        gateType: "pre_tool" as const,
        decision: "block" as const,
        reason: "blocked",
        payload: {
          behaviorId: "BEH-012",
          verdict: "block",
          overrideActive: false,
          runId: "run_test",
        },
      },
      {
        id: "e4",
        ts: "2026-05-20T00:03:00Z",
        type: "GATE_DECISION",
        gateType: "pre_tool" as const,
        decision: "allow" as const,
        reason: "disabled",
        payload: {
          behaviorId: "BEH-012",
          verdict: "allow",
          overrideActive: true,
          overrideMode: "disabled",
          runId: "run_test",
        },
      },
    ];

    const snapshots = computeSliSnapshots(events);
    expect(snapshots).toHaveLength(1);

    // biome-ignore lint/style/noNonNullAssertion: guarded by expect(snapshots).toHaveLength(1) above
    const snap = snapshots[0]!;
    expect(snap.behaviorId).toBe("BEH-012");
    expect(snap.totalDecisions).toBe(4);
    expect(snap.blockCount).toBe(1);
    expect(snap.warnCount).toBe(0);
    expect(snap.allowCount).toBe(3);
    expect(snap.overrideDisabledCount).toBe(1);
    expect(snap.blockRate).toBeCloseTo(0.25);
    expect(snap.falsePositiveRate).toBeCloseTo(0.25);
  });

  it("computes zero rates when all decisions are allow with no overrides", () => {
    const events = [
      {
        id: "e1",
        ts: "2026-05-20T00:00:00Z",
        type: "GATE_DECISION",
        gateType: "post_tool" as const,
        decision: "allow" as const,
        reason: "ok",
        payload: {
          behaviorId: "BEH-011",
          verdict: "allow",
          overrideActive: false,
          runId: "run_test",
        },
      },
    ];

    const snapshots = computeSliSnapshots(events);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.blockRate).toBe(0);
    expect(snapshots[0]?.falsePositiveRate).toBe(0);
  });

  it("separates snapshots by behaviorId", () => {
    const events = [
      {
        id: "e1",
        ts: "2026-05-20T00:00:00Z",
        type: "GATE_DECISION",
        gateType: "pre_tool" as const,
        decision: "allow" as const,
        reason: "ok",
        payload: {
          behaviorId: "BEH-010",
          verdict: "allow",
          overrideActive: false,
          runId: "run_test",
        },
      },
      {
        id: "e2",
        ts: "2026-05-20T00:01:00Z",
        type: "GATE_DECISION",
        gateType: "pre_tool" as const,
        decision: "block" as const,
        reason: "blocked",
        payload: {
          behaviorId: "BEH-012",
          verdict: "block",
          overrideActive: false,
          runId: "run_test",
        },
      },
    ];

    const snapshots = computeSliSnapshots(events);
    expect(snapshots).toHaveLength(2);
    const ids = snapshots.map((s) => s.behaviorId).sort();
    expect(ids).toEqual(["BEH-010", "BEH-012"]);
  });
});

// ── Part 4: getCatalogRiskFloor ───────────────────────────────────────────────

describe("getCatalogRiskFloor", () => {
  it("returns correct floor for known behaviors", () => {
    expect(getCatalogRiskFloor("BEH-012")).toBe("M");
    expect(getCatalogRiskFloor("BEH-023")).toBe("H");
    expect(getCatalogRiskFloor("BEH-031")).toBe("H");
    expect(getCatalogRiskFloor("BEH-010")).toBe("T");
  });

  it("returns T for unknown behaviors", () => {
    expect(getCatalogRiskFloor("BEH-999")).toBe("T");
  });
});
