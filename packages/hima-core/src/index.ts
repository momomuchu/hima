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

// ---------------------------------------------------------------------------
// ward-transitions — cycle-transition guards and archival (R-006, R-042, R-043)
// ---------------------------------------------------------------------------
export {
  checkStageGate,
  writeStageVerdict,
  closeWard,
} from "./ward-transitions.js";

export { translateClaude } from "./adapter-claude.js";
export type { ClaudeResponse } from "./adapter-claude.js";

// ---------------------------------------------------------------------------
// adapter-codex — Codex runtime adapter (R-010)
// ---------------------------------------------------------------------------
export { translateCodex } from "./adapter-codex.js";
export type { CodexResponse } from "./adapter-codex.js";

// ---------------------------------------------------------------------------
// adapter-hermes — Hermes ACP runtime adapter (R-011)
// ---------------------------------------------------------------------------
export { translateHermes } from "./adapter-hermes.js";
export type { HermesResponse, AcpObject } from "./adapter-hermes.js";

// ---------------------------------------------------------------------------
// adapter-opencode — OpenCode runtime adapter (R-050)
// ---------------------------------------------------------------------------
export { translateOpenCode } from "./adapter-opencode.js";
export type { OpenCodeResponse } from "./adapter-opencode.js";
export { runGate } from "./run-gate.js";
export type { RunGateInput, RunGateResult } from "./run-gate.js";

// ---------------------------------------------------------------------------
// behavior-core — BehaviorDescriptor engine types, registry, and seed behaviors.
// ---------------------------------------------------------------------------
export type {
  BehaviorDescriptor,
  BehaviorContext,
  BehaviorVerdict,
} from "./behavior-core/types.js";
export {
  Registry,
  defaultRegistry,
  registerBehavior,
  getBehaviorsForGate,
} from "./behavior-core/registry.js";
export { BEH_023 } from "./behavior-core/beh-023-completion.js";
export { BEH_READ_BEFORE_WRITE } from "./behavior-core/beh-read-before-write.js";
export { BEH_FALSIFIES_IF } from "./behavior-core/beh-falsifies-if.js";
export { BEH_SECURITY_SCOPE } from "./behavior-core/beh-security-scope.js";
export { BEH_SECRET_GUARD } from "./behavior-core/beh-secret-guard.js";
export { BEH_RESEARCH_FIRST } from "./behavior-core/beh-research-first.js";
export { BEH_SPEC_GATE } from "./behavior-core/beh-spec-gate.js";
export { BEH_PLANNER_WRITE_GUARD } from "./behavior-core/beh-planner-write-guard.js";

// ---------------------------------------------------------------------------
// read-set — per-session read-set tracker (R-003 PostToolUse capture)
// ---------------------------------------------------------------------------
export { recordRead, readReadSet, isInReadSet } from "./read-set.js";

// ---------------------------------------------------------------------------
// gates-core — evaluateGate() aggregator
// ---------------------------------------------------------------------------
export { evaluateGate } from "./gates-core/evaluate-gate.js";

// ---------------------------------------------------------------------------
// dispatch — runtime-aware adapter dispatcher (R-012)
// ---------------------------------------------------------------------------
export { dispatchTranslate } from "./dispatch.js";
export type { DispatchResponse } from "./dispatch.js";

// ---------------------------------------------------------------------------
// deferred-verdict — single-use block verdict persistence (R-027)
// ---------------------------------------------------------------------------
export {
  writeDeferredVerdict,
  readAndConsumeDeferredVerdict,
  verdictFilePath,
} from "./deferred-verdict.js";
export type { DeferredVerdict } from "./deferred-verdict.js";

// ---------------------------------------------------------------------------
// risk-class — resolveRiskClass() helper (R-002)
// ---------------------------------------------------------------------------
export { resolveRiskClass } from "./risk-class.js";

// ---------------------------------------------------------------------------
// risk-classifier — classifyRisk() heuristic floor estimator (R-018, R-019)
// ---------------------------------------------------------------------------
export { classifyRisk } from "./risk-classifier.js";

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

// ---------------------------------------------------------------------------
// trace — per-session JSONL trace emitter (observability)
// ---------------------------------------------------------------------------
export { appendTrace, readTrace, traceFilePath } from "./trace.js";

// ---------------------------------------------------------------------------
// config — per-user / per-project config loader + resolvers
// (AMENDMENT-001 pluggable skills + AMENDMENT-003 pluggable cycle)
// ---------------------------------------------------------------------------
export {
  HimaConfig,
  decodeHimaConfig,
  decodeHimaConfigEither,
  loadConfig,
  resolveStageForceSkills,
  resolveStageForceSkillsForFloor,
  resolveStageInjectSkills,
  resolveRole,
} from "./config.js";
export type { LoadConfigOpts } from "./config.js";

// ---------------------------------------------------------------------------
// auto-actions — pure advisory context builders (I12 AUTO-ACTION family).
// R-025 A-01 artifact-auto-open, R-026 A-02 founder-digest,
// R-039 T-06 next-attack-reflex, R-044 A-03 review-surface-emit,
// R-045 A-14 research-convert.
// ---------------------------------------------------------------------------
export {
  buildArtifactAutoOpenContext,
  buildFounderDigestContext,
  buildReviewSurfaceContext,
  buildResearchConvertContext,
  buildNextAttackContext,
} from "./auto-actions.js";
export type { FounderDigestOpts } from "./auto-actions.js";

// ---------------------------------------------------------------------------
// session-state — session-start and pre-compact advisory context builders.
// R-030 buildSessionResumeContext, R-036 buildPreCompactContext.
// ---------------------------------------------------------------------------
export {
  buildSessionResumeContext,
  buildPreCompactContext,
} from "./session-state.js";

// ---------------------------------------------------------------------------
// prompts-core — role→stage mapping, variant resolution, role-context strings.
// R-020: roleForStage, roleContext, PLANNER_STAGES; resolveVariant.
// ---------------------------------------------------------------------------
export type { HimaRole } from "./prompts-core/role-for-stage.js";
export {
  PLANNER_STAGES,
  EXECUTOR_STAGES,
  REVIEWER_STAGES,
  roleForStage,
  roleContext,
} from "./prompts-core/role-for-stage.js";
export type { ResolveVariantParams } from "./prompts-core/variant-resolver.js";
export {
  resolveVariant,
  PLANNER_AGENT_NAMES,
} from "./prompts-core/variant-resolver.js";
export type { PromptSource, VariantTable } from "./prompts-core/types.js";

// ---------------------------------------------------------------------------
// rules-engine — path-scoped rule injection (R-029, SPEC-006).
// resolveRulesForPath, parseRuleFrontmatter, ruleMatches.
// ---------------------------------------------------------------------------
export type { ResolveRulesOpts, ResolveRulesResult } from "./rules-engine/index.js";
export { resolveRulesForPath } from "./rules-engine/index.js";
export type { ParsedRule } from "./rules-engine/frontmatter.js";
export { parseRuleFrontmatter } from "./rules-engine/frontmatter.js";
export { ruleMatches } from "./rules-engine/matcher.js";
