/**
 * Tests for behavior-core/beh-adr-before-impl.ts — BEH_ADR_BEFORE_IMPL gate.
 *
 * Mandated scenarios (per R-023):
 *  A. Write to src/foo.ts at M, read-set empty → warn (no ADR present)
 *  B. Write to src/foo.ts at M, read-set has docs/adr/0001-arch.md → allow
 *  C. Write to src/service.ts at H, read-set has docs/decisions/0002-db.md → allow
 *  D. Write to src/foo.ts at T → allow (below enforcement floor)
 *  E. Write to src/foo.ts at L → allow (below enforcement floor)
 *
 * Implementation file detection (isImplFile):
 *  F. "src/foo.ts" → impl file (should check ADR)
 *  G. "README.md" → NOT impl (exempt .md)
 *  H. "docs/adr/0001.md" → NOT impl (exempt .md)
 *  I. ".hima/state/ward.json" → NOT impl (exempt .hima/**)
 *  J. ".hima/plans/master.md" → NOT impl (exempt .hima/**)
 *  K. "packages/core/src/index.ts" → impl file
 *
 * ADR detection in read-set (hasAdrInReadSet):
 *  L. read-set with "/docs/adr/0001-arch.md" → true
 *  M. read-set with "/docs/decisions/0002-db.md" → true
 *  N. read-set with only "/src/foo.ts" → false
 *  O. empty read-set → false
 *  P. read-set with "/docs/adr-extra/foo.ts" (not a docs/adr/ segment) → false
 *
 * Tool variants:
 *  Q. Read tool on impl file at M → allow (non-write)
 *  R. Bash tool on impl file at M → allow (non-write)
 *  S. Edit tool, empty read-set, at M → warn
 *  T. MultiEdit tool, empty read-set, at M → warn
 *
 * toolInput edge cases:
 *  U. toolInput is undefined → allow defensively
 *  V. toolInput is null → allow defensively
 *  W. toolInput is a string primitive → allow defensively
 *  X. file_path is empty string → allow defensively
 *
 * Ward / session:
 *  Y. No ward (null), impl file, M, empty read-set → warn (uses session "unknown")
 *
 * Descriptor contract:
 *  Z. descriptor gates = ["pre_tool"]
 *  AA. descriptor id = "BEH-ADR-BEFORE-IMPL"
 *  AB. decision is never "block" (advisory only)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BEH_ADR_BEFORE_IMPL,
  extractTargetPath,
  isImplFile,
  hasAdrInReadSet,
} from "../src/behavior-core/beh-adr-before-impl.js";
import { recordRead } from "../src/read-set.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { Ward, RiskClass } from "@norm/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Evaluate the descriptor (async). */
async function evaluate(ctx: BehaviorContext): Promise<BehaviorVerdict> {
  return BEH_ADR_BEFORE_IMPL.evaluate(ctx);
}

function makeWard(id = "ward-adr-001"): Ward {
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
 * Build a BehaviorContext for ADR-before-impl tests.
 * Defaults: Write to src/foo.ts, M risk class, no ward.
 */
function makeCtx(
  root: string,
  options: {
    toolName?: string;
    filePath?: string;
    rawToolInput?: unknown;
    useUndefinedToolInput?: true;
    riskClass?: RiskClass;
    ward?: Ward | null;
  } = {},
): BehaviorContext {
  const toolInput = options.useUndefinedToolInput
    ? undefined
    : options.rawToolInput !== undefined
      ? options.rawToolInput
      : { file_path: options.filePath ?? "src/foo.ts", content: "x" };

  return {
    event: {
      gateType: "pre_tool",
      toolName: options.toolName ?? "Write",
      toolInput,
    },
    riskClass: options.riskClass ?? "M",
    root,
    ward: options.ward !== undefined ? options.ward : null,
  };
}

// ---------------------------------------------------------------------------
// Test lifecycle — temp directory per suite
// ---------------------------------------------------------------------------

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "hima-adr-test-"));
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Mandated scenarios
// ---------------------------------------------------------------------------

