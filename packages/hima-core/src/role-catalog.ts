/**
 * role-catalog — the 11 forced-parallelization roles for hima v3.
 *
 * Each role is a plain typed record (RoleDef) that carries:
 *   - name        unique human-readable identifier
 *   - mission     one-sentence charter (from PARALLELIZATION-v3.md §1)
 *   - stages      stage names this role is active in
 *   - forcedSkills corpus SkillRefs injected into the agent before its first Write
 *   - adversaryOf optional: the name of the primary role this role challenges
 *
 * AMENDMENT-002 note: agent count is WORK-driven (spawnRoleTeam always returns
 * the full stage team); criticality scales depth/skills, not head-count.
 * This catalog is the single source of truth for role metadata; spawnRoleTeam
 * reads it at runtime to resolve team composition for any given stage.
 *
 * Source: .planning/architecture/PARALLELIZATION-v3.md §1
 */

import type { SkillRef } from "@hima/schemas";

// ---------------------------------------------------------------------------
// RoleDef
// ---------------------------------------------------------------------------

export type RoleDef = {
  /** Unique human-readable role name (e.g. "Surveyor"). */
  readonly name: string;
  /** One-sentence mission statement. */
  readonly mission: string;
  /** Stage names where this role is active (matches StageDef.name in @hima/schemas). */
  readonly stages: readonly string[];
  /**
   * SkillRefs that MUST be invoked by the agent before its first Write.
   * Source is always "corpus" — the founder's instance maps these corpus-* ids
   * to the skill routing layer (AMENDMENT-001: never "base" literals here).
   */
  readonly forcedSkills: readonly SkillRef[];
  /**
   * When present, this role is the adversarial counterpart of the named primary role.
   * The adversarial role runs as a dedicated separate agent (H+ floor) or as an
   * advisory inject (M floor) and cannot approve its own primary's work.
   */
  readonly adversaryOf?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a corpus SkillRef from a corpus skill id. */
function cs(id: string): SkillRef {
  return { source: "corpus", id };
}

// ---------------------------------------------------------------------------
// ROLE_CATALOG — 11 roles from PARALLELIZATION-v3.md §1
// ---------------------------------------------------------------------------

export const ROLE_CATALOG: readonly RoleDef[] = [
  // ── R-01 — SURVEYOR (discovery) ──────────────────────────────────────────
  {
    name: "Surveyor",
    mission:
      "Map the problem domain: existing code, dependencies, constraints, unstated requirements, risks. Every claim must cite a file, line, or external source.",
    stages: ["discovery"],
    forcedSkills: [
      cs("corpus-technical-analysis-discovery"),
      cs("corpus-specification-requirements"),
    ],
  },

  // ── R-02 — RISK ANALYST (discovery, analysis) — adversarial to Surveyor ─
  {
    name: "Risk Analyst",
    mission:
      "Challenge the Surveyor's findings. Find gaps, unstated constraints, security surfaces, failure modes. List at least 3 gap hypotheses with the evidence needed to close each.",
    stages: ["discovery", "analysis"],
    forcedSkills: [cs("corpus-specification-requirements")],
    adversaryOf: "Surveyor",
  },

  // ── R-03 — RESEARCHER (discovery) ────────────────────────────────────────
  {
    name: "Researcher",
    mission:
      "Look up external facts: versioned docs, official specs, dependency changelogs. Produce cited evidence that the Surveyor's findings can reference.",
    stages: ["discovery"],
    forcedSkills: [cs("corpus-technical-analysis-discovery")],
  },

  // ── R-04 — SPEC AUTHOR (spec) ─────────────────────────────────────────────
  // Named "Specwright" in PARALLELIZATION-v3.md; normalised to "Spec Author"
  // to match the KEY DATA table in the task spec.
  {
    name: "Spec Author",
    mission:
      "Author one assigned slice of the formal specification: a schema chunk, behavior section, or ADR draft. Every criterion must be falsifiable. Add a Falsifies-If block.",
    stages: ["spec"],
    forcedSkills: [
      cs("corpus-spec-driven-development"),
      cs("corpus-schema-driven-development"),
    ],
  },

  // ── R-05 — CONTRACT GUARDIAN (spec) — adversarial to Spec Author ─────────
  {
    name: "Contract Guardian",
    mission:
      "Audit the spec for completeness, falsifiability, and internal consistency. Find missing Falsifies-If blocks, untestable criteria, and scope items with no analysis traceability.",
    stages: ["spec"],
    forcedSkills: [
      cs("corpus-spec-driven-development"),
      cs("corpus-specification-requirements"),
    ],
    adversaryOf: "Spec Author",
  },

  // ── R-06 — ARCHITECT (design) ─────────────────────────────────────────────
  {
    name: "Architect",
    mission:
      "Design one architectural dimension: data model, API boundary, service topology, or cross-cutting concern. Every structural decision must produce a Decision Record with status:accepted.",
    stages: ["design"],
    forcedSkills: [
      cs("corpus-architecture-system-design"),
      cs("corpus-domain-modeling-ddd"),
    ],
  },

  // ── R-07 — ANTAGONIST (design) — adversarial to Architect ────────────────
  {
    name: "Antagonist",
    mission:
      "Challenge the Architect's design: find brittleness, scalability cliffs, security surfaces, unexamined alternatives. Produce at minimum: 3 failure scenarios, 2 scalability concerns, 1 security surface — each with a concrete remedy.",
    stages: ["design"],
    forcedSkills: [cs("corpus-architecture-system-design")],
    adversaryOf: "Architect",
  },

  // ── R-08 — EXECUTOR (impl) ───────────────────────────────────────────────
  {
    name: "Executor",
    mission:
      "Implement one assigned file or module slice. Read spec and design artifacts for the slice before writing any code. Trace every file to a spec acceptance criterion.",
    stages: ["impl"],
    forcedSkills: [
      cs("corpus-code-quality-maintainability"),
      cs("corpus-error-handling-resilience"),
    ],
  },

  // ── R-09 — TEST WRITER (test, impl) ─────────────────────────────────────
  {
    name: "Test Writer",
    mission:
      "Author tests that can FAIL — TDD-first posture. Every test corresponds to a spec acceptance criterion. Property-based tests required for any function handling quantities or business rules.",
    stages: ["test", "impl"],
    forcedSkills: [cs("corpus-quality-engineering")],
  },

  // ── R-10 — REVIEWER (verify) ─────────────────────────────────────────────
  {
    name: "Reviewer",
    mission:
      "Code review: quality, rule compliance, security, duplication, performance. Structured findings list: (a) quality violations with file+line, (b) security surfaces, (c) spec divergences. Severity: BLOCK or NOTE.",
    stages: ["verify"],
    forcedSkills: [
      cs("corpus-code-quality-maintainability"),
      cs("corpus-quality-engineering"),
    ],
  },

  // ── R-11 — SECURITY AUDITOR (verify) ─────────────────────────────────────
  {
    name: "Security Auditor",
    mission:
      "Audit the implementation for security surfaces: injection vectors, credential exposure, auth gaps, dependency vulnerabilities. Runs concurrently with Reviewer at verify (H+ floor).",
    stages: ["verify"],
    forcedSkills: [cs("corpus-security-privacy-compliance")],
  },
] as const;

// ---------------------------------------------------------------------------
// getRolesForStage
// ---------------------------------------------------------------------------

/**
 * Return all roles active in the given stage (matches RoleDef.stages).
 *
 * This is the primary query API consumed by spawnRoleTeam(). The full role-team
 * is always returned; criticality-gated collapsing (adversarial → advisory inject
 * at M floor) is the caller's responsibility (AMENDMENT-002).
 */
export function getRolesForStage(stage: string): RoleDef[] {
  return ROLE_CATALOG.filter((r) => r.stages.includes(stage));
}
