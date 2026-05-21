/**
 * Tests for BEH-010 — Read-Before-Write
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-010
 *
 * Falsifies-If counter-example (required passing test):
 *   A Write call against an existing file path that was NOT read earlier in the
 *   same session must produce a READ_BEFORE_WRITE violation.
 *   Conversely, a Write to a path that WAS read must NOT produce a violation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── ESM-safe fs mock ──────────────────────────────────────────────────────────
// vi.mock must be hoisted; the factory captures the mock functions.
const mockExistsSync = vi.fn<[string], boolean>();

vi.mock("node:fs", () => ({
  existsSync: (p: string) => mockExistsSync(p),
  readFileSync: vi.fn(),
}));

// Import behavior AFTER mock is set up
import { readBeforeWrite } from "../src/behaviors/beh-010-read-before-write.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { CurrentRiskFile } from "../src/schemas/current-risk.schema.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import type { RunSetFile } from "../src/schemas/run-set.schema.js";
import type { PlanningStateFile } from "../src/schemas/state.schema.js";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeContext(overrides: {
  riskClass?: string;
  sessionReadSet?: ReadonlySet<string>;
}): GateEvaluationContext {
  return {
    projectRoot: "/project",
    state: {} as PlanningStateFile,
    currentRisk: { risk_class: overrides.riskClass ?? "M" } as unknown as CurrentRiskFile,
    runSet: { policy: {}, evidence: [], events: [] } as unknown as RunSetFile,
    sessionReadSet: overrides.sessionReadSet,
  };
}

function makeWriteEvent(filePath: string): GateEvent {
  return {
    gateType: "pre_tool",
    toolName: "Write",
    toolInput: { file_path: filePath, content: "new content" },
  };
}

function makeEditEvent(filePath: string): GateEvent {
  return {
    gateType: "pre_tool",
    toolName: "Edit",
    toolInput: { file_path: filePath, old_string: "old", new_string: "new" },
  };
}

function makeReadEvent(filePath: string): GateEvent {
  return {
    gateType: "pre_tool",
    toolName: "Read",
    toolInput: { file_path: filePath },
  };
}

beforeEach(() => {
  mockExistsSync.mockReset();
});

// ── Module metadata ───────────────────────────────────────────────────────────

describe("BEH-010 descriptor", () => {
  it("has the correct id and name", () => {
    expect(readBeforeWrite.id).toBe("BEH-010");
    expect(readBeforeWrite.name).toBe("Read-Before-Write");
  });

  it("fires only on pre_tool gate", () => {
    expect(readBeforeWrite.gates).toEqual(["pre_tool"]);
  });
});

// ── Abstain cases ─────────────────────────────────────────────────────────────

describe("BEH-010 — abstain cases", () => {
  it("abstains for a Read tool call (not a mutation)", () => {
    const ctx = makeContext({ sessionReadSet: new Set() });
    const event = makeReadEvent("src/foo.ts");
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains for a Bash tool call", () => {
    const ctx = makeContext({ sessionReadSet: new Set() });
    const event: GateEvent = {
      gateType: "pre_tool",
      toolName: "Bash",
      toolInput: { command: "echo hello" },
    };
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains when no sessionReadSet is provided (integration not wired)", () => {
    // When integration layer has not populated sessionReadSet, the behavior must not
    // false-block — it abstains conservatively.
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ sessionReadSet: undefined });
    const event = makeWriteEvent("src/foo.ts");
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains when toolInput has no extractable path", () => {
    const ctx = makeContext({ sessionReadSet: new Set() });
    const event: GateEvent = {
      gateType: "pre_tool",
      toolName: "Write",
      toolInput: { content: "hello" }, // no file_path field
    };
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains for a new file (does not exist on disk) even without a prior read", () => {
    mockExistsSync.mockReturnValue(false); // file does not exist → new-file creation
    const ctx = makeContext({ sessionReadSet: new Set() }); // empty read set
    const event = makeWriteEvent("src/brand-new.ts");
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains when the file WAS read earlier (path in sessionReadSet)", () => {
    mockExistsSync.mockReturnValue(true);
    // The path is normalized to lowercase forward-slash form
    const ctx = makeContext({
      riskClass: "M",
      sessionReadSet: new Set(["src/existing.ts"]),
    });
    const event = makeWriteEvent("src/existing.ts");
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });

  it("abstains for Edit tool when path was read", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({
      riskClass: "H",
      sessionReadSet: new Set(["src/component.ts"]),
    });
    const event = makeEditEvent("src/component.ts");
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });
});

// ── Violation detection ───────────────────────────────────────────────────────

describe("BEH-010 — violation detection", () => {
  it("produces a warn at risk class T for unread existing file", () => {
    mockExistsSync.mockReturnValue(true); // file exists on disk
    const ctx = makeContext({ riskClass: "T", sessionReadSet: new Set() });
    const event = makeWriteEvent("src/existing.ts");
    const verdict = readBeforeWrite.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.reason).toContain("BEH-010");
    expect(verdict?.qualityDimension).toBe("evidence");
  });

  it("produces a warn at risk class L for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "L", sessionReadSet: new Set() });
    const event = makeWriteEvent("src/existing.ts");
    const verdict = readBeforeWrite.classify(ctx, event);
    expect(verdict?.decision).toBe("warn");
  });

  it("produces a BLOCK at risk class M for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set() });
    const event = makeWriteEvent("src/existing.ts");
    const verdict = readBeforeWrite.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces a BLOCK at risk class H for unread existing file", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "H", sessionReadSet: new Set() });
    const event = makeWriteEvent("src/important.ts");
    const verdict = readBeforeWrite.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("blocks Edit tool when path was NOT read at risk class M", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({ riskClass: "M", sessionReadSet: new Set() });
    const event = makeEditEvent("src/component.ts");
    const verdict = readBeforeWrite.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });
});

// ── Falsifies-If counter-example (MUST pass) ─────────────────────────────────

describe("BEH-010 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: a Write to an existing unread path at M MUST produce a block verdict", () => {
    // Spec falsifies_if: "A Write or Edit tool call against an existing file path
    // that was not read earlier in the same session completes without a
    // READ_BEFORE_WRITE_VIOLATION gate event being recorded."
    // This test is the canonical regression guard for that contract.
    mockExistsSync.mockReturnValue(true); // file exists
    const ctx = makeContext({
      riskClass: "M",
      sessionReadSet: new Set(), // path NOT in read set
    });
    const event = makeWriteEvent("src/unread-existing.ts");
    const verdict = readBeforeWrite.classify(ctx, event);

    // MUST produce a violation — not null, not allow
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("was not read in this session");
  });

  it("FALSIFIES-IF: a Write to a path that WAS read MUST NOT produce a violation", () => {
    mockExistsSync.mockReturnValue(true);
    const ctx = makeContext({
      riskClass: "M",
      sessionReadSet: new Set(["src/was-read.ts"]),
    });
    const event = makeWriteEvent("src/was-read.ts");
    // MUST abstain — the read-set check passes
    expect(readBeforeWrite.classify(ctx, event)).toBeNull();
  });
});
