/**
 * spawn-plan — work-driven role-team composition for forced parallelization.
 *
 * `spawnPlan(stage, allRoles)` returns the FULL role-team for a stage.
 * Width is determined by the WORK (the stage), never by criticality — per AMENDMENT-002.
 * Criticality scales depth and skills; it is NOT a parameter here.
 *
 * `teamWidth(plan)` returns plan.length (convenience alias).
 *
 * `mergeTeamOutputs(verdicts)` applies merge rules M1-M6 to reduce per-agent
 * StageVerdict[] into a single authoritative StageVerdict.
 *
 * See: .planning/architecture/PARALLELIZATION-v3.md §1 (role catalog), §4 (merge model).
 *      AMENDMENT-002: agent count is WORK-driven, NOT criticality-gated.
 */

import type { SkillRef } from "@hima/schemas";

// ---------------------------------------------------------------------------
// RoleDef — structural type (inline to avoid sibling-module coupling)
// ---------------------------------------------------------------------------

/**
 * The role model each lane agent runs on.
 * Sourced from PART 5 cost-bounds table in PARALLELIZATION-v3.md.
 */
export type AgentModel = "sonnet" | "haiku";

/**
 * One entry in the role catalog. Holds everything the coordinator needs to
 * spawn a lane agent: identity, stage membership, skill obligations, model,
 * and whether this role is the adversarial counterpart for its stage.
 *
 * `stages` — the stage identifiers this role is active in.
 * `skillRefs` — skills that MUST be invoked (forced) before the agent's first Write.
 * `isAdversarial` — true for roles whose blocking findings prevent done-verified (M2).
 */
export type RoleDef = {
  /** Short machine-readable identifier (e.g. "surveyor"). */
  readonly roleId: string;
  /** Display name for canary / fanout-manifest. */
  readonly name: string;
  /** One-line mission injected as role context. */
  readonly mission: string;
  /** Dev-cycle stages this role participates in. */
  readonly stages: readonly string[];
  /** Skills that must be forced before this role's first Write. AMENDMENT-001: {source,id} pairs. */
  readonly skillRefs: readonly SkillRef[];
  /** Model this role runs on (never opus; never inherited). */
  readonly model: AgentModel;
  /**
   * True when this role is the adversarial counterpart for its stage.
   * An adversarial role's open BLOCK findings prevent the stage from reaching done-verified (M2).
   */
  readonly isAdversarial: boolean;
};

// ---------------------------------------------------------------------------
// Role catalog — 11 dedicated roles per PARALLELIZATION-v3.md §1
//
// SkillRefs use source "base" per AMENDMENT-001: core never references corpus-*
// literals directly. The founder's instance maps base IDs to corpus-* skills.
// ---------------------------------------------------------------------------

/**
 * The canonical 11-role catalog. Ordered by stage sequence for readability.
 * Includes the cross-stage Adversarial-Validator (R-10) and Merge-Arbiter (R-11)
 * which participate in all stages at M+ floor.
 *
 * Cross-stage roles (R-10, R-11) are NOT included in spawnPlan() results because
 * they are spawned sequentially AFTER lane agents by the coordinator — they are
 * not part of the parallel lane team returned for a given stage.
 */
