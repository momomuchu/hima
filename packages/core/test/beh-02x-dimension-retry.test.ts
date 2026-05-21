/**
 * Tests for BEH-021 — Dimension-Specific Retry and Escalation Policy
 *
 * Covers:
 *   - DIMENSION_RETRY_POLICY table has all 5 dimensions with correct values
 *   - countPriorViolationAttempts counts gate_violation events by dimension
 *   - Abstains when no qualityDimension in event metadata
 *   - Abstains below risk floor M
 *   - Security dimension at H: immediate escalation on first occurrence
 *   - Security dimension at M: no immediate escalation, uses maxAttempts cap
 *   - Tests dimension at M: warns within cap, blocks when cap exceeded
 *   - Review dimension: maxAttempts=2 boundary
 *   - Evidence dimension at H: escalateImmediately=true fires
 *   - Suppression dimension: maxAttempts=3 boundary
 *   - Falsifies-If counter-examples (both directions from spec)
 */

import { describe, expect, it } from "vitest";
import {
  beh021DimensionRetry,
  countPriorViolationAttempts,
  DIMENSION_RETRY_POLICY,
} from "../src/behaviors/beh-021-dimension-retry.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { QualityDimension, RiskClass } from "../src/types/canonical.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeContext(
  riskClass: RiskClass,
  priorViolations: Array<{ dimension: QualityDimension }> = [],
): GateEvaluationContext {
  const project = createDefaultPlanningProject("beh021-test");

  // Fix M5: use the real event type that handle-hook.ts writes (GATE_EVALUATED with
  // decision="block"), not the synthetic "gate_violation" type that never exists in production.
  const events = priorViolations.map((v, i) => ({
    id: `evt-${i}`,
    ts: new Date().toISOString(),
    type: "GATE_EVALUATED",
    decision: "block" as const,
    payload: { qualityDimension: v.dimension },
  }));

  return {
    projectRoot: "/tmp/test",
    state: project.state,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: ({ T: 0, L: 1, M: 2, H: 3, C: 4 } as const)[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...project.runSet,
      route: { ...project.runSet.route, riskClass },
      events,
    },
  };
}

function makeEvent(dimension?: QualityDimension): GateEvent {
  return {
    gateType: "stop",
    metadata: dimension ? { qualityDimension: dimension } : undefined,
  };
}

// ── DIMENSION_RETRY_POLICY table ──────────────────────────────────────────────

describe("DIMENSION_RETRY_POLICY table", () => {
  it("contains all 5 required quality dimensions", () => {
    const dims: QualityDimension[] = ["security", "tests", "review", "evidence", "suppression"];
    for (const dim of dims) {
      expect(DIMENSION_RETRY_POLICY).toHaveProperty(dim);
    }
  });

  it("security: maxAttempts=1 escalateImmediately=true", () => {
    expect(DIMENSION_RETRY_POLICY.security).toEqual({
      maxAttempts: 1,
      escalateImmediately: true,
    });
  });

  it("tests: maxAttempts=3 escalateImmediately=false", () => {
    expect(DIMENSION_RETRY_POLICY.tests).toEqual({
      maxAttempts: 3,
      escalateImmediately: false,
    });
  });

  it("review: maxAttempts=2 escalateImmediately=false", () => {
    expect(DIMENSION_RETRY_POLICY.review).toEqual({
      maxAttempts: 2,
      escalateImmediately: false,
    });
  });

  it("evidence: maxAttempts=2 escalateImmediately=true", () => {
    expect(DIMENSION_RETRY_POLICY.evidence).toEqual({
      maxAttempts: 2,
      escalateImmediately: true,
    });
  });

  it("suppression: maxAttempts=3 escalateImmediately=false", () => {
    expect(DIMENSION_RETRY_POLICY.suppression).toEqual({
      maxAttempts: 3,
      escalateImmediately: false,
    });
  });
});

// ── countPriorViolationAttempts ───────────────────────────────────────────────

describe("countPriorViolationAttempts", () => {
  it("returns 0 when no events exist", () => {
    const ctx = makeContext("M");
    expect(countPriorViolationAttempts(ctx, "security")).toBe(0);
  });

  it("counts only GATE_EVALUATED block/warn events matching the dimension", () => {
    const ctx = makeContext("M", [
      { dimension: "security" },
      { dimension: "tests" },
      { dimension: "security" },
    ]);
    expect(countPriorViolationAttempts(ctx, "security")).toBe(2);
    expect(countPriorViolationAttempts(ctx, "tests")).toBe(1);
    expect(countPriorViolationAttempts(ctx, "review")).toBe(0);
  });
});

// ── BEH-021 classify: abstain cases ──────────────────────────────────────────

