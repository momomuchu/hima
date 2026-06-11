// Regression test: riskClass=T without written code → stop gate must allow.
//
// This covers the bug described in PROPOSITION.md §8 / amendement §12:
//   baseline-policy.ts declares requiresEvidenceBeforeStop: false for T, but
//   the original evaluateStop() in @harness/core never reads that field, causing
//   T-risk runs to be blocked with DONE_WITHOUT_EVIDENCE even when no code was
//   written (ci_green/sast_clean/secrets_clean evidence is absent).

import { describe, expect, it } from "vitest";
import { evaluateGate, type GateEvaluationContext } from "../src/index.js";

// Minimal context factory using the same shape as @harness/core's planning-store.
function makeContext(overrides: Partial<GateEvaluationContext> = {}): GateEvaluationContext {
  const now = new Date().toISOString();
  return {
    projectRoot: "/tmp/test-project",
    state: {
      version: 1,
      run_id: "run_test",
      phase: "discovery",
      sub_phase: "Observer",
      mode: "auto",
      active_gates: ["session_start", "user_prompt", "pre_tool", "post_tool", "stop"],
      last_gate_type: null,
      status: "active",
      updated_at: now,
    },
    currentRisk: {
      version: 1,
      run_id: "run_test",
      risk_class: "T",
      rank: 0,
      bypass_allowed: true,
      human_checkpoint_required: false,
      forcing_signals: [],
      updated_at: now,
    },
    runSet: {
      version: 1,
      run_id: "run_test",
      route: {
        phase: "discovery",
        subPhase: "Observer",
        mode: "auto",
        riskClass: "T",
      },
      intent: {},
      policy: {},
      project: {},
      evidence: [],
      events: [],
      subagents: [],
      runtimeBindings: [],
    },
    ...overrides,
  };
}

describe("evaluateGate — stop gate regression", () => {
  it("riskClass=T without evidence → stop returns allow (requiresEvidenceBeforeStop=false)", () => {
    const ctx = makeContext();
    const result = evaluateGate(ctx, { gateType: "stop" });

    expect(result.decision).toBe("allow");
    expect(result.finalState).toBe("DONE_VERIFIED");
    expect(result.violationType).toBeUndefined();
  });

  it("riskClass=L without evidence → stop returns allow (requiresEvidenceBeforeStop=false)", () => {
    const ctx = makeContext({
      currentRisk: {
        ...makeContext().currentRisk,
        risk_class: "L",
        rank: 1,
        bypass_allowed: true,
      },
      runSet: {
        ...makeContext().runSet,
        route: { ...makeContext().runSet.route, riskClass: "L" },
      },
    });
    const result = evaluateGate(ctx, { gateType: "stop" });

    expect(result.decision).toBe("allow");
    expect(result.finalState).toBe("DONE_VERIFIED");
  });

  it("riskClass=M without evidence → stop blocks with DONE_WITHOUT_EVIDENCE", () => {
    const ctx = makeContext({
      currentRisk: {
        ...makeContext().currentRisk,
        risk_class: "M",
        rank: 2,
        bypass_allowed: false,
      },
      runSet: {
        ...makeContext().runSet,
        route: { ...makeContext().runSet.route, riskClass: "M" },
      },
    });
    const result = evaluateGate(ctx, { gateType: "stop" });

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("DONE_WITHOUT_EVIDENCE");
  });

  it("riskClass=T with unresolved policy violations → stop blocks", () => {
    const ts = new Date(Date.now() - 1000).toISOString();
    const ctx = makeContext({
      runSet: {
        ...makeContext().runSet,
        evidence: [],
        events: [
          {
            type: "GATE_EVALUATED",
            gateType: "post_tool",
            ts,
            decision: "warn",
            reason: "plaintext secret detected",
            payload: {
              finalState: "BLOCKED_POLICY",
              violationType: "SECRET_IN_PLAINTEXT",
            },
          },
        ],
      },
    });
    const result = evaluateGate(ctx, { gateType: "stop" });

    expect(result.decision).toBe("block");
    expect(result.violationType).toBe("UNRESOLVED_POLICY_VIOLATION");
  });

  it("riskClass=T in full-bypass mode → stop allows even with no evidence", () => {
    const ctx = makeContext({
      state: {
        ...makeContext().state,
        mode: "full-bypass",
      },
    });
    const result = evaluateGate(ctx, { gateType: "stop" });

    expect(result.decision).toBe("allow");
    expect(result.finalState).toBe("DONE_VERIFIED");
  });
});
