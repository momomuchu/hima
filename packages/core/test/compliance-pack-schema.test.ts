import { describe, expect, it } from "vitest";
import { CompliancePackSchema, parseCompliancePack } from "../src/index.js";

const basePack = {
  schemaVersion: 1,
  kind: "developer-session-compliance-pack",
  sessionId: "session-001",
  runtimeTarget: "codex",
  createdAt: "2026-05-14T23:59:00.000Z",
  claimBoundary: "evidence_pack_not_compliance_certification",
} as const;

const draftEvidenceReferences = {
  riskClassificationPath: ".planning/current-risk.json",
  runSetPath: ".planning/run-set.json",
  ledgerPath: ".planning/ledger/session-001.jsonl",
  runtimeEvidencePath:
    "docs/excellence-application/05-architecture/runtime-session-evidence/cycle-30/preflight.json",
} as const;

const assembledEvidenceReferences = {
  ...draftEvidenceReferences,
  benchmarkResultPath: "evidence/benchmark.json",
  complianceMappingPath: "evidence/mapping.json",
  siemFixturePath: ".planning/siem-fixtures/session-001-siem.json",
} as const;

describe("CompliancePackSchema", () => {
  it("accepts draft compliance packs with required local evidence references", () => {
    const parsed = parseCompliancePack({
      ...basePack,
      status: "draft",
      evidenceReferences: draftEvidenceReferences,
    });

    expect(parsed.status).toBe("draft");
    expect(parsed.claimBoundary).toBe("evidence_pack_not_compliance_certification");
  });

  it("rejects draft compliance packs that silently omit evidence references", () => {
    const result = CompliancePackSchema.safeParse({
      ...basePack,
      status: "draft",
      evidenceReferences: {
        runSetPath: ".planning/run-set.json",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "evidenceReferences.riskClassificationPath",
      "evidenceReferences.ledgerPath",
      "evidenceReferences.runtimeEvidencePath",
    ]);
  });

  it("accepts blocked compliance packs with explicit unavailable evidence", () => {
    const result = CompliancePackSchema.safeParse({
      ...basePack,
      status: "blocked",
      blockReason: "Real runtime session evidence is not authorized.",
      unavailableEvidence: ["runtime-session-transcript", "benchmark-result"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects blocked compliance packs without a block reason and unavailable evidence", () => {
    const result = CompliancePackSchema.safeParse({
      ...basePack,
      status: "blocked",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "blockReason",
      "unavailableEvidence",
    ]);
  });

  it("rejects assembled compliance packs without benchmark and mapping evidence", () => {
    const result = CompliancePackSchema.safeParse({
      ...basePack,
      status: "assembled",
      evidenceReferences: draftEvidenceReferences,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "evidenceReferences.benchmarkResultPath",
      "evidenceReferences.complianceMappingPath",
      "evidenceReferences.siemFixturePath",
    ]);
  });

  it("accepts assembled compliance packs with a local SIEM fixture reference", () => {
    const parsed = parseCompliancePack({
      ...basePack,
      status: "assembled",
      evidenceReferences: assembledEvidenceReferences,
    });

    expect(parsed.status).toBe("assembled");
    expect(parsed.evidenceReferences?.siemFixturePath).toBe(
      ".planning/siem-fixtures/session-001-siem.json",
    );
  });

  it("requires the explicit non-certification claim boundary", () => {
    const result = CompliancePackSchema.safeParse({
      ...basePack,
      status: "draft",
      claimBoundary: "eu_ai_act_compliant",
      evidenceReferences: draftEvidenceReferences,
    });

    expect(result.success).toBe(false);
  });
});
