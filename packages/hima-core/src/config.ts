/**
 * config — per-user / per-project HimaConfig loader + resolvers.
 *
 * Merge precedence: base ({}) < user (~/.hima/config.json) < project (<root>/.hima/config.json).
 * Missing / invalid files are skipped silently:
 *   ENOENT          → skip (normal, no log)
 *   JSON parse fail → skip + log to stderr
 *   decode fail     → skip + log to stderr
 *
 * AMENDMENT-001 pluggable skills + AMENDMENT-003 pluggable cycle.
 *
 * Note: HimaConfig is defined here (and mirrored in @hima/schemas/src/config.ts) because
 * schemas does not yet export config.ts publicly.  When schemas adds that export, this
 * definition can be replaced with an import.
 */

import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Either, Schema } from "effect";
import { CycleDef, RISK_ORDER, RuntimeTarget, SkillRef } from "@hima/schemas";
import type { RiskClass } from "@hima/schemas";
import type { AgentModel, RoleDef } from "./role-catalog.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal sub-schemas (not exported; HimaConfig encapsulates them)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StageSkillOverride — per-stage skill customization.
 * Absent sub-fields leave the corresponding default from StageDef intact.
 */
const StageSkillOverride = Schema.Struct({
  force: Schema.optional(Schema.Array(SkillRef)),
  inject: Schema.optional(Schema.Array(SkillRef)),
});

/**
 * RoleOverride — per-role subagent customization.
 * Only the listed fields may be overridden; all others inherit from the base RoleDef.
 * `model` is restricted to "sonnet"|"haiku" — "opus" is forbidden per cost-guard §6.
 */
const RoleOverride = Schema.Struct({
  forcedSkills: Schema.optional(Schema.Array(SkillRef)),
  model: Schema.optional(Schema.Literal("sonnet", "haiku")),
  stages: Schema.optional(Schema.Array(Schema.String)),
});

// ─────────────────────────────────────────────────────────────────────────────
// HimaConfig — top-level schema + decoders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HimaConfig — per-user / per-project customization overlay.
 *
 * stageSkills     — keyed by stage id; overrides force/inject for that stage.
 * cycle           — full cycle replacement (AMENDMENT-003); supersedes DEV_CYCLE when present.
 * roles           — keyed by role id; overrides model, forcedSkills, and stages for a subagent.
 * runtimes        — (SPEC-016 Q-001 / OQ-1) which coding-agent runtime(s) this project
 *                    targets. Bookkeeping only for `hima init`'s own hook-wiring loop
 *                    (SPEC-017 A-002) — never the source of truth for a live gate event's
 *                    runtime (that always comes from the hook invocation context).
 * useDevCyclePack — (SPEC-016 Q-002) when explicitly `false`, resolveStageForceSkills /
 *                    resolveStageInjectSkills skip the DEV_CYCLE fallback step entirely
 *                    (OQ-2). `undefined` (the default) preserves today's fallback behavior.
 * enabledSources  — (SPEC-016 Q-003) allowlist of SkillRef.source tiers this project has
 *                    declared available; resolveStageForceSkills / resolveStageInjectSkills
 *                    drop any resolved SkillRef whose source is not in this list (OQ-3).
 *                    `undefined` (the default) is a no-op — no filtering is applied.
 *
 * All top-level fields are optional.  Absent fields fall back to founder defaults
 * (DEV_CYCLE from @hima/schemas, ROLE_CATALOG from @hima/core).
 */
export const HimaConfig = Schema.Struct({
  stageSkills: Schema.optional(
    Schema.Record({ key: Schema.String, value: StageSkillOverride }),
  ),
  cycle: Schema.optional(CycleDef),
  roles: Schema.optional(
    Schema.Record({ key: Schema.String, value: RoleOverride }),
  ),
  runtimes: Schema.optional(Schema.Array(RuntimeTarget)),
  useDevCyclePack: Schema.optional(Schema.Boolean),
  enabledSources: Schema.optional(
    Schema.Array(Schema.Literal("base", "corpus", "user", "project")),
  ),
});

