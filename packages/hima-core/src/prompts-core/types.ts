/**
 * prompts-core/types.ts — core type contracts for the profiles / prompts-core layer.
 *
 * Design sources:
 *   SPEC-004-profiles.md [CRITICAL][BLOCKS:critical] (VariantTable, PromptSource)
 *   R-020 gap register (packages/hima-core/src/prompts-core/)
 *
 * PromptSource discriminated union:
 *   - "bundled"    — content inlined at compile time; no disk I/O at runtime.
 *   - "filesystem" — content resolved at runtime from baseDir; async load required.
 *
 * VariantTable maps variant names (e.g. "default", "claude", "planner") to their
 * respective PromptSource. resolveVariant() selects which variant name to use;
 * the loader layer (loader.ts) materialises the selected source into a string.
 */

// ---------------------------------------------------------------------------
// PromptSource — where prompt content lives
// ---------------------------------------------------------------------------

/**
 * A prompt source is either:
 *
 *  - `bundled`   — the content string is embedded in the JS bundle (static import).
 *                  No filesystem access at runtime; deterministic and offline-safe.
 *
 *  - `filesystem` — the content is loaded from disk at runtime by reading
 *                   `<baseDir>/<variantName>.md`. The loader must validate that
 *                   the resolved path stays under baseDir (anti path-traversal).
 */
export type PromptSource =
  | { readonly kind: "bundled"; readonly content: string }
  | { readonly kind: "filesystem"; readonly baseDir: string };

// ---------------------------------------------------------------------------
// VariantTable — the profile's full variant map
// ---------------------------------------------------------------------------

/**
 * A VariantTable is the complete set of prompt variants a profile exposes.
 * Keys are variant names (e.g. "default", "claude", "planner"); values are
 * the corresponding PromptSource.
 *
 * resolveVariant() takes a VariantTable and returns the selected variant name.
 * The loader materialises the PromptSource at that name into prompt text.
 *
 * v0.1 convention: every table must include at minimum a "default" or a first
 * fallback entry so resolveVariant() always returns a valid key.
 */
export type VariantTable = Record<string, PromptSource>;
