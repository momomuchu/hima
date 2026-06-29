/**
 * Tests for gates-core/evaluate-gate.ts — evaluateGate() aggregator.
 *
 * Scenarios:
 *  1. Empty behavior list → allow
 *  2. Single blocking behavior → block + forceIntent from block path
 *  3. Single warning behavior → warn
 *  4. Single allowing behavior → allow
 *  5. Mixed: one block + one warn → block (block wins)
 *  6. Mixed: one warn + one allow → warn
 *  7. Behavior that throws → treated as allow, does not propagate
 *  8. Behavior not applicable to the gate type → skipped → allow
 *  9. Block with violationType DONE_WITHOUT_EVIDENCE → DeferredBlock forceIntent
 * 10. Block without violationType → no forceIntent (pickAttack decides)
 */

import { describe, it, expect } from "vitest";
import { evaluateGate } from "../src/gates-core/evaluate-gate.js";
import type { BehaviorContext, BehaviorDescriptor } from "../src/behavior-core/types.js";
import type { GateEvent } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStopEvent(): GateEvent {
  return { gateType: "stop" };
}

function makePreToolEvent(): GateEvent {
  return { gateType: "pre_tool", toolName: "Write" };
}

function makeCtx(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
  return {
    event: makeStopEvent(),
    riskClass: "H",
    root: "/tmp/test-root",
    ward: null,
    agentOutput: "DONE_VERIFIED",
    ...overrides,
  };
}

function allowDescriptor(id = "test-allow"): BehaviorDescriptor {
  return {
    id,
    gates: ["stop"],
    evaluate: () => ({ decision: "allow", reason: "all good", behaviorId: id }),
  };
}

function warnDescriptor(id = "test-warn"): BehaviorDescriptor {
  return {
    id,
    gates: ["stop"],
    evaluate: () => ({
      decision: "warn",
      reason: "advisory: check your work",
      behaviorId: id,
    }),
  };
}

function blockDescriptor(
  id = "test-block",
  violationType?: string,
): BehaviorDescriptor {
  return {
    id,
    gates: ["stop"],
    evaluate: () => ({
      decision: "block",
      reason: "blocked by policy",
      behaviorId: id,
      violationType,
    }),
  };
}

function throwingDescriptor(id = "test-throw"): BehaviorDescriptor {
  return {
    id,
    gates: ["stop"],
    evaluate: () => {
      throw new Error("descriptor exploded");
    },
  };
}

function preToolDescriptor(id = "test-pre-tool"): BehaviorDescriptor {
  return {
    id,
    gates: ["pre_tool"],
    evaluate: () => ({ decision: "block", reason: "pre_tool block", behaviorId: id }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluateGate", () => {
  it("1. empty behavior list → allow", async () => {
    const result = await evaluateGate([], makeCtx());
    expect(result.decision).toBe("allow");
  });

  it("2. single blocking behavior → block", async () => {
    const result = await evaluateGate([blockDescriptor()], makeCtx());
    expect(result.decision).toBe("block");
    expect(result.reason).toBe("blocked by policy");
  });

  it("3. single warning behavior → warn", async () => {
    const result = await evaluateGate([warnDescriptor()], makeCtx());
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("advisory");
  });

  it("4. single allowing behavior → allow", async () => {
    const result = await evaluateGate([allowDescriptor()], makeCtx());
    expect(result.decision).toBe("allow");
  });

  it("5. block + warn → block (block wins)", async () => {
    const result = await evaluateGate(
      [blockDescriptor("b1"), warnDescriptor("w1")],
      makeCtx(),
    );
    expect(result.decision).toBe("block");
  });

  it("6. warn + allow → warn", async () => {
    const result = await evaluateGate(
      [warnDescriptor("w1"), allowDescriptor("a1")],
      makeCtx(),
    );
    expect(result.decision).toBe("warn");
  });

  it("7. throwing behavior → treated as allow, does not propagate", async () => {
    await expect(
      evaluateGate([throwingDescriptor()], makeCtx()),
    ).resolves.toMatchObject({ decision: "allow" });
  });

  it("8. behavior registered for pre_tool, event is stop → skipped → allow", async () => {
    // The preToolDescriptor only covers "pre_tool", so it should be skipped
    // when the event is "stop".
    const result = await evaluateGate([preToolDescriptor()], makeCtx({ event: makeStopEvent() }));
    expect(result.decision).toBe("allow");
  });

  it("9. block with DONE_WITHOUT_EVIDENCE → DeferredBlock forceIntent attached", async () => {
    const result = await evaluateGate(
      [blockDescriptor("bev", "DONE_WITHOUT_EVIDENCE")],
      makeCtx(),
    );
    expect(result.decision).toBe("block");
    expect(result.forceIntent).toBeDefined();
    expect(result.forceIntent?.kind).toBe("DeferredBlock");
  });

  it("10. block without violationType → no forceIntent (pickAttack decides)", async () => {
    const result = await evaluateGate(
      [blockDescriptor("bev")],
      makeCtx(),
    );
    expect(result.decision).toBe("block");
    expect(result.forceIntent).toBeUndefined();
  });

  it("11. async behavior is awaited correctly", async () => {
    const asyncAllow: BehaviorDescriptor = {
      id: "async-allow",
      gates: ["stop"],
      evaluate: () =>
        Promise.resolve({ decision: "allow", reason: "async ok", behaviorId: "async-allow" }),
    };
    const result = await evaluateGate([asyncAllow], makeCtx());
    expect(result.decision).toBe("allow");
  });

  it("12. multiple allows → combined reason in allow", async () => {
    const result = await evaluateGate(
      [allowDescriptor("a1"), allowDescriptor("a2")],
      makeCtx(),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("all good");
  });
});
