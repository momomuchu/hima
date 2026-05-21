/**
 * Tests for BEH-030 — Subagent Contract Schema Completeness
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §7 BEH-030
 *
 * Falsifies-If regression (from spec):
 *   A subagent is spawned at risk class M or above with a SubagentInput that
 *   lacks the budget or failurePolicy fields without a SUBAGENT_CONTRACT_INCOMPLETE
 *   block verdict being emitted. One such spawn disproves this behavior.
 */

import { describe, expect, it } from "vitest";
import {
  BEH_030_DEGRADED_MODE,
  subagentContractCompleteness,
  VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE,
} from "../src/behaviors/beh-030-subagent-contract.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import { createDefaultPlanningProject } from "../src/storage/planning-store.js";
import type { RiskClass } from "../src/types/canonical.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(riskClass: RiskClass): GateEvaluationContext {
  const project = createDefaultPlanningProject("run_beh030_test");
  return {
    projectRoot: "/tmp/project",
    state: project.state,
    currentRisk: {
      ...project.currentRisk,
      risk_class: riskClass,
      rank: { T: 0, L: 1, M: 2, H: 3, C: 4 }[riskClass],
      bypass_allowed: riskClass === "T" || riskClass === "L",
      human_checkpoint_required: riskClass === "H" || riskClass === "C",
    },
    runSet: {
      ...project.runSet,
      route: { ...project.runSet.route, riskClass },
    },
  };
}

function makeSubagentStartEvent(metadata: Record<string, unknown>): GateEvent {
  return {
    gateType: "subagent_start",
    metadata: {
      agentId: "worker-1",
      task: "implement feature X",
      scope: ["src/"],
      deliverables: ["src/feature.ts"],
      ...metadata,
    },
  };
}

const COMPLETE_BUDGET = { maxTurns: 20, timeoutMs: 60_000 };
const COMPLETE_FAILURE_POLICY = { onTimeout: "gap", onError: "retry", maxRetries: 2 };
const BUDGET_NO_TIMEOUT = { maxTurns: 20 };
// Minimal valid failure policy for M class: both onTimeout and onError present
const MINIMAL_FAILURE_POLICY = { onTimeout: "gap", onError: "block" };

// ── Descriptor shape ──────────────────────────────────────────────────────────

describe("BEH-030 descriptor", () => {
  it("has id BEH-030", () => {
    expect(subagentContractCompleteness.id).toBe("BEH-030");
  });

  it("fires only on subagent_start gate", () => {
    expect(subagentContractCompleteness.gates).toEqual(["subagent_start"]);
  });

  it("exports degraded-mode strings for codex and hermes", () => {
    expect(typeof BEH_030_DEGRADED_MODE.codex).toBe("string");
    expect(typeof BEH_030_DEGRADED_MODE.hermes).toBe("string");
    expect(BEH_030_DEGRADED_MODE.codex.length).toBeGreaterThan(0);
    expect(BEH_030_DEGRADED_MODE.hermes.length).toBeGreaterThan(0);
  });

  it("exports violation type identifier", () => {
    expect(VIOLATION_SUBAGENT_CONTRACT_INCOMPLETE).toBe("SUBAGENT_CONTRACT_INCOMPLETE");
  });
});

// ── T and L risk classes — maxTurns required, failurePolicy not required ────────
// sec-M1 fix: maxTurns is enforced at ALL risk classes (prevents runaway agents
// even at low risk). failurePolicy is only required at M and above.

