import { describe, expect, it } from "vitest";
import { BenchmarkAuthorizationSchema, parseBenchmarkAuthorization } from "../src/index.js";

const baseAuthorization = {
  schemaVersion: 1,
  suite: "swe-bench-verified",
  requestedInstances: 10,
  runtimeTargets: ["codex"],
  createdAt: "2026-05-14T23:59:00.000Z",
  authorizationBoundary: "explicit_authorization_required_before_execution",
} as const;

describe("BenchmarkAuthorizationSchema", () => {
  it("accepts blocked authorization artifacts with a block reason", () => {
    const parsed = parseBenchmarkAuthorization({
      ...baseAuthorization,
      status: "blocked",
      blockReason: "Runtime/model spend is not authorized.",
    });

    expect(parsed.status).toBe("blocked");
  });

  it("rejects blocked authorization artifacts without a block reason", () => {
    const result = BenchmarkAuthorizationSchema.safeParse({
      ...baseAuthorization,
      status: "blocked",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["blockReason"]);
  });

  it("requires cost, credential, evidence, and transcript fields for authorization", () => {
    const result = BenchmarkAuthorizationSchema.safeParse({
      ...baseAuthorization,
      status: "authorized",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "authorizedBy",
      "authorizationId",
      "costBudgetUsd",
      "credentialScope",
      "evidenceRetentionPath",
      "transcriptRetentionPath",
    ]);
  });

  it("accepts explicit benchmark execution authorization", () => {
    const result = BenchmarkAuthorizationSchema.safeParse({
      ...baseAuthorization,
      status: "authorized",
      authorizedBy: "founder",
      authorizationId: "auth-001",
      costBudgetUsd: 25,
      credentialScope: "local-runtime-cli",
      evidenceRetentionPath: ".planning/benchmarks/evidence/",
      transcriptRetentionPath: ".planning/benchmarks/transcripts/",
    });

    expect(result.success).toBe(true);
  });

  it("keeps instance count inside the dry-run benchmark bounds", () => {
    expect(
      BenchmarkAuthorizationSchema.safeParse({
        ...baseAuthorization,
        status: "blocked",
        requestedInstances: 21,
        blockReason: "Too many instances.",
      }).success,
    ).toBe(false);
  });

  it("requires the explicit execution authorization boundary", () => {
    expect(
      BenchmarkAuthorizationSchema.safeParse({
        ...baseAuthorization,
        status: "blocked",
        authorizationBoundary: "implicit_execution_allowed",
        blockReason: "Runtime/model spend is not authorized.",
      }).success,
    ).toBe(false);
  });
});
