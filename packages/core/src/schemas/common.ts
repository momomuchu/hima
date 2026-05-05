import { z } from "zod";
import {
  CHANGE_TYPES,
  CONFIDENCE_LEVELS,
  EVIDENCE_KEYS,
  EVIDENCE_STATUSES,
  FINAL_STATES,
  GATE_DECISIONS,
  GATE_TYPES,
  MACRO_CYCLES,
  OPERATING_MODES,
  RISK_CLASSES,
  RUNTIME_PROOF_TYPES,
  STATE_STATUSES,
  SUB_PHASES,
} from "../types/canonical.js";

export const MacroCycleSchema = z.enum(MACRO_CYCLES);
export const SubPhaseSchema = z.enum(SUB_PHASES);
export const RiskClassSchema = z.enum(RISK_CLASSES);
export const OperatingModeSchema = z.enum(OPERATING_MODES);
export const GateTypeSchema = z.enum(GATE_TYPES);
export const FinalStateSchema = z.enum(FINAL_STATES);
export const StateStatusSchema = z.enum(STATE_STATUSES);
export const EvidenceKeySchema = z.enum(EVIDENCE_KEYS);
export const GateDecisionSchema = z.enum(GATE_DECISIONS);
export const EvidenceStatusSchema = z.enum(EVIDENCE_STATUSES);
export const ConfidenceLevelSchema = z.enum(CONFIDENCE_LEVELS);
export const ChangeTypeSchema = z.enum(CHANGE_TYPES);
export const RuntimeProofTypeSchema = z.enum(RUNTIME_PROOF_TYPES);

export const JsonObjectSchema = z.record(z.string(), z.unknown());
