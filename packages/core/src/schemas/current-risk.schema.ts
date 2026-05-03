import { z } from "zod";
import { RiskClassSchema } from "./common.js";

export const CurrentRiskFileSchema = z.object({
  version: z.literal(1),
  run_id: z.string().min(1),
  risk_class: RiskClassSchema,
  rank: z.number().int().min(0).max(4),
  bypass_allowed: z.boolean(),
  human_checkpoint_required: z.boolean(),
  forcing_signals: z.array(z.string()),
  promotion_history: z.array(z.record(z.string(), z.unknown())),
  updated_at: z.string().min(1),
});

export type CurrentRiskFile = z.infer<typeof CurrentRiskFileSchema>;
