/**
 * Tests for behavior-core/beh-planner-write-guard.ts — BEH_PLANNER_WRITE_GUARD.
 *
 * Mandated scenarios (per R-020 part 2):
 *   A. ward at discovery + Write to src/x.ts → block PLANNER_WRITE_GUARD
 *   B. ward at discovery + Write to .hima/plans/p.md → allow
 *   C. ward at impl stage (executor) + Write to src/x.ts → allow
 *   D. no ward → allow
 *
 * Extended coverage:
 *   E. ward at analysis + Edit to src/x.ts → block
 *   F. ward at spec + MultiEdit to src/x.ts → block
 *   G. ward at discovery + Write to docs/foo.md → allow (.md extension)
 *   H. ward at discovery + Write to .hima/drafts/d.md → allow
 *   I. ward at discovery + non-write tool (Bash) → allow
 *   J. ward at discovery + Write, toolInput undefined → allow (defensive)
 *   K. ward at discovery + Write, toolInput null → allow (defensive)
 *   L. ward at design stage + Write to src/x.ts → allow (not a planner stage)
 *   M. ward at test stage + Write to src/x.ts → allow (not a planner stage)
 *   N. ward at verify stage + Write to src/x.ts → allow (not a planner stage)
 *   O. ward at discovery + Write, toolInput "path" key → block
 *   P. ward at discovery + Write to non-.md file, absolute path → block
 *   Q. block reason cites openStage and remediation command
 *   R. descriptor id is BEH-PLANNER-WRITE-GUARD
 *   S. descriptor gates is ["pre_tool"]
 *   T. ward null (not undefined) → allow
 *   U. ward at discovery + Write to .hima/plans-extra/x.ts → block (not inside plans/)
 */

import { describe, it, expect } from "vitest";
import { BEH_PLANNER_WRITE_GUARD } from "../src/behavior-core/beh-planner-write-guard.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { Ward } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROOT = "/project/root";

/** Call evaluate synchronously. The guard is always synchronous. */
function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  const result = BEH_PLANNER_WRITE_GUARD.evaluate(ctx);
  // Guard is synchronous — cast is safe; would throw if it returned a Promise.
  return result as BehaviorVerdict;
}

function makeWard(
  openStage: string,
  overrides: Partial<Omit<Ward, "openStage">> = {},
): Ward {
  return {
    id: "ward-001",
    entryPoint: "full",
    floor: "M",
    openStage,
    skillRegister: [],
    verdicts: [],
    ...overrides,
  };
}

function makeCtx(
  overrides: {
    toolName?: string;
    toolInput?: unknown;
    ward?: Ward | null;
    root?: string;
    riskClass?: Ward["floor"];
  } = {},
): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName: overrides.toolName ?? "Write",
      toolInput:
        overrides.toolInput !== undefined
          ? overrides.toolInput
          : { file_path: "src/x.ts", content: "const x = 1;" },
    },
    riskClass: overrides.riskClass ?? "M",
    root: overrides.root ?? ROOT,
    ward:
      overrides.ward !== undefined
        ? overrides.ward
        : makeWard("discovery"),
  };
}

// ---------------------------------------------------------------------------
// Mandated scenarios (A–D)
// ---------------------------------------------------------------------------

describe("BEH_PLANNER_WRITE_GUARD — mandated scenarios", () => {
  it("A. ward at discovery + Write to src/x.ts → block PLANNER_WRITE_GUARD", () => {
    const result = evaluate(
      makeCtx({ ward: makeWard("discovery"), toolInput: { file_path: "src/x.ts" } }),
    );
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-PLANNER-WRITE-GUARD");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("B. ward at discovery + Write to .hima/plans/p.md → allow", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: ".hima/plans/p.md" },
      }),
    );
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-PLANNER-WRITE-GUARD");
  });

  it("C. ward at impl stage (executor) + Write to src/x.ts → allow", () => {
    const result = evaluate(
      makeCtx({ ward: makeWard("impl"), toolInput: { file_path: "src/x.ts" } }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a planner stage/);
  });

  it("D. no ward (undefined) → allow", () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "Write",
        toolInput: { file_path: "src/x.ts" },
      },
      riskClass: "M",
      root: ROOT,
      ward: undefined,
    };
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no ward/);
  });
});

// ---------------------------------------------------------------------------
// Extended coverage (E–U)
// ---------------------------------------------------------------------------

