import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseSiemIngestFixture,
  runLocalSiemFixture,
  SiemIngestRecordSchema,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-local-siem-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("local SIEM ingest fixture", () => {
  it("writes local SIEM-like records from HIMA ledger entries without external transmission", async () => {
    const result = await runLocalSiemFixture({
      root,
      runId: "siem-001",
      iterations: 5,
    });
    const fixture = parseSiemIngestFixture(JSON.parse(await readFile(result.fixtureFile, "utf8")));

    expect(result).toMatchObject({
      ok: true,
      runId: "siem-001",
      records: 5,
      ledgerValid: true,
      externalTransmissions: false,
      externalSessionsLaunched: false,
    });
    expect(fixture.records).toHaveLength(5);
    expect(fixture.records[0]).toMatchObject({
      kind: "local-siem-ingest-record",
      fixtureScope: "local_only_no_external_siem",
      source: "hima-ledger",
      eventType: "local-stress-transition",
      externalTransmissions: false,
      externalSessionsLaunched: false,
    });
  });

  it("rejects malformed SIEM records missing integrity fields", async () => {
    const result = await runLocalSiemFixture({
      root,
      runId: "siem-invalid",
      iterations: 1,
    });
    const fixture = parseSiemIngestFixture(JSON.parse(await readFile(result.fixtureFile, "utf8")));
    const { eventHash: _eventHash, ...integrity } = fixture.records[0].integrity;

    expect(
      SiemIngestRecordSchema.safeParse({
        ...fixture.records[0],
        integrity,
      }).success,
    ).toBe(false);
  });

  it("rejects records that claim external transmission", async () => {
    const result = await runLocalSiemFixture({
      root,
      runId: "siem-external",
      iterations: 1,
    });
    const fixture = parseSiemIngestFixture(JSON.parse(await readFile(result.fixtureFile, "utf8")));

    expect(
      SiemIngestRecordSchema.safeParse({
        ...fixture.records[0],
        externalTransmissions: true,
      }).success,
    ).toBe(false);
  });
});
