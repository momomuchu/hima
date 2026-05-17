/**
 * edge-g3.test.ts — edge-case hardening for the generator parser/mapper.
 * Coverage: OWNS variant B (heading+dash-list), AUTO-INVOQUER variants C/D,
 * FORCE-INVOKE missing bracket → SOFT default, digit-suffix skill name not
 * misparsed as a hardness bracket, deriveId suffix stripping.
 * All fixtures are inline; no real corpus path is accessed.
 */
import { describe, it, expect } from "vitest";
import { parseRules } from "../src/parse.js";
import { mapSkill } from "../src/map.js";
import type { RawSkill } from "../src/parse.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---- fixture helpers -------------------------------------------------------

function makeRulesFile(content: string): string {
  const dir = join(tmpdir(), `hima-edge-g3-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "ACTIVATION-RULES.md");
  writeFileSync(p, content, "utf8");
  return p;
}

function makeSkill(overrides: Partial<RawSkill> = {}): RawSkill {
  return {
    dir: "technical-analysis-discovery-excellence-book",
    frontmatter: {},
    body: "",
    ...overrides,
  };
}

// ---- (1) OWNS variant B — heading + dash-list ------------------------------
// skill-catalog-map.md §6: 7/32 books use `## OWNS\n\n- item1\n- item2`
// The parser must return each dash-list item as one element, not an empty array.

describe("OWNS variant B — heading + dash-list (§6)", () => {
  it("parses ## OWNS heading with dash-list items into owns array", () => {
    const skill = makeSkill({
      dir: "api-design-excellence-book",
      body: `## OWNS

- API style selection decisions
- contract-first design decisions
- versioning decisions

## NE GERE PAS

- implementation decisions

# API Design Skill

Prose here.
`,
    });
    const entry = mapSkill(skill);
    expect(entry.owns).toContain("API style selection decisions");
    expect(entry.owns).toContain("contract-first design decisions");
    expect(entry.owns).toContain("versioning decisions");
  });

  it("returns 3 items, not the fallback singleton", () => {
    const skill = makeSkill({
      dir: "api-design-excellence-book",
      body: `## OWNS

- API style selection decisions
- contract-first design decisions
- versioning decisions

# API Design Skill

Prose.
`,
    });
    const entry = mapSkill(skill);
    // Fallback is ["API Design decisions"] (one item); variant B should give 3.
    expect(entry.owns.length).toBeGreaterThanOrEqual(3);
  });
});

// ---- (2) AUTO-INVOQUER variant D — unquoted comma list (no quotes) ---------
// skill-catalog-map.md §7: variant D is an unquoted comma list.
// extractKeywords (map.ts lines 121-135) fires the variant D path only when
// the quoted/dash-list pass yields kws.length === 0.
// The parser regex `/AUTO-INVOQUER\b[^:]*:?\s*(.+)/i` stops at the first `:`,
// so the body must use `**AUTO-INVOQUER** when: kw1, kw2, kw3` (colon after
// "when") for the unquoted list to land in the capture group cleanly.
// When no preamble keyword precedes the list, the full comma list is captured
// and split directly — yielding one element per comma token.

describe("AUTO-INVOQUER variant D — unquoted comma list (§7)", () => {
  it("extracts ≥3 keywords from an unquoted comma list after 'when:'", () => {
    const skill = makeSkill({
      dir: "ui-knowledge-excellence-book",
      body: `**OWNS**: UI pattern decisions
**NE GERE PAS**: backend decisions

# UI Knowledge Skill

**AUTO-INVOQUER** when: UI, UX, landing page, forms, components

Prose here.
`,
    });
    const entry = mapSkill(skill);
    expect(entry.activation.keywords.length).toBeGreaterThanOrEqual(3);
  });

  it("keyword list includes the individual comma-split items (lowercase)", () => {
    const skill = makeSkill({
      dir: "ui-knowledge-excellence-book",
      body: `**OWNS**: UI pattern decisions
**NE GERE PAS**: backend decisions

# UI Knowledge Skill

**AUTO-INVOQUER** when: UI, UX, landing page

Prose.
`,
    });
    const entry = mapSkill(skill);
    // Each part trimmed + lowercased
    expect(entry.activation.keywords).toContain("ui");
    expect(entry.activation.keywords).toContain("ux");
    expect(entry.activation.keywords).toContain("landing page");
  });

  it("sets auto=true when variant D yields keywords", () => {
    const skill = makeSkill({
      dir: "ui-knowledge-excellence-book",
      body: `**OWNS**: UI pattern decisions
**NE GERE PAS**: backend decisions

# UI Knowledge Skill

**AUTO-INVOQUER** when: UI, UX, landing page

Prose.
`,
    });
    const entry = mapSkill(skill);
    expect(entry.activation.auto).toBe(true);
  });
});

// ---- (3) AUTO-INVOQUER variant C — embedded in frontmatter description -----
// skill-catalog-map.md §7 variant C: idea-sourcing embeds AUTO-INVOQUER inside
// the YAML description field. The parser must scan frontmatter.description too.

describe("AUTO-INVOQUER variant C — embedded in frontmatter description (§7)", () => {
  it("extracts keywords from AUTO-INVOQUER inside frontmatter description", () => {
    const skill = makeSkill({
      dir: "idea-sourcing-excellence-book",
      frontmatter: {
        name: "idea-sourcing",
        description: "Idea sourcing and brainstorming. AUTO-INVOQUER when: 'idea sourcing', 'brainstorming', 'problem log'.",
      },
      body: `**OWNS**: idea sourcing decisions
**NE GERE PAS**: execution decisions

# Idea Sourcing Skill

Prose here.
`,
    });
    const entry = mapSkill(skill);
    expect(entry.activation.keywords).toContain("idea sourcing");
    expect(entry.activation.keywords).toContain("brainstorming");
    expect(entry.activation.keywords).toContain("problem log");
  });

  it("sets auto=true when keywords found only in frontmatter description", () => {
    const skill = makeSkill({
      dir: "idea-sourcing-excellence-book",
      frontmatter: {
        description: "AUTO-INVOQUER when: 'idea sourcing', 'brainstorming'.",
      },
      // body intentionally has no AUTO-INVOQUER line
      body: `**OWNS**: idea sourcing decisions\n**NE GERE PAS**: execution\n\n# Idea Sourcing Skill\n\nProse.\n`,
    });
    const entry = mapSkill(skill);
    expect(entry.activation.auto).toBe(true);
  });
});

// ---- (4) FORCE-INVOKE missing [HARD]/[SOFT] bracket → defaults to SOFT -----
// activation-rules-topology.md §Parse-risks item 4:
// "absence means SOFT" — 130 SOFT rules have no bracket in source.

describe("FORCE-INVOKE missing bracket → SOFT default (Parse-risks §4)", () => {
  it("defaults hardness to SOFT when no [HARD] or [SOFT] bracket is present", () => {
    const path = makeRulesFile(`
### RULE build-001
SIGNAL: "refactor"
FORCE-INVOKE: code-quality-maintainability
HANDOFF: NEXT-STAGE quality-release
PRECEDENCE: 10
`);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "build-001");
    expect(r).toBeDefined();
    expect(r!.hardness).toBe("SOFT");
  });

  it("forceInvokeSkill is the bare skill name when bracket is absent", () => {
    const path = makeRulesFile(`
### RULE build-002
SIGNAL: "cleanup"
FORCE-INVOKE: code-quality-maintainability
HANDOFF: NEXT-STAGE quality-release
PRECEDENCE: 5
`);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "build-002");
    expect(r!.forceInvokeSkill).toBe("code-quality-maintainability");
  });
});

