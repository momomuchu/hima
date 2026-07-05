import { Schema } from "effect";

/**
 * RuntimeTarget — the coding-agent runtime(s) a project targets.
 *
 * Mirrors the plain TS union already defined locally in `@norm/hima-core`
 * (`capability-map-v3.ts` / `forcing-primitive.ts`,
 * `"claude" | "codex" | "hermes" | "opencode"`) as a decodable Effect Schema
 * literal so `HimaConfig.runtimes` (SPEC-016 Q-001 / OQ-1) has a schema-level
 * source of truth instead of two independent plain-TS copies.
 *
 * See: docs/specs/SPEC-016-onboarding-questions.md Q-001, OQ-1.
 */
export const RuntimeTarget = Schema.Literal(
  "claude",
  "codex",
  "hermes",
  "opencode",
);

export type RuntimeTarget = typeof RuntimeTarget.Type;

/** Decode an unknown value into a RuntimeTarget, throwing on invalid input. */
export const decodeRuntimeTarget = Schema.decodeUnknownSync(RuntimeTarget);

/** Decode an unknown value into Either<RuntimeTarget, ParseError> (non-throwing). */
export const decodeRuntimeTargetEither =
  Schema.decodeUnknownEither(RuntimeTarget);
