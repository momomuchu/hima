import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeGateEvent,
  decodeGateEventEither,
  decodeGateType,
  decodeGateTypeEither,
  decodeGateVerdict,
  decodeGateVerdictEither,
  decodeForceIntent,
  decodeForceIntentEither,
} from "../src/gate.js";

// ---------------------------------------------------------------------------
// GateType
// ---------------------------------------------------------------------------

describe("GateType schema", () => {
  it("accepts all 9 valid gate types", () => {
    const types = [
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
    for (const t of types) {
      expect(decodeGateType(t)).toBe(t);
    }
  });

  it("rejects an unknown gate type", () => {
    const result = decodeGateTypeEither("unknown_gate");
    expect(Either.isLeft(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GateEvent
// ---------------------------------------------------------------------------

describe("GateEvent schema", () => {
  it("decodes a minimal gate event (gateType only)", () => {
    const value = { gateType: "pre_tool" };
    expect(decodeGateEvent(value)).toEqual(value);
  });

  it("decodes a gate event with all optional fields", () => {
    const value = {
      gateType: "user_prompt",
      toolName: undefined,
      promptContent: "write a plan",
      toolInput: { key: "val" },
    };
    const result = decodeGateEvent(value);
    expect(result.gateType).toBe("user_prompt");
    expect(result.promptContent).toBe("write a plan");
  });

  it("decodes a pre_tool event with toolName and toolInput", () => {
    const value = {
      gateType: "pre_tool",
      toolName: "Edit",
      toolInput: { file_path: "/foo/bar.ts", old_string: "x", new_string: "y" },
    };
    const result = decodeGateEvent(value);
    expect(result.gateType).toBe("pre_tool");
    expect(result.toolName).toBe("Edit");
  });

  it("rejects a gate event with invalid gateType", () => {
    const result = decodeGateEventEither({ gateType: "nope" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a gate event missing gateType", () => {
    const result = decodeGateEventEither({ toolName: "Edit" });
    expect(Either.isLeft(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ForceIntent
// ---------------------------------------------------------------------------

describe("ForceIntent schema", () => {
  it("decodes a SkillGate intent with blocksUntilInvoked=true", () => {
    const value = {
      kind: "SkillGate",
      skillId: "corpus-spec-driven-development",
      blocksUntilInvoked: true,
    };
    expect(decodeForceIntent(value)).toEqual(value);
  });

  it("decodes a SkillGate intent with blocksUntilInvoked=false", () => {
    const value = {
      kind: "SkillGate",
      skillId: "corpus-architecture-system-design",
      blocksUntilInvoked: false,
    };
    expect(decodeForceIntent(value)).toEqual(value);
  });

  it("decodes a ContextInject intent", () => {
    const value = {
      kind: "ContextInject",
      content: "You must run the spec skill before proceeding.",
    };
    expect(decodeForceIntent(value)).toEqual(value);
  });

  it("decodes a DeferredBlock intent with resolveOn list", () => {
    const value = {
      kind: "DeferredBlock",
      reason: "stop is degraded on Codex runtime",
      resolveOn: ["pre_tool", "user_prompt"],
    };
    expect(decodeForceIntent(value)).toEqual(value);
  });

  it("rejects an unknown intent kind", () => {
    const result = decodeForceIntentEither({ kind: "HardBlock", reason: "x" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects SkillGate missing blocksUntilInvoked", () => {
    const result = decodeForceIntentEither({
      kind: "SkillGate",
      skillId: "some-skill",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects ContextInject missing content", () => {
    const result = decodeForceIntentEither({ kind: "ContextInject" });
    expect(Either.isLeft(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GateVerdict — primary contract, most detailed tests
// ---------------------------------------------------------------------------

describe("GateVerdict schema", () => {
  it("decodes a block verdict with a SkillGate forceIntent", () => {
    const value = {
      decision: "block",
      reason: "spec stage requires corpus-spec-driven-development before impl",
      forceIntent: {
        kind: "SkillGate",
        skillId: "corpus-spec-driven-development",
        blocksUntilInvoked: true,
      },
    };
    const result = decodeGateVerdict(value);
    expect(result.decision).toBe("block");
    expect(result.reason).toBe(
      "spec stage requires corpus-spec-driven-development before impl",
    );
    expect(result.forceIntent).toEqual({
      kind: "SkillGate",
      skillId: "corpus-spec-driven-development",
      blocksUntilInvoked: true,
    });
  });

  it("decodes a warn verdict with a ContextInject forceIntent", () => {
    const value = {
      decision: "warn",
      reason: "inject role context for subagent",
      forceIntent: {
        kind: "ContextInject",
        content: "You are operating in a governed pipeline. Follow PFV4 rules.",
      },
    };
    const result = decodeGateVerdict(value);
    expect(result.decision).toBe("warn");
    expect(result.forceIntent?.kind).toBe("ContextInject");
  });

  it("decodes a block verdict with a DeferredBlock forceIntent", () => {
    const value = {
      decision: "block",
      reason: "stop gate is degraded; verdict deferred",
      forceIntent: {
        kind: "DeferredBlock",
        reason: "stop is degraded on Hermes runtime",
        resolveOn: ["pre_tool", "user_prompt"],
      },
    };
    const result = decodeGateVerdict(value);
    expect(result.decision).toBe("block");
    const fi = result.forceIntent as Extract<
      typeof result.forceIntent,
      { kind: "DeferredBlock" }
    >;
    expect(fi?.resolveOn).toContain("pre_tool");
  });

  it("decodes an allow verdict with no forceIntent", () => {
    const value = { decision: "allow", reason: "gate passed cleanly" };
    const result = decodeGateVerdict(value);
    expect(result.decision).toBe("allow");
    expect(result.forceIntent).toBeUndefined();
  });

  it("rejects a verdict with bad decision value", () => {
    const result = decodeGateVerdictEither({
      decision: "skip",
      reason: "not a real decision",
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a verdict missing reason", () => {
    const result = decodeGateVerdictEither({ decision: "allow" });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a verdict with invalid nested forceIntent", () => {
    const result = decodeGateVerdictEither({
      decision: "block",
      reason: "some reason",
      forceIntent: { kind: "Unknown", data: 42 },
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a verdict with forceIntent missing required fields", () => {
    const result = decodeGateVerdictEither({
      decision: "warn",
      reason: "skill required",
      forceIntent: {
        kind: "SkillGate",
        // missing skillId and blocksUntilInvoked
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });
});
