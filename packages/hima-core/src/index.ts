/**
 * @hima/core — public surface.
 *
 * Re-exports everything from the five core modules so consumers can import
 * directly from "@hima/core" without knowing the internal file layout.
 *
 * NOTE: Both capability-map-v3 and forcing-primitive independently export a
 * `RuntimeTarget` type with the same shape ("claude" | "codex" | "hermes").
 * We expose it once via capability-map-v3 and exclude the duplicate from
 * forcing-primitive to keep the public surface unambiguous.
 *
 * NOTE: role-catalog and spawn-plan both define a `RoleDef` type and a
 * `ROLE_CATALOG` constant with different shapes (intentional: different
 * abstraction layers). spawn-plan's versions are canonical on the public
 * surface (they carry roleId/model/isAdversarial). role-catalog's versions
 * are re-exported under prefixed aliases to avoid TS2308 ambiguity.
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
// role-catalog — 11-role catalog (forcedSkills/adversaryOf shape)
// RoleDef and ROLE_CATALOG are re-exported under catalog-prefixed aliases to
// avoid collision with spawn-plan's canonical RoleDef / ROLE_CATALOG.
// ---------------------------------------------------------------------------
export {
  getRolesForStage,
} from "./role-catalog.js";
export type {
  RoleDef as CatalogRoleDef,
} from "./role-catalog.js";
export {
  ROLE_CATALOG as CATALOG_ROLES,
} from "./role-catalog.js";

// ---------------------------------------------------------------------------
// spawn-plan — work-driven team composition (canonical RoleDef with roleId/model/isAdversarial)
// mergeTeamOutputs here operates on AgentVerdict[] (coordinator merge path).
// ---------------------------------------------------------------------------
export {
  ROLE_CATALOG,
  spawnPlan,
  teamWidth,
  mergeTeamOutputs,
} from "./spawn-plan.js";
export type {
  RoleDef,
  AgentModel,
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
