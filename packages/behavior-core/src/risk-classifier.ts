// Ported from packages/core/src/risk-classifier/index.ts — no logic changes
// Simplification: inlined maxRiskClass (was in risk-rank.ts)

import { compareRiskClass, maxRiskClass, riskAtLeast, RISK_CLASSES } from "./risk-class.js";
import type { RiskClass } from "./risk-class.js";

export type { RiskClass };
export { compareRiskClass };

export type ChangeType =
  | "feature"
  | "fix"
  | "refactor"
  | "migration"
  | "infra"
  | "deps"
  | "docs"
  | "architecture_refactor";

export type OperatingMode = "bypass" | "auto" | "pairing" | "full-bypass" | "checkpoint" | "explicit";

export type DeploymentStrategy = "direct" | "canary-10" | "canary-progressive" | "canary-with-flag";

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

export interface ForcingSignal {
  type: "file_path" | "diff_content" | "label" | "structural" | "cross_repo";
  value: string;
  forcedClass: "H" | "C";
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

const DETERMINISTIC_CLASSIFIED_AT = "1970-01-01T00:00:00.000Z";

const HIGH_FILE_PATTERNS = [
  /(^|\/)auth(\/|$)/,
  /(^|\/)authorization(\/|$)/,
  /(^|\/)sessions(\/|$)/,
  /(^|\/)oauth(\/|$)/,
  /(^|\/)sso(\/|$)/,
  /(^|\/)payments(\/|$)/,
  /(^|\/)billing(\/|$)/,
  /(^|\/)invoices(\/|$)/,
  /(^|\/)subscriptions(\/|$)/,
  /(^|\/)migrations(\/|$)/,
  /\.migration\.ts$/,
  /\.sql$/,
  /(^|\/)api\/public(\/|$)/,
  /(^|\/)openapi\.ya?ml$/,
  /(^|\/)swagger\.json$/,
  /\.proto$/,
  /(^|\/)infra(\/|$)/,
  /(^|\/)terraform(\/|$)/,
  /(^|\/)k8s(\/|$)/,
  /(^|\/)docker-compose\.prod[^/]*$/,
  /(^|\/)\.env[^/]*$/,
  /(^|\/)config\/security[^/]*$/,
  /(^|\/)secrets(\/|$)/,
] as const;

const CRITICAL_FILE_PATTERNS = [
  /(^|\/)health(\/|$)/,
  /(^|\/)biometric(\/|$)/,
  /(^|\/)medical(\/|$)/,
] as const;

const HIGH_LABELS = new Set([
  "auth", "authentication", "authorization", "payment", "billing", "stripe", "pci",
  "migration", "schema-change", "api-breaking", "breaking-change", "pii", "gdpr",
  "privacy", "infra-prod", "infrastructure",
]);

const CRITICAL_LABELS = new Set([
  "health-data", "biometric", "hipaa", "regulatory", "nis2", "eaa", "dora-financial",
  "arch-refactor", "architecture", "multi-service", "cross-repo",
]);

const HIGH_DIFF_PATTERNS = [
  /\bCREATE\s+TABLE\b/i,
  /\bALTER\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bADD\s+COLUMN\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /^\+\s*[^+\n]*(password|secret|api_key|private_key)\s*[:=]\s*["'][^"'\s]+["']/im,
  /^\+\s*[^+\n]*\b(email|phone|ssn|address|user_id)\b\s*[:?=]/im,
] as const;

const CRITICAL_DIFF_PATTERNS = [
  /\bhealth_data\b/,
  /\bbiometric\b/,
  /\bfinancial_regulated\b/,
] as const;

const MANDATORY_ACTIVITIES: Record<RiskClass, string[]> = {
  T: ["risk_classification", "unit_tests", "sast", "secrets_scan", "quality_gates_ci"],
  L: ["risk_classification", "unit_tests", "integration_tests", "sast", "secrets_scan", "code_review_1", "quality_gates_ci", "rollback_plan"],
  M: ["risk_classification", "formal_dor", "privacy_accessibility_impact", "unit_tests", "integration_tests", "sast", "secrets_scan", "code_review_1", "quality_gates_ci", "acceptance_validation", "rollback_plan", "active_slo_monitoring"],
  H: ["problem_validation", "user_interviews_jtbd", "risk_classification", "formal_dor", "privacy_accessibility_impact", "adr", "threat_model_stride", "unit_tests", "integration_tests", "e2e_critical", "sast", "dast", "secrets_scan", "sbom", "artifact_sign", "code_review_2", "human_approval", "feature_flag", "rollback_plan_tested", "canary_progressive"],
  C: ["problem_validation", "user_interviews_jtbd", "risk_classification", "formal_dor", "privacy_accessibility_impact", "adr", "threat_model_stride", "threat_model_linddun", "aipd", "unit_tests", "integration_tests", "e2e_critical", "sast", "dast", "secrets_scan", "sbom", "artifact_sign", "code_review_2", "security_audit", "load_tests", "human_approval_signed", "feature_flag", "rollback_plan_repeated", "stakeholder_communication", "postmortem_template"],
};

export class RiskClassificationError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_DEMOTION" | "UNAUTHORIZED_DEMOTION" | "FORCING_SIGNAL_ACTIVE" | "CLASS_SKIP_NOT_ALLOWED" | "BYPASS_FORBIDDEN",
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RiskClassificationError";
  }
}

