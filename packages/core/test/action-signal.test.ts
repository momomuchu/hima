import { describe, expect, it } from "vitest";
import {
  classifyPreTool,
  classifyToolName,
  computeZoneCompliance,
  detectSuppressionWithoutJustification,
  estimateLineDelta,
  extendWithPostTool,
  hashContent,
  isPostToolSignal,
  SEMANTIC_CLASSES,
  type SemanticClass,
  ZONE_COMPLIANCE_VALUES,
  type ZoneCompliance,
} from "../src/gates/action-signal.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePreToolEvent(toolName: string, toolInput?: unknown): GateEvent {
  return { gateType: "pre_tool", toolName, toolInput };
}

function makePostToolEvent(toolName: string, toolInput?: unknown, toolOutput?: unknown): GateEvent {
  return { gateType: "post_tool", toolName, toolInput, toolOutput };
}

// ── SemanticClass catalog ─────────────────────────────────────────────────────

describe("SEMANTIC_CLASSES catalog", () => {
  it("contains exactly the four spec-mandated values", () => {
    expect(SEMANTIC_CLASSES).toEqual([
      "READ_ONLY",
      "WRITE_MUTATION",
      "EXECUTE_SIDE_EFFECT",
      "META_CONTROL",
    ]);
  });
});

describe("ZONE_COMPLIANCE_VALUES catalog", () => {
  it("contains exactly the three spec-mandated values", () => {
    expect(ZONE_COMPLIANCE_VALUES).toEqual(["allowed", "anomalous", "forbidden"]);
  });
});

// ── classifyToolName ──────────────────────────────────────────────────────────

describe("classifyToolName — READ_ONLY", () => {
  it.each([
    "Read",
    "Glob",
    "Grep",
    "LS",
    "ListFiles",
    "Search",
  ])("classifies %s as READ_ONLY", (name) => {
    expect(classifyToolName(name)).toBe<SemanticClass>("READ_ONLY");
  });
});

describe("classifyToolName — WRITE_MUTATION", () => {
  it.each([
    "Write",
    "Edit",
    "MultiEdit",
    "CreateFile",
    "NotebookEdit",
  ])("classifies %s as WRITE_MUTATION", (name) => {
    expect(classifyToolName(name)).toBe<SemanticClass>("WRITE_MUTATION");
  });
});

describe("classifyToolName — EXECUTE_SIDE_EFFECT", () => {
  it.each([
    "Bash",
    "Shell",
    "PowerShell",
    "Python",
    "Node",
    "sh",
    "cmd",
  ])("classifies %s as EXECUTE_SIDE_EFFECT", (name) => {
    expect(classifyToolName(name)).toBe<SemanticClass>("EXECUTE_SIDE_EFFECT");
  });
});

describe("classifyToolName — META_CONTROL", () => {
  it.each([
    "Task",
    "task",
    "Agent",
    "agent",
    "TaskCreate",
    "taskcreate",
    "TodoWrite",
    "TodoRead",
    "SubAgent",
  ])("classifies %s as META_CONTROL", (name) => {
    expect(classifyToolName(name)).toBe<SemanticClass>("META_CONTROL");
  });
});

// ── computeZoneCompliance ─────────────────────────────────────────────────────

describe("computeZoneCompliance", () => {
  it("READ_ONLY is always allowed regardless of target or subPhase", () => {
    expect(computeZoneCompliance("READ_ONLY", "src/foo.ts", "Observer")).toBe<ZoneCompliance>(
      "allowed",
    );
    expect(computeZoneCompliance("READ_ONLY", "src/bar.ts", null)).toBe<ZoneCompliance>("allowed");
  });

  it("META_CONTROL is always allowed", () => {
    expect(computeZoneCompliance("META_CONTROL", "src/foo.ts", "Define")).toBe<ZoneCompliance>(
      "allowed",
    );
  });

  it("WRITE_MUTATION within allowed zone is allowed", () => {
    // Execute sub-phase allows src/
    expect(computeZoneCompliance("WRITE_MUTATION", "src/foo.ts", "Execute")).toBe<ZoneCompliance>(
      "allowed",
    );
  });

  it("WRITE_MUTATION outside allowed zone in Execute is anomalous", () => {
    // Execute does not allow docs/
    expect(
      computeZoneCompliance("WRITE_MUTATION", "docs/architecture.md", "Execute"),
    ).toBe<ZoneCompliance>("anomalous");
  });

  it("WRITE_MUTATION outside allowed zone in Observer is forbidden", () => {
    // Observer only allows .planning/01-discovery/ and .planning/09-logs/
    expect(
      computeZoneCompliance("WRITE_MUTATION", "src/index.ts", "Observer"),
    ).toBe<ZoneCompliance>("forbidden");
  });

  it("WRITE_MUTATION with empty targetPath is anomalous", () => {
    expect(computeZoneCompliance("WRITE_MUTATION", "", "Execute")).toBe<ZoneCompliance>(
      "anomalous",
    );
  });

  it("EXECUTE_SIDE_EFFECT outside allowed zone in Observer is forbidden", () => {
    expect(
      computeZoneCompliance("EXECUTE_SIDE_EFFECT", "src/build.ts", "Observer"),
    ).toBe<ZoneCompliance>("forbidden");
  });
});

