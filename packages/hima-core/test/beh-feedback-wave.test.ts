/**
 * Tests for behavior-core/beh-feedback-wave.ts — BEH_FEEDBACK_WAVE advisory.
 *
 * Mandated scenarios (per R-016):
 *  A. "la landing est cassée, refais le" at H → warn
 *  B. neutral prompt at H → allow (no evaluative language)
 *  C. artifact + evaluative language at M → allow (risk below H)
 *  D. evaluative language only, no artifact token, at H → allow
 *  E. artifact token only, no evaluative language, at H → allow
 *
 * Risk class coverage:
 *  F. H → warn (meets floor)
 *  G. C → warn (above floor)
 *  H. M → allow (below H floor)
 *  I. L → allow (below H floor)
 *  J. T → allow (below H floor)
 *
 * promptContent edge cases:
 *  K. promptContent undefined → allow
 *  L. promptContent empty string → allow
 *
 * Token matching (case-insensitive + partial/substring):
 *  M. "La Landing" (uppercase) at H → warn (case-insensitive)
 *  N. "cassée" matches token "cassé" (partial match) at H → warn
 *  O. "refais" does NOT match token "refaire" → not evaluative alone
 *  P. multi-token prompt with several artifact and evaluative hits → warn
 *
 * Advisory constraint:
 *  Q. warn verdict never carries a violationType
 *  R. decision is always "warn" or "allow", never "block"
 *
 * Reason format:
 *  S. warn reason contains "[BEH-FEEDBACK-WAVE]"
 *  T. warn reason mentions the matched artifact token
 *  U. warn reason mentions the matched evaluative token
 *  V. allow reason on no-artifact hit contains "[founder-feedback-scale] evaluated — NOT triggered"
 *  W. allow reason on no-evaluative hit contains "[founder-feedback-scale] evaluated — NOT triggered"
 *
 * findArtifactToken unit tests:
 *  X. "la landing est cassée" → "la landing"
 *  Y. "ce code est broken" → "ce code"
 *  Z. "hello world" → null
 *
 * findEvaluativeToken unit tests:
 *  AA. "c'est cassé" → "cassé"
 *  AB. "it is broken" → "broken"
 *  AC. "everything looks fine" → null
 *
 * Exported token list contract:
 *  AD. ARTIFACT_TOKENS is a non-empty readonly array
 *  AE. EVALUATIVE_TOKENS is a non-empty readonly array
 *  AF. ARTIFACT_TOKENS includes "la landing"
 *  AG. EVALUATIVE_TOKENS includes "cassé"
 *
 * Descriptor contract:
 *  AH. gates = ["user_prompt"]
 *  AI. id = "BEH-FEEDBACK-WAVE"
 *
 * Path 2 fallback (R-016):
 *  AJ. ≥2 evaluative tokens + ward present → warn (path:fallback)
 *  AK. ≥2 evaluative tokens, no ward → allow (NOT triggered)
 *  AL. 1 evaluative token + ward → allow (insufficient: <2 for Path 2)
 *  AM. Path 2 warn reason contains "[BEH-FEEDBACK-WAVE]"
 *  AN. Path 2 warn reason contains "path:fallback"
 *  AO. Path 2 warn reason contains the ward openStage
 *
 * NOT-triggered reason contract (all allow paths):
 *  AP. below-H allow carries "[founder-feedback-scale] evaluated — NOT triggered"
 *  AQ. no-promptContent allow carries "[founder-feedback-scale] evaluated — NOT triggered"
 *  AR. no-artifact allow (no ward) carries "[founder-feedback-scale] evaluated — NOT triggered"
 *  AS. no-evaluative allow carries "[founder-feedback-scale] evaluated — NOT triggered"
 *
 * countEvaluativeTokens unit tests:
 *  AT. "trop lent et trop petit" → 2
 *  AU. "cassé et mauvais et raté" → 3
 *  AV. "everything looks fine" → 0
 *  AW. "trop lent" → 1
 */

