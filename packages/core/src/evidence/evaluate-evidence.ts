import { RISK_POLICY } from "../policy/baseline-policy.js";
import type { EvidenceItem } from "../schemas/run-set.schema.js";
import type { EvidenceKey, RiskClass } from "../types/canonical.js";

const HUMAN_ONLY_EVIDENCE_KEYS = new Set<EvidenceKey>([
  "human_validation",
  "explicit_human_signature",
]);

export interface EvidenceSufficiency {
  readonly sufficient: boolean;
  readonly riskClass: RiskClass;
  readonly presentEvidenceKeys: EvidenceKey[];
  readonly missingEvidenceKeys: EvidenceKey[];
  readonly reason: string;
}

export function isHumanOnlyEvidenceKey(key: EvidenceKey): boolean {
  return HUMAN_ONLY_EVIDENCE_KEYS.has(key);
}

export function isTrustedHumanEvidence(item: EvidenceItem): boolean {
  if (!isHumanOnlyEvidenceKey(item.key)) {
    return true;
  }

  return item.source === "human" || item.metadata?.verifiedHuman === true;
}

export function getAcceptedEvidenceKeys(evidence: readonly EvidenceItem[]): EvidenceKey[] {
  return [
    ...new Set(
      evidence
        .filter((item) => item.status === "accepted" && isTrustedHumanEvidence(item))
        .map((item) => item.key),
    ),
  ];
}

export function isEvidenceSufficient(
  evidence: readonly EvidenceItem[],
  riskClass: RiskClass,
): EvidenceSufficiency {
  const presentEvidenceKeys = getAcceptedEvidenceKeys(evidence);
  const policy = RISK_POLICY[riskClass];
  const required = policy.mandatoryEvidenceKeys;
  const present = new Set(presentEvidenceKeys);
  const missingEvidenceKeys = required.filter(
    (key) => !present.has(key) && !hasAcceptedAlternative(key, present, policy),
  );

  return {
    sufficient: missingEvidenceKeys.length === 0,
    riskClass,
    presentEvidenceKeys,
    missingEvidenceKeys,
    reason:
      missingEvidenceKeys.length === 0
        ? `Evidence Set sufficient for risk ${riskClass}`
        : `Evidence Set missing for risk ${riskClass}: ${missingEvidenceKeys.join(", ")}`,
  };
}

function hasAcceptedAlternative(
  requiredKey: EvidenceKey,
  present: ReadonlySet<EvidenceKey>,
  policy: (typeof RISK_POLICY)[RiskClass],
): boolean {
  const alternative = policy.mandatoryEvidenceAlternatives?.find(
    (entry) => entry.requiredKey === requiredKey,
  );

  return alternative?.acceptedAlternativeKeys.some((key) => present.has(key)) ?? false;
}
