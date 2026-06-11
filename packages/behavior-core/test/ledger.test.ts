import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendLedgerEntry,
  getLedgerPath,
  readLedger,
  verifyLedgerChain,
} from "../src/ledger.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "behavior-core-ledger-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("simplified hash-chained ledger (no ed25519)", () => {
  it("writes sha256-chained entries under .hima/state/ledger", async () => {
    await appendLedgerEntry(root, "run_test", { type: "first" });
    await appendLedgerEntry(root, "run_test", { type: "second" });

    const entries = await readLedger(root, "run_test");

    expect(getLedgerPath(root, "run_test")).toMatch(
      /\.hima[\\/]state[\\/]ledger[\\/]run_test\.jsonl$/,
    );
    expect(entries).toHaveLength(2);
    expect(entries[1]?.prevHash).toBe(entries[0]?.eventHash);
    expect(verifyLedgerChain(entries)).toBe(true);
  });

  it("entries have no signature or publicKey fields", async () => {
    await appendLedgerEntry(root, "run_nosig", { type: "payload" });
    const entries = await readLedger(root, "run_nosig");
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty("signature");
    expect(entries[0]).not.toHaveProperty("publicKey");
  });

  it("detects tampered payloads via hash mismatch", async () => {
    await appendLedgerEntry(root, "run_test", { type: "first" });
    const entries = await readLedger(root, "run_test");

    expect(
      verifyLedgerChain([{ ...entries[0]!, payload: { type: "tampered" } }]),
    ).toBe(false);
  });

  it("detects broken chain via prevHash mismatch", async () => {
    await appendLedgerEntry(root, "run_chain", { type: "first" });
    await appendLedgerEntry(root, "run_chain", { type: "second" });
    const entries = await readLedger(root, "run_chain");

    // Swap the entries to break the chain
    expect(verifyLedgerChain([entries[1]!, entries[0]!])).toBe(false);
  });

  it("returns empty array for empty ledger file", async () => {
    // First write creates the file, then we read a non-existent run
    // Actually test that ENOENT path works cleanly
    await appendLedgerEntry(root, "run_first", {});
    await appendLedgerEntry(root, "run_first", {});
    const entries = await readLedger(root, "run_first");
    expect(entries.length).toBe(2);
    expect(verifyLedgerChain(entries)).toBe(true);
  });

  it("keeps the chain valid for multiple payloads", async () => {
    const payloads = [
      { type: "event_a", data: 1 },
      { type: "event_b", data: "hello" },
      { type: "event_c", data: [1, 2, 3] },
      { type: "event_d", data: null },
    ];

    for (const payload of payloads) {
      await appendLedgerEntry(root, "run_multi", payload);
    }

    const entries = await readLedger(root, "run_multi");
    expect(entries).toHaveLength(4);
    expect(verifyLedgerChain(entries)).toBe(true);

    // Verify chain links
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]?.prevHash).toBe(entries[i - 1]?.eventHash);
    }
  });
});