// ── classifyPreTool ───────────────────────────────────────────────────────────

describe("classifyPreTool", () => {
  it("produces a complete ActionSignalPreTool record", () => {
    const event = makePreToolEvent("Write", { file_path: "src/index.ts", content: "hello" });
    const signal = classifyPreTool(event, "Execute", "build", "M");

    expect(signal.toolName).toBe("Write");
    expect(signal.semanticClass).toBe("WRITE_MUTATION");
    expect(signal.targetPath).toBe("src/index.ts");
    expect(signal.subPhase).toBe("Execute");
    expect(signal.phase).toBe("build");
    expect(signal.riskClass).toBe("M");
    expect(signal.zoneCompliance).toBe("allowed");
  });

  it("marks zone as forbidden for Observer sub-phase write to src/", () => {
    const event = makePreToolEvent("Write", { file_path: "src/main.ts" });
    const signal = classifyPreTool(event, "Observer", "discovery", "T");

    expect(signal.semanticClass).toBe("WRITE_MUTATION");
    expect(signal.zoneCompliance).toBe("forbidden");
  });

  it("handles Read tool in any phase as READ_ONLY allowed", () => {
    const event = makePreToolEvent("Read", { file_path: "src/foo.ts" });
    const signal = classifyPreTool(event, "Observer", "discovery", "T");

    expect(signal.semanticClass).toBe("READ_ONLY");
    expect(signal.zoneCompliance).toBe("allowed");
  });

  it("handles null subPhase gracefully", () => {
    const event = makePreToolEvent("Bash", { command: "ls" });
    const signal = classifyPreTool(event, null, "discovery", "L");

    expect(signal.subPhase).toBeNull();
    expect(signal.semanticClass).toBe("EXECUTE_SIDE_EFFECT");
  });
});

// ── extendWithPostTool ────────────────────────────────────────────────────────

