import { z } from "zod";
import { RUNTIME_TARGETS } from "../runtime/runtime-profiles.js";

export const CompliancePackStatusSchema = z.enum(["draft", "blocked", "assembled"]);

export const CompliancePackEvidenceReferencesSchema = z.object({
  riskClassificationPath: z.string().min(1).optional(),
  runSetPath: z.string().min(1).optional(),
  ledgerPath: z.string().min(1).optional(),
  runtimeEvidencePath: z.string().min(1).optional(),
  benchmarkResultPath: z.string().min(1).optional(),
  complianceMappingPath: z.string().min(1).optional(),
  siemFixturePath: z.string().min(1).optional(),
});

export const CompliancePackSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal("developer-session-compliance-pack"),
    status: CompliancePackStatusSchema,
    sessionId: z.string().min(1),
    runtimeTarget: z.enum(RUNTIME_TARGETS),
    createdAt: z.string().min(1),
    claimBoundary: z.literal("evidence_pack_not_compliance_certification"),
    evidenceReferences: CompliancePackEvidenceReferencesSchema.optional(),
    unavailableEvidence: z.array(z.string().min(1)).optional(),
    blockReason: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "blocked") {
      if (value.blockReason === undefined) {
        context.addIssue({
          code: "custom",
          path: ["blockReason"],
          message: "Blocked compliance packs require blockReason.",
        });
      }

      if (value.unavailableEvidence === undefined || value.unavailableEvidence.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["unavailableEvidence"],
          message: "Blocked compliance packs require unavailableEvidence.",
        });
      }

      return;
    }

    if (value.evidenceReferences === undefined) {
      context.addIssue({
        code: "custom",
        path: ["evidenceReferences"],
        message: `${value.status} compliance packs require evidenceReferences.`,
      });
      return;
    }

    const requiredDraftFields = [
      "riskClassificationPath",
      "runSetPath",
      "ledgerPath",
      "runtimeEvidencePath",
    ] as const;

    for (const field of requiredDraftFields) {
      if (value.evidenceReferences[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: ["evidenceReferences", field],
          message: `${value.status} compliance packs require evidenceReferences.${field}.`,
        });
      }
    }

    if (value.status !== "assembled") {
      return;
    }

    for (const field of [
      "benchmarkResultPath",
      "complianceMappingPath",
      "siemFixturePath",
    ] as const) {
      if (value.evidenceReferences[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: ["evidenceReferences", field],
          message: `assembled compliance packs require evidenceReferences.${field}.`,
        });
      }
    }
  });

export type CompliancePackStatus = z.infer<typeof CompliancePackStatusSchema>;
export type CompliancePackEvidenceReferences = z.infer<
  typeof CompliancePackEvidenceReferencesSchema
>;
export type CompliancePack = z.infer<typeof CompliancePackSchema>;

export function parseCompliancePack(input: unknown): CompliancePack {
  return CompliancePackSchema.parse(input);
}
