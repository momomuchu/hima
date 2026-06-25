import { Schema } from "effect";

/**
 * ForceAction — the output of `pickAttack()`: the strongest forcing move available on the
 * active runtime for a given gate event. One of six rungs (+ noop). This is the typed contract
 * every adapter translates into its runtime-native response (exit 2 / systemMessage / ACP).
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.2, ARCHITECTURE-FLOW-v3.md §3.
 */

export const HardBlock = Schema.Struct({
  kind: Schema.Literal("hard-block"),
  reason: Schema.String,
});

export const SkillForce = Schema.Struct({
  kind: Schema.Literal("skill-force"),
  skillId: Schema.String,
  reason: Schema.String,
});

export const RichInject = Schema.Struct({
  kind: Schema.Literal("rich-inject"),
  content: Schema.String,
});

export const ConstrainedInject = Schema.Struct({
  kind: Schema.Literal("constrained-inject"),
  systemMessage: Schema.String,
});

export const DeferredBlock = Schema.Struct({
  kind: Schema.Literal("deferred-block"),
  verdictFile: Schema.String,
  reason: Schema.String,
  resolveOn: Schema.Array(Schema.String),
});

export const ObserveOnly = Schema.Struct({
  kind: Schema.Literal("observe-only"),
  log: Schema.String,
});

export const Noop = Schema.Struct({
  kind: Schema.Literal("noop"),
});

export const ForceAction = Schema.Union(
  HardBlock,
  SkillForce,
  RichInject,
  ConstrainedInject,
  DeferredBlock,
  ObserveOnly,
  Noop,
);

export type ForceAction = typeof ForceAction.Type;

/** Decode an unknown value into a ForceAction, throwing on invalid input. */
export const decodeForceAction = Schema.decodeUnknownSync(ForceAction);

/** Decode an unknown value into Either<ForceAction, ParseError> (non-throwing). */
export const decodeForceActionEither = Schema.decodeUnknownEither(ForceAction);