describe("BEH-030 — T and L risk classes", () => {
  it.each([
    "T",
    "L",
  ] as RiskClass[])("blocks at risk class %s when budget.maxTurns is absent", (riskClass) => {
    const ctx = makeContext(riskClass);
    const event = makeSubagentStartEvent({});
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("maxTurns");
  });

  it.each([
    "T",
    "L",
  ] as RiskClass[])("abstains at risk class %s when budget.maxTurns is present (failurePolicy not required)", (riskClass) => {
    const ctx = makeContext(riskClass);
    const event = makeSubagentStartEvent({ budget: { maxTurns: 10 } });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Risk floor M — required fields ────────────────────────────────────────────

describe("BEH-030 — risk class M", () => {
  it("abstains when budget.maxTurns and failurePolicy are complete", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      budget: BUDGET_NO_TIMEOUT,
      failurePolicy: MINIMAL_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("blocks when budget is entirely absent", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      failurePolicy: MINIMAL_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.violationType).toBe("SUBAGENT_CONTRACT_INCOMPLETE");
    expect(verdict?.reason).toContain("metadata.budget.maxTurns");
  });

  it("blocks when failurePolicy is entirely absent", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({ budget: BUDGET_NO_TIMEOUT });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("metadata.failurePolicy.onTimeout");
    expect(verdict?.reason).toContain("metadata.failurePolicy.onError");
  });

  it("blocks when budget.maxTurns is zero (not positive)", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      budget: { maxTurns: 0 },
      failurePolicy: MINIMAL_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("metadata.budget.maxTurns");
  });

  it("blocks when failurePolicy.onError is an invalid action", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      budget: BUDGET_NO_TIMEOUT,
      failurePolicy: { onTimeout: "gap", onError: "explode" },
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("metadata.failurePolicy.onError");
  });

  it("blocks when onError is retry but maxRetries is absent", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      budget: BUDGET_NO_TIMEOUT,
      failurePolicy: { onTimeout: "gap", onError: "retry" },
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("metadata.failurePolicy.maxRetries");
  });

  it("abstains when onError is retry and maxRetries is 0 (valid zero-retry)", () => {
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      budget: BUDGET_NO_TIMEOUT,
      failurePolicy: { onTimeout: "gap", onError: "retry", maxRetries: 0 },
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("does NOT require timeoutMs at risk class M", () => {
    // timeoutMs is only required at H/C
    const ctx = makeContext("M");
    const event = makeSubagentStartEvent({
      budget: BUDGET_NO_TIMEOUT, // no timeoutMs
      failurePolicy: MINIMAL_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Risk class H — additional timeoutMs required ─────────────────────────────

describe("BEH-030 — risk class H", () => {
  it("abstains when both budget and failurePolicy are complete including timeoutMs", () => {
    const ctx = makeContext("H");
    const event = makeSubagentStartEvent({
      budget: COMPLETE_BUDGET,
      failurePolicy: COMPLETE_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).toBeNull();
  });

  it("blocks when budget.timeoutMs is absent at H", () => {
    const ctx = makeContext("H");
    const event = makeSubagentStartEvent({
      budget: BUDGET_NO_TIMEOUT, // missing timeoutMs
      failurePolicy: COMPLETE_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("metadata.budget.timeoutMs");
  });

  it("includes risk class in block reason", () => {
    const ctx = makeContext("H");
    const event = makeSubagentStartEvent({});
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.reason).toContain("H");
  });
});

// ── Risk class C — same as H ──────────────────────────────────────────────────

describe("BEH-030 — risk class C", () => {
  it("blocks when any required field is absent at C", () => {
    const ctx = makeContext("C");
    const event = makeSubagentStartEvent({ budget: COMPLETE_BUDGET });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("abstains when all fields present at C", () => {
    const ctx = makeContext("C");
    const event = makeSubagentStartEvent({
      budget: COMPLETE_BUDGET,
      failurePolicy: COMPLETE_FAILURE_POLICY,
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict).toBeNull();
  });
});

// ── Falsifies-If regression guard ────────────────────────────────────────────
//
// From spec §7 BEH-030 falsifies_if:
//   "A subagent is spawned at risk class M or above with a SubagentInput that
//    lacks the budget or failurePolicy fields without a SUBAGENT_CONTRACT_INCOMPLETE
//    block verdict being emitted. One such spawn disproves this behavior."

describe("BEH-030 Falsifies-If counter-example regression", () => {
  it("COUNTER-EXAMPLE: M-class spawn with no budget/failurePolicy MUST block (never allow)", () => {
    const ctx = makeContext("M");
    // Minimal SubagentInput — no budget, no failurePolicy
    const event = makeSubagentStartEvent({});
    const verdict = subagentContractCompleteness.classify(ctx, event);

    // This is the falsifying case: if verdict is null or warn, the behavior is broken.
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.violationType).toBe("SUBAGENT_CONTRACT_INCOMPLETE");
  });

  it("COUNTER-EXAMPLE: H-class spawn with only maxTurns (missing timeoutMs) MUST block", () => {
    const ctx = makeContext("H");
    const event = makeSubagentStartEvent({
      budget: { maxTurns: 10 }, // missing timeoutMs
      failurePolicy: { onTimeout: "gap", onError: "block" },
    });
    const verdict = subagentContractCompleteness.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("metadata.budget.timeoutMs");
  });
});
