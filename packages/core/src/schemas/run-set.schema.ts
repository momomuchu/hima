import { z } from "zod";
import {
  CLAIM_SOURCES,
  COMPLETION_STATUSES,
  FAILURE_POLICY_ACTIONS,
  RUNTIME_BINDING_STATUSES,
  RUNTIME_CAPABILITY_STATUSES,
  RUNTIME_PROOF_TYPES,
  SUBAGENT_ROLES,
} from "../types/canonical.js";
import {
  EvidenceKeySchema,
  EvidenceStatusSchema,
  FinalStateSchema,
  GateDecisionSchema,
  GateTypeSchema,
  JsonObjectSchema,
  MacroCycleSchema,
  OperatingModeSchema,
  RiskClassSchema,
  SubPhaseSchema,
} from "./common.js";

// ── BEH-W4: Behavior override + observability types ──────────────────────────

/**
 * Per-run override for an individual behavior (BEH-NNN).
 * Lives at run-set.json#/policy/behaviorOverrides[].
 * Design: .planning/behavior-system/gate-config-and-observability-design.md §2.2
 */
export const BehaviorOverrideSchema = z.object({
  /** BEH-NNN identifier from 12-behaviors-catalog-spec.md */
  behaviorId: z.string().regex(/^BEH-[0-9]{3}$/),
  /**
   * Enforcement mode for this behavior in the current run.
   * "enabled"   — full enforcement (default)
   * "warn-only" — verdict capped at "warn"; gate never hard-blocks on this behavior
   * "disabled"  — behavior does not fire for enforcement (still emits GATE_DECISION record)
   */
  mode: z.enum(["enabled", "warn-only", "disabled"]),
  /**
   * Optional override of the behavior's risk_floor for this run only.
   * Can only raise the floor (make behavior stricter), never lower it.
   * Lowering produces OVERRIDE_FORBIDDEN_FLOOR_REDUCTION.
   */
  riskFloorOverride: RiskClassSchema.optional(),
  /** Human-readable justification. Required for mode != "enabled". */
  justification: z.string().min(10),
  /** ISO 8601 timestamp when this override was added. */
  addedAt: z.string().min(1),
  /** Who added this override. */
  addedBy: z.enum(["developer", "gate"]),
});

/**
 * Signal record within a GateDecisionRecord: one channel read during the decision.
 */
export const SignalRecordSchema = z.object({
  channel: z.enum(["tool_type", "tool_args", "file_diff", "evidence_state", "prompt_pattern"]),
  /** Compact description of the value read. Never the raw bytes. */
  summary: z.string(),
  /** Whether this signal was the deciding factor for the verdict. */
  deciding: z.boolean(),
});

/**
 * Structured gate-decision record emitted for every gate evaluation.
 * Appended to run-set.json#/events[] as type: "GATE_DECISION".
 * Design: .planning/behavior-system/gate-config-and-observability-design.md §3.2
 */
export const GateDecisionRecordSchema = z.object({
  type: z.literal("GATE_DECISION"),
  ts: z.string().min(1),
  runId: z.string().min(1),
  gateType: GateTypeSchema,
  /** BEH-NNN identifier, or null for structural checks not tied to a catalog behavior. */
  behaviorId: z
    .string()
    .regex(/^BEH-[0-9]{3}$/)
    .nullable(),
  classifierMethod: z
    .enum(["tool_type", "tool_args", "file_diff", "evidence_state", "prompt_pattern", "composite"])
    .nullable(),
  signalsRead: z.array(SignalRecordSchema),
  verdict: GateDecisionSchema,
  /** ViolationType if verdict is warn/block; null on allow. */
  violationType: z.string().nullable(),
  /**
   * Structured references to files, lines, or evidence keys.
   * Format: "path/to/file.ts:42" or "run-set.json#/evidence/ci_green"
   */
  evidenceRefs: z.array(z.string()),
  /** Human-readable explanation. minLength: 10 enforces non-opaque blocks. */
  why: z.string().min(10),
  /** Actionable resolution steps on block. Required when verdict is "block". */
  resolution: z.array(z.string()).optional(),
  riskClass: RiskClassSchema,
  phase: MacroCycleSchema,
  subPhase: SubPhaseSchema,
  /** Whether a behaviorOverride was active for this behaviorId at decision time. */
  overrideActive: z.boolean(),
  /** Mode applied if overrideActive is true. */
  overrideMode: z.enum(["warn-only", "disabled"]).optional(),
});

