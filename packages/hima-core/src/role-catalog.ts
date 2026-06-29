/**
 * role-catalog — the 11 forced-parallelization roles for hima v3.
 *
 * SINGLE SOURCE OF TRUTH for all role metadata consumed by both the catalog
 * query layer (getRolesForStage) and the spawn-plan layer (spawnPlan).
 *
 * Each RoleDef carries the union of fields needed by both consumers:
 *
 *   Catalog layer (corpus/adversaryOf shape):
 *     - name          unique human-readable identifier
 *     - mission       one-sentence charter (from PARALLELIZATION-v3.md §1)
 *     - stages        stage names this role is active in
 *     - forcedSkills  corpus SkillRefs injected before the agent's first Write
 *     - adversaryOf   optional: the name of the primary role this role challenges
 *
 *   Spawn-plan layer (coordinator spawn shape):
 *     - roleId        short machine-readable identifier (e.g. "surveyor")
 *     - skillRefs     base SkillRefs for the coordinator spawn manifest (AMENDMENT-001)
 *     - model         agent model (sonnet | haiku); never opus, never inherited
 *     - isAdversarial true when this role's BLOCK findings prevent done-verified (M2)
 *
 * AMENDMENT-002 note: agent count is WORK-driven (spawnRoleTeam always returns
 * the full stage team); criticality scales depth/skills, not head-count.
 *
 * Source: .planning/architecture/PARALLELIZATION-v3.md §1
 */

import type { SkillRef } from "@hima/schemas";

// ---------------------------------------------------------------------------
// AgentModel
// ---------------------------------------------------------------------------

/**
 * The role model each lane agent runs on.
 * Sourced from PART 5 cost-bounds table in PARALLELIZATION-v3.md.
 */
export type AgentModel = "sonnet" | "haiku";

// ---------------------------------------------------------------------------
// RoleDef — unified SSOT type
// ---------------------------------------------------------------------------

export type RoleDef = {
  // ── Catalog layer (corpus/adversaryOf shape) ──────────────────────────────

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

  // ── Spawn-plan layer (coordinator spawn shape) ────────────────────────────

  /** Short machine-readable identifier (e.g. "surveyor"). */
  readonly roleId: string;
  /**
   * Base SkillRefs for the coordinator spawn manifest.
   * Source is always "base" per AMENDMENT-001: core never references corpus-*
   * literals directly. The founder's instance maps base IDs to corpus-* skills.
   */
  readonly skillRefs: readonly SkillRef[];
  /** Model this role runs on (never opus; never inherited). */
  readonly model: AgentModel;
  /**
   * True when this role is the adversarial counterpart for its stage.
   * An adversarial role's open BLOCK findings prevent the stage from reaching
   * done-verified (M2). Corresponds to adversaryOf being set.
   */
  readonly isAdversarial: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a corpus SkillRef from a corpus skill id. */
function cs(id: string): SkillRef {
  return { source: "corpus", id };
}

/** Build a base SkillRef from a base skill id. */
function bs(id: string): SkillRef {
  return { source: "base", id };
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
    roleId: "surveyor",
    skillRefs: [
      bs("technical-analysis-discovery"),
      bs("specification-requirements"),
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // ── R-02 — RISK ANALYST (discovery, analysis) — adversarial to Surveyor ─
  {
    name: "Risk Analyst",
    mission:
      "Challenge the Surveyor's findings. Find gaps, unstated constraints, security surfaces, failure modes. List at least 3 gap hypotheses with the evidence needed to close each.",
    stages: ["discovery", "analysis"],
    forcedSkills: [cs("corpus-specification-requirements")],
    adversaryOf: "Surveyor",
    roleId: "risk-analyst",
    skillRefs: [
      bs("specification-requirements"),
      bs("security-privacy-compliance"),
    ],
    model: "sonnet",
    isAdversarial: true,
  },

  // ── R-03 — RESEARCHER (discovery) ────────────────────────────────────────
  {
    name: "Researcher",
    mission:
      "Look up external facts: versioned docs, official specs, dependency changelogs. Produce cited evidence that the Surveyor's findings can reference.",
    stages: ["discovery"],
    forcedSkills: [cs("corpus-technical-analysis-discovery")],
    roleId: "researcher",
    skillRefs: [bs("technical-analysis-discovery")],
    model: "haiku",
    isAdversarial: false,
  },

  // ── R-04 — SPEC AUTHOR / Specwright (spec) ────────────────────────────────
  // Display name "Spec Author" per the KEY DATA table in the task spec.
  // Machine roleId "specwright" per PARALLELIZATION-v3.md.
  {
    name: "Spec Author",
    mission:
      "Author one assigned slice of the formal specification: a schema chunk, behavior section, or ADR draft. Every criterion must be falsifiable. Add a Falsifies-If block.",
    stages: ["spec"],
    forcedSkills: [
      cs("corpus-spec-driven-development"),
      cs("corpus-schema-driven-development"),
    ],
    roleId: "specwright",
    skillRefs: [
      bs("spec-driven-development"),
      bs("schema-driven-development"),
      bs("specification-requirements"),
    ],
    model: "sonnet",
    isAdversarial: false,
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
    roleId: "contract-guardian",
    skillRefs: [
      bs("spec-driven-development"),
      bs("specification-requirements"),
    ],
    model: "sonnet",
    isAdversarial: true,
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
    roleId: "architect",
    skillRefs: [
      bs("architecture-system-design"),
      bs("domain-modeling-ddd"),
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // ── R-07 — ANTAGONIST (design) — adversarial to Architect ────────────────
  {
    name: "Antagonist",
    mission:
      "Challenge the Architect's design: find brittleness, scalability cliffs, security surfaces, unexamined alternatives. Produce at minimum: 3 failure scenarios, 2 scalability concerns, 1 security surface — each with a concrete remedy.",
    stages: ["design"],
    forcedSkills: [cs("corpus-architecture-system-design")],
    adversaryOf: "Architect",
    roleId: "antagonist",
    skillRefs: [
      bs("architecture-system-design"),
      bs("security-privacy-compliance"),
    ],
    model: "sonnet",
    isAdversarial: true,
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
    roleId: "executor",
    skillRefs: [
      bs("code-quality-maintainability"),
      bs("error-handling-resilience"),
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // ── R-09 — TEST WRITER (test, impl) ─────────────────────────────────────
  {
    name: "Test Writer",
    mission:
      "Author tests that can FAIL — TDD-first posture. Every test corresponds to a spec acceptance criterion. Property-based tests required for any function handling quantities or business rules.",
    stages: ["test", "impl"],
    forcedSkills: [cs("corpus-quality-engineering")],
    roleId: "test-writer",
    skillRefs: [bs("quality-engineering")],
    model: "sonnet",
    isAdversarial: false,
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
    roleId: "reviewer",
    skillRefs: [
      bs("code-quality-maintainability"),
      bs("quality-engineering"),
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // ── R-11 — SECURITY AUDITOR (verify) ─────────────────────────────────────
  {
    name: "Security Auditor",
    mission:
      "Audit the implementation for security surfaces: injection vectors, credential exposure, auth gaps, dependency vulnerabilities. Runs concurrently with Reviewer at verify (H+ floor).",
    stages: ["verify"],
    forcedSkills: [cs("corpus-security-privacy-compliance")],
    roleId: "security-auditor",
    skillRefs: [bs("security-privacy-compliance")],
    model: "sonnet",
    isAdversarial: true,
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
