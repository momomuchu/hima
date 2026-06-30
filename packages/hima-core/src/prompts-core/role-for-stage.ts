/**
 * prompts-core/role-for-stage.ts — stage → role resolution + bundled role-context strings.
 *
 * Design sources:
 *   ENTRYPOINTS-v3 PART 6 (stage→role mapping: planner=discovery/analysis/spec,
 *                          executor=design/impl/test, reviewer=verify)
 *   SPEC-004-profiles.md (role contracts, role-context injection)
 *   R-020 gap register
 *
 * Exports:
 *   PLANNER_STAGES   — ReadonlySet of stage names that map to the planner role.
 *   EXECUTOR_STAGES  — ReadonlySet of stage names that map to the executor role.
 *   REVIEWER_STAGES  — ReadonlySet of stage names that map to the reviewer role.
 *   roleForStage()   — maps a stage name to a HimaRole or null.
 *   roleContext()    — returns the bundled injection string for a given role.
 */

// ---------------------------------------------------------------------------
// HimaRole — the three functional profiles in v0.1
// ---------------------------------------------------------------------------

/**
 * The three v0.1 profiles per SPEC-004.
 * Functional names are authoritative (PROPOSITION.md §12, Q1).
 */
export type HimaRole = "planner" | "executor" | "reviewer";

// ---------------------------------------------------------------------------
// Stage sets — single source of truth for stage→role membership
// ---------------------------------------------------------------------------

/**
 * Stages where the planner role is active.
 * Planner = discovery / analysis / spec (planning & specification stages).
 * Source: ENTRYPOINTS-v3 PART 6.
 */
export const PLANNER_STAGES: ReadonlySet<string> = new Set([
  "discovery",
  "analysis",
  "spec",
]);

/**
 * Stages where the executor role is active.
 * Executor = design / impl / test (construction stages).
 * Source: ENTRYPOINTS-v3 PART 6.
 */
export const EXECUTOR_STAGES: ReadonlySet<string> = new Set([
  "design",
  "impl",
  "test",
]);

/**
 * Stages where the reviewer role is active.
 * Reviewer = verify (the gate stage).
 * Source: ENTRYPOINTS-v3 PART 6.
 */
export const REVIEWER_STAGES: ReadonlySet<string> = new Set(["verify"]);

// ---------------------------------------------------------------------------
// roleForStage — stage → HimaRole | null
// ---------------------------------------------------------------------------

/**
 * Map a stage name to its active HimaRole, or null when the stage is not
 * recognised by the v0.1 profile set.
 *
 * Lookup order: PLANNER_STAGES → EXECUTOR_STAGES → REVIEWER_STAGES → null.
 * Pure: no I/O, no side effects.
 *
 * @example
 *   roleForStage("discovery") // → "planner"
 *   roleForStage("impl")      // → "executor"
 *   roleForStage("verify")    // → "reviewer"
 *   roleForStage("unknown")   // → null
 */
export function roleForStage(stage: string): HimaRole | null {
  if (PLANNER_STAGES.has(stage)) return "planner";
  if (EXECUTOR_STAGES.has(stage)) return "executor";
  if (REVIEWER_STAGES.has(stage)) return "reviewer";
  return null;
}

// ---------------------------------------------------------------------------
// roleContext — bundled role-context injection strings
// ---------------------------------------------------------------------------

/**
 * Return the bundled role-context string injected as additionalContext before
 * the agent's first write in the given role.
 *
 * The marker format `[HIMA role:<name>]` is the canonical prefix recognised
 * by downstream tooling (e.g. planner-write-guard checks for the planner marker).
 *
 * Strings are intentionally terse — they appear in every prompt injection and
 * must not bloat the context window.
 *
 * Source: SPEC-004 role contracts; ENTRYPOINTS-v3 PART 6 role write-guards table.
 */
export function roleContext(role: HimaRole): string {
  switch (role) {
    case "planner":
      // Planner may ONLY write .md files and .hima/plans/**. No code.
      // Source: SPEC-004 [CRITICAL][BLOCKS:critical] planner-write-guard.
      return "[HIMA role:planner] Plan only; do not write implementation code (only .md / .hima/plans).";

    case "executor":
      // Executor implements tasks from the active plan; gates apply per criticality.
      // Source: SPEC-004 executor contract.
      return "[HIMA role:executor] Implement the active plan tasks; read spec before writing; trace every file to a spec criterion.";

    case "reviewer":
      // Reviewer only reads and produces verdicts; never mutates implementation.
      // Source: SPEC-004 critic/reviewer contract.
      return "[HIMA role:reviewer] Verify only; do not modify implementation; produce PASS/PARTIAL/FAIL verdicts with file+line evidence.";
  }
}
