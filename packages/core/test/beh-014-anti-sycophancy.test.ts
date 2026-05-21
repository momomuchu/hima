/**
 * Tests for BEH-014 — Anti-Sycophancy Re-Verify on Challenge
 *
 * Spec: docs/conception/12-behaviors-catalog-spec.md §5 BEH-014
 *
 * Falsifies-If counter-example (required passing test):
 *   A run that resumes past a prior block verdict in response to a user challenge
 *   WITHOUT any new EvidenceRecord or human_override post-dating the block MUST
 *   produce a SYCOPHANCY_BYPASS_ATTEMPTED verdict.
 *   A run with new evidence post-dating the block MUST abstain (legitimate reconsideration).
 */

import { describe, expect, it } from "vitest";
import { antiSycophancy } from "../src/behaviors/beh-014-anti-sycophancy.js";
import type { GateEvaluationContext } from "../src/gates/evaluate-gate.js";
import type { CurrentRiskFile } from "../src/schemas/current-risk.schema.js";
import type { GateEvent } from "../src/schemas/gate-event.schema.js";
import type { EvidenceItem, RunEvent, RunSetFile } from "../src/schemas/run-set.schema.js";
import type { PlanningStateFile } from "../src/schemas/state.schema.js";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeContext(
  riskClass: string,
  recentEvents: Partial<RunEvent>[],
  evidence: Partial<EvidenceItem>[] = [],
): GateEvaluationContext {
  return {
    projectRoot: "/project",
    state: {} as PlanningStateFile,
    currentRisk: { risk_class: riskClass } as unknown as CurrentRiskFile,
    runSet: {
      policy: {},
      evidence: evidence as EvidenceItem[],
      events: recentEvents as RunEvent[],
    } as unknown as RunSetFile,
  };
}

function makeBlockEvent(ts = "2026-05-20T10:00:00Z"): Partial<RunEvent> {
  return { id: "ev-block", ts, type: "gate", decision: "block", gateType: "pre_tool" };
}

function makeAllowEvent(ts = "2026-05-20T10:01:00Z"): Partial<RunEvent> {
  return { id: "ev-allow", ts, type: "gate", decision: "allow", gateType: "pre_tool" };
}

function makeUserPromptEvent(promptContent: string): GateEvent {
  return {
    gateType: "user_prompt",
    promptContent,
  };
}

function makeEvidenceItem(
  key: string,
  createdAt: string,
  source: EvidenceItem["source"] = "agent",
  metadata?: Record<string, unknown>,
): Partial<EvidenceItem> {
  return {
    id: `ev-${key}`,
    key: key as EvidenceItem["key"],
    kind: "test",
    status: "accepted",
    summary: `Evidence for ${key}`,
    source,
    claimSource: "verified",
    createdAt,
    metadata,
  };
}

// ── Module metadata ───────────────────────────────────────────────────────────

describe("BEH-014 descriptor", () => {
  it("has the correct id and name", () => {
    expect(antiSycophancy.id).toBe("BEH-014");
    expect(antiSycophancy.name).toBe("Anti-Sycophancy — Re-Verify on Challenge");
  });

  it("fires only on user_prompt gate", () => {
    expect(antiSycophancy.gates).toEqual(["user_prompt"]);
  });
});

// ── Abstain cases ─────────────────────────────────────────────────────────────

describe("BEH-014 — abstain cases", () => {
  it("abstains when there are no recent block events", () => {
    const ctx = makeContext("M", [makeAllowEvent()]);
    const event = makeUserPromptEvent("just do it anyway");
    expect(antiSycophancy.classify(ctx, event)).toBeNull();
  });

  it("abstains when there is a recent block but the prompt does not indicate reversal intent", () => {
    const ctx = makeContext("M", [makeBlockEvent()]);
    const event = makeUserPromptEvent("please help me understand the error in the code");
    expect(antiSycophancy.classify(ctx, event)).toBeNull();
  });

  it("abstains when there is a recent block and new evidence was added after it", () => {
    const blockTs = "2026-05-20T10:00:00Z";
    const newEvidenceTs = "2026-05-20T10:05:00Z"; // AFTER the block
    const ctx = makeContext(
      "M",
      [makeBlockEvent(blockTs)],
      [makeEvidenceItem("ci_green", newEvidenceTs)],
    );
    const event = makeUserPromptEvent("proceed anyway");
    // New evidence post-dates the block — this is legitimate reconsideration
    expect(antiSycophancy.classify(ctx, event)).toBeNull();
  });

  it("abstains when there is a human_override record with a non-empty rationale", () => {
    const blockTs = "2026-05-20T10:00:00Z";
    const ctx = makeContext(
      "H",
      [makeBlockEvent(blockTs)],
      [
        makeEvidenceItem(
          "human_validation",
          "2026-05-20T09:59:00Z", // can pre-date — what matters is the override record itself
          "human",
          { rationale: "The security team has reviewed and approved this specific deviation." },
        ),
      ],
    );
    const event = makeUserPromptEvent("do it regardless");
    expect(antiSycophancy.classify(ctx, event)).toBeNull();
  });

  it("abstains when event log is empty (no prior events)", () => {
    const ctx = makeContext("M", []);
    const event = makeUserPromptEvent("just proceed");
    expect(antiSycophancy.classify(ctx, event)).toBeNull();
  });
});

