/**
 * Tests for adapter-hermes.ts — translateHermes() ACP response mapping.
 *
 * Scenarios:
 *  1.  hard-block       → raw.action="block", raw.message=reason, decision="block", exitCode=2
 *  2.  skill-force      → raw.action="block", raw.message=reason, decision="block", exitCode=2
 *  3.  constrained-inject (short)  → raw.action="continue", raw.content=systemMessage, decision="continue", exitCode=0
 *  4.  constrained-inject (long)   → raw.content truncated to ≤1800 bytes
 *  5.  rich-inject (short)         → DOWNGRADED: raw.action="continue", raw.content=content, decision="continue", exitCode=0
 *  6.  rich-inject (long)          → raw.content truncated to ≤1800 bytes
 *  7.  deferred-block   → raw.action="continue", no raw.content, decision="continue", exitCode=0
 *  8.  observe-only     → raw.action="continue", decision="continue", exitCode=0
 *  9.  noop             → raw.action="continue", decision="continue", exitCode=0
 * 10.  hard-block additionalContext is absent (not set for block decisions)
 * 11.  constrained-inject additionalContext carries full (untruncated) content
 * 12.  rich-inject additionalContext carries full (untruncated) content
 * 13.  Truncation: multi-byte UTF-8 boundary safe (no garbled tail)
 */

import { describe, it, expect } from "vitest";
import { translateHermes } from "../src/adapter-hermes.js";
import type { ForceAction } from "@norm/schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OVER_1800 = "x".repeat(2000);
const MULTI_BYTE_OVER_1800 = "é".repeat(1000); // 2 bytes each → 2000 bytes total

// ---------------------------------------------------------------------------
// hard-block
// ---------------------------------------------------------------------------

