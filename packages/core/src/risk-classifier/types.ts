import type {
  ChangeType,
  DeploymentStrategy,
  OperatingMode,
  RiskClass,
} from "../types/canonical.js";

export type { ChangeType, DeploymentStrategy, OperatingMode, RiskClass };

export interface Changeset {
  files: string[];
  labels: string[];
  changeType: ChangeType;
  diffContent?: string;
  diffLinesNet?: number;
  impactEstimate?: 1 | 2 | 3 | 4 | 5;
  probabilityEstimate?: 1 | 2 | 3 | 4 | 5;
  reposCount?: number;
  ciGreen?: boolean;
  newEndpointExposed?: boolean;
}

export interface ClassificationResult {
  riskClass: RiskClass;
  justification: string;
  activeSignals: ForcingSignal[];
  compositeScore?: number;
  operatingMode: OperatingMode;
  deploymentStrategy: DeploymentStrategy;
  mandatoryActivities: string[];
  bypassEligible: boolean;
  classifiedAt: string;
  proposedBy: "agent" | "developer";
}

export interface ForcingSignal {
  type: "file_path" | "diff_content" | "label" | "structural" | "cross_repo";
  value: string;
  forcedClass: "H" | "C";
}

export interface PromotionResult {
  success: boolean;
  previousClass: RiskClass;
  newClass: RiskClass;
  escalationEntry: EscalationEntry;
  newMandatoryActivities: string[];
  sprintImpact: string | null;
}

export interface EscalationEntry {
  timestamp: string;
  fromClass: RiskClass;
  toClass: RiskClass;
  triggerSignal?: string;
  triggerFile?: string;
  triggerCommit?: string;
  detectedBy: "harness-auto" | "developer" | "agent";
  confirmedBy?: "developer";
  confirmationTimestamp?: string;
  actionsTriggered: string[];
  note?: string;
}

export interface DemotionOptions {
  reason: string;
  authorizedBy: "developer";
  reviewDate: string;
}
