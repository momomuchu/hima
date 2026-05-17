import { z } from "zod";

export const SiemIngestRecordSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("local-siem-ingest-record"),
  fixtureScope: z.literal("local_only_no_external_siem"),
  source: z.literal("hima-ledger"),
  eventId: z.string().min(1),
  observedAt: z.string().min(1),
  runId: z.string().min(1),
  eventType: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]),
  integrity: z.object({
    ledgerSequence: z.number().int().nonnegative(),
    prevHash: z.string().regex(/^[a-f0-9]{64}$/),
    eventHash: z.string().regex(/^[a-f0-9]{64}$/),
    signaturePresent: z.literal(true),
  }),
  governance: z.object({
    payloadKind: z.string().min(1),
    evidenceAnchorKind: z.literal("local_ledger_entry"),
  }),
  externalTransmissions: z.literal(false),
  externalSessionsLaunched: z.literal(false),
});

export const SiemIngestFixtureSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("local-siem-ingest-fixture"),
  fixtureScope: z.literal("local_only_no_external_siem"),
  runId: z.string().min(1),
  createdAt: z.string().min(1),
  records: z.array(SiemIngestRecordSchema).min(1),
  externalTransmissions: z.literal(false),
  externalSessionsLaunched: z.literal(false),
});

export type SiemIngestRecord = z.infer<typeof SiemIngestRecordSchema>;
export type SiemIngestFixture = z.infer<typeof SiemIngestFixtureSchema>;

export function parseSiemIngestRecord(input: unknown): SiemIngestRecord {
  return SiemIngestRecordSchema.parse(input);
}

export function parseSiemIngestFixture(input: unknown): SiemIngestFixture {
  return SiemIngestFixtureSchema.parse(input);
}
