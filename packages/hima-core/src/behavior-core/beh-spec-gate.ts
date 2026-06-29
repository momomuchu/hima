/**
 * BEH_SPEC_GATE — Spec-gate advisory at M+ prompt arrival (R-024).
 *
 * At every user_prompt gate, if the incoming prompt signals implementation
 * intent (impl/build/code verbs + a code-ish noun) AND the effective risk
 * class is M, H, or C, AND no spec reference is present in the prompt,
 * this behavior emits an advisory warn pointing to corpus-spec-driven-development.
 *
 * This behavior is ADVISORY (warn), never block. It surfaces guidance to the
 * agent at prompt-time and does not halt execution.
 *
 * Decision tree:
 *   1. No implementation intent in promptContent → allow.
 *   2. riskClass < M (T or L) → allow (advisory not warranted at low stakes).
 *   3. Spec reference present in prompt → allow (spec acknowledged).
 *   4. Implementation intent at M+ without spec reference → warn.
 *
 * Implementation intent detection (both conditions must hold):
 *   Verbs:   \b(implement|build|code)\b  OR  \b(write|add|create)\s+the\b
 *   Nouns:   any code-ish noun from CODE_NOUN_RE (function, service, flow, …)
 *
 * Spec reference detection (any one hit passes):
 *   - ".spec.md" in prompt (file extension reference)
 *   - "docs/specs" in prompt (directory path reference)
 *   - "\bspec\b" word boundary (standalone word reference)
 *
 * violationType: n/a (advisory only — warn never carries violationType)
 * gates:         ["user_prompt"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-024,
 *      BEHAVIOR-CATALOG-v3.md §1 S-17,
 *      cycle.ts:75-82 (DEV_CYCLE spec stage forceSkills = corpus-spec-driven-development).
 */

import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";
import { RISK_ORDER } from "@hima/schemas";
import type { RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-SPEC-GATE";

/**
 * Verbs that indicate the agent is being asked to implement code.
 *
 * Group 1 — strong implementation verbs (word-boundary, standalone):
 *   implement, build, code
 *
 * Group 2 — weaker verbs that signal implementation only when followed by
 *   "the" (disambiguating writing/creating/adding from general speech):
 *   write the, add the, create the
 */
const IMPL_VERB_RE = /\b(implement|build|code)\b|\b(write|add|create)\s+the\b/i;

/**
 * Code-ish nouns. Used in conjunction with IMPL_VERB_RE to avoid false
 * positives from non-programming contexts ("build the house", "write the
 * essay"). A prompt must match both a verb AND at least one noun from this
 * list for implementation intent to be detected.
 *
 * Plural forms included via optional trailing 's?' where natural.
 */
const CODE_NOUN_RE =
  /\b(functions?|classes?|components?|modules?|services?|handlers?|routes?|endpoints?|apis?|auth(?:entication|orization)?|features?|flows?|interfaces?|types?|schemas?|hooks?|adapters?|gates?|behaviors?|actions?|middlewares?|stores?|queries|migrations?|commands?|validators?|guards?|decorators?|algorithms?|tests?|configs?|plugins?|rules?|filters?|specs?)\b/i;

/**
 * Patterns that signal the prompt already references a spec artifact.
 * Any one match causes the gate to pass immediately.
 *
 *   \.spec\.md\b  — file extension reference (e.g. "auth.spec.md")
 *   docs\/specs   — directory path reference (e.g. "docs/specs/auth.spec.md")
 *   \bspec\b      — standalone word reference (e.g. "per spec", "the spec file")
 */
const SPEC_REF_RE = /\.spec\.md\b|docs\/specs|\bspec\b/i;

/**
 * Minimum numeric risk order at which the advisory is active (M = 2).
 * T (0) and L (1) are below this floor and always allow.
 */
const WARN_FLOOR = RISK_ORDER["M"];

// ---------------------------------------------------------------------------
// Internal helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Safe RISK_ORDER lookup — RISK_ORDER is exhaustive over RiskClass so the
 * value is always present, but noUncheckedIndexedAccess makes the type
 * `number | undefined`. The non-null assertion is safe here by construction.
 */
function riskOrder(rc: RiskClass): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return RISK_ORDER[rc]!;
}

/**
 * Return true when the prompt contains an implementation-intent verb AND a
 * code-ish noun, indicating the user is requesting code to be written.
 *
 * Both conditions must hold to reduce false positives from phrases like
 * "build the team" (non-code noun) or "write the report" (non-code noun).
 */
export function hasImplIntent(prompt: string): boolean {
  return IMPL_VERB_RE.test(prompt) && CODE_NOUN_RE.test(prompt);
}

/**
 * Return true when the prompt contains a spec reference, indicating the user
 * has acknowledged or pointed to a spec document.
 */
export function hasSpecRef(prompt: string): boolean {
  return SPEC_REF_RE.test(prompt);
}

// ---------------------------------------------------------------------------
// BEH_SPEC_GATE descriptor
// ---------------------------------------------------------------------------

export const BEH_SPEC_GATE: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Active only at the user_prompt gate (prompt-time advisory).
  gates: ["user_prompt"],

  // Synchronous: all checks operate on in-memory prompt content and risk
  // class — no filesystem I/O required.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event, riskClass } = ctx;
    const prompt = event.promptContent ?? "";

    // ── 1. No implementation intent → allow ──────────────────────────────────
    if (!hasImplIntent(prompt)) {
      return {
        decision: "allow",
        reason: "no implementation intent detected — spec-gate not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 2. Risk class below M (T or L) → allow ───────────────────────────────
    // The advisory is not warranted for trivial or low-stakes work.
    if (riskOrder(riskClass) < WARN_FLOOR) {
      return {
        decision: "allow",
        reason: `risk class ${riskClass} is below M — spec-gate advisory not active`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 3. Spec reference present → allow ─────────────────────────────────────
    // The user has already referenced a spec artifact; the gate passes.
    if (hasSpecRef(prompt)) {
      return {
        decision: "allow",
        reason: "spec reference detected in prompt — spec-gate passed",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 4. Implementation intent at M+ without spec reference → warn ──────────
    // Advisory only: surfaces guidance, does not block execution.
    return {
      decision: "warn",
      reason:
        `[${BEHAVIOR_ID}] implementation requested at ${riskClass} without a spec reference` +
        ` — consider a spec first (corpus-spec-driven-development)`,
      behaviorId: BEHAVIOR_ID,
    };
  },
};
