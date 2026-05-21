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

export const LAYERED_EVIDENCE_GATE_STAGES = Object.freeze([
  "eval_suite",
  "held_out_split",
  "suite_promotion",
] as const);

export type LayeredEvidenceGateStage = (typeof LAYERED_EVIDENCE_GATE_STAGES)[number];

export interface LayeredEvidenceGateStageResult {
  readonly stage: LayeredEvidenceGateStage;
  readonly passed: boolean;
  readonly acceptedEvidenceIds: string[];
  readonly presentEvidenceKeys: EvidenceKey[];
  readonly missingEvidenceKeys: EvidenceKey[];
  readonly suiteNames: string[];
  readonly promotionTargets: string[];
  readonly blockedByPreviousStage?: LayeredEvidenceGateStage;
}

export interface LayeredEvidenceGateOptions {
  readonly requiredStages?: readonly LayeredEvidenceGateStage[];
  readonly requiredEvidenceKeysByStage?: Partial<
    Record<LayeredEvidenceGateStage, readonly EvidenceKey[]>
  >;
}

export interface LayeredEvidenceGateEvaluation {
  readonly sufficient: boolean;
  readonly readyForPromotion: boolean;
  readonly requiredStages: LayeredEvidenceGateStage[];
  readonly completedStages: LayeredEvidenceGateStage[];
  readonly missingStages: LayeredEvidenceGateStage[];
  readonly stageResults: LayeredEvidenceGateStageResult[];
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

export function isLayeredEvidenceGateStage(value: unknown): value is LayeredEvidenceGateStage {
  return (
    typeof value === "string" &&
    LAYERED_EVIDENCE_GATE_STAGES.includes(value as LayeredEvidenceGateStage)
  );
}

export function getEvidenceGateStage(item: EvidenceItem): LayeredEvidenceGateStage | undefined {
  const stage = getMetadataString(item, "evidenceGateStage", "evidence_gate_stage");
  return isLayeredEvidenceGateStage(stage) ? stage : undefined;
}

export function evaluateLayeredEvidenceGate(
  evidence: readonly EvidenceItem[],
  options: LayeredEvidenceGateOptions = {},
): LayeredEvidenceGateEvaluation {
  const requiredStages = [...(options.requiredStages ?? LAYERED_EVIDENCE_GATE_STAGES)];
  const acceptedEvidence = evidence.filter(
    (item) => item.status === "accepted" && isTrustedHumanEvidence(item),
  );
  const completedStages: LayeredEvidenceGateStage[] = [];
  const missingStages: LayeredEvidenceGateStage[] = [];
  let firstMissingStage: LayeredEvidenceGateStage | undefined;

  const stageResults = requiredStages.map((stage) => {
    const stageEvidence = acceptedEvidence.filter((item) => getEvidenceGateStage(item) === stage);
    const presentEvidenceKeys = [...new Set(stageEvidence.map((item) => item.key))];
    const requiredEvidenceKeys = options.requiredEvidenceKeysByStage?.[stage] ?? [];
    const present = new Set(presentEvidenceKeys);
    const missingEvidenceKeys = requiredEvidenceKeys.filter((key) => !present.has(key));
    const passed = stageEvidence.length > 0 && missingEvidenceKeys.length === 0;

    if (passed && !firstMissingStage) {
      completedStages.push(stage);
    } else {
      missingStages.push(stage);
      firstMissingStage ??= stage;
    }

    return {
      stage,
      passed,
      acceptedEvidenceIds: stageEvidence.map((item) => item.id),
      presentEvidenceKeys,
      missingEvidenceKeys,
      suiteNames: uniqueMetadataStrings(stageEvidence, "suiteName", "suite_name"),
      promotionTargets: uniqueMetadataStrings(stageEvidence, "promotionTarget", "promotion_target"),
      ...(firstMissingStage && firstMissingStage !== stage
        ? { blockedByPreviousStage: firstMissingStage }
        : {}),
    } satisfies LayeredEvidenceGateStageResult;
  });

  const sufficient = missingStages.length === 0;
  const readyForPromotion =
    sufficient && requiredStages.includes("suite_promotion" satisfies LayeredEvidenceGateStage);

  return {
    sufficient,
    readyForPromotion,
    requiredStages,
    completedStages,
    missingStages,
    stageResults,
    reason: sufficient
      ? "Layered evidence gate sufficient for local proof"
      : `Layered evidence gate missing stages: ${missingStages.join(", ")}`,
  };
}

function getMetadataString(
  item: EvidenceItem,
  camelCaseKey: string,
  snakeCaseKey: string,
): string | undefined {
  const metadata = item.metadata;
  if (!metadata) {
    return undefined;
  }

  const raw = metadata[camelCaseKey] ?? metadata[snakeCaseKey];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

function uniqueMetadataStrings(
  evidence: readonly EvidenceItem[],
  camelCaseKey: string,
  snakeCaseKey: string,
): string[] {
  return [
    ...new Set(
      evidence
        .map((item) => getMetadataString(item, camelCaseKey, snakeCaseKey))
        .filter((value): value is string => value !== undefined),
    ),
  ];
}
