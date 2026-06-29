/**
 * Tests for adapter-codex / translateCodex()
 *
 * Coverage mandated by R-010:
 *  1. skill-force       → exit 2 + systemMessage has skill id within first 100 chars
 *  2. rich-inject       → downgraded to constrained (exit 0, systemMessage set)
 *  3. constrained-inject > 1800 bytes → systemMessage truncated to ≤ 1800 bytes
 *  4. deferred-block    → exit 0
 *  5. noop              → exit 0
 *
 * Additional coverage:
 *  6. hard-block        → exit 2 + reason + systemMessage
 *  7. observe-only      → exit 0
 *  8. rich-inject long  → downgraded + truncated to ≤ 1800 bytes
 *  9. constrained-inject short → systemMessage preserved verbatim (no truncation)
 */

import { describe, it, expect } from "vitest";
import type { ForceAction } from "@hima/schemas";
import { translateCodex } from "../src/adapter-codex.js";

// ---------------------------------------------------------------------------
// hard-block
// ---------------------------------------------------------------------------

describe("translateCodex — hard-block", () => {
  it("returns block exit 2 with reason and systemMessage", () => {
    const action: ForceAction = {
      kind: "hard-block",
      reason: "secret detected in diff",
    };
    const result = translateCodex(action);
    expect(result.decision).toBe("block");
    expect(result.exitCode).toBe(2);
    expect(result.reason).toBe("secret detected in diff");
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain("secret detected in diff");
  });
});

// ---------------------------------------------------------------------------
// skill-force (mandated test #1)
// ---------------------------------------------------------------------------

describe("translateCodex — skill-force", () => {
  it("returns block exit 2 and skillId within first 100 chars of systemMessage", () => {
    const action: ForceAction = {
      kind: "skill-force",
      skillId: "corpus-security-privacy-compliance",
      reason: "security gate requires this skill",
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("block");
    expect(result.exitCode).toBe(2);
    expect(result.reason).toBe("security gate requires this skill");

    const msg = result.systemMessage ?? "";
    expect(msg.length).toBeGreaterThan(0);

    // MANDATED: skill id must appear in the first 100 chars.
    const prefix = msg.slice(0, 100);
    expect(prefix).toContain("corpus-security-privacy-compliance");
  });

  it("places skillId before reason text in systemMessage", () => {
    const action: ForceAction = {
      kind: "skill-force",
      skillId: "corpus-ui-knowledge",
      reason: "UI gate active",
    };
    const result = translateCodex(action);
    const msg = result.systemMessage ?? "";
    const skillPos = msg.indexOf("corpus-ui-knowledge");
    const reasonPos = msg.indexOf("UI gate active");
    expect(skillPos).toBeLessThan(reasonPos);
  });
});

// ---------------------------------------------------------------------------
// rich-inject → downgraded to constrained (mandated tests #2 and #8)
// ---------------------------------------------------------------------------

describe("translateCodex — rich-inject (downgraded to constrained)", () => {
  it("is downgraded: returns continue exit 0 with systemMessage set", () => {
    const action: ForceAction = {
      kind: "rich-inject",
      content: "# SKILL INJECTION\n\nUse the corpus-ui-knowledge rubric.",
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
    // systemMessage must carry the downgraded content.
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain("SKILL INJECTION");
    // additionalContext is not the Codex channel; it must NOT be set here.
    expect(result.additionalContext).toBeUndefined();
  });

  it("truncates rich content exceeding 1800 bytes to ≤ 1800 bytes", () => {
    const longContent = "r".repeat(2500); // 2500 ASCII chars = 2500 bytes
    const action: ForceAction = {
      kind: "rich-inject",
      content: longContent,
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
    expect(result.systemMessage).toBeDefined();

    const msgBytes = Buffer.from(result.systemMessage ?? "", "utf8").length;
    expect(msgBytes).toBeLessThanOrEqual(1800);
    // Confirm actual truncation occurred (not a no-op).
    expect(result.systemMessage!.length).toBeLessThan(longContent.length);
  });
});

// ---------------------------------------------------------------------------
// constrained-inject (mandated test #3)
// ---------------------------------------------------------------------------

describe("translateCodex — constrained-inject", () => {
  it("returns continue exit 0 with systemMessage set verbatim for short content", () => {
    const action: ForceAction = {
      kind: "constrained-inject",
      systemMessage: "apply the read-before-write constraint",
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
    expect(result.systemMessage).toBe("apply the read-before-write constraint");
  });

  it("truncates systemMessage content exceeding 1800 bytes (mandated)", () => {
    const longMsg = "c".repeat(2500); // 2500 bytes in ASCII
    const action: ForceAction = {
      kind: "constrained-inject",
      systemMessage: longMsg,
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);

    const msgBytes = Buffer.from(result.systemMessage ?? "", "utf8").length;
    expect(msgBytes).toBeLessThanOrEqual(1800);
    // Confirm truncation.
    expect(result.systemMessage!.length).toBeLessThan(longMsg.length);
  });

  it("preserves exactly 1800 bytes when content is exactly 1800 bytes", () => {
    const exactMsg = "e".repeat(1800);
    const action: ForceAction = {
      kind: "constrained-inject",
      systemMessage: exactMsg,
    };
    const result = translateCodex(action);

    expect(result.systemMessage).toBe(exactMsg);
    const msgBytes = Buffer.from(result.systemMessage ?? "", "utf8").length;
    expect(msgBytes).toBe(1800);
  });
});

// ---------------------------------------------------------------------------
// deferred-block (mandated test #4)
// ---------------------------------------------------------------------------

describe("translateCodex — deferred-block", () => {
  it("returns continue exit 0 (verdict persisted by caller)", () => {
    const action: ForceAction = {
      kind: "deferred-block",
      verdictFile: "/tmp/hima-verdict.json",
      reason: "hermes enforcement deferred to stop hook",
      resolveOn: ["stop"],
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// observe-only
// ---------------------------------------------------------------------------

describe("translateCodex — observe-only", () => {
  it("returns continue exit 0", () => {
    const action: ForceAction = {
      kind: "observe-only",
      log: "gate event observed for telemetry",
    };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// noop (mandated test #5)
// ---------------------------------------------------------------------------

describe("translateCodex — noop", () => {
  it("returns continue exit 0", () => {
    const action: ForceAction = { kind: "noop" };
    const result = translateCodex(action);

    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Truncation boundary — multi-byte UTF-8 safety
// ---------------------------------------------------------------------------

describe("translateCodex — truncation boundary", () => {
  it("does not produce a truncated string with byte length exceeding 1800 for multibyte content", () => {
    // 3-byte UTF-8 chars (e.g. '€' = U+20AC = 0xE2 0x82 0xAC)
    // 601 '€' chars = 1803 bytes; truncation must yield ≤ 1800 bytes (600 chars = 1800 bytes).
    const euroStr = "€".repeat(601);
    const action: ForceAction = {
      kind: "constrained-inject",
      systemMessage: euroStr,
    };
    const result = translateCodex(action);

    const msgBytes = Buffer.from(result.systemMessage ?? "", "utf8").length;
    expect(msgBytes).toBeLessThanOrEqual(1800);
  });
});
