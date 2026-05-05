import { describe, expect, it } from "vitest";
import {
  type Changeset,
  classifyRisk,
  compareRiskClass,
  demoteRisk,
  getMandatoryActivities,
  isBypassEligible,
  promoteRisk,
  RiskClassificationError,
  scanForForcingSignals,
} from "../src/risk-classifier/index.js";

describe("risk classifier", () => {
  it("classifies trivial documentation changes deterministically", () => {
    const changeset: Changeset = {
      files: ["README.md"],
      labels: [],
      changeType: "docs",
      diffLinesNet: 3,
    };

    expect(classifyRisk(changeset)).toEqual(classifyRisk(changeset));
    expect(classifyRisk(changeset)).toMatchObject({
      riskClass: "T",
      activeSignals: [],
      compositeScore: 1,
      operatingMode: "bypass",
      deploymentStrategy: "direct",
      bypassEligible: true,
      proposedBy: "agent",
    });
  });

  it("forces H for sensitive file paths, labels, and schema diff content", () => {
    const result = classifyRisk({
      files: ["src/auth/session.ts", "db/migrations/001.sql"],
      labels: ["pii"],
      changeType: "fix",
      diffContent: "+ ALTER TABLE users ADD COLUMN email text;",
      impactEstimate: 1,
      probabilityEstimate: 1,
    });

    expect(result.riskClass).toBe("H");
    expect(result.bypassEligible).toBe(false);
    expect(result.activeSignals).toEqual(
      expect.arrayContaining([
        { type: "file_path", value: "src/auth/session.ts", forcedClass: "H" },
        { type: "label", value: "pii", forcedClass: "H" },
      ]),
    );
  });

  it("forces C for critical data, architecture, and cross-repo signals", () => {
    const signals = scanForForcingSignals(
      ["services/medical/record.ts"],
      "+ import type { health_data } from './types';",
      ["arch-refactor"],
      { changeType: "architecture_refactor", reposCount: 2 },
    );

    expect(signals.map((signal) => signal.forcedClass)).toContain("C");

    const result = classifyRisk({
      files: ["services/medical/record.ts"],
      labels: ["arch-refactor"],
      changeType: "architecture_refactor",
      diffContent: "+ import type { health_data } from './types';",
      reposCount: 2,
      impactEstimate: 1,
      probabilityEstimate: 1,
    });

    expect(result.riskClass).toBe("C");
    expect(result.operatingMode).toBe("pairing");
    expect(result.deploymentStrategy).toBe("canary-with-flag");
  });

  it("uses score mapping and structural minimum when no forcing signal exists", () => {
    expect(
      classifyRisk({
        files: ["src/search/results.ts"],
        labels: [],
        changeType: "feature",
        impactEstimate: 2,
        probabilityEstimate: 3,
      }).riskClass,
    ).toBe("M");

    expect(
      classifyRisk({
        files: ["src/feature.ts"],
        labels: [],
        changeType: "fix",
        impactEstimate: 1,
        probabilityEstimate: 1,
        diffLinesNet: 301,
      }).riskClass,
    ).toBe("M");
  });

  it("requires all modeled L-risk bypass conditions", () => {
    const lRisk: Changeset = {
      files: ["src/widget.ts"],
      labels: [],
      changeType: "fix",
      impactEstimate: 2,
      probabilityEstimate: 2,
      diffLinesNet: 50,
      ciGreen: true,
      newEndpointExposed: false,
    };

    expect(classifyRisk(lRisk).riskClass).toBe("L");
    expect(isBypassEligible("L", lRisk)).toBe(true);
    expect(isBypassEligible("L", { ...lRisk, ciGreen: false })).toBe(false);
    expect(isBypassEligible("L", { ...lRisk, diffLinesNet: 101 })).toBe(false);
    expect(isBypassEligible("L", { ...lRisk, newEndpointExposed: true })).toBe(false);
  });

  it("promotes safely and blocks invalid demotions", () => {
    expect(compareRiskClass("H", "M")).toBeGreaterThan(0);
    expect(
      promoteRisk("L", "H", "auth signal appeared", {
        signal: "auth",
        file: "src/auth/session.ts",
      }),
    ).toMatchObject({
      success: true,
      previousClass: "L",
      newClass: "H",
      escalationEntry: {
        triggerSignal: "auth",
        triggerFile: "src/auth/session.ts",
      },
    });

    expect(getMandatoryActivities("H")).toContain("human_approval");

    expect(() =>
      demoteRisk(
        "H",
        "L",
        { reason: "too noisy", authorizedBy: "developer", reviewDate: "2026-05-17T10:15:00Z" },
        [],
      ),
    ).toThrow(RiskClassificationError);

    expect(() =>
      demoteRisk(
        "H",
        "M",
        { reason: "staging only", authorizedBy: "developer", reviewDate: "2026-05-17T10:15:00Z" },
        [{ type: "file_path", value: "src/auth/session.ts", forcedClass: "H" }],
      ),
    ).toThrow(RiskClassificationError);
  });
});
