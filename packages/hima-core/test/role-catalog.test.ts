import { describe, expect, it } from "vitest";
import {
  ROLE_CATALOG,
  getRolesForStage,
} from "../src/role-catalog.js";

// ---------------------------------------------------------------------------
// Catalog shape
// ---------------------------------------------------------------------------

describe("ROLE_CATALOG", () => {
  it("contains exactly 11 roles", () => {
    expect(ROLE_CATALOG).toHaveLength(11);
  });

  it("has unique role names", () => {
    const names = ROLE_CATALOG.map((r) => r.name);
    const unique = new Set(names);
    expect(unique.size).toBe(11);
  });

  it("every role has at least one forced skill", () => {
    for (const role of ROLE_CATALOG) {
      expect(role.forcedSkills.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("every role.forcedSkills entry is a valid corpus SkillRef (source=corpus, non-empty id)", () => {
    for (const role of ROLE_CATALOG) {
      for (const skill of role.forcedSkills) {
        expect(skill.source).toBe("corpus");
        expect(typeof skill.id).toBe("string");
        expect(skill.id.length).toBeGreaterThan(0);
      }
    }
  });

  it("every role has at least one stage", () => {
    for (const role of ROLE_CATALOG) {
      expect(role.stages.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("adversaryOf, when present, references an existing role name", () => {
    const names = new Set(ROLE_CATALOG.map((r) => r.name));
    for (const role of ROLE_CATALOG) {
      if (role.adversaryOf !== undefined) {
        expect(names.has(role.adversaryOf)).toBe(true);
      }
    }
  });

  // Adversarial pairs from PARALLELIZATION-v3.md §1
  it("Surveyor←adversary is Risk Analyst", () => {
    const ra = ROLE_CATALOG.find((r) => r.name === "Risk Analyst");
    expect(ra?.adversaryOf).toBe("Surveyor");
  });

  it("Spec Author←adversary is Contract Guardian", () => {
    const cg = ROLE_CATALOG.find((r) => r.name === "Contract Guardian");
    expect(cg?.adversaryOf).toBe("Spec Author");
  });

  it("Architect←adversary is Antagonist", () => {
    const ant = ROLE_CATALOG.find((r) => r.name === "Antagonist");
    expect(ant?.adversaryOf).toBe("Architect");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — discovery
// ---------------------------------------------------------------------------

describe("getRolesForStage('discovery')", () => {
  it("returns exactly 3 roles", () => {
    const roles = getRolesForStage("discovery");
    expect(roles).toHaveLength(3);
  });

  it("includes Surveyor", () => {
    const names = getRolesForStage("discovery").map((r) => r.name);
    expect(names).toContain("Surveyor");
  });

  it("includes Risk Analyst", () => {
    const names = getRolesForStage("discovery").map((r) => r.name);
    expect(names).toContain("Risk Analyst");
  });

  it("includes Researcher", () => {
    const names = getRolesForStage("discovery").map((r) => r.name);
    expect(names).toContain("Researcher");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — spec
// ---------------------------------------------------------------------------

describe("getRolesForStage('spec')", () => {
  it("returns exactly 2 roles (Spec Author + Contract Guardian)", () => {
    const roles = getRolesForStage("spec");
    expect(roles).toHaveLength(2);
  });

  it("includes Spec Author", () => {
    const names = getRolesForStage("spec").map((r) => r.name);
    expect(names).toContain("Spec Author");
  });

  it("includes Contract Guardian", () => {
    const names = getRolesForStage("spec").map((r) => r.name);
    expect(names).toContain("Contract Guardian");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — design
// ---------------------------------------------------------------------------

describe("getRolesForStage('design')", () => {
  it("returns exactly 2 roles (Architect + Antagonist)", () => {
    const roles = getRolesForStage("design");
    expect(roles).toHaveLength(2);
  });

  it("includes Architect", () => {
    const names = getRolesForStage("design").map((r) => r.name);
    expect(names).toContain("Architect");
  });

  it("includes Antagonist", () => {
    const names = getRolesForStage("design").map((r) => r.name);
    expect(names).toContain("Antagonist");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — impl
// ---------------------------------------------------------------------------

describe("getRolesForStage('impl')", () => {
  it("includes Executor", () => {
    const names = getRolesForStage("impl").map((r) => r.name);
    expect(names).toContain("Executor");
  });

  it("includes Test Writer (concurrent at H+)", () => {
    const names = getRolesForStage("impl").map((r) => r.name);
    expect(names).toContain("Test Writer");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — test
// ---------------------------------------------------------------------------

describe("getRolesForStage('test')", () => {
  it("includes Test Writer", () => {
    const names = getRolesForStage("test").map((r) => r.name);
    expect(names).toContain("Test Writer");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — verify
// ---------------------------------------------------------------------------

describe("getRolesForStage('verify')", () => {
  it("returns exactly 2 roles", () => {
    const roles = getRolesForStage("verify");
    expect(roles).toHaveLength(2);
  });

  it("includes Reviewer", () => {
    const names = getRolesForStage("verify").map((r) => r.name);
    expect(names).toContain("Reviewer");
  });

  it("includes Security Auditor", () => {
    const names = getRolesForStage("verify").map((r) => r.name);
    expect(names).toContain("Security Auditor");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — analysis (Risk Analyst appears in two stages)
// ---------------------------------------------------------------------------

describe("getRolesForStage('analysis')", () => {
  it("includes Risk Analyst (active in both discovery and analysis)", () => {
    const names = getRolesForStage("analysis").map((r) => r.name);
    expect(names).toContain("Risk Analyst");
  });
});

// ---------------------------------------------------------------------------
// getRolesForStage — unknown stage
// ---------------------------------------------------------------------------

describe("getRolesForStage — unknown stage", () => {
  it("returns an empty array for an unknown stage", () => {
    expect(getRolesForStage("nonexistent")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Specific forced-skill spot-checks (key role → required corpus skill)
// ---------------------------------------------------------------------------

describe("forced skills spot-checks", () => {
  it("Surveyor has corpus-technical-analysis-discovery", () => {
    const surveyor = ROLE_CATALOG.find((r) => r.name === "Surveyor")!;
    const ids = surveyor.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-technical-analysis-discovery");
  });

  it("Surveyor has corpus-specification-requirements", () => {
    const surveyor = ROLE_CATALOG.find((r) => r.name === "Surveyor")!;
    const ids = surveyor.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-specification-requirements");
  });

  it("Spec Author has corpus-spec-driven-development", () => {
    const sa = ROLE_CATALOG.find((r) => r.name === "Spec Author")!;
    const ids = sa.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-spec-driven-development");
  });

  it("Spec Author has corpus-schema-driven-development", () => {
    const sa = ROLE_CATALOG.find((r) => r.name === "Spec Author")!;
    const ids = sa.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-schema-driven-development");
  });

  it("Architect has corpus-architecture-system-design", () => {
    const arch = ROLE_CATALOG.find((r) => r.name === "Architect")!;
    const ids = arch.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-architecture-system-design");
  });

  it("Architect has corpus-domain-modeling-ddd", () => {
    const arch = ROLE_CATALOG.find((r) => r.name === "Architect")!;
    const ids = arch.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-domain-modeling-ddd");
  });

  it("Executor has corpus-code-quality-maintainability", () => {
    const exec = ROLE_CATALOG.find((r) => r.name === "Executor")!;
    const ids = exec.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-code-quality-maintainability");
  });

  it("Executor has corpus-error-handling-resilience", () => {
    const exec = ROLE_CATALOG.find((r) => r.name === "Executor")!;
    const ids = exec.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-error-handling-resilience");
  });

  it("Test Writer has corpus-quality-engineering", () => {
    const tw = ROLE_CATALOG.find((r) => r.name === "Test Writer")!;
    const ids = tw.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-quality-engineering");
  });

  it("Reviewer has corpus-code-quality-maintainability", () => {
    const rev = ROLE_CATALOG.find((r) => r.name === "Reviewer")!;
    const ids = rev.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-code-quality-maintainability");
  });

  it("Reviewer has corpus-quality-engineering", () => {
    const rev = ROLE_CATALOG.find((r) => r.name === "Reviewer")!;
    const ids = rev.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-quality-engineering");
  });

  it("Security Auditor has corpus-security-privacy-compliance", () => {
    const sa = ROLE_CATALOG.find((r) => r.name === "Security Auditor")!;
    const ids = sa.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-security-privacy-compliance");
  });

  it("Antagonist has corpus-architecture-system-design", () => {
    const ant = ROLE_CATALOG.find((r) => r.name === "Antagonist")!;
    const ids = ant.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-architecture-system-design");
  });

  it("Contract Guardian has corpus-spec-driven-development", () => {
    const cg = ROLE_CATALOG.find((r) => r.name === "Contract Guardian")!;
    const ids = cg.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-spec-driven-development");
  });

  it("Contract Guardian has corpus-specification-requirements", () => {
    const cg = ROLE_CATALOG.find((r) => r.name === "Contract Guardian")!;
    const ids = cg.forcedSkills.map((s) => s.id);
    expect(ids).toContain("corpus-specification-requirements");
  });
});
