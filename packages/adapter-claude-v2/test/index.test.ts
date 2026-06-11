import { describe, expect, it } from "vitest";

describe("adapter-claude-v2 smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});

describe("adapter-claude-v2 capability map", () => {
  it("re-exports CLAUDE_CAPABILITY_MAP with correct runtime", async () => {
    const { CLAUDE_CAPABILITY_MAP } = await import("../src/index.js");
    expect(CLAUDE_CAPABILITY_MAP.runtime).toBe("claude");
  });

  it("has no absent gates", async () => {
    const { CLAUDE_CAPABILITY_MAP, GATE_TYPES } = await import("../src/index.js");
    for (const gateType of GATE_TYPES) {
      expect(CLAUDE_CAPABILITY_MAP.gates[gateType].level).not.toBe("absent");
    }
  });

  it("session_start, post_tool, post_compact are degraded", async () => {
    const { CLAUDE_CAPABILITY_MAP } = await import("../src/index.js");
    expect(CLAUDE_CAPABILITY_MAP.gates.session_start.level).toBe("degraded");
    expect(CLAUDE_CAPABILITY_MAP.gates.post_tool.level).toBe("degraded");
    expect(CLAUDE_CAPABILITY_MAP.gates.post_compact.level).toBe("degraded");
  });

  it("stop, subagent_start, subagent_stop are supported", async () => {
    const { CLAUDE_CAPABILITY_MAP } = await import("../src/index.js");
    expect(CLAUDE_CAPABILITY_MAP.gates.stop.level).toBe("supported");
    expect(CLAUDE_CAPABILITY_MAP.gates.subagent_start.level).toBe("supported");
    expect(CLAUDE_CAPABILITY_MAP.gates.subagent_stop.level).toBe("supported");
  });

  it("has no runtime gaps", async () => {
    const { CLAUDE_CAPABILITY_MAP } = await import("../src/index.js");
    expect(CLAUDE_CAPABILITY_MAP.runtimeGaps).toHaveLength(0);
  });
});

describe("adapter-claude-v2 hook bindings", () => {
  it("returns 9 bindings (one per gate)", async () => {
    const { getClaudeHookBindings, GATE_TYPES } = await import("../src/index.js");
    expect(getClaudeHookBindings()).toHaveLength(GATE_TYPES.length);
  });

  it("pre_tool binding is supported and blocking", async () => {
    const { getClaudeHookBindings } = await import("../src/index.js");
    const binding = getClaudeHookBindings().find((b) => b.gateType === "pre_tool");
    expect(binding?.status).toBe("supported");
    expect(binding?.canBlock).toBe(true);
    expect(binding?.nativeEvent).toBe("PreToolUse");
  });

  it("session_start binding is degraded and non-blocking", async () => {
    const { getClaudeHookBindings } = await import("../src/index.js");
    const binding = getClaudeHookBindings().find((b) => b.gateType === "session_start");
    expect(binding?.status).toBe("degraded");
    expect(binding?.canBlock).toBe(false);
    expect(binding?.nativeEvent).toBe("SessionStart");
  });

  it("all bindings have target=claude", async () => {
    const { getClaudeHookBindings } = await import("../src/index.js");
    for (const binding of getClaudeHookBindings()) {
      expect(binding.target).toBe("claude");
    }
  });

  it("all bindings have commands containing --format claude", async () => {
    const { getClaudeHookBindings } = await import("../src/index.js");
    for (const binding of getClaudeHookBindings()) {
      expect(binding.command).toContain("--format claude");
    }
  });

  it("no bindings are absent (full coverage)", async () => {
    const { getClaudeHookBindings } = await import("../src/index.js");
    for (const binding of getClaudeHookBindings()) {
      expect(binding.status).not.toBe("absent");
    }
  });
});
