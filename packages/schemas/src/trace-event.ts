import { Schema } from "effect";
import { GateType } from "./gate.js";
import { ForceAction } from "./force-action.js";

/**
 * TraceEvent — one structured observability record written per gate invocation.
 *
 * A TraceEvent is appended to `.hima/state/events.jsonl` as a single JSON line
 * after every gate handler runs. The trace renderer (`observe.ts` in @hima/cli)
 * reads these records for `hima observe` output.
 *
 * Design notes:
 *   - `forceAction` captures exactly what the gate engine applied (may be noop).
 *   - `skillsForced` is an ordered list of skill IDs actually forced; for the
 *     typical skill-force case this is a single element matching
 *     `forceAction.skillId`.  It is kept separate so summary queries can collect
 *     distinct skills without re-parsing the union.
 *   - `exitCode` is the Claude hook exit code: 0 = allow/context, 2 = block.
 *   - `sigil` / `wardStage` provide ward context so timelines are self-contained.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3, ARCHITECTURE-FLOW-v3.md §4.
 */

export const TraceEvent = Schema.Struct({
  /** ISO8601 wall-clock timestamp when the gate handler completed. */
  timestamp: Schema.String,

  /** The canonical gate position (see GateType). */
  gateType: GateType,

  /** Claude tool name, present only for pre_tool / post_tool events. */
  toolName: Schema.optional(Schema.String),

  /** The gate verdict decision: allow | warn | block. */
  decision: Schema.Literal("allow", "warn", "block"),

  /**
   * The ForceAction resolved by pickAttack() for this event.
   * Absent for pure allow paths where no force was considered.
   */
  forceAction: Schema.optional(ForceAction),

  /**
   * Ordered skill IDs that were forced (injected / blocked-until-invoked) as a
   * result of this event.  Typically 0 or 1 elements; separated from forceAction
   * so callers can collect distinct skills without parsing the union variant.
   */
  skillsForced: Schema.optional(Schema.Array(Schema.String)),

  /**
   * Claude hook exit code emitted for this event.
   * 0 = allow or context-inject; 2 = hard block.
   */
  exitCode: Schema.Number,

  /**
   * Raw sigil token detected in the user message, if any (e.g. "ulw", "spec").
   * Present only on user_prompt events that matched a sigil.
   */
  sigil: Schema.optional(Schema.String),

  /**
   * The ward's openStage at the time of this event (e.g. "discovery", "spec").
   * Absent if no ward was active.
   */
  wardStage: Schema.optional(Schema.String),
});

export type TraceEvent = typeof TraceEvent.Type;

/** Decode an unknown value into a TraceEvent, throwing on invalid input. */
export const decodeTraceEvent = Schema.decodeUnknownSync(TraceEvent);

/** Decode an unknown value into Either<TraceEvent, ParseError> (non-throwing). */
export const decodeTraceEventEither = Schema.decodeUnknownEither(TraceEvent);
