import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addEvidence,
  type EvidenceItem,
  type EvidenceKey,
  getAcceptedEvidenceKeys,
  initProject,
  isEvidenceSufficient,
  RISK_POLICY,
  readPlanningProject,
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

      expect(item.metadata).toEqual(metadata);
      expect(project.runSet.evidence[0].metadata).toEqual(metadata);
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
