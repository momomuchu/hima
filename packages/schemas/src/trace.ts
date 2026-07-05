import { Schema } from "effect";

/**
 * TraceEvent — one JSONL line appended to .hima/state/events.jsonl for every
 * gate evaluation in the v3 pipeline. Restores the observability that the old
 * @harness CLI provided (GateEvaluated events) but in the lean v3 shape.
 *
 * Consumed by: hima ledger queries, dashboards, tests, post-run audits.
 * Written by:  @norm/core runGate (via appendFile or storage-core append).
 *
 * See: docs/specs/SPEC-007-adapter-hermes.md, .planning/architecture/ARCHITECTURE-v3.md §3.2
 */
export const TraceEvent = Schema.Struct({
  /** ISO-8601 timestamp at gate-evaluation time. */
  ts: Schema.String,

  /** Claude session_id forwarded from the hook payload (or synthetic if absent). */
  sessionId: Schema.String,

  /** Monotonic run identifier scoped to a single CLI invocation (optional). */
  runId: Schema.optional(Schema.String),

  /**
   * The hook event that triggered this gate.
   * e.g. "PreToolUse", "UserPromptSubmit", "PostToolUse", "Stop"
   */
  hookEvent: Schema.String,

  /**
   * Which gate path was evaluated.
   * e.g. "skill-force", "ward", "hard-block", "noop"
   */
  gateType: Schema.String,

  /** Tool name from Claude PreToolUse payload (absent for UserPromptSubmit). */
  toolName: Schema.optional(Schema.String),

  /** Sigil extracted from the user prompt (UserPromptSubmit path only). */
  sigil: Schema.optional(Schema.String),

  /** Ward stage resolved by the sigil->ward gate (UserPromptSubmit path only). */
  wardStage: Schema.optional(Schema.String),

  /** The gate verdict emitted to the runtime. */
  decision: Schema.Literal("allow", "warn", "block", "noop"),

  /** `kind` field of the ForceAction that drove the decision (if any). */
  forceActionKind: Schema.optional(Schema.String),

  /** Skill IDs that were injected / forced by this gate event. */
  skillsForced: Schema.Array(Schema.String),

  /** All skill IDs present in the resolved skill-ref set at evaluation time. */
  skillsLoaded: Schema.Array(Schema.String),

  /** Exit code returned to Claude (0 = pass-through, 2 = hard-block). */
  exitCode: Schema.Number,

  /** Human-readable reason for the decision (present when decision != "noop"). */
  reason: Schema.optional(Schema.String),

  /** Canary string echoed to stderr for integration-test assertions. */
  canary: Schema.optional(Schema.String),
});

export type TraceEvent = typeof TraceEvent.Type;

/** Decode an unknown value into a TraceEvent, throwing on invalid input. */
export const decodeTraceEvent = Schema.decodeUnknownSync(TraceEvent);

/** Decode an unknown value into Either<TraceEvent, ParseError> (non-throwing). */
export const decodeTraceEventEither = Schema.decodeUnknownEither(TraceEvent);