describe("BEH_PLANNER_WRITE_GUARD — extended coverage", () => {
  it("E. ward at analysis + Edit to src/x.ts → block", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("analysis"),
        toolName: "Edit",
        toolInput: { file_path: "src/x.ts", new_string: "x" },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
    expect(result.reason).toMatch(/analysis/);
  });

  it("F. ward at spec + MultiEdit to src/x.ts → block", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("spec"),
        toolName: "MultiEdit",
        toolInput: { file_path: "src/x.ts" },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
    expect(result.reason).toMatch(/spec/);
  });

  it("G. ward at discovery + Write to docs/foo.md → allow (.md extension)", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: "docs/foo.md" },
      }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/\.md/);
  });

  it("H. ward at discovery + Write to .hima/drafts/d.md → allow", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: ".hima/drafts/d.md" },
      }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/\.hima\/drafts\//);
  });

  it("I. ward at discovery + non-write tool (Bash) → allow", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolName: "Bash",
        toolInput: { command: "ls" },
      }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write tool/);
  });

  it("J. ward at discovery + Write, toolInput undefined → allow (defensive)", () => {
    const ctx: BehaviorContext = {
      event: { gateType: "pre_tool", toolName: "Write", toolInput: undefined },
      riskClass: "M",
      root: ROOT,
      ward: makeWard("discovery"),
    };
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("K. ward at discovery + Write, toolInput null → allow (defensive)", () => {
    const result = evaluate(
      makeCtx({ ward: makeWard("discovery"), toolInput: null }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("L. ward at design stage + Write to src/x.ts → allow (not a planner stage)", () => {
    const result = evaluate(
      makeCtx({ ward: makeWard("design"), toolInput: { file_path: "src/x.ts" } }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a planner stage/);
  });

  it("M. ward at test stage + Write to src/x.ts → allow (not a planner stage)", () => {
    const result = evaluate(
      makeCtx({ ward: makeWard("test"), toolInput: { file_path: "src/x.ts" } }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a planner stage/);
  });

  it("N. ward at verify stage + Write to src/x.ts → allow (not a planner stage)", () => {
    const result = evaluate(
      makeCtx({ ward: makeWard("verify"), toolInput: { file_path: "src/x.ts" } }),
    );
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a planner stage/);
  });

  it("O. ward at discovery + Write, toolInput 'path' key → block", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { path: "src/x.ts", content: "x" },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("P. ward at discovery + absolute path to .ts → block", () => {
    const absPath = `${ROOT}/src/x.ts`;
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: absPath },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("Q. block reason cites openStage name and remediation command", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: "src/x.ts" },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.reason).toMatch(/discovery/);
    // Remediation command is now the friendlier `hima advance` (was `hima hook stage-advance`).
    expect(result.reason).toMatch(/hima advance/);
  });

  it("R. descriptor id is BEH-PLANNER-WRITE-GUARD", () => {
    expect(BEH_PLANNER_WRITE_GUARD.id).toBe("BEH-PLANNER-WRITE-GUARD");
  });

  it("S. descriptor gates is [\"pre_tool\"]", () => {
    expect(BEH_PLANNER_WRITE_GUARD.gates).toEqual(["pre_tool"]);
  });

  it("T. ward null → allow", () => {
    const ctx: BehaviorContext = {
      event: { gateType: "pre_tool", toolName: "Write", toolInput: { file_path: "src/x.ts" } },
      riskClass: "M",
      root: ROOT,
      ward: null,
    };
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/no ward/);
  });

  it("U. ward at discovery + Write to .hima/plans-extra/x.ts → block (partial name, not inside plans/)", () => {
    // ".hima/plans-extra" must NOT be matched as ".hima/plans"
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: ".hima/plans-extra/x.ts" },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("ward at discovery + Write to .hima/plans/ root itself → allow", () => {
    const absPlans = `${ROOT}/.hima/plans`;
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: absPlans },
      }),
    );
    // .hima/plans has no extension but equals the plans dir → allow
    expect(result.decision).toBe("allow");
  });

  it("ward at discovery + Write to .hima/plans/subdir/deep.md → allow", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("discovery"),
        toolInput: { file_path: ".hima/plans/subdir/deep.md" },
      }),
    );
    expect(result.decision).toBe("allow");
  });

  it("ward at spec + Write to src/something.test.ts → block", () => {
    const result = evaluate(
      makeCtx({
        ward: makeWard("spec"),
        toolInput: { file_path: "src/something.test.ts" },
      }),
    );
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });
});