import { describe, it, expect } from "vitest";
import {
  BEH_FEEDBACK_WAVE,
  ARTIFACT_TOKENS,
  EVALUATIVE_TOKENS,
  findArtifactToken,
  findEvaluativeToken,
  countEvaluativeTokens,
} from "../src/behavior-core/beh-feedback-wave.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { RiskClass, Ward } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Evaluate the descriptor synchronously (it never returns a Promise). */
function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_FEEDBACK_WAVE.evaluate(ctx) as BehaviorVerdict;
}

/** Minimal valid Ward for Path 2 tests. */
function makeWard(overrides: Partial<Ward> = {}): Ward {
  return {
    id: "ward-test-001",
    entryPoint: "full",
    floor: "M",
    openStage: "spec",
    skillRegister: [],
    verdicts: [],
    ...overrides,
  };
}

/** Build a BehaviorContext with specified promptContent, riskClass, and optional ward. */
function makeCtx(overrides: {
  promptContent?: string;
  riskClass?: RiskClass;
  useUndefinedPrompt?: true;
  ward?: Ward | null;
} = {}): BehaviorContext {
  return {
    event: {
      gateType: "user_prompt",
      ...(overrides.useUndefinedPrompt
        ? {}
        : { promptContent: overrides.promptContent ?? "neutral message" }),
    },
    riskClass: overrides.riskClass ?? "H",
    root: "/tmp/test-project",
    ...(overrides.ward !== undefined ? { ward: overrides.ward } : {}),
  };
}