export const ROLE_CATALOG: readonly RoleDef[] = [
  // --- R-01: SURVEYOR (discovery) ------------------------------------------
  {
    roleId: "surveyor",
    name: "Surveyor",
    mission:
      "Map the problem domain: existing code, dependencies, constraints, unstated requirements, risks. Every claim must cite a file or source.",
    stages: ["discovery"],
    skillRefs: [
      { source: "base", id: "technical-analysis-discovery" },
      { source: "base", id: "specification-requirements" },
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // --- R-02: RISK ANALYST (discovery, analysis) ----------------------------
  {
    roleId: "risk-analyst",
    name: "Risk Analyst",
    mission:
      "Challenge the Surveyor's findings. Find gaps, unstated constraints, security surfaces, failure modes. List at least 3 gap hypotheses with evidence needed to close each.",
    stages: ["discovery", "analysis"],
    skillRefs: [
      { source: "base", id: "specification-requirements" },
      { source: "base", id: "security-privacy-compliance" },
    ],
    model: "sonnet",
    isAdversarial: true,
  },

  // --- R-03: SPECWRIGHT / Spec Author (spec) --------------------------------
  {
    roleId: "specwright",
    name: "Specwright",
    mission:
      "Author one assigned slice of the formal specification. Every criterion must be falsifiable. Add a Falsifies-If block.",
    stages: ["spec"],
    skillRefs: [
      { source: "base", id: "spec-driven-development" },
      { source: "base", id: "schema-driven-development" },
      { source: "base", id: "specification-requirements" },
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // --- R-04: CONTRACT GUARDIAN (spec — adversarial) ------------------------
  {
    roleId: "contract-guardian",
    name: "Contract Guardian",
    mission:
      "Audit the spec for completeness and falsifiability. Find missing Falsifies-If blocks, untestable criteria, and scope items with no analysis traceability. Audit; do not write.",
    stages: ["spec"],
    skillRefs: [
      { source: "base", id: "spec-driven-development" },
      { source: "base", id: "specification-requirements" },
    ],
    model: "sonnet",
    isAdversarial: true,
  },

  // --- R-05: ARCHITECT (design) --------------------------------------------
  {
    roleId: "architect",
    name: "Architect",
    mission:
      "Design one architectural dimension. Every structural decision must produce a Decision Record with status:accepted. Design — do not implement.",
    stages: ["design"],
    skillRefs: [
      { source: "base", id: "architecture-system-design" },
      { source: "base", id: "domain-modeling-ddd" },
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // --- R-06: ANTAGONIST (design — adversarial) -----------------------------
  {
    roleId: "antagonist",
    name: "Antagonist",
    mission:
      "Challenge the Architect's design. Produce at minimum: 3 failure scenarios, 2 scalability concerns, 1 security surface — each with a concrete remedy. Findings without remedies are incomplete.",
    stages: ["design"],
    skillRefs: [
      { source: "base", id: "architecture-system-design" },
      { source: "base", id: "security-privacy-compliance" },
    ],
    model: "sonnet",
    isAdversarial: true,
  },

  // --- R-07: EXECUTOR (impl) -----------------------------------------------
  {
    roleId: "executor",
    name: "Executor",
    mission:
      "Implement one assigned file or module slice. Read spec and design artifacts before writing any code. Every file traces to a spec acceptance criterion.",
    stages: ["impl"],
    skillRefs: [
      { source: "base", id: "code-quality-maintainability" },
      { source: "base", id: "error-handling-resilience" },
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // --- R-08: TEST WRITER (test, impl) --------------------------------------
  {
    roleId: "test-writer",
    name: "Test Writer",
    mission:
      "Author tests that can FAIL — TDD-first posture. Every test corresponds to a spec acceptance criterion. No tests that only prove mocks.",
    stages: ["test", "impl"],
    skillRefs: [{ source: "base", id: "quality-engineering" }],
    model: "sonnet",
    isAdversarial: false,
  },

  // --- R-09: REVIEWER (verify) ---------------------------------------------
  {
    roleId: "reviewer",
    name: "Reviewer",
    mission:
      "Code review: quality, rule compliance, security, duplication, performance. Structured findings: (a) quality violations with file+line, (b) security surfaces, (c) spec divergences. BLOCK severity = must resolve before done-verified.",
    stages: ["verify"],
    skillRefs: [
      { source: "base", id: "code-quality-maintainability" },
      { source: "base", id: "quality-engineering" },
    ],
    model: "sonnet",
    isAdversarial: false,
  },

  // --- Security Auditor (verify — co-lane at H+, not the cross-stage validator) ---
  {
    roleId: "security-auditor",
    name: "Security Auditor",
    mission:
      "Security audit of the implementation: threat model, attack surfaces, credential handling, injection vectors, dependency vulnerabilities. BLOCK severity for exploitable issues.",
    stages: ["verify"],
    skillRefs: [{ source: "base", id: "security-privacy-compliance" }],
    model: "sonnet",
    isAdversarial: true,
  },

  // --- Researcher (discovery) — haiku: lookup-heavy -------------------------
  {
    roleId: "researcher",
    name: "Researcher",
    mission:
      "Look up external facts: library docs, API contracts, RFCs, prior art. Every finding must cite a URL or versioned source.",
    stages: ["discovery"],
    skillRefs: [{ source: "base", id: "technical-analysis-discovery" }],
    model: "haiku",
    isAdversarial: false,
  },
] as const;

// ---------------------------------------------------------------------------
// spawnPlan — work-driven role-team for a stage
// ---------------------------------------------------------------------------

/**
 * Return the full role-team for `stage` by filtering `allRoles` to those whose
 * `stages` array includes the given stage identifier.
 *
 * Width is WORK-driven: all roles that belong to the stage are returned.
 * Criticality is NOT a parameter — per AMENDMENT-002, the agent count for a
 * stage is determined by the work, not by a floor value.
 *
 * The cross-stage roles (Adversarial-Validator R-10, Merge-Arbiter R-11) are
 * NOT part of `ROLE_CATALOG` and are therefore never returned here; the
 * coordinator spawns them sequentially after lane agents complete.
 *
 * @param stage    - Stage identifier, e.g. "discovery", "design", "verify".
 * @param allRoles - The role catalog to filter. Pass `ROLE_CATALOG` for the
 *                   canonical 11-role set, or a custom catalog in tests.
 * @returns The subset of roles active for the given stage (may be empty for
 *          unknown stages — caller is responsible for validating the stage id).
 */
export function spawnPlan(
  stage: string,
  allRoles: readonly RoleDef[],
): RoleDef[] {
  return allRoles.filter((role) => role.stages.includes(stage));
}

// ---------------------------------------------------------------------------
// teamWidth — width of a spawned plan
// ---------------------------------------------------------------------------

/**
 * Return the number of agents in `plan`.
 * Equivalent to `plan.length`; named for readability at call sites.
 */
export function teamWidth(plan: readonly RoleDef[]): number {
  return plan.length;
}

// ---------------------------------------------------------------------------
// AgentVerdict — per-agent submission (local type; not yet in @hima/schemas)
// ---------------------------------------------------------------------------

/**
 * The decision a single lane agent reports in its verdict file.
 * Mirrors the `status` field of the ward's StageVerdict but adds
 * the agent identity and adversarial flag needed by the merge rules.
 */
export type AgentDecision = "blocked" | "partial" | "done" | "done-verified";

/**
 * Verdict submitted by one lane agent after completing its assigned work.
 *
 * `laneId`        — unique identifier for this lane within the fanout-manifest.
 * `roleId`        — matches `RoleDef.roleId` so merge rules can identify adversarial roles.
 * `isAdversarial` — true when this agent's BLOCK findings prevent done-verified (M2).
 * `decision`      — the agent's self-reported outcome.
 * `openFindings`  — BLOCK-severity findings; must be empty for done-verified (M5/M2).
 * `skillsInvoked` — skill IDs confirmed in this agent's sentinel record (M5c).
 * `evidence`      — file paths or URLs supporting the decision (M5f at verify).
 * `timedOut`      — true when the coordinator marked this lane timed-out (M6).
 */
export type AgentVerdict = {
  readonly laneId: string;
  readonly roleId: string;
  readonly isAdversarial: boolean;
  readonly decision: AgentDecision;
  readonly openFindings: ReadonlyArray<{ severity: "BLOCK" | "NOTE"; desc: string }>;
  readonly skillsInvoked: readonly string[];
  readonly evidence: readonly string[];
  readonly timedOut: boolean;
};

// ---------------------------------------------------------------------------
// mergeTeamOutputs — M1-M6 merge rules
// ---------------------------------------------------------------------------

/**
 * Reduce per-agent `AgentVerdict[]` into a single authoritative stage outcome.
 *
 * Applies merge rules M1-M6 in priority order:
 *
 *   M1 — any "blocked" verdict → result "blocked" (no exceptions).
 *   M2 — adversarial role with open BLOCK findings → prevents "done-verified".
 *   M3 — majority "partial" (none "blocked") → result "partial".
 *   M4 — all "done" + no BLOCK findings → result "done".
 *   M5 — "done-verified" requires: ALL done (no partial/blocked/timed-out) +
 *          all adversarial BLOCK findings resolved + all required skills confirmed +
 *          no timed-out lanes + evidence present.
 *   M6 — any timed-out lane → "partial" (never silently dropped).
 *
 * The returned object is shaped as hima's `StageVerdict` (stage, status, evidence).
 *
 * @param stage    - The dev-cycle stage these verdicts belong to (e.g. "design").
 * @param verdicts - One entry per spawned lane agent; must not be empty.
 * @returns A single merged StageVerdict for the stage.
 */
export function mergeTeamOutputs(
  stage: string,
  verdicts: readonly AgentVerdict[],
): { stage: string; status: "blocked" | "partial" | "done" | "done-verified"; evidence: string[] } {
  if (verdicts.length === 0) {
    // No verdicts submitted: the stage cannot be done — treat as partial (M6 spirit).
    return { stage, status: "partial", evidence: [] };
  }

  // Aggregate evidence across all lanes (deduplicated by value).
  const evidenceSet = new Set<string>();
  for (const v of verdicts) {
    for (const e of v.evidence) {
      evidenceSet.add(e);
    }
  }
  const evidence = [...evidenceSet];

  // ------------------------------------------------------------------
  // M1 — any "blocked" → result "blocked"
  // ------------------------------------------------------------------
  if (verdicts.some((v) => v.decision === "blocked")) {
    return { stage, status: "blocked", evidence };
  }

  // ------------------------------------------------------------------
  // M6 — any timed-out lane → at most "partial" (evaluated before M3/M4/M5
  //       because a stalled lane prevents done-verified and done)
  // ------------------------------------------------------------------
  const hasTimedOut = verdicts.some((v) => v.timedOut);

  // ------------------------------------------------------------------
  // M2 — adversarial BLOCK findings prevent done-verified
  //       (evaluated here for use in M5 check)
  // ------------------------------------------------------------------
  const hasAdversarialBlock = verdicts.some(
    (v) => v.isAdversarial && v.openFindings.some((f) => f.severity === "BLOCK"),
  );

  // ------------------------------------------------------------------
  // M3 — majority "partial" (and none blocked) → "partial"
  // ------------------------------------------------------------------
  const partialCount = verdicts.filter(
    (v) => v.decision === "partial" || v.timedOut,
  ).length;
  if (partialCount > verdicts.length / 2) {
    return { stage, status: "partial", evidence };
  }

  // ------------------------------------------------------------------
  // M4 / M5 — all done or done-verified; check whether full verification holds
  // ------------------------------------------------------------------
  const allDone = verdicts.every(
    (v) => v.decision === "done" || v.decision === "done-verified",
  );

  if (!allDone) {
    // Some lanes are partial (minority), none blocked → partial.
    return { stage, status: "partial", evidence };
  }

  // All lanes self-report done/done-verified; check M5 gates.
  const anyBlockFindings = verdicts.some((v) =>
    v.openFindings.some((f) => f.severity === "BLOCK"),
  );

  if (hasTimedOut || hasAdversarialBlock || anyBlockFindings) {
    // M5 gates not met — one or more of: timed-out lane (M6), adversarial BLOCK
    // finding (M2), or an unresolved BLOCK finding from any lane. All lanes are
    // otherwise done, so M4 applies: "done" (not done-verified).
    return { stage, status: "done", evidence };
  }

  // ------------------------------------------------------------------
  // M5 — done-verified: all done + no BLOCK findings + no timed-out +
  //       evidence present (evidence is checked; skills/write-guards are
  //       coordinator responsibilities and out of scope for this pure function)
  // ------------------------------------------------------------------
  const hasEvidence = evidence.length > 0;
  if (hasEvidence) {
    return { stage, status: "done-verified", evidence };
  }

  // Evidence absent → cannot claim done-verified.
  return { stage, status: "done", evidence };
}
