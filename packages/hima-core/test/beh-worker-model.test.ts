/**
 * Tests for behavior-core/beh-worker-model.ts — BEH_WORKER_MODEL.
 *
 * Mandated scenarios (R-028):
 *   A. subagent spawn with NO explicit model → block (WORKER_MODEL_UNSPECIFIED).
 *   B. subagent spawn with `model` field set → allow.
 *   C. subagent spawn with `subagent_type` field set → allow.
 *
 * Additional coverage:
 *   D. toolInput is null → block (cannot verify; fail-closed).
 *   E. toolInput is undefined → block (fail-closed).
 *   F. model field is empty string → block (whitespace-only treated as absent).
 *   G. subagent_type field is empty string → block (whitespace-only treated as absent).
 *   H. model field is "haiku" → allow.
 *   I. model field is "sonnet" → allow.
 *   J. model field is any non-empty string → allow (no allowlist enforcement here).
 *   K. both model and subagent_type present → allow (model takes precedence).
 *   L. model field is "  " (spaces only) → block (trim semantics).
 *   M. behaviorId is "BEH-WORKER-MODEL" and gates is ["subagent_start"].
 *   N. block reason contains prescribed phrasing from R-028.
 *   O. allow verdict has no violationType.
 *   P. evaluate is synchronous (returns BehaviorVerdict, not Promise).
 */

import { describe, it, expect } from "vitest";
import { BEH_WORKER_MODEL } from "../src/behavior-core/beh-worker-model.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSubagentCtx(toolInput: unknown): BehaviorContext {
  return {
    event: {
      gateType: "subagent_start",
      toolInput,
    },
    riskClass: "H",
    root: "/tmp/fake-root",
    ward: null,
  };
}

async function evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
  return BEH_WORKER_MODEL.evaluate(ctx);
}

// ---------------------------------------------------------------------------
// Descriptor meta
// ---------------------------------------------------------------------------

describe("BEH_WORKER_MODEL — descriptor meta", () => {
  it("M. behaviorId is BEH-WORKER-MODEL", () => {
    expect(BEH_WORKER_MODEL.id).toBe("BEH-WORKER-MODEL");
  });

  it("M. gates is exactly [subagent_start]", () => {
    expect(BEH_WORKER_MODEL.gates).toEqual(["subagent_start"]);
    expect(BEH_WORKER_MODEL.gates).not.toContain("pre_tool");
    expect(BEH_WORKER_MODEL.gates).not.toContain("stop");
    expect(BEH_WORKER_MODEL.gates).not.toContain("user_prompt");
  });
});

// ---------------------------------------------------------------------------
// Block path — missing model
// ---------------------------------------------------------------------------

describe("BEH_WORKER_MODEL — block (no explicit model)", () => {
  it("A. no model or subagent_type field → block (WORKER_MODEL_UNSPECIFIED)", async () => {
    const result = await evaluate(makeSubagentCtx({ task: "analyze the codebase" }));

    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-WORKER-MODEL");
    expect(result.violationType).toBe("WORKER_MODEL_UNSPECIFIED");
  });

  it("D. toolInput is null → block (fail-closed)", async () => {
    const result = await evaluate(makeSubagentCtx(null));

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("WORKER_MODEL_UNSPECIFIED");
  });

  it("E. toolInput is undefined → block (fail-closed)", async () => {
    const result = await evaluate(makeSubagentCtx(undefined));

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("WORKER_MODEL_UNSPECIFIED");
  });

  it("F. model is empty string → block (treated as absent)", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "", task: "do work" }));

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("WORKER_MODEL_UNSPECIFIED");
  });

  it("G. subagent_type is empty string → block (treated as absent)", async () => {
    const result = await evaluate(makeSubagentCtx({ subagent_type: "", task: "do work" }));

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("WORKER_MODEL_UNSPECIFIED");
  });

  it("L. model is whitespace-only → block (trim semantics)", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "   ", task: "do work" }));

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("WORKER_MODEL_UNSPECIFIED");
  });

  it("N. block reason contains the prescribed R-028 phrasing", async () => {
    const result = await evaluate(makeSubagentCtx({}));

    expect(result.reason).toContain("[BEH-WORKER-MODEL]");
    expect(result.reason).toContain("explicit model");
    expect(result.reason).toContain("haiku|sonnet");
  });
});

// ---------------------------------------------------------------------------
// Allow path — explicit model present
// ---------------------------------------------------------------------------

describe("BEH_WORKER_MODEL — allow (explicit model present)", () => {
  it("B. model field set to a non-empty string → allow", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "claude-haiku-4-5", task: "analyze" }));

    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-WORKER-MODEL");
  });

  it("C. subagent_type field set → allow", async () => {
    const result = await evaluate(makeSubagentCtx({ subagent_type: "sonnet", task: "analyze" }));

    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-WORKER-MODEL");
  });

  it("H. model is 'haiku' → allow", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "haiku", task: "do work" }));
    expect(result.decision).toBe("allow");
  });

  it("I. model is 'sonnet' → allow", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "sonnet", task: "do work" }));
    expect(result.decision).toBe("allow");
  });

  it("J. model is any non-empty string → allow (no allowlist enforcement)", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "gpt-4o", task: "do work" }));
    expect(result.decision).toBe("allow");
  });

  it("K. both model and subagent_type present → allow (model takes precedence)", async () => {
    const result = await evaluate(
      makeSubagentCtx({ model: "haiku", subagent_type: "sonnet", task: "analyze" }),
    );

    expect(result.decision).toBe("allow");
    expect(result.reason).toContain("haiku");
  });

  it("O. allow verdict has no violationType", async () => {
    const result = await evaluate(makeSubagentCtx({ model: "haiku", task: "analyze" }));

    expect(result.decision).toBe("allow");
    expect(result.violationType).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Synchrony check
// ---------------------------------------------------------------------------

describe("BEH_WORKER_MODEL — evaluate return type", () => {
  it("P. evaluate returns a BehaviorVerdict synchronously (not wrapped in Promise)", () => {
    const ctx = makeSubagentCtx({ model: "haiku" });
    // Call without await — the result must be the verdict directly (not a Promise).
    const result = BEH_WORKER_MODEL.evaluate(ctx);

    // If it were a Promise, result.decision would be undefined.
    expect((result as BehaviorVerdict).decision).toBe("allow");
    expect((result as BehaviorVerdict).behaviorId).toBe("BEH-WORKER-MODEL");
  });
});
