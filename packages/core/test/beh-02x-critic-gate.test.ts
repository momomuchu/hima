/**
 * Tests for BEH-020 — Critic Gate: Reviewer Required Before Verify-to-Capitalize
 *
 * Covers:
 *   - Abstains when risk class is below M
 *   - Abstains when subPhase is not Verify
 *   - Abstains when reviewer evidence is present (APPROVED)
 *   - Abstains when reviewer evidence is present (CHANGES_REQUIRED)
 *   - Blocks when reviewer evidence is absent at M+
 *   - Blocks at H with no reviewer evidence
 *   - Falsifies-If counter-example: run at M reaches subagent_stop in Verify
 *     with no reviewer evidence → block verdict must fire
 */

import { describe, expect, it } from "vitest";
import {
  beh020CriticGate,
  hasReviewerEvidence,
  REVIEWER_EVIDENCE_PATH,
} from "../src/behaviors/beh-020-critic-gate.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { RiskClass } from "../src/types/canonical.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeContext(
  riskClass: RiskClass,
  subPhase: string = "Verify",
  evidenceItems: unknown[] = [],
): GateEvaluationContext {
  const project = createDefaultPlanningProject("beh020-test");

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
      route: {
        ...project.runSet.route,
        riskClass,
        // biome-ignore lint/suspicious/noExplicitAny: test helper — subPhase is a partial type coercion
        subPhase: subPhase as any,
      },
      // biome-ignore lint/suspicious/noExplicitAny: test helper — evidenceItems is a partial type coercion
      evidence: evidenceItems as any[],
    },
  };
}

function makeEvent(): GateEvent {
  return { gateType: "subagent_stop" };
}

function reviewerEvidenceItem(verdict: string) {
  return {
    id: "rev-001",
    key: REVIEWER_EVIDENCE_PATH,
    kind: "subagent_result",
    status: "accepted",
    summary: "reviewer result",
    createdAt: new Date().toISOString(),
    metadata: { role: "reviewer", verdict },
  };
}

// ── hasReviewerEvidence unit tests ────────────────────────────────────────────

describe("hasReviewerEvidence", () => {
  it("returns false when evidence array is empty", () => {
    const ctx = makeContext("M", "Verify", []);
    expect(hasReviewerEvidence(ctx)).toBe(false);
  });

  it("returns true when APPROVED reviewer record exists", () => {
    const ctx = makeContext("M", "Verify", [reviewerEvidenceItem("APPROVED")]);
    expect(hasReviewerEvidence(ctx)).toBe(true);
  });

  it("returns true when CHANGES_REQUIRED reviewer record exists", () => {
    const ctx = makeContext("M", "Verify", [reviewerEvidenceItem("CHANGES_REQUIRED")]);
    expect(hasReviewerEvidence(ctx)).toBe(true);
  });

  it("returns false when record has wrong key", () => {
    const item = { ...reviewerEvidenceItem("APPROVED"), key: "ci_green" };
    const ctx = makeContext("M", "Verify", [item]);
    expect(hasReviewerEvidence(ctx)).toBe(false);
  });

  it("returns false when record has no metadata.role=reviewer", () => {
    const item = {
      id: "rev-002",
      key: REVIEWER_EVIDENCE_PATH,
      kind: "subagent_result",
      status: "accepted",
      summary: "executor result",
      createdAt: new Date().toISOString(),
      metadata: { role: "executor", verdict: "APPROVED" },
    };
    const ctx = makeContext("M", "Verify", [item]);
    expect(hasReviewerEvidence(ctx)).toBe(false);
  });
});

// ── BEH-020 classifier ────────────────────────────────────────────────────────

describe("BEH-020 — beh020CriticGate.classify", () => {
  it("abstains at risk class T (below enforcement floor)", () => {
    const ctx = makeContext("T", "Verify", []);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict).toBeNull();
  });

  it("abstains at risk class L (below enforcement floor)", () => {
    const ctx = makeContext("L", "Verify", []);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict).toBeNull();
  });

  it("abstains at M when subPhase is not Verify (e.g. Execute)", () => {
    const ctx = makeContext("M", "Execute", []);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict).toBeNull();
  });

  it("abstains at M in Verify when APPROVED reviewer evidence is present", () => {
    const ctx = makeContext("M", "Verify", [reviewerEvidenceItem("APPROVED")]);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict).toBeNull();
  });

  it("abstains at M in Verify when CHANGES_REQUIRED reviewer evidence is present", () => {
    const ctx = makeContext("M", "Verify", [reviewerEvidenceItem("CHANGES_REQUIRED")]);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict).toBeNull();
  });

  it("blocks at M in Verify when no reviewer evidence exists", () => {
    const ctx = makeContext("M", "Verify", []);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.qualityDimension).toBe("review");
    expect(verdict?.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("blocks at H in Verify when no reviewer evidence exists", () => {
    const ctx = makeContext("H", "Verify", []);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict?.decision).toBe("block");
  });

  it("blocks at C in Verify when no reviewer evidence exists", () => {
    const ctx = makeContext("C", "Verify", []);
    const verdict = beh020CriticGate.classify(ctx, makeEvent());
    expect(verdict?.decision).toBe("block");
  });

  // ── Falsifies-If counter-example ───────────────────────────────────────────
  // Spec falsifies_if: "A run at risk class M or above transitions from
  // build/Verify to build/Capitalize and subsequently reaches DONE_VERIFIED
  // without a reviewer evidence record."
  // This test IS that counter-example — it must produce a block, disproving
  // the scenario where a run could slip through without reviewer evidence.

  it(
    "FALSIFIES-IF: M+/Verify without reviewer evidence must always block " +
      "(counter-example that disproves the gap scenario)",
    () => {
      for (const riskClass of ["M", "H", "C"] as const) {
        const ctx = makeContext(riskClass, "Verify", []);
        const verdict = beh020CriticGate.classify(ctx, makeEvent());
        expect(verdict?.decision, `expected block at ${riskClass}`).toBe("block");
      }
    },
  );
});

// ── Descriptor metadata ───────────────────────────────────────────────────────

describe("BEH-020 descriptor metadata", () => {
  it("has the correct catalog id", () => {
    expect(beh020CriticGate.id).toBe("BEH-020");
  });

  it("fires only on subagent_stop gate", () => {
    expect(beh020CriticGate.gates).toEqual(["subagent_stop"]);
  });
});
