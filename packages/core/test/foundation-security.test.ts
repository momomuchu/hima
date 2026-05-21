/**
 * Foundation Security Tests — C1 / C2 / M3 / H4 regression guards
 *
 * These tests encode the exact DONE criteria from the fix-1-foundation task:
 *   - Unknown tool -> WRITE_MUTATION (not READ_ONLY)      [C1]
 *   - mcp__fs__write_file -> not READ_ONLY               [C1]
 *   - canonicalProjectPath("../../../etc/passwd") -> insideRoot false [C2]
 *   - Fullwidth / 1-char-justified suppression -> NOT accepted (true)  [H4]
 *   - Meta tool (task) -> META_CONTROL -> qualifyingWriteOccurred false [M3]
 */

import { describe, expect, it } from "vitest";
import {
  classifyToolName,
  detectSuppressionWithoutJustification,
} from "../src/gates/action-signal.js";
import { canonicalProjectPath } from "../src/gates/canonical-path.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import { evaluateAiSlopCleaner } from "../src/security/ai-slop-cleaner.js";

// ── C1: Fail-closed classifier ────────────────────────────────────────────────

describe("C1 — classifyToolName fail-closed", () => {
  it("unknown tool name -> WRITE_MUTATION, never READ_ONLY", () => {
    expect(classifyToolName("some_unknown_tool_xyz")).toBe("WRITE_MUTATION");
    expect(classifyToolName("mySuperCustomTool")).toBe("WRITE_MUTATION");
    expect(classifyToolName("")).toBe("WRITE_MUTATION");
  });

  it("MCP tool (mcp__fs__write_file) -> WRITE_MUTATION, not READ_ONLY", () => {
    expect(classifyToolName("mcp__fs__write_file")).toBe("WRITE_MUTATION");
    expect(classifyToolName("mcp__fs__write_file")).not.toBe("READ_ONLY");
  });

  it("MCP read-like tool name still fails closed to WRITE_MUTATION", () => {
    // MCP tools are not in the allowlist — they must fail closed.
    expect(classifyToolName("mcp__filesystem__read")).toBe("WRITE_MUTATION");
    expect(classifyToolName("mcp__browser__navigate")).toBe("WRITE_MUTATION");
  });

  it("known READ_ONLY tools remain READ_ONLY", () => {
    for (const name of ["Read", "Glob", "Grep", "LS", "Cat", "ListFiles", "Search"]) {
      expect(classifyToolName(name)).toBe("READ_ONLY");
    }
  });

  it("meta tools are META_CONTROL, not READ_ONLY or WRITE_MUTATION", () => {
    for (const name of [
      "Task",
      "TaskCreate",
      "TaskUpdate",
      "TodoWrite",
      "TodoRead",
      "SubAgent",
      "Agent",
      "Delegate",
      "ExitPlanMode",
    ]) {
      expect(classifyToolName(name)).toBe("META_CONTROL");
    }
  });

  it("shell tools are EXECUTE_SIDE_EFFECT", () => {
    for (const name of ["Bash", "Shell", "PowerShell", "Python", "Node"]) {
      expect(classifyToolName(name)).toBe("EXECUTE_SIDE_EFFECT");
    }
  });
});

// ── C2: canonicalProjectPath path traversal ───────────────────────────────────

describe("C2 — canonicalProjectPath path traversal guard", () => {
  const root = "C:/Users/momomuchu/dev/Pipeline/hima";

  it("../../../etc/passwd resolves outside root -> insideRoot false", () => {
    const result = canonicalProjectPath("../../../etc/passwd", root);
    expect(result.insideRoot).toBe(false);
  });

  it("../../outside/file.ts resolves outside root -> insideRoot false", () => {
    const result = canonicalProjectPath("../../outside/file.ts", root);
    expect(result.insideRoot).toBe(false);
  });

  it("src/index.ts resolves inside root -> insideRoot true, relative path", () => {
    const result = canonicalProjectPath("src/index.ts", root);
    expect(result.insideRoot).toBe(true);
    expect(result.path).toBe("src/index.ts");
  });

  it("backslash path resolves correctly inside root", () => {
    const result = canonicalProjectPath("src\\gates\\action-signal.ts", root);
    expect(result.insideRoot).toBe(true);
    expect(result.path).toContain("src/gates/action-signal.ts");
  });

  it("path equal to root returns insideRoot true with empty relative path", () => {
    const result = canonicalProjectPath(".", root);
    expect(result.insideRoot).toBe(true);
  });
});

