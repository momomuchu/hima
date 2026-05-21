/**
 * @file ima-state-g3.test.ts
 * GOAL-3 H1 — IMA State Machine tests
 *
 * Covers:
 *   (1) enter() seeds correct active_stage / window / mode
 *   (2) advance() traverses NEXT-STAGE bounded by window.stop, finalizes at stop
 *   (3) hardSkip() sets blocked=true regardless of mode INCLUDING mode=full-bypass
 *       (§10.2 binding — bypass-still-blocks)
 *   (4) inspectState() returns all 6 required fields and is pure
 *   (5) Worked trace from state-machine.md §5 reproduced step-by-step
 */

import { describe, expect, it } from "vitest";
import {
  advance,
  enter,
  hardSkip,
  type ImaMode,
  inspectState,
  type SpineConfig,
  type StageWindow,
  unblock,
} from "../src/runtime/ima-state.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/** Minimal SpineConfig — returns fixed disciplines per stage. */
function makeConfig(map: Record<string, readonly string[]>): SpineConfig {
  return {
    disciplinesFor(stage) {
      return map[stage] ?? [];
    },
  };
}

/** The exact discipline map from state-machine.md §5. */
const traceDisciplines = makeConfig({
  "analysis-discovery": ["competitor-benchmark", "assumption-log", "discovery-gate-matrix"],
  specification: ["acceptance-criteria", "non-functional-requirements"],
  "design-ux": ["WCAG-2.2", "dark-pattern-check", "wireframe-coverage"],
});

/** Window used in the worked trace: [analysis-discovery, design-ux] */
const traceWindow: StageWindow = {
  start: "analysis-discovery",
  stop: "design-ux",
};

// ─── (1) enter() ─────────────────────────────────────────────────────────────

describe("enter()", () => {
  it("seeds active_stage = window.start", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.active_stage).toBe("analysis-discovery");
  });

  it("seeds window correctly", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.window.start).toBe("analysis-discovery");
    expect(state.window.stop).toBe("design-ux");
  });

  it("seeds mode correctly", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.mode).toBe("M1");
  });

  it("seeds forced_disciplines from spineConfig for window.start", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.forced_disciplines).toEqual([
      "competitor-benchmark",
      "assumption-log",
      "discovery-gate-matrix",
    ]);
  });

  it("seeds completed_stages as empty array", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.completed_stages).toEqual([]);
  });

  it("seeds blocked = false", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.blocked).toBe(false);
  });

  it("sets next_handoff = nextStage(start) when start !== stop", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    // analysis-discovery → specification (next on spine)
    expect(state.next_handoff).toBe("specification");
  });

  it("sets next_handoff = END when window is a single stage", () => {
    const singleWindow: StageWindow = { start: "specification", stop: "specification" };
    const state = enter("run_single", singleWindow, "M1", traceDisciplines);
    expect(state.next_handoff).toBe("END");
  });

  it("sets decision_owner = agent for M1", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    expect(state.decision_owner).toBe("agent");
  });

  it("sets decision_owner = human for M2", () => {
    const state = enter("run_001", traceWindow, "M2", traceDisciplines);
    expect(state.decision_owner).toBe("human");
  });

  it("sets decision_owner = agent for M3", () => {
    const state = enter("run_001", traceWindow, "M3", traceDisciplines);
    expect(state.decision_owner).toBe("agent");
  });

  it("throws when window.start is END", () => {
    expect(() =>
      enter("run_x", { start: "END", stop: "design-ux" }, "M1", traceDisciplines),
    ).toThrow();
  });

  it("throws when window.stop is END", () => {
    expect(() =>
      enter("run_x", { start: "analysis-discovery", stop: "END" }, "M1", traceDisciplines),
    ).toThrow();
  });

  it("throws when stop precedes start on spine", () => {
    expect(() =>
      enter("run_x", { start: "design-ux", stop: "analysis-discovery" }, "M1", traceDisciplines),
    ).toThrow();
  });
});

// ─── (2) advance() ───────────────────────────────────────────────────────────

