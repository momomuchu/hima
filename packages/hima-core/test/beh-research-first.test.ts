/**
 * Tests for behavior-core/beh-research-first.ts — BEH_RESEARCH_FIRST gate.
 *
 * Mandated scenarios (per R-007):
 *  A. full-entry ward, no discovery verdict, Write to docs/specs/x.spec.md → block RESEARCH_FIRST
 *  B. full-entry ward, discovery "done" verdict, Write to docs/specs/x.spec.md → allow
 *  C. run-entry ward, Write to docs/specs/x.spec.md → allow (research-first is full-only)
 *  D. non-spec path (Write to src/foo.ts) → allow regardless of ward state
 *
 * Ward / pipeline context:
 *  E. No ward (null) + Write to docs/specs/x.spec.md → allow defensively
 *  F. spec-entry ward + spec path → allow (research-first is full-only)
 *  G. full-entry ward, discovery "done-verified" verdict → allow
 *  H. full-entry ward, discovery "done-validated" verdict → allow
 *
 * Discovery verdict status variants (negative — do NOT unblock):
 *  I. full-entry ward, discovery "partial" verdict → block
 *  J. full-entry ward, discovery "blocked" verdict → block
 *  K. full-entry ward, verdict present for a different stage ("analysis" done) → block
 *
 * Tool variants:
 *  L. Edit tool + spec path + full ward, no discovery → block
 *  M. MultiEdit tool + spec path + full ward, no discovery → block
 *  N. Bash tool + spec path + full ward, no discovery → allow (non-write)
 *  O. Read tool → allow (non-write)
 *
 * toolInput edge cases:
 *  P. toolInput is undefined → allow defensively
 *  Q. toolInput is null → allow defensively
 *  R. toolInput is a string primitive → allow defensively
 *  S. file_path is an empty string → allow defensively
 *
 * Spec-class path pattern coverage:
 *  T. *.spec.md in a nested directory → detected as spec-class
 *  U. docs/specs/<filename> → detected as spec-class
 *  V. docs/decisions/<filename> → detected as spec-class
 *  W. docs/specs-adjacent/foo.ts (partial prefix) → NOT spec-class → allow
 *
 * isSpecClassPath unit tests (exported helper):
 *  X. "foo.spec.md" → true
 *  Y. "path/to/bar.spec.md" → true
 *  Z. "docs/specs/overview.md" → true
 *  AA. "docs/decisions/0001-choice.md" → true
 *  AB. "src/foo.ts" → false
 *  AC. "docs/specs-extra/foo.ts" → false
 *  AD. "notadoc.ts" → false
 *
 * isDiscoverySealed unit tests (exported helper):
 *  AE. empty verdicts → false
 *  AF. single discovery:done → true
 *  AG. single discovery:done-verified → true
 *  AH. single discovery:done-validated → true
 *  AI. single discovery:partial → false
 *  AJ. single discovery:blocked → false
 *  AK. analysis:done only → false
 *  AL. multiple verdicts, discovery:done among them → true
 *
 * Descriptor contract:
 *  AM. descriptor gates = ["pre_tool"]
 *  AN. descriptor id = "BEH-RESEARCH-FIRST"
 */

import { describe, it, expect } from "vitest";
import {
  BEH_RESEARCH_FIRST,
  isSpecClassPath,
  isDiscoverySealed,
} from "../src/behavior-core/beh-research-first.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { Ward, StageVerdict, RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Evaluate the descriptor synchronously (it never returns a Promise). */
function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_RESEARCH_FIRST.evaluate(ctx) as BehaviorVerdict;
}

/** Build a Ward with a specific entryPoint and optional verdicts. */
function makeWard(
  entryPoint: Ward["entryPoint"] = "full",
  verdicts: StageVerdict[] = [],
): Ward {
  return {
    id: "ward-rf-001",
    entryPoint,
    floor: "M",
    openStage: "spec",
    skillRegister: [],
    verdicts,
  };
}

/** Build a StageVerdict for the discovery stage with the given status. */
function discoveryVerdict(status: StageVerdict["status"]): StageVerdict {
  return { stage: "discovery", status, evidence: [] };
}

/** Build a StageVerdict for a non-discovery stage. */
function stageVerdict(stage: string, status: StageVerdict["status"]): StageVerdict {
  return { stage, status, evidence: [] };
}

/**
 * Build a BehaviorContext for the given scenario.
 *
 * Defaults: Write to docs/specs/x.spec.md, full-entry ward with no verdicts, M risk class.
 */
function makeCtx(overrides: {
  toolName?: string;
  filePath?: string;
  riskClass?: RiskClass;
  ward?: Ward | null;
  rawToolInput?: unknown;
  useUndefinedToolInput?: true;
} = {}): BehaviorContext {
  const toolInput = overrides.useUndefinedToolInput
    ? undefined
    : overrides.rawToolInput !== undefined
      ? overrides.rawToolInput
      : { file_path: overrides.filePath ?? "docs/specs/x.spec.md", content: "x" };

  return {
    event: {
      gateType: "pre_tool",
      toolName: overrides.toolName ?? "Write",
      toolInput,
    },
    riskClass: overrides.riskClass ?? "M",
    root: "/tmp/test-project",
    ward: overrides.ward !== undefined ? overrides.ward : makeWard("full", []),
  };
}

