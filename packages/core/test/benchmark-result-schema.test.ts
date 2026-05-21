import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BenchmarkResultSchema, parseBenchmarkResult } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(repoRoot, "fixtures", "benchmark-results");

const baseResult = {
  schemaVersion: 1,
  suite: "swe-bench-verified",
  instanceId: "swe-verified-001",
  runtimeTarget: "codex",
  createdAt: "2026-05-14T23:59:00.000Z",
} as const;

describe("BenchmarkResultSchema", () => {
  it("accepts planned benchmark artifacts without execution evidence", () => {
    const parsed = parseBenchmarkResult({
      ...baseResult,
      status: "planned",
    });

    expect(parsed.status).toBe("planned");
  });

  it("requires a block reason for blocked benchmark artifacts", () => {
    expect(
      BenchmarkResultSchema.safeParse({
        ...baseResult,
        status: "blocked",
      }).success,
    ).toBe(false);

    expect(
      BenchmarkResultSchema.safeParse({
        ...baseResult,
        status: "blocked",
        blockReason: "External runtime spend not authorized.",
      }).success,
    ).toBe(true);
  });

  it("rejects executed benchmark artifacts without transcript, evidence, overhead, and cost data", () => {
    const result = BenchmarkResultSchema.safeParse({
      ...baseResult,
      status: "executed",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "baselineTranscriptPath",
      "governedTranscriptPath",
      "testsBeforeAfterPath",
      "himaEvidencePath",
      "wallClockOverheadMs",
      "costAccounting",
    ]);
  });

  it("accepts executed benchmark artifacts with complete evidence and zero-cost accounting", () => {
    const result = BenchmarkResultSchema.safeParse({
      ...baseResult,
      status: "executed",
      baselineTranscriptPath: "evidence/baseline.log",
      governedTranscriptPath: "evidence/governed.log",
      testsBeforeAfterPath: "evidence/tests.txt",
      himaEvidencePath: "evidence/hima-events.jsonl",
      wallClockOverheadMs: 1234,
      costAccounting: {
        zeroCostReason: "Local replay fixture.",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects executed benchmark artifacts with empty cost accounting", () => {
    expect(
      BenchmarkResultSchema.safeParse({
        ...baseResult,
        status: "executed",
        baselineTranscriptPath: "evidence/baseline.log",
        governedTranscriptPath: "evidence/governed.log",
        testsBeforeAfterPath: "evidence/tests.txt",
        himaEvidencePath: "evidence/hima-events.jsonl",
        wallClockOverheadMs: 1234,
        costAccounting: {},
      }).success,
    ).toBe(false);
  });

  it("accepts canonical planned, blocked, and valid executed fixtures", async () => {
    for (const fixtureName of ["planned.json", "blocked.json", "executed-valid.json"]) {
      const fixturePath = path.join(fixtureRoot, fixtureName);
      const parsed = parseBenchmarkResult(JSON.parse(await readFile(fixturePath, "utf8")));

      expect(["planned", "blocked", "executed"]).toContain(parsed.status);
    }
  });

  it("keeps valid executed fixture evidence paths resolvable while marking them synthetic", async () => {
    const parsed = parseBenchmarkResult(
      JSON.parse(await readFile(path.join(fixtureRoot, "executed-valid.json"), "utf8")),
    );

    expect(parsed.status).toBe("executed");
    expect(parsed.costAccounting?.zeroCostReason).toContain("Synthetic validator fixture");

    for (const evidencePath of [
      parsed.baselineTranscriptPath,
      parsed.governedTranscriptPath,
      parsed.testsBeforeAfterPath,
      parsed.himaEvidencePath,
    ]) {
      expect(evidencePath).toBeDefined();
      await expect(access(path.join(repoRoot, evidencePath ?? ""))).resolves.toBeUndefined();
    }
  });

  it("rejects the canonical fake executed fixture", async () => {
    const fixture = JSON.parse(
      await readFile(path.join(fixtureRoot, "executed-invalid-fake.json"), "utf8"),
    );

    expect(BenchmarkResultSchema.safeParse(fixture).success).toBe(false);
  });
});
