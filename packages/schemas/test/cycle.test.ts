import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeCycleDef,
  decodeCycleDefEither,
  DEV_CYCLE,
} from "../src/cycle.js";

describe("CycleDef schema", () => {
  it("DEV_CYCLE decodes against CycleDef without throwing", () => {
    expect(() => decodeCycleDef(DEV_CYCLE)).not.toThrow();
  });

  it("DEV_CYCLE has exactly 8 stages", () => {
    expect(DEV_CYCLE.stages).toHaveLength(8);
  });

  it("DEV_CYCLE stage ids match the canonical order", () => {
    const ids = DEV_CYCLE.stages.map((s) => s.id);
    expect(ids).toEqual([
      "discovery",
      "analysis",
      "spec",
      "design",
      "impl",
      "test",
      "verify",
      "maintenance",
    ]);
  });

  it("spec stage forceSkills includes corpus-spec-driven-development", () => {
    const spec = DEV_CYCLE.stages.find((s) => s.id === "spec");
    expect(spec).toBeDefined();
    const hasSkill = spec!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" && ref.id === "corpus-spec-driven-development",
    );
    expect(hasSkill).toBe(true);
  });

  it("discovery stage forceSkills includes corpus-technical-analysis-discovery", () => {
    const discovery = DEV_CYCLE.stages.find((s) => s.id === "discovery");
    expect(discovery).toBeDefined();
    const hasSkill = discovery!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" &&
        ref.id === "corpus-technical-analysis-discovery",
    );
    expect(hasSkill).toBe(true);
  });

  it("design stage forceSkills includes corpus-architecture-system-design", () => {
    const design = DEV_CYCLE.stages.find((s) => s.id === "design");
    expect(design).toBeDefined();
    const hasSkill = design!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" &&
        ref.id === "corpus-architecture-system-design",
    );
    expect(hasSkill).toBe(true);
  });

  it("impl stage forceSkills includes corpus-code-quality-maintainability", () => {
    const impl = DEV_CYCLE.stages.find((s) => s.id === "impl");
    expect(impl).toBeDefined();
    const hasSkill = impl!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" &&
        ref.id === "corpus-code-quality-maintainability",
    );
    expect(hasSkill).toBe(true);
  });

  it("test and verify stages forceSkills include corpus-quality-engineering", () => {
    for (const stageId of ["test", "verify"]) {
      const stage = DEV_CYCLE.stages.find((s) => s.id === stageId);
      expect(stage).toBeDefined();
      const hasSkill = stage!.forceSkills.some(
        (ref) =>
          ref.source === "corpus" && ref.id === "corpus-quality-engineering",
      );
      expect(hasSkill).toBe(true);
    }
  });

  it("analysis stage forceSkills includes corpus-specification-requirements", () => {
    const analysis = DEV_CYCLE.stages.find((s) => s.id === "analysis");
    expect(analysis).toBeDefined();
    const hasSkill = analysis!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" &&
        ref.id === "corpus-specification-requirements",
    );
    expect(hasSkill).toBe(true);
  });

  it("analysis stage forceSkills includes corpus-domain-modeling-ddd", () => {
    const analysis = DEV_CYCLE.stages.find((s) => s.id === "analysis");
    expect(analysis).toBeDefined();
    const hasSkill = analysis!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" && ref.id === "corpus-domain-modeling-ddd",
    );
    expect(hasSkill).toBe(true);
  });

  it("impl stage forceSkills includes corpus-error-handling-resilience", () => {
    const impl = DEV_CYCLE.stages.find((s) => s.id === "impl");
    expect(impl).toBeDefined();
    const hasSkill = impl!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" && ref.id === "corpus-error-handling-resilience",
    );
    expect(hasSkill).toBe(true);
  });

  it("maintenance stage forceSkills includes corpus-production-reliability-devops", () => {
    const maintenance = DEV_CYCLE.stages.find((s) => s.id === "maintenance");
    expect(maintenance).toBeDefined();
    const hasSkill = maintenance!.forceSkills.some(
      (ref) =>
        ref.source === "corpus" &&
        ref.id === "corpus-production-reliability-devops",
    );
    expect(hasSkill).toBe(true);
  });

  it("all stages have entryAllowed: true", () => {
    for (const stage of DEV_CYCLE.stages) {
      expect(stage.entryAllowed).toBe(true);
    }
  });

  it("decodes a minimal hand-crafted CycleDef", () => {
    const value = {
      id: "test-cycle",
      name: "Test Cycle",
      stages: [
        {
          id: "s1",
          name: "Stage One",
          forceSkills: [{ source: "corpus", id: "corpus-spec-driven-development" }],
          injectSkills: [],
          entryAllowed: true,
        },
      ],
    };
    expect(decodeCycleDef(value)).toEqual(value);
  });

  it("rejects a CycleDef with missing id", () => {
    const result = decodeCycleDefEither({
      name: "No ID Cycle",
      stages: [],
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a CycleDef with invalid stage (bad SkillRef source)", () => {
    const result = decodeCycleDefEither({
      id: "bad-cycle",
      name: "Bad Cycle",
      stages: [
        {
          id: "s1",
          name: "Stage One",
          forceSkills: [{ source: "external", id: "some-skill" }],
          injectSkills: [],
          entryAllowed: true,
        },
      ],
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a StageDef with missing entryAllowed", () => {
    const result = decodeCycleDefEither({
      id: "bad-cycle",
      name: "Bad Cycle",
      stages: [
        {
          id: "s1",
          name: "Stage One",
          forceSkills: [],
          injectSkills: [],
          // entryAllowed missing
        },
      ],
    });
    expect(Either.isLeft(result)).toBe(true);
  });
});
