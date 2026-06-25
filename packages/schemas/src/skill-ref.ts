import { Schema } from "effect";

/**
 * SkillRef — a typed reference to a skill by source registry and identifier.
 * Sources: "base" (built-in hima skills), "corpus" (excellence-book corpus),
 * "user" (user-scoped ~/.claude/skills), "project" (repo-local .claude/skills).
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §3.1 (skill routing).
 */

export const SkillRef = Schema.Struct({
  source: Schema.Literal("base", "corpus", "user", "project"),
  id: Schema.String,
});

export type SkillRef = typeof SkillRef.Type;

/** Decode an unknown value into a SkillRef, throwing on invalid input. */
export const decodeSkillRef = Schema.decodeUnknownSync(SkillRef);

/** Decode an unknown value into Either<SkillRef, ParseError> (non-throwing). */
export const decodeSkillRefEither = Schema.decodeUnknownEither(SkillRef);