describe("advance()", () => {
  it("moves to the next stage inside the window", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    expect(r1.state.active_stage).toBe("specification");
  });

  it("appends the completed stage to completed_stages", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    expect(r1.state.completed_stages).toEqual(["analysis-discovery"]);
  });

  it("reloads forced_disciplines for the new stage (no carry-over)", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    // specification disciplines — NOT analysis-discovery disciplines
    expect(r1.state.forced_disciplines).toEqual([
      "acceptance-criteria",
      "non-functional-requirements",
    ]);
    expect(r1.state.forced_disciplines).not.toContain("competitor-benchmark");
  });

  it("sets next_handoff = END when advancing into window.stop", () => {
    // advance twice to reach design-ux (window.stop)
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    expect(r2.state.active_stage).toBe("design-ux");
    expect(r2.state.next_handoff).toBe("END");
  });

  it("finalizes at window.stop (active_stage = END after advancing from stop)", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const r3 = advance(r2.state, traceDisciplines);
    expect(r3.ok).toBe(true);
    if (!r3.ok) throw new Error("unreachable");
    expect(r3.state.active_stage).toBe("END");
    expect(r3.state.next_handoff).toBeNull();
    expect(r3.state.forced_disciplines).toEqual([]);
  });

  it("does not over-run past window.stop", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const r3 = advance(r2.state, traceDisciplines);
    expect(r3.ok).toBe(true);
    if (!r3.ok) throw new Error("unreachable");
    // finalized — active_stage is END, not "architecture" (what comes after design-ux)
    expect(r3.state.active_stage).toBe("END");
    expect(r3.state.active_stage).not.toBe("architecture");
  });

  it("returns ok=false without mutation when blocked", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const blocked = hardSkip(s0, "HARD_SKIP", "discipline missing");
    const result = advance(blocked, traceDisciplines);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("Cannot advance: state is blocked");
    expect(result.state.active_stage).toBe("analysis-discovery");
  });
});

// ─── (3) hardSkip() — bypass-still-blocks (§10.2 binding) ───────────────────

describe("hardSkip()", () => {
  const modes: ImaMode[] = ["M1", "M2", "M3"];

  for (const mode of modes) {
    it(`sets blocked=true for mode ${mode}`, () => {
      const state = enter("run_skip", traceWindow, mode, traceDisciplines);
      const blocked = hardSkip(state, "HARD_SKIP", `HARD discipline failed in ${mode}`);
      expect(blocked.blocked).toBe(true);
    });

    it(`sets blocker.code correctly for mode ${mode}`, () => {
      const state = enter("run_skip", traceWindow, mode, traceDisciplines);
      const blocked = hardSkip(state, "GATE_FAIL", `gate failed in ${mode}`);
      expect(blocked.blocker?.code).toBe("GATE_FAIL");
    });
  }

  // §10.2 KEY ASSERTION: full-bypass (closest to M0 is M3 gate-less) still blocks
  // The design doc states: "M0 full-bypass = no decision gates / no checkpoints /
  // no SOFT-warn friction; BUT every HARD discipline still loads and a skipped
  // HARD stage still BLOCKs." M3 is the bypass-mode in the H1 implementation.
  it("§10.2 binding — bypass mode (M3) still blocks on hardSkip (bypass-still-blocks)", () => {
    const bypassState = enter("run_bypass", traceWindow, "M3", traceDisciplines);
    expect(bypassState.mode).toBe("M3");
    expect(bypassState.blocked).toBe(false);

    const afterSkip = hardSkip(
      bypassState,
      "HARD_SKIP",
      "HARD discipline cannot be satisfied even in full-bypass mode",
      "Provide the missing evidence then call unblock()",
    );

    // The machine MUST be blocked regardless of bypass mode
    expect(afterSkip.blocked).toBe(true);
    expect(afterSkip.mode).toBe("M3"); // mode unchanged
    expect(afterSkip.blocker?.code).toBe("HARD_SKIP");
    expect(afterSkip.blocker?.message).toContain("HARD discipline");
    expect(afterSkip.blocker?.resolution).toBe("Provide the missing evidence then call unblock()");

    // advance() must refuse while blocked (even in bypass mode)
    const advResult = advance(afterSkip, traceDisciplines);
    expect(advResult.ok).toBe(false);
  });

  it("preserves all other fields on block (active_stage, window, mode, forced_disciplines)", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    const blocked = hardSkip(state, "MISSING_EVIDENCE", "evidence not found");
    expect(blocked.active_stage).toBe(state.active_stage);
    expect(blocked.window).toEqual(state.window);
    expect(blocked.mode).toBe(state.mode);
    expect(blocked.forced_disciplines).toEqual(state.forced_disciplines);
  });

  it("records blocker.since as a valid ISO-8601 timestamp", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    const blocked = hardSkip(state, "HARD_SKIP", "test");
    expect(blocked.blocker?.since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("unblock() clears blocked and drops blocker field", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    const blocked = hardSkip(state, "HARD_SKIP", "test");
    const resumed = unblock(blocked);
    expect(resumed.blocked).toBe(false);
    expect(resumed.blocker).toBeUndefined();
    expect(resumed.active_stage).toBe("analysis-discovery");
  });

  it("unblock() is idempotent when not blocked", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    const same = unblock(state);
    expect(same).toBe(state); // identity — no new object
  });
});

