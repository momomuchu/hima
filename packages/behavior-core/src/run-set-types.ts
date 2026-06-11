// Minimal run-set types needed by behavior-core behaviors
// Derived from packages/core/src/schemas/run-set.schema.ts — only what behaviors consume

import type { GateDecision } from "./types.js";
import type { RiskClass } from "./risk-class.js";

export interface EvidenceItem {
  id: string;
  key: string;
  status?: "candidate" | "accepted" | "rejected";
  claimSource?: "verified" | "inferred" | "external" | "training";
  completionStatus?: "DONE_VERIFIED" | "DONE_UNTESTED" | "ATTEMPTED_UNCONFIRMED";
  createdAt: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SubagentRunRecord {
  id: string;
  role?: string;
  status?: string;
  allowedTools?: string[];
  scope?: string[];
}

export interface LoopDetectorEntry {
  toolName: string;
  argsHash: string;
  resultHash: string;
  ts: string;
}

export interface LoopDetector {
  entries: LoopDetectorEntry[];
  maxEntries: number;
  consecutiveMatchCount: number;
}

export interface RunSetEvent {
  type?: string;
  gateType?: string;
  ts: string;
  decision?: GateDecision;
  payload?: unknown;
}

export interface PolicyConfig {
  behaviorOverrides?: BehaviorOverride[];
  riskPolicies?: Record<string, { mandatoryEvidenceKeys?: string[] }>;
}

export interface BehaviorOverride {
  behaviorId: string;
  mode: "enabled" | "warn-only" | "disabled";
  riskFloorOverride?: RiskClass;
}

export interface RunRoute {
  subPhase?: string;
}

export interface RunSetFile {
  runId: string;
  evidence: EvidenceItem[];
  events: RunSetEvent[];
  subagents: SubagentRunRecord[];
  policy: PolicyConfig;
  route?: RunRoute;
  loopDetector?: LoopDetector;
}

export interface CurrentRiskFile {
  risk_class: RiskClass;
}
