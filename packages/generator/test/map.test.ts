/**
 * map.test.ts — unit tests for Stage 1 MAP.
 * Covers: mapSkill GAP defaults, PRESETS count, buildActivateSkill schema.
 * Uses small inline RawSkill fixtures; does NOT depend on the real corpus.
 */
import { describe, expect, it } from "vitest";
import { buildActivateSkill, mapSkill, PRESETS } from "../src/map.js";
import type { RawSkill } from "../src/parse.js";
import {
  MACRO_CYCLES,
  OPERATING_MODES,
  RISK_CLASSES,
  SkillFrontmatterSchema,
} from "../src/schemas.js";

// ---- fixture builders -----------------------------------------------------

function makeSkill(overrides: Partial<RawSkill> = {}): RawSkill {
  return {
    dir: "technical-analysis-discovery-excellence-book",
    frontmatter: {},
    body: `**OWNS**: current-state comparative analysis decisions
**NE GERE PAS**: system architecture decisions
**AUTO-INVOQUER** when: "impact analysis", "codebase mapping", "feasibility"

# Technical Analysis Discovery Skill

Use this skill when a coding task needs pre-implementation discovery.
`,
    ...overrides,
  };
}

// ---- mapSkill — id derivation ---------------------------------------------

describe("mapSkill — id derivation", () => {
  it("strips -excellence-book suffix from directory name (GAP-1)", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.id).toBe("technical-analysis-discovery");
  });

  it("prefers frontmatter name over directory name when present", () => {
    const skill = makeSkill({ frontmatter: { name: "my-custom-skill" } });
    const entry = mapSkill(skill);
    expect(entry.id).toBe("my-custom-skill");
  });
});

// ---- mapSkill — title -----------------------------------------------------

describe("mapSkill — title", () => {
  it("strips the 'Skill' suffix from the H1 heading (GAP-2)", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.title).toBe("Technical Analysis Discovery");
    expect(entry.title).not.toMatch(/Skill/i);
  });

  it("falls back to titleCase(id) when body has no H1", () => {
    const skill = makeSkill({ body: "No heading here." });
    const entry = mapSkill(skill);
    // titleCase of "technical-analysis-discovery" → "Technical Analysis Discovery"
    expect(entry.title).toBe("Technical Analysis Discovery");
  });
});

// ---- mapSkill — GAP defaults (macroCycles, riskClasses, operatingModes) ---

describe("mapSkill — GAP defaults", () => {
  it("GAP-4: macroCycles defaults to ALL 8 macro cycles", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.activation.macroCycles).toEqual([...MACRO_CYCLES]);
    expect(entry.activation.macroCycles).toHaveLength(8);
  });

  it("GAP-5: gateTypes defaults to [user_prompt, session_start]", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.activation.gateTypes).toEqual(["user_prompt", "session_start"]);
  });

  it("GAP-6: riskClasses defaults to ALL 5 risk classes", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.activation.riskClasses).toEqual([...RISK_CLASSES]);
    expect(entry.activation.riskClasses).toHaveLength(5);
  });

  it("GAP-7: operatingModes defaults to ALL 3 operating modes", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.activation.operatingModes).toEqual([...OPERATING_MODES]);
    expect(entry.activation.operatingModes).toHaveLength(3);
  });

  it("GAP-9: evidenceProduced defaults to []", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.evidenceProduced).toEqual([]);
  });

  it("GAP-10: hookRefs defaults to []", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.hookRefs).toEqual([]);
  });

  it("GAP-11: subagentRefs defaults to []", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.subagentRefs).toEqual([]);
  });
});

// ---- mapSkill — keywords from AUTO-INVOQUER --------------------------------

