import { describe, expect, it } from "vitest";
import { parseRuntimeParityAuthorization, RuntimeParityAuthorizationSchema } from "../src/index.js";

const baseAuthorization = {
  schemaVersion: 1,
  kind: "real-runtime-parity-authorization",
  scenarioId: "small-feature",
  runtimeTargets: ["claude", "codex", "hermes"],
  createdAt: "2026-05-14T23:59:00.000Z",
  authorizationBoundary: "explicit_authorization_required_before_real_runtime_parity_execution",
} as const;

describe("RuntimeParityAuthorizationSchema", () => {
  it("accepts blocked authorization with all runtime targets and a reason", () => {
    const parsed = parseRuntimeParityAuthorization({
      ...baseAuthorization,
      status: "blocked",
      blockReason: "Runtime/model sessions are not authorized.",
    });

    expect(parsed.status).toBe("blocked");
  });

  it("requires all runtime targets for real parity authorization", () => {
    expect(
      RuntimeParityAuthorizationSchema.safeParse({
        ...baseAuthorization,
        status: "blocked",
        runtimeTargets: ["claude", "codex"],
        blockReason: "Hermes is missing.",
      }).success,
    ).toBe(false);
  });

  it("requires cost credentials and retention fields for authorized execution", () => {
    const result = RuntimeParityAuthorizationSchema.safeParse({
      ...baseAuthorization,
      status: "authorized",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("authorizedBy");
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("costBudgetUsd");
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(
      "transcriptRetentionPath",
    );
  });

  it("accepts explicit authorized execution metadata without launching execution", () => {
    expect(
      RuntimeParityAuthorizationSchema.safeParse({
        ...baseAuthorization,
        status: "authorized",
        authorizedBy: "founder",
        authorizationId: "runtime-parity-auth-001",
        costBudgetUsd: 25,
        credentialScope: "local-runtime-cli",
        evidenceRetentionPath: ".planning/runtime-parity/evidence/",
        transcriptRetentionPath: ".planning/runtime-parity/transcripts/",
      }).success,
    ).toBe(true);
  });
});
