import { z } from "zod";
import { GateTypeSchema, JsonObjectSchema } from "./common.js";

export const GateEventSchema = z.object({
  gateType: GateTypeSchema,
  toolName: z.string().optional(),
  toolInput: z.unknown().optional(),
  toolOutput: z.unknown().optional(),
  promptContent: z.string().optional(),
  metadata: JsonObjectSchema.optional(),
});

export type GateEvent = z.infer<typeof GateEventSchema>;