// ---------------------------------------------------------------------------
// Mandated scenarios
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — mandated scenarios", () => {
  it("A. full-entry ward, no discovery verdict, Write to spec path → block RESEARCH_FIRST", () => {
    const ctx = makeCtx({ ward: makeWard("full", []) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-RESEARCH-FIRST");
    expect(result.violationType).toBe("RESEARCH_FIRST");
    expect(result.reason).toMatch(/stage:discovery verdict required/);
    expect(result.reason).toMatch(/hima hook stage-advance --stage discovery --status done/);
  });

  it("B. full-entry ward, discovery 'done' verdict, Write to spec path → allow", () => {
    const ctx = makeCtx({ ward: makeWard("full", [discoveryVerdict("done")]) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-RESEARCH-FIRST");
  });

  it("C. run-entry ward, Write to spec path → allow (research-first is full-only)", () => {
    const ctx = makeCtx({ ward: makeWard("run", []) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/full.*entry only/i);
  });

  it("D. non-spec path (src/foo.ts) → allow regardless of ward state", () => {
    const ctx = makeCtx({
      filePath: "src/foo.ts",
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a spec-class/);
  });
});

// ---------------------------------------------------------------------------
// Ward / pipeline context
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — ward context", () => {
  it("E. null ward + Write to spec path → allow (no pipeline context)", () => {
    const ctx = makeCtx({ ward: null });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no active ward/);
  });

  it("F. spec-entry ward + spec path → allow (research-first is full-only)", () => {
    const ctx = makeCtx({ ward: makeWard("spec", []) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/full.*entry only/i);
  });

  it("G. full-entry ward, discovery 'done-verified' verdict → allow", () => {
    const ctx = makeCtx({ ward: makeWard("full", [discoveryVerdict("done-verified")]) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("H. full-entry ward, discovery 'done-validated' verdict → allow", () => {
    const ctx = makeCtx({ ward: makeWard("full", [discoveryVerdict("done-validated")]) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });
});

// ---------------------------------------------------------------------------
// Discovery verdict status variants (negative — do NOT unblock)
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — unsatisfying discovery verdict statuses", () => {
  it("I. discovery 'partial' verdict → block (not sealed)", () => {
    const ctx = makeCtx({ ward: makeWard("full", [discoveryVerdict("partial")]) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("J. discovery 'blocked' verdict → block (not sealed)", () => {
    const ctx = makeCtx({ ward: makeWard("full", [discoveryVerdict("blocked")]) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("K. only non-discovery stage sealed ('analysis' done) → block", () => {
    const ctx = makeCtx({ ward: makeWard("full", [stageVerdict("analysis", "done")]) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });
});

// ---------------------------------------------------------------------------
// Tool variants
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — tool variants", () => {
  it("L. Edit tool + spec path + full ward, no discovery → block", () => {
    const ctx = makeCtx({
      toolName: "Edit",
      rawToolInput: { file_path: "docs/specs/x.spec.md", new_string: "x" },
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("M. MultiEdit tool + spec path + full ward, no discovery → block", () => {
    const ctx = makeCtx({
      toolName: "MultiEdit",
      rawToolInput: { file_path: "docs/specs/x.spec.md", new_string: "x" },
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("N. Bash tool + spec path + full ward, no discovery → allow (non-write)", () => {
    const ctx = makeCtx({
      toolName: "Bash",
      rawToolInput: { command: "cat docs/specs/x.spec.md" },
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write/);
  });

  it("O. Read tool → allow (non-write)", () => {
    const ctx = makeCtx({
      toolName: "Read",
      rawToolInput: { file_path: "docs/specs/x.spec.md" },
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write/);
  });
});

// ---------------------------------------------------------------------------
// toolInput edge cases
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — toolInput edge cases", () => {
  it("P. toolInput is undefined → allow defensively", () => {
    const ctx = makeCtx({ useUndefinedToolInput: true });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("Q. toolInput is null → allow defensively", () => {
    const ctx = makeCtx({ rawToolInput: null });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("R. toolInput is a string primitive → allow defensively", () => {
    const ctx = makeCtx({ rawToolInput: "not-an-object" });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("S. file_path is an empty string → allow defensively", () => {
    const ctx = makeCtx({ rawToolInput: { file_path: "", content: "x" } });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });
});

// ---------------------------------------------------------------------------
// Spec-class path pattern coverage
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — spec-class path routing", () => {
  it("T. *.spec.md in a nested directory → blocked (spec-class)", () => {
    const ctx = makeCtx({
      filePath: "packages/mylib/docs/feature.spec.md",
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("U. docs/specs/<filename> → blocked (spec-class)", () => {
    const ctx = makeCtx({
      filePath: "docs/specs/overview.md",
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("V. docs/decisions/<filename> → blocked (spec-class)", () => {
    const ctx = makeCtx({
      filePath: "docs/decisions/0001-choice.md",
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("RESEARCH_FIRST");
  });

  it("W. docs/specs-extra/foo.ts (partial prefix) → NOT spec-class → allow", () => {
    const ctx = makeCtx({
      filePath: "docs/specs-extra/foo.ts",
      ward: makeWard("full", []),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a spec-class/);
  });
});

// ---------------------------------------------------------------------------
// isSpecClassPath unit tests
// ---------------------------------------------------------------------------

describe("isSpecClassPath", () => {
  it("X. 'foo.spec.md' → true", () => {
    expect(isSpecClassPath("foo.spec.md")).toBe(true);
  });

  it("Y. 'path/to/bar.spec.md' → true", () => {
    expect(isSpecClassPath("path/to/bar.spec.md")).toBe(true);
  });

  it("Z. 'docs/specs/overview.md' → true", () => {
    expect(isSpecClassPath("docs/specs/overview.md")).toBe(true);
  });

  it("AA. 'docs/decisions/0001-choice.md' → true", () => {
    expect(isSpecClassPath("docs/decisions/0001-choice.md")).toBe(true);
  });

  it("AB. 'src/foo.ts' → false", () => {
    expect(isSpecClassPath("src/foo.ts")).toBe(false);
  });

  it("AC. 'docs/specs-extra/foo.ts' → false (not under docs/specs/)", () => {
    expect(isSpecClassPath("docs/specs-extra/foo.ts")).toBe(false);
  });

  it("AD. 'notadoc.ts' → false", () => {
    expect(isSpecClassPath("notadoc.ts")).toBe(false);
  });

  it("leading './' is stripped before matching", () => {
    expect(isSpecClassPath("./docs/specs/plan.md")).toBe(true);
    expect(isSpecClassPath("./feature.spec.md")).toBe(true);
  });

  it("Windows backslash separators are normalised", () => {
    expect(isSpecClassPath("docs\\specs\\plan.md")).toBe(true);
  });

  it("absolute-style path with docs/specs segment is spec-class", () => {
    expect(isSpecClassPath("/project/docs/specs/plan.md")).toBe(true);
  });

  it("'docs/specs/' bare directory (no filename) → false (requires a file after the slash)", () => {
    // The pattern requires at least one character after the slash: .+
    // A bare "docs/specs/" has nothing after the final slash.
    expect(isSpecClassPath("docs/specs/")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDiscoverySealed unit tests
// ---------------------------------------------------------------------------

describe("isDiscoverySealed", () => {
  it("AE. empty verdicts → false", () => {
    expect(isDiscoverySealed([])).toBe(false);
  });

  it("AF. single discovery:done → true", () => {
    expect(isDiscoverySealed([{ stage: "discovery", status: "done", evidence: [] }])).toBe(true);
  });

  it("AG. single discovery:done-verified → true", () => {
    expect(isDiscoverySealed([{ stage: "discovery", status: "done-verified", evidence: [] }])).toBe(true);
  });

  it("AH. single discovery:done-validated → true", () => {
    expect(isDiscoverySealed([{ stage: "discovery", status: "done-validated", evidence: [] }])).toBe(true);
  });

  it("AI. single discovery:partial → false", () => {
    expect(isDiscoverySealed([{ stage: "discovery", status: "partial", evidence: [] }])).toBe(false);
  });

  it("AJ. single discovery:blocked → false", () => {
    expect(isDiscoverySealed([{ stage: "discovery", status: "blocked", evidence: [] }])).toBe(false);
  });

  it("AK. analysis:done only → false (wrong stage)", () => {
    expect(isDiscoverySealed([{ stage: "analysis", status: "done", evidence: [] }])).toBe(false);
  });

  it("AL. multiple verdicts, discovery:done among them → true", () => {
    expect(
      isDiscoverySealed([
        { stage: "analysis", status: "done", evidence: [] },
        { stage: "discovery", status: "done", evidence: ["evidence-1"] },
        { stage: "spec", status: "partial", evidence: [] },
      ]),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Descriptor contract
// ---------------------------------------------------------------------------

describe("BEH_RESEARCH_FIRST — descriptor contract", () => {
  it("AM. descriptor gates = ['pre_tool']", () => {
    expect(BEH_RESEARCH_FIRST.gates).toEqual(["pre_tool"]);
    expect(BEH_RESEARCH_FIRST.gates).not.toContain("stop");
  });

  it("AN. descriptor id = 'BEH-RESEARCH-FIRST'", () => {
    expect(BEH_RESEARCH_FIRST.id).toBe("BEH-RESEARCH-FIRST");
  });
});
