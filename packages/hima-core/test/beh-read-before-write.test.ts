/**
 * Tests for behavior-core/beh-read-before-write.ts — BEH_READ_BEFORE_WRITE gate.
 *
 * Mandated scenarios (per R-003):
 *  A. Write to existing file at M risk, file NOT in read-set → block READ_BEFORE_WRITE
 *  B. Write to existing file at M risk, file IN read-set → allow
 *  C. Write to non-existent file at M risk → allow (new-file allowance)
 *  D. Write at T risk → allow (enforcement not active)
 *  E. Write at L risk → allow (enforcement not active)
 *
 * Content extraction from toolInput:
 *  F. toolInput with "path" key (not "file_path") → extracted, blocks when not in read-set
 *  G. toolInput is undefined → allow defensively
 *  H. toolInput is a primitive → allow defensively
 *  I. toolInput is null → allow defensively
 *
 * Write tool variants:
 *  J. Edit tool name → enforcement triggered
 *  K. MultiEdit tool name → enforcement triggered
 *
 * Non-write tools:
 *  L. Bash → allow
 *  M. Read → allow
 *
 * Risk class coverage:
 *  N. H risk, file exists, NOT in read-set → block
 *  O. C risk, file exists, NOT in read-set → block
 *
 * Ward / session:
 *  P. Ward is null → sessionId "unknown", file exists → block
 *
 * extractTargetPath unit tests:
 *  Q. Prefers file_path over path when both present
 *  R. Returns undefined for empty string file_path
 *  S. Returns undefined for non-object toolInput
 *  T. Returns undefined when neither field is present
 *  U. Returns undefined when file_path is non-string
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BEH_READ_BEFORE_WRITE,
  extractTargetPath,
} from "../src/behavior-core/beh-read-before-write.js";
import { recordRead } from "../src/read-set.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { Ward, RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Evaluate the descriptor and return the verdict. */
async function evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
  return BEH_READ_BEFORE_WRITE.evaluate(ctx);
}

function makeWard(id = "ward-001"): Ward {
  return {
    id,
    entryPoint: "full",
    floor: "M",
    openStage: "spec",
    skillRegister: [],
    verdicts: [],
  };
}

/**
 * Build a BehaviorContext. When `toolInput` is explicitly `null` in overrides,
 * the event.toolInput is set to undefined (cannot pass undefined through an
 * object literal without it being swallowed by ??).
 *
 * `sessionId` — when provided, sets ctx.sessionId so BEH_READ_BEFORE_WRITE
 * uses it as the read-set key (R-003 fix: prefer ctx.sessionId over ward?.id).
 */
function makeCtx(
  root: string,
  overrides: {
    toolName?: string;
    relPath?: string;
    riskClass?: RiskClass;
    ward?: Ward | null;
    rawToolInput?: unknown;
    useUndefinedToolInput?: true;
    sessionId?: string;
  } = {},
): BehaviorContext {
  const toolInput = overrides.useUndefinedToolInput
    ? undefined
    : overrides.rawToolInput !== undefined
      ? overrides.rawToolInput
      : { file_path: overrides.relPath ?? "src/foo.ts", content: "x" };

  return {
    event: {
      gateType: "pre_tool",
      toolName: overrides.toolName ?? "Write",
      toolInput,
    },
    riskClass: overrides.riskClass ?? "M",
    root,
    ward: overrides.ward !== undefined ? overrides.ward : makeWard(),
    ...(overrides.sessionId !== undefined ? { sessionId: overrides.sessionId } : {}),
  };
}

