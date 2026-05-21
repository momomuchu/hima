import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addEvidence,
  type EvidenceItem,
  type EvidenceKey,
  evaluateLayeredEvidenceGate,
  getAcceptedEvidenceKeys,
  getEvidenceGateStage,
  initProject,
  isEvidenceSufficient,
  LAYERED_EVIDENCE_GATE_STAGES,
  RISK_POLICY,
  readEventLog,
  readLedger,
  readPlanningProject,
  verifyLedgerEntries,
} from "../src/index.js";

const now = "2026-05-03T00:00:00.000Z";

function evidence(key: EvidenceItem["key"], status: EvidenceItem["status"] = "accepted") {
  return {
    id: `ev_${key}`,
    key,
    kind: "command_output",
    status,
    summary: key,
    createdAt: now,
  } satisfies EvidenceItem;
}

function trustedHumanEvidence(key: "human_validation" | "explicit_human_signature"): EvidenceItem {
  return {
    ...evidence(key),
    source: "human",
  };
}

describe("evidence sufficiency", () => {
  it("uses mandatory evidence keys from the baseline policy", () => {
    const result = isEvidenceSufficient(
      [evidence("ci_green"), evidence("sast_clean"), evidence("secrets_clean")],
      "T",
    );

    expect(result.sufficient).toBe(true);
    expect(result.missingEvidenceKeys).toEqual([]);
  });

  it("ignores candidate evidence for final sufficiency", () => {
    const result = isEvidenceSufficient(
      [evidence("ci_green"), evidence("sast_clean"), evidence("secrets_clean", "candidate")],
      "T",
    );

    expect(result.sufficient).toBe(false);
    expect(result.missingEvidenceKeys).toEqual(["secrets_clean"]);
  });

  it("accepts explicit human signature as the H human checkpoint evidence", () => {
    const result = isEvidenceSufficient(
      evidenceForRiskReplacing("H", "human_validation", "explicit_human_signature"),
      "H",
    );

    expect(result.sufficient).toBe(true);
    expect(result.missingEvidenceKeys).toEqual([]);
  });

  it("accepts explicit human signature as the C human checkpoint evidence", () => {
    const result = isEvidenceSufficient(
      evidenceForRiskReplacing("C", "human_validation", "explicit_human_signature"),
      "C",
    );

    expect(result.sufficient).toBe(true);
    expect(result.missingEvidenceKeys).toEqual([]);
  });

  it("still requires other mandatory H evidence when explicit human signature is present", () => {
    const result = isEvidenceSufficient(
      evidenceForRiskReplacing("H", "human_validation", "explicit_human_signature").filter(
        (item) => item.key !== "load_tests",
      ),
      "H",
    );

    expect(result.sufficient).toBe(false);
    expect(result.missingEvidenceKeys).toEqual(["load_tests"]);
  });

  it("ignores accepted human-only evidence when it does not come from a trusted channel", () => {
    const result = isEvidenceSufficient(
      evidenceForRiskReplacing("H", "human_validation", "explicit_human_signature").map((item) =>
        item.key === "explicit_human_signature" ? { ...item, source: "agent" } : item,
      ),
      "H",
    );

    expect(result.sufficient).toBe(false);
    expect(result.presentEvidenceKeys).not.toContain("explicit_human_signature");
    expect(result.missingEvidenceKeys).toEqual(["human_validation"]);
  });

  it("trusts accepted human-only evidence with an explicit verified metadata marker", () => {
    expect(
      getAcceptedEvidenceKeys([
        {
          ...evidence("human_validation"),
          source: "agent",
          metadata: { verifiedHuman: true },
        },
      ]),
    ).toEqual(["human_validation"]);
  });

  it.each([
    { verifiedHuman: "true" },
    { verifiedHuman: false },
    { human: { verified: true } },
  ])("does not trust non-exact human metadata %j", (metadata) => {
    expect(
      getAcceptedEvidenceKeys([
        {
          ...evidence("human_validation"),
          source: "agent",
          metadata,
        },
      ]),
    ).toEqual([]);
  });
});

