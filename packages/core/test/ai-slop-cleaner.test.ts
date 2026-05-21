import { describe, expect, it } from "vitest";
import {
  AI_SLOP_CLEANER_FINDING_IDS,
  evaluateAiSlopCleaner,
} from "../src/security/ai-slop-cleaner.js";

describe("evaluateAiSlopCleaner", () => {
  it("accepts non-cleanup text without requiring HARV-01 evidence", () => {
    const result = evaluateAiSlopCleaner({
      gateType: "post_tool",
      parts: ["implemented runtime bindings and ran tests"],
    });

    expect(result.cleanupTriggered).toBe(false);
    expect(result.accepted).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("requires a cleanup plan and regression evidence for cleanup work", () => {
    const result = evaluateAiSlopCleaner({
      gateType: "post_tool",
      parts: ["Ran an ai-slop cleanup pass over the service boundary."],
    });

    expect(result.cleanupTriggered).toBe(true);
    expect(result.accepted).toBe(false);
    expect(result.findings.map((finding) => finding.id)).toEqual([
      "missing_cleanup_plan",
      "missing_regression_evidence",
    ]);
    expect(result.evidenceAnchors).toEqual([
      "docs/excellence-application/05-architecture/stream-g-harvested-skill-wave.md#harvest-target:missing_cleanup_plan",
      "docs/excellence-application/05-architecture/stream-g-harvested-skill-wave.md#harvest-target:missing_regression_evidence",
    ]);
  });

  it("accepts cleanup work with a plan and unchanged-behavior evidence", () => {
    const result = evaluateAiSlopCleaner({
      gateType: "subagent_stop",
      parts: [
        "cleanup_plan: remove duplicate branches only\nregression_evidence: tests passed and unchanged-behavior evidence recorded",
      ],
    });

    expect(result.cleanupTriggered).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("keeps the finding catalog stable and unique", () => {
    expect(AI_SLOP_CLEANER_FINDING_IDS).toEqual([
      "missing_cleanup_plan",
      "missing_regression_evidence",
    ]);
    expect(new Set(AI_SLOP_CLEANER_FINDING_IDS)).toHaveLength(AI_SLOP_CLEANER_FINDING_IDS.length);
  });
});
