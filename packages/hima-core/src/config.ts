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
import { CycleDef, SkillRef } from "@hima/schemas";
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
 * stageSkills — keyed by stage id; overrides force/inject for that stage.
 * cycle       — full cycle replacement (AMENDMENT-003); supersedes DEV_CYCLE when present.
 * roles       — keyed by role id; overrides model, forcedSkills, and stages for a subagent.
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
 *   3. devCycle stage.forceSkills         — founder default (DEV_CYCLE from caller)
 *   4. []                                 — stage not found in any source
 *
 * Pass DEV_CYCLE from @hima/schemas as devCycle to get the founder default.
 */
export function resolveStageForceSkills(
  config: HimaConfig,
  stageId: string,
  devCycle: CycleDef,
): SkillRef[] {
  // 1. Explicit stageSkills override
  const force = config.stageSkills?.[stageId]?.force;
  if (force !== undefined) {
    return [...force];
  }

  // 2. Custom cycle stage override
  const configStage = config.cycle?.stages.find((s) => s.id === stageId);
  if (configStage !== undefined) {
    return [...configStage.forceSkills];
  }

  // 3. Founder default cycle
  const devStage = devCycle.stages.find((s) => s.id === stageId);
  if (devStage !== undefined) {
    return [...devStage.forceSkills];
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
 *   3. devCycle stage.injectSkills         — founder default
 *   4. []                                  — stage not found
 */
export function resolveStageInjectSkills(
  config: HimaConfig,
  stageId: string,
  devCycle: CycleDef,
): SkillRef[] {
  // 1. Explicit stageSkills override
  const inject = config.stageSkills?.[stageId]?.inject;
  if (inject !== undefined) {
    return [...inject];
  }

  // 2. Custom cycle stage override
  const configStage = config.cycle?.stages.find((s) => s.id === stageId);
  if (configStage !== undefined) {
    return [...configStage.injectSkills];
  }

  // 3. Founder default cycle
  const devStage = devCycle.stages.find((s) => s.id === stageId);
  if (devStage !== undefined) {
    return [...devStage.injectSkills];
  }

  return [];
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
 * cycle: b wins wholesale (project beats user).
 */
function mergeTwo(a: HimaConfig, b: HimaConfig): HimaConfig {
  const stageSkills = mergeOptionalRecords(a.stageSkills, b.stageSkills);
  const cycle = b.cycle ?? a.cycle;
  const roles = mergeOptionalRecords(a.roles, b.roles);

  // Build a plain mutable object; HimaConfig.Type has readonly fields, but
  // a structurally compatible mutable object is assignable to the readonly type.
  const out: {
    stageSkills?: HimaConfig["stageSkills"];
    cycle?: HimaConfig["cycle"];
    roles?: HimaConfig["roles"];
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
