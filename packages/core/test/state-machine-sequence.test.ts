import { describe, expect, it } from "vitest";
import { MACRO_CYCLES, SUB_PHASES, transitionPlanningState } from "../src/index.js";
import {
  isRegressiveTransition,
  isSequentialTransition,
  nextMacroCycle,
  nextPlanningPosition,
  nextSubPhase,
  sequenceIndex,
  validatePlanningTransition,
} from "../src/state-machine/subphases.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";

describe("state-machine canonical sequence", () => {
  it("traverses the full 8x7 macro-cycle and subphase grid", () => {
    const project = createDefaultPlanningProject("run_test");
    let state = project.state;
    const visited = [`${state.phase}/${state.sub_phase}`];

    for (let index = 1; index < MACRO_CYCLES.length * SUB_PHASES.length; index += 1) {
      const result = transitionPlanningState(state, {});
      state = result.newSnapshot;
      visited.push(`${state.phase}/${state.sub_phase}`);
    }

    expect(visited).toHaveLength(56);
    expect(visited[0]).toBe("discovery/Observer");
    expect(visited.at(-1)).toBe("learning/Transmit");
    expect(new Set(visited).size).toBe(56);
    expect(() => transitionPlanningState(state, {})).toThrow(
      "Cannot implicitly advance from learning/Transmit",
    );
  });

  it("computes next subphase, cycle, and absolute sequence order from canonical arrays", () => {
    expect(nextSubPhase("Observer")).toBe("Define");
    expect(nextSubPhase("Transmit")).toBeNull();
    expect(nextMacroCycle("discovery")).toBe("cadrage");
    expect(nextMacroCycle("learning")).toBeNull();

    expect(
      nextPlanningPosition({
        phase: "discovery",
        subPhase: "Transmit",
      }),
    ).toEqual({
      phase: "cadrage",
      subPhase: "Observer",
    });

    expect(
      sequenceIndex({
        phase: "learning",
        subPhase: "Transmit",
      }),
    ).toBe(55);
  });

  it("classifies sequential and regressive transitions", () => {
    const observer = {
      phase: "discovery" as const,
      subPhase: "Observer" as const,
    };
    const define = {
      phase: "discovery" as const,
      subPhase: "Define" as const,
    };
    const later = {
      phase: "build" as const,
      subPhase: "Execute" as const,
    };

    expect(isSequentialTransition(observer, define)).toBe(true);
    expect(isSequentialTransition(observer, later)).toBe(false);
    expect(isRegressiveTransition(later, observer)).toBe(true);
    expect(isRegressiveTransition(observer, later)).toBe(false);
    expect(validatePlanningTransition(later, observer)).toMatchObject({
      valid: false,
      kind: "regressive",
    });
    expect(validatePlanningTransition(observer, later)).toMatchObject({
      valid: false,
      kind: "non_sequential",
    });
    expect(validatePlanningTransition(later, observer, { explicit: true })).toEqual({
      valid: true,
      kind: "explicit",
    });
  });
});