export function classifyRisk(changeset: Changeset): ClassificationResult {
  const activeSignals = scanForForcingSignals(changeset.files, changeset.diffContent, changeset.labels, changeset);
  const forcedClass = maxRiskClass(activeSignals.map((s) => s.forcedClass));
  const compositeScore = getImpactEstimate(changeset) * getProbabilityEstimate(changeset);
  const calculatedClass = classFromCompositeScore(compositeScore);
  const structuralMinimum = getStructuralMinimum(changeset);
  const riskClass = maxRiskClass([forcedClass, calculatedClass, structuralMinimum]);

  return {
    riskClass,
    justification: buildJustification(riskClass, activeSignals, compositeScore, structuralMinimum),
    activeSignals,
    compositeScore,
    operatingMode: getOperatingMode(riskClass),
    deploymentStrategy: getDeploymentStrategy(riskClass),
    mandatoryActivities: getMandatoryActivities(riskClass),
    bypassEligible: isBypassEligible(riskClass, changeset),
    classifiedAt: DETERMINISTIC_CLASSIFIED_AT,
    proposedBy: "agent",
  };
}

export function promoteRisk(
  current: RiskClass,
  target: RiskClass,
  reason: string,
  triggerContext?: { signal?: string; file?: string; commit?: string },
): PromotionResult {
  if (compareRiskClass(target, current) <= 0) {
    throw new RiskClassificationError("Promotion target must be higher than current class.", "INVALID_DEMOTION", { current, target });
  }

  const escalationEntry: EscalationEntry = {
    timestamp: DETERMINISTIC_CLASSIFIED_AT,
    fromClass: current,
    toClass: target,
    triggerSignal: triggerContext?.signal,
    triggerFile: triggerContext?.file,
    triggerCommit: triggerContext?.commit,
    detectedBy: "agent",
    actionsTriggered: getMandatoryActivities(target),
    note: reason,
  };

  return {
    success: true,
    previousClass: current,
    newClass: target,
    escalationEntry,
    newMandatoryActivities: getMandatoryActivities(target),
    sprintImpact: target === "H" || target === "C" ? "additional mandatory H-risk controls activated" : null,
  };
}

export function demoteRisk(
  current: RiskClass,
  target: RiskClass,
  options: DemotionOptions,
  activeSignals: ForcingSignal[],
): PromotionResult {
  if (compareRiskClass(target, current) >= 0) {
    throw new RiskClassificationError("Demotion target must be lower than current class.", "INVALID_DEMOTION", { current, target });
  }

  if (activeSignals.some((s) => riskAtLeast(s.forcedClass, target))) {
    throw new RiskClassificationError("Cannot demote while an incompatible forcing signal is active.", "FORCING_SIGNAL_ACTIVE", { activeSignals, target });
  }

  if (!isAllowedDemotion(current, target)) {
    throw new RiskClassificationError("Requested demotion is not allowed by the risk policy.", "UNAUTHORIZED_DEMOTION", { current, target });
  }

  const currentRank = RISK_CLASSES.indexOf(current);
  const targetRank = RISK_CLASSES.indexOf(target);
  if (currentRank - targetRank > 1) {
    throw new RiskClassificationError("Demotion cannot skip a risk class.", "CLASS_SKIP_NOT_ALLOWED", { current, target });
  }

  const escalationEntry: EscalationEntry = {
    timestamp: DETERMINISTIC_CLASSIFIED_AT,
    fromClass: current,
    toClass: target,
    detectedBy: "developer",
    confirmedBy: options.authorizedBy,
    confirmationTimestamp: DETERMINISTIC_CLASSIFIED_AT,
    actionsTriggered: getMandatoryActivities(target),
    note: `${options.reason}; review_date=${options.reviewDate}`,
  };

  return { success: true, previousClass: current, newClass: target, escalationEntry, newMandatoryActivities: getMandatoryActivities(target), sprintImpact: null };
}

export function isBypassEligible(riskClass: RiskClass, changeset: Changeset): boolean {
  if (riskClass === "T") return true;
  if (riskClass !== "L") return false;

  const activeSignals = scanForForcingSignals(changeset.files, changeset.diffContent, changeset.labels, changeset);
  return (
    changeset.ciGreen === true &&
    activeSignals.every((s) => compareRiskClass(s.forcedClass, "H") < 0) &&
    (changeset.diffLinesNet ?? 0) <= 100 &&
    !hasSensitiveBypassPath(changeset.files) &&
    changeset.newEndpointExposed !== true
  );
}

