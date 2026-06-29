import { describe, expect, it } from "vitest";
import { normalizePayload } from "../src/stdin.js";

describe("normalizePayload", () => {
  it("reads Claude snake_case fields (the real hook payload)", () => {
    const out = normalizePayload({
      tool_name: "Write",
      tool_input: { file_path: "x.ts" },
      prompt: "do the thing ulw",
      hook_event_name: "PreToolUse",
      session_id: "abc",
    });
    expect(out.toolName).toBe("Write");
    expect(out.toolInput).toEqual({ file_path: "x.ts" });
    expect(out.promptContent).toBe("do the thing ulw");
    expect(out.hookEventName).toBe("PreToolUse");
    expect(out.sessionId).toBe("abc");
  });

  it("falls back to camelCase for direct/test callers", () => {
    const out = normalizePayload({
      toolName: "Edit",
      toolInput: { a: 1 },
      promptContent: "hi",
      sessionId: "sess-xyz",
      hookEventName: "UserPromptSubmit",
    });
    expect(out.toolName).toBe("Edit");
    expect(out.toolInput).toEqual({ a: 1 });
    expect(out.promptContent).toBe("hi");
    expect(out.sessionId).toBe("sess-xyz");
    expect(out.hookEventName).toBe("UserPromptSubmit");
  });

  it("prefers snake_case when both present", () => {
    const out = normalizePayload({
      tool_name: "Write",
      toolName: "Read",
      session_id: "snake",
      sessionId: "camel",
      hook_event_name: "PreToolUse",
      hookEventName: "PostToolUse",
    });
    expect(out.toolName).toBe("Write");
    expect(out.sessionId).toBe("snake");
    expect(out.hookEventName).toBe("PreToolUse");
  });

  it("returns empty for non-object input", () => {
    expect(normalizePayload(null)).toEqual({});
    expect(normalizePayload("nope")).toEqual({});
    expect(normalizePayload([1, 2])).toEqual({});
  });

  it("sessionId and hookEventName are absent when not in payload", () => {
    const out = normalizePayload({ tool_name: "Read" });
    expect(out.sessionId).toBeUndefined();
    expect(out.hookEventName).toBeUndefined();
  });
});
