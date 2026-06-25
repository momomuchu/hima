import { Schema } from "effect";

/**
 * GateCapabilityCell — one row in the runtime capability matrix. Describes what a single
 * gate type can do on a given runtime: whether it can block, how it injects context, how
 * enforcement is carried out, and what compensating mechanisms exist when native support is
 * absent.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3 and AMENDMENT-001/002/003 for the full
 * 8-field definition and per-runtime values.
 */

export const GateType = Schema.Literal(
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "pre_compact",
  "post_compact",
  "stop",
  "subagent_start",
  "subagent_stop",
);

export const Level = Schema.Literal("supported", "degraded", "absent");

export const InjectionMode = Schema.Literal("rich", "constrained", "none");

export const EnforcementStrength = Schema.Literal(
  "hard",
  "advisory",
  "deferred",
  "observe_only",
);

export const CompensatingMechanism = Schema.Literal(
  "intercept_delegate_task_pre_tool",
  "deferred_stop_verdict",
  "poll_subagent_file",
  "injected_role_context",
  "keyword_detection_user_prompt",
  "none",
);

export const SubagentSupport = Schema.Literal("native", "poll-file", "absent");

export const ProfileSupport = Schema.Literal(
  "runtime-profiles",
  "injected-role-context",
  "none",
);

export const GateCapabilityCell = Schema.Struct({
  gateType: GateType,
  level: Level,
  canBlock: Schema.Boolean,
  injectionMode: InjectionMode,
  enforcementStrength: EnforcementStrength,
  skillForcing: Schema.Boolean,
  compensatingMechanism: CompensatingMechanism,
  maxInjectionBytes: Schema.optional(Schema.Number),
  universal: Schema.Boolean,
  subagents: SubagentSupport,
  profiles: ProfileSupport,
  note: Schema.optional(Schema.String),
});

export type GateCapabilityCell = typeof GateCapabilityCell.Type;

/** Decode an unknown value into a GateCapabilityCell, throwing on invalid input. */
export const decodeGateCapabilityCell =
  Schema.decodeUnknownSync(GateCapabilityCell);

/** Decode an unknown value into Either<GateCapabilityCell, ParseError> (non-throwing). */
export const decodeGateCapabilityCellEither =
  Schema.decodeUnknownEither(GateCapabilityCell);
