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
  });

  it("falls back to camelCase for direct/test callers", () => {
    const out = normalizePayload({
      toolName: "Edit",
      toolInput: { a: 1 },
      promptContent: "hi",
    });
    expect(out.toolName).toBe("Edit");
    expect(out.toolInput).toEqual({ a: 1 });
    expect(out.promptContent).toBe("hi");
  });

  it("prefers snake_case when both present", () => {
    const out = normalizePayload({ tool_name: "Write", toolName: "Read" });
    expect(out.toolName).toBe("Write");
  });

  it("returns empty for non-object input", () => {
    expect(normalizePayload(null)).toEqual({});
    expect(normalizePayload("nope")).toEqual({});
    expect(normalizePayload([1, 2])).toEqual({});
  });
});