// ── H4: Unicode suppression evasion ──────────────────────────────────────────

function makeWriteEvent(content: string): GateEvent {
  return { gateType: "post_tool", toolName: "Write", toolInput: { content } };
}

describe("H4 — suppression scanner Unicode evasion and substantive justification", () => {
  it("fullwidth @ts-ignore (NFKC normalization) is detected", () => {
    // Fullwidth characters that NFKC-normalize to ASCII suppression directive.
    // U+FF20 = ＠, U+FF54 = ｔ, U+FF53 = ｓ etc.
    const content = "// ＠ts-ignore\nconst x: any = {};";
    const event = makeWriteEvent(content);
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });

  it("zero-width chars injected into suppression directive are stripped and detected", () => {
    // Zero-width space (U+200B) injected to try to break the pattern match.
    const content = "// @ts​-ignore\nconst x = 1;";
    const event = makeWriteEvent(content);
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });

  it("single-word justification is NOT substantive (rejected)", () => {
    // Only one real word after separator — not substantive.
    const content = "// eslint-disable-next-line -- ok\neval('x');";
    const event = makeWriteEvent(content);
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });

  it("lint rule name as justification is NOT substantive (rejected)", () => {
    // 'no-eval' is a lint rule name, not a human justification.
    const content = "/* eslint-disable no-eval */\neval('x');";
    const event = makeWriteEvent(content);
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });

  it("two+ real words after separator IS substantive (accepted)", () => {
    const content = "// eslint-disable-next-line -- legacy api usage\neval('x');";
    const event = makeWriteEvent(content);
    expect(detectSuppressionWithoutJustification(event)).toBe(false);
  });

  it("preceding line with two+ real words is substantive (accepted)", () => {
    const content = "// TODO: fix after library upgrade\n// @ts-ignore\nconst y = {};";
    const event = makeWriteEvent(content);
    expect(detectSuppressionWithoutJustification(event)).toBe(false);
  });

  it("bidi override chars injected into justification text are stripped — directive without real justification still flagged", () => {
    // Bidi char U+202E (right-to-left override) injected to try to fake justification length.
    const content = "// eslint-disable-next-line -- ‮ok\neval('x');";
    const event = makeWriteEvent(content);
    // After stripping bidi, "ok" is a single token — not substantive.
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });
});

// ── M3: META_CONTROL -> qualifyingWriteOccurred false ────────────────────────

describe("M3 — meta tool (Task) -> META_CONTROL -> qualifyingWriteOccurred false", () => {
  it("Task tool classified as META_CONTROL", () => {
    expect(classifyToolName("Task")).toBe("META_CONTROL");
  });

  it("META_CONTROL tool does NOT qualify as a write for ai-slop-cleaner", () => {
    // Simulate what evaluate-gate.ts does: qualifyingAction = WRITE_MUTATION || EXECUTE_SIDE_EFFECT
    const toolSemanticClass = classifyToolName("Task");
    const qualifyingAction =
      toolSemanticClass === "WRITE_MUTATION" || toolSemanticClass === "EXECUTE_SIDE_EFFECT";
    expect(qualifyingAction).toBe(false);

    // Confirm: even with cleanup keyword in parts, no trigger when not qualifying.
    const result = evaluateAiSlopCleaner({
      gateType: "post_tool",
      parts: [
        { tool: "Task", description: "ai-slop cleanup task" },
        "Task dispatched successfully",
        {},
      ],
      qualifyingWriteOccurred: qualifyingAction,
    });
    expect(result.cleanupTriggered).toBe(false);
  });

  it("WRITE_MUTATION tool qualifies as a write for ai-slop-cleaner", () => {
    const toolSemanticClass = classifyToolName("Write");
    const qualifyingAction =
      toolSemanticClass === "WRITE_MUTATION" || toolSemanticClass === "EXECUTE_SIDE_EFFECT";
    expect(qualifyingAction).toBe(true);
  });

  it("READ_ONLY tool does NOT qualify as a write for ai-slop-cleaner", () => {
    const toolSemanticClass = classifyToolName("Read");
    const qualifyingAction =
      toolSemanticClass === "WRITE_MUTATION" || toolSemanticClass === "EXECUTE_SIDE_EFFECT";
    expect(qualifyingAction).toBe(false);
  });
});
