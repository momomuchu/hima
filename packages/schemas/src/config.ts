import { Schema } from "effect";
import { CycleDef } from "./cycle.js";
import { SkillRef } from "./skill-ref.js";

/**
 * StageSkillOverride — per-stage skill customization applied on top of the
 * founder defaults from DEV_CYCLE.  Absent sub-fields leave the default
 * forceSkills / injectSkills from the stage definition intact.
 *
 * See: AMENDMENT-001 (pluggable skills).
 */
const StageSkillOverride = Schema.Struct({
  force: Schema.optional(Schema.Array(SkillRef)),
  inject: Schema.optional(Schema.Array(SkillRef)),
});

/**
 * RoleOverride — per-role / per-subagent customization.
 * `model` is intentionally restricted to "sonnet" | "haiku"; "opus" is
 * forbidden for cost-guard compliance (kernel §6).
 * `stages` lists the cycle-stage ids the role is allowed to operate in;
 * absent means unrestricted.
 *
 * See: AMENDMENT-001 (pluggable skills).
 */
const RoleOverride = Schema.Struct({
  forcedSkills: Schema.optional(Schema.Array(SkillRef)),
  model: Schema.optional(Schema.Literal("sonnet", "haiku")),
  stages: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * HimaConfig — per-user / per-project customization overlay loaded by the
 * v3 CLI at startup.  All top-level fields are optional; absent fields fall
 * back to the founder defaults (DEV_CYCLE from cycle.ts, ROLE_CATALOG from
 * @hima/core).
 *
 * stageSkills  — keyed by stage id; overrides forceSkills / injectSkills for
 *                that stage without touching the rest of the cycle.
 * cycle        — full cycle replacement (AMENDMENT-003); when present it
 *                supersedes DEV_CYCLE entirely.
 * roles        — keyed by role id; overrides model, forced skills, and
 *                allowed stages for a named subagent role.
 *
 * See: AMENDMENT-001 (pluggable skills), AMENDMENT-003 (pluggable cycle).
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
