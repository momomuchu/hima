/**
 * BEH-013 — Calibrated Uncertainty / Claim Source Field
 *
 * Every EvidenceRecord written to the Evidence Set must include a claimSource field
 * declaring the epistemic origin of the claim. At risk class M and above, the stop
 * gate requires at least one "verified" evidence item per mandatory evidence key.
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-013
 * Gate: stop
 * Risk floor: M (warn below, block at/above)
 *
 * Signal channels used:
 *   - evidence_state : context.runSet.evidence — iterates EvidenceItem.claimSource
 *     against mandatory evidence keys for the current riskClass
 *
 * NEVER reads event.toolOutput or event.promptContent as raw text.
 */

import type { BehaviorDescriptor, BehaviorVerdict } from "../gates/behavior-registry.js";
import type { GateEvaluationContext } from "../gates/evaluate-gate.js";
import { RISK_POLICY } from "../policy/baseline-policy.js";
import type { GateEvent } from "../schemas/gate-event.schema.js";
import { riskAtLeast } from "../types/canonical.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the set of evidence keys that are mandatory for the current risk class.
 *
 * Fix B2: source mandatory keys from the canonical RISK_POLICY baseline (imported
 * from baseline-policy.ts) rather than the optional per-run policy.riskPolicies
 * override. In the common case the override is absent (riskPolicies is an optional
 * field per run-set.schema.ts:296), so reading it exclusively meant this check
 * always returned an empty set and silently abstained.
 *
 * The per-run riskPolicies override (if present) takes precedence so that
 * operators can extend or narrow the baseline for specific runs.
 */
function getMandatoryEvidenceKeys(context: GateEvaluationContext): Set<string> {
  const riskClass = context.currentRisk?.risk_class ?? "T";

  // Check for a per-run riskPolicies override first (may add or replace keys).
  const riskPolicies = context.runSet?.policy?.riskPolicies;
  const perRunPolicy = (
    riskPolicies as Record<string, { mandatoryEvidenceKeys?: string[] }> | undefined
  )?.[riskClass];
  if (perRunPolicy?.mandatoryEvidenceKeys && perRunPolicy.mandatoryEvidenceKeys.length > 0) {
    return new Set(perRunPolicy.mandatoryEvidenceKeys);
  }

  // Fall back to the canonical baseline RISK_POLICY — always present for all risk classes.
  const baselinePolicy = RISK_POLICY[riskClass as keyof typeof RISK_POLICY];
  if (!baselinePolicy) {
    return new Set();
  }
  return new Set(baselinePolicy.mandatoryEvidenceKeys);
}

// ── BehaviorDescriptor ────────────────────────────────────────────────────────

export const claimSource: BehaviorDescriptor = {
  id: "BEH-013",
  name: "Calibrated Uncertainty — Claim Source Field",
  gates: ["stop"],

  classify(context: GateEvaluationContext, _event: GateEvent): BehaviorVerdict {
    // Signal: evidence_state — examine EvidenceItems in run-set
    const evidence = context.runSet?.evidence ?? [];

    // Risk floor: M — abstain entirely for T and L (backwards-compatible with
    // existing evidence records written before claimSource was introduced).
    const riskClass = context.currentRisk?.risk_class ?? "T";
    if (!riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "M")) {
      return null;
    }

    // First pass: at M+, any EvidenceItem that is missing the claimSource field is a gap.
    const missingClaimSource = evidence.filter((item) => item.claimSource === undefined);
    if (missingClaimSource.length > 0) {
      const isBlock = riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "M");
      return {
        decision: isBlock ? "block" : "warn",
        reason: `BEH-013: ${missingClaimSource.length} evidence item(s) are missing the claimSource field. Every EvidenceRecord must declare its epistemic origin: "verified", "inferred", "external", or "training".`,
        violationType: "DONE_WITHOUT_EVIDENCE",
        qualityDimension: "evidence",
      };
    }

    // Second pass: for risk class M and above, every mandatory key must have at least
    // one record with claimSource: "verified".

    const mandatoryKeys = getMandatoryEvidenceKeys(context);
    if (mandatoryKeys.size === 0) {
      return null; // No mandatory keys configured — abstain
    }

    // Build a map: key → has at least one "verified" record
    const verifiedByKey = new Map<string, boolean>();
    for (const key of mandatoryKeys) {
      verifiedByKey.set(key, false);
    }
    for (const item of evidence) {
      if (mandatoryKeys.has(item.key) && item.claimSource === "verified") {
        verifiedByKey.set(item.key, true);
      }
    }

    const unverifiedKeys = [...verifiedByKey.entries()]
      .filter(([, verified]) => !verified)
      .map(([key]) => key);

    if (unverifiedKeys.length === 0) {
      return null;
    }

    const isBlock = riskAtLeast(riskClass as import("../types/canonical.js").RiskClass, "M");

    return {
      decision: isBlock ? "block" : "warn",
      reason: `BEH-013: Mandatory evidence key(s) have no "verified" claim source: [${unverifiedKeys.join(", ")}]. At risk class ${riskClass}, each mandatory key requires at least one EvidenceRecord with claimSource: "verified" (produced by a Read or Grep tool call against a file on disk this session).`,
      violationType: "DONE_WITHOUT_EVIDENCE",
      qualityDimension: "evidence",
      finalState: "BLOCKED_POLICY",
    };
  },
};
