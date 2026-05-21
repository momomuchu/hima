import path from "node:path";
import {
  parseSiemIngestFixture,
  parseSiemIngestRecord,
  type SiemIngestRecord,
} from "../schemas/siem-ingest.schema.js";
import {
  type LedgerEntry,
  readLedger,
  verifyLedgerEntries,
} from "../storage/hash-chained-ledger.js";
import { safeAtomicWriteFile } from "../storage/safe-write.js";
import { runLocalStressFixture } from "../stress/local-stress-fixture.js";

export type LocalSiemFixtureResult = {
  ok: true;
  runId: string;
  fixtureFile: string;
  records: number;
  ledgerValid: boolean;
  externalTransmissions: false;
  externalSessionsLaunched: false;
};

export type LocalSiemFixtureOptions = {
  root: string;
  runId?: string;
  iterations?: number;
};

export async function runLocalSiemFixture(
  options: LocalSiemFixtureOptions,
): Promise<LocalSiemFixtureResult> {
  const runId = parseSiemRunId(options.runId ?? "local-siem-fixture");
  const stress = await runLocalStressFixture({
    root: options.root,
    runId,
    iterations: options.iterations ?? 10,
  });
  const ledger = await readLedger(options.root, runId);
  const ledgerValid = verifyLedgerEntries(ledger);
  const fixture = parseSiemIngestFixture({
    schemaVersion: 1,
    kind: "local-siem-ingest-fixture",
    fixtureScope: "local_only_no_external_siem",
    runId,
    createdAt: new Date().toISOString(),
    records: ledger.map(mapLedgerEntryToSiemRecord),
    externalTransmissions: false,
    externalSessionsLaunched: stress.externalSessionsLaunched,
  });
  const fixtureFile = path.join(options.root, ".planning", "siem-fixtures", `${runId}.json`);

  await safeAtomicWriteFile(options.root, fixtureFile, `${JSON.stringify(fixture, null, 2)}\n`);

  return {
    ok: true,
    runId,
    fixtureFile,
    records: fixture.records.length,
    ledgerValid,
    externalTransmissions: false,
    externalSessionsLaunched: false,
  };
}

export function mapLedgerEntryToSiemRecord(entry: LedgerEntry): SiemIngestRecord {
  return parseSiemIngestRecord({
    schemaVersion: 1,
    kind: "local-siem-ingest-record",
    fixtureScope: "local_only_no_external_siem",
    source: "hima-ledger",
    eventId: entry.id,
    observedAt: entry.ts,
    runId: entry.runId,
    eventType: readPayloadKind(entry.payload),
    severity: "info",
    integrity: {
      ledgerSequence: entry.sequence,
      prevHash: entry.prevHash,
      eventHash: entry.eventHash,
      signaturePresent: entry.signature.length > 0,
    },
    governance: {
      payloadKind: readPayloadKind(entry.payload),
      evidenceAnchorKind: "local_ledger_entry",
    },
    externalTransmissions: false,
    externalSessionsLaunched: false,
  });
}

function readPayloadKind(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "kind" in payload) {
    const kind = (payload as { kind?: unknown }).kind;
    if (typeof kind === "string" && kind.length > 0) {
      return kind;
    }
  }

  return "unknown";
}

function parseSiemRunId(input: string): string {
  const normalized = input.trim();
  if (/^[A-Za-z0-9._-]+$/u.test(normalized)) {
    return normalized;
  }

  throw new Error(
    "SIEM fixture runId may contain only letters, numbers, dot, underscore, or dash.",
  );
}
