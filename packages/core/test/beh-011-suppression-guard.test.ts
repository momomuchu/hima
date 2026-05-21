/**
 * Tests for BEH-011 — Unjustified Suppression Guard
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-011
 *
 * Falsifies-If counter-example (required passing test):
 *   A file write containing an eslint-disable or @ts-expect-error directive WITHOUT an
 *   adjacent justification comment MUST produce an UNJUSTIFIED_SUPPRESSION violation.
 *   A write with a properly justified suppression must NOT produce a violation.
 */

import { describe, expect, it } from "vitest";
import { suppressionGuard } from "../src/behaviors/beh-011-suppression-guard.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { CurrentRiskFile } from "../src/schemas/current-risk.schema.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import type { RunSetFile } from "../src/schemas/run-set.schema.js";
import type { PlanningStateFile } from "../src/schemas/state.schema.js";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeContext(riskClass = "M"): GateEvaluationContext {
  return {
    projectRoot: "/project",
    state: {} as PlanningStateFile,
    currentRisk: { risk_class: riskClass } as unknown as CurrentRiskFile,
    runSet: { policy: {}, evidence: [], events: [] } as unknown as RunSetFile,
  };
}

function makeWriteEvent(content: string, toolName = "Write"): GateEvent {
  return {
    gateType: "post_tool",
    toolName,
    toolInput: { file_path: "src/test.ts", content },
    toolOutput: "File written successfully",
  };
}

function makeEditEvent(newString: string): GateEvent {
  return {
    gateType: "post_tool",
    toolName: "Edit",
    toolInput: {
      file_path: "src/test.ts",
      old_string: "const x = 1;",
      new_string: newString,
    },
    toolOutput: "File edited successfully",
  };
}

// ── Module metadata ───────────────────────────────────────────────────────────

describe("BEH-011 descriptor", () => {
  it("has the correct id and name", () => {
    expect(suppressionGuard.id).toBe("BEH-011");
    expect(suppressionGuard.name).toBe("Unjustified Suppression Guard");
  });

  it("fires only on post_tool gate", () => {
    expect(suppressionGuard.gates).toEqual(["post_tool"]);
  });
});

// ── Abstain cases ─────────────────────────────────────────────────────────────

describe("BEH-011 — abstain cases", () => {
  it("abstains for a Read tool call (not a mutation)", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "post_tool",
      toolName: "Read",
      toolInput: { file_path: "src/foo.ts" },
      toolOutput: "// @ts-ignore\nconst x: any = {};",
    };
    // Output text contains @ts-expect-error but Read is not a write mutation — must abstain
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });

  it("abstains for a Bash tool call", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "post_tool",
      toolName: "Bash",
      toolInput: { command: "echo eslint-disable" },
    };
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });

  it("abstains when written content contains no suppression directives", () => {
    const ctx = makeContext();
    const event = makeWriteEvent("const x = 1;\nconst y = 2;");
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });

  it("abstains when @ts-ignore has a justification on the preceding line", () => {
    const ctx = makeContext();
    const content =
      "// TODO: fix after library upgrade provides proper types\n// @ts-ignore\nconst y = {};";
    const event = makeWriteEvent(content);
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });

  it("abstains when eslint-disable has an inline reason separator", () => {
    const ctx = makeContext();
    // "-- reason: legacy API" is a recognized justification separator
    const content = "const x = 1; // eslint-disable-next-line -- reason: legacy API\neval('x');";
    const event = makeWriteEvent(content);
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });
});

// ── Violation detection ───────────────────────────────────────────────────────

describe("BEH-011 — violation detection", () => {
  it("produces warn at risk class T for unjustified @ts-ignore", () => {
    const ctx = makeContext("T");
    const event = makeWriteEvent("// @ts-ignore\nconst x: any = {};");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.qualityDimension).toBe("suppression");
  });

  it("produces warn at risk class L for unjustified @ts-ignore", () => {
    const ctx = makeContext("L");
    const event = makeWriteEvent("// @ts-ignore\nconst x: any = {};");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("produces BLOCK at risk class M for unjustified @ts-ignore", () => {
    const ctx = makeContext("M");
    const event = makeWriteEvent("// @ts-ignore\nconst x: any = {};");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-011");
  });

  it("produces BLOCK at risk class M for bare eslint-disable", () => {
    const ctx = makeContext("M");
    const event = makeWriteEvent("/* eslint-disable no-eval */\neval('x');");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK at risk class M for @ts-nocheck without justification", () => {
    const ctx = makeContext("M");
    const event = makeWriteEvent("// @ts-nocheck\nconst x = 1;");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK for Edit tool with unjustified suppression in new_string", () => {
    const ctx = makeContext("M");
    const event = makeEditEvent("// @ts-ignore\nconst x: any = {};");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK at risk class H for unjustified #noqa", () => {
    const ctx = makeContext("H");
    // Python-style noqa
    const event = makeWriteEvent("import * from module  # noqa\nx = 1");
    const verdict = suppressionGuard.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });
});

// ── Falsifies-If counter-example (MUST pass) ─────────────────────────────────

describe("BEH-011 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: write with unjustified eslint-disable reaches post_tool without violation", () => {
    // Spec falsifies_if: "A file write containing an eslint-disable or @ts-expect-error
    // directive without an adjacent justification comment reaches DONE_VERIFIED
    // without a UNJUSTIFIED_SUPPRESSION violation in run-set.json."
    // This test is the canonical regression guard.
    const ctx = makeContext("M");
    const content = "const x = 1;\n// eslint-disable-next-line\nconst y = eval('bad');";
    const event = makeWriteEvent(content);
    const verdict = suppressionGuard.classify(ctx, event);

    // MUST produce a violation — not null
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-011");
  });

  it("FALSIFIES-IF: write with properly justified suppression MUST NOT produce a violation", () => {
    const ctx = makeContext("M");
    // Justification is on the preceding line
    const content =
      "// TODO: fix after upstream types are updated\n" + "// @ts-ignore\n" + "const y = {};";
    const event = makeWriteEvent(content);
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });
});
