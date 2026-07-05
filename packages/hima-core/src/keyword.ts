import type { SigilMatch } from "@norm/schemas";

/**
 * keyword — sigil detection for pipeline entry-points.
 *
 * Strips fenced ```...``` blocks and inline `...` spans from the input text,
 * then tests whether the message ends with a recognised sigil keyword.
 *
 * Sigil map:
 *   full → { entryPoint: "full", floor: "H" }
 *   ulw  → { entryPoint: "full", floor: "H" }  (alias for full)
 *   run  → { entryPoint: "run",  floor: "M" }
 *   spec → { entryPoint: "spec", floor: "M" }
 *
 * Detection regex (applied after stripping): /\b(full|run|spec|ulw)\s*$/i
 *
 * See: .planning/architecture/ARCHITECTURE-v3.md §2 (entrypoints),
 *      AMENDMENT-003 (dev-cycle stage registry).
 */

/** Regex that strips fenced code blocks (``` ... ```). */
const FENCED_BLOCK_RE = /```[\s\S]*?```/g;

/** Regex that strips inline code spans (` ... `). */
const INLINE_CODE_RE = /`[^`]*`/g;

/** Terminal-sigil regex — matches a sigil word at the very end of the cleaned text. */
const TERMINAL_SIGIL_RE = /\b(full|run|spec|ulw)\s*$/i;

/**
 * pickSigil — detect a terminal sigil in a user message.
 *
 * @param text - The raw user message text.
 * @returns A SigilMatch if a recognised terminal sigil is found, or null.
 */
export function pickSigil(text: string): SigilMatch | null {
  // 1. Strip fenced code blocks first, then inline code spans.
  const cleaned = text
    .replace(FENCED_BLOCK_RE, "")
    .replace(INLINE_CODE_RE, "");

  // 2. Test for a terminal sigil.
  const match = TERMINAL_SIGIL_RE.exec(cleaned);
  if (match === null) return null;

  const token = (match[1] ?? "").toLowerCase();

  // 3. Resolve alias and build the SigilMatch.
  switch (token) {
    case "full":
      return { sigil: "full", entryPoint: "full", floor: "H" };
    case "ulw":
      return { sigil: "ulw", entryPoint: "full", floor: "H" };
    case "run":
      return { sigil: "run", entryPoint: "run", floor: "M" };
    case "spec":
      return { sigil: "spec", entryPoint: "spec", floor: "M" };
    default:
      // Unreachable given the regex, but TypeScript requires exhaustiveness.
      return null;
  }
}
