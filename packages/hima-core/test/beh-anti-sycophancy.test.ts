/**
 * Tests for behavior-core/beh-anti-sycophancy.ts — BEH_ANTI_SYCOPHANCY gate.
 *
 * Mandated scenarios (per R-022):
 *  A. "absolutely, great idea" at M → warn (signals detected at M+)
 *  B. No sycophancy signal at M → allow
 *  C. "absolutely" at T → allow (below enforcement floor)
 *  D. "you are right" at M → warn
 *  E. "exactly right" at H → warn
 *  F. Empty agentOutput at M → allow
 *  G. Undefined agentOutput at M → allow
 *  H. Signal at L → allow (below enforcement floor)
 *  I. Signal at C → warn (M+ floor)
 *  J. No signal, long output, at H → allow
 *
 * Descriptor contract:
 *  K. descriptor gates = ["post_tool"]
 *  L. descriptor id = "BEH-ANTI-SYCOPHANCY"
 *  M. decision is never "block" (advisory only)
 *
 * Reason string contract:
 *  N. warn reason includes "[BEH-ANTI-SYCOPHANCY]"
 *  O. warn reason includes "competing hypothesis"
 */

import { describe, it, expect } from "vitest";
import { BEH_ANTI_SYCOPHANCY } from "../src/behavior-core/beh-anti-sycophancy.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Evaluate the descriptor synchronously (it never returns a Promise). */
function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_ANTI_SYCOPHANCY.evaluate(ctx) as BehaviorVerdict;
}

/**
 * Build a minimal BehaviorContext for anti-sycophancy tests.
 * agentOutput defaults to undefined (absent); riskClass defaults to "M".
 */
function makeCtx(
  options: {
    agentOutput?: string;
    riskClass?: RiskClass;
  } = {},
): BehaviorContext {
  return {
    event: {
      gateType: "post_tool",
    },
    riskClass: options.riskClass ?? "M",
    root: "/tmp/test-project",
    agentOutput: options.agentOutput,
  };
}

// ---------------------------------------------------------------------------
// Mandated scenarios
// ---------------------------------------------------------------------------

describe("BEH_ANTI_SYCOPHANCY — mandated scenarios", () => {
  it("A. 'absolutely, great idea' at M → warn (signals detected at M+)", () => {
    const ctx = makeCtx({ agentOutput: "absolutely, great idea! Let's proceed." });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-ANTI-SYCOPHANCY");
  });

  it("B. No sycophancy signal at M → allow", () => {
    const ctx = makeCtx({
      agentOutput:
        "The proposed approach has merit, but consider an alternative: instead of X, Y might reduce latency.",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("C. 'absolutely' at T → allow (below enforcement floor)", () => {
    const ctx = makeCtx({ agentOutput: "Absolutely!", riskClass: "T" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });

  it("D. 'you are right' at M → warn", () => {
    const ctx = makeCtx({ agentOutput: "You are right, this is the best approach." });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("E. 'exactly right' at H → warn", () => {
    const ctx = makeCtx({
      agentOutput: "Exactly right — we should proceed immediately.",
      riskClass: "H",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("F. Empty agentOutput at M → allow", () => {
    const ctx = makeCtx({ agentOutput: "" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no agent output/);
  });

  it("G. Undefined agentOutput at M → allow", () => {
    const ctx = makeCtx({ agentOutput: undefined });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no agent output/);
  });

  it("H. Signal at L → allow (below enforcement floor)", () => {
    const ctx = makeCtx({ agentOutput: "Great idea, let's do it.", riskClass: "L" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });

  it("I. Signal at C → warn (M+ floor)", () => {
    const ctx = makeCtx({
      agentOutput: "Absolutely, this is the correct architecture.",
      riskClass: "C",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("J. No signal, long output, at H → allow", () => {
    const ctx = makeCtx({
      agentOutput:
        "There are two competing approaches here. Option A reduces coupling at the cost of " +
        "additional indirection; Option B keeps things simple but ties the modules tightly. " +
        "Given your constraint on testability, Option A seems preferable — but Option B has " +
        "lower upfront complexity. I recommend Option A with the caveat that integration tests " +
        "will be required to validate the seam.",
      riskClass: "H",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });
});

// ---------------------------------------------------------------------------
// Descriptor contract
// ---------------------------------------------------------------------------

describe("BEH_ANTI_SYCOPHANCY — descriptor contract", () => {
  it("K. descriptor gates = ['post_tool']", () => {
    expect(BEH_ANTI_SYCOPHANCY.gates).toEqual(["post_tool"]);
  });

  it("L. descriptor id = 'BEH-ANTI-SYCOPHANCY'", () => {
    expect(BEH_ANTI_SYCOPHANCY.id).toBe("BEH-ANTI-SYCOPHANCY");
  });

  it("M. decision is never 'block' (advisory only)", () => {
    // Even with a strong signal at C, the behavior is warn-only.
    const ctx = makeCtx({
      agentOutput: "Absolutely! Great idea! You are right! Exactly right!",
      riskClass: "C",
    });
    const result = evaluate(ctx);
    expect(result.decision).not.toBe("block");
  });
});

// ---------------------------------------------------------------------------
// Reason string contract
// ---------------------------------------------------------------------------

describe("BEH_ANTI_SYCOPHANCY — reason string", () => {
  it("N. warn reason includes '[BEH-ANTI-SYCOPHANCY]'", () => {
    const ctx = makeCtx({ agentOutput: "Absolutely!", riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("[BEH-ANTI-SYCOPHANCY]");
  });

  it("O. warn reason includes 'competing hypothesis'", () => {
    const ctx = makeCtx({ agentOutput: "Great idea.", riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toMatch(/competing hypothesis/);
  });
});

// ---------------------------------------------------------------------------
// Case-insensitivity
// ---------------------------------------------------------------------------

describe("BEH_ANTI_SYCOPHANCY — case-insensitive matching", () => {
  it("'ABSOLUTELY' (uppercase) at M → warn", () => {
    const ctx = makeCtx({ agentOutput: "ABSOLUTELY, let's proceed.", riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("'Great Idea' (title case) at M → warn", () => {
    const ctx = makeCtx({ agentOutput: "Great Idea, I like it.", riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("'You Are Right' (mixed case) at M → warn", () => {
    const ctx = makeCtx({ agentOutput: "You Are Right about this.", riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Whitespace-only agentOutput
// ---------------------------------------------------------------------------

describe("BEH_ANTI_SYCOPHANCY — whitespace-only output", () => {
  it("agentOutput is only whitespace at M → allow (treated as absent)", () => {
    const ctx = makeCtx({ agentOutput: "   \t\n  ", riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no agent output/);
  });
});
