/**
 * floor-skills — risk-class-scaled corpus-skill additions per DEV_CYCLE stage.
 *
 * resolveStageForceSkillsForFloor extends a base skill list with corpus
 * additions determined by the active risk floor (RiskClass). Pure function;
 * no I/O, no side effects.
 *
 * Gap R-017: floor-scaled stage skills resolver.
 *
 * Source table: ENTRYPOINTS-v3 Part 4 — floor-skill additions per stage.
 */

import { RISK_ORDER } from "@hima/schemas";
import type { RiskClass, SkillRef } from "@hima/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Floor addition table
// ─────────────────────────────────────────────────────────────────────────────

type FloorAdditions = {
  /** Extra corpus skills added when risk floor is H (High). */
  readonly H: readonly SkillRef[];
  /**
   * Extra corpus skills added when risk floor is C (Critical).
   * These are additive on top of H additions — C always includes H.
   */
  readonly C: readonly SkillRef[];
};

/**
 * FLOOR_SKILL_ADDITIONS — per-stage extra corpus SkillRefs added at H and at C.
 *
 * C additions are additive on top of H (C includes H). Unknown stages return
 * baseSkills unchanged (no floor additions).
 *
 * Source: ENTRYPOINTS-v3 Part 4 — floor-skill table.
 */
export const FLOOR_SKILL_ADDITIONS: Readonly<Record<string, FloorAdditions>> =
  {
    discovery: {
      H: [{ source: "corpus", id: "corpus-architecture-system-design" }],
      C: [{ source: "corpus", id: "corpus-security-privacy-compliance" }],
    },
    spec: {
      H: [{ source: "corpus", id: "corpus-specification-requirements" }],
      C: [{ source: "corpus", id: "corpus-software-delivery-governance" }],
    },
    design: {
      H: [{ source: "corpus", id: "corpus-api-design" }],
      C: [{ source: "corpus", id: "corpus-security-privacy-compliance" }],
    },
    impl: {
      H: [{ source: "corpus", id: "corpus-performance-engineering" }],
      C: [{ source: "corpus", id: "corpus-concurrency-distributed-correctness" }],
    },
    verify: {
      H: [{ source: "corpus", id: "corpus-security-privacy-compliance" }],
      C: [],
    },
    analysis: {
      H: [{ source: "corpus", id: "corpus-domain-modeling-ddd" }],
      C: [{ source: "corpus", id: "corpus-architecture-system-design" }],
    },
    test: {
      H: [{ source: "corpus", id: "corpus-quality-engineering" }],
      C: [],
    },
    maintenance: {
      H: [{ source: "corpus", id: "corpus-production-reliability-devops" }],
      C: [],
    },
  };

// ─────────────────────────────────────────────────────────────────────────────
// resolveStageForceSkillsForFloor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return baseSkills extended with floor-scaled corpus additions for the given stage.
 *
 * Floor rules:
 *   T / L / M → return baseSkills unchanged (no additions)
 *   H         → base + H additions for stageId (deduped by source+id)
 *   C         → base + H additions + C additions for stageId (deduped by source+id)
 *
 * Unknown stages (stageId not in FLOOR_SKILL_ADDITIONS) → return baseSkills unchanged.
 *
 * Deduplication preserves order: base entries first, additions appended in
 * declaration order, skipping any whose source+id is already present.
 *
 * @param baseSkills - The resolved force-skills from resolveStageForceSkills.
 * @param stageId    - The DEV_CYCLE stage identifier (e.g. "discovery", "impl").
 * @param floor      - The active risk class floor for the current ward/prompt.
 * @returns A new array; the original baseSkills array is never mutated.
 */
export function resolveStageForceSkillsForFloor(
  baseSkills: SkillRef[],
  stageId: string,
  floor: RiskClass,
): SkillRef[] {
  // T / L / M — no floor additions
  if (RISK_ORDER[floor] < RISK_ORDER["H"]) {
    return [...baseSkills];
  }

  const additions: FloorAdditions | undefined = FLOOR_SKILL_ADDITIONS[stageId];
  if (additions === undefined) {
    // Unknown stage — no additions defined; return a copy
    return [...baseSkills];
  }

  const toAdd: SkillRef[] = [
    ...additions.H,
    ...(RISK_ORDER[floor] >= RISK_ORDER["C"] ? additions.C : []),
  ];

  return dedupAppend(baseSkills, toAdd);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append refs from `extra` to `base`, skipping any whose source+id already
 * appears in the combined set. Returns a new array; inputs are not mutated.
 */
function dedupAppend(base: SkillRef[], extra: SkillRef[]): SkillRef[] {
  const seen = new Set<string>(base.map(skillKey));
  const result: SkillRef[] = [...base];
  for (const ref of extra) {
    const key = skillKey(ref);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(ref);
    }
  }
  return result;
}

/** Composite key for deduplication: source:id. */
function skillKey(ref: SkillRef): string {
  return `${ref.source}:${ref.id}`;
}
