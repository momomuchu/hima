import { Schema } from "effect";

/**
 * Gate schemas — typed contracts for all gate events, verdicts, and force intents
 * flowing through the PFV4 runtime kernel.
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3, ARCHITECTURE-FLOW-v3.md §3.
 */

// ---------------------------------------------------------------------------
// GateType — the 9 canonical gate positions across all runtimes
// ---------------------------------------------------------------------------

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

export type GateType = typeof GateType.Type;

// ---------------------------------------------------------------------------
// GateEvent — the inbound payload arriving at a gate
// ---------------------------------------------------------------------------

export const GateEvent = Schema.Struct({
  gateType: GateType,
  toolName: Schema.optional(Schema.String),
  promptContent: Schema.optional(Schema.String),
  toolInput: Schema.optional(Schema.Unknown),
});

export type GateEvent = typeof GateEvent.Type;

// ---------------------------------------------------------------------------
// ForceIntent — what the gate engine wants to force at the call-site
// ---------------------------------------------------------------------------

export const SkillGateIntent = Schema.Struct({
  kind: Schema.Literal("SkillGate"),
  skillId: Schema.String,
  blocksUntilInvoked: Schema.Boolean,
});

export const ContextInjectIntent = Schema.Struct({
  kind: Schema.Literal("ContextInject"),
  content: Schema.String,
});

export const DeferredBlockIntent = Schema.Struct({
  kind: Schema.Literal("DeferredBlock"),
  reason: Schema.String,
  resolveOn: Schema.Array(Schema.String),
});

export const ForceIntent = Schema.Union(
  SkillGateIntent,
  ContextInjectIntent,
  DeferredBlockIntent,
);

export type ForceIntent = typeof ForceIntent.Type;

// ---------------------------------------------------------------------------
// GateVerdict — the outbound decision for a gate event
// ---------------------------------------------------------------------------

export const GateVerdict = Schema.Struct({
  decision: Schema.Literal("allow", "warn", "block"),
  reason: Schema.String,
  forceIntent: Schema.optional(ForceIntent),
});

export type GateVerdict = typeof GateVerdict.Type;

// ---------------------------------------------------------------------------
// Decoders
// ---------------------------------------------------------------------------

/** Decode an unknown value into a GateType, throwing on invalid input. */
export const decodeGateType = Schema.decodeUnknownSync(GateType);

/** Decode an unknown value into a GateType as Either (non-throwing). */
export const decodeGateTypeEither = Schema.decodeUnknownEither(GateType);

/** Decode an unknown value into a GateEvent, throwing on invalid input. */
export const decodeGateEvent = Schema.decodeUnknownSync(GateEvent);

/** Decode an unknown value into a GateEvent as Either (non-throwing). */
export const decodeGateEventEither = Schema.decodeUnknownEither(GateEvent);

/** Decode an unknown value into a ForceIntent, throwing on invalid input. */
export const decodeForceIntent = Schema.decodeUnknownSync(ForceIntent);

/** Decode an unknown value into a ForceIntent as Either (non-throwing). */
export const decodeForceIntentEither = Schema.decodeUnknownEither(ForceIntent);

/** Decode an unknown value into a GateVerdict, throwing on invalid input. */
export const decodeGateVerdict = Schema.decodeUnknownSync(GateVerdict);

/** Decode an unknown value into a GateVerdict as Either (non-throwing). */
export const decodeGateVerdictEither = Schema.decodeUnknownEither(GateVerdict);
