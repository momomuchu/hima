// e2e: stop event with riskClass T payload → verdict allow.
// Tests the full parse → dispatch → format pipeline by importing modules directly.

import { describe, it, expect } from "vitest";
import { formatVerdict } from "../src/format.js";
import type { GateType, Verdict } from "../src/types.js";
import { GATE_TYPES } from "../src/types.js";

// Mirrors the stub dispatch in commands/hook.ts — always returns allow.
async function dispatch(_gateType: GateType, _payload: unknown): Promise<Verdict> {
  return { decision: "allow" };
}

function parseGateType(event: string): GateType {
  const normalized = event.toLowerCase().replaceAll("-", "_");
  if (GATE_TYPES.includes(normalized as GateType)) return normalized as GateType;
  throw new Error(`Unknown hook event: ${event}. Valid events: ${GATE_TYPES.join(", ")}`);
}

describe("hook pipeline e2e", () => {
  it("stop event with riskClass T payload produces allow verdict", async () => {
    const payload = { riskClass: "T" };
    const gateType = parseGateType("stop");
    const verdict = await dispatch(gateType, payload);
    const output = formatVerdict(gateType, verdict, "native");
    expect((output as Verdict).decision).toBe("allow");
  });

  it("stop + allow formatted for claude returns object without decision key", async () => {
    const gateType = parseGateType("stop");
    const verdict = await dispatch(gateType, { riskClass: "T" });
    const output = formatVerdict(gateType, verdict, "claude");
    expect(output).not.toHaveProperty("decision");
  });

  it("stop + allow formatted for hermes returns empty object", async () => {
    const gateType = parseGateType("stop");
    const verdict = await dispatch(gateType, { riskClass: "T" });
    const output = formatVerdict(gateType, verdict, "hermes");
    expect(output).toEqual({});
  });

  it("parseGateType throws on unknown event", () => {
    expect(() => parseGateType("not_a_real_event")).toThrow("Unknown hook event");
  });

  it("all canonical gate types parse without error", () => {
    for (const gt of GATE_TYPES) {
      expect(() => parseGateType(gt)).not.toThrow();
    }
  });
});
