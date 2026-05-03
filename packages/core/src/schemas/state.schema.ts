import { z } from "zod";
import {
  GateTypeSchema,
  MacroCycleSchema,
  OperatingModeSchema,
  StateStatusSchema,
  SubPhaseSchema,
} from "./common.js";

export const PlanningStateFileSchema = z.object({
  version: z.literal(1),
  run_id: z.string().min(1),
  phase: MacroCycleSchema,
  sub_phase: SubPhaseSchema.nullable(),
  mode: OperatingModeSchema,
  active_gates: z.array(GateTypeSchema),
  last_gate_type: GateTypeSchema.nullable(),
  status: StateStatusSchema,
  updated_at: z.string().min(1),
});

export type PlanningStateFile = z.infer<typeof PlanningStateFileSchema>;
