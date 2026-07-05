import { describe, it, expect } from "vitest";
import { translateOpenCode, OPENCODE_MAP } from "../src/adapter-opencode.js";
import type { ForceAction } from "@norm/schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_GATE_TYPES = [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
] as const;

const PENDING_NOTE = "semantics pending web verification";

// ---------------------------------------------------------------------------
// translateOpenCode — blocking actions
// ---------------------------------------------------------------------------

describe("translateOpenCode — hard-block", () => {
  it("returns decision:block and exitCode:2", () => {
    const action: ForceAction = {
      kind: "hard-block",
      reason: "forbidden tool call",
    };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("block");
    expect(result.exitCode).toBe(2);
  });

  it("carries the reason through", () => {
    const action: ForceAction = {
      kind: "hard-block",
      reason: "test reason",
    };
    const result = translateOpenCode(action);
    expect(result.reason).toBe("test reason");
  });
});

describe("translateOpenCode — skill-force", () => {
  it("returns decision:block and exitCode:2", () => {
    const action: ForceAction = {
      kind: "skill-force",
      skillId: "corpus-security",
      reason: "security gate triggered",
    };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("block");
    expect(result.exitCode).toBe(2);
  });

  it("carries the reason through", () => {
    const action: ForceAction = {
      kind: "skill-force",
      skillId: "corpus-ui",
      reason: "skill force reason",
    };
    const result = translateOpenCode(action);
    expect(result.reason).toBe("skill force reason");
  });
});

// ---------------------------------------------------------------------------
// translateOpenCode — inject actions (rich-capable)
// ---------------------------------------------------------------------------

describe("translateOpenCode — rich-inject", () => {
  it("returns decision:continue and exitCode:0", () => {
    const action: ForceAction = {
      kind: "rich-inject",
      content: "## System reminder\n\nApply security guidelines.",
    };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });

  it("puts content into additionalContext (no truncation on OpenCode)", () => {
    const content = "A".repeat(3000); // longer than constrained 1800-byte limit
    const action: ForceAction = {
      kind: "rich-inject",
      content,
    };
    const result = translateOpenCode(action);
    expect(result.additionalContext).toBe(content);
  });

  it("does not set decision:block", () => {
    const action: ForceAction = {
      kind: "rich-inject",
      content: "some context",
    };
    expect(translateOpenCode(action).decision).toBe("continue");
  });
});

describe("translateOpenCode — constrained-inject", () => {
  it("returns decision:continue, exitCode:0, additionalContext=systemMessage", () => {
    const action: ForceAction = {
      kind: "constrained-inject",
      systemMessage: "compact system instruction",
    };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
    expect(result.additionalContext).toBe("compact system instruction");
  });
});

// ---------------------------------------------------------------------------
// translateOpenCode — pass-through / observe actions
// ---------------------------------------------------------------------------

describe("translateOpenCode — deferred-block", () => {
  it("returns decision:continue and exitCode:0 (verdict persisted to disk by caller)", () => {
    const action: ForceAction = {
      kind: "deferred-block",
      verdictFile: "/tmp/verdict.json",
      reason: "stop verdict deferred",
      resolveOn: ["stop"],
    };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });
});

describe("translateOpenCode — observe-only", () => {
  it("returns decision:continue and exitCode:0", () => {
    const action: ForceAction = {
      kind: "observe-only",
      log: "gate telemetry event",
    };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });
});

describe("translateOpenCode — noop", () => {
  it("returns decision:continue and exitCode:0", () => {
    const action: ForceAction = { kind: "noop" };
    const result = translateOpenCode(action);
    expect(result.decision).toBe("continue");
    expect(result.exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OPENCODE_MAP — structural invariants
// ---------------------------------------------------------------------------

describe("OPENCODE_MAP — cell count", () => {
  it("has exactly 9 cells (one per gate type)", () => {
    expect(Object.keys(OPENCODE_MAP)).toHaveLength(9);
  });

  it("covers every gate type", () => {
    for (const gt of ALL_GATE_TYPES) {
      expect(OPENCODE_MAP[gt], `cell for gateType=${gt}`).toBeDefined();
    }
  });
});

describe("OPENCODE_MAP — universal invariants", () => {
  it("user_prompt: universal=true and canBlock=true", () => {
    const c = OPENCODE_MAP["user_prompt"];
    expect(c.universal).toBe(true);
    expect(c.canBlock).toBe(true);
  });

  it("pre_tool: universal=true and canBlock=true", () => {
    const c = OPENCODE_MAP["pre_tool"];
    expect(c.universal).toBe(true);
    expect(c.canBlock).toBe(true);
  });
});

describe("OPENCODE_MAP — pending-verification note on every cell", () => {
  it("every cell carries the pending-verification note", () => {
    for (const gt of ALL_GATE_TYPES) {
      const c = OPENCODE_MAP[gt];
      expect(c.note, `${gt} note`).toBe(PENDING_NOTE);
    }
  });
});

describe("OPENCODE_MAP — gateType field matches key", () => {
  it("every cell's gateType matches its map key", () => {
    for (const gt of ALL_GATE_TYPES) {
      expect(OPENCODE_MAP[gt].gateType, `OPENCODE_MAP[${gt}].gateType`).toBe(gt);
    }
  });
});

describe("OPENCODE_MAP — schema validation at load time", () => {
  it("all 9 cells are defined (decodeGateCapabilityCell ran at import via cell())", () => {
    // If any cell were schema-invalid, the module would have thrown at import time.
    let count = 0;
    for (const gt of ALL_GATE_TYPES) {
      expect(OPENCODE_MAP[gt]).toBeDefined();
      count++;
    }
    expect(count).toBe(9);
  });
});
