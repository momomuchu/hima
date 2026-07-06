/**
 * @norm/core — public surface.
 *
 * Re-exports everything from the core modules so consumers can import
 * directly from "@norm/core" without knowing the internal file layout.
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

export type { ClaudeResponse } from "./adapter-claude.js";
export { translateClaude } from "./adapter-claude.js";
export type { CodexResponse } from "./adapter-codex.js";
// ---------------------------------------------------------------------------
// adapter-codex — Codex runtime adapter (R-010)
// ---------------------------------------------------------------------------
export { translateCodex } from "./adapter-codex.js";
export type { HermesRawPayload, HermesResponse } from "./adapter-hermes.js";
// ---------------------------------------------------------------------------
// adapter-hermes — Hermes native-hook runtime adapter (R-011; NOT ACP — SOT C4)
// ---------------------------------------------------------------------------
export { translateHermes } from "./adapter-hermes.js";
export type { OpenCodeResponse } from "./adapter-opencode.js";
// ---------------------------------------------------------------------------
// adapter-opencode — OpenCode runtime adapter (R-050)
// ---------------------------------------------------------------------------
export { translateOpenCode } from "./adapter-opencode.js";
export type { FounderDigestOpts, OpenEnv } from "./auto-actions.js";
// ---------------------------------------------------------------------------
// auto-actions — pure advisory context builders (I12 AUTO-ACTION family).
// R-025 A-01 artifact-auto-open, R-026 A-02 founder-digest,
// R-039 T-06 next-attack-reflex, R-044 A-03 review-surface-emit,
// R-045 A-14 research-convert.
// ---------------------------------------------------------------------------
export {
  buildArtifactAutoOpenContext,
  buildFounderDigestContext,
  buildNextAttackContext,
  buildResearchConvertContext,
  buildReviewSurfaceContext,
  detectOpenEnv,
} from "./auto-actions.js";
export { BEH_023 } from "./behavior-core/beh-023-completion.js";
export { BEH_ADR_BEFORE_IMPL } from "./behavior-core/beh-adr-before-impl.js";
export { BEH_ANTI_SYCOPHANCY } from "./behavior-core/beh-anti-sycophancy.js";
export { BEH_FALSIFIES_IF } from "./behavior-core/beh-falsifies-if.js";
// I14b behaviors (R-016, R-022, R-023)
export { BEH_FEEDBACK_WAVE } from "./behavior-core/beh-feedback-wave.js";
export { BEH_PLANNER_WRITE_GUARD } from "./behavior-core/beh-planner-write-guard.js";
export {
  BEH_DELEGATION_FIRST,
  decideDelegationFirst,
} from "./behavior-core/beh-delegation-first.js";
export type {
  DelegationFirstInput,
  DelegationFirstDecision,
} from "./behavior-core/beh-delegation-first.js";
export {
  laneMarkerPath,
  markLane,
  isLaneActive,
  clearLane,
  stageDelegationPath,
  markStageDelegation,
  isStageDelegationActive,
  clearStageDelegation,
} from "./behavior-core/delegation-lane.js";
export { BEH_READ_BEFORE_WRITE } from "./behavior-core/beh-read-before-write.js";
export { BEH_RESEARCH_FIRST } from "./behavior-core/beh-research-first.js";
export { BEH_SECRET_GUARD } from "./behavior-core/beh-secret-guard.js";
export { BEH_SECURITY_SCOPE } from "./behavior-core/beh-security-scope.js";
export { BEH_SPEC_GATE } from "./behavior-core/beh-spec-gate.js";
export { BEH_WORKER_MODEL } from "./behavior-core/beh-worker-model.js";
export {
  defaultRegistry,
  getBehaviorsForGate,
  Registry,
  registerBehavior,
} from "./behavior-core/registry.js";
// ---------------------------------------------------------------------------
// behavior-core — BehaviorDescriptor engine types, registry, and seed behaviors.
// ---------------------------------------------------------------------------
export type {
  BehaviorContext,
  BehaviorDescriptor,
  BehaviorVerdict,
} from "./behavior-core/types.js";
export * from "./capability-map-v3.js";
// ---------------------------------------------------------------------------
// codex-subagent — poll-file compensation for Codex subagent_start absence (R-049).
// registerSubagent: called by child Codex agent at session-start.
// readSubagentRegistry: read accumulated child sessionIds for a parent session.
// ---------------------------------------------------------------------------
export {
  readSubagentRegistry,
  registerSubagent,
} from "./codex-subagent.js";
export type { LoadConfigOpts } from "./config.js";
// ---------------------------------------------------------------------------
// session-diff — git-state snapshot helpers for the R-044 review-surface gate.
// captureGitSnapshot: persist a git-diff baseline at session-start.
// readGitSnapshot / hasChangesSince: detect drift at post-tool-use.
// ---------------------------------------------------------------------------
export {
  captureGitSnapshot,
  hasChangesSince,
  readGitSnapshot,
  sessionDiffPath,
} from "./session-diff.js";
// ---------------------------------------------------------------------------
// config — per-user / per-project config loader + resolvers
// (AMENDMENT-001 pluggable skills + AMENDMENT-003 pluggable cycle)
// ---------------------------------------------------------------------------
export {
  decodeHimaConfig,
  decodeHimaConfigEither,
  HimaConfig,
  loadConfig,
  resolveRole,
  resolveStageForceSkills,
  resolveStageForceSkillsForFloor,
  filterByEnabledSources,
  resolveStageInjectSkills,
} from "./config.js";
// ---------------------------------------------------------------------------
// dev-cycle-pack — base-tier meta skills + the swappable default dev-cycle pack
// (ADR-0006). GENERIC_DEV_CYCLE is the corpus-free default CycleDef.
// ---------------------------------------------------------------------------
export {
  BASE_META_SKILLS,
  DEV_CYCLE_PACK_SKILLS,
  GENERIC_DEV_CYCLE,
} from "./dev-cycle-pack.js";
export type { DeferredVerdict } from "./deferred-verdict.js";
// ---------------------------------------------------------------------------
// deferred-verdict — single-use block verdict persistence (R-027)
// ---------------------------------------------------------------------------
export {
  readAndConsumeDeferredVerdict,
  verdictFilePath,
  writeDeferredVerdict,
} from "./deferred-verdict.js";
export type { DispatchResponse } from "./dispatch.js";
// ---------------------------------------------------------------------------
// dispatch — runtime-aware adapter dispatcher (R-012)
// ---------------------------------------------------------------------------
export { dispatchTranslate } from "./dispatch.js";
// forcing-primitive exports RuntimeTarget too — exclude it to avoid the
// TS2308 "already exported" ambiguity; the one from capability-map-v3 is canonical.
export { pickAttack } from "./forcing-primitive.js";
// ---------------------------------------------------------------------------
// gates-core — evaluateGate() aggregator
// ---------------------------------------------------------------------------
export { evaluateGate } from "./gates-core/evaluate-gate.js";
// ---------------------------------------------------------------------------
// hermes-home — HERMES_HOME warning helper (R-055).
// hermesHomeWarning: returns a warning string when HERMES_HOME is absent/empty.
// ---------------------------------------------------------------------------
export { HERMES_HOME_WARNING, hermesHomeWarning } from "./hermes-home.js";
// ---------------------------------------------------------------------------
// hermes-subagent — Hermes subagent propagation helpers (R-047, R-048).
// injectRulesIntoDelegateTask: idempotent rule injection into delegate_task payloads.
// markSubagentSeen / isSubagentSeen: session-scoped dedup for subagent_stop replay.
// ---------------------------------------------------------------------------
export {
  injectRulesIntoDelegateTask,
  isSubagentSeen,
  markSubagentSeen,
} from "./hermes-subagent.js";
export * from "./keyword.js";
export { CRITIC_PROMPTS } from "./prompts-core/critic-prompts.js";
export { EXECUTOR_PROMPTS } from "./prompts-core/executor-prompts.js";
// ---------------------------------------------------------------------------
// prompts-core — role-specific bundled prompt tables + loader (R-020).
// PLANNER_PROMPTS, EXECUTOR_PROMPTS, CRITIC_PROMPTS: variant tables.
// loadPrompt: materialises a PromptSource into a prompt string.
// ---------------------------------------------------------------------------
export { loadPrompt } from "./prompts-core/loader.js";
export { PLANNER_PROMPTS } from "./prompts-core/planner-prompts.js";
// ---------------------------------------------------------------------------
// prompts-core — role→stage mapping, variant resolution, role-context strings.
// R-020: roleForStage, roleContext, PLANNER_STAGES; resolveVariant.
// ---------------------------------------------------------------------------
export type { HimaRole } from "./prompts-core/role-for-stage.js";
export {
  EXECUTOR_STAGES,
  PLANNER_STAGES,
  REVIEWER_STAGES,
  roleContext,
  roleForStage,
} from "./prompts-core/role-for-stage.js";
export type { PromptSource, VariantTable } from "./prompts-core/types.js";
export type { ResolveVariantParams } from "./prompts-core/variant-resolver.js";
export {
  PLANNER_AGENT_NAMES,
  resolveVariant,
} from "./prompts-core/variant-resolver.js";
// ---------------------------------------------------------------------------
// read-set — per-session read-set tracker (R-003 PostToolUse capture)
// ---------------------------------------------------------------------------
export { isInReadSet, readReadSet, recordRead } from "./read-set.js";
// ---------------------------------------------------------------------------
// research-subpass — compressed research sub-pass context for "run" entry (R-041)
// runResearchSubpassContext: advisory canary string.
// researchSubpassForcedSkill: the SkillRef to force onto the ward at floor H+.
// ---------------------------------------------------------------------------
export {
  researchSubpassForcedSkill,
  runResearchSubpassContext,
} from "./research-subpass.js";
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
export type { AgentModel, RoleDef } from "./role-catalog.js";
export { getRolesForStage, ROLE_CATALOG } from "./role-catalog.js";
export type { ParsedRule } from "./rules-engine/frontmatter.js";
export { parseRuleFrontmatter } from "./rules-engine/frontmatter.js";
// ---------------------------------------------------------------------------
// rules-engine — path-scoped rule injection (R-029, SPEC-006).
// resolveRulesForPath, parseRuleFrontmatter, ruleMatches.
// ---------------------------------------------------------------------------
export type { ResolveRulesOpts, ResolveRulesResult } from "./rules-engine/index.js";
export { discoverAgentsMd, resolveRulesForPath } from "./rules-engine/index.js";
export { ruleMatches } from "./rules-engine/matcher.js";
export type { RunGateInput, RunGateResult } from "./run-gate.js";
export { runGate } from "./run-gate.js";
// ---------------------------------------------------------------------------
// session-state — session-start and pre-compact advisory context builders.
// R-030 buildSessionResumeContext, R-036 buildPreCompactContext.
// ---------------------------------------------------------------------------
export {
  buildPreCompactContext,
  buildSessionResumeContext,
} from "./session-state.js";
export * from "./skill-state.js";
export type { SpawnManifest } from "./spawn-manifest.js";
// ---------------------------------------------------------------------------
// spawn-manifest — live role-spawn manifest helpers (R-035)
// ---------------------------------------------------------------------------
export {
  buildSpawnAssignmentContext,
  hasSpawnManifest,
  writeSpawnManifest,
} from "./spawn-manifest.js";
export type {
  AgentDecision,
  AgentVerdict,
} from "./spawn-plan.js";
// ---------------------------------------------------------------------------
// spawn-plan — work-driven team composition.
// RoleDef/AgentModel/ROLE_CATALOG are imported by spawn-plan from role-catalog;
// only the spawn-plan-specific symbols are exported here.
// mergeTeamOutputs operates on AgentVerdict[] (coordinator merge path).
// ---------------------------------------------------------------------------
export {
  mergeTeamOutputs,
  spawnPlan,
  teamWidth,
} from "./spawn-plan.js";
export type { MergeOptions } from "./team-merge.js";
// ---------------------------------------------------------------------------
// team-merge — schema-typed StageVerdict merge (ward layer)
// mergeTeamOutputs from team-merge operates on StageVerdict[] with MergeOptions.
// Re-exported as mergeStageVerdicts to avoid collision with spawn-plan's version.
// ---------------------------------------------------------------------------
export { mergeTeamOutputs as mergeStageVerdicts } from "./team-merge.js";
// ---------------------------------------------------------------------------
// trace — per-session JSONL trace emitter (observability)
// ---------------------------------------------------------------------------
export { appendTrace, readTrace, traceFilePath } from "./trace.js";
export * from "./ward-store.js";
// ---------------------------------------------------------------------------
// ward-transitions — cycle-transition guards and archival (R-006, R-042, R-043)
// ---------------------------------------------------------------------------
export {
  checkStageGate,
  closeWard,
  writeStageVerdict,
} from "./ward-transitions.js";
export type { WaveLogEntry } from "./wave-log.js";
// ---------------------------------------------------------------------------
// wave-log — founder feedback-wave audit log emitter (R-037)
// ---------------------------------------------------------------------------
export { appendWaveLog, waveLogPath } from "./wave-log.js";
