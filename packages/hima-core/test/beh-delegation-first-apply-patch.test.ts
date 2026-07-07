/**
 * Regression tests — BEH_DELEGATION_FIRST vs Codex's real `apply_patch` write tool.
 *
 * BUG (live-proven via `codex exec`): Codex's real file-write tool is
 * `apply_patch` with `tool_input = { command: "<patch script>" }` — there is no
 * `file_path`/`path` field. beh-delegation-first.ts hardcoded
 * `WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"])`, so an
 * `apply_patch` call at impl+H with no delegation was classified as a
 * "non-write tool" and silently ALLOWED — Delegation-First was completely
 * inert on Codex. These tests pin down the fix (tool-classify.ts wiring):
 *
 *  A. apply_patch adding an implementation file, impl+H, no delegation → BLOCK
 *     (unit level: BEH_DELEGATION_FIRST.evaluate)
 *  B. same, but through the REAL end-to-end router
 *     (registry → evaluateGate → runGate → translateCodex) → claude.exitCode 2
 *  C. apply_patch touching ONLY a .md file → NOT blocked (allow)
 *  D. apply_patch with an unparseable/missing command → still BLOCKED
 *     (fail-closed default — never silently allow on ambiguity)
 *  E. apply_patch write WITH delegation active → allow (unblocked, same as
 *     Write/Edit/MultiEdit)
 *  F. apply_patch is case/separator-insensitive ("APPLY_PATCH") → still blocks
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GateEvent, Ward } from "@norm/schemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BEH_DELEGATION_FIRST } from "../src/behavior-core/beh-delegation-first.js";
import { markLane } from "../src/behavior-core/delegation-lane.js";
import { Registry } from "../src/behavior-core/registry.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import { evaluateGate } from "../src/gates-core/evaluate-gate.js";
import { runGate } from "../src/run-gate.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "delfirst-applypatch-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeWard(openStage: string, overrides: Partial<Ward> = {}): Ward {
  return {
    id: "ward-ap-001",
    entryPoint: "full",
    floor: "H",
    openStage,
    skillRegister: [],
    verdicts: [],
    ...overrides,
  };
}

const ADD_TS_PATCH = "*** Begin Patch\n*** Add File: src/x.ts\n+export const x = 1;\n*** End Patch";
const ADD_MD_PATCH = "*** Begin Patch\n*** Add File: docs/x.md\n+# doc\n*** End Patch";
const UNPARSEABLE_PATCH = "*** Begin Patch\nnot a real patch body\n*** End Patch";

function applyPatchEvent(command: string): GateEvent {
  return {
    gateType: "pre_tool",
    toolName: "apply_patch",
    toolInput: { command },
  };
}

function makeCtx(overrides: Partial<BehaviorContext> = {}): BehaviorContext {
  return {
    event: applyPatchEvent(ADD_TS_PATCH),
    riskClass: "H",
    root,
    ward: makeWard("impl"),
    sessionId: "sess-main",
    ...overrides,
  };
}

function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  return BEH_DELEGATION_FIRST.evaluate(ctx) as BehaviorVerdict;
}

// ---------------------------------------------------------------------------
// A. apply_patch write, impl+H, no delegation → BLOCK
// ---------------------------------------------------------------------------

describe("BEH_DELEGATION_FIRST — Codex apply_patch regression", () => {
  it("A. apply_patch adding an impl file, impl+H, no delegation → block DELEGATION_FIRST", () => {
    const verdict = evaluate(makeCtx());
    expect(verdict.decision).toBe("block");
    expect(verdict.violationType).toBe("DELEGATION_FIRST");
  });

  // -------------------------------------------------------------------------
  // B. Real end-to-end router path: registry → evaluateGate → runGate → codex
  // -------------------------------------------------------------------------

  it("B. e2e via the REAL router (registry+evaluateGate+runGate+codex) → exitCode 2", async () => {
    const registry = new Registry();
    registry.registerBehavior(BEH_DELEGATION_FIRST);

    const ctx = makeCtx();
    const behaviors = registry.getBehaviorsForGate("pre_tool");
    const verdict = await evaluateGate(behaviors, ctx);

    expect(verdict.decision).toBe("block");

    const result = await runGate({
      root,
      runtime: "codex",
      gateType: "pre_tool",
      event: ctx.event,
      verdict,
    });

    expect(result.claude.decision).toBe("block");
    expect(result.claude.exitCode).toBe(2);
  });

  // -------------------------------------------------------------------------
  // C. apply_patch touching ONLY a .md file → NOT blocked
  // -------------------------------------------------------------------------

  it("C. apply_patch touching ONLY a .md file → allow", () => {
    const verdict = evaluate(makeCtx({ event: applyPatchEvent(ADD_MD_PATCH) }));
    expect(verdict.decision).toBe("allow");
  });

  // -------------------------------------------------------------------------
  // D. Unparseable / missing command → still BLOCKED (fail-closed default)
  // -------------------------------------------------------------------------

  it("D1. apply_patch with unparseable command body → still block (fail closed)", () => {
    const verdict = evaluate(makeCtx({ event: applyPatchEvent(UNPARSEABLE_PATCH) }));
    expect(verdict.decision).toBe("block");
    expect(verdict.violationType).toBe("DELEGATION_FIRST");
  });

  it("D2. apply_patch with missing command field entirely → still block (fail closed)", () => {
    const ctx = makeCtx({
      event: { gateType: "pre_tool", toolName: "apply_patch", toolInput: {} },
    });
    const verdict = evaluate(ctx);
    expect(verdict.decision).toBe("block");
    expect(verdict.violationType).toBe("DELEGATION_FIRST");
  });

  it("D3. apply_patch with blank command → still block (fail closed)", () => {
    const ctx = makeCtx({ event: applyPatchEvent("   ") });
    const verdict = evaluate(ctx);
    expect(verdict.decision).toBe("block");
  });

  // -------------------------------------------------------------------------
  // E. apply_patch write WITH delegation active → allow
  // -------------------------------------------------------------------------

  it("E. apply_patch write with delegation active → allow", () => {
    markLane(root, "sess-main");
    const verdict = evaluate(makeCtx());
    expect(verdict.decision).toBe("allow");
  });

  // -------------------------------------------------------------------------
  // F. Case/separator-insensitive tool name still blocks
  // -------------------------------------------------------------------------

  it("F. 'APPLY_PATCH' (upper-case) still recognized and blocks", () => {
    const ctx = makeCtx({
      event: {
        gateType: "pre_tool",
        toolName: "APPLY_PATCH",
        toolInput: { command: ADD_TS_PATCH },
      },
    });
    const verdict = evaluate(ctx);
    expect(verdict.decision).toBe("block");
    expect(verdict.violationType).toBe("DELEGATION_FIRST");
  });
});
