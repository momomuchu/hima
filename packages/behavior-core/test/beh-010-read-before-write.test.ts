import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExistsSync = vi.fn<[string], boolean>();

vi.mock("node:fs", () => ({
  existsSync: (p: string) => mockExistsSync(p),
  readFileSync: vi.fn(),
}));

import { readBeforeWrite } from "../src/behaviors/beh-010-read-before-write.js";
import type { GateEvaluationContext } from "../src/behavior-registry.js";
import type { GateEvent } from "../src/gate-event.js";
import type { CurrentRiskFile, RunSetFile } from "../src/run-set-types.js";

function makeContext(overrides: {
  riskClass?: string;
  sessionReadSet?: ReadonlySet<string>;
}): GateEvaluationContext {
  return {
    projectRoot: "/project",
    currentRisk: { risk_class: overrides.riskClass ?? "M" } as CurrentRiskFile,
    runSet: { runId: "r1", policy: {}, evidence: [], events: [], subagents: [] } as RunSetFile,
    sessionReadSet: overrides.sessionReadSet,
  };
}

function makeWriteEvent(filePath: string): GateEvent {
  return { gateType: "pre_tool", toolName: "Write", toolInput: { file_path: filePath, content: "new" } };
}

function makeEditEvent(filePath: string): GateEvent {
  return { gateType: "pre_tool", toolName: "Edit", toolInput: { file_path: filePath, old_string: "old", new_string: "new" } };
}

beforeEach(() => { mockExistsSync.mockReset(); });

describe("BEH-010 descriptor", () => {
  it("has the correct id and name", () => {
    expect(readBeforeWrite.id).toBe("BEH-010");
    expect(readBeforeWrite.name).toBe("Read-Before-Write");
  });
  it("fires only on pre_tool gate", () => {
    expect(readBeforeWrite.gates).toEqual(["pre_tool"]);
  });
});

describe("BEH-010 — abstain cases", () => {
  it("abstains for a Read tool call", () => {
    const ctx = makeContext({ sessionReadSet: new Set() });
    const event: GateEvent = { gateType: "pre_tool", toolName: "Read", toolInput: { file_path: "src/foo.ts" } };
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains for a Bash tool call", () => {
    const ctx = makeContext({ sessionReadSet: new Set() });
    const event: GateEvent = { gateType: "pre_tool", toolName: "Bash", toolInput: { command: "echo hello" } };
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains when no sessionReadSet is provided", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ sessionReadSet: undefined });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/foo.ts"))).toBeNull();
  });

  it("abstains when toolInput has no extractable path", () => {
    const ctx = makeContext({ sessionReadSet: new Set() });
    const event: GateEvent = { gateType: "pre_tool", toolName: "Write", toolInput: { content: "hello" } };
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains for a new file (does not exist on disk)", () => {
    mockExistsSync.mockReturnValue(false);
    const ctx = makeContext({ sessionReadSet: new Set() });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/brand-new.ts"))).toBeNull();
  });

  it("abstains when the file WAS read earlier", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set(["src/existing.ts"]) });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/existing.ts"))).toBeNull();
  });

  it("abstains for Edit tool when path was read", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "H", sessionReadSet: new Set(["src/component.ts"]) });
    expect(readBeforeWrite.classify(ctx, makeEditEvent("src/component.ts"))).toBeNull();
  });
});

describe("BEH-010 — violation detection", () => {
  it("produces a warn at risk class T for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "T", sessionReadSet: new Set() });
    const verdict = readBeforeWrite.classify(ctx, makeWriteEvent("src/existing.ts"));
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.reason).toContain("BEH-010");
  });

  it("produces a warn at risk class L for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "L", sessionReadSet: new Set() });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/existing.ts"))?.decision).toBe("warn");
  });

  it("produces a BLOCK at risk class M for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set() });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/existing.ts"))?.decision).toBe("block");
  });

  it("produces a BLOCK at risk class H for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "H", sessionReadSet: new Set() });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/important.ts"))?.decision).toBe("block");
  });

  it("blocks Edit tool when path was NOT read at risk class M", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set() });
    expect(readBeforeWrite.classify(ctx, makeEditEvent("src/component.ts"))?.decision).toBe("block");
  });
});

describe("BEH-010 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: Write to existing unread path at M MUST produce a block", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set() });
    const verdict = readBeforeWrite.classify(ctx, makeWriteEvent("src/unread-existing.ts"));
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("was not read in this session");
  });

  it("FALSIFIES-IF: Write to a path that WAS read MUST NOT produce a violation", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set(["src/was-read.ts"]) });
    expect(readBeforeWrite.classify(ctx, makeWriteEvent("src/was-read.ts"))).toBeNull();
  });
});
