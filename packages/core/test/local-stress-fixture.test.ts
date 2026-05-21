import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLedger, runLocalStressFixture, validateLocalStressLedger } from "../src/index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "harness-local-stress-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("local stress fixture", () => {
  it("runs a deterministic 100-entry local ledger stress fixture", async () => {
    const result = await runLocalStressFixture({
      root,
      runId: "stress-001",
      iterations: 100,
    });

    expect(result).toMatchObject({
      ok: true,
      runId: "stress-001",
      iterations: 100,
      ledgerEntries: 100,
      driftDetected: true,
      externalSessionsLaunched: false,
      validation: {
        ok: true,
        ledgerValid: true,
        sequenceValid: true,
        transitionOrderValid: true,
      },
    });
    expect(result.ledgerPath).toMatch(/\.hima[\\/]state[\\/]ledger[\\/]stress-001\.jsonl$/);
  });

  it("detects transition-order drift in a tampered ledger", async () => {
    await runLocalStressFixture({
      root,
      runId: "stress-drift",
      iterations: 10,
    });
    const entries = await readLedger(root, "stress-drift");
    const firstPayload = entries[0].payload as {
      from: unknown;
      to: unknown;
    };
    const tampered = [
      {
        ...entries[0],
        payload: {
          ...firstPayload,
          to: firstPayload.from,
        },
      },
      ...entries.slice(1),
    ];
    const validation = validateLocalStressLedger(tampered, 10);

    expect(validation.ok).toBe(false);
    expect(validation.ledgerValid).toBe(false);
    expect(validation.transitionOrderValid).toBe(false);
    expect(validation.errors.join("\n")).toContain("transition order drift");
  });

  it("rejects reusing a stress run id so repeated runs do not append silently", async () => {
    await runLocalStressFixture({
      root,
      runId: "stress-reuse",
      iterations: 2,
    });

    await expect(
      runLocalStressFixture({
        root,
        runId: "stress-reuse",
        iterations: 2,
      }),
    ).rejects.toThrow("stress fixture ledger already exists");
  });
});
