/**
 * Tests for floor-skills.ts — resolveStageForceSkillsForFloor.
 *
 * Required scenarios (task spec R-017):
 *   (1) discovery at M     → base only
 *   (2) discovery at H     → base + corpus-architecture-system-design
 *   (3) discovery at C     → base + architecture-system-design + security-privacy-compliance
 *   (4) dedup              → no duplicate when base already contains an addition
 *   (5) unknown stage      → baseSkills unchanged at any floor
 *
 * Additional coverage:
 *   - T and L floors also return base only
 *   - All five known stages exercise H and C paths
 *   - FLOOR_SKILL_ADDITIONS exported map structural smoke-tests
 */

import { describe, expect, it } from "vitest";
import type { SkillRef } from "@hima/schemas";
import {
  FLOOR_SKILL_ADDITIONS,
  resolveStageForceSkillsForFloor,
} from "../src/floor-skills.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Default discovery base from DEV_CYCLE. */
const DISCOVERY_BASE: SkillRef = {
  source: "corpus",
  id: "corpus-technical-analysis-discovery",
};

const SPEC_BASE: SkillRef = {
  source: "corpus",
  id: "corpus-spec-driven-development",
};

const DESIGN_BASE: SkillRef = {
  source: "corpus",
  id: "corpus-architecture-system-design",
};

const IMPL_BASE: SkillRef = {
  source: "corpus",
  id: "corpus-code-quality-maintainability",
};

const VERIFY_BASE: SkillRef = {
  source: "corpus",
  id: "corpus-quality-engineering",
};

// Floor additions referenced explicitly in tests
const ARCH: SkillRef = {
  source: "corpus",
  id: "corpus-architecture-system-design",
};

const SECURITY: SkillRef = {
  source: "corpus",
  id: "corpus-security-privacy-compliance",
};

const SPEC_H: SkillRef = {
  source: "corpus",
  id: "corpus-specification-requirements",
};

const SPEC_C: SkillRef = {
  source: "corpus",
  id: "corpus-software-delivery-governance",
};

const DESIGN_H: SkillRef = {
  source: "corpus",
  id: "corpus-api-design",
};

const IMPL_H: SkillRef = {
  source: "corpus",
  id: "corpus-performance-engineering",
};

const IMPL_C: SkillRef = {
  source: "corpus",
  id: "corpus-concurrency-distributed-correctness",
};

const CUSTOM: SkillRef = { source: "user", id: "my-custom-skill" };

