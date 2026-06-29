import { Either } from "effect";
import { describe, expect, it } from "vitest";
import { decodeHimaConfig, decodeHimaConfigEither } from "../src/config.js";

describe("HimaConfig schema", () => {
  // ── happy-path ────────────────────────────────────────────────────────────

  it("decodes an empty config {} (all fields optional)", () => {
    expect(decodeHimaConfig({})).toEqual({});
  });

  it("decodes a stageSkills override for the 'discovery' stage", () => {
    const value = {
      stageSkills: {
        discovery: {
          force: [{ source: "user", id: "my-discovery-skill" }],
          inject: [{ source: "base", id: "context-inject" }],
        },
      },
    };
    expect(decodeHimaConfig(value)).toEqual(value);
  });

  it("decodes a stageSkills override with only 'force' (inject absent)", () => {
    const value = {
      stageSkills: {
        spec: {
          force: [
            { source: "corpus", id: "corpus-spec-driven-development" },
            { source: "project", id: "local-spec-helper" },
          ],
        },
      },
    };
    expect(decodeHimaConfig(value)).toEqual(value);
  });

  it("decodes a roles override with model 'haiku'", () => {
    const value = {
      roles: {
        "spec-writer": {
          model: "haiku",
          stages: ["spec"],
          forcedSkills: [
            { source: "corpus", id: "corpus-spec-driven-development" },
          ],
        },
      },
    };
    expect(decodeHimaConfig(value)).toEqual(value);
  });

  it("decodes a roles override with model 'sonnet' and no stages restriction", () => {
    const value = {
      roles: {
        executor: {
          model: "sonnet",
          forcedSkills: [
            { source: "corpus", id: "corpus-code-quality-maintainability" },
          ],
        },
      },
    };
    expect(decodeHimaConfig(value)).toEqual(value);
  });

  it("decodes a full cycle replacement (cycle field present)", () => {
    const value = {
      cycle: {
        id: "custom-cycle-v1",
        name: "Custom Cycle",
        stages: [
          {
            id: "research",
            name: "Research",
            forceSkills: [{ source: "corpus", id: "corpus-ai-ml-product-engineering" }],
            injectSkills: [],
            entryAllowed: true,
          },
        ],
      },
    };
    expect(decodeHimaConfig(value)).toEqual(value);
  });

  it("decodes a combined stageSkills + roles config", () => {
    const value = {
      stageSkills: {
        impl: {
          force: [{ source: "project", id: "project-impl-helper" }],
        },
      },
      roles: {
        reviewer: {
          model: "haiku",
          stages: ["impl", "test"],
        },
      },
    };
    expect(decodeHimaConfig(value)).toEqual(value);
  });

  // ── rejection cases ───────────────────────────────────────────────────────

  it("rejects a bad SkillRef source in stageSkills.force", () => {
    const result = decodeHimaConfigEither({
      stageSkills: {
        discovery: {
          force: [{ source: "external", id: "some-skill" }],
        },
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a bad SkillRef source in roles.forcedSkills", () => {
    const result = decodeHimaConfigEither({
      roles: {
        executor: {
          forcedSkills: [{ source: "registry", id: "some-skill" }],
        },
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects role model 'opus' (forbidden by cost-guard §6)", () => {
    const result = decodeHimaConfigEither({
      roles: {
        architect: {
          model: "opus",
        },
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects role model 'fable' (also forbidden)", () => {
    const result = decodeHimaConfigEither({
      roles: {
        executor: {
          model: "fable",
        },
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a cycle override with an invalid stage SkillRef", () => {
    const result = decodeHimaConfigEither({
      cycle: {
        id: "bad-cycle",
        name: "Bad Cycle",
        stages: [
          {
            id: "s1",
            name: "Stage One",
            forceSkills: [{ source: "unknown-registry", id: "x" }],
            injectSkills: [],
            entryAllowed: true,
          },
        ],
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects a cycle override missing required 'id' field", () => {
    const result = decodeHimaConfigEither({
      cycle: {
        name: "No Id Cycle",
        stages: [],
      },
    });
    expect(Either.isLeft(result)).toBe(true);
  });
});
