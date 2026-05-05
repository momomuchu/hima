import { z } from "zod";
import {
  RUNTIME_BINDING_STATUSES,
  RUNTIME_CAPABILITY_STATUSES,
  RUNTIME_PROOF_TYPES,
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
    role: OptionalStringSchema,
    runtime: OptionalStringSchema,
    status: SubagentRunStatusSchema.optional(),
    scope: StringArraySchema.optional(),
    startedAt: OptionalStringSchema,
    stoppedAt: OptionalStringSchema,
    evidenceRefs: StringArraySchema.optional(),
    summary: OptionalStringSchema,
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
  metadata: JsonObjectSchema.optional(),
  createdAt: z.string().min(1),
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