/**
 * Per-behavior SLI snapshot written to run-set.json#/policy/sliSnapshot at stop gate.
 * Design: .planning/behavior-system/gate-config-and-observability-design.md §3.6
 */
export const BehaviorSliSnapshotSchema = z.object({
  behaviorId: z.string().regex(/^BEH-[0-9]{3}$/),
  windowRuns: z.number().int().nonnegative(),
  totalDecisions: z.number().int().nonnegative(),
  blockCount: z.number().int().nonnegative(),
  warnCount: z.number().int().nonnegative(),
  allowCount: z.number().int().nonnegative(),
  /** Developer-acknowledged false positives: explicitly disabled via override. */
  overrideDisabledCount: z.number().int().nonnegative(),
  overrideWarnOnlyCount: z.number().int().nonnegative(),
  /** 0.0–1.0 */
  blockRate: z.number().min(0).max(1),
  /** 0.0–1.0 */
  falsePositiveRate: z.number().min(0).max(1),
  snapshotAt: z.string().min(1),
});

// BEH-013 — epistemic origin of a claim written into the Evidence Set.
export const ClaimSourceSchema = z.enum(CLAIM_SOURCES);

// BEH-023 — three-value completion status on EvidenceRecord items.
export const CompletionStatusSchema = z.enum(COMPLETION_STATUSES);

// BEH-031 — typed role vocabulary for SubagentRunRecord.
export const SubagentRoleSchema = z.enum(SUBAGENT_ROLES);

// BEH-030 — budget and failure-policy schemas for SubagentInput contract.
export const SubagentBudgetSchema = z.object({
  /** Maximum number of turns the subagent may run (required at M+). */
  maxTurns: z.number().int().positive().optional(),
  /** Wall-clock timeout in milliseconds (required at H/C). */
  timeoutMs: z.number().int().positive().optional(),
});

export const SubagentFailurePolicySchema = z.object({
  /** Action on timeout: gap (record gap), retry, or block parent. */
  onTimeout: z.enum(FAILURE_POLICY_ACTIONS).optional(),
  /** Action on error: gap, retry, or block parent. */
  onError: z.enum(FAILURE_POLICY_ACTIONS).optional(),
  /** Max retries when onError or onTimeout is "retry". */
  maxRetries: z.number().int().nonnegative().optional(),
});

export const RuntimeCapabilityStatusSchema = z.enum(RUNTIME_CAPABILITY_STATUSES);

export const RuntimeBindingStatusSchema = z.enum(RUNTIME_BINDING_STATUSES);

export const RuntimeProofTypeSchema = z.enum(RUNTIME_PROOF_TYPES);

export const RuntimeProbeEvidenceSchema = z.object({
  type: RuntimeProofTypeSchema,
  status: EvidenceStatusSchema,
  observedAt: z.string().min(1).optional(),
  detail: z.string().min(1).optional(),
  verifier: z.string().min(1).optional(),
  target: z.string().min(1).optional(),
  runtimeVersion: z.string().min(1).optional(),
  gateType: GateTypeSchema.optional(),
  configDigest: z.string().min(1).optional(),
  result: z.string().min(1).optional(),
  proofDigest: z.string().min(1).optional(),
});

export const RuntimeHookCapabilityInputSchema = z.object({
  nativeEvent: z.string().min(1).nullable().optional(),
  canBlock: z.boolean().optional(),
  status: RuntimeCapabilityStatusSchema.optional(),
  configDigest: z.string().min(1).optional(),
  proofs: z.array(RuntimeProbeEvidenceSchema).optional(),
  notes: z.array(z.string()).optional(),
});

export const RuntimeHooksInputSchema = z.partialRecord(
  GateTypeSchema,
  RuntimeHookCapabilityInputSchema,
);

