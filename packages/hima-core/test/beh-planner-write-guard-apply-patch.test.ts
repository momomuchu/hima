/**
 * Regression tests — BEH_PLANNER_WRITE_GUARD vs Codex's real `apply_patch` write tool.
 *
 * Same root-cause bug as beh-delegation-first-apply-patch.test.ts:
 * beh-planner-write-guard.ts hardcoded
 * `WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"])`, so an
 * `apply_patch` call at a planner stage (discovery/analysis/spec) was
 * classified as a "non-write tool" and silently ALLOWED through — the
 * planner-write-guard was completely inert on Codex.
 *
 *  A. apply_patch adding an implementation file at discovery stage → BLOCK
 *  B. apply_patch touching ONLY a .md file at discovery stage → allow
 *  C. apply_patch with an unparseable/missing command at discovery stage →
 *     still BLOCKED (fail-closed default)
 *  D. apply_patch to .hima/plans/** at discovery stage → allow
 *  E. apply_patch at a non-planner stage (impl) → allow (guard doesn't apply)
 */

import type { Ward } from "@norm/schemas";
import { describe, expect, it } from "vitest";
import { BEH_PLANNER_WRITE_GUARD } from "../src/behavior-core/beh-planner-write-guard.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";

const ROOT = "/project/root";

function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_PLANNER_WRITE_GUARD.evaluate(ctx) as BehaviorVerdict;
}

function makeWard(openStage: string, overrides: Partial<Omit<Ward, "openStage">> = {}): Ward {
  return {
    id: "ward-pwg-ap-001",
    entryPoint: "full",
    floor: "M",
    openStage,
    skillRegister: [],
    verdicts: [],
    ...overrides,
  };
}

const ADD_TS_PATCH = "*** Begin Patch\n*** Add File: src/x.ts\n+export const x = 1;\n*** End Patch";
const ADD_MD_PATCH = "*** Begin Patch\n*** Add File: docs/x.md\n+# doc\n*** End Patch";
const ADD_PLAN_PATCH = "*** Begin Patch\n*** Add File: .hima/plans/p.md\n+# plan\n*** End Patch";
const UNPARSEABLE_PATCH = "*** Begin Patch\nnot a real patch body\n*** End Patch";

function makeCtx(
  overrides: { command?: string; toolInput?: unknown; ward?: Ward | null } = {},
): BehaviorContext {
  return {
    event: {
      gateType: "pre_tool",
      toolName: "apply_patch",
      toolInput:
        overrides.toolInput !== undefined
          ? overrides.toolInput
          : { command: overrides.command ?? ADD_TS_PATCH },
    },
    riskClass: "M",
    root: ROOT,
    ward: overrides.ward !== undefined ? overrides.ward : makeWard("discovery"),
  };
}

describe("BEH_PLANNER_WRITE_GUARD — Codex apply_patch regression", () => {
  it("A. apply_patch adding an impl file at discovery stage → block PLANNER_WRITE_GUARD", () => {
    const result = evaluate(makeCtx());
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("B. apply_patch touching ONLY a .md file at discovery stage → allow", () => {
    const result = evaluate(makeCtx({ command: ADD_MD_PATCH }));
    expect(result.decision).toBe("allow");
  });

  it("C1. apply_patch with unparseable command at discovery stage → still block (fail closed)", () => {
    const result = evaluate(makeCtx({ command: UNPARSEABLE_PATCH }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("C2. apply_patch with missing command field at discovery stage → still block (fail closed)", () => {
    const result = evaluate(makeCtx({ toolInput: {} }));
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("PLANNER_WRITE_GUARD");
  });

  it("D. apply_patch to .hima/plans/** at discovery stage → allow", () => {
    const result = evaluate(makeCtx({ command: ADD_PLAN_PATCH }));
    expect(result.decision).toBe("allow");
  });

  it("E. apply_patch at a non-planner stage (impl) → allow (guard doesn't apply)", () => {
    const result = evaluate(makeCtx({ ward: makeWard("impl") }));
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a planner stage/);
  });
});
