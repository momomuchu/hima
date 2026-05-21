/**
 * pipeline.test.ts — integration-level tests for runGenerator.
 * Uses canaryOnly:true to avoid dependency on the real corpus path.
 * Tests the full GeneratorResult contract.
 */
import { describe, expect, it } from "vitest";
import { runGenerator } from "../src/index.js";

describe("runGenerator — canaryOnly mode", () => {
  it("returns canary.passed=true", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.canary.passed).toBe(true);
  });

  it("sets top-level passed=true when canary passes", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.passed).toBe(true);
  });

  it("returns zero skillCount and validSkills in canaryOnly mode (corpus not read)", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.skillCount).toBe(0);
    expect(result.validSkills).toBe(0);
  });

  it("returns zero activateCount in canaryOnly mode (MAP skipped)", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.activateCount).toBe(0);
  });

  it("returns empty errors array in canaryOnly mode", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.errors).toEqual([]);
  });

  it("returns empty written array in canaryOnly mode (no emit)", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.written).toEqual([]);
  });

  it("canary.errorCount is >= 3 (non-vacuity: 3 defects injected)", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    expect(result.canary.errorCount).toBeGreaterThanOrEqual(3);
  });

  it("GeneratorResult shape is complete (all fields present)", () => {
    const result = runGenerator({
      corpusRoot: "/nonexistent-corpus",
      activationRulesPath: "/nonexistent-rules.md",
      canaryOnly: true,
    });
    // Assert every field of the GeneratorResult interface is present
    expect(typeof result.skillCount).toBe("number");
    expect(typeof result.validSkills).toBe("number");
    expect(typeof result.activateCount).toBe("number");
    expect(typeof result.validActivate).toBe("number");
    expect(typeof result.keywordEntries).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.canary.passed).toBe("boolean");
    expect(typeof result.canary.errorCount).toBe("number");
    expect(typeof result.canary.message).toBe("string");
    expect(Array.isArray(result.written)).toBe(true);
    expect(typeof result.passed).toBe("boolean");
  });
});