export const RuntimeHookCapabilitySchema = z.object({
  gateType: GateTypeSchema,
  nativeEvent: z.string().min(1).nullable(),
  canBlock: z.boolean(),
  status: RuntimeCapabilityStatusSchema,
  inspectedAt: z.string().min(1),
  configDigest: z.string().min(1).optional(),
  proofs: z.array(RuntimeProbeEvidenceSchema).optional(),
  notes: z.array(z.string()).optional(),
});

export const RuntimeCapabilitySchema = z.object({
  target: z.string().min(1),
  runtimeName: z.string().min(1),
  runtimeVersion: z.string().min(1).optional(),
  status: RuntimeCapabilityStatusSchema,
  inspectedAt: z.string().min(1),
  configDigest: z.string().min(1).optional(),
  hooks: z.partialRecord(GateTypeSchema, RuntimeHookCapabilitySchema),
  knownLimitations: z.array(z.string()),
});

export const RuntimeBindingSchema = z.object({
  gateType: GateTypeSchema,
  target: z.string().min(1),
  status: RuntimeBindingStatusSchema,
  nativeEvent: z.string().min(1).nullable(),
  canBlock: z.boolean(),
  inspectedAt: z.string().min(1).nullable(),
  runtimeVersion: z.string().min(1).optional(),
  configDigest: z.string().min(1).optional(),
  reason: z.string().min(1),
});

export const RuntimeCapabilitySetSchema = z.record(z.string(), RuntimeCapabilitySchema);

export const RuntimeBindingSetSchema = z
  .object({
    activeTarget: z.string().min(1).nullable().optional(),
    gates: z.partialRecord(GateTypeSchema, RuntimeBindingSchema).optional(),
  })
  .catchall(z.unknown());

export const FinalizationStateSchema = z.union([
  z.literal("ACTIVE"),
  z.literal("BLOCKED"),
  FinalStateSchema,
]);

const OptionalStringSchema = z.string().nullable().optional();

const StringArraySchema = z.array(z.string());

export const ProjectRepoPathsSchema = z
  .object({
    root: OptionalStringSchema,
    planning: z.literal(".planning").optional(),
  })
  .catchall(z.unknown());

export const ProjectSetSchema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    projectId: OptionalStringSchema,
    name: OptionalStringSchema,
    repoPaths: ProjectRepoPathsSchema.optional(),
    tags: StringArraySchema.optional(),
    updatedAt: OptionalStringSchema,
  })
  .catchall(z.unknown());

export const IntentSetSchema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    rawPrompt: OptionalStringSchema,
    objective: OptionalStringSchema,
    interpretedObjective: OptionalStringSchema,
    inScope: StringArraySchema.optional(),
    notInScope: StringArraySchema.optional(),
    assumptions: StringArraySchema.optional(),
    ambiguities: StringArraySchema.optional(),
    deliverables: StringArraySchema.optional(),
    plannedCycles: z.array(MacroCycleSchema).optional(),
    initialRiskClass: RiskClassSchema.optional(),
    effectiveRiskClass: RiskClassSchema.optional(),
    authorizedAutonomy: OperatingModeSchema.optional(),
    capturedAt: OptionalStringSchema,
    updatedAt: OptionalStringSchema,
  })
  .catchall(z.unknown());

export const RiskPolicyOverrideSchema = z
  .object({
    bypassAllowed: z.boolean().optional(),
    humanCheckpointRequired: z.boolean().optional(),
    mandatoryEvidenceKeys: z.array(EvidenceKeySchema).optional(),
    requiredGates: z.array(GateTypeSchema).optional(),
  })
  .catchall(z.unknown());

export const GatePolicyOverrideSchema = z
  .object({
    canBlock: z.boolean().optional(),
    enforcement: z.enum(["allow", "warn", "block", "observe"]).optional(),
    requiredEvidenceKeys: z.array(EvidenceKeySchema).optional(),
  })
  .catchall(z.unknown());