// ---------------------------------------------------------------------------
// Mandated scenarios (R-016)
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — mandated scenarios", () => {
  it("A. 'la landing est cassée, refais le' at H → warn", () => {
    const ctx = makeCtx({ promptContent: "la landing est cassée, refais le" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-FEEDBACK-WAVE");
  });

  it("B. neutral prompt at H → allow (no evaluative language)", () => {
    const ctx = makeCtx({ promptContent: "la landing looks good, ship it" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("C. artifact + evaluative language at M → allow (risk below H)", () => {
    const ctx = makeCtx({
      promptContent: "la landing est cassée, refais le",
      riskClass: "M",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below H/);
  });

  it("D. evaluative language only, no artifact token, at H → allow", () => {
    const ctx = makeCtx({ promptContent: "c'est cassé, tout est mauvais" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/NOT triggered/);
  });

  it("E. artifact token only, no evaluative language, at H → allow", () => {
    const ctx = makeCtx({ promptContent: "la landing looks great, deploy it" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/NOT triggered/);
  });
});

// ---------------------------------------------------------------------------
// Risk class coverage
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — risk class coverage", () => {
  const BOTH_SIGNALS = "la landing est cassée et mauvaise";

  it("F. H → warn (meets H floor)", () => {
    const ctx = makeCtx({ promptContent: BOTH_SIGNALS, riskClass: "H" });
    expect(evaluate(ctx).decision).toBe("warn");
  });

  it("G. C → warn (above H floor)", () => {
    const ctx = makeCtx({ promptContent: BOTH_SIGNALS, riskClass: "C" });
    expect(evaluate(ctx).decision).toBe("warn");
  });

  it("H. M → allow (below H floor)", () => {
    const ctx = makeCtx({ promptContent: BOTH_SIGNALS, riskClass: "M" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below H/);
  });

  it("I. L → allow (below H floor)", () => {
    const ctx = makeCtx({ promptContent: BOTH_SIGNALS, riskClass: "L" });
    expect(evaluate(ctx).decision).toBe("allow");
  });

  it("J. T → allow (below H floor)", () => {
    const ctx = makeCtx({ promptContent: BOTH_SIGNALS, riskClass: "T" });
    expect(evaluate(ctx).decision).toBe("allow");
  });
});

// ---------------------------------------------------------------------------
// promptContent edge cases
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — promptContent edge cases", () => {
  it("K. promptContent undefined → allow", () => {
    const ctx = makeCtx({ useUndefinedPrompt: true });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no promptContent/);
  });

  it("L. promptContent empty string → allow", () => {
    const ctx = makeCtx({ promptContent: "" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no promptContent/);
  });
});

// ---------------------------------------------------------------------------
// Token matching edge cases
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — token matching", () => {
  it("M. 'La Landing' (uppercase) at H → warn (case-insensitive)", () => {
    const ctx = makeCtx({ promptContent: "La Landing est CASSÉE et MAUVAISE" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("N. 'cassée' matches token 'cassé' (partial match) at H → warn", () => {
    // 'cassée' = 'cassé' + 'e' → 'cassée'.includes('cassé') === true
    const ctx = makeCtx({ promptContent: "la landing est cassée" });
    // cassée matches cassé → evaluative token found
    // 'la landing' → artifact token found
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("O. 'refais' alone does NOT match evaluative token 'refaire'", () => {
    // 'refaire' is NOT a substring of 'refais'
    // So 'refais' without another evaluative token should not trigger
    const ctx = makeCtx({ promptContent: "la landing, refais le design" });
    // 'refais' does not include 'refaire' — need a different evaluative token
    // "le design" is not in EVALUATIVE_TOKENS → allow
    const result = evaluate(ctx);
    // 'la landing' → artifact found but no evaluative match
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/NOT triggered/);
  });

  it("P. multi-token prompt with several hits → warn", () => {
    const ctx = makeCtx({
      promptContent:
        "le dashboard et la landing sont cassés, le header est mauvais, refaire tout",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// Advisory constraint
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — advisory constraint", () => {
  it("Q. warn verdict never carries a violationType", () => {
    const ctx = makeCtx({ promptContent: "la landing est cassée" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.violationType).toBeUndefined();
  });

  it("R. decision is always 'warn' or 'allow', never 'block'", () => {
    const prompts = [
      "la landing est cassée, refais le",
      "neutral prompt with no signals",
      "ce code est broken",
      "",
    ];
    for (const promptContent of prompts) {
      const ctx = makeCtx({ promptContent });
      const result = evaluate(ctx);
      expect(["warn", "allow"]).toContain(result.decision);
      expect(result.decision).not.toBe("block");
    }
  });
});

// ---------------------------------------------------------------------------
// Reason format
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — reason format", () => {
  it("S. warn reason contains '[BEH-FEEDBACK-WAVE]'", () => {
    const ctx = makeCtx({ promptContent: "la landing est cassée, refais le" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("[BEH-FEEDBACK-WAVE]");
  });

  it("T. warn reason mentions the matched artifact token", () => {
    const ctx = makeCtx({ promptContent: "la landing est cassée, refais le" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("la landing");
  });

  it("U. warn reason mentions the matched evaluative token", () => {
    const ctx = makeCtx({ promptContent: "la landing est cassée, refais le" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("cassé");
  });

  it("V. allow on no-artifact hit reason contains NOT triggered", () => {
    const ctx = makeCtx({ promptContent: "tout est cassé et mauvais" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("NOT triggered");
  });

  it("W. allow on no-evaluative hit reason contains NOT triggered", () => {
    const ctx = makeCtx({ promptContent: "la landing looks great" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("NOT triggered");
  });
});

// ---------------------------------------------------------------------------
// findArtifactToken unit tests
// ---------------------------------------------------------------------------

describe("findArtifactToken", () => {
  it("X. 'la landing est cassée' → 'la landing'", () => {
    expect(findArtifactToken("la landing est cassée")).toBe("la landing");
  });

  it("Y. 'ce code est broken' → 'ce code'", () => {
    expect(findArtifactToken("ce code est broken")).toBe("ce code");
  });

  it("Z. 'hello world' → null", () => {
    expect(findArtifactToken("hello world")).toBeNull();
  });

  it("case-insensitive: 'CE CODE EST BROKEN' → 'ce code'", () => {
    expect(findArtifactToken("CE CODE EST BROKEN")).toBe("ce code");
  });

  it("'ce bug est critique' → 'ce bug'", () => {
    expect(findArtifactToken("ce bug est critique")).toBe("ce bug");
  });
});

// ---------------------------------------------------------------------------
// findEvaluativeToken unit tests
// ---------------------------------------------------------------------------

describe("findEvaluativeToken", () => {
  it("AA. 'c'est cassé' → 'cassé'", () => {
    expect(findEvaluativeToken("c'est cassé")).toBe("cassé");
  });

  it("AB. 'it is broken' → 'broken'", () => {
    expect(findEvaluativeToken("it is broken")).toBe("broken");
  });

  it("AC. 'everything looks fine' → null", () => {
    expect(findEvaluativeToken("everything looks fine")).toBeNull();
  });

  it("case-insensitive: 'IT IS BROKEN' → 'broken'", () => {
    expect(findEvaluativeToken("IT IS BROKEN")).toBe("broken");
  });

  it("'c'est cassée' → 'cassé' (substring match on accented feminine form)", () => {
    // 'cassée'.includes('cassé') === true since 'cassé' is a prefix of 'cassée'
    expect(findEvaluativeToken("c'est cassée")).toBe("cassé");
  });
});

// ---------------------------------------------------------------------------
// Exported token list contract
// ---------------------------------------------------------------------------

describe("exported token lists", () => {
  it("AD. ARTIFACT_TOKENS is a non-empty readonly array", () => {
    expect(Array.isArray(ARTIFACT_TOKENS)).toBe(true);
    expect(ARTIFACT_TOKENS.length).toBeGreaterThan(0);
  });

  it("AE. EVALUATIVE_TOKENS is a non-empty readonly array", () => {
    expect(Array.isArray(EVALUATIVE_TOKENS)).toBe(true);
    expect(EVALUATIVE_TOKENS.length).toBeGreaterThan(0);
  });

  it("AF. ARTIFACT_TOKENS includes 'la landing'", () => {
    expect(ARTIFACT_TOKENS).toContain("la landing");
  });

  it("AG. EVALUATIVE_TOKENS includes 'cassé'", () => {
    expect(EVALUATIVE_TOKENS).toContain("cassé");
  });
});

// ---------------------------------------------------------------------------
// Descriptor contract
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — descriptor contract", () => {
  it("AH. gates = ['user_prompt']", () => {
    expect(BEH_FEEDBACK_WAVE.gates).toEqual(["user_prompt"]);
  });

  it("AI. id = 'BEH-FEEDBACK-WAVE'", () => {
    expect(BEH_FEEDBACK_WAVE.id).toBe("BEH-FEEDBACK-WAVE");
  });
});

// ---------------------------------------------------------------------------
// Path 2 fallback (R-016)
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — Path 2 fallback", () => {
  // A prompt with ≥2 evaluative tokens and no artifact token.
  const TWO_NEGATIVES = "trop lent et trop petit";
  const THREE_NEGATIVES = "c'est cassé, c'est mauvais et raté";

  it("AJ. ≥2 evaluative tokens + ward present → warn (path:fallback)", () => {
    const ctx = makeCtx({ promptContent: TWO_NEGATIVES, ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-FEEDBACK-WAVE");
  });

  it("AK. ≥2 evaluative tokens, no ward → allow (NOT triggered)", () => {
    // ward absent (not set in ctx)
    const ctx = makeCtx({ promptContent: TWO_NEGATIVES });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("[founder-feedback-scale] evaluated — NOT triggered");
  });

  it("AK-null. ≥2 evaluative tokens, ward: null → allow (NOT triggered)", () => {
    const ctx = makeCtx({ promptContent: TWO_NEGATIVES, ward: null });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("[founder-feedback-scale] evaluated — NOT triggered");
  });

  it("AL. 1 evaluative token + ward → allow (insufficient for Path 2)", () => {
    const ctx = makeCtx({ promptContent: "trop lent", ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("[founder-feedback-scale] evaluated — NOT triggered");
  });

  it("AM. Path 2 warn reason contains '[BEH-FEEDBACK-WAVE]'", () => {
    const ctx = makeCtx({ promptContent: THREE_NEGATIVES, ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("[BEH-FEEDBACK-WAVE]");
  });

  it("AN. Path 2 warn reason contains 'path:fallback'", () => {
    const ctx = makeCtx({ promptContent: TWO_NEGATIVES, ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("path:fallback");
  });

  it("AO. Path 2 warn reason contains the ward openStage", () => {
    const ctx = makeCtx({
      promptContent: TWO_NEGATIVES,
      ward: makeWard({ openStage: "build" }),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.reason).toContain("build");
  });

  it("Path 2 warn never carries violationType (advisory constraint)", () => {
    const ctx = makeCtx({ promptContent: TWO_NEGATIVES, ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.violationType).toBeUndefined();
  });

  it("Path 2 does not fire when riskClass is below H (step 1 takes precedence)", () => {
    const ctx = makeCtx({ promptContent: TWO_NEGATIVES, riskClass: "M", ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("Path 2 does not fire when promptContent is empty (step 2 takes precedence)", () => {
    const ctx = makeCtx({ promptContent: "", ward: makeWard() });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("no promptContent");
  });

  it("Path 1 still fires when artifact token present even with ward (Path 1 wins)", () => {
    // "la landing" is an artifact token + "cassé" + "mauvais" → Path 1 fires
    const ctx = makeCtx({
      promptContent: "la landing est cassée et mauvaise",
      ward: makeWard(),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("warn");
    // Path 1 reason contains the artifact token, not "path:fallback"
    expect(result.reason).toContain("la landing");
    expect(result.reason).not.toContain("path:fallback");
  });
});

// ---------------------------------------------------------------------------
// NOT-triggered reason contract (all allow paths carry the literal)
// ---------------------------------------------------------------------------

describe("BEH_FEEDBACK_WAVE — NOT-triggered reason on all allow paths", () => {
  const NOT_TRIGGERED = "[founder-feedback-scale] evaluated — NOT triggered";

  it("AP. below-H allow carries NOT-triggered literal", () => {
    const ctx = makeCtx({ riskClass: "M", promptContent: "la landing est cassée" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain(NOT_TRIGGERED);
  });

  it("AQ. no-promptContent allow carries NOT-triggered literal", () => {
    const ctx = makeCtx({ useUndefinedPrompt: true });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain(NOT_TRIGGERED);
  });

  it("AR. no-artifact allow (no ward) carries NOT-triggered literal", () => {
    const ctx = makeCtx({ promptContent: "c'est cassé et mauvais" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain(NOT_TRIGGERED);
  });

  it("AS. no-evaluative allow carries NOT-triggered literal", () => {
    const ctx = makeCtx({ promptContent: "la landing looks great" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toContain(NOT_TRIGGERED);
  });
});

// ---------------------------------------------------------------------------
// countEvaluativeTokens unit tests
// ---------------------------------------------------------------------------

describe("countEvaluativeTokens", () => {
  it("AT. 'trop lent et trop petit' → 2", () => {
    expect(countEvaluativeTokens("trop lent et trop petit")).toBe(2);
  });

  it("AU. 'c'est cassé, c'est mauvais et raté' → 3", () => {
    expect(countEvaluativeTokens("c'est cassé, c'est mauvais et raté")).toBe(3);
  });

  it("AV. 'everything looks fine' → 0", () => {
    expect(countEvaluativeTokens("everything looks fine")).toBe(0);
  });

  it("AW. 'trop lent' → 1", () => {
    expect(countEvaluativeTokens("trop lent")).toBe(1);
  });

  it("case-insensitive: 'TROP LENT ET MAUVAIS' → 2", () => {
    expect(countEvaluativeTokens("TROP LENT ET MAUVAIS")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countEvaluativeTokens("")).toBe(0);
  });
});