describe("extendWithPostTool", () => {
  it("appends contentHash, linesAdded, linesRemoved, suppressionPatternFound", () => {
    const preEvent = makePreToolEvent("Write", {
      file_path: "src/foo.ts",
      content: "line1\nline2",
    });
    const preTool = classifyPreTool(preEvent, "Execute", "build", "M");

    const postEvent = makePostToolEvent("Write", preEvent.toolInput, "ok");
    const postTool = extendWithPostTool(preTool, postEvent);

    expect(isPostToolSignal(postTool)).toBe(true);
    expect(postTool.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(postTool.linesAdded).toBe(2); // "line1\nline2" → 2 lines
    expect(postTool.linesRemoved).toBe(0);
    expect(postTool.suppressionPatternFound).toBe(false);
  });

  it("detects suppression without justification in written content", () => {
    const content = "const x = 1;\n// eslint-disable-next-line\nconst y = eval('bad');";
    const preEvent = makePreToolEvent("Write", { file_path: "src/bad.ts", content });
    const preTool = classifyPreTool(preEvent, "Execute", "build", "M");

    const postEvent = makePostToolEvent("Write", preEvent.toolInput, "ok");
    const postTool = extendWithPostTool(preTool, postEvent);

    expect(postTool.suppressionPatternFound).toBe(true);
  });

  it("does not flag suppression with justification on same line", () => {
    const content = "const x = 1; // eslint-disable-next-line -- reason: legacy API";
    const preEvent = makePreToolEvent("Write", { file_path: "src/ok.ts", content });
    const preTool = classifyPreTool(preEvent, "Execute", "build", "M");

    const postEvent = makePostToolEvent("Write", preEvent.toolInput, "ok");
    const postTool = extendWithPostTool(preTool, postEvent);

    // The suppression is on a line with a comment before it — justified
    expect(postTool.suppressionPatternFound).toBe(false);
  });

  it("suppressionPatternFound is false for READ_ONLY tools", () => {
    const preEvent = makePreToolEvent("Read", { file_path: "src/foo.ts" });
    const preTool = classifyPreTool(preEvent, "Execute", "build", "M");
    const postEvent = makePostToolEvent(
      "Read",
      preEvent.toolInput,
      "file contents with @ts-ignore",
    );
    const postTool = extendWithPostTool(preTool, postEvent);

    // READ_ONLY — we do not scan output for suppressions
    expect(postTool.suppressionPatternFound).toBe(false);
  });
});

// ── hashContent ───────────────────────────────────────────────────────────────

describe("hashContent", () => {
  it("returns a 64-char hex string for non-empty content", () => {
    expect(hashContent("hello")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns empty string for null/undefined", () => {
    expect(hashContent(null)).toBe("");
    expect(hashContent(undefined)).toBe("");
  });

  it("returns same hash for same content (stability)", () => {
    expect(hashContent("same")).toBe(hashContent("same"));
  });

  it("returns different hashes for different content", () => {
    expect(hashContent("a")).not.toBe(hashContent("b"));
  });
});

// ── estimateLineDelta ─────────────────────────────────────────────────────────

describe("estimateLineDelta", () => {
  it("uses old_string/new_string for Edit tool", () => {
    const event = makePostToolEvent("Edit", {
      file_path: "src/foo.ts",
      old_string: "line1\nline2\nline3",
      new_string: "lineA\nlineB",
    });
    const delta = estimateLineDelta(event);
    expect(delta.linesRemoved).toBe(3);
    expect(delta.linesAdded).toBe(2);
  });

  it("uses content for Write tool", () => {
    const event = makePostToolEvent("Write", {
      file_path: "src/new.ts",
      content: "a\nb\nc\nd",
    });
    const delta = estimateLineDelta(event);
    expect(delta.linesAdded).toBe(4);
    expect(delta.linesRemoved).toBe(0);
  });

  it("returns zeros for tools with no content fields", () => {
    const event = makePostToolEvent("Read", { file_path: "src/foo.ts" });
    const delta = estimateLineDelta(event);
    expect(delta.linesAdded).toBe(0);
    expect(delta.linesRemoved).toBe(0);
  });
});

// ── detectSuppressionWithoutJustification ─────────────────────────────────────

describe("detectSuppressionWithoutJustification", () => {
  it("returns false when no suppression directives present", () => {
    const event = makePostToolEvent("Write", {
      content: "const x = 1;\nconst y = 2;",
    });
    expect(detectSuppressionWithoutJustification(event)).toBe(false);
  });

  it("returns true for bare @ts-ignore without justification", () => {
    const event = makePostToolEvent("Write", {
      content: "const x = 1;\n// @ts-ignore\nconst y: any = {};",
    });
    // "@ts-expect-error" on its own line with preceding comment "// @ts-expect-error" —
    // the preceding line IS the comment, but it has no extra text after the directive
    // Actually the comment IS the @ts-expect-error itself — no separate justification text
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });

  it("returns false for @ts-ignore with justification on preceding line", () => {
    const event = makePostToolEvent("Write", {
      content: "// TODO: fix after library upgrade\n// @ts-ignore\nconst y = {};",
    });
    expect(detectSuppressionWithoutJustification(event)).toBe(false);
  });

  it("returns true for eslint-disable without justification", () => {
    const event = makePostToolEvent("Write", {
      content: "/* eslint-disable no-eval */\neval('x');",
    });
    // eslint-disable directive present with only the rule name, no justification comment
    // The line itself has the comment-start token but no separate justification text
    // after the directive.  Our scanner checks for adjacent justification comment
    // with non-whitespace text beyond the directive token.
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });

  it("returns false when toolInput has no content field", () => {
    const event = makePostToolEvent("Bash", { command: "echo hello" });
    expect(detectSuppressionWithoutJustification(event)).toBe(false);
  });

  it("uses new_string for Edit tool input", () => {
    const event = makePostToolEvent("Edit", {
      old_string: "const x = 1;",
      new_string: "// @ts-nocheck\nconst x = 1;",
    });
    expect(detectSuppressionWithoutJustification(event)).toBe(true);
  });
});

// ── isPostToolSignal type guard ────────────────────────────────────────────────

describe("isPostToolSignal", () => {
  it("returns false for a pre_tool signal", () => {
    const event = makePreToolEvent("Read", { file_path: "src/foo.ts" });
    const signal = classifyPreTool(event, "Execute", "build", "M");
    expect(isPostToolSignal(signal)).toBe(false);
  });

  it("returns true for a post_tool signal", () => {
    const preEvent = makePreToolEvent("Write", { file_path: "src/foo.ts", content: "x" });
    const preTool = classifyPreTool(preEvent, "Execute", "build", "M");
    const postTool = extendWithPostTool(
      preTool,
      makePostToolEvent("Write", preEvent.toolInput, "ok"),
    );
    expect(isPostToolSignal(postTool)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BEH-000 REGRESSION TESTS (Falsifies-If contract)
//
// From spec §4 BEH-000 falsifies_if:
//   "a keyword appears in agent output text and triggers a gate decision in
//    the absence of any corresponding tool call in the same gate window"
//
// These two tests are the canonical regression guard:
//   1. Keyword in output text WITHOUT a qualifying write → NO violation (allow)
//   2. A real qualifying write WITHOUT justification evidence → violation fires
// ═══════════════════════════════════════════════════════════════════════════════

import { evaluateAiSlopCleaner } from "../src/security/ai-slop-cleaner.js";

describe("BEH-000 regression — action-signal guard on ai-slop-cleaner", () => {
  it("ALLOW: keyword in output text with no qualifying write does NOT trigger violation", () => {
    // Scenario: agent discusses cleanup/deslop in its output text (e.g. a planning
    // note, a comment in a Read result) but has NOT performed any file write.
    // qualifyingWriteOccurred=false → enforcement suppressed regardless of keyword.
    const result = evaluateAiSlopCleaner({
      gateType: "post_tool",
      parts: [
        // toolInput: a Read call (not a write)
        { file_path: "src/foo.ts" },
        // toolOutput: the file content mentions cleanup — this is the false-positive trap
        "This file performs ai-slop cleanup for the codebase",
        // metadata: some context
        { action: "Read" },
      ],
      qualifyingWriteOccurred: false,
    });

    // The keyword "ai-slop cleanup" appears in output text but no write occurred.
    // The gate MUST NOT trigger — this is the closed trap.
    expect(result.cleanupTriggered).toBe(false);
    expect(result.accepted).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("BLOCK: real qualifying write with cleanup keyword but missing evidence still fires", () => {
    // Scenario: agent actually wrote a file as part of cleanup work (qualifyingWriteOccurred=true)
    // AND the keyword is present, but the required evidence fields are missing.
    // The violation MUST fire — this is the genuine case that must not be suppressed.
    const result = evaluateAiSlopCleaner({
      gateType: "post_tool",
      parts: [
        // toolInput: actual Write call with cleanup keyword in content
        { file_path: "src/utils.ts", content: "// ai-slop cleanup applied here" },
        // toolOutput: success
        "File written successfully",
        // metadata: no cleanup_plan, no regression_evidence
        { action: "Write" },
      ],
      qualifyingWriteOccurred: true,
    });

    // A real write occurred WITH the keyword → trigger fires.
    expect(result.cleanupTriggered).toBe(true);
    // No cleanup_plan or regression_evidence present → not accepted.
    expect(result.accepted).toBe(false);
    expect(result.findings.map((f) => f.id)).toContain("missing_cleanup_plan");
    expect(result.findings.map((f) => f.id)).toContain("missing_regression_evidence");
  });

  it("ALLOW: real qualifying write with cleanup keyword AND all required evidence passes", () => {
    // The genuine case where evidence IS present — should pass without violation.
    const result = evaluateAiSlopCleaner({
      gateType: "post_tool",
      parts: [
        { file_path: "src/utils.ts", content: "// ai-slop cleanup applied" },
        "File written successfully",
        {
          action: "Write",
          cleanup_plan: "smell-focused cleanup plan: removed dead code",
          regression_evidence: "regression evidence: tests passed green",
        },
      ],
      qualifyingWriteOccurred: true,
    });

    expect(result.cleanupTriggered).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.findings).toHaveLength(0);
  });
});