export const PolicySetSchema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    globalRules: StringArraySchema.optional(),
    riskPolicies: z.partialRecord(RiskClassSchema, RiskPolicyOverrideSchema).optional(),
    gatePolicies: z.partialRecord(GateTypeSchema, GatePolicyOverrideSchema).optional(),
    updatedAt: OptionalStringSchema,
    /**
     * Per-run overrides for individual behaviors (BEH-NNN).
     * Absent entry = "enabled" at catalog default.
     * Design: .planning/behavior-system/gate-config-and-observability-design.md §2.2
     */
    behaviorOverrides: z.array(BehaviorOverrideSchema).optional(),
    /**
     * Per-behavior SLI snapshot written at stop gate.
     * Design: .planning/behavior-system/gate-config-and-observability-design.md §3.6
     */
    sliSnapshot: z.array(BehaviorSliSnapshotSchema).optional(),
  })
  .catchall(z.unknown());

export const SubagentRunStatusSchema = z.enum([
  "planned",
  "requested",
  "running",
  "completed",
  "failed",
  "blocked",
  "cancelled",
]);

export const SubagentRunRecordSchema = z
  .object({
    agentId: z.string().min(1),
    /** BEH-031 — "watcher" added to role vocabulary for H/C observability. */
    role: z.union([SubagentRoleSchema, z.string()]).nullable().optional(),
    runtime: OptionalStringSchema,
    status: SubagentRunStatusSchema.optional(),
    scope: StringArraySchema.optional(),
    deliverables: StringArraySchema.optional(),
    startedAt: OptionalStringSchema,
    stoppedAt: OptionalStringSchema,
    evidenceRefs: StringArraySchema.optional(),
    summary: OptionalStringSchema,
    /** BEH-030 — budget constraining subagent run length (required at M+). */
    budget: SubagentBudgetSchema.optional(),
    /** BEH-030 — failure recovery policy for timeout/error outcomes (required at M+). */
    failurePolicy: SubagentFailurePolicySchema.optional(),
    metadata: JsonObjectSchema.optional(),
  })
  .catchall(z.unknown());

export const RunEventSchema = z.object({
  id: z.string().min(1),
  ts: z.string().min(1),
  type: z.string().min(1),
  gateType: GateTypeSchema.optional(),
  decision: GateDecisionSchema.optional(),
  reason: z.string().optional(),
  payload: JsonObjectSchema.optional(),
});

export const EvidenceItemSchema = z.object({
  id: z.string().min(1),
  key: EvidenceKeySchema,
  kind: z.string().min(1),
  status: EvidenceStatusSchema,
  summary: z.string().min(1),
  source: z.enum(["agent", "human", "ci", "hook", "system"]).optional(),
  /** BEH-013 — epistemic origin of this claim (verified = read from disk this session). */
  claimSource: ClaimSourceSchema.optional(),
  /** BEH-023 — three-value completion status; stop gate checks for non-DONE_VERIFIED at H/C. */
  completionStatus: CompletionStatusSchema.optional(),
  metadata: JsonObjectSchema.optional(),
  createdAt: z.string().min(1),
});

// BEH-022 — sliding-window loop detector ring-buffer section persisted in run-set.json.
export const LoopDetectorEntrySchema = z.object({
  /** Name of the tool that was invoked. */
  toolName: z.string().min(1),
  /** Stable content hash of the tool input arguments (JSON-canonical SHA-256). */
  argsHash: z.string().min(1),
  /** Stable content hash of the tool output (JSON-canonical SHA-256). */
  resultHash: z.string().min(1),
  /** ISO-8601 timestamp of the event. */
  ts: z.string().min(1),
});

export const LoopDetectorSchema = z.object({
  /** Bounded ring buffer of the last N (toolName, argsHash, resultHash) triples. */
  entries: z.array(LoopDetectorEntrySchema),
  /** Maximum number of entries retained in the ring buffer (default 10). */
  maxEntries: z.number().int().positive().optional(),
  /** Number of consecutive identical triples observed in the current window. */
  consecutiveMatchCount: z.number().int().nonnegative().optional(),
});

