import { Schema } from "effect";
import { EntryPoint } from "./sigil.js";
import { RiskClass } from "./risk.js";
import { SkillRef } from "./skill-ref.js";

/**
 * Ward — the live execution context for a single hima pipeline run. Tracks
 * which entry-point was triggered, the risk-class floor, the current dev-cycle
 * stage, which skills are registered, per-stage verdicts, and an optional
 * deferred-block verdict file path.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.3, AMENDMENT-003 (stage
 * registry as data), ENTRYPOINTS-v3.md (floor rules per entry-point).
 */

/**
 * StageVerdict — the outcome record for a single dev-cycle stage. Captures the
 * stage name, its resolution status, and the evidence items that support it.
 *
 * Status semantics:
 *   blocked        — gate hard-blocked; stage cannot proceed.
 *   partial        — some evidence gathered; stage incomplete.
 *   done           — stage complete; no independent verification performed.
 *   done-verified  — stage complete + automatically verified.
 *   done-validated — stage complete + founder-validated.
 */
export const StageVerdict = Schema.Struct({
  stage: Schema.String,
  status: Schema.Literal(
    "blocked",
    "partial",
    "done",
    "done-verified",
    "done-validated",
  ),
  evidence: Schema.Array(Schema.String),
});

export type StageVerdict = typeof StageVerdict.Type;

/**
 * Ward — the pipeline execution context carried across gate events for a single
 * run. Created at session_start / user_prompt sigil detection and mutated by
 * gate handlers as the run progresses through dev-cycle stages.
 *
 * Fields:
 *   id            — unique run identifier (e.g. UUID or timestamp slug).
 *   entryPoint    — the canonical entry-point resolved from the detected sigil.
 *   floor         — the minimum RiskClass enforced for this run.
 *   openStage     — the dev-cycle stage currently executing (e.g. "discovery").
 *   skillRegister — ordered list of skill references active for this run.
 *   verdicts      — per-stage outcome records accumulated during the run.
 *   deferred      — optional path to a pending deferred-block verdict file.
 */
export const Ward = Schema.Struct({
  id: Schema.String,
  entryPoint: EntryPoint,
  floor: RiskClass,
  openStage: Schema.String,
  skillRegister: Schema.Array(SkillRef),
  verdicts: Schema.Array(StageVerdict),
  deferred: Schema.optional(Schema.String),
});

export type Ward = typeof Ward.Type;

/** Decode an unknown value into a Ward, throwing on invalid input. */
export const decodeWard = Schema.decodeUnknownSync(Ward);

/** Decode an unknown value into Either<Ward, ParseError> (non-throwing). */
export const decodeWardEither = Schema.decodeUnknownEither(Ward);
