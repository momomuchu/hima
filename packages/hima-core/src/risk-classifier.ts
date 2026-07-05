/**
 * risk-classifier.ts — heuristic RiskClass floor estimator for no-sigil prompts.
 *
 * classifyRisk() scans raw prompt text for lexical signals and returns the
 * highest matched floor together with every reason label that fired.
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-018, R-019.
 * Design source: ARCHITECTURE-FLOW-v3.md §1 NO-sigil branch;
 *                ENTRYPOINTS-v3.md §no-sigil classification.
 *
 * Properties:
 *   - Pure function — no I/O, no side effects.
 *   - Conservative — each signal group votes for a floor; the final floor is the
 *     max across all fired groups. Multiple groups may fire on the same prompt.
 *   - The classifier can only RAISE a floor (R-019); lowering is the caller's job.
 */

import { RISK_ORDER } from "@norm/schemas";
import type { RiskClass } from "@norm/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

/** A named group of patterns that all vote for the same floor. */
interface SignalRule {
  /** The floor this rule proposes when any of its patterns fire. */
  readonly floor: RiskClass;
  /** Human-readable label emitted in the returned reasons[]. */
  readonly label: string;
  /** Patterns to test; ANY match fires the rule (case-insensitive, applied to raw text). */
  readonly patterns: readonly RegExp[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All rules are evaluated in a single pass over the input.
 * Rules are ordered C → H → M for readability, but the actual floor is the max
 * of all fired rules — order does not matter for correctness.
 */
const SIGNAL_RULES: readonly SignalRule[] = [
  // ── C: security / financial / identity-critical signals ──────────────────
  // These terms appear in prompts whose consequences are hardest to reverse and
  // whose errors carry the highest risk (data loss, credential exposure, money).
  {
    floor: "C",
    label: "security/payment/auth/credential/schema-migration/secret signal",
    patterns: [
      /\bsecurity\b/i,
      /\bpayment\b/i,
      /\bauth(?:entication|orization|oris)?\b/i,
      /\bcredential\b/i,
      /\bschema[\s-]migration\b/i,
      /\bsecret\b/i,
      /\bpassword\b/i,
      /\bencrypt(?:ion)?\b/i,
      /\boauth\b/i,
      /\bjwt\b/i,
    ],
  },

  // ── H: architectural verb signals ─────────────────────────────────────────
  // Verbs that imply cross-cutting restructuring — reversing these mid-flight is
  // expensive. Includes "migrate" which subsumes "schema migration" at this level
  // (the C rule fires too when the compound phrase is present).
  {
    floor: "H",
    label: "architectural verb signal",
    patterns: [
      /\barchitect(?:ure|ural)?\b/i,
      /\bredesign\b/i,
      /\brefactor\b/i,
      /\bmigrat(?:e|es|ed|ion|ions)?\b/i,
      /\brewrite\b/i,
      /\brestructure\b/i,
    ],
  },

  // ── H: broad-scope indicators ─────────────────────────────────────────────
  // Scope signals that imply multi-file or systemic blast radius.
  {
    floor: "H",
    label: "broad-scope indicator",
    patterns: [
      /\bmulti[\s-]file\b/i,
      /\bcross[\s-]cut\b/i,
      /\bmulti[\s-]module\b/i,
      /\ball\s+the\b/i,
      /\beverything\b/i,
    ],
  },

  // ── M: bounded implementation verbs ──────────────────────────────────────
  // Common coding-task verbs; fire only when no C or H signal is present
  // (max() ensures C/H wins when both classes fire simultaneously).
  {
    floor: "M",
    label: "bounded implementation verb signal",
    patterns: [
      /\bimplement\b/i,
      /\badd\b/i,
      /\bbuild\b/i,
      /\bcreate\b/i,
      /\bfix\b/i,
      /\bwrite\b/i,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// classifyRisk — public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the risk floor of a user prompt using lexical heuristics.
 *
 * The function is intentionally conservative: when multiple signal groups fire,
 * the highest floor wins. A prompt about "auth refactoring" will return "C"
 * because the C auth signal outranks the H refactor signal.
 *
 * When no signal fires the floor is "T" and reasons is [].
 *
 * @param promptText - Raw user message text; no pre-processing required.
 * @returns  floor   — the highest matched RiskClass, or "T" as the default.
 *           reasons — one entry per fired signal rule; empty when floor is "T".
 */
export function classifyRisk(promptText: string): {
  floor: RiskClass;
  reasons: string[];
} {
  const reasons: string[] = [];
  let floor: RiskClass = "T";

  for (const rule of SIGNAL_RULES) {
    const fired = rule.patterns.some((re) => re.test(promptText));
    if (fired) {
      reasons.push(rule.label);
      if (RISK_ORDER[rule.floor] > RISK_ORDER[floor]) {
        floor = rule.floor;
      }
    }
  }

  return { floor, reasons };
}
