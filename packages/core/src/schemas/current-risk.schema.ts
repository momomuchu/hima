import { z } from "zod";
import { RiskClassSchema } from "./common.js";

export const PromotionHistoryEntrySchema = z
  .object({
    from: RiskClassSchema.optional(),
    to: RiskClassSchema.optional(),
    riskClass: RiskClassSchema.optional(),
    signal: z.string().optional(),
    reason: z.string().optional(),
    source: z.string().optional(),
    ts: z.string().optional(),
    at: z.string().optional(),
  })
  .catchall(z.unknown());

export const CurrentRiskFileSchema = z.object({
  version: z.literal(1),
  run_id: z.string().min(1),
  risk_class: RiskClassSchema,
  rank: z.number().int().min(0).max(4),
  bypass_allowed: z.boolean(),
  human_checkpoint_required: z.boolean(),
  forcing_signals: z.array(z.string()),
  promotion_history: z.array(PromotionHistoryEntrySchema),
  updated_at: z.string().min(1),
});

export type PromotionHistoryEntry = z.infer<typeof PromotionHistoryEntrySchema>;
export type CurrentRiskFile = z.infer<typeof CurrentRiskFileSchema>;
