/**
 * rules-engine/matcher.ts — picomatch-based glob matcher for rule files.
 *
 * Provides `ruleMatches(globs, relativePath, basename)` which tests a target
 * file path against a list of glob patterns using picomatch.
 *
 * Matching strategy (SPEC-006 §HIGH shouldApplyRule):
 *   1. For each pattern in `globs`:
 *      - Test against `relativePath` (relative path from project root).
 *      - Test against `basename` (filename only).
 *      - Options: `{ dot: true, bash: true }`.
 *   2. Patterns prefixed with `!` are negation patterns:
 *      - If any positive pattern matched AND a negation pattern also matches →
 *        the rule is NOT applied.
 *   3. Returns true when at least one positive pattern matches AND no negation
 *      pattern cancels it.
 *   4. Returns false when `globs` is empty (caller must check `alwaysApply`
 *      independently).
 *
 * LRU cache: compiled picomatch functions are cached by pattern string to avoid
 * repeated compilation (max 256 entries, simple FIFO eviction).
 *
 * picomatch v4 ships as a CJS module without bundled TypeScript types. We load
 * it via createRequire (standard ESM→CJS interop) and assert the return type
 * locally. No @ts-ignore needed; the loader returns `any` which we narrow.
 *
 * See: SPEC-006-rules-engine-injection.md [HIGH][BLOCKS:high] matcher section.
 */

import { createRequire } from "node:module";

// ---------------------------------------------------------------------------
// picomatch loader (CJS interop via createRequire)
// ---------------------------------------------------------------------------

/** Minimal types for the picomatch subset we use. */
type PicoMatcher = (path: string) => boolean;
type PicoMatchOpts = { dot: boolean; bash: boolean };
type PicoMatchFn = (pattern: string, opts?: PicoMatchOpts) => PicoMatcher;

const _require = createRequire(import.meta.url);
// picomatch v4 is a CJS module; createRequire returns any → narrow immediately.
const picomatch = _require("picomatch") as PicoMatchFn;

// ---------------------------------------------------------------------------
// Picomatch options used throughout
// ---------------------------------------------------------------------------

const PM_OPTS: PicoMatchOpts = { dot: true, bash: true };

// ---------------------------------------------------------------------------
// Compiled-matcher cache (LRU-ish: simple FIFO eviction at 256 entries)
// ---------------------------------------------------------------------------

const CACHE_MAX = 256;
const _cache = new Map<string, PicoMatcher>();

function compileMatcher(pattern: string): PicoMatcher {
  const cached = _cache.get(pattern);
  if (cached) return cached;

  const matcher = picomatch(pattern, PM_OPTS);

  // Evict oldest entry when at capacity
  if (_cache.size >= CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    if (firstKey !== undefined) {
      _cache.delete(firstKey);
    }
  }

  _cache.set(pattern, matcher);
  return matcher;
}

// ---------------------------------------------------------------------------
// ruleMatches
// ---------------------------------------------------------------------------

/**
 * Test whether a target file matches any of the provided glob patterns.
 *
 * @param globs        Array of picomatch glob patterns (may include `!` negations).
 * @param relativePath File path relative to the project root (forward-slash separators).
 * @param basename     Filename without directory components.
 * @returns            `true` when the file matches at least one positive pattern
 *                     and no negation pattern cancels the match.
 */
export function ruleMatches(
  globs: string[],
  relativePath: string,
  basename: string,
): boolean {
  if (globs.length === 0) return false;

  const positive: string[] = [];
  const negative: string[] = [];

  for (const g of globs) {
    if (g.startsWith("!")) {
      negative.push(g.slice(1));
    } else {
      positive.push(g);
    }
  }

  // No positive patterns → nothing to match against
  if (positive.length === 0) return false;

  // Test whether the file matches any positive pattern
  const positiveHit = positive.some((pattern) => {
    const matcher = compileMatcher(pattern);
    return matcher(relativePath) || matcher(basename);
  });

  if (!positiveHit) return false;

  // Test whether any negation pattern cancels the match
  const negativeHit = negative.some((pattern) => {
    const matcher = compileMatcher(pattern);
    return matcher(relativePath) || matcher(basename);
  });

  return !negativeHit;
}

// ---------------------------------------------------------------------------
// Exported for testing: clear the internal cache
// ---------------------------------------------------------------------------

/** Flush the compiled-matcher cache. Useful in tests. */
export function clearMatcherCache(): void {
  _cache.clear();
}
