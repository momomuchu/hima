import { describe, expect, it } from "vitest";

describe("storage-core smoke", () => {
  it("package loads", async () => {
    await import("../src/index.js");
  });
});

describe("storage-core capability-map", () => {
  it("exports GATE_TYPES with 9 entries", async () => {
    const { GATE_TYPES } = await import("../src/index.js");
    expect(GATE_TYPES).toHaveLength(9);
  });

  it("hermes has degraded stop gate", async () => {
    const { getGateCapability } = await import("../src/index.js");
    const cap = getGateCapability("hermes", "stop");
    expect(cap.level).toBe("degraded");
  });

  it("hermes has absent subagent_start gate", async () => {
    const { getGateCapability } = await import("../src/index.js");
    const cap = getGateCapability("hermes", "subagent_start");
    expect(cap.level).toBe("absent");
  });

  it("hermes has 4 runtime gaps documented", async () => {
    const { HERMES_CAPABILITY_MAP } = await import("../src/index.js");
    expect(HERMES_CAPABILITY_MAP.runtimeGaps.length).toBeGreaterThanOrEqual(4);
  });

  it("claude has no absent gates", async () => {
    const { CLAUDE_CAPABILITY_MAP, GATE_TYPES } = await import("../src/index.js");
    for (const gateType of GATE_TYPES) {
      expect(CLAUDE_CAPABILITY_MAP.gates[gateType].level).not.toBe("absent");
    }
  });

  it("getLimitedGates returns hermes degraded and absent gates", async () => {
    const { getLimitedGates } = await import("../src/index.js");
    const limited = getLimitedGates("hermes");
    const gateTypes = limited.map((g) => g.gateType);
    expect(gateTypes).toContain("stop");
    expect(gateTypes).toContain("subagent_start");
    expect(gateTypes).toContain("session_start");
  });

  it("codex has absent subagent gates", async () => {
    const { getGateCapability } = await import("../src/index.js");
    expect(getGateCapability("codex", "subagent_start").level).toBe("absent");
    expect(getGateCapability("codex", "subagent_stop").level).toBe("absent");
  });
});

describe("storage-core atomicWriteFile", () => {
  it("exports atomicWriteFile as a function", async () => {
    const { atomicWriteFile } = await import("../src/index.js");
    expect(typeof atomicWriteFile).toBe("function");
  });
});

describe("storage-core withFileLock", () => {
  it("exports withFileLock as a function", async () => {
    const { withFileLock } = await import("../src/index.js");
    expect(typeof withFileLock).toBe("function");
  });
});
