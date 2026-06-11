// @hima/behavior-core — public API
// Registers all behaviors on import (side-effect via behaviors/index.ts)

// Types
export type { RiskClass } from "./risk-class.js";
export {
  RISK_CLASSES,
  RISK_CLASS_RANK,
  isRiskClass,
  parseRiskClass,
  compareRiskClass,
  riskAtLeast,
  maxRiskClass,
} from "./risk-class.js";

export type { GateType, GateDecision, FinalState, QualityDimension, CompletionStatus } from "./types.js";

export type { GateEvent } from "./gate-event.js";

export type {
  EvidenceItem,
  SubagentRunRecord,
  LoopDetectorEntry,
  LoopDetector,
  RunSetEvent,
  PolicyConfig,
  BehaviorOverride,
  RunSetFile,
  CurrentRiskFile,
} from "./run-set-types.js";

// Risk classifier
export {
  classifyRisk,
  promoteRisk,
  demoteRisk,
  scanForForcingSignals,
  isBypassEligible,
  getOperatingMode,
  getDeploymentStrategy,
  getMandatoryActivities,
  RiskClassificationError,
} from "./risk-classifier.js";
export type {
  Changeset,
  ClassificationResult,
  ForcingSignal,
  PromotionResult,
  EscalationEntry,
  DemotionOptions,
  ChangeType,
  OperatingMode,
  DeploymentStrategy,
} from "./risk-classifier.js";

// Path utils
export { normalizePath, canonicalProjectPath } from "./canonical-path.js";

// Action signal
export {
  classifyToolName,
  extractTargetPath,
  hashContent,
  detectSuppressionWithoutJustification,
  estimateLineDelta,
} from "./action-signal.js";
export type { SemanticClass, ZoneCompliance, ActionSignal } from "./action-signal.js";

// Behavior registry
export {
  registerBehavior,
  getBehaviorsForGate,
  getAllBehaviors,
  evaluateBehaviors,
  evaluateBehaviorsWithOverrides,
} from "./behavior-registry.js";
export type {
  BehaviorDescriptor,
  BehaviorVerdict,
  GateResult,
  GateEvaluationContext,
  GateViolationType,
  BehaviorVerdictWithMeta,
} from "./behavior-registry.js";

// Override resolution
export { resolveOverride, getCatalogRiskFloor } from "./behavior-override.js";
export type { OverrideResolution } from "./behavior-override.js";

// All 12 behaviors (also triggers registration via side-effect)
export * from "./behaviors/index.js";

// Simplified ledger (sha256 hash-chain, no ed25519)
export {
  appendLedgerEntry,
  readLedger,
  verifyLedgerChain,
  sha256Hex,
  getLedgerPath,
  GENESIS_HASH,
} from "./ledger.js";
export type { LedgerEntry } from "./ledger.js";
