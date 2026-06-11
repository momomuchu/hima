/**
 * Tests for action-signal module in @hima/behavior-core
 *
 * Ported from packages/core/test/action-signal.test.ts
 * Adapted for behavior-core v2:
 *   - Imports use local paths (action-signal.js, gate-event.js)
 *   - No security/ai-slop-cleaner import (not in behavior-core)
 */

import { describe, expect, it } from "vitest";
import {
  classifyToolName,
  detectSuppressionWithoutJustification,
  estimateLineDelta,
  hashContent,
  SEMANTIC_CLASSES,
  type SemanticClass,
  ZONE_COMPLIANCE_VALUES,
} from "../src/action-signal.js";
import type { GateEvent } from "../src/gate-event.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  it.each(["Read", "Glob", "Grep", "LS", "ListFiles", "Search"])(
    "classifies %s as READ_ONLY",
    (name) => {
      expect(classifyToolName(name)).toBe<SemanticClass>("READ_ONLY");
    },
  );
});

describe("classifyToolName — WRITE_MUTATION", () => {
  it.each(["Write", "Edit", "MultiEdit", "CreateFile", "NotebookEdit"])(
    "classifies %s as WRITE_MUTATION",
    (name) => {
      expect(classifyToolName(name)).toBe<SemanticClass>("WRITE_MUTATION");
    },
  );
});

describe("classifyToolName — EXECUTE_SIDE_EFFECT", () => {
  it.each(["Bash", "Shell", "PowerShell", "Python", "Node", "sh", "cmd"])(
    "classifies %s as EXECUTE_SIDE_EFFECT",
    (name) => {
      expect(classifyToolName(name)).toBe<SemanticClass>("EXECUTE_SIDE_EFFECT");
    },
  );
});

describe("classifyToolName — META_CONTROL", () => {
  it.each(["Task", "task", "Agent", "agent", "TaskCreate", "taskcreate", "TodoWrite", "TodoRead", "SubAgent"])(
    "classifies %s as META_CONTROL",
    (name) => {
      expect(classifyToolName(name)).toBe<SemanticClass>("META_CONTROL");
    },
  );
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
