import { describe, expect, it } from "vitest";
import { runCanary } from "../src/canary.js";
import { SkillCatalogEntrySchema } from "../src/schemas.js";

describe("runCanary", () => {
  it("returns passed=true — validator rejected malformed entry", () => {
    const result = runCanary();
    expect(result.passed).toBe(true);
  });

  it("errorCount is >= 3 — non-vacuity: at least 3 distinct defects are caught", () => {
    const result = runCanary();
    expect(result.errorCount).toBeGreaterThanOrEqual(3);
  });

  it("message describes the rejection count, not the acceptance path", () => {
    const result = runCanary();
    expect(result.message).toMatch(/canary OK/);
    expect(result.message).not.toMatch(/CANARY FAIL/);
  });
});

describe("SkillCatalogEntrySchema — valid entry round-trip", () => {
  it("accepts a hand-built valid SkillCatalogEntry", () => {
    const valid = {
      id: "technical-analysis-discovery",
      title: "Technical Analysis Discovery",
      purpose: "Use this skill when a coding task needs pre-implementation discovery.",
      activation: {
        macroCycles: ["discovery", "build"] as const,
        gateTypes: ["user_prompt", "session_start"] as const,
        riskClasses: ["T", "L", "M", "H", "C"] as const,
        operatingModes: ["bypass", "auto", "pairing"] as const,
        keywords: ["impact analysis", "codebase mapping", "feasibility"],
        auto: true,
      },
      owns: ["current-state comparative analysis decisions"],
      outOfScope: ["system architecture decisions"],
      evidenceProduced: [],
      hookRefs: [],
      subagentRefs: [],
    };
    const result = SkillCatalogEntrySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects an entry whose id is not kebab-case", () => {
    const bad = {
      id: "NOT KEBAB CASE!",
      title: "x",
      purpose: "x",
      activation: {
        macroCycles: ["discovery"] as const,
        riskClasses: ["T"] as const,
        keywords: ["kw"],
        auto: false,
      },
      owns: ["something"],
      outOfScope: ["something else"],
      evidenceProduced: [],
      hookRefs: [],
      subagentRefs: [],
    };
    const result = SkillCatalogEntrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects an entry with empty macroCycles array", () => {
    const bad = {
      id: "valid-id",
      title: "Valid",
      purpose: "purpose text",
      activation: {
        macroCycles: [] as const, // min(1) violation
        riskClasses: ["T"] as const,
        keywords: ["kw"],
        auto: false,
      },
      owns: ["something"],
      outOfScope: ["something else"],
      evidenceProduced: [],
      hookRefs: [],
      subagentRefs: [],
    };
    const result = SkillCatalogEntrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