describe("mapSkill — keywords from AUTO-INVOQUER", () => {
  it("extracts quoted phrases from AUTO-INVOQUER line", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.activation.keywords).toContain("impact analysis");
    expect(entry.activation.keywords).toContain("codebase mapping");
    expect(entry.activation.keywords).toContain("feasibility");
  });

  it("sets auto=true when keywords are extracted", () => {
    const entry = mapSkill(makeSkill());
    expect(entry.activation.auto).toBe(true);
  });

  it("sets auto=false when there is no AUTO-INVOQUER line", () => {
    const skill = makeSkill({
      body: `**OWNS**: something\n**NE GERE PAS**: something else\n\n# My Skill\n\nProse here.\n`,
    });
    const entry = mapSkill(skill);
    expect(entry.activation.auto).toBe(false);
  });

  it("id strips -excellence-book even when AUTO-INVOQUER is in frontmatter description", () => {
    const skill = makeSkill({
      dir: "idea-sourcing-excellence-book",
      frontmatter: {
        description: 'AUTO-INVOQUER when: "idea sourcing", "brainstorming"',
      },
      body: `**OWNS**: idea sourcing decisions\n**NE GERE PAS**: execution decisions\n\n# Idea Sourcing Skill\n\nProse.\n`,
    });
    const entry = mapSkill(skill);
    expect(entry.id).toBe("idea-sourcing");
    expect(entry.activation.keywords).toContain("idea sourcing");
    expect(entry.activation.keywords).toContain("brainstorming");
  });
});

// ---- PRESETS count ---------------------------------------------------------

describe("PRESETS", () => {
  it("has exactly 16 entries (one per Pn preset)", () => {
    expect(PRESETS).toHaveLength(16);
  });

  it("pid values are P1 through P16 with no gaps", () => {
    const pids = PRESETS.map((p) => p.pid);
    for (let i = 1; i <= 16; i++) {
      expect(pids).toContain(`P${i}`);
    }
  });

  it("P1 spans the full window (start=1, stop=13)", () => {
    const p1 = PRESETS.find((p) => p.pid === "P1");
    expect(p1).toBeDefined();
    expect(p1?.start).toBe(1);
    expect(p1?.stop).toBe(13);
  });

  it("P16 is the scope preset (start=1, stop=1)", () => {
    const p16 = PRESETS.find((p) => p.pid === "P16");
    expect(p16).toBeDefined();
    expect(p16?.start).toBe(1);
    expect(p16?.stop).toBe(1);
  });

  it("all presets have non-blank name and intent", () => {
    for (const p of PRESETS) {
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(p.intent.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---- buildActivateSkill — SkillFrontmatterSchema --------------------------

describe("buildActivateSkill — frontmatter passes SkillFrontmatterSchema", () => {
  it("P1 (full) frontmatter is valid per SkillFrontmatterSchema", () => {
    const p1 = PRESETS.find((p) => p.pid === "P1");
    expect(p1).toBeDefined();
    if (!p1) return;
    const skill = buildActivateSkill(p1, ["technical-analysis-discovery"]);
    const result = SkillFrontmatterSchema.safeParse(skill.frontmatter);
    expect(result.success).toBe(true);
  });

  it("P16 (scope) frontmatter is valid per SkillFrontmatterSchema", () => {
    const p16 = PRESETS.find((p) => p.pid === "P16");
    expect(p16).toBeDefined();
    if (!p16) return;
    const skill = buildActivateSkill(p16, []);
    const result = SkillFrontmatterSchema.safeParse(skill.frontmatter);
    expect(result.success).toBe(true);
  });

  it("all 16 presets produce valid SkillFrontmatterSchema frontmatter", () => {
    for (const p of PRESETS) {
      const skill = buildActivateSkill(p, []);
      const result = SkillFrontmatterSchema.safeParse(skill.frontmatter);
      expect(result.success, `P${p.pid} (${p.name}) frontmatter failed validation`).toBe(true);
    }
  });

  it("presetId matches Pn regex (P1-P16)", () => {
    for (const p of PRESETS) {
      const skill = buildActivateSkill(p, []);
      expect(skill.presetId).toMatch(/^P(?:[1-9]|1[0-6])$/);
    }
  });

  it("window.start <= window.stop for all presets", () => {
    for (const p of PRESETS) {
      const skill = buildActivateSkill(p, []);
      expect(skill.window.start).toBeLessThanOrEqual(skill.window.stop);
    }
  });
});
