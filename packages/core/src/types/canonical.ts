export const MACRO_CYCLES = [
  "discovery",
  "cadrage",
  "conception",
  "build",
  "validation",
  "release",
  "run",
  "learning",
] as const;

export type MacroCycle = (typeof MACRO_CYCLES)[number];

export const SUB_PHASES = [
  "Observer",
  "Define",
  "Design",
  "Execute",
  "Verify",
  "Capitalize",
  "Transmit",
] as const;

export type SubPhase = (typeof SUB_PHASES)[number];
export const DEFAULT_SUB_PHASE = "Observer" satisfies SubPhase;

export const RISK_CLASSES = ["T", "L", "M", "H", "C"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export const RISK_CLASS_RANK: Record<RiskClass, number> = {
  T: 0,
  L: 1,
  M: 2,
  H: 3,
  C: 4,
};

export function compareRiskClass(a: RiskClass, b: RiskClass): number {
  return RISK_CLASS_RANK[a] - RISK_CLASS_RANK[b];
}

export function riskAtLeast(current: RiskClass, minimum: RiskClass): boolean {
  return compareRiskClass(current, minimum) >= 0;
}

export const OPERATING_MODES = ["bypass", "auto", "pairing"] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export const GATE_TYPES = [
  "session_start",
  "user_prompt",
  "pre_tool",
  "post_tool",
  "stop",
  "subagent_start",
  "subagent_stop",
] as const;

export type GateType = (typeof GATE_TYPES)[number];

export const GATE_DECISIONS = ["allow", "warn", "block"] as const;
export type GateDecision = (typeof GATE_DECISIONS)[number];

export const FINAL_STATES = [
  "DONE_VERIFIED",
  "DONE_WITH_GAPS",
  "BLOCKED_NEEDS_USER",
  "BLOCKED_RUNTIME_MISSING",
  "BLOCKED_POLICY",
  "MAX_ATTEMPTS_REACHED",
  "LOOP_DETECTED",
  "CANCELLED",
] as const;

export type FinalState = (typeof FINAL_STATES)[number];

export const STATE_STATUSES = ["idle", "active", "suspended", "closing", "closed"] as const;
export type StateStatus = (typeof STATE_STATUSES)[number];

export const DEPLOYMENT_STRATEGIES = [
  "direct",
  "canary-10",
  "canary-progressive",
  "canary-with-flag",
] as const;

export type DeploymentStrategy = (typeof DEPLOYMENT_STRATEGIES)[number];

export const EVIDENCE_KEYS = [
  "ci_green",
  "sast_clean",
  "secrets_clean",
  "integration_tests",
  "review_1",
  "sbom",
  "product_validation",
  "e2e_tests",
  "review_2_or_antagonist",
  "adr",
  "threat_model_stride",
  "dast_report",
  "slsa_provenance",
  "aipd",
  "canary_plan",
  "rollback_tested",
  "human_validation",
  "load_tests",
  "independent_security_audit",
  "explicit_human_signature",
  "hook_decision",
  "subagent_output",
  "command_output",
  "files_modified",
  "known_gap",
  "confidence_level",
  "risk_remaining",
] as const;

export type EvidenceKey = (typeof EVIDENCE_KEYS)[number];

export const EVIDENCE_STATUSES = ["candidate", "accepted", "rejected"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export const DEFAULT_EVIDENCE_STATUS = "candidate" satisfies EvidenceStatus;
export const DEFAULT_EVIDENCE_KEY = "command_output" satisfies EvidenceKey;

export const RUNTIME_PROOF_TYPES = [
  "config_read",
  "manifest_digest",
  "dry_run",
  "negative_fixture",
  "event_fire",
  "manual_attestation",
] as const;
export type RuntimeProofType = (typeof RUNTIME_PROOF_TYPES)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export const DEFAULT_CONFIDENCE_LEVEL = "medium" satisfies ConfidenceLevel;

export const CHANGE_TYPES = [
  "feature",
  "fix",
  "refactor",
  "migration",
  "infra",
  "deps",
  "docs",
  "architecture_refactor",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];
export const DEFAULT_CHANGE_TYPE = "feature" satisfies ChangeType;

export const RUNTIME_CAPABILITY_STATUSES = [
  "available",
  "missing",
  "unknown",
  "stale",
  "failed_probe",
] as const;

export type RuntimeCapabilityStatusValue = (typeof RUNTIME_CAPABILITY_STATUSES)[number];
export const DEFAULT_RUNTIME_CAPABILITY_STATUS = "available" satisfies RuntimeCapabilityStatusValue;

export const RUNTIME_BINDING_STATUSES = [
  "native",
  "fallback",
  "missing",
  "stale",
  "noop",
  "capability_unknown",
] as const;

export type RuntimeBindingStatusValue = (typeof RUNTIME_BINDING_STATUSES)[number];
export const MISSING_RUNTIME_BINDING_STATUS = "missing" satisfies RuntimeBindingStatusValue;
