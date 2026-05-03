import type {
  DeploymentStrategy,
  EvidenceKey,
  GateType,
  OperatingMode,
  RiskClass,
} from "../types/canonical.js";

export const BASE_GATES = [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "stop",
] as const satisfies readonly GateType[];

export const DELEGATION_GATES = [
  "subagent_start",
  "subagent_stop",
] as const satisfies readonly GateType[];

export interface RiskPolicy {
  readonly allowedModes: readonly OperatingMode[];
  readonly bypassAllowed: boolean;
  readonly mandatoryEvidenceKeys: readonly EvidenceKey[];
  readonly mandatoryEvidenceAlternatives?: readonly MandatoryEvidenceAlternative[];
  readonly requiredApprovals: number;
  readonly deploymentStrategy: DeploymentStrategy;
  readonly requiresEvidenceBeforeStop: boolean;
  readonly requiresHumanCheckpoint: boolean;
  readonly requiresSubagentGatesWhenDelegating: boolean;
}

export interface MandatoryEvidenceAlternative {
  readonly requiredKey: EvidenceKey;
  readonly acceptedAlternativeKeys: readonly EvidenceKey[];
}

export const RISK_POLICY: Record<RiskClass, RiskPolicy> = {
  T: {
    allowedModes: ["bypass", "auto", "pairing"],
    bypassAllowed: true,
    mandatoryEvidenceKeys: ["ci_green", "sast_clean", "secrets_clean"],
    requiredApprovals: 0,
    deploymentStrategy: "direct",
    requiresEvidenceBeforeStop: false,
    requiresHumanCheckpoint: false,
    requiresSubagentGatesWhenDelegating: false,
  },
  L: {
    allowedModes: ["bypass", "auto", "pairing"],
    bypassAllowed: true,
    mandatoryEvidenceKeys: [
      "ci_green",
      "sast_clean",
      "secrets_clean",
      "integration_tests",
      "review_1",
      "sbom",
    ],
    requiredApprovals: 1,
    deploymentStrategy: "direct",
    requiresEvidenceBeforeStop: false,
    requiresHumanCheckpoint: false,
    requiresSubagentGatesWhenDelegating: false,
  },
  M: {
    allowedModes: ["auto", "pairing"],
    bypassAllowed: false,
    mandatoryEvidenceKeys: [
      "ci_green",
      "sast_clean",
      "secrets_clean",
      "integration_tests",
      "review_1",
      "sbom",
      "product_validation",
    ],
    requiredApprovals: 1,
    deploymentStrategy: "canary-10",
    requiresEvidenceBeforeStop: true,
    requiresHumanCheckpoint: false,
    requiresSubagentGatesWhenDelegating: true,
  },
  H: {
    allowedModes: ["auto", "pairing"],
    bypassAllowed: false,
    mandatoryEvidenceKeys: [
      "ci_green",
      "sast_clean",
      "secrets_clean",
      "integration_tests",
      "e2e_tests",
      "review_2_or_antagonist",
      "adr",
      "threat_model_stride",
      "dast_report",
      "sbom",
      "slsa_provenance",
      "aipd",
      "canary_plan",
      "rollback_tested",
      "human_validation",
      "load_tests",
    ],
    requiredApprovals: 2,
    deploymentStrategy: "canary-progressive",
    requiresEvidenceBeforeStop: true,
    requiresHumanCheckpoint: true,
    mandatoryEvidenceAlternatives: [
      {
        requiredKey: "human_validation",
        acceptedAlternativeKeys: ["explicit_human_signature"],
      },
    ],
    requiresSubagentGatesWhenDelegating: true,
  },
  C: {
    allowedModes: ["auto", "pairing"],
    bypassAllowed: false,
    mandatoryEvidenceKeys: [
      "ci_green",
      "sast_clean",
      "secrets_clean",
      "integration_tests",
      "e2e_tests",
      "review_2_or_antagonist",
      "adr",
      "threat_model_stride",
      "dast_report",
      "sbom",
      "slsa_provenance",
      "aipd",
      "canary_plan",
      "rollback_tested",
      "human_validation",
      "load_tests",
      "independent_security_audit",
      "explicit_human_signature",
    ],
    requiredApprovals: 2,
    deploymentStrategy: "canary-with-flag",
    requiresEvidenceBeforeStop: true,
    requiresHumanCheckpoint: true,
    mandatoryEvidenceAlternatives: [
      {
        requiredKey: "human_validation",
        acceptedAlternativeKeys: ["explicit_human_signature"],
      },
    ],
    requiresSubagentGatesWhenDelegating: true,
  },
};

export function getRequiredGates(
  riskClass: RiskClass,
  options: { delegationPlanned?: boolean } = {},
): GateType[] {
  const policy = RISK_POLICY[riskClass];

  if (policy.requiresSubagentGatesWhenDelegating && options.delegationPlanned) {
    return [...BASE_GATES, ...DELEGATION_GATES];
  }

  return [...BASE_GATES];
}
