/**
 * Tests for BEH-012 — Chesterton's Fence Delete Guard
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-012
 *
 * Falsifies-If counter-example (required passing test):
 *   A file deletion against an existing file that contains no recognized rationale
 *   comment MUST produce a CHESTERTON_FENCE_VIOLATION.
 *   A deletion against a file WITH a rationale comment MUST abstain.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── ESM-safe fs mock ──────────────────────────────────────────────────────────
const mockExistsSync = vi.fn<[string], boolean>();
const mockReadFileSync = vi.fn<[string, unknown], string>();

vi.mock("node:fs", () => ({
  existsSync: (p: string) => mockExistsSync(p),
  readFileSync: (p: string, opts: unknown) => mockReadFileSync(p, opts),
}));

import { chestertonFence } from "../src/behaviors/beh-012-chesterton-fence.js";
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

function makeBashEvent(command: string): GateEvent {
  return {
    gateType: "pre_tool",
    toolName: "Bash",
    toolInput: { command },
  };
}

function makeTruncationWriteEvent(filePath: string): GateEvent {
  return {
    gateType: "pre_tool",
    toolName: "Write",
    toolInput: { file_path: filePath, content: "" },
  };
}

beforeEach(() => {
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
});

// ── Module metadata ───────────────────────────────────────────────────────────

describe("BEH-012 descriptor", () => {
  it("has the correct id and name", () => {
    expect(chestertonFence.id).toBe("BEH-012");
    expect(chestertonFence.name).toBe("Chesterton's Fence Delete Guard");
  });

  it("fires only on pre_tool gate", () => {
    expect(chestertonFence.gates).toEqual(["pre_tool"]);
  });
});

// ── Abstain cases ─────────────────────────────────────────────────────────────

describe("BEH-012 — abstain cases", () => {
  it("abstains for a Read tool call", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "pre_tool",
      toolName: "Read",
      toolInput: { file_path: "src/foo.ts" },
    };
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });

  it("abstains for Bash that is not a deletion command", () => {
    const ctx = makeContext();
    const event = makeBashEvent("npm test");
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });

  it("abstains for Write with non-empty content (not a truncation)", () => {
    const ctx = makeContext();
    const event: GateEvent = {
      gateType: "pre_tool",
      toolName: "Write",
      toolInput: { file_path: "src/foo.ts", content: "const x = 1;" },
    };
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });

  it("abstains for deletion of a file that does not exist on disk", () => {
    mockExistsSync.mockReturnValue(false); // file doesn't exist
    const ctx = makeContext();
    const event = makeBashEvent("rm src/ghost.ts");
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });

  it("abstains for deletion of a file that HAS a rationale comment (why)", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      "// why: this file was superseded by the new router module\nconst x = 1;",
    );
    const ctx = makeContext("M");
    const event = makeBashEvent("rm src/old-router.ts");
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });

  it("abstains when file has a TODO comment (purpose is known-pending)", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("// TODO: remove once migration is complete\nconst x = 1;");
    const ctx = makeContext("H");
    const event = makeBashEvent("rm src/legacy.ts");
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });

  it("abstains when file has a NOTE comment", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("// NOTE: temporary adapter — superseded by v2\nconst x = 1;");
    const ctx = makeContext("M");
    const event = makeBashEvent("rm src/adapter.ts");
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });
});

// ── Violation detection ───────────────────────────────────────────────────────

describe("BEH-012 — violation detection", () => {
  it("produces warn at risk class T for file with no rationale", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("const x = 1;\nconst y = 2;");
    const ctx = makeContext("T");
    const event = makeBashEvent("rm src/no-rationale.ts");
    const verdict = chestertonFence.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.qualityDimension).toBe("evidence");
  });

  it("produces BLOCK at risk class M for file with no rationale", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("export const foo = 1;");
    const ctx = makeContext("M");
    const event = makeBashEvent("rm src/module.ts");
    const verdict = chestertonFence.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-012");
  });

  it("produces BLOCK for rimraf command on file with no rationale", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("const unused = true;");
    const ctx = makeContext("M");
    const event = makeBashEvent("rimraf dist/old-module.js");
    const verdict = chestertonFence.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK for truncation Write (empty content) on existing file with no rationale", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("const data = {};");
    const ctx = makeContext("M");
    const event = makeTruncationWriteEvent("src/data.ts");
    const verdict = chestertonFence.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK at risk class H for file with no rationale", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("export function criticalFn() {}");
    const ctx = makeContext("H");
    const event = makeBashEvent("rm -rf src/critical.ts");
    const verdict = chestertonFence.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });
});

// ── Falsifies-If counter-example (MUST pass) ─────────────────────────────────

describe("BEH-012 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: deletion of existing file with no rationale comment MUST produce block at M", () => {
    // Spec falsifies_if: "A file deletion completes against an existing file that
    // contains no recognized rationale comment, without a CHESTERTON_FENCE_VIOLATION
    // being recorded in run-set.json."
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      // No comment with why/rationale/purpose/NOTE/FIXME/TODO
      "export const MAGIC_NUMBER = 42;\nexport const VERSION = '1.0.0';",
    );
    const ctx = makeContext("M");
    const event = makeBashEvent("rm src/constants.ts");
    const verdict = chestertonFence.classify(ctx, event);

    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("no rationale comment");
  });

  it("FALSIFIES-IF: deletion of file WITH rationale comment MUST NOT produce a violation", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      "// rationale: this module was replaced by the unified store pattern\nexport const old = {};",
    );
    const ctx = makeContext("H");
    const event = makeBashEvent("rm src/old-store.ts");
    expect(chestertonFence.classify(ctx, event)).toBeNull();
  });
});