describe("BEH_ADR_BEFORE_IMPL — mandated scenarios", () => {
  it("A. Write to src/foo.ts at M, empty read-set → warn", async () => {
    // Empty read-set: no reads recorded at all.
    const ctx = makeCtx(tempRoot, { riskClass: "M" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("warn");
    expect(result.behaviorId).toBe("BEH-ADR-BEFORE-IMPL");
    expect(result.reason).toContain("[BEH-ADR-BEFORE-IMPL]");
  });

  it("B. Write to src/foo.ts at M, read-set has docs/adr/0001-arch.md → allow", async () => {
    // Record an ADR file in the session read-set (session "unknown" — no ward).
    const adrPath = path.join(tempRoot, "docs", "adr", "0001-arch.md");
    await recordRead(tempRoot, "unknown", adrPath);

    const ctx = makeCtx(tempRoot, { riskClass: "M" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/ADR file is in the session read-set/);
  });

  it("C. Write to src/service.ts at H, read-set has docs/decisions/0002-db.md → allow", async () => {
    const decisionPath = path.join(tempRoot, "docs", "decisions", "0002-db.md");
    await recordRead(tempRoot, "unknown", decisionPath);

    const ctx = makeCtx(tempRoot, {
      filePath: "src/service.ts",
      riskClass: "H",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("D. Write to src/foo.ts at T → allow (below enforcement floor)", async () => {
    const ctx = makeCtx(tempRoot, { riskClass: "T" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });

  it("E. Write to src/foo.ts at L → allow (below enforcement floor)", async () => {
    const ctx = makeCtx(tempRoot, { riskClass: "L" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/below M/);
  });
});

// ---------------------------------------------------------------------------
// isImplFile unit tests
// ---------------------------------------------------------------------------

describe("isImplFile", () => {
  it("F. 'src/foo.ts' → impl file", () => {
    expect(isImplFile("src/foo.ts")).toBe(true);
  });

  it("G. 'README.md' → NOT impl (exempt .md)", () => {
    expect(isImplFile("README.md")).toBe(false);
  });

  it("H. 'docs/adr/0001.md' → NOT impl (exempt .md)", () => {
    expect(isImplFile("docs/adr/0001.md")).toBe(false);
  });

  it("I. '.hima/state/ward.json' → NOT impl (exempt .hima/**)", () => {
    expect(isImplFile(".hima/state/ward.json")).toBe(false);
  });

  it("J. '.hima/plans/master.md' → NOT impl (exempt .hima/**)", () => {
    expect(isImplFile(".hima/plans/master.md")).toBe(false);
  });

  it("K. 'packages/core/src/index.ts' → impl file", () => {
    expect(isImplFile("packages/core/src/index.ts")).toBe(true);
  });

  it("'.hima' bare directory → NOT impl", () => {
    expect(isImplFile(".hima")).toBe(false);
  });

  it("'src/component.tsx' → impl file", () => {
    expect(isImplFile("src/component.tsx")).toBe(true);
  });

  it("leading './' stripped — './src/foo.ts' → impl file", () => {
    expect(isImplFile("./src/foo.ts")).toBe(true);
  });

  it("leading './' stripped — './.hima/state/x.json' → NOT impl", () => {
    expect(isImplFile("./.hima/state/x.json")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAdrInReadSet unit tests
// ---------------------------------------------------------------------------

describe("hasAdrInReadSet", () => {
  it("L. entry containing '/docs/adr/0001-arch.md' → true", () => {
    expect(hasAdrInReadSet(["/project/docs/adr/0001-arch.md"])).toBe(true);
  });

  it("M. entry containing '/docs/decisions/0002-db.md' → true", () => {
    expect(hasAdrInReadSet(["/project/docs/decisions/0002-db.md"])).toBe(true);
  });

  it("N. read-set with only '/src/foo.ts' → false", () => {
    expect(hasAdrInReadSet(["/project/src/foo.ts"])).toBe(false);
  });

  it("O. empty read-set → false", () => {
    expect(hasAdrInReadSet([])).toBe(false);
  });

  it("P. '/docs/adr-extra/foo.ts' (not a docs/adr/ segment) → false", () => {
    expect(hasAdrInReadSet(["/project/docs/adr-extra/foo.ts"])).toBe(false);
  });

  it("multiple entries — ADR present among non-ADR → true", () => {
    expect(
      hasAdrInReadSet([
        "/project/src/foo.ts",
        "/project/docs/adr/0001-arch.md",
        "/project/src/bar.ts",
      ]),
    ).toBe(true);
  });

  it("ADR in read-set (decisions) among non-ADR → true", () => {
    expect(
      hasAdrInReadSet([
        "/project/src/foo.ts",
        "/project/docs/decisions/0002.md",
      ]),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool variants
// ---------------------------------------------------------------------------

describe("BEH_ADR_BEFORE_IMPL — tool variants", () => {
  it("Q. Read tool on impl file at M → allow (non-write)", async () => {
    const ctx = makeCtx(tempRoot, {
      toolName: "Read",
      rawToolInput: { file_path: "src/foo.ts" },
      riskClass: "M",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write/);
  });

  it("R. Bash tool on impl file at M → allow (non-write)", async () => {
    const ctx = makeCtx(tempRoot, {
      toolName: "Bash",
      rawToolInput: { command: "cat src/foo.ts" },
      riskClass: "M",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write/);
  });

  it("S. Edit tool, empty read-set, at M → warn", async () => {
    const ctx = makeCtx(tempRoot, {
      toolName: "Edit",
      rawToolInput: { file_path: "src/foo.ts", new_string: "x" },
      riskClass: "M",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("T. MultiEdit tool, empty read-set, at M → warn", async () => {
    const ctx = makeCtx(tempRoot, {
      toolName: "MultiEdit",
      rawToolInput: { file_path: "src/foo.ts", new_string: "x" },
      riskClass: "M",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// toolInput edge cases
// ---------------------------------------------------------------------------

describe("BEH_ADR_BEFORE_IMPL — toolInput edge cases", () => {
  it("U. toolInput is undefined → allow defensively", async () => {
    const ctx = makeCtx(tempRoot, { useUndefinedToolInput: true });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("V. toolInput is null → allow defensively", async () => {
    const ctx = makeCtx(tempRoot, { rawToolInput: null });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("W. toolInput is a string primitive → allow defensively", async () => {
    const ctx = makeCtx(tempRoot, { rawToolInput: "not-an-object" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("X. file_path is empty string → allow defensively", async () => {
    const ctx = makeCtx(tempRoot, { rawToolInput: { file_path: "", content: "x" } });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });
});

// ---------------------------------------------------------------------------
// Ward / session
// ---------------------------------------------------------------------------

describe("BEH_ADR_BEFORE_IMPL — ward and session", () => {
  it("Y. No ward (null), impl file, M, empty read-set → warn (session 'unknown')", async () => {
    // No ward — session key falls back to "unknown". Read-set is empty.
    const ctx = makeCtx(tempRoot, { ward: null, riskClass: "M" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("warn");
  });

  it("uses ward.id as session key when ward is present", async () => {
    const ward = makeWard("my-session-id");
    // Record ADR under ward.id as session key.
    const adrPath = path.join(tempRoot, "docs", "adr", "0001-arch.md");
    await recordRead(tempRoot, "my-session-id", adrPath);

    const ctx = makeCtx(tempRoot, { ward, riskClass: "M" });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("ADR recorded under wrong session key → warn (different session)", async () => {
    const ward = makeWard("session-A");
    // Record ADR under a DIFFERENT session key.
    const adrPath = path.join(tempRoot, "docs", "adr", "0001.md");
    await recordRead(tempRoot, "session-B", adrPath);

    const ctx = makeCtx(tempRoot, { ward, riskClass: "M" });
    const result = await evaluate(ctx);
    // session-A read-set is empty → warn.
    expect(result.decision).toBe("warn");
  });

  it("Write to .md file at M with empty read-set → allow (non-impl file)", async () => {
    const ctx = makeCtx(tempRoot, {
      filePath: "docs/plans/overview.md",
      riskClass: "M",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not an implementation file/);
  });

  it("Write to .hima/** at M with empty read-set → allow (non-impl file)", async () => {
    const ctx = makeCtx(tempRoot, {
      filePath: ".hima/state/ward.json",
      riskClass: "M",
    });
    const result = await evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not an implementation file/);
  });
});

// ---------------------------------------------------------------------------
// Descriptor contract
// ---------------------------------------------------------------------------

describe("BEH_ADR_BEFORE_IMPL — descriptor contract", () => {
  it("Z. descriptor gates = ['pre_tool']", () => {
    expect(BEH_ADR_BEFORE_IMPL.gates).toEqual(["pre_tool"]);
  });

  it("AA. descriptor id = 'BEH-ADR-BEFORE-IMPL'", () => {
    expect(BEH_ADR_BEFORE_IMPL.id).toBe("BEH-ADR-BEFORE-IMPL");
  });

  it("AB. decision is never 'block' (advisory only)", async () => {
    // Worst case: impl file at C with empty read-set. Still warn, never block.
    const ctx = makeCtx(tempRoot, { riskClass: "C" });
    const result = await evaluate(ctx);
    expect(result.decision).not.toBe("block");
    // It should be either warn (if checking ADR) or allow (if exempt for some reason).
    expect(["warn", "allow"]).toContain(result.decision);
  });
});

// ---------------------------------------------------------------------------
// extractTargetPath unit tests (shared helper)
// ---------------------------------------------------------------------------

describe("extractTargetPath", () => {
  it("returns file_path when present", () => {
    expect(extractTargetPath({ file_path: "src/foo.ts" })).toBe("src/foo.ts");
  });

  it("returns path when file_path is absent", () => {
    expect(extractTargetPath({ path: "src/bar.ts" })).toBe("src/bar.ts");
  });

  it("prefers file_path over path when both present", () => {
    expect(extractTargetPath({ file_path: "src/a.ts", path: "src/b.ts" })).toBe("src/a.ts");
  });

  it("returns undefined for empty string file_path", () => {
    expect(extractTargetPath({ file_path: "" })).toBeUndefined();
  });

  it("returns undefined for non-object toolInput", () => {
    expect(extractTargetPath("string")).toBeUndefined();
    expect(extractTargetPath(null)).toBeUndefined();
    expect(extractTargetPath(undefined)).toBeUndefined();
    expect(extractTargetPath(42)).toBeUndefined();
  });

  it("returns undefined when neither field is present", () => {
    expect(extractTargetPath({ content: "x" })).toBeUndefined();
  });

  it("returns undefined when file_path is non-string", () => {
    expect(extractTargetPath({ file_path: 123 })).toBeUndefined();
  });

  it("trims whitespace from file_path", () => {
    expect(extractTargetPath({ file_path: "  src/foo.ts  " })).toBe("src/foo.ts");
  });

  it("returns undefined when file_path is whitespace-only", () => {
    expect(extractTargetPath({ file_path: "   " })).toBeUndefined();
  });
});
