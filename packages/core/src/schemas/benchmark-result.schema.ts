import { z } from "zod";
import { RUNTIME_TARGETS } from "../runtime/runtime-profiles.js";

export const BenchmarkResultStatusSchema = z.enum(["planned", "blocked", "executed"]);

export const BenchmarkCostAccountingSchema = z
  .object({
    tokenCount: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
    zeroCostReason: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.tokenCount === undefined &&
      value.costUsd === undefined &&
      value.zeroCostReason === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Benchmark cost accounting requires tokenCount, costUsd, or zeroCostReason.",
      });
    }
  });

export const BenchmarkResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    suite: z.literal("swe-bench-verified"),
    status: BenchmarkResultStatusSchema,
    instanceId: z.string().min(1),
    runtimeTarget: z.enum(RUNTIME_TARGETS),
    createdAt: z.string().min(1),
    baselineTranscriptPath: z.string().min(1).optional(),
    governedTranscriptPath: z.string().min(1).optional(),
    testsBeforeAfterPath: z.string().min(1).optional(),
    himaEvidencePath: z.string().min(1).optional(),
    wallClockOverheadMs: z.number().nonnegative().optional(),
    costAccounting: BenchmarkCostAccountingSchema.optional(),
    blockReason: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "blocked" && value.blockReason === undefined) {
      context.addIssue({
        code: "custom",
        path: ["blockReason"],
        message: "Blocked benchmark results require blockReason.",
      });
    }

    if (value.status !== "executed") {
      return;
    }

    const requiredExecutedFields = [
      "baselineTranscriptPath",
      "governedTranscriptPath",
      "testsBeforeAfterPath",
      "himaEvidencePath",
      "wallClockOverheadMs",
      "costAccounting",
    ] as const;

    for (const field of requiredExecutedFields) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `Executed benchmark results require ${field}.`,
        });
      }
    }
  });

export type BenchmarkResultStatus = z.infer<typeof BenchmarkResultStatusSchema>;
export type BenchmarkCostAccounting = z.infer<typeof BenchmarkCostAccountingSchema>;
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

export function parseBenchmarkResult(input: unknown): BenchmarkResult {
  return BenchmarkResultSchema.parse(input);
}
