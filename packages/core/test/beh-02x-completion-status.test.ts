/**
 * Tests for BEH-023 — Three-State Completion Status
 *
 * Covers:
 *   - findIncompleteEvidenceRecords returns empty when all evidence is DONE_VERIFIED
 *   - findIncompleteEvidenceRecords returns empty when completionStatus is absent (backwards compat)
 *   - findIncompleteEvidenceRecords detects DONE_UNTESTED records
 *   - findIncompleteEvidenceRecords detects ATTEMPTED_UNCONFIRMED records
 *   - findIncompleteEvidenceRecords reports worst status correctly
 *   - BEH-023 abstains when all evidence is verified/absent
 *   - BEH-023 warns at T/L with incomplete evidence
 *   - BEH-023 warns at M with incomplete evidence
 *   - BEH-023 blocks at H with incomplete evidence
 *   - BEH-023 blocks at C with incomplete evidence
 *   - Falsifies-If counter-example: H/C + DONE_UNTESTED mandatory record must block
 */

import { describe, expect, it } from "vitest";
import {
  beh023CompletionStatus,
  findIncompleteEvidenceRecords,
  INCOMPLETE_STATUSES,
} from "../src/behaviors/beh-023-completion-status.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import type { CompletionStatus } from "../src/schemas/run-set.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { RiskClass } from "../src/types/canonical.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

type EvidenceItemInput = {
  id: string;
  completionStatus?: CompletionStatus;
  key?: string;
};

function makeContext(
  riskClass: RiskClass,
  evidenceItems: EvidenceItemInput[] = [],
): GateEvaluationContext {
  const project = createDefaultPlanningProject("beh023-test");

  const evidence = evidenceItems.map((item) => ({
    id: item.id,
    key: item.key ?? "ci_green",
    kind: "test_result",
    status: "accepted" as const,
    summary: `evidence item ${item.id}`,
    createdAt: new Date().toISOString(),
    ...(item.completionStatus !== undefined ? { completionStatus: item.completionStatus } : {}),
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
      // biome-ignore lint/suspicious/noExplicitAny: test helper — evidence is a partial type coercion
      evidence: evidence as any,
    },
  };
}

function makeStopEvent(): GateEvent {
  return { gateType: "stop" };
}

// ── INCOMPLETE_STATUSES catalog ───────────────────────────────────────────────

describe("INCOMPLETE_STATUSES catalog", () => {
  it("contains DONE_UNTESTED and ATTEMPTED_UNCONFIRMED", () => {
    expect(INCOMPLETE_STATUSES).toContain("DONE_UNTESTED");
    expect(INCOMPLETE_STATUSES).toContain("ATTEMPTED_UNCONFIRMED");
  });

  it("does NOT contain DONE_VERIFIED", () => {
    expect(INCOMPLETE_STATUSES).not.toContain("DONE_VERIFIED");
  });
});

// ── findIncompleteEvidenceRecords ─────────────────────────────────────────────

describe("findIncompleteEvidenceRecords", () => {
  it("returns empty result when evidence array is empty", () => {
    const ctx = makeContext("M", []);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.incompleteIds).toHaveLength(0);
    expect(result.worstStatus).toBeNull();
  });

  it("returns empty result when all items have DONE_VERIFIED status", () => {
    const ctx = makeContext("M", [
      { id: "ev-1", completionStatus: "DONE_VERIFIED" },
      { id: "ev-2", completionStatus: "DONE_VERIFIED" },
    ]);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.incompleteIds).toHaveLength(0);
    expect(result.worstStatus).toBeNull();
  });

  it("returns empty when completionStatus is absent (backwards compat — treated as DONE_VERIFIED)", () => {
    const ctx = makeContext("M", [
      { id: "ev-1" }, // no completionStatus field
      { id: "ev-2" }, // no completionStatus field
    ]);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.incompleteIds).toHaveLength(0);
    expect(result.worstStatus).toBeNull();
  });

  it("detects a DONE_UNTESTED record", () => {
    const ctx = makeContext("M", [
      { id: "ev-1", completionStatus: "DONE_VERIFIED" },
      { id: "ev-2", completionStatus: "DONE_UNTESTED" },
    ]);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.incompleteIds).toContain("ev-2");
    expect(result.incompleteIds).not.toContain("ev-1");
    expect(result.worstStatus).toBe("DONE_UNTESTED");
  });

  it("detects an ATTEMPTED_UNCONFIRMED record", () => {
    const ctx = makeContext("M", [{ id: "ev-1", completionStatus: "ATTEMPTED_UNCONFIRMED" }]);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.incompleteIds).toContain("ev-1");
    expect(result.worstStatus).toBe("ATTEMPTED_UNCONFIRMED");
  });

  it("reports ATTEMPTED_UNCONFIRMED as worst when mixed with DONE_UNTESTED", () => {
    const ctx = makeContext("M", [
      { id: "ev-1", completionStatus: "DONE_UNTESTED" },
      { id: "ev-2", completionStatus: "ATTEMPTED_UNCONFIRMED" },
    ]);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.incompleteIds).toHaveLength(2);
    expect(result.worstStatus).toBe("ATTEMPTED_UNCONFIRMED");
  });

  it("reports DONE_UNTESTED as worst when only DONE_UNTESTED is present", () => {
    const ctx = makeContext("M", [
      { id: "ev-1", completionStatus: "DONE_UNTESTED" },
      { id: "ev-2", completionStatus: "DONE_UNTESTED" },
    ]);
    const result = findIncompleteEvidenceRecords(ctx);
    expect(result.worstStatus).toBe("DONE_UNTESTED");
  });
});

