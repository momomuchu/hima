import { describe, it, expect } from "vitest";
import { formatForClaude, formatForHermes } from "../src/format.js";
import type { Verdict } from "../src/types.js";

const allow: Verdict = { decision: "allow" };
const block: Verdict = { decision: "block", reason: "blocked by policy" };
const warn: Verdict = { decision: "warn", reason: "risky operation" };

describe("formatForClaude", () => {
  it("stop + allow returns empty object", () => {
    expect(formatForClaude("stop", allow)).toEqual({});
  });

  it("stop + block returns decision/reason", () => {
    expect(formatForClaude("stop", block)).toEqual({
      decision: "block",
      reason: "blocked by policy",
    });
  });

  it("pre_tool + allow returns permissionDecision allow", () => {
    const out = formatForClaude("pre_tool", allow);
    expect((out as Record<string, Record<string, unknown>>)["hookSpecificOutput"]?.["permissionDecision"]).toBe("allow");
  });

  it("pre_tool + block returns permissionDecision deny", () => {
    const out = formatForClaude("pre_tool", block);
    expect((out as Record<string, Record<string, unknown>>)["hookSpecificOutput"]?.["permissionDecision"]).toBe("deny");
  });

  it("warn returns systemMessage", () => {
    const out = formatForClaude("post_tool", warn);
    expect((out as Record<string, unknown>)["systemMessage"]).toBe("risky operation");
  });
});

describe("formatForHermes", () => {
  it("stop + allow returns empty object", () => {
    expect(formatForHermes("stop", allow)).toEqual({});
  });

  it("stop + block returns decision block", () => {
    expect(formatForHermes("stop", block)).toEqual({
      decision: "block",
      reason: "blocked by policy",
    });
  });
});