export function getOperatingMode(riskClass: RiskClass): OperatingMode {
  if (riskClass === "T") return "bypass";
  if (riskClass === "C") return "pairing";
  return "auto";
}

export function getDeploymentStrategy(riskClass: RiskClass): DeploymentStrategy {
  switch (riskClass) {
    case "T": case "L": return "direct";
    case "M": return "canary-10";
    case "H": return "canary-progressive";
    case "C": return "canary-with-flag";
  }
}

export function getMandatoryActivities(riskClass: RiskClass): string[] {
  return [...MANDATORY_ACTIVITIES[riskClass]];
}

export function scanForForcingSignals(
  files: string[],
  diffContent = "",
  labels: string[] = [],
  changeset?: Pick<Changeset, "changeType" | "reposCount" | "diffLinesNet">,
): ForcingSignal[] {
  const signals: ForcingSignal[] = [];

  for (const file of files.map(normalizePath)) {
    if (CRITICAL_FILE_PATTERNS.some((p) => p.test(file))) {
      signals.push({ type: "file_path", value: file, forcedClass: "C" });
    } else if (HIGH_FILE_PATTERNS.some((p) => p.test(file))) {
      signals.push({ type: "file_path", value: file, forcedClass: "H" });
    }
  }

  for (const label of labels.map((l) => l.toLowerCase())) {
    if (CRITICAL_LABELS.has(label)) {
      signals.push({ type: "label", value: label, forcedClass: "C" });
    } else if (HIGH_LABELS.has(label)) {
      signals.push({ type: "label", value: label, forcedClass: "H" });
    }
  }

  for (const pattern of CRITICAL_DIFF_PATTERNS) {
    const match = diffContent.match(pattern);
    if (match?.[0]) signals.push({ type: "diff_content", value: match[0], forcedClass: "C" });
  }

  for (const pattern of HIGH_DIFF_PATTERNS) {
    const match = diffContent.match(pattern);
    if (match?.[0]) signals.push({ type: "diff_content", value: match[0].trim(), forcedClass: "H" });
  }

  if ((changeset?.reposCount ?? 0) >= 2) {
    signals.push({ type: "cross_repo", value: String(changeset?.reposCount), forcedClass: "C" });
  }

  if (changeset?.changeType === "architecture_refactor") {
    signals.push({ type: "structural", value: changeset.changeType, forcedClass: "C" });
  }

  return signals;
}

function classFromCompositeScore(score: number): RiskClass {
  if (score <= 2) return "T";
  if (score <= 5) return "L";
  if (score <= 10) return "M";
  if (score <= 17) return "H";
  return "C";
}

function getImpactEstimate(changeset: Changeset): 1 | 2 | 3 | 4 | 5 {
  if (changeset.impactEstimate) return changeset.impactEstimate;
  switch (changeset.changeType) {
    case "docs": return 1;
    case "deps": case "fix": case "refactor": return 2;
    case "feature": return 3;
    case "migration": case "infra": return 4;
    case "architecture_refactor": return 5;
  }
}

function getProbabilityEstimate(changeset: Changeset): 1 | 2 | 3 | 4 | 5 {
  if (changeset.probabilityEstimate) return changeset.probabilityEstimate;
  switch (changeset.changeType) {
    case "docs": return 1;
    case "fix": case "deps": return 2;
    case "refactor": case "feature": return 3;
    case "migration": case "infra": case "architecture_refactor": return 4;
  }
}

function getStructuralMinimum(changeset: Changeset): RiskClass {
  if ((changeset.diffLinesNet ?? 0) > 300) return "M";
  return "T";
}

function buildJustification(riskClass: RiskClass, activeSignals: ForcingSignal[], compositeScore: number, structuralMinimum: RiskClass): string {
  if (activeSignals.length > 0) {
    const highestSignal = maxRiskClass(activeSignals.map((s) => s.forcedClass));
    return `${riskClass}: forced at least ${highestSignal} by ${activeSignals.length} active signal(s).`;
  }
  if (structuralMinimum !== "T") {
    return `${riskClass}: composite score ${compositeScore} with structural minimum ${structuralMinimum}.`;
  }
  return `${riskClass}: composite score ${compositeScore}.`;
}

function hasSensitiveBypassPath(files: string[]): boolean {
  return files.map(normalizePath).some((f) => HIGH_FILE_PATTERNS.some((p) => p.test(f)));
}

function isAllowedDemotion(current: RiskClass, target: RiskClass): boolean {
  return (
    (current === "L" && target === "T") ||
    (current === "M" && target === "L") ||
    (current === "H" && target === "M") ||
    (current === "C" && target === "H")
  );
}

function normalizePath(p: string): string {
  return p.replaceAll("\\", "/").replace(/^\.?\//, "").toLowerCase();
}