// ─── (4) inspectState() ──────────────────────────────────────────────────────

describe("inspectState()", () => {
  it("returns all 6 required fields: active_stage, window, mode, forced_disciplines, next_handoff, decision_owner", () => {
    const state = enter("run_inspect", traceWindow, "M1", traceDisciplines);
    const output = inspectState(state);
    const snap = output.json;

    expect(snap.active_stage).toBeDefined();
    expect(snap.window).toBeDefined();
    expect(snap.mode).toBeDefined();
    expect(snap.forced_disciplines).toBeDefined();
    expect(snap.next_handoff).toBeDefined();
    expect(snap.decision_owner).toBeDefined();
  });

  it("json snapshot is identical to input state (no mutation)", () => {
    const state = enter("run_inspect", traceWindow, "M1", traceDisciplines);
    const output = inspectState(state);
    expect(output.json).toBe(state); // same reference — pure function
  });

  it("is pure — same input produces same output", () => {
    const state = enter("run_inspect", traceWindow, "M1", traceDisciplines);
    const out1 = inspectState(state);
    const out2 = inspectState(state);
    // Both calls return same json reference (pure — no side effects)
    expect(out2.json).toBe(out1.json);
    expect(out1.human).toBe(out2.human);
  });

  it("human output contains run_id, active_stage, window, mode, next_handoff, decision_owner", () => {
    const state = enter("run_inspect_001", traceWindow, "M1", traceDisciplines);
    const output = inspectState(state);
    expect(output.human).toContain("run_inspect_001");
    expect(output.human).toContain("analysis-discovery");
    expect(output.human).toContain("design-ux");
    expect(output.human).toContain("M1");
    expect(output.human).toContain("specification"); // next_handoff
    expect(output.human).toContain("agent"); // decision_owner
  });

  it("human output shows BLOCKED status when blocked", () => {
    const state = enter("run_001", traceWindow, "M1", traceDisciplines);
    const blocked = hardSkip(state, "HARD_SKIP", "missing evidence");
    const output = inspectState(blocked);
    expect(output.human).toContain("BLOCKED");
    expect(output.human).toContain("HARD_SKIP");
  });

  it("human output shows FINALIZED when active_stage = END", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const r3 = advance(r2.state, traceDisciplines);
    expect(r3.ok).toBe(true);
    if (!r3.ok) throw new Error("unreachable");
    const output = inspectState(r3.state);
    expect(output.human).toContain("FINALIZED");
  });

  it("human output shows next_handoff = — when null (finalized)", () => {
    const s0 = enter("run_001", traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const r3 = advance(r2.state, traceDisciplines);
    expect(r3.ok).toBe(true);
    if (!r3.ok) throw new Error("unreachable");
    const output = inspectState(r3.state);
    expect(output.human).toContain("—"); // next_handoff rendered as —
  });
});

// ─── (5) Worked trace — state-machine.md §5, literal expected values ─────────

