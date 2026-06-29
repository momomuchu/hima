/**
 * Tests for behavior-core/beh-spec-gate.ts — BEH_SPEC_GATE advisory.
 *
 * Mandated scenarios (per R-024):
 *  A. "implement the auth flow" at M → warn (impl intent, no spec ref, M risk)
 *  B. "implement per docs/specs/auth.spec.md" → allow (spec reference present)
 *  C. "what is auth?" → allow (no implementation intent)
 *  D. "implement the auth flow" at T → allow (risk class below M)
 *
 * Risk class coverage:
 *  E. impl intent at H → warn
 *  F. impl intent at C → warn
 *  G. impl intent at L → allow (below M floor)
 *
 * Spec reference variants:
 *  H. prompt contains ".spec.md" → allow (file extension reference)
 *  I. prompt contains "docs/specs" → allow (directory path reference)
 *  J. prompt contains "\bspec\b" (standalone word) → allow (word reference)
 *
 * Implementation verb coverage:
 *  K. "build the auth service" at M → warn (build verb)
 *  L. "write the component" at M → warn (write the + component)
 *  M. "add the route handler" at M → warn (add the + handler)
 *  N. "create the migration" at M → warn (create the + migration)
 *  O. "code the validator" at M → warn (code verb)
 *
 * Code noun absence (impl verb present, no code noun → allow):
 *  P. "build the report" at M → allow (non-code noun "report")
 *  Q. "write the essay" at M → allow (non-code noun "essay")
 *
 * promptContent edge cases:
 *  R. promptContent is undefined → allow (no intent detectable)
 *  S. promptContent is empty string → allow (no intent detectable)
 *
 * Advisory constraint:
 *  T. warn verdict never carries a violationType
 *  U. decision is always "warn" or "allow", never "block"
 *
 * hasImplIntent unit tests (exported helper):
 *  V.  "implement the auth flow" → true
 *  W.  "build the authentication service" → true
 *  X.  "write the component" → true
 *  Y.  "what is auth?" → false (no impl verb)
 *  Z.  "the flow is ready" → false (no impl verb)
 *  AA. "build the house" → false (non-code noun)
 *  AB. "write the essay" → false (non-code noun)
 *  AC. "add the new route" → true (add the + route)
 *  AD. "create the migration" → true (create the + migration)
 *  AE. "code the validator" → true (code verb + validator)
 *
 * hasSpecRef unit tests (exported helper):
 *  AF. "per docs/specs/auth.spec.md" → true (.spec.md)
 *  AG. "see docs/specs/auth.md" → true (docs/specs)
 *  AH. "per spec" → true (\bspec\b)
 *  AI. "the spec file" → true (\bspec\b)
 *  AJ. "specific details" → false ("specific" does not match \bspec\b)
 *  AK. "inspect the code" → false ("inspect" does not match \bspec\b)
 *  AL. empty string → false
 *
 * Descriptor contract:
 *  AM. gates = ["user_prompt"]
 *  AN. id = "BEH-SPEC-GATE"
 */

import { describe, it, expect } from "vitest";
import {
  BEH_SPEC_GATE,
  hasImplIntent,
  hasSpecRef,
} from "../src/behavior-core/beh-spec-gate.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Evaluate the descriptor synchronously (it never returns a Promise). */
function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_SPEC_GATE.evaluate(ctx) as BehaviorVerdict;
}

/**
 * Build a BehaviorContext for the given scenario.
 *
 * Defaults: empty prompt, no ward, M risk class.
 */
function makeCtx(overrides: {
  prompt?: string;
  riskClass?: RiskClass;
} = {}): BehaviorContext {
  return {
    event: {
      gateType: "user_prompt",
      promptContent: overrides.prompt,
    },
    riskClass: overrides.riskClass ?? "M",
    root: "/tmp/test-project",
    ward: null,
  };
}