// ── BEH-023 classify: abstain cases ──────────────────────────────────────────

describe("BEH-023 — abstain cases", () => {
  it("abstains when evidence array is empty", () => {
    const ctx = makeContext("H", []);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict).toBeNull();
  });

  it("abstains when all items have DONE_VERIFIED status", () => {
    const ctx = makeContext("H", [{ id: "ev-1", completionStatus: "DONE_VERIFIED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict).toBeNull();
  });

  it("abstains when completionStatus is absent on all items", () => {
    const ctx = makeContext("H", [{ id: "ev-1" }, { id: "ev-2" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict).toBeNull();
  });
});

// ── BEH-023 classify: warn at T ───────────────────────────────────────────────

describe("BEH-023 — warn at risk class T", () => {
  it("warns (not blocks) at T with DONE_UNTESTED evidence", () => {
    const ctx = makeContext("T", [{ id: "ev-1", completionStatus: "DONE_UNTESTED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.finalState).toBe("DONE_WITH_GAPS");
    expect(verdict?.qualityDimension).toBe("evidence");
  });

  it("warns (not blocks) at T with ATTEMPTED_UNCONFIRMED evidence", () => {
    const ctx = makeContext("T", [{ id: "ev-1", completionStatus: "ATTEMPTED_UNCONFIRMED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("warn");
  });
});

// ── BEH-023 classify: warn at L ───────────────────────────────────────────────

describe("BEH-023 — warn at risk class L", () => {
  it("warns at L with incomplete evidence", () => {
    const ctx = makeContext("L", [{ id: "ev-1", completionStatus: "DONE_UNTESTED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.finalState).toBe("DONE_WITH_GAPS");
  });
});

// ── BEH-023 classify: warn at M ───────────────────────────────────────────────

describe("BEH-023 — warn at risk class M", () => {
  it("warns at M with DONE_UNTESTED evidence", () => {
    const ctx = makeContext("M", [{ id: "ev-1", completionStatus: "DONE_UNTESTED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.qualityDimension).toBe("evidence");
  });
});

// ── BEH-023 classify: block at H ─────────────────────────────────────────────

describe("BEH-023 — block at risk class H", () => {
  it("blocks at H with DONE_UNTESTED evidence", () => {
    const ctx = makeContext("H", [{ id: "ev-1", completionStatus: "DONE_UNTESTED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_POLICY");
    expect(verdict?.qualityDimension).toBe("evidence");
    expect(verdict?.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("blocks at H with ATTEMPTED_UNCONFIRMED evidence", () => {
    const ctx = makeContext("H", [{ id: "ev-1", completionStatus: "ATTEMPTED_UNCONFIRMED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_POLICY");
  });

  it("block reason includes affected record IDs", () => {
    const ctx = makeContext("H", [
      { id: "ev-alpha", completionStatus: "DONE_UNTESTED" },
      { id: "ev-beta", completionStatus: "ATTEMPTED_UNCONFIRMED" },
    ]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.reason).toContain("ev-alpha");
    expect(verdict?.reason).toContain("ev-beta");
  });
});

// ── BEH-023 classify: block at C ─────────────────────────────────────────────

describe("BEH-023 — block at risk class C", () => {
  it("blocks at C with DONE_UNTESTED evidence", () => {
    const ctx = makeContext("C", [{ id: "ev-1", completionStatus: "DONE_UNTESTED" }]);
    const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
    expect(verdict?.decision).toBe("block");
    expect(verdict?.finalState).toBe("BLOCKED_POLICY");
  });
});

// ── Falsifies-If counter-example ──────────────────────────────────────────────
// Spec: "A run at risk class H or C reaches DONE_VERIFIED where any mandatory
// evidence record carries completionStatus: 'DONE_UNTESTED' without a subsequent
// record upgrading it to 'DONE_VERIFIED'."

describe("BEH-023 — Falsifies-If counter-example", () => {
  it(
    "FALSIFIES-IF: H/C with DONE_UNTESTED evidence must always block " +
      "(disproving that DONE_VERIFIED can be reached with untested evidence)",
    () => {
      for (const riskClass of ["H", "C"] as const) {
        const ctx = makeContext(riskClass, [
          { id: "mandatory-ev", completionStatus: "DONE_UNTESTED" },
        ]);
        const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
        expect(verdict?.decision, `expected block at ${riskClass}`).toBe("block");
        expect(verdict?.finalState, `expected BLOCKED_POLICY at ${riskClass}`).toBe(
          "BLOCKED_POLICY",
        );
      }
    },
  );

  it("FALSIFIES-IF: H/C with ATTEMPTED_UNCONFIRMED evidence must always block", () => {
    for (const riskClass of ["H", "C"] as const) {
      const ctx = makeContext(riskClass, [
        { id: "unconfirmed-ev", completionStatus: "ATTEMPTED_UNCONFIRMED" },
      ]);
      const verdict = beh023CompletionStatus.classify(ctx, makeStopEvent());
      expect(verdict?.decision, `expected block at ${riskClass}`).toBe("block");
    }
  });
});

// ── Descriptor metadata ───────────────────────────────────────────────────────

describe("BEH-023 descriptor metadata", () => {
  it("has correct catalog id", () => {
    expect(beh023CompletionStatus.id).toBe("BEH-023");
  });

  it("fires only on the stop gate", () => {
    expect(beh023CompletionStatus.gates).toEqual(["stop"]);
  });
});
