import { describe, expect, it } from "vitest";
import {
  ALLOWED_OVERLAP_PAIRS,
  AUTO_COMPLETE_TRANSITIONS,
  assertModeActivationAllowed,
  buildModeTransitionError,
  buildModeTransitionMessage,
  EXECUTION_LIKE_MODES,
  evaluateModeActivation,
  getHimaWorkflowModeFamily,
  HIMA_WORKFLOW_MODES,
  type HimaWorkflowMode,
  isAllowedModeOverlap,
  isAutoCompleteModeTransition,
  isHimaWorkflowMode,
  PLANNING_LIKE_MODES,
} from "../src/index.js";

describe("mode exclusion graph", () => {
  it("classifies the planning and execution mode families", () => {
    expect(getHimaWorkflowModeFamily("deep-interview")).toBe("planning");
    expect(getHimaWorkflowModeFamily("ralplan")).toBe("planning");
    expect(getHimaWorkflowModeFamily("autopilot")).toBe("execution");
    expect(getHimaWorkflowModeFamily("ultraqa")).toBe("execution");
    expect(isHimaWorkflowMode("ralph")).toBe(true);
    expect(isHimaWorkflowMode("unknown")).toBe(false);
  });

  it("allows empty, duplicate, and approved overlap activations", () => {
    expect(evaluateModeActivation([], "team")).toMatchObject({
      allowed: true,
      kind: "allow",
      resultingModes: ["team"],
    });

    expect(evaluateModeActivation(["team"], "team")).toMatchObject({
      allowed: true,
      kind: "allow",
      resultingModes: ["team"],
    });

    expect(evaluateModeActivation(["team"], "ralph")).toMatchObject({
      allowed: true,
      kind: "overlap",
      resultingModes: ["team", "ralph"],
    });

    expect(evaluateModeActivation(["autopilot"], "ultrawork")).toMatchObject({
      allowed: true,
      kind: "overlap",
      resultingModes: ["autopilot", "ultrawork"],
    });
  });

  it("auto-completes source-verified planning-to-execution transitions", () => {
    expect(evaluateModeActivation(["deep-interview"], "ralplan")).toEqual({
      allowed: true,
      kind: "auto-complete",
      currentModes: ["deep-interview"],
      requestedMode: "ralplan",
      resultingModes: ["ralplan"],
      autoCompleteModes: ["deep-interview"],
      transitionMessage: "mode transiting: deep-interview -> ralplan",
    });

    expect(evaluateModeActivation(["ralplan", "ultrawork"], "ralph")).toMatchObject({
      allowed: true,
      kind: "auto-complete",
      resultingModes: ["ultrawork", "ralph"],
      autoCompleteModes: ["ralplan"],
    });

    expect(isAutoCompleteModeTransition("ralplan", "autoresearch")).toBe(true);
    expect(buildModeTransitionMessage("ralplan", "autopilot")).toBe(
      "mode transiting: ralplan -> autopilot",
    );
  });

  it("denies unsupported execution overlap and execution-to-planning rollback", () => {
    expect(evaluateModeActivation(["team"], "autopilot")).toMatchObject({
      allowed: false,
      kind: "deny",
      resultingModes: ["team"],
    });

    const rollback = evaluateModeActivation(["autopilot"], "ralplan");
    expect(rollback).toMatchObject({
      allowed: false,
      kind: "deny",
      denialReason: "rollback",
      resultingModes: ["autopilot"],
    });

    expect(() => assertModeActivationAllowed(["autopilot"], "ralplan", "start")).toThrow(
      "Execution-to-planning rollback auto-complete is not allowed",
    );
    expect(buildModeTransitionError(["team"], "autopilot", "start")).toContain(
      "Unsupported workflow overlap: team + autopilot.",
    );
  });

  it("keeps the local catalog internally consistent", () => {
    const allModes = new Set<HimaWorkflowMode>(HIMA_WORKFLOW_MODES);
    const planning = new Set<HimaWorkflowMode>(PLANNING_LIKE_MODES);
    const execution = new Set<HimaWorkflowMode>(EXECUTION_LIKE_MODES);
    const modeFamilySize = planning.size + execution.size;

    expect(allModes.size).toBe(HIMA_WORKFLOW_MODES.length);
    expect(modeFamilySize).toBe(allModes.size);
    expect([...planning].filter((mode) => execution.has(mode))).toEqual([]);

    for (const mode of HIMA_WORKFLOW_MODES) {
      expect(planning.has(mode) || execution.has(mode)).toBe(true);
    }

    const transitionKeys = new Set<string>();
    for (const [source, target] of AUTO_COMPLETE_TRANSITIONS) {
      expect(allModes.has(source)).toBe(true);
      expect(allModes.has(target)).toBe(true);
      transitionKeys.add(`${source}->${target}`);
    }

    expect(transitionKeys.size).toBe(AUTO_COMPLETE_TRANSITIONS.length);
    expect(AUTO_COMPLETE_TRANSITIONS).toHaveLength(6);

    for (const [left, right] of ALLOWED_OVERLAP_PAIRS) {
      expect(left).not.toBe(right);
      expect(allModes.has(left)).toBe(true);
      expect(allModes.has(right)).toBe(true);
      expect(isAllowedModeOverlap(left, right)).toBe(true);
      expect(isAllowedModeOverlap(right, left)).toBe(true);
    }
  });
});
