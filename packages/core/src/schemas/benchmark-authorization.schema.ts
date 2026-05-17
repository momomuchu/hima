import { z } from "zod";
import { RUNTIME_TARGETS } from "../runtime/runtime-profiles.js";

export const BenchmarkAuthorizationStatusSchema = z.enum(["blocked", "authorized"]);

export const BenchmarkAuthorizationSchema = z
  .object({
    schemaVersion: z.literal(1),
    suite: z.literal("swe-bench-verified"),
    status: BenchmarkAuthorizationStatusSchema,
    requestedInstances: z.number().int().min(1).max(20),
    runtimeTargets: z.array(z.enum(RUNTIME_TARGETS)).min(1),
    createdAt: z.string().min(1),
    authorizationBoundary: z.literal("explicit_authorization_required_before_execution"),
    blockReason: z.string().min(1).optional(),
    authorizedBy: z.string().min(1).optional(),
    authorizationId: z.string().min(1).optional(),
    costBudgetUsd: z.number().positive().optional(),
    credentialScope: z.string().min(1).optional(),
    evidenceRetentionPath: z.string().min(1).optional(),
    transcriptRetentionPath: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "blocked") {
      if (value.blockReason === undefined) {
        context.addIssue({
          code: "custom",
          path: ["blockReason"],
          message: "Blocked benchmark authorization requires blockReason.",
        });
      }

      return;
    }

    for (const field of [
      "authorizedBy",
      "authorizationId",
      "costBudgetUsd",
      "credentialScope",
      "evidenceRetentionPath",
      "transcriptRetentionPath",
    ] as const) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `Authorized benchmark execution requires ${field}.`,
        });
      }
    }
  });

export type BenchmarkAuthorizationStatus = z.infer<typeof BenchmarkAuthorizationStatusSchema>;
export type BenchmarkAuthorization = z.infer<typeof BenchmarkAuthorizationSchema>;

export function parseBenchmarkAuthorization(input: unknown): BenchmarkAuthorization {
  return BenchmarkAuthorizationSchema.parse(input);
}