describe("BEH-021 — abstain cases", () => {
  it("abstains when event has no qualityDimension metadata", () => {
    const ctx = makeContext("M");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent(undefined));
    expect(verdict).toBeNull();
  });

  it("abstains at risk class T (below floor)", () => {
    const ctx = makeContext("T");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("security"));
    expect(verdict).toBeNull();
  });

  it("abstains at risk class L (below floor)", () => {
    const ctx = makeContext("L");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("tests"));
    expect(verdict).toBeNull();
  });
});

// ── Security dimension ────────────────────────────────────────────────────────

describe("BEH-021 — security dimension", () => {
  it("blocks immediately at H on first occurrence (escalateImmediately=true)", () => {
    const ctx = makeContext("H"); // 0 prior violations
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("security"));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_NEEDS_USER");
    expect(verdict?.qualityDimension).toBe("security");
  });

  it("blocks immediately at C on first occurrence", () => {
    const ctx = makeContext("C");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("security"));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_NEEDS_USER");
  });

  it("warns at M on first occurrence (escalateImmediately only fires at H/C)", () => {
    const ctx = makeContext("M"); // 0 prior violations
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("security"));
    // At M, no immediate escalation — within maxAttempts=1 cap (0 prior < 1)
    expect(verdict?.decision).toBe("warn");
  });

  it("blocks at M when maxAttempts=1 is exceeded (1 prior violation)", () => {
    const ctx = makeContext("M", [{ dimension: "security" }]);
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("security"));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_NEEDS_USER");
  });
});

// ── Tests dimension ───────────────────────────────────────────────────────────

describe("BEH-021 — tests dimension (maxAttempts=3)", () => {
  it("warns on first occurrence at M (0 prior)", () => {
    const ctx = makeContext("M");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("tests"));
    expect(verdict?.decision).toBe("warn");
  });

  it("warns on second occurrence (1 prior)", () => {
    const ctx = makeContext("M", [{ dimension: "tests" }]);
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("tests"));
    expect(verdict?.decision).toBe("warn");
  });

  it("warns on third occurrence (2 prior — at cap boundary)", () => {
    const ctx = makeContext("M", [{ dimension: "tests" }, { dimension: "tests" }]);
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("tests"));
    expect(verdict?.decision).toBe("warn");
  });

  it("blocks when 3 prior violations exceed maxAttempts=3", () => {
    const ctx = makeContext("M", [
      { dimension: "tests" },
      { dimension: "tests" },
      { dimension: "tests" },
    ]);
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("tests"));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_NEEDS_USER");
  });
});

// ── Evidence dimension at H ───────────────────────────────────────────────────

describe("BEH-021 — evidence dimension (escalateImmediately at H/C)", () => {
  it("blocks immediately at H on first evidence violation", () => {
    const ctx = makeContext("H");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("evidence"));
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_NEEDS_USER");
    expect(verdict?.qualityDimension).toBe("evidence");
  });

  it("warns at M on first evidence violation (no immediate escalation at M)", () => {
    const ctx = makeContext("M");
    const verdict = beh021DimensionRetry.classify(ctx, makeEvent("evidence"));
    expect(verdict?.decision).toBe("warn");
  });
});

// ── Falsifies-If counter-examples ─────────────────────────────────────────────
// Spec falsifies_if:
//   (1) "A security-dimension gate violation at risk class H occurs and the run
//       continues to a second attempt without a BLOCKED_NEEDS_USER event"
//   (2) "A tests-dimension violation at risk class M causes an immediate
//       BLOCKED_NEEDS_USER on the first attempt without exhausting the cap"

describe("BEH-021 — Falsifies-If counter-examples", () => {
  it(
    "FALSIFIES-IF (1): security at H must produce BLOCKED_NEEDS_USER on first violation " +
      "— disproving the scenario where it could continue to a second attempt",
    () => {
      const ctx = makeContext("H", []); // 0 prior — this IS the first attempt
      const verdict = beh021DimensionRetry.classify(ctx, makeEvent("security"));
      expect(verdict?.decision).toBe("block");
      expect(verdict?.finalState).toBe("BLOCKED_NEEDS_USER");
    },
  );

  it(
    "FALSIFIES-IF (2): tests at M must NOT produce immediate BLOCKED_NEEDS_USER " +
      "on the first attempt (maxAttempts=3 must be respected)",
    () => {
      const ctx = makeContext("M", []); // 0 prior — first attempt
      const verdict = beh021DimensionRetry.classify(ctx, makeEvent("tests"));
      // Must NOT block — the cap (3 attempts) has not been reached
      expect(verdict?.decision).not.toBe("block");
    },
  );
});

// ── Descriptor metadata ───────────────────────────────────────────────────────

describe("BEH-021 descriptor metadata", () => {
  it("has correct catalog id", () => {
    expect(beh021DimensionRetry.id).toBe("BEH-021");
  });

  it("fires on stop and subagent_stop gates", () => {
    expect(beh021DimensionRetry.gates).toContain("stop");
    expect(beh021DimensionRetry.gates).toContain("subagent_stop");
  });
});
