/**
 * Tests for behavior-core/beh-falsifies-if.ts — BEH_FALSIFIES_IF gate.
 *
 * Mandated scenarios (per R-004):
 *  A. Write to claim-bearing path (docs/business-model/) WITHOUT Falsifies-If → block MISSING_FALSIFIES_IF
 *  B. Write to claim-bearing path WITH Falsifies-If → allow
 *  C. Write to docs/decisions/ WITHOUT Falsifies-If → block
 *  D. Write to non-claim-bearing path → allow
 *  E. Non-write tool → allow
 *
 * Claim-bearing path variants:
 *  F. docs/business-model/research-* → NOT claim-bearing → allow
 *  G. docs/business-model/verification-* → NOT claim-bearing → allow
 *  H. docs/business-model/strategy-diagnosis.md → claim-bearing → blocks
 *  I. docs/decisions/0001-foo.md → claim-bearing → blocks
 *
 * Frontmatter claim-bearing:
 *  J. Non-claim-bearing path + frontmatter claim-bearing:true + no Falsifies-If → block
 *  K. Non-claim-bearing path + frontmatter claim-bearing:true + Falsifies-If present → allow
 *  L. Non-claim-bearing path + no frontmatter → allow
 *
 * Content extraction:
 *  M. Content from "new_string" field (Edit tool) → used correctly
 *  N. Content from "content" field (Write tool) → used correctly
 *  O. toolInput with missing content → allow defensively
 *  P. toolInput with missing path → allow defensively
 *
 * All floors fire (criticality-independent):
 *  Q. T risk + claim-bearing + no Falsifies-If → block
 *  R. L risk + claim-bearing + no Falsifies-If → block
 *  S. M risk + claim-bearing + no Falsifies-If → block
 *  T. H risk + claim-bearing + no Falsifies-If → block
 *  U. C risk + claim-bearing + no Falsifies-If → block
 *
 * Helper unit tests:
 *  isClaimBearingPath, hasClaimBearingFrontmatter, hasFalsifiesIf,
 *  extractTargetPath, extractContent.
 */

