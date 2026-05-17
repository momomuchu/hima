import { z } from "zod";
import { RUNTIME_TARGETS } from "../runtime/runtime-profiles.js";

export const RuntimeParityAuthorizationStatusSchema = z.enum(["blocked", "authorized"]);

export const RuntimeParityAuthorizationSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("real-runtime-parity-authorization"),
    status: RuntimeParityAuthorizationStatusSchema,
    scenarioId: z.string().min(1),
    runtimeTargets: z.array(z.enum(RUNTIME_TARGETS)).min(1),
    createdAt: z.string().min(1),
    authorizationBoundary: z.literal(
      "explicit_authorization_required_before_real_runtime_parity_execution",
    ),
    blockReason: z.string().min(1).optional(),
    authorizedBy: z.string().min(1).optional(),
    authorizationId: z.string().min(1).optional(),
    costBudgetUsd: z.number().positive().optional(),
    credentialScope: z.string().min(1).optional(),
    evidenceRetentionPath: z.string().min(1).optional(),
    transcriptRetentionPath: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    const missingTargets = RUNTIME_TARGETS.filter(
      (target) => !value.runtimeTargets.includes(target),
    );
    if (missingTargets.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["runtimeTargets"],
        message: `Runtime parity authorization requires all targets: ${RUNTIME_TARGETS.join(", ")}.`,
      });
    }

    if (value.status === "blocked") {
      if (value.blockReason === undefined) {
        context.addIssue({
          code: "custom",
          path: ["blockReason"],
          message: "Blocked runtime parity authorization requires blockReason.",
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
          message: `Authorized runtime parity execution requires ${field}.`,
        });
      }
    }
  });

export type RuntimeParityAuthorizationStatus = z.infer<
  typeof RuntimeParityAuthorizationStatusSchema
>;
export type RuntimeParityAuthorization = z.infer<typeof RuntimeParityAuthorizationSchema>;

export function parseRuntimeParityAuthorization(input: unknown): RuntimeParityAuthorization {
  return RuntimeParityAuthorizationSchema.parse(input);
}