// ---------------------------------------------------------------------------
// Mandated scenarios (R-024)
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — mandated scenarios", () => {
  it("A. 'implement the auth flow' at M → warn (impl intent, no spec ref)", () => {
    const result = evaluate(makeCtx({ prompt: "implement the auth flow", riskClass: "M" }));
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-SPEC-GATE");
    expect(result.reason).toMatch(/\[BEH-SPEC-GATE\]/);
    expect(result.reason).toMatch(/implementation requested at M/);
    expect(result.reason).toMatch(/corpus-spec-driven-development/);
  });

  it("B. 'implement per docs/specs/auth.spec.md' → allow (spec reference present)", () => {
    const result = evaluate(makeCtx({
      prompt: "implement per docs/specs/auth.spec.md",
      riskClass: "M",
    }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SPEC-GATE");
    expect(result.reason).toMatch(/spec reference detected/);
  });

  it("C. 'what is auth?' → allow (no implementation intent)", () => {
    const result = evaluate(makeCtx({ prompt: "what is auth?", riskClass: "M" }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SPEC-GATE");
    expect(result.reason).toMatch(/no implementation intent/);
  });

  it("D. 'implement the auth flow' at T → allow (risk class below M)", () => {
    const result = evaluate(makeCtx({ prompt: "implement the auth flow", riskClass: "T" }));
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-SPEC-GATE");
    expect(result.reason).toMatch(/below M/);
  });
});

// ---------------------------------------------------------------------------
// Risk class coverage
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — risk class coverage", () => {
  const warnPrompt = "implement the auth flow";

  it("E. impl intent at H → warn", () => {
    const result = evaluate(makeCtx({ prompt: warnPrompt, riskClass: "H" }));
    expect(result.decision).toBe("warn");
    expect(result.reason).toMatch(/implementation requested at H/);
  });

  it("F. impl intent at C → warn", () => {
    const result = evaluate(makeCtx({ prompt: warnPrompt, riskClass: "C" }));
    expect(result.decision).toBe("warn");
    expect(result.reason).toMatch(/implementation requested at C/);
  });

  it("G. impl intent at L → allow (below M floor)", () => {
    const result = evaluate(makeCtx({ prompt: warnPrompt, riskClass: "L" }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });
});

// ---------------------------------------------------------------------------
// Spec reference variants
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — spec reference variants", () => {
  it("H. prompt contains '.spec.md' → allow", () => {
    const result = evaluate(makeCtx({
      prompt: "implement the auth.spec.md feature",
      riskClass: "M",
    }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/spec reference detected/);
  });

  it("I. prompt contains 'docs/specs' → allow", () => {
    const result = evaluate(makeCtx({
      prompt: "implement the flow in docs/specs/flow.md",
      riskClass: "M",
    }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/spec reference detected/);
  });

  it("J. prompt contains standalone 'spec' word → allow", () => {
    const result = evaluate(makeCtx({
      prompt: "implement the auth flow per spec",
      riskClass: "M",
    }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/spec reference detected/);
  });
});

// ---------------------------------------------------------------------------
// Implementation verb coverage
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — implementation verb coverage", () => {
  it("K. 'build the auth service' at M → warn", () => {
    const result = evaluate(makeCtx({ prompt: "build the auth service", riskClass: "M" }));
    expect(result.decision).toBe("warn");
  });

  it("L. 'write the component' at M → warn", () => {
    const result = evaluate(makeCtx({ prompt: "write the component for onboarding", riskClass: "M" }));
    expect(result.decision).toBe("warn");
  });

  it("M. 'add the route handler' at M → warn", () => {
    const result = evaluate(makeCtx({ prompt: "add the route handler for login", riskClass: "M" }));
    expect(result.decision).toBe("warn");
  });

  it("N. 'create the migration' at M → warn", () => {
    const result = evaluate(makeCtx({ prompt: "create the migration for user table", riskClass: "M" }));
    expect(result.decision).toBe("warn");
  });

  it("O. 'code the validator' at M → warn", () => {
    const result = evaluate(makeCtx({ prompt: "code the validator for email inputs", riskClass: "M" }));
    expect(result.decision).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Code noun absence (impl verb without code noun → allow)
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — non-code noun exclusion", () => {
  it("P. 'build the report' at M → allow (non-code noun)", () => {
    const result = evaluate(makeCtx({ prompt: "build the report for Q3 results", riskClass: "M" }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no implementation intent/);
  });

  it("Q. 'write the essay' at M → allow (non-code noun)", () => {
    const result = evaluate(makeCtx({ prompt: "write the essay about architecture", riskClass: "M" }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no implementation intent/);
  });
});

// ---------------------------------------------------------------------------
// promptContent edge cases
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — promptContent edge cases", () => {
  it("R. promptContent is undefined → allow (no intent detectable)", () => {
    const result = evaluate({
      event: { gateType: "user_prompt" },
      riskClass: "M",
      root: "/tmp/test-project",
      ward: null,
    });
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no implementation intent/);
  });

  it("S. promptContent is empty string → allow (no intent detectable)", () => {
    const result = evaluate(makeCtx({ prompt: "", riskClass: "M" }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no implementation intent/);
  });
});

// ---------------------------------------------------------------------------
// Advisory constraint — never block
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — advisory constraint", () => {
  it("T. warn verdict never carries a violationType", () => {
    const result = evaluate(makeCtx({ prompt: "implement the auth flow", riskClass: "M" }));
    expect(result.decision).toBe("warn");
    expect(result.violationType).toBeUndefined();
  });

  it("U. decision is always 'warn' or 'allow', never 'block'", () => {
    const prompts = [
      "implement the auth flow",
      "build the service",
      "what is auth?",
      "implement per spec",
    ];
    const riskClasses: RiskClass[] = ["T", "L", "M", "H", "C"];
    for (const prompt of prompts) {
      for (const riskClass of riskClasses) {
        const result = evaluate(makeCtx({ prompt, riskClass }));
        expect(result.decision).not.toBe("block");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// hasImplIntent unit tests
// ---------------------------------------------------------------------------

describe("hasImplIntent", () => {
  it("V. 'implement the auth flow' → true", () => {
    expect(hasImplIntent("implement the auth flow")).toBe(true);
  });

  it("W. 'build the authentication service' → true", () => {
    expect(hasImplIntent("build the authentication service")).toBe(true);
  });

  it("X. 'write the component for the dashboard' → true", () => {
    expect(hasImplIntent("write the component for the dashboard")).toBe(true);
  });

  it("Y. 'what is auth?' → false (no impl verb)", () => {
    expect(hasImplIntent("what is auth?")).toBe(false);
  });

  it("Z. 'the flow is ready' → false (no impl verb)", () => {
    expect(hasImplIntent("the flow is ready")).toBe(false);
  });

  it("AA. 'build the house' → false (non-code noun)", () => {
    expect(hasImplIntent("build the house")).toBe(false);
  });

  it("AB. 'write the essay' → false (non-code noun)", () => {
    expect(hasImplIntent("write the essay")).toBe(false);
  });

  it("AC. 'add the new route' → true (add the + route)", () => {
    expect(hasImplIntent("add the new route")).toBe(true);
  });

  it("AD. 'create the migration' → true (create the + migration)", () => {
    expect(hasImplIntent("create the migration")).toBe(true);
  });

  it("AE. 'code the validator' → true (code verb + validator)", () => {
    expect(hasImplIntent("code the validator")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasSpecRef unit tests
// ---------------------------------------------------------------------------

describe("hasSpecRef", () => {
  it("AF. 'per docs/specs/auth.spec.md' → true (.spec.md)", () => {
    expect(hasSpecRef("per docs/specs/auth.spec.md")).toBe(true);
  });

  it("AG. 'see docs/specs/auth.md' → true (docs/specs path)", () => {
    expect(hasSpecRef("see docs/specs/auth.md")).toBe(true);
  });

  it("AH. 'per spec' → true (standalone spec word)", () => {
    expect(hasSpecRef("per spec")).toBe(true);
  });

  it("AI. 'the spec file' → true (standalone spec word)", () => {
    expect(hasSpecRef("the spec file")).toBe(true);
  });

  it("AJ. 'specific details' → false (specific is not standalone spec)", () => {
    expect(hasSpecRef("specific details")).toBe(false);
  });

  it("AK. 'inspect the code' → false (inspect does not contain standalone spec)", () => {
    expect(hasSpecRef("inspect the code")).toBe(false);
  });

  it("AL. empty string → false", () => {
    expect(hasSpecRef("")).toBe(false);
  });

  it("auth.spec.md extension match (no path prefix)", () => {
    expect(hasSpecRef("implement auth.spec.md behavior")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Descriptor contract
// ---------------------------------------------------------------------------

describe("BEH_SPEC_GATE — descriptor contract", () => {
  it("AM. gates = ['user_prompt']", () => {
    expect(BEH_SPEC_GATE.gates).toEqual(["user_prompt"]);
    expect(BEH_SPEC_GATE.gates).not.toContain("pre_tool");
    expect(BEH_SPEC_GATE.gates).not.toContain("stop");
  });

  it("AN. id = 'BEH-SPEC-GATE'", () => {
    expect(BEH_SPEC_GATE.id).toBe("BEH-SPEC-GATE");
  });
});
