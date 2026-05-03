import { describe, expect, it } from "vitest";
import { HarnessError, transitionPlanningState } from "../src/index.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";

describe("transitionPlanningState", () => {
  it("advances one canonical state when no explicit target is supplied", () => {
    const project = createDefaultPlanningProject("run_test");
    const result = transitionPlanningState(project.state, {});

    expect(result.newSnapshot.phase).toBe("discovery");
    expect(result.newSnapshot.sub_phase).toBe("Define");
  });

  it("moves macro cycle and subphase as an explicit direct transition", () => {
    const project = createDefaultPlanningProject("run_test");
    const result = transitionPlanningState(project.state, {
      targetPhase: "build",
      targetSubPhase: "Execute",
    });

    expect(result.newSnapshot.phase).toBe("build");
    expect(result.newSnapshot.sub_phase).toBe("Execute");
  });

  it("allows explicit regressive transitions while rejecting unknown current states", () => {
    const project = createDefaultPlanningProject("run_test");
    const advanced = transitionPlanningState(project.state, {
      targetPhase: "validation",
      targetSubPhase: "Verify",
    });
    const regressed = transitionPlanningState(advanced.newSnapshot, {
      targetPhase: "cadrage",
      targetSubPhase: "Define",
    });

    expect(regressed.newSnapshot.phase).toBe("cadrage");
    expect(regressed.newSnapshot.sub_phase).toBe("Define");

    expect(() =>
      transitionPlanningState(
        {
          ...project.state,
          phase: "unknown",
        } as never,
        {},
      ),
    ).toThrow(HarnessError);
  });

  it("updates updated_at without mutating the previous snapshot", () => {
    const project = createDefaultPlanningProject("run_test");
    const before = "2026-05-03T00:00:00.000Z";
    const state = {
      ...project.state,
      updated_at: before,
    };

    const result = transitionPlanningState(state, {});

    expect(result.previousSnapshot).toBe(state);
    expect(result.previousSnapshot.updated_at).toBe(before);
    expect(result.newSnapshot.updated_at).not.toBe(before);
    expect(Date.parse(result.newSnapshot.updated_at)).not.toBeNaN();
  });

  it("uses readable transition errors", () => {
    const project = createDefaultPlanningProject("run_test");
    const terminalState = {
      ...project.state,
      phase: "learning" as const,
      sub_phase: "Transmit" as const,
    };

    expect(() => transitionPlanningState(terminalState, {})).toThrow(
      "Cannot implicitly advance from learning/Transmit",
    );

    expect(() =>
      transitionPlanningState(
        {
          ...project.state,
          sub_phase: "Unknown",
        } as never,
        {},
      ),
    ).toThrow("Unknown subphase: Unknown");
  });
});