// ─────────────────────────────────────────────────────────────────────────────
// (1) T / L / M floors → base only
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveStageForceSkillsForFloor — T / L / M floors", () => {
  it("discovery at T returns baseSkills only", () => {
    expect(
      resolveStageForceSkillsForFloor([DISCOVERY_BASE], "discovery", "T"),
    ).toEqual([DISCOVERY_BASE]);
  });

  it("discovery at L returns baseSkills only", () => {
    expect(
      resolveStageForceSkillsForFloor([DISCOVERY_BASE], "discovery", "L"),
    ).toEqual([DISCOVERY_BASE]);
  });

  it("discovery at M returns baseSkills only", () => {
    expect(
      resolveStageForceSkillsForFloor([DISCOVERY_BASE], "discovery", "M"),
    ).toEqual([DISCOVERY_BASE]);
  });

  it("returns empty array when base is empty at M", () => {
    expect(resolveStageForceSkillsForFloor([], "discovery", "M")).toEqual([]);
  });

  it("multi-skill base preserved at M", () => {
    const base: SkillRef[] = [DISCOVERY_BASE, CUSTOM];
    expect(resolveStageForceSkillsForFloor(base, "discovery", "M")).toEqual(
      base,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) H floor — per-stage H additions
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveStageForceSkillsForFloor — H floor additions", () => {
  it("discovery at H appends corpus-architecture-system-design", () => {
    const result = resolveStageForceSkillsForFloor(
      [DISCOVERY_BASE],
      "discovery",
      "H",
    );
    expect(result).toEqual([DISCOVERY_BASE, ARCH]);
  });

  it("spec at H appends corpus-specification-requirements", () => {
    const result = resolveStageForceSkillsForFloor([SPEC_BASE], "spec", "H");
    expect(result).toEqual([SPEC_BASE, SPEC_H]);
  });

  it("design at H appends corpus-api-design", () => {
    const result = resolveStageForceSkillsForFloor(
      [DESIGN_BASE],
      "design",
      "H",
    );
    expect(result).toEqual([DESIGN_BASE, DESIGN_H]);
  });

  it("impl at H appends corpus-performance-engineering", () => {
    const result = resolveStageForceSkillsForFloor([IMPL_BASE], "impl", "H");
    expect(result).toEqual([IMPL_BASE, IMPL_H]);
  });

  it("verify at H appends corpus-security-privacy-compliance", () => {
    const result = resolveStageForceSkillsForFloor(
      [VERIFY_BASE],
      "verify",
      "H",
    );
    expect(result).toEqual([VERIFY_BASE, SECURITY]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) C floor — H additions + C additions (C includes H)
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveStageForceSkillsForFloor — C floor (C includes H)", () => {
  it("discovery at C includes H addition (architecture) AND C addition (security)", () => {
    const result = resolveStageForceSkillsForFloor(
      [DISCOVERY_BASE],
      "discovery",
      "C",
    );
    expect(result).toEqual([DISCOVERY_BASE, ARCH, SECURITY]);
  });

  it("spec at C includes specification-requirements (H) AND software-delivery-governance (C)", () => {
    const result = resolveStageForceSkillsForFloor([SPEC_BASE], "spec", "C");
    expect(result).toEqual([SPEC_BASE, SPEC_H, SPEC_C]);
  });

  it("design at C includes api-design (H) AND security-privacy-compliance (C)", () => {
    const result = resolveStageForceSkillsForFloor(
      [DESIGN_BASE],
      "design",
      "C",
    );
    expect(result).toEqual([DESIGN_BASE, DESIGN_H, SECURITY]);
  });

  it("impl at C includes performance-engineering (H) AND concurrency-distributed-correctness (C)", () => {
    const result = resolveStageForceSkillsForFloor([IMPL_BASE], "impl", "C");
    expect(result).toEqual([IMPL_BASE, IMPL_H, IMPL_C]);
  });

  it("verify at C: H adds security, C list is empty — result is base + security only (no extra)", () => {
    const result = resolveStageForceSkillsForFloor(
      [VERIFY_BASE],
      "verify",
      "C",
    );
    // verify has no C-specific additions — result is base + H only
    expect(result).toEqual([VERIFY_BASE, SECURITY]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) Deduplication
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveStageForceSkillsForFloor — deduplication by source+id", () => {
  it("does not duplicate an H addition already present in baseSkills", () => {
    // ARCH is the H addition for discovery; pre-load it in base
    const result = resolveStageForceSkillsForFloor(
      [DISCOVERY_BASE, ARCH],
      "discovery",
      "H",
    );
    expect(result.filter((r) => r.id === ARCH.id && r.source === ARCH.source)).toHaveLength(1);
    expect(result).toEqual([DISCOVERY_BASE, ARCH]);
  });

  it("does not duplicate a C addition already present in baseSkills", () => {
    // Pre-load both H and C additions for discovery
    const result = resolveStageForceSkillsForFloor(
      [DISCOVERY_BASE, ARCH, SECURITY],
      "discovery",
      "C",
    );
    const archCount = result.filter(
      (r) => r.source === ARCH.source && r.id === ARCH.id,
    ).length;
    const secCount = result.filter(
      (r) => r.source === SECURITY.source && r.id === SECURITY.id,
    ).length;
    expect(archCount).toBe(1);
    expect(secCount).toBe(1);
    expect(result).toEqual([DISCOVERY_BASE, ARCH, SECURITY]);
  });

  it("treats source+id together — same id but different source is NOT a duplicate", () => {
    // A user-scoped ref with the same id as ARCH should not suppress the corpus addition
    const userArch: SkillRef = {
      source: "user",
      id: "corpus-architecture-system-design",
    };
    const result = resolveStageForceSkillsForFloor(
      [DISCOVERY_BASE, userArch],
      "discovery",
      "H",
    );
    // The corpus-source ARCH should still be appended
    expect(result).toContainEqual(ARCH);
    expect(result).toContainEqual(userArch);
    expect(result).toHaveLength(3);
  });

  it("base skills are placed first, additions appended in order (no reorder)", () => {
    const result = resolveStageForceSkillsForFloor(
      [DISCOVERY_BASE, CUSTOM],
      "discovery",
      "H",
    );
    expect(result[0]).toEqual(DISCOVERY_BASE);
    expect(result[1]).toEqual(CUSTOM);
    expect(result[2]).toEqual(ARCH);
    expect(result).toHaveLength(3);
  });

  it("empty base at H produces only the H additions", () => {
    const result = resolveStageForceSkillsForFloor([], "discovery", "H");
    expect(result).toEqual([ARCH]);
  });

  it("empty base at C produces H + C additions only", () => {
    const result = resolveStageForceSkillsForFloor([], "discovery", "C");
    expect(result).toEqual([ARCH, SECURITY]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (5) Unknown stage → baseSkills unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveStageForceSkillsForFloor — unknown stage", () => {
  it("returns baseSkills unchanged at H for an unknown stage", () => {
    const base: SkillRef[] = [CUSTOM];
    const result = resolveStageForceSkillsForFloor(base, "unknown-stage", "H");
    expect(result).toEqual(base);
  });

  it("returns baseSkills unchanged at C for an unknown stage", () => {
    const base: SkillRef[] = [DISCOVERY_BASE, CUSTOM];
    const result = resolveStageForceSkillsForFloor(base, "nonexistent", "C");
    expect(result).toEqual(base);
  });

  it("returns empty array unchanged for unknown stage with empty base", () => {
    expect(resolveStageForceSkillsForFloor([], "unknown", "C")).toEqual([]);
  });

  it("unknown stage at T is also unchanged", () => {
    expect(
      resolveStageForceSkillsForFloor([CUSTOM], "ghost-stage", "T"),
    ).toEqual([CUSTOM]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOOR_SKILL_ADDITIONS — exported map structural smoke-tests
// ─────────────────────────────────────────────────────────────────────────────

describe("FLOOR_SKILL_ADDITIONS — exported map shape", () => {
  const knownStages = [
    "discovery",
    "analysis",
    "spec",
    "design",
    "impl",
    "test",
    "verify",
    "maintenance",
  ] as const;

  it("has entries for all expected DEV_CYCLE stages", () => {
    for (const stage of knownStages) {
      expect(FLOOR_SKILL_ADDITIONS[stage]).toBeDefined();
    }
  });

  it("all H entries use source 'corpus'", () => {
    for (const stage of knownStages) {
      const entry = FLOOR_SKILL_ADDITIONS[stage];
      if (entry !== undefined) {
        for (const ref of entry.H) {
          expect(ref.source).toBe("corpus");
        }
      }
    }
  });

  it("all C entries use source 'corpus'", () => {
    for (const stage of knownStages) {
      const entry = FLOOR_SKILL_ADDITIONS[stage];
      if (entry !== undefined) {
        for (const ref of entry.C) {
          expect(ref.source).toBe("corpus");
        }
      }
    }
  });

  it("H additions are non-empty for all 8 known stages", () => {
    for (const stage of knownStages) {
      const entry = FLOOR_SKILL_ADDITIONS[stage];
      expect(entry?.H.length).toBeGreaterThan(0);
    }
  });

  it("H additions are non-empty at H for analysis/test/maintenance specifically", () => {
    for (const stage of ["analysis", "test", "maintenance"] as const) {
      const result = resolveStageForceSkillsForFloor([], stage, "H");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("verify has empty C additions (verify C list is [])", () => {
    expect(FLOOR_SKILL_ADDITIONS["verify"]?.C).toEqual([]);
  });

  it("test and maintenance have empty C additions", () => {
    expect(FLOOR_SKILL_ADDITIONS["test"]?.C).toEqual([]);
    expect(FLOOR_SKILL_ADDITIONS["maintenance"]?.C).toEqual([]);
  });
});
