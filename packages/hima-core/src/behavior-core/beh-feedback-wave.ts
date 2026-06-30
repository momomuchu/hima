/**
 * BEH_FEEDBACK_WAVE — Feedback-wave-detect advisory gate (R-016).
 *
 * At every user_prompt gate, when the incoming prompt contains BOTH an
 * artifact-signal token AND an evaluative/negative token AND the effective
 * risk class is H or C, this behavior emits an advisory warn recommending
 * a multi-agent feedback wave (corpus-ui-knowledge / corpus-* per dimension).
 *
 * Matching rules (Path 1 — full trigger):
 *   1. riskClass < H (T, L, M)            → allow (advisory not warranted).
 *   2. No promptContent                    → allow.
 *   3. Zero artifact-signal token matches  → allow.
 *   4. Zero evaluative-language matches    → allow.
 *   5. ≥1 artifact token AND ≥1 evaluative token at H/C → warn.
 *
 * Token matching is case-insensitive and partial (substring) — "cassée"
 * matches token "cassé"; "l'animation" matches token "l'animat".
 *
 * This behavior is ADVISORY (warn), never block. It enriches the agent's
 * context with a prompt to launch specialist feedback lanes without halting.
 *
 * violationType: n/a (advisory — warn never carries violationType)
 * gates:         ["user_prompt"]
 *
 * See: .planning/architecture/V3-COMPLETENESS-AUDIT.md R-016,
 *      BEHAVIOR-CATALOG-v3.md §1 S-15,
 *      founder-feedback-scale.md §1 (Path 1 trigger definition).
 */

import type { BehaviorDescriptor, BehaviorContext, BehaviorVerdict } from "./types.js";
import { RISK_ORDER } from "@hima/schemas";
import type { RiskClass } from "@hima/schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BEHAVIOR_ID = "BEH-FEEDBACK-WAVE";

/**
 * Numeric threshold — H and above (H=3, C=4) trigger the wave advisory.
 * M and below (T=0, L=1, M=2) are skipped: cost of a wave is not warranted
 * at lower criticality.
 */
const H_FLOOR = RISK_ORDER["H"];

// ---------------------------------------------------------------------------
// Token lists — exported for external inspection and test assertions
// ---------------------------------------------------------------------------

/**
 * Artifact-signal tokens sourced from founder-feedback-scale.md §1.
 *
 * A prompt must contain at least one of these tokens (case-insensitive,
 * partial/substring match) to qualify as referring to a concrete artifact.
 * Extend this list via a PR to agent-runtime#11.
 */
export const ARTIFACT_TOKENS: ReadonlyArray<string> = [
  "la landing",
  "le dashboard",
  "le hero",
  "l'animation",
  "l'animat",
  "ce composant",
  "le cta",
  "l'onboarding",
  "ce bouton",
  "le header",
  "le footer",
  "la nav",
  "le modal",
  "la page",
  "ce layout",
  "cette vue",
  "l'interface",
  "ce design",
  "ce schéma",
  "ce plan",
  "cet output",
  "ce résultat",
  "ce code",
  "cette implémentation",
  "la feature",
  "le flow",
  "ce formulaire",
  "l'écran",
  "ce ticket",
  "ce bug",
  "l'erreur",
  "ce crash",
  "la sidebar",
  "le menu",
  "cette couleur",
  "ce padding",
  "ce spacing",
  "cette typo",
  "ce copy",
] as const;

/**
 * Evaluative/negative language tokens sourced from founder-feedback-scale.md §1.
 *
 * A prompt must contain at least one of these tokens (case-insensitive,
 * partial/substring match) alongside an artifact token to trigger the wave
 * advisory. Extend this list via a PR to agent-runtime#11.
 */
export const EVALUATIVE_TOKENS: ReadonlyArray<string> = [
  "c'est pas bien",
  "il manque",
  "refaire",
  "trop lent",
  "trop rapide",
  "trop grand",
  "trop petit",
  "pas assez",
  "wrong",
  "fix",
  "bad",
  "weak",
  "improve",
  "c'est nul",
  "ça marche pas",
  "pas bon",
  "incorrect",
  "broken",
  "cassé",
  "plante",
  "bug",
  "erreur",
  "faible",
  "générique",
  "pauvre",
  "insuffisant",
  "à revoir",
  "à refaire",
  "mauvais",
  "raté",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the numeric ordering for a risk class.
 * Safe: RISK_ORDER is exhaustive; non-null assertion is correct by construction.
 */
function riskOrder(rc: RiskClass): number {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return RISK_ORDER[rc]!;
}

/**
 * Return the first matching artifact-signal token found in the prompt,
 * or null when none matches.
 *
 * Case-insensitive substring match ("cassée" matches token "cassé").
 */
export function findArtifactToken(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  for (const token of ARTIFACT_TOKENS) {
    if (lower.includes(token.toLowerCase())) {
      return token;
    }
  }
  return null;
}

/**
 * Return the first matching evaluative/negative token found in the prompt,
 * or null when none matches.
 *
 * Case-insensitive substring match.
 */
export function findEvaluativeToken(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  for (const token of EVALUATIVE_TOKENS) {
    if (lower.includes(token.toLowerCase())) {
      return token;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// BEH_FEEDBACK_WAVE descriptor
// ---------------------------------------------------------------------------

export const BEH_FEEDBACK_WAVE: BehaviorDescriptor = {
  id: BEHAVIOR_ID,

  // Fires only at the user_prompt gate.
  gates: ["user_prompt"],

  // Synchronous: all checks operate on in-memory prompt content and risk class.
  evaluate(ctx: BehaviorContext): BehaviorVerdict {
    const { event, riskClass } = ctx;

    // ── 1. riskClass below H → allow (advisory not warranted at low stakes) ──
    if (riskOrder(riskClass) < H_FLOOR) {
      return {
        decision: "allow",
        reason: `riskClass "${riskClass}" is below H — feedback-wave advisory not warranted`,
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 2. No promptContent → allow (nothing to scan) ─────────────────────
    const prompt = event.promptContent;
    if (prompt === undefined || prompt.trim() === "") {
      return {
        decision: "allow",
        reason: "no promptContent to scan — feedback-wave gate not applicable",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 3. No artifact-signal token → allow (no concrete artifact in scope) ─
    const artifactHit = findArtifactToken(prompt);
    if (artifactHit === null) {
      return {
        decision: "allow",
        reason:
          "[founder-feedback-scale] evaluated — NOT triggered. Reason: no artifact-signal token",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 4. No evaluative language → allow (no negative signal) ────────────
    const evaluativeHit = findEvaluativeToken(prompt);
    if (evaluativeHit === null) {
      return {
        decision: "allow",
        reason:
          "[founder-feedback-scale] evaluated — NOT triggered. Reason: no evaluative language",
        behaviorId: BEHAVIOR_ID,
      };
    }

    // ── 5. Both signals at H/C → warn with wave-launch advisory ───────────
    return {
      decision: "warn",
      reason:
        `[BEH-FEEDBACK-WAVE] founder feedback on an artifact detected ` +
        `(artifact: "${artifactHit}", evaluative: "${evaluativeHit}") — ` +
        `consider a multi-agent feedback wave (corpus-ui-knowledge / corpus-* per dimension). ` +
        `Decompose into specialist lanes: palette/a11y · layout · animation · copy · UX-flow. ` +
        `See founder-feedback-scale.md §2 for lane decomposition table.`,
      behaviorId: BEHAVIOR_ID,
    };
  },
};