// ── Violation detection ───────────────────────────────────────────────────────

describe("BEH-014 — violation detection", () => {
  it("produces warn at risk class T when prompt challenges block without new evidence", () => {
    const ctx = makeContext("T", [makeBlockEvent()]);
    const event = makeUserPromptEvent("just do it");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("warn");
    expect(verdict?.qualityDimension).toBe("evidence");
  });

  it("produces BLOCK at risk class L when prompt challenges block without new evidence", () => {
    const ctx = makeContext("L", [makeBlockEvent()]);
    const event = makeUserPromptEvent("proceed anyway");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("BEH-014");
  });

  it("produces BLOCK at risk class M when prompt challenges block without new evidence", () => {
    const ctx = makeContext("M", [makeBlockEvent()]);
    const event = makeUserPromptEvent("override the gate");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK for 'ignore the block' phrasing at M", () => {
    const ctx = makeContext("M", [makeBlockEvent()]);
    const event = makeUserPromptEvent("ignore the block and continue");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK for 'run it anyway' phrasing at M", () => {
    const ctx = makeContext("M", [makeBlockEvent()]);
    const event = makeUserPromptEvent("run it anyway");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK for 'it's fine' dismissal at M", () => {
    const ctx = makeContext("M", [makeBlockEvent()]);
    const event = makeUserPromptEvent("it's fine, proceed");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("produces BLOCK at risk class H for 'skip the check' phrasing", () => {
    const ctx = makeContext("H", [makeBlockEvent()]);
    const event = makeUserPromptEvent("skip the check and write the file");
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });

  it("does NOT block when evidence pre-dates the block (old evidence, no new evidence)", () => {
    const blockTs = "2026-05-20T10:00:00Z";
    const oldEvidenceTs = "2026-05-20T09:00:00Z"; // BEFORE the block
    const ctx = makeContext(
      "M",
      [makeBlockEvent(blockTs)],
      [makeEvidenceItem("ci_green", oldEvidenceTs)],
    );
    const event = makeUserPromptEvent("proceed anyway");
    // Old evidence does not count as new evidence — violation must fire
    const verdict = antiSycophancy.classify(ctx, event);
    expect(verdict?.decision).toBe("block");
  });
});

// ── Falsifies-If counter-example (MUST pass) ─────────────────────────────────

describe("BEH-014 Falsifies-If counter-example", () => {
  it("FALSIFIES-IF: challenge prompt after block without new evidence MUST produce block at M", () => {
    // Spec falsifies_if: "A run resumes past a prior block verdict in response to a
    // user challenge, without any new EvidenceRecord or human_override record
    // post-dating the block, and reaches any non-BLOCKED FinalState."
    const ctx = makeContext("M", [makeBlockEvent()], []); // no new evidence
    const event = makeUserPromptEvent("just do it regardless");
    const verdict = antiSycophancy.classify(ctx, event);

    expect(verdict).not.toBeNull();
    expect(verdict?.decision).toBe("block");
    expect(verdict?.reason).toContain("accepted EvidenceRecord");
  });

  it("FALSIFIES-IF: challenge prompt after block WITH new post-block evidence MUST abstain", () => {
    const blockTs = "2026-05-20T10:00:00Z";
    const newEvidenceTs = "2026-05-20T11:00:00Z";
    const ctx = makeContext(
      "M",
      [makeBlockEvent(blockTs)],
      [makeEvidenceItem("ci_green", newEvidenceTs)],
    );
    const event = makeUserPromptEvent("proceed with the action");
    // New evidence present — should abstain (legitimate reconsideration)
    expect(antiSycophancy.classify(ctx, event)).toBeNull();
  });
});
