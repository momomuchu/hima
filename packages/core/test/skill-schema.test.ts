import { describe, expect, it } from "vitest";
import { parseSkillFrontmatter, SkillFrontmatterSchema } from "../src/index.js";

const validSkillFrontmatter = {
  name: "build-inner-loop",
  version: "1.0.0",
  type: "task",
  triggers: ["build", "tdd", "implement"],
  expected_outputs: ["implementation: code change", "evidence: test output"],
  requires_tools: ["shell"],
  fallback_for_toolsets: ["readonly-runtime"],
  description: "Run a risk-calibrated implementation loop.",
} as const;

describe("skill frontmatter schema", () => {
  it("accepts the locked SKILL.md frontmatter fields", () => {
    expect(parseSkillFrontmatter(validSkillFrontmatter)).toEqual(validSkillFrontmatter);
  });

  it("accepts semantic versions with prerelease and build metadata", () => {
    expect(
      parseSkillFrontmatter({
        ...validSkillFrontmatter,
        version: "1.2.3-beta.1+build.7",
      }).version,
    ).toBe("1.2.3-beta.1+build.7");
  });

  it("rejects missing required locked fields", () => {
    const { description: _description, ...missingDescription } = validSkillFrontmatter;

    expect(SkillFrontmatterSchema.safeParse(missingDescription).success).toBe(false);
  });

  it("rejects skill types outside task or knowledge", () => {
    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        type: "agent",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown extra frontmatter fields", () => {
    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        owner: "runtime",
      }).success,
    ).toBe(false);
  });

  it("rejects scalar lists and blank list entries", () => {
    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        triggers: "build",
      }).success,
    ).toBe(false);

    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        expected_outputs: ["implementation: code change", ""],
      }).success,
    ).toBe(false);

    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        requires_tools: ["shell", "   "],
      }).success,
    ).toBe(false);
  });

  it("enforces synthesis name, version, and one-line description shape", () => {
    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        name: "Build Inner Loop",
      }).success,
    ).toBe(false);

    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        version: "v1",
      }).success,
    ).toBe(false);

    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        description: "Line one\nline two",
      }).success,
    ).toBe(false);

    expect(
      SkillFrontmatterSchema.safeParse({
        ...validSkillFrontmatter,
        description: "   ",
      }).success,
    ).toBe(false);
  });
});