export type HimaConfig = typeof HimaConfig.Type;

/** Decode an unknown value into HimaConfig, throwing on invalid input. */
export const decodeHimaConfig = Schema.decodeUnknownSync(HimaConfig);

/** Decode an unknown value into Either<HimaConfig, ParseError> (non-throwing). */
export const decodeHimaConfigEither = Schema.decodeUnknownEither(HimaConfig);

// ─────────────────────────────────────────────────────────────────────────────
// LoadConfigOpts — injectable paths for testability
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadConfigOpts {
  /**
   * Absolute path to the user-scoped config file.
   * Defaults to ~/.hima/config.json when omitted.
   */
  userConfigPath?: string | undefined;
  /**
   * Absolute path to the project-scoped config file.
   * Defaults to <root>/.hima/config.json when omitted.
   */
  projectConfigPath?: string | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// loadConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load and merge the HimaConfig for a project root.
 *
 * Merge order (highest precedence last):
 *   base: {}
 *   user: ~/.hima/config.json  (or opts.userConfigPath)
 *   project: <root>/.hima/config.json  (or opts.projectConfigPath)
 *
 * Within stageSkills and roles, the merge is per-key: a stage/role present in
 * the project config replaces the corresponding user-config entry entirely.
 * cycle is replaced wholesale (project beats user).
 *
 * Files that are missing (ENOENT) or fail to decode are silently skipped.
 */
export async function loadConfig(
  root: string,
  opts?: LoadConfigOpts,
): Promise<HimaConfig> {
  const userPath =
    opts?.userConfigPath ??
    path.join(os.homedir(), ".hima", "config.json");
  const projectPath =
    opts?.projectConfigPath ??
    path.join(root, ".hima", "config.json");

  const [userCfg, projectCfg] = await Promise.all([
    tryLoadOne(userPath),
    tryLoadOne(projectPath),
  ]);

  return mergeAll({}, userCfg ?? {}, projectCfg ?? {});
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveStageForceSkills
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective forceSkills list for a stage.
 *
 * Precedence (first match wins):
 *   1. config.stageSkills[stageId].force  — explicit user/project override
 *   2. config.cycle stage.forceSkills     — custom cycle override (AMENDMENT-003)
 *   3. devCycle stage.forceSkills         — founder default (DEV_CYCLE from caller),
 *                                            SKIPPED entirely when
 *                                            config.useDevCyclePack === false (OQ-2)
 *   4. []                                 — stage not found in any source
 *
 * Pass DEV_CYCLE from @hima/schemas as devCycle to get the founder default.
 *
 * The resolved list is filtered by config.enabledSources when present (OQ-3):
 * any SkillRef whose `source` is not in that allowlist is dropped. When
 * config.enabledSources is undefined (the default), no filtering is applied —
 * this is a no-op, preserving today's behavior exactly.
 */
export function resolveStageForceSkills(
  config: HimaConfig,
  stageId: string,
  devCycle: CycleDef,
): SkillRef[] {
  // 1. Explicit stageSkills override
  const force = config.stageSkills?.[stageId]?.force;
  if (force !== undefined) {
    return filterByEnabledSources(config, [...force]);
  }

  // 2. Custom cycle stage override
  const configStage = config.cycle?.stages.find((s) => s.id === stageId);
  if (configStage !== undefined) {
    return filterByEnabledSources(config, [...configStage.forceSkills]);
  }

  // 3. Founder default cycle — skipped entirely when useDevCyclePack === false (OQ-2).
  //    `undefined` (the default) falls through to the existing fallback unchanged.
  if (config.useDevCyclePack === false) {
    return [];
  }
  const devStage = devCycle.stages.find((s) => s.id === stageId);
  if (devStage !== undefined) {
    return filterByEnabledSources(config, [...devStage.forceSkills]);
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveStageInjectSkills
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective injectSkills list for a stage.
 *
 * Analogous to resolveStageForceSkills but for the inject dimension:
 *   1. config.stageSkills[stageId].inject  — explicit user/project override
 *   2. config.cycle stage.injectSkills     — custom cycle override
 *   3. devCycle stage.injectSkills         — founder default, SKIPPED entirely
 *                                            when config.useDevCyclePack === false (OQ-2)
 *   4. []                                  — stage not found
 *
 * The resolved list is filtered by config.enabledSources when present (OQ-3),
 * same no-op-when-undefined semantics as resolveStageForceSkills.
 */
export function resolveStageInjectSkills(
  config: HimaConfig,
  stageId: string,
  devCycle: CycleDef,
): SkillRef[] {
  // 1. Explicit stageSkills override
  const inject = config.stageSkills?.[stageId]?.inject;
  if (inject !== undefined) {
    return filterByEnabledSources(config, [...inject]);
  }

  // 2. Custom cycle stage override
  const configStage = config.cycle?.stages.find((s) => s.id === stageId);
  if (configStage !== undefined) {
    return filterByEnabledSources(config, [...configStage.injectSkills]);
  }

  // 3. Founder default cycle — skipped entirely when useDevCyclePack === false (OQ-2).
  if (config.useDevCyclePack === false) {
    return [];
  }
  const devStage = devCycle.stages.find((s) => s.id === stageId);
  if (devStage !== undefined) {
    return filterByEnabledSources(config, [...devStage.injectSkills]);
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveStageForceSkillsForFloor — R-017 floor-scaled skill gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-stage extra forceSkills added at floor H and floor C (on top of base).
 *
 * Reading the table:
 *   H: skills ADDED when floor >= H (beyond the L/M base from DEV_CYCLE).
 *   C: skills ADDED when floor >= C (in addition to H extras).
 *
 * Derived from ENTRYPOINTS-v3.md PART 4 — THE DEFINITIVE STAGE → CORPUS SKILL FORCE-MAP.
 * Only [FORCE] skills that appear first at H or C in the table are listed here;
 * skills already forced at L/M come in via the `base` parameter from resolveStageForceSkills.
 */
const STAGE_FLOOR_EXTRAS: Readonly<
  Record<string, Readonly<{ H: readonly SkillRef[]; C: readonly SkillRef[] }>>
> = {
  discovery: {
    H: [
      { source: "corpus", id: "corpus-specification-requirements" },
      { source: "corpus", id: "corpus-architecture-system-design" },
    ],
    C: [
      { source: "corpus", id: "corpus-domain-modeling-ddd" },
      { source: "corpus", id: "corpus-security-privacy-compliance" },
      { source: "corpus", id: "corpus-software-delivery-governance" },
    ],
  },
  analysis: {
    H: [
      { source: "corpus", id: "corpus-domain-modeling-ddd" },
      { source: "corpus", id: "corpus-architecture-system-design" },
    ],
    C: [
      { source: "corpus", id: "corpus-api-design" },
      { source: "corpus", id: "corpus-security-privacy-compliance" },
      { source: "corpus", id: "corpus-software-delivery-governance" },
    ],
  },
  spec: {
    H: [
      { source: "corpus", id: "corpus-schema-driven-development" },
      { source: "corpus", id: "corpus-domain-modeling-ddd" },
      { source: "corpus", id: "corpus-architecture-system-design" },
    ],
    C: [
      { source: "corpus", id: "corpus-security-privacy-compliance" },
    ],
  },
  design: {
    H: [
      { source: "corpus", id: "corpus-error-handling-resilience" },
    ],
    C: [
      { source: "corpus", id: "corpus-security-privacy-compliance" },
      { source: "corpus", id: "corpus-observability" },
      { source: "corpus", id: "corpus-software-delivery-governance" },
    ],
  },
  impl: {
    H: [
      { source: "corpus", id: "corpus-error-handling-resilience" },
      { source: "corpus", id: "corpus-performance-engineering" },
      { source: "corpus", id: "corpus-security-privacy-compliance" },
      { source: "corpus", id: "corpus-observability" },
    ],
    C: [
      { source: "corpus", id: "corpus-software-delivery-governance" },
    ],
  },
  test: {
    H: [
      { source: "corpus", id: "corpus-code-quality-maintainability" },
      { source: "corpus", id: "corpus-observability" },
      { source: "corpus", id: "corpus-software-delivery-governance" },
    ],
    C: [],
  },
  verify: {
    H: [
      { source: "corpus", id: "corpus-software-delivery-governance" },
      { source: "corpus", id: "corpus-security-privacy-compliance" },
    ],
    C: [
      { source: "corpus", id: "corpus-observability" },
      { source: "corpus", id: "corpus-production-reliability-devops" },
    ],
  },
  maintenance: {
    H: [],
    C: [],
  },
};

/**
 * resolveStageForceSkillsForFloor — apply floor-scaling to a base skill list.
 *
 * Takes the base forceSkills (from resolveStageForceSkills) and adds the extra
 * [FORCE] skills mandated at H and C floors per ENTRYPOINTS-v3 PART 4.
 *
 * Rules:
 *   - At floor T / L / M: returns `base` unchanged.
 *   - At floor H: returns base + H-extras for this stage.
 *   - At floor C: returns base + H-extras + C-extras for this stage.
 *   - Skills already present in `base` are deduplicated (not added twice).
 *   - Unknown stage ids return `base` unchanged (no floor-scaling defined).
 *
 * @param base    The forceSkills resolved by resolveStageForceSkills (config override > cycle > DEV_CYCLE).
 * @param stageId The current ward stage (e.g. "discovery", "impl").
 * @param floor   The ward's effective floor (after R-019 classification raise).
 * @returns       The floor-scaled forceSkills list.
 */
export function resolveStageForceSkillsForFloor(
  base: SkillRef[],
  stageId: string,
  floor: RiskClass,
): SkillRef[] {
  // Below H floor: no extra skills (default / M behavior unchanged).
  if (RISK_ORDER[floor] < RISK_ORDER["H"]) {
    return base;
  }

  const extras = STAGE_FLOOR_EXTRAS[stageId];
  if (extras === undefined) {
    // Unknown stage — return base unchanged.
    return base;
  }

  // Collect H extras (always added at H+) and optionally C extras.
  const toAdd: SkillRef[] = [
    ...extras.H,
    ...(RISK_ORDER[floor] >= RISK_ORDER["C"] ? extras.C : []),
  ];

  // Deduplicate: skip any extra already present in base.
  const baseKeys = new Set(base.map((s) => `${s.source}:${s.id}`));
  const newExtras = toAdd.filter((s) => !baseKeys.has(`${s.source}:${s.id}`));

  return [...base, ...newExtras];
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveRole
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective RoleDef by merging any config override over baseRole.
 *
 * Override fields (from config.roles[roleId]) that are defined win over baseRole:
 *   model, forcedSkills, stages
 *
 * Returns undefined when baseRole is not provided (we cannot fabricate required fields).
 * Returns baseRole unchanged when no override exists for the given roleId.
 */
export function resolveRole(
  config: HimaConfig,
  roleId: string,
  baseRole?: RoleDef,
): RoleDef | undefined {
  if (baseRole === undefined) return undefined;

  const override = config.roles?.[roleId];
  if (override === undefined) return baseRole;

  return {
    name: baseRole.name,
    mission: baseRole.mission,
    stages:
      override.stages !== undefined
        ? (override.stages as readonly string[])
        : baseRole.stages,
    forcedSkills:
      override.forcedSkills !== undefined
        ? (override.forcedSkills as readonly SkillRef[])
        : baseRole.forcedSkills,
    adversaryOf: baseRole.adversaryOf,
    roleId: baseRole.roleId,
    skillRefs: baseRole.skillRefs,
    model: (override.model ?? baseRole.model) as AgentModel,
    isAdversarial: baseRole.isAdversarial,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter a resolved SkillRef list against config.enabledSources (SPEC-016 Q-003 / OQ-3).
 *
 * No-op guarantee: when config.enabledSources is undefined (the default, matching
 * every config decoded before this field existed), the input list is returned
 * unchanged — no filtering occurs.
 */
function filterByEnabledSources(
  config: HimaConfig,
  skills: SkillRef[],
): SkillRef[] {
  const enabledSources = config.enabledSources;
  if (enabledSources === undefined) {
    return skills;
  }
  const allowed = new Set<string>(enabledSources);
  return skills.filter((s) => allowed.has(s.source));
}

/**
 * Try to load and decode a single config file.
 * Returns null if the file does not exist or fails to decode (never throws).
 */
async function tryLoadOne(filePath: string): Promise<HimaConfig | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (e: unknown) {
    if (isEnoent(e)) return null; // normal — file is optional
    process.stderr.write(
      `[hima:config] skipping ${filePath}: read error — ${String(e)}\n`,
    );
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e: unknown) {
    process.stderr.write(
      `[hima:config] skipping ${filePath}: JSON parse error — ${String(e)}\n`,
    );
    return null;
  }

  const result = decodeHimaConfigEither(parsed);
  if (Either.isLeft(result)) {
    process.stderr.write(
      `[hima:config] skipping ${filePath}: schema decode failed — ${String(result.left)}\n`,
    );
    return null;
  }
  return result.right;
}

/**
 * Merge configs left-to-right.  Later entries win for overlapping keys.
 */
function mergeAll(...configs: HimaConfig[]): HimaConfig {
  return configs.reduce<HimaConfig>(mergeTwo, {});
}

/**
 * Merge two configs with b winning over a.
 *
 * stageSkills / roles: per-key merge (b's entry wins for any key present in b).
 * cycle / runtimes / useDevCyclePack / enabledSources: b wins wholesale when
 * defined (project beats user), matching cycle's existing wholesale-replace
 * semantics — these are scalar/array top-level fields, not keyed records.
 */
function mergeTwo(a: HimaConfig, b: HimaConfig): HimaConfig {
  const stageSkills = mergeOptionalRecords(a.stageSkills, b.stageSkills);
  const cycle = b.cycle ?? a.cycle;
  const roles = mergeOptionalRecords(a.roles, b.roles);
  const runtimes = b.runtimes ?? a.runtimes;
  const useDevCyclePack = b.useDevCyclePack ?? a.useDevCyclePack;
  const enabledSources = b.enabledSources ?? a.enabledSources;

  // Build a plain mutable object; HimaConfig.Type has readonly fields, but
  // a structurally compatible mutable object is assignable to the readonly type.
  const out: {
    stageSkills?: HimaConfig["stageSkills"];
    cycle?: HimaConfig["cycle"];
    roles?: HimaConfig["roles"];
    runtimes?: HimaConfig["runtimes"];
    useDevCyclePack?: HimaConfig["useDevCyclePack"];
    enabledSources?: HimaConfig["enabledSources"];
  } = {};

  if (stageSkills !== undefined) {
    out.stageSkills = stageSkills as HimaConfig["stageSkills"];
  }
  if (cycle !== undefined) {
    out.cycle = cycle;
  }
  if (roles !== undefined) {
    out.roles = roles as HimaConfig["roles"];
  }
  if (runtimes !== undefined) {
    out.runtimes = runtimes;
  }
  if (useDevCyclePack !== undefined) {
    out.useDevCyclePack = useDevCyclePack;
  }
  if (enabledSources !== undefined) {
    out.enabledSources = enabledSources;
  }

  return out;
}

/**
 * Merge two optional Record<string, V> maps.
 * Returns undefined only when both inputs are undefined.
 * Otherwise spreads a over b (b's keys win).
 */
function mergeOptionalRecords<V>(
  a: Readonly<Record<string, V>> | undefined,
  b: Readonly<Record<string, V>> | undefined,
): Record<string, V> | undefined {
  if (a === undefined && b === undefined) return undefined;
  return { ...(a ?? {}), ...(b ?? {}) };
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
