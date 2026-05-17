import { describe, expect, it } from "vitest";
import {
  assertGateType,
  assertOperatingMode,
  assertRiskClass,
  assertSubPhase,
  CHANGE_TYPES,
  CONFIDENCE_LEVELS,
  compareRiskClass,
  DEFAULT_CHANGE_TYPE,
  DEFAULT_CONFIDENCE_LEVEL,
  DEFAULT_EVIDENCE_KEY,
  DEFAULT_EVIDENCE_STATUS,
  DEFAULT_RUNTIME_CAPABILITY_STATUS,
  DEFAULT_SUB_PHASE,
  EVIDENCE_KEYS,
  EVIDENCE_STATUSES,
  FINAL_STATES,
  GATE_DECISIONS,
  GATE_TYPES,
  isGateType,
  isOperatingMode,
  isRiskClass,
  isSubPhaseValue,
  MACRO_CYCLES,
  MISSING_RUNTIME_BINDING_STATUS,
  OPERATING_MODES,
  parseGateType,
  parseOperatingMode,
  parseRiskClass,
  parseSubPhase,
  RISK_CLASSES,
  RUNTIME_BINDING_STATUSES,
  RUNTIME_CAPABILITY_STATUSES,
  RUNTIME_PROOF_TYPES,
  riskAtLeast,
  STATE_STATUSES,
  SUB_PHASES,
} from "../src/index.js";
import {
  ChangeTypeSchema,
  ConfidenceLevelSchema,
  EvidenceKeySchema,
  EvidenceStatusSchema,
  FinalStateSchema,
  GateDecisionSchema,
  GateTypeSchema,
  MacroCycleSchema,
  OperatingModeSchema,
  RiskClassSchema,
  StateStatusSchema,
  SubPhaseSchema,
} from "../src/schemas/common.js";
import {
  RuntimeBindingStatusSchema,
  RuntimeCapabilityStatusSchema,
  RuntimeProofTypeSchema,
} from "../src/schemas/run-set.schema.js";

describe("canonical vocabulary", () => {
  it("keeps the PFV4 macro cycles and subphases explicit", () => {
    expect(MACRO_CYCLES).toEqual([
      "discovery",
      "cadrage",
      "conception",
      "build",
      "validation",
      "release",
      "run",
      "learning",
    ]);

    expect(SUB_PHASES).toEqual([
      "Observer",
      "Define",
      "Design",
      "Execute",
      "Verify",
      "Capitalize",
      "Transmit",
    ]);
  });

  it("compares risk classes by rank, not lexicographic order", () => {
    expect(compareRiskClass("H", "M")).toBeGreaterThan(0);
    expect(riskAtLeast("C", "H")).toBe(true);
    expect(riskAtLeast("L", "M")).toBe(false);
  });

  it("includes the nine canonical gates", () => {
    expect(GATE_TYPES).toEqual([
      "session_start",
      "user_prompt",
      "pre_tool",
      "post_tool",
      "pre_compact",
      "post_compact",
      "stop",
      "subagent_start",
      "subagent_stop",
    ]);
  });

  it("exports canonical user-facing vocabularies for adapters", () => {
    expect(GATE_DECISIONS).toEqual(["allow", "warn", "block"]);
    expect(EVIDENCE_STATUSES).toEqual(["candidate", "accepted", "rejected"]);
    expect(RUNTIME_PROOF_TYPES).toEqual([
      "config_read",
      "manifest_digest",
      "dry_run",
      "negative_fixture",
      "event_fire",
      "manual_attestation",
    ]);
    expect(CONFIDENCE_LEVELS).toEqual(["low", "medium", "high"]);
    expect(CHANGE_TYPES).toEqual([
      "feature",
      "fix",
      "refactor",
      "migration",
      "infra",
      "deps",
      "docs",
      "architecture_refactor",
    ]);
  });

  it("keeps schemas wired to canonical vocabulary constants", () => {
    expect(MacroCycleSchema.options).toEqual(MACRO_CYCLES);
    expect(SubPhaseSchema.options).toEqual(SUB_PHASES);
    expect(RiskClassSchema.options).toEqual(RISK_CLASSES);
    expect(OperatingModeSchema.options).toEqual(OPERATING_MODES);
    expect(GateTypeSchema.options).toEqual(GATE_TYPES);
    expect(FinalStateSchema.options).toEqual(FINAL_STATES);
    expect(StateStatusSchema.options).toEqual(STATE_STATUSES);
    expect(EvidenceKeySchema.options).toEqual(EVIDENCE_KEYS);
    expect(GateDecisionSchema.options).toEqual(GATE_DECISIONS);
    expect(EvidenceStatusSchema.options).toEqual(EVIDENCE_STATUSES);
    expect(ConfidenceLevelSchema.options).toEqual(CONFIDENCE_LEVELS);
    expect(ChangeTypeSchema.options).toEqual(CHANGE_TYPES);
    expect(RuntimeCapabilityStatusSchema.options).toEqual(RUNTIME_CAPABILITY_STATUSES);
    expect(RuntimeBindingStatusSchema.options).toEqual(RUNTIME_BINDING_STATUSES);
    expect(RuntimeProofTypeSchema.options).toEqual(RUNTIME_PROOF_TYPES);
  });

  it("rejects legacy French risk aliases at the schema boundary", () => {
    expect(RiskClassSchema.safeParse("F").success).toBe(false);
    expect(RiskClassSchema.safeParse("E").success).toBe(false);
    expect(RiskClassSchema.safeParse("É").success).toBe(false);
  });

  it("constructs and rejects C3 value-object vocabulary boundaries", () => {
    expect(parseRiskClass("H")).toBe("H");
    expect(parseSubPhase("Execute")).toBe("Execute");
    expect(parseOperatingMode("pairing")).toBe("pairing");
    expect(parseGateType("pre_tool")).toBe("pre_tool");

    expect(isRiskClass("F")).toBe(false);
    expect(isSubPhaseValue("Plan")).toBe(false);
    expect(isOperatingMode("manual")).toBe(false);
    expect(isGateType("before_tool")).toBe(false);

    expect(() => parseRiskClass("F")).toThrow(TypeError);
    expect(() => parseSubPhase("Plan")).toThrow(TypeError);
    expect(() => parseOperatingMode("manual")).toThrow(TypeError);
    expect(() => parseGateType("before_tool")).toThrow(TypeError);

    expect(() => assertRiskClass("C")).not.toThrow();
    expect(() => assertSubPhase("Verify")).not.toThrow();
    expect(() => assertOperatingMode("auto")).not.toThrow();
    expect(() => assertGateType("stop")).not.toThrow();
  });

  it("exports canonical defaults for command and runtime surfaces", () => {
    expect(DEFAULT_SUB_PHASE).toBe("Observer");
    expect(DEFAULT_EVIDENCE_STATUS).toBe("candidate");
    expect(DEFAULT_EVIDENCE_KEY).toBe("command_output");
    expect(DEFAULT_CONFIDENCE_LEVEL).toBe("medium");
    expect(DEFAULT_CHANGE_TYPE).toBe("feature");
    expect(DEFAULT_RUNTIME_CAPABILITY_STATUS).toBe("available");
    expect(MISSING_RUNTIME_BINDING_STATUS).toBe("missing");
  });
});
