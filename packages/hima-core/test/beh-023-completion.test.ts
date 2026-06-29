/**
 * Tests for behavior-core/beh-023-completion.ts — BEH_023 completion gate.
 *
 * Mandated scenarios (per R-005 spec):
 *  A. "DONE_VERIFIED" output at H with no ward evidence → block (DONE_WITHOUT_EVIDENCE)
 *  B. "DONE_VERIFIED" output at H with done-verified verdict in ward → allow
 *  C. "DONE_VERIFIED" output at T risk class → warn (not block)
 *
 * Additional scenarios:
 *  D. No completion claim in output → allow
 *  E. Empty agentOutput → allow
 *  F. Completion claim at M with no ward → block
 *  G. Completion claim at C with no ward → block
 *  H. Completion claim at L → warn
 *  I. Completion claim at H, ward has "done" (not "done-verified") → block
 *  J. Completion claim at H, ward has "done-validated" → allow
 *  K. "MASTERED" lexeme → detected
 *  L. "finished" (lowercase) lexeme → detected
 *  M. "shipped" lexeme → detected
 *  N. No ward at M → block (no evidence possible)
 *  O. Null/undefined agentOutput → allow
 */

import { describe, it, expect } from "vitest";
import { BEH_023 } from "../src/behavior-core/beh-023-completion.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { Ward, StageVerdict, RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWard(verdicts: StageVerdict[] = []): Ward {
  return {
    id: "test-ward-001",
    entryPoint: "full",
    floor: "H",
    openStage: "spec",
    skillRegister: [],
    verdicts,
  };
}

function makeVerdict(status: StageVerdict["status"]): StageVerdict {
  return {
    stage: "spec",
    status,
    evidence: ["test evidence"],
  };
}

function makeCtx(
  overrides: Partial<BehaviorContext> & { riskClass?: RiskClass } = {},
): BehaviorContext {
  return {
    event: { gateType: "stop" },
    riskClass: overrides.riskClass ?? "H",
    root: "/tmp/test-project",
    ward: overrides.ward !== undefined ? overrides.ward : null,
    agentOutput: overrides.agentOutput ?? "DONE_VERIFIED",
    ...overrides,
  };
}

/** Resolve synchronous or async evaluate() result. */
async function evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
  return BEH_023.evaluate(ctx);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BEH_023 — completion gate", () => {
  // --- Mandated scenarios ---

  it("A. DONE_VERIFIED at H with no ward evidence → block with DONE_WITHOUT_EVIDENCE", async () => {
    const result = await evaluate(makeCtx({ riskClass: "H", ward: makeWard([]) }));
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-023");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("B. DONE_VERIFIED at H with done-verified verdict in ward → allow", async () => {
    const ward = makeWard([makeVerdict("done-verified")]);
    const result = await evaluate(makeCtx({ riskClass: "H", ward }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("C. DONE_VERIFIED output at T risk class → warn (not block)", async () => {
    const result = await evaluate(makeCtx({ riskClass: "T", agentOutput: "DONE_VERIFIED" }));
    expect(result.decision).toBe("warn");
    expect(result.decision).not.toBe("block");
    expect(result.behaviorId).toBe("BEH-023");
  });

  // --- Additional scenarios ---

  it("D. No completion claim → allow", async () => {
    const result = await evaluate(makeCtx({
      riskClass: "H",
      agentOutput: "Work is in progress. Reviewing the spec now.",
    }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("E. Empty agentOutput → allow", async () => {
    const result = await evaluate(makeCtx({ riskClass: "H", agentOutput: "" }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("F. Completion claim at M with no ward → block", async () => {
    const result = await evaluate(makeCtx({ riskClass: "M", ward: null }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("G. Completion claim at C with no ward → block", async () => {
    const result = await evaluate(makeCtx({ riskClass: "C", ward: null }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("H. Completion claim at L → warn", async () => {
    const result = await evaluate(makeCtx({ riskClass: "L", agentOutput: "Task complete." }));
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("I. Completion claim at H, ward has 'done' (not done-verified) → block", async () => {
    const ward = makeWard([makeVerdict("done")]);
    const result = await evaluate(makeCtx({ riskClass: "H", ward }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("J. Completion claim at H, ward has 'done-validated' → allow", async () => {
    const ward = makeWard([makeVerdict("done-validated")]);
    const result = await evaluate(makeCtx({ riskClass: "H", ward }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("K. MASTERED lexeme → detected, blocks at H with empty ward verdicts", async () => {
    const result = await evaluate(makeCtx({
      riskClass: "H",
      ward: makeWard([]),
      agentOutput: "The agent has MASTERED the task.",
    }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("L. finished (lowercase) lexeme → detected, warns at L", async () => {
    const result = await evaluate(makeCtx({
      riskClass: "L",
      agentOutput: "I have finished the research.",
    }));
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("M. shipped lexeme → detected, blocks at M with no ward", async () => {
    const result = await evaluate(makeCtx({
      riskClass: "M",
      ward: null,
      agentOutput: "Feature shipped.",
    }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("N. No ward at M with DONE → block (no evidence possible)", async () => {
    const result = await evaluate(makeCtx({ riskClass: "M", ward: null, agentOutput: "DONE" }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("O. Undefined agentOutput → allow", async () => {
    const result = await evaluate(makeCtx({ riskClass: "H", agentOutput: undefined }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-023");
  });

  it("descriptor is registered for the stop gate only", () => {
    expect(BEH_023.gates).toEqual(["stop"]);
    expect(BEH_023.gates).not.toContain("pre_tool");
    expect(BEH_023.gates).not.toContain("user_prompt");
  });

  it("behaviorId is BEH-023", () => {
    expect(BEH_023.id).toBe("BEH-023");
  });
});
