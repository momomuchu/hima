// Ported from packages/core/src/behaviors/beh-013-claim-source.ts — simplified
// Simplification: baseline policy keys hardcoded (no import from baseline-policy)

import type { BehaviorDescriptor, BehaviorVerdict, GateEvaluationContext } from "../behavior-registry.js";
import type { GateEvent } from "../gate-event.js";
import { riskAtLeast, type RiskClass } from "../risk-class.js";

// Minimal mandatory keys per risk class (from baseline-policy.ts)
const MANDATORY_KEYS_BY_RISK: Record<string, string[]> = {
  T: ["ci_green", "sast_clean", "secrets_clean"],
  L: ["ci_green", "sast_clean", "secrets_clean", "integration_tests", "review_1", "sbom"],
  M: ["ci_green", "sast_clean", "secrets_clean", "integration_tests", "review_1", "sbom", "product_validation"],
  H: ["ci_green", "sast_clean", "secrets_clean", "integration_tests", "e2e_tests", "review_2_or_antagonist", "adr", "threat_model_stride", "dast_report", "sbom", "slsa_provenance", "aipd", "canary_plan", "rollback_tested", "human_validation", "load_tests"],
  C: ["ci_green", "sast_clean", "secrets_clean", "integration_tests", "e2e_tests", "review_2_or_antagonist", "adr", "threat_model_stride", "dast_report", "sbom", "slsa_provenance", "aipd", "canary_plan", "rollback_tested", "human_validation", "load_tests", "independent_security_audit", "explicit_human_signature"],
};

function getMandatoryEvidenceKeys(context: GateEvaluationContext): Set<string> {
  const riskClass = context.currentRisk?.risk_class ?? "T";
  const perRunPolicy = context.runSet?.policy?.riskPolicies?.[riskClass];
  if (perRunPolicy?.mandatoryEvidenceKeys && perRunPolicy.mandatoryEvidenceKeys.length > 0) {
    return new Set(perRunPolicy.mandatoryEvidenceKeys);
  }
  return new Set(MANDATORY_KEYS_BY_RISK[riskClass] ?? []);
}

export const claimSource: BehaviorDescriptor = {
  id: "BEH-013",
  name: "Calibrated Uncertainty — Claim Source Field",
  gates: ["stop"],

  classify(context: GateEvaluationContext, _event: GateEvent): BehaviorVerdict {
    const evidence = context.runSet?.evidence ?? [];
    const riskClass = (context.currentRisk?.risk_class ?? "T") as RiskClass;

    if (!riskAtLeast(riskClass, "M")) return null;

    const missingClaimSource = evidence.filter((item) => item.claimSource === undefined);
    if (missingClaimSource.length > 0) {
      return {
        decision: "block",
        reason: `BEH-013: ${missingClaimSource.length} evidence item(s) are missing the claimSource field. Every EvidenceRecord must declare its epistemic origin: "verified", "inferred", "external", or "training".`,
        violationType: "DONE_WITHOUT_EVIDENCE",
        qualityDimension: "evidence",
      };
    }

    const mandatoryKeys = getMandatoryEvidenceKeys(context);
    if (mandatoryKeys.size === 0) return null;

    const verifiedByKey = new Map<string, boolean>();
    for (const key of mandatoryKeys) verifiedByKey.set(key, false);
    for (const item of evidence) {
      if (mandatoryKeys.has(item.key) && item.claimSource === "verified") {
        verifiedByKey.set(item.key, true);
      }
    }

    const unverifiedKeys = [...verifiedByKey.entries()].filter(([, v]) => !v).map(([k]) => k);
    if (unverifiedKeys.length === 0) return null;

    return {
      decision: "block",
      reason: `BEH-013: Mandatory evidence key(s) have no "verified" claim source: [${unverifiedKeys.join(", ")}]. At risk class ${riskClass}, each mandatory key requires at least one EvidenceRecord with claimSource: "verified".`,
      violationType: "DONE_WITHOUT_EVIDENCE",
      qualityDimension: "evidence",
      finalState: "BLOCKED_POLICY",
    };
  },
};