// ---- (5) Digit suffix in skill name not misparsed as hardness bracket ------
// activation-rules-topology.md §Parse-risks item 4:
// "saas-finance-unit-economics" — regex must NOT mistake the digit suffix for a
// [HARD]/[SOFT] bracket.  The real FINANCE terminal rules use this skill name.

describe("Digit-suffix skill name not misparsed as hardness bracket (Parse-risks §4)", () => {
  it("saas-finance-unit-economics with [HARD] bracket is parsed correctly", () => {
    const path = makeRulesFile(`
### RULE FINANCE-saas-finance-unit-economics-001
SIGNAL: "should I build this"
FORCE-INVOKE: saas-finance-unit-economics [HARD]
HANDOFF: END
PRECEDENCE: 100
`);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "FINANCE-saas-finance-unit-economics-001");
    expect(r).toBeDefined();
    expect(r!.forceInvokeSkill).toBe("saas-finance-unit-economics");
    expect(r!.hardness).toBe("HARD");
  });

  it("saas-finance-unit-economics without bracket is not truncated or misparsed", () => {
    const path = makeRulesFile(`
### RULE FINANCE-saas-finance-unit-economics-002
SIGNAL: "viable economics"
FORCE-INVOKE: saas-finance-unit-economics
HANDOFF: END
PRECEDENCE: 90
`);
    const rules = parseRules(path);
    const r = rules.find((r) => r.id === "FINANCE-saas-finance-unit-economics-002");
    expect(r).toBeDefined();
    // The full name including the digit suffix must be preserved
    expect(r!.forceInvokeSkill).toBe("saas-finance-unit-economics");
    // No bracket → SOFT
    expect(r!.hardness).toBe("SOFT");
  });
});

// ---- (6) deriveId strips both -excellence-book and -excellence suffixes -----
// skill-catalog-map.md §5 inventory: seo-content-organic-growth-excellence and
// idea-to-pmf-excellence both use the -excellence suffix (without -book).
// map.ts deriveId applies both replace calls in sequence.

describe("deriveId suffix stripping (GAP-1)", () => {
  it("strips -excellence-book suffix (standard case)", () => {
    const skill = makeSkill({ dir: "technical-analysis-discovery-excellence-book" });
    const entry = mapSkill(skill);
    expect(entry.id).toBe("technical-analysis-discovery");
  });

  it("strips -excellence suffix (books without -book, e.g. idea-to-pmf-excellence)", () => {
    const skill = makeSkill({
      dir: "idea-to-pmf-excellence-book",
      frontmatter: { name: "idea-to-pmf-excellence" },
    });
    const entry = mapSkill(skill);
    // frontmatter name takes precedence; -excellence suffix stripped
    expect(entry.id).toBe("idea-to-pmf");
  });

  it("strips -excellence suffix from frontmatter name: seo-content-organic-growth-excellence", () => {
    const skill = makeSkill({
      dir: "seo-content-organic-growth-excellence-book",
      frontmatter: { name: "seo-content-organic-growth-excellence" },
    });
    const entry = mapSkill(skill);
    expect(entry.id).toBe("seo-content-organic-growth");
  });

  it("strips -excellence suffix from frontmatter name: ux-research-product-experience-excellence", () => {
    const skill = makeSkill({
      dir: "ux-research-product-experience-excellence-book",
      frontmatter: { name: "ux-research-product-experience-excellence" },
    });
    const entry = mapSkill(skill);
    expect(entry.id).toBe("ux-research-product-experience");
  });

  it("does not double-strip a name that has neither suffix", () => {
    const skill = makeSkill({
      dir: "product-strategy-excellence-book",
      frontmatter: { name: "product-strategy" },
    });
    const entry = mapSkill(skill);
    expect(entry.id).toBe("product-strategy");
  });
});
