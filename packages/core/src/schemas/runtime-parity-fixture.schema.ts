import { z } from "zod";
import { RUNTIME_TARGETS } from "../runtime/runtime-profiles.js";
import {
  EVIDENCE_KEYS,
  GATE_TYPES,
  MACRO_CYCLES,
  OPERATING_MODES,
  RISK_CLASSES,
  SUB_PHASES,
} from "../types/canonical.js";

export const RuntimeParityFixtureScopeSchema = z.literal("synthetic_not_real_runtime");

export const RuntimeParityGovernanceFieldsSchema = z.object({
  riskClass: z.enum(RISK_CLASSES),
  operatingMode: z.enum(OPERATING_MODES),
  macroCycle: z.enum(MACRO_CYCLES),
  subPhase: z.enum(SUB_PHASES),
  activeGate: z.enum(GATE_TYPES),
  requiredEvidenceKeys: z.array(z.enum(EVIDENCE_KEYS)).min(1),
  ledgerHashAlgorithm: z.literal("sha256"),
  ledgerEntryKind: z.literal("governance_event"),
  evidenceAnchorKind: z.literal("local_artifact_path"),
  policyBoundary: z.literal("fixture_only_no_runtime_execution"),
});

export const RuntimeParityFixtureSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("synthetic-runtime-parity-fixture"),
  fixtureScope: RuntimeParityFixtureScopeSchema,
  runtimeTarget: z.enum(RUNTIME_TARGETS),
  sessionId: z.string().min(1),
  createdAt: z.string().min(1),
  governance: RuntimeParityGovernanceFieldsSchema,
  externalSessionsLaunched: z.literal(false),
});

export type RuntimeParityFixtureScope = z.infer<typeof RuntimeParityFixtureScopeSchema>;
export type RuntimeParityGovernanceFields = z.infer<typeof RuntimeParityGovernanceFieldsSchema>;
export type RuntimeParityFixture = z.infer<typeof RuntimeParityFixtureSchema>;

export function parseRuntimeParityFixture(input: unknown): RuntimeParityFixture {
  return RuntimeParityFixtureSchema.parse(input);
}
