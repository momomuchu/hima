import { z } from "zod";
import { RUNTIME_BINDING_STATUSES, RUNTIME_CAPABILITY_STATUSES } from "../types/canonical.js";
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

export const RuntimeHookCapabilitySchema = z.object({
  gateType: GateTypeSchema,
  nativeEvent: z.string().min(1).nullable(),
  canBlock: z.boolean(),
  status: RuntimeCapabilityStatusSchema,
  inspectedAt: z.string().min(1),
  configDigest: z.string().min(1).optional(),
  notes: z.array(z.string()).optional(),
});

export const RuntimeCapabilitySchema = z.object({
  target: z.string().min(1),
  runtimeName: z.string().min(1),
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
  configDigest: z.string().min(1).optional(),
  reason: z.string().min(1),
});

export const RuntimeCapabilitySetSchema = z.record(z.string(), RuntimeCapabilitySchema);

export const RuntimeBindingSetSchema = z.object({
  activeTarget: z.string().min(1).nullable().optional(),
  gates: z.partialRecord(GateTypeSchema, RuntimeBindingSchema).optional(),
});

export const FinalizationStateSchema = z.union([
  z.literal("ACTIVE"),
  z.literal("BLOCKED"),
  FinalStateSchema,
]);

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
  project: JsonObjectSchema,
  intent: JsonObjectSchema,
  runtimeCapabilities: RuntimeCapabilitySetSchema,
  runtimeBindings: RuntimeBindingSetSchema,
  policy: JsonObjectSchema,
  route: z.object({
    phase: MacroCycleSchema,
    subPhase: SubPhaseSchema,
    mode: OperatingModeSchema,
    riskClass: RiskClassSchema,
  }),
  events: z.array(RunEventSchema),
  evidence: z.array(EvidenceItemSchema),
  subagents: z.array(JsonObjectSchema),
  finalization: z.object({
    state: FinalizationStateSchema,
    gaps: z.array(z.string()),
  }),
});

export type RunEvent = z.infer<typeof RunEventSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type RuntimeCapabilityStatus = z.infer<typeof RuntimeCapabilityStatusSchema>;
export type RuntimeBindingStatus = z.infer<typeof RuntimeBindingStatusSchema>;
export type RuntimeHookCapability = z.infer<typeof RuntimeHookCapabilitySchema>;
export type RuntimeCapability = z.infer<typeof RuntimeCapabilitySchema>;
export type RuntimeBinding = z.infer<typeof RuntimeBindingSchema>;
export type RuntimeCapabilitySet = z.infer<typeof RuntimeCapabilitySetSchema>;
export type RuntimeBindingSet = z.infer<typeof RuntimeBindingSetSchema>;
export type FinalizationState = z.infer<typeof FinalizationStateSchema>;
export type RunSetFile = z.infer<typeof RunSetFileSchema>;
