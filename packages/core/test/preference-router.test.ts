import { describe, expect, it } from "vitest";
import {
  evaluatePreferenceRoutes,
  PREFERENCE_ROUTE_REJECTION_REASONS,
} from "../src/routing/preference-router.js";

describe("preference router", () => {
  it("selects the highest scored eligible route and breaks ordering by priority", () => {
    const result = evaluatePreferenceRoutes({
      signals: {
        cliAvailable: true,
        runtimeAuthorized: true,
      },
      candidates: [
        {
          id: "codex-fast",
          routeId: "adapter-codex",
          score: 4,
          priority: 20,
          requiredSignals: ["cliAvailable"],
        },
        {
          id: "claude-deep",
          routeId: "adapter-claude",
          score: 4,
          priority: 30,
          requiredSignals: ["runtimeAuthorized"],
        },
        {
          id: "hermes-missing",
          routeId: "adapter-hermes",
          score: 5,
          priority: 100,
          requiredSignals: ["hermesAvailable"],
        },
      ],
    });

    expect(result.decision).toBe("select_route");
    expect(result.selectedCandidateId).toBe("claude-deep");
    expect(result.selectedRouteId).toBe("adapter-claude");
    expect(
      result.evaluations.find((entry) => entry.candidateId === "hermes-missing"),
    ).toMatchObject({
      status: "rejected",
      rejectionReasons: ["missing_required_signal"],
      missingSignals: ["hermesAvailable"],
    });
  });

  it("requires more evaluation when top candidates tie on score and priority", () => {
    const result = evaluatePreferenceRoutes({
      signals: { runtimeAuthorized: true },
      candidates: [
        {
          id: "codex",
          score: 3,
          priority: 10,
          requiredSignals: ["runtimeAuthorized"],
        },
        {
          id: "claude",
          score: 3,
          priority: 10,
          requiredSignals: ["runtimeAuthorized"],
        },
      ],
    });

    expect(result.decision).toBe("needs_evaluation");
    expect(result.selectedRouteId).toBeNull();
    expect(result.tiedCandidateIds).toEqual(["claude", "codex"]);
  });

  it("rejects killed candidates and candidates at or below the score floor", () => {
    const result = evaluatePreferenceRoutes({
      signals: {
        runtimeAuthorized: true,
        budgetExceeded: true,
      },
      scoreFloor: 1,
      candidates: [
        {
          id: "codex",
          score: 5,
          requiredSignals: ["runtimeAuthorized"],
          killSignals: ["budgetExceeded"],
        },
        {
          id: "local-fallback",
          score: 1,
          requiredSignals: ["runtimeAuthorized"],
        },
      ],
    });

    expect(result.decision).toBe("reject_all");
    expect(result.evaluations).toMatchObject([
      {
        candidateId: "codex",
        status: "rejected",
        rejectionReasons: ["killed_by_signal"],
        triggeredKillSignals: ["budgetExceeded"],
      },
      {
        candidateId: "local-fallback",
        status: "rejected",
        rejectionReasons: ["score_below_floor"],
      },
    ]);
  });

  it("surfaces missing signals when no candidate has enough evidence", () => {
    const result = evaluatePreferenceRoutes({
      candidates: [
        {
          id: "claude",
          score: 5,
          requiredSignals: ["runtimeAuthorized", "transcriptRetention"],
        },
        {
          id: "codex",
          score: 4,
          requiredSignals: ["runtimeAuthorized"],
        },
      ],
    });

    expect(result.decision).toBe("needs_evidence");
    expect(result.missingSignals).toEqual(["runtimeAuthorized", "transcriptRetention"]);
    expect(result.reason).toContain("runtimeAuthorized");
  });

  it("keeps rejection reasons unique and ordered", () => {
    expect(new Set(PREFERENCE_ROUTE_REJECTION_REASONS).size).toBe(
      PREFERENCE_ROUTE_REJECTION_REASONS.length,
    );
    expect(PREFERENCE_ROUTE_REJECTION_REASONS).toEqual([
      "missing_required_signal",
      "killed_by_signal",
      "score_below_floor",
    ]);
  });
});