describe("worked trace (state-machine.md §5)", () => {
  const RUN_ID = "run_20260517143000";

  it("T0 — enter(): seeds expected literal values", () => {
    const s0 = enter(RUN_ID, traceWindow, "M1", traceDisciplines);

    expect(s0.run_id).toBe("run_20260517143000");
    expect(s0.active_stage).toBe("analysis-discovery");
    expect(s0.window).toEqual({ start: "analysis-discovery", stop: "design-ux" });
    expect(s0.mode).toBe("M1");
    expect(s0.forced_disciplines).toEqual([
      "competitor-benchmark",
      "assumption-log",
      "discovery-gate-matrix",
    ]);
    expect(s0.completed_stages).toEqual([]);
    expect(s0.next_handoff).toBe("specification");
    expect(s0.decision_owner).toBe("agent");
    expect(s0.blocked).toBe(false);
    expect(s0.blocker).toBeUndefined();
  });

  it("T1 — advance() from analysis-discovery: moves to specification", () => {
    const s0 = enter(RUN_ID, traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);

    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const s1 = r1.state;

    expect(s1.run_id).toBe("run_20260517143000");
    expect(s1.active_stage).toBe("specification");
    expect(s1.window).toEqual({ start: "analysis-discovery", stop: "design-ux" });
    expect(s1.mode).toBe("M1");
    expect(s1.forced_disciplines).toEqual(["acceptance-criteria", "non-functional-requirements"]);
    expect(s1.completed_stages).toEqual(["analysis-discovery"]);
    expect(s1.next_handoff).toBe("design-ux");
    expect(s1.decision_owner).toBe("agent");
    expect(s1.blocked).toBe(false);
  });

  it("T2 — advance() from specification: moves to design-ux, next_handoff = END", () => {
    const s0 = enter(RUN_ID, traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);

    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const s2 = r2.state;

    expect(s2.run_id).toBe("run_20260517143000");
    expect(s2.active_stage).toBe("design-ux");
    expect(s2.window).toEqual({ start: "analysis-discovery", stop: "design-ux" });
    expect(s2.mode).toBe("M1");
    expect(s2.forced_disciplines).toEqual(["WCAG-2.2", "dark-pattern-check", "wireframe-coverage"]);
    expect(s2.completed_stages).toEqual(["analysis-discovery", "specification"]);
    expect(s2.next_handoff).toBe("END");
    expect(s2.decision_owner).toBe("agent");
    expect(s2.blocked).toBe(false);
  });

  it("T3 — advance() from design-ux (window.stop): finalizes to END", () => {
    const s0 = enter(RUN_ID, traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const r3 = advance(r2.state, traceDisciplines);

    expect(r3.ok).toBe(true);
    if (!r3.ok) throw new Error("unreachable");
    const s3 = r3.state;

    expect(s3.run_id).toBe("run_20260517143000");
    expect(s3.active_stage).toBe("END");
    expect(s3.window).toEqual({ start: "analysis-discovery", stop: "design-ux" });
    expect(s3.mode).toBe("M1");
    expect(s3.forced_disciplines).toEqual([]);
    expect(s3.completed_stages).toEqual(["analysis-discovery", "specification", "design-ux"]);
    expect(s3.next_handoff).toBeNull();
    expect(s3.decision_owner).toBe("agent");
    expect(s3.blocked).toBe(false);
    expect(s3.blocker).toBeUndefined();
  });

  it("full trace: 3 stages complete in spine order, no over-run, END is terminal", () => {
    const s0 = enter(RUN_ID, traceWindow, "M1", traceDisciplines);
    const r1 = advance(s0, traceDisciplines);
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error("unreachable");
    const r2 = advance(r1.state, traceDisciplines);
    expect(r2.ok).toBe(true);
    if (!r2.ok) throw new Error("unreachable");
    const r3 = advance(r2.state, traceDisciplines);
    expect(r3.ok).toBe(true);
    if (!r3.ok) throw new Error("unreachable");

    // End-to-end consistency checks from state-machine.md §5
    expect(r3.state.completed_stages).toHaveLength(3);
    expect(r3.state.completed_stages[0]).toBe("analysis-discovery");
    expect(r3.state.completed_stages[1]).toBe("specification");
    expect(r3.state.completed_stages[2]).toBe("design-ux");
    expect(r3.state.active_stage).toBe("END");
    expect(r3.state.next_handoff).toBeNull();

    // No further advance possible — already at END with next_handoff = null
    const r4 = advance(r3.state, traceDisciplines);
    // advance from END: next_handoff is null → target = "END" → returns finalized state ok:true
    // but active_stage stays END with no new completed stages added (re-finalize is idempotent)
    expect(r4.state.active_stage).toBe("END");
  });
});
