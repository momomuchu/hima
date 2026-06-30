/**
 * prompts-core/variant-resolver.ts — resolveVariant(): the sole variant-selection
 * function for the profiles layer.
 *
 * Design sources:
 *   SPEC-004-profiles.md [CRITICAL][BLOCKS:high] (resolution order, no other mechanism)
 *   SPEC-004 MEDIUM items (PLANNER_AGENT_NAMES, MODEL_MATCHERS v0.1)
 *
 * Resolution order (verbatim from SPEC-004 [CRITICAL][BLOCKS:high]):
 *   1. If agentName ∈ PLANNER_AGENT_NAMES AND variant "planner" is present → "planner".
 *   2. Else first variant whose MODEL_MATCHER matches modelID (claude = startsWith("claude-")).
 *   3. Else "default" if present.
 *   4. Else first key of the table.
 *
 * This function is PURE: no I/O, no side effects. The loader layer handles
 * filesystem access after variant selection.
 *
 * No other variant-selection mechanism is permitted in v0.1 (SPEC-004 CRITICAL).
 */

// ---------------------------------------------------------------------------
// PLANNER_AGENT_NAMES — v0.1: {"planner"}, extensible for aliases
// ---------------------------------------------------------------------------

/**
 * Set of agent-name aliases that trigger planner-variant selection when
 * the "planner" variant is present in the table.
 *
 * v0.1 per SPEC-004 MEDIUM: `new Set(["planner"])`.
 * Extend here to add aliases (e.g. "plan", "architect") in future waves.
 */
export const PLANNER_AGENT_NAMES: ReadonlySet<string> = new Set(["planner"]);

// ---------------------------------------------------------------------------
// MODEL_MATCHERS — v0.1: one matcher for "claude"
// ---------------------------------------------------------------------------

type ModelMatcher = {
  /** The variant name this matcher maps to (key in the VariantTable). */
  readonly variantName: string;
  /** Returns true when modelID belongs to this model family. */
  readonly matches: (modelID: string) => boolean;
};

/**
 * Ordered list of model-to-variant matchers.
 * resolveVariant() iterates this array in order and picks the first match.
 *
 * v0.1 per SPEC-004 MEDIUM: one matcher covering all Claude model IDs
 * (`modelID.startsWith("claude-")`). GPT / Gemini / etc. matchers are
 * added in Wave 4+ when those adapters are activated.
 */
const MODEL_MATCHERS: readonly ModelMatcher[] = [
  {
    variantName: "claude",
    matches: (modelID) => modelID.startsWith("claude-"),
  },
];

// ---------------------------------------------------------------------------
// resolveVariant — sole variant-selection entry point
// ---------------------------------------------------------------------------

export type ResolveVariantParams = {
  /** The modelID string from the active session (e.g. "claude-sonnet-4-6"). */
  readonly modelID: string;
  /**
   * The agent name for this invocation (e.g. "planner", "executor").
   * Checked against PLANNER_AGENT_NAMES as step 1.
   */
  readonly agentName: string;
  /**
   * The full VariantTable for the active profile.
   * Keys are variant names; values are PromptSource (not inspected here).
   */
  readonly variants: Record<string, unknown>;
};

/**
 * Select which variant name to use from the given VariantTable.
 *
 * Returns the variant name (a key that exists in `variants`).
 * Never throws — falls back gracefully to the first available key.
 *
 * Pure: no I/O, no side effects, no global state mutation.
 */
export function resolveVariant({
  modelID,
  agentName,
  variants,
}: ResolveVariantParams): string {
  // Step 1 — planner alias takes precedence when variant is present.
  if (PLANNER_AGENT_NAMES.has(agentName) && "planner" in variants) {
    return "planner";
  }

  // Step 2 — first model matcher whose variant exists in the table.
  for (const matcher of MODEL_MATCHERS) {
    if (matcher.variantName in variants && matcher.matches(modelID)) {
      return matcher.variantName;
    }
  }

  // Step 3 — "default" fallback if present.
  if ("default" in variants) {
    return "default";
  }

  // Step 4 — first key of the table (last-resort fallback).
  const firstKey = Object.keys(variants)[0];
  if (firstKey !== undefined) {
    return firstKey;
  }

  // Empty table (should never happen with a valid VariantTable).
  return "default";
}
