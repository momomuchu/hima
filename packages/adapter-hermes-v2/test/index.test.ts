import { describe, expect, it } from "vitest";

describe("adapter-hermes-v2 smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});

describe("adapter-hermes-v2 capability map", () => {
  it("re-exports HERMES_CAPABILITY_MAP with correct runtime", async () => {
    const { HERMES_CAPABILITY_MAP } = await import("../src/index.js");
    expect(HERMES_CAPABILITY_MAP.runtime).toBe("hermes");
  });

  it("stop gate is degraded on hermes", async () => {
    const { HERMES_CAPABILITY_MAP } = await import("../src/index.js");
    expect(HERMES_CAPABILITY_MAP.gates.stop.level).toBe("degraded");
  });

  it("subagent_start gate is absent on hermes", async () => {
    const { HERMES_CAPABILITY_MAP } = await import("../src/index.js");
    expect(HERMES_CAPABILITY_MAP.gates.subagent_start.level).toBe("absent");
  });

  it("documents at least 4 hermes runtime gaps", async () => {
    const { HERMES_CAPABILITY_MAP } = await import("../src/index.js");
    expect(HERMES_CAPABILITY_MAP.runtimeGaps.length).toBeGreaterThanOrEqual(4);
  });

  it("runtime gaps include no-system-prompt and sticky-profiles", async () => {
    const { HERMES_CAPABILITY_MAP } = await import("../src/index.js");
    const ids = HERMES_CAPABILITY_MAP.runtimeGaps.map((g) => g.id);
    expect(ids).toContain("hermes-no-system-prompt-hook");
    expect(ids).toContain("hermes-sticky-profiles");
    expect(ids).toContain("hermes-subagents-skip-context-files");
    expect(ids).toContain("hermes-magic-words-gateway-only");
  });
});

describe("adapter-hermes-v2 hook bindings", () => {
  it("returns 9 bindings (one per gate)", async () => {
    const { getHermesHookBindings, GATE_TYPES } = await import("../src/index.js");
    expect(getHermesHookBindings()).toHaveLength(GATE_TYPES.length);
  });

  it("subagent_start binding is absent with null nativeEvent", async () => {
    const { getHermesHookBindings } = await import("../src/index.js");
    const binding = getHermesHookBindings().find((b) => b.gateType === "subagent_start");
    expect(binding?.status).toBe("absent");
    expect(binding?.nativeEvent).toBeNull();
    expect(binding?.canBlock).toBe(false);
  });

  it("stop binding is degraded and non-blocking", async () => {
    const { getHermesHookBindings } = await import("../src/index.js");
    const binding = getHermesHookBindings().find((b) => b.gateType === "stop");
    expect(binding?.status).toBe("degraded");
    expect(binding?.canBlock).toBe(false);
    expect(binding?.nativeEvent).toBe("on_session_end");
  });

  it("pre_tool binding is supported and blocking", async () => {
    const { getHermesHookBindings } = await import("../src/index.js");
    const binding = getHermesHookBindings().find((b) => b.gateType === "pre_tool");
    expect(binding?.status).toBe("supported");
    expect(binding?.canBlock).toBe(true);
    expect(binding?.nativeEvent).toBe("pre_tool_call");
  });

  it("all bindings have target=hermes", async () => {
    const { getHermesHookBindings } = await import("../src/index.js");
    for (const binding of getHermesHookBindings()) {
      expect(binding.target).toBe("hermes");
    }
  });

  it("all bindings have a non-empty command", async () => {
    const { getHermesHookBindings } = await import("../src/index.js");
    for (const binding of getHermesHookBindings()) {
      expect(binding.command.length).toBeGreaterThan(0);
    }
  });
});
