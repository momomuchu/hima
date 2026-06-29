/**
 * @hima/core — public surface.
 *
 * Re-exports everything from the core modules so consumers can import
 * directly from "@hima/core" without knowing the internal file layout.
 *
 * NOTE: Both capability-map-v3 and forcing-primitive independently export a
 * `RuntimeTarget` type with the same shape ("claude" | "codex" | "hermes").
 * We expose it once via capability-map-v3 and exclude the duplicate from
 * forcing-primitive to keep the public surface unambiguous.
 *
 * NOTE: RoleDef and ROLE_CATALOG have a single source of truth in role-catalog.
 * spawn-plan re-exports them from there; we expose them here from role-catalog
 * directly (one canonical export, no aliases required).
 *
 * NOTE: spawn-plan and team-merge both export `mergeTeamOutputs` with
 * different signatures. spawn-plan's version (AgentVerdict[]) is the
 * work-driven merge used by the coordinator. team-merge's version
 * (StageVerdict[], MergeOptions) is the schema-typed merge for the ward
 * layer. The latter is re-exported as `mergeStageVerdicts`.
 */

export * from "./keyword.js";
export * from "./capability-map-v3.js";

// forcing-primitive exports RuntimeTarget too — exclude it to avoid the
// TS2308 "already exported" ambiguity; the one from capability-map-v3 is canonical.
export {
  pickAttack,
} from "./forcing-primitive.js";

export * from "./skill-state.js";
export * from "./ward-store.js";
export { translateClaude } from "./adapter-claude.js";
export type { ClaudeResponse } from "./adapter-claude.js";
export { runGate } from "./run-gate.js";
export type { RunGateInput, RunGateResult } from "./run-gate.js";

// ---------------------------------------------------------------------------
// role-catalog — SSOT for RoleDef, ROLE_CATALOG, and getRolesForStage.
// ---------------------------------------------------------------------------
export type { RoleDef, AgentModel } from "./role-catalog.js";
export { ROLE_CATALOG, getRolesForStage } from "./role-catalog.js";

// ---------------------------------------------------------------------------
// spawn-plan — work-driven team composition.
// RoleDef/AgentModel/ROLE_CATALOG are imported by spawn-plan from role-catalog;
// only the spawn-plan-specific symbols are exported here.
// mergeTeamOutputs operates on AgentVerdict[] (coordinator merge path).
// ---------------------------------------------------------------------------
export {
  spawnPlan,
  teamWidth,
  mergeTeamOutputs,
} from "./spawn-plan.js";
export type {
  AgentDecision,
  AgentVerdict,
} from "./spawn-plan.js";

// ---------------------------------------------------------------------------
// team-merge — schema-typed StageVerdict merge (ward layer)
// mergeTeamOutputs from team-merge operates on StageVerdict[] with MergeOptions.
// Re-exported as mergeStageVerdicts to avoid collision with spawn-plan's version.
// ---------------------------------------------------------------------------
export {
  mergeTeamOutputs as mergeStageVerdicts,
} from "./team-merge.js";
export type {
  MergeOptions,
} from "./team-merge.js";
