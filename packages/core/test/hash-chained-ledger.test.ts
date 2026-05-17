import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendLedgerEntry,
  createLedgerSigner,
  getLedgerPath,
  readLedger,
  verifyLedgerEntries,
} from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-ledger-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("hash-chained ledger", () => {
  it("writes Ed25519-signed SHA-256 chained entries under .hima/state/ledger", async () => {
    const signer = createLedgerSigner();
    await appendLedgerEntry(root, "run_test", { type: "first" }, signer);
    await appendLedgerEntry(root, "run_test", { type: "second" }, signer);

    const entries = await readLedger(root, "run_test");

    expect(getLedgerPath(root, "run_test")).toMatch(
      /\.hima[\\/]state[\\/]ledger[\\/]run_test\.jsonl$/,
    );
    expect(entries).toHaveLength(2);
    expect(entries[1].prevHash).toBe(entries[0].eventHash);
    expect(verifyLedgerEntries(entries)).toBe(true);
  });

  it("detects tampered payloads", async () => {
    const signer = createLedgerSigner();
    await appendLedgerEntry(root, "run_test", { type: "first" }, signer);
    const entries = await readLedger(root, "run_test");

    expect(verifyLedgerEntries([{ ...entries[0], payload: { type: "tampered" } }])).toBe(false);
  });

  it("keeps the chain valid for generated JSON payloads", () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.jsonValue(), { minLength: 1, maxLength: 5 }),
        async (payloads) => {
          const propertyRoot = await mkdtemp(path.join(tmpdir(), "harness-ledger-property-"));
          try {
            const signer = createLedgerSigner();
            for (const payload of payloads) {
              await appendLedgerEntry(propertyRoot, "run_property", payload, signer);
            }

            expect(verifyLedgerEntries(await readLedger(propertyRoot, "run_property"))).toBe(true);
          } finally {
            await rm(propertyRoot, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