import { describe, it, expect } from "vitest";
import {
  BEH_FALSIFIES_IF,
  isClaimBearingPath,
  hasClaimBearingFrontmatter,
  hasFalsifiesIf,
  extractTargetPath,
  extractContent,
} from "../src/behavior-core/beh-falsifies-if.js";
import type { BehaviorContext, BehaviorVerdict } from "../src/behavior-core/types.js";
import type { RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function evaluate(ctx: BehaviorContext): BehaviorVerdict {
  const result = BEH_FALSIFIES_IF.evaluate(ctx);
  // evaluate() is synchronous; wrap in case the type is Promise<BehaviorVerdict>
  if (result instanceof Promise) throw new Error("Expected synchronous result");
  return result;
}

function makeCtx(overrides: {
  toolName?: string;
  filePath?: string;
  content?: string;
  riskClass?: RiskClass;
  contentKey?: "content" | "new_string";
}): BehaviorContext {
  const {
    toolName = "Write",
    filePath = "docs/business-model/strategy.md",
    content = "# Strategy\n\nFalsifies-If: metric drops below 10%\n",
    riskClass = "H",
    contentKey = "content",
  } = overrides;

  return {
    event: {
      gateType: "pre_tool",
      toolName,
      toolInput: filePath !== ""
        ? { file_path: filePath, [contentKey]: content }
        : undefined,
    },
    riskClass,
    root: "/tmp/test-project",
    ward: null,
  };
}

/** Content without a Falsifies-If block. */
const CONTENT_NO_FALSIFIES = `# Strategy Diagnosis

This document describes the go-to-market approach.

## Risks

- Market saturation
`;

/** Content with a Falsifies-If block. */
const CONTENT_WITH_FALSIFIES = `# Strategy Diagnosis

This document describes the go-to-market approach.

Falsifies-If: Monthly active users drop below 100 within 90 days.
`;

// ---------------------------------------------------------------------------
// BEH_FALSIFIES_IF descriptor tests
// ---------------------------------------------------------------------------

describe("BEH_FALSIFIES_IF — falsifies-if gate", () => {
  // ── Mandated scenarios ────────────────────────────────────────────────────

  it("A. Write to docs/business-model/ WITHOUT Falsifies-If → block MISSING_FALSIFIES_IF", () => {
    const ctx = makeCtx({
      filePath: "docs/business-model/strategy-diagnosis.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.behaviorId).toBe("BEH-FALSIFIES-IF");
    expect(result.violationType).toBe("MISSING_FALSIFIES_IF");
    expect(result.reason).toMatch(/Falsifies-If/);
  });

  it("B. Write to docs/business-model/ WITH Falsifies-If → allow", () => {
    const ctx = makeCtx({
      filePath: "docs/business-model/strategy-diagnosis.md",
      content: CONTENT_WITH_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.behaviorId).toBe("BEH-FALSIFIES-IF");
  });

  it("C. Write to docs/decisions/ WITHOUT Falsifies-If → block", () => {
    const ctx = makeCtx({
      filePath: "docs/decisions/0001-auth-strategy.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("MISSING_FALSIFIES_IF");
  });

  it("D. Write to non-claim-bearing path → allow", () => {
    const ctx = makeCtx({
      filePath: "src/index.ts",
      content: "export {};",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/not a claim-bearing/);
  });

  it("E. Non-write tool (Bash) → allow", () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "Bash",
        toolInput: { command: "ls -la" },
      },
      riskClass: "H",
      root: "/tmp/test-project",
      ward: null,
    };
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/non-write/);
  });

  // ── Claim-bearing path variants ───────────────────────────────────────────

  it("F. docs/business-model/research-* → NOT claim-bearing → allow", () => {
    const ctx = makeCtx({
      filePath: "docs/business-model/research-market-analysis.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("G. docs/business-model/verification-* → NOT claim-bearing → allow", () => {
    const ctx = makeCtx({
      filePath: "docs/business-model/verification-pmf-metrics.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("H. docs/business-model/strategy-diagnosis.md → claim-bearing → blocks without Falsifies-If", () => {
    const ctx = makeCtx({
      filePath: "docs/business-model/strategy-diagnosis.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
  });

  it("I. docs/decisions/0001-foo.md → claim-bearing → blocks without Falsifies-If", () => {
    const ctx = makeCtx({
      filePath: "docs/decisions/0001-project-identity.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("MISSING_FALSIFIES_IF");
  });

  // ── Frontmatter claim-bearing ─────────────────────────────────────────────

  it("J. Non-claim-bearing path + frontmatter claim-bearing:true + no Falsifies-If → block", () => {
    const content = `---\nclaim-bearing: true\n---\n\n# My File\n\nSome content here.\n`;
    const ctx = makeCtx({
      filePath: "src/some-module.ts",
      content,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("MISSING_FALSIFIES_IF");
  });

  it("K. Non-claim-bearing path + frontmatter claim-bearing:true + Falsifies-If → allow", () => {
    const content = `---\nclaim-bearing: true\n---\n\n# My File\n\nFalsifies-If: users drop below 50\n`;
    const ctx = makeCtx({
      filePath: "src/some-module.ts",
      content,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("L. Non-claim-bearing path + no frontmatter → allow", () => {
    const ctx = makeCtx({
      filePath: "src/utils.ts",
      content: "// no frontmatter",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  // ── Content extraction ────────────────────────────────────────────────────

  it("M. Content from 'new_string' field (Edit) → used correctly", () => {
    const ctx = makeCtx({
      toolName: "Edit",
      filePath: "docs/decisions/0002-db.md",
      content: CONTENT_NO_FALSIFIES,
      contentKey: "new_string",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("MISSING_FALSIFIES_IF");
  });

  it("N. Content from 'content' field (Write) → used correctly", () => {
    const ctx = makeCtx({
      toolName: "Write",
      filePath: "docs/decisions/0002-db.md",
      content: CONTENT_WITH_FALSIFIES,
      contentKey: "content",
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
  });

  it("O. toolInput with missing content → allow defensively", () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "Write",
        toolInput: { file_path: "docs/decisions/0001-foo.md" }, // no content
      },
      riskClass: "H",
      root: "/tmp/test-project",
      ward: null,
    };
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  it("P. toolInput with missing path → allow defensively", () => {
    const ctx: BehaviorContext = {
      event: {
        gateType: "pre_tool",
        toolName: "Write",
        toolInput: { content: CONTENT_NO_FALSIFIES }, // no file_path or path
      },
      riskClass: "H",
      root: "/tmp/test-project",
      ward: null,
    };
    const result = evaluate(ctx);
    expect(result.decision).toBe("allow");
    expect(result.reason).toMatch(/defensively/);
  });

  // ── All floors fire ───────────────────────────────────────────────────────

  it("Q. T risk + claim-bearing + no Falsifies-If → block (fires at all floors)", () => {
    const ctx = makeCtx({
      riskClass: "T",
      filePath: "docs/decisions/0001-auth.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("MISSING_FALSIFIES_IF");
  });

  it("R. L risk + claim-bearing + no Falsifies-If → block", () => {
    const ctx = makeCtx({
      riskClass: "L",
      filePath: "docs/decisions/0001-auth.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
  });

  it("S. M risk + claim-bearing + no Falsifies-If → block", () => {
    const ctx = makeCtx({
      riskClass: "M",
      filePath: "docs/decisions/0001-auth.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
  });

  it("T. H risk + claim-bearing + no Falsifies-If → block", () => {
    const ctx = makeCtx({
      riskClass: "H",
      filePath: "docs/decisions/0001-auth.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
  });

  it("U. C risk + claim-bearing + no Falsifies-If → block", () => {
    const ctx = makeCtx({
      riskClass: "C",
      filePath: "docs/decisions/0001-auth.md",
      content: CONTENT_NO_FALSIFIES,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("block");
  });

  it("descriptor is registered for pre_tool only", () => {
    expect(BEH_FALSIFIES_IF.gates).toEqual(["pre_tool"]);
    expect(BEH_FALSIFIES_IF.gates).not.toContain("stop");
  });

  it("descriptor id is BEH-FALSIFIES-IF", () => {
    expect(BEH_FALSIFIES_IF.id).toBe("BEH-FALSIFIES-IF");
  });
});

// ---------------------------------------------------------------------------
// Unit tests for isClaimBearingPath
// ---------------------------------------------------------------------------

describe("isClaimBearingPath", () => {
  it("matches docs/business-model/*.md", () => {
    expect(isClaimBearingPath("docs/business-model/strategy-diagnosis.md")).toBe(true);
  });

  it("matches docs/business-model/sub/file.md", () => {
    expect(isClaimBearingPath("docs/business-model/sub/file.md")).toBe(true);
  });

  it("does NOT match docs/business-model/research-*.md", () => {
    expect(isClaimBearingPath("docs/business-model/research-market.md")).toBe(false);
  });

  it("does NOT match docs/business-model/verification-*.md", () => {
    expect(isClaimBearingPath("docs/business-model/verification-pmf.md")).toBe(false);
  });

  it("matches docs/decisions/0001-foo.md", () => {
    expect(isClaimBearingPath("docs/decisions/0001-foo.md")).toBe(true);
  });

  it("does NOT match src/index.ts", () => {
    expect(isClaimBearingPath("src/index.ts")).toBe(false);
  });

  it("does NOT match docs/specs/SPEC-001.md", () => {
    expect(isClaimBearingPath("docs/specs/SPEC-001.md")).toBe(false);
  });

  it("matches absolute path containing docs/business-model/", () => {
    expect(isClaimBearingPath("/Users/dev/hima/docs/business-model/pricing.md")).toBe(true);
  });

  it("matches absolute path containing docs/decisions/", () => {
    expect(isClaimBearingPath("/Users/dev/hima/docs/decisions/0001.md")).toBe(true);
  });

  it("handles Windows-style backslash separators", () => {
    expect(isClaimBearingPath("docs\\decisions\\0001-foo.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for hasClaimBearingFrontmatter
// ---------------------------------------------------------------------------

describe("hasClaimBearingFrontmatter", () => {
  it("detects 'claim-bearing: true' in frontmatter", () => {
    expect(
      hasClaimBearingFrontmatter("---\nclaim-bearing: true\n---\n\n# Content"),
    ).toBe(true);
  });

  it("detects with extra whitespace around colon", () => {
    expect(hasClaimBearingFrontmatter("claim-bearing:  true\n")).toBe(true);
  });

  it("returns false for 'claim-bearing: false'", () => {
    expect(hasClaimBearingFrontmatter("claim-bearing: false\n")).toBe(false);
  });

  it("returns false when key is absent", () => {
    expect(hasClaimBearingFrontmatter("# My doc\n\nNo frontmatter.")).toBe(false);
  });

  it("returns false for 'claim-bearing: true' embedded mid-word", () => {
    // Pattern is line-anchored; this must be a standalone line
    expect(hasClaimBearingFrontmatter("some text claim-bearing: true other")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for hasFalsifiesIf
// ---------------------------------------------------------------------------

describe("hasFalsifiesIf", () => {
  it("detects 'Falsifies-If:' as standalone line", () => {
    expect(hasFalsifiesIf("Falsifies-If: metric drops\n")).toBe(true);
  });

  it("detects with leading whitespace (indented in a list)", () => {
    expect(hasFalsifiesIf("  Falsifies-If: something\n")).toBe(true);
  });

  it("detects in the middle of a longer document", () => {
    const doc = `# Title\n\nSome content.\n\nFalsifies-If: users drop below 100.\n\n## Next`;
    expect(hasFalsifiesIf(doc)).toBe(true);
  });

  it("returns false when absent", () => {
    expect(hasFalsifiesIf("# Title\n\nNo falsifies block here.")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for extractTargetPath (beh-falsifies-if version)
// ---------------------------------------------------------------------------

describe("extractTargetPath (falsifies-if)", () => {
  it("extracts file_path", () => {
    expect(extractTargetPath({ file_path: "docs/decisions/0001.md" })).toBe(
      "docs/decisions/0001.md",
    );
  });

  it("falls back to path", () => {
    expect(extractTargetPath({ path: "docs/decisions/0001.md" })).toBe(
      "docs/decisions/0001.md",
    );
  });

  it("returns undefined for empty file_path", () => {
    expect(extractTargetPath({ file_path: "" })).toBeUndefined();
  });

  it("returns undefined for non-object", () => {
    expect(extractTargetPath(null)).toBeUndefined();
    expect(extractTargetPath(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unit tests for extractContent
// ---------------------------------------------------------------------------

describe("extractContent", () => {
  it("extracts 'content' field (Write)", () => {
    expect(extractContent({ file_path: "x.md", content: "Hello" })).toBe("Hello");
  });

  it("falls back to 'new_string' (Edit)", () => {
    expect(extractContent({ file_path: "x.md", new_string: "World" })).toBe("World");
  });

  it("returns empty string when content is empty", () => {
    expect(extractContent({ content: "" })).toBe("");
  });

  it("returns undefined when neither field is present", () => {
    expect(extractContent({ file_path: "x.md" })).toBeUndefined();
  });

  it("returns undefined for non-object toolInput", () => {
    expect(extractContent(null)).toBeUndefined();
    expect(extractContent(undefined)).toBeUndefined();
  });
});