describe("translateHermes — hard-block", () => {
  const action: ForceAction = { kind: "hard-block", reason: "forbidden tool" };

  it("sets decision to block", () => {
    expect(translateHermes(action).decision).toBe("block");
  });

  it("sets exitCode to 2", () => {
    expect(translateHermes(action).exitCode).toBe(2);
  });

  it("emits raw ACP block with message=reason", () => {
    const { raw } = translateHermes(action);
    expect(raw.action).toBe("block");
    expect((raw as { action: string; message: string }).message).toBe("forbidden tool");
  });

  it("carries reason at top level", () => {
    expect(translateHermes(action).reason).toBe("forbidden tool");
  });

  it("does not set additionalContext", () => {
    expect(translateHermes(action).additionalContext).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// skill-force
// ---------------------------------------------------------------------------

describe("translateHermes — skill-force", () => {
  const action: ForceAction = {
    kind: "skill-force",
    skillId: "corpus-security",
    reason: "skill required",
  };

  it("sets decision to block", () => {
    expect(translateHermes(action).decision).toBe("block");
  });

  it("sets exitCode to 2", () => {
    expect(translateHermes(action).exitCode).toBe(2);
  });

  it("emits raw ACP block with message=reason", () => {
    const { raw } = translateHermes(action);
    expect(raw.action).toBe("block");
    expect((raw as { action: string; message: string }).message).toBe("skill required");
  });
});

// ---------------------------------------------------------------------------
// constrained-inject — short content (under 1800 bytes)
// ---------------------------------------------------------------------------

describe("translateHermes — constrained-inject (short)", () => {
  const action: ForceAction = {
    kind: "constrained-inject",
    systemMessage: "apply rule X",
  };

  it("sets decision to continue", () => {
    expect(translateHermes(action).decision).toBe("continue");
  });

  it("sets exitCode to 0", () => {
    expect(translateHermes(action).exitCode).toBe(0);
  });

  it("emits raw ACP continue with content=systemMessage", () => {
    const { raw } = translateHermes(action);
    expect(raw.action).toBe("continue");
    expect((raw as { action: string; content?: string }).content).toBe("apply rule X");
  });

  it("carries full systemMessage in additionalContext", () => {
    expect(translateHermes(action).additionalContext).toBe("apply rule X");
  });
});

// ---------------------------------------------------------------------------
// constrained-inject — long content (over 1800 bytes)
// ---------------------------------------------------------------------------

describe("translateHermes — constrained-inject (long, truncated)", () => {
  const action: ForceAction = {
    kind: "constrained-inject",
    systemMessage: OVER_1800,
  };

  it("raw.content is truncated to ≤1800 bytes", () => {
    const { raw } = translateHermes(action);
    const content = (raw as { action: string; content?: string }).content ?? "";
    const byteLen = new TextEncoder().encode(content).length;
    expect(byteLen).toBeLessThanOrEqual(1800);
  });

  it("additionalContext carries the full (untruncated) systemMessage", () => {
    const { additionalContext } = translateHermes(action);
    expect(additionalContext).toBe(OVER_1800);
  });

  it("decision remains continue", () => {
    expect(translateHermes(action).decision).toBe("continue");
  });
});

// ---------------------------------------------------------------------------
// rich-inject — downgrade to constrained
// ---------------------------------------------------------------------------

describe("translateHermes — rich-inject (downgraded, short)", () => {
  const action: ForceAction = {
    kind: "rich-inject",
    content: "## Context\nSome markdown",
  };

  it("sets decision to continue (not block)", () => {
    expect(translateHermes(action).decision).toBe("continue");
  });

  it("sets exitCode to 0", () => {
    expect(translateHermes(action).exitCode).toBe(0);
  });

  it("emits raw ACP continue with content=action.content", () => {
    const { raw } = translateHermes(action);
    expect(raw.action).toBe("continue");
    expect((raw as { action: string; content?: string }).content).toBe(
      "## Context\nSome markdown",
    );
  });

  it("carries full content in additionalContext", () => {
    expect(translateHermes(action).additionalContext).toBe("## Context\nSome markdown");
  });
});

describe("translateHermes — rich-inject (long, truncated)", () => {
  const action: ForceAction = {
    kind: "rich-inject",
    content: OVER_1800,
  };

  it("raw.content is truncated to ≤1800 bytes", () => {
    const { raw } = translateHermes(action);
    const content = (raw as { action: string; content?: string }).content ?? "";
    const byteLen = new TextEncoder().encode(content).length;
    expect(byteLen).toBeLessThanOrEqual(1800);
  });

  it("additionalContext carries the full (untruncated) content", () => {
    expect(translateHermes(action).additionalContext).toBe(OVER_1800);
  });
});

// ---------------------------------------------------------------------------
// deferred-block
// ---------------------------------------------------------------------------

describe("translateHermes — deferred-block", () => {
  const action: ForceAction = {
    kind: "deferred-block",
    verdictFile: "/tmp/verdict.json",
    reason: "scope review required",
    resolveOn: ["stop"],
  };

  it("sets decision to continue", () => {
    expect(translateHermes(action).decision).toBe("continue");
  });

  it("sets exitCode to 0", () => {
    expect(translateHermes(action).exitCode).toBe(0);
  });

  it("emits raw ACP continue without content", () => {
    const { raw } = translateHermes(action);
    expect(raw.action).toBe("continue");
    expect((raw as { action: string; content?: string }).content).toBeUndefined();
  });

  it("does not set additionalContext", () => {
    expect(translateHermes(action).additionalContext).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// observe-only
// ---------------------------------------------------------------------------

describe("translateHermes — observe-only", () => {
  const action: ForceAction = { kind: "observe-only", log: "telemetry note" };

  it("sets decision to continue", () => {
    expect(translateHermes(action).decision).toBe("continue");
  });

  it("sets exitCode to 0", () => {
    expect(translateHermes(action).exitCode).toBe(0);
  });

  it("emits raw ACP continue", () => {
    expect(translateHermes(action).raw.action).toBe("continue");
  });
});

// ---------------------------------------------------------------------------
// noop
// ---------------------------------------------------------------------------

describe("translateHermes — noop", () => {
  const action: ForceAction = { kind: "noop" };

  it("sets decision to continue", () => {
    expect(translateHermes(action).decision).toBe("continue");
  });

  it("sets exitCode to 0", () => {
    expect(translateHermes(action).exitCode).toBe(0);
  });

  it("emits raw ACP continue", () => {
    expect(translateHermes(action).raw.action).toBe("continue");
  });
});

// ---------------------------------------------------------------------------
// Multi-byte UTF-8 truncation safety
// ---------------------------------------------------------------------------

describe("translateHermes — multi-byte UTF-8 truncation boundary", () => {
  const action: ForceAction = {
    kind: "constrained-inject",
    systemMessage: MULTI_BYTE_OVER_1800,
  };

  it("raw.content byte length is ≤1800", () => {
    const { raw } = translateHermes(action);
    const content = (raw as { action: string; content?: string }).content ?? "";
    const byteLen = new TextEncoder().encode(content).length;
    expect(byteLen).toBeLessThanOrEqual(1800);
  });

  it("raw.content is valid UTF-8 (no garbled multi-byte tail)", () => {
    const { raw } = translateHermes(action);
    const content = (raw as { action: string; content?: string }).content ?? "";
    // If content decodes to a string without the replacement character U+FFFD,
    // the multi-byte boundary was respected.
    expect(content).not.toContain("�");
  });
});