describe("layered evidence gate", () => {
  it("rejects missing layers without treating later layers as progression", () => {
    const result = evaluateLayeredEvidenceGate([
      layeredEvidence("eval_suite", "command_output"),
      layeredEvidence("suite_promotion", "review_2_or_antagonist"),
    ]);

    expect(result.sufficient).toBe(false);
    expect(result.readyForPromotion).toBe(false);
    expect(result.completedStages).toEqual(["eval_suite"]);
    expect(result.missingStages).toEqual(["held_out_split", "suite_promotion"]);
    expect(result.stageResults[1]).toMatchObject({
      stage: "held_out_split",
      passed: false,
      missingEvidenceKeys: [],
    });
    expect(result.stageResults[2]).toMatchObject({
      stage: "suite_promotion",
      passed: true,
      blockedByPreviousStage: "held_out_split",
    });
  });

  it("accepts ordered local layer progression with suite and promotion metadata", () => {
    const result = evaluateLayeredEvidenceGate([
      layeredEvidence("eval_suite", "command_output", {
        suiteName: "local-regression",
      }),
      layeredEvidence("held_out_split", "integration_tests", {
        suite_name: "local-regression",
      }),
      layeredEvidence("suite_promotion", "review_2_or_antagonist", {
        promotionTarget: "candidate-suite-v2",
      }),
    ]);

    expect(result).toMatchObject({
      sufficient: true,
      readyForPromotion: true,
      completedStages: ["eval_suite", "held_out_split", "suite_promotion"],
      missingStages: [],
    });
    expect(result.stageResults[0].suiteNames).toEqual(["local-regression"]);
    expect(result.stageResults[1].suiteNames).toEqual(["local-regression"]);
    expect(result.stageResults[2].promotionTargets).toEqual(["candidate-suite-v2"]);
  });

  it("supports per-layer required evidence keys", () => {
    const result = evaluateLayeredEvidenceGate(
      [
        layeredEvidence("eval_suite", "command_output"),
        layeredEvidence("held_out_split", "integration_tests"),
        layeredEvidence("suite_promotion", "review_2_or_antagonist"),
      ],
      {
        requiredEvidenceKeysByStage: {
          eval_suite: ["ci_green"],
        },
      },
    );

    expect(result.sufficient).toBe(false);
    expect(result.stageResults[0]).toMatchObject({
      stage: "eval_suite",
      passed: false,
      missingEvidenceKeys: ["ci_green"],
    });
  });

  it("ignores unaccepted, untrusted, and unmarked layer evidence", () => {
    const result = evaluateLayeredEvidenceGate([
      layeredEvidence("eval_suite", "command_output", {}, "candidate"),
      {
        ...layeredEvidence("held_out_split", "human_validation"),
        source: "agent",
      },
      evidence("review_2_or_antagonist"),
    ]);

    expect(result.sufficient).toBe(false);
    expect(result.completedStages).toEqual([]);
    expect(result.missingStages).toEqual(["eval_suite", "held_out_split", "suite_promotion"]);
  });

  it("keeps the local layered gate catalog internally consistent", () => {
    expect(new Set(LAYERED_EVIDENCE_GATE_STAGES).size).toBe(LAYERED_EVIDENCE_GATE_STAGES.length);
    expect(LAYERED_EVIDENCE_GATE_STAGES).toEqual([
      "eval_suite",
      "held_out_split",
      "suite_promotion",
    ]);
    expect(getEvidenceGateStage(layeredEvidence("eval_suite", "command_output"))).toBe(
      "eval_suite",
    );
    expect(getEvidenceGateStage(evidence("command_output"))).toBeUndefined();
  });
});

describe("addEvidence", () => {
  it.each([
    "human_validation",
    "explicit_human_signature",
  ] as const)("rejects accepted %s evidence from an untrusted source", async (key) => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-evidence-"));

    try {
      await initProject(root);

      await expect(
        addEvidence(root, {
          key,
          kind: "review",
          status: "accepted",
          summary: "agent claimed human approval",
          source: "agent",
        }),
      ).rejects.toThrow("metadata.verifiedHuman=true");

      const project = await readPlanningProject(root);
      expect(project.runSet.evidence).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts human-only evidence from trusted human source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-evidence-"));

    try {
      await initProject(root);

      await expect(
        addEvidence(root, {
          key: "human_validation",
          kind: "review",
          status: "accepted",
          summary: "human approved release",
          source: "human",
        }),
      ).resolves.toMatchObject({
        key: "human_validation",
        source: "human",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves ordinary evidence metadata without treating it as authority", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-evidence-"));
    const metadata = {
      verifiedHuman: "not-authority",
      command: "pnpm test",
      nested: {
        retained: true,
        values: [1, "two", null],
      },
    };

    try {
      await initProject(root);

      const item = await addEvidence(root, {
        key: "ci_green",
        kind: "command_output",
        status: "accepted",
        summary: "tests passed",
        source: "agent",
        metadata,
      });
      const project = await readPlanningProject(root);
      const eventsLog = await readEventLog(root);
      const ledger = await readLedger(root, project.runSet.runId);

      expect(item.metadata).toEqual(metadata);
      expect(project.runSet.evidence[0].metadata).toEqual(metadata);
      expect(project.runSet.events[0]).toMatchObject({
        id: `evidence-added-${item.id}`,
        type: "EVIDENCE_ADDED",
        payload: {
          evidenceId: item.id,
          key: "ci_green",
          status: "accepted",
        },
      });
      expect(eventsLog[0]).toMatchObject({
        id: `evidence-added-${item.id}`,
        type: "EvidenceAdded",
        payload: {
          owner: "Evidence",
          legacyType: "EVIDENCE_ADDED",
        },
      });
      expect(ledger[0].payload).toMatchObject({ type: "EVIDENCE_ADDED" });
      expect(verifyLedgerEntries(ledger)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function evidenceForRiskReplacing(
  riskClass: "H" | "C",
  replacedKey: EvidenceKey,
  replacementKey: EvidenceKey,
): EvidenceItem[] {
  const keys = RISK_POLICY[riskClass].mandatoryEvidenceKeys.filter((key) => key !== replacedKey);

  if (!keys.includes(replacementKey)) {
    keys.push(replacementKey);
  }

  return keys.map((key) =>
    key === "human_validation" || key === "explicit_human_signature"
      ? trustedHumanEvidence(key)
      : evidence(key),
  );
}

function layeredEvidence(
  stage: "eval_suite" | "held_out_split" | "suite_promotion",
  key: EvidenceItem["key"],
  metadata: Record<string, unknown> = {},
  status: EvidenceItem["status"] = "accepted",
): EvidenceItem {
  return {
    ...evidence(key, status),
    id: `ev_${stage}_${key}`,
    metadata: {
      evidenceGateStage: stage,
      ...metadata,
    },
  };
}
