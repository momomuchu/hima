/**
 * Tests for BEH-013 — Calibrated Uncertainty / Claim Source Field
 *
 * Ported from packages/core/test/beh-013-claim-source.test.ts
 * Adapted for behavior-core v2:
 *   - Imports use local paths (behavior-registry.js, gate-event.js, run-set-types.js)
 *   - EvidenceItem in v2 has no `kind` or `summary` fields
 *   - No PlanningStateFile or schema imports
 *
 * Falsifies-If counter-example (required passing test):
 *   A run at risk class M or above that reaches the stop gate where a mandatory
 *   evidence key has no record with claimSource: "verified" MUST produce a violation.
 *   A run where all mandatory keys have at least one "verified" record MUST abstain.
 */

import { describe, expect, it } from "vitest";
import { claimSource } from "../src/behaviors/beh-013-claim-source.js";
import type { GateEvaluationContext } from "../src/behavior-registry.js";
import type { GateEvent } from "../src/gate-event.js";
import type { CurrentRiskFile, EvidenceItem, RunSetFile } from "../src/run-set-types.js";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeContext(
  riskClass: string,
  evidence: Partial<EvidenceItem>[],
  mandatoryKeys: string[] = [],
): GateEvaluationContext {
  const policy = {
    riskPolicies:
      mandatoryKeys.length > 0
        ? { [riskClass]: { mandatoryEvidenceKeys: mandatoryKeys } }
        : {},
  };

  return {
    projectRoot: "/project",
    currentRisk: { risk_class: riskClass } as unknown as CurrentRiskFile,
    runSet: {
      runId: "test-run",
      policy,
      evidence: evidence as EvidenceItem[],
      events: [],
      subagents: [],
    } as unknown as RunSetFile,
  };
}

function makeStopEvent(): GateEvent {
  return { gateType: "stop" };
}

function makeEvidenceItem(
  key: string,
  claimSourceValue: string | undefined,
  createdAt = "2026-05-20T10:00:00Z",
): Partial<EvidenceItem> {
  return {
    id: `ev-${key}`,
    key: key as EvidenceItem["key"],
    status: "accepted",
    source: "agent",
    claimSource: claimSourceValue as EvidenceItem["claimSource"],
    createdAt,
  };
}

// ── Module metadata ───────────────────────────────────────────────────────────

describe("BEH-013 descriptor", () => {
  it("has the correct id and name", () => {
    expect(claimSource.id).toBe("BEH-013");
    expect(claimSource.name).toBe("Calibrated Uncertainty — Claim Source Field");
  });

  it("fires only on stop gate", () => {
    expect(claimSource.gates).toEqual(["stop"]);
  });
});

// ── Abstain cases ─────────────────────────────────────────────────────────────

describe("BEH-013 — abstain cases", () => {
  it("abstains when evidence set is empty at risk class T (below risk floor)", () => {
    const ctx = makeContext("T", []);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });

  it("abstains at M when all mandatory baseline keys have at least one verified record", () => {
    const mMandatoryKeys = [
      "ci_green", "sast_clean", "secrets_clean", "integration_tests",
      "review_1", "sbom", "product_validation",
    ] as const;
    const evidence = mMandatoryKeys.map((k) => makeEvidenceItem(k, "verified"));
    const ctx = makeContext("M", evidence);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });

  it("abstains when all mandatory keys have a verified record", () => {
    const ctx = makeContext(
      "M",
      [makeEvidenceItem("ci_green", "verified"), makeEvidenceItem("sast_clean", "verified")],
      ["ci_green", "sast_clean"],
    );
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });

  it("abstains at risk class T with missing claimSource — risk floor is M", () => {
    const ctx = makeContext("T", [makeEvidenceItem("ci_green", undefined)]);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });
});

// ── Violation detection — missing claimSource field ──────────────────────────

describe("BEH-013 — missing claimSource field violations", () => {
  it("abstains at risk class T when any item lacks claimSource — risk floor is M", () => {
    const ctx = makeContext("T", [makeEvidenceItem("ci_green", undefined)]);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });

  it("produces BLOCK at risk class M when any item lacks claimSource", () => {
    const ctx = makeContext("M", [
      makeEvidenceItem("ci_green", "verified"),
      makeEvidenceItem("sast_clean", undefined),
    ]);
    const event = makeStopEvent();
    const verdict = claimSource.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-013");
    expect(verdict?.reason).toContain("missing the claimSource field");
  });

  it("produces BLOCK at risk class H when any item lacks claimSource", () => {
    const ctx = makeContext("H", [makeEvidenceItem("review_1", undefined)]);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)?.decision).toBe("block");
  });
});

// ── Violation detection — mandatory key without verified record ───────────────

describe("BEH-013 — unverified mandatory evidence violations", () => {
  it("produces BLOCK at M when mandatory key has only inferred records", () => {
    const ctx = makeContext("M", [makeEvidenceItem("ci_green", "inferred")], ["ci_green"]);
    const event = makeStopEvent();
    const verdict = claimSource.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("ci_green");
    expect(verdict?.reason).toContain("verified");
  });

  it("produces BLOCK at M when mandatory key has only external records", () => {
    const ctx = makeContext("M", [makeEvidenceItem("sast_clean", "external")], ["sast_clean"]);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)?.decision).toBe("block");
  });

  it("produces BLOCK at M when mandatory key has only training records", () => {
    const ctx = makeContext(
      "M",
      [makeEvidenceItem("integration_tests", "training")],
      ["integration_tests"],
    );
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)?.decision).toBe("block");
  });

  it("abstains when mandatory key has at least one verified record (even if others inferred)", () => {
    const ctx = makeContext(
      "M",
      [
        makeEvidenceItem("ci_green", "inferred"),
        makeEvidenceItem("ci_green", "verified"),
      ],
      ["ci_green"],
    );
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });
});

// ── Falsifies-If counter-example (MUST pass) ─────────────────────────────────

describe("BEH-013 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: stop gate at M with mandatory key having no verified record MUST block", () => {
    const ctx = makeContext(
      "M",
      [makeEvidenceItem("ci_green", "inferred"), makeEvidenceItem("ci_green", "external")],
      ["ci_green"],
    );
    const event = makeStopEvent();
    const verdict = claimSource.classify(ctx, event);

    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("ci_green");
  });

  it("FALSIFIES-IF: stop gate at M with all mandatory keys verified MUST NOT block", () => {
    const ctx = makeContext("M", [makeEvidenceItem("ci_green", "verified")], ["ci_green"]);
    const event = makeStopEvent();
    expect(claimSource.classify(ctx, event)).toBeNull();
  });
});
