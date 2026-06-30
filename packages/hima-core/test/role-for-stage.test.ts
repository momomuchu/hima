/**
 * Tests for prompts-core/role-for-stage.ts.
 *
 * Covers:
 *   - PLANNER_STAGES / EXECUTOR_STAGES / REVIEWER_STAGES set membership
 *   - roleForStage() → correct HimaRole or null for every defined stage
 *   - roleForStage() → null for unknown stages
 *   - roleContext() → returns the canonical role-marker string for each role
 */

import { describe, expect, it } from "vitest";
import {
  PLANNER_STAGES,
  EXECUTOR_STAGES,
  REVIEWER_STAGES,
  roleForStage,
  roleContext,
} from "../src/prompts-core/role-for-stage.js";

// ---------------------------------------------------------------------------
// Stage-set membership
// ---------------------------------------------------------------------------

describe("PLANNER_STAGES", () => {
  it('contains "discovery"', () => expect(PLANNER_STAGES.has("discovery")).toBe(true));
  it('contains "analysis"', () => expect(PLANNER_STAGES.has("analysis")).toBe(true));
  it('contains "spec"', () => expect(PLANNER_STAGES.has("spec")).toBe(true));
  it('does not contain "impl"', () => expect(PLANNER_STAGES.has("impl")).toBe(false));
  it('does not contain "verify"', () => expect(PLANNER_STAGES.has("verify")).toBe(false));
});

describe("EXECUTOR_STAGES", () => {
  it('contains "design"', () => expect(EXECUTOR_STAGES.has("design")).toBe(true));
  it('contains "impl"', () => expect(EXECUTOR_STAGES.has("impl")).toBe(true));
  it('contains "test"', () => expect(EXECUTOR_STAGES.has("test")).toBe(true));
  it('does not contain "spec"', () => expect(EXECUTOR_STAGES.has("spec")).toBe(false));
  it('does not contain "verify"', () => expect(EXECUTOR_STAGES.has("verify")).toBe(false));
});

describe("REVIEWER_STAGES", () => {
  it('contains "verify"', () => expect(REVIEWER_STAGES.has("verify")).toBe(true));
  it('does not contain "impl"', () => expect(REVIEWER_STAGES.has("impl")).toBe(false));
  it('does not contain "spec"', () => expect(REVIEWER_STAGES.has("spec")).toBe(false));
});

describe("stage sets are mutually exclusive", () => {
  it("PLANNER_STAGES and EXECUTOR_STAGES share no stages", () => {
    const intersection = [...PLANNER_STAGES].filter((s) => EXECUTOR_STAGES.has(s));
    expect(intersection).toHaveLength(0);
  });

  it("PLANNER_STAGES and REVIEWER_STAGES share no stages", () => {
    const intersection = [...PLANNER_STAGES].filter((s) => REVIEWER_STAGES.has(s));
    expect(intersection).toHaveLength(0);
  });

  it("EXECUTOR_STAGES and REVIEWER_STAGES share no stages", () => {
    const intersection = [...EXECUTOR_STAGES].filter((s) => REVIEWER_STAGES.has(s));
    expect(intersection).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// roleForStage — planner stages
// ---------------------------------------------------------------------------

describe('roleForStage — planner stages → "planner"', () => {
  it('"discovery" → "planner"', () => expect(roleForStage("discovery")).toBe("planner"));
  it('"analysis" → "planner"', () => expect(roleForStage("analysis")).toBe("planner"));
  it('"spec" → "planner"', () => expect(roleForStage("spec")).toBe("planner"));
});

// ---------------------------------------------------------------------------
// roleForStage — executor stages
// ---------------------------------------------------------------------------

describe('roleForStage — executor stages → "executor"', () => {
  it('"design" → "executor"', () => expect(roleForStage("design")).toBe("executor"));
  it('"impl" → "executor"', () => expect(roleForStage("impl")).toBe("executor"));
  it('"test" → "executor"', () => expect(roleForStage("test")).toBe("executor"));
});

// ---------------------------------------------------------------------------
// roleForStage — reviewer stage
// ---------------------------------------------------------------------------

describe('roleForStage — reviewer stage → "reviewer"', () => {
  it('"verify" → "reviewer"', () => expect(roleForStage("verify")).toBe("reviewer"));
});

// ---------------------------------------------------------------------------
// roleForStage — unknown / empty stages
// ---------------------------------------------------------------------------

describe("roleForStage — unknown stages → null", () => {
  it('"archive" → null', () => expect(roleForStage("archive")).toBeNull());
  it('"" (empty string) → null', () => expect(roleForStage("")).toBeNull());
  it('"DISCOVERY" (wrong case) → null', () => expect(roleForStage("DISCOVERY")).toBeNull());
  it('"plan" → null (not a stage name)', () => expect(roleForStage("plan")).toBeNull());
  it('"review" → null (not a stage name, "verify" is)', () => expect(roleForStage("review")).toBeNull());
});

// ---------------------------------------------------------------------------
// roleContext — role marker strings
// ---------------------------------------------------------------------------

describe("roleContext — role marker strings", () => {
  it('planner context contains "[HIMA role:planner]"', () => {
    expect(roleContext("planner")).toContain("[HIMA role:planner]");
  });

  it("planner context forbids implementation code (mentions .md / .hima/plans)", () => {
    const ctx = roleContext("planner");
    expect(ctx.toLowerCase()).toMatch(/\.md|\.hima\/plans/);
  });

  it('executor context contains "[HIMA role:executor]"', () => {
    expect(roleContext("executor")).toContain("[HIMA role:executor]");
  });

  it("executor context mentions spec or plan (implementation context)", () => {
    const ctx = roleContext("executor").toLowerCase();
    // Must reference either spec or plan to guide correct executor behaviour
    expect(ctx.match(/spec|plan/)).not.toBeNull();
  });

  it('reviewer context contains "[HIMA role:reviewer]"', () => {
    expect(roleContext("reviewer")).toContain("[HIMA role:reviewer]");
  });

  it("reviewer context forbids implementation modification (mentions verify or do not modify)", () => {
    const ctx = roleContext("reviewer").toLowerCase();
    expect(ctx.match(/verify|do not modify/)).not.toBeNull();
  });

  it("all three role-context strings are non-empty", () => {
    expect(roleContext("planner").length).toBeGreaterThan(0);
    expect(roleContext("executor").length).toBeGreaterThan(0);
    expect(roleContext("reviewer").length).toBeGreaterThan(0);
  });

  it("each role has a distinct context string", () => {
    const p = roleContext("planner");
    const e = roleContext("executor");
    const r = roleContext("reviewer");
    expect(p).not.toBe(e);
    expect(p).not.toBe(r);
    expect(e).not.toBe(r);
  });
});