/** Create a target file at the given relative path inside root. */
async function createFile(root: string, relPath: string): Promise<string> {
  const abs = path.join(root, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, "// existing file", "utf8");
  return abs;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let root: string;

beforeEach(async () => {
  // Resolve realpath to avoid macOS /var → /private/var symlink mismatches.
  // recordRead() stores paths via fsRealpath; ctx.root must match the same form.
  const tempBase = await mkdtemp(path.join(tmpdir(), "hima-rbw-"));
  root = await realpath(tempBase);
  await mkdir(path.join(root, ".hima", "state"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BEH_READ_BEFORE_WRITE — read-before-write gate", () => {
  // ── Mandated scenarios ────────────────────────────────────────────────────

  it("A. Write to existing file at M, NOT in read-set → block READ_BEFORE_WRITE", async () => {
    await createFile(root, "src/foo.ts");
    // No recordRead call → empty read-set
    const ctx = makeCtx(root);
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-READ-BEFORE-WRITE");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
    expect(result.reason).toMatch(/Read "src\/foo\.ts" before writing/);
  });

  it("B. Write to existing file at M, file IN read-set → allow", async () => {
    const abs = await createFile(root, "src/foo.ts");
    await recordRead(root, "ward-001", abs);
    const ctx = makeCtx(root);
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-READ-BEFORE-WRITE");
    expect(result.reason).toMatch(/read-set/);
  });

  it("C. Write to non-existent file at M → allow (new-file allowance)", async () => {
    // Do NOT create src/newfile.ts
    const ctx = makeCtx(root, { relPath: "src/newfile.ts" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-READ-BEFORE-WRITE");
    expect(result.reason).toMatch(/does not exist yet/);
  });

  it("D. Write at T risk → allow (enforcement not active)", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, { riskClass: "T" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });

  it("E. Write at L risk → allow (enforcement not active)", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, { riskClass: "L" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });

  // ── Content extraction ────────────────────────────────────────────────────

  it("F. toolInput with 'path' key → extracted, blocks when not in read-set", async () => {
    await createFile(root, "src/bar.ts");
    const ctx = makeCtx(root, {
      rawToolInput: { path: "src/bar.ts", content: "x" },
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  it("G. toolInput is undefined → allow defensively", async () => {
    const ctx = makeCtx(root, { useUndefinedToolInput: true });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("H. toolInput is a string primitive → allow defensively", async () => {
    const ctx = makeCtx(root, { rawToolInput: "not-an-object" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("I. toolInput is null → allow defensively", async () => {
    const ctx = makeCtx(root, { rawToolInput: null });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  // ── Write tool variants ───────────────────────────────────────────────────

  it("J. Edit tool triggers enforcement (existing file, not in read-set → block)", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, {
      toolName: "Edit",
      rawToolInput: { file_path: "src/foo.ts", new_string: "x" },
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  it("K. MultiEdit tool triggers enforcement (existing file, not in read-set → block)", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, {
      toolName: "MultiEdit",
      rawToolInput: { file_path: "src/foo.ts", new_string: "x" },
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  // ── Non-write tools ───────────────────────────────────────────────────────

  it("L. Bash tool at M → allow", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, {
      toolName: "Bash",
      rawToolInput: { command: "ls -la" },
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write/);
  });

  it("M. Read tool at M → allow", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, {
      toolName: "Read",
      rawToolInput: { file_path: "src/foo.ts" },
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  // ── Risk class coverage ───────────────────────────────────────────────────

  it("N. H risk, file exists, NOT in read-set → block", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, { riskClass: "H" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  it("O. C risk, file exists, NOT in read-set → block", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, { riskClass: "C" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  // ── Ward / session ────────────────────────────────────────────────────────

  it("P. Ward is null → sessionId 'unknown', file exists, not in read-set → block", async () => {
    await createFile(root, "src/foo.ts");
    const ctx = makeCtx(root, { ward: null });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  it("read-set absent on disk → treated as empty → block (file exists)", async () => {
    await createFile(root, "src/foo.ts");
    // No read-set file
    const ctx = makeCtx(root);
    const result = await evaluate(ctx);
    expect(result.decision).toBe("block");
  });

  // ── R-003: ctx.sessionId takes precedence over ward?.id ──────────────────
  // These tests verify the key-alignment fix: the behavior must look up the
  // read-set using ctx.sessionId when provided, not ward?.id.

  it("R-003-A. ctx.sessionId provided, read recorded under sessionId → allow", async () => {
    const abs = await createFile(root, "src/foo.ts");
    const sessionId = "explicit-session-r003";
    // Record under the explicit session id — NOT under the ward id ("ward-001")
    await recordRead(root, sessionId, abs);
    // Ward id ("ward-001") ≠ sessionId — if the behavior used ward?.id it would block.
    const ctx = makeCtx(root, { sessionId });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/read-set/);
  });

  it("R-003-B. ctx.sessionId provided but read recorded under ward.id → block (keys mismatch)", async () => {
    const abs = await createFile(root, "src/foo.ts");
    const sessionId = "explicit-session-r003";
    // Record under ward id — different from sessionId
    await recordRead(root, "ward-001", abs);
    const ctx = makeCtx(root, { sessionId });
    const result = await evaluate(ctx);
    // sessionId ≠ "ward-001" → read-set keyed by sessionId is empty → block
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("READ_BEFORE_WRITE");
  });

  it("R-003-C. no ctx.sessionId → falls back to ward?.id → allow when read recorded under ward id", async () => {
    const abs = await createFile(root, "src/foo.ts");
    // Record under ward id (fallback path)
    await recordRead(root, "ward-001", abs);
    // No sessionId in context → behavior falls back to ward?.id = "ward-001"
    const ctx = makeCtx(root);
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/read-set/);
  });

  it("descriptor is registered for pre_tool only", () => {
    expect(BEH_READ_BEFORE_WRITE.gates).toEqual(["pre_tool"]);
    expect(BEH_READ_BEFORE_WRITE.gates).not.toContain("stop");
  });

  it("descriptor id is BEH-READ-BEFORE-WRITE", () => {
    expect(BEH_READ_BEFORE_WRITE.id).toBe("BEH-READ-BEFORE-WRITE");
  });
});

// ---------------------------------------------------------------------------
// Unit tests for extractTargetPath
// ---------------------------------------------------------------------------

describe("extractTargetPath", () => {
  it("Q. prefers file_path over path when both present", () => {
    expect(extractTargetPath({ file_path: "src/a.ts", path: "src/b.ts" })).toBe("src/a.ts");
  });

  it("falls back to path when file_path is absent", () => {
    expect(extractTargetPath({ path: "src/b.ts" })).toBe("src/b.ts");
  });

  it("R. returns undefined for empty string file_path", () => {
    expect(extractTargetPath({ file_path: "" })).toBeUndefined();
  });

  it("S. returns undefined for non-object toolInput", () => {
    expect(extractTargetPath(null)).toBeUndefined();
    expect(extractTargetPath(42)).toBeUndefined();
    expect(extractTargetPath("string")).toBeUndefined();
    expect(extractTargetPath(undefined)).toBeUndefined();
  });

  it("T. returns undefined when neither file_path nor path is present", () => {
    expect(extractTargetPath({ content: "x" })).toBeUndefined();
  });

  it("U. returns undefined when file_path is a non-string", () => {
    expect(extractTargetPath({ file_path: 42 })).toBeUndefined();
  });

  it("trims whitespace from valid paths", () => {
    expect(extractTargetPath({ file_path: "  src/foo.ts  " })).toBe("src/foo.ts");
  });
});
