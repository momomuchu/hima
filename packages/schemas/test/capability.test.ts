import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeGateCapabilityCell,
  decodeGateCapabilityCellEither,
} from "../src/capability.js";

describe("GateCapabilityCell schema", () => {
  const claudePreTool = {
    gateType: "pre_tool",
    level: "supported",
    canBlock: true,
    injectionMode: "rich",
    enforcementStrength: "hard",
    skillForcing: true,
    compensatingMechanism: "none",
    universal: true,
    subagents: "native",
    profiles: "runtime-profiles",
  };

  it("decodes a valid claude pre_tool cell", () => {
    expect(decodeGateCapabilityCell(claudePreTool)).toEqual(claudePreTool);
  });

  it("decodes a cell with optional maxInjectionBytes and note", () => {
    // Sample value is 8000 (SOT: Codex skill-listing char cap) purely as a schema-shape
    // fixture — this test only exercises the optional-field decode path, it is not a
    // claim about a specific runtime's real cap. See docs/research/runtime-capabilities.sot.json
    // (SOT correction C1): the real Codex constrained cells carry no documented
    // injection-byte cap at all; the previous "1800" fixture here echoed that same myth
    // (1800 was HERMES_API_TIMEOUT / Codex's job_max_runtime_seconds, both SECOND
    // timeouts, not byte limits).
    const syntheticCellWithCap = {
      gateType: "pre_tool",
      level: "supported",
      canBlock: true,
      injectionMode: "constrained",
      enforcementStrength: "hard",
      skillForcing: false,
      compensatingMechanism: "none",
      maxInjectionBytes: 8000,
      universal: true,
      subagents: "poll-file",
      profiles: "none",
      note: "systemMessage only, capped at 8000 chars",
    };
    const decoded = decodeGateCapabilityCell(syntheticCellWithCap);
    expect(decoded.maxInjectionBytes).toBe(8000);
    expect(decoded.note).toBe("systemMessage only, capped at 8000 chars");
  });

  it("decodes a degraded stop cell with deferred enforcement", () => {
    const hermesStop = {
      gateType: "stop",
      level: "degraded",
      canBlock: false,
      injectionMode: "none",
      enforcementStrength: "deferred",
      skillForcing: false,
      compensatingMechanism: "deferred_stop_verdict",
      universal: false,
      subagents: "absent",
      profiles: "injected-role-context",
    };
    const decoded = decodeGateCapabilityCell(hermesStop);
    expect(decoded.level).toBe("degraded");
    expect(decoded.enforcementStrength).toBe("deferred");
    expect(decoded.compensatingMechanism).toBe("deferred_stop_verdict");
  });

  it("decodes an absent gate with intercept compensating mechanism", () => {
    const hermesSubagentStart = {
      gateType: "subagent_start",
      level: "absent",
      canBlock: false,
      injectionMode: "none",
      enforcementStrength: "observe_only",
      skillForcing: false,
      compensatingMechanism: "intercept_delegate_task_pre_tool",
      universal: false,
      subagents: "absent",
      profiles: "none",
    };
    expect(decodeGateCapabilityCell(hermesSubagentStart).level).toBe("absent");
  });

  it("rejects a bad enforcementStrength value", () => {
    const bad = { ...claudePreTool, enforcementStrength: "strict" };
    const result = decodeGateCapabilityCellEither(bad);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a bad gateType value", () => {
    const bad = { ...claudePreTool, gateType: "unknown_gate" };
    const result = decodeGateCapabilityCellEither(bad);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a bad injectionMode value", () => {
    const bad = { ...claudePreTool, injectionMode: "full" };
    const result = decodeGateCapabilityCellEither(bad);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects missing required field canBlock", () => {
    const { canBlock: _omit, ...bad } = claudePreTool;
    const result = decodeGateCapabilityCellEither(bad);
    expect(Either.isLeft(result)).toBe(true);
  });

  it("accepts cell without optional fields (maxInjectionBytes, note)", () => {
    const decoded = decodeGateCapabilityCell(claudePreTool);
    expect(decoded.maxInjectionBytes).toBeUndefined();
    expect(decoded.note).toBeUndefined();
  });
});
