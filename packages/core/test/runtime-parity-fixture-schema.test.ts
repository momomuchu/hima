import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRuntimeParityFixture, RuntimeParityFixtureSchema } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(repoRoot, "fixtures", "runtime-parity", "synthetic");
const invalidFixtureRoot = path.join(repoRoot, "fixtures", "runtime-parity", "invalid");

const baseFixture = {
  schemaVersion: 1,
  kind: "synthetic-runtime-parity-fixture",
  fixtureScope: "synthetic_not_real_runtime",
  runtimeTarget: "codex",
  sessionId: "synthetic-parity-cycle-40",
  createdAt: "2026-05-14T23:59:00.000Z",
  governance: {
    riskClass: "M",
    operatingMode: "auto",
    macroCycle: "validation",
    subPhase: "Verify",
    activeGate: "post_tool",
    requiredEvidenceKeys: ["hook_decision", "command_output", "files_modified"],
    ledgerHashAlgorithm: "sha256",
    ledgerEntryKind: "governance_event",
    evidenceAnchorKind: "local_artifact_path",
    policyBoundary: "fixture_only_no_runtime_execution",
  },
  externalSessionsLaunched: false,
} as const;

describe("RuntimeParityFixtureSchema", () => {
  it("accepts canonical synthetic fixtures for Claude Codex and Hermes", async () => {
    for (const fixtureName of ["claude.json", "codex.json", "hermes.json"]) {
      const parsed = parseRuntimeParityFixture(
        JSON.parse(await readFile(path.join(fixtureRoot, fixtureName), "utf8")),
      );

      expect(parsed.kind).toBe("synthetic-runtime-parity-fixture");
      expect(parsed.fixtureScope).toBe("synthetic_not_real_runtime");
      expect(parsed.externalSessionsLaunched).toBe(false);
    }
  });

  it("rejects fixtures that claim external runtime execution", () => {
    expect(
      RuntimeParityFixtureSchema.safeParse({
        ...baseFixture,
        externalSessionsLaunched: true,
      }).success,
    ).toBe(false);
  });

  it("rejects fixtures that omit required governance fields", () => {
    const { policyBoundary: _policyBoundary, ...governance } = baseFixture.governance;

    expect(
      RuntimeParityFixtureSchema.safeParse({
        ...baseFixture,
        governance,
      }).success,
    ).toBe(false);
  });

  it("rejects the canonical missing-governance-field drift fixture", async () => {
    const fixture = JSON.parse(
      await readFile(path.join(invalidFixtureRoot, "drift-missing-policy-boundary.json"), "utf8"),
    );

    expect(RuntimeParityFixtureSchema.safeParse(fixture).success).toBe(false);
  });

  it("rejects fake real-runtime parity scope", () => {
    expect(
      RuntimeParityFixtureSchema.safeParse({
        ...baseFixture,
        fixtureScope: "real_runtime_parity_verified",
      }).success,
    ).toBe(false);
  });
});
