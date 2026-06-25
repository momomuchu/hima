import { Schema } from "effect";
import { RiskClass } from "./risk.js";

/**
 * Sigil detection — the three entry-point sigils that the pipeline kernel
 * recognises at end-of-message (after stripping fenced and inline code spans).
 * "ulw" is an alias for "full" and resolves to entryPoint "full" at match time.
 *
 * Regex for detection (applied by the caller, not this schema):
 *   /\b(full|run|spec|ulw)\s*$/i
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §2 (entrypoints),
 *      AMENDMENT-003 (dev-cycle stage registry).
 */

/** The three canonical entry-point identifiers. */
export const EntryPoint = Schema.Literal("full", "run", "spec");
export type EntryPoint = typeof EntryPoint.Type;

/**
 * SigilMatch — the decoded result produced when the runtime detects a sigil
 * at the end of a user message.
 *
 * Fields:
 *   sigil       — the raw token found in the message (e.g. "ulw", "full").
 *   entryPoint  — the canonical entry-point after alias resolution.
 *   floor       — the minimum RiskClass enforced for this entry-point.
 */
export const SigilMatch = Schema.Struct({
  sigil: Schema.String,
  entryPoint: EntryPoint,
  floor: RiskClass,
});
export type SigilMatch = typeof SigilMatch.Type;

/** Decode an unknown value into a SigilMatch, throwing on invalid input. */
export const decodeSigilMatch = Schema.decodeUnknownSync(SigilMatch);

/** Decode an unknown value into Either<SigilMatch, ParseError> (non-throwing). */
export const decodeSigilMatchEither = Schema.decodeUnknownEither(SigilMatch);
