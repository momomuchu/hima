import { describe, expect, it } from "vitest";
import { suppressionGuard } from "../src/behaviors/beh-011-suppression-guard.js";
import type { GateEvaluationContext } from "../src/behavior-registry.js";
import type { GateEvent } from "../src/gate-event.js";
import type { CurrentRiskFile, RunSetFile } from "../src/run-set-types.js";

function makeContext(riskClass = "M"): GateEvaluationContext {
  return {
    projectRoot: "/project",
    currentRisk: { risk_class: riskClass } as CurrentRiskFile,
    runSet: { runId: "r1", policy: {}, evidence: [], events: [], subagents: [] } as RunSetFile,
  };
}

function makeWriteEvent(content: string, toolName = "Write"): GateEvent {
  return { gateType: "post_tool", toolName, toolInput: { file_path: "src/test.ts", content }, toolOutput: "ok" };
}

function makeEditEvent(newString: string): GateEvent {
  return { gateType: "post_tool", toolName: "Edit", toolInput: { file_path: "src/test.ts", old_string: "x", new_string: newString }, toolOutput: "ok" };
}

describe("BEH-011 descriptor", () => {
  it("has the correct id and name", () => {
    expect(suppressionGuard.id).toBe("BEH-011");
    expect(suppressionGuard.name).toBe("Unjustified Suppression Guard");
  });
  it("fires only on post_tool gate", () => {
    expect(suppressionGuard.gates).toEqual(["post_tool"]);
  });
});

describe("BEH-011 — abstain cases", () => {
  it("abstains for a Read tool call", () => {
    const ctx = makeContext();
    const event: GateEvent = { gateType: "post_tool", toolName: "Read", toolInput: { file_path: "src/foo.ts" }, toolOutput: "// @ts-ignore\nconst x: any = {};" };
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });

  it("abstains for a Bash tool call", () => {
    const ctx = makeContext();
    const event: GateEvent = { gateType: "post_tool", toolName: "Bash", toolInput: { command: "echo eslint-disable" } };
    expect(suppressionGuard.classify(ctx, event)).toBeNull();
  });

  it("abstains when written content contains no suppression directives", () => {
    expect(suppressionGuard.classify(makeContext(), makeWriteEvent("const x = 1;\nconst y = 2;"))).toBeNull();
  });

  it("abstains when @ts-ignore has a justification on the preceding line", () => {
    const content = "// TODO: fix after library upgrade provides proper types\n// @ts-ignore\nconst y = {};";
    expect(suppressionGuard.classify(makeContext(), makeWriteEvent(content))).toBeNull();
  });

  it("abstains when eslint-disable has an inline reason separator", () => {
    const content = "const x = 1; // eslint-disable-next-line -- reason: legacy API\neval('x');";
    expect(suppressionGuard.classify(makeContext(), makeWriteEvent(content))).toBeNull();
  });
});

describe("BEH-011 — violation detection", () => {
  it("produces warn at risk class T for unjustified @ts-ignore", () => {
    const verdict = suppressionGuard.classify(makeContext("T"), makeWriteEvent("// @ts-ignore\nconst x: any = {};"));
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.qualityDimension).toBe("suppression");
  });

  it("produces warn at risk class L for unjustified @ts-ignore", () => {
    expect(suppressionGuard.classify(makeContext("L"), makeWriteEvent("// @ts-ignore\nconst x: any = {};"))?.decision).toBe("warn");
  });

  it("produces BLOCK at risk class M for unjustified @ts-ignore", () => {
    const verdict = suppressionGuard.classify(makeContext("M"), makeWriteEvent("// @ts-ignore\nconst x: any = {};"));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-011");
  });

  it("produces BLOCK at risk class M for bare eslint-disable", () => {
    expect(suppressionGuard.classify(makeContext("M"), makeWriteEvent("/* eslint-disable no-eval */\neval('x');"))?.decision).toBe("block");
  });

  it("produces BLOCK at risk class M for @ts-nocheck without justification", () => {
    expect(suppressionGuard.classify(makeContext("M"), makeWriteEvent("// @ts-nocheck\nconst x = 1;"))?.decision).toBe("block");
  });

  it("produces BLOCK for Edit tool with unjustified suppression in new_string", () => {
    expect(suppressionGuard.classify(makeContext("M"), makeEditEvent("// @ts-ignore\nconst x: any = {};"))?.decision).toBe("block");
  });

  it("produces BLOCK at risk class H for unjustified #noqa", () => {
    expect(suppressionGuard.classify(makeContext("H"), makeWriteEvent("import * from module  # noqa\nx = 1"))?.decision).toBe("block");
  });
});

describe("BEH-011 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: write with unjustified eslint-disable MUST produce a block at M", () => {
    const content = "const x = 1;\n// eslint-disable-next-line\nconst y = eval('bad');";
    const verdict = suppressionGuard.classify(makeContext("M"), makeWriteEvent(content));
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-011");
  });

  it("FALSIFIES-IF: write with properly justified suppression MUST NOT produce a violation", () => {
    const content = "// TODO: fix after upstream types are updated\n// @ts-ignore\nconst y = {};";
    expect(suppressionGuard.classify(makeContext("M"), makeWriteEvent(content))).toBeNull();
  });
});