// BEH-032 — abort report record written when CYCLE_ABORT is triggered.
export const AbortReportSchema = z.object({
  runId: z.string().min(1),
  ts: z.string().min(1),
  triggeredBy: z.enum(["human", "gate", "policy"]),
  reason: z.string().min(1),
  /** Last up-to-10 loop-detector ring-buffer entries at time of abort. */
  lastActionSignals: z.array(z.unknown()).optional(),
});

export const RunSetFileSchema = z.object({
  version: z.literal(1),
  runId: z.string().min(1),
  project: ProjectSetSchema,
  intent: IntentSetSchema,
  runtimeCapabilities: RuntimeCapabilitySetSchema,
  runtimeBindings: RuntimeBindingSetSchema,
  policy: PolicySetSchema,
  route: z.object({
    phase: MacroCycleSchema,
    subPhase: SubPhaseSchema,
    mode: OperatingModeSchema,
    riskClass: RiskClassSchema,
  }),
  events: z.array(RunEventSchema),
  evidence: z.array(EvidenceItemSchema),
  subagents: z.array(SubagentRunRecordSchema),
  finalization: z.object({
    state: FinalizationStateSchema,
    gaps: z.array(z.string()),
  }),
  /** BEH-022 — loop detector ring buffer; persisted across context compaction events. */
  loopDetector: LoopDetectorSchema.optional(),
  /** BEH-032 — abort reports written when CYCLE_ABORT is triggered. */
  abortReports: z.array(AbortReportSchema).optional(),
});

export type RunEvent = z.infer<typeof RunEventSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type ProjectSet = z.infer<typeof ProjectSetSchema>;
export type IntentSet = z.infer<typeof IntentSetSchema>;
export type PolicySet = z.infer<typeof PolicySetSchema>;
export type SubagentRunStatus = z.infer<typeof SubagentRunStatusSchema>;
export type SubagentRunRecord = z.infer<typeof SubagentRunRecordSchema>;
export type RuntimeCapabilityStatus = z.infer<typeof RuntimeCapabilityStatusSchema>;
export type RuntimeBindingStatus = z.infer<typeof RuntimeBindingStatusSchema>;
export type RuntimeProbeEvidence = z.infer<typeof RuntimeProbeEvidenceSchema>;
export type RuntimeHookCapabilityInput = z.infer<typeof RuntimeHookCapabilityInputSchema>;
export type RuntimeHookCapability = z.infer<typeof RuntimeHookCapabilitySchema>;
export type RuntimeCapability = z.infer<typeof RuntimeCapabilitySchema>;
export type RuntimeBinding = z.infer<typeof RuntimeBindingSchema>;
export type RuntimeCapabilitySet = z.infer<typeof RuntimeCapabilitySetSchema>;
export type RuntimeBindingSet = z.infer<typeof RuntimeBindingSetSchema>;
export type FinalizationState = z.infer<typeof FinalizationStateSchema>;
export type RunSetFile = z.infer<typeof RunSetFileSchema>;
// BEH-013
export type ClaimSource = z.infer<typeof ClaimSourceSchema>;
// BEH-023
export type CompletionStatus = z.infer<typeof CompletionStatusSchema>;
// BEH-030
export type SubagentBudget = z.infer<typeof SubagentBudgetSchema>;
export type SubagentFailurePolicy = z.infer<typeof SubagentFailurePolicySchema>;
// BEH-031
export type SubagentRole = z.infer<typeof SubagentRoleSchema>;
// BEH-022
export type LoopDetectorEntry = z.infer<typeof LoopDetectorEntrySchema>;
export type LoopDetector = z.infer<typeof LoopDetectorSchema>;
// BEH-032
export type AbortReport = z.infer<typeof AbortReportSchema>;
// BEH-W4 — behavior override + observability
export type BehaviorOverride = z.infer<typeof BehaviorOverrideSchema>;
export type SignalRecord = z.infer<typeof SignalRecordSchema>;
export type GateDecisionRecord = z.infer<typeof GateDecisionRecordSchema>;
export type BehaviorSliSnapshot = z.infer<typeof BehaviorSliSnapshotSchema>;
