import type { GateType } from "../types/canonical.js";

export const AI_SLOP_CLEANER_EVIDENCE_ANCHOR =
  "docs/excellence-application/05-architecture/stream-g-harvested-skill-wave.md#harvest-target";

export const AI_SLOP_CLEANER_FINDING_IDS = [
  "missing_cleanup_plan",
  "missing_regression_evidence",
] as const;

export type AiSlopCleanerFindingId = (typeof AI_SLOP_CLEANER_FINDING_IDS)[number];

export interface AiSlopCleanerFinding {
  readonly id: AiSlopCleanerFindingId;
  readonly message: string;
}

export interface AiSlopCleanerInput {
  readonly gateType?: GateType;
  readonly parts: readonly unknown[];
  /**
   * BEH-000 — Action-signal guard.
   *
   * When provided and false, the cleanup trigger is suppressed even if the
   * keyword pattern matches in the text of `parts`. This closes the false-positive
   * trap: an agent that merely *discusses* cleanup work in output text does not
   * trigger the enforcement unless a qualifying file-write action actually occurred.
   *
   * Callers that know a WRITE_MUTATION action was performed for cleanup work must
   * set this to true. Callers that cannot determine write status should omit the
   * field (undefined), which preserves the legacy keyword-only path for backwards
   * compatibility in contexts where no ActionSignal is available (e.g. subagent_stop
   * without write evidence in metadata).
   *
   * The inverse guarantee is preserved: a real qualifying write WITH keyword AND
   * without evidence still fires (qualifyingWriteOccurred=true + keyword present +
   * missing evidence → violation).
   */
  readonly qualifyingWriteOccurred?: boolean;
}

export interface AiSlopCleanerEvaluation {
  readonly cleanupTriggered: boolean;
  readonly accepted: boolean;
  readonly findings: readonly AiSlopCleanerFinding[];
  readonly evidenceAnchors: readonly string[];
}

const CLEANUP_TRIGGER_PATTERN =
  /\b(?:ai[-_\s]?slop|deslop|de[-_\s]?slop|cleanup|cleanup_plan|clean[-_\s]?up|anti[-_\s]?slop|slop[-_\s]?cleaner|slop[-_\s]?cleanup)\b/i;

const CLEANUP_PLAN_PATTERN =
  /\b(?:cleanup_plan|cleanup[\s_-]+plan|smell[-_\s]+focused[\s_-]+cleanup[\s_-]+plan)\b/i;

const REGRESSION_EVIDENCE_PATTERN =
  /\b(?:regression_evidence|regression[\s_-]+evidence|unchanged[-_\s]+behavior[\s_-]+evidence|tests?[\s_-]+(?:pass|passed|green)|regression[\s_-]+tests?[\s_-]+(?:pass|passed|green))\b/i;

export function evaluateAiSlopCleaner(input: AiSlopCleanerInput): AiSlopCleanerEvaluation {
  const haystack = input.parts.map(stringifyUnknown).filter(Boolean).join("\n");
  const keywordPresent = CLEANUP_TRIGGER_PATTERN.test(haystack);

  // BEH-000 action-signal guard: keyword in output text alone is not sufficient
  // to trigger enforcement when the caller explicitly signals no write occurred.
  // qualifyingWriteOccurred=false → suppress trigger regardless of keyword.
  // qualifyingWriteOccurred=true  → keyword + write → trigger (genuine case).
  // qualifyingWriteOccurred=undefined → legacy path: keyword alone triggers
  //   (preserves backwards compat for call sites without ActionSignal context).
  const cleanupTriggered = keywordPresent && input.qualifyingWriteOccurred !== false;

  if (!cleanupTriggered) {
    return {
      cleanupTriggered: false,
      accepted: true,
      findings: [],
      evidenceAnchors: [AI_SLOP_CLEANER_EVIDENCE_ANCHOR],
    };
  }

  const findings: AiSlopCleanerFinding[] = [];

  if (!CLEANUP_PLAN_PATTERN.test(haystack)) {
    findings.push({
      id: "missing_cleanup_plan",
      message: "Cleanup/deslop work must include a smell-focused cleanup plan.",
    });
  }

  if (!REGRESSION_EVIDENCE_PATTERN.test(haystack)) {
    findings.push({
      id: "missing_regression_evidence",
      message:
        "Cleanup/deslop work must include regression evidence or explicit unchanged-behavior evidence.",
    });
  }

  return {
    cleanupTriggered: true,
    accepted: findings.length === 0,
    findings,
    evidenceAnchors:
      findings.length > 0
        ? findings.map((finding) => `${AI_SLOP_CLEANER_EVIDENCE_ANCHOR}:${finding.id}`)
        : [AI_SLOP_CLEANER_EVIDENCE_ANCHOR],
  };
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
